import React, { useState, useCallback, useRef, useMemo } from 'react';
import { useDrop } from 'react-dnd';
import type { TemplateJson, TextFieldConfig, ItemsTableConfig, ContentDetailsTableConfig, ImageFieldConfig } from '../../services/types';
import FieldEditor from './FieldEditor';
import ImageEditor from './ImageEditor';
import TableEditor from './TableEditor';
import SidePanel from './SidePanel';
import PropertyPanel from './PropertyPanel';
import SetupPanel from './SetupPanel';
import TableEditorModal from './TableEditorModal';
import ZoneConfigModal from './ZoneConfigModal';
import DataPreview from './DataPreview';
import apiClient from '../../services/api';
import { useMobile } from '../../contexts/MobileContext';
import './Canvas.css';

// Page dimensions in pixels (at 96 DPI)
const PAGE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  'A4': { width: 794, height: 1123 },      // 210mm x 297mm
  'Letter': { width: 816, height: 1056 },  // 8.5" x 11"
  'Legal': { width: 816, height: 1344 },   // 8.5" x 14"
};

const getPageDimensions = (size: string, orientation: 'portrait' | 'landscape') => {
  const dims = PAGE_DIMENSIONS[size] || PAGE_DIMENSIONS['A4'];
  return orientation === 'landscape' 
    ? { width: dims.height, height: dims.width }
    : dims;
};

interface ResizableSectionZoneProps {
  className: string;
  label: string;
  height: number;
  top?: number;
  bottom?: number;
  isBottom?: boolean;
  onHeightChange: (height: number) => void;
  children: React.ReactNode;
}

const ResizableSectionZone: React.FC<ResizableSectionZoneProps> = ({
  className,
  label,
  height,
  top,
  bottom,
  isBottom = false,
  onHeightChange,
  children,
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startHeight, setStartHeight] = useState(height);
  const zoneRef = useRef<HTMLDivElement>(null);

  // Mouse event handler
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setStartY(e.clientY);
    setStartHeight(height);
  };

  // Touch event handler for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      e.preventDefault();
      e.stopPropagation();
      const touch = e.touches[0];
      setIsResizing(true);
      setStartY(touch.clientY);
      setStartHeight(height);
    }
  };

  React.useEffect(() => {
    if (isResizing) {
      // Mouse handlers
      const handleMouseMove = (e: MouseEvent) => {
        const deltaY = isBottom ? startY - e.clientY : e.clientY - startY;
        const newHeight = Math.max(40, startHeight + deltaY);
        onHeightChange(newHeight);
      };
      const handleMouseUp = () => {
        setIsResizing(false);
      };
      
      // Touch handlers
      const handleTouchMove = (e: TouchEvent) => {
        if (e.touches.length === 1) {
          e.preventDefault();
          const touch = e.touches[0];
          const deltaY = isBottom ? startY - touch.clientY : touch.clientY - startY;
          const newHeight = Math.max(40, startHeight + deltaY);
          onHeightChange(newHeight);
        }
      };
      const handleTouchEnd = () => {
        setIsResizing(false);
      };
      
      // Add all event listeners
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
      document.addEventListener('touchcancel', handleTouchEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
        document.removeEventListener('touchcancel', handleTouchEnd);
      };
    }
  }, [isResizing, startY, startHeight, isBottom, onHeightChange]);

  const style: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    height: `${height}px`,
    ...(isBottom ? { bottom: `${bottom}px` } : { top: `${top}px` }),
  };

  return (
    <div
      ref={zoneRef}
      className={`section-zone ${className}`}
      style={style}
    >
      <div className="section-label">{label}</div>
      <div
        className={`section-resize-handle ${isBottom ? 'resize-handle-top' : 'resize-handle-bottom'}`}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        style={{
          cursor: 'row-resize',
          position: 'absolute',
          [isBottom ? 'top' : 'bottom']: 0,
          left: 0,
          right: 0,
          height: '16px',
          minHeight: '16px',
          backgroundColor: isResizing ? 'rgba(11, 99, 255, 0.3)' : 'transparent',
          zIndex: 100,
          touchAction: 'none',
        }}
      />
      <div style={{ position: 'relative', width: '100%', height: '100%', pointerEvents: 'auto',top: '-40px' }}>
        {children}
      </div>
    </div>
  );
};

interface CanvasProps {
  templateId?: number;
  presetId?: number;
}

