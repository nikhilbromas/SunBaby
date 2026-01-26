import React from 'react';
import type { WhereCondition, WhereOperator } from '../../services/types';
import './WhereBuilder.css';

interface WhereBuilderProps {
  conditions: WhereCondition[];
  availableColumns: string[];
  onChange: (conditions: WhereCondition[]) => void;
}

// User-friendly labels for operators
const OPERATOR_LABELS: Record<WhereOperator, string> = {
  '=': 'equals',
  '!=': 'not equals',
  '>': 'greater than',
  '<': 'less than',
  '>=': 'at least',
  '<=': 'at most',
  'LIKE': 'contains',
  'IN': 'is one of',
  'IS NULL': 'is empty',
  'IS NOT NULL': 'is not empty'
};

const OPERATORS: WhereOperator[] = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN', 'IS NULL', 'IS NOT NULL'];

const WhereBuilder: React.FC<WhereBuilderProps> = ({
  conditions,
  availableColumns,
  onChange
}) => {
  const addCondition = () => {
    const newCondition: WhereCondition = {
      column: availableColumns[0] || '',
      operator: '=',
      value: '',
      isParameter: false,
      andOr: conditions.length > 0 ? 'AND' : undefined
    };
    onChange([...conditions, newCondition]);
  };

  const removeCondition = (index: number) => {
    const updated = conditions.filter((_, i) => i !== index);
    if (updated.length > 0 && updated[0].andOr) {
      updated[0] = { ...updated[0], andOr: undefined };
    }
    onChange(updated);
  };

  const updateCondition = (index: number, updates: Partial<WhereCondition>) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const needsValue = (operator: WhereOperator) => {
    return operator !== 'IS NULL' && operator !== 'IS NOT NULL';
  };

  return (
    <div className="where-builder">
      <div className="where-builder-header">
        <h4>🔍 Filters</h4>
        <button
          type="button"
          onClick={addCondition}
          className="add-condition-btn"
          disabled={availableColumns.length === 0}
        >
          ➕ Add Filter
        </button>
      </div>

      {conditions.length === 0 ? (
        <div className="where-builder-empty">
          <div className="empty-icon">🔍</div>
          <h4>No filters added</h4>
          <p>Add filters to show only the records you need</p>
        </div>
      ) : (
        <div className="where-conditions-list">
          {conditions.map((condition, index) => (
            <div key={index} className="where-condition-row">
              {index > 0 && (
                <div className="logic-connector">
                  <select
                    className="and-or-select"
                    value={condition.andOr || 'AND'}
                    onChange={(e) => updateCondition(index, { andOr: e.target.value as 'AND' | 'OR' })}
                  >
                    <option value="AND">AND (all must match)</option>
                    <option value="OR">OR (any can match)</option>
                  </select>
                </div>
              )}

              <div className="condition-content">
                <div className="condition-row">
                  <div className="field-wrapper">
                    <label className="field-label">Field</label>
                    <select
                      className="column-select"
                      value={condition.column}
                      onChange={(e) => updateCondition(index, { column: e.target.value })}
                    >
                      {availableColumns.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>

                  <div className="operator-wrapper">
                    <label className="operator-label">Condition</label>
                    <select
                      className="operator-select"
                      value={condition.operator}
                      onChange={(e) => updateCondition(index, { operator: e.target.value as WhereOperator })}
                    >
                      {OPERATORS.map(op => (
                        <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
                      ))}
                    </select>
                  </div>

                  {needsValue(condition.operator) && (
                    <div className="value-wrapper">
                      <label className="value-label">Value</label>
                      {condition.operator === 'IN' ? (
                        <input
                          type="text"
                          className="value-input"
                          placeholder="value1, value2, ..."
                          value={Array.isArray(condition.value) ? condition.value.join(', ') : condition.value || ''}
                          onChange={(e) => {
                            const values = e.target.value.split(',').map(v => v.trim());
                            updateCondition(index, { value: values });
                          }}
                        />
                      ) : (
                        <div className="value-input-wrapper">
                          <input
                            type="text"
                            className="value-input"
                            placeholder={condition.operator === 'LIKE' ? '%search%' : 'Enter value or @parameter'}
                            value={condition.value as string || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const isParam = val.startsWith('@');
                              updateCondition(index, { value: val, isParameter: isParam });
                            }}
                          />
                          {condition.isParameter && (
                            <span className="parameter-badge" title="This is a parameter - value will be provided at runtime">
                              Parameter
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => removeCondition(index)}
                    className="remove-condition-btn"
                    title="Remove filter"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {conditions.length > 0 && (
        <div className="filter-summary">
          <span className="filter-count">{conditions.length} filter{conditions.length !== 1 ? 's' : ''} active</span>
        </div>
      )}
    </div>
  );
};

export default WhereBuilder;
