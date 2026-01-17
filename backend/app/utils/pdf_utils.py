"""
PDF utility functions for page size calculations and helper methods.
"""
from typing import Dict, Any, Tuple
import logging

logger = logging.getLogger(__name__)


def get_page_size(page_size: str, orientation: str) -> Tuple[float, float]:
    """
    Get page size in points.
    Uses the same dimensions as template_engine (pixels at 96 DPI, used as points).
    
    Args:
        page_size: Page size (A4, Letter, etc.)
        orientation: Orientation (portrait, landscape)
        
    Returns:
        Tuple of (width, height) in points
    """
    # Page sizes matching template_engine (pixels at 96 DPI, used directly as points)
    # A4: 794 x 1123 pixels (at 96 DPI) = 794 x 1123 points
    # Letter: 816 x 1056 pixels (at 96 DPI) = 816 x 1056 points
    # This matches the template engine's page dimensions for proper coordinate alignment
    page_sizes = {
        'A4': {'portrait': (794, 1123), 'landscape': (1123, 794)},
        'Letter': {'portrait': (816, 1056), 'landscape': (1056, 816)}
    }
    
    size_key = page_size if page_size in page_sizes else 'A4'
    orient_key = orientation if orientation in ['portrait', 'landscape'] else 'portrait'
    
    return page_sizes.get(size_key, page_sizes['A4'])[orient_key]


def hex_to_rgb(hex_color: str) -> Tuple[float, float, float]:
    """
    Convert hex color to RGB tuple (0-1 range).
    
    Args:
        hex_color: Hex color string (#RRGGBB)
        
    Returns:
        RGB tuple (r, g, b) in 0-1 range
    """
    hex_color = hex_color.lstrip('#')
    if len(hex_color) == 6:
        r = int(hex_color[0:2], 16) / 255.0
        g = int(hex_color[2:4], 16) / 255.0
        b = int(hex_color[4:6], 16) / 255.0
        return (r, g, b)
    return (0, 0, 0)


def page_has_content(page_num: int, template_config: Dict[str, Any],
                     data: Dict[str, Any], bill_content_pages_info: Dict[str, Any]) -> bool:
    """
    Check if a page has actual content (not just headers/footers).
    
    Args:
        page_num: Page number to check
        template_config: Template configuration
        data: Data dictionary
        bill_content_pages_info: Bill content pagination info
        
    Returns:
        True if page has content, False otherwise
    """
    # Check for bill header (first page only)
    if page_num == 1:
        header_fields = template_config.get('header', [])
        if header_fields:
            return True
    
    # Check for bill content
    bill_content_fields = template_config.get('billContent', [])
    bill_content_tables = template_config.get('billContentTables', [])
    content_details_tables = template_config.get('contentDetailsTables', [])
    
    # For billContentTables, calculate pagination dynamically like itemsTable
    if bill_content_tables:
        items = data.get('items', [])
        if items:
            from app.utils.template_engine import TemplateEngine
            template_engine = TemplateEngine()
            rows_per_page = template_engine._calculate_rows_per_page(template_config, len(items))
            items_pages = []
            for i in range(0, len(items), rows_per_page):
                items_pages.append(items[i:i + rows_per_page])
            
            if page_num <= len(items_pages) and len(items_pages[page_num - 1]) > 0:
                return True
    
    # Check for other bill content (fields, content details tables)
    if bill_content_fields or content_details_tables:
        if bill_content_pages_info['total_pages'] > 0:
            page_info = bill_content_pages_info['pages'].get(page_num)
            if page_info and (page_info.get('fields') or page_info.get('tables')):
                return True
        elif page_num == 1:
            return True
    
    # Check for items table (if not in bill content)
    items_table = template_config.get('itemsTable', {})
    if items_table and not bill_content_tables:
        items = data.get('items', [])
        if items:
            from app.utils.template_engine import TemplateEngine
            template_engine = TemplateEngine()
            rows_per_page = template_engine._calculate_rows_per_page(template_config, len(items))
            items_pages = []
            for i in range(0, len(items), rows_per_page):
                items_pages.append(items[i:i + rows_per_page])
            
            if page_num <= len(items_pages) and len(items_pages[page_num - 1]) > 0:
                return True
    
    return False

