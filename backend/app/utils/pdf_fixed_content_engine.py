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

from .pdf_field_renderer import render_field, render_image
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
        Uses zoneConfigs if available, falls back to sectionHeights.
        
        Args:
            template_config: Template configuration
            page_height: Page height in points
            
        Returns:
            Dictionary with section heights: pageHeader, pageFooter, billHeader, billFooter
        """
        zone_configs = template_config.get('zoneConfigs', {})
        section_heights_config = template_config.get('sectionHeights', {})
        
        # Use zoneConfigs if available, otherwise use sectionHeights
        if zone_configs:
            # Extract heights from zone configs
            page_header_height = zone_configs.get('pageHeader', {}).get('height', 60)
            page_footer_height = zone_configs.get('pageFooter', {}).get('height', 60)
            bill_header_height = zone_configs.get('billHeader', {}).get('height', 200)
            bill_footer_height = zone_configs.get('billFooter', {}).get('height', 100)
        else:
            # Fallback to sectionHeights
            page_header_height = section_heights_config.get('pageHeader', 60)
            if 'pageHeader' not in section_heights_config:
                page_header_fields = template_config.get('pageHeader', [])
                page_header_height = self._calculate_section_height_from_fields(page_header_fields, 60)
            
            page_footer_height = section_heights_config.get('pageFooter', 60)
            if 'pageFooter' not in section_heights_config:
                page_footer_fields = template_config.get('pageFooter', [])
                page_footer_height = self._calculate_section_height_from_fields(page_footer_fields, 60)
            
            bill_header_height = section_heights_config.get('billHeader', 200)
            if 'billHeader' not in section_heights_config:
                bill_header_fields = template_config.get('header', [])
                bill_header_height = self._calculate_section_height_from_fields(bill_header_fields, 200)
            
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
    
    def get_zone_config(self, template_config: Dict[str, Any], zone_type: str) -> Dict[str, Any]:
        """
        Get zone configuration for a specific zone type.
        
        Args:
            template_config: Template configuration
            zone_type: Zone type ('pageHeader', 'pageFooter', 'billHeader', 'billContent', 'billFooter')
            
        Returns:
            Zone configuration dictionary or empty dict if not found
        """
        zone_configs = template_config.get('zoneConfigs', {})
        return zone_configs.get(zone_type, {})
    
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
        page_context: Dict[str, Any], header_top_y: float, header_height: float, company_id: int = None
    ) -> None:
        """Render page header at fixed position."""
        zone_config = self.get_zone_config(template_config, 'pageHeader')
        page_header_fields = template_config.get('pageHeader', [])
        page_header_images = template_config.get('pageHeaderImages', [])
        
        # Apply zone X offset and margins if configured
        zone_x = zone_config.get('x', 0) if zone_config else 0
        margin_left = zone_config.get('marginLeft', 0) if zone_config else 0
        margin_top = zone_config.get('marginTop', 0) if zone_config else 0
        padding = zone_config.get('padding', 0) if zone_config else 0
        
        for field in page_header_fields:
            if field.get('visible', True):
                x = zone_x + margin_left + padding + field.get('x', 0)
                # Field Y is relative to header top, with margin and padding
                y = header_top_y - (margin_top + padding + field.get('y', 0))
                render_field(c, field, data, x, y, page_context)
        
        for image_field in page_header_images:
            if image_field.get('visible', True):
                x = zone_x + margin_left + padding + image_field.get('x', 0)
                # Image Y is relative to header top, with margin and padding
                y = header_top_y - (margin_top + padding + image_field.get('y', 0))
                image_field_copy = {**image_field, 'y': y}
                render_image(c, image_field_copy, company_id)
    
    def render_page_footer(
        self, c: canvas.Canvas, template_config: Dict[str, Any], data: Dict[str, Any],
        page_context: Dict[str, Any], footer_top_y: float, footer_height: float, company_id: int = None
    ) -> None:
        """Render page footer at fixed position (every page)."""
        zone_config = self.get_zone_config(template_config, 'pageFooter')
        page_footer_fields = template_config.get('pageFooter', [])
        page_footer_images = template_config.get('pageFooterImages', [])
        
        # Apply zone X offset and margins if configured
        zone_x = zone_config.get('x', 0) if zone_config else 0
        margin_left = zone_config.get('marginLeft', 0) if zone_config else 0
        margin_top = zone_config.get('marginTop', 0) if zone_config else 0
        padding = zone_config.get('padding', 0) if zone_config else 0
        
        for field in page_footer_fields:
            if field.get('visible', True):
                x = zone_x + margin_left + padding + field.get('x', 0)
                # Field Y is relative to footer top, with margin and padding
                y = footer_top_y - (margin_top + padding + field.get('y', 0))
                render_field(c, field, data, x, y, page_context)
        
        for image_field in page_footer_images:
            if image_field.get('visible', True):
                x = zone_x + margin_left + padding + image_field.get('x', 0)
                # Image Y is relative to footer top, with margin and padding
                y = footer_top_y - (margin_top + padding + image_field.get('y', 0))
                image_field_copy = {**image_field, 'y': y}
                render_image(c, image_field_copy, company_id)
    
    def render_bill_header(
        self, c: canvas.Canvas, template_config: Dict[str, Any], data: Dict[str, Any],
        page_context: Dict[str, Any], header_top_y: float, header_height: float, company_id: int = None
    ) -> None:
        """Render bill header at fixed position (first page only)."""
        zone_config = self.get_zone_config(template_config, 'billHeader')
        bill_header_fields = template_config.get('header', [])
        bill_header_images = template_config.get('headerImages', [])
        
        # Apply zone X offset and margins if configured
        zone_x = zone_config.get('x', 0) if zone_config else 0
        margin_left = zone_config.get('marginLeft', 0) if zone_config else 0
        margin_top = zone_config.get('marginTop', 0) if zone_config else 0
        padding = zone_config.get('padding', 0) if zone_config else 0
        
        for field in bill_header_fields:
            if field.get('visible', True):
                x = zone_x + margin_left + padding + field.get('x', 0)
                # Field Y is relative to header top, with margin and padding
                y = header_top_y - (margin_top + padding + field.get('y', 0))
                render_field(c, field, data, x, y, page_context)
        
        for image_field in bill_header_images:
            if image_field.get('visible', True):
                x = zone_x + margin_left + padding + image_field.get('x', 0)
                # Image Y is relative to header top, with margin and padding
                y = header_top_y - (margin_top + padding + image_field.get('y', 0))
                image_field_copy = {**image_field, 'y': y}
                render_image(c, image_field_copy, company_id)
    
    def render_bill_footer(
        self, c: canvas.Canvas, template_config: Dict[str, Any], data: Dict[str, Any],
        page_context: Dict[str, Any], footer_top_y: float, footer_height: float, company_id: int = None
    ) -> None:
        """Render bill footer below content (last page only)."""
        zone_config = self.get_zone_config(template_config, 'billFooter')
        bill_footer_fields = template_config.get('billFooter', [])
        bill_footer_images = template_config.get('billFooterImages', [])
        
        # Apply zone X offset and margins if configured
        zone_x = zone_config.get('x', 0) if zone_config else 0
        margin_left = zone_config.get('marginLeft', 0) if zone_config else 0
        margin_top = zone_config.get('marginTop', 0) if zone_config else 0
        padding = zone_config.get('padding', 0) if zone_config else 0
        
        for field in bill_footer_fields:
            if field.get('visible', True):
                x = zone_x + margin_left + padding + field.get('x', 0)
                # Field Y is relative to footer top, with margin and padding
                y = footer_top_y - (margin_top + padding + field.get('y', 0))
                render_field(c, field, data, x, y, page_context)
        
        for image_field in bill_footer_images:
            if image_field.get('visible', True):
                x = zone_x + margin_left + padding + image_field.get('x', 0)
                # Image Y is relative to footer top, with margin and padding
                y = footer_top_y - (margin_top + padding + image_field.get('y', 0))
                image_field_copy = {**image_field, 'y': y}
                render_image(c, image_field_copy, company_id)

