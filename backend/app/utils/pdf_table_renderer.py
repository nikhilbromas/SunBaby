"""
PDF table rendering utilities.
Handles rendering of tables in PDF documents with pagination support.
"""
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.lib import colors
from typing import Dict, Any, List, Tuple
import html
import logging
from .pdf_utils import hex_to_rgb
from .pdf_field_renderer import get_field_value

logger = logging.getLogger(__name__)


def create_paragraph_style(font_name: str, font_size: float, 
                          color: str, alignment: str, leading: float = None) -> ParagraphStyle:
    """
    Create a ParagraphStyle for table cells.
    
    Args:
        font_name: Font name (e.g., 'Helvetica', 'Helvetica-Bold')
        font_size: Font size in points
        color: Hex color string (e.g., '#000000')
        alignment: Text alignment ('left', 'center', 'right')
        leading: Line spacing (defaults to font_size * 1.2)
        
    Returns:
        ParagraphStyle object
    """
    # Convert alignment string to ReportLab enum
    if alignment == 'center':
        align_enum = TA_CENTER
    elif alignment == 'right':
        align_enum = TA_RIGHT
    else:
        align_enum = TA_LEFT
    
    # Convert hex color to Color object
    rgb = hex_to_rgb(color)
    text_color = colors.Color(rgb[0], rgb[1], rgb[2])
    
    # Set leading (line spacing)
    if leading is None:
        leading = font_size * 1.2
    
    style = ParagraphStyle(
        name=f'CellStyle_{font_name}_{font_size}',
        fontName=font_name,
        fontSize=font_size,
        textColor=text_color,
        alignment=align_enum,
        leading=leading,
        spaceBefore=0,
        spaceAfter=0,
        leftIndent=0,
        rightIndent=0
    )
    
    return style


def create_cell_paragraph(text: str, font_name: str, font_size: float,
                         color: str, alignment: str) -> Paragraph:
    """
    Create a Paragraph object for a table cell.
    
    Args:
        text: Cell text content
        font_name: Font name (e.g., 'Helvetica', 'Helvetica-Bold')
        font_size: Font size in points
        color: Hex color string (e.g., '#000000')
        alignment: Text alignment ('left', 'center', 'right')
        
    Returns:
        Paragraph object
    """
    # Escape text for XML/HTML (Paragraph uses XML-like markup)
    escaped_text = html.escape(str(text) if text else '')
    
    # Create style
    style = create_paragraph_style(font_name, font_size, color, alignment)
    
    # Create and return paragraph
    return Paragraph(escaped_text, style)


def calculate_cell_height(text: str, col_width: float, cell_padding: float,
                         border_width: float, font_name: str, font_size: float,
                         color: str, alignment: str) -> float:
    """
    Calculate the actual height required for a cell using Paragraph.wrap().
    
    Args:
        text: Cell text content
        col_width: Column width in points
        cell_padding: Cell padding in points
        border_width: Border width in points
        font_name: Font name
        font_size: Font size in points
        color: Hex color string
        alignment: Text alignment
        
    Returns:
        Cell height in points (including padding and borders)
    """
    if not text or not text.strip():
        # Empty cell - return minimum height
        return font_size + (cell_padding * 2) + (border_width * 2) + 2
    
    # Create paragraph
    para = create_cell_paragraph(text, font_name, font_size, color, alignment)
    
    # Calculate available width (column width minus padding on both sides)
    available_width = col_width - (cell_padding * 2)
    
    if available_width <= 0:
        # No space for content
        return font_size + (cell_padding * 2) + (border_width * 2) + 2
    
    # Use wrap() to calculate actual height needed
    # Pass large height (10000) to allow full wrapping
    w, h = para.wrap(available_width, 10000)
    
    # Return height including padding and borders
    return h + (cell_padding * 2) + (border_width * 2)


