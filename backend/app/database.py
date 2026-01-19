"""
Database connection and session management for MSSQL Server.
"""
import pyodbc
from typing import Optional
from contextlib import contextmanager
from app.config import settings
import logging

logger = logging.getLogger(__name__)


class Database:
    """Database connection manager."""
    
    def __init__(self):
        self._auth_connection_string = self._build_connection_string()
        self.connection_string = self._auth_connection_string
        self._current_db_context = "auth"
    
    def _build_connection_string(self) -> str:
        """Build MSSQL connection string from settings."""
        # Base connection string parts
        base_parts = [
            f"DRIVER={{{settings.DB_DRIVER}}};",
            f"SERVER={settings.DB_SERVER};",
            f"DATABASE={settings.DB_NAME};"
        ]
        
        # Add authentication
        if settings.DB_TRUSTED_CONNECTION:
            base_parts.append("Trusted_Connection=yes;")
        else:
            base_parts.append(f"UID={settings.DB_USER};")
            base_parts.append(f"PWD={settings.DB_PASSWORD};")
        
        # Add encryption settings (disable only in Docker/container environments)
        if settings.DB_DISABLE_ENCRYPTION:
            # Disable encryption for Docker/container environments to avoid TLS version issues
            base_parts.append("Encrypt=no;")
            base_parts.append("TrustServerCertificate=yes;")
        # If DB_DISABLE_ENCRYPTION is False, use default encryption (works on localhost)
        
        return "".join(base_parts)

    def switch_to_auth_db(self) -> None:
        """Revert the active connection string back to the configured auth DB."""
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
        conn_str = (
            f"DRIVER={{{settings.DB_DRIVER}}};"
            f"SERVER={server};"
            f"DATABASE={name};"
        )
        if user:
            conn_str += f"UID={user};"
        if pw:
            conn_str += f"PWD={pw};"

        # Add encryption settings (disable only in Docker/container environments)
        if settings.DB_DISABLE_ENCRYPTION:
            # Disable encryption for Docker/container environments to avoid TLS version issues
            conn_str += "Encrypt=no;TrustServerCertificate=yes;"
        # If DB_DISABLE_ENCRYPTION is False, use default encryption (works on localhost)

        # Validate connection before switching permanently
        test_conn = None
        try:
            test_conn = pyodbc.connect(conn_str)
        finally:
            if test_conn:
                test_conn.close()

        self.connection_string = conn_str
        self._current_db_context = "company"
    
    @contextmanager
    def get_connection(self):
        """Get a database connection context manager."""
        conn = None
        try:
            conn = pyodbc.connect(self.connection_string)
            conn.autocommit = False
            yield conn
            conn.commit()
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Database error: {str(e)}")
            raise
        finally:
            if conn:
                conn.close()
    
    def execute_query(self, query: str, params: Optional[dict] = None) -> list[dict]:
        """
        Execute a SELECT query and return results as list of dictionaries.
        
        Args:
            query: SQL SELECT query with parameter placeholders (@ParamName)
            params: Dictionary of parameter values
            
        Returns:
            List of dictionaries representing rows
        """
        params = params or {}
        with self.get_connection() as conn:
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
    
    def execute_scalar(self, query: str, params: Optional[dict] = None) -> Optional[any]:
        """
        Execute a query that returns a single scalar value.
        
        Args:
            query: SQL query
            params: Dictionary of parameter values
            
        Returns:
            Single scalar value or None
        """
        params = params or {}
        with self.get_connection() as conn:
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

    def execute_non_query(self, query: str, params: Optional[dict] = None) -> None:
        """
        Execute a non-SELECT query (DDL/DML). Supports @ParamName placeholders.
        """
        params = params or {}
        with self.get_connection() as conn:
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