const Canvas: React.FC<CanvasProps> = ({ templateId: initialTemplateId, presetId: initialPresetId }) => {
  // Mobile context for responsive behavior
  const { 
    isMobile, 
    isTouchDevice,
    activeDesignerTab, 
    setActiveDesignerTab, 
    isPlacementMode, 
    placementItem, 
    exitPlacementMode, 
    canvasZoom,
    setCanvasZoom,
    zoomIn,
    zoomOut,
    resetZoom,
  } = useMobile();
  
  // Refs for pinch-to-zoom
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const pinchStateRef = useRef<{
    initialDistance: number;
    initialZoom: number;
    isPinching: boolean;
  }>({ initialDistance: 0, initialZoom: 1, isPinching: false });
  
  const [selectedPresetId, setSelectedPresetId] = useState<number | undefined>(initialPresetId);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>(initialTemplateId);
  const [template, setTemplate] = useState<TemplateJson>({
    page: { size: 'A4', orientation: 'portrait' },
    header: [],
    itemsTable: undefined,
    billContent: undefined,
  });
  const [selectedElement, setSelectedElement] = useState<{
    type: 'field' | 'table' | 'contentDetailTable' | 'billContentTable' | 'image';
    index: number;
    section?: 'pageHeader' | 'pageFooter' | 'header' | 'billContent' | 'billFooter';
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Calculate page dimensions based on size and orientation
  const pageDimensions = useMemo(() => 
    getPageDimensions(template.page.size, template.page.orientation),
    [template.page.size, template.page.orientation]
  );
  const [isSetupPanelOpen, setIsSetupPanelOpen] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<{
    type: 'itemsTable' | 'billContentTable' | 'contentDetailTable';
    index?: number;
  } | null>(null);
  const [isZoneConfigModalOpen, setIsZoneConfigModalOpen] = useState(false);
  const [sampleData, setSampleData] = useState<{
    header: { data: Record<string, any> | null; fields: string[] };
    items: { data: Record<string, any>[]; fields: string[]; sampleCount: number };
    contentDetails?: Record<string, { data: Record<string, any>[] | Record<string, any> | null; fields: string[]; sampleCount: number; dataType?: 'array' | 'object' }>;
  } | null>(null);

  // Calculate dynamic height for a section based on fields (standalone function for use in loadTemplate)
  const calculateSectionHeightHelper = (fields: TextFieldConfig[]): number => {
    const MIN_HEIGHT = 40;
    const PADDING = 20;
    
    if (!fields || fields.length === 0) {
      return MIN_HEIGHT;
    }
    
    let maxBottom = 0;
    
    // Check all fields
    fields.forEach(field => {
      if (field.visible !== false) {
        // Estimate field height based on font size
        const fieldHeight = field.fontSize ? field.fontSize * 1.5 : 20;
        const bottom = (field.y || 0) + fieldHeight;
        maxBottom = Math.max(maxBottom, bottom);
      }
    });
    
    return Math.max(MIN_HEIGHT, maxBottom + PADDING);
  };

  // Calculate dynamic height for bill-content based on fields and tables (standalone function)
  const calculateBillContentHeightHelper = (fields: TextFieldConfig[], tables: ItemsTableConfig[], contentDetailsTables: ContentDetailsTableConfig[] = []): number => {
    const MIN_HEIGHT = 100;
    const PADDING = 20;
    
    let maxBottom = 0;
    
    // Check all fields
    fields.forEach(field => {
      // Estimate field height based on font size
      const fieldHeight = field.fontSize ? field.fontSize * 1.5 : 20;
      const bottom = field.y + fieldHeight;
      maxBottom = Math.max(maxBottom, bottom);
    });
    
    // Check all tables (positioned relative to bill-content)
    tables.forEach(table => {
      // Estimate table height: header + sample rows
      const fontSize = table.fontSize || 12;
      const cellPadding = table.cellPadding || 10;
      const rowHeight = fontSize + (cellPadding * 2);
      const headerHeight = rowHeight;
      const sampleRowsHeight = rowHeight * 2; // 2 sample rows shown
      const tableHeight = headerHeight + sampleRowsHeight;
      const bottom = (table.y || 0) + tableHeight;
      maxBottom = Math.max(maxBottom, bottom);
    });
    
    // Check all contentDetailsTables (positioned relative to bill-content)
    contentDetailsTables.forEach(table => {
      // Estimate table height: header + sample rows
      const fontSize = table.fontSize || 12;
      const cellPadding = table.cellPadding || 10;
      const rowHeight = fontSize + (cellPadding * 2);
      const headerHeight = rowHeight;
      const sampleRowsHeight = rowHeight * 2; // 2 sample rows shown
      const tableHeight = headerHeight + sampleRowsHeight;
      const bottom = (table.y || 0) + tableHeight;
      maxBottom = Math.max(maxBottom, bottom);
    });
    
    return Math.max(MIN_HEIGHT, maxBottom + PADDING);
  };

  // Load template if templateId provided
  React.useEffect(() => {
    if (selectedTemplateId) {
      loadTemplate(selectedTemplateId);
    } else {
      // Reset template when no template selected
      setTemplate({
        page: { size: 'A4', orientation: 'portrait' },
        header: [],
        itemsTable: undefined,
        contentDetailsTables: undefined,
        billContent: undefined,
      });
      setSelectedElement(null);
    }
  }, [selectedTemplateId]);

  const loadTemplate = async (id: number) => {
    try {
      const loaded = await apiClient.getTemplate(id);
      const templateJson = JSON.parse(loaded.TemplateJson) as TemplateJson;
      
      // Prioritize saved sectionHeights - only calculate if truly missing (undefined/null)
      const savedSectionHeights = templateJson.sectionHeights || {};
      const sectionHeights: typeof savedSectionHeights = { ...savedSectionHeights };
      
      // Only calculate page header height if completely missing (not 0, which is a valid saved value)
      if (sectionHeights.pageHeader === undefined || sectionHeights.pageHeader === null) {
        if (templateJson.pageHeader && templateJson.pageHeader.length > 0) {
          sectionHeights.pageHeader = calculateSectionHeightHelper(templateJson.pageHeader);
        } else {
          sectionHeights.pageHeader = 60; // Default when no fields
        }
      }
      
      // Only calculate page footer height if completely missing
      if (sectionHeights.pageFooter === undefined || sectionHeights.pageFooter === null) {
        if (templateJson.pageFooter && templateJson.pageFooter.length > 0) {
          sectionHeights.pageFooter = calculateSectionHeightHelper(templateJson.pageFooter);
        } else {
          sectionHeights.pageFooter = 60; // Default when no fields
        }
      }
      
      // Only calculate bill content height if completely missing
      if (sectionHeights.billContent === undefined || sectionHeights.billContent === null) {
        const billContentFields = templateJson.billContent || [];
        const billContentTables = templateJson.billContentTables || [];
        const contentDetailsTables = templateJson.contentDetailsTables || [];
        if (billContentFields.length > 0 || billContentTables.length > 0 || contentDetailsTables.length > 0) {
          sectionHeights.billContent = calculateBillContentHeightHelper(billContentFields, billContentTables, contentDetailsTables);
        } else {
          sectionHeights.billContent = 100; // Default when no content
        }
      }
      
      // Set defaults for other heights only if completely missing
      if (sectionHeights.billHeader === undefined || sectionHeights.billHeader === null) {
        sectionHeights.billHeader = 200; // Default
      }
      if (sectionHeights.billFooter === undefined || sectionHeights.billFooter === null) {
        sectionHeights.billFooter = 100; // Default
      }
      
      // Set template with initialized sectionHeights (preserving saved values)
      setTemplate({
        ...templateJson,
        sectionHeights,
      });
    } catch (error) {
      console.error('Error loading template:', error);
      alert('Failed to load template');
    }
  };

  // Calculate dynamic height for a section based on fields
  const calculateSectionHeight = useCallback((fields: TextFieldConfig[]): number => {
    const MIN_HEIGHT = 40;
    const PADDING = 20;
    
    if (!fields || fields.length === 0) {
      return MIN_HEIGHT;
    }
    
    let maxBottom = 0;
    
    // Check all fields
    fields.forEach(field => {
      if (field.visible !== false) {
        // Estimate field height based on font size
        const fieldHeight = field.fontSize ? field.fontSize * 1.5 : 20;
        const bottom = (field.y || 0) + fieldHeight;
        maxBottom = Math.max(maxBottom, bottom);
      }
    });
    
    return Math.max(MIN_HEIGHT, maxBottom + PADDING);
  }, []);

  // Calculate dynamic height for bill-content based on fields and tables
  const calculateBillContentHeight = useCallback((fields: TextFieldConfig[], tables: ItemsTableConfig[], contentDetailsTables: ContentDetailsTableConfig[] = []): number => {
    const MIN_HEIGHT = 100;
    const PADDING = 20;
    
    let maxBottom = 0;
    
    // Check all fields
    fields.forEach(field => {
      // Estimate field height based on font size
      const fieldHeight = field.fontSize ? field.fontSize * 1.5 : 20;
      const bottom = field.y + fieldHeight;
      maxBottom = Math.max(maxBottom, bottom);
    });
    
    // Check all tables (positioned relative to bill-content)
    tables.forEach(table => {
      // Estimate table height: header + sample rows
      const fontSize = table.fontSize || 12;
      const cellPadding = table.cellPadding || 10;
      const rowHeight = fontSize + (cellPadding * 2);
      const headerHeight = rowHeight;
      const sampleRowsHeight = rowHeight * 2; // 2 sample rows shown
      const tableHeight = headerHeight + sampleRowsHeight;
      const bottom = (table.y || 0) + tableHeight;
      maxBottom = Math.max(maxBottom, bottom);
    });
    
    // Check all contentDetailsTables (positioned relative to bill-content)
    contentDetailsTables.forEach(table => {
      // Estimate table height: header + sample rows
      const fontSize = table.fontSize || 12;
      const cellPadding = table.cellPadding || 10;
      const rowHeight = fontSize + (cellPadding * 2);
      const headerHeight = rowHeight;
      const sampleRowsHeight = rowHeight * 2; // 2 sample rows shown
      const tableHeight = headerHeight + sampleRowsHeight;
      const bottom = (table.y || 0) + tableHeight;
      maxBottom = Math.max(maxBottom, bottom);
    });
    
    return Math.max(MIN_HEIGHT, maxBottom + PADDING);
  }, []);

  // Calculate page header height only if missing
  // Preserve saved heights from templates - don't recalculate on content changes
  React.useEffect(() => {
    const currentHeight = template.sectionHeights?.pageHeader;
    
    // Only calculate if height is truly missing (undefined/null)
    // Preserve user-resized heights even if content changes
    if (currentHeight === undefined || currentHeight === null) {
      const fields = template.pageHeader || [];
      const calculatedHeight = calculateSectionHeight(fields);
      setTemplate((prev) => ({
        ...prev,
        sectionHeights: {
          ...(prev.sectionHeights || {}),
          pageHeader: calculatedHeight,
        },
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.pageHeader, calculateSectionHeight]);

  // Calculate page footer height only if missing
  // Preserve saved heights from templates - don't recalculate on content changes
  React.useEffect(() => {
    const currentHeight = template.sectionHeights?.pageFooter;
    
    // Only calculate if height is truly missing (undefined/null)
    // Preserve user-resized heights even if content changes
    if (currentHeight === undefined || currentHeight === null) {
      const fields = template.pageFooter || [];
      const calculatedHeight = calculateSectionHeight(fields);
      setTemplate((prev) => ({
        ...prev,
        sectionHeights: {
          ...(prev.sectionHeights || {}),
          pageFooter: calculatedHeight,
        },
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.pageFooter, calculateSectionHeight]);

  // Calculate bill-content height only if missing
  // Preserve saved heights from templates - don't recalculate on content changes
  React.useEffect(() => {
    const currentHeight = template.sectionHeights?.billContent;
    
    // Only calculate if height is truly missing (undefined/null)
    // Preserve user-resized heights even if content changes
    if (currentHeight === undefined || currentHeight === null) {
      const fields = template.billContent || [];
      const tables = template.billContentTables || [];
      const contentDetailsTables = template.contentDetailsTables || [];
      const calculatedHeight = calculateBillContentHeight(fields, tables, contentDetailsTables);
      setTemplate((prev) => ({
        ...prev,
        sectionHeights: {
          ...(prev.sectionHeights || {}),
          billContent: calculatedHeight,
        },
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.billContent, template.billContentTables, template.contentDetailsTables, calculateBillContentHeight]);

  const handleDataFieldDrop = useCallback(
    (item: { fieldType: 'header' | 'item' | 'contentDetail' | 'selectionZone'; fieldName?: string; bind?: string; label?: string; targetSection?: 'pageHeader' | 'pageFooter' | 'header' | 'billContent' | 'billFooter'; contentName?: string; fields?: Array<{ fieldType: 'header' | 'item' | 'contentDetail'; fieldName: string; bind: string; label: string; contentName?: string }> }, clientOffset: { x: number; y: number } | null, targetSectionParam?: 'pageHeader' | 'pageFooter' | 'header' | 'billContent' | 'billFooter') => {
      if (item.fieldType === 'selectionZone' && item.fields && item.targetSection) {
        // Handle zone drop - create all fields in the zone
        const zoneFields = item.fields;
        const targetSection = item.targetSection;
        const canvasElement = document.querySelector('.canvas');
        
        // Calculate base position relative to section
        let baseX = 20;
        let baseY = 20;
        const fieldSpacing = 25; // Vertical spacing between fields
        
        if (clientOffset && canvasElement) {
          const canvasRect = canvasElement.getBoundingClientRect();
          const absoluteX = clientOffset.x - canvasRect.left;
          const absoluteY = clientOffset.y - canvasRect.top;
          
          baseX = absoluteX - 20;
          
          // Calculate base Y relative to section
          if (targetSection === 'pageHeader') {
            baseY = absoluteY - 40 - 10;
          } else if (targetSection === 'header') {
            const pageHeaderHeight = template.sectionHeights?.pageHeader || 60;
            baseY = absoluteY - 40 - pageHeaderHeight - 10 - 10;
          } else if (targetSection === 'billContent') {
            const pageHeaderHeight = template.sectionHeights?.pageHeader || 60;
            const billHeaderHeight = template.sectionHeights?.billHeader || 200;
            baseY = absoluteY - 40 - pageHeaderHeight - 10 - billHeaderHeight - 10 - 10;
          } else if (targetSection === 'billFooter') {
            const pageFooterHeight = template.sectionHeights?.pageFooter || 60;
            baseY = absoluteY - (canvasRect.height - pageFooterHeight - 10 - (template.sectionHeights?.billFooter || 100));
          } else if (targetSection === 'pageFooter') {
            const pageFooterHeight = template.sectionHeights?.pageFooter || 60;
            baseY = absoluteY - (canvasRect.height - pageFooterHeight);
          }
          baseY = Math.max(0, baseY);
        }
        
        // Process each field in the zone
        const newFields: Array<{ field: TextFieldConfig; section: 'pageHeader' | 'pageFooter' | 'header' | 'billContent' | 'billFooter'; table?: ItemsTableConfig | ContentDetailsTableConfig; tableIndex?: number }> = [];
        let itemTableFields: Array<{ bind: string; label: string; visible: boolean }> = [];
        let billContentTableFields: Array<{ bind: string; label: string; visible: boolean }> = [];
        const contentDetailTables: Map<string, Array<{ bind: string; label: string; visible: boolean }>> = new Map();
        let yOffset = 0;
        
        zoneFields.forEach((zoneField) => {
          // Ensure required fields are defined
          if (!zoneField.bind || !zoneField.label) {
            return;
          }
          
          const bind = zoneField.bind;
          const label = zoneField.label;
          
          if (zoneField.fieldType === 'header') {
            // Check if field already exists in target section
            const sectionFields = 
              targetSection === 'pageHeader' ? template.pageHeader || [] :
              targetSection === 'pageFooter' ? template.pageFooter || [] :
              targetSection === 'billFooter' ? template.billFooter || [] :
              targetSection === 'billContent' ? template.billContent || [] :
              template.header || [];
            
            const fieldExists = sectionFields.some(f => f.bind === bind);
            if (!fieldExists) {
              newFields.push({
                field: {
                  type: 'text',
                  label: label,
                  bind: bind,
                  x: baseX,
                  y: baseY + yOffset,
                  visible: true,
                },
                section: targetSection,
              });
              yOffset += fieldSpacing;
            }
          } else if (zoneField.fieldType === 'item') {
            // For item fields, add to appropriate table based on target section
            if (targetSection === 'billContent') {
              billContentTableFields.push({
                bind: bind,
                label: label,
                visible: true,
              });
            } else {
              itemTableFields.push({
                bind: bind,
                label: label,
                visible: true,
              });
            }
          } else if (zoneField.fieldType === 'contentDetail' && zoneField.contentName) {
            // Detect object-type contentDetails: bind path starts with "contentDetails."
            const isObjectType = bind.startsWith('contentDetails.');
            
            if (isObjectType) {
              // Object-type: Add to newFields array as a field in target section
              // Check if field already exists in target section
              const sectionFields = 
                targetSection === 'pageHeader' ? template.pageHeader || [] :
                targetSection === 'pageFooter' ? template.pageFooter || [] :
                targetSection === 'billFooter' ? template.billFooter || [] :
                targetSection === 'billContent' ? template.billContent || [] :
                template.header || [];
              
              const fieldExists = sectionFields.some(f => f.bind === bind);
              if (!fieldExists) {
                newFields.push({
                  field: {
                    type: 'text',
                    label: label,
                    bind: bind,
                    x: baseX,
                    y: baseY + yOffset,
                    visible: true,
                  },
                  section: targetSection, // Use targetSection from zone
                });
                yOffset += fieldSpacing;
              }
            } else {
              // Array-type: For content detail fields, add to content detail table (existing behavior)
              const contentName = zoneField.contentName;
              if (!contentDetailTables.has(contentName)) {
                contentDetailTables.set(contentName, []);
              }
              contentDetailTables.get(contentName)!.push({
                bind: bind,
                label: label,
                visible: true,
              });
            }
          }
        });
        
        // Update template with all new fields
        setTemplate((prev) => {
          let updated = { ...prev };
          
          // Add text fields
          newFields.forEach(({ field, section }) => {
            if (section === 'pageHeader') {
              updated.pageHeader = [...(updated.pageHeader || []), field];
            } else if (section === 'pageFooter') {
              updated.pageFooter = [...(updated.pageFooter || []), field];
            } else if (section === 'billFooter') {
              updated.billFooter = [...(updated.billFooter || []), field];
            } else if (section === 'billContent') {
              updated.billContent = [...(updated.billContent || []), field];
            } else {
              updated.header = [...(updated.header || []), field];
            }
          });
          
          // Add item fields to items table or bill-content table
          if (itemTableFields.length > 0) {
            if (!updated.itemsTable) {
              updated.itemsTable = {
                columns: itemTableFields,
              };
            } else {
              const existingColumns = updated.itemsTable.columns || [];
              const newColumns = itemTableFields.filter(item => 
                !existingColumns.some(col => col.bind === item.bind)
              );
              updated.itemsTable = {
                ...updated.itemsTable,
                columns: [...existingColumns, ...newColumns],
              };
            }
          }
          
          if (billContentTableFields.length > 0) {
            const billContentTables = updated.billContentTables || [];
            if (billContentTables.length === 0) {
              updated.billContentTables = [{
                columns: billContentTableFields,
                x: baseX,
                y: baseY,
              }];
            } else {
              const firstTable = billContentTables[0];
              const existingColumns = firstTable.columns || [];
              const newColumns = billContentTableFields.filter(item => 
                !existingColumns.some(col => col.bind === item.bind)
              );
              if (newColumns.length > 0) {
                const updatedTables = [...billContentTables];
                updatedTables[0] = {
                  ...firstTable,
                  columns: [...existingColumns, ...newColumns],
                };
                updated.billContentTables = updatedTables;
              }
            }
          }
          
          // Add content detail fields to content detail tables
          if (contentDetailTables.size > 0) {
            const contentDetailsTables = updated.contentDetailsTables || [];
            contentDetailTables.forEach((columns, contentName) => {
              const existingTableIndex = contentDetailsTables.findIndex(
                (t) => t.contentName === contentName
              );
              
              if (existingTableIndex >= 0) {
                const existingTable = contentDetailsTables[existingTableIndex];
                const existingColumns = existingTable.columns || [];
                const newColumns = columns.filter(item => 
                  !existingColumns.some(col => col.bind === item.bind)
                );
                if (newColumns.length > 0) {
                  const updatedTables = [...contentDetailsTables];
                  updatedTables[existingTableIndex] = {
                    ...existingTable,
                    columns: [...existingColumns, ...newColumns],
                  };
                  updated.contentDetailsTables = updatedTables;
                }
              } else {
                // Create new content detail table
                updated.contentDetailsTables = [
                  ...contentDetailsTables,
                  {
                    contentName,
                    columns,
                    x: baseX,
                    y: baseY,
                  },
                ];
              }
            });
          }
          
          return updated;
        });
        
        return;
      } else if (item.fieldType === 'header') {
        // Determine target section based on drop position or explicit target
        const canvasElement = document.querySelector('.canvas');
        let section: 'pageHeader' | 'pageFooter' | 'header' | 'billContent' | 'billFooter' = 'header';
        
        if (clientOffset && canvasElement) {
          const canvasRect = canvasElement.getBoundingClientRect();
          const y = clientOffset.y - canvasRect.top;
          const canvasHeight = template.page.orientation === 'landscape' ? 794 : 1123;
          
          // Calculate section boundaries
          const pageHeaderHeight = template.sectionHeights?.pageHeader || 60;
          const billHeaderHeight = template.sectionHeights?.billHeader || 200;
          const billContentHeight = template.sectionHeights?.billContent || 100;
          const billFooterHeight = template.sectionHeights?.billFooter || 100;
          const pageFooterHeight = template.sectionHeights?.pageFooter || 60;
          
          const pageHeaderTop = 40;
          const billHeaderTop = pageHeaderTop + pageHeaderHeight + 10;
          const billContentTop = billHeaderTop + billHeaderHeight + 10;
          const billContentBottom = billContentTop + billContentHeight;
          const billFooterBottom = canvasHeight - pageFooterHeight - 10;
          
          // Determine section based on targetSection from item (priority) or Y position
          // Use targetSection from item first, then targetSectionParam, then Y position
          if (item.targetSection) {
            section = item.targetSection;
          } else if (targetSectionParam) {
            section = targetSectionParam;
          } else if (y < pageHeaderTop + pageHeaderHeight) {
            section = 'pageHeader';
          } else if (y >= billHeaderTop && y < billContentTop) {
            section = 'header';
          } else if (y >= billContentTop && y < billContentBottom) {
            section = 'billContent';
          } else if (y >= billFooterBottom - billFooterHeight && y < billFooterBottom) {
            section = 'billFooter';
          } else if (y > canvasHeight - pageFooterHeight) {
            section = 'pageFooter';
          } else {
            section = 'header';
          }
        }
        
        // Calculate Y position relative to section
        let relativeY = 20;
        if (clientOffset && canvasElement) {
          const canvasRect = canvasElement.getBoundingClientRect();
          const absoluteY = clientOffset.y - canvasRect.top;
          
          if (section === 'pageHeader') {
            relativeY = absoluteY - 40 - 10;
          } else if (section === 'header') {
            const pageHeaderHeight = template.sectionHeights?.pageHeader || 60;
            relativeY = absoluteY - 40 - pageHeaderHeight - 10 - 10;
          } else if (section === 'billContent') {
            const pageHeaderHeight = template.sectionHeights?.pageHeader || 60;
            const billHeaderHeight = template.sectionHeights?.billHeader || 200;
            relativeY = absoluteY - 40 - pageHeaderHeight - 10 - billHeaderHeight - 10 - 10;
          } else if (section === 'billFooter') {
            const pageFooterHeight = template.sectionHeights?.pageFooter || 60;
            relativeY = absoluteY - (canvasRect.height - pageFooterHeight - 10 - (template.sectionHeights?.billFooter || 100));
          } else if (section === 'pageFooter') {
            const pageFooterHeight = template.sectionHeights?.pageFooter || 60;
            relativeY = absoluteY - (canvasRect.height - pageFooterHeight);
          }
          relativeY = Math.max(0, relativeY);
        }
        
        // Check if field with same bind already exists in target section
        const fieldExists = (() => {
          const sectionFields = 
            section === 'pageHeader' ? template.pageHeader || [] :
            section === 'pageFooter' ? template.pageFooter || [] :
            section === 'billFooter' ? template.billFooter || [] :
            section === 'billContent' ? template.billContent || [] :
            template.header || [];
          
          return sectionFields.some(f => f.bind === item.bind);
        })();
        
        // Don't add duplicate fields in the same section
        if (fieldExists) {
          return;
        }
        
        // Ensure required fields are defined
        if (!item.bind || !item.label) {
          return;
        }
        
        const newField: TextFieldConfig = {
          type: 'text',
          label: item.label,
          bind: item.bind,
          x: clientOffset && canvasElement ? clientOffset.x - canvasElement.getBoundingClientRect().left - 20 : 20,
          y: relativeY,
          visible: true,
        };
        
        setTemplate((prev) => {
          if (section === 'pageHeader') {
            return {
              ...prev,
              pageHeader: [...(prev.pageHeader || []), newField],
            };
          } else if (section === 'pageFooter') {
            return {
              ...prev,
              pageFooter: [...(prev.pageFooter || []), newField],
            };
          } else if (section === 'billFooter') {
            return {
              ...prev,
              billFooter: [...(prev.billFooter || []), newField],
            };
          } else if (section === 'billContent') {
            return {
              ...prev,
              billContent: [...(prev.billContent || []), newField],
            };
          } else {
            return {
              ...prev,
              header: [...prev.header, newField],
            };
          }
        });
      } else if (item.fieldType === 'item') {
        // Determine if dropping into bill-content or creating items table
        const canvasElement = document.querySelector('.canvas');
        let section: 'billContent' | 'itemsTable' = 'itemsTable';
        
        if (clientOffset && canvasElement) {
          const canvasRect = canvasElement.getBoundingClientRect();
          const y = clientOffset.y - canvasRect.top;
          
          // Calculate section boundaries
          const pageHeaderHeight = template.sectionHeights?.pageHeader || 60;
          const billHeaderHeight = template.sectionHeights?.billHeader || 200;
          const billContentHeight = template.sectionHeights?.billContent || 100;
          
          const billHeaderTop = 40 + pageHeaderHeight + 10;
          const billContentTop = billHeaderTop + billHeaderHeight + 10;
          const billContentBottom = billContentTop + billContentHeight;
          
          // Check if drop is in bill-content zone
          if (y >= billContentTop && y < billContentBottom) {
            section = 'billContent';
          }
        }
        
        if (section === 'billContent') {
          // Ensure required fields are defined
          if (!item.bind || !item.label) {
            return;
          }
          
          // Capture values for use in callback
          const bindValue = item.bind;
          const labelValue = item.label;
          
          // Add item field to bill-content table or create new table in bill-content
          setTemplate((prev) => {
            const billContentTables = prev.billContentTables || [];
            if (billContentTables.length === 0) {
              // Create new table in bill-content
              const canvasElement = document.querySelector('.canvas');
              const relativeY = clientOffset && canvasElement ? 
                clientOffset.y - canvasElement.getBoundingClientRect().top - 
                (40 + (template.sectionHeights?.pageHeader || 60) + 10 + 
                 (template.sectionHeights?.billHeader || 200) + 10) - 10 : 20;
              
              return {
                ...prev,
                billContentTables: [{
                  columns: [
                    { bind: bindValue, label: labelValue, visible: true },
                  ],
                  x: clientOffset && canvasElement ? clientOffset.x - canvasElement.getBoundingClientRect().left - 20 : 20,
                  y: Math.max(0, relativeY),
                }],
              };
            } else {
              // Add column to first bill-content table if not already present
              const firstTable = billContentTables[0];
              const columnExists = firstTable.columns?.some(
                (col) => col.bind === bindValue
              );
              if (!columnExists) {
                const updatedTables = [...billContentTables];
                updatedTables[0] = {
                  ...firstTable,
                  columns: [
                    ...(firstTable.columns || []),
                    { bind: bindValue, label: labelValue, visible: true },
                  ],
                };
                return {
                  ...prev,
                  billContentTables: updatedTables,
                };
              }
            }
            return prev;
          });
        } else {
          // Ensure required fields are defined
          if (!item.bind || !item.label) {
            return;
          }
          
          // Capture values for use in callback
          const bindValue = item.bind;
          const labelValue = item.label;
          
          // Add item field to items table (existing behavior)
          setTemplate((prev) => {
            if (!prev.itemsTable) {
              // Create new table if it doesn't exist
              return {
                ...prev,
                itemsTable: {
                  columns: [
                    { bind: bindValue, label: labelValue, visible: true },
                  ],
                },
              };
            } else {
              // Add column to existing table if not already present
              const columnExists = prev.itemsTable.columns?.some(
                (col) => col.bind === bindValue
              );
              if (!columnExists) {
                return {
                  ...prev,
                  itemsTable: {
                    ...prev.itemsTable,
                    columns: [
                      ...(prev.itemsTable.columns || []),
                      { bind: bindValue, label: labelValue, visible: true },
                    ],
                  },
                };
              }
              return prev;
            }
          });
        }
      } else if (item.fieldType === 'contentDetail' && item.contentName) {
        // Ensure required fields are defined
        if (!item.bind || !item.label) {
          return;
        }
        
        // Capture values for use in callback
        const bindValue = item.bind;
        const labelValue = item.label;
        const contentName = item.contentName;
        
        // Detect object-type contentDetails: bind path starts with "contentDetails."
        // Object types use: contentDetails.${contentName}.${field}
        // Array types use: just the field name
        const isObjectType = bindValue.startsWith('contentDetails.');
        
        if (isObjectType) {
          // Object-type: Create field in billContent section (or target section)
          const canvasElement = document.querySelector('.canvas');
          let section: 'pageHeader' | 'pageFooter' | 'header' | 'billContent' | 'billFooter' = 'billContent';
          
          // Determine target section based on drop position or explicit target
          if (clientOffset && canvasElement) {
            const canvasRect = canvasElement.getBoundingClientRect();
            const y = clientOffset.y - canvasRect.top;
            const canvasHeight = template.page.orientation === 'landscape' ? 794 : 1123;
            
            // Calculate section boundaries
            const pageHeaderHeight = template.sectionHeights?.pageHeader || 60;
            const billHeaderHeight = template.sectionHeights?.billHeader || 200;
            const billContentHeight = template.sectionHeights?.billContent || 100;
            const billFooterHeight = template.sectionHeights?.billFooter || 100;
            const pageFooterHeight = template.sectionHeights?.pageFooter || 60;
            
            const pageHeaderTop = 40;
            const billHeaderTop = pageHeaderTop + pageHeaderHeight + 10;
            const billContentTop = billHeaderTop + billHeaderHeight + 10;
            const billContentBottom = billContentTop + billContentHeight;
            const billFooterBottom = canvasHeight - pageFooterHeight - 10;
            
            // Determine section based on targetSection from item (priority) or Y position
            if (item.targetSection) {
              section = item.targetSection;
            } else if (y < pageHeaderTop + pageHeaderHeight) {
              section = 'pageHeader';
            } else if (y >= billHeaderTop && y < billContentTop) {
              section = 'header';
            } else if (y >= billContentTop && y < billContentBottom) {
              section = 'billContent';
            } else if (y >= billFooterBottom - billFooterHeight && y < billFooterBottom) {
              section = 'billFooter';
            } else if (y > canvasHeight - pageFooterHeight) {
              section = 'pageFooter';
            } else {
              section = 'billContent'; // Default to billContent for object-type
            }
          }
          
          // Calculate Y position relative to section
          let relativeY = 20;
          if (clientOffset && canvasElement) {
            const canvasRect = canvasElement.getBoundingClientRect();
            const absoluteY = clientOffset.y - canvasRect.top;
            
            if (section === 'pageHeader') {
              relativeY = absoluteY - 40 - 10;
            } else if (section === 'header') {
              const pageHeaderHeight = template.sectionHeights?.pageHeader || 60;
              relativeY = absoluteY - 40 - pageHeaderHeight - 10 - 10;
            } else if (section === 'billContent') {
              const pageHeaderHeight = template.sectionHeights?.pageHeader || 60;
              const billHeaderHeight = template.sectionHeights?.billHeader || 200;
              relativeY = absoluteY - 40 - pageHeaderHeight - 10 - billHeaderHeight - 10 - 10;
            } else if (section === 'billFooter') {
              const pageFooterHeight = template.sectionHeights?.pageFooter || 60;
              relativeY = absoluteY - (canvasRect.height - pageFooterHeight - 10 - (template.sectionHeights?.billFooter || 100));
            } else if (section === 'pageFooter') {
              const pageFooterHeight = template.sectionHeights?.pageFooter || 60;
              relativeY = absoluteY - (canvasRect.height - pageFooterHeight);
            }
            relativeY = Math.max(0, relativeY);
          }
          
          // Check if field with same bind already exists in target section
          const fieldExists = (() => {
            const sectionFields = 
              section === 'pageHeader' ? template.pageHeader || [] :
              section === 'pageFooter' ? template.pageFooter || [] :
              section === 'billFooter' ? template.billFooter || [] :
              section === 'billContent' ? template.billContent || [] :
              template.header || [];
            
            return sectionFields.some(f => f.bind === bindValue);
          })();
          
          // Don't add duplicate fields in the same section
          if (fieldExists) {
            return;
          }
          
          const newField: TextFieldConfig = {
            type: 'text',
            label: labelValue,
            bind: bindValue,
            x: clientOffset && canvasElement ? clientOffset.x - canvasElement.getBoundingClientRect().left - 20 : 20,
            y: relativeY,
            visible: true,
          };
          
          setTemplate((prev) => {
            if (section === 'pageHeader') {
              return {
                ...prev,
                pageHeader: [...(prev.pageHeader || []), newField],
              };
            } else if (section === 'pageFooter') {
              return {
                ...prev,
                pageFooter: [...(prev.pageFooter || []), newField],
              };
            } else if (section === 'billFooter') {
              return {
                ...prev,
                billFooter: [...(prev.billFooter || []), newField],
              };
            } else if (section === 'billContent') {
              return {
                ...prev,
                billContent: [...(prev.billContent || []), newField],
              };
            } else {
              return {
                ...prev,
                header: [...prev.header, newField],
              };
            }
          });
        } else {
          // Array-type: Add content detail field to content detail table (existing behavior)
          setTemplate((prev) => {
            const contentDetailsTables = prev.contentDetailsTables || [];
            const existingTableIndex = contentDetailsTables.findIndex(
              (t) => t.contentName === contentName
            );
            
            if (existingTableIndex >= 0) {
              // Add column to existing content detail table
              const existingTable = contentDetailsTables[existingTableIndex];
              const columnExists = existingTable.columns?.some(
                (col) => col.bind === bindValue
              );
              if (!columnExists) {
                const updatedTables = [...contentDetailsTables];
                updatedTables[existingTableIndex] = {
                  ...existingTable,
                  columns: [
                    ...(existingTable.columns || []),
                    { bind: bindValue, label: labelValue, visible: true },
                  ],
                };
                return {
                  ...prev,
                  contentDetailsTables: updatedTables,
                };
              }
              return prev;
            } else {
              // Create new content detail table in bill-content zone
              const canvasElement = document.querySelector('.canvas');
              let x = 20;
              let y = 20;
              
              if (clientOffset && canvasElement) {
                const canvasRect = canvasElement.getBoundingClientRect();
                // Calculate position relative to bill-content section
                const pageHeaderHeight = template.sectionHeights?.pageHeader || 60;
                const billHeaderHeight = template.sectionHeights?.billHeader || 200;
                const absoluteY = clientOffset.y - canvasRect.top;
                const billContentTop = 40 + pageHeaderHeight + 10 + billHeaderHeight + 10;
                
                x = clientOffset.x - canvasRect.left - 20;
                y = absoluteY - billContentTop - 10; // Position relative to bill-content zone
                y = Math.max(0, y); // Ensure non-negative
              }
              
              return {
                ...prev,
                contentDetailsTables: [
                  ...contentDetailsTables,
                  {
                    contentName,
                    columns: [
                      { bind: bindValue, label: labelValue, visible: true },
                    ],
                    x,
                    y,
                  },
                ],
              };
            }
          });
        }
      }
    },
    [template.header.length, template.itemsTable]
  );

  const handleDrop = useCallback(
    (
      item: {
        type: 'text' | 'table' | 'pageNumber' | 'totalPages';
        targetSection?: 'pageHeader' | 'pageFooter' | 'header' | 'billContent' | 'billFooter' | 'itemsTable';
      },
      monitor: any
    ) => {
      const clientOffset = monitor?.getClientOffset();
      const canvasElement = document.querySelector('.canvas');
      
      if (item.type === 'pageNumber' || item.type === 'totalPages') {
        // Page number fields can only be dropped in pageHeader or pageFooter
        let section: 'pageHeader' | 'pageFooter' =
          item.targetSection === 'pageFooter' ? 'pageFooter' : 'pageHeader';
        
        if (clientOffset && canvasElement) {
          const canvasRect = canvasElement.getBoundingClientRect();
          const y = clientOffset.y - canvasRect.top;
          const canvasHeight = template.page.orientation === 'landscape' ? 794 : 1123;
          
          const pageHeaderHeight = template.sectionHeights?.pageHeader || 60;
          const pageFooterHeight = template.sectionHeights?.pageFooter || 60;
          const pageHeaderTop = 40;
          const pageHeaderBottom = pageHeaderTop + pageHeaderHeight;
          const pageFooterTop = canvasHeight - pageFooterHeight - 10;
          
          // Determine if dropped in pageHeader or pageFooter (unless explicitly targeted)
          if (!item.targetSection) {
            if (y < pageHeaderBottom) {
              section = 'pageHeader';
            } else if (y > pageFooterTop) {
              section = 'pageFooter';
            } else {
              section = 'pageHeader';
            }
          }
        }
        
        // Calculate position relative to section
        let relativeY = 20;
        let x = 20;
        if (clientOffset && canvasElement) {
          const canvasRect = canvasElement.getBoundingClientRect();
          const absoluteY = clientOffset.y - canvasRect.top;
          x = clientOffset.x - canvasRect.left - 20;
          
          if (section === 'pageHeader') {
            relativeY = absoluteY - 40 - 10;
          } else {
            const pageFooterHeight = template.sectionHeights?.pageFooter || 60;
            relativeY = absoluteY - (canvasRect.height - pageFooterHeight);
          }
          relativeY = Math.max(0, relativeY);
        }
        
        const newField: TextFieldConfig = {
          type: 'text',
          label: item.type === 'pageNumber' ? 'Page' : 'Total Pages',
          bind: '',
          x,
          y: relativeY,
          visible: true,
          fieldType: item.type,
        };
        
        setTemplate((prev) => {
          if (section === 'pageHeader') {
            return { ...prev, pageHeader: [...(prev.pageHeader || []), newField] };
          } else {
            return { ...prev, pageFooter: [...(prev.pageFooter || []), newField] };
          }
        });
      } else if (item.type === 'text') {
        // Determine target section based on drop position
        let section: 'pageHeader' | 'pageFooter' | 'header' | 'billContent' | 'billFooter' =
          (item.targetSection && item.targetSection !== 'itemsTable'
            ? item.targetSection
            : 'header') as any;
        
        if (!item.targetSection && clientOffset && canvasElement) {
          const canvasRect = canvasElement.getBoundingClientRect();
          const y = clientOffset.y - canvasRect.top;
          const canvasHeight = template.page.orientation === 'landscape' ? 794 : 1123;
          
          const pageHeaderHeight = template.sectionHeights?.pageHeader || 60;
          const billHeaderHeight = template.sectionHeights?.billHeader || 200;
          const billContentHeight = template.sectionHeights?.billContent || 100;
          const billFooterHeight = template.sectionHeights?.billFooter || 100;
          const pageFooterHeight = template.sectionHeights?.pageFooter || 60;
          
          const pageHeaderTop = 40;
          const billHeaderTop = pageHeaderTop + pageHeaderHeight + 10;
          const billContentTop = billHeaderTop + billHeaderHeight + 10;
          const billContentBottom = billContentTop + billContentHeight;
          const billFooterBottom = canvasHeight - pageFooterHeight - 10;
          const billFooterTop = billFooterBottom - billFooterHeight;
          
          if (y < pageHeaderTop + pageHeaderHeight) {
            section = 'pageHeader';
          } else if (y >= billHeaderTop && y < billContentTop) {
            section = 'header';
          } else if (y >= billContentTop && y < billContentBottom) {
            section = 'billContent';
          } else if (y >= billFooterTop && y < billFooterBottom) {
            section = 'billFooter';
          } else if (y > canvasHeight - pageFooterHeight) {
            section = 'pageFooter';
          }
        }
        
        const newField: TextFieldConfig = {
          type: 'text',
          label: 'New Field',
          bind: 'header.FieldName',
          x: 20,
          y: 20,
          visible: true,
        };
        
        setTemplate((prev) => {
          if (section === 'pageHeader') {
            return { ...prev, pageHeader: [...(prev.pageHeader || []), newField] };
          } else if (section === 'pageFooter') {
            return { ...prev, pageFooter: [...(prev.pageFooter || []), newField] };
          } else if (section === 'billContent') {
            return { ...prev, billContent: [...(prev.billContent || []), newField] };
          } else if (section === 'billFooter') {
            return { ...prev, billFooter: [...(prev.billFooter || []), newField] };
          } else {
            return { ...prev, header: [...prev.header, newField] };
          }
        });
      } else if (item.type === 'table') {
        // Determine if dropping into bill-content or creating items table
        let section: 'billContent' | 'itemsTable' =
          item.targetSection === 'billContent' ? 'billContent' : 'itemsTable';
        
        if (!item.targetSection && clientOffset && canvasElement) {
          const canvasRect = canvasElement.getBoundingClientRect();
          const y = clientOffset.y - canvasRect.top;
          
          const pageHeaderHeight = template.sectionHeights?.pageHeader || 60;
          const billHeaderHeight = template.sectionHeights?.billHeader || 200;
          const billContentHeight = template.sectionHeights?.billContent || 100;
          
          const billHeaderTop = 40 + pageHeaderHeight + 10;
          const billContentTop = billHeaderTop + billHeaderHeight + 10;
          const billContentBottom = billContentTop + billContentHeight;
          
          if (y >= billContentTop && y < billContentBottom) {
            section = 'billContent';
          }
        }
        
        const newTable: ItemsTableConfig = {
          columns: [
            { bind: 'ItemName', label: 'Item', visible: true },
            { bind: 'Qty', label: 'Qty', visible: true },
            { bind: 'Amount', label: 'Amount', visible: true },
          ],
          x: clientOffset && canvasElement ? clientOffset.x - canvasElement.getBoundingClientRect().left - 20 : 20,
          y: clientOffset && canvasElement ? 
            (section === 'billContent' ? 
              clientOffset.y - canvasElement.getBoundingClientRect().top - 
              (40 + (template.sectionHeights?.pageHeader || 60) + 10 + 
               (template.sectionHeights?.billHeader || 200) + 10) - 10 : 
              clientOffset.y - canvasElement.getBoundingClientRect().top - 20) : 20,
        };
        
        if (section === 'billContent') {
          setTemplate((prev) => ({
            ...prev,
            billContentTables: [...(prev.billContentTables || []), newTable],
          }));
        } else {
          setTemplate((prev) => ({
            ...prev,
            itemsTable: newTable,
          }));
        }
      }
    },
    [template.header.length, template.sectionHeights]
  );

  const handleImageDrop = useCallback(
    (item: { type: 'image'; imageId: number; base64Data: string; width: number; height: number }, monitor: any) => {
      const clientOffset = monitor?.getClientOffset();
      const canvasElement = document.querySelector('.canvas');
      
      // Determine target section based on drop position
      let section: 'pageHeader' | 'pageFooter' | 'header' | 'billContent' | 'billFooter' = 'header';
      
      if (clientOffset && canvasElement) {
        const canvasRect = canvasElement.getBoundingClientRect();
        const y = clientOffset.y - canvasRect.top;
        const canvasHeight = template.page.orientation === 'landscape' ? 794 : 1123;
        
        const pageHeaderHeight = template.sectionHeights?.pageHeader || 60;
        const billHeaderHeight = template.sectionHeights?.billHeader || 200;
        const billContentHeight = template.sectionHeights?.billContent || 100;
        const billFooterHeight = template.sectionHeights?.billFooter || 100;
        const pageFooterHeight = template.sectionHeights?.pageFooter || 60;
        
        const pageHeaderTop = 40;
        const billHeaderTop = pageHeaderTop + pageHeaderHeight + 10;
        const billContentTop = billHeaderTop + billHeaderHeight + 10;
        const billContentBottom = billContentTop + billContentHeight;
        const billFooterBottom = canvasHeight - pageFooterHeight - 10;
        const billFooterTop = billFooterBottom - billFooterHeight;
        
        if (y < pageHeaderTop + pageHeaderHeight) {
          section = 'pageHeader';
        } else if (y >= billHeaderTop && y < billContentTop) {
          section = 'header';
        } else if (y >= billContentTop && y < billContentBottom) {
          section = 'billContent';
        } else if (y >= billFooterTop && y < billFooterBottom) {
          section = 'billFooter';
        } else if (y > canvasHeight - pageFooterHeight) {
          section = 'pageFooter';
        }
      }
      
      const newImage: ImageFieldConfig = {
        type: 'image',
        imageId: item.imageId,
        x: clientOffset && canvasElement ? clientOffset.x - canvasElement.getBoundingClientRect().left - 20 : 20,
        y: clientOffset && canvasElement ? clientOffset.y - canvasElement.getBoundingClientRect().top - 20 : 20,
        width: Math.min(item.width, 200), // Default max width
        height: undefined, // Let it maintain aspect ratio
        visible: true,
      };
      
      setTemplate((prev) => {
        const sectionKey = section === 'pageHeader' ? 'pageHeaderImages' :
                          section === 'pageFooter' ? 'pageFooterImages' :
                          section === 'header' ? 'headerImages' :
                          section === 'billContent' ? 'billContentImages' :
                          'billFooterImages';
        return {
          ...prev,
          [sectionKey]: [...(prev[sectionKey as keyof TemplateJson] as ImageFieldConfig[] || []), newImage],
        };
      });
    },
    [template.page.orientation, template.sectionHeights]
  );

  const [{ isOver }, drop] = useDrop({
    accept: ['text', 'table', 'pageNumber', 'totalPages', 'data-field', 'image'],
    drop: (item: any, monitor) => {
      if (item.type === 'data-field' || item.fieldType) {
        // Handle data field drop - targetSection is already in item
        handleDataFieldDrop(item, monitor.getClientOffset());
      } else if (item.type === 'image') {
        // Handle image drop
        handleImageDrop(item, monitor);
      } else {
        // Handle regular toolbar drop
        handleDrop(item, monitor);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  const updateField = (index: number, field: Partial<TextFieldConfig>, section: 'pageHeader' | 'pageFooter' | 'header' | 'billContent' | 'billFooter' = 'header') => {
    setTemplate((prev) => {
      if (section === 'pageHeader' && prev.pageHeader) {
        return {
          ...prev,
          pageHeader: prev.pageHeader.map((f, i) => (i === index ? { ...f, ...field } : f)),
        };
      } else if (section === 'pageFooter' && prev.pageFooter) {
        return {
          ...prev,
          pageFooter: prev.pageFooter.map((f, i) => (i === index ? { ...f, ...field } : f)),
        };
      } else if (section === 'billFooter' && prev.billFooter) {
        return {
          ...prev,
          billFooter: prev.billFooter.map((f, i) => (i === index ? { ...f, ...field } : f)),
        };
      } else if (section === 'billContent' && prev.billContent) {
        return {
          ...prev,
          billContent: prev.billContent.map((f, i) => (i === index ? { ...f, ...field } : f)),
        };
      } else {
        return {
          ...prev,
          header: prev.header.map((f, i) => (i === index ? { ...f, ...field } : f)),
        };
      }
    });
  };

  const deleteField = (index: number, section: 'pageHeader' | 'pageFooter' | 'header' | 'billContent' | 'billFooter' = 'header') => {
    setTemplate((prev) => {
      if (section === 'pageHeader' && prev.pageHeader) {
        return { ...prev, pageHeader: prev.pageHeader.filter((_, i) => i !== index) };
      } else if (section === 'pageFooter' && prev.pageFooter) {
        return { ...prev, pageFooter: prev.pageFooter.filter((_, i) => i !== index) };
      } else if (section === 'billFooter' && prev.billFooter) {
        return { ...prev, billFooter: prev.billFooter.filter((_, i) => i !== index) };
      } else if (section === 'billContent' && prev.billContent) {
        return { ...prev, billContent: prev.billContent.filter((_, i) => i !== index) };
      } else {
        return { ...prev, header: prev.header.filter((_, i) => i !== index) };
      }
    });
    if (selectedElement?.type === 'field' && selectedElement.index === index && selectedElement.section === section) {
      setSelectedElement(null);
    }
  };

  const updateImage = (index: number, image: Partial<ImageFieldConfig>, section: 'pageHeader' | 'pageFooter' | 'header' | 'billContent' | 'billFooter' = 'header') => {
    setTemplate((prev) => {
      const sectionKey = section === 'pageHeader' ? 'pageHeaderImages' :
                        section === 'pageFooter' ? 'pageFooterImages' :
                        section === 'header' ? 'headerImages' :
                        section === 'billContent' ? 'billContentImages' :
                        'billFooterImages';
      const images = (prev[sectionKey as keyof TemplateJson] as ImageFieldConfig[]) || [];
      return {
        ...prev,
        [sectionKey]: images.map((img, i) => (i === index ? { ...img, ...image } : img)),
      };
    });
  };

  const deleteImage = (index: number, section: 'pageHeader' | 'pageFooter' | 'header' | 'billContent' | 'billFooter' = 'header') => {
    setTemplate((prev) => {
      const sectionKey = section === 'pageHeader' ? 'pageHeaderImages' :
                        section === 'pageFooter' ? 'pageFooterImages' :
                        section === 'header' ? 'headerImages' :
                        section === 'billContent' ? 'billContentImages' :
                        'billFooterImages';
      const images = (prev[sectionKey as keyof TemplateJson] as ImageFieldConfig[]) || [];
      return {
        ...prev,
        [sectionKey]: images.filter((_, i) => i !== index),
      };
    });
    if (selectedElement?.type === 'image' && selectedElement.index === index && selectedElement.section === section) {
      setSelectedElement(null);
    }
  };

  const updateTable = (table: ItemsTableConfig) => {
    setTemplate((prev) => ({
      ...prev,
      itemsTable: table,
    }));
  };

  const updateContentDetailTable = (index: number, table: ContentDetailsTableConfig) => {
    setTemplate((prev) => {
      const contentDetailsTables = prev.contentDetailsTables || [];
      const updated = [...contentDetailsTables];
      updated[index] = table;
      return {
        ...prev,
        contentDetailsTables: updated,
      };
    });
  };

  const deleteContentDetailTable = (index: number) => {
    setTemplate((prev) => {
      const contentDetailsTables = prev.contentDetailsTables || [];
      return {
        ...prev,
        contentDetailsTables: contentDetailsTables.filter((_, i) => i !== index),
      };
    });
    if (selectedElement?.type === 'contentDetailTable' && selectedElement.index === index) {
      setSelectedElement(null);
    }
  };

  const updateBillContentTable = (index: number, table: ItemsTableConfig) => {
    setTemplate((prev) => {
      const billContentTables = prev.billContentTables || [];
      const updated = [...billContentTables];
      updated[index] = table;
      return {
        ...prev,
        billContentTables: updated,
      };
    });
  };

  const deleteBillContentTable = (index: number) => {
    setTemplate((prev) => {
      const billContentTables = prev.billContentTables || [];
      return {
        ...prev,
        billContentTables: billContentTables.filter((_, i) => i !== index),
      };
    });
    if (selectedElement?.type === 'billContentTable' && selectedElement.index === index) {
      setSelectedElement(null);
    }
  };

  const updatePage = (page: { size?: string; orientation?: 'portrait' | 'landscape' }) => {
    setTemplate((prev) => ({
      ...prev,
      page: {
        ...prev.page,
        ...page,
      },
    }));
  };

  const handlePresetSelect = (presetId: number) => {
    setSelectedPresetId(presetId);
    setSelectedTemplateId(undefined);
    setSampleData(null);
  };

  const handleTemplateSelect = (templateId: number) => {
    setSelectedTemplateId(templateId);
  };

  const handleDataReceived = (data: {
    header: { data: Record<string, any> | null; fields: string[] };
    items: { data: Record<string, any>[]; fields: string[]; sampleCount: number };
    contentDetails?: Record<string, { data: Record<string, any>[] | Record<string, any> | null; fields: string[]; sampleCount: number; dataType?: 'array' | 'object' }>;
  }) => {
    setSampleData(data);
  };

  const saveTemplate = async () => {
    if (!selectedPresetId) {
      alert('Please select a preset first');
      return;
    }

    setIsSaving(true);
    try {
      // Ensure sectionHeights is included in template before saving
      const templateToSave = {
        ...template,
        sectionHeights: template.sectionHeights || {},
      };
      const templateJson = JSON.stringify(templateToSave);
      
      if (selectedTemplateId) {
        await apiClient.updateTemplate(selectedTemplateId, { templateJson });
        alert('Template updated successfully');
      } else {
        const name = prompt('Enter template name:');
        if (name && selectedPresetId) {
          const newTemplate = await apiClient.createTemplate({
            presetId: selectedPresetId,
            templateName: name,
            templateJson,
          });
          // Set selectedTemplateId so the template can be updated in future saves
          setSelectedTemplateId(newTemplate.TemplateId);
          alert('Template created successfully');
          // Templates list will auto-refresh via PresetSelector component
        }
      }
    } catch (error: any) {
      alert(`Failed to save template: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate distance between two touch points
  const getTouchDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Pinch-to-zoom handlers
  const handlePinchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      pinchStateRef.current = {
        initialDistance: distance,
        initialZoom: canvasZoom,
        isPinching: true,
      };
    }
  }, [canvasZoom]);

  const handlePinchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2 && pinchStateRef.current.isPinching) {
      e.preventDefault();
      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      const scale = distance / pinchStateRef.current.initialDistance;
      const newZoom = Math.max(0.2, Math.min(2, pinchStateRef.current.initialZoom * scale));
      setCanvasZoom(newZoom);
    }
  }, [setCanvasZoom]);

  const handlePinchEnd = useCallback(() => {
    pinchStateRef.current.isPinching = false;
  }, []);

  // Set up pinch-to-zoom event listeners on canvas container
  React.useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container || !isTouchDevice) return;

    // Use passive: false to allow preventDefault for pinch gestures
    container.addEventListener('touchstart', handlePinchStart, { passive: false });
    container.addEventListener('touchmove', handlePinchMove, { passive: false });
    container.addEventListener('touchend', handlePinchEnd);
    container.addEventListener('touchcancel', handlePinchEnd);

    return () => {
      container.removeEventListener('touchstart', handlePinchStart);
      container.removeEventListener('touchmove', handlePinchMove);
      container.removeEventListener('touchend', handlePinchEnd);
      container.removeEventListener('touchcancel', handlePinchEnd);
    };
  }, [isTouchDevice, handlePinchStart, handlePinchMove, handlePinchEnd]);

  // Handle canvas click/tap for placement mode and element deselection
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    // If in placement mode on mobile, handle element placement
    if (isMobile && isPlacementMode && placementItem) {
      e.preventDefault();
      e.stopPropagation();
      
      // Get click position relative to canvas
      const canvas = e.currentTarget as HTMLElement;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / canvasZoom;
      const y = (e.clientY - rect.top) / canvasZoom;
      
      // Create element at click position based on type
      if (placementItem.type === 'text') {
        // Add a text field at position
        const targetSection = placementItem.targetSection || 'header';
        const newField: TextFieldConfig = {
          type: 'text',
          label: 'New Text Field',
          bind: '',
          x: x,
          y: y,
          visible: true,
          fontSize: 12,
          fontWeight: 'normal',
          color: '#000000',
        };
        setTemplate(prev => {
          const sectionKey = targetSection === 'header' ? 'header' : targetSection;
          const currentFields = (prev[sectionKey as keyof TemplateJson] as TextFieldConfig[]) || [];
          return {
            ...prev,
            [sectionKey]: [...currentFields, newField],
          };
        });
      } else if (placementItem.type === 'data-field' && placementItem.field) {
        const targetSection = placementItem.targetSection || 'header';
        const newField: TextFieldConfig = {
          type: 'text',
          label: placementItem.field,
          bind: placementItem.field,
          x: x,
          y: y,
          visible: true,
          fontSize: 12,
          fontWeight: 'normal',
          color: '#000000',
        };
        setTemplate(prev => {
          const sectionKey = targetSection === 'header' ? 'header' : targetSection;
          const currentFields = (prev[sectionKey as keyof TemplateJson] as TextFieldConfig[]) || [];
          return {
            ...prev,
            [sectionKey]: [...currentFields, newField],
          };
        });
      } else if (placementItem.type === 'image' && placementItem.imageId) {
        const targetSection = placementItem.targetSection || 'header';
        const newImage: ImageFieldConfig = {
          type: 'image',
          imageId: placementItem.imageId,
          x: x,
          y: y,
          width: 100,
          height: 100,
          visible: true,
        };
        setTemplate(prev => {
          const sectionKey = targetSection === 'pageHeader' ? 'pageHeaderImages' :
                           targetSection === 'pageFooter' ? 'pageFooterImages' :
                           targetSection === 'header' ? 'headerImages' :
                           targetSection === 'billContent' ? 'billContentImages' :
                           'billFooterImages';
          const currentImages = (prev[sectionKey as keyof TemplateJson] as ImageFieldConfig[]) || [];
          return {
            ...prev,
            [sectionKey]: [...currentImages, newImage],
          };
        });
      } else if (placementItem.type === 'table') {
        // Add items table
        if (!template.itemsTable) {
          setTemplate(prev => ({
            ...prev,
            itemsTable: {
              x: x,
              y: y,
              columns: [{ bind: '', label: 'Column 1', visible: true, width: 100 }],
              style: {
                headerBackground: '#f0f0f0',
                headerTextColor: '#000000',
                rowBackground: '#ffffff',
                alternateRowBackground: '#f9f9f9',
                borderColor: '#cccccc',
                fontSize: 10,
              },
            },
          }));
        }
      } else if (placementItem.type === 'pageNumber' || placementItem.type === 'totalPages') {
        const targetSection = placementItem.targetSection || 'pageFooter';
        const newField: TextFieldConfig = {
          type: 'text',
          label: placementItem.type === 'pageNumber' ? 'Page Number' : 'Total Pages',
          bind: '',
          x: x,
          y: y,
          visible: true,
          fontSize: 10,
          fontWeight: 'normal',
          color: '#000000',
          fieldType: placementItem.type,
        };
        setTemplate(prev => {
          const currentFields = (prev[targetSection as keyof TemplateJson] as TextFieldConfig[]) || [];
          return {
            ...prev,
            [targetSection]: [...currentFields, newField],
          };
        });
      }
      
      exitPlacementMode();
      return;
    }
    
    // Clear selection when clicking on canvas, section zones, or canvas header
    const target = e.target as HTMLElement;
    if (
      e.target === e.currentTarget ||
      target.classList.contains('canvas-header') ||
      target.classList.contains('section-zone') ||
      target.classList.contains('section-label')
    ) {
      setSelectedElement(null);
    }
  }, [isMobile, isPlacementMode, placementItem, canvasZoom, exitPlacementMode, template.itemsTable]);

  return (
    <div className={`template-designer ${isMobile ? 'template-designer-mobile' : ''}`}>
      {/* Mobile Placement Mode Banner */}
      {isMobile && isPlacementMode && (
        <div className="placement-mode-banner">
          <span className="placement-icon">📍</span>
          <span>Tap on canvas to place {placementItem?.type === 'data-field' ? placementItem.field : placementItem?.type}</span>
          <button onClick={exitPlacementMode} className="cancel-placement-btn">✕</button>
        </div>
      )}
      
      <div className="designer-content">
        {/* Properties Panel - hidden on mobile when not on properties tab */}
        <div className={`properties-panel-container ${isMobile && activeDesignerTab !== 'properties' ? 'mobile-hidden' : ''}`}>
          <PropertyPanel
            selectedElement={selectedElement}
            template={template}
            onUpdateField={(index, updates, section) => updateField(index, updates, section || 'header')}
            onUpdateImage={(index, updates, section) => updateImage(index, updates, section || 'header')}
            onUpdateTable={updateTable}
            onUpdateContentDetailTable={updateContentDetailTable}
            onUpdateBillContentTable={updateBillContentTable}
            onUpdatePage={updatePage}
            onUpdatePagination={(pagination: { rowsPerPage?: number; repeatHeader?: boolean }) => {
              setTemplate((prev) => ({
                ...prev,
                pagination: {
                  rowsPerPage: pagination.rowsPerPage,
                  repeatHeader: pagination.repeatHeader !== false,
                },
              }));
            }}
            onSave={saveTemplate}
            isSaving={isSaving}
            onSetup={() => setIsSetupPanelOpen(true)}
            onOpenTableModal={(type, index) => {
              setEditingTable({ type, index });
              setIsTableModalOpen(true);
            }}
            onOpenZoneConfig={() => setIsZoneConfigModalOpen(true)}
          />
        </div>
        <div className="designer-content-wrapper">
          {/* Canvas Container - hidden on mobile when not on canvas tab */}
          <div 
            ref={canvasContainerRef}
            className={`canvas-container ${isMobile && activeDesignerTab !== 'canvas' ? 'mobile-hidden' : ''}`}
          >
          {/* Canvas Scroll Wrapper - provides correct scroll dimensions for scaled canvas */}
          {/* Canvas has 40px padding on each side = 80px total, must be included before scaling */}
          <div 
            className="canvas-scroll-wrapper"
            style={{
              width: `${(pageDimensions.width + 80) * canvasZoom}px`,
              height: `${(pageDimensions.height + 80) * canvasZoom}px`,
            }}
          >
          <div
            ref={drop}
            className={`canvas ${isOver ? 'drag-over' : ''} ${isPlacementMode ? 'placement-mode' : ''}`}
            style={{
              width: `${pageDimensions.width}px`,
              minHeight: `${pageDimensions.height}px`,
              transform: `scale(${canvasZoom})`,
              transformOrigin: 'top left',
            }}
            onClick={handleCanvasClick}
          >
            <div className="canvas-header">
              <h3>Template Canvas ({template.page.size} - {template.page.orientation})</h3>
            </div>
            
            {/* Page Header Section */}
            <ResizableSectionZone
              className="page-header-zone"
              label="Page Header"
              height={template.sectionHeights?.pageHeader || 60}
              top={40}
              onHeightChange={(height) => {
                setTemplate((prev) => ({
                  ...prev,
                  sectionHeights: { ...prev.sectionHeights, pageHeader: height },
                }));
              }}
            >
              {(template.pageHeader || []).map((field, index) => (
                <FieldEditor
                  key={`pageHeader-${index}`}
                  field={field}
                  index={index}
                  isSelected={selectedElement?.type === 'field' && selectedElement.index === index && selectedElement.section === 'pageHeader'}
                  onSelect={() => setSelectedElement({ type: 'field', index, section: 'pageHeader' })}
                  onUpdate={(updates) => updateField(index, updates, 'pageHeader')}
                  onDelete={() => deleteField(index, 'pageHeader')}
                  sampleData={sampleData?.header?.data || null}
                  fullSampleData={sampleData}
                  section="pageHeader"
                  canvasZoom={canvasZoom}
                />
              ))}
              {(template.pageHeaderImages || []).map((imageField, index) => (
                <ImageEditor
                  key={`pageHeaderImage-${index}`}
                  imageField={imageField}
                  index={index}
                  isSelected={selectedElement?.type === 'image' && selectedElement.index === index && selectedElement.section === 'pageHeader'}
                  onSelect={() => setSelectedElement({ type: 'image', index, section: 'pageHeader' })}
                  onUpdate={(updates) => updateImage(index, updates, 'pageHeader')}
                  onDelete={() => deleteImage(index, 'pageHeader')}
                  section="pageHeader"
                  canvasZoom={canvasZoom}
                />
              ))}
            </ResizableSectionZone>
            
            {/* Bill Header Section */}
            <ResizableSectionZone
              className="bill-header-zone"
              label="Bill Header"
              height={template.sectionHeights?.billHeader || 200}
              top={40 + (template.sectionHeights?.pageHeader || 60) + 10}
              onHeightChange={(height) => {
                setTemplate((prev) => ({
                  ...prev,
                  sectionHeights: { ...prev.sectionHeights, billHeader: height },
                }));
              }}
            >
              {template.header.map((field, index) => (
                <FieldEditor
                  key={`header-${index}`}
                  field={field}
                  index={index}
                  isSelected={selectedElement?.type === 'field' && selectedElement.index === index && selectedElement.section === 'header'}
                  onSelect={() => setSelectedElement({ type: 'field', index, section: 'header' })}
                  onUpdate={(updates) => updateField(index, updates, 'header')}
                  onDelete={() => deleteField(index, 'header')}
                  sampleData={sampleData?.header?.data || null}
                  fullSampleData={sampleData}
                  section="header"
                  canvasZoom={canvasZoom}
                />
              ))}
              {(template.headerImages || []).map((imageField, index) => (
                <ImageEditor
                  key={`headerImage-${index}`}
                  imageField={imageField}
                  index={index}
                  isSelected={selectedElement?.type === 'image' && selectedElement.index === index && selectedElement.section === 'header'}
                  onSelect={() => setSelectedElement({ type: 'image', index, section: 'header' })}
                  onUpdate={(updates) => updateImage(index, updates, 'header')}
                  onDelete={() => deleteImage(index, 'header')}
                  section="header"
                  canvasZoom={canvasZoom}
                />
              ))}
            </ResizableSectionZone>
            
            {/* Bill Content Section */}
            <ResizableSectionZone
              className="bill-content-zone"
              label="Bill Content"
              height={template.sectionHeights?.billContent || 100}
              top={40 + (template.sectionHeights?.pageHeader || 60) + 10 + (template.sectionHeights?.billHeader || 200) + 10}
              onHeightChange={(height) => {
                setTemplate((prev) => ({
                  ...prev,
                  sectionHeights: { ...prev.sectionHeights, billContent: height },
                }));
              }}
            >
              {(template.billContent || []).map((field, index) => (
                <FieldEditor
                  key={`billContent-${index}`}
                  field={field}
                  index={index}
                  isSelected={selectedElement?.type === 'field' && selectedElement.index === index && selectedElement.section === 'billContent'}
                  onSelect={() => setSelectedElement({ type: 'field', index, section: 'billContent' })}
                  onUpdate={(updates) => updateField(index, updates, 'billContent')}
                  onDelete={() => deleteField(index, 'billContent')}
                  sampleData={sampleData?.header?.data || null}
                  fullSampleData={sampleData}
                  section="billContent"
                  canvasZoom={canvasZoom}
                />
              ))}
              {(template.billContentImages || []).map((imageField, index) => (
                <ImageEditor
                  key={`billContentImage-${index}`}
                  imageField={imageField}
                  index={index}
                  isSelected={selectedElement?.type === 'image' && selectedElement.index === index && selectedElement.section === 'billContent'}
                  onSelect={() => setSelectedElement({ type: 'image', index, section: 'billContent' })}
                  onUpdate={(updates) => updateImage(index, updates, 'billContent')}
                  onDelete={() => deleteImage(index, 'billContent')}
                  section="billContent"
                  canvasZoom={canvasZoom}
                />
              ))}
              {(template.billContentTables || []).map((table, index) => {
                // Create a unique key that includes finalRows info to force re-render when finalRows change
                const finalRowsKey = table.finalRows 
                  ? `${table.finalRows.length}-${table.finalRows.map(r => r.cells.length).join('-')}`
                  : '0';
                return (
                  <TableEditor
                    key={`billContentTable-${index}-${finalRowsKey}`}
                    table={table}
                    isSelected={selectedElement?.type === 'billContentTable' && selectedElement.index === index}
                    onSelect={() => setSelectedElement({ type: 'billContentTable', index })}
                    onUpdate={(updatedTable) => updateBillContentTable(index, updatedTable as ItemsTableConfig)}
                    x={table.x || 20}
                    y={table.y || 20}
                    onPositionChange={(x, y) => {
                      // Preserve all table properties including finalRows when updating position
                      updateBillContentTable(index, { ...table, x, y, finalRows: table.finalRows });
                    }}
                    onDelete={() => deleteBillContentTable(index)}
                    relativeToSection={true}
                    sampleData={sampleData?.items?.data || null}
                    canvasZoom={canvasZoom}
                  />
                );
              })}
              {(template.contentDetailsTables || []).map((cdTable, index) => {
                // Only handle array-type contentDetails for tables
                const contentDetail = cdTable.contentName && sampleData?.contentDetails?.[cdTable.contentName]
                  ? sampleData.contentDetails[cdTable.contentName]
                  : null;
                const contentDetailData = contentDetail && contentDetail.dataType === 'array' && Array.isArray(contentDetail.data)
                  ? contentDetail.data
                  : (contentDetail && Array.isArray(contentDetail.data) ? contentDetail.data : null);
                
                return (
                  <TableEditor
                    key={`contentDetail-${index}`}
                    table={cdTable}
                    isSelected={selectedElement?.type === 'contentDetailTable' && selectedElement.index === index}
                    onSelect={() => setSelectedElement({ type: 'contentDetailTable', index })}
                    onUpdate={(table) => updateContentDetailTable(index, table as ContentDetailsTableConfig)}
                    x={cdTable.x || 20}
                    y={cdTable.y || 20}
                    onPositionChange={(x, y) => {
                      updateContentDetailTable(index, { ...cdTable, x, y });
                    }}
                    onDelete={() => deleteContentDetailTable(index)}
                    label={`Content: ${cdTable.contentName}`}
                    relativeToSection={true}
                    sampleData={contentDetailData}
                    canvasZoom={canvasZoom}
                  />
                );
              })}
            </ResizableSectionZone>
            
            {/* Bill Footer Section */}
            {template.billFooter && template.billFooter.length > 0 && (
              <ResizableSectionZone
                className="bill-footer-zone"
                label="Bill Footer"
                height={template.sectionHeights?.billFooter || 100}
                bottom={(template.sectionHeights?.pageFooter || 60) + 10}
                isBottom={true}
                onHeightChange={(height) => {
                  setTemplate((prev) => ({
                    ...prev,
                    sectionHeights: { ...prev.sectionHeights, billFooter: height },
                  }));
                }}
              >
                {template.billFooter.map((field, index) => (
                  <FieldEditor
                    key={`billFooter-${index}`}
                    field={field}
                    index={index}
                    isSelected={selectedElement?.type === 'field' && selectedElement.index === index && selectedElement.section === 'billFooter'}
                    onSelect={() => setSelectedElement({ type: 'field', index, section: 'billFooter' })}
                    onUpdate={(updates) => updateField(index, updates, 'billFooter')}
                    onDelete={() => deleteField(index, 'billFooter')}
                    sampleData={sampleData?.header?.data || null}
                    fullSampleData={sampleData}
                    section="billFooter"
                    canvasZoom={canvasZoom}
                  />
                ))}
                {(template.billFooterImages || []).map((imageField, index) => (
                  <ImageEditor
                    key={`billFooterImage-${index}`}
                    imageField={imageField}
                    index={index}
                    isSelected={selectedElement?.type === 'image' && selectedElement.index === index && selectedElement.section === 'billFooter'}
                    onSelect={() => setSelectedElement({ type: 'image', index, section: 'billFooter' })}
                    onUpdate={(updates) => updateImage(index, updates, 'billFooter')}
                    onDelete={() => deleteImage(index, 'billFooter')}
                    section="billFooter"
                    canvasZoom={canvasZoom}
                  />
                ))}
              </ResizableSectionZone>
            )}
            
            {/* Page Footer Section */}
            <ResizableSectionZone
              className="page-footer-zone"
              label="Page Footer"
              height={template.sectionHeights?.pageFooter || 60}
              bottom={0}
              isBottom={true}
              onHeightChange={(height) => {
                setTemplate((prev) => ({
                  ...prev,
                  sectionHeights: { ...prev.sectionHeights, pageFooter: height },
                }));
              }}
            >
              {(template.pageFooter || []).map((field, index) => (
                <FieldEditor
                  key={`pageFooter-${index}`}
                  field={field}
                  index={index}
                  isSelected={selectedElement?.type === 'field' && selectedElement.index === index && selectedElement.section === 'pageFooter'}
                  onSelect={() => setSelectedElement({ type: 'field', index, section: 'pageFooter' })}
                  onUpdate={(updates) => updateField(index, updates, 'pageFooter')}
                  onDelete={() => deleteField(index, 'pageFooter')}
                  sampleData={sampleData?.header?.data || null}
                  fullSampleData={sampleData}
                  section="pageFooter"
                  canvasZoom={canvasZoom}
                />
              ))}
              {(template.pageFooterImages || []).map((imageField, index) => (
                <ImageEditor
                  key={`pageFooterImage-${index}`}
                  imageField={imageField}
                  index={index}
                  isSelected={selectedElement?.type === 'image' && selectedElement.index === index && selectedElement.section === 'pageFooter'}
                  onSelect={() => setSelectedElement({ type: 'image', index, section: 'pageFooter' })}
                  onUpdate={(updates) => updateImage(index, updates, 'pageFooter')}
                  onDelete={() => deleteImage(index, 'pageFooter')}
                  section="pageFooter"
                  canvasZoom={canvasZoom}
                />
              ))}
            </ResizableSectionZone>
            {template.itemsTable && (
              <TableEditor
                table={template.itemsTable}
                isSelected={selectedElement?.type === 'table'}
                onSelect={() => setSelectedElement({ type: 'table', index: 0 })}
                onUpdate={updateTable}
                x={template.itemsTable.x || 20}
                y={template.itemsTable.y || 20}
                onPositionChange={(x, y) => {
                  updateTable({ ...template.itemsTable!, x, y });
                }}
                sampleData={sampleData?.items?.data || null}
                canvasZoom={canvasZoom}
              />
            )}
          </div>
          </div>
          {/* Zoom Controls - positioned at bottom-right of canvas container */}
          {(!isMobile || activeDesignerTab === 'canvas') && (
            <div className="canvas-zoom-controls">
              <button onClick={zoomOut} className="zoom-btn zoom-out" aria-label="Zoom out">−</button>
              <div className="zoom-level-container">
                <button 
                  onClick={resetZoom} 
                  className="zoom-btn zoom-reset" 
                  aria-label="Reset zoom"
                  title="Click to reset to 100%"
                >
                  {Math.round(canvasZoom * 100)}%
                </button>
                <div className="zoom-presets">
                  <button 
                    onClick={() => setCanvasZoom(0.5)} 
                    className={`zoom-preset ${Math.abs(canvasZoom - 0.5) < 0.05 ? 'active' : ''}`}
                    title="50%"
                  >50%</button>
                  <button 
                    onClick={() => setCanvasZoom(0.75)} 
                    className={`zoom-preset ${Math.abs(canvasZoom - 0.75) < 0.05 ? 'active' : ''}`}
                    title="75%"
                  >75%</button>
                  <button 
                    onClick={() => setCanvasZoom(1)} 
                    className={`zoom-preset ${Math.abs(canvasZoom - 1) < 0.05 ? 'active' : ''}`}
                    title="100%"
                  >100%</button>
                  <button 
                    onClick={() => setCanvasZoom(1.5)} 
                    className={`zoom-preset ${Math.abs(canvasZoom - 1.5) < 0.05 ? 'active' : ''}`}
                    title="150%"
                  >150%</button>
                </div>
              </div>
              <button onClick={zoomIn} className="zoom-btn zoom-in" aria-label="Zoom in">+</button>
            </div>
          )}
        </div>
          {/* Side Panel - hidden on mobile when not on elements tab */}
          <div className={`side-panel-wrapper ${isMobile && activeDesignerTab !== 'elements' ? 'mobile-hidden' : ''}`}>
            <SidePanel
              sampleData={sampleData}
            />
          </div>
          
          {/* Data Preview Panel - only on mobile when data tab is active */}
          {isMobile && activeDesignerTab === 'data' && (
            <div className="data-panel-wrapper">
              {sampleData ? (
                <DataPreview
                  headerData={sampleData.header.data}
                  headerFields={sampleData.header.fields}
                  itemsData={sampleData.items.data}
                  itemsFields={sampleData.items.fields}
                  contentDetails={sampleData.contentDetails}
                />
              ) : (
                <div className="no-data-message">
                  <p>Execute query to see available data fields</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Mobile Tab Bar */}
      {isMobile && (
        <div className="mobile-tab-bar">
          <button
            className={`mobile-tab-btn ${activeDesignerTab === 'canvas' ? 'active' : ''}`}
            onClick={() => setActiveDesignerTab('canvas')}
          >
            <span className="mobile-tab-icon">🎨</span>
            <span className="mobile-tab-label">Canvas</span>
          </button>
          <button
            className={`mobile-tab-btn ${activeDesignerTab === 'elements' ? 'active' : ''}`}
            onClick={() => setActiveDesignerTab('elements')}
          >
            <span className="mobile-tab-icon">🧩</span>
            <span className="mobile-tab-label">Elements</span>
          </button>
          <button
            className={`mobile-tab-btn ${activeDesignerTab === 'data' ? 'active' : ''}`}
            onClick={() => setActiveDesignerTab('data')}
            disabled={!sampleData}
          >
            <span className="mobile-tab-icon">📊</span>
            <span className="mobile-tab-label">Data</span>
          </button>
          <button
            className={`mobile-tab-btn ${activeDesignerTab === 'properties' ? 'active' : ''}`}
            onClick={() => setActiveDesignerTab('properties')}
          >
            <span className="mobile-tab-icon">⚙️</span>
            <span className="mobile-tab-label">Properties</span>
          </button>
          <button
            className="mobile-tab-btn save-btn"
            onClick={saveTemplate}
            disabled={isSaving}
          >
            <span className="mobile-tab-icon">{isSaving ? '⏳' : '💾'}</span>
            <span className="mobile-tab-label">{isSaving ? 'Saving' : 'Save'}</span>
          </button>
        </div>
      )}
      
      <SetupPanel
        isOpen={isSetupPanelOpen}
        onClose={() => setIsSetupPanelOpen(false)}
        selectedPresetId={selectedPresetId}
        selectedTemplateId={selectedTemplateId}
        onPresetSelect={handlePresetSelect}
        onTemplateSelect={handleTemplateSelect}
        onDataReceived={handleDataReceived}
      />
      {isTableModalOpen && editingTable && (() => {
        let table: ItemsTableConfig | ContentDetailsTableConfig | undefined;
        let tableLabel: string | undefined;
        
        if (editingTable.type === 'itemsTable' && template.itemsTable) {
          table = template.itemsTable;
          tableLabel = 'Items Table';
        } else if (editingTable.type === 'billContentTable' && template.billContentTables && editingTable.index !== undefined) {
          table = template.billContentTables[editingTable.index];
          tableLabel = 'Bill Content Table';
        } else if (editingTable.type === 'contentDetailTable' && template.contentDetailsTables && editingTable.index !== undefined) {
          const contentTable = template.contentDetailsTables[editingTable.index];
          table = contentTable;
          tableLabel = `Content Detail Table: ${contentTable.contentName || 'Unknown'}`;
        }
        
        if (!table) return null;
        
        return (
          <TableEditorModal
            isOpen={isTableModalOpen}
            onClose={() => {
              setIsTableModalOpen(false);
              setEditingTable(null);
            }}
            table={table}
            onSave={(updatedTable) => {
              if (editingTable.type === 'itemsTable') {
                updateTable(updatedTable as ItemsTableConfig);
              } else if (editingTable.type === 'billContentTable' && editingTable.index !== undefined) {
                updateBillContentTable(editingTable.index, updatedTable as ItemsTableConfig);
              } else if (editingTable.type === 'contentDetailTable' && editingTable.index !== undefined) {
                updateContentDetailTable(editingTable.index, updatedTable as ContentDetailsTableConfig);
              }
              setIsTableModalOpen(false);
              setEditingTable(null);
            }}
            tableType={editingTable.type}
            tableLabel={tableLabel}
            sampleData={sampleData}
          />
        );
      })()}
      {isZoneConfigModalOpen && (
        <ZoneConfigModal
          isOpen={isZoneConfigModalOpen}
          onClose={() => setIsZoneConfigModalOpen(false)}
          template={template}
          onSave={(zoneConfigs) => {
            setTemplate((prev) => ({
              ...prev,
              zoneConfigs,
              // Also update sectionHeights for backward compatibility
              sectionHeights: {
                pageHeader: zoneConfigs.pageHeader?.height,
                billHeader: zoneConfigs.billHeader?.height,
                billContent: zoneConfigs.billContent?.height,
                billFooter: zoneConfigs.billFooter?.height,
                pageFooter: zoneConfigs.pageFooter?.height,
              },
            }));
            setIsZoneConfigModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default Canvas;

