import React, { useState } from 'react';
import type { TemplateJson, TextFieldConfig, ItemsTableConfig, ContentDetailsTableConfig, TableColumnConfig, FinalRowConfig, ImageFieldConfig } from '../../services/types';
import './PropertyPanel.css';

interface PropertyPanelProps {
  selectedElement: { type: 'field' | 'table' | 'contentDetailTable' | 'billContentTable' | 'image'; index: number; section?: 'pageHeader' | 'pageFooter' | 'header' | 'billContent' | 'billFooter' } | null;
  template: TemplateJson;
  onUpdateField: (index: number, updates: Partial<TextFieldConfig>, section?: 'pageHeader' | 'pageFooter' | 'header' | 'billContent' | 'billFooter') => void;
  onUpdateImage?: (index: number, updates: Partial<ImageFieldConfig>, section?: 'pageHeader' | 'pageFooter' | 'header' | 'billContent' | 'billFooter') => void;
  onUpdateTable: (table: ItemsTableConfig) => void;
  onUpdateContentDetailTable?: (index: number, table: ContentDetailsTableConfig) => void;
  onUpdateBillContentTable?: (index: number, table: ItemsTableConfig) => void;
  onUpdatePage?: (page: { size?: string; orientation?: 'portrait' | 'landscape' }) => void;
  onUpdatePagination?: (pagination: { rowsPerPage?: number; repeatHeader?: boolean }) => void;
  onSave?: () => void;
  isSaving?: boolean;
  onSetup?: () => void;
  onOpenTableModal?: (type: 'itemsTable' | 'billContentTable' | 'contentDetailTable', index?: number) => void;
  onOpenZoneConfig?: () => void;
}

