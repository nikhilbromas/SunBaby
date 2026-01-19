# JSON PDF Engine – ReportLab Rendering Rules

## Overview

This document defines the rules and behavior of a JSON-driven PDF rendering engine built using ReportLab.

The engine is designed for billing / report documents where some sections are fixed and others are dynamically positioned based on content length.

The goal is to ensure:
- Predictable layout
- Automatic pagination
- Consistent headers and footers
- Dynamic content flow without overlapping

## Page Structure Definition

Each PDF page is divided into the following logical sections:

1. **Page Header**
2. **Bill Header** (first page only)
3. **Bill Content** (dynamic, multi-page)
4. **Bill Footer** (last page only)
5. **Page Footer**

## Section Rendering Rules

### Page Header

- Rendered on **every page**
- **Fixed height**
- **Fixed position** at the top of the page
- Does not change position regardless of content length

### Page Footer

- Rendered on **every page**
- **Fixed height**
- **Fixed position** at the bottom of the page
- Always visible even when content spans multiple pages

### Bill Header

- Rendered **only on the first page**
- **Fixed height**
- Positioned immediately below the Page Header
- Its height reduces the available space for dynamic content on the first page

### Bill Footer

- Rendered **only on the last page**
- **Fixed height**
- Positioned immediately below the bill content (billcontent table, contentdetails table, fields)
- Reserved space must be maintained while rendering dynamic content

## Height Reservation Rules

The usable vertical space for content on a page is calculated as:

```
Usable Space = Page height
             - Page Header height
             - Page Footer height
             - Bill Header height (first page only)
             - Bill Footer height (last page only)
```

Dynamic content must always respect this reserved space.

## Dynamic Content Flow Rules

### Content Positioning

- All bill content elements are rendered **top to bottom**
- **No absolute Y positions** are allowed for dynamic content
- Each element's Y position is calculated relative to the previous element

### Y Position Calculation Rule

For every dynamic element:

1. **Start position** is the end position of the previous element
2. Add a **vertical gap** (default gap is 2 units unless overridden)

In simple terms:

```
New element Y position = Previous element end Y + gap
```

## Page Break Rules

A page break must occur when:

- The next element's height exceeds the remaining available space on the current page

When a page break happens:

1. A new page is created
2. **Page Header** is rendered
3. **Page Footer** space is reserved
4. **Bill Header** is **not rendered** on subsequent pages
5. Dynamic content continues from the top usable area of the new page

## Last Page Detection Rules

The engine must track whether more content remains to be rendered.

When the engine determines that no more dynamic content exists:

1. The current page becomes the **last page**
2. **Bill Footer** is rendered on this page
3. **Page Footer** is rendered after Bill Footer

## JSON Template Responsibilities

The JSON template must define:

- Page size and orientation
- Fixed heights for:
  - Page Header
  - Page Footer
  - Bill Header
  - Bill Footer
- Default vertical gap between elements
- Content blocks in rendering order
- Data bindings for dynamic content

**The JSON must not contain absolute Y positions for dynamic content.**

## Engine Responsibilities

The PDF engine is responsible for:

- Interpreting JSON layout rules
- Calculating available space per page
- Managing page transitions
- Maintaining correct Y positioning
- Ensuring no overlap between sections
- Rendering headers and footers consistently

## Key Design Principles

1. **Fixed sections** are position-based
2. **Dynamic sections** are flow-based
3. **JSON controls layout intent**, not rendering mechanics
4. **Rendering engine owns pagination logic**
5. Same JSON structure can later support:
   - HTML preview
   - PDF generation
   - Print layouts

## Intended Use Cases

- POS billing systems
- Invoices and receipts
- ERP and accounting reports
- Thermal and A4 print formats
- User-customizable report templates

## Implementation Notes

### Coordinate System

ReportLab uses a coordinate system where:
- **X=0** is at the left edge of the page
- **Y=0** is at the **bottom** of the page
- **Y increases upward** (opposite of typical screen coordinates)

When working with "from top" calculations:
- Convert to ReportLab coordinates: `y_reportlab = page_height - y_from_top`
- Or track positions as "from top" and convert only when rendering

### Section Height Calculation

Section heights can be:
1. **Explicitly defined** in `sectionHeights` configuration
2. **Calculated dynamically** from field positions and sizes
3. **Estimated** based on content when needed

### Dynamic Content Stacking

When multiple dynamic elements are present (fields, tables, contentDetails):

1. Sort elements by their configured Y positions (ascending)
2. Render first element at its configured position
3. For subsequent elements:
   - Calculate proposed position: `previous_element_bottom - gap`
   - Use the **minimum** of proposed position and configured position
   - This ensures stacking while respecting initial spacing

### Table Pagination

Tables that span multiple pages must:

1. Track the last rendered row index
2. Resume rendering on the next page from `last_index + 1`
3. Repeat table headers on each page (if configured)
4. Respect minimum content Y to avoid overlapping with footer

### Bill Footer Placement

Bill footer positioning logic:

1. Calculate desired position: `bill_content_bottom - bill_footer_height - spacing`
2. Calculate minimum allowed position: `page_footer_top + bill_footer_height + spacing`
3. If desired position >= minimum position: render on current page
4. Otherwise: render on next page (which becomes the last page)


