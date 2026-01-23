"""
Database connection and session management for MSSQL Server.
"""
import pyodbc
from typing import Optional
from contextlib import contextmanager, asynccontextmanager
from queue import Queue, Empty, Full
from threading import Lock, RLock
import time
import asyncio
from concurrent.futures import ThreadPoolExecutor
from app.config import settings
import logging

logger = logging.getLogger(__name__)

# Global thread pool executor for async database operations
_db_executor: Optional[ThreadPoolExecutor] = None

def get_db_executor() -> ThreadPoolExecutor:
    """Get or create the database thread pool executor."""
    global _db_executor
    if _db_executor is None:
        _db_executor = ThreadPoolExecutor(max_workers=settings.DB_POOL_SIZE + settings.DB_POOL_MAX_OVERFLOW, thread_name_prefix="db_worker")
    return _db_executor


class ConnectionPool:
    """Thread-safe connection pool for database connections."""
    
    def __init__(self, connection_string: str, pool_size: int = 10, max_overflow: int = 5):
        """
        Initialize connection pool.
        
        Args:
            connection_string: Database connection string
            pool_size: Number of connections to maintain in pool
            max_overflow: Maximum additional connections beyond pool_size
        """
        self.connection_string = connection_string
        self.pool_size = pool_size
        self.max_overflow = max_overflow
        self._pool: Queue = Queue(maxsize=pool_size)
        self._overflow_count = 0
        self._lock = RLock()
        self._created_connections = 0
        
        # Pre-populate pool with initial connections
        for _ in range(min(2, pool_size)):  # Start with 2 connections
            try:
                conn = self._create_connection()
                self._pool.put(conn)
                self._created_connections += 1
            except Exception as e:
                logger.warning(f"Failed to pre-create connection: {e}")
    
    def _create_connection(self) -> pyodbc.Connection:
        """Create a new database connection."""
        conn = pyodbc.connect(self.connection_string, timeout=5)
        conn.autocommit = False
        return conn
    
    def _is_connection_alive(self, conn: pyodbc.Connection) -> bool:
        """Check if connection is still alive by executing a simple query."""
        try:
            if conn is None or not hasattr(conn, 'cursor'):
                return False
            # Quick test query to verify connection is actually working
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
            cursor.close()
            return True
        except (pyodbc.OperationalError, pyodbc.InterfaceError, pyodbc.DatabaseError, Exception):
            return False
    
    def get_connection(self, timeout: float = 5.0) -> pyodbc.Connection:
        """
        Get a connection from the pool.
        
        Args:
            timeout: Maximum time to wait for a connection
            
        Returns:
            Database connection
        """
        with self._lock:
            # Try to get from pool
            try:
                conn = self._pool.get(timeout=min(timeout, 1.0))
                # Check if connection is still alive
                if self._is_connection_alive(conn):
                    return conn
                else:
                    # Connection is dead, create a new one
                    logger.debug("Connection from pool was dead, creating new one")
                    try:
                        conn.close()
                    except Exception:
                        pass
                    self._created_connections -= 1
            except Empty:
                pass
            
            # Pool is empty, check if we can create overflow connection
            if self._overflow_count < self.max_overflow:
                self._overflow_count += 1
                self._created_connections += 1
                logger.debug(f"Creating overflow connection ({self._overflow_count}/{self.max_overflow})")
                return self._create_connection()
            
            # Wait a bit more for a connection from pool
            try:
                conn = self._pool.get(timeout=timeout - 1.0)
                if self._is_connection_alive(conn):
                    return conn
                else:
                    try:
                        conn.close()
                    except Exception:
                        pass
                    self._created_connections -= 1
                    # Create replacement
                    return self._create_connection()
            except Empty:
                # Timeout - create a temporary connection
                logger.warning("Connection pool exhausted, creating temporary connection")
                return self._create_connection()
    
    def return_connection(self, conn: pyodbc.Connection) -> None:
        """
        Return a connection to the pool.
        
        Args:
            conn: Connection to return
        """
        if conn is None:
            return
        
        with self._lock:
            # Check if this is an overflow connection
            if self._overflow_count > 0:
                self._overflow_count -= 1
                self._created_connections -= 1
                try:
                    conn.close()
                except Exception:
                    pass
                return
            
            # Try to return to pool
            if self._is_connection_alive(conn):
                try:
                    # Reset connection state
                    conn.rollback()
                    self._pool.put_nowait(conn)
                except Full:
                    # Pool is full, close the connection
                    try:
                        conn.close()
                    except Exception:
                        pass
                    self._created_connections -= 1
            else:
                # Connection is dead, don't return it
                try:
                    conn.close()
                except Exception:
                    pass
                self._created_connections -= 1
    
    def close_all(self) -> None:
        """Close all connections in the pool."""
        with self._lock:
            while not self._pool.empty():
                try:
                    conn = self._pool.get_nowait()
                    conn.close()
                    self._created_connections -= 1
                except Exception:
                    pass
            self._overflow_count = 0


