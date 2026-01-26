import React, { useState, useRef } from 'react';
import type { CalculatedColumn } from '../../services/types';
import { SQL_FUNCTION_CATEGORIES, getFunctionsByCategory, getFunctionByName } from '../../utils/sqlFunctions';
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Common data types for quick selection
  const COMMON_DATA_TYPES = [
    { value: 'DECIMAL(18,2)', label: 'Money (2 decimals)' },
    { value: 'DECIMAL(18,4)', label: 'High Precision (4 decimals)' },
    { value: 'INT', label: 'Whole Number' },
    { value: 'VARCHAR(255)', label: 'Text' },
    { value: 'DATE', label: 'Date Only' },
    { value: 'DATETIME', label: 'Date & Time' },
    { value: 'FLOAT', label: 'Decimal Number' },
    { value: 'BIT', label: 'Yes/No' }
  ];

  const handleInsertColumn = (column: string) => {
    setExpressionText(prev => prev + column);
    // Focus textarea after insertion
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleInsertOperator = (operator: string) => {
    setExpressionText(prev => prev + ` ${operator} `);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  // Smart function insertion with parameter placeholders
  const handleInsertFunction = (funcName: string) => {
    const func = getFunctionByName(funcName);
    if (!func) {
      // Fallback to simple insertion
      setExpressionText(prev => prev + `${funcName}()`);
      return;
    }

    let insertion = '';
    
    // Special handling for common functions
    if (funcName === 'CAST' || funcName === 'TRY_CAST') {
      insertion = `${funcName}(|expression| AS |datatype|)`;
    } else if (funcName === 'CONVERT' || funcName === 'TRY_CONVERT') {
      insertion = `${funcName}(|datatype|, |expression|)`;
    } else if (funcName === 'ISNULL') {
      insertion = `${funcName}(|value|, |default|)`;
    } else if (funcName === 'COALESCE') {
      insertion = `${funcName}(|value1|, |value2|)`;
    } else if (func.parameters.length === 0) {
      insertion = `${funcName}()`;
    } else {
      // Build insertion with placeholders based on parameters
      const params = func.parameters
        .filter(p => p.required)
        .map((p, idx) => `|${p.name}${idx > 0 ? idx + 1 : ''}|`)
        .join(', ');
      const optionalParams = func.parameters
        .filter(p => !p.required)
        .map((p, idx) => `|${p.name}${idx > 0 ? idx + 1 : ''}|`)
        .join(', ');
      
      if (optionalParams) {
        insertion = `${funcName}(${params}, ${optionalParams})`;
      } else {
        insertion = `${funcName}(${params})`;
      }
    }

    setExpressionText(prev => prev + insertion);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  // Insert data type into CAST template
  const handleInsertDataType = (dataType: string) => {
    const text = expressionText;
    const lastCastIndex = text.lastIndexOf('CAST(');
    const lastTryCastIndex = text.lastIndexOf('TRY_CAST(');
    const lastIndex = Math.max(lastCastIndex, lastTryCastIndex);
    
    if (lastIndex >= 0) {
      // Find the datatype placeholder
      const afterCast = text.substring(lastIndex);
      const datatypePlaceholder = afterCast.indexOf('|datatype|');
      
      if (datatypePlaceholder >= 0) {
        const start = lastIndex + datatypePlaceholder;
        const end = start + '|datatype|'.length;
        const newText = text.substring(0, start) + dataType + text.substring(end);
        setExpressionText(newText);
      } else {
        // No placeholder found, just append
        setExpressionText(prev => prev + dataType);
      }
    } else {
      // No CAST found, insert CAST template with data type
      setExpressionText(prev => prev + `CAST(|expression| AS ${dataType})`);
    }
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  // Formula templates for common patterns
  const FORMULA_TEMPLATES = [
    {
      name: 'Convert to Money',
      description: 'Convert a field to decimal with 2 decimals',
      template: 'CAST(|field| AS DECIMAL(18,2))'
    },
    {
      name: 'Handle NULL',
      description: 'Replace NULL with 0',
      template: 'ISNULL(|field|, 0)'
    },
    {
      name: 'Calculate Total',
      description: 'Multiply quantity by rate',
      template: 'CAST(|qty| * |rate| AS DECIMAL(18,2))'
    },
    {
      name: 'Calculate with Discount',
      description: 'Total minus discount',
      template: 'CAST((|qty| * |rate|) - |discount| AS DECIMAL(18,2))'
    },
    {
      name: 'Calculate Net Amount',
      description: 'Total minus discount plus tax',
      template: 'CAST((|qty| * |rate|) - |discount| + |tax| AS DECIMAL(18,2))'
    },
    {
      name: 'Round to 2 Decimals',
      description: 'Round a number to 2 decimal places',
      template: 'ROUND(|field|, 2)'
    }
  ];

  const handleInsertTemplate = (template: string) => {
    setExpressionText(prev => {
      // If there's existing text, add newline and template
      if (prev.trim()) {
        return prev + '\n' + template;
      }
      return template;
    });
    setTimeout(() => textareaRef.current?.focus(), 0);
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
            ref={textareaRef}
            value={expressionText}
            onChange={(e) => setExpressionText(e.target.value)}
            placeholder="Click fields and functions below, or type your formula directly...

Examples:
• Price * Quantity
• FirstName + ' ' + LastName  
• ISNULL(Discount, 0)
• CAST(Amount AS DECIMAL(18,2))
• ROUND(Amount * 0.18, 2)"
            rows={6}
            className="formula-textarea"
          />
          <div className="formula-hints">
            <span className="hint-text">💡 Tip: Use |placeholder| markers to see where to fill in values</span>
          </div>
        </div>

        {/* Formula Templates Section */}
        <div className="helper-section templates-section">
          <h4>📝 Quick Templates</h4>
          <p className="section-description">Click a template to insert a common formula pattern</p>
          <div className="templates-grid">
            {FORMULA_TEMPLATES.map((tmpl, idx) => (
              <button
                key={idx}
                type="button"
                className="template-btn"
                onClick={() => handleInsertTemplate(tmpl.template)}
                title={tmpl.description}
              >
                <span className="template-name">{tmpl.name}</span>
                <span className="template-desc">{tmpl.description}</span>
              </button>
            ))}
          </div>
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
                  title={`${func.signature}\n${func.description || ''}`}
                >
                  <span className="func-name">{func.name}</span>
                  {func.description && (
                    <span className="func-hint">{func.description.substring(0, 40)}...</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Data Type Selector - shown when Conversion category is selected */}
          {selectedCategory === 'Conversion' && (
            <div className="helper-section data-types-section">
              <h4>📊 Common Data Types</h4>
              <div className="helper-buttons data-types-grid">
                {COMMON_DATA_TYPES.map(dt => (
                  <button
                    key={dt.value}
                    type="button"
                    className="helper-btn datatype-btn"
                    onClick={() => handleInsertDataType(dt.value)}
                    title={`Insert ${dt.value}`}
                  >
                    <span className="datatype-value">{dt.value}</span>
                    <span className="datatype-label">{dt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
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
