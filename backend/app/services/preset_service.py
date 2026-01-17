"""
Service for managing SQL Presets.
Handles CRUD operations with SQL validation.
"""
import json
from typing import List, Optional
from app.database import db
from app.models.preset import PresetCreate, PresetUpdate, PresetResponse
from app.utils.sql_validator import validator, SQLValidationError
import logging

logger = logging.getLogger(__name__)


class PresetService:
    """Service for SQL preset management."""
    
    def create_preset(self, preset_data: PresetCreate) -> PresetResponse:
        """
        Create a new SQL preset with validation.
        
        Args:
            preset_data: Preset creation data
            
        Returns:
            Created preset
            
        Raises:
            SQLValidationError: If SQL validation fails
            ValueError: If preset name already exists
        """
        # Validate SQL JSON
        sql_json_dict = json.loads(preset_data.sqlJson)
        validation_result = validator.validate_sql_json(sql_json_dict)
        
        if not validation_result['valid']:
            raise SQLValidationError("SQL validation failed")
        
        # Check if preset name already exists
        existing = self.get_preset_by_name(preset_data.presetName)
        if existing:
            raise ValueError(f"Preset with name '{preset_data.presetName}' already exists")
        
        # Insert into database
        insert_query = """
            INSERT INTO ReportSqlPresets (PresetName, SqlJson, ExpectedParams, CreatedBy)
            OUTPUT INSERTED.*
            VALUES (?, ?, ?, ?)
        """
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute(
                    insert_query,
                    (
                        preset_data.presetName,
                        preset_data.sqlJson,
                        preset_data.expectedParams,
                        preset_data.createdBy
                    )
                )
                row = cursor.fetchone()
                conn.commit()
                
                if row:
                    return self._row_to_preset_response(row)
                else:
                    raise Exception("Failed to create preset")
            finally:
                cursor.close()
    
    def get_preset(self, preset_id: int) -> Optional[PresetResponse]:
        """
        Get preset by ID.
        
        Args:
            preset_id: Preset ID
            
        Returns:
            Preset or None if not found
        """
        query = "SELECT * FROM ReportSqlPresets WHERE PresetId = ? AND IsActive = 1"
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute(query, (preset_id,))
                row = cursor.fetchone()
                
                if row:
                    return self._row_to_preset_response(row)
                return None
            finally:
                cursor.close()
    
    def get_preset_by_name(self, preset_name: str) -> Optional[PresetResponse]:
        """
        Get preset by name.
        
        Args:
            preset_name: Preset name
            
        Returns:
            Preset or None if not found
        """
        query = "SELECT * FROM ReportSqlPresets WHERE PresetName = ? AND IsActive = 1"
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute(query, (preset_name,))
                row = cursor.fetchone()
                
                if row:
                    return self._row_to_preset_response(row)
                return None
            finally:
                cursor.close()
    
    def list_presets(self, skip: int = 0, limit: int = 100) -> tuple[List[PresetResponse], int]:
        """
        List all active presets.
        
        Args:
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            Tuple of (presets list, total count)
        """
        count_query = "SELECT COUNT(*) FROM ReportSqlPresets WHERE IsActive = 1"
        list_query = """
            SELECT * FROM ReportSqlPresets 
            WHERE IsActive = 1 
            ORDER BY CreatedOn DESC
            OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
        """
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            try:
                # Get total count
                cursor.execute(count_query)
                total = cursor.fetchone()[0]
                
                # Get presets
                cursor.execute(list_query, (skip, limit))
                rows = cursor.fetchall()
                
                presets = [self._row_to_preset_response(row) for row in rows]
                return presets, total
            finally:
                cursor.close()
    
    def update_preset(self, preset_id: int, preset_data: PresetUpdate) -> Optional[PresetResponse]:
        """
        Update an existing preset.
        
        Args:
            preset_id: Preset ID
            preset_data: Update data
            
        Returns:
            Updated preset or None if not found
            
        Raises:
            SQLValidationError: If SQL validation fails
        """
        # Validate SQL JSON if provided
        if preset_data.sqlJson:
            sql_json_dict = json.loads(preset_data.sqlJson)
            validation_result = validator.validate_sql_json(sql_json_dict)
            
            if not validation_result['valid']:
                raise SQLValidationError("SQL validation failed")
        
        # Build update query dynamically
        updates = []
        params = []
        
        if preset_data.presetName is not None:
            updates.append("PresetName = ?")
            params.append(preset_data.presetName)
        
        if preset_data.sqlJson is not None:
            updates.append("SqlJson = ?")
            params.append(preset_data.sqlJson)
        
        if preset_data.expectedParams is not None:
            updates.append("ExpectedParams = ?")
            params.append(preset_data.expectedParams)
        
        if preset_data.isActive is not None:
            updates.append("IsActive = ?")
            params.append(preset_data.isActive)
        
        if not updates:
            # No updates provided, just return existing
            return self.get_preset(preset_id)
        
        updates.append("UpdatedOn = GETDATE()")
        params.append(preset_id)
        
        update_query = f"""
            UPDATE ReportSqlPresets 
            SET {', '.join(updates)}
            OUTPUT INSERTED.*
            WHERE PresetId = ? AND IsActive = 1
        """
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute(update_query, params)
                row = cursor.fetchone()
                conn.commit()
                
                if row:
                    return self._row_to_preset_response(row)
                return None
            finally:
                cursor.close()
    
    def delete_preset(self, preset_id: int) -> bool:
        """
        Soft delete a preset (set IsActive = 0).
        
        Args:
            preset_id: Preset ID
            
        Returns:
            True if deleted, False if not found
        """
        update_query = """
            UPDATE ReportSqlPresets 
            SET IsActive = 0, UpdatedOn = GETDATE()
            WHERE PresetId = ? AND IsActive = 1
        """
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute(update_query, (preset_id,))
                conn.commit()
                return cursor.rowcount > 0
            finally:
                cursor.close()
    
    def _row_to_preset_response(self, row) -> PresetResponse:
        """Convert database row to PresetResponse."""
        return PresetResponse(
            PresetId=row[0],
            PresetName=row[1],
            SqlJson=row[2],
            ExpectedParams=row[3],
            CreatedBy=row[4],
            CreatedOn=row[5],
            UpdatedOn=row[6] if len(row) > 6 else None,
            IsActive=bool(row[7] if len(row) > 7 else True)
        )


# Global service instance
preset_service = PresetService()

