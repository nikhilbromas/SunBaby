import React, { useState } from 'react';
import type { WindowFunction, WindowFunctionType } from '../../services/types';
import './WindowFunctionBuilder.css';

interface WindowFunctionBuilderProps {
  availableColumns: string[];
  initialValue?: WindowFunction;
  onAdd: (windowFunc: WindowFunction) => void;
  onCancel: () => void;
}

// User-friendly function descriptions
const WINDOW_FUNCTION_INFO: Record<WindowFunctionType, { label: string; description: string; category: string }> = {
  'ROW_NUMBER': { label: 'Row Number', description: 'Assigns a unique number to each row (1, 2, 3...)', category: 'Ranking' },
  'RANK': { label: 'Rank', description: 'Assigns rank with gaps for ties (1, 2, 2, 4...)', category: 'Ranking' },
  'DENSE_RANK': { label: 'Dense Rank', description: 'Assigns rank without gaps (1, 2, 2, 3...)', category: 'Ranking' },
  'NTILE': { label: 'Split into Groups', description: 'Divides rows into equal groups', category: 'Ranking' },
  'SUM': { label: 'Running Sum', description: 'Calculates running total', category: 'Running Totals' },
  'AVG': { label: 'Running Average', description: 'Calculates running average', category: 'Running Totals' },
  'COUNT': { label: 'Running Count', description: 'Calculates running count', category: 'Running Totals' },
  'MIN': { label: 'Running Minimum', description: 'Tracks the lowest value so far', category: 'Running Totals' },
  'MAX': { label: 'Running Maximum', description: 'Tracks the highest value so far', category: 'Running Totals' },
  'LEAD': { label: 'Next Row Value', description: 'Gets value from the next row', category: 'Row Navigation' },
  'LAG': { label: 'Previous Row Value', description: 'Gets value from the previous row', category: 'Row Navigation' },
  'FIRST_VALUE': { label: 'First Value', description: 'Gets the first value in the group', category: 'Row Navigation' },
  'LAST_VALUE': { label: 'Last Value', description: 'Gets the last value in the group', category: 'Row Navigation' }
};

const WINDOW_FUNCTIONS: WindowFunctionType[] = [
  'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'NTILE',
  'SUM', 'AVG', 'COUNT', 'MIN', 'MAX',
  'LEAD', 'LAG', 'FIRST_VALUE', 'LAST_VALUE'
];

