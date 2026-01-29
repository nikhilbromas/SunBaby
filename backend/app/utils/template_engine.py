"""
Jinja2 template engine for rendering bill templates.
Converts template JSON to HTML.
"""
from jinja2 import Environment, BaseLoader, Template
from typing import Dict, Any, Tuple, List
import json
import math
from datetime import datetime


class TemplateEngine:
    """Template rendering engine using Jinja2."""
    
    def __init__(self):
        """Initialize template engine."""
        self.env = Environment(
            loader=BaseLoader(),
            autoescape=True,
            trim_blocks=True,
            lstrip_blocks=True
        )
    
    def render_template(self, template_json: str, data: Dict[str, Any]) -> str:
        """
        Render template JSON to HTML.
        
        Args:
            template_json: Template JSON string
            data: Data dictionary with 'header' and 'items'
            
        Returns:
            Rendered HTML string
        """
        template_config = json.loads(template_json)
        
        # Generate HTML from template configuration
        html = self._generate_html(template_config, data)
        
        return html
    
    def _render_content_detail_table(self, table_config: Dict[str, Any], data_chunk: List[Dict[str, Any]], 
                                     page_num: int, total_pages: int, repeat_header: bool = True) -> str:
        """
        Render a single page of content detail table data.
        
        Args:
            table_config: Table configuration with contentName
            data_chunk: List of items for this page
            page_num: Current page number (1-based)
            total_pages: Total number of pages
            repeat_header: Whether to repeat table header
            
        Returns:
            HTML string for the table page
        """
        table_x = table_config.get('x', 0)
        table_y = table_config.get('y', 0)
        
        # Build table container style (relative positioning within bill-content)
        table_style_parts = [f'position: relative; left: {table_x}px; top: {table_y}px;']
        if table_config.get('tableWidth'):
            table_style_parts.append(f'width: {table_config.get("tableWidth")}px')
        table_style = '; '.join(table_style_parts)
        
        # Build table style
        table_inline_style = []
        border_color = table_config.get('borderColor', '#dddddd')
        border_width = table_config.get('borderWidth', 1)
        cell_padding = table_config.get('cellPadding', 10)
        font_size = table_config.get('fontSize')
        
        if font_size:
            table_inline_style.append(f'font-size: {font_size}px')
        
        table_style_str = '; '.join(table_inline_style) if table_inline_style else ''
        
        html_parts = [f'<div class="bill-content-table" style="{table_style}">']
        html_parts.append(f'<table style="{table_style_str}">')
        
        # Table header
        columns = table_config.get('columns', [])
        visible_columns = [col for col in columns if col.get('visible', True)]
        if visible_columns and (page_num == 1 or repeat_header):
            header_bg = table_config.get('headerBackgroundColor', '#f0f0f0')
            header_text = table_config.get('headerTextColor', '#000000')
            html_parts.append('<thead><tr>')
            for col in visible_columns:
                align = col.get('align', 'left')
                width_style = f'width: {col.get("width")}px;' if col.get('width') else ''
                html_parts.append(
                    f'<th style="text-align: {align}; background-color: {header_bg}; color: {header_text}; '
                    f'padding: {cell_padding}px; border: {border_width}px solid {border_color}; {width_style}">'
                    f'{col.get("label", "")}</th>'
                )
            html_parts.append('</tr></thead>')
        
        # Table body
        html_parts.append('<tbody>')
        alternate_color = table_config.get('alternateRowColor', '#f9f9f9')
        if data_chunk and len(data_chunk) > 0:
            for idx, item in enumerate(data_chunk):
                row_bg = alternate_color if idx % 2 == 1 else ''
                row_style = f'background-color: {row_bg};' if row_bg else ''
                html_parts.append(f'<tr style="{row_style}">')
                for col in visible_columns:
                    # Bind directly from item dictionary
                    bind_path = col.get('bind', '')
                    if bind_path:
                        # If bind path has no dot, get directly from item
                        if '.' not in bind_path:
                            value = str(item.get(bind_path, '')) if isinstance(item, dict) else ''
                        else:
                            value = self._get_field_value(bind_path, item)
                    else:
                        value = ''
                    align = col.get('align', 'left')
                    html_parts.append(
                        f'<td style="text-align: {align}; padding: {cell_padding}px; '
                        f'border: {border_width}px solid {border_color};">{value}</td>'
                    )
                html_parts.append('</tr>')
        else:
            # Show empty row if no items
            html_parts.append('<tr>')
            for col in visible_columns:
                html_parts.append(
                    f'<td style="text-align: center; color: #999; padding: {cell_padding}px; '
                    f'border: {border_width}px solid {border_color};">-</td>'
                )
            html_parts.append('</tr>')
        html_parts.append('</tbody>')
        
        html_parts.append('</table>')
        html_parts.append('</div>')
        
        return '\n'.join(html_parts)
    
    def _render_bill_content_table(self, table_config: Dict[str, Any], items: List[Dict[str, Any]], 
                                   start_index: int = 0, end_index: int = None, page_num: int = 1, 
                                   total_pages: int = 1, repeat_header: bool = True) -> str:
        """
        Render a bill-content table with items (supports pagination).
        
        Args:
            table_config: Table configuration
            items: List of all items
            start_index: Start index for items (for pagination)
            end_index: End index for items (for pagination, None means all)
            page_num: Current page number
            total_pages: Total number of pages
            repeat_header: Whether to repeat header on each page
            
        Returns:
            HTML string for the table
        """
        table_x = table_config.get('x', 0)
        table_y = table_config.get('y', 0)
        
        # Build table container style (relative positioning within bill-content)
        table_style_parts = [f'position: relative; left: {table_x}px; top: {table_y}px;']
        if table_config.get('tableWidth'):
            table_style_parts.append(f'width: {table_config.get("tableWidth")}px')
        table_style = '; '.join(table_style_parts)
        
        # Build table style
        table_inline_style = []
        border_color = table_config.get('borderColor', '#dddddd')
        border_width = table_config.get('borderWidth', 1)
        cell_padding = table_config.get('cellPadding', 10)
        font_size = table_config.get('fontSize')
        
        if font_size:
            table_inline_style.append(f'font-size: {font_size}px')
        
        table_style_str = '; '.join(table_inline_style) if table_inline_style else ''
        
        html_parts = [f'<div class="bill-content-table" style="{table_style}">']
        html_parts.append(f'<table style="{table_style_str}">')
        
        # Table header
        columns = table_config.get('columns', [])
        visible_columns = [col for col in columns if col.get('visible', True)]
        if visible_columns and (page_num == 1 or repeat_header):
            header_bg = table_config.get('headerBackgroundColor', '#f0f0f0')
            header_text = table_config.get('headerTextColor', '#000000')
            html_parts.append('<thead><tr>')
            for col in visible_columns:
                align = col.get('align', 'left')
                width_style = f'width: {col.get("width")}px;' if col.get('width') else ''
                html_parts.append(
                    f'<th style="text-align: {align}; background-color: {header_bg}; color: {header_text}; '
                    f'padding: {cell_padding}px; border: {border_width}px solid {border_color}; {width_style}">'
                    f'{col.get("label", "")}</th>'
                )
            html_parts.append('</tr></thead>')
        
        # Table body - render only items in the specified range
        html_parts.append('<tbody>')
        alternate_color = table_config.get('alternateRowColor', '#f9f9f9')
        # Ensure we render all items correctly - end_index is exclusive in Python slicing
        if end_index is not None:
            items_to_render = items[start_index:end_index]
            logger.debug(f"[DEBUG] _render_bill_content_table: Rendering items {start_index} to {end_index-1} (exclusive), total items: {len(items)}, items_to_render: {len(items_to_render)}")
        else:
            items_to_render = items[start_index:]
            logger.debug(f"[DEBUG] _render_bill_content_table: Rendering items from {start_index} to end, total items: {len(items)}, items_to_render: {len(items_to_render)}")
        
        if items_to_render and len(items_to_render) > 0:
            for idx, item in enumerate(items_to_render):
                # Calculate actual row index for alternating colors
                actual_idx = start_index + idx
                row_bg = alternate_color if actual_idx % 2 == 1 else ''
                row_style = f'background-color: {row_bg};' if row_bg else ''
                html_parts.append(f'<tr style="{row_style}">')
                for col in visible_columns:
                    # Bind directly from item dictionary
                    bind_path = col.get('bind', '')
                    if bind_path:
                        # If bind path has no dot, get directly from item
                        if '.' not in bind_path:
                            value = str(item.get(bind_path, '')) if isinstance(item, dict) else ''
                        else:
                            value = self._get_field_value(bind_path, item)
                    else:
                        value = ''
                    align = col.get('align', 'left')
                    html_parts.append(
                        f'<td style="text-align: {align}; padding: {cell_padding}px; '
                        f'border: {border_width}px solid {border_color};">{value}</td>'
                    )
                html_parts.append('</tr>')
        else:
            # Show empty row if no items
            html_parts.append('<tr>')
            for col in visible_columns:
                html_parts.append(
                    f'<td style="text-align: center; color: #999; padding: {cell_padding}px; '
                    f'border: {border_width}px solid {border_color};">-</td>'
                )
            html_parts.append('</tr>')
        html_parts.append('</tbody>')
        
        html_parts.append('</table>')
        html_parts.append('</div>')
        
        return '\n'.join(html_parts)
    
    def _render_table_page(self, items_table: Dict[str, Any], items_chunk: List[Dict[str, Any]], 
                          page_num: int, total_pages: int, repeat_header: bool = True) -> str:
        """
        Render a single page of table data.
        
        Args:
            items_table: Table configuration
            items_chunk: List of items for this page
            page_num: Current page number (1-based)
            total_pages: Total number of pages
            repeat_header: Whether to repeat table header
            
        Returns:
            HTML string for the table page
        """
        table_x = items_table.get('x', 0)
        table_y = items_table.get('y', 0)
        
        # Build table container style
        table_style_parts = [f'position: absolute; left: {table_x}px; top: {table_y}px;']
        if items_table.get('tableWidth'):
            table_style_parts.append(f'width: {items_table.get("tableWidth")}px')
        table_style = '; '.join(table_style_parts)
        
        # Build table style
        table_inline_style = []
        border_color = items_table.get('borderColor', '#dddddd')
        border_width = items_table.get('borderWidth', 1)
        cell_padding = items_table.get('cellPadding', 10)
        font_size = items_table.get('fontSize')
        
        if font_size:
            table_inline_style.append(f'font-size: {font_size}px')
        
        table_style_str = '; '.join(table_inline_style) if table_inline_style else ''
        
        html_parts = [f'<div class="bill-items" style="{table_style}">']
        html_parts.append(f'<table style="{table_style_str}">')
        
        # Table header
        columns = items_table.get('columns', [])
        visible_columns = [col for col in columns if col.get('visible', True)]
        if visible_columns and (page_num == 1 or repeat_header):
            header_bg = items_table.get('headerBackgroundColor', '#f0f0f0')
            header_text = items_table.get('headerTextColor', '#000000')
            html_parts.append('<thead><tr>')
            for col in visible_columns:
                align = col.get('align', 'left')
                width_style = f'width: {col.get("width")}px;' if col.get('width') else ''
                html_parts.append(
                    f'<th style="text-align: {align}; background-color: {header_bg}; color: {header_text}; '
                    f'padding: {cell_padding}px; border: {border_width}px solid {border_color}; {width_style}">'
                    f'{col.get("label", "")}</th>'
                )
            html_parts.append('</tr></thead>')
        
        # Table body
        html_parts.append('<tbody>')
        alternate_color = items_table.get('alternateRowColor', '#f9f9f9')
        if items_chunk and len(items_chunk) > 0:
            for idx, item in enumerate(items_chunk):
                row_bg = alternate_color if idx % 2 == 1 else ''
                row_style = f'background-color: {row_bg};' if row_bg else ''
                html_parts.append(f'<tr style="{row_style}">')
                for col in visible_columns:
                    # Bind directly from item dictionary
                    bind_path = col.get('bind', '')
                    if bind_path:
                        # If bind path has no dot, get directly from item
                        if '.' not in bind_path:
                            value = str(item.get(bind_path, '')) if isinstance(item, dict) else ''
                        else:
                            value = self._get_field_value(bind_path, item)
                    else:
                        value = ''
                    align = col.get('align', 'left')
                    html_parts.append(
                        f'<td style="text-align: {align}; padding: {cell_padding}px; '
                        f'border: {border_width}px solid {border_color};">{value}</td>'
                    )
                html_parts.append('</tr>')
        else:
            # Show empty row if no items
            html_parts.append('<tr>')
            for col in visible_columns:
                html_parts.append(
                    f'<td style="text-align: center; color: #999; padding: {cell_padding}px; '
                    f'border: {border_width}px solid {border_color};">-</td>'
                )
            html_parts.append('</tr>')
        html_parts.append('</tbody>')
        
        html_parts.append('</table>')
        html_parts.append('</div>')
        
        return '\n'.join(html_parts)
    
    def _generate_html(self, template_config: Dict[str, Any], data: Dict[str, Any]) -> str:
        """
        Generate HTML from template configuration with pagination support.
        
        Args:
            template_config: Template configuration dictionary
            data: Data dictionary
            
        Returns:
            HTML string
        """
        logger.debug("[DEBUG] _generate_html: Starting HTML generation")
        page_config = template_config.get('page', {})
        page_size = page_config.get('size', 'A4')
        orientation = page_config.get('orientation', 'portrait')
        pagination_config = template_config.get('pagination', {})
        repeat_header = pagination_config.get('repeatHeader', True)
        
        # Initialize content details data early to avoid scope issues
        content_details_data = {}  # {contentName: data}
        logger.debug(f"[DEBUG] _generate_html: Initialized content_details_data = {content_details_data}")
        
        # Calculate pagination for items table
        items = data.get('items', [])
        items_table = template_config.get('itemsTable')
        
        rows_per_page = self._calculate_rows_per_page(template_config, len(items))
        
        # Split items into pages
        total_pages = max(1, (len(items) + rows_per_page - 1) // rows_per_page) if items else 1
        items_pages = []
        for i in range(0, len(items), rows_per_page):
            items_pages.append(items[i:i + rows_per_page])
        
        # If no items, still create one page
        if not items_pages:
            items_pages = [[]]
        
        # Process contentDetails tables
        # Note: contentDetailsTables are rendered as part of bill-content, so they use bill-content pagination
        # not separate pagination
        content_details = data.get('contentDetails', {})
        content_details_tables = template_config.get('contentDetailsTables', [])
        
        for cd_table_config in content_details_tables:
            content_name = cd_table_config.get('contentName')
            logger.debug(f"[DEBUG] _generate_html: Processing content_details_table: {content_name}")
            if content_name and content_name in content_details:
                cd_data = content_details[content_name]
                # Only process array-type contentDetails for tables
                if isinstance(cd_data, list):
                    content_details_data[content_name] = cd_data
                    logger.debug(f"[DEBUG] _generate_html: Added {content_name} to content_details_data, now has {len(content_details_data)} items")
        
        # Calculate bill-content pagination if needed
        bill_content_fields = template_config.get('billContent', [])
        bill_content_tables = template_config.get('billContentTables', [])
        bill_content_height = template_config.get('sectionHeights', {}).get('billContent', 100)
        
        # Get bill-footer fields for height calculation
        bill_footer_fields = template_config.get('billFooter', [])
        
        # Calculate available height for bill-content per page
        logger.debug(f"[DEBUG] _generate_html: Before _calculate_bill_content_pages, content_details_data = {type(content_details_data)}, keys = {list(content_details_data.keys()) if content_details_data else 'None'}")
        try:
            bill_content_pages_info = self._calculate_bill_content_pages(
                template_config, bill_content_fields, bill_content_tables, bill_content_height, items,
                content_details_tables, content_details_data, bill_footer_fields
            )
            logger.debug(f"[DEBUG] _generate_html: After _calculate_bill_content_pages, success")
        except Exception as e:
            logger.error(f"[ERROR] _generate_html: Error in _calculate_bill_content_pages: {str(e)}", exc_info=True)
            raise
        
        # Calculate overall total pages (max of items pages and bill-content pages)
        # Note: contentDetailsTables use bill-content pagination, not separate pagination
        all_page_counts = [total_pages]
        if bill_content_pages_info['total_pages'] > 0:
            all_page_counts.append(bill_content_pages_info['total_pages'])
        overall_total_pages = max(all_page_counts) if all_page_counts else 1
        
        # Start HTML document
        html_parts = [
            '<!DOCTYPE html>',
            '<html>',
            '<head>',
            '<meta charset="UTF-8">',
            '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
            '<title>Bill Preview</title>',
            '<style>',
            self._generate_css(page_size, orientation, template_config),
            '</style>',
            '</head>',
            '<body>'
        ]
        
        # Render each page
        for page_num in range(1, overall_total_pages + 1):
            page_context = {'currentPage': page_num, 'totalPages': overall_total_pages}
            
            # Check if this page has any content before rendering
            has_content = False
            
            # Check for bill header (first page only)
            if page_num == 1:
                header_fields = template_config.get('header', [])
                if header_fields:
                    has_content = True
            
            # Check for bill content
            bill_content_fields = template_config.get('billContent', [])
            bill_content_tables = template_config.get('billContentTables', [])
            content_details_tables = template_config.get('contentDetailsTables', [])
            if bill_content_fields or bill_content_tables or content_details_tables:
                if bill_content_pages_info['total_pages'] > 0:
                    page_info = bill_content_pages_info['pages'].get(page_num)
                    if page_info and (page_info.get('fields') or page_info.get('tables')):
                        has_content = True
                elif page_num == 1:
                    has_content = True
            
            # Check for items table
            if items_table and not bill_content_tables:
                items_chunk = items_pages[page_num - 1] if page_num <= len(items_pages) else []
                if items_chunk and len(items_chunk) > 0:
                    has_content = True
            
            # Check for content details tables (they're part of bill-content, so already checked above)
            
            # Check for bill footer (appears on the page where bill-content ends)
            bill_content_complete = False
            bill_content_last_page = 1
            
            if bill_content_pages_info['total_pages'] > 0:
                bill_content_last_page = bill_content_pages_info['total_pages']
                bill_content_complete = (page_num >= bill_content_last_page)
            else:
                bill_content_last_page = 1
                bill_content_complete = (page_num == 1)
            
            # Bill footer appears on the last page where bill-content exists
            if page_num == bill_content_last_page and bill_content_complete:
                bill_footer_fields = template_config.get('billFooter', [])
                if bill_footer_fields:
                    has_content = True
            
            # Skip rendering if page has no content
            if not has_content:
                continue
            
            # Page container
            html_parts.append('<div class="bill-page">')
            html_parts.append('<div class="bill-container">')
            
            # Page header (appears on every page)
            page_header_fields = template_config.get('pageHeader', [])
            if page_header_fields:
                html_parts.append('<div class="page-header">')
                for field in page_header_fields:
                    html_parts.append(self._render_field(field, data, page_context, 'page-field'))
                html_parts.append('</div>')
            
            # Bill header (appears on first page only)
            if page_num == 1:
                header_fields = template_config.get('header', [])
                if header_fields:
                    html_parts.append('<div class="bill-header">')
                    for field in header_fields:
                        html_parts.append(self._render_field(field, data, page_context))
                    html_parts.append('</div>')
            
            # Bill content section (may span multiple pages if height exceeds available space)
            if bill_content_fields or bill_content_tables or content_details_tables:
                # Check if we need to render bill-content on this page
                if bill_content_pages_info['total_pages'] > 0:
                    # Bill-content spans multiple pages
                    page_info = bill_content_pages_info['pages'].get(page_num)
                    if page_info:
                        html_parts.append(f'<div class="bill-content" style="position: relative; top: {page_info["offset_y"]}px;">')
                        
                        # Render fields for this page chunk
                        for field_info in page_info['fields']:
                            field = field_info['field']
                            # Adjust field Y position relative to page start
                            adjusted_field = field.copy()
                            adjusted_field['y'] = field_info['adjusted_y']
                            html_parts.append(self._render_field(adjusted_field, data, page_context))
                        
                        # Render tables for this page chunk
                        for table_info in page_info['tables']:
                            table_config = table_info['table_config']
                            table_type = table_info.get('type', 'billContent')
                            adjusted_table = table_config.copy()
                            adjusted_table['y'] = table_info['adjusted_y']
                            
                            if table_type == 'contentDetail':
                                # Render content detail table
                                content_name = table_info.get('content_name')
                                logger.debug(f"[DEBUG] _generate_html: Rendering contentDetail table: {content_name}, content_details_data type = {type(content_details_data)}, available keys = {list(content_details_data.keys()) if content_details_data else 'None'}")
                                if content_name and content_name in content_details_data:
                                    cd_data = content_details_data[content_name]
                                    # Render all data for contentDetail table (it's treated as single unit)
                                    if cd_data and isinstance(cd_data, list) and len(cd_data) > 0:
                                        html_parts.append(self._render_content_detail_table(
                                            adjusted_table, cd_data, page_num, 1, repeat_header
                                        ))
                            else:
                                # Render bill-content table
                                table_items = table_info.get('items', data.get('items', []))
                                table_start_index = table_info.get('start_index', 0)
                                table_end_index = table_info.get('end_index', len(table_items) if table_items else 0)
                                # Render table with pagination support
                                html_parts.append(self._render_bill_content_table(
                                    adjusted_table, 
                                    table_items, 
                                    table_start_index, 
                                    table_end_index,
                                    page_num,
                                    bill_content_pages_info['total_pages'],
                                    repeat_header
                                ))
                        
                        # Render bill-footer inside bill-content on the last page
                        bill_content_last_page = bill_content_pages_info['total_pages'] if bill_content_pages_info['total_pages'] > 0 else 1
                        if page_num == bill_content_last_page:
                            bill_footer_fields = template_config.get('billFooter', [])
                            if bill_footer_fields:
                                # Calculate where bill-content ends on this page
                                bill_content_end = 0
                                # Find the bottom of the last element in bill-content
                                max_bottom = 0
                                for field_info in page_info.get('fields', []):
                                    field = field_info['field']
                                    field_y = field_info.get('adjusted_y', field.get('y', 0))
                                    font_size = field.get('fontSize', 12)
                                    field_height = font_size * 1.5 if font_size else 20
                                    max_bottom = max(max_bottom, field_y + field_height)
                                
                                for table_info in page_info.get('tables', []):
                                    table_config = table_info['table_config']
                                    table_y = table_info.get('adjusted_y', 0)
                                    font_size = table_config.get('fontSize', 12)
                                    cell_padding = table_config.get('cellPadding', 10)
                                    border_width = table_config.get('borderWidth', 1)
                                    row_height = font_size + (cell_padding * 2) + (border_width * 2) + 2
                                    header_height = row_height
                                    
                                    if table_info.get('type') == 'contentDetail':
                                        # Calculate full table height for contentDetail tables
                                        content_name = table_info.get('content_name')
                                        if content_name and content_name in content_details_data:
                                            cd_data = content_details_data[content_name]
                                            if isinstance(cd_data, list):
                                                num_rows = len(cd_data)
                                            else:
                                                num_rows = 0
                                        else:
                                            num_rows = 0
                                        table_height = header_height + (row_height * num_rows) if num_rows > 0 else header_height
                                    else:
                                        # Calculate height for billContent tables (may be split across pages)
                                        start_index = table_info.get('start_index', 0)
                                        end_index = table_info.get('end_index', 0)
                                        num_rows = end_index - start_index
                                        table_height = header_height + (row_height * num_rows) if num_rows > 0 else header_height
                                    
                                    max_bottom = max(max_bottom, table_y + table_height)
                                
                                bill_content_end = max_bottom
                                
                                # Position bill-footer after bill-content with spacing (relative to bill-content)
                                bill_footer_y = bill_content_end + 20  # 20px spacing after bill-content
                                
                                html_parts.append(f'<div class="bill-footer" style="position: relative; top: {bill_footer_y}px;">')
                                for field in bill_footer_fields:
                                    html_parts.append(self._render_field(field, data, page_context))
                                html_parts.append('</div>')
                        
                        html_parts.append('</div>')
                else:
                    # Bill-content fits on first page only
                    if page_num == 1:
                        html_parts.append('<div class="bill-content">')
                        
                        # Render bill-content fields
                        for field in bill_content_fields:
                            html_parts.append(self._render_field(field, data, page_context))
                        
                        # Render bill-content tables (fits on one page, no pagination needed)
                        for table_config in bill_content_tables:
                            table_items = data.get('items', [])
                            html_parts.append(self._render_bill_content_table(
                                table_config, 
                                table_items, 
                                0, 
                                None, 
                                1, 
                                1, 
                                True
                            ))
                        
                        # Render contentDetailsTables inside bill-content
                        for cd_table_config in content_details_tables:
                            content_name = cd_table_config.get('contentName')
                            logger.debug(f"[DEBUG] _generate_html: Rendering contentDetailsTable (single page): {content_name}, content_details_data type = {type(content_details_data)}, available keys = {list(content_details_data.keys()) if content_details_data else 'None'}")
                            if content_name and content_name in content_details_data:
                                cd_data = content_details_data[content_name]
                                # Render all data for contentDetail table
                                if cd_data and isinstance(cd_data, list) and len(cd_data) > 0:
                                    html_parts.append(self._render_content_detail_table(
                                        cd_table_config, cd_data, 1, 1, repeat_header
                                    ))
                        
                        # Render bill-footer inside bill-content (single page scenario)
                        bill_footer_fields = template_config.get('billFooter', [])
                        if bill_footer_fields:
                            # Calculate where bill-content ends
                            bill_content_end = 0
                            max_bottom = 0
                            
                            # Calculate max bottom from bill-content fields
                            for field in bill_content_fields:
                                field_y = field.get('y', 0)
                                font_size = field.get('fontSize', 12)
                                field_height = font_size * 1.5 if font_size else 20
                                max_bottom = max(max_bottom, field_y + field_height)
                            
                            # Calculate max bottom from bill-content tables
                            for table_config in bill_content_tables:
                                table_y = table_config.get('y', 0)
                                font_size = table_config.get('fontSize', 12)
                                cell_padding = table_config.get('cellPadding', 10)
                                border_width = table_config.get('borderWidth', 1)
                                row_height = font_size + (cell_padding * 2) + (border_width * 2) + 2
                                header_height = row_height
                                num_items = len(data.get('items', []))
                                rows_height = row_height * num_items if num_items > 0 else row_height
                                table_height = header_height + rows_height
                                max_bottom = max(max_bottom, table_y + table_height)
                            
                            # Calculate max bottom from contentDetailsTables
                            for cd_table_config in content_details_tables:
                                content_name = cd_table_config.get('contentName')
                                if content_name and content_name in content_details_data:
                                    cd_data = content_details_data[content_name]
                                    if isinstance(cd_data, list) and len(cd_data) > 0:
                                        table_y = cd_table_config.get('y', 0)
                                        font_size = cd_table_config.get('fontSize', 12)
                                        cell_padding = cd_table_config.get('cellPadding', 10)
                                        border_width = cd_table_config.get('borderWidth', 1)
                                        row_height = font_size + (cell_padding * 2) + (border_width * 2) + 2
                                        header_height = row_height
                                        num_rows = len(cd_data)
                                        table_height = header_height + (row_height * num_rows)
                                        max_bottom = max(max_bottom, table_y + table_height)
                            
                            bill_content_end = max_bottom
                            
                            # Position bill-footer after bill-content with spacing (relative to bill-content)
                            bill_footer_y = bill_content_end + 20  # 20px spacing after bill-content
                            
                            html_parts.append(f'<div class="bill-footer" style="position: relative; top: {bill_footer_y}px;">')
                            for field in bill_footer_fields:
                                html_parts.append(self._render_field(field, data, page_context))
                            html_parts.append('</div>')
                        
                        html_parts.append('</div>')
            
            # Items table (rendered on each page with its chunk of data)
            # Only render if itemsTable exists AND there are no billContentTables
            # (billContentTables replace itemsTable functionality)
            if items_table and not bill_content_tables:
                items_chunk = items_pages[page_num - 1] if page_num <= len(items_pages) else []
                if items_chunk and len(items_chunk) > 0:
                    html_parts.append(self._render_table_page(
                        items_table, items_chunk, page_num, total_pages, repeat_header
                    ))
            
            # Page footer (appears on every page)
            page_footer_fields = template_config.get('pageFooter', [])
            # Calculate page-footer height for this page
            section_heights = template_config.get('sectionHeights', {})
            if 'pageFooter' in section_heights:
                page_footer_height = section_heights.get('pageFooter', 60)
            else:
                # Calculate height from fields dynamically
                page_footer_height = self._calculate_section_height_from_fields(page_footer_fields, 60)
            
            # Always render page-footer div to maintain page structure with calculated height
            # Position absolute with bottom: 0 ensures it's at the bottom of bill-container
            # Add z-index to ensure it's visible above bill-content
            html_parts.append(f'<div class="page-footer" style="position: absolute; bottom: 0; left: 0; right: 0; height: {page_footer_height}px; min-height: {page_footer_height}px; padding: 10px 40px; width: 794px; z-index: 10; background: white;"><div class="page-footer-relative" style="position: relative; height: {page_footer_height}px; min-height: {page_footer_height}px; width: 100%;">')
            if page_footer_fields:
                for field in page_footer_fields:
                    html_parts.append(self._render_field(field, data, page_context, 'page-field'))
            html_parts.append('</div></div>')
            
            html_parts.append('</div>')  # Close bill-container
            html_parts.append('</div>')  # Close bill-page
            
            # Add page break except for last page
            if page_num < overall_total_pages:
                html_parts.append('<div class="page-break"></div>')
        
        # Close HTML
        html_parts.extend([
            '</body>',
            '</html>'
        ])
        
        logger.debug("[DEBUG] _generate_html: Successfully completed HTML generation")
        return '\n'.join(html_parts)
    
    def _get_special_field_value(self, field_type: str, page_context: Dict[str, Any] = None) -> str:
        """
        Get value for special field types.
        
        Args:
            field_type: Special field type ('pageNumber', 'totalPages', 'currentDate', 'currentTime')
            page_context: Dictionary with 'currentPage' and 'totalPages' keys
            
        Returns:
            Field value as string
        """
        if field_type == 'pageNumber':
            if page_context and 'currentPage' in page_context:
                return str(page_context['currentPage'])
            return '1'
        elif field_type == 'totalPages':
            if page_context and 'totalPages' in page_context:
                return str(page_context['totalPages'])
            return '1'
        elif field_type == 'currentDate':
            return datetime.now().strftime('%Y-%m-%d')
        elif field_type == 'currentTime':
            return datetime.now().strftime('%H:%M:%S')
        return ''
    
    def _get_field_value(self, bind_path: str, data: Dict[str, Any], field_type: str = None, page_context: Dict[str, Any] = None) -> str:
        """
        Get field value from data using binding path or special field type.
        
        Args:
            bind_path: Binding path like 'header.BillNo' or 'ItemName'
            data: Data dictionary or item dictionary
            field_type: Special field type ('pageNumber', 'totalPages', 'currentDate', 'currentTime')
            page_context: Dictionary with 'currentPage' and 'totalPages' keys for special fields
        
        Returns:
            Field value as string
        """
        # Handle special fields
        if field_type and field_type in ['pageNumber', 'totalPages', 'currentDate', 'currentTime']:
            return self._get_special_field_value(field_type, page_context)
        
        if not bind_path:
            return ''
        
        parts = bind_path.split('.')
        value = data
        
        try:
            for part in parts:
                if isinstance(value, dict):
                    value = value.get(part, '')
                elif isinstance(value, list) and len(value) > 0:
                    value = value[0].get(part, '') if isinstance(value[0], dict) else ''
                else:
                    return ''
            
            # Handle None values
            if value is None:
                return ''
            
            return str(value)
        except Exception as e:
            logger.warning(f"Error getting field value for {bind_path}: {str(e)}")
            return ''
    
    def _calculate_bill_content_pages(self, template_config: Dict[str, Any], 
                                     bill_content_fields: List[Dict[str, Any]], 
                                     bill_content_tables: List[Dict[str, Any]], 
                                     bill_content_height: int,
                                     items: List[Dict[str, Any]],
                                     content_details_tables: List[Dict[str, Any]] = None,
                                     content_details_data: Dict[str, List[Dict[str, Any]]] = None,
                                     bill_footer_fields: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Calculate pagination for bill-content section if it exceeds page height.
        
        Args:
            template_config: Template configuration
            bill_content_fields: List of bill-content fields
            bill_content_tables: List of bill-content tables
            bill_content_height: Total height of bill-content
            
        Returns:
            Dictionary with pagination info:
            {
                'total_pages': int,
                'pages': {
                    page_num: {
                        'offset_y': int,  # Y offset for this page
                        'fields': [{'field': dict, 'adjusted_y': int}],
                        'tables': [{'table_config': dict, 'items': list, 'adjusted_y': int}]
                    }
                }
            }
        """
        if content_details_tables is None:
            content_details_tables = []
        # Use a local variable to avoid UnboundLocalError when reassigning content_details_data
        # Python treats content_details_data as local if we assign to it later, so we can't check it directly in an if statement
        # Store parameter value before any assignment to avoid scope issues
        _param_cd_data = content_details_data
        if _param_cd_data is None:
            logger.warning("[DEBUG] _calculate_bill_content_pages: content_details_data parameter was None, using empty dict")
            content_details_data = {}
        else:
            # Reassign to ensure it's a local variable (same reference, but now local scope)
            content_details_data = _param_cd_data
        logger.debug(f"[DEBUG] _calculate_bill_content_pages: Received content_details_data = {type(content_details_data)}, keys = {list(content_details_data.keys()) if content_details_data else 'empty'}")
            
        if not bill_content_fields and not bill_content_tables and not content_details_tables:
            return {'total_pages': 0, 'pages': {}}
        
        # Get page dimensions
        page_config = template_config.get('page', {})
        page_size = page_config.get('size', 'A4')
        orientation = page_config.get('orientation', 'portrait')
        
        page_sizes = {
            'A4': {'portrait': (794, 1123), 'landscape': (1123, 794)},
            'Letter': {'portrait': (816, 1056), 'landscape': (1056, 816)}
        }
        
        size_key = page_size if page_size in page_sizes else 'A4'
        orient_key = orientation if orientation in ['portrait', 'landscape'] else 'portrait'
        _, page_height = page_sizes.get(size_key, page_sizes['A4'])[orient_key]
        
        # Get section heights, calculate dynamically if not provided
        section_heights = template_config.get('sectionHeights', {})
        
        # Calculate page header height from fields if not provided
        page_header_fields = template_config.get('pageHeader', [])
        if 'pageHeader' in section_heights:
            page_header_height = section_heights.get('pageHeader', 60)
        else:
            page_header_height = self._calculate_section_height_from_fields(page_header_fields, 60)
        
        # Calculate page footer height from fields if not provided
        page_footer_fields = template_config.get('pageFooter', [])
        if 'pageFooter' in section_heights:
            page_footer_height = section_heights.get('pageFooter', 60)
        else:
            page_footer_height = self._calculate_section_height_from_fields(page_footer_fields, 60)
        
        bill_header_height = section_heights.get('billHeader', 200)
        container_padding = 80  # Top and bottom padding (40px each)
        
        # Calculate available height for bill-content on first page
        # First page: page_header + bill_header + bill_content + page_footer
        available_height_first_page = page_height - page_header_height - bill_header_height - page_footer_height - container_padding
        
        # Calculate available height for bill-content on subsequent pages
        # Subsequent pages: page_header + bill_content + page_footer
        available_height_other_pages = page_height - page_header_height - page_footer_height - container_padding
        
        logger.debug(f"[DEBUG] _calculate_bill_content_pages: Height calculations:")
        logger.debug(f"[DEBUG] _calculate_bill_content_pages: - page_height: {page_height}")
        logger.debug(f"[DEBUG] _calculate_bill_content_pages: - page_header_height: {page_header_height}")
        logger.debug(f"[DEBUG] _calculate_bill_content_pages: - bill_header_height: {bill_header_height}")
        logger.debug(f"[DEBUG] _calculate_bill_content_pages: - page_footer_height: {page_footer_height}")
        logger.debug(f"[DEBUG] _calculate_bill_content_pages: - container_padding: {container_padding}")
        logger.debug(f"[DEBUG] _calculate_bill_content_pages: - available_height_first_page: {available_height_first_page}")
        logger.debug(f"[DEBUG] _calculate_bill_content_pages: - available_height_other_pages: {available_height_other_pages}")
        
        # Calculate actual bill-content height based on elements
        # Sum up all field heights and table heights (including bill-footer)
        actual_bill_content_height = 0
        
        # Initialize bill_footer_fields if None
        if bill_footer_fields is None:
            bill_footer_fields = template_config.get('billFooter', [])
        
        # Calculate fields height (bill-content + bill-footer)
        max_field_y = 0
        for field in bill_content_fields:
            if field.get('visible', True):
                field_y = field.get('y', 0)
                font_size = field.get('fontSize', 12)
                field_height = font_size * 1.5 if font_size else 20
                max_field_y = max(max_field_y, field_y + field_height)
        
        # Calculate bill-footer fields height (will be positioned at end of bill-content)
        max_bill_footer_field_y = 0
        if bill_footer_fields:
            # Bill-footer fields will be positioned after all bill-content elements
            # Calculate their height assuming they start at the end of bill-content
            for field in bill_footer_fields:
                if field.get('visible', True):
                    field_y = field.get('y', 0)  # This is position within footer
                    font_size = field.get('fontSize', 12)
                    field_height = font_size * 1.5 if font_size else 20
                    max_bill_footer_field_y = max(max_bill_footer_field_y, field_y + field_height)
        
        # Calculate tables height
        max_table_y = 0
        for table_config in bill_content_tables:
            table_y = table_config.get('y', 0)
            font_size = table_config.get('fontSize', 12)
            cell_padding = table_config.get('cellPadding', 10)
            border_width = table_config.get('borderWidth', 1)
            row_height = font_size + (cell_padding * 2) + (border_width * 2) + 2
            header_height = row_height
            num_items = len(items) if items else 0
            rows_height = row_height * num_items if num_items > 0 else row_height
            table_height = header_height + rows_height + 10
            max_table_y = max(max_table_y, table_y + table_height)
        
        # Calculate contentDetailsTables height
        max_content_detail_table_y = 0
        logger.debug(f"[DEBUG] _calculate_bill_content_pages: Calculating height, content_details_data type = {type(content_details_data)}, is None = {content_details_data is None}")
        for cd_table_config in content_details_tables:
            content_name = cd_table_config.get('contentName')
            logger.debug(f"[DEBUG] _calculate_bill_content_pages: Processing table: {content_name}, checking if in content_details_data")
            if content_name and content_name in content_details_data:
                cd_data = content_details_data[content_name]
                if isinstance(cd_data, list):
                    table_y = cd_table_config.get('y', 0)
                    font_size = cd_table_config.get('fontSize', 12)
                    cell_padding = cd_table_config.get('cellPadding', 10)
                    border_width = cd_table_config.get('borderWidth', 1)
                    row_height = font_size + (cell_padding * 2) + (border_width * 2) + 2
                    header_height = row_height
                    num_rows = len(cd_data) if cd_data else 0
                    rows_height = row_height * num_rows if num_rows > 0 else row_height
                    table_height = header_height + rows_height + 10
                    max_content_detail_table_y = max(max_content_detail_table_y, table_y + table_height)
        
        # Calculate accumulated height considering bill-footer at the end
        # Bill-footer will be positioned after all bill-content elements
        # First, find the maximum end position of bill-content elements (fields + tables)
        max_bill_content_end = max(max_field_y, max_table_y, max_content_detail_table_y)
        
        # Bill-footer height is relative to the end of bill-content
        # Add bill-footer height to the total (with 20px spacing)
        bill_footer_total_height = max_bill_content_end + 20 + max_bill_footer_field_y if bill_footer_fields else max_bill_content_end
        
        # Actual height is the maximum of bill-content height or the calculated total with footer
        actual_bill_content_height = max(bill_footer_total_height, bill_content_height)
        
        # Check if bill-content fits on one page
        if actual_bill_content_height <= available_height_first_page:
            return {'total_pages': 0, 'pages': {}}
        
        # Bill-content needs to be split across pages
        logger.debug(f"[DEBUG] _calculate_bill_content_pages: Starting pagination calculation")
        logger.debug(f"[DEBUG] _calculate_bill_content_pages: - available_height_first_page: {available_height_first_page}")
        logger.debug(f"[DEBUG] _calculate_bill_content_pages: - available_height_other_pages: {available_height_other_pages}")
        logger.debug(f"[DEBUG] _calculate_bill_content_pages: - actual_bill_content_height: {actual_bill_content_height}")
        
        pages_info = {}
        current_y = 0
        page_num = 1
        available_height = available_height_first_page
        
        # Process fields
        fields_to_place = []
        for field in bill_content_fields:
            if not field.get('visible', True):
                continue
            field_y = field.get('y', 0)
            # Estimate field height
            font_size = field.get('fontSize', 12)
            field_height = font_size * 1.5 if font_size else 20
            fields_to_place.append({
                'field': field,
                'y': field_y,
                'height': field_height
            })
        
        # Process tables - calculate actual height based on number of items
        tables_to_place = []
        for table_config in bill_content_tables:
            table_y = table_config.get('y', 0)
            # Calculate actual table height based on number of items
            font_size = table_config.get('fontSize', 12)
            cell_padding = table_config.get('cellPadding', 10)
            border_width = table_config.get('borderWidth', 1)
            row_height = font_size + (cell_padding * 2) + (border_width * 2) + 2
            
            # Calculate header height
            header_height = row_height
            
            # Calculate total rows (items count)
            num_items = len(items) if items else 0
            rows_height = row_height * num_items if num_items > 0 else row_height
            
            # Total table height
            estimated_table_height = header_height + rows_height + 10  # Add some padding
            
            tables_to_place.append({
                'table_config': table_config,
                'y': table_y,
                'height': estimated_table_height,
                'num_items': num_items,
                'row_height': row_height,
                'type': 'billContent'
            })
        
        # Process contentDetailsTables - calculate actual height based on content detail data
        logger.debug(f"[DEBUG] _calculate_bill_content_pages: Processing contentDetailsTables, content_details_data type = {type(content_details_data)}, is None = {content_details_data is None}")
        for cd_table_config in content_details_tables:
            content_name = cd_table_config.get('contentName')
            logger.debug(f"[DEBUG] _calculate_bill_content_pages: Processing table for pagination: {content_name}, checking if in content_details_data")
            if content_name and content_name in content_details_data:
                cd_data = content_details_data[content_name]
                if isinstance(cd_data, list):
                    table_y = cd_table_config.get('y', 0)
                    font_size = cd_table_config.get('fontSize', 12)
                    cell_padding = cd_table_config.get('cellPadding', 10)
                    border_width = cd_table_config.get('borderWidth', 1)
                    row_height = font_size + (cell_padding * 2) + (border_width * 2) + 2
                    
                    # Calculate header height
                    header_height = row_height
                    
                    # Calculate total rows (content detail data count)
                    num_rows = len(cd_data) if cd_data else 0
                    rows_height = row_height * num_rows if num_rows > 0 else row_height
                    
                    # Total table height
                    estimated_table_height = header_height + rows_height + 10  # Add some padding
                    
                    tables_to_place.append({
                        'table_config': cd_table_config,
                        'y': table_y,
                        'height': estimated_table_height,
                        'num_items': num_rows,
                        'row_height': row_height,
                        'type': 'contentDetail',
                        'content_name': content_name
                    })
        
        # Combine and sort all elements by Y position
        all_elements = []
        for f in fields_to_place:
            all_elements.append({'type': 'field', 'data': f, 'y': f['y'], 'height': f['height']})
        for t in tables_to_place:
            all_elements.append({'type': 'table', 'data': t, 'y': t['y'], 'height': t['height']})
        
        logger.debug(f"[DEBUG] _calculate_bill_content_pages: Total elements to place: {len(all_elements)}")
        for idx, elem in enumerate(all_elements):
            elem_type = elem['type']
            elem_data = elem['data']
            if elem_type == 'table':
                table_type = elem_data.get('type', 'unknown')
                content_name = elem_data.get('content_name', 'N/A')
                logger.debug(f"[DEBUG] _calculate_bill_content_pages: Element {idx}: type={elem_type}, table_type={table_type}, content_name={content_name}, y={elem['y']}, height={elem['height']}")
            else:
                logger.debug(f"[DEBUG] _calculate_bill_content_pages: Element {idx}: type={elem_type}, y={elem['y']}, height={elem['height']}")
        
        all_elements.sort(key=lambda x: x['y'])
        logger.debug(f"[DEBUG] _calculate_bill_content_pages: Elements sorted by Y position")
        
        # Distribute elements across pages
        # Track the bottom Y position of the last element on current page
        current_page_bottom = 0
        current_page_elements = {'fields': [], 'tables': []}
        # Track table end positions per page for positioning subsequent fields
        table_end_positions = {}  # {page_num: bottom_y}
        # Track actual end positions of all previous elements (absolute Y positions)
        previous_elements_end = {}  # {element_index: end_y_position}
        
        logger.debug(f"[DEBUG] _calculate_bill_content_pages: Starting element placement loop")
        for element_index, element in enumerate(all_elements):
            element_y = element['y']
            element_height = element['height']
            element_bottom = element_y + element_height
            elem_type = element['type']
            if elem_type == 'table':
                table_type = element['data'].get('type', 'unknown')
                content_name = element['data'].get('content_name', 'N/A') if table_type == 'contentDetail' else 'N/A'
                logger.debug(f"[DEBUG] _calculate_bill_content_pages: Processing element {element_index}: type={elem_type}, table_type={table_type}, content_name={content_name}, y={element_y}, height={element_height}, current_page={page_num}")
            else:
                logger.debug(f"[DEBUG] _calculate_bill_content_pages: Processing element {element_index}: type={elem_type}, y={element_y}, height={element_height}, current_page={page_num}")
            
            # Check if element fits on current page
            if element['type'] == 'field':
                # Find the maximum end position of all previous elements
                max_previous_end = 0
                has_table_before = False
                last_table_page = 0
                last_table_end = 0
                
                for i in range(element_index):
                    if i in previous_elements_end:
                        max_previous_end = max(max_previous_end, previous_elements_end[i])
                    # Also check if previous element was a table
                    if all_elements[i]['type'] == 'table':
                        has_table_before = True
                        # Find which page this table ended on
                        for pnum, end_pos in table_end_positions.items():
                            if pnum >= last_table_page:
                                last_table_page = pnum
                                last_table_end = end_pos
                
                # Calculate adjusted position based on Y position and previous elements
                # For bill-content: use Y positions as gaps from previous element's end
                
                # Find the previous element's end position
                prev_end = max_previous_end
                
                # If there's a table before and we're on the same page, use table end
                if has_table_before:
                    last_table_page = max(table_end_positions.keys()) if table_end_positions else 0
                    last_table_end = table_end_positions.get(last_table_page, 0) if table_end_positions else 0
                    
                    # Ensure we're on or past the page where table ended
                    if page_num < last_table_page:
                        # We're before the table's last page, move to where table ended
                        if current_page_elements['fields'] or current_page_elements['tables']:
                            pages_info[page_num] = {
                                'offset_y': 0,
                                'fields': current_page_elements['fields'],
                                'tables': current_page_elements['tables']
                            }
                        page_num = last_table_page
                        available_height = available_height_first_page if last_table_page == 1 else available_height_other_pages
                        current_page_elements = {'fields': [], 'tables': []}
                        current_page_bottom = 0
                    
                    # If we're on the page where table ended, use table end as base
                    if page_num == last_table_page and last_table_page in table_end_positions:
                        table_end = table_end_positions[last_table_page]
                        prev_end = max(prev_end, table_end)
                    elif page_num > last_table_page:
                        # We're past the table's page, field should be on new page
                        # Y position is gap from top, so reset prev_end
                        prev_end = 0
                
                # Calculate position: previous end + gap (field's Y position)
                # The field's Y position represents the gap from previous element
                if prev_end > 0 and page_num == last_table_page:
                    # There's a previous element on same page, use its end + field's Y as gap
                    adjusted_y = prev_end 
                elif page_num > last_table_page:
                    # Previous element ended on earlier page, use Y as gap from top of new page
                    adjusted_y = 0
                elif prev_end > 0:
                    # There's a previous element, use its end + field's Y as gap
                    adjusted_y = prev_end 
                else:
                    # No previous element, use field's Y as absolute position or gap from top
                    adjusted_y = 0
                
                # Ensure it's not before current page bottom (only check if on same page as previous element)
                if adjusted_y < current_page_bottom and (not has_table_before or page_num == last_table_page):
                    adjusted_y = current_page_bottom  # Use Y as gap from current bottom
                
                new_page_bottom = element_height
                
                if new_page_bottom <= available_height:
                    # Field fits, add to current page
                    current_page_elements['fields'].append({
                        'field': element['data']['field'],
                        'adjusted_y': adjusted_y
                    })
                    current_page_bottom = new_page_bottom
                    # Track this element's end position
                    previous_elements_end[element_index] = adjusted_y + element_height
                else:
                    # Field doesn't fit, start new page
                    if current_page_elements['fields'] or current_page_elements['tables']:
                        pages_info[page_num] = {
                            'offset_y': 0,
                            'fields': current_page_elements['fields'],
                            'tables': current_page_elements['tables']
                        }
                    
                    page_num += 1
                    available_height = available_height_other_pages
                    current_page_elements = {'fields': [], 'tables': []}
                    current_page_bottom = 0
                    
                    # On new page, use field's Y position as gap from top
                    # The Y position is the gap, so position at Y from top of page
                    adjusted_y = 0  # Y is gap, so use it directly from top
                    
                    current_page_elements['fields'].append({
                        'field': element['data']['field'],
                        'adjusted_y': adjusted_y
                    })
                    current_page_bottom = adjusted_y + element_height
                    # Track this element's end position
                    previous_elements_end[element_index] = adjusted_y + element_height
            else:
                # Handle table - split rows across pages if needed
                table_config = element['data']['table_config']
                table_y = element['y']  # This is the gap from previous element
                table_data = element['data']
                table_type = table_data.get('type', 'billContent')
                num_items = table_data.get('num_items', len(items))
                row_height = table_data.get('row_height', 20)
                header_height = row_height
                
                # Calculate table's actual start position based on previous elements
                max_prev_end = 0
                prev_elements_info = []
                for i in range(element_index):
                    if i in previous_elements_end:
                        prev_end = previous_elements_end[i]
                        prev_elements_info.append(f"elem[{i}]={prev_end}")
                        max_prev_end = max(max_prev_end, prev_end)
                
                logger.debug(f"[DEBUG] _calculate_bill_content_pages: Table element {element_index}:")
                logger.debug(f"[DEBUG] _calculate_bill_content_pages: - Previous elements end positions: {prev_elements_info}")
                logger.debug(f"[DEBUG] _calculate_bill_content_pages: - max_prev_end: {max_prev_end}")
                logger.debug(f"[DEBUG] _calculate_bill_content_pages: - table_y (gap): {table_y}")
                
                # Table's Y position is the gap from previous element
                if max_prev_end > 0:
                    table_start_y = max_prev_end 
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - Using max_prev_end as table_start_y: {table_start_y}")
                else:
                    table_start_y = table_y  # First element, use Y as absolute
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - No previous elements, using table_y as table_start_y: {table_start_y}")
                
                # Save current page if it has other elements
                if current_page_elements['fields'] or current_page_elements['tables']:
                    pages_info[page_num] = {
                        'offset_y': 0,
                        'fields': current_page_elements['fields'],
                        'tables': current_page_elements['tables']
                    }
                
                # For contentDetail tables, treat as single unit (no splitting)
                if table_type == 'contentDetail':
                    content_name = table_data.get('content_name', 'unknown')
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: Processing contentDetail table '{content_name}'")
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - element_index: {element_index}")
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - current page_num: {page_num}")
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - max_prev_end: {max_prev_end}")
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - table_y (gap): {table_y}")
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - table_start_y (calculated): {table_start_y}")
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - table_height: {element['height']}")
                    
                    # Check if table fits on current page
                    # Account for page-footer: table must fit within available space
                    page_available = available_height_first_page if page_num == 1 else available_height_other_pages
                    table_height = element['height']
                    
                    # Calculate total space needed: starting position + table height
                    total_space_needed = table_start_y + table_height
                    
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - page_available (accounting for page-footer): {page_available}")
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - table_start_y: {table_start_y}")
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - table_height: {table_height}")
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - total_space_needed: {total_space_needed}")
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - Will fit? {total_space_needed <= page_available}")
                    
                    if total_space_needed > page_available:
                        # Table doesn't fit, move to next page
                        logger.debug(f"[DEBUG] _calculate_bill_content_pages: - Table doesn't fit, moving to next page")
                        logger.debug(f"[DEBUG] _calculate_bill_content_pages: - Old page_num: {page_num}")
                        page_num += 1
                        available_height = available_height_other_pages
                        table_start_y = 0  # On new page, use Y as gap from top
                        page_available = available_height_other_pages
                        logger.debug(f"[DEBUG] _calculate_bill_content_pages: - New page_num: {page_num}")
                        logger.debug(f"[DEBUG] _calculate_bill_content_pages: - New table_start_y: {table_start_y}")
                    else:
                        logger.debug(f"[DEBUG] _calculate_bill_content_pages: - Table fits on current page {page_num}")
                    
                    # Ensure page entry exists
                    if page_num not in pages_info:
                        pages_info[page_num] = {
                            'offset_y': 0,
                            'fields': [],
                            'tables': []
                        }
                    
                    # For contentDetail tables, use their absolute Y position from template (not gap-based)
                    # The Y position in template is absolute relative to bill-content start
                    original_y = table_config.get('y', 0)
                    
                    # Add entire table to page (no splitting)
                    # Use original_y as adjusted_y for contentDetail tables (absolute positioning)
                    pages_info[page_num]['tables'].append({
                        'table_config': table_config,
                        'adjusted_y': original_y,  # Use absolute Y position from template
                        'type': 'contentDetail',
                        'content_name': table_data.get('content_name')
                    })
                    
                    # Track table's end position using original Y position
                    # For contentDetail, end position is original_y + table_height
                    table_end_position = original_y + table_height
                    current_page_bottom = table_end_position
                    previous_elements_end[element_index] = table_end_position
                    current_page_elements = {'fields': [], 'tables': []}
                    continue
                
                # For billContent tables, split rows across pages
                # Ensure we're on the correct page for table start
                page_available = available_height_first_page if page_num == 1 else available_height_other_pages
                if table_start_y > page_available and page_num == 1:
                    # Table doesn't fit on first page, move to next
                    page_num += 1
                    available_height = available_height_other_pages
                    table_start_y = 0 # On new page, use Y as absolute
                    page_available = available_height_other_pages
                
                # Split table rows across pages
                start_index = 0
                current_table_page = page_num
                
                # Calculate space needed by subsequent elements on the same page
                # Look ahead to find elements that come after this billContent table
                # The 'y' value of subsequent elements represents the gap from the billContent table end
                subsequent_elements_height = 0
                if element_index + 1 < len(all_elements):
                    # Check subsequent elements to see if they'll be on the same page
                    # Elements with small 'y' gaps (< 200px) are likely meant to be on the same page
                    for next_elem_idx in range(element_index + 1, len(all_elements)):
                        next_elem = all_elements[next_elem_idx]
                        next_elem_y = next_elem['y']  # Gap from billContent table end
                        next_elem_height = next_elem['height']
                        next_elem_type = next_elem['type']
                        
                        # If the gap is small, this element is likely meant to be on the same page
                        # Account for both the gap and the element height
                        if next_elem_y < 200:  # Small gap suggests same page
                            subsequent_elements_height += next_elem_y + next_elem_height
                            logger.debug(f"[DEBUG] _calculate_bill_content_pages: Element {next_elem_idx} (type={next_elem_type}, gap={next_elem_y}, height={next_elem_height}) will be on same page, adding {next_elem_y + next_elem_height}px")
                        else:
                            # Large gap suggests different page, stop checking
                            break
                
                logger.debug(f"[DEBUG] _calculate_bill_content_pages: Total subsequent_elements_height to reserve: {subsequent_elements_height}")
                
                while start_index < num_items:
                    # Calculate available space for this page
                    if current_table_page == 1:
                        # First page: account for bill-header and table start position
                        if start_index == 0:
                            # First chunk starts at table_start_y
                            # available_height_first_page already accounts for page-footer
                            # We need space from table_start_y to the end, so subtract table_start_y
                            page_available = available_height_first_page - table_start_y
                            actual_table_start_y = table_start_y
                        else:
                            # Continuation on first page (shouldn't normally happen)
                            page_available = available_height_first_page
                            actual_table_start_y = 0
                    else:
                        # Subsequent pages: full available height (already accounts for page-footer)
                        page_available = available_height_other_pages
                        actual_table_start_y = 0
                    
                    # Calculate rows that fit
                    # page_available already accounts for page-footer height in available_height_first_page/available_height_other_pages
                    # We also need to account for subsequent elements that will be on the same page
                    # For first chunk on first page: page_available = available_height_first_page - table_start_y
                    #   So available_for_rows = page_available - header_height - subsequent_elements_height (table_start_y already subtracted)
                    # For other cases: page_available is the full available height
                    #   So available_for_rows = page_available - header_height - actual_table_start_y - subsequent_elements_height
                    if start_index == 0 and current_table_page == 1:
                        # First chunk on first page: table_start_y already subtracted from page_available
                        available_for_rows = page_available - header_height - subsequent_elements_height
                    else:
                        # Subsequent chunks or pages: subtract header, starting position, and subsequent elements
                        available_for_rows = page_available - header_height - actual_table_start_y - subsequent_elements_height
                    
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - subsequent_elements_height: {subsequent_elements_height}")
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: billContent table chunk calculation:")
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - current_table_page: {current_table_page}")
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - start_index: {start_index}, num_items: {num_items}")
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - page_available (with page-footer): {page_available}")
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - actual_table_start_y: {actual_table_start_y}")
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - header_height: {header_height}")
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - row_height: {row_height}")
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - available_for_rows: {available_for_rows}")
                    
                    # Calculate how many rows can fit
                    # Calculate base number of rows that fit using floor division
                    base_rows = max(1, math.floor(available_for_rows / row_height)) if available_for_rows > 0 else 1
                    
                    # Check if we can fit one more row (to avoid being too conservative)
                    total_height_for_base = base_rows * row_height
                    if total_height_for_base + row_height <= available_for_rows:
                        rows_this_page = base_rows + 1
                    else:
                        rows_this_page = base_rows
                    
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - base_rows: {base_rows}, calculated rows_this_page: {rows_this_page}")
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - remaining items: {num_items - start_index}")
                    
                    # Ensure we don't exceed remaining items
                    # end_index is exclusive in Python slicing, so items[start_index:end_index] gives items start_index to end_index-1
                    end_index = min(start_index + rows_this_page, num_items)
                    actual_rows_this_page = end_index - start_index
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - end_index: {end_index} (exclusive, so will render indices {start_index} to {end_index-1})")
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - actual_rows_this_page: {actual_rows_this_page}")
                    
                    # Verify we're not losing rows - check if we can fit more
                    if actual_rows_this_page < rows_this_page and start_index + rows_this_page < num_items:
                        logger.warning(f"[WARNING] _calculate_bill_content_pages: Calculated {rows_this_page} rows but only rendering {actual_rows_this_page} rows. start_index={start_index}, end_index={end_index}, num_items={num_items}")
                    
                    # Calculate table end position on this page
                    # Use actual_rows_this_page to reflect the actual number of rows rendered
                    table_end_y = actual_table_start_y + header_height + (actual_rows_this_page * row_height)
                    
                    # Ensure page entry exists
                    if current_table_page not in pages_info:
                        pages_info[current_table_page] = {
                            'offset_y': 0,
                            'fields': [],
                            'tables': []
                        }
                    
                    # Add table chunk
                    pages_info[current_table_page]['tables'].append({
                        'table_config': table_config,
                        'items': items,
                        'adjusted_y': actual_table_start_y,
                        'start_index': start_index,
                        'end_index': end_index,
                        'type': 'billContent'
                    })
                    
                    # Track table end position for this page
                    table_end_positions[current_table_page] = table_end_y
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: billContent table chunk on page {current_table_page}:")
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - start_index: {start_index}, end_index: {end_index}")
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - actual_table_start_y: {actual_table_start_y}")
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - table_end_y: {table_end_y}")
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - rows_this_page: {rows_this_page}")
                    
                    start_index = end_index
                    
                    # Move to next page if more rows remain
                    if start_index < num_items:
                        logger.debug(f"[DEBUG] _calculate_bill_content_pages: - More rows remaining ({start_index}/{num_items}), moving to next page")
                        current_table_page += 1
                        if current_table_page > page_num:
                            page_num = current_table_page
                            available_height = available_height_other_pages
                    else:
                        logger.debug(f"[DEBUG] _calculate_bill_content_pages: - All rows processed, billContent table ends on page {current_table_page} at position {table_end_y}")
                
                # Update tracking - set current page to where table ended
                if current_table_page in table_end_positions:
                    current_page_bottom = table_end_positions[current_table_page]
                    # Update page_num to where table ended so subsequent fields know the correct page
                    page_num = max(page_num, current_table_page)
                    # Update available_height for the page where table ended
                    if current_table_page == 1:
                        available_height = available_height_first_page
                    else:
                        available_height = available_height_other_pages
                    # Track table's end position for this element
                    previous_elements_end[element_index] = table_end_positions[current_table_page]
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: billContent table element {element_index} ended:")
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - Final page: {current_table_page}")
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - End position: {table_end_positions[current_table_page]}")
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - Updated page_num: {page_num}")
                else:
                    current_page_bottom = 0
                    # Track table's end position (at its Y + height)
                    table_y = element['y']
                    previous_elements_end[element_index] = table_y + element['height']
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: billContent table element {element_index} (no end position tracked):")
                    logger.debug(f"[DEBUG] _calculate_bill_content_pages: - End position: {previous_elements_end[element_index]}")
                current_page_elements = {'fields': [], 'tables': []}
        
        # Add last page if it has elements
        if current_page_elements['fields'] or current_page_elements['tables']:
            pages_info[page_num] = {
                'offset_y': 0,
                'fields': current_page_elements['fields'],
                'tables': current_page_elements['tables']
            }
        
        return {
            'total_pages': page_num,
            'pages': pages_info
        }
    
    def _calculate_section_height_from_fields(self, fields: List[Dict[str, Any]], default_height: int = 60) -> int:
        """
        Calculate section height based on field positions and sizes.
        
        Args:
            fields: List of field configurations
            default_height: Default height if no fields or calculation fails
            
        Returns:
            Calculated height in pixels
        """
        if not fields or len(fields) == 0:
            return default_height
        
        MIN_HEIGHT = 40
        PADDING = 20
        
        max_bottom = 0
        for field in fields:
            if field.get('visible', True):
                field_y = field.get('y', 0)
                font_size = field.get('fontSize', 12)
                field_height = font_size * 1.5 if font_size else 20
                bottom = field_y + field_height
                max_bottom = max(max_bottom, bottom)
        
        calculated_height = max(MIN_HEIGHT, max_bottom + PADDING)
        return calculated_height if calculated_height > default_height else default_height
    
    def _calculate_rows_per_page_for_table(self, table_config: Dict[str, Any], template_config: Dict[str, Any], items_count: int) -> int:
        """
        Calculate maximum rows per page for a specific table configuration.
        
        Args:
            table_config: Table configuration dictionary
            template_config: Template configuration dictionary
            items_count: Total number of items
            
        Returns:
            Maximum rows per page
        """
        # If explicitly set in table config, use it
        if table_config.get('rowsPerPage'):
            return max(1, table_config['rowsPerPage'])
        
        # Otherwise use the same calculation as items table
        return self._calculate_rows_per_page(template_config, items_count)
    
    def _calculate_rows_per_page(self, template_config: Dict[str, Any], items_count: int) -> int:
        """
        Calculate maximum rows per page based on available space.
        
        Args:
            template_config: Template configuration dictionary
            items_count: Total number of items
            
        Returns:
            Maximum rows per page
        """
        pagination_config = template_config.get('pagination', {})
        
        # If explicitly set, use it
        if pagination_config.get('rowsPerPage'):
            return max(1, pagination_config['rowsPerPage'])
        
        # Calculate based on page size and table position
        page_config = template_config.get('page', {})
        page_size = page_config.get('size', 'A4')
        orientation = page_config.get('orientation', 'portrait')
        
        # Page dimensions (in pixels at 96 DPI)
        page_sizes = {
            'A4': {'portrait': (794, 1123), 'landscape': (1123, 794)},
            'Letter': {'portrait': (816, 1056), 'landscape': (1056, 816)}
        }
        
        size_key = page_size if page_size in page_sizes else 'A4'
        orient_key = orientation if orientation in ['portrait', 'landscape'] else 'portrait'
        _, page_height = page_sizes.get(size_key, page_sizes['A4'])[orient_key]
        
        # Get section heights from template config, calculate dynamically if not provided
        section_heights = template_config.get('sectionHeights', {})
        
        # Calculate page header height from fields if not provided
        page_header_fields = template_config.get('pageHeader', [])
        if 'pageHeader' in section_heights:
            page_header_height = section_heights.get('pageHeader', 60)
        else:
            page_header_height = self._calculate_section_height_from_fields(page_header_fields, 60)
        
        # Calculate page footer height from fields if not provided
        page_footer_fields = template_config.get('pageFooter', [])
        if 'pageFooter' in section_heights:
            page_footer_height = section_heights.get('pageFooter', 60)
        else:
            page_footer_height = self._calculate_section_height_from_fields(page_footer_fields, 60)
        
        bill_header_height = section_heights.get('billHeader', 200)
        bill_content_height = section_heights.get('billContent', 100)
        bill_footer_height = section_heights.get('billFooter', 100)
        
        # Margins (top and bottom padding of bill-container)
        container_padding = 80  # Top and bottom padding (40px each)
        
        items_table = template_config.get('itemsTable', {})
        table_y = items_table.get('y', 0)
        
        # Calculate available height for table
        # Structure: page_header (fixed) -> bill_header (first page only) -> bill_content -> table area -> bill_footer (last page only) -> page_footer (fixed)
        # table_y is position from top of bill-container (which is after page_header)
        # For pagination calculation, we need space available from table_y to bottom of page
        # Available = page_height - page_header - bill_header - bill_content - table_y - bill_footer - page_footer - container_padding
        # Note: bill_header and bill_content are included in table_y calculation on first page, but for subsequent pages
        # we have more space, so we calculate conservatively using first page layout
        # If table is in bill-content, table_y is relative to bill-content, so we need to account for that
        # Calculate available height for items table
        # Structure: page_header -> bill_header -> bill_content -> items_table area -> bill_footer -> page_footer
        # table_y is absolute position from top of bill-container
        # Available = page_height - page_header - bill_header - bill_content - (table_y offset from bill_content end) - bill_footer - page_footer - container_padding
        # The table_y position needs to account for bill_header + bill_content positioning
        # For simplicity: page_height - all fixed sections - table_y - margins
        available_height = page_height - page_header_height - bill_header_height - bill_content_height - table_y - bill_footer_height - page_footer_height - container_padding-150
        
        # Estimate row height (cell padding + font size + border)
        cell_padding = items_table.get('cellPadding', 10)
        font_size = items_table.get('fontSize', 12)
        border_width = items_table.get('borderWidth', 1)
        estimated_row_height = (cell_padding * 2) + font_size + (border_width * 2) + 4
        
        # Calculate rows (subtract one for header row)
        rows_per_page = max(1, int((available_height - estimated_row_height) / estimated_row_height - 10))
        
        return rows_per_page
    
    def _render_field(self, field: Dict[str, Any], data: Dict[str, Any], page_context: Dict[str, Any] = None, container_class: str = 'field') -> str:
        """
        Render a single field.
        
        Args:
            field: Field configuration
            data: Data dictionary
            page_context: Page context for special fields
            container_class: CSS class for container
            
        Returns:
            HTML string for the field
        """
        if not field.get('visible', True):
            return ''
        
        field_type = field.get('fieldType')
        bind_path = field.get('bind', '')
        value = self._get_field_value(bind_path, data, field_type, page_context)
        style = self._get_field_style(field)
        
        return (
            f'<div class="{container_class}" style="position: absolute; {style}">'
            f'<span class="label">{field.get("label", "")}:</span> '
            f'<span class="value">{value}</span>'
            f'</div>'
        )
    
    def _get_field_style(self, field: Dict[str, Any]) -> str:
        """
        Generate CSS style for a field.
        
        Args:
            field: Field configuration
            
        Returns:
            CSS style string
        """
        styles = []
        
        if 'x' in field:
            styles.append(f'left: {field["x"]}px')
        if 'y' in field:
            styles.append(f'top: {field["y"]}px')
        if 'fontSize' in field:
            styles.append(f'font-size: {field["fontSize"]}px')
        if 'fontWeight' in field:
            styles.append(f'font-weight: {field["fontWeight"]}')
        if 'color' in field:
            styles.append(f'color: {field["color"]}')
        
        return '; '.join(styles)
    
    def _generate_css(self, page_size: str, orientation: str, template_config: Dict[str, Any] = None) -> str:
        """
        Generate CSS for the bill preview.
        
        Args:
            page_size: Page size (A4, Letter, etc.)
            orientation: Page orientation (portrait, landscape)
            template_config: Template configuration dictionary (optional)
            
        Returns:
            CSS string
        """
        # Page dimensions (in pixels at 96 DPI)
        page_sizes = {
            'A4': {'portrait': (794, 1123), 'landscape': (1123, 794)},
            'Letter': {'portrait': (816, 1056), 'landscape': (1056, 816)}
        }
        
        size_key = page_size if page_size in page_sizes else 'A4'
        orient_key = orientation if orientation in ['portrait', 'landscape'] else 'portrait'
        
        width, height = page_sizes.get(size_key, page_sizes['A4'])[orient_key]
        
        # Calculate dynamic heights for page header and footer
        page_header_height = 60
        page_footer_height = 60
        
        if template_config:
            section_heights = template_config.get('sectionHeights', {})
            
            # Calculate page header height
            if 'pageHeader' in section_heights:
                page_header_height = section_heights.get('pageHeader', 60)
            else:
                page_header_fields = template_config.get('pageHeader', [])
                page_header_height = self._calculate_section_height_from_fields(page_header_fields, 60)
            
            # Calculate page footer height
            if 'pageFooter' in section_heights:
                page_footer_height = section_heights.get('pageFooter', 60)
            else:
                page_footer_fields = template_config.get('pageFooter', [])
                page_footer_height = self._calculate_section_height_from_fields(page_footer_fields, 60)
        
        return f"""
            * {{
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }}
            
            body {{
                font-family: Arial, sans-serif;
                background: #f5f5f5;
                padding: 20px;
                margin: 0;
            }}
            
            .bill-page {{
                margin-bottom: 20px;
            }}
            
            .bill-container {{
                background: white;
                width: {width}px;
                min-height: {height}px;
                margin: 0 auto;
                padding: 40px;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
                position: relative;
                overflow: visible;
            }}
            
            .page-header {{
                position: relative;
                top: 0;
                left: 0;
                right: 0;
                min-height: {page_header_height}px;
                height: {page_header_height}px;
                padding: 10px 40px;
                width: {width}px;
            }}
            
            .page-header .page-field {{
                position: absolute;
                white-space: nowrap;
            }}
            
            .bill-header {{
                width: 100%;
                min-height: 200px;
                height: auto;
                margin: 0;
                padding: 0;
                overflow: visible;
                position: relative;
            }}
            
            .bill-header .field {{
                position: absolute !important;
                white-space: nowrap;
                margin: 0 !important;
                padding: 0;
                display: block;
            }}
            
            .bill-content {{
                width: 100%;
                min-height: 100px;
                height: auto;
                margin: 0;
                padding: 0;
                overflow: visible;
                position: relative;
            }}
            
            .bill-content .field {{
                
                white-space: nowrap;
                margin: 0 !important;
                padding: 0;
                display: block;
            }}
            
            .bill-content-table {{
                position: relative !important;
                z-index: 1;
                margin: 0 !important;
                padding: 0;
            }}
            
            .bill-content-table table {{
                width: auto;
                min-width: 400px;
                border-collapse: collapse;
                background: white;
                margin: 0;
            }}
            
            .bill-content-table th,
            .bill-content-table td {{
                padding: 10px;
                border: 1px solid #ddd;
                text-align: left;
                word-wrap: break-word;
                overflow-wrap: break-word;
                word-break: break-word;
                white-space: normal;
            }}
            
            .bill-content-table th {{
                background-color: #f0f0f0;
                font-weight: bold;
            }}
            
            .bill-content-table tr:nth-child(even) {{
                background-color: #f9f9f9;
            }}
            
            .bill-header .label,
            .page-header .label,
            .bill-footer .label,
            .page-footer .label {{
                font-weight: bold;
                margin-right: 10px;
            }}
            
            .bill-footer {{
                position: relative;
                left: 0;
                right: 0;
                width: {width}px;
                padding: 10px 40px;
                min-height: 80px;
            }}
            
            .bill-footer .field {{
                position: absolute;
                white-space: nowrap;
            }}
            
            .page-footer {{
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: {page_footer_height}px;
                min-height: {page_footer_height}px;
                padding: 10px 40px;
                width: {width}px;
                z-index: 10;
                background: white;
            }}
             .page-footer-relative {{
                position: relative;
                bottom: 0;
                left: 0;
                right: 0;
                height: {page_footer_height}px;
                min-height: {page_footer_height}px;
                width: {width}px;
            }}
            
            .page-footer .page-field {{
                position: absolute;
                white-space: nowrap;
            }}
            
            .bill-items,
            .bill-content-detail {{
                position: absolute !important;
                z-index: 1;
                margin: 0 !important;
                padding: 0;
            }}
            
            .bill-items table,
            .bill-content-detail table {{
                width: auto;
                min-width: 400px;
                border-collapse: collapse;
                background: white;
                margin: 0;
            }}
            
            .bill-items th,
            .bill-items td,
            .bill-content-detail th,
            .bill-content-detail td {{
                padding: 10px;
                border: 1px solid #ddd;
                text-align: left;
                word-wrap: break-word;
                overflow-wrap: break-word;
                word-break: break-word;
                white-space: normal;
            }}
            
            .bill-items th,
            .bill-content-detail th {{
                background-color: #f0f0f0;
                font-weight: bold;
            }}
            
            .bill-items tr:nth-child(even),
            .bill-content-detail tr:nth-child(even) {{
                background-color: #f9f9f9;
            }}
            
            .bill-items tbody tr:hover,
            .bill-content-detail tbody tr:hover {{
                background-color: #f0f0f0;
            }}
            
            .page-break {{
                page-break-after: always;
                break-after: page;
            }}
            
            @page {{
                size: {page_size} {orientation};
                margin: 0;
            }}
            
            @media print {{
                * {{
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    color-adjust: exact !important;
                }}
                
                body {{
                    background: white !important;
                    padding: 0 !important;
                    margin: 0 !important;
                }}
                
                .bill-page {{
                    margin-bottom: 0;
                    page-break-after: always;
                    break-after: page;
                }}
                
                .bill-page:last-child {{
                    page-break-after: auto;
                    break-after: auto;
                }}
                
                .bill-container {{
                    box-shadow: none !important;
                    margin: 0 auto !important;
                    padding: 0 !important;
                    width: {width}px !important;
                    min-height: {height}px !important;
                    background: white !important;
                    page-break-inside: avoid;
                    break-inside: avoid;
                }}
                
                .page-header,
                .page-footer {{
                    position: fixed;
                }}
                
                .bill-header {{
                    page-break-inside: avoid;
                    break-inside: avoid;
                    position: relative !important;
                }}
                
                .bill-header .field {{
                    position: absolute !important;
                    margin: 0 !important;
                }}
                
                .bill-content {{
                    page-break-inside: avoid;
                    break-inside: avoid;
                    position: relative !important;
                }}
                
                .bill-content .field {{
                    position: absolute !important;
                    margin: 0 !important;
                }}
                
                .bill-content-table {{
                    position: relative !important;
                    page-break-inside: auto;
                    break-inside: auto;
                    margin: 0 !important;
                }}
                
                .bill-content-table table {{
                    page-break-inside: auto;
                    break-inside: auto;
                    background: white !important;
                }}
                
                .bill-content-table tr {{
                    page-break-inside: avoid;
                    break-inside: avoid;
                    page-break-after: auto;
                    break-after: auto;
                }}
                
                .bill-footer {{
                    position: relative;
                    page-break-inside: avoid;
                    break-inside: avoid;
                }}
                
                .bill-items,
                .bill-content-detail {{
                    position: absolute !important;
                    page-break-inside: auto;
                    break-inside: auto;
                    margin: 0 !important;
                }}
                
                .bill-items table,
                .bill-content-detail table {{
                    page-break-inside: auto;
                    break-inside: auto;
                    background: white !important;
                }}
                
                .bill-items tr,
                .bill-content-detail tr {{
                    page-break-inside: avoid;
                    break-inside: avoid;
                    page-break-after: auto;
                    break-after: auto;
                }}
                
                .page-break {{
                    page-break-after: always;
                    break-after: page;
                }}
            }}
        """


# Global template engine instance
template_engine = TemplateEngine()

