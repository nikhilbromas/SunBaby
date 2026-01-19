"""
Dynamic Content Render Engine - Engine 2
Handles rendering of data-driven content that may span multiple pages.

Core Principles:
- Streaming Rendering Model: row-by-row, measure actual heights
- No Pre-calculation: use actual heights only
- Cursor Rules: cursor advances only after rendering, never stalls
- Final Rows Rules: render only after completion, exactly once
"""

from reportlab.pdfgen import canvas
from typing import Dict, Any, List
import logging

from .pdf_field_renderer import render_field, get_field_value
from .pdf_table_renderer import (
    render_table,
    create_cell_paragraph,
    calculate_cell_height
)

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
        
        """
        Formula Evaluation Examples:
        
        1. Simple sum:
           "sum(items.amount)"
           "sum(items.quantity * items.price)"
        
        2. Sum with header reference:
           "sum(items.amount) * header.exchangeRate"
           "sum(items.total) + header.tax"
        
        3. Sum from contentDetails:
           "sum(contentDetails.payments.amount)"
           "sum(contentDetails.discounts.value)"
        
        4. Complex calculations:
           "sum(items.amount) - sum(items.discount) + header.tax"
           "(sum(items.quantity) * header.unitPrice) + header.shipping"
        
        5. Other aggregate functions:
           "avg(items.rating)"
           "count(items)"
           "min(items.price)"
           "max(items.amount)"
        
        6. Combined operations:
           "sum(items.amount) / count(items)"
           "sum(items.total) * (1 + header.taxRate / 100)"
        """
        try:
            import re
            formula_original = formula
            formula_lower = formula.lower()
            
            logger.info(f"Evaluating formula: '{formula_original}'")
            logger.debug(f"  Items count: {len(all_items) if all_items else 0}")
            logger.debug(f"  ContentDetails available: {list(data.get('contentDetails', {}).keys()) if data.get('contentDetails') else 'none'}")
            
            # Helper function to get source data
            def get_source_data(source_path: str):
                """Get data source based on path like 'items', 'contentDetails.payments', etc."""
                if source_path == 'items' or source_path.startswith('items.'):
                    return all_items
                elif source_path.startswith('contentDetails.'):
                    parts = source_path.replace('contentDetails.', '').split('.')
                    content_name = parts[0]
                    content_details = data.get('contentDetails', {})
                    if content_name in content_details:
                        cd_data = content_details[content_name]
                        if isinstance(cd_data, list):
                            return cd_data
                return []
            
            # Helper function to extract field value from item
            def extract_field_value(item: dict, field_path: str) -> float:
                """Extract numeric value from item using field path."""
                if '.' not in field_path:
                    value = item.get(field_path) if isinstance(item, dict) else None
                else:
                    value = get_field_value(field_path, item)
                
                if value is None:
                    return 0.0
                try:
                    return float(value)
                except (ValueError, TypeError):
                    return 0.0
            
            # Helper function to evaluate expression in field path (e.g., "items.quantity * items.price")
            def evaluate_field_expression(item: dict, expr: str) -> float:
                """Evaluate expression like 'items.quantity * items.price' for a single item."""
                try:
                    # Replace field references with actual values
                    expr_eval = expr
                    # Handle items.fieldName pattern
                    field_pattern = r'items\.(\w+)'
                    for match in re.finditer(field_pattern, expr_eval, re.IGNORECASE):
                        field_name = match.group(1)
                        field_value = extract_field_value(item, field_name)
                        expr_eval = expr_eval.replace(match.group(0), str(field_value))
                    # Evaluate the expression
                    return float(eval(expr_eval))
                except:
                    return 0.0
            
            # Process aggregate functions: sum(), avg(), count(), min(), max()
            aggregate_patterns = [
                (r'sum\(([^)]+)\)', 'sum'),
                (r'avg\(([^)]+)\)', 'avg'),
                (r'count\(([^)]+)\)', 'count'),
                (r'min\(([^)]+)\)', 'min'),
                (r'max\(([^)]+)\)', 'max'),
            ]
            
            for pattern, func_name in aggregate_patterns:
                for match in re.finditer(pattern, formula_lower, re.IGNORECASE):
                    expr = match.group(1).strip()
                    original_match = match.group(0)
                    
                    logger.debug(f"Evaluating {func_name.upper()} function: {original_match} (expression: {expr})")
                    
                    # Determine source data
                    source_data = []
                    field_expr = expr
                    source_type = 'unknown'
                    
                    if expr.startswith('items.'):
                        source_data = all_items
                        field_expr = expr.replace('items.', '')
                        source_type = 'items'
                        logger.debug(f"  Source: items, field: {field_expr}, items count: {len(source_data)}")
                    elif expr.startswith('contentDetails.'):
                        # Extract content name and field
                        parts = expr.replace('contentDetails.', '').split('.', 1)
                        content_name = parts[0]
                        field_expr = parts[1] if len(parts) > 1 else ''
                        source_type = f'contentDetails.{content_name}'
                        content_details = data.get('contentDetails', {})
                        if content_name in content_details:
                            cd_data = content_details[content_name]
                            if isinstance(cd_data, list):
                                source_data = cd_data
                                logger.debug(f"  Source: contentDetails.{content_name}, field: {field_expr}, items count: {len(source_data)}")
                            else:
                                logger.warning(f"  contentDetails.{content_name} is not a list, got {type(cd_data)}")
                        else:
                            logger.warning(f"  contentDetails.{content_name} not found in data")
                    elif expr == 'items':
                        # count(items) - just count the items
                        source_data = all_items
                        field_expr = None
                        source_type = 'items'
                        logger.debug(f"  Source: items (count only), items count: {len(source_data)}")
                    else:
                        # Default to items
                        source_data = all_items
                        field_expr = expr.replace('items.', '') if 'items.' in expr else expr
                        source_type = 'items'
                        logger.debug(f"  Source: items (default), field: {field_expr}, items count: {len(source_data)}")
                    
                    if not source_data:
                        logger.warning(f"  No source data found for {func_name}({expr}), replacing with 0")
                        formula = formula.replace(original_match, '0', 1)
                        continue
                    
                    # Calculate aggregate value
                    if func_name == 'count' and field_expr is None:
                        # count(items) - just return count
                        agg_value = len(source_data)
                        logger.info(f"  {func_name.upper()}({expr}) = {agg_value} (count of {len(source_data)} items)")
                    else:
                        # Extract values
                        values = []
                        has_expression = '*' in field_expr or '+' in field_expr or '-' in field_expr or '/' in field_expr
                        
                        if has_expression:
                            logger.debug(f"  Evaluating expression for each item: {expr}")
                        
                        for idx, item in enumerate(source_data):
                            try:
                                if has_expression:
                                    # Expression like "items.quantity * items.price"
                                    value = evaluate_field_expression(item, expr)
                                    if idx < 3:  # Log first 3 items for debugging
                                        logger.debug(f"    Item[{idx}]: {expr} = {value}")
                                else:
                                    # Simple field reference
                                    value = extract_field_value(item, field_expr)
                                    if idx < 3:  # Log first 3 items for debugging
                                        logger.debug(f"    Item[{idx}]: {field_expr} = {value}")
                                
                                if value is not None:
                                    values.append(value)
                            except Exception as e:
                                logger.warning(f"    Error extracting value from item[{idx}]: {str(e)}")
                                continue
                        
                        if not values:
                            agg_value = 0
                            logger.warning(f"  No valid values extracted for {func_name}({expr}), result: 0")
                        elif func_name == 'sum':
                            agg_value = sum(values)
                            logger.info(f"  SUM({expr}) = {agg_value} (sum of {len(values)} values: {values[:5]}{'...' if len(values) > 5 else ''})")
                        elif func_name == 'avg':
                            agg_value = sum(values) / len(values) if values else 0
                            logger.info(f"  AVG({expr}) = {agg_value:.2f} (average of {len(values)} values)")
                        elif func_name == 'count':
                            agg_value = len(values)
                            logger.info(f"  COUNT({expr}) = {agg_value} (count of {len(values)} non-null values)")
                        elif func_name == 'min':
                            agg_value = min(values)
                            logger.info(f"  MIN({expr}) = {agg_value} (minimum of {len(values)} values)")
                        elif func_name == 'max':
                            agg_value = max(values)
                            logger.info(f"  MAX({expr}) = {agg_value} (maximum of {len(values)} values)")
                        else:
                            agg_value = 0
                            logger.warning(f"  Unknown aggregate function: {func_name}")
                    
                    # Replace in formula (use original case)
                    original_formula_match = re.search(pattern, formula, re.IGNORECASE)
                    if original_formula_match:
                        formula_before = formula
                        formula = formula.replace(original_formula_match.group(0), str(agg_value), 1)
                        logger.debug(f"  Formula updated: {formula_before} -> {formula}")
            
            # Replace header references
            header = data.get('header', {})
            if isinstance(header, dict):
                header_replacements = {}
                for key, value in header.items():
                    # Replace both header.key and header.key patterns
                    formula_before = formula
                    formula = re.sub(
                        rf'\bheader\.{re.escape(key)}\b',
                        str(value),
                        formula,
                        flags=re.IGNORECASE
                    )
                    if formula_before != formula:
                        header_replacements[f'header.{key}'] = value
                
                if header_replacements:
                    logger.debug(f"  Header replacements: {header_replacements}")
                    logger.debug(f"  Formula after header replacement: {formula}")
            
            # Evaluate the final numeric expression
            logger.debug(f"  Final formula to evaluate: {formula}")
            result = eval(formula)
            
            if isinstance(result, float) and result.is_integer():
                final_result = str(int(result))
            elif isinstance(result, float):
                final_result = f"{result:.2f}"
            else:
                final_result = str(result)
            
            logger.info(f"Formula evaluation complete: '{formula_original}' = {final_result}")
            return final_result
        except Exception as e:
            logger.warning(f"Error evaluating formula '{formula}': {str(e)}")
            return ''
    
    return ''


