"""
Service for managing Templates.
Handles CRUD operations for bill templates.
"""
from typing import List, Optional
from app.database import db
from app.models.template import TemplateCreate, TemplateUpdate, TemplateResponse
from app.utils.cache import template_cache, make_cache_key
import logging

logger = logging.getLogger(__name__)


class TemplateService:
    """Service for template management."""
    
    async def create_template(self, template_data: TemplateCreate) -> TemplateResponse:
        """
        Create a new template.
        
        Args:
            template_data: Template creation data
            
        Returns:
            Created template
            
        Raises:
            ValueError: If preset doesn't exist or template name already exists
        """
        # Verify preset exists
        from app.services.preset_service import preset_service
        preset = await preset_service.get_preset(template_data.presetId)
        if not preset:
            raise ValueError(f"Preset with ID {template_data.presetId} not found")
        
        # Check if template name already exists for this preset
        existing = self.get_template_by_name(template_data.templateName, template_data.presetId)
        if existing:
            raise ValueError(f"Template with name '{template_data.templateName}' already exists for this preset")
        
        # Insert into database
        insert_query = """
            INSERT INTO ReportTemplates (PresetId, TemplateName, TemplateJson, CreatedBy)
            OUTPUT INSERTED.*
            VALUES (?, ?, ?, ?)
        """
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute(
                    insert_query,
                    (
                        template_data.presetId,
                        template_data.templateName,
                        template_data.templateJson,
                        template_data.createdBy
                    )
                )
                row = cursor.fetchone()
                conn.commit()
                
                if row:
                    template = self._row_to_template_response(row)
                    # Cache the new template
                    cache_key = make_cache_key("template", template.TemplateId)
                    template_cache.set(cache_key, template)
                    return template
                else:
                    raise Exception("Failed to create template")
            finally:
                cursor.close()
    
    async def get_template(self, template_id: int) -> Optional[TemplateResponse]:
        """
        Get template by ID (async).
        
        Args:
            template_id: Template ID
            
        Returns:
            Template or None if not found
        """
        # Check cache first
        cache_key = make_cache_key("template", template_id)
        cached = template_cache.get(cache_key)
        if cached is not None:
            return cached
        
        # Use async query execution with @ParamName format
        query = "SELECT * FROM ReportTemplates WHERE TemplateId = @template_id AND IsActive = 1"
        results = await db.execute_query_async(query, {"template_id": template_id})
        
        if results and len(results) > 0:
            # Convert dict result to TemplateResponse
            row_dict = results[0]
            template = TemplateResponse(
                TemplateId=row_dict.get('TemplateId'),
                PresetId=row_dict.get('PresetId'),
                TemplateName=row_dict.get('TemplateName'),
                TemplateJson=row_dict.get('TemplateJson'),
                CreatedBy=row_dict.get('CreatedBy'),
                CreatedOn=row_dict.get('CreatedOn'),
                UpdatedOn=row_dict.get('UpdatedOn'),
                IsActive=bool(row_dict.get('IsActive', True))
            )
            # Cache the result
            template_cache.set(cache_key, template)
            return template
        return None
    
    def get_template_by_name(self, template_name: str, preset_id: Optional[int] = None) -> Optional[TemplateResponse]:
        """
        Get template by name.
        
        Args:
            template_name: Template name
            preset_id: Optional preset ID filter
            
        Returns:
            Template or None if not found
        """
        if preset_id:
            query = "SELECT * FROM ReportTemplates WHERE TemplateName = ? AND PresetId = ? AND IsActive = 1"
            params = (template_name, preset_id)
        else:
            query = "SELECT * FROM ReportTemplates WHERE TemplateName = ? AND IsActive = 1"
            params = (template_name,)
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute(query, params)
                row = cursor.fetchone()
                
                if row:
                    return self._row_to_template_response(row)
                return None
            finally:
                cursor.close()
    
    def list_templates(self, preset_id: Optional[int] = None, skip: int = 0, limit: int = 100) -> tuple[List[TemplateResponse], int]:
        """
        List templates, optionally filtered by preset.
        
        Args:
            preset_id: Optional preset ID filter
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            Tuple of (templates list, total count)
        """
        if preset_id:
            count_query = "SELECT COUNT(*) FROM ReportTemplates WHERE PresetId = ? AND IsActive = 1"
            list_query = """
                SELECT * FROM ReportTemplates 
                WHERE PresetId = ? AND IsActive = 1 
                ORDER BY CreatedOn DESC
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
            """
            count_params = (preset_id,)
            list_params = (preset_id, skip, limit)
        else:
            count_query = "SELECT COUNT(*) FROM ReportTemplates WHERE IsActive = 1"
            list_query = """
                SELECT * FROM ReportTemplates 
                WHERE IsActive = 1 
                ORDER BY CreatedOn DESC
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
            """
            count_params = ()
            list_params = (skip, limit)
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            try:
                # Get total count
                cursor.execute(count_query, count_params)
                total = cursor.fetchone()[0]
                
                # Get templates
                cursor.execute(list_query, list_params)
                rows = cursor.fetchall()
                
                templates = [self._row_to_template_response(row) for row in rows]
                return templates, total
            finally:
                cursor.close()
    
    async def update_template(self, template_id: int, template_data: TemplateUpdate) -> Optional[TemplateResponse]:
        """
        Update an existing template.
        
        Args:
            template_id: Template ID
            template_data: Update data
            
        Returns:
            Updated template or None if not found
            
        Raises:
            ValueError: If preset doesn't exist
        """
        # Verify preset exists if presetId is being updated
        if template_data.presetId is not None:
            from app.services.preset_service import preset_service
            preset = await preset_service.get_preset(template_data.presetId)
            if not preset:
                raise ValueError(f"Preset with ID {template_data.presetId} not found")
        
        # Build update query dynamically
        updates = []
        params = []
        
        if template_data.templateName is not None:
            updates.append("TemplateName = ?")
            params.append(template_data.templateName)
        
        if template_data.templateJson is not None:
            updates.append("TemplateJson = ?")
            params.append(template_data.templateJson)
        
        if template_data.presetId is not None:
            updates.append("PresetId = ?")
            params.append(template_data.presetId)
        
        if template_data.isActive is not None:
            updates.append("IsActive = ?")
            params.append(template_data.isActive)
        
        if not updates:
            # No updates provided, just return existing
            return await self.get_template(template_id)
        
        updates.append("UpdatedOn = GETDATE()")
        params.append(template_id)
        
        update_query = f"""
            UPDATE ReportTemplates 
            SET {', '.join(updates)}
            OUTPUT INSERTED.*
            WHERE TemplateId = ? AND IsActive = 1
        """
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute(update_query, params)
                row = cursor.fetchone()
                conn.commit()
                
                if row:
                    template = self._row_to_template_response(row)
                    # Update cache
                    cache_key = make_cache_key("template", template_id)
                    template_cache.set(cache_key, template)
                    return template
                return None
            finally:
                cursor.close()
    
    def delete_template(self, template_id: int) -> bool:
        """
        Soft delete a template (set IsActive = 0).
        
        Args:
            template_id: Template ID
            
        Returns:
            True if deleted, False if not found
        """
        update_query = """
            UPDATE ReportTemplates 
            SET IsActive = 0, UpdatedOn = GETDATE()
            WHERE TemplateId = ? AND IsActive = 1
        """
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute(update_query, (template_id,))
                conn.commit()
                deleted = cursor.rowcount > 0
                if deleted:
                    # Invalidate cache
                    cache_key = make_cache_key("template", template_id)
                    template_cache.delete(cache_key)
                return deleted
            finally:
                cursor.close()
    
    def _row_to_template_response(self, row) -> TemplateResponse:
        """Convert database row to TemplateResponse."""
        return TemplateResponse(
            TemplateId=row[0],
            PresetId=row[1],
            TemplateName=row[2],
            TemplateJson=row[3],
            CreatedBy=row[4],
            CreatedOn=row[5],
            UpdatedOn=row[6] if len(row) > 6 else None,
            IsActive=bool(row[7] if len(row) > 7 else True)
        )


# Global service instance
template_service = TemplateService()

