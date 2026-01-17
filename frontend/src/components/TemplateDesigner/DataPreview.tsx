import React, { useState, useRef } from 'react';
import { useDrag } from 'react-dnd';
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

  return (
    <div
      ref={drag}
      className={`field-item draggable-field ${isDragging ? 'dragging' : ''}`}
      title="Drag to canvas to add field"
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

  return (
    <div
      ref={drag}
      className={`field-item draggable-field ${isDragging ? 'dragging' : ''}`}
      title="Drag to canvas to add field"
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
}> = ({ contentName, field, sampleValue }) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'data-field',
    item: {
      fieldType: 'contentDetail',
      contentName,
      fieldName: field,
      bind: field,
      label: field,
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  return (
    <div
      ref={drag}
      className={`field-item draggable-field ${isDragging ? 'dragging' : ''}`}
      title="Drag to content detail table to add column"
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
  DraggableContentDetailFieldComponent: React.FC<{ contentName: string; field: string; sampleValue: any }>;
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

  const hasFields = zoneFields.length > 0;

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
          {hasFields ? (
            <div className="fields-list">
              {zoneFields.map((zoneField, index) => {
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
                  return (
                    <DraggableContentDetailFieldComponent
                      key={`${targetSection}-contentDetail-${zoneField.contentName}-${zoneField.fieldName}-${index}`}
                      contentName={zoneField.contentName}
                      field={zoneField.fieldName}
                      sampleValue={zoneField.sampleValue}
                    />
                  );
                }
                return null;
              })}
            </div>
          ) : (
            <p className="no-fields-hint">No fields available for this zone</p>
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
  const hasData = headerFields.length > 0 || itemsFields.length > 0 || (contentDetails && Object.keys(contentDetails).length > 0);

  return (
    <div className="data-preview">
      <p className="drag-hint">💡 Drag fields to appropriate section on canvas. Double-click a zone to drag all its fields at once.</p>
      
      {hasData && (
        <>
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

