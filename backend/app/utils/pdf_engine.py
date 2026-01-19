"""
JSON PDF Engine - ReportLab Rendering Engine
Strictly implements the rules defined in backend/docs/PDF_ENGINE_RULES.md

This engine enforces:
- Fixed sections (Page Header/Footer, Bill Header/Footer) with position-based rendering
- Dynamic sections (Bill Content) with flow-based rendering
- Automatic pagination with proper space reservation
- No absolute Y positions for dynamic content
"""

from reportlab.pdfgen import canvas
from io import BytesIO
from typing import Dict, Any, List, Tuple, Optional
import json
import logging

from .pdf_utils import get_page_size
from .pdf_field_renderer import render_field, get_field_value
from .pdf_table_renderer import (
    render_table,
    calculate_table_height,
    calculate_bill_footer_height,
    create_cell_paragraph,
    calculate_cell_height
)
from .pdf_fixed_content_engine import FixedContentRenderEngine
from .pdf_dynamic_content_engine import DynamicContentRenderEngine
from .pdf_page_balance_engine import PageBalanceFitEngine

logger = logging.getLogger(__name__)


def _calculate_final_row_value(
    cell_config: Dict[str, Any], 
    all_items: List[Dict[str, Any]], 
    data: Dict[str, Any]
) -> str:
    """
    Calculate value for final row cell based on calculation configuration.
    
    Args:
        cell_config: FinalRowCellConfig
        all_items: All items in the table (for calculations)
        data: Full data dictionary (for formulas)
        
    Returns:
        Calculated value as string
    """
    value_type = cell_config.get('valueType', 'static')
    
    if value_type == 'static':
        return cell_config.get('value', '')
    
    elif value_type == 'calculation':
        calculation_type = cell_config.get('calculationType', 'sum')
        calculation_source = cell_config.get('calculationSource', 'items')
        calculation_field = cell_config.get('calculationField', '')
        
        if not calculation_field or not all_items:
            return ''
        
        # Get source data based on calculation_source
        source_data = []
        if calculation_source == 'items':
            source_data = all_items
        elif calculation_source.startswith('contentDetails.'):
            content_name = calculation_source.replace('contentDetails.', '')
            content_details = data.get('contentDetails', {})
            if content_name in content_details:
                cd_data = content_details[content_name]
                if isinstance(cd_data, list):
                    source_data = cd_data
        
        if not source_data:
            return ''
        
        # Extract values from source data
        values = []
        for item in source_data:
            if '.' not in calculation_field:
                value = item.get(calculation_field) if isinstance(item, dict) else None
            else:
                value = get_field_value(calculation_field, item)
            
            if value is not None:
                try:
                    numeric_value = float(value)
                    values.append(numeric_value)
                except (ValueError, TypeError):
                    pass
        
        if not values:
            return ''
        
        # Perform calculation
        if calculation_type == 'sum':
            result = sum(values)
        elif calculation_type == 'avg':
            result = sum(values) / len(values) if values else 0
        elif calculation_type == 'count':
            result = len(values)
        elif calculation_type == 'min':
            result = min(values)
        elif calculation_type == 'max':
            result = max(values)
        else:
            return ''
        
        # Format result (handle decimals)
        if calculation_type in ['sum', 'avg', 'min', 'max']:
            if result.is_integer():
                return str(int(result))
            else:
                return f"{result:.2f}"
        else:
            return str(int(result))
    
    elif value_type == 'formula':
        formula = cell_config.get('formula', '')
        if not formula:
            return ''
        
        # Simple formula evaluation (e.g., "sum(items.rate) * header.exchangeRate")
        # This is a basic implementation - can be extended with more complex parsing
        try:
            # Replace common patterns
            formula_lower = formula.lower()
            
            # Extract sum() operations
            import re
            sum_pattern = r'sum\(([^)]+)\)'
            for match in re.finditer(sum_pattern, formula_lower):
                sum_expr = match.group(1)
                if 'items.' in sum_expr or sum_expr.startswith('items.'):
                    field_name = sum_expr.replace('items.', '')
                    values = [float(item.get(field_name, 0)) for item in all_items if item.get(field_name) is not None]
                    sum_value = sum(values) if values else 0
                    formula = formula.replace(match.group(0), str(sum_value))
            
            # Replace header references
            header = data.get('header', {})
            if isinstance(header, dict):
                for key, value in header.items():
                    formula = formula.replace(f'header.{key}', str(value))
            
            # Evaluate simple numeric expression
            result = eval(formula)
            if isinstance(result, float) and result.is_integer():
                return str(int(result))
            return str(result)
        except Exception as e:
            logger.warning(f"Error evaluating formula '{formula}': {str(e)}")
            return ''
    
    return ''


