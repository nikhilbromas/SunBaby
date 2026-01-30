"""
Service for generating bill previews.
Executes SQL presets and prepares data for template rendering.
"""
import json
import asyncio
from typing import Dict, List, Optional, Any
from app.database import db
from app.services.preset_service import preset_service
from app.services.template_service import template_service
from app.utils.cache import query_cache, make_cache_key
from app.config import settings


class PreviewService:
    """Service for generating bill previews."""
    
    async def generate_preview_data(self, template_id: int, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate preview data by executing SQL presets with given parameters (async).
        
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
        # Get template (we need it first to get preset_id)
        template = await template_service.get_template(template_id)
        if not template:
            raise ValueError(f"Template with ID {template_id} not found")
        
        # Get linked preset
        preset = await preset_service.get_preset(template.PresetId)
        if not preset:
            raise ValueError(f"Preset with ID {template.PresetId} not found")
        
        # Parse SQL JSON
        sql_json = json.loads(preset.SqlJson)
        
        # Validate required parameters
        required_params = self._extract_required_parameters(sql_json)
        missing_params = [p for p in required_params if p not in parameters]
        if missing_params:
            raise ValueError(f"Missing required parameters: {', '.join(missing_params)}")
        
        # Check cache for query results
        cache_key = make_cache_key("preview_data", template_id, **parameters)
        cached_result = query_cache.get(cache_key)
        if cached_result is not None:
            return cached_result
        
        # Execute queries in parallel
        tasks = []
        query_types = []
        queries_for_cache = []
        
        if 'headerQuery' in sql_json:
            query = sql_json['headerQuery']
            queries_for_cache.append(('header', query))
            tasks.append(db.execute_query_async(query, parameters))
            query_types.append('header')
        
        if 'itemQuery' in sql_json:
            query = sql_json['itemQuery']
            queries_for_cache.append(('items', query))
            tasks.append(db.execute_query_async(query, parameters))
            query_types.append('items')
        
        # Execute contentDetails queries in parallel
        content_detail_queries = {}
        if 'contentDetails' in sql_json and isinstance(sql_json['contentDetails'], list):
            for content_detail in sql_json['contentDetails']:
                if not isinstance(content_detail, dict) or 'name' not in content_detail or 'query' not in content_detail:
                    continue
                
                name = content_detail['name']
                query = content_detail['query']
                content_detail_queries[name] = query
                queries_for_cache.append((f'contentDetail:{name}', query))
                tasks.append(db.execute_query_async(query, parameters))
                query_types.append(f'contentDetail:{name}')
        
        # Execute all queries in parallel
        results = []
        if tasks:
            try:
                results = await asyncio.gather(*tasks, return_exceptions=True)
            except Exception as e:
                raise ValueError(f"Error executing queries: {str(e)}")
        
        # Process results
        header_data = None
        items_data = None
        content_details = {}
        
        for i, result in enumerate(results):
            query_type = query_types[i]
            
            if isinstance(result, Exception):
                raise ValueError(f"Error executing {query_type} query: {str(result)}")
            
            # Limit rows for preview
            if len(result) > settings.MAX_QUERY_ROWS:
                result = result[:settings.MAX_QUERY_ROWS]
            
            if query_type == 'header':
                header_data = result
            elif query_type == 'items':
                items_data = result
            elif query_type.startswith('contentDetail:'):
                name = query_type.split(':', 1)[1]
                content_details[name] = result if result else []
        
        result_data = {
            'header': header_data[0] if header_data and len(header_data) > 0 else None,
            'items': items_data if items_data else [],
            'contentDetails': content_details,
            'template': template
        }
        
        # Cache the result
        query_cache.set(cache_key, result_data)
        
        return result_data
    
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

