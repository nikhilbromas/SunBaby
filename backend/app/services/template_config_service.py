"""
Service for managing Template Configs.
Handles CRUD operations for template configurations.
"""
from typing import List, Optional
from app.database import db
from app.models.template_config import TemplateConfigCreate, TemplateConfigUpdate, TemplateConfigResponse
import logging

logger = logging.getLogger(__name__)


class TemplateConfigService:
    """Service for template config management."""
    
    def create_template_config(self, config_data: TemplateConfigCreate) -> TemplateConfigResponse:
        """
        Create a new template config.
        
        Args:
            config_data: Template config creation data
            
        Returns:
            Created template config
            
        Raises:
            ValueError: If template, preset, or interface doesn't exist
        """
        # Verify template exists
        template_exists = db.execute_scalar(
            "SELECT COUNT(*) FROM ReportTemplates WHERE TemplateId = @templateId AND IsActive = 1",
            {"templateId": config_data.templateId}
        )
        if template_exists == 0:
            raise ValueError(f"Template with ID {config_data.templateId} not found")
        
        # Verify preset exists
        preset_exists = db.execute_scalar(
            "SELECT COUNT(*) FROM ReportSqlPresets WHERE PresetId = @presetId AND IsActive = 1",
            {"presetId": config_data.presetId}
        )
        if preset_exists == 0:
            raise ValueError(f"Preset with ID {config_data.presetId} not found")
        
        # Verify interface exists (application-level validation, no FK constraint)
        interface_exists = db.execute_scalar(
            "SELECT COUNT(*) FROM ainterface WHERE InterfaceID = @interfaceId",
            {"interfaceId": config_data.interfaceId}
        )
        if interface_exists == 0:
            raise ValueError(f"Interface with ID {config_data.interfaceId} not found")
        
        # Verify department exists if provided
        if config_data.departmentId is not None:
            dept_exists = db.execute_scalar(
                "SELECT COUNT(*) FROM aDepartmentMaster WHERE DepartmentID = @departmentId",
                {"departmentId": config_data.departmentId}
            )
            if dept_exists == 0:
                raise ValueError(f"Department with ID {config_data.departmentId} not found")
        
        # Verify shop exists if provided
        if config_data.shopId is not None:
            shop_exists = db.execute_scalar(
                "SELECT COUNT(*) FROM ashops WHERE ShopID = @shopId",
                {"shopId": config_data.shopId}
            )
            if shop_exists == 0:
                raise ValueError(f"Shop with ID {config_data.shopId} not found")
        
        # Insert into database
        insert_query = """
            INSERT INTO TemplateConfig (TemplateId, PresetId, InterfaceId, DepartmentId, ShopId, Type, Description, CreatedBy)
            OUTPUT INSERTED.*
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute(
                    insert_query,
                    (
                        config_data.templateId,
                        config_data.presetId,
                        config_data.interfaceId,
                        config_data.departmentId,
                        config_data.shopId,
                        config_data.type,
                        config_data.description,
                        config_data.createdBy
                    )
                )
                row = cursor.fetchone()
                conn.commit()
                
                if row:
                    return self._row_to_template_config_response(row)
                else:
                    raise Exception("Failed to create template config")
            finally:
                cursor.close()
    
    async def get_template_config(self, config_id: int) -> Optional[TemplateConfigResponse]:
        """
        Get template config by ID (async).
        
        Args:
            config_id: Template config ID
            
        Returns:
            Template config or None if not found
        """
        query = "SELECT * FROM TemplateConfig WHERE ConfigId = @config_id AND IsActive = 1"
        results = await db.execute_query_async(query, {"config_id": config_id})
        
        if results and len(results) > 0:
            row_dict = results[0]
            return TemplateConfigResponse(
                ConfigId=row_dict.get('ConfigId'),
                TemplateId=row_dict.get('TemplateId'),
                PresetId=row_dict.get('PresetId'),
                InterfaceId=row_dict.get('InterfaceId'),
                DepartmentId=row_dict.get('DepartmentId'),
                ShopId=row_dict.get('ShopId'),
                Type=row_dict.get('Type'),
                Description=row_dict.get('Description'),
                CreatedBy=row_dict.get('CreatedBy'),
                CreatedOn=row_dict.get('CreatedOn'),
                UpdatedOn=row_dict.get('UpdatedOn'),
                IsActive=bool(row_dict.get('IsActive', True))
            )
        return None
    
    def list_template_configs(
        self,
        template_id: Optional[int] = None,
        preset_id: Optional[int] = None,
        interface_id: Optional[int] = None,
        department_id: Optional[int] = None,
        shop_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100
    ) -> tuple[List[TemplateConfigResponse], int]:
        """
        List template configs, optionally filtered.
        
        Args:
            template_id: Optional template ID filter
            preset_id: Optional preset ID filter
            interface_id: Optional interface ID filter
            department_id: Optional department ID filter
            shop_id: Optional shop ID filter
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            Tuple of (configs list, total count)
        """
        # Build WHERE clause
        conditions = ["IsActive = 1"]
        params = []
        
        if template_id is not None:
            conditions.append("TemplateId = ?")
            params.append(template_id)
        
        if preset_id is not None:
            conditions.append("PresetId = ?")
            params.append(preset_id)
        
        if interface_id is not None:
            conditions.append("InterfaceId = ?")
            params.append(interface_id)
        
        if department_id is not None:
            conditions.append("DepartmentId = ?")
            params.append(department_id)
        
        if shop_id is not None:
            conditions.append("ShopId = ?")
            params.append(shop_id)
        
        where_clause = " AND ".join(conditions)
        
        count_query = f"SELECT COUNT(*) FROM TemplateConfig WHERE {where_clause}"
        list_query = f"""
            SELECT * FROM TemplateConfig 
            WHERE {where_clause}
            ORDER BY CreatedOn DESC
            OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
        """
        
        list_params = params + [skip, limit]
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            try:
                # Get total count
                cursor.execute(count_query, params)
                total = cursor.fetchone()[0]
                
                # Get configs
                cursor.execute(list_query, list_params)
                rows = cursor.fetchall()
                
                configs = [self._row_to_template_config_response(row) for row in rows]
                return configs, total
            finally:
                cursor.close()
    
    def update_template_config(self, config_id: int, config_data: TemplateConfigUpdate) -> Optional[TemplateConfigResponse]:
        """
        Update an existing template config.
        
        Args:
            config_id: Template config ID
            config_data: Update data
            
        Returns:
            Updated template config or None if not found
        """
        # Build update query dynamically
        updates = []
        params = []
        
        if config_data.templateId is not None:
            # Verify template exists
            template_exists = db.execute_scalar(
                "SELECT COUNT(*) FROM ReportTemplates WHERE TemplateId = @templateId AND IsActive = 1",
                {"templateId": config_data.templateId}
            )
            if template_exists == 0:
                raise ValueError(f"Template with ID {config_data.templateId} not found")
            updates.append("TemplateId = ?")
            params.append(config_data.templateId)
        
        if config_data.presetId is not None:
            # Verify preset exists
            preset_exists = db.execute_scalar(
                "SELECT COUNT(*) FROM ReportSqlPresets WHERE PresetId = @presetId AND IsActive = 1",
                {"presetId": config_data.presetId}
            )
            if preset_exists == 0:
                raise ValueError(f"Preset with ID {config_data.presetId} not found")
            updates.append("PresetId = ?")
            params.append(config_data.presetId)
        
        if config_data.interfaceId is not None:
            # Verify interface exists
            interface_exists = db.execute_scalar(
                "SELECT COUNT(*) FROM ainterface WHERE InterfaceID = @interfaceId",
                {"interfaceId": config_data.interfaceId}
            )
            if interface_exists == 0:
                raise ValueError(f"Interface with ID {config_data.interfaceId} not found")
            updates.append("InterfaceId = ?")
            params.append(config_data.interfaceId)
        
        # Handle departmentId - update if a value is provided
        # Note: In Pydantic, None means "not provided" for Optional fields
        # To allow setting to NULL, we check if the field was explicitly set
        # For now, we only update if a non-None value is provided
        if config_data.departmentId is not None:
            # Verify department exists
            dept_exists = db.execute_scalar(
                "SELECT COUNT(*) FROM aDepartmentMaster WHERE DepartmentID = @departmentId",
                {"departmentId": config_data.departmentId}
            )
            if dept_exists == 0:
                raise ValueError(f"Department with ID {config_data.departmentId} not found")
            updates.append("DepartmentId = ?")
            params.append(config_data.departmentId)
        # If departmentId is None, we don't update it (leave existing value)
        
        # Handle shopId - update if a value is provided
        if config_data.shopId is not None:
            # Verify shop exists
            shop_exists = db.execute_scalar(
                "SELECT COUNT(*) FROM ashops WHERE ShopID = @shopId",
                {"shopId": config_data.shopId}
            )
            if shop_exists == 0:
                raise ValueError(f"Shop with ID {config_data.shopId} not found")
            updates.append("ShopId = ?")
            params.append(config_data.shopId)
        # If shopId is None, we don't update it (leave existing value)
        
        if config_data.type is not None:
            updates.append("Type = ?")
            params.append(config_data.type)
        
        if config_data.description is not None:
            updates.append("Description = ?")
            params.append(config_data.description)
        
        if config_data.isActive is not None:
            updates.append("IsActive = ?")
            params.append(config_data.isActive)
        
        if not updates:
            # No updates provided, just return existing
            import asyncio
            try:
                loop = asyncio.get_event_loop()
                return loop.run_until_complete(self.get_template_config(config_id))
            except RuntimeError:
                return asyncio.run(self.get_template_config(config_id))
        
        updates.append("UpdatedOn = GETDATE()")
        params.append(config_id)
        
        update_query = f"""
            UPDATE TemplateConfig 
            SET {', '.join(updates)}
            OUTPUT INSERTED.*
            WHERE ConfigId = ? AND IsActive = 1
        """
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute(update_query, params)
                row = cursor.fetchone()
                conn.commit()
                
                if row:
                    return self._row_to_template_config_response(row)
                return None
            finally:
                cursor.close()
    
    def delete_template_config(self, config_id: int) -> bool:
        """
        Soft delete a template config (set IsActive = 0).
        
        Args:
            config_id: Template config ID
            
        Returns:
            True if deleted, False if not found
        """
        update_query = """
            UPDATE TemplateConfig 
            SET IsActive = 0, UpdatedOn = GETDATE()
            WHERE ConfigId = ? AND IsActive = 1
        """
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute(update_query, (config_id,))
                conn.commit()
                return cursor.rowcount > 0
            finally:
                cursor.close()
    
    def _row_to_template_config_response(self, row) -> TemplateConfigResponse:
        """Convert database row to TemplateConfigResponse."""
        # Handle both tuple and dict results
        if isinstance(row, dict):
            return TemplateConfigResponse(
                ConfigId=row.get('ConfigId'),
                TemplateId=row.get('TemplateId'),
                PresetId=row.get('PresetId'),
                InterfaceId=row.get('InterfaceId'),
                DepartmentId=row.get('DepartmentId'),
                ShopId=row.get('ShopId'),
                Type=row.get('Type'),
                Description=row.get('Description'),
                CreatedBy=row.get('CreatedBy'),
                CreatedOn=row.get('CreatedOn'),
                UpdatedOn=row.get('UpdatedOn'),
                IsActive=bool(row.get('IsActive', True))
            )
        else:
            # Tuple format (from cursor.fetchone())
            return TemplateConfigResponse(
                ConfigId=row[0],
                TemplateId=row[1],
                PresetId=row[2],
                InterfaceId=row[3],
                DepartmentId=row[4] if len(row) > 4 and row[4] is not None else None,
                ShopId=row[5] if len(row) > 5 and row[5] is not None else None,
                Type=row[6] if len(row) > 6 else '',
                Description=row[7] if len(row) > 7 and row[7] is not None else None,
                CreatedBy=row[8] if len(row) > 8 and row[8] is not None else None,
                CreatedOn=row[9] if len(row) > 9 else None,
                UpdatedOn=row[10] if len(row) > 10 and row[10] is not None else None,
                IsActive=bool(row[11] if len(row) > 11 else True)
            )


# Global service instance
template_config_service = TemplateConfigService()

