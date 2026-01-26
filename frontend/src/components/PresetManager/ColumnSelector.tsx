import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api';
import type { ColumnInfo, SimpleColumn } from '../../services/types';
import './ColumnSelector.css';

interface ColumnSelectorProps {
  selectedTables: string[];
  selectedColumns: SimpleColumn[];
  onChange: (columns: SimpleColumn[]) => void;
  onAddCalculated?: () => void;
  onAddWindow?: () => void;
}

const ColumnSelector: React.FC<ColumnSelectorProps> = ({
  selectedTables,
  selectedColumns,
  onChange,
  onAddCalculated,
  onAddWindow
}) => {
  const [tableColumns, setTableColumns] = useState<Record<string, ColumnInfo[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadColumnsForTables();
  }, [selectedTables]);

  const loadColumnsForTables = async () => {
    if (selectedTables.length === 0) {
      setTableColumns({});
      return;
    }

    setLoading(true);
    const newTableColumns: Record<string, ColumnInfo[]> = {};

    for (const tableName of selectedTables) {
      try {
        const response = await apiClient.getTableColumns(tableName);
        newTableColumns[tableName] = response.columns;
      } catch (error) {
        console.error(`Failed to load fields for ${tableName}`, error);
      }
    }

    setTableColumns(newTableColumns);
    setLoading(false);
  };

  const isColumnSelected = (table: string, column: string) => {
    return selectedColumns.some(c => c.table === table && c.column === column);
  };

  const toggleColumn = (table: string, column: ColumnInfo) => {
    if (isColumnSelected(table, column.name)) {
      onChange(selectedColumns.filter(c => !(c.table === table && c.column === column.name)));
    } else {
      onChange([...selectedColumns, { type: 'simple', table, column: column.name }]);
    }
  };

  const updateAlias = (table: string, column: string, alias: string) => {
    onChange(selectedColumns.map(c => 
      c.table === table && c.column === column
        ? { ...c, alias: alias || undefined }
        : c
    ));
  };

  const selectAll = (tableName: string) => {
    const cols = tableColumns[tableName] || [];
    const newCols = cols
      .filter(col => !isColumnSelected(tableName, col.name))
      .map(col => ({ type: 'simple' as const, table: tableName, column: col.name }));
    onChange([...selectedColumns, ...newCols]);
  };

  const deselectAll = (tableName: string) => {
    onChange(selectedColumns.filter(c => c.table !== tableName));
  };

  return (
    <div className="column-selector">
      <div className="column-selector-header">
        <h3>Choose Fields</h3>
        <div className="column-actions">
          {onAddCalculated && (
            <button onClick={onAddCalculated} className="add-calculated-btn" title="Add a formula field">
              ➕ Add Formula
            </button>
          )}
          {onAddWindow && (
            <button onClick={onAddWindow} className="add-window-btn" title="Add ranking or numbering">
              🔢 Add Ranking
            </button>
          )}
        </div>
      </div>

      {loading && <div className="column-selector-loading">Loading fields...</div>}

      {!loading && selectedTables.length === 0 && (
        <div className="column-selector-empty">
          <div className="empty-icon">📋</div>
          <h4>No data sources selected</h4>
          <p>Go back to Step 1 and select a data source first</p>
        </div>
      )}

      {!loading && selectedTables.length > 0 && (
        <div className="column-tables">
          {selectedTables.map(tableName => (
            <div key={tableName} className="column-table-section">
              <div className="table-header">
                <span>{tableName}</span>
                <div className="table-actions">
                  <button 
                    className="select-all-btn"
                    onClick={() => selectAll(tableName)}
                    title="Select all fields"
                  >
                    Select All
                  </button>
                  <button 
                    className="deselect-all-btn"
                    onClick={() => deselectAll(tableName)}
                    title="Deselect all fields"
                  >
                    Clear
                  </button>
                </div>
              </div>
              {tableColumns[tableName]?.length > 0 ? (
                <div className="columns-list">
                  {tableColumns[tableName].map(col => (
                    <div key={col.name} className={`column-item ${isColumnSelected(tableName, col.name) ? 'selected' : ''}`}>
                      <label className="column-checkbox">
                        <input
                          type="checkbox"
                          checked={isColumnSelected(tableName, col.name)}
                          onChange={() => toggleColumn(tableName, col)}
                        />
                        <span className="column-name">
                          {col.name}
                        </span>
                        <span className="column-type">{col.dataType}</span>
                        {col.isPrimaryKey && <span className="pk-badge">Key</span>}
                        {col.isForeignKey && <span className="fk-badge">Link</span>}
                      </label>
                      {isColumnSelected(tableName, col.name) && (
                        <div className="alias-row">
                          <label className="alias-label">Display Name:</label>
                          <input
                            type="text"
                            className="alias-input"
                            placeholder="Same as field name"
                            value={selectedColumns.find(c => c.table === tableName && c.column === col.name)?.alias || ''}
                            onChange={(e) => updateAlias(tableName, col.name, e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-columns">No fields available</div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedColumns.length > 0 && (
        <div className="selected-summary">
          <span className="selected-count">{selectedColumns.length} fields selected</span>
        </div>
      )}
    </div>
  );
};

export default ColumnSelector;
