"""
Fixed Content Render Engine - Engine 1
Handles rendering of fixed-position, fixed-height content.

Responsibilities:
- Page Header (every page)
- Page Footer (every page)
- Bill Header (first page only)
- Bill Footer (last page only)
- Calculate section heights
"""

from reportlab.pdfgen import canvas
from typing import Dict, Any, List
import logging

from .pdf_field_renderer import render_field
from .pdf_table_renderer import calculate_bill_footer_height

logger = logging.getLogger(__name__)


class FixedContentRenderEngine:
    """
    Engine 1: Fixed Content Render Engine
    
    Purpose: Render fixed-position, fixed-height content that doesn't depend on data length.
    
    Handles:
    - Page Header (every page)
    - Page Footer (every page)
    - Bill Header (first page only)
    - Bill Footer (last page only)
    - Section height calculations
    """
    
    def calculate_section_heights(
        self, template_config: Dict[str, Any], page_height: float
    ) -> Dict[str, float]:
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
    
    def render_page_header(
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
    
    def render_page_footer(
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
    
    def render_bill_header(
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
    
    def render_bill_footer(
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

