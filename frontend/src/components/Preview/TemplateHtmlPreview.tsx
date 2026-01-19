import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../services/api';
import type { Template, TemplateJson, TextFieldConfig, ItemsTableConfig, ContentDetailsTableConfig, PreviewData } from '../../services/types';
import './TemplateHtmlPreview.css';

interface TemplateHtmlPreviewProps {
  templateId: number;
  parameters: Record<string, any>;
  onError?: (error: string) => void;
}

const TemplateHtmlPreview: React.FC<TemplateHtmlPreviewProps> = ({ templateId, parameters, onError }) => {
  const [template, setTemplate] = useState<Template | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPreview();
  }, [templateId, parameters]);

  const loadPreview = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch template and preview data in parallel
      const [loadedTemplate, data] = await Promise.all([
        apiClient.getTemplate(templateId),
        apiClient.getPreviewData(templateId, parameters),
      ]);

      setTemplate(loadedTemplate);
      setPreviewData(data);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to load preview';
      setError(errorMsg);
      if (onError) onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Resolve bind path (e.g., "header.ItemName" -> data.header?.ItemName)
  const resolveBindPath = (bind: string, data: any): any => {
    if (!bind || !data) return '';
    const parts = bind.split('.');
    let value = data;
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined || value === null) return '';
    }
    return value ?? '';
  };

  // Get field value based on field type and bind
  const getFieldValue = (field: TextFieldConfig, pageNumber?: number, totalPages?: number): string => {
    if (!field.bind || !previewData) return '';

    if (field.fieldType === 'pageNumber') {
      return pageNumber?.toString() || '1';
    }
    if (field.fieldType === 'totalPages') {
      return totalPages?.toString() || '1';
    }
    if (field.fieldType === 'currentDate') {
      return new Date().toLocaleDateString();
    }
    if (field.fieldType === 'currentTime') {
      return new Date().toLocaleTimeString();
    }

    // Regular text field - resolve bind path
    return resolveBindPath(field.bind, previewData)?.toString() || '';
  };

  // Render a text field
  const renderField = (field: TextFieldConfig, pageNumber?: number, totalPages?: number) => {
    if (field.visible === false) return null;

    const value = getFieldValue(field, pageNumber, totalPages);
    const style: React.CSSProperties = {
      position: 'absolute',
      left: `${field.x}px`,
      top: `${field.y}px`,
      fontSize: field.fontSize ? `${field.fontSize}px` : undefined,
      fontWeight: field.fontWeight || 'normal',
      color: field.color || '#000000',
    };

    return (
      <div key={`${field.bind}-${field.x}-${field.y}`} className="template-field" style={style}>
        {value}
      </div>
    );
  };

 

  // Render a table with pagination support (startIndex/endIndex for row splitting)
  const renderTable = (
    tableConfig: ItemsTableConfig | ContentDetailsTableConfig,
    data: Record<string, any>[],
    pageNumber: number,
    _totalPages: number,
    adjustedY?: number,
    startIndex?: number,
    endIndex?: number
  ) => {
    const visibleColumns = (tableConfig.columns || []).filter(col => col.visible !== false);
    if (visibleColumns.length === 0) return null;

    // Slice data if startIndex/endIndex provided (for row pagination)
    let displayData = data;
    if (startIndex !== undefined && endIndex !== undefined) {
      displayData = data.slice(startIndex, endIndex);
    }

    // Show header on first page or repeat header setting
    const showHeader = pageNumber === 1 || true; // TODO: Support repeatHeader config

    // Validation: Determine if this is a new table starting (not a pagination continuation)
    // Use tableConfig.y when:
    // 1. This is a continuation chunk (startIndex > 0) -> use adjustedY (should be 0 for continuation pages)
    // 2. This is the first chunk (startIndex === 0 or undefined):
    //    - If adjustedY is provided and > 0 -> use adjustedY (gap-based positioning from previous elements)
    //    - If adjustedY === 0 or undefined -> use tableConfig.y (new table starting at top of page)
    let topPosition: number;
    if (startIndex !== undefined && startIndex > 0) {
      // Continuation chunk - use adjustedY (should be 0 for continuation pages)
      topPosition = adjustedY !== undefined ? adjustedY : 0;
    } else {
      // First chunk - use tableConfig.y if starting at top, otherwise use adjustedY
      if (adjustedY !== undefined && adjustedY > 0) {
        topPosition = adjustedY; // Gap-based positioning
      } else {
        topPosition = tableConfig.y || 0; // New table starting at top
      }
    }
    console.log(topPosition,tableConfig);
    const style: React.CSSProperties = {
      position: 'relative',
      top: `${topPosition}px`,
      width: tableConfig.tableWidth ? `${tableConfig.tableWidth}px` : 'auto',
      borderColor: tableConfig.borderColor || '#dddddd',
      borderWidth: `${tableConfig.borderWidth || 1}px`,
      borderStyle: 'solid',
      fontSize: tableConfig.fontSize ? `${tableConfig.fontSize}px` : '12px',
    };

    return (
      <div key={`table-${tableConfig.x}-${tableConfig.y}-${startIndex}-${endIndex}`} className="template-table-wrapper" style={style}>
        <table className="template-table">
          {showHeader && (
            <thead>
              <tr style={{
                backgroundColor: tableConfig.headerBackgroundColor || '#f0f0f0',
                color: tableConfig.headerTextColor || '#000000',
              }}>
                {visibleColumns.map((col, idx) => (
                  <th
                    key={idx}
                    style={{
                      padding: `${tableConfig.cellPadding || 10}px`,
                      textAlign: col.align || 'left',
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {displayData.length > 0 ? (
              displayData.map((row, rowIdx) => {
                // Calculate actual row index for alternating colors
                const actualRowIdx = startIndex !== undefined ? startIndex + rowIdx : rowIdx;
                return (
                  <tr
                    key={rowIdx}
                    style={{
                      backgroundColor: actualRowIdx % 2 === 1 ? (tableConfig.alternateRowColor || '#f9f9f9') : 'transparent',
                    }}
                  >
                    {visibleColumns.map((col, colIdx) => {
                      const value = resolveBindPath(col.bind, row)?.toString() || '';
                      return (
                        <td
                          key={colIdx}
                          style={{
                            padding: `${tableConfig.cellPadding || 10}px`,
                            textAlign: col.align || 'left',
                          }}
                        >
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            ) : (
              <tr>
                {visibleColumns.map((_col, colIdx) => (
                  <td
                    key={colIdx}
                    style={{
                      padding: `${tableConfig.cellPadding || 10}px`,
                      textAlign: 'center',
                      color: '#999',
                    }}
                  >
                    -
                  </td>
                ))}
              </tr>
            )}
            {/* Render final rows if they exist - only when table is completely rendered */}
            {tableConfig.finalRows && tableConfig.finalRows.length > 0 && (() => {
              // Check if table is completely rendered (all rows shown)
              // Final rows should only show when:
              // 1. endIndex is undefined (no pagination, all data shown), OR
              // 2. endIndex equals data.length (last chunk of paginated table)
              const isTableComplete = endIndex === undefined || endIndex >= data.length;
              
              if (!isTableComplete) return null;
              
              return tableConfig.finalRows.map((finalRow, rowIndex) => {
                if (finalRow.visible === false) return null;
              
              // Render cells based on the actual cells array, handling column spanning
              let columnIndex = 0;
              
              return (
                <tr 
                  key={`final-${rowIndex}`}
                  style={{
                    backgroundColor: finalRow.backgroundColor || undefined,
                    borderTop: finalRow.borderTop ? `${(tableConfig.borderWidth || 1) * 2}px solid ${tableConfig.borderColor || '#dddddd'}` : undefined,
                  }}
                >
                  {finalRow.cells.map((cell, cellIndex) => {
                    // Get the corresponding visible column for this cell
                    const colForAlignment = visibleColumns[columnIndex] || visibleColumns[visibleColumns.length - 1];
                    
                    // Ensure minimum font size for visibility
                    const tableFontSize = tableConfig.fontSize || 12;
                    const cellFontSize = cell.fontSize || tableFontSize;
                    const minFontSize = Math.max(10, cellFontSize);
                    
                    const cellStyles: React.CSSProperties = {
                      padding: `${tableConfig.cellPadding || 10}px`,
                      border: `${tableConfig.borderWidth || 1}px solid ${tableConfig.borderColor || '#dddddd'}`,
                      textAlign: cell.align || colForAlignment?.align || 'left',
                      fontWeight: cell.fontWeight || 'normal',
                      fontSize: `${minFontSize}px`,
                      color: cell.color || '#000000',
                      backgroundColor: finalRow.backgroundColor || undefined,
                    };
                    
                    // Get cell value based on value type
                    let cellValue = '';
                    if (cell.valueType === 'static') {
                      cellValue = cell.value || cell.label || '';
                    } else if (cell.valueType === 'calculation') {
                      // For preview, show calculation placeholder
                      const calcType = cell.calculationType || 'sum';
                      const source = cell.calculationSource || 'items';
                      const field = cell.calculationField || 'amount';
                      cellValue = `[${calcType}(${source}.${field})]`;
                    } else if (cell.valueType === 'formula') {
                      // For preview, show formula placeholder
                      cellValue = `[${cell.formula || 'formula'}]`;
                    } else {
                      // Default to label if no value type
                      cellValue = cell.label || '';
                    }
                    
                    // If cell value is empty, show a placeholder
                    if (!cellValue || cellValue.trim() === '') {
                      cellValue = '\u00A0'; // Non-breaking space
                    }
                    
                    const colSpan = cell.colSpan || 1;
                    columnIndex += colSpan;
                    
                    return (
                      <td
                        key={cellIndex}
                        colSpan={colSpan}
                        style={cellStyles}
                      >
                        {cellValue}
                      </td>
                    );
                  })}
                  {/* Fill remaining columns if cells don't cover all visible columns */}
                  {columnIndex < visibleColumns.length && (
                    Array.from({ length: visibleColumns.length - columnIndex }).map((_, fillIndex) => (
                      <td
                        key={`fill-${fillIndex}`}
                        style={{
                          padding: `${tableConfig.cellPadding || 10}px`,
                          border: `${tableConfig.borderWidth || 1}px solid ${tableConfig.borderColor || '#dddddd'}`,
                          textAlign: visibleColumns[columnIndex + fillIndex]?.align || 'left',
                        }}
                      >
                        &nbsp;
                      </td>
                    ))
                  )}
                </tr>
              );
            });
            })()}
          </tbody>
        </table>
      </div>
    );
  };

  // Calculate pagination using relative positioning with Y-axis gaps
  const paginatedContent = useMemo(() => {
    if (!template || !previewData) return { pages: [], totalPages: 0 };

    const templateJson: TemplateJson = JSON.parse(template.TemplateJson);
    const sectionHeights = templateJson.sectionHeights || {};
    const pageHeight = templateJson.page.orientation === 'portrait' ? 1123 : 794;
    const containerPadding = 80; // 40px top + 40px bottom

    // Fixed heights (only these are fixed)
    const pageHeaderHeight = sectionHeights.pageHeader || 60;
    const billHeaderHeight = sectionHeights.billHeader || 200;
    const pageFooterHeight = sectionHeights.pageFooter || 60;

    // Available height calculations with fixed sections
    // First page: page_header + bill_header + bill_content + page_footer + padding
    const availableHeightFirstPage = pageHeight - pageHeaderHeight - billHeaderHeight - pageFooterHeight - containerPadding;
    // Subsequent pages: page_header + bill_content + page_footer + padding
    const availableHeightOtherPages = pageHeight - pageHeaderHeight - pageFooterHeight - containerPadding;

    // Get all bill content elements
    const billContentFields = templateJson.billContent || [];
    const billContentTables = templateJson.billContentTables || [];
    const contentDetailsTables = templateJson.contentDetailsTables || [];

    // Build element list with positions (Y is absolute position)
    interface ElementInfo {
      type: 'field' | 'billContentTable' | 'contentDetailTable';
      y: number; // Absolute Y position
      gap: number; // Gap from previous element (calculated after sorting)
      height: number;
      data: any;
    }

    const elements: ElementInfo[] = [];

    // Add fields
    billContentFields.forEach(field => {
      if (field.visible !== false) {
        const fieldHeight = (field.fontSize || 14) * 1.5;
        elements.push({
          type: 'field',
          y: field.y || 0,
          gap: 0, // Will be calculated after sorting
          height: fieldHeight,
          data: field,
        });
      }
    });

    // Add bill content tables
    billContentTables.forEach(table => {
        const fontSize = table.fontSize || 12;
        const cellPadding = table.cellPadding || 10;
        const borderWidth = table.borderWidth || 1;
        const rowHeight = fontSize + (cellPadding * 2) + (borderWidth * 2) + 2;
        const tableItems = previewData.items || [];
        const numItems = tableItems.length;
        const headerHeight = rowHeight;
        // Calculate height including final rows
        const finalRowsHeight = table.finalRows 
          ? table.finalRows.filter(r => r.visible !== false).length * rowHeight 
          : 0;
        const estimatedHeight = headerHeight + (rowHeight * numItems) + finalRowsHeight + 10;

      elements.push({
        type: 'billContentTable',
        y: table.y || 0,
        gap: 0, // Will be calculated after sorting
        height: estimatedHeight,
        data: {
          table,
          rowHeight,
          headerHeight,
          numItems,
        },
      });
    });

    // Add content details tables
    contentDetailsTables.forEach(table => {
      const contentDetailsTable = table as ContentDetailsTableConfig;
      const contentName = contentDetailsTable.contentName;
      // Extract table data directly from contentDetails - same pattern as billContentTable
      const tableData: Record<string, any>[] = (Array.isArray(previewData.contentDetails?.[contentName])
        ? previewData.contentDetails[contentName]
        : []) as Record<string, any>[];

      const fontSize = table.fontSize || 12;
      const cellPadding = table.cellPadding || 10;
      const borderWidth = table.borderWidth || 1;
      const rowHeight = fontSize + (cellPadding * 2) + (borderWidth * 2) + 2;
      const headerHeight = rowHeight;
      const numRows = tableData.length;
      // Calculate height including final rows
      const finalRowsHeight = table.finalRows 
        ? table.finalRows.filter(r => r.visible !== false).length * rowHeight 
        : 0;
      const estimatedHeight = headerHeight + (rowHeight * numRows) + finalRowsHeight + 10;

      elements.push({
        type: 'contentDetailTable',
        y: table.y || 0,
        gap: 0, // Will be calculated after sorting
        height: estimatedHeight,
        data: {
          table: contentDetailsTable,
          data: tableData,
          contentName,
          rowHeight,
          headerHeight,
          numRows,
        },
      });
    });

    // Sort elements by Y position (lowest Y first)
    elements.sort((a, b) => a.y - b.y);

    // Calculate gaps between consecutive elements (relative positioning)
    for (let i = 0; i < elements.length; i++) {
      if (i === 0) {
        // First element: gap is its Y position
        elements[i].gap = elements[i].y;
      } else {
        // Gap is the difference between current Y and previous (Y + height)
        const prevElement = elements[i - 1];
        const prevBottom = prevElement.y + prevElement.height;
        elements[i].gap = Math.max(0, elements[i].y - prevBottom);
      }
    }

    // Calculate total height using relative positioning (gaps)
    let cumulativeY = 0;
    for (let i = 0; i < elements.length; i++) {
      cumulativeY += elements[i].gap; // Add gap from previous
      cumulativeY += elements[i].height; // Add element height
    }

    // Check if bill-content fits on one page using cumulative height
    if (cumulativeY <= availableHeightFirstPage) {
      // Fits on one page - use relative positioning with gaps
      let currentY = 0;
      const tables: Array<{
        table: ItemsTableConfig | ContentDetailsTableConfig;
        type: 'billContentTable' | 'contentDetailTable';
        adjustedY: number;
        startIndex?: number;
        endIndex?: number;
        contentName?: string;
      }> = [];

      // Map elements to output using gaps
      elements.forEach(elem => {
        if (elem.type === 'field') {
          // Fields are handled separately
        } else if (elem.type === 'billContentTable') {
          tables.push({
            table: elem.data.table,
            type: 'billContentTable',
            adjustedY: currentY + elem.gap,
            startIndex: 0,
            endIndex: undefined,
          });
          currentY += elem.gap + elem.height;
        } else if (elem.type === 'contentDetailTable') {
          const cdTable = elem.data.table as ContentDetailsTableConfig;
          tables.push({
            table: cdTable,
            type: 'contentDetailTable',
            adjustedY: currentY + elem.gap,
            contentName: cdTable.contentName,
          });
          currentY += elem.gap + elem.height;
        }
      });

      // Map fields
      let fieldY = 0;
      const fieldsWithGaps = elements
        .filter(e => e.type === 'field')
        .map(e => {
          const adjustedY = fieldY + e.gap;
          fieldY += e.gap + e.height;
          return { field: e.data as TextFieldConfig, adjustedY };
        });

      return {
        pages: [{
          pageNumber: 1,
          fields: fieldsWithGaps,
          tables,
          offsetY: 0,
        }],
        totalPages: 1,
      };
    }

    // Need pagination - distribute elements across pages using relative positioning
    interface PageInfo {
      pageNumber: number;
      fields: Array<{ field: TextFieldConfig; adjustedY: number }>;
      tables: Array<{
        table: ItemsTableConfig | ContentDetailsTableConfig;
        type: 'billContentTable' | 'contentDetailTable';
        adjustedY: number;
        startIndex?: number;
        endIndex?: number;
        contentName?: string;
      }>;
      offsetY: number;
    }

    const pages: PageInfo[] = [];
    let currentPage = 1;
    let currentYOnPage = 0; // Track cumulative Y position on current page using gaps
    let lastTableType: 'billContentTable' | 'contentDetailTable' | null = null; // Track last table type for gap calculation

    for (let elemIdx = 0; elemIdx < elements.length; elemIdx++) {
      const element = elements[elemIdx];
      const elementGap = element.gap; // Gap from previous element
      const elementHeight = element.height; // Element height
      
      // Calculate element's start position on current page (using gap)
      // When starting a new page and element has a Y position, use that as base if switching table types
      let elementStartY = currentYOnPage + elementGap;

      // Determine available height for current page
      const availableHeight = currentPage === 1 ? availableHeightFirstPage : availableHeightOtherPages;

      if (element.type === 'field') {
        // Field - check if it fits with gap
        const fieldHeight = elementHeight;
        const fieldEndY = elementStartY + fieldHeight;

        if (fieldEndY > availableHeight) {
          // Field doesn't fit - start new page
          // Ensure previous page exists
          if (pages.length < currentPage) {
            pages.push({
              pageNumber: currentPage,
              fields: [],
              tables: [],
              offsetY: 0,
            });
          }
          
          currentPage++;
          currentYOnPage = 0; // Reset Y position for new page

          // Add field to new page (gap is not needed at start of new page)
          if (pages.length < currentPage) {
            pages.push({
              pageNumber: currentPage,
              fields: [],
              tables: [],
              offsetY: 0,
            });
          }
          pages[currentPage - 1].fields.push({
            field: element.data,
            adjustedY: 0, // Start from top of new page
          });
          currentYOnPage = fieldHeight; // Update position after field
        } else {
          // Field fits - add to current page using gap
          if (pages.length < currentPage) {
            pages.push({
              pageNumber: currentPage,
              fields: [],
              tables: [],
              offsetY: 0,
            });
          }
          pages[currentPage - 1].fields.push({
            field: element.data,
            adjustedY: elementStartY,
          });
          currentYOnPage = fieldEndY; // Update position after field
        }
      } else if (element.type === 'contentDetailTable') {
        // Content detail table - split rows across pages using gap-based positioning
        const { table, rowHeight, headerHeight, numRows, contentName } = element.data;
        let startIndex = 0;
        let tablePage = currentPage;
        // Use table.y when switching from different table type and starting on new page, otherwise use gap-based position
        const isTableTypeSwitch = lastTableType !== null && lastTableType !== 'contentDetailTable';
        const initialTableStartY = (isTableTypeSwitch && currentYOnPage === 0) ? (table.y || 0) : elementStartY;

        // Handle empty table case (numRows === 0) - just show header once
        if (numRows === 0) {
          // Ensure page exists
          if (pages.length < tablePage) {
            pages.push({
              pageNumber: tablePage,
              fields: [],
              tables: [],
              offsetY: 0,
            });
          }

          // Add empty table (header only) to page using gap or table.y if switching types
          pages[tablePage - 1].tables.push({
            table,
            type: 'contentDetailTable',
            adjustedY: initialTableStartY,
            startIndex: 0,
            endIndex: 0,
            contentName,
          });

          // Update position after table
          currentYOnPage = initialTableStartY + headerHeight;
          lastTableType = 'contentDetailTable';
        } else {
          // Normal case: table has rows - split across pages using gaps
          while (startIndex < numRows) {
            const pageAvailable = tablePage === 1 ? availableHeightFirstPage : availableHeightOtherPages;
            // For first chunk, use initialTableStartY (includes gap or table.y); for subsequent chunks, use table.y if new page and switching types, otherwise 0
            let tableStartY: number;
            if (startIndex === 0) {
              tableStartY = initialTableStartY;
            } else {
              // Check if we're on a new page due to table type switch
              const isNewPageForTypeSwitch = tablePage > 1 && isTableTypeSwitch;
              tableStartY = isNewPageForTypeSwitch ? (table.y || 0) : 0;
            }
            
            // Calculate space available for rows (subtract header and starting position)
            const availableForRows = pageAvailable - tableStartY - headerHeight;

            // Calculate how many rows fit
            const rowsThisPage = Math.max(1, Math.floor(availableForRows / rowHeight));
            const endIndex = Math.min(startIndex + rowsThisPage, numRows);

            // Ensure page exists
            if (pages.length < tablePage) {
              pages.push({
                pageNumber: tablePage,
                fields: [],
                tables: [],
                offsetY: 0,
              });
            }

            // Add table chunk to page
            pages[tablePage - 1].tables.push({
              table,
              type: 'contentDetailTable',
              adjustedY: tableStartY,
              startIndex,
              endIndex,
              contentName,
            });

            // Track table end position for current page
            const tableEndY = tableStartY + headerHeight + ((endIndex - startIndex) * rowHeight);
            currentYOnPage = tableEndY; // Update position

            startIndex = endIndex;
            if (startIndex < numRows) {
              tablePage++;
              currentPage = tablePage;
              currentYOnPage = 0; // Reset for new page
            }
          }
        }

        // Update current page to where table ended
        currentPage = tablePage;
        lastTableType = 'contentDetailTable';
      } else if (element.type === 'billContentTable') {
        // Bill content table - split rows across pages using gap-based positioning
        const { table, rowHeight, headerHeight, numItems } = element.data;
        let startIndex = 0;
        let tablePage = currentPage;
        // Use table.y when switching from different table type and starting on new page, otherwise use gap-based position
        const isTableTypeSwitch = lastTableType !== null && lastTableType !== 'billContentTable';
        const initialTableStartY = (isTableTypeSwitch && currentYOnPage === 0) ? (table.y || 0) : elementStartY;

        while (startIndex < numItems) {
          const pageAvailable = tablePage === 1 ? availableHeightFirstPage : availableHeightOtherPages;
          // For first chunk, use initialTableStartY (includes gap or table.y); for subsequent chunks, use table.y if new page and switching types, otherwise 0
          let tableStartY: number;
          if (startIndex === 0) {
            tableStartY = initialTableStartY;
          } else {
            // Check if we're on a new page due to table type switch
            const isNewPageForTypeSwitch = tablePage > 1 && isTableTypeSwitch;
            tableStartY = isNewPageForTypeSwitch ? (table.y || 0) : 0;
          }
          
          // Calculate space available for rows (subtract header and starting position)
          const availableForRows = pageAvailable - tableStartY - headerHeight;

          // Calculate how many rows fit
          const rowsThisPage = Math.max(1, Math.floor(availableForRows / rowHeight));
          const endIndex = Math.min(startIndex + rowsThisPage, numItems);

          // Ensure page exists
          if (pages.length < tablePage) {
            pages.push({
              pageNumber: tablePage,
              fields: [],
              tables: [],
              offsetY: 0,
            });
          }

          // Add table chunk to page
          pages[tablePage - 1].tables.push({
            table,
            type: 'billContentTable',
            adjustedY: tableStartY,
            startIndex,
            endIndex,
          });

          // Track table end position for current page
          const tableEndY = tableStartY + headerHeight + ((endIndex - startIndex) * rowHeight);
          currentYOnPage = tableEndY; // Update position

          startIndex = endIndex;
          if (startIndex < numItems) {
            tablePage++;
            currentPage = tablePage;
            currentYOnPage = 0; // Reset for new page
          }
        }

        // Update current page to where table ended
        currentPage = tablePage;
        lastTableType = 'billContentTable';
      }
    }

    // Ensure at least one page
    if (pages.length === 0) {
      const tables: Array<{
        table: ItemsTableConfig | ContentDetailsTableConfig;
        type: 'billContentTable' | 'contentDetailTable';
        adjustedY: number;
        startIndex?: number;
        endIndex?: number;
        contentName?: string;
      }> = [];

      
    
      billContentTables.forEach(t => {
        tables.push({
          table: t,
          type: 'billContentTable',
          adjustedY: t.y || 0,
          startIndex: 0,
          endIndex: undefined,
        });
      });

      contentDetailsTables.forEach(t => {
        const cdTable = t as ContentDetailsTableConfig;
        tables.push({
          table: cdTable,
          type: 'contentDetailTable',
          adjustedY: t.y || 0,
          contentName: cdTable.contentName,
        });
      });

      pages.push({
        pageNumber: 1,
        fields: billContentFields.map(f => ({ field: f, adjustedY: f.y || 0 })),
        tables,
        offsetY: 0,
      });
    }

    return {
      pages,
      totalPages: pages.length > 0 ? Math.max(...pages.map(p => p.pageNumber)) : 1,
    };
  }, [template, previewData]);

  if (loading) {
    return <div className="template-html-preview loading">Loading preview...</div>;
  }

  if (error) {
    return <div className="template-html-preview error">Error: {error}</div>;
  }

  if (!template || !previewData) {
    return <div className="template-html-preview">No data available</div>;
  }

  const templateJson: TemplateJson = JSON.parse(template.TemplateJson);
  const sectionHeights = templateJson.sectionHeights || {};
  const pageHeight = templateJson.page.orientation === 'portrait' ? 1123 : 794;
  const pageWidth = templateJson.page.orientation === 'portrait' ? 794 : 1123;

  return (
    <div className="template-html-preview">
      {paginatedContent.pages.map((page, pageIdx) => {
        const pageNumber = pageIdx + 1;
        const totalPages = paginatedContent.totalPages;

        return (
          <div
            key={page.pageNumber}
            className="preview-page"
            style={{
              width: `${pageWidth}px`,
              minHeight: `${pageHeight}px`,
              position: 'relative',
              backgroundColor: '#ffffff',
              margin: '0 auto 20px',
              padding: '20px',
              boxShadow: '0 0 10px rgba(0,0,0,0.1)',
            }}
          >
            {/* Page Header */}
            {templateJson.pageHeader && templateJson.pageHeader.length > 0 && (
              <div
                className="preview-section page-header"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '20px',
                  right: '20px',
                  height: `${sectionHeights.pageHeader || 60}px`,
                  width: 'calc(100% - 40px)',
                }}
              >
                {templateJson.pageHeader.map((field) => renderField(field, pageNumber, totalPages))}
              </div>
            )}

            {/* Bill Header */}
            {templateJson.header && templateJson.header.length > 0 && (
              <div
                className="preview-section bill-header"
                style={{
                  position: 'absolute',
                  top: `${(sectionHeights.pageHeader || 60) + 10}px`,
                  left: '20px',
                  right: '20px',
                  height: `${sectionHeights.billHeader || 200}px`,
                  width: 'calc(100% - 40px)',
                }}
              >
                {templateJson.header.map((field) => renderField(field, pageNumber, totalPages))}
              </div>
            )}

            {/* Bill Content */}
            <div
              className="preview-section bill-content"
              style={{
                position: 'absolute',
                top: `${(sectionHeights.pageHeader || 60) + (sectionHeights.billHeader || 200) + 20}px`,
                left: '20px',
                right: '20px',
                minHeight: `${sectionHeights.billContent || 100}px`,
                width: 'calc(100% - 40px)',
              }}
            >
              {/* Bill Content Fields */}
              {page.fields.map((fieldInfo) => {
                const adjustedField = { ...fieldInfo.field, y: fieldInfo.adjustedY };
                return renderField(adjustedField, pageNumber, totalPages);
              })}

              {/* Tables (bill content and content details) */}
              {page.tables.map((tableInfo) => {
                if (tableInfo.type === 'billContentTable') {
                  const tableData = previewData.items || [];
                  return renderTable(
                    tableInfo.table as ItemsTableConfig,
                    tableData,
                    pageNumber,
                    totalPages,
                    tableInfo.adjustedY,
                    tableInfo.startIndex,
                    tableInfo.endIndex
                  );
                } else if (tableInfo.type === 'contentDetailTable') {
                  const contentDetailsTable = tableInfo.table as ContentDetailsTableConfig;
                  const contentName = tableInfo.contentName || contentDetailsTable.contentName;
                  // Extract table data directly from contentDetails - same pattern as billContentTable
                  const tableData: Record<string, any>[] = (Array.isArray(previewData.contentDetails?.[contentName])
                    ? previewData.contentDetails[contentName]
                    : []) as Record<string, any>[];
                  
                  return renderTable(
                    contentDetailsTable,
                    tableData,
                    pageNumber,
                    totalPages,
                    tableInfo.adjustedY,
                    tableInfo.startIndex,
                    tableInfo.endIndex
                  );
                }
                return null;
              })}
            </div>

            {/* Bill Footer - only render on last page */}
            {templateJson.billFooter && templateJson.billFooter.length > 0 && pageNumber === totalPages && (
              <div
                className="preview-section bill-footer"
                style={{
                  position: 'absolute',
                  bottom: `${(sectionHeights.pageFooter || 60) + 10}px`,
                  left: '20px',
                  right: '20px',
                  height: `${sectionHeights.billFooter || 100}px`,
                  width: 'calc(100% - 40px)',
                }}
              >
                {templateJson.billFooter.map((field) => renderField(field, pageNumber, totalPages))}
              </div>
            )}

            {/* Page Footer */}
            {templateJson.pageFooter && templateJson.pageFooter.length > 0 && (
              <div
                className="preview-section page-footer"
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: '20px',
                  right: '20px',
                  height: `${sectionHeights.pageFooter || 60}px`,
                  width: 'calc(100% - 40px)',
                }}
              >
                {templateJson.pageFooter.map((field) => renderField(field, pageNumber, totalPages))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TemplateHtmlPreview;