def render_table(c: canvas.Canvas, table_config: Dict[str, Any],
                items: List[Dict[str, Any]], x: float, y: float,
                page_num: int = 1, total_pages: int = 1,
                repeat_header: bool = True,
                start_index: int = 0, end_index: int = None,
                min_content_y: float = None) -> Tuple[int, int]:
    """
    Render a table.
    
    Args:
        c: Canvas object
        table_config: Table configuration
        items: List of items/rows
        x: X position in points
        y: Y position in points
        page_num: Current page number
        total_pages: Total pages
        repeat_header: Whether to repeat header
        start_index: Start index for items (pagination)
        end_index: End index for items (pagination)
        min_content_y: Minimum Y position for content bottom (pagination check)
        
    Returns:
        Tuple of (rows_rendered, last_rendered_index):
        - rows_rendered: Number of rows actually rendered on this page
        - last_rendered_index: Index of last row rendered (0-based from items list, -1 if none rendered)
    """
    columns = table_config.get('columns', [])
    visible_columns = [col for col in columns if col.get('visible', True)]
    
    if not visible_columns:
        return (0, start_index - 1)
    
    # Get table styling
    font_size = table_config.get('fontSize', 12)
    cell_padding = table_config.get('cellPadding', 10)
    border_width = table_config.get('borderWidth', 1)
    border_color = table_config.get('borderColor', '#dddddd')
    header_bg = table_config.get('headerBackgroundColor', '#f0f0f0')
    header_text = table_config.get('headerTextColor', '#000000')
    alternate_color = table_config.get('alternateRowColor', '#f9f9f9')
    
    # Calculate row height
    row_height = font_size + (cell_padding * 2) + (border_width * 2) + 2
    
    # Get items to render
    if end_index is not None:
        items_to_render = items[start_index:end_index]
    else:
        items_to_render = items[start_index:]
    
    current_y = y
    
    # Render header using Paragraph
    if page_num == 1 or repeat_header:
        header_y = current_y
        col_x = x
        
        # First pass: Calculate header cell heights to determine header row height
        header_cell_heights = []
        header_paragraphs = []
        
        for col in visible_columns:
            col_width = col.get('width', 100)
            label = col.get('label', '')
            align = col.get('align', 'left')
            
            # Create paragraph for header cell
            para = create_cell_paragraph(label, 'Helvetica-Bold', font_size, header_text, align)
            header_paragraphs.append(para)
            
            # Calculate cell height using Paragraph.wrap()
            cell_height = calculate_cell_height(
                label, col_width, cell_padding, border_width,
                'Helvetica-Bold', font_size, header_text, align
            )
            header_cell_heights.append(cell_height)
        
        # Header row height is max of all header cell heights
        header_row_height = max(header_cell_heights) if header_cell_heights else row_height
        
        # Second pass: Render header cells
        for col_idx, col in enumerate(visible_columns):
            col_width = col.get('width', 100)
            para = header_paragraphs[col_idx]
            align = col.get('align', 'left')
            
            # Draw header cell background
            c.setFillColorRGB(*hex_to_rgb(header_bg))
            c.rect(col_x, header_y - header_row_height, col_width, header_row_height, fill=1, stroke=0)
            
            # Calculate available width for text
            available_width = col_width - (cell_padding * 2)
            
            # Wrap paragraph to get its actual height
            w, para_height = para.wrap(available_width, 10000)
            
            # Calculate text position
            # Paragraph.drawOn() uses bottom-left coordinates (Y=0 at bottom, increases upward)
            # header_y is top of cell (from top coordinate, larger Y = higher up)
            # Cell bottom (from top): header_y - header_row_height
            # We want paragraph bottom to be: cell bottom + padding
            # In ReportLab coordinates (from bottom): this is (header_y - header_row_height + cell_padding)
            text_x = col_x + cell_padding
            text_y = header_y - header_row_height + cell_padding
            
            # Draw paragraph
            para.drawOn(c, text_x, text_y)
            
            # Draw border
            c.setStrokeColorRGB(*hex_to_rgb(border_color))
            c.setLineWidth(border_width)
            c.rect(col_x, header_y - header_row_height, col_width, header_row_height, fill=0, stroke=1)
            
            col_x += col_width
        
        current_y = header_y - header_row_height
    
    # Render rows using Paragraph - calculate REAL height before drawing
    rows_rendered = 0
    
    for idx, item in enumerate(items_to_render):
        actual_idx = start_index + idx
        
        # First pass: Create Paragraphs for all cells and calculate their heights
        cell_paragraphs = []
        cell_heights = []
        cell_values = []
        
        for col in visible_columns:
            col_width = col.get('width', 100)
            align = col.get('align', 'left')
            
            # Get cell value
            bind_path = col.get('bind', '')
            if bind_path:
                if '.' not in bind_path:
                    raw_value = item.get(bind_path, '') if isinstance(item, dict) else ''
                else:
                    raw_value = get_field_value(bind_path, item)
                
                # Convert to string and handle None/empty values
                if raw_value is None:
                    value = ''
                else:
                    value = str(raw_value).strip()
            else:
                value = ''
            
            cell_values.append(value)
            
            # Create paragraph for this cell
            para = create_cell_paragraph(value, 'Helvetica', font_size, '#000000', align)
            cell_paragraphs.append(para)
            
            # Calculate cell height using Paragraph.wrap()
            cell_height = calculate_cell_height(
                value, col_width, cell_padding, border_width,
                'Helvetica', font_size, '#000000', align
            )
            cell_heights.append(cell_height)
        
        # Row height is MAX of all cell heights (CRITICAL: not sum, not average)
        row_height = max(cell_heights) if cell_heights else (font_size + (cell_padding * 2) + (border_width * 2) + 2)
        
        # Calculate row position
        # In ReportLab: Y=0 at bottom, Y increases upward
        # current_y is the top position where we should start this row (from top coordinate)
        # row_y (ReportLab coordinate) = current_y - row_height (row bottom in ReportLab coords)
        row_y = current_y - row_height
        
        # Check pagination BEFORE rendering (NON-NEGOTIABLE)
        # min_content_y is in "from top" coordinates (smaller Y = closer to bottom of page)
        # row_y is row bottom position (ReportLab coordinate, which equals "from top" coordinate)
        # row top (from top) = row_y + row_height
        if min_content_y is not None:
            row_bottom_from_top = row_y  # row_y is already the bottom in "from top" coordinates
            # Add small buffer (5 points) to be more lenient - prevents stopping too early
            # This accounts for slight variations in height calculations
            min_content_y_with_buffer = min_content_y - 5
            # Check if row bottom would go below minimum allowed Y (from top)
            # row_bottom_from_top should be >= min_content_y_with_buffer (smaller Y = closer to bottom)
            if row_bottom_from_top < min_content_y_with_buffer:
                # Row doesn't fit within available height, stop rendering
                # Return how many rows were actually rendered
                last_rendered_index = start_index + rows_rendered - 1 if rows_rendered > 0 else start_index - 1
                return (rows_rendered, last_rendered_index)
        
        # Second pass: Render row (pagination check passed)
        col_x = x
        
        # Alternate row color
        if actual_idx % 2 == 1 and alternate_color:
            c.setFillColorRGB(*hex_to_rgb(alternate_color))
            total_width = sum(col.get('width', 100) for col in visible_columns)
            c.rect(col_x, row_y, total_width, row_height, fill=1, stroke=0)
        
        # Render each cell using Paragraph
        for col_idx, col in enumerate(visible_columns):
            col_width = col.get('width', 100)
            para = cell_paragraphs[col_idx]
            align = col.get('align', 'left')
            
            # Calculate available width for text
            available_width = col_width - (cell_padding * 2)
            
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
            c.setStrokeColorRGB(*hex_to_rgb(border_color))
            c.setLineWidth(border_width)
            c.rect(col_x, row_y, col_width, row_height, fill=0, stroke=1)
            
            col_x += col_width
        
        # Move current_y down for next row
        current_y = row_y
        rows_rendered += 1
    
    # Return how many rows were actually rendered
    last_rendered_index = start_index + rows_rendered - 1 if rows_rendered > 0 else start_index - 1
    return (rows_rendered, last_rendered_index)


