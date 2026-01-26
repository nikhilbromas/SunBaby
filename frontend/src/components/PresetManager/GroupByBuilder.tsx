import React from 'react';
import './GroupByBuilder.css';

interface GroupByBuilderProps {
  groupBy: string[];
  availableColumns: string[];
  onChange: (groupBy: string[]) => void;
}

const GroupByBuilder: React.FC<GroupByBuilderProps> = ({
  groupBy,
  availableColumns,
  onChange
}) => {
  const addColumn = () => {
    const availableToAdd = availableColumns.filter(col => !groupBy.includes(col));
    if (availableToAdd.length > 0) {
      onChange([...groupBy, availableToAdd[0]]);
    }
  };

  const removeColumn = (index: number) => {
    onChange(groupBy.filter((_, i) => i !== index));
  };

  const updateColumn = (index: number, value: string) => {
    const updated = [...groupBy];
    updated[index] = value;
    onChange(updated);
  };

  return (
    <div className="groupby-builder">
      <div className="groupby-builder-header">
        <h4>📊 Summarize By</h4>
        <button
          type="button"
          onClick={addColumn}
          className="add-groupby-btn"
          disabled={availableColumns.length === 0 || availableColumns.filter(col => !groupBy.includes(col)).length === 0}
        >
          ➕ Add Group
        </button>
      </div>

      {groupBy.length === 0 ? (
        <div className="groupby-builder-empty">
          <div className="empty-icon">📊</div>
          <h4>No grouping</h4>
          <p>Group your data to see totals, counts, or averages for each category</p>
        </div>
      ) : (
        <>
          <div className="groupby-info">
            <span className="info-icon">💡</span>
            <p>Records will be combined based on these fields. Use with SUM, COUNT, or AVG in your formula fields.</p>
          </div>
          <div className="groupby-list">
            {groupBy.map((column, index) => (
              <div key={index} className="groupby-item">
                <span className="group-number">{index + 1}</span>
                <select
                  className="groupby-select"
                  value={column}
                  onChange={(e) => updateColumn(index, e.target.value)}
                >
                  {availableColumns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeColumn(index)}
                  className="remove-groupby-btn"
                  title="Remove from grouping"
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

export default GroupByBuilder;