const WindowFunctionBuilder: React.FC<WindowFunctionBuilderProps> = ({
  availableColumns,
  initialValue,
  onAdd,
  onCancel
}) => {
  const [selectedFunction, setSelectedFunction] = useState<WindowFunctionType>(
    initialValue?.function || 'ROW_NUMBER'
  );
  const [alias, setAlias] = useState(initialValue?.alias || '');
  const [usePartitionBy, setUsePartitionBy] = useState(
    (initialValue?.partitionBy && initialValue.partitionBy.length > 0) || false
  );
  const [partitionColumns, setPartitionColumns] = useState<string[]>(
    initialValue?.partitionBy || []
  );
  const [useOrderBy, setUseOrderBy] = useState<boolean>(
    (initialValue?.orderBy && initialValue.orderBy.length > 0) || true
  );
  const [orderByItems, setOrderByItems] = useState<{ column: string; direction: 'ASC' | 'DESC' }[]>(
    initialValue?.orderBy || [
      { column: availableColumns[0] || '', direction: 'ASC' }
    ]
  );

  const handleAdd = () => {
    const windowFunc: WindowFunction = {
      type: 'window',
      function: selectedFunction,
      alias: alias || selectedFunction.toLowerCase(),
      partitionBy: usePartitionBy ? partitionColumns : undefined,
      orderBy: useOrderBy ? orderByItems : undefined
    };
    onAdd(windowFunc);
  };

  const addPartitionColumn = () => {
    if (availableColumns.length > 0) {
      setPartitionColumns([...partitionColumns, availableColumns[0]]);
    }
  };

  const addOrderByItem = () => {
    if (availableColumns.length > 0) {
      setOrderByItems([...orderByItems, { column: availableColumns[0], direction: 'ASC' }]);
    }
  };

  const functionInfo = WINDOW_FUNCTION_INFO[selectedFunction];

  // Group functions by category
  const functionsByCategory = WINDOW_FUNCTIONS.reduce((acc, fn) => {
    const cat = WINDOW_FUNCTION_INFO[fn].category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(fn);
    return acc;
  }, {} as Record<string, WindowFunctionType[]>);

  return (
    <div className="window-function-builder">
      <div className="window-header">
        <h3>{initialValue ? '✏️ Edit Ranking or Running Calculation' : '🔢 Add Ranking or Running Calculation'}</h3>
        <p>{initialValue ? 'Update your ranking or running calculation' : 'Add row numbers, rankings, or running totals to your results'}</p>
      </div>

      <div className="window-form">
        <div className="form-group">
          <label>
            <span className="label-text">Choose Function</span>
          </label>
          <div className="function-grid">
            {Object.entries(functionsByCategory).map(([category, fns]) => (
              <div key={category} className="function-category">
                <div className="category-title">{category}</div>
                <div className="category-functions">
                  {fns.map(fn => (
                    <button
                      key={fn}
                      type="button"
                      className={`function-option ${selectedFunction === fn ? 'selected' : ''}`}
                      onClick={() => setSelectedFunction(fn)}
                      title={WINDOW_FUNCTION_INFO[fn].description}
                    >
                      <span className="fn-label">{WINDOW_FUNCTION_INFO[fn].label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {functionInfo && (
            <div className="function-description">
              <span className="desc-icon">💡</span>
              <span>{functionInfo.description}</span>
            </div>
          )}
        </div>

        <div className="form-group">
          <label>
            <span className="label-text">Display Name</span>
          </label>
          <input
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder={`e.g., ${WINDOW_FUNCTION_INFO[selectedFunction].label.replace(/\s+/g, '')}`}
            className="name-input"
          />
          <span className="hint">This name will appear as the column header</span>
        </div>

        <div className="form-group checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={usePartitionBy}
              onChange={(e) => setUsePartitionBy(e.target.checked)}
            />
            <span>Reset for each group</span>
          </label>
          <span className="checkbox-hint">
            Start numbering from 1 for each unique combination of these fields
          </span>
          {usePartitionBy && (
            <div className="partition-section">
              {partitionColumns.length === 0 ? (
                <div className="empty-partition">
                  Click "Add Field" to choose grouping fields
                </div>
              ) : (
                partitionColumns.map((col, index) => (
                  <div key={index} className="partition-item">
                    <select
                      value={col}
                      onChange={(e) => {
                        const updated = [...partitionColumns];
                        updated[index] = e.target.value;
                        setPartitionColumns(updated);
                      }}
                    >
                      {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button
                      type="button"
                      className="remove-btn"
                      onClick={() => setPartitionColumns(partitionColumns.filter((_, i) => i !== index))}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
              <button type="button" onClick={addPartitionColumn} className="add-field-btn">
                ➕ Add Field
              </button>
            </div>
          )}
        </div>

        <div className="form-group checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={useOrderBy}
              onChange={(e) => setUseOrderBy(e.target.checked)}
            />
            <span>Sort within each group</span>
          </label>
          <span className="checkbox-hint">
            Determine the order in which numbering or calculations are applied
          </span>
          {useOrderBy && (
            <div className="orderby-section">
              {orderByItems.map((item, index) => (
                <div key={index} className="orderby-item">
                  <span className="order-number">{index + 1}</span>
                  <select
                    value={item.column}
                    onChange={(e) => {
                      const updated = [...orderByItems];
                      updated[index].column = e.target.value;
                      setOrderByItems(updated);
                    }}
                  >
                    {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select
                    className="direction-select"
                    value={item.direction}
                    onChange={(e) => {
                      const updated = [...orderByItems];
                      updated[index].direction = e.target.value as 'ASC' | 'DESC';
                      setOrderByItems(updated);
                    }}
                  >
                    <option value="ASC">A → Z / Smallest First</option>
                    <option value="DESC">Z → A / Largest First</option>
                  </select>
                  <button
                    type="button"
                    className="remove-btn"
                    onClick={() => setOrderByItems(orderByItems.filter((_, i) => i !== index))}
                    disabled={orderByItems.length <= 1}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button type="button" onClick={addOrderByItem} className="add-field-btn">
                ➕ Add Sort Field
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="window-function-actions">
        <button type="button" onClick={onCancel} className="cancel-btn">
          ← Back
        </button>
        <button type="button" onClick={handleAdd} className="add-btn primary">
          {initialValue ? '✓ Update' : `✓ Add ${WINDOW_FUNCTION_INFO[selectedFunction].label}`}
        </button>
      </div>
    </div>
  );
};

export default WindowFunctionBuilder;
