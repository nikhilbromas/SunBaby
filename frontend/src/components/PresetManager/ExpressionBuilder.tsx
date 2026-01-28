import React, { useState, useRef } from 'react';
import type { CalculatedColumn } from '../../services/types';
import { SQL_FUNCTION_CATEGORIES, getFunctionsByCategory, getFunctionByName } from '../../utils/sqlFunctions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ExpressionBuilderProps {
  availableColumns: string[];
  onAdd: (column: CalculatedColumn) => void;
  onCancel: () => void;
  initialValue?: CalculatedColumn;
  onUpdate?: (column: CalculatedColumn) => void;
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
  onCancel,
  initialValue,
  onUpdate
}) => {
  // Helper to extract expression text from expression node
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

  const [alias, setAlias] = useState(initialValue?.alias || '');
  const [expressionText, setExpressionText] = useState(
    initialValue ? getExpressionText(initialValue.expression) : ''
  );
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

    if (onUpdate && initialValue) {
      onUpdate(calculatedColumn);
    } else {
      onAdd(calculatedColumn);
    }
  };

  const functionsInCategory = getFunctionsByCategory(selectedCategory);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
      <div className="bg-black rounded-lg shadow-md border border-neutral-800 mb-6 p-6">
  <div className="flex items-center gap-3 mb-2">
    <div className="flex-shrink-0 w-10 h-10 bg-white rounded-lg flex items-center justify-center">
      <svg
        className="w-6 h-6 text-black"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
        />
      </svg>
    </div>

    <div>
      <h3 className="text-xl font-bold text-white">
        {initialValue ? 'Edit Formula Field' : 'Add Formula Field'}
      </h3>
      <p className="text-sm text-neutral-400">
        {initialValue
          ? 'Update your calculated field'
          : 'Create a calculated field using math, functions, or other fields'}
      </p>
    </div>
  </div>
</div>


        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="e.g., Total Amount, Full Name, Tax Percentage"
                  className="w-full"
                />
                <p className="text-xs text-slate-500 mt-1.5">This name will appear as the column header</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Formula <span className="text-red-500">*</span>
                </label>
                <textarea
                  ref={textareaRef}
                  value={expressionText}
                  onChange={(e) => setExpressionText(e.target.value)}
                  placeholder={`Click fields and functions below, or type your formula directly...

Examples:
                       • Price * Quantity
                   • FirstName + ' ' + LastName  
                   • ISNULL(Discount, 0)
                  • CAST(Amount AS DECIMAL(18,2))
                 • ROUND(Amount * 0.18, 2)`}
                  rows={6}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-y bg-black text-white              "
                />
                <div className="mt-2 flex items-start gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2">
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Tip: Use |placeholder| markers to see where to fill in values</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h4 className="text-base font-semibold text-slate-900">Quick Templates</h4>
            </div>
            <p className="text-sm text-slate-600 mb-4">Click a template to insert a common formula pattern</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {FORMULA_TEMPLATES.map((tmpl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleInsertTemplate(tmpl.template)}
                  title={tmpl.description}
                  className="text-left p-3 border border-slate-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  <div className="font-medium text-sm text-slate-900 mb-1">{tmpl.name}</div>
                  <div className="text-xs text-slate-500">{tmpl.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <h4 className="text-base font-semibold text-slate-900">Available Fields</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableColumns.slice(0, 12).map(col => (
                <button
                  key={col}
                  type="button"
                  onClick={() => handleInsertColumn(col)}
                  title={`Insert ${col}`}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-md text-sm font-mono transition-colors"
                >
                  {col.length > 15 ? col.substring(0, 15) + '...' : col}
                </button>
              ))}
              {availableColumns.length > 12 && (
                <span className="px-3 py-1.5 text-sm text-slate-500 italic">
                  +{availableColumns.length - 12} more
                </span>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <h4 className="text-base font-semibold text-slate-900">Math Operators</h4>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              <button type="button" onClick={() => handleInsertOperator('+')} className="p-3 border border-slate-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-center">
                <div className="text-2xl font-bold text-slate-700">+</div>
                <div className="text-xs text-slate-500 mt-1">Add</div>
              </button>
              <button type="button" onClick={() => handleInsertOperator('-')} className="p-3 border border-slate-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-center">
                <div className="text-2xl font-bold text-slate-700">−</div>
                <div className="text-xs text-slate-500 mt-1">Subtract</div>
              </button>
              <button type="button" onClick={() => handleInsertOperator('*')} className="p-3 border border-slate-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-center">
                <div className="text-2xl font-bold text-slate-700">×</div>
                <div className="text-xs text-slate-500 mt-1">Multiply</div>
              </button>
              <button type="button" onClick={() => handleInsertOperator('/')} className="p-3 border border-slate-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-center">
                <div className="text-2xl font-bold text-slate-700">÷</div>
                <div className="text-xs text-slate-500 mt-1">Divide</div>
              </button>
              <button type="button" onClick={() => handleInsertOperator('(')} className="p-3 border border-slate-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-center">
                <div className="text-2xl font-bold text-slate-700">(</div>
                <div className="text-xs text-slate-500 mt-1">Open</div>
              </button>
              <button type="button" onClick={() => handleInsertOperator(')')} className="p-3 border border-slate-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-center">
                <div className="text-2xl font-bold text-slate-700">)</div>
                <div className="text-xs text-slate-500 mt-1">Close</div>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h4 className="text-base font-semibold text-slate-900">Functions</h4>
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
            >
              {SQL_FUNCTION_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat] || cat}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {functionsInCategory.map(func => (
                <button
                  key={func.name}
                  type="button"
                  onClick={() => handleInsertFunction(func.name)}
                  title={`${func.signature}\n${func.description || ''}`}
                  className="text-left p-3 border border-slate-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  <div className="font-mono font-semibold text-sm text-slate-900 mb-1">{func.name}</div>
                  {func.description && (
                    <div className="text-xs text-slate-500 line-clamp-2">{func.description}</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {selectedCategory === 'Conversion' && (
            <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <h4 className="text-base font-semibold text-slate-900">Common Data Types</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                {COMMON_DATA_TYPES.map(dt => (
                  <button
                    key={dt.value}
                    type="button"
                    onClick={() => handleInsertDataType(dt.value)}
                    title={`Insert ${dt.value}`}
                    className="text-left p-3 border border-slate-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                  >
                    <div className="font-mono text-xs font-semibold text-slate-900 mb-1">{dt.value}</div>
                    <div className="text-xs text-slate-500">{dt.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="sticky bottom-0 bg-white border-t border-slate-200 shadow-lg rounded-t-lg p-4">
            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <Button
                type="button"
                onClick={onCancel}
                variant="outline"
                className="border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back
              </Button>
              <Button
                type="button"
                onClick={handleAdd}
                disabled={!alias.trim() || !expressionText.trim()}
                className="bg-blue-600 text-white hover:bg-blue-700 font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {initialValue ? 'Update Formula' : 'Add Formula Field'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpressionBuilder;
