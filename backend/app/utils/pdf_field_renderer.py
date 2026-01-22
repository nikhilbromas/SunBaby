"""
PDF field rendering utilities.
Handles rendering of text fields in PDF documents.
"""
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from typing import Dict, Any, Optional
from datetime import datetime
import logging
import base64
import io
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


def render_image(c: canvas.Canvas, image_field: Dict[str, Any], company_id: Optional[int] = None, content_area_height: Optional[float] = None, page_width: Optional[float] = None):
    """
    Render an image field.
    
    Args:
        c: Canvas object
        image_field: Image field configuration with imageId
        company_id: Optional company ID for database access
        content_area_height: Optional full content area height for watermark scaling
        page_width: Optional page width for watermark scaling
    """
    if not image_field.get('visible', True):
        return
    
    try:
        from app.services.image_service import image_service
        from app.database import db
        from app.utils.company_schema import ensure_company_schema
        
        image_id = image_field.get('imageId')
        if not image_id:
            logger.warning("Image field missing imageId")
            return
        
        # Switch to company DB if needed
        if company_id:
            from app.services.auth_service import auth_service
            details = auth_service.get_company_details(company_id)
            if details:
                db.switch_to_company_db(details)
                ensure_company_schema()
        
        # Get image from database using image_service
        try:
            image = image_service.get_image(image_id, company_id)
        except Exception as e:
            logger.error(f"Error getting image {image_id} from database: {str(e)}", exc_info=True)
            return
            
        if not image:
            logger.warning(f"Image {image_id} not found in database")
            return
        
        # Extract base64 data (remove data URI prefix if present)
        base64_data = image.Base64Data
        if not base64_data:
            logger.error(f"Image {image_id} has no Base64Data")
            return
            
        if base64_data.startswith('data:'):
            # Remove data URI prefix (e.g., "data:image/png;base64,")
            base64_data = base64_data.split(',', 1)[1]
        
        # Decode base64 to bytes
        try:
            image_bytes = base64.b64decode(base64_data)
            image_stream = io.BytesIO(image_bytes)
        except Exception as e:
            logger.error(f"Error decoding base64 data for image {image_id}: {str(e)}")
            return
        
        # Get position and size
        x = image_field.get('x', 0)
        y = image_field.get('y', 0)
        width = image_field.get('width')
        height = image_field.get('height')
        
        # Check if this is a watermark
        is_watermark = image_field.get('watermark', False)
        
        # Use template dimensions if specified, otherwise use original image dimensions
        # For watermarks, use template dimensions (don't force to fill full area)
        # For regular images, use specified dimensions or original image dimensions
        if not width:
            width = image.Width
        if not height:
            height = image.Height
        
        # Log dimension source
        if is_watermark:
            logger.info(f"Watermark using template dimensions: width={width:.1f}, height={height:.1f}, original image size={image.Width}x{image.Height}")
        
        # Log watermark rendering details (after getting dimensions)
        if is_watermark:
            logger.info(f"Rendering watermark: imageId={image_id}, width={width:.1f}, height={height:.1f}, x={x:.1f}, y={y:.1f}, image.Width={image.Width}, image.Height={image.Height}, Base64Data length={len(image.Base64Data) if image.Base64Data else 0}")
            logger.info(f"Watermark dimension analysis: setup_width={width:.1f}, setup_height={height:.1f}, actual_width={width:.1f}, actual_height={height:.1f}, content_area_height={content_area_height if content_area_height else 'N/A'}, page_width={page_width if page_width else 'N/A'}")
        
        # ReportLab's drawImage uses bottom-left corner as anchor
        # The y coordinate passed is already in ReportLab space (from top of image)
        # We need to adjust for image height since drawImage anchors at bottom
        # If y represents the top of the image, subtract height to get bottom position
        # For watermarks, use exact calculation; for regular images, add small offset for alignment
        if is_watermark:
            # Watermarks: exact positioning (no offset)
            # y is the top of the image in ReportLab coordinates, drawImage needs bottom
            draw_y = y - height
            logger.info(f"Watermark draw position: y={y:.1f}, height={height:.1f}, draw_y={draw_y:.1f}, x={x:.1f}")
        else:
            # Regular images: small offset for alignment with text fields
            draw_y = y - height + 20
        
        # For watermarks, apply opacity (alpha transparency)
        if is_watermark:
            # Save current graphics state
            c.saveState()
            # Set opacity (0.0 = fully transparent, 1.0 = fully opaque)
            # Watermarks typically use 0.3-0.4 opacity for better visibility
            # ReportLab uses setFillAlpha and setStrokeAlpha for transparency
            c.setFillAlpha(0.35)
            c.setStrokeAlpha(0.35)
        
        # Create ImageReader and draw image
        img_reader = ImageReader(image_stream)
        # For watermarks, preserve aspect ratio to match preview (use template dimensions)
        # For regular images, also preserve aspect ratio
        c.drawImage(img_reader, x, draw_y, width=width, height=height, preserveAspectRatio=True)
        
        # Restore graphics state if watermark
        if is_watermark:
            c.restoreState()
        
    except Exception as e:
        logger.error(f"Error rendering image {image_field.get('imageId')}: {str(e)}", exc_info=True)
    finally:
        # Switch back to auth DB if we switched
        if company_id:
            try:
                db.switch_to_auth_db()
            except Exception:
                pass

