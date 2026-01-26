import React from 'react';
import './OrderByBuilder.css';

interface OrderByItem {
  column: string;
  direction: 'ASC' | 'DESC';
}

interface OrderByBuilderProps {
  orderBy: OrderByItem[];
  availableColumns: string[];
  onChange: (orderBy: OrderByItem[]) => void;
}

const OrderByBuilder: React.FC<OrderByBuilderProps> = ({
  orderBy,
  availableColumns,
  onChange
}) => {
  const addColumn = () => {
    if (availableColumns.length > 0) {
      const newItem: OrderByItem = {
        column: availableColumns[0],
        direction: 'ASC'
      };
      onChange([...orderBy, newItem]);
    }
  };

  const removeColumn = (index: number) => {
    onChange(orderBy.filter((_, i) => i !== index));
  };

  const updateColumn = (index: number, column: string) => {
    const updated = [...orderBy];
    updated[index] = { ...updated[index], column };
    onChange(updated);
  };

  const updateDirection = (index: number, direction: 'ASC' | 'DESC') => {
    const updated = [...orderBy];
    updated[index] = { ...updated[index], direction };
    onChange(updated);
  };

  const moveUp = (index: number) => {
    if (index > 0) {
      const updated = [...orderBy];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      onChange(updated);
    }
  };

  const moveDown = (index: number) => {
    if (index < orderBy.length - 1) {
      const updated = [...orderBy];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      onChange(updated);
    }
  };

  return (
    <div className="orderby-builder">
      <div className="orderby-builder-header">
        <h4>↕️ Sort Results</h4>
        <button
          type="button"
          onClick={addColumn}
          className="add-orderby-btn"
          disabled={availableColumns.length === 0}
        >
          ➕ Add Sort
        </button>
      </div>

      {orderBy.length === 0 ? (
        <div className="orderby-builder-empty">
          <div className="empty-icon">↕️</div>
          <h4>No sorting applied</h4>
          <p>Add sorting to arrange your results in a specific order</p>
        </div>
      ) : (
        <>
          <div className="orderby-info">
            <span className="info-icon">💡</span>
            <p>Drag to change priority. First sort is applied first, then second, and so on.</p>
          </div>
          <div className="orderby-list">
            {orderBy.map((item, index) => (
              <div key={index} className="orderby-item">
                <div className="orderby-controls">
                  <button
                    type="button"
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className="move-btn"
                    title="Move up (higher priority)"
                  >
                    ▲
                  </button>
                  <span className="priority-number">{index + 1}</span>
                  <button
                    type="button"
                    onClick={() => moveDown(index)}
                    disabled={index === orderBy.length - 1}
                    className="move-btn"
                    title="Move down (lower priority)"
                  >
                    ▼
                  </button>
                </div>

                <div className="sort-config">
                  <div className="sort-field-wrapper">
                    <label className="sort-label">Sort by</label>
                    <select
                      className="orderby-column-select"
                      value={item.column}
                      onChange={(e) => updateColumn(index, e.target.value)}
                    >
                      {availableColumns.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sort-direction-wrapper">
                    <label className="sort-label">Order</label>
                    <select
                      className="orderby-direction-select"
                      value={item.direction}
                      onChange={(e) => updateDirection(index, e.target.value as 'ASC' | 'DESC')}
                    >
                      <option value="ASC">A → Z / Smallest First</option>
                      <option value="DESC">Z → A / Largest First</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeColumn(index)}
                  className="remove-orderby-btn"
                  title="Remove sorting"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default OrderByBuilder;