class DynamicContentRenderEngine:
    """
    Engine 2: Dynamic Content Render Engine
    
    Purpose: Render data-driven content that may span multiple pages using streaming row-by-row rendering.
    
    Core Principles:
    1. Streaming Rendering Model - Render row-by-row, measure actual heights
    2. No Pre-calculation - Use actual heights only
    3. Cursor Rules - Cursor advances only after rendering, never stalls
    4. Final Rows Rules - Render only after completion, exactly once
    """
    
    def __init__(self, default_gap: float = 2.0):
        """
        Initialize Dynamic Content Render Engine.
        
        Args:
            default_gap: Default vertical gap between dynamic elements (in points)
                        In "from top" coordinates where Y decreases downward:
                        - gap is added by subtracting from current_y
                        - next_element_y = previous_bottom_y - gap
                        - This ensures tables stack with consistent spacing
        """
        self.default_gap = default_gap
    
    def extract_elements(
        self, template_config: Dict[str, Any], data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Extract all bill content elements (fields, tables) in rendering order.
        
        Includes:
        - billContent fields: Text fields from template_config['billContent']
        - billContentTables: Tables from template_config['billContentTables']
        - contentDetailsTables: Tables from template_config['contentDetailsTables']
        
        Returns list of elements with type, config, and initial Y position.
        Elements are sorted by their configured Y position (ascending = top to bottom).
        All elements are managed as dynamic, flow-based content with consistent gaps.
        """
        elements = []
        
        # Bill content fields - extracted from template_config['billContent']
        # These are text fields that render in the dynamic bill content section
        # Example: {"type": "text", "label": "OrderID", "bind": "header.OrderID", "x": 56, "y": 3, "visible": true}
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
    
    def render_element(
        self, c: canvas.Canvas, element: Dict[str, Any],
        element_y: float, min_content_y: float,
        page_num: int, page_context: Dict[str, Any], data: Dict[str, Any],
        template_config: Dict[str, Any], cursor_state: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Render a single content element (field or table).
        
        Supports:
        - 'field': billContent text fields (from template_config['billContent'])
        - 'billContentTable': Main content tables
        - 'contentDetailTable': Content detail tables
        
        Returns:
            Dictionary with:
            - 'bottom_y': float - Bottom Y position of rendered element
            - 'rows_rendered': int - Number of rows rendered (for tables, 0 for fields)
            - 'cursor_updated': bool - Whether cursor state was updated (always False for fields)
            - 'all_rows_rendered': bool - Whether all rows are complete (always True for fields)
        """
        element_type = element['type']
        
        if element_type == 'field':
            # Render billContent field - these are text fields from template_config['billContent']
            # Fields render once per page and don't require cursor state management 
            field = element['config']
            x = field.get('x', 0)
            render_field(c, field, data, x, element_y, page_context)
            font_size = field.get('fontSize', 12)
            element_height = font_size * 1.5
            return {
                'bottom_y': element_y ,
                'rows_rendered': 0,
                'cursor_updated': False,
                'all_rows_rendered': True
            }
        
        elif element_type == 'billContentTable':
            return self._render_bill_content_table(
                c, element, element_y, min_content_y,
                page_num, page_context, data, cursor_state
            )
        
        elif element_type == 'contentDetailTable':
            return self._render_content_detail_table(
                c, element, element_y, min_content_y,
                page_num, page_context, data, cursor_state
            )
        else:
            return {
                'bottom_y': element_y - 20,
                'rows_rendered': 0,
                'cursor_updated': False,
                'all_rows_rendered': True
            }
    
    def _render_bill_content_table(
        self, c: canvas.Canvas, element: Dict[str, Any],
        element_y: float, min_content_y: float,
        page_num: int, page_context: Dict[str, Any], data: Dict[str, Any],
        cursor_state: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Render billContentTable with cursor state management."""
        table_config = element['config']
        items = element.get('data', [])
        
        # Initialize state if not exists
        table_key = f"billContentTable_{table_config.get('x', 0)}_{table_config.get('y', 0)}"
        if table_key not in cursor_state:
            cursor_state[table_key] = {
                'last_index': -1,
                'final_rows_rendered': False,
                'all_rows_rendered': False
            }
        
        # Get current state
        state = cursor_state[table_key]
        current_last_index = state.get('last_index', -1)
        total_items = len(items) if items else 0
        
        # Initialize state on first call
        if 'total_items' not in state:
            state['table_config'] = table_config
            state['items'] = items
            state['total_items'] = total_items
            state['all_rows_rendered'] = False
            state['final_rows_rendered'] = False
        
        # Determine start_index for continuation
        # RULE 6: Header Rendering Rule - Headers render only when start_index == 0 (new page for table)
        if current_last_index >= 0:
            # Continue from last rendered row (start_index > 0 = continuation, no header)
            start_index = current_last_index + 1
        else:
            # First page or retry (start_index == 0 = new page, render header)
            start_index = 0
        
        # Always use None for end_index - let render_table handle row-by-row accumulation
        end_index = None
        
        # Render table
        # Note: repeat_header parameter is kept for backward compatibility but is no longer used.
        # Header rendering is now controlled by start_index == 0 (new page for table).
        x = table_config.get('x', 0)
        rows_rendered, last_index, actual_height = render_table(
            c, table_config, items, x, element_y,
            page_num, page_context.get('totalPages', 1), True,
            start_index, end_index, min_content_y
        )
        
        # Handle zero-row scenario
        if rows_rendered == 0 and start_index < total_items:
            logger.warning(f"CRITICAL: Table {table_key} rendered 0 rows but has remaining data! "
                        f"start_index={start_index}, total_items={total_items}.")
            if last_index < start_index:
                last_index = current_last_index
        
        # Update cursor (monotonic - only increases)
        if last_index > current_last_index:
            state['last_index'] = last_index
        
        # Check completion
        current_last_index = state['last_index']
        
        # CRITICAL: Check completion BEFORE updating last_index to ensure accurate state
        # Completion conditions:
        # 1. We reached the last item (last_index == total_items - 1) - data cursor at end
        # 2. We attempted to start beyond the end (start_index >= total_items) - tried to render past end
        # 3. Table is empty (total_items == 0)
        # 4. All data consumed on previous pages (current_last_index >= total_items - 1)
        reached_last_item = (current_last_index >= total_items - 1) and (current_last_index >= 0) if total_items > 0 else False
        attempted_beyond_end = (start_index >= total_items) if total_items > 0 else False
        data_exhausted = reached_last_item or attempted_beyond_end or (total_items == 0)
        
        if data_exhausted and not state['all_rows_rendered']:
            state['all_rows_rendered'] = True
            logger.debug(f"Table marked complete: table_key={table_key}, "
                        f"last_index={current_last_index}, total_items={total_items}, "
                        f"reached_last_item={reached_last_item}, attempted_beyond_end={attempted_beyond_end}, "
                        f"rows_rendered={rows_rendered}")
        
        # Render final rows if complete
        table_bottom_y = element_y - actual_height
        final_rows = table_config.get('finalRows', [])
        all_rows_rendered = state.get('all_rows_rendered', False)
        final_rows_already_rendered = state.get('final_rows_rendered', False)
        
        if final_rows and all_rows_rendered and not final_rows_already_rendered:
            columns = table_config.get('columns', [])
            visible_columns = [col for col in columns if col.get('visible', True)]
            font_size = table_config.get('fontSize', 12)
            cell_padding = table_config.get('cellPadding', 10)
            border_width = table_config.get('borderWidth', 1)
            border_color = table_config.get('borderColor', '#dddddd')
            
            # CRITICAL: Render final rows at table_bottom_y (bottom of data rows)
            # final_rows_bottom will be the actual bottom after final rows render
            final_rows_bottom = self._render_final_rows(
                c, table_config, final_rows, columns, visible_columns,
                items, data, x, table_bottom_y, font_size, cell_padding,
                border_width, border_color, min_content_y
            )
            # CRITICAL: Recalculate actual_height to include final rows
            # bottom_y will be final_rows_bottom, ensuring next element starts AFTER final rows
            actual_height = element_y - final_rows_bottom
            state['final_rows_rendered'] = True
            logger.debug(f"Final rows rendered for table {table_key}: "
                        f"table_bottom_y={table_bottom_y:.1f}, "
                        f"final_rows_bottom={final_rows_bottom:.1f}, "
                        f"actual_height={actual_height:.1f}, "
                        f"bottom_y will be {element_y - actual_height:.1f}")
        
        # CRITICAL: bottom_y must be AFTER final rows (if rendered)
        # This ensures billContent fields render with proper gap after final rows
        bottom_y = element_y - actual_height
        return {
            'bottom_y': bottom_y,
            'rows_rendered': rows_rendered,
            'cursor_updated': last_index > current_last_index,
            'all_rows_rendered': state.get('all_rows_rendered', False)
        }
    
    def _render_content_detail_table(
        self, c: canvas.Canvas, element: Dict[str, Any],
        element_y: float, min_content_y: float,
        page_num: int, page_context: Dict[str, Any], data: Dict[str, Any],
        cursor_state: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Render contentDetailTable with cursor state management."""
        table_config = element['config']
        cd_data = element.get('data', [])
        content_name = element.get('content_name')
        
        # Initialize state if not exists
        content_table_key = f"contentDetailTable_{content_name}_{table_config.get('x', 0)}_{table_config.get('y', 0)}"
        
        if content_table_key not in cursor_state:
            actual_data_length = len(cd_data) if cd_data else 0
            cursor_state[content_table_key] = {
                'last_index': -1,
                'final_rows_rendered': False,
                'all_rows_rendered': False,
                'content_name': content_name,
                'table_config': table_config,
                'items': cd_data,
                'total_items': actual_data_length
            }
        
        # Get current state
        state = cursor_state[content_table_key]
        current_last_index = state.get('last_index', -1)
        total_items = state.get('total_items', len(cd_data) if cd_data else 0)
        
        # Determine start_index for continuation
        # RULE 6: Header Rendering Rule - Headers render only when start_index == 0 (new page for table)
        if current_last_index >= 0:
            # Continue from last rendered row (start_index > 0 = continuation, no header)
            start_index = current_last_index + 1
        else:
            # First page or retry (start_index == 0 = new page, render header)
            start_index = 0
        
        # Always use None for end_index
        end_index = None
        
        # Render table
        # Note: repeat_header parameter is kept for backward compatibility but is no longer used.
        # Header rendering is now controlled by start_index == 0 (new page for table).
        x = table_config.get('x', 0)
        rows_rendered, last_index, actual_height = render_table(
            c, table_config, cd_data, x, element_y,
            page_num, page_context.get('totalPages', 1), True,
            start_index, end_index, min_content_y
        )
        
        # Handle zero-row scenario
        if rows_rendered == 0 and start_index < total_items:
            logger.warning(f"CRITICAL: ContentDetail table {content_name} rendered 0 rows but has remaining data!")
            if last_index < start_index:
                last_index = current_last_index
        
        # Update cursor (monotonic)
        if last_index > current_last_index:
            state['last_index'] = last_index
        
        # Check completion
        current_last_index = state['last_index']
        
        # CRITICAL: Check completion with same logic as billContentTable
        # Completion conditions:
        # 1. We reached the last item (last_index == total_items - 1) - data cursor at end
        # 2. We attempted to start beyond the end (start_index >= total_items) - tried to render past end
        # 3. Table is empty (total_items == 0)
        reached_last_item = (current_last_index >= total_items - 1) and (current_last_index >= 0) if total_items > 0 else False
        attempted_beyond_end = (start_index >= total_items) if total_items > 0 else False
        data_exhausted = reached_last_item or attempted_beyond_end or (total_items == 0)
        
        if data_exhausted and not state['all_rows_rendered']:
            state['all_rows_rendered'] = True
            logger.debug(f"ContentDetail table marked complete: table_key={content_table_key}, "
                        f"last_index={current_last_index}, total_items={total_items}, "
                        f"reached_last_item={reached_last_item}, attempted_beyond_end={attempted_beyond_end}, "
                        f"rows_rendered={rows_rendered}")
        
        # Render final rows if complete
        table_bottom_y = element_y - actual_height
        final_rows = table_config.get('finalRows', [])
        all_rows_rendered = state.get('all_rows_rendered', False)
        final_rows_already_rendered = state.get('final_rows_rendered', False)
        
        if final_rows and all_rows_rendered and not final_rows_already_rendered:
            columns = table_config.get('columns', [])
            visible_columns = [col for col in columns if col.get('visible', True)]
            font_size = table_config.get('fontSize', 12)
            cell_padding = table_config.get('cellPadding', 10)
            border_width = table_config.get('borderWidth', 1)
            border_color = table_config.get('borderColor', '#dddddd')
            
            # CRITICAL: Render final rows at table_bottom_y (bottom of data rows)
            # final_rows_bottom will be the actual bottom after final rows render
            final_rows_bottom = self._render_final_rows(
                c, table_config, final_rows, columns, visible_columns,
                cd_data, data, x, table_bottom_y, font_size, cell_padding,
                border_width, border_color, min_content_y
            )
            # CRITICAL: Recalculate actual_height to include final rows
            # bottom_y will be final_rows_bottom, ensuring next element starts AFTER final rows
            actual_height = element_y - final_rows_bottom
            state['final_rows_rendered'] = True
            logger.debug(f"Final rows rendered for table {content_table_key}: "
                        f"table_bottom_y={table_bottom_y:.1f}, "
                        f"final_rows_bottom={final_rows_bottom:.1f}, "
                        f"actual_height={actual_height:.1f}, "
                        f"bottom_y will be {element_y - actual_height:.1f}")
        
        # CRITICAL: bottom_y must be AFTER final rows (if rendered)
        # This ensures billContent fields render with proper gap after final rows
        bottom_y = element_y - actual_height
        return {
            'bottom_y': bottom_y,
            'rows_rendered': rows_rendered,
            'cursor_updated': last_index > current_last_index,
            'all_rows_rendered': state.get('all_rows_rendered', False)
        }
    
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
        """
        if not final_rows:
            return current_y
        
        # Calculate total height required
        total_final_rows_height = 0
        row_gap = 2
        
        for final_row in final_rows:
            if not final_row.get('visible', True):
                continue
            
            # Calculate height for this row by iterating through final_row.cells (handling colspan)
            max_cell_height = font_size + (cell_padding * 2) + (border_width * 2) + 2
            col_idx = 0
            
            for cell_cfg in final_row.get('cells', []):
                cell_col_span = cell_cfg.get('colSpan', 1) or 1
                cell_col_span = max(1, int(cell_col_span))  # Ensure at least 1
                
                # Calculate cell width (sum of widths for spanned columns)
                cell_width = 0
                for i in range(cell_col_span):
                    if col_idx + i < len(visible_columns):
                        cell_width += visible_columns[col_idx + i].get('_calculated_width') or visible_columns[col_idx + i].get('width', 100)
                
                # Get cell styling
                cell_font_size = cell_cfg.get('fontSize', font_size)
                cell_color = cell_cfg.get('color', '#000000')
                first_col_align = visible_columns[col_idx].get('align', 'left') if col_idx < len(visible_columns) else 'left'
                cell_align = cell_cfg.get('align', first_col_align)
                
                # Calculate cell height (simplified estimate for height calculation)
                cell_row_height = cell_font_size + (cell_padding * 2) + (border_width * 2) + 2
                max_cell_height = max(max_cell_height, cell_row_height)
                
                # Skip spanned columns
                col_idx += cell_col_span
            
            total_final_rows_height += max_cell_height + row_gap
        
        if total_final_rows_height > 0:
            total_final_rows_height -= row_gap
        
        # Check if final rows fit
        if min_content_y is not None:
            available_space = current_y - min_content_y
            if available_space < total_final_rows_height:
                logger.warning(f"Final rows total height ({total_final_rows_height}) exceeds available space "
                             f"({available_space}). Final rows may overlap with footer.")
        
        # Render all final rows
        for final_row in final_rows:
            if not final_row.get('visible', True):
                continue
            
            # Calculate cell values and heights - iterate through final_row.cells (not visible_columns)
            # Handle colspan by grouping cells and calculating their widths
            cell_paragraphs = []
            cell_heights = []
            cell_configs = []  # Store cell config (colspan, width, align, etc.)
            
            col_idx = 0
            for cell_cfg in final_row.get('cells', []):
                cell_col_span = cell_cfg.get('colSpan', 1) or 1
                cell_col_span = max(1, int(cell_col_span))  # Ensure at least 1
                
                # Calculate cell width (sum of widths for spanned columns)
                cell_width = 0
                for i in range(cell_col_span):
                    if col_idx + i < len(visible_columns):
                        # Use _calculated_width if available, otherwise use width or default
                        cell_width += visible_columns[col_idx + i].get('_calculated_width') or visible_columns[col_idx + i].get('width', 100)
                
                # Calculate cell value
                cell_value = _calculate_final_row_value(cell_cfg, all_items, data)
                
                # Get cell styling
                cell_font_size = cell_cfg.get('fontSize', font_size)
                cell_color = cell_cfg.get('color', '#000000')
                # Use cell align if specified, otherwise use first spanned column's align
                first_col_align = visible_columns[col_idx].get('align', 'left') if col_idx < len(visible_columns) else 'left'
                cell_align = cell_cfg.get('align', first_col_align)
                cell_font_weight = cell_cfg.get('fontWeight', 'normal')
                
                font_name = 'Helvetica-Bold' if cell_font_weight == 'bold' else 'Helvetica'
                para = create_cell_paragraph(cell_value, font_name, cell_font_size, cell_color, cell_align)
                cell_paragraphs.append(para)
                
                # Calculate cell height
                cell_height = calculate_cell_height(
                    cell_value, cell_width, cell_padding, border_width,
                    font_name, cell_font_size, cell_color, cell_align
                )
                cell_heights.append(cell_height)
                
                # Store cell config
                cell_configs.append({
                    'colspan': cell_col_span,
                    'width': cell_width,
                    'align': cell_align,
                    'font_size': cell_font_size,
                    'color': cell_color,
                    'font_name': font_name
                })
                
                # Skip spanned columns
                col_idx += cell_col_span
            
            # Row height is max of all cell heights
            row_height = max(cell_heights) if cell_heights else (font_size + (cell_padding * 2) + (border_width * 2) + 2)
            
            # Check if row fits
            row_y = current_y - row_height
            if min_content_y is not None and row_y < min_content_y:
                logger.error(f"Final row does not fit on current page. Available: {current_y - min_content_y}, "
                           f"Required: {row_height}. Final rows must not be split across pages.")
                return current_y
            
            # Calculate total table width for background
            total_width = sum(
                visible_columns[i].get('_calculated_width') or visible_columns[i].get('width', 100)
                for i in range(len(visible_columns))
            )
            
            # Render row background if specified
            bg_color = final_row.get('backgroundColor')
            if bg_color:
                from .pdf_utils import hex_to_rgb
                c.setFillColorRGB(*hex_to_rgb(bg_color))
                c.rect(x, row_y, total_width, row_height, fill=1, stroke=0)
            
            # Render cells - iterate through final_row.cells (handling colspan)
            col_x = x
            for cell_idx, cell_config in enumerate(cell_configs):
                cell_width = cell_config['width']
                para = cell_paragraphs[cell_idx]
                align = cell_config['align']
                
                # Calculate available width for text
                available_width = cell_width - (cell_padding * 2)
                
                # Wrap paragraph to get its actual dimensions
                w, para_height = para.wrap(available_width, 10000)
                
                # Calculate text position
                # Paragraph.drawOn() uses bottom-left coordinates (Y=0 at bottom, increases upward)
                # row_y is row bottom (ReportLab coordinate)
                # We want paragraph bottom to be: row bottom + padding
                text_x = col_x + cell_padding
                text_y = row_y + cell_padding
                
                # Draw paragraph
                para.drawOn(c, text_x, text_y)
                
                # Draw border
                from .pdf_utils import hex_to_rgb
                c.setStrokeColorRGB(*hex_to_rgb(border_color))
                c.setLineWidth(border_width)
                
                if final_row.get('borderTop', False):
                    c.line(col_x, current_y, col_x + cell_width, current_y)
                
                c.rect(col_x, row_y, cell_width, row_height, fill=0, stroke=1)
                col_x += cell_width
            
            current_y = row_y
        
        return current_y

