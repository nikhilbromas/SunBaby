import React from 'react';
import type { JoinConfig, JoinType } from '../../services/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface JoinBuilderProps {
  joins: JoinConfig[];
  availableTables: string[];
  availableColumns: string[];
  onChange: (joins: JoinConfig[]) => void;
}

// User-friendly labels for join types
const JOIN_TYPE_LABELS: Record<JoinType, { label: string; description: string }> = {
  'INNER': { label: 'Matching Only', description: 'Show only records that exist in both tables' },
  'LEFT': { label: 'All from First', description: 'Show all from first table, matching from second' },
  'RIGHT': { label: 'All from Second', description: 'Show all from second table, matching from first' },
  'FULL OUTER': { label: 'All Records', description: 'Show all records from both tables' },
  'CROSS': { label: 'Every Combination', description: 'Combine every record with every other' }
};

const JOIN_TYPES: JoinType[] = ['INNER', 'LEFT', 'RIGHT', 'FULL OUTER', 'CROSS'];

// Check if a join has valid conditions
const hasValidConditions = (join: JoinConfig): boolean => {
  if (join.type === 'CROSS') return true;
  return join.conditions.some(c => c.leftColumn && c.rightColumn);
};

const JoinBuilder: React.FC<JoinBuilderProps> = ({
  joins,
  availableTables,
  availableColumns,
  onChange
}) => {
  // Get columns for a specific table from availableColumns
  const getColumnsForTable = (tableName: string): string[] => {
    return availableColumns.filter(col => col.startsWith(`${tableName}.`));
  };

  // Try to find a smart default condition (matching column names between tables)
  const findSmartDefaults = (baseTable: string, joinTable: string): { left: string; right: string } => {
    const baseCols = getColumnsForTable(baseTable);
    const joinCols = getColumnsForTable(joinTable);
    
    // Look for common column name patterns (ID, Key endings, or same name)
    for (const leftCol of baseCols) {
      const leftName = leftCol.split('.').pop()?.toLowerCase() || '';
      for (const rightCol of joinCols) {
        const rightName = rightCol.split('.').pop()?.toLowerCase() || '';
        // Exact match or common FK patterns
        if (leftName === rightName && leftName) {
          return { left: leftCol, right: rightCol };
        }
        // Common patterns: BillID matches poshBillID, etc.
        if (leftName.endsWith('id') && rightName.includes(leftName.replace('id', ''))) {
          return { left: leftCol, right: rightCol };
        }
        if (rightName.endsWith('id') && leftName.includes(rightName.replace('id', ''))) {
          return { left: leftCol, right: rightCol };
        }
      }
    }
    
    return { left: baseCols[0] || '', right: joinCols[0] || '' };
  };

  const addJoin = () => {
    // Get a table that isn't already in a join and isn't the base table
    const usedTables = joins.map(j => j.table);
    const baseTable = availableTables[0] || '';
    const availableForJoin = availableTables.filter(t => !usedTables.includes(t) && t !== baseTable);
    const defaultTable = availableForJoin[0] || availableTables[1] || availableTables[0] || '';
    
    // Try to find smart defaults for the join condition
    const defaults = findSmartDefaults(baseTable, defaultTable);
    
    const newJoin: JoinConfig = {
      type: 'INNER',
      table: defaultTable,
      alias: '',
      conditions: [{ leftColumn: defaults.left, operator: '=', rightColumn: defaults.right }]
    };
    onChange([...joins, newJoin]);
  };

  const removeJoin = (index: number) => {
    onChange(joins.filter((_, i) => i !== index));
  };

  const updateJoin = (index: number, updates: Partial<JoinConfig>) => {
    const updated = [...joins];
    updated[index] = { ...updated[index], ...updates };
    
    // If table changed, try to update conditions with smart defaults
    if (updates.table && updates.table !== joins[index].table) {
      const baseTable = availableTables[0] || '';
      const defaults = findSmartDefaults(baseTable, updates.table);
      if (defaults.left || defaults.right) {
        updated[index].conditions = [{ leftColumn: defaults.left, operator: '=', rightColumn: defaults.right }];
      }
    }
    
    onChange(updated);
  };

  const addCondition = (joinIndex: number) => {
    const updated = [...joins];
    // Pick the first available column as default, preferring empty to avoid confusion
    updated[joinIndex].conditions.push({
      leftColumn: '',
      operator: '=',
      rightColumn: '',
      andOr: 'AND'
    });
    onChange(updated);
  };

  const removeCondition = (joinIndex: number, condIndex: number) => {
    const updated = [...joins];
    updated[joinIndex].conditions = updated[joinIndex].conditions.filter((_, i) => i !== condIndex);
    onChange(updated);
  };

  const updateCondition = (joinIndex: number, condIndex: number, updates: any) => {
    const updated = [...joins];
    updated[joinIndex].conditions[condIndex] = {
      ...updated[joinIndex].conditions[condIndex],
      ...updates
    };
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-base font-semibold text-slate-900">Link Data Sources</h4>
        <Button
          type="button"
          onClick={addJoin}
          disabled={availableTables.length === 0}
          size="sm"
          className="bg-blue-600 text-white hover:bg-blue-700"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Link Tables
        </Button>
      </div>

      {availableTables.length <= 1 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-blue-900">
            You have only one data source selected. Add more data sources in Step 1 to link them together.
          </p>
        </div>
      )}

      {joins.length === 0 && availableTables.length > 1 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-slate-200 rounded-lg bg-white">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h4 className="text-sm font-semibold text-slate-900 mb-1">No links created</h4>
          <p className="text-xs text-slate-500">Link your data sources to combine related information</p>
        </div>
      ) : (
        <div className="space-y-4">
          {joins.map((join, joinIndex) => {
            const isValid = hasValidConditions(join);
            return (
              <Card key={joinIndex} className={cn(
                "border shadow-md",
                !isValid ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"
              )}>
                <div className="p-4 space-y-4">
                  {!isValid && (
                    <div className="flex items-start gap-2 text-amber-800 text-sm">
                      <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium">Please select fields to match on</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Link Type
                      </label>
                      <select
                        value={join.type}
                        onChange={(e) => updateJoin(joinIndex, { type: e.target.value as JoinType })}
                        title={JOIN_TYPE_LABELS[join.type].description}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      >
                        {JOIN_TYPES.map(type => (
                          <option key={type} value={type}>{JOIN_TYPE_LABELS[type].label}</option>
                        ))}
                      </select>
                      <p className="text-xs text-slate-500 mt-1">{JOIN_TYPE_LABELS[join.type].description}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Connect To
                      </label>
                      <select
                        value={join.table}
                        onChange={(e) => updateJoin(joinIndex, { table: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      >
                        {availableTables.map(table => (
                          <option key={table} value={table}>{table}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Short Name (optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., ord"
                        value={join.alias || ''}
                        onChange={(e) => updateJoin(joinIndex, { alias: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>
                  </div>

                  {join.type !== 'CROSS' && (
                    <div className="pt-4 border-t border-slate-200 space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                        </svg>
                        <span className="text-sm font-medium text-slate-700">Match Where:</span>
                      </div>

                      {join.conditions.map((cond, condIndex) => (
                        <div key={condIndex} className="space-y-2">
                          {condIndex > 0 && (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 border-t border-slate-200"></div>
                              <select
                                value={cond.andOr || 'AND'}
                                onChange={(e) => updateCondition(joinIndex, condIndex, { andOr: e.target.value })}
                                className="px-3 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium bg-slate-50"
                              >
                                <option value="AND">AND</option>
                                <option value="OR">OR</option>
                              </select>
                              <div className="flex-1 border-t border-slate-200"></div>
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <select
                              value={cond.leftColumn}
                              onChange={(e) => updateCondition(joinIndex, condIndex, { leftColumn: e.target.value })}
                              className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            >
                              <option value="">Select field...</option>
                              {availableColumns.map(col => (
                                <option key={col} value={col}>{col}</option>
                              ))}
                            </select>
                            <span className="flex-shrink-0 text-slate-600 font-bold">=</span>
                            <select
                              value={cond.rightColumn}
                              onChange={(e) => updateCondition(joinIndex, condIndex, { rightColumn: e.target.value })}
                              className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            >
                              <option value="">Select field...</option>
                              {availableColumns.map(col => (
                                <option key={col} value={col}>{col}</option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              onClick={() => removeCondition(joinIndex, condIndex)}
                              variant="outline"
                              size="sm"
                              className="border-red-200 text-red-600 hover:bg-red-50"
                              title="Remove condition"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </Button>
                          </div>
                        </div>
                      ))}

                      <Button
                        type="button"
                        onClick={() => addCondition(joinIndex)}
                        variant="outline"
                        size="sm"
                        className="w-full border-slate-300 text-slate-700 hover:bg-slate-50"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Another Match
                      </Button>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-200 flex justify-end">
                    <Button
                      type="button"
                      onClick={() => removeJoin(joinIndex)}
                      variant="outline"
                      size="sm"
                      className="border-red-200 text-red-600 hover:bg-red-50"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Remove Link
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default JoinBuilder;
