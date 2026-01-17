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

    // Calculate top position - use adjustedY from pagination if provided, otherwise use table's y
    const topPosition = adjustedY !== undefined ? adjustedY : (tableConfig.y || 0);
    
    const style: React.CSSProperties = {
      position: 'absolute',
      left: `${tableConfig.x || 0}px`,
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
                {visibleColumns.map((col, colIdx) => (
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
          </tbody>
        </table>
      </div>
    );
  };

  // Calculate pagination - matching backend logic
  const paginatedContent = useMemo(() => {
    if (!template || !previewData) return { pages: [], totalPages: 0 };

    const templateJson: TemplateJson = JSON.parse(template.TemplateJson);
    const sectionHeights = templateJson.sectionHeights || {};
    const pageHeight = templateJson.page.orientation === 'portrait' ? 1123 : 794;
    const containerPadding = 80; // 40px top + 40px bottom

    const pageHeaderHeight = sectionHeights.pageHeader || 60;
    const billHeaderHeight = sectionHeights.billHeader || 200;
    const pageFooterHeight = sectionHeights.pageFooter || 60;

    // Available height calculations (matching backend)
    // First page: page_header + bill_header + bill_content + page_footer
    const availableHeightFirstPage = pageHeight - pageHeaderHeight - billHeaderHeight - pageFooterHeight - containerPadding;
    // Subsequent pages: page_header + bill_content + page_footer
    const availableHeightOtherPages = pageHeight - pageHeaderHeight - pageFooterHeight - containerPadding;

    // Get all bill content elements
    const billContentFields = templateJson.billContent || [];
    const billContentTables = templateJson.billContentTables || [];
    const contentDetailsTables = templateJson.contentDetailsTables || [];

    // Build element list with positions
    interface ElementInfo {
      type: 'field' | 'billContentTable' | 'contentDetailTable';
      y: number; // Y position (gap from previous element)
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
        const estimatedHeight = headerHeight + (rowHeight * numItems) + 10;

      elements.push({
        type: 'billContentTable',
        y: table.y || 0,
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
      const tableData = previewData.contentDetails?.[contentName]?.data 
        ? (Array.isArray(previewData.contentDetails[contentName].data) 
            ? previewData.contentDetails[contentName].data as Record<string, any>[]
            : [])
        : [];

      const fontSize = table.fontSize || 12;
      const cellPadding = table.cellPadding || 10;
      const borderWidth = table.borderWidth || 1;
      const rowHeight = fontSize + (cellPadding * 2) + (borderWidth * 2) + 2;
      const headerHeight = rowHeight;
      const numRows = tableData.length;
      const estimatedHeight = headerHeight + (rowHeight * numRows) + 10;

      elements.push({
        type: 'contentDetailTable',
        y: table.y || 0,
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

    // Sort elements by Y position
    elements.sort((a, b) => a.y - b.y);

    // Check if bill-content fits on one page
    const maxElementBottom = Math.max(...elements.map(e => e.y + e.height), 0);
    if (maxElementBottom <= availableHeightFirstPage) {
      // Fits on one page - return single page
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

      return {
        pages: [{
          pageNumber: 1,
          fields: billContentFields.map(f => ({ field: f, adjustedY: f.y || 0 })),
          tables,
          offsetY: 0,
        }],
        totalPages: 1,
      };
    }

    // Need pagination - distribute elements across pages
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
        const previousElementEnds: number[] = []; // Track end positions of previous elements

    for (let elemIdx = 0; elemIdx < elements.length; elemIdx++) {
      const element = elements[elemIdx];
      const elemY = element.y; // Gap from previous element

      // Calculate element's start position based on previous elements
      const maxPrevEnd = previousElementEnds.length > 0 ? Math.max(...previousElementEnds) : 0;
      const elementStartY = maxPrevEnd > 0 ? maxPrevEnd : elemY;

      // Determine available height for current page
      const availableHeight = currentPage === 1 ? availableHeightFirstPage : availableHeightOtherPages;

      if (element.type === 'field') {
        // Field - check if it fits
        const fieldHeight = element.height;
        const fieldEndY = elementStartY + fieldHeight;

        if (fieldEndY > availableHeight) {
          // Field doesn't fit - start new page
          if (pages.length === 0 || pages[pages.length - 1].pageNumber === currentPage) {
            // Save current page if it has content
            if (pages.length > 0 && (pages[pages.length - 1].fields.length > 0 || pages[pages.length - 1].tables.length > 0)) {
              // Page already exists, update it
            } else {
              pages.push({
                pageNumber: currentPage,
                fields: [],
                tables: [],
                offsetY: 0,
              });
            }
          }
          currentPage++;
          previousElementEnds.length = 0;

          // Add field to new page
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
          previousElementEnds.push(element.height);
        } else {
          // Field fits - add to current page
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
          previousElementEnds.push(fieldEndY);
        }
      } else if (element.type === 'contentDetailTable') {
        // Content detail table - treat as single unit (no splitting)
        const tableEndY = elementStartY + element.height;

        if (tableEndY > availableHeight) {
          // Table doesn't fit - start new page
          if (pages.length === 0 || pages[pages.length - 1].pageNumber === currentPage) {
            if (pages.length > 0 && (pages[pages.length - 1].fields.length > 0 || pages[pages.length - 1].tables.length > 0)) {
              // Page exists
            } else {
              pages.push({
                pageNumber: currentPage,
                fields: [],
                tables: [],
                offsetY: 0,
              });
            }
          }
          currentPage++;
          previousElementEnds.length = 0;

          // Add table to new page
          if (pages.length < currentPage) {
            pages.push({
              pageNumber: currentPage,
              fields: [],
              tables: [],
              offsetY: 0,
            });
          }
          pages[currentPage - 1].tables.push({
            table: element.data.table,
            type: 'contentDetailTable',
            adjustedY: 0,
            contentName: element.data.contentName,
          });
          previousElementEnds.push(element.height);
        } else {
          // Table fits - add to current page
          if (pages.length < currentPage) {
            pages.push({
              pageNumber: currentPage,
              fields: [],
              tables: [],
              offsetY: 0,
            });
          }
          pages[currentPage - 1].tables.push({
            table: element.data.table,
            type: 'contentDetailTable',
            adjustedY: elementStartY,
            contentName: element.data.contentName,
          });
          previousElementEnds.push(tableEndY);
        }
      } else if (element.type === 'billContentTable') {
        // Bill content table - split rows across pages
        const { table, rowHeight, headerHeight, numItems } = element.data;
        let startIndex = 0;
        let tablePage = currentPage;

        while (startIndex < numItems) {
          const pageAvailable = tablePage === 1 ? availableHeightFirstPage : availableHeightOtherPages;
          const tableStartY = startIndex === 0 && tablePage === currentPage ? elementStartY : 0;
          
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

          // Track table end position
          const tableEndY = tableStartY + headerHeight + ((endIndex - startIndex) * rowHeight);
          if (previousElementEnds.length === 0 || tablePage > currentPage) {
            previousElementEnds.push(tableEndY);
          } else {
            previousElementEnds[previousElementEnds.length - 1] = Math.max(
              previousElementEnds[previousElementEnds.length - 1] || 0,
              tableEndY
            );
          }

          startIndex = endIndex;
          if (startIndex < numItems) {
            tablePage++;
            if (tablePage > currentPage) {
              currentPage = tablePage;
            }
          }
        }

        // Update current page to where table ended
        currentPage = tablePage;
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
                  left: 0,
                  right: 0,
                  height: `${sectionHeights.pageHeader || 60}px`,
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
                  left: 0,
                  right: 0,
                  height: `${sectionHeights.billHeader || 200}px`,
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
                left: 0,
                right: 0,
                minHeight: `${sectionHeights.billContent || 100}px`,
                width: '100%',
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
                  const contentData = previewData.contentDetails?.[tableInfo.contentName || ''];
                  const tableData = contentData?.data
                    ? (Array.isArray(contentData.data) 
                        ? contentData.data as Record<string, any>[]
                        : [])
                    : [];
                  return renderTable(
                    contentDetailsTable,
                    tableData,
                    pageNumber,
                    totalPages,
                    tableInfo.adjustedY
                  );
                }
                return null;
              })}
            </div>

            {/* Bill Footer */}
            {templateJson.billFooter && templateJson.billFooter.length > 0 && (
              <div
                className="preview-section bill-footer"
                style={{
                  position: 'absolute',
                  bottom: `${(sectionHeights.pageFooter || 60) + 10}px`,
                  left: 0,
                  right: 0,
                  height: `${sectionHeights.billFooter || 100}px`,
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
                  left: 0,
                  right: 0,
                  height: `${sectionHeights.pageFooter || 60}px`,
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

