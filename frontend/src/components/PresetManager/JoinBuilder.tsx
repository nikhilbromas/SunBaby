import React from 'react';
import type { JoinConfig, JoinType } from '../../services/types';
import './JoinBuilder.css';

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
    <div className="join-builder">
      <div className="join-builder-header">
        <h4>Link Data Sources</h4>
        <button
          type="button"
          onClick={addJoin}
          className="add-join-btn"
          disabled={availableTables.length === 0}
        >
          ➕ Link Tables
        </button>
      </div>

      {availableTables.length <= 1 && (
        <div className="join-builder-info">
          <span className="info-icon">💡</span>
          <p>You have only one data source selected. Add more data sources in Step 1 to link them together.</p>
        </div>
      )}

      {joins.length === 0 && availableTables.length > 1 ? (
        <div className="join-builder-empty">
          <div className="empty-icon">🔗</div>
          <h4>No links created</h4>
          <p>Link your data sources to combine related information</p>
        </div>
      ) : (
        <div className="joins-list">
          {joins.map((join, joinIndex) => {
            const isValid = hasValidConditions(join);
            return (
            <div key={joinIndex} className={`join-item ${!isValid ? 'join-item-warning' : ''}`}>
              {!isValid && (
                <div className="join-warning">
                  ⚠️ Please select fields to match on
                </div>
              )}
              <div className="join-header">
                <div className="join-type-wrapper">
                  <label className="join-type-label">Link Type</label>
                  <select
                    value={join.type}
                    onChange={(e) => updateJoin(joinIndex, { type: e.target.value as JoinType })}
                    className="join-type-select"
                    title={JOIN_TYPE_LABELS[join.type].description}
                  >
                    {JOIN_TYPES.map(type => (
                      <option key={type} value={type}>{JOIN_TYPE_LABELS[type].label}</option>
                    ))}
                  </select>
                </div>

                <div className="join-table-wrapper">
                  <label className="join-table-label">Connect To</label>
                  <select
                    value={join.table}
                    onChange={(e) => updateJoin(joinIndex, { table: e.target.value })}
                    className="join-table-select"
                  >
                    {availableTables.map(table => (
                      <option key={table} value={table}>{table}</option>
                    ))}
                  </select>
                </div>

                <div className="join-alias-wrapper">
                  <label className="join-alias-label">Short Name (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g., ord"
                    value={join.alias || ''}
                    onChange={(e) => updateJoin(joinIndex, { alias: e.target.value })}
                    className="join-alias-input"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => removeJoin(joinIndex)}
                  className="remove-join-btn"
                  title="Remove this link"
                >
                  ×
                </button>
              </div>

              {join.type !== 'CROSS' && (
                <div className="join-conditions">
                  <div className="conditions-header">
                    <span className="on-label">Match Where:</span>
                  </div>
                  {join.conditions.map((cond, condIndex) => (
                    <div key={condIndex} className="join-condition">
                      {condIndex > 0 && (
                        <select
                          value={cond.andOr || 'AND'}
                          onChange={(e) => updateCondition(joinIndex, condIndex, { andOr: e.target.value })}
                          className="and-or-select"
                        >
                          <option value="AND">AND</option>
                          <option value="OR">OR</option>
                        </select>
                      )}
                      <select
                        value={cond.leftColumn}
                        onChange={(e) => updateCondition(joinIndex, condIndex, { leftColumn: e.target.value })}
                        className="column-select"
                      >
                        <option value="">Select field...</option>
                        {availableColumns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                      <span className="equals-sign">=</span>
                      <select
                        value={cond.rightColumn}
                        onChange={(e) => updateCondition(joinIndex, condIndex, { rightColumn: e.target.value })}
                        className="column-select"
                      >
                        <option value="">Select field...</option>
                        {availableColumns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeCondition(joinIndex, condIndex)}
                        className="remove-condition-btn"
                        title="Remove condition"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addCondition(joinIndex)}
                    className="add-condition-btn"
                  >
                    ➕ Add Another Match
                  </button>
                </div>
              )}
            </div>
          )})}
        </div>
      )}
    </div>
  );
};

export default JoinBuilder;
