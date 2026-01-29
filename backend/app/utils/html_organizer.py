"""
HTML organizer for reorganizing bill-content and bill-footer sections
and fixing pagination in generated HTML.
"""
import re
import json
from typing import Dict, Any, List, Tuple
from bs4 import BeautifulSoup


class HtmlOrganizer:
    """Organizes and fixes HTML bill-content and bill-footer pagination."""
    
    def __init__(self):
        """Initialize HTML organizer."""
        pass
    
    def organize_html(self, html: str, template_json: str) -> str:
        """
        Organize HTML bill-content and bill-footer sections and fix pagination.
        
        Args:
            html: Generated HTML string
            template_json: Template JSON string for configuration
            
        Returns:
            Reorganized HTML string
        """
        try:
            template_config = json.loads(template_json)
            soup = BeautifulSoup(html, 'html.parser')
            
            # Get section heights from template
            section_heights = template_config.get('sectionHeights', {})
            page_header_height = section_heights.get('pageHeader', 180)
            page_footer_height = section_heights.get('pageFooter', 175)
            bill_header_height = section_heights.get('billHeader', 200)
            
            # Page height (A4: 1123px)
            page_height = 1123
            
            # Available height per page (page height - page header - page footer)
            available_height_first_page = page_height - page_header_height - page_footer_height - bill_header_height
            available_height_other_pages = page_height - page_header_height - page_footer_height
            
            # Find all bill pages
            bill_pages = soup.find_all('div', class_='bill-page')
            
            if not bill_pages:
                return html
            
            # Collect all bill-content elements from all pages, preserving order
            all_content_items = []  # List of all elements (tables, fields) with their original Y positions
            all_bill_footers = []
            
            for page_idx, page in enumerate(bill_pages):
                bill_content = page.find('div', class_='bill-content')
                bill_footer = page.find('div', class_='bill-footer')
                
                if bill_content:
                    # Extract all tables and fields from this bill-content
                    # Get all child divs and preserve their order
                    children = bill_content.find_all(['div'], recursive=False)
                    
                    for child in children:
                        if 'bill-content-table' in child.get('class', []):
                            all_content_items.append({
                                'type': 'table',
                                'element': child,
                                'original_page': page,
                                'original_page_idx': page_idx,
                                'y_pos': self._get_top_from_style(child.get('style', ''))
                            })
                        elif 'field' in child.get('class', []):
                            all_content_items.append({
                                'type': 'field',
                                'element': child,
                                'original_page': page,
                                'original_page_idx': page_idx,
                                'y_pos': self._get_top_from_style(child.get('style', ''))
                            })
                
                if bill_footer:
                    all_bill_footers.append({
                        'page': page,
                        'footer': bill_footer,
                        'page_idx': page_idx
                    })
            
            # Sort content items by their Y position to maintain order
            all_content_items.sort(key=lambda x: (x['original_page_idx'], x['y_pos']))
            
            # Reorganize all content items across pages
            reorganized = self._reorganize_content_items_simple(
                all_content_items,
                bill_pages,
                available_height_first_page,
                available_height_other_pages,
                bill_header_height
            )
            
            # Place bill-footer on the last page with content
            if all_bill_footers and reorganized:
                last_content_page_idx = max(item['target_page_idx'] for item in reorganized if 'target_page_idx' in item)
                self._place_bill_footer_optimized(
                    all_bill_footers,
                    last_content_page_idx,
                    bill_pages,
                    bill_header_height,
                    reorganized
                )
            
            # Try to consolidate last page content onto previous page
            self._consolidate_last_page(bill_pages, available_height_first_page, available_height_other_pages, bill_header_height)
            
            # Remove empty pages (pages with no bill-content or only empty bill-content)
            self._remove_empty_pages(bill_pages)
            
            return str(soup)
            
        except Exception as e:
            pass
            return html
    
    def _reorganize_content_items_simple(
        self,
        all_content_items: List[Dict],
        bill_pages: List,
        available_height_first: float,
        available_height_other: float,
        bill_header_height: float
    ) -> List[Dict]:
        """
        Reorganize all content items (tables and fields) across pages.
        
        Returns:
            List of reorganized items with target_page_idx info
        """
        if not all_content_items:
            return []
        
        # Get soup object from first element to create new tags
        soup = None
        if all_content_items:
            soup = all_content_items[0]['element']
            # Navigate up to find the BeautifulSoup object
            while soup and hasattr(soup, 'parent') and soup.parent:
                if hasattr(soup, 'new_tag'):  # BeautifulSoup object has new_tag method
                    break
                soup = soup.parent
        
        # Fallback: get soup from bill_pages
        if not soup or not hasattr(soup, 'new_tag'):
            if bill_pages:
                soup = bill_pages[0]
                while soup and hasattr(soup, 'parent') and soup.parent:
                    if hasattr(soup, 'new_tag'):
                        break
                    soup = soup.parent
        
        reorganized = []
        current_page_idx = 0
        current_height = 0
        available_height = available_height_first
        
        # Create or find bill-content containers for each page
        page_content_containers = {}
        for idx, page in enumerate(bill_pages):
            bill_content = page.find('div', class_='bill-content')
            if not bill_content:
                # Create bill-content container if soup is available
                if soup and hasattr(soup, 'new_tag'):
                    bill_content = soup.new_tag('div', class_='bill-content', style='position: relative; top: 0px;')
                    bill_container = page.find('div', class_='bill-container')
                    if bill_container:
                        # Insert after bill-header if exists, otherwise after page-header
                        bill_header = page.find('div', class_='bill-header')
                        if bill_header:
                            bill_header.insert_after(bill_content)
                        else:
                            page_header = page.find('div', class_='page-header')
                            if page_header:
                                page_header.insert_after(bill_content)
                else:
                    # Can't create, skip this page
                    continue
            page_content_containers[idx] = bill_content
        
        # Process each content item
        for item in all_content_items:
            element = item['element']
            element_type = item['type']
            y_pos = item.get('y_pos', 0)  # Y position is gap from previous element
            
            # Calculate element height
            element_height = self._calculate_element_height(element, element_type)
            
            # Calculate adjusted position: Y is gap from previous element
            if len(reorganized) == 0:
                # First element - use Y as absolute position
                adjusted_y = y_pos
            else:
                # Subsequent element - use Y as gap from previous element
                prev_item = reorganized[-1]
                if prev_item['target_page_idx'] == current_page_idx:
                    # Previous element on same page - use its end + Y gap
                    prev_end = prev_item['offset_y'] + prev_item['height']
                    adjusted_y = prev_end + y_pos  # Y is gap from previous element
                else:
                    # Previous element on different page - use Y as gap from top of new page
                    adjusted_y = y_pos
                    # Update current_height for new page
                    current_height = 0
            
            # Check if element fits on current page
            if adjusted_y + element_height <= available_height:
                # Element fits, place on current page
                target_container = page_content_containers.get(current_page_idx)
                if not target_container:
                    continue
                
                # Move element to target container
                element.extract()
                target_container.append(element)
                
                # Update element position
                new_style = element.get('style', '')
                new_style = self._update_style_top(new_style, adjusted_y)
                element['style'] = new_style
                
                reorganized.append({
                    'element': element,
                    'target_page_idx': current_page_idx,
                    'offset_y': adjusted_y,
                    'height': element_height
                })
                
                current_height = adjusted_y + element_height
            else:
                # Element doesn't fit, move to next page
                current_page_idx += 1
                if current_page_idx >= len(bill_pages):
                    # Can't fit, skip (shouldn't normally happen)
                    continue
                
                available_height = available_height_other
                current_height = 0
                
                target_container = page_content_containers.get(current_page_idx)
                if not target_container:
                    continue
                
                # On new page, use Y as gap from top
                adjusted_y = y_pos
                
                # Move element to target container
                element.extract()
                target_container.append(element)
                
                # Update element position
                new_style = element.get('style', '')
                new_style = self._update_style_top(new_style, adjusted_y)
                element['style'] = new_style
                
                reorganized.append({
                    'element': element,
                    'target_page_idx': current_page_idx,
                    'offset_y': adjusted_y,
                    'height': element_height
                })
                
                current_height = adjusted_y + element_height
        
        return reorganized
    
    def _calculate_element_height(self, element: BeautifulSoup, element_type: str) -> float:
        """
        Calculate the actual height of a content element (table or field).
        """
        if element_type == 'table':
            table = element.find('table')
            if table:
                rows = table.find_all('tr')
                if rows:
                    # Calculate row height based on padding and borders
                    # Get padding from first cell if available
                    first_cell = table.find('td') or table.find('th')
                    cell_padding = 10  # Default
                    if first_cell:
                        cell_style = first_cell.get('style', '')
                        padding_match = re.search(r'padding:\s*(\d+)px', cell_style)
                        if padding_match:
                            cell_padding = int(padding_match.group(1))
                    
                    # Row height: padding top + padding bottom + border top + border bottom + text height
                    # Assuming border is 1px and text is ~15px
                    row_height = (cell_padding * 2) + 2 + 15  # ~37px per row
                    return row_height * len(rows)
            return 50  # Minimum table height
        else:  # field
            # Estimate field height based on font size or default
            style = element.get('style', '')
            # Try to get font-size from style or estimate
            font_size_match = re.search(r'font-size:\s*(\d+)px', style)
            if font_size_match:
                font_size = int(font_size_match.group(1))
                return font_size * 1.5  # Estimate height
            return 20  # Default field height
    
    def _get_top_from_style(self, style: str) -> float:
        """
        Extract top value from style string.
        """
        if not style:
            return 0
        top_match = re.search(r'top:\s*(\d+\.?\d*)px', style)
        if top_match:
            return float(top_match.group(1))
        return 0
    
    def _update_style_top(self, style: str, new_top: float) -> str:
        """
        Update or add top value in style string.
        """
        if 'top:' in style:
            style = re.sub(r'top:\s*\d+\.?\d*px', f'top: {new_top}px', style)
        else:
            style = f'{style}; top: {new_top}px' if style else f'top: {new_top}px'
        return style
    
    def _place_bill_footer_optimized(
        self,
        bill_footers: List[Dict],
        last_content_page_idx: int,
        bill_pages: List,
        bill_header_height: float,
        reorganized_items: List[Dict]
    ):
        """
        Place bill-footer on the last page with bill-content, calculating position correctly.
        """
        if not bill_footers:
            return
        
        # Get the last bill-footer
        last_footer = bill_footers[-1]['footer']
        
        # Find the target page
        target_page = bill_pages[last_content_page_idx] if last_content_page_idx < len(bill_pages) else bill_pages[-1]
        
        # Find bill-content on target page and calculate max bottom
        bill_content = target_page.find('div', class_='bill-content')
        if bill_content:
            # Calculate the maximum bottom position of all elements in bill-content
            max_bottom = 0
            
            tables = bill_content.find_all('div', class_='bill-content-table')
            fields = bill_content.find_all('div', class_='field')
            
            for table in tables:
                table_top = self._get_top_from_style(table.get('style', ''))
                table_height = self._calculate_element_height(table, 'table')
                max_bottom = max(max_bottom, table_top + table_height)
            
            for field in fields:
                field_top = self._get_top_from_style(field.get('style', ''))
                field_height = self._calculate_element_height(field, 'field')
                max_bottom = max(max_bottom, field_top + field_height)
            
            # Calculate footer position: bill_header_height + max_bottom + spacing
            footer_top = bill_header_height + max_bottom + 20  # 20px spacing
            
            # Update footer position
            footer_style = last_footer.get('style', '')
            footer_style = self._update_style_top(footer_style, footer_top)
            # Ensure position is relative
            if 'position:' not in footer_style:
                footer_style = f'{footer_style}; position: relative;'
            last_footer['style'] = footer_style
        
        # Remove footer from other pages
        for footer_item in bill_footers[:-1]:  # Keep only last footer
            footer_item['footer'].decompose()
        
        # Move footer to target page if not already there
        if last_footer.parent != target_page:
            target_page.append(last_footer)
    
    def _consolidate_last_page(
        self,
        bill_pages: List,
        available_height_first: float,
        available_height_other: float,
        bill_header_height: float
    ):
        """
        Try to move content from the last page to the previous page if there's space.
        This consolidates pages so we don't have a separate last page with just a field and footer.
        """
        if len(bill_pages) < 2:
            return
        
        last_page = bill_pages[-1]
        prev_page = bill_pages[-2]
        
        # Get content from last page
        last_bill_content = last_page.find('div', class_='bill-content')
        last_bill_footer = last_page.find('div', class_='bill-footer')
        
        if not last_bill_content and not last_bill_footer:
            return
        
        # Get content from previous page
        prev_bill_content = prev_page.find('div', class_='bill-content')
        if not prev_bill_content:
            return
        
        # Calculate available space on previous page
        # Determine if previous page is first page (has bill-header)
        prev_has_bill_header = prev_page.find('div', class_='bill-header') is not None
        available_height = available_height_first if prev_has_bill_header else available_height_other
        
        # Calculate current content height on previous page
        prev_content_height = self._calculate_page_content_height(prev_bill_content)
        
        # Calculate last page content height
        last_content_height = 0
        if last_bill_content:
            last_content_height = self._calculate_page_content_height(last_bill_content)
        
        # Calculate bill-footer height
        footer_height = 0
        if last_bill_footer:
            footer_height = 100  # Estimate footer height
        
        # Check if we can fit last page content + footer on previous page
        total_new_content = last_content_height + footer_height + 20  # 20px spacing
        remaining_space = available_height - prev_content_height
        
        # Always try to consolidate if last page has minimal content (just a field and footer)
        # or if there's enough space
        last_page_has_minimal_content = (
            last_content_height < 100 and  # Less than 100px of content
            (not last_bill_content or len(last_bill_content.find_all(['div'], recursive=False)) <= 2)
        )
        
        if total_new_content <= remaining_space or last_page_has_minimal_content:
            # Can fit, move content
            prev_max_bottom = self._get_max_bottom(prev_bill_content)
            
            # Move bill-content items from last page to previous page
            if last_bill_content:
                tables = last_bill_content.find_all('div', class_='bill-content-table')
                fields = last_bill_content.find_all('div', class_='field')
                
                for table in tables:
                    table.extract()
                    # Update position relative to previous page content
                    current_top = self._get_top_from_style(table.get('style', ''))
                    new_top = prev_max_bottom + current_top
                    new_style = self._update_style_top(table.get('style', ''), new_top)
                    table['style'] = new_style
                    prev_bill_content.append(table)
                    # Update prev_max_bottom
                    table_height = self._calculate_element_height(table, 'table')
                    prev_max_bottom = new_top + table_height
                
                for field in fields:
                    field.extract()
                    # Update position relative to previous page content
                    current_top = self._get_top_from_style(field.get('style', ''))
                    new_top = prev_max_bottom + current_top
                    new_style = self._update_style_top(field.get('style', ''), new_top)
                    field['style'] = new_style
                    prev_bill_content.append(field)
                    # Update prev_max_bottom
                    field_height = self._calculate_element_height(field, 'field')
                    prev_max_bottom = new_top + field_height
            
            # Move bill-footer to previous page
            if last_bill_footer:
                last_bill_footer.extract()
                # Calculate footer position: max content bottom + spacing
                # If previous page has bill-header, account for it, otherwise just use content bottom
                if prev_has_bill_header:
                    footer_top = bill_header_height + prev_max_bottom + 20
                else:
                    footer_top = prev_max_bottom + 20
                footer_style = self._update_style_top(last_bill_footer.get('style', ''), footer_top)
                if 'position:' not in footer_style:
                    footer_style = f'{footer_style}; position: relative;'
                last_bill_footer['style'] = footer_style
                prev_page.append(last_bill_footer)
    
    def _calculate_page_content_height(self, bill_content) -> float:
        """
        Calculate total height of all content in bill-content section.
        """
        if not bill_content:
            return 0
        
        max_bottom = 0
        tables = bill_content.find_all('div', class_='bill-content-table')
        fields = bill_content.find_all('div', class_='field')
        
        for table in tables:
            table_top = self._get_top_from_style(table.get('style', ''))
            table_height = self._calculate_element_height(table, 'table')
            max_bottom = max(max_bottom, table_top + table_height)
        
        for field in fields:
            field_top = self._get_top_from_style(field.get('style', ''))
            field_height = self._calculate_element_height(field, 'field')
            max_bottom = max(max_bottom, field_top + field_height)
        
        return max_bottom
    
    def _get_max_bottom(self, bill_content) -> float:
        """
        Get the maximum bottom position of all elements in bill-content.
        """
        return self._calculate_page_content_height(bill_content)
    
    def _remove_empty_pages(self, bill_pages: List):
        """
        Remove pages that only contain page-header and page-footer (no bill-content or bill-footer).
        """
        pages_to_remove = []
        
        for page in bill_pages:
            bill_content = page.find('div', class_='bill-content')
            bill_footer = page.find('div', class_='bill-footer')
            bill_header = page.find('div', class_='bill-header')
            
            # Check if page has meaningful content
            has_content = False
            
            if bill_content:
                # Check if bill-content has actual content (tables or fields)
                tables = bill_content.find_all('div', class_='bill-content-table')
                fields = bill_content.find_all('div', class_='field')
                if tables or fields:
                    has_content = True
            
            if bill_footer or bill_header:
                has_content = True
            
            # If no content, mark for removal
            if not has_content:
                pages_to_remove.append(page)
        
        # Remove empty pages
        for page in pages_to_remove:
            # Also remove the page-break before it if exists
            prev_sibling = page.find_previous_sibling()
            if prev_sibling and 'page-break' in prev_sibling.get('class', []):
                prev_sibling.decompose()
            page.decompose()


# Create global instance
html_organizer = HtmlOrganizer()