class PDFEngine:
    """
    JSON PDF Engine implementing the rules from PDF_ENGINE_RULES.md
    
    Key principles:
    - Fixed sections: position-based (Page Header/Footer, Bill Header/Footer)
    - Dynamic sections: flow-based (Bill Content)
    - JSON controls layout intent, engine owns pagination logic
    """
    
    def __init__(self, default_gap: float = 2.0):
        """
        Initialize PDF Engine.
        
        Args:
            default_gap: Default vertical gap between dynamic elements (in points)
        """
        self.default_gap = default_gap
        
        # Initialize three engines
        self.fixed_engine = FixedContentRenderEngine()
        self.dynamic_engine = DynamicContentRenderEngine(default_gap)
        self.balance_engine = PageBalanceFitEngine()
    
    def generate_pdf(self, template_json: str, data: Dict[str, Any]) -> bytes:
        """
        Generate PDF from template JSON and data following PDF_ENGINE_RULES.md
        
        Args:
            template_json: Template JSON string
            data: Data dictionary with 'header', 'items', and 'contentDetails'
            
        Returns:
            PDF bytes
        """
        template_config = json.loads(template_json)
        
        # Create PDF buffer
        buffer = BytesIO()
        
        # Get page configuration
        page_config = template_config.get('page', {})
        page_size = page_config.get('size', 'A4')
        orientation = page_config.get('orientation', 'portrait')
        
        # Get page dimensions
        page_width, page_height = get_page_size(page_size, orientation)
        
        # Create canvas
        c = canvas.Canvas(buffer, pagesize=(page_width, page_height))
        
        # Get section heights (from config or calculated) - Use Fixed Engine
        section_heights = self.fixed_engine.calculate_section_heights(template_config, page_height)
        
        # Extract dynamic content elements - Use Dynamic Engine
        # Includes: billContent fields, billContentTables, and contentDetailsTables
        # All elements are sorted by Y position and managed as dynamic, flow-based content
        bill_content_elements = self.dynamic_engine.extract_elements(template_config, data)
        
        # Calculate pagination for dynamic content
        pagination_info = self._calculate_pagination(
            template_config, data, section_heights, page_height, bill_content_elements
        )
        
        # Render all pages
        total_pages = pagination_info['total_pages']
        # RULE 1 & 2: Table Rendering State - Terminal State Per Table
        # Each table tracks: last_index (monotonic, never resets), total_items, all_rows_rendered, final_rows_rendered
        table_rendering_state = {}  # Track table rendering progress
        
        # CRITICAL FIX: Dynamic continuation - tables that don't render must continue on next page
        # We need to track which tables need continuation and add them to subsequent pages
        max_pages = total_pages
        page_num = 1
        max_iterations = 100  # Safety limit to prevent infinite loops
        
        # PHASE 1: Rendering Phase - Render all pages, track last_index monotonically
        # RULE 2: last_index Must Be Monotonic Per Table - starts at -1, only increases, never resets
        iteration = 0
        while page_num <= max_pages and iteration < max_iterations:
            iteration += 1
            
            # Check for tables that need continuation BEFORE rendering this page
            # (from previous page's rendering) - Use Balance Engine
            # CRITICAL: Only add tables that are allowed to render (sequential rendering)
            if page_num > 1:
                tables_needing_continuation = self._get_tables_needing_continuation_with_order(
                    bill_content_elements, table_rendering_state, page_num
                )
                
                # Add tables needing continuation to this page's elements (respecting sequential order)
                # CRITICAL: Continuation tables must be inserted at the BEGINNING to ensure they render
                # before any other elements (fields) that might be on the same page
                if tables_needing_continuation:
                    if page_num not in pagination_info['pages']:
                        pagination_info['pages'][page_num] = []
                    page_elements = pagination_info['pages'][page_num]
                    
                    # Insert continuation tables at the beginning (in reverse order to maintain sequence)
                    for table_element in reversed(tables_needing_continuation):
                        # Add to page elements if not already present
                        element_already_present = any(
                            id(e.get('element')) == id(table_element) or
                            (e.get('element', {}).get('type') == table_element['type'] and
                             e.get('element', {}).get('config') == table_element.get('config'))
                            for e in page_elements
                        )
                        if not element_already_present:
                            # Insert at beginning (index 0) so continuation renders before other elements
                            pagination_info['pages'][page_num].insert(0, {
                                'element': table_element,
                                'start_index': 0,
                                'end_index': None,
                                'y': 0
                            })
                            logger.debug(f"Added table to page {page_num} for continuation (at beginning): "
                                       f"{table_element.get('type')}, content_name={table_element.get('content_name')}")
            
            self._render_page(
                c, page_num, max_pages, template_config, data,
                section_heights, page_width, page_height,
                bill_content_elements, pagination_info, table_rendering_state
            )
            
            # Check if we need more pages for continuation AFTER rendering - Respect sequential order
            # CRITICAL: Only check if we're on the last page (page_num == max_pages)
            # This prevents unnecessary pagination extensions when tables complete mid-sequence
            if page_num == max_pages:
                tables_still_needing_continuation = self._get_tables_needing_continuation_with_order(
                    bill_content_elements, table_rendering_state, page_num + 1
                )
                
                # Only extend pagination if there are tables that actually need continuation
                # AND those tables can render (sequential order allows them)
                if tables_still_needing_continuation:
                    # Need more pages - extend pagination
                    max_pages += 1
                    logger.debug(f"Extended pagination to {max_pages} pages for table continuation. "
                               f"Tables needing continuation: {len(tables_still_needing_continuation)}")
            
            # Don't call showPage() on the last page - canvas.save() handles it
            if page_num < max_pages:
                c.showPage()
            
            page_num += 1
        
        if iteration >= max_iterations:
            logger.error(f"CRITICAL: Rendering loop reached max_iterations ({max_iterations}). "
                        f"This may indicate an infinite continuation loop. "
                        f"Tables needing continuation: {self._get_tables_needing_continuation_with_order(bill_content_elements, table_rendering_state, page_num)}")
        
        c.save()
        buffer.seek(0)
        return buffer.getvalue()
    
    def _get_tables_needing_continuation(
        self, bill_content_elements: List[Dict[str, Any]],
        table_rendering_state: Dict[str, Any], page_num: int
    ) -> List[Dict[str, Any]]:
        """
        Get tables that need continuation on the next page.
        
        A table needs continuation if:
        - It has data remaining (last_index < total_items - 1)
        - It hasn't been marked as all_rows_rendered
        """
        tables_needing_continuation = []
        
        for element in bill_content_elements:
            if element['type'] in ['billContentTable', 'contentDetailTable']:
                table_config = element['config']
                items = element.get('data', [])
                
                if element['type'] == 'billContentTable':
                    table_key = f"billContentTable_{table_config.get('x', 0)}_{table_config.get('y', 0)}"
                else:
                    content_name = element.get('content_name')
                    table_key = f"contentDetailTable_{content_name}_{table_config.get('x', 0)}_{table_config.get('y', 0)}"
                
                if table_key in table_rendering_state:
                    state = table_rendering_state[table_key]
                    last_index = state.get('last_index', -1)
                    total_items = state.get('total_items', 0)
                    all_rows_rendered = state.get('all_rows_rendered', False)
                    
                    # Table needs continuation if it has remaining data
                    if not all_rows_rendered and last_index < total_items - 1:
                        tables_needing_continuation.append(element)
                        logger.debug(f"Table {table_key} needs continuation: last_index={last_index}, "
                                   f"total_items={total_items}, all_rows_rendered={all_rows_rendered}")
        
        return tables_needing_continuation
    
    def _get_tables_needing_continuation_with_order(
        self, bill_content_elements: List[Dict[str, Any]],
        table_rendering_state: Dict[str, Any], page_num: int
    ) -> List[Dict[str, Any]]:
        """
        Get tables that need continuation, respecting sequential rendering order.
        
        A table can only render if all previous tables (by Y position) are complete.
        This ensures contentDetailsTable doesn't start until billContentTable is finished.
        """
        tables_needing_continuation = []
        
        # Get all tables needing continuation (without order check first)
        all_tables_needing_continuation = self.balance_engine.get_tables_needing_continuation(
            bill_content_elements, table_rendering_state, page_num
        )
        
        # For each table needing continuation, check if all previous tables are complete
        for table_element in all_tables_needing_continuation:
            table_y = table_element.get('y', 0)
            
            # Get table key for comparison
            table_config = table_element['config']
            if table_element['type'] == 'billContentTable':
                current_table_key = f"billContentTable_{table_config.get('x', 0)}_{table_config.get('y', 0)}"
            else:
                content_name = table_element.get('content_name')
                current_table_key = f"contentDetailTable_{content_name}_{table_config.get('x', 0)}_{table_config.get('y', 0)}"
            
            # Check if all previous tables (by Y position) are complete
            can_render = True
            for element in bill_content_elements:
                if element['type'] not in ['billContentTable', 'contentDetailTable']:
                    continue
                
                element_y = element.get('y', 0)
                
                # Skip if this is the same table (compare by key instead of id)
                element_table_config = element['config']
                if element['type'] == 'billContentTable':
                    element_table_key = f"billContentTable_{element_table_config.get('x', 0)}_{element_table_config.get('y', 0)}"
                else:
                    element_content_name = element.get('content_name')
                    element_table_key = f"contentDetailTable_{element_content_name}_{element_table_config.get('x', 0)}_{element_table_config.get('y', 0)}"
                
                if element_table_key == current_table_key:
                    continue
                
                # Check if this element comes before our table (smaller Y = earlier in order)
                if element_y < table_y:
                    # This element comes before our table - it must be complete
                    if element_table_key in table_rendering_state:
                        state = table_rendering_state[element_table_key]
                        all_rows_rendered = state.get('all_rows_rendered', False)
                        if not all_rows_rendered:
                            # Previous table not complete - cannot render this table yet
                            can_render = False
                            # Table blocked - skip logging
                            break
                    else:
                        # Table not in state yet - not complete
                        can_render = False
                        # Table blocked - skip logging
                        break
            
            if can_render:
                tables_needing_continuation.append(table_element)
            # else: Skipping table continuation - skip logging
        
        return tables_needing_continuation
    
    def _check_all_tables_complete(
        self, table_rendering_state: Dict[str, Any], bill_content_elements: List[Dict[str, Any]]
    ) -> bool:
        """
        Check if all tables in bill_content_elements are complete.
        
        Returns True only if all tables have all_rows_rendered = True.
        """
        # Get all table elements
        table_elements = [e for e in bill_content_elements if e['type'] in ['billContentTable', 'contentDetailTable']]
        
        if not table_elements:
            # No tables - consider complete
            return True
        
        # Check each table
        for element in table_elements:
            table_config = element['config']
            if element['type'] == 'billContentTable':
                table_key = f"billContentTable_{table_config.get('x', 0)}_{table_config.get('y', 0)}"
            else:
                content_name = element.get('content_name')
                table_key = f"contentDetailTable_{content_name}_{table_config.get('x', 0)}_{table_config.get('y', 0)}"
            
            if table_key not in table_rendering_state:
                # Table hasn't started yet - not complete
                return False
            
            state = table_rendering_state[table_key]
            all_rows_rendered = state.get('all_rows_rendered', False)
            
            if not all_rows_rendered:
                # This table is not complete
                return False
        
        # All tables are complete
        return True
    
    def _filter_elements_by_sequential_order(
        self, page_elements: List[Dict[str, Any]], table_rendering_state: Dict[str, Any],
        bill_content_elements: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Filter page elements to respect sequential rendering order.
        
        Only include an element (table or field) if all previous tables (by Y position in original list) are complete.
        This ensures contentDetailsTable doesn't render until billContentTable is finished.
        And ensures billContent fields (type='field') don't render until previous tables are finished.
        """
        filtered_elements = []
        
        for element_info in page_elements:
            element = element_info['element']
            element_type = element.get('type')
            element_y = element.get('y', 0)
            
            # For table elements, get table key for comparison
            current_table_key = None
            if element_type == 'billContentTable':
                table_config = element['config']
                current_table_key = f"billContentTable_{table_config.get('x', 0)}_{table_config.get('y', 0)}"
            elif element_type == 'contentDetailTable':
                table_config = element['config']
                content_name = element.get('content_name')
                current_table_key = f"contentDetailTable_{content_name}_{table_config.get('x', 0)}_{table_config.get('y', 0)}"
            
            # Check if all previous tables (in original bill_content_elements order) are complete
            # CRITICAL: An element (table or field) can render if all previous tables (by Y order) that have been started are complete.
            # For fields (type='field'), they must wait for previous tables to complete before rendering.
            # We only check tables that have been started (are in table_rendering_state).
            # If a previous table hasn't started yet, it's either:
            # 1. Not on this page yet (will start later) - allow this one to render
            # 2. On this page but hasn't been rendered yet - will be rendered before this one (order in page_elements)
            # 
            # So we only block if: previous table has started AND is not complete
            can_render = True
            
            for prev_element in bill_content_elements:
                # Only check previous table elements (tables block other elements from rendering)
                if prev_element.get('type') not in ['billContentTable', 'contentDetailTable']:
                    continue
                
                # Get previous table key for comparison
                prev_table_config = prev_element['config']
                if prev_element['type'] == 'billContentTable':
                    prev_table_key = f"billContentTable_{prev_table_config.get('x', 0)}_{prev_table_config.get('y', 0)}"
                else:
                    prev_content_name = prev_element.get('content_name')
                    prev_table_key = f"contentDetailTable_{prev_content_name}_{prev_table_config.get('x', 0)}_{prev_table_config.get('y', 0)}"
                
                # Skip if this is the same table element (compare by key)
                # For fields (current_table_key is None), check all previous tables
                if current_table_key and prev_table_key == current_table_key:
                    break  # We've reached our element - all previous ones are checked
                
                prev_element_y = prev_element.get('y', 0)
                
                # Check if previous table comes before (smaller Y = earlier in order)
                if prev_element_y < element_y:
                    # Only block if previous table has been started (is in table_rendering_state) AND is not complete
                    # If previous table hasn't started, it means it's either:
                    # - Not on current page (will start later) - allow this one
                    # - On current page but hasn't rendered yet - it will render before this one due to page_elements order
                    if prev_table_key in table_rendering_state:
                        state = table_rendering_state[prev_table_key]
                        all_rows_rendered = state.get('all_rows_rendered', False)
                        if not all_rows_rendered:
                            can_render = False
                            # Element (table or field) blocked from rendering - skip logging
                            break
                    # If previous table hasn't started yet, it's OK - allow this one to render
                    # (Previous table will render first if on same page, or later if not)
            
            if can_render:
                filtered_elements.append(element_info)
            # else: Skipping element on page (table or field blocked) - skip logging
        
        return filtered_elements
    
    def _get_section_heights(self, template_config: Dict[str, Any], page_height: float) -> Dict[str, float]:
        """
        Get section heights from config or calculate dynamically.
        
        Args:
            template_config: Template configuration
            page_height: Page height in points
            
        Returns:
            Dictionary with section heights: pageHeader, pageFooter, billHeader, billFooter
        """
        section_heights_config = template_config.get('sectionHeights', {})
        
        # Page Header height
        page_header_height = section_heights_config.get('pageHeader', 60)
        if 'pageHeader' not in section_heights_config:
            page_header_fields = template_config.get('pageHeader', [])
            page_header_height = self._calculate_section_height_from_fields(page_header_fields, 60)
        
        # Page Footer height
        page_footer_height = section_heights_config.get('pageFooter', 60)
        if 'pageFooter' not in section_heights_config:
            page_footer_fields = template_config.get('pageFooter', [])
            page_footer_height = self._calculate_section_height_from_fields(page_footer_fields, 60)
        
        # Bill Header height
        bill_header_height = section_heights_config.get('billHeader', 200)
        if 'billHeader' not in section_heights_config:
            bill_header_fields = template_config.get('header', [])
            bill_header_height = self._calculate_section_height_from_fields(bill_header_fields, 200)
        
        # Bill Footer height
        bill_footer_height = section_heights_config.get('billFooter', 100)
        if 'billFooter' not in section_heights_config:
            bill_footer_fields = template_config.get('billFooter', [])
            bill_footer_height = calculate_bill_footer_height(bill_footer_fields) if bill_footer_fields else 0
        
        return {
            'pageHeader': page_header_height,
            'pageFooter': page_footer_height,
            'billHeader': bill_header_height,
            'billFooter': bill_footer_height
        }
    
    def _calculate_section_height_from_fields(self, fields: List[Dict[str, Any]], default_height: float) -> float:
        """Calculate section height from field positions and sizes."""
        if not fields:
            return default_height
        
        min_height = 40
        padding = 20
        
        max_bottom = 0
        for field in fields:
            if field.get('visible', True):
                field_y = field.get('y', 0)
                font_size = field.get('fontSize', 12)
                field_height = font_size * 1.5 if font_size else 20
                bottom = field_y + field_height
                max_bottom = max(max_bottom, bottom)
        
        calculated_height = max(min_height, max_bottom + padding)
        return max(calculated_height, default_height)
    
    def _extract_bill_content_elements(self, template_config: Dict[str, Any], data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract all bill content elements (fields, tables) in rendering order.
        
        Returns list of elements with type, config, and initial Y position.
        Elements are sorted by their configured Y position (ascending = top to bottom).
        """
        elements = []
        
        # Bill content fields
        bill_content_fields = template_config.get('billContent', [])
        for field in bill_content_fields:
            if field.get('visible', True):
                elements.append({
                    'type': 'field',
                    'config': field,
                    'y': field.get('y', 0)
                })
        
        # Bill content tables
        bill_content_tables = template_config.get('billContentTables', [])
        items = data.get('items', [])
        for table_config in bill_content_tables:
            elements.append({
                'type': 'billContentTable',
                'config': table_config,
                'data': items,
                'y': table_config.get('y', 0)
            })
        
        # Content details tables
        content_details_tables = template_config.get('contentDetailsTables', [])
        content_details_data = data.get('contentDetails', {})
        for table_config in content_details_tables:
            content_name = table_config.get('contentName')
            cd_data = content_details_data.get(content_name, []) if content_name else []
            if isinstance(cd_data, list) and len(cd_data) > 0:
                elements.append({
                    'type': 'contentDetailTable',
                    'config': table_config,
                    'data': cd_data,
                    'content_name': content_name,
                    'y': table_config.get('y', 0)
                })
        
        # Sort by Y position (ascending = top to bottom)
        elements.sort(key=lambda e: e.get('y', 0))
        
        return elements
    
    def _calculate_pagination(
        self, template_config: Dict[str, Any], data: Dict[str, Any],
        section_heights: Dict[str, float], page_height: float,
        bill_content_elements: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Calculate pagination for dynamic content.
        
        Returns pagination info with pages and element positioning.
        """
        # Container padding - matches template_engine (80 total: 40pt top + 40pt bottom)
        container_padding_top = 40
        container_padding_bottom = 40
        container_padding_total = container_padding_top + container_padding_bottom
        
        # Calculate available height per page
        page_header_height = section_heights['pageHeader']
        page_footer_height = section_heights['pageFooter']
        bill_header_height = section_heights['billHeader']
        bill_footer_height = section_heights['billFooter']
        
        # First page: minus bill header and container padding
        available_height_first_page = page_height - page_header_height - page_footer_height - bill_header_height - container_padding_total
        
        # Subsequent pages: no bill header, but still minus container padding
        available_height_subsequent_pages = page_height - page_header_height - page_footer_height - container_padding_total
        
        pages = {}
        current_page = 1
        current_y = 0  # Current Y position on current page (from top of content area)
        current_page_height = available_height_first_page
        
        # Process each element
        for element in bill_content_elements:
            element_height = self._estimate_element_height(element, template_config, data)
            
            # Check if element fits on current page
            if current_y + element_height > current_page_height:
                # Element doesn't fit - check if it's a table that can be split
                if element['type'] in ['billContentTable', 'contentDetailTable']:
                    # CRITICAL FIX: Don't pre-calculate rows using estimates
                    # Instead, let render_table handle row-by-row accumulation using ACTUAL heights
                    # Pre-calculation with estimates causes:
                    # - Negative available height aborts (rows_available_height <= 0 returns 0)
                    # - Tables to be completely skipped
                    # - Remaining rows never attempted
                    # 
                    # Solution: Always attempt to render table on current page
                    # render_table will use ACTUAL heights and stop at min_content_y
                    # This ensures row-by-row accumulation, not pre-calculation
                    
                    # Put table on current page - let render_table decide how many rows fit
                    pages.setdefault(current_page, []).append({
                        'element': element,
                        'start_index': 0,
                        'end_index': None,  # CRITICAL: None means render_table decides using actual heights
                        'y': current_y
                    })
                    
                    # Estimate height for pagination planning (but render_table will use actual heights)
                    # Use a conservative estimate to ensure we don't over-allocate space
                    estimated_table_height = self._estimate_element_height(element, template_config, data)
                    # CRITICAL: Account for gap after table for pagination estimation
                    # Even though table might continue, we need gap for next element estimation
                    current_y += estimated_table_height + self.default_gap
                    
                    # CRITICAL: Don't pre-slice tables - let render_table handle continuation
                    # If table doesn't fit completely, render_table will stop at min_content_y
                    # The continuation logic in _render_content_element will handle next page
                    # This ensures row-by-row accumulation, not pre-calculation
                else:
                    # Non-table element (field) doesn't fit - move to next page
                    # CRITICAL: Account for gap in pagination calculation for fields too
                    current_page += 1
                    current_page_height = available_height_subsequent_pages
                    current_y = 0
                    pages.setdefault(current_page, []).append({
                        'element': element,
                        'y': current_y
                    })
                    # Include gap after field for next element estimation
                    current_y += element_height + self.default_gap
            else:
                # Element fits on current page
                # CRITICAL: For tables, set end_index=None to enable row-by-row accumulation
                element_info = {
                    'element': element,
                    'y': current_y
                }
                if element['type'] in ['billContentTable', 'contentDetailTable']:
                    element_info['start_index'] = 0
                    element_info['end_index'] = None  # Let render_table decide using actual heights
                pages.setdefault(current_page, []).append(element_info)
                # Add gap after element (accounting for extra space)
                current_y += element_height + self.default_gap
        
        # Ensure at least one page exists
        if not pages:
            pages[1] = []
        
        total_pages = max(pages.keys()) if pages else 1
        
        return {
            'total_pages': total_pages,
            'pages': pages,
            'available_height_first_page': available_height_first_page,
            'available_height_subsequent_pages': available_height_subsequent_pages
        }
    
    def _estimate_element_height(self, element: Dict[str, Any], template_config: Dict[str, Any], data: Dict[str, Any]) -> float:
        """
        Estimate height of a dynamic content element.
        
        Supports:
        - 'field': billContent text fields (from template_config['billContent'])
        - 'billContentTable': Main content tables (includes final rows height)
        - 'contentDetailTable': Content detail tables (includes final rows height)
        
        Includes final rows height for tables.
        """
        element_type = element['type']
        
        if element_type == 'field':
            # billContent field height estimation
            # Fields are text elements from template_config['billContent']
            # CRITICAL: Height calculation must match actual rendering in render_element()
            # Both use: font_size * 1.5
            font_size = element['config'].get('fontSize', 12)
            return font_size * 1.5
        elif element_type in ['billContentTable', 'contentDetailTable']:
            table_config = element['config']
            items = element.get('data', [])
            
            # RULE 1 & 5: Every Table Must Define a Row Height - Table-Specific Calculation
            # Calculate table height: header + data rows + final rows
            font_size = table_config.get('fontSize', 12)
            cell_padding = table_config.get('cellPadding', 10)
            border_width = table_config.get('borderWidth', 1)
            
            # RULE 1: Base row height (same as render_table base calculation)
            base_row_height = font_size + (cell_padding * 2) + (border_width * 2) + 2
            
            # RULE 2: Account for potential text wrapping (render_table uses dynamic heights)
            # CRITICAL: Actual row heights can be MUCH larger than base height
            # Use very conservative estimate: base height * 3.0 for potential wrapping
            # This accounts for multi-line text, paragraph spacing, leading, etc.
            # Better to underestimate than to stop rendering early
            row_height_estimate = base_row_height * 3.0
            
            header_height = base_row_height  # Header uses base height
            
            # RULE 3: render_table doesn't add gaps between rows (current_y = row_y)
            # So we don't add row_gap in height calculation
            num_rows = len(items) if items else 0
            
            # Calculate data rows height (no gaps, matching render_table behavior)
            data_rows_height = 0
            if num_rows > 0:
                # Each row takes row_height_estimate (no gaps)
                data_rows_height = num_rows * row_height_estimate
            
            # Add final rows height
            final_rows_height = self._estimate_final_rows_height(table_config, data)
            
            # Extra space/padding for table
            extra_space = 10
            
            total_height = header_height + data_rows_height + final_rows_height + extra_space
            return total_height if num_rows > 0 or final_rows_height > 0 else header_height + extra_space
        else:
            return 20  # Default height
    
    def _estimate_element_height_with_rows(self, element: Dict[str, Any], num_rows: int, template_config: Dict[str, Any], data: Dict[str, Any] = None) -> float:
        """
        Estimate height of a table element with specific number of rows.
        Includes final rows height if this is the last page of the table.
        
        RULE 1 & 2 & 5: Row Height Must Be Counted - Table-Specific Calculation
        Must match the calculation used in render_table (dynamic heights with wrapping buffer).
        """
        if element['type'] not in ['billContentTable', 'contentDetailTable']:
            return self._estimate_element_height(element, template_config, data or {})
        
        table_config = element['config']
        font_size = table_config.get('fontSize', 12)
        cell_padding = table_config.get('cellPadding', 10)
        border_width = table_config.get('borderWidth', 1)
        
        # RULE 1: Base row height (same as render_table base calculation)
        base_row_height = font_size + (cell_padding * 2) + (border_width * 2) + 2
        
        # RULE 2: Account for potential text wrapping (render_table uses dynamic heights)
        # Use conservative estimate: base height * 1.5 for potential wrapping
        row_height_estimate = base_row_height * 1.5
        
        header_height = base_row_height  # Header uses base height
        
        # RULE 3: render_table doesn't add gaps between rows (current_y = row_y)
        # So we don't add row_gap in height calculation
        
        # Calculate data rows height (no gaps, matching render_table behavior)
        data_rows_height = 0
        if num_rows > 0:
            # Each row takes row_height_estimate (no gaps)
            data_rows_height = num_rows * row_height_estimate
        
        # Check if this is the last page (all rows rendered) - if so, include final rows
        total_items = len(element.get('data', []))
        final_rows_height = 0
        if data and num_rows > 0 and num_rows >= total_items:
            # This is the last page, include final rows height
            final_rows_height = self._estimate_final_rows_height(table_config, data)
        
        # Extra space/padding
        extra_space = 10
        
        total_height = header_height + data_rows_height + final_rows_height + extra_space
        return total_height if num_rows > 0 or final_rows_height > 0 else header_height + extra_space
    
    def _estimate_final_rows_height(self, table_config: Dict[str, Any], data: Dict[str, Any]) -> float:
        """
        Estimate height of final rows for a table.
        
        Args:
            table_config: Table configuration
            data: Data dictionary (for calculations)
            
        Returns:
            Estimated height of final rows in points
        """
        final_rows = table_config.get('finalRows', [])
        if not final_rows:
            return 0
        
        # Get table styling
        font_size = table_config.get('fontSize', 12)
        cell_padding = table_config.get('cellPadding', 10)
        border_width = table_config.get('borderWidth', 1)
        base_row_height = font_size + (cell_padding * 2) + (border_width * 2) + 2
        
        # Calculate height for each final row
        total_final_rows_height = 0
        row_gap = 2  # Gap between final rows
        
        for final_row in final_rows:
            if not final_row.get('visible', True):
                continue
            
            # Find maximum cell height for this row
            max_cell_height = base_row_height
            columns = table_config.get('columns', [])
            visible_columns = [col for col in columns if col.get('visible', True)]
            
            # Estimate row height based on cell configurations
            for col in visible_columns:
                # Find corresponding cell config
                cell_config = None
                cell_col_idx = 0
                for cell_cfg in final_row.get('cells', []):
                    cell_col_span = cell_cfg.get('colSpan', 1)
                    if cell_col_idx < len(visible_columns) and cell_col_idx <= visible_columns.index(col) < cell_col_idx + cell_col_span:
                        cell_config = cell_cfg
                        break
                    cell_col_idx += cell_col_span
                
                if cell_config:
                    cell_font_size = cell_config.get('fontSize', font_size)
                    cell_row_height = cell_font_size + (cell_padding * 2) + (border_width * 2) + 2
                    max_cell_height = max(max_cell_height, cell_row_height)
            
            total_final_rows_height += max_cell_height + row_gap
        
        # Remove last gap
        if total_final_rows_height > 0:
            total_final_rows_height -= row_gap
        
        return total_final_rows_height
    
    def _calculate_rows_fitting_height(self, element: Dict[str, Any], available_height: float, template_config: Dict[str, Any]) -> int:
        """
        Calculate how many table rows fit in available height.
        
        RULE 1 & 2: Row Height Must Be Counted Before Rendering
        RULE 3: Pagination Decisions Must Use Total Row Height
        RULE 5: Height Calculation Must Be Table-Specific
        
        This function must use the SAME row height calculation as render_table.
        render_table uses dynamic row heights based on cell content (Paragraph.wrap()).
        For estimation, we use a conservative estimate that accounts for potential wrapping.
        """
        if element['type'] not in ['billContentTable', 'contentDetailTable']:
            return 0
        
        table_config = element['config']
        font_size = table_config.get('fontSize', 12)
        cell_padding = table_config.get('cellPadding', 10)
        border_width = table_config.get('borderWidth', 1)
        
        # RULE 1: Every Table Must Define a Row Height
        # Use the same base calculation as render_table, but add a buffer for text wrapping
        # render_table calculates: max(cell_heights) where cell_height uses Paragraph.wrap()
        # CRITICAL: Actual row heights can be MUCH larger than base height due to:
        # - Multi-line text wrapping
        # - Paragraph spacing
        # - Variable font leading
        # - Cell padding
        # For estimation, we use a VERY conservative estimate to avoid underestimation
        base_row_height = font_size + (cell_padding * 2) + (border_width * 2) + 2
        
        # RULE 2: Account for potential text wrapping (cells may be MUCH taller than base height)
        # Use a much larger multiplier (3x) to account for:
        # - Long text that wraps multiple lines
        # - Paragraph leading and spacing
        # - Cell padding effects
        # This ensures we don't underestimate available space
        # Better to underestimate rows-per-page than to stop rendering early
        row_height_estimate = base_row_height * 3.0
        
        header_height = base_row_height  # Header uses base height (no wrapping typically)
        
        # RULE 3: Row spacing/gap - render_table doesn't add gaps, but we account for visual spacing
        # Note: render_table moves current_y = row_y (bottom of row), so next row starts immediately
        # But we add a small buffer for visual spacing in estimation
        row_gap = 0  # render_table doesn't add gaps between rows
        extra_space = 10  # Extra padding/space buffer for safety
        
        # RULE 3: Subtract header height and extra space from available height
        rows_available_height = available_height - header_height - extra_space
        
        # CRITICAL FIX: Don't abort on negative or zero height
        # Even if estimated calculation suggests no space, we should still attempt rendering
        # render_table will use ACTUAL heights and may find space that estimates missed
        # Returning 0 here causes tables to be completely skipped, which is fatal
        if rows_available_height <= 0:
            # Return at least 1 to allow render_table to attempt rendering with actual heights
            # render_table will correctly stop if there's truly no space
            return 1
        
        # RULE 3: Calculate how many rows fit using estimated row height
        # Since render_table doesn't add gaps, each row takes row_height_estimate
        # Formula: rows_available_height = num_rows * row_height_estimate
        num_rows = int(rows_available_height / row_height_estimate)
        
        # Ensure we don't exceed total items
        total_items = len(element.get('data', []))
        result = min(num_rows, total_items)
        
        # Rows fitting calculation - skip detailed logging
        
        return result
    
    def _render_page(
        self, c: canvas.Canvas, page_num: int, total_pages: int,
        template_config: Dict[str, Any], data: Dict[str, Any],
        section_heights: Dict[str, float], page_width: float, page_height: float,
        bill_content_elements: List[Dict[str, Any]], pagination_info: Dict[str, Any],
        table_rendering_state: Dict[str, Any]
    ) -> None:
        """
        Render a single page following PDF_ENGINE_RULES.md
        
        Rendering order:
        1. Page Header (every page)
        2. Bill Header (first page only)
        3. Bill Content (dynamic, flow-based)
        4. Bill Footer (last page only)
        5. Page Footer (every page)
        """
        page_context = {'currentPage': page_num, 'totalPages': total_pages}
        
        # Calculate available height using Balance Engine
        # CRITICAL: Check all_tables_complete BEFORE rendering content for height calculation
        # Then recalculate AFTER rendering to check if bill footer should render
        all_tables_complete_before = self._check_all_tables_complete(table_rendering_state, bill_content_elements)
        height_info = self.balance_engine.calculate_available_height(
            page_height, page_num, total_pages, section_heights, all_tables_complete_before
        )
        min_content_y_from_top = height_info['min_y']
        
        # Render Page Header using Fixed Engine
        page_header_height = section_heights['pageHeader']
        header_top_y = page_height - self.balance_engine.container_padding_top
        self.fixed_engine.render_page_header(c, template_config, data, page_context, header_top_y, page_header_height)
        
        # Render Bill Header (first page only) using Fixed Engine
        bill_header_top_y = header_top_y - page_header_height
        if page_num == 1:
            bill_header_height = section_heights['billHeader']
            self.fixed_engine.render_bill_header(c, template_config, data, page_context, bill_header_top_y, bill_header_height)
            # Content starts after bill header on first page
            content_start_y = bill_header_top_y - bill_header_height
        else:
            # Content starts after page header on subsequent pages
            content_start_y = bill_header_top_y
        
        # Render Bill Content (dynamic, flow-based)
        # Content area starts at content_start_y and ends at min_content_y_from_top (calculated by Balance Engine above)
        
        bill_content_bottom = self._render_bill_content(
            c, page_num, template_config, data, page_context,
            content_start_y, min_content_y_from_top, pagination_info,
            table_rendering_state, bill_content_elements,
            page_height, section_heights
        )
        
        # Render Bill Footer only when ALL tables are complete
        # Recheck after rendering content (tables may have completed during rendering)
        all_tables_complete = self._check_all_tables_complete(table_rendering_state, bill_content_elements)
        if all_tables_complete:
            bill_footer_height = section_heights['billFooter']
            bill_footer_top_y = self.balance_engine.calculate_bill_footer_position(
                bill_content_bottom, bill_footer_height, page_height,
                section_heights['pageFooter'], self.balance_engine.container_padding_bottom
            )
            self.fixed_engine.render_bill_footer(c, template_config, data, page_context, bill_footer_top_y, bill_footer_height)
        
        # Render Page Footer using Fixed Engine
        page_footer_height = section_heights['pageFooter']
        footer_top_y = self.balance_engine.container_padding_bottom + page_footer_height
        self.fixed_engine.render_page_footer(c, template_config, data, page_context, footer_top_y, page_footer_height)
    
    def _render_page_header(
        self, c: canvas.Canvas, template_config: Dict[str, Any], data: Dict[str, Any],
        page_context: Dict[str, Any], header_top_y: float, header_height: float
    ) -> None:
        """Render page header at fixed position."""
        page_header_fields = template_config.get('pageHeader', [])
        if not page_header_fields:
            return
        
        for field in page_header_fields:
            if field.get('visible', True):
                x = field.get('x', 0)
                # Field Y is relative to header top
                y = header_top_y - field.get('y', 0)
                render_field(c, field, data, x, y, page_context)
    
    def _render_bill_header(
        self, c: canvas.Canvas, template_config: Dict[str, Any], data: Dict[str, Any],
        page_context: Dict[str, Any], header_top_y: float, header_height: float
    ) -> None:
        """Render bill header at fixed position (first page only)."""
        bill_header_fields = template_config.get('header', [])
        if not bill_header_fields:
            return
        
        for field in bill_header_fields:
            if field.get('visible', True):
                x = field.get('x', 0)
                # Field Y is relative to header top
                y = header_top_y - field.get('y', 0)
                render_field(c, field, data, x, y, page_context)
    
    def _render_bill_content(
        self, c: canvas.Canvas, page_num: int, template_config: Dict[str, Any],
        data: Dict[str, Any], page_context: Dict[str, Any],
        content_start_y: float, content_bottom_y: float,
        pagination_info: Dict[str, Any], table_rendering_state: Dict[str, Any],
        bill_content_elements: List[Dict[str, Any]],
        page_height: float = None, section_heights: Dict[str, float] = None
    ) -> float:
        """
        Render bill content using flow-based positioning.
        
        Returns the bottom Y position of rendered content.
        """
        page_elements = pagination_info['pages'].get(page_num, [])
        
        if not page_elements:
            return content_start_y
        
        # Calculate reference position from page header (not content_start_y which includes bill header)
        # CRITICAL: Position reference taken from page header as requested
        if page_height is not None and section_heights is not None:
            page_header_start_y = page_height - self.balance_engine.container_padding_top
            page_header_height = section_heights.get('pageHeader', 60)
            bill_header_height = section_heights.get('billHeader', 85) if page_num == 1 else 0
            # Reference start: after page header and bill header (if present)
            # First element positions relative to this reference point
            reference_start_y = page_header_start_y - page_header_height - bill_header_height
        else:
            # Fallback to content_start_y if heights not provided
            reference_start_y = content_start_y
        
        # Track current Y position for flow-based rendering
        # Start from reference position (from page header)
        logger.debug(f"[POSITION] Page {page_num}: Starting bill content rendering, "
                   f"reference_start_y={reference_start_y:.1f}, "
                   f"content_bottom_y={content_bottom_y:.1f}, "
                   f"default_gap={self.default_gap:.1f}, "
                   f"page_elements_count={len(page_elements)}")
        
        current_y = reference_start_y
        content_bottom = reference_start_y
        
        # Render elements in order (already sorted by pagination)
        # CRITICAL: Re-filter elements after each render to check if next sequential table can start
        # This allows contentDetailTable to start on same page when billContentTable completes mid-page
        elements_to_render = self._filter_elements_by_sequential_order(page_elements, table_rendering_state, bill_content_elements)
        rendered_count = 0  # Track how many elements we've rendered from original list
        
        while rendered_count < len(elements_to_render) or rendered_count < len(page_elements):
            # Re-filter elements after each render to catch newly enabled tables
            # This ensures contentDetailTable can start immediately when billContentTable completes
            current_elements_to_render = self._filter_elements_by_sequential_order(page_elements, table_rendering_state, bill_content_elements)
            
            # Only process elements we haven't rendered yet
            if rendered_count >= len(current_elements_to_render):
                break  # No more elements to render
            
            element_info = current_elements_to_render[rendered_count]
            element = element_info['element']
            # CRITICAL: Get configured Y from the element itself (template config), not from element_info
            # element_info['y'] is the flow-based Y from pagination, not the configured Y from template
            configured_y = element.get('y', 0)
            
            # Check if this is a table continuation (has state with last_index >= 0)
            # Continuations should NOT use configured_y - they start from page header reference directly
            is_table_continuation = False
            if element.get('type') in ['billContentTable', 'contentDetailTable']:
                table_config = element.get('config')
                if element.get('type') == 'billContentTable':
                    table_key = f"billContentTable_{table_config.get('x', 0)}_{table_config.get('y', 0)}"
                else:
                    content_name = element.get('content_name')
                    table_key = f"contentDetailTable_{content_name}_{table_config.get('x', 0)}_{table_config.get('y', 0)}"
                
                if table_key in table_rendering_state:
                    last_index = table_rendering_state[table_key].get('last_index', -1)
                    # Table is a continuation if it has a last_index >= 0 (has rendered rows before)
                    is_table_continuation = last_index >= 0
            
            # Apply flow-based positioning: position from page header, then flow from previous element
            # CRITICAL: First element positions relative to page header reference
            # Table continuations start from page header WITHOUT configured_y (no prediction, use actual data)
            # Subsequent elements position relative to previous element's bottom with gap (flow-based)
            if rendered_count == 0:
                if is_table_continuation:
                    # Table continuation: start from page header reference WITHOUT configured_y
                    # This ensures continuations start at the same position as first elements, not offset by Y
                    element_y = reference_start_y
                    logger.debug(f"[POSITION] Page {page_num}, Element {rendered_count} (CONTINUATION): "
                               f"type={element.get('type')}, configured_y={configured_y} (IGNORED for continuation), "
                               f"reference_start_y={reference_start_y:.1f}, element_y={element_y:.1f}")
                else:
                    # First element (not continuation): position relative to page header reference (page header bottom)
                    element_y = reference_start_y - configured_y
                    logger.debug(f"[POSITION] Page {page_num}, Element {rendered_count} (FIRST): "
                               f"type={element.get('type')}, configured_y={configured_y}, "
                               f"reference_start_y={reference_start_y:.1f}, element_y={element_y:.1f}")
            else:
                # Subsequent elements: position relative to previous element's bottom (flow-based with gap)
                # CRITICAL: New element starts at previous element's bottom minus gap
                # current_y is the bottom Y of the previous element (from render_result['bottom_y'])
                # In "from top" coordinates: Y decreases downward, so subtract gap to move down
                element_y = current_y - self.default_gap
                logger.debug(f"[POSITION] Page {page_num}, Element {rendered_count}: "
                           f"type={element.get('type')}, configured_y={configured_y}, "
                           f"current_y={current_y:.1f}, gap={self.default_gap:.1f}, "
                           f"element_y={element_y:.1f} (current_y - gap)")
            
            # Ensure element doesn't go below minimum content Y
            element_y_before_clamp = element_y
            element_y = max(element_y, content_bottom_y)
            if element_y != element_y_before_clamp:
                logger.debug(f"[POSITION] Element {rendered_count} clamped: "
                           f"element_y_before={element_y_before_clamp:.1f}, "
                           f"content_bottom_y={content_bottom_y:.1f}, "
                           f"element_y_after={element_y:.1f}")
            #element_y add 10 
             #element_y = element_y - 10
            font_size = element['config'].get('fontSize', 12)
            element_y = element_y - font_size * 1.5
            # Render element using Dynamic Engine
            logger.debug(f"[RENDER] Page {page_num}, Element {rendered_count}: "
                       f"type={element.get('type')}, starting at element_y={element_y:.1f}")
            render_result = self.dynamic_engine.render_element(
                c, element, element_y, content_bottom_y,
                page_num, page_context, data, template_config, table_rendering_state
            )
            element_bottom = render_result['bottom_y']
            
            # Update flow position
            current_y_before = current_y
            current_y = element_bottom
            content_bottom = min(content_bottom, element_bottom)
            
            logger.debug(f"[GAP] Page {page_num}, Element {rendered_count} rendered: "
                       f"type={element.get('type')}, element_y={element_y:.1f}, "
                       f"element_bottom={element_bottom:.1f}, "
                       f"current_y: {current_y_before:.1f} -> {current_y:.1f}, "
                       f"gap_applied={abs(current_y_before - element_y):.1f}")
            
            # CRITICAL: After rendering, check if this element completed and if next sequential element can start
            # If so, add it to current page_elements so it can render on same page (reducing gap)
            # This applies to both tables (checking for completion) and all elements (checking next in Y-order)
            element_completed = False
            current_element_y = element.get('y', 0)
            
            # For tables, check if they completed
            # CRITICAL: A table is complete only when:
            # 1. All rows are rendered (all_rows_rendered = True)
            # 2. Final rows are rendered (if they exist) (final_rows_rendered = True)
            # This ensures the next element positions correctly after final rows
            if element.get('type') in ['billContentTable', 'contentDetailTable']:
                table_config = element.get('config')
                if element.get('type') == 'billContentTable':
                    table_key = f"billContentTable_{table_config.get('x', 0)}_{table_config.get('y', 0)}"
                else:
                    content_name = element.get('content_name')
                    table_key = f"contentDetailTable_{content_name}_{table_config.get('x', 0)}_{table_config.get('y', 0)}"
                
                if table_key in table_rendering_state:
                    state = table_rendering_state[table_key]
                    all_rows_rendered = state.get('all_rows_rendered', False)
                    final_rows = table_config.get('finalRows', [])
                    final_rows_rendered = state.get('final_rows_rendered', False)
                    
                    # Table is complete if:
                    # - All rows are rendered AND
                    # - Either no final rows exist OR final rows are already rendered
                    # This ensures next element positions after final rows are confirmed rendered
                    element_completed = all_rows_rendered and (not final_rows or final_rows_rendered)
            else:
                # Fields always complete after rendering (they render once)
                element_completed = True
            
            if element_completed:
                # Element completed - find the NEXT sequential element (field or table) in Y-order that can now render
                # CRITICAL: Must find the element that comes AFTER this one in Y-order (larger Y value)
                # In "from top" coordinates: Y increases downward, so larger Y = further down = later in sequence
                # ORDER: billContentTable (y:0) -> billContent fields (y:3, y:4) -> contentDetailsTable (y:49)
                next_sequential_element = None
                smallest_next_y = float('inf')  # Track smallest Y value for next element
                
                for next_element in bill_content_elements:
                    # Check ALL elements (fields and tables) - not just tables
                    # ORDER IS CRITICAL: billContentTable -> billContent fields -> contentDetailsTable
                    next_element_y = next_element.get('y', 0)
                    
                    # CRITICAL: Only consider elements that come AFTER current element in Y-order
                    # In "from top" coordinates, larger Y = further down = later in sequence
                    if next_element_y <= current_element_y:
                        continue  # This element comes before or is the same as current - skip
                    
                    # Check if this next element is already on current page OR any previous page
                    # CRITICAL: Fields should only render ONCE across all pages (they're not like tables that can continue)
                    # For fields, check config dict equality (x, y, bind, etc.) to catch duplicates
                    # For tables, check type and config (table keys)
                    next_already_on_page = False
                    # First check current page elements
                    for e in page_elements:
                        existing_element = e.get('element')
                        if existing_element is None:
                            continue
                        
                        # Check object identity first (fastest)
                        if id(existing_element) == id(next_element):
                            next_already_on_page = True
                            break
                        
                        # Check type match
                        if existing_element.get('type') != next_element['type']:
                            continue
                        
                        # For fields: check config dict equality (all keys match)
                        if next_element['type'] == 'field':
                            existing_config = existing_element.get('config', {})
                            next_config = next_element.get('config', {})
                            # Compare key fields that uniquely identify a field
                            if (existing_config.get('x') == next_config.get('x') and
                                existing_config.get('y') == next_config.get('y') and
                                existing_config.get('bind') == next_config.get('bind') and
                                existing_config.get('label') == next_config.get('label')):
                                next_already_on_page = True
                                break
                        # For tables: check config equality (table keys match)
                        elif next_element['type'] in ['billContentTable', 'contentDetailTable']:
                            existing_config = existing_element.get('config', {})
                            next_config = next_element.get('config', {})
                            # Check table position and content name
                            if (existing_config.get('x') == next_config.get('x') and
                                existing_config.get('y') == next_config.get('y')):
                                if next_element['type'] == 'contentDetailTable':
                                    # Also check content_name for contentDetailTable
                                    if (existing_element.get('content_name') == next_element.get('content_name')):
                                        next_already_on_page = True
                                        break
                                else:
                                    # billContentTable - just check x, y
                                    next_already_on_page = True
                                    break
                    
                    # CRITICAL: For fields, check if already assigned to previous pages
                    # BUT: If a field was assigned to a previous page but filtered out (not rendered),
                    # it should be eligible to be added to current page when table completes
                    # So we only skip if field is on current page (already checked above)
                    # Fields on previous pages that were filtered out can be re-added here
                    # This allows fields to "move" to current page when they become eligible
                    
                    if next_already_on_page:
                        continue  # Already on page or already assigned to another page, skip
                    
                    # Check if this next element can now render
                    # For fields: can always render (no dependencies)
                    # For tables: must check if all previous tables (by Y-order) are complete
                    next_can_render = True
                    if next_element['type'] in ['billContentTable', 'contentDetailTable']:
                        # Table element - check if all previous tables are complete
                        for prev_element in bill_content_elements:
                            if prev_element['type'] not in ['billContentTable', 'contentDetailTable']:
                                continue  # Skip non-table elements when checking table dependencies
                            
                            prev_element_y = prev_element.get('y', 0)
                            if prev_element_y >= next_element_y:
                                break  # Reached or passed next element
                            
                            # Check if previous table is complete
                            prev_table_config = prev_element['config']
                            if prev_element['type'] == 'billContentTable':
                                prev_table_key = f"billContentTable_{prev_table_config.get('x', 0)}_{prev_table_config.get('y', 0)}"
                            else:
                                prev_content_name = prev_element.get('content_name')
                                prev_table_key = f"contentDetailTable_{prev_content_name}_{prev_table_config.get('x', 0)}_{prev_table_config.get('y', 0)}"
                            
                            if prev_table_key in table_rendering_state:
                                if not table_rendering_state[prev_table_key].get('all_rows_rendered', False):
                                    next_can_render = False
                                    break
                    
                    if next_can_render and next_element_y < smallest_next_y:
                        # Found a candidate - use the one with smallest Y (closest to current)
                        next_sequential_element = next_element
                        smallest_next_y = next_element_y
                
                if next_sequential_element:
                    # Next element can start - add it to current page
                    logger.debug(f"[FIELD] Page {page_num}: Found next sequential element after table completion: "
                               f"type={next_sequential_element.get('type')}, "
                               f"y={next_sequential_element.get('y', 0)}, "
                               f"current_element_y={current_element_y}")
                    # CRITICAL: Check if element is already on this page to prevent duplicate rendering
                    # This prevents tables from being added both dynamically and as continuations
                    # CRITICAL: For fields, check config dict equality (x, y, bind, etc.) to catch duplicates
                    # For tables, check type and config (table keys)
                    element_already_on_page = False
                    for e in page_elements:
                        existing_element = e.get('element')
                        if existing_element is None:
                            continue
                        
                        # Check object identity first (fastest)
                        if id(existing_element) == id(next_sequential_element):
                            element_already_on_page = True
                            break
                        
                        # Check type match
                        if existing_element.get('type') != next_sequential_element['type']:
                            continue
                        
                        # For fields: check config dict equality (all keys match)
                        if next_sequential_element['type'] == 'field':
                            existing_config = existing_element.get('config', {})
                            next_config = next_sequential_element.get('config', {})
                            # Compare key fields that uniquely identify a field
                            if (existing_config.get('x') == next_config.get('x') and
                                existing_config.get('y') == next_config.get('y') and
                                existing_config.get('bind') == next_config.get('bind') and
                                existing_config.get('label') == next_config.get('label')):
                                element_already_on_page = True
                                break
                        # For tables: check config equality (table keys match)
                        elif next_sequential_element['type'] in ['billContentTable', 'contentDetailTable']:
                            existing_config = existing_element.get('config', {})
                            next_config = next_sequential_element.get('config', {})
                            # Check table position and content name
                            if (existing_config.get('x') == next_config.get('x') and
                                existing_config.get('y') == next_config.get('y')):
                                if next_sequential_element['type'] == 'contentDetailTable':
                                    # Also check content_name for contentDetailTable
                                    if (existing_element.get('content_name') == next_sequential_element.get('content_name')):
                                        element_already_on_page = True
                                        break
                                else:
                                    # billContentTable - just check x, y
                                    element_already_on_page = True
                                    break
                    
                    if not element_already_on_page:
                        # CRITICAL: Calculate Y position accounting for skipped elements
                        # If there are elements between current_element and next_sequential_element that were
                        # already rendered on previous pages, we need to account for their height
                        adjusted_current_y = current_y
                        
                        # Check for skipped elements between current and next (in Y-order)
                        current_element_y = element.get('y', 0)
                        next_element_y = next_sequential_element.get('y', 0)
                        
                        # Find all elements between current and next that were already rendered
                        for skipped_element in bill_content_elements:
                            skipped_y = skipped_element.get('y', 0)
                            # Skip if not between current and next
                            if skipped_y <= current_element_y or skipped_y >= next_element_y:
                                continue
                            
                            # Check if this element was already rendered on a previous page
                            skipped_already_rendered = False
                            if skipped_element['type'] == 'field':
                                # Check if field was rendered on any previous page
                                for page_num_check, page_els in pagination_info.get('pages', {}).items():
                                    if page_num_check >= page_num:
                                        continue  # Only check previous pages
                                    for e_check in page_els:
                                        existing_element_check = e_check.get('element')
                                        if existing_element_check is None:
                                            continue
                                        if existing_element_check.get('type') != 'field':
                                            continue
                                        existing_config_check = existing_element_check.get('config', {})
                                        skipped_config = skipped_element.get('config', {})
                                        if (existing_config_check.get('x') == skipped_config.get('x') and
                                            existing_config_check.get('y') == skipped_config.get('y') and
                                            existing_config_check.get('bind') == skipped_config.get('bind') and
                                            existing_config_check.get('label') == skipped_config.get('label')):
                                            skipped_already_rendered = True
                                            break
                                    if skipped_already_rendered:
                                        break
                            
                            # If element was already rendered, account for its height
                            if skipped_already_rendered:
                                # Estimate height of skipped element
                                skipped_height = self._estimate_element_height(skipped_element, template_config, data)
                                # Adjust current_y to account for skipped element + gap
                                adjusted_current_y = adjusted_current_y - skipped_height - self.default_gap
                        
                        # CRITICAL: Use flow-based position (adjusted_current_y - gap) to ensure gap is accounted for
                        # The configured Y is ignored for sequential elements - gap must be consistent
                        next_element_y_from_top = adjusted_current_y - self.default_gap
                        element_info = {
                            'element': next_sequential_element,
                            'y': next_sequential_element.get('y', 0)  # Store configured Y for reference, but flow position will be used
                        }
                        # For tables, add start_index and end_index
                        if next_sequential_element['type'] in ['billContentTable', 'contentDetailTable']:
                            element_info['start_index'] = 0
                            element_info['end_index'] = None
                        page_elements.append(element_info)
                        logger.debug(f"Added next sequential element to page {page_num} after previous element completion: "
                                   f"type={next_sequential_element.get('type')}, content_name={next_sequential_element.get('content_name')}, "
                                   f"current_y={current_y:.1f}, gap={self.default_gap}, "
                                   f"next_element_y={next_element_y_from_top:.1f}, "
                                   f"current_element_y={current_element_y}, next_element_y={next_sequential_element.get('y', 0)}")
                    else:
                        # Skipping duplicate element - skip logging
                        pass
            
            # Increment rendered count
            rendered_count += 1
        
        return content_bottom
    
    def _render_content_element(
        self, c: canvas.Canvas, element: Dict[str, Any], element_info: Dict[str, Any],
        element_y: float, min_content_y: float, page_num: int,
        page_context: Dict[str, Any], data: Dict[str, Any],
        template_config: Dict[str, Any], table_rendering_state: Dict[str, Any]
    ) -> float:
        """
        Render a single content element (field or table).
        
        FINAL ROW RENDERING RULES (MANDATORY):
        ======================================
        RULE 1: Final Rows Are Table-Level, Not Page-Level
        - Final rows render only when: last_index >= total_items - 1
        - Must NOT depend on: start_index, end_index, page_num
        
        RULE 2: Final Rows Render Only Once
        - Track state with: final_rows_rendered flag (initial: False)
        - Set to True immediately after rendering
        - Never repeat on previous or intermediate pages
        
        RULE 3: Page Space Validation for Final Rows
        - Calculate total height required before rendering
        - If space insufficient, should create new page (currently logs warning)
        - Final rows must never be split across pages
        
        RULE 4: Final Rows Must Ignore Pagination Boundaries
        - Do not belong to page slice or row range
        - Render based on completion state only
        
        RULE 5: Multiple Tables Have Independent Final Row States
        - Each table tracks: last_index, total_items, final_rows_rendered
        - State is not shared across tables
        
        RULE 6: ContentDetail Tables Follow Same Rules
        - Final rows evaluated per content name (e.g., payment, tax, discount)
        - Independent state per content name
        
        Returns the bottom Y position of the rendered element.
        """
        element_type = element['type']
        
        if element_type == 'field':
            field = element['config']
            x = field.get('x', 0)
            render_field(c, field, data, x, element_y, page_context)
            font_size = field.get('fontSize', 12)
            element_height = font_size * 1.5
            return element_y - element_height
        
        elif element_type == 'billContentTable':
            table_config = element['config']
            items = element.get('data', [])
            
            # RULE 5: Multiple Tables Have Independent Final Row States
            # Initialize state if not exists (MANDATORY: independent state per table)
            table_key = f"billContentTable_{table_config.get('x', 0)}_{table_config.get('y', 0)}"
            if table_key not in table_rendering_state:
                table_rendering_state[table_key] = {
                    'last_index': -1,
                    'final_rows_rendered': False  # MANDATORY: initial state flag (RULE 2)
                }
            
            # RULE 5 & 6: Data Cursor Must Advance Correctly Across Pages
            # CRITICAL FIX: Always use row-by-row accumulation, never pre-calculated slices
            # Get pagination info for this table (may be ignored when continuing)
            start_index = element_info.get('start_index', 0)
            end_index = element_info.get('end_index', None)  # Default to None - let render_table decide
            
            # RULE 5: last_index Must Track Data Cursor, Not Page Cursor
            # RULE 6: Pagination Must Never Stop Data Consumption
            # CRITICAL FIX: Check for continuation - handle both normal continuation and zero-row scenarios
            current_last_index = table_rendering_state[table_key].get('last_index', -1)
            total_items = len(items) if items else 0
            
            # Continuation needed if:
            # 1. last_index >= 0 (normal continuation - some rows rendered previously)
            # 2. OR last_index == -1 but this is not the first attempt (zero rows rendered previously)
            #    We detect this by checking if start_index from pagination is > 0
            needs_continuation = (
                current_last_index >= 0 or
                (current_last_index == -1 and element_info.get('start_index', 0) > 0)
            )
            
            if needs_continuation:
                # RULE 5: Continue from where we left off on previous page
                if current_last_index >= 0:
                    # Normal continuation: advance from last rendered row
                    start_index = current_last_index + 1
                else:
                    # Zero-row scenario: retry from start_index (don't advance)
                    start_index = element_info.get('start_index', 0)
                    logger.debug(f"Table zero-row continuation: table_key={table_key}, "
                               f"retrying from start_index={start_index}")
                
                # RULE 6: Always use None for end_index - let render_table handle row-by-row accumulation
                # This ensures data iteration continues using ACTUAL heights, not estimates
                end_index = None
                logger.debug(f"Table continuing across pages: table_key={table_key}, "
                           f"start_index={start_index} (from last_index={current_last_index}), "
                           f"end_index=None (row-by-row accumulation)")
            else:
                # First page: also use None for end_index to enable row-by-row accumulation
                # render_table will use ACTUAL heights and stop at min_content_y
                end_index = None
                logger.debug(f"Table first page: table_key={table_key}, "
                           f"start_index={start_index}, end_index=None (row-by-row accumulation)")
            
            x = table_config.get('x', 0)
            # RULE 6: For continuation across pages, pass None for end_index to let render_table handle pagination
            # render_table stops when min_content_y is hit OR when data is exhausted
            # Returns last_rendered_index which is the last data index consumed (data cursor position)
            rows_rendered, last_index, actual_height = render_table(
                c, table_config, items, x, element_y,
                page_num, page_context.get('totalPages', 1), True,
                start_index, end_index,
                min_content_y
            )
            
            # CRITICAL FIX 1: Enforce Minimum One-Row-Per-Page Rule
            # If a table has remaining data but zero rows rendered, we have a problem
            # This means no rows fit on current page - we need to ensure continuation
            total_items = len(items) if items else 0
            if rows_rendered == 0 and start_index < total_items:
                # Zero rows rendered but data remains - this violates minimum-row guarantee
                logger.warning(f"CRITICAL: Table {table_key} rendered 0 rows but has remaining data! "
                            f"start_index={start_index}, total_items={total_items}, "
                            f"min_content_y={min_content_y}, element_y={element_y}. "
                            f"This table MUST continue on next page.")
                # Ensure continuation by keeping last_index at -1 (or current value) so table retries
                # Don't advance cursor - same row will be retried on next page
                if last_index < start_index:
                    # render_table returned start_index - 1 (no rows rendered)
                    # Keep last_index unchanged so continuation logic triggers
                    last_index = table_rendering_state[table_key].get('last_index', -1)
                    logger.debug(f"Zero rows rendered - keeping last_index={last_index} to force continuation")
            
            # RULE 2 & 5: last_index Must Be Monotonic Per Table
            # Update last_index only if it increases (never reset, never decrease)
            # This ensures data cursor advances correctly across page breaks
            current_last_index = table_rendering_state[table_key].get('last_index', -1)
            if last_index > current_last_index:
                table_rendering_state[table_key]['last_index'] = last_index
                logger.debug(f"Data cursor advanced: table_key={table_key}, "
                           f"last_index: {current_last_index} -> {last_index}, "
                           f"rows_rendered={rows_rendered} (informational)")
            elif last_index == current_last_index:
                # CRITICAL: If last_index unchanged and we have remaining data, ensure continuation
                if rows_rendered == 0 and start_index < total_items:
                    logger.warning(f"Table {table_key} cursor stalled: last_index={last_index}, "
                                f"rows_rendered=0, start_index={start_index}, total_items={total_items}. "
                                f"Continuation required on next page.")
                logger.debug(f"Data cursor unchanged: table_key={table_key}, "
                           f"last_index={last_index}, rows_rendered={rows_rendered} (informational)")
            else:
                logger.warning(f"Data cursor regression detected: table_key={table_key}, "
                            f"last_index: {current_last_index} -> {last_index} (should never decrease!)")
            
            # RULE 1: total_items Must Equal the Actual Data Length
            # Store table config and items for completion detection
            # Ensure items comes from element.get('data', []) which is set in _extract_bill_content_elements
            if 'table_config' not in table_rendering_state[table_key]:
                table_rendering_state[table_key]['table_config'] = table_config
                # RULE 1: Store actual data reference - items must come from element.get('data', [])
                table_rendering_state[table_key]['items'] = items
                # RULE 1: total_items must equal actual data length
                actual_data_length = len(items) if items else 0
                table_rendering_state[table_key]['total_items'] = actual_data_length
                table_rendering_state[table_key]['all_rows_rendered'] = False
                table_rendering_state[table_key]['final_rows_rendered'] = False
                logger.debug(f"Table state initialized: table_key={table_key}, total_items={actual_data_length}, "
                           f"data_source_length={actual_data_length}")
            else:
                # RULE 1: Validate total_items matches actual data length on subsequent calls
                stored_total_items = table_rendering_state[table_key]['total_items']
                actual_data_length = len(items) if items else 0
                if stored_total_items != actual_data_length:
                    logger.warning(f"Table {table_key}: total_items mismatch! stored={stored_total_items}, "
                                f"actual={actual_data_length}. Updating to actual.")
                    table_rendering_state[table_key]['total_items'] = actual_data_length
                    table_rendering_state[table_key]['items'] = items
            
            # RULE 3 & 4: Completion Detection Must Be Decoupled from Page Rendering
            # RULE 4: Final Rows Must Be Triggered by Completion Event, Not Index Math
            # RULE 3: rows_rendered Is Informational Only - must NOT be used for completion detection
            # Completion must be driven only by data cursor state (data exhaustion)
            total_items = table_rendering_state[table_key]['total_items']
            current_last_index = table_rendering_state[table_key]['last_index']
            
            # RULE 4: Completion Must Be Detected by Data Exhaustion
            # A table is complete when: The engine attempts to fetch the next row AND no row exists
            # This condition must immediately trigger: all_rows_rendered = True
            
            # Data exhausted if:
            # 1. We reached the last item (last_index == total_items - 1) - data cursor reached end
            # 2. OR we tried to start beyond the end (start_index >= total_items) - attempted fetch beyond end
            # 3. OR table is empty (total_items == 0)
            # RULE 3: Do NOT check rows_rendered - it's informational only, resets per page
            reached_last_item = (current_last_index >= total_items - 1) and (current_last_index >= 0) if total_items > 0 else False
            attempted_beyond_end = (start_index >= total_items) if total_items > 0 else False
            
            # RULE 4: Data exhaustion = reached end OR attempted beyond end OR empty table
            data_exhausted = reached_last_item or attempted_beyond_end or (total_items == 0)
            
            if data_exhausted and not table_rendering_state[table_key]['all_rows_rendered']:
                # RULE 4: Set completion state immediately when data exhaustion is detected
                table_rendering_state[table_key]['all_rows_rendered'] = True
                logger.debug(f"Table data exhaustion detected: table_key={table_key}, "
                           f"last_index={current_last_index}, total_items={total_items}, "
                           f"reached_last_item={reached_last_item}, attempted_beyond_end={attempted_beyond_end}, "
                           f"start_index={start_index}, rows_rendered={rows_rendered} (informational only)")
            
            # RULE 6: Final Rows Must Be Checked After Dynamic Content Loop Ends
            # Check final rows ONLY after completion is detected AND we're on the page where table ends
            # We render final rows immediately after detecting completion on the current page
            table_bottom_y = element_y - actual_height
            final_rows = table_config.get('finalRows', [])
            all_rows_rendered = table_rendering_state[table_key].get('all_rows_rendered', False)
            final_rows_already_rendered = table_rendering_state[table_key].get('final_rows_rendered', False)
            
            logger.debug(f"Table rendering state: table_key={table_key}, last_index={current_last_index}, "
                        f"total_items={total_items}, all_rows_rendered={all_rows_rendered}, "
                        f"final_rows={len(final_rows) if final_rows else 0}, "
                        f"final_rows_already_rendered={final_rows_already_rendered}, "
                        f"start_index={start_index}, rows_rendered={rows_rendered} (informational only)")
            
            # RULE 1 & 2: Render final rows ONLY if:
            # 1. Final rows exist
            # 2. Table is complete (all_rows_rendered = True) - RULE 3 & 4
            # 3. Final rows haven't been rendered yet (prevent duplicates) - RULE 2
            if final_rows and all_rows_rendered and not final_rows_already_rendered:
                # RULE 3: Page Space Validation for Final Rows
                columns = table_config.get('columns', [])
                visible_columns = [col for col in columns if col.get('visible', True)]
                font_size = table_config.get('fontSize', 12)
                cell_padding = table_config.get('cellPadding', 10)
                border_width = table_config.get('borderWidth', 1)
                border_color = table_config.get('borderColor', '#dddddd')
                
                final_rows_height = self._estimate_final_rows_height(table_config, data)
                available_space = table_bottom_y - min_content_y if min_content_y else table_bottom_y
                
                if available_space < final_rows_height:
                    logger.warning(f"Final rows height ({final_rows_height}) exceeds available space ({available_space}) "
                                 f"for table {table_key}. Rendering may overlap.")
                
                # RULE 4: Final rows ignore pagination boundaries - render based on completion only
                final_rows_bottom = self._render_final_rows(
                    c, table_config, final_rows, columns, visible_columns,
                    items, data, x, table_bottom_y, font_size, cell_padding,
                    border_width, border_color, min_content_y
                )
                actual_height = element_y - final_rows_bottom
                
                # RULE 2: Mark that final rows have been rendered (set flag immediately)
                table_rendering_state[table_key]['final_rows_rendered'] = True
                logger.debug(f"Final rows rendered for table {table_key} (TABLE-LEVEL, rendered once)")
            
            return element_y - actual_height
        
        elif element_type == 'contentDetailTable':
            table_config = element['config']
            cd_data = element.get('data', [])
            content_name = element.get('content_name')
            
            # RULE 5 & 6 & 7: ContentDetail Tables Follow Same Rules - Independent State Per Content Name
            # Each content name (e.g., payment, tax, discount) has independent state
            content_table_key = f"contentDetailTable_{content_name}_{table_config.get('x', 0)}_{table_config.get('y', 0)}"
            
            # RULE 1 & 7: total_items Must Equal the Actual Data Length
            # Initialize state if not exists (MANDATORY: independent state per content name)
            if content_table_key not in table_rendering_state:
                # RULE 7: contentDetailsTables Must Use Their Own Data Length
                # total_items must equal the length of that content's dataset (cd_data)
                actual_data_length = len(cd_data) if cd_data else 0
                table_rendering_state[content_table_key] = {
                    'last_index': -1,
                    'final_rows_rendered': False,  # MANDATORY: initial state flag
                    'all_rows_rendered': False,  # RULE 1: Terminal state
                    'content_name': content_name,  # Track content name for debugging
                    'table_config': table_config,
                    'items': cd_data,  # RULE 7: Store actual data for this content name
                    'total_items': actual_data_length  # RULE 7: Must be from this content's dataset
                }
                logger.debug(f"ContentDetail table state initialized: content_name={content_name}, "
                           f"table_key={content_table_key}, total_items={actual_data_length}, "
                           f"data_source_length={actual_data_length}")
            else:
                # RULE 1 & 7: Validate total_items matches actual data length on subsequent calls
                stored_total_items = table_rendering_state[content_table_key]['total_items']
                actual_data_length = len(cd_data) if cd_data else 0
                if stored_total_items != actual_data_length:
                    logger.warning(f"ContentDetail table {content_name}: total_items mismatch! "
                                f"stored={stored_total_items}, actual={actual_data_length}. Updating to actual.")
                    table_rendering_state[content_table_key]['total_items'] = actual_data_length
                    table_rendering_state[content_table_key]['items'] = cd_data
            
            # RULE 5 & 6: Data Cursor Must Advance Correctly Across Pages
            # CRITICAL FIX: Always use row-by-row accumulation, never pre-calculated slices
            # For contentDetail tables, check if we're continuing from previous page
            current_last_index = table_rendering_state[content_table_key].get('last_index', -1)
            total_items = table_rendering_state[content_table_key].get('total_items', len(cd_data) if cd_data else 0)
            
            # CRITICAL FIX: Check for continuation - handle both normal continuation and zero-row scenarios
            # Continuation needed if:
            # 1. last_index >= 0 (normal continuation - some rows rendered previously)
            # 2. OR last_index == -1 but we have data and this is not first page (zero rows rendered previously)
            needs_continuation = (
                current_last_index >= 0 or
                (current_last_index == -1 and total_items > 0 and page_num > 1)
            )
            
            if needs_continuation:
                if current_last_index >= 0:
                    # Normal continuation: advance from last rendered row
                    start_index = current_last_index + 1
                else:
                    # Zero-row scenario: retry from start (don't advance)
                    start_index = 0
                    logger.debug(f"ContentDetail table zero-row continuation: content_name={content_name}, "
                               f"retrying from start_index={start_index}")
            else:
                # First page: start from beginning
                start_index = 0
            
            # RULE 6: Always use None for end_index - let render_table handle row-by-row accumulation
            # This ensures data iteration continues using ACTUAL heights, not estimates
            end_index = None
            
            x = table_config.get('x', 0)
            # RULE 6: Pass None for end_index to let render_table handle pagination
            # render_table stops when min_content_y is hit OR when data is exhausted
            # Uses ACTUAL row heights (from Paragraph.wrap()) for row-by-row accumulation
            rows_rendered, last_index, actual_height = render_table(
                c, table_config, cd_data, x, element_y,
                page_num, page_context.get('totalPages', 1), True,
                start_index, end_index, min_content_y
            )
            
            logger.debug(f"ContentDetail table rendering: content_name={content_name}, "
                        f"start_index={start_index}, end_index={end_index} (row-by-row accumulation)")
            
            # CRITICAL FIX 1: Enforce Minimum One-Row-Per-Page Rule (ContentDetail tables)
            # If a table has remaining data but zero rows rendered, we have a problem
            total_items = table_rendering_state[content_table_key].get('total_items', len(cd_data) if cd_data else 0)
            if rows_rendered == 0 and start_index < total_items:
                # Zero rows rendered but data remains - this violates minimum-row guarantee
                logger.warning(f"CRITICAL: ContentDetail table {content_name} rendered 0 rows but has remaining data! "
                            f"start_index={start_index}, total_items={total_items}, "
                            f"min_content_y={min_content_y}, element_y={element_y}. "
                            f"This table MUST continue on next page.")
                # Ensure continuation by keeping last_index at -1 (or current value) so table retries
                if last_index < start_index:
                    # render_table returned start_index - 1 (no rows rendered)
                    # Keep last_index unchanged so continuation logic triggers
                    last_index = table_rendering_state[content_table_key].get('last_index', -1)
                    logger.debug(f"Zero rows rendered - keeping last_index={last_index} to force continuation")
            
            # RULE 2 & 5: last_index Must Be Monotonic Per Table
            # Update last_index only if it increases (never reset, never decrease)
            # This ensures data cursor advances correctly across page breaks
            if last_index > current_last_index:
                table_rendering_state[content_table_key]['last_index'] = last_index
                logger.debug(f"ContentDetail data cursor advanced: content_name={content_name}, "
                           f"last_index: {current_last_index} -> {last_index}, "
                           f"rows_rendered={rows_rendered} (informational)")
            elif last_index == current_last_index:
                # CRITICAL: If last_index unchanged and we have remaining data, ensure continuation
                if rows_rendered == 0 and start_index < total_items:
                    logger.warning(f"ContentDetail table {content_name} cursor stalled: last_index={last_index}, "
                                f"rows_rendered=0, start_index={start_index}, total_items={total_items}. "
                                f"Continuation required on next page.")
                logger.debug(f"ContentDetail data cursor unchanged: content_name={content_name}, "
                           f"last_index={last_index}, rows_rendered={rows_rendered} (informational)")
            else:
                logger.warning(f"ContentDetail data cursor regression detected: content_name={content_name}, "
                            f"last_index: {current_last_index} -> {last_index} (should never decrease!)")
            
            # RULE 3 & 4: Completion Detection Must Be Decoupled from Page Rendering
            # RULE 7: ContentDetail Tables Must Follow the Same Completion Contract
            # RULE 3: rows_rendered Is Informational Only - must NOT be used for completion detection
            # Completion must be driven only by data cursor state (data exhaustion)
            total_items = table_rendering_state[content_table_key]['total_items']
            current_last_index = table_rendering_state[content_table_key]['last_index']
            
            # RULE 4: Completion Must Be Detected by Data Exhaustion
            # A table is complete when: The engine attempts to fetch the next row AND no row exists
            # For contentDetail tables, we always start at 0, so check if we've reached the end
            
            # RULE 7: Data exhausted if:
            # 1. We reached the last item (last_index == total_items - 1) - data cursor reached end
            # 2. OR table is empty (total_items == 0)
            # RULE 3: Do NOT check rows_rendered - it's informational only, resets per page
            reached_last_item = (current_last_index >= total_items - 1) and (current_last_index >= 0) if total_items > 0 else False
            
            # RULE 4 & 7: Data exhaustion = reached end OR empty table
            data_exhausted = reached_last_item or (total_items == 0)
            
            if data_exhausted and not table_rendering_state[content_table_key]['all_rows_rendered']:
                # RULE 4: Set completion state immediately when data exhaustion is detected
                table_rendering_state[content_table_key]['all_rows_rendered'] = True
                logger.debug(f"ContentDetail table data exhaustion detected: content_name={content_name}, "
                           f"table_key={content_table_key}, last_index={current_last_index}, "
                           f"total_items={total_items}, reached_last_item={reached_last_item}, "
                           f"rows_rendered={rows_rendered} (informational only)")
            
            # RULE 6: Final Rows Must Be Checked After Dynamic Content Loop Ends
            table_bottom_y = element_y - actual_height
            final_rows = table_config.get('finalRows', [])
            all_rows_rendered = table_rendering_state[content_table_key].get('all_rows_rendered', False)
            final_rows_already_rendered = table_rendering_state[content_table_key].get('final_rows_rendered', False)
            
            logger.debug(f"ContentDetail table rendering state: content_name={content_name}, "
                        f"table_key={content_table_key}, last_index={current_last_index}, "
                        f"total_items={total_items}, all_rows_rendered={all_rows_rendered}, "
                        f"final_rows={len(final_rows) if final_rows else 0}, "
                        f"final_rows_already_rendered={final_rows_already_rendered}, "
                        f"rows_rendered={rows_rendered} (informational only)")
            
            # RULE 1 & 2 & 7: Render final rows ONLY if:
            # 1. Final rows exist
            # 2. Table is complete (all_rows_rendered = True) - RULE 3 & 4 & 7
            # 3. Final rows haven't been rendered yet (prevent duplicates) - RULE 2
            if final_rows and all_rows_rendered and not final_rows_already_rendered:
                # RULE 3: Page Space Validation for Final Rows
                columns = table_config.get('columns', [])
                visible_columns = [col for col in columns if col.get('visible', True)]
                font_size = table_config.get('fontSize', 12)
                cell_padding = table_config.get('cellPadding', 10)
                border_width = table_config.get('borderWidth', 1)
                border_color = table_config.get('borderColor', '#dddddd')
                
                final_rows_height = self._estimate_final_rows_height(table_config, data)
                available_space = table_bottom_y - min_content_y if min_content_y else table_bottom_y
                
                if available_space < final_rows_height:
                    logger.warning(f"Final rows height ({final_rows_height}) exceeds available space ({available_space}) "
                                 f"for contentDetail table {content_name}. Rendering may overlap.")
                
                # RULE 4: Final rows ignore pagination boundaries - render based on completion only
                final_rows_bottom = self._render_final_rows(
                    c, table_config, final_rows, columns, visible_columns,
                    cd_data, data, x, table_bottom_y, font_size, cell_padding,
                    border_width, border_color, min_content_y
                )
                actual_height = element_y - final_rows_bottom
                
                # RULE 2: Mark that final rows have been rendered (set flag immediately)
                table_rendering_state[content_table_key]['final_rows_rendered'] = True
                logger.debug(f"Final rows rendered for contentDetail table {content_name} (TABLE-LEVEL, rendered once)")
            
            return element_y - actual_height
        
        else:
            return element_y - 20  # Default height
    
    def _render_bill_footer(
        self, c: canvas.Canvas, template_config: Dict[str, Any], data: Dict[str, Any],
        page_context: Dict[str, Any], footer_top_y: float, footer_height: float
    ) -> None:
        """Render bill footer below content (last page only)."""
        bill_footer_fields = template_config.get('billFooter', [])
        if not bill_footer_fields:
            return
        
        for field in bill_footer_fields:
            if field.get('visible', True):
                x = field.get('x', 0)
                # Field Y is relative to footer top
                y = footer_top_y - field.get('y', 0)
                render_field(c, field, data, x, y, page_context)
    
    def _render_page_footer(
        self, c: canvas.Canvas, template_config: Dict[str, Any], data: Dict[str, Any],
        page_context: Dict[str, Any], footer_top_y: float, footer_height: float
    ) -> None:
        """Render page footer at fixed position (every page)."""
        page_footer_fields = template_config.get('pageFooter', [])
        if not page_footer_fields:
            return
        
        for field in page_footer_fields:
            if field.get('visible', True):
                x = field.get('x', 0)
                # Field Y is relative to footer top
                y = footer_top_y - field.get('y', 0)
                render_field(c, field, data, x, y, page_context)
    
    def _render_final_rows(
        self, c: canvas.Canvas, table_config: Dict[str, Any],
        final_rows: List[Dict[str, Any]], columns: List[Dict[str, Any]],
        visible_columns: List[Dict[str, Any]], all_items: List[Dict[str, Any]],
        data: Dict[str, Any], x: float, current_y: float,
        font_size: float, cell_padding: float, border_width: float,
        border_color: str, min_content_y: float = None
    ) -> float:
        """
        Render final rows at the bottom of a table with calculations.
        
        RULE 3: Final rows must never be split across pages.
        If space is insufficient, final rows should be rendered on a new page.
        
        Args:
            c: Canvas object
            table_config: Table configuration
            final_rows: List of FinalRowConfig
            columns: All columns
            visible_columns: Visible columns only
            all_items: All items in the table (for calculations)
            data: Full data dictionary (for formulas)
            x: X position of table
            current_y: Current Y position (top of final rows area)
            font_size: Font size
            cell_padding: Cell padding
            border_width: Border width
            border_color: Border color
            min_content_y: Minimum Y for content bottom
            
        Returns:
            Bottom Y position after rendering final rows
        """
        if not final_rows:
            return current_y
        
        start_y = current_y
        
        # RULE 3: Calculate total height required for ALL final rows before rendering
        total_final_rows_height = 0
        row_gap = 2  # Gap between final rows
        
        for final_row in final_rows:
            if not final_row.get('visible', True):
                continue
            
            # Estimate row height
            max_cell_height = font_size + (cell_padding * 2) + (border_width * 2) + 2
            for col in visible_columns:
                # Find cell config
                cell_config = None
                cell_col_idx = 0
                for cell_cfg in final_row.get('cells', []):
                    cell_col_span = cell_cfg.get('colSpan', 1)
                    if cell_col_idx < len(visible_columns) and cell_col_idx <= visible_columns.index(col) < cell_col_idx + cell_col_span:
                        cell_config = cell_cfg
                        break
                    cell_col_idx += cell_col_span
                
                if cell_config:
                    cell_font_size = cell_config.get('fontSize', font_size)
                    cell_row_height = cell_font_size + (cell_padding * 2) + (border_width * 2) + 2
                    max_cell_height = max(max_cell_height, cell_row_height)
            
            total_final_rows_height += max_cell_height + row_gap
        
        # Remove last gap
        if total_final_rows_height > 0:
            total_final_rows_height -= row_gap
        
        # RULE 3: Check if final rows fit on current page
        if min_content_y is not None:
            available_space = current_y - min_content_y
            if available_space < total_final_rows_height:
                # RULE 3: Space insufficient - final rows cannot be split
                # Log warning - in a full implementation, this would trigger page break
                logger.warning(f"Final rows total height ({total_final_rows_height}) exceeds available space "
                             f"({available_space}). Final rows may overlap with footer.")
        
        # Render all final rows (RULE 3: must not be split)
        for final_row in final_rows:
            if not final_row.get('visible', True):
                continue
            
            # Calculate cell values for this final row
            cell_values = []
            cell_paragraphs = []
            cell_heights = []
            
            for col_idx, col in enumerate(visible_columns):
                # Find corresponding cell config (handle colSpan)
                cell_config = None
                cell_col_idx = 0
                for cell_cfg in final_row.get('cells', []):
                    cell_col_span = cell_cfg.get('colSpan', 1)
                    if cell_col_idx <= col_idx < cell_col_idx + cell_col_span:
                        cell_config = cell_cfg
                        break
                    cell_col_idx += cell_col_span
                
                if cell_config:
                    # Calculate value
                    cell_value = _calculate_final_row_value(cell_config, all_items, data)
                else:
                    cell_value = ''
                
                cell_values.append(cell_value)
                
                # Create paragraph with cell styling
                cell_font_size = cell_config.get('fontSize', font_size) if cell_config else font_size
                cell_color = cell_config.get('color', '#000000') if cell_config else '#000000'
                cell_align = cell_config.get('align', col.get('align', 'left')) if cell_config else col.get('align', 'left')
                cell_font_weight = cell_config.get('fontWeight', 'normal') if cell_config else 'normal'
                
                font_name = 'Helvetica-Bold' if cell_font_weight == 'bold' else 'Helvetica'
                para = create_cell_paragraph(cell_value, font_name, cell_font_size, cell_color, cell_align)
                cell_paragraphs.append(para)
                
                # Calculate cell height
                col_width = col.get('width', 100)
                cell_height = calculate_cell_height(
                    cell_value, col_width, cell_padding, border_width,
                    font_name, cell_font_size, cell_color, cell_align
                )
                cell_heights.append(cell_height)
            
            # Row height is max of all cell heights
            row_height = max(cell_heights) if cell_heights else (font_size + (cell_padding * 2) + (border_width * 2) + 2)
            
            # RULE 3: Check if row fits (final rows must not be split)
            row_y = current_y - row_height
            if min_content_y is not None and row_y < min_content_y:
                # RULE 3: Row doesn't fit - final rows must not be split
                # Log error and return (in full implementation, would trigger page break)
                logger.error(f"Final row does not fit on current page. Available: {current_y - min_content_y}, "
                           f"Required: {row_height}. Final rows must not be split across pages.")
                return current_y
            
            # Render row background if specified
            bg_color = final_row.get('backgroundColor')
            if bg_color:
                total_width = sum(col.get('width', 100) for col in visible_columns)
                from .pdf_utils import hex_to_rgb
                c.setFillColorRGB(*hex_to_rgb(bg_color))
                c.rect(x, row_y, total_width, row_height, fill=1, stroke=0)
            
            # Render cells
            col_x = x
            for col_idx, col in enumerate(visible_columns):
                col_width = col.get('width', 100)
                para = cell_paragraphs[col_idx]
                cell_config = None
                
                # Find cell config
                cell_col_idx = 0
                for cell_cfg in final_row.get('cells', []):
                    cell_col_span = cell_cfg.get('colSpan', 1)
                    if cell_col_idx <= col_idx < cell_col_idx + cell_col_span:
                        cell_config = cell_cfg
                        break
                    cell_col_idx += cell_col_span
                
                align = cell_config.get('align', col.get('align', 'left')) if cell_config else col.get('align', 'left')
                
                # Draw text
                available_width = col_width - (cell_padding * 2)
                w, para_height = para.wrap(available_width, 10000)
                text_x = col_x + cell_padding
                text_y = row_y + cell_padding
                para.drawOn(c, text_x, text_y)
                
                # Draw border
                from .pdf_utils import hex_to_rgb
                c.setStrokeColorRGB(*hex_to_rgb(border_color))
                c.setLineWidth(border_width)
                
                # Draw top border if specified
                if final_row.get('borderTop', False):
                    c.line(col_x, current_y, col_x + col_width, current_y)
                
                c.rect(col_x, row_y, col_width, row_height, fill=0, stroke=1)
                col_x += col_width
            
            current_y = row_y
        
        return current_y


# Global instance
pdf_engine = PDFEngine()

