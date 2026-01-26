import React, { useCallback, useState, useMemo } from 'react';
import type { ColumnInfo, SimpleColumn, CalculatedColumn, WindowFunction } from '../../services/types';
import './ColumnSelector.css';

interface ColumnSelectorProps {
  selectedTables: string[];
  selectedColumns: SimpleColumn[];
  calculatedColumns: CalculatedColumn[];
  windowColumns: WindowFunction[];
  tableColumns: Record<string, ColumnInfo[]>; // Passed from parent (centralized)
  onChange: (columns: SimpleColumn[]) => void;
  onCalculatedChange: (columns: CalculatedColumn[]) => void;
  onWindowChange: (columns: WindowFunction[]) => void;
  onAddCalculated?: () => void;
  onAddWindow?: () => void;
  onEditCalculated?: (column: CalculatedColumn, index: number) => void;
  onEditWindow?: (column: WindowFunction, index: number) => void;
}

const ColumnSelector: React.FC<ColumnSelectorProps> = ({
  selectedTables,
  selectedColumns,
  calculatedColumns,
  windowColumns,
  tableColumns,
  onChange,
  onCalculatedChange,
  onWindowChange,
  onAddCalculated,
  onAddWindow,
  onEditCalculated,
  onEditWindow
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

  // Filter columns based on search term - enhanced to match partial names
  const filterColumns = useCallback((columns: ColumnInfo[], tableName: string): ColumnInfo[] => {
    if (!searchTerm.trim()) return columns;
    
    const searchLower = searchTerm.toLowerCase().trim();
    // Split search term into words for more flexible matching
    const searchWords = searchLower.split(/\s+/).filter(w => w.length > 0);
    
    return columns.filter(col => {
      const colName = col.name.toLowerCase();
      const dataType = (col.dataType || '').toLowerCase();
      
      // Check if column name contains the search term (partial match)
      // This will match "billid" in "posdbillid", "poshbillid", etc.
      if (colName.includes(searchLower)) return true;
      
      // Also check if all search words are present in column name
      if (searchWords.length > 1 && searchWords.every(word => colName.includes(word))) {
        return true;
      }
      
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
  
  // Filter formula fields based on search term
  const filterFormulaFields = useCallback((fields: CalculatedColumn[] | WindowFunction[]): (CalculatedColumn | WindowFunction)[] => {
    if (!searchTerm.trim()) return fields;
    
    const searchLower = searchTerm.toLowerCase().trim();
    
    return fields.filter(field => {
      // Check alias/name
      if (field.alias.toLowerCase().includes(searchLower)) return true;
      
      // For calculated columns, check expression text
      if (field.type === 'calculated') {
        const getExpressionText = (expr: any): string => {
          if (typeof expr === 'string') return expr;
          if (expr?.type === 'literal') return expr.value || '';
          if (expr?.type === 'column') return `${expr.table ? `${expr.table}.` : ''}${expr.column}`;
          if (expr?.type === 'function') {
            const args = expr.args?.map(getExpressionText).join(', ') || '';
            return `${expr.name}(${args})`;
          }
          if (expr?.type === 'operator') {
            const left = getExpressionText(expr.left);
            const right = getExpressionText(expr.right);
            return `(${left} ${expr.operator} ${right})`;
          }
          return JSON.stringify(expr);
        };
        const expressionText = getExpressionText(field.expression);
        if (expressionText.toLowerCase().includes(searchLower)) return true;
      }
      
      // For window functions, check function name and columns
      if (field.type === 'window') {
        if (field.function.toLowerCase().includes(searchLower)) return true;
        if (field.partitionBy?.some(col => col.toLowerCase().includes(searchLower))) return true;
        if (field.orderBy?.some(o => o.column.toLowerCase().includes(searchLower))) return true;
      }
      
      return false;
    });
  }, [searchTerm]);

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

      {/* Formula Fields Section */}
      {(() => {
        const filteredCalculated = searchTerm.trim() 
          ? filterFormulaFields(calculatedColumns) as CalculatedColumn[]
          : calculatedColumns;
        const filteredWindow = searchTerm.trim()
          ? filterFormulaFields(windowColumns) as WindowFunction[]
          : windowColumns;
        
        if (filteredCalculated.length === 0 && filteredWindow.length === 0) {
          return null;
        }
        
        return (
          <div className="formula-fields-section">
            <div className="formula-fields-header">
              <h4>Formula Fields</h4>
              <span className="formula-count">
                {filteredCalculated.length + filteredWindow.length} formula{filteredCalculated.length + filteredWindow.length !== 1 ? 's' : ''}
                {searchTerm.trim() && (calculatedColumns.length + windowColumns.length !== filteredCalculated.length + filteredWindow.length) && (
                  <span className="filtered-count">
                    {' '}(filtered from {calculatedColumns.length + windowColumns.length})
                  </span>
                )}
              </span>
            </div>

            {/* Calculated Columns */}
            {filteredCalculated.length > 0 && (
              <div className="formula-list">
                {filteredCalculated.map((col, index) => {
                  // Find original index for proper editing
                  const originalIndex = calculatedColumns.findIndex(c => c === col);
                // Extract expression text from expression node
                const getExpressionText = (expr: any): string => {
                  if (typeof expr === 'string') return expr;
                  if (expr?.type === 'literal') return expr.value || '';
                  if (expr?.type === 'column') return `${expr.table ? `${expr.table}.` : ''}${expr.column}`;
                  if (expr?.type === 'function') {
                    const args = expr.args?.map(getExpressionText).join(', ') || '';
                    return `${expr.name}(${args})`;
                  }
                  if (expr?.type === 'operator') {
                    const left = getExpressionText(expr.left);
                    const right = getExpressionText(expr.right);
                    return `(${left} ${expr.operator} ${right})`;
                  }
                  return JSON.stringify(expr);
                };
                
                const expressionText = getExpressionText(col.expression);
                
                return (
                  <div key={`calc-${index}`} className="formula-item">
                    <div className="formula-item-header">
                      <span className="formula-icon">📐</span>
                      <span className="formula-name">{col.alias || 'Unnamed Formula'}</span>
                      <span className="formula-type-badge">Formula</span>
                    </div>
                    <div className="formula-expression">{expressionText}</div>
                    <div className="formula-actions">
                      {onEditCalculated && (
                        <button
                          className="edit-formula-btn"
                          onClick={() => onEditCalculated(col, originalIndex >= 0 ? originalIndex : index)}
                          title="Edit formula"
                        >
                          ✏️ Edit
                        </button>
                      )}
                      <button
                        className="delete-formula-btn"
                        onClick={() => {
                          const updated = calculatedColumns.filter((_, i) => i !== (originalIndex >= 0 ? originalIndex : index));
                          onCalculatedChange(updated);
                        }}
                        title="Delete formula"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

            {/* Window Function Columns */}
            {filteredWindow.length > 0 && (
              <div className="formula-list">
                {filteredWindow.map((col, index) => {
                  // Find original index for proper editing
                  const originalIndex = windowColumns.findIndex(c => c === col);
                  const partitionText = col.partitionBy?.join(', ') || '';
                  const orderByText = col.orderBy?.map(o => `${o.column} ${o.direction}`).join(', ') || '';
                  const functionText = `${col.function}(${partitionText ? `PARTITION BY ${partitionText}` : ''}${orderByText ? ` ORDER BY ${orderByText}` : ''})`;
                  
                  return (
                    <div key={`window-${index}`} className="formula-item">
                      <div className="formula-item-header">
                        <span className="formula-icon">🔢</span>
                        <span className="formula-name">{col.alias || 'Unnamed Ranking'}</span>
                        <span className="formula-type-badge">Ranking</span>
                      </div>
                      <div className="formula-expression">{functionText}</div>
                      <div className="formula-actions">
                        {onEditWindow && (
                          <button
                            className="edit-formula-btn"
                            onClick={() => onEditWindow(col, originalIndex >= 0 ? originalIndex : index)}
                            title="Edit ranking"
                          >
                            ✏️ Edit
                          </button>
                        )}
                        <button
                          className="delete-formula-btn"
                          onClick={() => {
                            const updated = windowColumns.filter((_, i) => i !== (originalIndex >= 0 ? originalIndex : index));
                            onWindowChange(updated);
                          }}
                          title="Delete ranking"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default ColumnSelector;