class Database:
    """Database connection manager."""
    
    def __init__(self):
        self._auth_connection_string = self._build_connection_string()
        self.connection_string = self._auth_connection_string
        self._current_db_context = "auth"
        
        # Initialize connection pools
        self._auth_pool = ConnectionPool(
            self._auth_connection_string,
            pool_size=settings.DB_POOL_SIZE,
            max_overflow=settings.DB_POOL_MAX_OVERFLOW
        )
        self._company_pool: Optional[ConnectionPool] = None
        self._pool_lock = Lock()
    
    def _build_connection_string(self) -> str:
        """Build MSSQL connection string from settings."""
        import os
        
        # SSL/TLS configuration (can be overridden via environment variables)
        # For ODBC Driver 18 with TLS-enforced SQL Server, encryption is required
        # Default to True for ODBC Driver 18, but can be overridden via DB_ENCRYPT
        encrypt = os.getenv("DB_ENCRYPT", "True").lower() == "true"
        trust_cert = os.getenv("DB_TRUST_SERVER_CERTIFICATE", "True").lower() == "true"
        
        if settings.DB_TRUSTED_CONNECTION:
            conn_str = (
                f"DRIVER={{{settings.DB_DRIVER}}};"
                f"SERVER={settings.DB_SERVER};"
                f"DATABASE={settings.DB_NAME};"
                f"Trusted_Connection=yes;"
            )
        else:
            conn_str = (
                f"DRIVER={{{settings.DB_DRIVER}}};"
                f"SERVER={settings.DB_SERVER};"
                f"DATABASE={settings.DB_NAME};"
                f"UID={settings.DB_USER};"
                f"PWD={settings.DB_PASSWORD};"
            )
        
        # Add SSL/TLS encryption settings
        if encrypt:
            conn_str += f"Encrypt=yes;"
            # Don't set TLSVersion - let OpenSSL negotiate based on MinProtocol in openssl.cnf
            # This avoids conflicts between connection string TLSVersion and OpenSSL config
            if trust_cert:
                conn_str += f"TrustServerCertificate=yes;"
            else:
                conn_str += f"TrustServerCertificate=no;"
        else:
            conn_str += f"Encrypt=no;"
        
        return conn_str

    def switch_to_auth_db(self) -> None:
        """Revert the active connection string back to the configured auth DB."""
        with self._pool_lock:
            # Close company pool when switching back
            if self._company_pool:
                self._company_pool.close_all()
                self._company_pool = None
        
        self.connection_string = self._auth_connection_string
        self._current_db_context = "auth"

    def switch_to_company_db(self, company_db_details: dict) -> None:
        """
        Switch the active connection string to a company database.

        Expected keys in company_db_details:
        - DBserver, DBname, DBuserName, DBpassword
        """
        server = (company_db_details.get("DBserver") or "").strip()
        name = (company_db_details.get("DBname") or "").strip()
        user = (company_db_details.get("DBuserName") or "").strip()
        pw = (company_db_details.get("DBpassword") or "").strip()

        if not server or not name:
            raise ValueError("Missing company DBserver/DBname")

        # Always use SQL auth for company DB (details come from CompanyProfile)
        import os
        # For ODBC Driver 18 with TLS-enforced SQL Server, encryption is required
        encrypt = os.getenv("DB_ENCRYPT", "True").lower() == "true"
        trust_cert = os.getenv("DB_TRUST_SERVER_CERTIFICATE", "True").lower() == "true"
        
        conn_str = (
            f"DRIVER={{{settings.DB_DRIVER}}};"
            f"SERVER={server};"
            f"DATABASE={name};"
        )
        if user:
            conn_str += f"UID={user};"
        if pw:
            conn_str += f"PWD={pw};"
        
        # Add SSL/TLS encryption settings
        if encrypt:
            conn_str += f"Encrypt=yes;"
            # Don't set TLSVersion - let OpenSSL negotiate based on MinProtocol in openssl.cnf
            # This avoids conflicts between connection string TLSVersion and OpenSSL config
            if trust_cert:
                conn_str += f"TrustServerCertificate=yes;"
            else:
                conn_str += f"TrustServerCertificate=no;"
        else:
            conn_str += f"Encrypt=no;"

        # Validate connection before switching permanently
        test_conn = None
        try:
            test_conn = pyodbc.connect(conn_str, timeout=5)
            test_conn.autocommit = True  # Use autocommit for test connection to avoid transaction issues
            # Test the connection with a simple query
            cursor = test_conn.cursor()
            cursor.execute("SELECT 1")
            cursor.close()
        except Exception as e:
            raise ValueError(f"Failed to connect to company database: {str(e)}")
        finally:
            if test_conn:
                try:
                    test_conn.close()
                except Exception:
                    pass

        # Close old company pool if exists
        with self._pool_lock:
            if self._company_pool:
                self._company_pool.close_all()
            
            # Create new pool for company DB
            self._company_pool = ConnectionPool(
                conn_str,
                pool_size=settings.DB_POOL_SIZE,
                max_overflow=settings.DB_POOL_MAX_OVERFLOW
            )

        self.connection_string = conn_str
        self._current_db_context = "company"
    
    @asynccontextmanager
    async def get_connection_async(self, use_auth_db: bool = False):
        """
        Get a database connection context manager from pool (async version).
        
        Args:
            use_auth_db: If True, always use auth DB connection regardless of current context
        """
        loop = asyncio.get_event_loop()
        executor = get_db_executor()
        
        # Run the synchronous context manager in executor
        conn_context = self.get_connection(use_auth_db=use_auth_db)
        conn = await loop.run_in_executor(executor, lambda: conn_context.__enter__())
        
        try:
            yield conn
            # Commit in executor
            await loop.run_in_executor(executor, lambda: conn_context.__exit__(None, None, None))
        except Exception as e:
            # Rollback in executor
            try:
                await loop.run_in_executor(executor, lambda: conn_context.__exit__(type(e), e, None))
            except Exception:
                pass
            raise
    
    @contextmanager
    def get_connection(self, use_auth_db: bool = False):
        """
        Get a database connection context manager from pool.
        
        Args:
            use_auth_db: If True, always use auth DB connection regardless of current context
        """
        conn = None
        pool = None
        
        try:
            # Select appropriate pool
            with self._pool_lock:
                if use_auth_db or self._current_db_context == "auth":
                    pool = self._auth_pool
                else:
                    pool = self._company_pool if self._company_pool else self._auth_pool
            
            # Get connection from pool
            conn = pool.get_connection()
            conn.autocommit = False
            yield conn
            
            # Only commit if connection is still valid and no error occurred
            try:
                if conn:
                    conn.commit()
            except Exception as commit_error:
                # If commit fails, try to rollback
                try:
                    if conn:
                        conn.rollback()
                except Exception:
                    pass  # Ignore rollback errors if connection is already closed
                raise commit_error
        except Exception as e:
            if conn:
                try:
                    # Check if connection is still valid before rollback
                    conn.rollback()
                except Exception:
                    # Connection might already be closed or in invalid state
                    pass
            logger.error(f"Database error: {str(e)}")
            raise
        finally:
            if conn and pool:
                try:
                    pool.return_connection(conn)
                except Exception:
                    # If return fails, try to close
                    try:
                        conn.close()
                    except Exception:
                        pass
    
    async def execute_query_async(self, query: str, params: Optional[dict] = None, use_auth_db: bool = False) -> list[dict]:
        """
        Execute a SELECT query asynchronously and return results as list of dictionaries.
        
        Args:
            query: SQL SELECT query with parameter placeholders (@ParamName)
            params: Dictionary of parameter values
            use_auth_db: If True, always execute against auth DB regardless of current context
            
        Returns:
            List of dictionaries representing rows
        """
        loop = asyncio.get_event_loop()
        executor = get_db_executor()
        return await loop.run_in_executor(executor, self.execute_query, query, params, use_auth_db)
    
    def execute_query(self, query: str, params: Optional[dict] = None, use_auth_db: bool = False, max_retries: int = 3) -> list[dict]:
        """
        Execute a SELECT query and return results as list of dictionaries.
        Includes retry logic for connection failures.
        
        Args:
            query: SQL SELECT query with parameter placeholders (@ParamName)
            params: Dictionary of parameter values
            use_auth_db: If True, always execute against auth DB regardless of current context
            max_retries: Maximum number of retry attempts for connection failures
            
        Returns:
            List of dictionaries representing rows
        """
        params = params or {}
        last_exception = None
        
        for attempt in range(max_retries):
            try:
                with self.get_connection(use_auth_db=use_auth_db) as conn:
                    cursor = conn.cursor()
                    try:
                        import re
                        
                        # Extract all parameter names from query (including duplicates)
                        param_pattern = r'@(\w+)'
                        all_param_matches = list(re.finditer(param_pattern, query, re.IGNORECASE))
                        
                        if not all_param_matches:
                            # No parameters, execute directly
                            cursor.execute(query)
                        else:
                            # Get unique parameter names for validation
                            param_names = list(set(match.group(1) for match in all_param_matches))
                            
                            # Validate all required parameters are provided
                            missing_params = [p for p in param_names if p not in params]
                            if missing_params:
                                raise ValueError(f"Missing required parameters: {', '.join(missing_params)}")
                            
                            # Build parameterized query and values list
                            # Replace each @paramName with ? and add corresponding value
                            formatted_query = query
                            param_values = []
                            
                            # Process matches in reverse order to preserve positions
                            for match in reversed(all_param_matches):
                                param_name = match.group(1)
                                start, end = match.span()
                                # Replace this occurrence with ? 
                                formatted_query = formatted_query[:start] + '?' + formatted_query[end:]
                                # Add the parameter value (will be used in reverse order, so prepend)
                                param_values.insert(0, params[param_name])
                            
                            # Execute the parameterized query
                            cursor.execute(formatted_query, param_values)
                        
                        # Get column names
                        columns = [column[0] for column in cursor.description]
                        
                        # Fetch all rows and convert to dictionaries
                        rows = cursor.fetchall()
                        results = [dict(zip(columns, row)) for row in rows]
                        
                        return results
                    finally:
                        cursor.close()
            
            except (pyodbc.OperationalError, pyodbc.InterfaceError, pyodbc.DatabaseError) as e:
                last_exception = e
                error_code = getattr(e, 'args', [None])[0] if hasattr(e, 'args') and e.args else None
                error_msg = str(e)
                
                # Check if this is a connection-related error that we should retry
                is_connection_error = (
                    error_code in ('08S01', '08003', 'HY000') or  # Communication link failure, Connection not open, General error
                    'Communication link failure' in error_msg or
                    'link failure' in error_msg.lower() or
                    ('connection' in error_msg.lower() and ('closed' in error_msg.lower() or 'lost' in error_msg.lower() or 'broken' in error_msg.lower()))
                )
                
                if is_connection_error and attempt < max_retries - 1:
                    # Log the retry attempt
                    wait_time = 0.5 * (2 ** attempt)  # Exponential backoff: 0.5s, 1s, 2s
                    logger.warning(
                        f"Database connection error (attempt {attempt + 1}/{max_retries}): {error_msg}. "
                        f"Retrying in {wait_time:.1f}s..."
                    )
                    time.sleep(wait_time)
                    
                    # Force connection pool to refresh by clearing dead connections
                    # This will be handled by get_connection's connection validation
                    continue
                else:
                    # Not a retryable error or max retries reached
                    logger.error(f"Database error: {error_msg}")
                    raise
            except Exception as e:
                # Non-connection errors should not be retried
                logger.error(f"Database error: {str(e)}")
                raise
        
        # If we exhausted all retries, raise the last exception
        if last_exception:
            raise last_exception
        raise Exception("Failed to execute query after retries")
    
    async def execute_scalar_async(self, query: str, params: Optional[dict] = None, use_auth_db: bool = False) -> Optional[any]:
        """
        Execute a query asynchronously that returns a single scalar value.
        
        Args:
            query: SQL query
            params: Dictionary of parameter values
            use_auth_db: If True, always execute against auth DB regardless of current context
            
        Returns:
            Single scalar value or None
        """
        loop = asyncio.get_event_loop()
        executor = get_db_executor()
        return await loop.run_in_executor(executor, self.execute_scalar, query, params, use_auth_db)
    
    def execute_scalar(self, query: str, params: Optional[dict] = None, use_auth_db: bool = False, max_retries: int = 3) -> Optional[any]:
        """
        Execute a query that returns a single scalar value.
        Includes retry logic for connection failures.
        
        Args:
            query: SQL query
            params: Dictionary of parameter values
            use_auth_db: If True, always execute against auth DB regardless of current context
            max_retries: Maximum number of retry attempts for connection failures
            
        Returns:
            Single scalar value or None
        """
        params = params or {}
        last_exception = None
        
        for attempt in range(max_retries):
            try:
                with self.get_connection(use_auth_db=use_auth_db) as conn:
                    cursor = conn.cursor()
                    try:
                        import re
                        param_pattern = r'@(\w+)'
                        
                        # Extract all parameter matches
                        all_param_matches = list(re.finditer(param_pattern, query, re.IGNORECASE))
                        
                        if not all_param_matches:
                            # No parameters, execute directly
                            cursor.execute(query)
                        else:
                            # Get unique parameter names for validation
                            param_names = list(set(match.group(1) for match in all_param_matches))
                            
                            # Validate all required parameters are provided
                            missing_params = [p for p in param_names if p not in params]
                            if missing_params:
                                raise ValueError(f"Missing required parameters: {', '.join(missing_params)}")
                            
                            # Build parameterized query and values list
                            formatted_query = query
                            param_values = []
                            
                            # Process matches in reverse order to preserve positions
                            for match in reversed(all_param_matches):
                                param_name = match.group(1)
                                start, end = match.span()
                                # Replace this occurrence with ?
                                formatted_query = formatted_query[:start] + '?' + formatted_query[end:]
                                # Add the parameter value (will be used in reverse order, so prepend)
                                param_values.insert(0, params[param_name])
                            
                            cursor.execute(formatted_query, param_values)
                        
                        result = cursor.fetchone()
                        return result[0] if result else None
                    finally:
                        cursor.close()
            
            except (pyodbc.OperationalError, pyodbc.InterfaceError, pyodbc.DatabaseError) as e:
                last_exception = e
                error_code = getattr(e, 'args', [None])[0] if hasattr(e, 'args') and e.args else None
                error_msg = str(e)
                
                # Check if this is a connection-related error that we should retry
                is_connection_error = (
                    error_code in ('08S01', '08003', 'HY000') or  # Communication link failure, Connection not open, General error
                    'Communication link failure' in error_msg or
                    'link failure' in error_msg.lower() or
                    ('connection' in error_msg.lower() and ('closed' in error_msg.lower() or 'lost' in error_msg.lower() or 'broken' in error_msg.lower()))
                )
                
                if is_connection_error and attempt < max_retries - 1:
                    # Log the retry attempt
                    wait_time = 0.5 * (2 ** attempt)  # Exponential backoff: 0.5s, 1s, 2s
                    logger.warning(
                        f"Database connection error in execute_scalar (attempt {attempt + 1}/{max_retries}): {error_msg}. "
                        f"Retrying in {wait_time:.1f}s..."
                    )
                    time.sleep(wait_time)
                    continue
                else:
                    # Not a retryable error or max retries reached
                    logger.error(f"Database error in execute_scalar: {error_msg}")
                    raise
            except Exception as e:
                # Non-connection errors should not be retried
                logger.error(f"Database error in execute_scalar: {str(e)}")
                raise
        
        # If we exhausted all retries, raise the last exception
        if last_exception:
            raise last_exception
        raise Exception("Failed to execute scalar query after retries")

    async def execute_non_query_async(self, query: str, params: Optional[dict] = None, use_auth_db: bool = False, autocommit: bool = False) -> None:
        """
        Execute a non-SELECT query asynchronously (DDL/DML). Supports @ParamName placeholders.
        
        Args:
            query: SQL query
            params: Dictionary of parameter values
            use_auth_db: If True, always execute against auth DB regardless of current context
            autocommit: If True, use autocommit mode (recommended for DDL statements)
        """
        loop = asyncio.get_event_loop()
        executor = get_db_executor()
        return await loop.run_in_executor(executor, self.execute_non_query, query, params, use_auth_db, autocommit)
    
    def execute_non_query(self, query: str, params: Optional[dict] = None, use_auth_db: bool = False, autocommit: bool = False) -> None:
        """
        Execute a non-SELECT query (DDL/DML). Supports @ParamName placeholders.
        
        Args:
            query: SQL query
            params: Dictionary of parameter values
            use_auth_db: If True, always execute against auth DB regardless of current context
            autocommit: If True, use autocommit mode (recommended for DDL statements)
        """
        params = params or {}
        
        # For autocommit operations, use a simpler connection approach
        if autocommit:
            conn_str = self._auth_connection_string if use_auth_db else self.connection_string
            conn = None
            try:
                conn = pyodbc.connect(conn_str)
                conn.autocommit = True
                cursor = conn.cursor()
                try:
                    import re

                    param_pattern = r'@(\w+)'
                    all_param_matches = list(re.finditer(param_pattern, query, re.IGNORECASE))

                    if not all_param_matches:
                        cursor.execute(query)
                    else:
                        param_names = list(set(match.group(1) for match in all_param_matches))
                        missing_params = [p for p in param_names if p not in params]
                        if missing_params:
                            raise ValueError(f"Missing required parameters: {', '.join(missing_params)}")

                        formatted_query = query
                        param_values = []
                        for match in reversed(all_param_matches):
                            param_name = match.group(1)
                            start, end = match.span()
                            formatted_query = formatted_query[:start] + '?' + formatted_query[end:]
                            param_values.insert(0, params[param_name])

                        cursor.execute(formatted_query, param_values)
                finally:
                    cursor.close()
            finally:
                if conn:
                    try:
                        conn.close()
                    except Exception:
                        pass
        else:
            # Use transaction-based connection for DML operations
            with self.get_connection(use_auth_db=use_auth_db) as conn:
                cursor = conn.cursor()
                try:
                    import re

                    param_pattern = r'@(\w+)'
                    all_param_matches = list(re.finditer(param_pattern, query, re.IGNORECASE))

                    if not all_param_matches:
                        cursor.execute(query)
                        return

                    param_names = list(set(match.group(1) for match in all_param_matches))
                    missing_params = [p for p in param_names if p not in params]
                    if missing_params:
                        raise ValueError(f"Missing required parameters: {', '.join(missing_params)}")

                    formatted_query = query
                    param_values = []
                    for match in reversed(all_param_matches):
                        param_name = match.group(1)
                        start, end = match.span()
                        formatted_query = formatted_query[:start] + '?' + formatted_query[end:]
                        param_values.insert(0, params[param_name])

                    cursor.execute(formatted_query, param_values)
                finally:
                    cursor.close()


# Global database instance
db = Database()

