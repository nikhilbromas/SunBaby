import React, { useState } from 'react';
import type { CalculatedColumn } from '../../services/types';
import { SQL_FUNCTION_CATEGORIES, getFunctionsByCategory } from '../../utils/sqlFunctions';
import './ExpressionBuilder.css';

interface ExpressionBuilderProps {
  availableColumns: string[];
  onAdd: (column: CalculatedColumn) => void;
  onCancel: () => void;
}

// User-friendly category labels
const CATEGORY_LABELS: Record<string, string> = {
  'Aggregate': 'Totals & Counts',
  'String': 'Text Functions',
  'Date': 'Date & Time',
  'Math': 'Math & Numbers',
  'Conversion': 'Convert Data',
  'Logic': 'Logic & Conditions',
  'Other': 'Other Functions'
};

const ExpressionBuilder: React.FC<ExpressionBuilderProps> = ({
  availableColumns,
  onAdd,
  onCancel
}) => {
  const [alias, setAlias] = useState('');
  const [expressionText, setExpressionText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(SQL_FUNCTION_CATEGORIES[0]);

  const handleInsertColumn = (column: string) => {
    setExpressionText(prev => prev + column);
  };

  const handleInsertOperator = (operator: string) => {
    setExpressionText(prev => prev + ` ${operator} `);
  };

  const handleInsertFunction = (funcName: string) => {
    setExpressionText(prev => prev + `${funcName}()`);
  };

  const handleAdd = () => {
    if (!alias.trim() || !expressionText.trim()) return;

    const calculatedColumn: CalculatedColumn = {
      type: 'calculated',
      alias: alias.trim(),
      expression: {
        type: 'literal',
        value: expressionText.trim()
      }
    };

    onAdd(calculatedColumn);
  };

  const functionsInCategory = getFunctionsByCategory(selectedCategory);

  return (
    <div className="expression-builder">
      <div className="expression-header">
        <h3>➕ Add Formula Field</h3>
        <p>Create a calculated field using math, functions, or other fields</p>
      </div>

      <div className="expression-form">
        <div className="form-group">
          <label>
            <span className="label-text">Display Name</span>
            <span className="required">*</span>
          </label>
          <input
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="e.g., Total Amount, Full Name, Tax Percentage"
            className="name-input"
          />
          <span className="hint">This name will appear as the column header</span>
        </div>

        <div className="form-group">
          <label>
            <span className="label-text">Formula</span>
            <span className="required">*</span>
          </label>
          <textarea
            value={expressionText}
            onChange={(e) => setExpressionText(e.target.value)}
            placeholder="Click fields and functions below, or type your formula directly...

Examples:
• Price * Quantity
• FirstName + ' ' + LastName  
• ISNULL(Discount, 0)
• ROUND(Amount * 0.18, 2)"
            rows={5}
            className="formula-textarea"
          />
        </div>

        <div className="expression-helpers">
          <div className="helper-section">
            <h4>📋 Available Fields</h4>
            <div className="helper-buttons fields-grid">
              {availableColumns.slice(0, 12).map(col => (
                <button
                  key={col}
                  type="button"
                  className="helper-btn field-btn"
                  onClick={() => handleInsertColumn(col)}
                  title={`Insert ${col}`}
                >
                  {col.length > 15 ? col.substring(0, 15) + '...' : col}
                </button>
              ))}
              {availableColumns.length > 12 && (
                <span className="more-indicator">
                  +{availableColumns.length - 12} more
                </span>
              )}
            </div>
          </div>

          <div className="helper-section">
            <h4>🔢 Math Operators</h4>
            <div className="helper-buttons operators-grid">
              <button type="button" className="helper-btn operator-btn" onClick={() => handleInsertOperator('+')}>
                <span className="op-symbol">+</span>
                <span className="op-label">Add</span>
              </button>
              <button type="button" className="helper-btn operator-btn" onClick={() => handleInsertOperator('-')}>
                <span className="op-symbol">−</span>
                <span className="op-label">Subtract</span>
              </button>
              <button type="button" className="helper-btn operator-btn" onClick={() => handleInsertOperator('*')}>
                <span className="op-symbol">×</span>
                <span className="op-label">Multiply</span>
              </button>
              <button type="button" className="helper-btn operator-btn" onClick={() => handleInsertOperator('/')}>
                <span className="op-symbol">÷</span>
                <span className="op-label">Divide</span>
              </button>
              <button type="button" className="helper-btn operator-btn" onClick={() => handleInsertOperator('(')}>
                <span className="op-symbol">(</span>
                <span className="op-label">Open</span>
              </button>
              <button type="button" className="helper-btn operator-btn" onClick={() => handleInsertOperator(')')}>
                <span className="op-symbol">)</span>
                <span className="op-label">Close</span>
              </button>
            </div>
          </div>

          <div className="helper-section functions-section">
            <h4>⚡ Functions</h4>
            <select
              className="category-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {SQL_FUNCTION_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat] || cat}
                </option>
              ))}
            </select>
            <div className="helper-buttons functions-grid">
              {functionsInCategory.map(func => (
                <button
                  key={func.name}
                  type="button"
                  className="helper-btn function-btn"
                  onClick={() => handleInsertFunction(func.name)}
                  title={func.description}
                >
                  <span className="func-name">{func.name}</span>
                  {func.description && (
                    <span className="func-hint">{func.description.substring(0, 40)}...</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="expression-actions">
        <button type="button" onClick={onCancel} className="cancel-btn">
          ← Back
        </button>
        <button
          type="button"
          onClick={handleAdd}
          className="add-btn primary"
          disabled={!alias.trim() || !expressionText.trim()}
        >
          ✓ Add Formula Field
        </button>
      </div>
    </div>
  );
};

export default ExpressionBuilder;
