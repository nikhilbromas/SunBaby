"""
Service for querying database schema metadata.
Provides information about tables, views, columns, and relationships.
"""
from typing import List, Optional, Dict, Any
from app.database import db
from app.config import settings


class SchemaService:
    """Service for database schema introspection."""
    
    def get_tables_and_views(
        self, 
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 500
    ) -> tuple[List[Dict[str, Any]], int]:
        """
        Get list of tables and views from the database.
        
        Args:
            search: Optional search term to filter tables/views by name
            skip: Number of records to skip (pagination)
            limit: Maximum number of records to return
            
        Returns:
            Tuple of (list of table info dicts, total count)
        """
        # Base query to get tables and views
        base_query = """
            SELECT 
                TABLE_NAME as name,
                TABLE_TYPE as type,
                TABLE_SCHEMA as schemaName
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA NOT IN ('sys', 'INFORMATION_SCHEMA')
        """
        
        params = {}
        
        # Add search filter if provided
        if search:
            base_query += " AND TABLE_NAME LIKE @search"
            params['search'] = f"%{search}%"
        
        # Check if ALLOWED_TABLES is configured
        if hasattr(settings, 'ALLOWED_TABLES') and settings.ALLOWED_TABLES:
            allowed_list = [t.strip() for t in settings.ALLOWED_TABLES.split(',') if t.strip()]
            if allowed_list:
                placeholders = ','.join([f"'{table}'" for table in allowed_list])
                base_query += f" AND TABLE_NAME IN ({placeholders})"
        
        # Get total count
        count_query = f"SELECT COUNT(*) FROM ({base_query}) as counts"
        total = db.execute_scalar(count_query, params) or 0
        
        # Add ordering and pagination
        base_query += f" ORDER BY TABLE_NAME OFFSET {skip} ROWS FETCH NEXT {limit} ROWS ONLY"
        
        # Execute query
        results = db.execute_query(base_query, params)
        
        # Transform results
        tables = []
        for row in results:
            table_info = {
                'name': row['name'],
                'type': 'table' if row['type'] == 'BASE TABLE' else 'view',
                'schema': row.get('schemaName', 'dbo')
            }
            
            # Optionally get row count estimate for tables (not views)
            if table_info['type'] == 'table':
                try:
                    row_count_query = """
                        SELECT SUM(row_count) as row_count
                        FROM sys.dm_db_partition_stats
                        WHERE object_id = OBJECT_ID(@table_name)
                        AND index_id IN (0, 1)
                    """
                    row_count = db.execute_scalar(
                        row_count_query, 
                        {'table_name': f"{table_info['schema']}.{table_info['name']}"}
                    )
                    table_info['rowCount'] = int(row_count) if row_count else None
                except Exception as e:
                    pass
                    table_info['rowCount'] = None
            
            tables.append(table_info)
        
        return tables, total
    
    def get_table_columns(self, table_name: str) -> List[Dict[str, Any]]:
        """
        Get columns for a specific table or view.
        
        Args:
            table_name: Name of the table or view
            
        Returns:
            List of column information dicts
        """
        # Query for column information
        query = """
            SELECT 
                c.COLUMN_NAME as name,
                c.DATA_TYPE as dataType,
                c.IS_NULLABLE as nullable,
                c.CHARACTER_MAXIMUM_LENGTH as maxLength,
                c.NUMERIC_PRECISION as numericPrecision,
                c.NUMERIC_SCALE as numericScale,
                CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as isPrimaryKey,
                CASE WHEN fk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as isForeignKey
            FROM INFORMATION_SCHEMA.COLUMNS c
            LEFT JOIN (
                SELECT ku.TABLE_NAME, ku.COLUMN_NAME
                FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku 
                    ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
                WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
            ) pk ON c.TABLE_NAME = pk.TABLE_NAME AND c.COLUMN_NAME = pk.COLUMN_NAME
            LEFT JOIN (
                SELECT ku.TABLE_NAME, ku.COLUMN_NAME
                FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku 
                    ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
                WHERE tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
            ) fk ON c.TABLE_NAME = fk.TABLE_NAME AND c.COLUMN_NAME = fk.COLUMN_NAME
            WHERE c.TABLE_NAME = @table_name
            ORDER BY c.ORDINAL_POSITION
        """
        
        results = db.execute_query(query, {'table_name': table_name})
        
        columns = []
        for row in results:
            column_info = {
                'name': row['name'],
                'dataType': row['dataType'],
                'nullable': row['nullable'] == 'YES',
                'isPrimaryKey': bool(row['isPrimaryKey']),
                'isForeignKey': bool(row['isForeignKey'])
            }
            
            # Add maxLength for string types
            if row.get('maxLength'):
                column_info['maxLength'] = int(row['maxLength'])
            
            # Add precision/scale for numeric types
            if row.get('numericPrecision'):
                column_info['numericPrecision'] = int(row['numericPrecision'])
            if row.get('numericScale'):
                column_info['numericScale'] = int(row['numericScale'])
            
            columns.append(column_info)
        
        return columns
    
    def get_table_relationships(self) -> List[Dict[str, Any]]:
        """
        Get foreign key relationships between tables.
        
        Returns:
            List of relationship information dicts
        """
        query = """
            SELECT 
                fk.name as constraintName,
                tp.name as parentTable,
                cp.name as parentColumn,
                tr.name as childTable,
                cr.name as childColumn
            FROM sys.foreign_keys fk
            INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
            INNER JOIN sys.tables tp ON fk.referenced_object_id = tp.object_id
            INNER JOIN sys.tables tr ON fk.parent_object_id = tr.object_id
            INNER JOIN sys.columns cp ON fkc.referenced_object_id = cp.object_id 
                AND fkc.referenced_column_id = cp.column_id
            INNER JOIN sys.columns cr ON fkc.parent_object_id = cr.object_id 
                AND fkc.parent_column_id = cr.column_id
            ORDER BY tp.name, tr.name
        """
        
        results = db.execute_query(query, {})
        
        relationships = []
        for row in results:
            relationships.append({
                'constraintName': row['constraintName'],
                'parentTable': row['parentTable'],
                'parentColumn': row['parentColumn'],
                'childTable': row['childTable'],
                'childColumn': row['childColumn']
            })
        
        return relationships


# Global service instance
schema_service = SchemaService()

