"""
PDF Generator using ReportLab.
Generates PDF directly from template JSON and data.
Refactored version using separate modules for field rendering, table rendering, and utilities.
"""
from reportlab.pdfgen import canvas
from io import BytesIO
from typing import Dict, Any, List
import json
import logging

from .pdf_utils import get_page_size, page_has_content
from .pdf_field_renderer import render_field
from .pdf_table_renderer import (
    render_table,
    calculate_table_height,
    calculate_table_height_simple,
    calculate_bill_footer_height
)

logger = logging.getLogger(__name__)


class PDFGenerator:
    """PDF generator using ReportLab."""
    
    def __init__(self):
        """Initialize PDF generator."""
        pass
    
    def generate_pdf(self, template_json: str, data: Dict[str, Any]) -> bytes:
        """
        Generate PDF from template JSON and data.
        
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
        
        # Calculate pagination for bill-content
        bill_content_fields = template_config.get('billContent', [])
        bill_content_tables = template_config.get('billContentTables', [])
        bill_content_height = template_config.get('sectionHeights', {}).get('billContent', 100)
        items = data.get('items', [])
        content_details_tables = template_config.get('contentDetailsTables', [])
        content_details_data = data.get('contentDetails', {})
        bill_footer_fields = template_config.get('billFooter', [])
        
        # Reuse pagination logic from template_engine
        from app.utils.template_engine import TemplateEngine
        template_engine = TemplateEngine()
        
        bill_content_pages_info = template_engine._calculate_bill_content_pages(
            template_config,
            bill_content_fields,
            bill_content_tables,
            bill_content_height,
            items,
            content_details_tables,
            content_details_data,
            bill_footer_fields
        )
        
        # Track actual last rendered index per table to handle early stops
        # Key: table identifier (table index or content_name), Value: last rendered index
        table_last_rendered_index = {}
        
        # Track if bill footer has been rendered
        bill_footer_rendered = False
        
        # Calculate total pages - only count pages with actual content
        items_table = template_config.get('itemsTable', {})
        rows_per_page = template_engine._calculate_rows_per_page(template_config, len(items))
        total_items_pages = max(1, (len(items) + rows_per_page - 1) // rows_per_page) if items else 0
        
        all_page_counts = []
        if total_items_pages > 0:
            all_page_counts.append(total_items_pages)
        if bill_content_pages_info['total_pages'] > 0:
            all_page_counts.append(bill_content_pages_info['total_pages'])
        
        # If no content, still create one page
        overall_total_pages = max(all_page_counts) if all_page_counts else 1
        
        # First, determine which pages actually have content
        pages_with_content = []
        for page_num in range(1, overall_total_pages + 1):
            if page_has_content(page_num, template_config, data, bill_content_pages_info):
                pages_with_content.append(page_num)
        
        # Update total pages to actual pages with content
        if not pages_with_content:
            # If no content at all, create at least one page with header/footer
            pages_with_content = [1]
        
        actual_total_pages = len(pages_with_content)
        
        # Render pages, dynamically adding more if needed when rows don't fit
        max_iterations = 100  # Safety limit to prevent infinite loops
        iteration = 0
        idx = 0
        
        while idx < len(pages_with_content) and iteration < max_iterations:
            iteration += 1
            page_num = pages_with_content[idx]
            actual_total_pages = len(pages_with_content)
            page_context = {'currentPage': idx + 1, 'totalPages': actual_total_pages}
            
            # Render the page
            render_result = self._render_page(c, page_num, template_config, data, page_context, 
                            bill_content_pages_info, page_width, page_height, table_last_rendered_index, bill_footer_rendered)
            
            # Update bill footer rendering status
            if render_result.get('bill_footer_rendered', False):
                bill_footer_rendered = True
            
            # Check if there are unrendered rows that need additional pages
            # Check all bill content tables to see if any have remaining rows
            bill_content_tables = template_config.get('billContentTables', [])
            items = data.get('items', [])
            needs_additional_page = False
            next_page_num = len(pages_with_content) + 1
            
            for table_config in bill_content_tables:
                table_x = table_config.get('x', 0)
                table_y = table_config.get('y', 0)
                table_key = f"billContent_table_{table_x}_{table_y}"
                
                if table_key in table_last_rendered_index:
                    last_rendered = table_last_rendered_index[table_key]
                    total_items = len(items) if items else 0
                    if last_rendered < total_items - 1:
                        # There are remaining rows that need to be rendered
                        needs_additional_page = True
                        logger.debug(f"Table at ({table_x}, {table_y}) has unrendered rows: "
                                   f"last_rendered={last_rendered}, total_items={total_items}. "
                                   f"Adding page {next_page_num}")
                        break
            
            # Check if bill footer needs a new page
            if render_result.get('bill_footer_needs_new_page', False) and not bill_footer_rendered:
                needs_additional_page = True
                logger.debug(f"Bill footer needs a new page. Adding page {next_page_num}")
            
            # If we need an additional page and we're on the last page, add it
            if needs_additional_page and idx == len(pages_with_content) - 1:
                pages_with_content.append(next_page_num)
                logger.debug(f"Added additional page {next_page_num} to render remaining rows or bill footer")
            
            # Move to next page
            idx += 1
            
            # Don't call showPage() on the last page - canvas.save() handles it
            if idx < len(pages_with_content):
                c.showPage()
        
        c.save()
        buffer.seek(0)
        return buffer.getvalue()
    
    def _render_page(self, c: canvas.Canvas, page_num: int, template_config: Dict[str, Any],
                    data: Dict[str, Any], page_context: Dict[str, Any],
                    bill_content_pages_info: Dict[str, Any],
                    page_width: float, page_height: float,
                    table_last_rendered_index: Dict[str, int] = None,
                    bill_footer_rendered: bool = False) -> Dict[str, Any]:
        """
        Render a single page.
        
        Args:
            c: Canvas object
            page_num: Page number (1-based)
            template_config: Template configuration
            data: Data dictionary
            page_context: Page context
            bill_content_pages_info: Bill content pagination info
            page_width: Page width in points
            page_height: Page height in points
            table_last_rendered_index: Dictionary tracking last rendered index per table
            
        Returns:
            True if page has content, False otherwise
        """
        if table_last_rendered_index is None:
            table_last_rendered_index = {}
        # Container padding - matches template_engine (80 total: 40px top + 40px bottom)
        # Since we're using pixel dimensions as points, padding is also in pixels/points
        container_padding_top = 40
        container_padding_bottom = 40
        container_padding_total = container_padding_top + container_padding_bottom
        
        # Get section heights from template config, calculate dynamically if needed
        section_heights = template_config.get('sectionHeights', {})
        page_header_height_pt = section_heights.get('pageHeader', 60)
        bill_header_height_pt = section_heights.get('billHeader', 200)
        
        # Calculate page footer height dynamically from fields if not provided
        page_footer_fields = template_config.get('pageFooter', [])
        if 'pageFooter' in section_heights:
            page_footer_height_pt = section_heights.get('pageFooter', 60)
        else:
            page_footer_height_pt = self._calculate_section_height_from_fields(page_footer_fields, 60)
        
        # Calculate available height for content area
        # Available = page height - page header - page footer - container padding (top and bottom)
        available_height = page_height - page_header_height_pt - page_footer_height_pt - container_padding_total
        
        # On first page, also subtract bill header
        if page_num == 1:
            available_height -= bill_header_height_pt
        
        # Starting Y position (top of page, accounting for container padding)
        current_y = page_height - container_padding_top
        
        has_content = False
        
        # Render page header (on every page) - static height
        page_header_fields = template_config.get('pageHeader', [])
        if page_header_fields:
            # header_y is the bottom of the header area
            # Field Y is offset from TOP of header area (current_y)
            for field in page_header_fields:
                if field.get('visible', True):
                    x_pt = field.get('x', 0)
                    # Position relative to top of header area (current_y)
                    y_pt = current_y - field.get('y', 0)
                    render_field(c, field, data, x_pt, y_pt, page_context)
            
            # Move current_y to bottom of header area for next section
            current_y = current_y - page_header_height_pt
        
        # Render bill header (first page only) - static height
        if page_num == 1:
            header_fields = template_config.get('header', [])
            if header_fields:
                bill_header_y = current_y - bill_header_height_pt
                for field in header_fields:
                    if field.get('visible', True):
                        x_pt = field.get('x', 0)
                        y_pt = bill_header_y - field.get('y', 0)
                        render_field(c, field, data, x_pt, y_pt, page_context)
                current_y = bill_header_y
                has_content = True
        
        # Render bill content - dynamic height calculation
        bill_content_fields = template_config.get('billContent', [])
        bill_content_tables = template_config.get('billContentTables', [])
        content_details_tables = template_config.get('contentDetailsTables', [])
        content_details_data = data.get('contentDetails', {})
        
        # Calculate minimum Y position for content bottom (must not overlap with page footer)
        # Page footer area: from bottom, starts at container_padding_bottom, height is page_footer_height_pt
        # From top coordinate system: minimum Y for content bottom
        # = container_padding_bottom + page_footer_height_pt + spacing (smaller value = closer to bottom)
        min_content_y_from_top = container_padding_bottom + page_footer_height_pt + 10
        bill_content_bottom = current_y  # Track where bill content ends
        
        if bill_content_fields or bill_content_tables or content_details_tables:
            if bill_content_pages_info['total_pages'] > 0:
                # Multi-page bill content
                page_info = bill_content_pages_info['pages'].get(page_num)
                
                # If page_info doesn't exist, this might be an additional page beyond pre-calculated pages
                # Check if we have unrendered rows that need to be rendered, or if bill footer needs a new page
                if not page_info:
                    # This is an additional page beyond pre-calculated pages
                    # Check if there are unrendered rows for any bill content table
                    bill_content_tables_list = template_config.get('billContentTables', [])
                    items = data.get('items', [])
                    has_unrendered_rows = False
                    
                    for table_config in bill_content_tables_list:
                        table_x = table_config.get('x', 0)
                        table_y = table_config.get('y', 0)
                        table_key = f"billContent_table_{table_x}_{table_y}"
                        
                        if table_key in table_last_rendered_index:
                            last_rendered = table_last_rendered_index[table_key]
                            total_items = len(items) if items else 0
                            if last_rendered < total_items - 1:
                                has_unrendered_rows = True
                                break
                    
                    # Check if bill footer needs to be rendered on this page
                    bill_footer_needs_page = False
                    if not bill_footer_rendered:
                        bill_footer_fields = template_config.get('billFooter', [])
                        if bill_footer_fields:
                            # Check if all bill content is rendered
                            all_content_rendered = True
                            if bill_content_tables_list:
                                for table_config in bill_content_tables_list:
                                    table_x = table_config.get('x', 0)
                                    table_y = table_config.get('y', 0)
                                    table_key = f"billContent_table_{table_x}_{table_y}"
                                    
                                    if table_key in table_last_rendered_index:
                                        last_rendered = table_last_rendered_index[table_key]
                                        total_items = len(items) if items else 0
                                        if last_rendered < total_items - 1:
                                            all_content_rendered = False
                                            break
                                    else:
                                        all_content_rendered = False
                                        break
                            else:
                                all_content_rendered = True
                            
                            if all_content_rendered:
                                bill_footer_needs_page = True
                                logger.debug(f"Page {page_num} (additional): Bill footer needs to be rendered on this page")
                    
                    if has_unrendered_rows or bill_footer_needs_page:
                        # Create a minimal page_info to render remaining rows or bill footer
                        page_info = {'fields': [], 'tables': []}
                        has_content = True
                        bill_content_start_y = current_y
                        
                        # Add table info for remaining rows
                        for table_config in bill_content_tables_list:
                            table_x = table_config.get('x', 0)
                            table_y = table_config.get('y', 0)
                            table_key = f"billContent_table_{table_x}_{table_y}"
                            
                            if table_key in table_last_rendered_index:
                                last_rendered = table_last_rendered_index[table_key]
                                total_items = len(items) if items else 0
                                if last_rendered < total_items - 1:
                                    # Create table info for remaining rows
                                    # For additional pages, start table at top of content area (adjusted_y = 0)
                                    # This ensures table starts right after page header
                                    table_info = {
                                        'table_config': table_config,
                                        'adjusted_y': 0,  # Start at top of content area on additional pages
                                        'type': 'billContent',
                                        'start_index': last_rendered + 1,
                                        'end_index': total_items,
                                        'items': items
                                    }
                                    page_info['tables'].append(table_info)
                                    logger.debug(f"Page {page_num} (additional): Created table_info for remaining rows "
                                               f"start_index={last_rendered + 1}, end_index={total_items}")
                        
                        # If this is a bill footer page (no tables), set bill_content_bottom to top of content area
                        if bill_footer_needs_page and not has_unrendered_rows:
                            bill_content_bottom = current_y
                
                if page_info and (page_info.get('fields') or page_info.get('tables')):
                    has_content = True
                    bill_content_start_y = current_y
                    
                    # Render fields for this page
                    for field_info in page_info.get('fields', []):
                        field = field_info['field']
                        adjusted_y = field_info.get('adjusted_y', 0)
                        if field.get('visible', True):
                            x_pt = field.get('x', 0)
                            y_pt = bill_content_start_y - adjusted_y
                            render_field(c, field, data, x_pt, y_pt, page_context)
                            # Update bottom position
                            font_size = field.get('fontSize', 12)
                            field_height = font_size * 1.5 if font_size else 20
                            bill_content_bottom = min(bill_content_bottom, y_pt - field_height)
                    
                    # Render tables for this page and calculate their heights
                    # Sort tables by adjusted_y to ensure correct processing order
                    # Note: adjusted_y is the Y position relative to bill_content_start_y
                    
                    tables_to_render = page_info.get('tables', [])
                    # Sort by adjusted_y (smaller adjusted_y means higher up on page check? 
                    # No, y_pt = start - adjusted_y. 
                    # If adjusted_y is larger, y_pt is smaller (lower on page).
                    # If adjusted_y is smaller, y_pt is larger (higher on page).
                    # We want to render from top to bottom, so we sort by adjusted_y ascending (smallest adjusted_y = highest Y = first)
                    # BUT WAIT: In calculate_bill_content_pages, adjusted_y might be accumulating offsets.
                    # Let's trust the sort order from pagination or re-sort.
                    
                    # Ensure we have a consistent sort key. 
                    # If strictly following pagination, valid tables are already sorted by Y in calculate_bill_content_pages. 
                    # But let's be safe.
                    tables_to_render.sort(key=lambda t: t.get('adjusted_y', 0))
                    
                    # Track current Y position cursor for flowing content
                    # Initialize with bill_content_start_y (top of content area)
                    # We will push this down as we render tables
                    current_table_cursor_y = bill_content_start_y
                    
                    for table_idx, table_info in enumerate(tables_to_render):
                        table_config = table_info['table_config']
                        adjusted_y = table_info.get('adjusted_y', 0)
                        table_type = table_info.get('type', 'billContent')
                        # Store table index in table_info for tracking
                        table_info['table_index'] = table_idx
                        
                        x_pt = table_config.get('x', 0)
                        
                        # Determine efficient Y position
                        # Base positions from pagination calculation
                        if table_type == 'contentDetail':
                             # For contentDetail, adjusted_y might be None or specific.
                             # If we use logic from earlier:
                             raw_adjusted_y = table_info.get('adjusted_y')
                             if raw_adjusted_y is None:
                                 # Fallback to configured Y
                                 raw_adjusted_y = table_config.get('y', 0)
                             
                             # Calculate proposed Y based on pagination plan
                             y_pt_pagination = bill_content_start_y - raw_adjusted_y
                        else:
                             # billContent uses Adjusted Y from pagination
                             y_pt_pagination = bill_content_start_y - adjusted_y
                        
                        # NOW APPLY DYNAMIC STACKING LOGIC
                        # We want to ensure this table starts *below* the previous one.
                        # current_table_cursor_y is the bottom of the previous element.
                        
                        # However, on the very first element of the page, we should respect the initial spacing/margin 
                        # implied by adjusted_y or just start at top?
                        # Using y_pt_pagination respects the relative offsets planned by pagination engine.
                        # But if previous table grew, current_table_cursor_y will be lower (smaller Y) than expected.
                        
                        # So, permissible Y is MIN(y_pt_pagination, current_table_cursor_y - spacing)
                        # (Remember: smaller Y = lower on page)
                        
                        if table_idx == 0:
                            # First table on page: respect pagination plan
                            y_pt = y_pt_pagination
                        else:
                            # Subsequent tables: stack dynamically
                            spacing = 10
                            y_pt = min(y_pt_pagination, current_table_cursor_y - spacing)
                        
                        # On subsequent pages (page 2+), ensure table header doesn't overlap with page header
                        # Add minimum spacing after page header
                        if page_num > 1:
                            # In ReportLab: Y=0 at bottom, Y increases upward
                            # current_y is the Y position right after page header (smaller Y = further down)
                            # y_pt is table top position (should be <= current_y to be below page header)
                            # Add spacing: table should start at least 10pt below page header end
                            min_table_top_y = current_y - 10  # 10pt spacing (smaller Y = further down)
                            # Ensure table top is not too high (y_pt should be <= min_table_top_y)
                            # If y_pt is larger than min_table_top_y, it's too high, so move it down
                            # Only apply this to billContent tables, not contentDetail (they use absolute positioning)
                            if table_type != 'contentDetail' and y_pt > min_table_top_y:
                                y_pt = min_table_top_y
                        
                        # Calculate table height dynamically
                        table_height = calculate_table_height(table_config, table_info, 
                                                                   content_details_data, data)
                        
                        # Validate that contentDetail table doesn't exceed page boundaries
                        if table_type == 'contentDetail':
                            table_bottom = y_pt - table_height
                            # Ensure table doesn't overlap with page footer
                            if table_bottom < min_content_y_from_top:
                                logger.warning(f"Page {page_num}: contentDetail table exceeds page boundary. "
                                              f"table_bottom={table_bottom}, min_y={min_content_y_from_top}. "
                                              f"Adjusting position.")
                                y_pt = min_content_y_from_top + table_height
                                table_bottom = min_content_y_from_top
                        
                        # Render table (pagination logic handles overlap prevention)
                        table_bottom = y_pt - table_height
                        
                        # Render...
                        if table_type == 'contentDetail':
                            content_name = table_info.get('content_name')
                            if content_name and content_name in content_details_data:
                                cd_data = content_details_data[content_name]
                                if isinstance(cd_data, list) and len(cd_data) > 0:
                                    min_content_y_from_top_for_table = min_content_y_from_top if 'min_content_y_from_top' in locals() else None
                                    rows_rendered, last_index, actual_height = render_table(c, table_config, cd_data, x_pt, y_pt, 
                                                      page_num, 0, min_content_y_from_top_for_table, True)
                                    # Use actual_height for accurate stacking
                                    table_bottom = y_pt - actual_height
                                    bill_content_bottom = min(bill_content_bottom, table_bottom)
                        else:
                            table_items = table_info.get('items', data.get('items', []))
                            table_x = table_config.get('x', 0)
                            table_y = table_config.get('y', 0)
                            table_key = f"billContent_table_{table_x}_{table_y}"
                            
                            original_start_index = table_info.get('start_index', 0)
                            if table_key in table_last_rendered_index:
                                tracked_last_index = table_last_rendered_index[table_key]
                                start_index = tracked_last_index + 1
                                logger.debug(f"Page {page_num}: Adjusting start_index from {original_start_index} to {start_index} "
                                           f"based on previous page's last_index={tracked_last_index}")
                            else:
                                start_index = original_start_index
                            
                            original_end_index = table_info.get('end_index', len(table_items) if table_items else 0)
                            total_items = len(table_items) if table_items else 0
                            
                            if start_index >= total_items:
                                continue
                                
                            end_index = min(original_end_index, total_items) if original_end_index > 0 else total_items
                            
                            if start_index >= end_index:
                                continue
                            
                            rows_rendered, last_index, actual_height = render_table(c, table_config, table_items, x_pt, y_pt,
                                             page_num, start_index, min_content_y_from_top, True)
                            
                            table_last_rendered_index[table_key] = last_index
                            
                            expected_rows = end_index - start_index
                            if rows_rendered < expected_rows and last_index < end_index - 1:
                                logger.debug(f"Page {page_num}: Rendered {rows_rendered} rows instead of {expected_rows} "
                                           f"(last_index={last_index}, expected end={end_index-1}). "
                                           f"Actual row heights are larger than estimated. Remaining rows will continue on next page.")
                            
                            # Use actual_height for accurate stacking
                            table_bottom = y_pt - actual_height
                            bill_content_bottom = min(bill_content_bottom, table_bottom)

                        # UPDATE CURSOR for next table using ACTUAL height
                        if actual_height > 0:
                            current_table_cursor_y = table_bottom
                    
                    # Render bill footer only after ALL bill content is fully rendered
                    # Check if all rows have been rendered for all bill content tables
                    # This check happens AFTER all tables on this page have been rendered
                    bill_content_tables_list = template_config.get('billContentTables', [])
                    items = data.get('items', [])
                    all_rows_rendered = True
                    
                    if bill_content_tables_list and items:
                        for table_config in bill_content_tables_list:
                            table_x = table_config.get('x', 0)
                            table_y = table_config.get('y', 0)
                            table_key = f"billContent_table_{table_x}_{table_y}"
                            
                            total_items = len(items)
                            if table_key in table_last_rendered_index:
                                last_rendered = table_last_rendered_index[table_key]
                                # Check if last_rendered is the last index (total_items - 1)
                                # If last_rendered < total_items - 1, there are still unrendered rows
                                if last_rendered < total_items - 1:
                                    # This table still has unrendered rows
                                    all_rows_rendered = False
                                    logger.debug(f"Bill footer check: Table at ({table_x}, {table_y}) has unrendered rows: "
                                               f"last_rendered={last_rendered}, total_items={total_items}")
                                    break
                            else:
                                # Table hasn't been rendered yet, so not all rows rendered
                                all_rows_rendered = False
                                logger.debug(f"Bill footer check: Table at ({table_x}, {table_y}) hasn't been rendered yet")
                                break
                    elif not bill_content_tables_list:
                        # No bill content tables, so all content is rendered
                        all_rows_rendered = True
                    
                    # Only render bill footer if all bill content rows have been rendered
                    # Also handle case where this page was created specifically for bill footer
                    if all_rows_rendered:
                        logger.debug(f"Page {page_num}: All bill content rows rendered. Checking if bill footer fits.")
                        bill_footer_fields = template_config.get('billFooter', [])
                        if bill_footer_fields and not bill_footer_rendered:
                            # Calculate bill footer height dynamically
                            bill_footer_height = calculate_bill_footer_height(bill_footer_fields)
                            
                            # Calculate minimum Y for bill footer top to avoid overlapping page footer
                            # Page footer area: starts at Y = container_padding_bottom, height = page_footer_height_pt
                            # Bill footer bottom must be at least: container_padding_bottom + page_footer_height_pt + 10
                            # Bill footer top = bill footer bottom + bill_footer_height
                            min_bill_footer_bottom = container_padding_bottom + page_footer_height_pt + 10
                            min_bill_footer_y = min_bill_footer_bottom + bill_footer_height
                            
                            # Calculate desired bill footer top position (below content, smaller Y = closer to bottom)
                            # bill_content_bottom is the lowest Y value (closest to bottom) where content ends
                            desired_bill_footer_y = bill_content_bottom - bill_footer_height - 20  # 20pt spacing below content
                            
                            # Check if bill footer fits on current page
                            # Bill footer fits if: desired_bill_footer_y >= min_bill_footer_y
                            # (larger Y = higher up, so if desired is higher than minimum, it fits)
                            bill_footer_fits = desired_bill_footer_y >= min_bill_footer_y
                            
                            if bill_footer_fits:
                                # Bill footer fits on current page - render it
                                bill_footer_y = desired_bill_footer_y
                                
                                # Final safety check: ensure bill footer top is below content bottom
                                # bill_footer_y should be < bill_content_bottom (smaller Y = closer to bottom)
                                if bill_footer_y >= bill_content_bottom:
                                    # If bill footer would overlap content, position it with minimum spacing
                                    bill_footer_y = max(bill_content_bottom - bill_footer_height - 10, min_bill_footer_y)
                                
                                logger.debug(f"Page {page_num}: Bill footer fits. Rendering at y={bill_footer_y}")
                                
                                for field in bill_footer_fields:
                                    if field.get('visible', True):
                                        x_pt = field.get('x', 0)
                                        y_pt = bill_footer_y - field.get('y', 0)
                                        render_field(c, field, data, x_pt, y_pt, page_context)
                                
                                # Mark bill footer as rendered
                                bill_footer_rendered = True
                            else:
                                # Bill footer doesn't fit on current page - need to render on next page
                                logger.debug(f"Page {page_num}: Bill footer doesn't fit (desired_y={desired_bill_footer_y}, "
                                           f"min_y={min_bill_footer_y}, height={bill_footer_height}). Will render on next page.")
                                # bill_footer_rendered remains False
            else:
                # Single page bill content
                if page_num == 1:
                    has_content = True
                    bill_content_start_y = current_y
                    
                    # Render bill content fields
                    for field in bill_content_fields:
                        if field.get('visible', True):
                            x_pt = field.get('x', 0)
                            y_pt = bill_content_start_y - field.get('y', 0)
                            render_field(c, field, data, x_pt, y_pt, page_context)
                            font_size = field.get('fontSize', 12)
                            field_height = font_size * 1.5 if font_size else 20
                            bill_content_bottom = min(bill_content_bottom, y_pt - field_height)
                    
                    # Calculate minimum Y position for content bottom (must not overlap with page footer)
                    # Smaller Y value = closer to bottom of page
                    min_content_y_from_top = container_padding_bottom + page_footer_height_pt + 10
                    
                    # Render bill content tables - sort by Y position to handle stacking
                    # Combine billContentTables and contentDetailsTables for proper sorting and stacking
                    all_tables_to_render = []
                    
                    for table_config in bill_content_tables:
                        all_tables_to_render.append({
                            'config': table_config, 
                            'type': 'billContent',
                            'y': table_config.get('y', 0)
                        })
                        
                    for cd_table_config in content_details_tables:
                        all_tables_to_render.append({
                            'config': cd_table_config, 
                            'type': 'contentDetail',
                            'y': cd_table_config.get('y', 0)
                        })
                    
                    # Sort by Y position
                    all_tables_to_render.sort(key=lambda t: t['y'])
                    
                    # Track current Y position within the content area for flowing content
                    # Start at the highest possible Y (top of content area) minus the first table's configured Y
                    # This respects the initial offset, but subsequent tables will stack
                    current_table_cursor_y = bill_content_start_y
                    
                    # Calculate effective content height (available space, accounting for footer)
                    # This is the usable vertical space between content start and footer top
                    effective_content_height = bill_content_start_y - min_content_y_from_top
                    
                    # Track lowest Y of any table rendered
                    lowest_table_bottom = bill_content_start_y
                    
                    for i, table_info in enumerate(all_tables_to_render):
                        table_config = table_info['config']
                        table_type = table_info['type']
                        
                        # Determine efficient Y position
                        # If this is the first table, use its configured Y offset from top
                        # If subsequent table, place it after the previous table with padding
                        config_y = table_config.get('y', 0)
                        
                        if i == 0:
                            # First table: respect its Y position, but clamp to content area
                            y_pt = bill_content_start_y - config_y
                            # Ensure we don't start below the minimum content Y
                            if y_pt < min_content_y_from_top:
                                y_pt = bill_content_start_y  # Start at top if offset is too large
                        else:
                            # Subsequent tables: check if we need to stack
                            # "y" in config is usually relative to start of section
                            # But if previous table grew, we must push this down
                            # Place at current_table_cursor_y - spacing (e.g. 10pt)
                            # However, we should also respect if the user configured a VERY large gap
                            # So we take the lower of (calculated stack position) OR (absolute config position)
                            # Remember larger Y = higher up. So "lower" means min().
                            
                            stack_y = current_table_cursor_y - 10
                            absolute_y = bill_content_start_y - config_y
                            
                            # Use the swappable logic: if it overlaps, move it down (smaller Y)
                            y_pt = min(stack_y, absolute_y)
                            
                            # Ensure we don't go below the minimum content Y
                            if y_pt < min_content_y_from_top:
                                logger.warning(f"Table {i} y_pt {y_pt} is below min {min_content_y_from_top}, clamping")
                                y_pt = min_content_y_from_top
                            
                        x_pt = table_config.get('x', 0)
                        
                        table_height = 0
                        actual_height = 0
                        table_bottom = y_pt
                        
                        if table_type == 'billContent':
                            table_items = data.get('items', [])
                            if table_items:
                                rows_rendered, last_index, actual_height = render_table(c, table_config, table_items, x_pt, y_pt, 1, 0, min_content_y_from_top, True)
                                table_bottom = y_pt - actual_height
                        
                        elif table_type == 'contentDetail':
                            content_name = table_config.get('contentName')
                            if content_name and content_name in content_details_data:
                                cd_data = content_details_data[content_name]
                                if isinstance(cd_data, list) and len(cd_data) > 0:
                                    rows_rendered, last_index, actual_height = render_table(c, table_config, cd_data, x_pt, y_pt, 1, 0, min_content_y_from_top, True)
                                    table_bottom = y_pt - actual_height
                        
                        # Update cursor for next table using ACTUAL height
                        if actual_height > 0:
                            current_table_cursor_y = table_bottom
                            bill_content_bottom = min(bill_content_bottom, table_bottom)
                    
                    # Render bill footer - dynamic height
                    bill_footer_fields = template_config.get('billFooter', [])
                    if bill_footer_fields and not bill_footer_rendered:
                        bill_footer_height = calculate_bill_footer_height(bill_footer_fields)
                        # Coordinate system: Y=0 at bottom, Y increases upward in ReportLab
                        # bill_content_bottom is the lowest Y value (closest to bottom) where content ends
                        # We want bill footer to start below content with spacing
                        # Calculate desired bill footer top position (below content, smaller Y = closer to bottom)
                        desired_bill_footer_y = bill_content_bottom - bill_footer_height - 20  # 20pt spacing below content
                        
                        # Calculate minimum Y for bill footer top to avoid overlapping page footer
                        # Page footer area: starts at Y = container_padding_bottom, height = page_footer_height_pt
                        # Bill footer bottom must be at least: container_padding_bottom + page_footer_height_pt + 10
                        # Bill footer top = bill footer bottom + bill_footer_height
                        min_bill_footer_bottom = container_padding_bottom + page_footer_height_pt + 10
                        min_bill_footer_y = min_bill_footer_bottom + bill_footer_height
                        
                        # Check if bill footer fits on current page
                        bill_footer_fits = desired_bill_footer_y >= min_bill_footer_y
                        
                        if bill_footer_fits:
                            # Bill footer fits on current page - render it
                            bill_footer_y = desired_bill_footer_y
                            
                            # Final safety check: ensure bill footer top is below content bottom
                            # bill_footer_y should be < bill_content_bottom (smaller Y = closer to bottom)
                            if bill_footer_y >= bill_content_bottom:
                                # If bill footer would overlap content, position it with minimum spacing
                                bill_footer_y = max(bill_content_bottom - bill_footer_height - 10, min_bill_footer_y)
                            
                            logger.debug(f"Page {page_num}: Bill footer fits (single page). Rendering at y={bill_footer_y}")
                            
                            for field in bill_footer_fields:
                                if field.get('visible', True):
                                    x_pt = field.get('x', 0)
                                    y_pt = bill_footer_y - field.get('y', 0)
                                    render_field(c, field, data, x_pt, y_pt, page_context)
                            
                            # Mark bill footer as rendered
                            bill_footer_rendered = True
                        else:
                            # Bill footer doesn't fit on current page - need to render on next page
                            logger.debug(f"Page {page_num}: Bill footer doesn't fit (single page, desired_y={desired_bill_footer_y}, "
                                       f"min_y={min_bill_footer_y}, height={bill_footer_height}). Will render on next page.")
                            # bill_footer_rendered remains False
        
        # Render items table (if not in bill content)
        items_table = template_config.get('itemsTable', {})
        if items_table and not bill_content_tables:
            items = data.get('items', [])
            from app.utils.template_engine import TemplateEngine
            template_engine = TemplateEngine()
            rows_per_page = template_engine._calculate_rows_per_page(template_config, len(items))
            items_pages = []
            for i in range(0, len(items), rows_per_page):
                items_pages.append(items[i:i + rows_per_page])
            
            if page_num <= len(items_pages) and len(items_pages[page_num - 1]) > 0:
                has_content = True
                items_chunk = items_pages[page_num - 1]
                table_x = items_table.get('x', 0)
                table_y = items_table.get('y', 0)
                # Position items table after bill content, ensuring it doesn't overlap with page footer
                # min_table_y_from_top is minimum Y from top for table bottom (smaller = closer to bottom)
                min_table_y_from_top = container_padding_bottom + page_footer_height_pt + 10
                potential_table_y = current_y - table_y
                table_bottom = potential_table_y - table_height
                # Check if table fits - table bottom must be above min_table_y_from_top
                if table_bottom >= min_table_y_from_top:
                    items_table_y = potential_table_y
                else:
                    # Position table so its bottom is just above page footer
                    items_table_y = min_table_y_from_top + table_height
                table_height = calculate_table_height_simple(items_table, items_chunk)
                # Check if table fits (bottom must be above page footer)
                if items_table_y - table_height >= min_table_y_from_top:
                    # Calculate start_index and end_index for this chunk (end_index used for validation only)
                    chunk_start_index = (page_num - 1) * rows_per_page
                    chunk_end_index = chunk_start_index + len(items_chunk)
                    # Pass min_table_y_from_top for pagination checking
                    # Use full items list with proper indices so pagination can work correctly
                    # Note: new render_table renders from start_index until boundary or end of items
                    rows_rendered, last_index, actual_height = render_table(c, items_table, items, table_x, items_table_y,
                                     page_num, chunk_start_index, min_table_y_from_top, True)
                    
                    # Check if fewer rows were rendered than expected
                    expected_rows = len(items_chunk)
                    if rows_rendered < expected_rows and last_index < chunk_end_index - 1:
                        # Fewer rows fit than estimated - log for debugging
                        logger.debug(f"Page {page_num} itemsTable: Rendered {rows_rendered} rows instead of {expected_rows} "
                                   f"(last_index={last_index}, expected end={chunk_end_index - 1}). "
                                   f"Actual row heights are larger than estimated.")
        
        # Render page footer (on every page) - static height
        # Ensure page footer is positioned correctly at the bottom
        page_footer_fields = template_config.get('pageFooter', [])
        if page_footer_fields:
            # Page footer starts at bottom padding
            # We want fields to be positioned relative to the TOP of the page footer area
            # Page Footer Area:
            # Bottom Y = container_padding_bottom
            # Top Y = container_padding_bottom + page_footer_height_pt
            
            footer_top_y = container_padding_bottom + page_footer_height_pt
            
            for field in page_footer_fields:
                if field.get('visible', True):
                    x_pt = field.get('x', 0)
                    # Field Y is relative to footer TOP
                    # y_pt = Top - field_y
                    field_y_offset = field.get('y', 0)
                    y_pt = footer_top_y - field_y_offset
                    render_field(c, field, data, x_pt, y_pt, page_context)
        
        # Determine if bill footer needs a new page
        bill_footer_needs_new_page = False
        if not bill_footer_rendered:
            bill_footer_fields = template_config.get('billFooter', [])
            if bill_footer_fields:
                # Check if all bill content is rendered (for multi-page case)
                bill_content_tables = template_config.get('billContentTables', [])
                items = data.get('items', [])
                all_rows_rendered = True
                
                if bill_content_tables:
                    for table_config in bill_content_tables:
                        table_x = table_config.get('x', 0)
                        table_y = table_config.get('y', 0)
                        table_key = f"billContent_table_{table_x}_{table_y}"
                        
                        if table_key in table_last_rendered_index:
                            last_rendered = table_last_rendered_index[table_key]
                            total_items = len(items) if items else 0
                            if last_rendered < total_items - 1:
                                all_rows_rendered = False
                                break
                        else:
                            all_rows_rendered = False
                            break
                
                # If all content is rendered but footer wasn't rendered, it needs a new page
                if all_rows_rendered:
                    bill_footer_needs_new_page = True
        
        return {
            'has_content': has_content,
            'bill_footer_rendered': bill_footer_rendered,
            'bill_footer_needs_new_page': bill_footer_needs_new_page
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


# Global instance
pdf_generator = PDFGenerator()


# Global instance
pdf_generator = PDFGenerator()

