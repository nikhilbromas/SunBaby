"""
PDF field rendering utilities.
Handles rendering of text fields in PDF documents.
"""
from reportlab.pdfgen import canvas
from typing import Dict, Any
from datetime import datetime
import logging
from .pdf_utils import hex_to_rgb

logger = logging.getLogger(__name__)


def get_field_value(bind_path: str, data: Dict[str, Any], 
                    field_type: str = None, page_context: Dict[str, Any] = None) -> str:
    """
    Get field value from data using binding path or special field type.
    
    Args:
        bind_path: Binding path like 'header.BillNo' or 'ItemName'
        data: Data dictionary or item dictionary
        field_type: Special field type
        page_context: Page context for special fields
        
    Returns:
        Field value as string (empty string if not found)
    """
    # Handle special fields
    if field_type and field_type in ['pageNumber', 'totalPages', 'currentDate', 'currentTime']:
        return get_special_field_value(field_type, page_context)
    
    if not bind_path:
        return ''
    
    parts = bind_path.split('.')
    value = data
    
    try:
        for part in parts:
            if isinstance(value, dict):
                if part not in value:
                    return ''
                value = value.get(part)
                if value is None:
                    return ''
            elif isinstance(value, list) and len(value) > 0:
                if not isinstance(value[0], dict):
                    return ''
                if part not in value[0]:
                    return ''
                value = value[0].get(part)
                if value is None:
                    return ''
            else:
                return ''
        
        # Handle None, empty string, or other falsy values
        if value is None:
            return ''
        
        # Convert to string and clean up - preserve numeric formatting
        if isinstance(value, (int, float)):
            # For numbers, convert to string without unnecessary decimals
            if isinstance(value, float) and value.is_integer():
                value_str = str(int(value))
            else:
                value_str = str(value)
        else:
            value_str = str(value).strip()
        
        return value_str
    except (KeyError, AttributeError, IndexError, TypeError) as e:
        logger.debug(f"Field value not found for {bind_path}: {str(e)}")
        return ''
    except Exception as e:
        logger.warning(f"Error getting field value for {bind_path}: {str(e)}")
        return ''


def get_special_field_value(field_type: str, page_context: Dict[str, Any] = None) -> str:
    """
    Get value for special field types.
    
    Args:
        field_type: Special field type
        page_context: Page context
        
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


def render_field(c: canvas.Canvas, field: Dict[str, Any], data: Dict[str, Any],
                 x: float, y: float, page_context: Dict[str, Any] = None):
    """
    Render a text field.
    
    Args:
        c: Canvas object
        field: Field configuration
        data: Data dictionary
        x: X position in points
        y: Y position in points
        page_context: Page context for special fields
    """
    if not field.get('visible', True):
        return
    
    # Get field value
    field_type = field.get('fieldType')
    bind_path = field.get('bind', '')
    value = get_field_value(bind_path, data, field_type, page_context)
    
    # Get styling
    font_size = field.get('fontSize', 12)
    font_family = field.get('fontFamily', 'Helvetica')
    font_weight = field.get('fontWeight', 'normal')
    color = field.get('color', '#000000')
    
    # Set font
    if font_weight == 'bold':
        c.setFont(f'{font_family}-Bold', font_size)
    else:
        c.setFont(font_family, font_size)
    
    # Set color
    rgb = hex_to_rgb(color)
    c.setFillColorRGB(rgb[0], rgb[1], rgb[2])
    
    # Render label and value - only show if value exists
    label = field.get('label', '')
    value_str = str(value).strip() if value else ''
    
    # Skip rendering if no value (don't show empty fields with just labels)
    # Exception: special field types always have values
    if not value_str and not field_type:
        return
    
    # Format text based on label presence
    if label and value_str:
        text = f"{label}: {value_str}"
    elif value_str:
        text = value_str
    elif label and field_type:
        # Only show label alone for special fields that might not have values yet
        text = label
    else:
        # Skip empty fields
        return
    
    # Handle alignment
    align = field.get('align', 'left')
    if align == 'center':
        c.drawCentredString(x, y, text)
    elif align == 'right':
        c.drawRightString(x, y, text)
    else:
        c.drawString(x, y, text)

