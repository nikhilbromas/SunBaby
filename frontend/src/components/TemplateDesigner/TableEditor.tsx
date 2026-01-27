import React, { useState } from 'react';
import type { ItemsTableConfig, ContentDetailsTableConfig } from '../../services/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import './TableEditor.css';

interface TableEditorProps {
  table: ItemsTableConfig | ContentDetailsTableConfig;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (table: ItemsTableConfig | ContentDetailsTableConfig) => void;
  x?: number;
  y?: number;
  onPositionChange?: (x: number, y: number) => void;
  onDelete?: () => void;
  label?: string;
  relativeToSection?: boolean; // If true, position is relative to parent section, not absolute to canvas
  sampleData?: Record<string, any>[] | null; // Sample data for items or content details
  canvasZoom?: number;
}

const TableEditor: React.FC<TableEditorProps> = ({
  table,
  isSelected,
  onSelect,
  onUpdate,
  x = 20,
  y = 20,
  onPositionChange,
  onDelete,
  label,
  relativeToSection = false,
  sampleData,
  canvasZoom = 1,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x, y });
  const [isResizingWidth, setIsResizingWidth] = useState(false);
  const [isDraggingResize, setIsDraggingResize] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, width: 0 });
  const tableRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setPosition({ x, y });
  }, [x, y]);

  const visibleColumns = table.columns.filter((col) => col.visible);

  const getCellValue = (col: any, rowIndex: number): string => {
    if (!sampleData || !Array.isArray(sampleData) || sampleData.length === 0) {
      return '[Value]';
    }
    
    const row = sampleData[rowIndex] || sampleData[0]; // Use first row if row doesn't exist
    if (!row) return '[Value]';
    
    // Extract field name from binding (e.g., "ItemName" from "items.ItemName" or just "ItemName")
    let fieldName = col.bind;
    if (fieldName.includes('.')) {
      fieldName = fieldName.split('.').pop() || fieldName;
    }
    
    const value = row[fieldName];
    return value !== null && value !== undefined ? String(value) : '[Value]';
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Don't enable resize if clicking on delete button
    if (target.tagName === 'BUTTON' || target.closest('.table-delete') || target.closest('.table-width-resize-handle')) {
      return;
    }
    
    // Enable width resizing mode (show the resize handle)
    setIsResizingWidth(true);
    onSelect();
    e.preventDefault();
    e.stopPropagation();
  };

  // Helper function to get parent section zone
  const getParentSectionZone = (): HTMLElement | null => {
    if (!tableRef.current) return null;
    let parent = tableRef.current.parentElement;
    while (parent && !parent.classList.contains('section-zone')) {
      parent = parent.parentElement;
    }
    return parent;
  };

  // Shared drag start logic for both mouse and touch
  const startDrag = (clientX: number, clientY: number) => {
    const zoom = canvasZoom || 1;
    if (relativeToSection) {
      const parent = getParentSectionZone();
      if (parent) {
        const parentRect = parent.getBoundingClientRect();
        setIsDragging(true);
        // Account for zoom: screen coordinates to canvas coordinates
        setDragStart({ 
          x: (clientX - parentRect.left) / zoom - position.x, 
          y: (clientY - parentRect.top) / zoom - position.y 
        });
      } else {
        setIsDragging(true);
        setDragStart({ x: clientX / zoom - position.x, y: clientY / zoom - position.y });
      }
    } else {
      setIsDragging(true);
      setDragStart({ x: clientX / zoom - position.x, y: clientY / zoom - position.y });
    }
    onSelect();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Only prevent dragging if clicking on the delete button or resize handle
    if (target.tagName === 'BUTTON' || target.closest('.table-delete') || target.closest('.table-width-resize-handle')) {
      return;
    }
    
    startDrag(e.clientX, e.clientY);
    e.preventDefault();
  };

  // Touch event handler for mobile drag
  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    // Only prevent dragging if clicking on the delete button or resize handle
    if (target.tagName === 'BUTTON' || target.closest('.table-delete') || target.closest('.table-width-resize-handle')) {
      return;
    }
    
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      startDrag(touch.clientX, touch.clientY);
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    if (relativeToSection && tableRef.current) {
      // Find the section zone container
      let parent = tableRef.current.parentElement;
      while (parent && !parent.classList.contains('section-zone')) {
        parent = parent.parentElement;
      }
      
      if (parent) {
        const parentRect = parent.getBoundingClientRect();
        const newX = e.clientX - parentRect.left - dragStart.x;
        const newY = e.clientY - parentRect.top - dragStart.y;
        const clampedX = Math.max(0, Math.min(newX, parentRect.width - 100)); // Leave margin
        const clampedY = Math.max(0, Math.min(newY, parentRect.height - 50));
        setPosition({ x: clampedX, y: clampedY });
        if (onPositionChange) {
          onPositionChange(clampedX, clampedY);
        }
        return;
      }
    }
    
    // Absolute positioning (default)
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    setPosition({ x: newX, y: newY });
    if (onPositionChange) {
      onPositionChange(newX, newY);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const getTableStyles = () => {
    const styles: React.CSSProperties = {
      position: relativeToSection ? 'relative' : 'absolute',
      left: `${position.x}px`,
      top: `${position.y}px`,
      cursor: isDragging ? 'grabbing' : 'grab',
      transition: isDragging ? 'none' : undefined,
      willChange: isDragging ? 'transform, left, top' : undefined,
    };
    if (table.tableWidth) {
      styles.width = `${table.tableWidth}px`;
    }
    // Note: Padding and margin can be added to table config types if needed
    // For now, we're using cellPadding for table cell padding
    return styles;
  };

  const getTableInlineStyles = () => {
    const styles: React.CSSProperties = {};
    const fontSize = table.fontSize || 12; // Default to 12px if not set
    styles.fontSize = `${fontSize}px`;
    return styles;
  };

  const getHeaderStyles = () => {
    const fontSize = table.fontSize || 12;
    return {
      backgroundColor: table.headerBackgroundColor || '#f0f0f0',
      color: table.headerTextColor || '#000000',
      padding: `${table.cellPadding || 10}px`,
      border: `${table.borderWidth || 1}px solid ${table.borderColor || '#dddddd'}`,
      fontSize: `${fontSize}px`,
    };
  };

  const getCellStyles = (rowIndex: number = 0) => {
    const fontSize = table.fontSize || 12;
    const baseStyles: React.CSSProperties = {
      padding: `${table.cellPadding || 10}px`,
      border: `${table.borderWidth || 1}px solid ${table.borderColor || '#dddddd'}`,
      fontSize: `${fontSize}px`,
    };
    if (rowIndex % 2 === 1 && table.alternateRowColor) {
      baseStyles.backgroundColor = table.alternateRowColor;
    }
    return baseStyles;
  };

  React.useEffect(() => {
    // Close resize mode when clicking outside
    if (isResizingWidth && !isDraggingResize) {
      const handleClickOutside = (e: MouseEvent) => {
        if (tableRef.current && !tableRef.current.contains(e.target as Node)) {
          setIsResizingWidth(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isResizingWidth, isDraggingResize]);

  React.useEffect(() => {
    if (isDragging) {
      let animationFrameId: number | null = null;
      
      // Shared move logic for both mouse and touch
      const handleMove = (clientX: number, clientY: number) => {
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId);
        }
        
        const zoom = canvasZoom || 1;
        animationFrameId = requestAnimationFrame(() => {
          if (relativeToSection) {
            const parent = getParentSectionZone();
            if (parent) {
              const parentRect = parent.getBoundingClientRect();
              // Convert screen coordinates to canvas coordinates
              const newX = (clientX - parentRect.left) / zoom - dragStart.x;
              const newY = (clientY - parentRect.top) / zoom - dragStart.y;
              // Clamp using canvas dimensions (not screen dimensions)
              const parentWidth = parentRect.width / zoom;
              const parentHeight = parentRect.height / zoom;
              const clampedX = Math.max(0, Math.min(newX, parentWidth - 100));
              const clampedY = Math.max(0, Math.min(newY, parentHeight - 50));
              setPosition({ x: clampedX, y: clampedY });
              if (onPositionChange) {
                onPositionChange(clampedX, clampedY);
              }
              return;
            }
          }
          
          // Absolute positioning
          const newX = clientX / zoom - dragStart.x;
          const newY = clientY / zoom - dragStart.y;
          setPosition({ x: newX, y: newY });
          if (onPositionChange) {
            onPositionChange(newX, newY);
          }
        });
      };

      const handleGlobalMouseMove = (e: MouseEvent) => {
        handleMove(e.clientX, e.clientY);
      };
      
      const handleGlobalTouchMove = (e: TouchEvent) => {
        if (e.touches.length === 1) {
          e.preventDefault(); // Prevent scrolling while dragging
          const touch = e.touches[0];
          handleMove(touch.clientX, touch.clientY);
        }
      };
      
      const handleGlobalMouseUp = () => {
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId);
        }
        setIsDragging(false);
      };
      
      const handleGlobalTouchEnd = () => {
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId);
        }
        setIsDragging(false);
      };
      
      // Add mouse and touch event listeners
      document.addEventListener('mousemove', handleGlobalMouseMove, { passive: true });
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
      document.addEventListener('touchend', handleGlobalTouchEnd);
      document.addEventListener('touchcancel', handleGlobalTouchEnd);
      
      return () => {
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId);
        }
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
        document.removeEventListener('touchmove', handleGlobalTouchMove);
        document.removeEventListener('touchend', handleGlobalTouchEnd);
        document.removeEventListener('touchcancel', handleGlobalTouchEnd);
      };
    }
  }, [isDragging, dragStart, relativeToSection, onPositionChange, canvasZoom]);

  React.useEffect(() => {
    if (isDraggingResize) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - resizeStart.x;
        const newWidth = Math.max(200, resizeStart.width + deltaX); // Minimum width 200px
        onUpdate({ ...table, tableWidth: newWidth });
      };
      
      const handleGlobalMouseUp = () => {
        setIsDraggingResize(false);
      };
      
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDraggingResize, resizeStart, table, onUpdate]);

  return (
    <div
      ref={tableRef}
      className={`table-editor ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${isResizingWidth ? 'resizing-width' : ''}`}
      style={getTableStyles()}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      {label && (
        <div className={cn("mb-1.5 font-bold text-xs text-foreground")}>
          {label}
        </div>
      )}
      <table style={getTableInlineStyles()}>
        <thead>
          <tr>
            {(() => {
              const headerCells = [];
              let colIndex = 0;
              while (colIndex < visibleColumns.length) {
                const col = visibleColumns[colIndex];
                const colSpan = col.colSpan || 1;
                headerCells.push(
                  <th key={colIndex} colSpan={colSpan} style={{ ...getHeaderStyles(), textAlign: col.align || 'left' }}>
                    {col.label}
                  </th>
                );
                colIndex += colSpan;
              }
              return headerCells;
            })()}
          </tr>
        </thead>
        <tbody>
          <tr>
            {(() => {
              const rowCells = [];
              let colIndex = 0;
              while (colIndex < visibleColumns.length) {
                const col = visibleColumns[colIndex];
                const colSpan = col.colSpan || 1;
                rowCells.push(
                  <td key={colIndex} colSpan={colSpan} style={{ ...getCellStyles(0), textAlign: col.align || 'left' }}>
                    {getCellValue(col, 0)}
                  </td>
                );
                colIndex += colSpan;
              }
              return rowCells;
            })()}
          </tr>
          <tr>
            {(() => {
              const rowCells = [];
              let colIndex = 0;
              while (colIndex < visibleColumns.length) {
                const col = visibleColumns[colIndex];
                const colSpan = col.colSpan || 1;
                rowCells.push(
                  <td key={colIndex} colSpan={colSpan} style={{ ...getCellStyles(1), textAlign: col.align || 'left' }}>
                    {getCellValue(col, 1)}
                  </td>
                );
                colIndex += colSpan;
              }
              return rowCells;
            })()}
          </tr>
          {/* Render final rows if they exist */}
          {table.finalRows && table.finalRows.length > 0 && table.finalRows.map((finalRow, rowIndex) => {
            if (finalRow.visible === false) return null;
            
            const baseRowStyles: React.CSSProperties = {};
            if (finalRow.backgroundColor) {
              baseRowStyles.backgroundColor = finalRow.backgroundColor;
            }
            
            // Render cells based on the actual cells array, handling column spanning
            let columnIndex = 0; // Track which visible column we're on
            
            return (
              <tr 
                key={`final-${rowIndex}`} 
                style={{
                  ...baseRowStyles,
                  borderTop: finalRow.borderTop ? `${(table.borderWidth || 1) * 2}px solid ${table.borderColor || '#dddddd'}` : undefined,
                }}
              >
                {finalRow.cells.map((cell, cellIndex) => {
                  // Get the corresponding visible column for this cell
                  const col = visibleColumns[columnIndex] || visibleColumns[visibleColumns.length - 1];
                  
                  // Ensure minimum font size for visibility (at least 10px, or use table fontSize, or cell fontSize)
                  const tableFontSize = table.fontSize || 12;
                  const cellFontSize = cell.fontSize || tableFontSize;
                  const minFontSize = Math.max(10, cellFontSize); // Minimum 10px for visibility
                  
                  const cellStyles: React.CSSProperties = {
                    ...getCellStyles(2 + rowIndex),
                    textAlign: cell.align || col?.align || 'left',
                    fontWeight: cell.fontWeight || 'normal',
                    fontSize: `${minFontSize}px`, // Always set font size with minimum
                    color: cell.color || '#000000', // Default to black if not set
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
                  
                  // If cell value is empty, show a placeholder to ensure visibility
                  if (!cellValue || cellValue.trim() === '') {
                    cellValue = '\u00A0'; // Non-breaking space to maintain cell height
                  }
                  
                  const colSpan = cell.colSpan || 1;
                  // Advance column index by the colspan
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
                      style={{ ...getCellStyles(2 + rowIndex), textAlign: visibleColumns[columnIndex + fillIndex]?.align || 'left' }}
                    >
                      &nbsp;
                    </td>
                  ))
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {isSelected && (
        <>
          <Button 
            variant="destructive" 
            size="icon" 
            className={cn(
              "absolute -top-2.5 -right-2.5 h-7 w-7 rounded-full shadow-lg border-2 border-white",
              "hover:scale-110 transition-transform"
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (onDelete) {
                onDelete();
              } else {
                onUpdate({ ...table, columns: [] });
              }
            }} 
            title="Delete table"
          >
            ×
          </Button>
          {isResizingWidth && (
            <div 
              className="table-width-resize-handle"
              style={{
                position: 'absolute',
                right: '-5px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '10px',
                height: '40px',
                backgroundColor: '#007bff',
                cursor: 'ew-resize',
                borderRadius: '5px',
                zIndex: 1000,
                boxShadow: '0 2px 8px rgba(0, 123, 255, 0.4)',
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (tableRef.current) {
                  const currentWidth = table.tableWidth || tableRef.current.offsetWidth;
                  setResizeStart({ x: e.clientX, width: currentWidth });
                  setIsDraggingResize(true);
                }
              }}
            />
          )}
        </>
      )}
    </div>
  );
};

export default TableEditor;

