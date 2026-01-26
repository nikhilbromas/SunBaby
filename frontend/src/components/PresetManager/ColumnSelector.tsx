import React, { useCallback, useState, useMemo } from 'react';
import type { ColumnInfo, SimpleColumn } from '../../services/types';
import './ColumnSelector.css';

interface ColumnSelectorProps {
  selectedTables: string[];
  selectedColumns: SimpleColumn[];
  tableColumns: Record<string, ColumnInfo[]>; // Passed from parent (centralized)
  onChange: (columns: SimpleColumn[]) => void;
  onAddCalculated?: () => void;
  onAddWindow?: () => void;
}

const ColumnSelector: React.FC<ColumnSelectorProps> = ({
  selectedTables,
  selectedColumns,
  tableColumns,
  onChange,
  onAddCalculated,
  onAddWindow
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedTables, setCollapsedTables] = useState<Set<string>>(new Set());

  // Helper to find the actual table key in tableColumns (case-insensitive)
  const findTableKey = useCallback((tableName: string): string | undefined => {
    // First try exact match
    if (tableColumns[tableName]) return tableName;
    // Then try case-insensitive
    const lowerName = tableName.toLowerCase();
    return Object.keys(tableColumns).find(k => k.toLowerCase() === lowerName);
  }, [tableColumns]);

  // Get columns for a table (case-insensitive lookup)
  const getTableColumns = useCallback((tableName: string): ColumnInfo[] => {
    const key = findTableKey(tableName);
    return key ? tableColumns[key] : [];
  }, [tableColumns, findTableKey]);

  const isColumnSelected = useCallback((table: string, column: string) => {
    return selectedColumns.some(c => 
      c.table.toLowerCase() === table.toLowerCase() && 
      c.column.toLowerCase() === column.toLowerCase()
    );
  }, [selectedColumns]);

  const toggleColumn = useCallback((table: string, column: ColumnInfo) => {
    const isSelected = selectedColumns.some(c => 
      c.table.toLowerCase() === table.toLowerCase() && 
      c.column.toLowerCase() === column.name.toLowerCase()
    );
    if (isSelected) {
      onChange(selectedColumns.filter(c => !(
        c.table.toLowerCase() === table.toLowerCase() && 
        c.column.toLowerCase() === column.name.toLowerCase()
      )));
    } else {
      onChange([...selectedColumns, { type: 'simple', table, column: column.name }]);
    }
  }, [selectedColumns, onChange]);

  const updateAlias = useCallback((table: string, column: string, alias: string) => {
    onChange(selectedColumns.map(c => 
      c.table.toLowerCase() === table.toLowerCase() && 
      c.column.toLowerCase() === column.toLowerCase()
        ? { ...c, alias: alias || undefined }
        : c
    ));
  }, [selectedColumns, onChange]);

  const selectAll = useCallback((tableName: string) => {
    const cols = getTableColumns(tableName);
    const newCols = cols
      .filter(col => !selectedColumns.some(c => 
        c.table.toLowerCase() === tableName.toLowerCase() && 
        c.column.toLowerCase() === col.name.toLowerCase()
      ))
      .map(col => ({ type: 'simple' as const, table: tableName, column: col.name }));
    onChange([...selectedColumns, ...newCols]);
  }, [getTableColumns, selectedColumns, onChange]);

  const deselectAll = useCallback((tableName: string) => {
    onChange(selectedColumns.filter(c => c.table.toLowerCase() !== tableName.toLowerCase()));
  }, [selectedColumns, onChange]);

  // Check if columns are loading (no columns data for a table yet)
  const hasLoadingTables = selectedTables.some(t => !findTableKey(t));

  // Filter columns based on search term
  const filterColumns = useCallback((columns: ColumnInfo[], tableName: string): ColumnInfo[] => {
    if (!searchTerm.trim()) return columns;
    
    const searchLower = searchTerm.toLowerCase();
    return columns.filter(col => {
      const colName = col.name.toLowerCase();
      const dataType = (col.dataType || '').toLowerCase();
      
      // Check if column name matches
      if (colName.includes(searchLower)) return true;
      
      // Check if data type matches
      if (dataType.includes(searchLower)) return true;
      
      // Check if alias matches
      const alias = selectedColumns.find(c => 
        c.table.toLowerCase() === tableName.toLowerCase() && 
        c.column.toLowerCase() === col.name.toLowerCase()
      )?.alias;
      if (alias && alias.toLowerCase().includes(searchLower)) return true;
      
      return false;
    });
  }, [searchTerm, selectedColumns]);

  // Get tables that have matching columns (for auto-expand)
  const tablesWithMatches = useMemo(() => {
    if (!searchTerm.trim()) return new Set<string>();
    const matches = new Set<string>();
    selectedTables.forEach(tableName => {
      const cols = getTableColumns(tableName);
      const filtered = filterColumns(cols, tableName);
      if (filtered.length > 0) {
        matches.add(tableName);
      }
    });
    return matches;
  }, [selectedTables, searchTerm, getTableColumns, filterColumns]);

  // Auto-expand tables with matches when searching
  React.useEffect(() => {
    if (searchTerm.trim() && tablesWithMatches.size > 0) {
      setCollapsedTables(prev => {
        const newSet = new Set(prev);
        tablesWithMatches.forEach(table => newSet.delete(table));
        return newSet;
      });
    }
  }, [searchTerm, tablesWithMatches]);

  const toggleCollapse = useCallback((tableName: string) => {
    setCollapsedTables(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tableName)) {
        newSet.delete(tableName);
      } else {
        newSet.add(tableName);
      }
      return newSet;
    });
  }, []);

  const expandAll = useCallback(() => {
    setCollapsedTables(new Set());
  }, []);

  const collapseAll = useCallback(() => {
    setCollapsedTables(new Set(selectedTables));
  }, [selectedTables]);

  const isCollapsed = useCallback((tableName: string) => {
    return collapsedTables.has(tableName);
  }, [collapsedTables]);

  // Count matching columns
  const getMatchCount = useCallback((tableName: string) => {
    const cols = getTableColumns(tableName);
    const filtered = filterColumns(cols, tableName);
    return { total: cols.length, matching: filtered.length };
  }, [getTableColumns, filterColumns]);

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

      {/* Search Input */}
      {selectedTables.length > 0 && (
        <div className="column-search-wrapper">
          <input
            type="text"
            className="column-search"
            placeholder="Search fields, aliases, or data types..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearchTerm('')}
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* Expand/Collapse All */}
      {selectedTables.length > 1 && (
        <div className="collapse-controls">
          <button
            type="button"
            className="collapse-all-btn"
            onClick={expandAll}
            title="Expand all tables"
          >
            ▼ Expand All
          </button>
          <button
            type="button"
            className="collapse-all-btn"
            onClick={collapseAll}
            title="Collapse all tables"
          >
            ▲ Collapse All
          </button>
        </div>
      )}

      {hasLoadingTables && <div className="column-selector-loading">Loading fields...</div>}

      {selectedTables.length === 0 && (
        <div className="column-selector-empty">
          <div className="empty-icon">📋</div>
          <h4>No data sources selected</h4>
          <p>Go back to Step 1 and select a data source first</p>
        </div>
      )}

      {selectedTables.length > 0 && (
        <div className="column-tables">
          {selectedTables.map(tableName => {
            const cols = getTableColumns(tableName);
            const tableKey = findTableKey(tableName);
            const filteredCols = filterColumns(cols, tableName);
            const collapsed = isCollapsed(tableName);
            const matchCount = getMatchCount(tableName);
            const selectedCount = cols.filter(col => isColumnSelected(tableName, col.name)).length;
            
            return (
              <div key={tableName} className="column-table-section">
                <div className="table-header">
                  <button
                    type="button"
                    className="collapse-toggle"
                    onClick={() => toggleCollapse(tableName)}
                    title={collapsed ? 'Expand' : 'Collapse'}
                  >
                    <span className={`collapse-icon ${collapsed ? 'collapsed' : ''}`}>▼</span>
                  </button>
                  <span className="table-name-header">{tableName}</span>
                  {collapsed && (
                    <span className="table-count-badge">
                      {selectedCount > 0 && `${selectedCount}/`}{matchCount.matching > 0 ? matchCount.matching : matchCount.total} fields
                    </span>
                  )}
                  {!collapsed && (
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
                  )}
                </div>
                {!collapsed && (
                  <>
                    {filteredCols.length > 0 ? (
                      <div className="columns-list">
                        {filteredCols.map(col => {
                          const selected = isColumnSelected(tableName, col.name);
                          // Highlight search term in column name
                          const highlightName = (name: string) => {
                            if (!searchTerm.trim()) return name;
                            const parts = name.split(new RegExp(`(${searchTerm})`, 'gi'));
                            return parts.map((part, i) => 
                              part.toLowerCase() === searchTerm.toLowerCase() ? (
                                <mark key={i} className="search-highlight">{part}</mark>
                              ) : part
                            );
                          };
                          
                          return (
                            <div key={col.name} className={`column-item ${selected ? 'selected' : ''}`}>
                              <label className="column-checkbox">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleColumn(tableName, col)}
                                />
                                <span className="column-name">
                                  {highlightName(col.name)}
                                </span>
                                <span className="column-type">{col.dataType}</span>
                                {col.isPrimaryKey && <span className="pk-badge">Key</span>}
                                {col.isForeignKey && <span className="fk-badge">Link</span>}
                              </label>
                              {selected && (
                                <div className="alias-row">
                                  <label className="alias-label">Display Name:</label>
                                  <input
                                    type="text"
                                    className="alias-input"
                                    placeholder="Same as field name"
                                    value={selectedColumns.find(c => 
                                      c.table.toLowerCase() === tableName.toLowerCase() && 
                                      c.column.toLowerCase() === col.name.toLowerCase()
                                    )?.alias || ''}
                                    onChange={(e) => updateAlias(tableName, col.name, e.target.value)}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : searchTerm ? (
                      <div className="no-columns">No fields match "{searchTerm}"</div>
                    ) : tableKey ? (
                      <div className="no-columns">No fields available</div>
                    ) : (
                      <div className="no-columns">Loading...</div>
                    )}
                    {searchTerm && filteredCols.length < cols.length && (
                      <div className="search-summary">
                        Showing {filteredCols.length} of {cols.length} fields
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Search Results Summary */}
      {searchTerm && selectedTables.length > 0 && (
        <div className="search-results-summary">
          {(() => {
            const totalMatches = selectedTables.reduce((sum, table) => {
              return sum + getMatchCount(table).matching;
            }, 0);
            return totalMatches > 0 ? (
              <span>Found {totalMatches} matching field{totalMatches !== 1 ? 's' : ''}</span>
            ) : (
              <span>No fields found matching "{searchTerm}"</span>
            );
          })()}
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
