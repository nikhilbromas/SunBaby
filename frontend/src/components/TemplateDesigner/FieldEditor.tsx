import React, { useState } from 'react';
import type { TextFieldConfig } from '../../services/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
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
  canvasZoom?: number;
}

const FieldEditor: React.FC<FieldEditorProps> = ({
  field,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  sampleData,
  fullSampleData,
  canvasZoom = 1,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: field.x, y: field.y });
  const [isEditingFontSize, setIsEditingFontSize] = useState(false);
  const [fontSizeInput, setFontSizeInput] = useState<string>(String(field.fontSize || 12));
  const fieldRef = React.useRef<HTMLDivElement>(null);
  const fontSizeInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setPosition({ x: field.x, y: field.y });
  }, [field.x, field.y]);

  React.useEffect(() => {
    setFontSizeInput(String(field.fontSize || 12));
  }, [field.fontSize]);

  React.useEffect(() => {
    if (isEditingFontSize && fontSizeInputRef.current) {
      fontSizeInputRef.current.focus();
      fontSizeInputRef.current.select();
    }
  }, [isEditingFontSize]);

  const handleFontSizeBlur = React.useCallback(() => {
    const numValue = parseInt(fontSizeInput, 10);
    if (isNaN(numValue) || numValue <= 0) {
      // Reset to current field fontSize or default
      setFontSizeInput(String(field.fontSize || 12));
    } else {
      onUpdate({ fontSize: numValue });
    }
    setIsEditingFontSize(false);
  }, [fontSizeInput, field.fontSize, onUpdate]);

  React.useEffect(() => {
    // Close font size editor when clicking outside
    if (isEditingFontSize) {
      const handleClickOutside = (e: MouseEvent) => {
        if (fieldRef.current && !fieldRef.current.contains(e.target as Node)) {
          handleFontSizeBlur();
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isEditingFontSize, handleFontSizeBlur]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLButtonElement) {
      return;
    }
    // Enable font size editing mode
    setIsEditingFontSize(true);
    onSelect();
    e.preventDefault();
    e.stopPropagation();
  };

  // Helper function to get parent section zone
  const getParentSectionZone = (): HTMLElement | null => {
    if (!fieldRef.current) return null;
    let parent = fieldRef.current.parentElement;
    while (parent && !parent.classList.contains('section-zone')) {
      parent = parent.parentElement;
    }
    return parent;
  };

  // Shared drag start logic for both mouse and touch
  const startDrag = (clientX: number, clientY: number) => {
    const parent = getParentSectionZone();
    const zoom = canvasZoom || 1;
    if (parent) {
      const parentRect = parent.getBoundingClientRect();
      setIsDragging(true);
      // Account for zoom: screen coordinates to canvas coordinates
      setDragStart({ 
        x: (clientX - parentRect.left) / zoom - field.x, 
        y: (clientY - parentRect.top) / zoom - field.y 
      });
      onSelect();
    } else {
      // Fallback to normal behavior
      setIsDragging(true);
      setDragStart({ x: clientX / zoom - field.x, y: clientY / zoom - field.y });
      onSelect();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLButtonElement) {
      return;
    }
    if (fieldRef.current) {
      startDrag(e.clientX, e.clientY);
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // Touch event handler for mobile drag
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLButtonElement) {
      return;
    }
    if (e.touches.length === 1 && fieldRef.current) {
      const touch = e.touches[0];
      startDrag(touch.clientX, touch.clientY);
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleFontSizeChange = (value: string) => {
    setFontSizeInput(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue > 0) {
      onUpdate({ fontSize: numValue });
    }
  };


  const handleFontSizeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleFontSizeBlur();
    } else if (e.key === 'Escape') {
      setFontSizeInput(String(field.fontSize || 12));
      setIsEditingFontSize(false);
    }
  };

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
          const parent = getParentSectionZone();
          if (parent) {
            const parentRect = parent.getBoundingClientRect();
            // Convert screen coordinates to canvas coordinates
            const newX = (clientX - parentRect.left) / zoom - dragStart.x;
            const newY = (clientY - parentRect.top) / zoom - dragStart.y;
            // Clamp using canvas dimensions (not screen dimensions)
            const parentWidth = parentRect.width / zoom;
            const parentHeight = parentRect.height / zoom;
            const clampedX = Math.max(0, Math.min(newX, parentWidth - 50)); // Leave some margin
            const clampedY = Math.max(0, Math.min(newY, parentHeight - 20));
            setPosition({ x: clampedX, y: clampedY });
            onUpdate({ x: clampedX, y: clampedY });
          } else {
            // Fallback
            const newX = clientX / zoom - dragStart.x;
            const newY = clientY / zoom - dragStart.y;
            setPosition({ x: Math.max(0, newX), y: Math.max(0, newY) });
            onUpdate({ x: Math.max(0, newX), y: Math.max(0, newY) });
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
  }, [isDragging, dragStart, onUpdate, canvasZoom]);

  const getDisplayValue = (): string => {
    // Handle special field types
    if (field.fieldType === 'currentDate') {
      return new Date().toLocaleDateString();
    }
    if (field.fieldType === 'currentTime') {
      return new Date().toLocaleTimeString();
    }
    if (field.fieldType === 'pageNumber') {
      return 'Page 1';
    }
    if (field.fieldType === 'totalPages') {
      return 'Total: 1';
    }
    
    // Handle static value for non-bound fields
    if (!field.bind || field.bind.trim() === '') {
      // If there's a static value, use it; otherwise show label or placeholder
      if (field.value && field.value.trim() !== '') {
        return field.value;
      }
      // If no value but has label, show label only (no value part)
      return '';
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

  // Treat undefined as visible (default). Only hide when explicitly set to false.
  if (field.visible === false) {
    return null;
  }

  const displayValue = getDisplayValue();

  // Parse width value for styling
  const getWidthStyle = (): string | undefined => {
    if (!field.width) return undefined;
    const width = field.width.trim();
    if (width === 'auto') return 'auto';
    if (width.endsWith('%')) return width;
    // If numeric, assume px
    const numValue = parseFloat(width);
    if (!isNaN(numValue)) return `${numValue}px`;
    return width; // Fallback to raw value
  };

  const widthStyle = getWidthStyle();

  // Handle fontFamily: Extract base font name (remove "-Bold" suffix for CSS)
  // CSS uses font-weight for bold, not "-Bold" suffix in font-family
  const getFontFamilyForCSS = (): string => {
    if (!field.fontFamily) return 'Helvetica';
    // Remove "-Bold" suffix if present (CSS handles bold via fontWeight)
    return field.fontFamily.replace(/-Bold$/, '');
  };

  // Determine fontWeight: Use field.fontWeight, or 'bold' if fontFamily ends with "-Bold"
  const getFontWeightForCSS = (): string | undefined => {
    if (field.fontWeight) return field.fontWeight;
    if (field.fontFamily && field.fontFamily.endsWith('-Bold')) {
      return 'bold';
    }
    return undefined;
  };

  return (
    <div
      ref={fieldRef}
      className={`field-editor ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${isEditingFontSize ? 'editing-font-size' : ''} ${field.bind && field.bind.trim() ? 'field-bound' : 'field-static'}`}
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        fontSize: field.fontSize ? `${field.fontSize}px` : undefined,
        fontWeight: getFontWeightForCSS(),
        fontFamily: getFontFamilyForCSS(),
        color: field.color,
        width: widthStyle,
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: isSelected ? 100 : 1,
        transition: isDragging ? 'none' : undefined,
        willChange: isDragging ? 'transform, left, top' : undefined,
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onDoubleClick={handleDoubleClick}
    >
      {field.label && field.label.trim() && (
        <div className="field-label">{field.label}</div>
      )}
      {displayValue && displayValue.trim() && (
        <div className="field-value">{displayValue}</div>
      )}
      {isSelected && (
        <>
          <button className="field-delete" onClick={onDelete} title="Delete field">
            ×
          </button>
          {isEditingFontSize && (
            <div 
              className="field-font-size-editor"
              style={{
                position: 'absolute',
                top: '-35px',
                left: '0',
                backgroundColor: '#007bff',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                zIndex: 1001,
                boxShadow: '0 2px 8px rgba(0, 123, 255, 0.4)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <span>Font Size:</span>
              <input
                ref={fontSizeInputRef}
                type="number"
                min="8"
                max="72"
                value={fontSizeInput}
                onChange={(e) => handleFontSizeChange(e.target.value)}
                onBlur={handleFontSizeBlur}
                onKeyDown={handleFontSizeKeyDown}
                style={{
                  width: '50px',
                  padding: '2px 4px',
                  border: 'none',
                  borderRadius: '2px',
                  fontSize: '12px',
                  textAlign: 'center',
                }}
                onClick={(e) => e.stopPropagation()}
              />
              <span>px</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FieldEditor;

