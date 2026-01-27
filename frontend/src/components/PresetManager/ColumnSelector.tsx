import React, { useCallback, useState, useMemo } from 'react';
import type { ColumnInfo, SimpleColumn, CalculatedColumn, WindowFunction } from '../../services/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">Choose Fields</h3>
        <div className="flex gap-2">
          {onAddCalculated && (
            <Button
              onClick={onAddCalculated}
              size="sm"
              variant="outline"
              className="border-emerald-200 text-emerald-600 hover:bg-emerald-50"
              title="Add a formula field"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Add Formula
            </Button>
          )}
          {onAddWindow && (
            <Button
              onClick={onAddWindow}
              size="sm"
              variant="outline"
              className="border-blue-200 text-blue-600 hover:bg-blue-50"
              title="Add ranking or numbering"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
              </svg>
              Add Ranking
            </Button>
          )}
        </div>
      </div>

      {selectedTables.length > 0 && (
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search fields, aliases, or data types..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              title="Clear search"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {selectedTables.length > 1 && (
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={expandAll}
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none border-slate-300 text-slate-700"
            title="Expand all tables"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            Expand All
          </Button>
          <Button
            type="button"
            onClick={collapseAll}
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none border-slate-300 text-slate-700"
            title="Collapse all tables"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            Collapse All
          </Button>
        </div>
      )}

      {hasLoadingTables && (
        <div className="flex items-center justify-center py-8 text-slate-500">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-sm font-medium">Loading fields...</p>
          </div>
        </div>
      )}

      {selectedTables.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-slate-200 rounded-lg bg-white">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h4 className="text-sm font-semibold text-slate-900 mb-1">No data sources selected</h4>
          <p className="text-xs text-slate-500">Go back to Step 1 and select a data source first</p>
        </div>
      )}

      {selectedTables.length > 0 && (
        <div className="space-y-3">
          {selectedTables.map(tableName => {
            const cols = getTableColumns(tableName);
            const tableKey = findTableKey(tableName);
            const filteredCols = filterColumns(cols, tableName);
            const collapsed = isCollapsed(tableName);
            const matchCount = getMatchCount(tableName);
            const selectedCount = cols.filter(col => isColumnSelected(tableName, col.name)).length;
            
            return (
              <Card key={tableName} className="border border-slate-200 shadow-sm bg-white overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleCollapse(tableName)}
                      title={collapsed ? 'Expand' : 'Collapse'}
                      className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors"
                    >
                      <svg 
                        className={cn("w-5 h-5 transition-transform", collapsed && "-rotate-90")} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <span className="flex-1 font-semibold text-sm text-slate-900">{tableName}</span>
                    {collapsed ? (
                      <span className="text-xs text-slate-600 bg-slate-200 px-2 py-1 rounded-full">
                        {selectedCount > 0 && `${selectedCount}/`}{matchCount.matching > 0 ? matchCount.matching : matchCount.total} fields
                      </span>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          onClick={() => selectAll(tableName)}
                          variant="outline"
                          size="sm"
                          className="border-blue-200 text-blue-600 hover:bg-blue-50 text-xs"
                          title="Select all fields"
                        >
                          Select All
                        </Button>
                        <Button
                          onClick={() => deselectAll(tableName)}
                          variant="outline"
                          size="sm"
                          className="border-slate-200 text-slate-600 hover:bg-slate-50 text-xs"
                          title="Deselect all fields"
                        >
                          Clear
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {!collapsed && (
                  <div className="p-4">
                    {filteredCols.length > 0 ? (
                      <div className="space-y-2">
                        {filteredCols.map(col => {
                          const selected = isColumnSelected(tableName, col.name);
                          const highlightName = (name: string) => {
                            if (!searchTerm.trim()) return name;
                            const parts = name.split(new RegExp(`(${searchTerm})`, 'gi'));
                            return parts.map((part, i) => 
                              part.toLowerCase() === searchTerm.toLowerCase() ? (
                                <mark key={i} className="bg-yellow-200">{part}</mark>
                              ) : part
                            );
                          };
                          
                          return (
                            <div key={col.name} className={cn(
                              "border rounded-lg p-3 transition-colors",
                              selected ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
                            )}>
                              <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleColumn(tableName, col)}
                                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-sm text-slate-900">
                                      {highlightName(col.name)}
                                    </span>
                                    <span className="text-xs text-slate-500 font-mono">{col.dataType}</span>
                                    {col.isPrimaryKey && (
                                      <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">Key</span>
                                    )}
                                    {col.isForeignKey && (
                                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">Link</span>
                                    )}
                                  </div>
                                </div>
                              </label>
                              {selected && (
                                <div className="mt-2 ml-7 flex items-center gap-2">
                                  <label className="text-xs font-medium text-slate-700 flex-shrink-0">Display Name:</label>
                                  <input
                                    type="text"
                                    placeholder="Same as field name"
                                    value={selectedColumns.find(c => 
                                      c.table.toLowerCase() === tableName.toLowerCase() && 
                                      c.column.toLowerCase() === col.name.toLowerCase()
                                    )?.alias || ''}
                                    onChange={(e) => updateAlias(tableName, col.name, e.target.value)}
                                    className="flex-1 px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : searchTerm ? (
                      <div className="text-center py-6 text-sm text-slate-500">No fields match "{searchTerm}"</div>
                    ) : tableKey ? (
                      <div className="text-center py-6 text-sm text-slate-500">No fields available</div>
                    ) : (
                      <div className="text-center py-6 text-sm text-slate-500">Loading...</div>
                    )}
                    {searchTerm && filteredCols.length < cols.length && (
                      <div className="mt-3 text-xs text-slate-500 text-center">
                        Showing {filteredCols.length} of {cols.length} fields
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {searchTerm && selectedTables.length > 0 && (() => {
        const totalMatches = selectedTables.reduce((sum, table) => sum + getMatchCount(table).matching, 0);
        return (
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-slate-700 font-medium">
              {totalMatches > 0 
                ? `Found ${totalMatches} matching field${totalMatches !== 1 ? 's' : ''}`
                : `No fields found matching "${searchTerm}"`
              }
            </span>
          </div>
        );
      })()}

      {selectedColumns.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-blue-900">
            {selectedColumns.length} field{selectedColumns.length !== 1 ? 's' : ''} selected
          </span>
        </div>
      )}

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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold text-slate-900">Formula Fields</h4>
              <span className="text-sm text-slate-600">
                {filteredCalculated.length + filteredWindow.length} formula{filteredCalculated.length + filteredWindow.length !== 1 ? 's' : ''}
                {searchTerm.trim() && (calculatedColumns.length + windowColumns.length !== filteredCalculated.length + filteredWindow.length) && (
                  <span className="text-xs text-slate-500">
                    {' '}(filtered from {calculatedColumns.length + windowColumns.length})
                  </span>
                )}
              </span>
            </div>

            <div className="space-y-3">
              {filteredCalculated.map((col, index) => {
                const originalIndex = calculatedColumns.findIndex(c => c === col);
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
                  <Card key={`calc-${index}`} className="border border-emerald-200 bg-emerald-50 shadow-sm">
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex-shrink-0 w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-slate-900">{col.alias || 'Unnamed Formula'}</div>
                          <span className="text-xs px-2 py-0.5 bg-emerald-200 text-emerald-800 rounded-full font-medium">Formula</span>
                        </div>
                        <div className="flex gap-2">
                          {onEditCalculated && (
                            <Button
                              onClick={() => onEditCalculated(col, originalIndex >= 0 ? originalIndex : index)}
                              variant="outline"
                              size="sm"
                              className="border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                              title="Edit formula"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </Button>
                          )}
                          <Button
                            onClick={() => {
                              const updated = calculatedColumns.filter((_, i) => i !== (originalIndex >= 0 ? originalIndex : index));
                              onCalculatedChange(updated);
                            }}
                            variant="outline"
                            size="sm"
                            className="border-red-200 text-red-600 hover:bg-red-50"
                            title="Delete formula"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 p-2 bg-white rounded border border-emerald-200 font-mono text-xs text-slate-700">
                        {expressionText}
                      </div>
                    </div>
                  </Card>
                );
              })}

              {filteredWindow.map((col, index) => {
                const originalIndex = windowColumns.findIndex(c => c === col);
                const partitionText = col.partitionBy?.join(', ') || '';
                const orderByText = col.orderBy?.map(o => `${o.column} ${o.direction}`).join(', ') || '';
                const functionText = `${col.function}(${partitionText ? `PARTITION BY ${partitionText}` : ''}${orderByText ? ` ORDER BY ${orderByText}` : ''})`;
                
                return (
                  <Card key={`window-${index}`} className="border border-blue-200 bg-blue-50 shadow-sm">
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-slate-900">{col.alias || 'Unnamed Ranking'}</div>
                          <span className="text-xs px-2 py-0.5 bg-blue-200 text-blue-800 rounded-full font-medium">Ranking</span>
                        </div>
                        <div className="flex gap-2">
                          {onEditWindow && (
                            <Button
                              onClick={() => onEditWindow(col, originalIndex >= 0 ? originalIndex : index)}
                              variant="outline"
                              size="sm"
                              className="border-blue-300 text-blue-700 hover:bg-blue-100"
                              title="Edit ranking"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </Button>
                          )}
                          <Button
                            onClick={() => {
                              const updated = windowColumns.filter((_, i) => i !== (originalIndex >= 0 ? originalIndex : index));
                              onWindowChange(updated);
                            }}
                            variant="outline"
                            size="sm"
                            className="border-red-200 text-red-600 hover:bg-red-50"
                            title="Delete ranking"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 p-2 bg-white rounded border border-blue-200 font-mono text-xs text-slate-700">
                        {functionText}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default ColumnSelector;
