"""
Page Balance & Fit Engine - Engine 3
Orchestrates pagination, manages available height, and decides what fits on each page.

Responsibilities:
- Calculate available height per page
- Track fixed content consumption
- Calculate remaining dynamic content budget
- Decide when to break pages
- Prevent zero-row pages
- Guarantee minimum one row per page
"""

from typing import Dict, Any


class PageBalanceFitEngine:
    """
    Engine 3: Page Balance & Fit Engine
    
    Purpose: Orchestrate pagination, manage available height, and decide what fits on each page.
    
    Responsibilities:
    - Calculate available height per page
    - Track fixed content consumption
    - Calculate remaining dynamic content budget
    - Decide when to break pages
    - Prevent zero-row pages
    - Guarantee minimum one row per page
    """
    
    def __init__(self, container_padding: float = 40):
        """
        Initialize Page Balance & Fit Engine.
        
        Args:
            container_padding: Container padding (top + bottom total)
        """
        self.container_padding_top = container_padding
        self.container_padding_bottom = container_padding
        self.container_padding_total = container_padding * 2
    
    def calculate_available_height(
        self, page_height: float, page_num: int, total_pages: int,
        section_heights: Dict[str, float], all_tables_complete: bool = False
    ) -> Dict[str, float]:
        """
        Calculate available height for dynamic content on a page.
        
        Args:
            page_height: Total page height in points
            page_num: Current page number
            total_pages: Total number of pages
            section_heights: Dictionary with section heights (pageHeader, pageFooter, billHeader, billFooter)
            all_tables_complete: Whether all tables have completed rendering (for bill footer height)
            
        Returns:
            Dictionary with:
            - 'available': float - Available height for dynamic content
            - 'start_y': float - Starting Y position (from top)
            - 'min_y': float - Minimum Y position (content bottom floor)
        """
        page_header_height = section_heights['pageHeader']
        page_footer_height = section_heights['pageFooter']
        bill_header_height = section_heights['billHeader'] if page_num == 1 else 0
        # CRITICAL: Only reserve bill footer height when all tables are complete (not based on page_num == total_pages)
        # because total_pages changes during rendering as pages are extended
        bill_footer_height = section_heights['billFooter'] if all_tables_complete else 0
        
        # Calculate available height
        # Total page height minus all fixed sections and container padding
        available = page_height - page_header_height - page_footer_height - bill_header_height - bill_footer_height - self.container_padding_total
        
        # Starting Y position (from top of page, accounting for container padding)
        start_y = page_height - self.container_padding_top
        
        # Minimum Y position (content must not go below this)
        # CRITICAL: Only reserve space for bill footer when all tables are complete
        # (not based on page_num == total_pages, which changes during rendering)
        spacing = 20  # Spacing between content and bill footer
        if all_tables_complete:
            bill_footer_requirement = self.container_padding_bottom + page_footer_height + bill_footer_height + spacing + 10
            page_footer_requirement = self.container_padding_bottom + page_footer_height + 10
            min_y = max(bill_footer_requirement, page_footer_requirement)
        else:
            min_y = self.container_padding_bottom + page_footer_height + 10
        
        return {
            'available': available,
            'start_y': start_y,
            'min_y': min_y
        }
    
    def calculate_bill_footer_position(
        self, content_bottom_y: float, bill_footer_height: float,
        page_height: float, page_footer_height: float, container_padding_bottom: float
    ) -> float:
        """
        Calculate bill footer position relative to content bottom.
        
        Args:
            content_bottom_y: Bottom Y position of content (from top)
            bill_footer_height: Height of bill footer
            page_height: Total page height
            page_footer_height: Height of page footer
            container_padding_bottom: Container bottom padding
            
        Returns:
            Bill footer top Y position (from top)
        """
        spacing = 20  # Spacing between content and bill footer
        
        # Desired position: content bottom - spacing - footer height
        desired_bill_footer_top = content_bottom_y - bill_footer_height - spacing
        
        # Minimum allowed position: above page footer
        min_bill_footer_top = container_padding_bottom + page_footer_height + bill_footer_height + 10
        
        # Ensure bill footer doesn't overlap with content
        if desired_bill_footer_top >= content_bottom_y:
            desired_bill_footer_top = content_bottom_y - bill_footer_height - spacing
        
        # Use maximum of desired and minimum
        bill_footer_top_y = max(desired_bill_footer_top, min_bill_footer_top)
        
        return bill_footer_top_y
    
    def check_element_fits(
        self, element_height: float, available_height: float
    ) -> bool:
        """
        Check if an element fits in available height.
        
        Args:
            element_height: Height of the element
            available_height: Available height
            
        Returns:
            True if element fits, False otherwise
        """
        return element_height <= available_height
    
    def should_break_page(
        self, element_height: float, available_height: float,
        min_row_guarantee: bool = True
    ) -> bool:
        """
        Decide if a page break is needed.
        
        Args:
            element_height: Height of the element
            available_height: Available height
            min_row_guarantee: Whether to guarantee minimum one row per page
            
        Returns:
            True if page break is needed, False otherwise
        """
        if min_row_guarantee:
            # For tables, allow element if it's the first element on page (minimum row guarantee)
            # This prevents zero-row pages
            if available_height <= 0:
                return False  # Will force at least one row attempt
        
        return element_height > available_height
    
    def validate_page_content(
        self, page_num: int, elements_rendered: int,
        cursor_state: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Validate page content and check for continuation requirements.
        
        Args:
            page_num: Current page number
            elements_rendered: Number of elements rendered on this page
            cursor_state: Cursor state dictionary
            
        Returns:
            Dictionary with:
            - 'valid': bool - Whether page is valid
            - 'needs_continuation': List[str] - List of table keys needing continuation
            - 'warnings': List[str] - List of warning messages
        """
        needs_continuation = []
        warnings = []
        
        # Check for tables that need continuation
        for table_key, state in cursor_state.items():
            last_index = state.get('last_index', -1)
            total_items = state.get('total_items', 0)
            all_rows_rendered = state.get('all_rows_rendered', False)
            
            # Table needs continuation if it has remaining data
            if not all_rows_rendered and last_index < total_items - 1:
                needs_continuation.append(table_key)
        
        # Check for zero-row pages (warning only, not fatal)
        if elements_rendered == 0 and page_num > 1:
            warnings.append(f"Page {page_num} rendered 0 elements. This may indicate pagination issues.")
        
        # Page is valid if we have content or continuation is expected
        valid = elements_rendered > 0 or len(needs_continuation) > 0
        
        return {
            'valid': valid,
            'needs_continuation': needs_continuation,
            'warnings': warnings
        }
    
    def get_tables_needing_continuation(
        self, bill_content_elements: list, cursor_state: Dict[str, Any], page_num: int
    ) -> list:
        """
        Get tables that need continuation on the next page.
        
        Note: bill_content_elements includes both fields and tables:
        - 'field' elements: billContent text fields (render once, no continuation needed)
        - 'billContentTable' elements: Main content tables (may need continuation)
        - 'contentDetailTable' elements: Content detail tables (may need continuation)
        
        This method only processes tables, as fields don't require continuation.
        
        A table needs continuation if:
        - It has data remaining (last_index < total_items - 1)
        - It hasn't been marked as all_rows_rendered
        
        Args:
            bill_content_elements: List of bill content elements (fields and tables)
            cursor_state: Cursor state dictionary
            page_num: Current page number
            
        Returns:
            List of table elements needing continuation (fields are excluded)
        """
        tables_needing_continuation = []
        
        for element in bill_content_elements:
            # Only process tables - fields don't need continuation (they render once)
            if element['type'] in ['billContentTable', 'contentDetailTable']:
                table_config = element['config']
                items = element.get('data', [])
                
                if element['type'] == 'billContentTable':
                    table_key = f"billContentTable_{table_config.get('x', 0)}_{table_config.get('y', 0)}"
                else:
                    content_name = element.get('content_name')
                    table_key = f"contentDetailTable_{content_name}_{table_config.get('x', 0)}_{table_config.get('y', 0)}"
                
                if table_key in cursor_state:
                    state = cursor_state[table_key]
                    last_index = state.get('last_index', -1)
                    total_items = state.get('total_items', 0)
                    all_rows_rendered = state.get('all_rows_rendered', False)
                    
                    # Table needs continuation if it has remaining data
                    if not all_rows_rendered and last_index < total_items - 1:
                        tables_needing_continuation.append(element)
        
        return tables_needing_continuation

