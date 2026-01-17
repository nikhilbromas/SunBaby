"""
Service for generating bill previews.
Executes SQL presets and prepares data for template rendering.
"""
import json
from typing import Dict, List, Optional, Any
from app.database import db
from app.services.preset_service import preset_service
from app.services.template_service import template_service
from app.config import settings
import logging

logger = logging.getLogger(__name__)


class PreviewService:
    """Service for generating bill previews."""
    
    def generate_preview_data(self, template_id: int, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate preview data by executing SQL presets with given parameters.
        
        Args:
            template_id: Template ID
            parameters: Dictionary of parameter values
            
        Returns:
            Dictionary containing header and items data:
            {
                'header': List[Dict] or None,
                'items': List[Dict] or None,
                'template': TemplateResponse
            }
            
        Raises:
            ValueError: If template not found or parameters missing
        """
        # Get template
        template = template_service.get_template(template_id)
        if not template:
            raise ValueError(f"Template with ID {template_id} not found")
        
        # Get linked preset
        preset = preset_service.get_preset(template.PresetId)
        if not preset:
            raise ValueError(f"Preset with ID {template.PresetId} not found")
        
        # Parse SQL JSON
        sql_json = json.loads(preset.SqlJson)
        
        # Validate required parameters
        required_params = self._extract_required_parameters(sql_json)
        missing_params = [p for p in required_params if p not in parameters]
        if missing_params:
            raise ValueError(f"Missing required parameters: {', '.join(missing_params)}")
        
        # Execute queries
        header_data = None
        items_data = None
        content_details = {}
        
        if 'headerQuery' in sql_json:
            try:
                header_data = db.execute_query(sql_json['headerQuery'], parameters)
                # Limit rows for preview
                if len(header_data) > settings.MAX_QUERY_ROWS:
                    header_data = header_data[:settings.MAX_QUERY_ROWS]
                    logger.warning(f"Header query returned more than {settings.MAX_QUERY_ROWS} rows, truncated")
            except Exception as e:
                logger.error(f"Error executing header query: {str(e)}")
                raise ValueError(f"Error executing header query: {str(e)}")
        
        if 'itemQuery' in sql_json:
            try:
                items_data = db.execute_query(sql_json['itemQuery'], parameters)
                # Limit rows for preview
                if len(items_data) > settings.MAX_QUERY_ROWS:
                    items_data = items_data[:settings.MAX_QUERY_ROWS]
                    logger.warning(f"Item query returned more than {settings.MAX_QUERY_ROWS} rows, truncated")
            except Exception as e:
                logger.error(f"Error executing item query: {str(e)}")
                raise ValueError(f"Error executing item query: {str(e)}")
        
        # Execute contentDetails queries
        if 'contentDetails' in sql_json and isinstance(sql_json['contentDetails'], list):
            for content_detail in sql_json['contentDetails']:
                if not isinstance(content_detail, dict) or 'name' not in content_detail or 'query' not in content_detail:
                    continue
                
                name = content_detail['name']
                query = content_detail['query']
                
                try:
                    cd_data = db.execute_query(query, parameters)
                    # Limit rows for preview
                    if len(cd_data) > settings.MAX_QUERY_ROWS:
                        cd_data = cd_data[:settings.MAX_QUERY_ROWS]
                        logger.warning(f"Content detail '{name}' query returned more than {settings.MAX_QUERY_ROWS} rows, truncated")
                    content_details[name] = cd_data if cd_data else []
                except Exception as e:
                    logger.error(f"Error executing content detail '{name}' query: {str(e)}")
                    raise ValueError(f"Error executing content detail '{name}' query: {str(e)}")
        
        return {
            'header': header_data[0] if header_data and len(header_data) > 0 else None,
            'items': items_data if items_data else [],
            'contentDetails': content_details,
            'template': template
        }
    
    def _extract_required_parameters(self, sql_json: Dict[str, Any]) -> List[str]:
        """
        Extract required parameters from SQL JSON.
        
        Args:
            sql_json: SQL JSON dictionary
            
        Returns:
            List of required parameter names
        """
        import re
        param_pattern = r'@(\w+)'
        all_params = []
        
        # Extract from headerQuery
        if 'headerQuery' in sql_json and sql_json['headerQuery']:
            params = re.findall(param_pattern, sql_json['headerQuery'], re.IGNORECASE)
            all_params.extend(params)
        
        # Extract from itemQuery
        if 'itemQuery' in sql_json and sql_json['itemQuery']:
            params = re.findall(param_pattern, sql_json['itemQuery'], re.IGNORECASE)
            all_params.extend(params)
        
        # Extract from contentDetails
        if 'contentDetails' in sql_json and isinstance(sql_json['contentDetails'], list):
            for content_detail in sql_json['contentDetails']:
                if isinstance(content_detail, dict) and 'query' in content_detail:
                    params = re.findall(param_pattern, content_detail['query'], re.IGNORECASE)
                    all_params.extend(params)
        
        # Remove duplicates and return
        return list(set(all_params))
    
    def prepare_data_for_template(self, preview_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Prepare data structure for template rendering.
        Flattens header data and organizes items and contentDetails for easy access.
        
        Args:
            preview_data: Preview data from generate_preview_data
            
        Returns:
            Prepared data structure:
            {
                'header': {...},
                'items': [...],
                'contentDetails': {name: [...]}
            }
        """
        return {
            'header': preview_data.get('header', {}),
            'items': preview_data.get('items', []),
            'contentDetails': preview_data.get('contentDetails', {})
        }


# Global service instance
preview_service = PreviewService()