def calculate_table_height(table_config: Dict[str, Any], table_info: Dict[str, Any],
                          content_details_data: Dict[str, Any], data: Dict[str, Any]) -> float:
    """
    Calculate table height for initial pagination estimates.
    
    Note: This method provides quick estimates for pagination planning.
    Actual row heights are calculated during rendering using Paragraph.wrap()
    to ensure accurate height calculation for large text content.
    
    Args:
        table_config: Table configuration
        table_info: Table info with pagination details
        content_details_data: Content details data
        data: Full data dictionary
        
    Returns:
        Estimated table height in points
    """
    font_size = table_config.get('fontSize', 12)
    cell_padding = table_config.get('cellPadding', 10)
    border_width = table_config.get('borderWidth', 1)
    row_height = font_size + (cell_padding * 2) + (border_width * 2) + 2
    header_height = row_height
    
    table_type = table_info.get('type', 'billContent')
    
    if table_type == 'contentDetail':
        content_name = table_info.get('content_name')
        if content_name and content_name in content_details_data:
            cd_data = content_details_data[content_name]
            num_rows = len(cd_data) if isinstance(cd_data, list) else 0
        else:
            num_rows = 0
    else:
        start_index = table_info.get('start_index', 0)
        end_index = table_info.get('end_index', 0)
        num_rows = end_index - start_index
    
    table_height = header_height + (row_height * num_rows) if num_rows > 0 else header_height
    return table_height


def calculate_table_height_simple(table_config: Dict[str, Any], 
                                 items: List[Dict[str, Any]]) -> float:
    """
    Calculate table height for simple table rendering (initial estimates).
    
    Note: This method provides quick estimates for pagination planning.
    Actual row heights are calculated during rendering using Paragraph.wrap()
    to ensure accurate height calculation for large text content.
    
    Args:
        table_config: Table configuration
        items: List of items/rows
        
    Returns:
        Estimated table height in points
    """
    font_size = table_config.get('fontSize', 12)
    cell_padding = table_config.get('cellPadding', 10)
    border_width = table_config.get('borderWidth', 1)
    row_height = font_size + (cell_padding * 2) + (border_width * 2) + 2
    header_height = row_height
    
    num_rows = len(items) if items else 0
    table_height = header_height + (row_height * num_rows) if num_rows > 0 else header_height
    return table_height


def calculate_bill_footer_height(bill_footer_fields: List[Dict[str, Any]]) -> float:
    """
    Calculate bill footer height dynamically based on fields.
    
    Args:
        bill_footer_fields: List of bill footer field configurations
        
    Returns:
        Bill footer height in points
    """
    if not bill_footer_fields:
        return 0
    
    max_bottom = 0
    for field in bill_footer_fields:
        if field.get('visible', True):
            field_y = field.get('y', 0)
            font_size = field.get('fontSize', 12)
            field_height = font_size * 1.5 if font_size else 20
            max_bottom = max(max_bottom, field_y + field_height)
    
    return max_bottom + 10  # Add some padding

