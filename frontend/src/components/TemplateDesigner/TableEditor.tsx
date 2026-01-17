import React, { useState } from 'react';
import type { ItemsTableConfig, ContentDetailsTableConfig } from '../../services/types';
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
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x, y });
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

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Only prevent dragging if clicking on the delete button
    if (target.tagName === 'BUTTON' || target.closest('.table-delete')) {
      return;
    }
    
    // Allow dragging when clicking on table cells (TD/TH) or anywhere on the table
    // This makes the entire table draggable when selected
    if (relativeToSection && tableRef.current) {
      // Find the section zone container (parent with section-zone class)
      let parent = tableRef.current.parentElement;
      while (parent && !parent.classList.contains('section-zone')) {
        parent = parent.parentElement;
      }
      
      if (parent) {
        const parentRect = parent.getBoundingClientRect();
        setIsDragging(true);
        setDragStart({ 
          x: e.clientX - parentRect.left - position.x, 
          y: e.clientY - parentRect.top - position.y 
        });
      } else {
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
      }
    } else {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
    
    onSelect();
    e.preventDefault();
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
    if (isDragging) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
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
            const clampedX = Math.max(0, Math.min(newX, parentRect.width - 100));
            const clampedY = Math.max(0, Math.min(newY, parentRect.height - 50));
            setPosition({ x: clampedX, y: clampedY });
            if (onPositionChange) {
              onPositionChange(clampedX, clampedY);
            }
            return;
          }
        }
        
        // Absolute positioning
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;
        setPosition({ x: newX, y: newY });
        if (onPositionChange) {
          onPositionChange(newX, newY);
        }
      };
      
      const handleGlobalMouseUp = () => {
        setIsDragging(false);
      };
      
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging, dragStart, relativeToSection, onPositionChange]);

  return (
    <div
      ref={tableRef}
      className={`table-editor ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
      style={getTableStyles()}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {label && (
        <div className="table-label" style={{ marginBottom: '5px', fontWeight: 'bold', fontSize: '12px' }}>
          {label}
        </div>
      )}
      <table style={getTableInlineStyles()}>
        <thead>
          <tr>
            {visibleColumns.map((col, index) => (
              <th key={index} style={{ ...getHeaderStyles(), textAlign: col.align || 'left' }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {visibleColumns.map((col, index) => (
              <td key={index} style={{ ...getCellStyles(0), textAlign: col.align || 'left' }}>
                {getCellValue(col, 0)}
              </td>
            ))}
          </tr>
          <tr>
            {visibleColumns.map((col, index) => (
              <td key={index} style={{ ...getCellStyles(1), textAlign: col.align || 'left' }}>
                {getCellValue(col, 1)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      {isSelected && (
        <button className="table-delete" onClick={(e) => {
          e.stopPropagation();
          if (onDelete) {
            onDelete();
          } else {
            onUpdate({ ...table, columns: [] });
          }
        }} title="Delete table">
          ×
        </button>
      )}
    </div>
  );
};

export default TableEditor;

