import React, { useState, useRef } from 'react';
import { useDrag } from 'react-dnd';
import { useMobile } from '../../contexts/MobileContext';
import './DataPreview.css';

interface DataPreviewProps {
  headerData: Record<string, any> | null;
  headerFields: string[];
  itemsData: Record<string, any>[];
  itemsFields: string[];
  contentDetails?: Record<string, { data: Record<string, any>[] | Record<string, any> | null; fields: string[]; sampleCount: number; dataType?: 'array' | 'object' }>;
}

const DraggableHeaderField: React.FC<{
  field: string;
  sampleValue: any;
  targetSection?: 'pageHeader' | 'pageFooter' | 'header' | 'billContent' | 'billFooter';
}> = ({ field, sampleValue, targetSection }) => {
  const { isMobile, enterPlacementMode } = useMobile();
  
  const [{ isDragging }, drag] = useDrag({
    type: 'data-field',
    item: {
      fieldType: 'header',
      fieldName: field,
      bind: `header.${field}`,
      label: field,
      targetSection,
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const handleTap = () => {
    if (isMobile) {
      enterPlacementMode({ 
        type: 'data-field', 
        field: `header.${field}`,
        targetSection 
      });
    }
  };

  return (
    <div
      ref={!isMobile ? drag : undefined}
      className={`field-item draggable-field ${isDragging ? 'dragging' : ''}`}
      title={isMobile ? "Tap to add field" : "Drag to canvas to add field"}
      onClick={isMobile ? handleTap : undefined}
      role={isMobile ? 'button' : undefined}
      tabIndex={isMobile ? 0 : undefined}
    >
      <code>header.{field}</code>
      {sampleValue !== null && sampleValue !== undefined && (
        <span className="field-value">
          Sample: {String(sampleValue)}
        </span>
      )}
    </div>
  );
};

const DraggableItemField: React.FC<{
  field: string;
  sampleValue: any;
}> = ({ field, sampleValue }) => {
  const { isMobile, enterPlacementMode } = useMobile();
  
  const [{ isDragging }, drag] = useDrag({
    type: 'data-field',
    item: {
      fieldType: 'item',
      fieldName: field,
      bind: field,
      label: field,
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const handleTap = () => {
    if (isMobile) {
      enterPlacementMode({ 
        type: 'data-field', 
        field: field,
        targetSection: 'billContent' 
      });
    }
  };

  return (
    <div
      ref={!isMobile ? drag : undefined}
      className={`field-item draggable-field ${isDragging ? 'dragging' : ''}`}
      title={isMobile ? "Tap to add field" : "Drag to canvas to add field"}
      onClick={isMobile ? handleTap : undefined}
      role={isMobile ? 'button' : undefined}
      tabIndex={isMobile ? 0 : undefined}
    >
      <code>{field}</code>
      {sampleValue !== null && sampleValue !== undefined && (
        <span className="field-value">
          Sample: {String(sampleValue)}
        </span>
      )}
    </div>
  );
};

const DraggableContentDetailField: React.FC<{
  contentName: string;
  field: string;
  sampleValue: any;
  bind?: string;
  label?: string;
  dataType?: 'array' | 'object';
}> = ({ contentName, field, sampleValue, bind, label, dataType }) => {
  const { isMobile, enterPlacementMode } = useMobile();
  
  const displayLabel = label || field;
  const bindPath = bind || field;
  const isObjectType = dataType === 'object';
  
  const [{ isDragging }, drag] = useDrag({
    type: 'data-field',
    item: {
      fieldType: 'contentDetail',
      contentName,
      fieldName: field,
      bind: bindPath,
      label: displayLabel,
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const handleTap = () => {
    if (isMobile) {
      enterPlacementMode({ 
        type: 'data-field', 
        field: bindPath,
        targetSection: isObjectType ? 'header' : 'billContent'
      });
    }
  };

  const tooltipText = isMobile
    ? "Tap to add field"
    : isObjectType 
      ? `Drag to canvas to add field (Object type: ${contentName})`
      : "Drag to content detail table to add column (Array type)";

  return (
    <div
      ref={!isMobile ? drag : undefined}
      className={`field-item draggable-field ${isDragging ? 'dragging' : ''}`}
      title={tooltipText}
      onClick={isMobile ? handleTap : undefined}
      role={isMobile ? 'button' : undefined}
      tabIndex={isMobile ? 0 : undefined}
    >
      <code>{displayLabel}</code>
      {sampleValue !== null && sampleValue !== undefined && (
        <span className="field-value">
          Sample: {String(sampleValue)}
        </span>
      )}
    </div>
  );
};

interface ZoneField {
  fieldType: 'header' | 'item' | 'contentDetail';
  fieldName: string;
  bind: string;
  label: string;
  sampleValue: any;
  contentName?: string;
}

interface DraggableSelectionZoneProps {
  targetSection: 'pageHeader' | 'pageFooter' | 'header' | 'billContent' | 'billFooter';
  label: string;
  hint: string;
  headerData: Record<string, any> | null;
  headerFields: string[];
  itemsData: Record<string, any>[];
  itemsFields: string[];
  contentDetails?: Record<string, { data: Record<string, any>[] | Record<string, any> | null; fields: string[]; sampleCount: number; dataType?: 'array' | 'object' }>;
  DraggableHeaderFieldComponent: React.FC<{ field: string; sampleValue: any; targetSection?: 'pageHeader' | 'pageFooter' | 'header' | 'billContent' | 'billFooter' }>;
  DraggableItemFieldComponent: React.FC<{ field: string; sampleValue: any }>;
  DraggableContentDetailFieldComponent: React.FC<{ contentName: string; field: string; sampleValue: any; bind?: string; label?: string; dataType?: 'array' | 'object' }>;
  searchTerm?: string;
}

const DraggableSelectionZone: React.FC<DraggableSelectionZoneProps> = ({
  targetSection,
  label,
  hint,
  headerData,
  headerFields,
  itemsData,
  itemsFields,
  contentDetails,
  DraggableHeaderFieldComponent,
  DraggableItemFieldComponent,
  DraggableContentDetailFieldComponent,
  searchTerm = '',
}) => {
  const [canDragZone, setCanDragZone] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed by default
  const zoneDragRef = useRef<HTMLDivElement>(null);

  // Collect all fields for this zone
  const zoneFields: ZoneField[] = [];
  
  // Add header fields
  headerFields.forEach((field) => {
    zoneFields.push({
      fieldType: 'header',
      fieldName: field,
      bind: `header.${field}`,
      label: field,
      sampleValue: headerData?.[field],
    });
  });

  // Add item fields (only for billContent section)
  if (targetSection === 'billContent') {
    itemsFields.forEach((field) => {
      zoneFields.push({
        fieldType: 'item',
        fieldName: field,
        bind: field,
        label: field,
        sampleValue: itemsData.length > 0 ? itemsData[0][field] : null,
      });
    });
  }

  // Add content detail fields
  if (contentDetails) {
    Object.entries(contentDetails).forEach(([contentName, contentData]) => {
      const dataType = contentData.dataType || 'array';
      
      if (dataType === 'object') {
        // Object type: treat like header fields - available in ALL sections
        contentData.fields.forEach((field) => {
          const sampleValue = contentData.data && typeof contentData.data === 'object' && !Array.isArray(contentData.data)
            ? (contentData.data as Record<string, any>)[field]
            : null;
          zoneFields.push({
            fieldType: 'contentDetail',
            fieldName: field,
            bind: `contentDetails.${contentName}.${field}`,
            label: `${contentName}.${field}`,
            sampleValue,
            contentName,
          });
        });
      } else {
        // Array type: treat like item fields (for tables) - only in billContent section
        if (targetSection === 'billContent') {
          contentData.fields.forEach((field) => {
            const dataArray = Array.isArray(contentData.data) ? contentData.data : [];
            const sampleValue = dataArray.length > 0 ? dataArray[0][field] : null;
            zoneFields.push({
              fieldType: 'contentDetail',
              fieldName: field,
              bind: field,
              label: field,
              sampleValue,
              contentName,
            });
          });
        }
      }
    });
  }

  const [{ isDragging }, drag] = useDrag({
    type: 'data-field',
    item: () => {
      return {
        fieldType: 'selectionZone',
        targetSection,
        fields: zoneFields,
      };
    },
    canDrag: canDragZone && zoneFields.length > 0,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    end: () => {
      setCanDragZone(false);
    },
  });

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (zoneFields.length > 0 && !canDragZone) {
      setCanDragZone(true);
    }
  };

  const handleToggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCollapsed(!isCollapsed);
  };

  // Attach drag ref to zone container
  React.useEffect(() => {
    if (zoneDragRef.current) {
      drag(zoneDragRef);
    }
  }, [drag]);

  // Filter fields based on search term
  const filteredFields = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return zoneFields;
    }
    const searchLower = searchTerm.toLowerCase().trim();
    return zoneFields.filter((field) => {
      const fieldName = field.fieldName.toLowerCase();
      const label = field.label.toLowerCase();
      const bind = field.bind.toLowerCase();
      return fieldName.includes(searchLower) || label.includes(searchLower) || bind.includes(searchLower);
    });
  }, [zoneFields, searchTerm]);

  const hasFields = filteredFields.length > 0;
  const hasAllFields = zoneFields.length > 0;

  return (
    <div
      ref={zoneDragRef}
      className={`preview-section selection-zone ${isDragging ? 'zone-dragging' : ''} ${canDragZone ? 'zone-draggable' : ''}`}
      onDoubleClick={handleDoubleClick}
      title={hasFields ? "Double-click to drag all fields in this zone" : undefined}
      style={canDragZone ? { cursor: 'grab' } : undefined}
    >
      <div className="zone-header">
        <div className="zone-header-left">
          <button
            className="collapse-toggle"
            onClick={handleToggleCollapse}
            title={isCollapsed ? "Expand zone" : "Collapse zone"}
            aria-label={isCollapsed ? "Expand zone" : "Collapse zone"}
          >
            <span className={`collapse-icon ${isCollapsed ? 'collapsed' : ''}`}>▼</span>
          </button>
          <h5>{label}</h5>
        </div>
        {canDragZone && (
          <span className="zone-drag-indicator">🎯 Ready to drag all fields - start dragging now</span>
        )}
      </div>
      {!isCollapsed && (
        <>
          <p className="section-hint">{hint}</p>
          {searchTerm.trim() && hasAllFields && (
            <p className="filter-info">
              Showing {filteredFields.length} of {zoneFields.length} fields
            </p>
          )}
          {hasFields ? (
            <div className="fields-list">
              {filteredFields.map((zoneField, index) => {
                if (zoneField.fieldType === 'header') {
                  return (
                    <DraggableHeaderFieldComponent
                      key={`${targetSection}-header-${zoneField.fieldName}-${index}`}
                      field={zoneField.fieldName}
                      sampleValue={zoneField.sampleValue}
                      targetSection={targetSection}
                    />
                  );
                } else if (zoneField.fieldType === 'item') {
                  return (
                    <DraggableItemFieldComponent
                      key={`${targetSection}-item-${zoneField.fieldName}-${index}`}
                      field={zoneField.fieldName}
                      sampleValue={zoneField.sampleValue}
                    />
                  );
                } else if (zoneField.fieldType === 'contentDetail' && zoneField.contentName) {
                  // Determine dataType from contentDetails
                  const dataType = contentDetails?.[zoneField.contentName]?.dataType;
                  return (
                    <DraggableContentDetailFieldComponent
                      key={`${targetSection}-contentDetail-${zoneField.contentName}-${zoneField.fieldName}-${index}`}
                      contentName={zoneField.contentName}
                      field={zoneField.fieldName}
                      sampleValue={zoneField.sampleValue}
                      bind={zoneField.bind}
                      label={zoneField.label}
                      dataType={dataType}
                    />
                  );
                }
                return null;
              })}
            </div>
          ) : (
            <p className="no-fields-hint">
              {searchTerm.trim() 
                ? `No fields match "${searchTerm}" in this zone` 
                : 'No fields available for this zone'}
            </p>
          )}
        </>
      )}
    </div>
  );
};

const DataPreview: React.FC<DataPreviewProps> = ({
  headerData,
  headerFields,
  itemsData,
  itemsFields,
  contentDetails,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const hasData = headerFields.length > 0 || itemsFields.length > 0 || (contentDetails && Object.keys(contentDetails).length > 0);

  return (
    <div className="data-preview">
      <p className="drag-hint">💡 Drag fields to appropriate section on canvas. Double-click a zone to drag all its fields at once.</p>
      
      {hasData && (
        <>
          <div className="search-container">
            <input
              type="text"
              className="search-input"
              placeholder="🔍 Search fields by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm.trim() && (
              <button
                className="search-clear"
                onClick={() => setSearchTerm('')}
                title="Clear search"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          <DraggableSelectionZone
            targetSection="pageHeader"
            label="Page Header Fields"
            hint="Drag to page header zone (top of page)"
            headerData={headerData}
            headerFields={headerFields}
            itemsData={itemsData}
            itemsFields={itemsFields}
            contentDetails={contentDetails}
            DraggableHeaderFieldComponent={DraggableHeaderField}
            DraggableItemFieldComponent={DraggableItemField}
            DraggableContentDetailFieldComponent={DraggableContentDetailField}
            searchTerm={searchTerm}
          />
          <DraggableSelectionZone
            targetSection="header"
            label="Bill Header Fields"
            hint="Drag to bill header zone (main area)"
            headerData={headerData}
            headerFields={headerFields}
            itemsData={itemsData}
            itemsFields={itemsFields}
            contentDetails={contentDetails}
            DraggableHeaderFieldComponent={DraggableHeaderField}
            DraggableItemFieldComponent={DraggableItemField}
            DraggableContentDetailFieldComponent={DraggableContentDetailField}
            searchTerm={searchTerm}
          />
          <DraggableSelectionZone
            targetSection="billContent"
            label="Bill Content Fields"
            hint="Drag to bill content zone (main content area between header and footer). Includes header, item, and content detail fields."
            headerData={headerData}
            headerFields={headerFields}
            itemsData={itemsData}
            itemsFields={itemsFields}
            contentDetails={contentDetails}
            DraggableHeaderFieldComponent={DraggableHeaderField}
            DraggableItemFieldComponent={DraggableItemField}
            DraggableContentDetailFieldComponent={DraggableContentDetailField}
            searchTerm={searchTerm}
          />
          <DraggableSelectionZone
            targetSection="billFooter"
            label="Bill Footer Fields"
            hint="Drag to bill footer zone (above page footer)"
            headerData={headerData}
            headerFields={headerFields}
            itemsData={itemsData}
            itemsFields={itemsFields}
            contentDetails={contentDetails}
            DraggableHeaderFieldComponent={DraggableHeaderField}
            DraggableItemFieldComponent={DraggableItemField}
            DraggableContentDetailFieldComponent={DraggableContentDetailField}
            searchTerm={searchTerm}
          />
          <DraggableSelectionZone
            targetSection="pageFooter"
            label="Page Footer Fields"
            hint="Drag to page footer zone (bottom of page)"
            headerData={headerData}
            headerFields={headerFields}
            itemsData={itemsData}
            itemsFields={itemsFields}
            contentDetails={contentDetails}
            DraggableHeaderFieldComponent={DraggableHeaderField}
            DraggableItemFieldComponent={DraggableItemField}
            DraggableContentDetailFieldComponent={DraggableContentDetailField}
            searchTerm={searchTerm}
          />
        </>
      )}

     

      {!hasData && (
        <p className="no-data">No data fields available. Execute query with parameters first.</p>
      )}
    </div>
  );
};

export default DataPreview;

