"""
Service for managing Template Parameters.
Handles CRUD operations for template parameter values.
"""
from typing import List, Optional, Dict
from app.database import db
from app.models.template_parameter import (
    TemplateParameterCreate,
    TemplateParameterUpdate,
    TemplateParameterResponse,
    BulkTemplateParameterUpdate
)
import logging

logger = logging.getLogger(__name__)


class TemplateParameterService:
    """Service for template parameter management."""
    
    async def create_parameter(self, parameter_data: TemplateParameterCreate) -> TemplateParameterResponse:
        """
        Create a new template parameter.
        
        Args:
            parameter_data: Parameter creation data
            
        Returns:
            Created parameter
            
        Raises:
            ValueError: If template doesn't exist or parameter already exists
        """
        # Ensure table exists
        from app.utils.company_schema import ensure_company_schema
        ensure_company_schema()
        
        # Verify table exists
        table_exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ReportTemplateParameters','U')")
        if not table_exists:
            logger.warning("ReportTemplateParameters table not found in create_parameter, attempting to create...")
            ensure_company_schema()
            table_exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ReportTemplateParameters','U')")
            if not table_exists:
                raise ValueError("ReportTemplateParameters table could not be created. Please check database permissions.")
        
        # Verify template exists
        from app.services.template_service import template_service
        template = await template_service.get_template(parameter_data.templateId)
        if not template:
            raise ValueError(f"Template with ID {parameter_data.templateId} not found")
        
        # Check if parameter already exists for this template
        existing = self.get_parameter_by_name(parameter_data.templateId, parameter_data.parameterName)
        if existing:
            raise ValueError(f"Parameter '{parameter_data.parameterName}' already exists for this template")
        
        # Insert into database
        insert_query = """
            INSERT INTO ReportTemplateParameters (TemplateId, ParameterName, ParameterValue, CreatedBy)
            OUTPUT INSERTED.*
            VALUES (?, ?, ?, ?)
        """
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute(
                    insert_query,
                    (
                        parameter_data.templateId,
                        parameter_data.parameterName,
                        parameter_data.parameterValue,
                        parameter_data.createdBy
                    )
                )
                row = cursor.fetchone()
                conn.commit()
                
                if row:
                    return self._row_to_parameter_response(row)
                else:
                    raise Exception("Failed to create parameter")
            finally:
                cursor.close()
    
    def get_parameter_by_name(self, template_id: int, parameter_name: str) -> Optional[TemplateParameterResponse]:
        """
        Get parameter by template ID and parameter name.
        
        Args:
            template_id: Template ID
            parameter_name: Parameter name
            
        Returns:
            Parameter or None if not found
        """
        # Ensure table exists before querying
        from app.utils.company_schema import ensure_company_schema
        ensure_company_schema()
        
        # Double-check table exists, if not, return None (table will be created on next request)
        table_exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ReportTemplateParameters','U')")
        if not table_exists:
            logger.debug(f"ReportTemplateParameters table not found when querying parameter '{parameter_name}' for template {template_id}")
            return None
        
        query = """
            SELECT * FROM ReportTemplateParameters 
            WHERE TemplateId = ? AND ParameterName = ? AND IsActive = 1
        """
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute(query, (template_id, parameter_name))
                row = cursor.fetchone()
                
                if row:
                    return self._row_to_parameter_response(row)
                return None
            finally:
                cursor.close()
    
    async def get_parameters_by_template(self, template_id: int) -> List[TemplateParameterResponse]:
        """
        Get all parameters for a template.
        
        Args:
            template_id: Template ID
            
        Returns:
            List of parameters
        """
        # Ensure table exists before querying
        from app.utils.company_schema import ensure_company_schema
        ensure_company_schema()
        
        # Verify table exists
        table_exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ReportTemplateParameters','U')")
        if not table_exists:
            logger.debug(f"ReportTemplateParameters table not found when getting parameters for template {template_id}")
            return []
        
        query = """
            SELECT * FROM ReportTemplateParameters 
            WHERE TemplateId = ? AND IsActive = 1
            ORDER BY ParameterName
        """
        
        try:
            with db.get_connection() as conn:
                cursor = conn.cursor()
                try:
                    cursor.execute(query, (template_id,))
                    rows = cursor.fetchall()
                    
                    return [self._row_to_parameter_response(row) for row in rows]
                finally:
                    cursor.close()
        except Exception as e:
            logger.error(f"Error getting parameters for template {template_id}: {e}", exc_info=True)
            raise
    
    def get_parameters_as_dict(self, template_id: int) -> Dict[str, str]:
        """
        Get parameters as a dictionary (parameter name -> value).
        
        Args:
            template_id: Template ID
            
        Returns:
            Dictionary of parameter name-value pairs
        """
        # Ensure table exists before querying
        from app.utils.company_schema import ensure_company_schema
        ensure_company_schema()
        
        # Verify table exists
        table_exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ReportTemplateParameters','U')")
        if not table_exists:
            logger.debug(f"ReportTemplateParameters table not found when getting parameters dict for template {template_id}")
            return {}
        
        # Use sync method since this is called from sync contexts
        query = """
            SELECT ParameterName, ParameterValue FROM ReportTemplateParameters 
            WHERE TemplateId = ? AND IsActive = 1
        """
        
        try:
            with db.get_connection() as conn:
                cursor = conn.cursor()
                try:
                    cursor.execute(query, (template_id,))
                    rows = cursor.fetchall()
                    
                    result = {}
                    for row in rows:
                        result[row[0]] = row[1] if row[1] else ''
                    return result
                finally:
                    cursor.close()
        except Exception as e:
            logger.error(f"Error getting parameters dict for template {template_id}: {e}", exc_info=True)
            return {}
    
    async def update_parameter(self, parameter_id: int, parameter_data: TemplateParameterUpdate) -> Optional[TemplateParameterResponse]:
        """
        Update an existing parameter.
        
        Args:
            parameter_id: Parameter ID
            parameter_data: Update data
            
        Returns:
            Updated parameter or None if not found
        """
        # Build update query dynamically
        updates = []
        params = []
        
        if parameter_data.parameterValue is not None:
            updates.append("ParameterValue = ?")
            params.append(parameter_data.parameterValue)
        
        if parameter_data.isActive is not None:
            updates.append("IsActive = ?")
            params.append(parameter_data.isActive)
        
        if not updates:
            # No updates provided, just return existing
            return await self.get_parameter(parameter_id)
        
        updates.append("UpdatedOn = GETDATE()")
        params.append(parameter_id)
        
        update_query = f"""
            UPDATE ReportTemplateParameters 
            SET {', '.join(updates)}
            OUTPUT INSERTED.*
            WHERE ParameterId = ? AND IsActive = 1
        """
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute(update_query, params)
                row = cursor.fetchone()
                conn.commit()
                
                if row:
                    return self._row_to_parameter_response(row)
                return None
            finally:
                cursor.close()
    
    async def get_parameter(self, parameter_id: int) -> Optional[TemplateParameterResponse]:
        """
        Get parameter by ID.
        
        Args:
            parameter_id: Parameter ID
            
        Returns:
            Parameter or None if not found
        """
        query = "SELECT * FROM ReportTemplateParameters WHERE ParameterId = @parameter_id AND IsActive = 1"
        results = await db.execute_query_async(query, {"parameter_id": parameter_id})
        
        if results and len(results) > 0:
            row_dict = results[0]
            return TemplateParameterResponse(
                ParameterId=row_dict.get('ParameterId'),
                TemplateId=row_dict.get('TemplateId'),
                ParameterName=row_dict.get('ParameterName'),
                ParameterValue=row_dict.get('ParameterValue'),
                CreatedBy=row_dict.get('CreatedBy'),
                CreatedOn=row_dict.get('CreatedOn'),
                UpdatedOn=row_dict.get('UpdatedOn'),
                IsActive=bool(row_dict.get('IsActive', True))
            )
        return None
    
    async def delete_parameter(self, parameter_id: int) -> bool:
        """
        Soft delete a parameter (set IsActive = 0).
        
        Args:
            parameter_id: Parameter ID
            
        Returns:
            True if deleted, False if not found
        """
        update_query = """
            UPDATE ReportTemplateParameters 
            SET IsActive = 0, UpdatedOn = GETDATE()
            WHERE ParameterId = ? AND IsActive = 1
        """
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute(update_query, (parameter_id,))
                conn.commit()
                return cursor.rowcount > 0
            finally:
                cursor.close()
    
    async def bulk_update_parameters(self, bulk_data: BulkTemplateParameterUpdate) -> List[TemplateParameterResponse]:
        """
        Bulk create/update parameters for a template.
        
        Args:
            bulk_data: Bulk update data with template ID and parameters dict
            
        Returns:
            List of created/updated parameters
        """
        # Ensure table exists before operations
        from app.utils.company_schema import ensure_company_schema
        ensure_company_schema()
        
        # Verify template exists
        from app.services.template_service import template_service
        template = await template_service.get_template(bulk_data.templateId)
        if not template:
            raise ValueError(f"Template with ID {bulk_data.templateId} not found")
        
        # Verify table exists before proceeding
        table_exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ReportTemplateParameters','U')")
        if not table_exists:
            # Table doesn't exist, try to create it one more time
            logger.warning("ReportTemplateParameters table not found, attempting to create...")
            ensure_company_schema()
            table_exists = db.execute_scalar("SELECT OBJECT_ID('dbo.ReportTemplateParameters','U')")
            if not table_exists:
                error_msg = "ReportTemplateParameters table could not be created. Please check database permissions and ensure ReportTemplates table exists."
                logger.error(error_msg)
                raise ValueError(error_msg)
            else:
                logger.info("ReportTemplateParameters table created successfully")
        
        results = []
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            try:
                for param_name, param_value in bulk_data.parameters.items():
                    try:
                        # Check if parameter exists using a direct query within the same connection
                        check_query = """
                            SELECT ParameterId FROM ReportTemplateParameters 
                            WHERE TemplateId = ? AND ParameterName = ? AND IsActive = 1
                        """
                        cursor.execute(check_query, (bulk_data.templateId, param_name))
                        existing_row = cursor.fetchone()
                        
                        if existing_row:
                            # Update existing
                            existing_id = existing_row[0]
                            update_query = """
                                UPDATE ReportTemplateParameters 
                                SET ParameterValue = ?, UpdatedOn = GETDATE()
                                OUTPUT INSERTED.*
                                WHERE ParameterId = ? AND IsActive = 1
                            """
                            cursor.execute(update_query, (param_value, existing_id))
                            row = cursor.fetchone()
                            if row:
                                results.append(self._row_to_parameter_response(row))
                        else:
                            # Create new
                            insert_query = """
                                INSERT INTO ReportTemplateParameters (TemplateId, ParameterName, ParameterValue, CreatedBy)
                                OUTPUT INSERTED.*
                                VALUES (?, ?, ?, ?)
                            """
                            cursor.execute(
                                insert_query,
                                (bulk_data.templateId, param_name, param_value, bulk_data.createdBy)
                            )
                            row = cursor.fetchone()
                            if row:
                                results.append(self._row_to_parameter_response(row))
                    except Exception as e:
                        logger.error(f"Error processing parameter '{param_name}': {e}", exc_info=True)
                        raise
                
                conn.commit()
                logger.debug(f"Bulk updated {len(results)} parameters for template {bulk_data.templateId}")
                return results
            except Exception as e:
                conn.rollback()
                logger.error(f"Error in bulk_update_parameters: {e}", exc_info=True)
                raise
            finally:
                cursor.close()
    
    def _row_to_parameter_response(self, row) -> TemplateParameterResponse:
        """Convert database row to TemplateParameterResponse."""
        return TemplateParameterResponse(
            ParameterId=row[0],
            TemplateId=row[1],
            ParameterName=row[2],
            ParameterValue=row[3],
            CreatedBy=row[4],
            CreatedOn=row[5],
            UpdatedOn=row[6] if len(row) > 6 else None,
            IsActive=bool(row[7] if len(row) > 7 else True)
        )


# Global service instance
template_parameter_service = TemplateParameterService()