const PropertyPanel: React.FC<PropertyPanelProps> = ({
  selectedElement,
  template,
  onUpdateField,
  onUpdateImage,
  onUpdateTable,
  onUpdateContentDetailTable,
  onUpdateBillContentTable,
  onUpdatePage,
  onUpdatePagination,
  onSave,
  isSaving,
  onSetup,
  onOpenTableModal,
  onOpenZoneConfig,
}) => {
  const getFieldForSelected = (): TextFieldConfig | null => {
    if (!selectedElement || selectedElement.type !== 'field') return null;
    const section = selectedElement.section || 'header';
    if (section === 'pageHeader') return template.pageHeader?.[selectedElement.index] || null;
    if (section === 'pageFooter') return template.pageFooter?.[selectedElement.index] || null;
    if (section === 'billFooter') return template.billFooter?.[selectedElement.index] || null;
    if (section === 'billContent') return template.billContent?.[selectedElement.index] || null;
    return template.header[selectedElement.index] || null;
  };

  const getImageForSelected = (): ImageFieldConfig | null => {
    if (!selectedElement || selectedElement.type !== 'image' || !onUpdateImage) return null;
    const section = selectedElement.section || 'header';
    const sectionKey = section === 'pageHeader' ? 'pageHeaderImages' :
                      section === 'pageFooter' ? 'pageFooterImages' :
                      section === 'header' ? 'headerImages' :
                      section === 'billContent' ? 'billContentImages' :
                      'billFooterImages';
    const images = (template[sectionKey as keyof TemplateJson] as ImageFieldConfig[]) || [];
    return images[selectedElement.index] || null;
  };
  if (!selectedElement) {
    return (
      <div className="property-panel">
        {onUpdatePage && (
          <div className="property-group">
            <h4>Page Layout</h4>
            <label>
              Size:
              <select
                value={template.page.size}
                onChange={(e) => onUpdatePage({ size: e.target.value })}
              >
                <option value="A4">A4</option>
                <option value="Letter">Letter</option>
                <option value="Legal">Legal</option>
              </select>
            </label>
            <label>
              Orientation:
              <select
                value={template.page.orientation}
                onChange={(e) => onUpdatePage({ orientation: e.target.value as 'portrait' | 'landscape' })}
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </label>
          </div>
        )}
        {onOpenZoneConfig && (
          <div className="property-group">
            <h4>Zone Configuration</h4>
            <button
              className="zone-config-button"
              onClick={onOpenZoneConfig}
              style={{
                width: '100%',
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #0B63FF 0%, #1E88E5 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: 600,
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 6px rgba(11, 99, 255, 0.25)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(11, 99, 255, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 6px rgba(11, 99, 255, 0.25)';
              }}
            >
              🎯 Configure Zones
            </button>
            <small style={{ display: 'block', marginTop: '0.5rem', color: '#6c757d', fontSize: '0.8rem' }}>
              Position and size zones (headers, footers, content areas)
            </small>
          </div>
        )}
        <div className="no-selection-container">
          <p className="no-selection">Select an element to edit properties</p>
        </div>
        {(onSave || onSetup) && (
          <div className="property-panel-actions">
            {onSetup && (
              <button 
                className="setup-button"
                onClick={onSetup}
              >
                 Start 
              </button>
            )}
            {onSave && (
              <button 
                className="save-button" 
                onClick={onSave} 
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save '}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (selectedElement.type === 'image' && onUpdateImage) {
    const image = getImageForSelected();
    if (!image) return null;
    const section = selectedElement.section || 'header';

    return (
      <div className="property-panel">
        <div className="property-group">
          <h4>Info</h4>
          <label>
            Section: <strong>{section === 'pageHeader' ? 'Page Header' : section === 'pageFooter' ? 'Page Footer' : section === 'billFooter' ? 'Bill Footer' : section === 'billContent' ? 'Bill Content' : 'Bill Header'}</strong>
          </label>
        </div>
        <div className="property-group">
          <h4>Position</h4>
          <label>
            X:
            <input
              type="number"
              value={image.x}
              onChange={(e) => onUpdateImage(selectedElement.index, { x: parseFloat(e.target.value) || 0 }, section)}
            />
          </label>
          <label>
            Y:
            <input
              type="number"
              value={image.y}
              onChange={(e) => onUpdateImage(selectedElement.index, { y: parseFloat(e.target.value) || 0 }, section)}
            />
          </label>
        </div>
        <div className="property-group">
          <h4>Size</h4>
          <label>
            Width:
            <input
              type="number"
              value={image.width || ''}
              onChange={(e) => onUpdateImage(selectedElement.index, { width: e.target.value ? parseFloat(e.target.value) : undefined }, section)}
              placeholder="Auto"
            />
          </label>
          <label>
            Height:
            <input
              type="number"
              value={image.height || ''}
              onChange={(e) => onUpdateImage(selectedElement.index, { height: e.target.value ? parseFloat(e.target.value) : undefined }, section)}
              placeholder="Auto"
            />
          </label>
        </div>
        <div className="property-group">
          <h4>Options</h4>
          <label>
            <input
              type="checkbox"
              checked={image.visible}
              onChange={(e) => onUpdateImage(selectedElement.index, { visible: e.target.checked }, section)}
            />
            Visible
          </label>
          {section === 'billContent' && (
            <label>
              <input
                type="checkbox"
                checked={image.watermark || false}
                onChange={(e) => onUpdateImage(selectedElement.index, { watermark: e.target.checked }, section)}
              />
              Watermark (render behind content with opacity)
            </label>
          )}
        </div>
        {(onSave || onSetup) && (
          <div className="property-panel-actions">
            {onSetup && (
              <button 
                className="setup-button"
                onClick={onSetup}
              >
                ⚙️ Setup
              </button>
            )}
            {onSave && (
              <button 
                className="save-button" 
                onClick={onSave} 
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Template'}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (selectedElement.type === 'field') {
    const field = getFieldForSelected();
    if (!field) return null;
    const section = selectedElement.section || 'header';
    const isPageSection = section === 'pageHeader' || section === 'pageFooter';

    return (
      <div className="property-panel">
        <div className="property-group">
          <h4>Info</h4>
          <label>
            Section: <strong>{section === 'pageHeader' ? 'Page Header' : section === 'pageFooter' ? 'Page Footer' : section === 'billFooter' ? 'Bill Footer' : section === 'billContent' ? 'Bill Content' : 'Bill Header'}</strong>
          </label>
        </div>
        <div className="property-group">
          <h4>Field</h4>
          <label>
            Type:
            <select
              value={field.fieldType || 'text'}
              onChange={(e) => onUpdateField(selectedElement.index, { fieldType: e.target.value === 'text' ? undefined : e.target.value as any }, section)}
            >
              <option value="text">Text</option>
              {isPageSection && (
                <>
                  <option value="pageNumber">Page #</option>
                  <option value="totalPages">Total Pages</option>
                </>
              )}
              <option value="currentDate">Date</option>
              <option value="currentTime">Time</option>
            </select>
          </label>
          <label>
            Label:
            <input
              type="text"
              value={field.label}
              onChange={(e) => onUpdateField(selectedElement.index, { label: e.target.value }, section)}
            />
          </label>
          {field.fieldType === 'text' && (
            <label>
              Binding:
              <input
                type="text"
                value={field.bind}
                onChange={(e) => onUpdateField(selectedElement.index, { bind: e.target.value }, section)}
                placeholder="header.Field"
              />
            </label>
          )}
        </div>
        <div className="property-group">
          <h4>Position</h4>
          <label>
            X:
            <input
              type="number"
              value={field.x}
              onChange={(e) => onUpdateField(selectedElement.index, { x: parseFloat(e.target.value) || 0 }, section)}
            />
          </label>
          <label>
            Y:
            <input
              type="number"
              value={field.y}
              onChange={(e) => onUpdateField(selectedElement.index, { y: parseFloat(e.target.value) || 0 }, section)}
            />
          </label>
        </div>
        <div className="property-group">
          <h4>Font</h4>
          <label>
            Size:
            <input
              type="number"
              value={field.fontSize || ''}
              onChange={(e) => onUpdateField(selectedElement.index, { fontSize: parseFloat(e.target.value) || undefined }, section)}
              placeholder="Auto"
            />
          </label>
          <label>
            Weight:
            <select
              value={field.fontWeight || ''}
              onChange={(e) => onUpdateField(selectedElement.index, { fontWeight: e.target.value || undefined }, section)}
            >
              <option value="">Normal</option>
              <option value="normal">Normal</option>
              <option value="bold">Bold</option>
            </select>
          </label>
          <label>
            Color:
            <input
              type="color"
              value={field.color || '#000000'}
              onChange={(e) => onUpdateField(selectedElement.index, { color: e.target.value }, section)}
            />
          </label>
        </div>
        <div className="property-group">
          <h4>Options</h4>
          <label>
            <input
              type="checkbox"
              checked={field.visible}
              onChange={(e) => onUpdateField(selectedElement.index, { visible: e.target.checked }, section)}
            />
            Visible
          </label>
        </div>
        {(onSave || onSetup) && (
          <div className="property-panel-actions">
            {onSetup && (
              <button 
                className="setup-button"
                onClick={onSetup}
              >
                ⚙️ Setup
              </button>
            )}
            {onSave && (
              <button 
                className="save-button" 
                onClick={onSave} 
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Template'}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (selectedElement.type === 'contentDetailTable' && template.contentDetailsTables && onUpdateContentDetailTable) {
    const table = template.contentDetailsTables[selectedElement.index];
    if (!table) return null;
    
    const [selectedColumns, setSelectedColumns] = useState<Set<number>>(new Set());

    const updateColumn = (index: number, updates: Partial<TableColumnConfig>) => {
      const newColumns = table.columns.map((col, i) =>
        i === index ? { ...col, ...updates } : col
      );
      onUpdateContentDetailTable(selectedElement.index, { ...table, columns: newColumns });
    };

    const toggleColumnSelection = (index: number) => {
      const newSelected = new Set(selectedColumns);
      if (newSelected.has(index)) {
        newSelected.delete(index);
      } else {
        newSelected.add(index);
      }
      setSelectedColumns(newSelected);
    };

    const deleteSelectedColumns = () => {
      const newColumns = table.columns.filter((_, i) => !selectedColumns.has(i));
      onUpdateContentDetailTable(selectedElement.index, { ...table, columns: newColumns });
      setSelectedColumns(new Set());
    };

    const toggleAllColumns = () => {
      if (selectedColumns.size === table.columns.length) {
        setSelectedColumns(new Set());
      } else {
        setSelectedColumns(new Set(table.columns.map((_, i) => i)));
      }
    };

    return (
      <div className="property-panel">
        <div className="property-group">
          <h4>Content Detail Table: {table.contentName}</h4>
          {onOpenTableModal && (
            <button
              className="open-modal-button"
              onClick={() => onOpenTableModal('contentDetailTable', selectedElement.index)}
              style={{
                marginTop: '0.5rem',
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: 600,
                width: '100%',
                transition: 'all 0.2s ease',
              }}
            >
              🎨 Open Table Editor
            </button>
          )}
        </div>
        <div className="property-group">
          <h4>Layout</h4>
          <label>
            Orientation:
            <select
              value={table.orientation || 'vertical'}
              onChange={(e) => onUpdateContentDetailTable(selectedElement.index, { ...table, orientation: e.target.value as 'vertical' | 'horizontal' })}
            >
              <option value="vertical">Vertical (Normal)</option>
              <option value="horizontal">Horizontal (Transposed)</option>
            </select>
          </label>
        </div>
        <div className="property-group">
          <h4>Position</h4>
          <label>
            X:
            <input
              type="number"
              value={table.x || 0}
              onChange={(e) => onUpdateContentDetailTable(selectedElement.index, { ...table, x: parseFloat(e.target.value) || 0 })}
            />
          </label>
          <label>
            Y:
            <input
              type="number"
              value={table.y || 0}
              onChange={(e) => onUpdateContentDetailTable(selectedElement.index, { ...table, y: parseFloat(e.target.value) || 0 })}
            />
          </label>
        </div>
        <div className="property-group">
          <h4>Borders</h4>
          <label>
            Color:
            <input
              type="color"
              value={table.borderColor || '#dddddd'}
              onChange={(e) => onUpdateContentDetailTable(selectedElement.index, { ...table, borderColor: e.target.value })}
            />
          </label>
          <label>
            Width:
            <input
              type="number"
              value={table.borderWidth || 1}
              min="0"
              step="0.5"
              onChange={(e) => onUpdateContentDetailTable(selectedElement.index, { ...table, borderWidth: parseFloat(e.target.value) || 1 })}
            />
          </label>
        </div>
        <div className="property-group">
          <h4>Header</h4>
          <label>
            Bg Color:
            <input
              type="color"
              value={table.headerBackgroundColor || '#f0f0f0'}
              onChange={(e) => onUpdateContentDetailTable(selectedElement.index, { ...table, headerBackgroundColor: e.target.value })}
            />
          </label>
          <label>
            Text Color:
            <input
              type="color"
              value={table.headerTextColor || '#000000'}
              onChange={(e) => onUpdateContentDetailTable(selectedElement.index, { ...table, headerTextColor: e.target.value })}
            />
          </label>
        </div>
        <div className="property-group">
          <h4>Style</h4>
          <label>
            Padding:
            <input
              type="number"
              value={table.cellPadding || 10}
              min="0"
              step="1"
              onChange={(e) => onUpdateContentDetailTable(selectedElement.index, { ...table, cellPadding: parseFloat(e.target.value) || 10 })}
            />
          </label>
          <label>
            Font Size:
            <input
              type="number"
              value={table.fontSize || ''}
              min="8"
              step="1"
              onChange={(e) => onUpdateContentDetailTable(selectedElement.index, { ...table, fontSize: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="Auto"
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={!!table.alternateRowColor}
              onChange={(e) => onUpdateContentDetailTable(selectedElement.index, { ...table, alternateRowColor: e.target.checked ? '#f9f9f9' : undefined })}
            />
            Alt Row Color
          </label>
          {table.alternateRowColor && (
            <label>
              Alt Row Color:
              <input
                type="color"
                value={table.alternateRowColor}
                onChange={(e) => onUpdateContentDetailTable(selectedElement.index, { ...table, alternateRowColor: e.target.value })}
              />
            </label>
          )}
          <label>
            Width:
            <input
              type="number"
              value={table.tableWidth || ''}
              min="100"
              step="10"
              onChange={(e) => onUpdateContentDetailTable(selectedElement.index, { ...table, tableWidth: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="Auto"
            />
          </label>
        </div>
        <div className="property-group column-group">
          <div className="column-header">
            <h4>Columns ({table.columns.length})</h4>
            <div className="column-actions">
              <button
                type="button"
                className="action-button"
                onClick={toggleAllColumns}
              >
                {selectedColumns.size === table.columns.length ? 'Deselect' : 'Select All'}
              </button>
              {selectedColumns.size > 0 && (
                <button
                  type="button"
                  className="action-button delete-button"
                  onClick={deleteSelectedColumns}
                >
                  Delete ({selectedColumns.size})
                </button>
              )}
            </div>
          </div>
          {table.columns.map((col, index) => (
            <div
              key={index}
              className={`column-item ${selectedColumns.has(index) ? 'selected' : ''}`}
            >
              <label className="column-select">
                <input
                  type="checkbox"
                  checked={selectedColumns.has(index)}
                  onChange={() => toggleColumnSelection(index)}
                />
                <span className="column-number">#{index + 1}</span>
              </label>
              <div className="column-fields">
                <label>
                  Label:
                  <input
                    type="text"
                    value={col.label}
                    onChange={(e) => updateColumn(index, { label: e.target.value })}
                  />
                </label>
                <label>
                  Binding:
                  <input
                    type="text"
                    value={col.bind}
                    onChange={(e) => updateColumn(index, { bind: e.target.value })}
                    placeholder="Field"
                  />
                </label>
                <label>
                  Width:
                  <input
                    type="number"
                    value={col.width || ''}
                    min="0"
                    step="1"
                    onChange={(e) => updateColumn(index, { width: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="Auto"
                  />
                </label>
                <label>
                  Height:
                  <input
                    type="number"
                    value={col.height || ''}
                    min="0"
                    step="1"
                    onChange={(e) => updateColumn(index, { height: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="Auto"
                  />
                </label>
                <label>
                  Align:
                  <select
                    value={col.align || 'left'}
                    onChange={(e) => updateColumn(index, { align: e.target.value as 'left' | 'center' | 'right' })}
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </label>
                <label>
                  Row Span:
                  <input
                    type="number"
                    value={col.rowSpan || ''}
                    min="1"
                    step="1"
                    onChange={(e) => updateColumn(index, { rowSpan: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="1"
                  />
                </label>
                <label>
                  Column Span:
                  <input
                    type="number"
                    value={col.colSpan || ''}
                    min="1"
                    step="1"
                    onChange={(e) => updateColumn(index, { colSpan: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="1"
                  />
                </label>
                <div className="property-group" style={{ marginTop: '0.5rem', padding: '0.75rem', background: '#f8f9fa', borderRadius: '6px' }}>
                  <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 600 }}>Data Manipulation</h5>
                  <label>
                    Calculation Type:
                    <select
                      value={col.calculationType || 'none'}
                      onChange={(e) => updateColumn(index, { calculationType: e.target.value as any })}
                    >
                      <option value="none">None</option>
                      <option value="sum">Sum</option>
                      <option value="avg">Average</option>
                      <option value="count">Count</option>
                      <option value="min">Min</option>
                      <option value="max">Max</option>
                      <option value="custom">Custom Formula</option>
                    </select>
                  </label>
                  {(col.calculationType && col.calculationType !== 'none') && (
                    <>
                      {col.calculationType !== 'custom' && (
                        <>
                          <label>
                            Source Table/Array:
                            <input
                              type="text"
                              value={col.calculationSource || ''}
                              onChange={(e) => updateColumn(index, { calculationSource: e.target.value })}
                              placeholder="e.g., items, contentDetails.items"
                            />
                          </label>
                          <label>
                            Field to Calculate:
                            <input
                              type="text"
                              value={col.calculationField || ''}
                              onChange={(e) => updateColumn(index, { calculationField: e.target.value })}
                              placeholder="e.g., rate, price"
                            />
                          </label>
                        </>
                      )}
                      {col.calculationType === 'custom' && (
                        <label>
                          Custom Formula:
                          <input
                            type="text"
                            value={col.calculationFormula || ''}
                            onChange={(e) => updateColumn(index, { calculationFormula: e.target.value })}
                            placeholder="e.g., sum(items.rate) * header.exchangeRate"
                            style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                          />
                        </label>
                      )}
                    </>
                  )}
                </div>
                <label>
                  <input
                    type="checkbox"
                    checked={col.visible}
                    onChange={(e) => updateColumn(index, { visible: e.target.checked })}
                  />
                  Visible
                </label>
              </div>
            </div>
          ))}
        </div>
        <div className="property-group column-group">
          <div className="column-header">
            <h4>Final Rows</h4>
            <button
              type="button"
              className="action-button"
              onClick={() => {
                const visibleColumns = table.columns.filter(col => col.visible !== false);
                const newRow: FinalRowConfig = {
                  cells: visibleColumns.map(() => ({
                    label: '',
                    valueType: 'static',
                    value: '',
                    align: 'left',
                    colSpan: 1,
                  })),
                  visible: true,
                };
                onUpdateContentDetailTable(selectedElement.index, {
                  ...table,
                  finalRows: [...(table.finalRows || []), newRow],
                });
              }}
              style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
            >
              + Add Row
            </button>
          </div>
          {table.finalRows && table.finalRows.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {table.finalRows.map((finalRow, rowIndex) => (
                <div key={rowIndex} style={{ border: '1px solid #e9ecef', borderRadius: '6px', padding: '0.75rem', background: '#f8f9fa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '0.875rem' }}>Row {rowIndex + 1}</strong>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const newRows = [...table.finalRows!];
                          // Add a new cell at the end
                          newRows[rowIndex].cells.push({
                            label: '',
                            valueType: 'static',
                            value: '',
                            align: 'left',
                            colSpan: 1,
                          });
                          onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                        }}
                        style={{ 
                          padding: '0.25rem 0.5rem', 
                          fontSize: '0.75rem',
                          background: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                        title="Add cell to row"
                      >
                        + Cell
                      </button>
                      {rowIndex > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newRows = [...table.finalRows!];
                            [newRows[rowIndex], newRows[rowIndex - 1]] = [newRows[rowIndex - 1], newRows[rowIndex]];
                            onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                          }}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          ↑
                        </button>
                      )}
                      {rowIndex < table.finalRows!.length - 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newRows = [...table.finalRows!];
                            [newRows[rowIndex], newRows[rowIndex + 1]] = [newRows[rowIndex + 1], newRows[rowIndex]];
                            onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                          }}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          ↓
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const newRows = table.finalRows!.filter((_, i) => i !== rowIndex);
                          onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows.length > 0 ? newRows : undefined });
                        }}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#dc3545' }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {finalRow.cells.map((cell, cellIndex) => {
                      const column = table.columns[cellIndex];
                      if (column && column.visible === false) return null;
                      return (
                        <div key={cellIndex} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.5rem', background: '#ffffff', borderRadius: '4px', position: 'relative' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '0.75rem', color: '#6c757d', fontWeight: 600 }}>
                              Cell {cellIndex + 1} ({column?.label || 'Column ' + (cellIndex + 1)})
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newRows = [...table.finalRows!];
                                newRows[rowIndex].cells = newRows[rowIndex].cells.filter((_, i) => i !== cellIndex);
                                // If no cells left, remove the row
                                if (newRows[rowIndex].cells.length === 0) {
                                  newRows.splice(rowIndex, 1);
                                  onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows.length > 0 ? newRows : undefined });
                                } else {
                                  onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                                }
                              }}
                              style={{ 
                                padding: '0.25rem 0.5rem', 
                                fontSize: '0.75rem', 
                                color: '#dc3545',
                                background: 'transparent',
                                border: '1px solid #dc3545',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                              title="Delete cell"
                            >
                              ×
                            </button>
                          </div>
                          <label style={{ fontSize: '0.875rem' }}>
                            Label:
                            <input
                              type="text"
                              value={cell.label || ''}
                              onChange={(e) => {
                                const newRows = [...table.finalRows!];
                                newRows[rowIndex].cells[cellIndex].label = e.target.value;
                                onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                              }}
                              placeholder="e.g., Sub Total"
                              style={{ width: '100%', marginTop: '0.25rem' }}
                            />
                          </label>
                          <label style={{ fontSize: '0.875rem' }}>
                            Value Type:
                            <select
                              value={cell.valueType || 'static'}
                              onChange={(e) => {
                                const newRows = [...table.finalRows!];
                                newRows[rowIndex].cells[cellIndex].valueType = e.target.value as any;
                                onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                              }}
                              style={{ width: '100%', marginTop: '0.25rem' }}
                            >
                              <option value="static">Static</option>
                              <option value="calculation">Calculation</option>
                              <option value="formula">Formula</option>
                            </select>
                          </label>
                          {cell.valueType === 'static' && (
                            <label style={{ fontSize: '0.875rem' }}>
                              Value:
                              <input
                                type="text"
                                value={cell.value || ''}
                                onChange={(e) => {
                                  const newRows = [...table.finalRows!];
                                  newRows[rowIndex].cells[cellIndex].value = e.target.value;
                                  onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                                }}
                                placeholder="e.g., 400"
                                style={{ width: '100%', marginTop: '0.25rem' }}
                              />
                            </label>
                          )}
                          {cell.valueType === 'calculation' && (
                            <>
                              <label style={{ fontSize: '0.875rem' }}>
                                Calculation:
                                <select
                                  value={cell.calculationType || 'sum'}
                                  onChange={(e) => {
                                    const newRows = [...table.finalRows!];
                                    newRows[rowIndex].cells[cellIndex].calculationType = e.target.value as any;
                                    onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                                  }}
                                  style={{ width: '100%', marginTop: '0.25rem' }}
                                >
                                  <option value="sum">Sum</option>
                                  <option value="avg">Average</option>
                                  <option value="count">Count</option>
                                  <option value="min">Min</option>
                                  <option value="max">Max</option>
                                </select>
                              </label>
                              <label style={{ fontSize: '0.875rem' }}>
                                Source Table/Array:
                                <input
                                  type="text"
                                  value={cell.calculationSource || ''}
                                  onChange={(e) => {
                                    const newRows = [...table.finalRows!];
                                    newRows[rowIndex].cells[cellIndex].calculationSource = e.target.value;
                                    onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                                  }}
                                  placeholder="e.g., items"
                                  style={{ width: '100%', marginTop: '0.25rem' }}
                                />
                              </label>
                              <label style={{ fontSize: '0.875rem' }}>
                                Field:
                                <input
                                  type="text"
                                  value={cell.calculationField || ''}
                                  onChange={(e) => {
                                    const newRows = [...table.finalRows!];
                                    newRows[rowIndex].cells[cellIndex].calculationField = e.target.value;
                                    onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                                  }}
                                  placeholder="e.g., rate, price"
                                  style={{ width: '100%', marginTop: '0.25rem' }}
                                />
                              </label>
                            </>
                          )}
                          {cell.valueType === 'formula' && (
                            <label style={{ fontSize: '0.875rem' }}>
                              Formula:
                              <input
                                type="text"
                                value={cell.formula || ''}
                                onChange={(e) => {
                                  const newRows = [...table.finalRows!];
                                  newRows[rowIndex].cells[cellIndex].formula = e.target.value;
                                  onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                                }}
                                placeholder="e.g., sum(items.rate) * header.exchangeRate"
                                style={{ width: '100%', marginTop: '0.25rem', fontFamily: 'monospace', fontSize: '0.875rem' }}
                              />
                            </label>
                          )}
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                            <label style={{ fontSize: '0.875rem', flex: 1 }}>
                              Align:
                              <select
                                value={cell.align || 'left'}
                                onChange={(e) => {
                                  const newRows = [...table.finalRows!];
                                  newRows[rowIndex].cells[cellIndex].align = e.target.value as any;
                                  onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                                }}
                                style={{ width: '100%', marginTop: '0.25rem' }}
                              >
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                                <option value="right">Right</option>
                              </select>
                            </label>
                            <label style={{ fontSize: '0.875rem', flex: 1 }}>
                              Col Span:
                              <input
                                type="number"
                                value={cell.colSpan || 1}
                                min="1"
                                onChange={(e) => {
                                  const newRows = [...table.finalRows!];
                                  newRows[rowIndex].cells[cellIndex].colSpan = parseInt(e.target.value) || 1;
                                  onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                                }}
                                style={{ width: '100%', marginTop: '0.25rem' }}
                              />
                            </label>
                          </div>
                          <label style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                            <input
                              type="checkbox"
                              checked={cell.fontWeight === 'bold'}
                              onChange={(e) => {
                                const newRows = [...table.finalRows!];
                                newRows[rowIndex].cells[cellIndex].fontWeight = e.target.checked ? 'bold' : 'normal';
                                onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                              }}
                            />
                            Bold
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.875rem', color: '#6c757d', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>
              No final rows. Click "Add Row" to create one.
            </p>
          )}
        </div>
        <div className="property-group">
          <h4>Pagination</h4>
          <label>
            Rows/Page:
            <input
              type="number"
              value={table.rowsPerPage || ''}
              min="1"
              onChange={(e) => onUpdateContentDetailTable(selectedElement.index, { 
                ...table,
                rowsPerPage: e.target.value ? parseInt(e.target.value) : undefined
              })}
              placeholder="Auto"
            />
          </label>
        </div>
        {(onSave || onSetup) && (
          <div className="property-panel-actions">
            {onSetup && (
              <button 
                className="setup-button"
                onClick={onSetup}
              >
                ⚙️ Setup
              </button>
            )}
            {onSave && (
              <button 
                className="save-button" 
                onClick={onSave} 
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Template'}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (selectedElement.type === 'billContentTable' && template.billContentTables && template.billContentTables[selectedElement.index] && onUpdateBillContentTable) {
    const table = template.billContentTables[selectedElement.index];
    const [selectedColumns, setSelectedColumns] = useState<Set<number>>(new Set());

    const updateColumn = (index: number, updates: Partial<TableColumnConfig>) => {
      const newColumns = table.columns.map((col, i) =>
        i === index ? { ...col, ...updates } : col
      );
      onUpdateBillContentTable(selectedElement.index, { ...table, columns: newColumns });
    };

    const toggleColumnSelection = (index: number) => {
      const newSelected = new Set(selectedColumns);
      if (newSelected.has(index)) {
        newSelected.delete(index);
      } else {
        newSelected.add(index);
      }
      setSelectedColumns(newSelected);
    };

    const deleteSelectedColumns = () => {
      const newColumns = table.columns.filter((_, i) => !selectedColumns.has(i));
      onUpdateBillContentTable(selectedElement.index, { ...table, columns: newColumns });
      setSelectedColumns(new Set());
    };

    const toggleAllColumns = () => {
      if (selectedColumns.size === table.columns.length) {
        setSelectedColumns(new Set());
      } else {
        setSelectedColumns(new Set(table.columns.map((_, i) => i)));
      }
    };

    return (
      <div className="property-panel">
        <div className="property-group">
          <h4>Bill Content Table</h4>
          {onOpenTableModal && (
            <button
              className="open-modal-button"
              onClick={() => onOpenTableModal('billContentTable', selectedElement.index)}
              style={{
                marginTop: '0.5rem',
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: 600,
                width: '100%',
                transition: 'all 0.2s ease',
              }}
            >
              🎨 Open Table Editor
            </button>
          )}
        </div>
        <div className="property-group">
          <h4>Layout</h4>
          <label>
            Orientation:
            <select
              value={table.orientation || 'vertical'}
              onChange={(e) => onUpdateBillContentTable(selectedElement.index, { ...table, orientation: e.target.value as 'vertical' | 'horizontal' })}
            >
              <option value="vertical">Vertical (Normal)</option>
              <option value="horizontal">Horizontal (Transposed)</option>
            </select>
          </label>
        </div>
        <div className="property-group">
          <h4>Position</h4>
          <label>
            X:
            <input
              type="number"
              value={table.x || 0}
              onChange={(e) => onUpdateBillContentTable(selectedElement.index, { ...table, x: parseFloat(e.target.value) || 0 })}
            />
          </label>
          <label>
            Y:
            <input
              type="number"
              value={table.y || 0}
              onChange={(e) => onUpdateBillContentTable(selectedElement.index, { ...table, y: parseFloat(e.target.value) || 0 })}
            />
          </label>
        </div>
        <div className="property-group">
          <h4>Borders</h4>
          <label>
            Color:
            <input
              type="color"
              value={table.borderColor || '#dddddd'}
              onChange={(e) => onUpdateBillContentTable(selectedElement.index, { ...table, borderColor: e.target.value })}
            />
          </label>
          <label>
            Width:
            <input
              type="number"
              value={table.borderWidth || 1}
              min="0"
              step="0.5"
              onChange={(e) => onUpdateBillContentTable(selectedElement.index, { ...table, borderWidth: parseFloat(e.target.value) || 1 })}
            />
          </label>
        </div>
        <div className="property-group">
          <h4>Header</h4>
          <label>
            Bg Color:
            <input
              type="color"
              value={table.headerBackgroundColor || '#f0f0f0'}
              onChange={(e) => onUpdateBillContentTable(selectedElement.index, { ...table, headerBackgroundColor: e.target.value })}
            />
          </label>
          <label>
            Text Color:
            <input
              type="color"
              value={table.headerTextColor || '#000000'}
              onChange={(e) => onUpdateBillContentTable(selectedElement.index, { ...table, headerTextColor: e.target.value })}
            />
          </label>
        </div>
        <div className="property-group">
          <h4>Style</h4>
          <label>
            Padding:
            <input
              type="number"
              value={table.cellPadding || 10}
              min="0"
              step="1"
              onChange={(e) => onUpdateBillContentTable(selectedElement.index, { ...table, cellPadding: parseFloat(e.target.value) || 10 })}
            />
          </label>
          <label>
            Font Size:
            <input
              type="number"
              value={table.fontSize || ''}
              min="8"
              step="1"
              onChange={(e) => onUpdateBillContentTable(selectedElement.index, { ...table, fontSize: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="Auto"
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={!!table.alternateRowColor}
              onChange={(e) => onUpdateBillContentTable(selectedElement.index, { ...table, alternateRowColor: e.target.checked ? '#f9f9f9' : undefined })}
            />
            Alt Row Color
          </label>
          {table.alternateRowColor && (
            <label>
              Alt Row Color:
              <input
                type="color"
                value={table.alternateRowColor}
                onChange={(e) => onUpdateBillContentTable(selectedElement.index, { ...table, alternateRowColor: e.target.value })}
              />
            </label>
          )}
          <label>
            Width:
            <input
              type="number"
              value={table.tableWidth || ''}
              min="100"
              step="10"
              onChange={(e) => onUpdateBillContentTable(selectedElement.index, { ...table, tableWidth: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="Auto"
            />
          </label>
        </div>
        <div className="property-group column-group">
          <div className="column-header">
            <h4>Columns ({table.columns.length})</h4>
            <div className="column-actions">
              <button
                type="button"
                className="action-button"
                onClick={toggleAllColumns}
              >
                {selectedColumns.size === table.columns.length ? 'Deselect' : 'Select All'}
              </button>
              {selectedColumns.size > 0 && (
                <button
                  type="button"
                  className="action-button delete-button"
                  onClick={deleteSelectedColumns}
                >
                  Delete ({selectedColumns.size})
                </button>
              )}
            </div>
          </div>
          {table.columns.map((col, index) => (
            <div
              key={index}
              className={`column-item ${selectedColumns.has(index) ? 'selected' : ''}`}
            >
              <label className="column-select">
                <input
                  type="checkbox"
                  checked={selectedColumns.has(index)}
                  onChange={() => toggleColumnSelection(index)}
                />
                <span className="column-number">#{index + 1}</span>
              </label>
              <div className="column-fields">
                <label>
                  Label:
                  <input
                    type="text"
                    value={col.label}
                    onChange={(e) => updateColumn(index, { label: e.target.value })}
                  />
                </label>
                <label>
                  Binding:
                  <input
                    type="text"
                    value={col.bind}
                    onChange={(e) => updateColumn(index, { bind: e.target.value })}
                    placeholder="Field"
                  />
                </label>
                <label>
                  Width:
                  <input
                    type="number"
                    value={col.width || ''}
                    min="0"
                    step="1"
                    onChange={(e) => updateColumn(index, { width: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="Auto"
                  />
                </label>
                <label>
                  Height:
                  <input
                    type="number"
                    value={col.height || ''}
                    min="0"
                    step="1"
                    onChange={(e) => updateColumn(index, { height: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="Auto"
                  />
                </label>
                <label>
                  Align:
                  <select
                    value={col.align || 'left'}
                    onChange={(e) => updateColumn(index, { align: e.target.value as 'left' | 'center' | 'right' })}
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </label>
                <label>
                  Row Span:
                  <input
                    type="number"
                    value={col.rowSpan || ''}
                    min="1"
                    step="1"
                    onChange={(e) => updateColumn(index, { rowSpan: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="1"
                  />
                </label>
                <label>
                  Column Span:
                  <input
                    type="number"
                    value={col.colSpan || ''}
                    min="1"
                    step="1"
                    onChange={(e) => updateColumn(index, { colSpan: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="1"
                  />
                </label>
                <div className="property-group" style={{ marginTop: '0.5rem', padding: '0.75rem', background: '#f8f9fa', borderRadius: '6px' }}>
                  <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 600 }}>Data Manipulation</h5>
                  <label>
                    Calculation Type:
                    <select
                      value={col.calculationType || 'none'}
                      onChange={(e) => updateColumn(index, { calculationType: e.target.value as any })}
                    >
                      <option value="none">None</option>
                      <option value="sum">Sum</option>
                      <option value="avg">Average</option>
                      <option value="count">Count</option>
                      <option value="min">Min</option>
                      <option value="max">Max</option>
                      <option value="custom">Custom Formula</option>
                    </select>
                  </label>
                  {(col.calculationType && col.calculationType !== 'none') && (
                    <>
                      {col.calculationType !== 'custom' && (
                        <>
                          <label>
                            Source Table/Array:
                            <input
                              type="text"
                              value={col.calculationSource || ''}
                              onChange={(e) => updateColumn(index, { calculationSource: e.target.value })}
                              placeholder="e.g., items, contentDetails.items"
                            />
                          </label>
                          <label>
                            Field to Calculate:
                            <input
                              type="text"
                              value={col.calculationField || ''}
                              onChange={(e) => updateColumn(index, { calculationField: e.target.value })}
                              placeholder="e.g., rate, price"
                            />
                          </label>
                        </>
                      )}
                      {col.calculationType === 'custom' && (
                        <label>
                          Custom Formula:
                          <input
                            type="text"
                            value={col.calculationFormula || ''}
                            onChange={(e) => updateColumn(index, { calculationFormula: e.target.value })}
                            placeholder="e.g., sum(items.rate) * header.exchangeRate"
                            style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                          />
                        </label>
                      )}
                    </>
                  )}
                </div>
                <label>
                  <input
                    type="checkbox"
                    checked={col.visible}
                    onChange={(e) => updateColumn(index, { visible: e.target.checked })}
                  />
                  Visible
                </label>
              </div>
            </div>
          ))}
        </div>
        <div className="property-group column-group">
          <div className="column-header">
            <h4>Final Rows</h4>
            <button
              type="button"
              className="action-button"
              onClick={() => {
                const visibleColumns = table.columns.filter(col => col.visible !== false);
                const newRow: FinalRowConfig = {
                  cells: visibleColumns.map(() => ({
                    label: '',
                    valueType: 'static',
                    value: '',
                    align: 'left',
                    colSpan: 1,
                  })),
                  visible: true,
                };
                onUpdateBillContentTable(selectedElement.index, {
                  ...table,
                  finalRows: [...(table.finalRows || []), newRow],
                });
              }}
              style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
            >
              + Add Row
            </button>
          </div>
          {table.finalRows && table.finalRows.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {table.finalRows.map((finalRow, rowIndex) => (
                <div key={rowIndex} style={{ border: '1px solid #e9ecef', borderRadius: '6px', padding: '0.75rem', background: '#f8f9fa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '0.875rem' }}>Row {rowIndex + 1}</strong>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const newRows = [...table.finalRows!];
                          // Add a new cell at the end
                          newRows[rowIndex].cells.push({
                            label: '',
                            valueType: 'static',
                            value: '',
                            align: 'left',
                            colSpan: 1,
                          });
                          onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                        }}
                        style={{ 
                          padding: '0.25rem 0.5rem', 
                          fontSize: '0.75rem',
                          background: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                        title="Add cell to row"
                      >
                        + Cell
                      </button>
                      {rowIndex > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newRows = [...table.finalRows!];
                            [newRows[rowIndex], newRows[rowIndex - 1]] = [newRows[rowIndex - 1], newRows[rowIndex]];
                            onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                          }}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          ↑
                        </button>
                      )}
                      {rowIndex < table.finalRows!.length - 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newRows = [...table.finalRows!];
                            [newRows[rowIndex], newRows[rowIndex + 1]] = [newRows[rowIndex + 1], newRows[rowIndex]];
                            onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                          }}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          ↓
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const newRows = table.finalRows!.filter((_, i) => i !== rowIndex);
                          onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows.length > 0 ? newRows : undefined });
                        }}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#dc3545' }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {finalRow.cells.map((cell, cellIndex) => {
                      const column = table.columns[cellIndex];
                      if (column && column.visible === false) return null;
                      return (
                        <div key={cellIndex} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.5rem', background: '#ffffff', borderRadius: '4px', position: 'relative' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '0.75rem', color: '#6c757d', fontWeight: 600 }}>
                              Cell {cellIndex + 1} ({column?.label || 'Column ' + (cellIndex + 1)})
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newRows = [...table.finalRows!];
                                newRows[rowIndex].cells = newRows[rowIndex].cells.filter((_, i) => i !== cellIndex);
                                // If no cells left, remove the row
                                if (newRows[rowIndex].cells.length === 0) {
                                  newRows.splice(rowIndex, 1);
                                  onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows.length > 0 ? newRows : undefined });
                                } else {
                                  onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                                }
                              }}
                              style={{ 
                                padding: '0.25rem 0.5rem', 
                                fontSize: '0.75rem', 
                                color: '#dc3545',
                                background: 'transparent',
                                border: '1px solid #dc3545',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                              title="Delete cell"
                            >
                              ×
                            </button>
                          </div>
                          <label style={{ fontSize: '0.875rem' }}>
                            Label:
                            <input
                              type="text"
                              value={cell.label || ''}
                              onChange={(e) => {
                                const newRows = [...table.finalRows!];
                                newRows[rowIndex].cells[cellIndex].label = e.target.value;
                                onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                              }}
                              placeholder="e.g., Sub Total"
                              style={{ width: '100%', marginTop: '0.25rem' }}
                            />
                          </label>
                          <label style={{ fontSize: '0.875rem' }}>
                            Value Type:
                            <select
                              value={cell.valueType || 'static'}
                              onChange={(e) => {
                                const newRows = [...table.finalRows!];
                                newRows[rowIndex].cells[cellIndex].valueType = e.target.value as any;
                                onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                              }}
                              style={{ width: '100%', marginTop: '0.25rem' }}
                            >
                              <option value="static">Static</option>
                              <option value="calculation">Calculation</option>
                              <option value="formula">Formula</option>
                            </select>
                          </label>
                          {cell.valueType === 'static' && (
                            <label style={{ fontSize: '0.875rem' }}>
                              Value:
                              <input
                                type="text"
                                value={cell.value || ''}
                                onChange={(e) => {
                                  const newRows = [...table.finalRows!];
                                  newRows[rowIndex].cells[cellIndex].value = e.target.value;
                                  onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                                }}
                                placeholder="e.g., 400"
                                style={{ width: '100%', marginTop: '0.25rem' }}
                              />
                            </label>
                          )}
                          {cell.valueType === 'calculation' && (
                            <>
                              <label style={{ fontSize: '0.875rem' }}>
                                Calculation:
                                <select
                                  value={cell.calculationType || 'sum'}
                                  onChange={(e) => {
                                    const newRows = [...table.finalRows!];
                                    newRows[rowIndex].cells[cellIndex].calculationType = e.target.value as any;
                                    onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                                  }}
                                  style={{ width: '100%', marginTop: '0.25rem' }}
                                >
                                  <option value="sum">Sum</option>
                                  <option value="avg">Average</option>
                                  <option value="count">Count</option>
                                  <option value="min">Min</option>
                                  <option value="max">Max</option>
                                </select>
                              </label>
                              <label style={{ fontSize: '0.875rem' }}>
                                Source Table/Array:
                                <input
                                  type="text"
                                  value={cell.calculationSource || ''}
                                  onChange={(e) => {
                                    const newRows = [...table.finalRows!];
                                    newRows[rowIndex].cells[cellIndex].calculationSource = e.target.value;
                                    onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                                  }}
                                  placeholder="e.g., items"
                                  style={{ width: '100%', marginTop: '0.25rem' }}
                                />
                              </label>
                              <label style={{ fontSize: '0.875rem' }}>
                                Field:
                                <input
                                  type="text"
                                  value={cell.calculationField || ''}
                                  onChange={(e) => {
                                    const newRows = [...table.finalRows!];
                                    newRows[rowIndex].cells[cellIndex].calculationField = e.target.value;
                                    onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                                  }}
                                  placeholder="e.g., rate, price"
                                  style={{ width: '100%', marginTop: '0.25rem' }}
                                />
                              </label>
                            </>
                          )}
                          {cell.valueType === 'formula' && (
                            <label style={{ fontSize: '0.875rem' }}>
                              Formula:
                              <input
                                type="text"
                                value={cell.formula || ''}
                                onChange={(e) => {
                                  const newRows = [...table.finalRows!];
                                  newRows[rowIndex].cells[cellIndex].formula = e.target.value;
                                  onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                                }}
                                placeholder="e.g., sum(items.rate) * header.exchangeRate"
                                style={{ width: '100%', marginTop: '0.25rem', fontFamily: 'monospace', fontSize: '0.875rem' }}
                              />
                            </label>
                          )}
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                            <label style={{ fontSize: '0.875rem', flex: 1 }}>
                              Align:
                              <select
                                value={cell.align || 'left'}
                                onChange={(e) => {
                                  const newRows = [...table.finalRows!];
                                  newRows[rowIndex].cells[cellIndex].align = e.target.value as any;
                                  onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                                }}
                                style={{ width: '100%', marginTop: '0.25rem' }}
                              >
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                                <option value="right">Right</option>
                              </select>
                            </label>
                            <label style={{ fontSize: '0.875rem', flex: 1 }}>
                              Col Span:
                              <input
                                type="number"
                                value={cell.colSpan || 1}
                                min="1"
                                onChange={(e) => {
                                  const newRows = [...table.finalRows!];
                                  newRows[rowIndex].cells[cellIndex].colSpan = parseInt(e.target.value) || 1;
                                  onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                                }}
                                style={{ width: '100%', marginTop: '0.25rem' }}
                              />
                            </label>
                          </div>
                          <label style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                            <input
                              type="checkbox"
                              checked={cell.fontWeight === 'bold'}
                              onChange={(e) => {
                                const newRows = [...table.finalRows!];
                                newRows[rowIndex].cells[cellIndex].fontWeight = e.target.checked ? 'bold' : 'normal';
                                onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                              }}
                            />
                            Bold
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.875rem', color: '#6c757d', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>
              No final rows. Click "Add Row" to create one.
            </p>
          )}
        </div>
        {(onSave || onSetup) && (
          <div className="property-panel-actions">
            {onSetup && (
              <button 
                className="setup-button"
                onClick={onSetup}
              >
                ⚙️ Setup
              </button>
            )}
            {onSave && (
              <button 
                className="save-button" 
                onClick={onSave} 
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Template'}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (selectedElement.type === 'table' && template.itemsTable) {
    const table = template.itemsTable;
    const [selectedColumns, setSelectedColumns] = useState<Set<number>>(new Set());

    const updateColumn = (index: number, updates: Partial<TableColumnConfig>) => {
      const newColumns = table.columns.map((col, i) =>
        i === index ? { ...col, ...updates } : col
      );
      onUpdateTable({ ...table, columns: newColumns });
    };

    const toggleColumnSelection = (index: number) => {
      const newSelected = new Set(selectedColumns);
      if (newSelected.has(index)) {
        newSelected.delete(index);
      } else {
        newSelected.add(index);
      }
      setSelectedColumns(newSelected);
    };

    const deleteSelectedColumns = () => {
      const newColumns = table.columns.filter((_, i) => !selectedColumns.has(i));
      onUpdateTable({ ...table, columns: newColumns });
      setSelectedColumns(new Set());
    };

    const toggleAllColumns = () => {
      if (selectedColumns.size === table.columns.length) {
        setSelectedColumns(new Set());
      } else {
        setSelectedColumns(new Set(table.columns.map((_, i) => i)));
      }
    };

    return (
      <div className="property-panel">
        <div className="property-group">
          <h4>Items Table</h4>
          {onOpenTableModal && (
            <button
              className="open-modal-button"
              onClick={() => onOpenTableModal('itemsTable')}
              style={{
                marginTop: '0.5rem',
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: 600,
                width: '100%',
                transition: 'all 0.2s ease',
              }}
            >
              🎨 Open Table Editor
            </button>
          )}
        </div>
        <div className="property-group">
          <h4>Layout</h4>
          <label>
            Orientation:
            <select
              value={table.orientation || 'vertical'}
              onChange={(e) => onUpdateTable({ ...table, orientation: e.target.value as 'vertical' | 'horizontal' })}
            >
              <option value="vertical">Vertical (Normal)</option>
              <option value="horizontal">Horizontal (Transposed)</option>
            </select>
          </label>
        </div>
        <div className="property-group">
          <h4>Position</h4>
          <label>
            X:
            <input
              type="number"
              value={table.x || 0}
              onChange={(e) => onUpdateTable({ ...table, x: parseFloat(e.target.value) || 0 })}
            />
          </label>
          <label>
            Y:
            <input
              type="number"
              value={table.y || 0}
              onChange={(e) => onUpdateTable({ ...table, y: parseFloat(e.target.value) || 0 })}
            />
          </label>
        </div>
        <div className="property-group">
          <h4>Borders</h4>
          <label>
            Color:
            <input
              type="color"
              value={table.borderColor || '#dddddd'}
              onChange={(e) => onUpdateTable({ ...table, borderColor: e.target.value })}
            />
          </label>
          <label>
            Width:
            <input
              type="number"
              value={table.borderWidth || 1}
              min="0"
              step="0.5"
              onChange={(e) => onUpdateTable({ ...table, borderWidth: parseFloat(e.target.value) || 1 })}
            />
          </label>
        </div>
        <div className="property-group">
          <h4>Header</h4>
          <label>
            Bg Color:
            <input
              type="color"
              value={table.headerBackgroundColor || '#f0f0f0'}
              onChange={(e) => onUpdateTable({ ...table, headerBackgroundColor: e.target.value })}
            />
          </label>
          <label>
            Text Color:
            <input
              type="color"
              value={table.headerTextColor || '#000000'}
              onChange={(e) => onUpdateTable({ ...table, headerTextColor: e.target.value })}
            />
          </label>
        </div>
        <div className="property-group">
          <h4>Style</h4>
          <label>
            Padding:
            <input
              type="number"
              value={table.cellPadding || 10}
              min="0"
              step="1"
              onChange={(e) => onUpdateTable({ ...table, cellPadding: parseFloat(e.target.value) || 10 })}
            />
          </label>
          <label>
            Font Size:
            <input
              type="number"
              value={table.fontSize || ''}
              min="8"
              step="1"
              onChange={(e) => onUpdateTable({ ...table, fontSize: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="Auto"
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={!!table.alternateRowColor}
              onChange={(e) => onUpdateTable({ ...table, alternateRowColor: e.target.checked ? '#f9f9f9' : undefined })}
            />
            Alt Row Color
          </label>
          {table.alternateRowColor && (
            <label>
              Alt Row Color:
              <input
                type="color"
                value={table.alternateRowColor}
                onChange={(e) => onUpdateTable({ ...table, alternateRowColor: e.target.value })}
              />
            </label>
          )}
          <label>
            Width:
            <input
              type="number"
              value={table.tableWidth || ''}
              min="100"
              step="10"
              onChange={(e) => onUpdateTable({ ...table, tableWidth: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="Auto"
            />
          </label>
        </div>
        <div className="property-group column-group">
          <div className="column-header">
            <h4>Columns ({table.columns.length})</h4>
            <div className="column-actions">
              <button
                type="button"
                className="action-button"
                onClick={toggleAllColumns}
              >
                {selectedColumns.size === table.columns.length ? 'Deselect' : 'Select All'}
              </button>
              {selectedColumns.size > 0 && (
                <button
                  type="button"
                  className="action-button delete-button"
                  onClick={deleteSelectedColumns}
                >
                  Delete ({selectedColumns.size})
                </button>
              )}
            </div>
          </div>
          {table.columns.map((col, index) => (
            <div
              key={index}
              className={`column-item ${selectedColumns.has(index) ? 'selected' : ''}`}
            >
              <label className="column-select">
                <input
                  type="checkbox"
                  checked={selectedColumns.has(index)}
                  onChange={() => toggleColumnSelection(index)}
                />
                <span className="column-number">#{index + 1}</span>
              </label>
              <div className="column-fields">
                <label>
                  Label:
                  <input
                    type="text"
                    value={col.label}
                    onChange={(e) => updateColumn(index, { label: e.target.value })}
                  />
                </label>
                <label>
                  Binding:
                  <input
                    type="text"
                    value={col.bind}
                    onChange={(e) => updateColumn(index, { bind: e.target.value })}
                    placeholder="Field"
                  />
                </label>
                <label>
                  Width:
                  <input
                    type="number"
                    value={col.width || ''}
                    min="0"
                    step="1"
                    onChange={(e) => updateColumn(index, { width: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="Auto"
                  />
                </label>
                <label>
                  Height:
                  <input
                    type="number"
                    value={col.height || ''}
                    min="0"
                    step="1"
                    onChange={(e) => updateColumn(index, { height: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="Auto"
                  />
                </label>
                <label>
                  Align:
                  <select
                    value={col.align || 'left'}
                    onChange={(e) => updateColumn(index, { align: e.target.value as 'left' | 'center' | 'right' })}
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </label>
                <label>
                  Row Span:
                  <input
                    type="number"
                    value={col.rowSpan || ''}
                    min="1"
                    step="1"
                    onChange={(e) => updateColumn(index, { rowSpan: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="1"
                  />
                </label>
                <label>
                  Column Span:
                  <input
                    type="number"
                    value={col.colSpan || ''}
                    min="1"
                    step="1"
                    onChange={(e) => updateColumn(index, { colSpan: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="1"
                  />
                </label>
                <div className="property-group" style={{ marginTop: '0.5rem', padding: '0.75rem', background: '#f8f9fa', borderRadius: '6px' }}>
                  <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 600 }}>Data Manipulation</h5>
                  <label>
                    Calculation Type:
                    <select
                      value={col.calculationType || 'none'}
                      onChange={(e) => updateColumn(index, { calculationType: e.target.value as any })}
                    >
                      <option value="none">None</option>
                      <option value="sum">Sum</option>
                      <option value="avg">Average</option>
                      <option value="count">Count</option>
                      <option value="min">Min</option>
                      <option value="max">Max</option>
                      <option value="custom">Custom Formula</option>
                    </select>
                  </label>
                  {(col.calculationType && col.calculationType !== 'none') && (
                    <>
                      {col.calculationType !== 'custom' && (
                        <>
                          <label>
                            Source Table/Array:
                            <input
                              type="text"
                              value={col.calculationSource || ''}
                              onChange={(e) => updateColumn(index, { calculationSource: e.target.value })}
                              placeholder="e.g., items, contentDetails.items"
                            />
                          </label>
                          <label>
                            Field to Calculate:
                            <input
                              type="text"
                              value={col.calculationField || ''}
                              onChange={(e) => updateColumn(index, { calculationField: e.target.value })}
                              placeholder="e.g., rate, price"
                            />
                          </label>
                        </>
                      )}
                      {col.calculationType === 'custom' && (
                        <label>
                          Custom Formula:
                          <input
                            type="text"
                            value={col.calculationFormula || ''}
                            onChange={(e) => updateColumn(index, { calculationFormula: e.target.value })}
                            placeholder="e.g., sum(items.rate) * header.exchangeRate"
                            style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                          />
                        </label>
                      )}
                    </>
                  )}
                </div>
                <label>
                  <input
                    type="checkbox"
                    checked={col.visible}
                    onChange={(e) => updateColumn(index, { visible: e.target.checked })}
                  />
                  Visible
                </label>
              </div>
            </div>
          ))}
        </div>
        <div className="property-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h4>Final Rows</h4>
            <button
              type="button"
              className="action-button"
              onClick={() => {
                const visibleColumns = table.columns.filter(col => col.visible !== false);
                const newRow: FinalRowConfig = {
                  cells: visibleColumns.map(() => ({
                    label: '',
                    valueType: 'static',
                    value: '',
                    align: 'left',
                    colSpan: 1,
                  })),
                  visible: true,
                };
                onUpdateTable({
                  ...table,
                  finalRows: [...(table.finalRows || []), newRow],
                });
              }}
              style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
            >
              + Add Row
            </button>
          </div>
          {table.finalRows && table.finalRows.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {table.finalRows.map((finalRow, rowIndex) => (
                <div key={rowIndex} style={{ border: '1px solid #e9ecef', borderRadius: '6px', padding: '0.75rem', background: '#f8f9fa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '0.875rem' }}>Row {rowIndex + 1}</strong>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const newRows = [...table.finalRows!];
                          // Add a new cell at the end
                          newRows[rowIndex].cells.push({
                            label: '',
                            valueType: 'static',
                            value: '',
                            align: 'left',
                            colSpan: 1,
                          });
                          onUpdateTable({ ...table, finalRows: newRows });
                        }}
                        style={{ 
                          padding: '0.25rem 0.5rem', 
                          fontSize: '0.75rem',
                          background: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                        title="Add cell to row"
                      >
                        + Cell
                      </button>
                      {rowIndex > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newRows = [...table.finalRows!];
                            [newRows[rowIndex], newRows[rowIndex - 1]] = [newRows[rowIndex - 1], newRows[rowIndex]];
                            onUpdateTable({ ...table, finalRows: newRows });
                          }}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          ↑
                        </button>
                      )}
                      {rowIndex < table.finalRows!.length - 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newRows = [...table.finalRows!];
                            [newRows[rowIndex], newRows[rowIndex + 1]] = [newRows[rowIndex + 1], newRows[rowIndex]];
                            onUpdateTable({ ...table, finalRows: newRows });
                          }}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          ↓
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const newRows = table.finalRows!.filter((_, i) => i !== rowIndex);
                          onUpdateTable({ ...table, finalRows: newRows.length > 0 ? newRows : undefined });
                        }}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#dc3545' }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {finalRow.cells.map((cell, cellIndex) => {
                      const column = table.columns[cellIndex];
                      if (column && column.visible === false) return null;
                      return (
                        <div key={cellIndex} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.5rem', background: '#ffffff', borderRadius: '4px', position: 'relative' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '0.75rem', color: '#6c757d', fontWeight: 600 }}>
                              Cell {cellIndex + 1} ({column?.label || 'Column ' + (cellIndex + 1)})
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newRows = [...table.finalRows!];
                                newRows[rowIndex].cells = newRows[rowIndex].cells.filter((_, i) => i !== cellIndex);
                                // If no cells left, remove the row
                                if (newRows[rowIndex].cells.length === 0) {
                                  newRows.splice(rowIndex, 1);
                                  onUpdateTable({ ...table, finalRows: newRows.length > 0 ? newRows : undefined });
                                } else {
                                  onUpdateTable({ ...table, finalRows: newRows });
                                }
                              }}
                              style={{ 
                                padding: '0.25rem 0.5rem', 
                                fontSize: '0.75rem', 
                                color: '#dc3545',
                                background: 'transparent',
                                border: '1px solid #dc3545',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                              title="Delete cell"
                            >
                              ×
                            </button>
                          </div>
                          <label style={{ fontSize: '0.875rem' }}>
                            Label:
                            <input
                              type="text"
                              value={cell.label || ''}
                              onChange={(e) => {
                                const newRows = [...table.finalRows!];
                                newRows[rowIndex].cells[cellIndex].label = e.target.value;
                                onUpdateTable({ ...table, finalRows: newRows });
                              }}
                              placeholder="e.g., Sub Total"
                              style={{ width: '100%', marginTop: '0.25rem' }}
                            />
                          </label>
                          <label style={{ fontSize: '0.875rem' }}>
                            Value Type:
                            <select
                              value={cell.valueType || 'static'}
                              onChange={(e) => {
                                const newRows = [...table.finalRows!];
                                newRows[rowIndex].cells[cellIndex].valueType = e.target.value as any;
                                onUpdateTable({ ...table, finalRows: newRows });
                              }}
                              style={{ width: '100%', marginTop: '0.25rem' }}
                            >
                              <option value="static">Static</option>
                              <option value="calculation">Calculation</option>
                              <option value="formula">Formula</option>
                            </select>
                          </label>
                          {cell.valueType === 'static' && (
                            <label style={{ fontSize: '0.875rem' }}>
                              Value:
                              <input
                                type="text"
                                value={cell.value || ''}
                                onChange={(e) => {
                                  const newRows = [...table.finalRows!];
                                  newRows[rowIndex].cells[cellIndex].value = e.target.value;
                                  onUpdateTable({ ...table, finalRows: newRows });
                                }}
                                placeholder="e.g., 400"
                                style={{ width: '100%', marginTop: '0.25rem' }}
                              />
                            </label>
                          )}
                          {cell.valueType === 'calculation' && (
                            <>
                              <label style={{ fontSize: '0.875rem' }}>
                                Calculation:
                                <select
                                  value={cell.calculationType || 'sum'}
                                  onChange={(e) => {
                                    const newRows = [...table.finalRows!];
                                    newRows[rowIndex].cells[cellIndex].calculationType = e.target.value as any;
                                    onUpdateTable({ ...table, finalRows: newRows });
                                  }}
                                  style={{ width: '100%', marginTop: '0.25rem' }}
                                >
                                  <option value="sum">Sum</option>
                                  <option value="avg">Average</option>
                                  <option value="count">Count</option>
                                  <option value="min">Min</option>
                                  <option value="max">Max</option>
                                </select>
                              </label>
                              <label style={{ fontSize: '0.875rem' }}>
                                Source Table/Array:
                                <input
                                  type="text"
                                  value={cell.calculationSource || ''}
                                  onChange={(e) => {
                                    const newRows = [...table.finalRows!];
                                    newRows[rowIndex].cells[cellIndex].calculationSource = e.target.value;
                                    onUpdateTable({ ...table, finalRows: newRows });
                                  }}
                                  placeholder="e.g., items"
                                  style={{ width: '100%', marginTop: '0.25rem' }}
                                />
                              </label>
                              <label style={{ fontSize: '0.875rem' }}>
                                Field:
                                <input
                                  type="text"
                                  value={cell.calculationField || ''}
                                  onChange={(e) => {
                                    const newRows = [...table.finalRows!];
                                    newRows[rowIndex].cells[cellIndex].calculationField = e.target.value;
                                    onUpdateTable({ ...table, finalRows: newRows });
                                  }}
                                  placeholder="e.g., rate, price"
                                  style={{ width: '100%', marginTop: '0.25rem' }}
                                />
                              </label>
                            </>
                          )}
                          {cell.valueType === 'formula' && (
                            <label style={{ fontSize: '0.875rem' }}>
                              Formula:
                              <input
                                type="text"
                                value={cell.formula || ''}
                                onChange={(e) => {
                                  const newRows = [...table.finalRows!];
                                  newRows[rowIndex].cells[cellIndex].formula = e.target.value;
                                  onUpdateTable({ ...table, finalRows: newRows });
                                }}
                                placeholder="e.g., sum(items.rate) * header.exchangeRate"
                                style={{ width: '100%', marginTop: '0.25rem', fontFamily: 'monospace', fontSize: '0.875rem' }}
                              />
                            </label>
                          )}
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                            <label style={{ fontSize: '0.875rem', flex: 1 }}>
                              Align:
                              <select
                                value={cell.align || 'left'}
                                onChange={(e) => {
                                  const newRows = [...table.finalRows!];
                                  newRows[rowIndex].cells[cellIndex].align = e.target.value as any;
                                  onUpdateTable({ ...table, finalRows: newRows });
                                }}
                                style={{ width: '100%', marginTop: '0.25rem' }}
                              >
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                                <option value="right">Right</option>
                              </select>
                            </label>
                            <label style={{ fontSize: '0.875rem', flex: 1 }}>
                              Col Span:
                              <input
                                type="number"
                                value={cell.colSpan || 1}
                                min="1"
                                onChange={(e) => {
                                  const newRows = [...table.finalRows!];
                                  newRows[rowIndex].cells[cellIndex].colSpan = parseInt(e.target.value) || 1;
                                  onUpdateTable({ ...table, finalRows: newRows });
                                }}
                                style={{ width: '100%', marginTop: '0.25rem' }}
                              />
                            </label>
                          </div>
                          <label style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                            <input
                              type="checkbox"
                              checked={cell.fontWeight === 'bold'}
                              onChange={(e) => {
                                const newRows = [...table.finalRows!];
                                newRows[rowIndex].cells[cellIndex].fontWeight = e.target.checked ? 'bold' : 'normal';
                                onUpdateTable({ ...table, finalRows: newRows });
                              }}
                            />
                            Bold
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.875rem', color: '#6c757d', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>
              No final rows. Click "Add Row" to create one.
            </p>
          )}
        </div>
        {onUpdatePagination && (
          <div className="property-group">
            <h4>Pagination</h4>
            <label>
              Rows Per Page (auto if empty):
              <input
                type="number"
                value={template.pagination?.rowsPerPage || ''}
                min="1"
                onChange={(e) => onUpdatePagination({ 
                  rowsPerPage: e.target.value ? parseInt(e.target.value) : undefined,
                  repeatHeader: template.pagination?.repeatHeader !== false
                })}
                placeholder="Auto"
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={template.pagination?.repeatHeader !== false}
                onChange={(e) => onUpdatePagination({ 
                  rowsPerPage: template.pagination?.rowsPerPage,
                  repeatHeader: e.target.checked
                })}
              />
              Repeat Table Header on Each Page
            </label>
          </div>
        )}
        {(onSave || onSetup) && (
          <div className="property-panel-actions">
            {onSetup && (
              <button 
                className="setup-button"
                onClick={onSetup}
              >
                ⚙️ Setup
              </button>
            )}
            {onSave && (
              <button 
                className="save-button" 
                onClick={onSave} 
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Template'}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default PropertyPanel;

