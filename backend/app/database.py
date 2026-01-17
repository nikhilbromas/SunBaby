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
        self.connection_string = self._build_connection_string()
    
    def _build_connection_string(self) -> str:
        """Build MSSQL connection string from settings."""
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
        return conn_str
    
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


# Global database instance
db = Database()

