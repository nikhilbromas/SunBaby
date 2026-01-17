import React, { useState } from 'react';
import type { TemplateJson, TextFieldConfig, ItemsTableConfig, ContentDetailsTableConfig, TableColumnConfig } from '../../services/types';
import './PropertyPanel.css';

interface PropertyPanelProps {
  selectedElement: { type: 'field' | 'table' | 'contentDetailTable' | 'billContentTable'; index: number; section?: 'pageHeader' | 'pageFooter' | 'header' | 'billContent' | 'billFooter' } | null;
  template: TemplateJson;
  onUpdateField: (index: number, updates: Partial<TextFieldConfig>, section?: 'pageHeader' | 'pageFooter' | 'header' | 'billContent' | 'billFooter') => void;
  onUpdateTable: (table: ItemsTableConfig) => void;
  onUpdateContentDetailTable?: (index: number, table: ContentDetailsTableConfig) => void;
  onUpdateBillContentTable?: (index: number, table: ItemsTableConfig) => void;
  onUpdatePage?: (page: { size?: string; orientation?: 'portrait' | 'landscape' }) => void;
  onUpdatePagination?: (pagination: { rowsPerPage?: number; repeatHeader?: boolean }) => void;
  onSave?: () => void;
  isSaving?: boolean;
  onSetup?: () => void;
}

const PropertyPanel: React.FC<PropertyPanelProps> = ({
  selectedElement,
  template,
  onUpdateField,
  onUpdateTable,
  onUpdateContentDetailTable,
  onUpdateBillContentTable,
  onUpdatePage,
  onUpdatePagination,
  onSave,
  isSaving,
  onSetup,
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
            Alt Row:
            <input
              type="color"
              value={table.alternateRowColor || '#f9f9f9'}
              onChange={(e) => onUpdateContentDetailTable(selectedElement.index, { ...table, alternateRowColor: e.target.value })}
            />
          </label>
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
            Alt Row:
            <input
              type="color"
              value={table.alternateRowColor || '#f9f9f9'}
              onChange={(e) => onUpdateBillContentTable(selectedElement.index, { ...table, alternateRowColor: e.target.value })}
            />
          </label>
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
            Alt Row:
            <input
              type="color"
              value={table.alternateRowColor || '#f9f9f9'}
              onChange={(e) => onUpdateTable({ ...table, alternateRowColor: e.target.value })}
            />
          </label>
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

