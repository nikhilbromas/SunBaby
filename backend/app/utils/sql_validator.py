"""
SQL Security Validator
Ensures only safe SELECT queries are executed with proper parameterization.

Supports complex queries with multiple JOINs:
- LEFT JOIN, RIGHT JOIN, INNER JOIN, FULL OUTER JOIN, CROSS JOIN
- Multiple JOINs in sequence
- Table aliases (e.g., FROM LOsPosHeader h)
- Schema-qualified tables (e.g., schema.table)
"""
import re
from typing import List, Set, Optional
from app.config import settings


class SQLValidationError(Exception):
    """Raised when SQL validation fails."""
    pass


class SQLValidator:
    """Validates SQL queries for security and correctness."""
    
    # Dangerous SQL keywords that should never appear in queries
    DANGEROUS_KEYWORDS: Set[str] = {
        'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE',
        'EXEC', 'EXECUTE', 'SP_', 'XP_', 'GRANT', 'REVOKE', 'DENY',
        'BACKUP', 'RESTORE', 'SHUTDOWN', 'KILL', 'DBCC'
    }
    
    # Allowed SQL keywords for SELECT queries
    ALLOWED_KEYWORDS: Set[str] = {
        'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL',
        'OUTER', 'ON', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'IS',
        'NULL', 'ORDER', 'BY', 'GROUP', 'HAVING', 'DISTINCT', 'TOP', 'AS',
        'UNION', 'ALL', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'COUNT',
        'SUM', 'AVG', 'MAX', 'MIN', 'CAST', 'CONVERT', 'AS', 'ASC', 'DESC'
    }
    
    def __init__(self, allowed_tables: Optional[List[str]] = None):
        """
        Initialize validator.
        
        Args:
            allowed_tables: List of allowed table/view names (whitelist)
        """
        self.allowed_tables = set(allowed_tables) if allowed_tables else set(settings.ALLOWED_TABLES)
    
    def validate(self, sql: str, require_parameters: bool = False) -> dict:
        """
        Validate SQL query for security and correctness.
        
        Args:
            sql: SQL query string
            require_parameters: Whether parameters are required
            
        Returns:
            Dictionary with validation results:
            {
                'valid': bool,
                'parameters': List[str],
                'tables': List[str],
                'warnings': List[str]
            }
            
        Raises:
            SQLValidationError: If validation fails
        """
        if not sql or not sql.strip():
            raise SQLValidationError("SQL query cannot be empty")
        
        sql_upper = sql.upper().strip()
        warnings = []
        
        # Check if it's a SELECT statement
        if not sql_upper.startswith('SELECT'):
            raise SQLValidationError("Only SELECT queries are allowed")
        
        # Check for dangerous keywords
        for keyword in self.DANGEROUS_KEYWORDS:
            # Use word boundaries to avoid false positives
            pattern = r'\b' + re.escape(keyword) + r'\b'
            if re.search(pattern, sql_upper, re.IGNORECASE):
                raise SQLValidationError(f"Dangerous keyword '{keyword}' is not allowed")
        
        # Extract parameters (@ParamName format)
        param_pattern = r'@(\w+)'
        parameters = list(set(re.findall(param_pattern, sql, re.IGNORECASE)))
        
        if require_parameters and not parameters:
            warnings.append("Query should use parameters for security")
        
        # Extract table/view names (simplified - looks for FROM/JOIN clauses)
        tables = self._extract_tables(sql_upper)
        
        # Validate JOIN clauses (ensure they have ON conditions, except CROSS JOIN)
        join_warnings = self._validate_joins(sql_upper)
        warnings.extend(join_warnings)
        
        # If whitelist is configured, validate tables
        if self.allowed_tables:
            invalid_tables = [t for t in tables if t.upper() not in [at.upper() for at in self.allowed_tables]]
            if invalid_tables:
                raise SQLValidationError(
                    f"Access to tables/views not allowed: {', '.join(invalid_tables)}"
                )
        
        # Check for SQL injection patterns
        if self._has_injection_patterns(sql):
            raise SQLValidationError("Query contains potentially dangerous patterns")
        
        return {
            'valid': True,
            'parameters': parameters,
            'tables': tables,
            'warnings': warnings
        }
    
    def _extract_tables(self, sql_upper: str) -> List[str]:
        """
        Extract table/view names from SQL query.
        Supports multiple JOINs of all types (LEFT, RIGHT, INNER, FULL OUTER, CROSS).
        Handles table names with mixed case, schema prefixes, and aliases.
        
        Examples:
        - FROM LOsPosHeader h -> extracts LOsPosHeader
        - LEFT JOIN orderheader o ON ... -> extracts orderheader
        - FROM schema.table -> extracts table
        """
        tables = []
        
        # Pattern to match FROM table_name [alias] or FROM schema.table_name [alias]
        # Handles: FROM LOsPosHeader, FROM LOsPosHeader h, FROM schema.table, FROM schema.table t
        # \w+ matches word characters (letters, digits, underscore)
        # This handles table names like LOsPosHeader, TableName, etc.
        # The alias part is optional and will be ignored
        from_pattern = r'FROM\s+(\w+(?:\.\w+)?)(?:\s+\w+)?(?=\s|$|,|JOIN|WHERE|GROUP|ORDER|HAVING)'
        from_matches = re.findall(from_pattern, sql_upper)
        tables.extend(from_matches)
        
        # Pattern to match all JOIN types: LEFT JOIN, RIGHT JOIN, INNER JOIN, FULL OUTER JOIN, CROSS JOIN
        # Also handles: JOIN (without type prefix, defaults to INNER)
        # Matches: [LEFT|RIGHT|INNER|FULL\s+OUTER|CROSS]?\s+JOIN\s+table_name [alias]
        # The (?:FULL\s+OUTER)? handles "FULL OUTER" as two words
        join_pattern = r'(?:LEFT|RIGHT|INNER|FULL\s+OUTER|CROSS)?\s+JOIN\s+(\w+(?:\.\w+)?)(?:\s+\w+)?(?=\s|$|ON|WHERE|GROUP|ORDER|HAVING|JOIN)'
        join_matches = re.findall(join_pattern, sql_upper)
        tables.extend(join_matches)
        
        # Remove duplicates and clean up - extract just the table name part
        # If it's schema.table, get just the table part
        # Convert to uppercase for consistent comparison
        cleaned_tables = []
        for t in tables:
            # Split on dot to get table name (last part if schema qualified)
            table_name = t.split('.')[-1].strip()
            if table_name:
                cleaned_tables.append(table_name.upper())
        
        # Remove duplicates while preserving order
        seen = set()
        unique_tables = []
        for t in cleaned_tables:
            if t not in seen:
                seen.add(t)
                unique_tables.append(t)
        
        return unique_tables
    
    def _validate_joins(self, sql_upper: str) -> List[str]:
        """
        Validate JOIN clauses to ensure they have proper ON conditions.
        CROSS JOINs don't require ON clauses, but other JOINs should have them.
        
        Args:
            sql_upper: SQL query in uppercase
            
        Returns:
            List of warning messages (empty if no issues)
        """
        warnings = []
        
        # Find all JOIN clauses (excluding CROSS JOIN)
        # Pattern matches: [LEFT|RIGHT|INNER|FULL\s+OUTER]?\s+JOIN
        join_pattern = r'(?:LEFT|RIGHT|INNER|FULL\s+OUTER)?\s+JOIN\s+(\w+(?:\.\w+)?)'
        join_matches = list(re.finditer(join_pattern, sql_upper, re.IGNORECASE))
        
        for match in join_matches:
            join_start = match.start()
            join_end = match.end()
            
            # Check if this is a CROSS JOIN (which doesn't need ON)
            join_text = sql_upper[max(0, join_start-20):join_start+10]
            if 'CROSS' in join_text:
                continue  # CROSS JOIN doesn't require ON clause
            
            # Look for ON clause after this JOIN
            # ON should appear within reasonable distance (next 200 chars)
            remaining_sql = sql_upper[join_end:join_end+200]
            
            # Check if ON appears (with word boundaries)
            on_pattern = r'\bON\b'
            if not re.search(on_pattern, remaining_sql):
                # Try to find the table name for better error message
                table_name = match.group(1)
                warnings.append(
                    f"JOIN with table '{table_name}' should have an ON condition "
                    "(except CROSS JOIN). Please verify the JOIN clause is correct."
                )
        
        return warnings
    
    def _has_injection_patterns(self, sql: str) -> bool:
        """
        Check for common SQL injection patterns.
        Uses precise patterns to avoid false positives with legitimate SQL.
        Focuses on blocking actual injection attempts, not normal SQL syntax.
        """
        dangerous_patterns = [
            # Multiple statements: semicolon followed by dangerous SQL keyword
            # This catches: SELECT ...; DROP TABLE ... (injection attempt)
            # Note: Trailing semicolons are allowed (common SQL practice)
            r';\s+(DROP|DELETE|UPDATE|INSERT|EXEC|EXECUTE|CREATE|ALTER|TRUNCATE)\s+',
            # Multi-line comments that could hide malicious code
            r'/\*.*?\*/',
            # Suspicious UNION patterns (but allow UNION ALL which is valid)
            # Pattern: UNION (not followed by ALL) ... SELECT (potential injection)
            r'\bUNION\s+(?!ALL\b).*?\bSELECT\b',
            # Dynamic execution
            r'\bEXEC\s*\(',
            r'\bEXECUTE\s*\(',
            # Dangerous stored procedures
            r'\b(SP_|XP_)\w+',
        ]
        
        for pattern in dangerous_patterns:
            if re.search(pattern, sql, re.IGNORECASE | re.DOTALL):
                pass
                return True
        
        # Note: We don't block -- comments here because:
        # 1. They're already handled by the dangerous keyword check
        # 2. Legitimate queries shouldn't have comments, but if they do, 
        #    the dangerous keyword check will catch any actual threats
        # 3. Blocking -- causes too many false positives
        
        return False
    
    def validate_sql_json(self, sql_json: dict) -> dict:
        """
        Validate SQL JSON structure containing headerQuery, itemQuery, and/or contentDetails.
        
        Args:
            sql_json: Dictionary with 'headerQuery', 'itemQuery', and/or 'contentDetails' keys
            
        Returns:
            Combined validation results
        """
        if not isinstance(sql_json, dict):
            raise SQLValidationError("SQL JSON must be a dictionary")
        
        # Check if at least one query exists
        has_header = 'headerQuery' in sql_json and sql_json.get('headerQuery')
        has_item = 'itemQuery' in sql_json and sql_json.get('itemQuery')
        has_content_details = 'contentDetails' in sql_json and isinstance(sql_json.get('contentDetails'), list) and len(sql_json.get('contentDetails', [])) > 0
        
        if not (has_header or has_item or has_content_details):
            raise SQLValidationError("SQL JSON must contain at least 'headerQuery', 'itemQuery', or 'contentDetails'")
        
        results = {
            'valid': True,
            'header': None,
            'item': None,
            'contentDetails': [],
            'all_parameters': [],
            'warnings': []
        }
        
        # Validate header query
        if 'headerQuery' in sql_json and sql_json['headerQuery']:
            header_result = self.validate(sql_json['headerQuery'], require_parameters=True)
            results['header'] = header_result
            results['all_parameters'].extend(header_result['parameters'])
            results['warnings'].extend(header_result['warnings'])
        
        # Validate item query
        if 'itemQuery' in sql_json and sql_json['itemQuery']:
            item_result = self.validate(sql_json['itemQuery'], require_parameters=True)
            results['item'] = item_result
            results['all_parameters'].extend(item_result['parameters'])
            results['warnings'].extend(item_result['warnings'])
        
        # Validate contentDetails queries
        if 'contentDetails' in sql_json and isinstance(sql_json['contentDetails'], list):
            for idx, content_detail in enumerate(sql_json['contentDetails']):
                if not isinstance(content_detail, dict):
                    raise SQLValidationError(f"contentDetails[{idx}] must be an object")
                if 'name' not in content_detail or not content_detail['name']:
                    raise SQLValidationError(f"contentDetails[{idx}] must have a 'name' field")
                if 'query' not in content_detail or not content_detail['query']:
                    raise SQLValidationError(f"contentDetails[{idx}] must have a 'query' field")
                
                # Validate the query
                query_result = self.validate(content_detail['query'], require_parameters=True)
                results['contentDetails'].append({
                    'name': content_detail['name'],
                    'result': query_result
                })
                results['all_parameters'].extend(query_result['parameters'])
                results['warnings'].extend(query_result['warnings'])
        
        # Remove duplicate parameters
        results['all_parameters'] = list(set(results['all_parameters']))
        
        return results


# Global validator instance
validator = SQLValidator()

