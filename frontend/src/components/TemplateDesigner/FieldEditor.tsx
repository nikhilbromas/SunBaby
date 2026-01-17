import React, { useState } from 'react';
import type { TextFieldConfig } from '../../services/types';
import './FieldEditor.css';

interface FieldEditorProps {
  field: TextFieldConfig;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<TextFieldConfig>) => void;
  onDelete: () => void;
  sampleData?: Record<string, any> | null;
  fullSampleData?: {
    header?: { data: Record<string, any> | null; fields: string[] };
    contentDetails?: Record<string, { data: Record<string, any>[] | Record<string, any> | null; fields: string[]; sampleCount: number; dataType?: 'array' | 'object' }>;
  } | null;
  section?: 'pageHeader' | 'pageFooter' | 'header' | 'billContent' | 'billFooter';
}

const FieldEditor: React.FC<FieldEditorProps> = ({
  field,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  sampleData,
  fullSampleData,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: field.x, y: field.y });
  const fieldRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setPosition({ x: field.x, y: field.y });
  }, [field.x, field.y]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLButtonElement) {
      return;
    }
    if (fieldRef.current) {
      // Find the section zone container (parent with section-zone class)
      let parent = fieldRef.current.parentElement;
      while (parent && !parent.classList.contains('section-zone')) {
        parent = parent.parentElement;
      }
      
      if (parent) {
        const parentRect = parent.getBoundingClientRect();
        setIsDragging(true);
        setDragStart({ 
          x: e.clientX - parentRect.left - field.x, 
          y: e.clientY - parentRect.top - field.y 
        });
        onSelect();
        e.preventDefault();
        e.stopPropagation();
      } else {
        // Fallback to normal behavior
        setIsDragging(true);
        setDragStart({ x: e.clientX - field.x, y: e.clientY - field.y });
        onSelect();
      }
    }
  };

  React.useEffect(() => {
    if (isDragging) {
      let animationFrameId: number | null = null;
      
      const handleGlobalMouseMove = (e: MouseEvent) => {
        // Use requestAnimationFrame for smooth updates
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId);
        }
        
        animationFrameId = requestAnimationFrame(() => {
          if (fieldRef.current) {
            // Find the section zone container
            let parent = fieldRef.current.parentElement;
            while (parent && !parent.classList.contains('section-zone')) {
              parent = parent.parentElement;
            }
            
            if (parent) {
              const parentRect = parent.getBoundingClientRect();
              const newX = e.clientX - parentRect.left - dragStart.x;
              const newY = e.clientY - parentRect.top - dragStart.y;
              const clampedX = Math.max(0, Math.min(newX, parentRect.width - 50)); // Leave some margin
              const clampedY = Math.max(0, Math.min(newY, parentRect.height - 20));
              setPosition({ x: clampedX, y: clampedY });
              onUpdate({ x: clampedX, y: clampedY });
            } else {
              // Fallback
              const newX = e.clientX - dragStart.x;
              const newY = e.clientY - dragStart.y;
              setPosition({ x: Math.max(0, newX), y: Math.max(0, newY) });
              onUpdate({ x: Math.max(0, newX), y: Math.max(0, newY) });
            }
          }
        });
      };
      
      const handleGlobalMouseUp = () => {
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId);
        }
        setIsDragging(false);
      };
      
      document.addEventListener('mousemove', handleGlobalMouseMove, { passive: true });
      document.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId);
        }
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging, dragStart, onUpdate]);

  const getDisplayValue = (): string => {
    // Handle special field types
    if (field.fieldType === 'currentDate') {
      return new Date().toLocaleDateString();
    }
    if (field.fieldType === 'currentTime') {
      return new Date().toLocaleTimeString();
    }
    if (field.fieldType === 'pageNumber') {
      return '1';
    }
    if (field.fieldType === 'totalPages') {
      return '1';
    }
    
    // Handle bound fields - sampleData is already the header data object (flat)
    // fieldType 'text' or undefined means it's a bound text field
    if (field.bind && (!field.fieldType || field.fieldType === 'text')) {
      // Handle nested bindings like "contentDetails.payments.Amount"
      if (field.bind.startsWith('contentDetails.')) {
        // Parse binding like "contentDetails.payments.Amount"
        const parts = field.bind.split('.');
        if (parts.length === 3 && fullSampleData?.contentDetails) {
          const [, contentName, fieldName] = parts;
          const contentDetail = fullSampleData.contentDetails[contentName];
          if (contentDetail && contentDetail.dataType === 'object' && contentDetail.data) {
            const data = contentDetail.data as Record<string, any>;
            const value = data[fieldName];
            if (value !== null && value !== undefined) {
              return String(value);
            }
          }
        }
        return '[Value]';
      }
      
      // Handle header bindings like "header.OrderID" or direct field names
      if (sampleData) {
        let fieldName = field.bind;
        if (field.bind.includes('.')) {
          const parts = field.bind.split('.');
          // Take the last part after the dot (e.g., "OrderID" from "header.OrderID")
          fieldName = parts[parts.length - 1];
        }
        
        // Look up the field name directly in sampleData
        if (sampleData && typeof sampleData === 'object') {
          const value = sampleData[fieldName];
          if (value !== null && value !== undefined) {
            return String(value);
          }
        }
      }
    }
    
    return '[Value]';
  };

  if (!field.visible) {
    return null;
  }

  const displayValue = getDisplayValue();

  return (
    <div
      ref={fieldRef}
      className={`field-editor ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        fontSize: field.fontSize ? `${field.fontSize}px` : undefined,
        fontWeight: field.fontWeight,
        color: field.color,
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: isSelected ? 100 : 1,
        transition: isDragging ? 'none' : undefined,
        willChange: isDragging ? 'transform, left, top' : undefined,
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="field-label">{field.label}:</div>
      <div className="field-value">{displayValue}</div>
      {isSelected && (
        <button className="field-delete" onClick={onDelete} title="Delete field">
          ×
        </button>
      )}
    </div>
  );
};

export default FieldEditor;

