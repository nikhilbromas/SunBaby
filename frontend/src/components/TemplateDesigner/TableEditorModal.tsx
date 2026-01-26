import React, { useState } from 'react';
import type { ItemsTableConfig, ContentDetailsTableConfig, TableColumnConfig, FinalRowConfig, FinalRowCellConfig } from '../../services/types';
import './TableEditorModal.css';

interface TableEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: ItemsTableConfig | ContentDetailsTableConfig;
  onSave: (table: ItemsTableConfig | ContentDetailsTableConfig) => void;
  tableType: 'itemsTable' | 'billContentTable' | 'contentDetailTable';
  tableLabel?: string;
  sampleData?: {
    header?: { data: Record<string, any> | null; fields: string[] };
    items?: { data: Record<string, any>[]; fields: string[]; sampleCount: number };
    contentDetails?: Record<string, { data: Record<string, any>[] | Record<string, any> | null; fields: string[]; sampleCount: number; dataType?: 'array' | 'object' }>;
  } | null;
}

const TableEditorModal: React.FC<TableEditorModalProps> = ({
  isOpen,
  onClose,
  table,
  onSave,
  tableType,
  tableLabel,
  sampleData,
}) => {
  const [editedTable, setEditedTable] = useState<ItemsTableConfig | ContentDetailsTableConfig>({ ...table });
  const [activeTab, setActiveTab] = useState<'general' | 'columns' | 'finalRows' | 'style'>('general');
  const [selectedColumns, setSelectedColumns] = useState<Set<number>>(new Set());
  const [expandedColumn, setExpandedColumn] = useState<number | null>(null);
  const [expandedCells, setExpandedCells] = useState<Record<string, boolean>>({});
  const [showBindingSuggestions, setShowBindingSuggestions] = useState<Record<number, boolean>>({});
  const [showFormulaBuilder, setShowFormulaBuilder] = useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (isOpen) {
      setEditedTable({ ...table });
      setSelectedColumns(new Set());
      setExpandedColumn(null);
      setExpandedCells({});
      setActiveTab('general');
    }
  }, [isOpen, table]);

  if (!isOpen) return null;

  const updateTable = (updates: Partial<ItemsTableConfig | ContentDetailsTableConfig>) => {
    setEditedTable((prev) => ({ ...prev, ...updates }));
  };

  const updateColumn = (index: number, updates: Partial<TableColumnConfig>) => {
    const newColumns = editedTable.columns.map((col, i) =>
      i === index ? { ...col, ...updates } : col
    );
    updateTable({ columns: newColumns });
  };

  const addColumn = () => {
    const newColumn: TableColumnConfig = {
      bind: '',
      label: 'New Column',
      visible: true,
    };
    updateTable({ columns: [...editedTable.columns, newColumn] });
  };

  const deleteColumn = (index: number) => {
    const newColumns = editedTable.columns.filter((_, i) => i !== index);
    updateTable({ columns: newColumns });
    setSelectedColumns(new Set());
  };

  const deleteSelectedColumns = () => {
    const newColumns = editedTable.columns.filter((_, i) => !selectedColumns.has(i));
    updateTable({ columns: newColumns });
    setSelectedColumns(new Set());
  };

  const toggleColumnSelection = (index: number) => {
    const newSelected = new Set(selectedColumns);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedColumns(newSelected);
  };

  const toggleAllColumns = () => {
    if (selectedColumns.size === editedTable.columns.length) {
      setSelectedColumns(new Set());
    } else {
      setSelectedColumns(new Set(editedTable.columns.map((_, i) => i)));
    }
  };

  const addFinalRow = () => {
    const visibleColumns = editedTable.columns.filter(col => col.visible !== false);
    const newRow: FinalRowConfig = {
      cells: visibleColumns.map(() => ({
        label: '',
        valueType: 'static',
        value: '',
        align: 'left',
        colSpan: 1,
      })),
      visible: true,
    };
    updateTable({ finalRows: [...(editedTable.finalRows || []), newRow] });
  };

  const updateFinalRow = (rowIndex: number, updates: Partial<FinalRowConfig>) => {
    const newRows = [...(editedTable.finalRows || [])];
    newRows[rowIndex] = { ...newRows[rowIndex], ...updates };
    updateTable({ finalRows: newRows });
  };

  const deleteFinalRow = (rowIndex: number) => {
    const newRows = (editedTable.finalRows || []).filter((_, i) => i !== rowIndex);
    updateTable({ finalRows: newRows.length > 0 ? newRows : undefined });
  };

  const updateFinalRowCell = (rowIndex: number, cellIndex: number, updates: Partial<FinalRowCellConfig>) => {
    const newRows = [...(editedTable.finalRows || [])];
    newRows[rowIndex].cells[cellIndex] = { ...newRows[rowIndex].cells[cellIndex], ...updates };
    updateTable({ finalRows: newRows });
  };

  const addCellToFinalRow = (rowIndex: number) => {
    const newRows = [...(editedTable.finalRows || [])];
    newRows[rowIndex].cells.push({
      label: '',
      valueType: 'static',
      value: '',
      align: 'left',
      colSpan: 1,
    });
    updateTable({ finalRows: newRows });
  };

  const deleteCellFromFinalRow = (rowIndex: number, cellIndex: number) => {
    const newRows = [...(editedTable.finalRows || [])];
    newRows[rowIndex].cells = newRows[rowIndex].cells.filter((_, i) => i !== cellIndex);
    if (newRows[rowIndex].cells.length === 0) {
      deleteFinalRow(rowIndex);
    } else {
      updateTable({ finalRows: newRows });
    }
  };

  const handleSave = () => {
    onSave(editedTable);
    onClose();
  };

  const handleCancel = () => {
    setEditedTable({ ...table });
    onClose();
  };

  // Get available binding options based on table type
  const getBindingOptions = (): Array<{ value: string; label: string; category: string }> => {
    const options: Array<{ value: string; label: string; category: string }> = [];
    
    if (tableType === 'itemsTable' || tableType === 'billContentTable') {
      // Items table bindings
      if (sampleData?.items?.fields) {
        sampleData.items.fields.forEach(field => {
          options.push({
            value: field,
            label: field,
            category: 'Items'
          });
        });
      }
      // Common item fields if no sample data
      if (options.length === 0) {
        ['ItemName', 'Qty', 'Amount', 'Rate', 'Price', 'Description', 'Unit', 'Total'].forEach(field => {
          options.push({ value: field, label: field, category: 'Items' });
        });
      }
    } else if (tableType === 'contentDetailTable' && 'contentName' in editedTable) {
      // Content detail bindings
      const contentName = editedTable.contentName;
      if (sampleData?.contentDetails?.[contentName]?.fields) {
        sampleData.contentDetails[contentName].fields.forEach(field => {
          const isObjectType = sampleData.contentDetails![contentName].dataType === 'object';
          const bindPath = isObjectType ? `contentDetails.${contentName}.${field}` : field;
          options.push({
            value: bindPath,
            label: field,
            category: `Content: ${contentName}`
          });
        });
      }
    }
    
    // Header fields (available for all tables)
    if (sampleData?.header?.fields) {
      sampleData.header.fields.forEach(field => {
        options.push({
          value: `header.${field}`,
          label: field,
          category: 'Header'
        });
      });
    }
    
    return options;
  };

  const bindingOptions = getBindingOptions();
  const groupedBindings = bindingOptions.reduce((acc, option) => {
    if (!acc[option.category]) {
      acc[option.category] = [];
    }
    acc[option.category].push(option);
    return acc;
  }, {} as Record<string, Array<{ value: string; label: string; category: string }>>);

  // Get available calculation sources (tables/arrays)
  const getCalculationSources = (): Array<{ value: string; label: string; description: string }> => {
    const sources: Array<{ value: string; label: string; description: string }> = [];
    
    // Items table
    if (sampleData?.items?.data && sampleData.items.data.length > 0) {
      sources.push({
        value: 'items',
        label: 'Items Table',
        description: `Contains ${sampleData.items.data.length} item(s)`
      });
    } else {
      sources.push({
        value: 'items',
        label: 'Items Table',
        description: 'Main items data'
      });
    }
    
    // Content details
    if (sampleData?.contentDetails) {
      Object.entries(sampleData.contentDetails).forEach(([name, detail]) => {
        if (detail.dataType === 'array' && Array.isArray(detail.data)) {
          sources.push({
            value: `contentDetails.${name}`,
            label: `Content: ${name}`,
            description: `Array with ${detail.data.length} item(s)`
          });
        }
      });
    }
    
    return sources;
  };

  // Get available fields from a calculation source
  const getFieldsFromSource = (source: string): Array<{ value: string; label: string }> => {
    const fields: Array<{ value: string; label: string }> = [];
    
    if (source === 'items' && sampleData?.items?.fields) {
      sampleData.items.fields.forEach(field => {
        fields.push({ value: field, label: field });
      });
    } else if (source.startsWith('contentDetails.')) {
      const contentName = source.replace('contentDetails.', '');
      if (sampleData?.contentDetails?.[contentName]?.fields) {
        sampleData.contentDetails[contentName].fields.forEach(field => {
          fields.push({ value: field, label: field });
        });
      }
    }
    
    // If no fields found, provide common defaults
    if (fields.length === 0) {
      ['Amount', 'Price', 'Rate', 'Qty', 'Total', 'Quantity', 'Cost'].forEach(field => {
        fields.push({ value: field, label: field });
      });
    }
    
    return fields;
  };

  // Get calculation description
  const getCalculationDescription = (type: string, source?: string, field?: string): string => {
    if (!type || type === 'none') return 'No calculation';
    
    const typeLabels: Record<string, string> = {
      sum: 'Sum',
      avg: 'Average',
      count: 'Count',
      min: 'Minimum',
      max: 'Maximum',
      custom: 'Custom Formula'
    };
    
    const typeLabel = typeLabels[type] || type;
    
    if (type === 'custom') {
      return 'Custom formula calculation';
    }
    
    if (source && field) {
      return `${typeLabel} of ${field} from ${source}`;
    }
    
    return `${typeLabel} calculation`;
  };

  const calculationSources = getCalculationSources();

  // Formula Builder Component with improved collapse functionality
  const FormulaBuilder: React.FC<{
    formula: string;
    onFormulaChange: (formula: string) => void;
    id: string;
  }> = ({ formula, onFormulaChange, id }) => {
    const [currentFunction, setCurrentFunction] = useState<string>('');
    const [currentSource, setCurrentSource] = useState<string>('');
    const [currentField, setCurrentField] = useState<string>('');
    const [currentNumber, setCurrentNumber] = useState<string>('');
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
      functions: false,
      operators: false,
      numbers: false,
      examples: false
    });

    const toggleSection = (section: string) => {
      setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const addFunction = () => {
      if (currentFunction && currentSource && currentField) {
        const funcFormula = `${currentFunction}(${currentSource}.${currentField})`;
        onFormulaChange(formula ? `${formula} + ${funcFormula}` : funcFormula);
        setCurrentFunction('');
        setCurrentSource('');
        setCurrentField('');
      } else if (currentFunction && currentSource) {
        // For count, field is optional
        const funcFormula = `${currentFunction}(${currentSource})`;
        onFormulaChange(formula ? `${formula} + ${funcFormula}` : funcFormula);
        setCurrentFunction('');
        setCurrentSource('');
      }
    };

    const addOperator = (op: string) => {
      onFormulaChange(formula ? `${formula} ${op} ` : `${op} `);
    };

    const addNumber = () => {
      if (currentNumber) {
        onFormulaChange(formula ? `${formula} ${currentNumber}` : currentNumber);
        setCurrentNumber('');
      }
    };

    const addParenthesis = (open: boolean) => {
      onFormulaChange(formula ? `${formula}${open ? '(' : ')'}` : (open ? '(' : ')'));
    };

    const clearFormula = () => {
      onFormulaChange('');
    };

    const removeLast = () => {
      if (formula) {
        const newFormula = formula.trim().slice(0, -1).trim();
        onFormulaChange(newFormula);
      }
    };

    const isExpanded = showFormulaBuilder[id];

    return (
      <div className="formula-builder" style={{
        marginTop: '1rem',
        padding: isExpanded ? '1.25rem' : '0.75rem',
        background: 'linear-gradient(135deg, rgba(11, 99, 255, 0.08) 0%, rgba(30, 136, 229, 0.04) 100%)',
        border: '2px solid rgba(11, 99, 255, 0.2)',
        borderRadius: '8px',
        transition: 'all 0.3s ease'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isExpanded ? '1rem' : '0' }}>
          <h5 style={{ margin: 0, color: '#0B63FF', fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🧮</span>
            <span>Visual Formula Builder</span>
            {formula && (
              <span style={{ 
                fontSize: '0.75rem', 
                fontWeight: 400, 
                color: '#6c757d',
                fontFamily: 'monospace',
                marginLeft: '0.5rem'
              }}>
                ({formula.length} chars)
              </span>
            )}
          </h5>
          <button
            type="button"
            onClick={() => setShowFormulaBuilder({ ...showFormulaBuilder, [id]: !showFormulaBuilder[id] })}
            style={{
              background: isExpanded ? 'rgba(11, 99, 255, 0.15)' : 'rgba(11, 99, 255, 0.1)',
              border: '1px solid rgba(11, 99, 255, 0.3)',
              borderRadius: '4px',
              padding: '0.4rem 0.9rem',
              cursor: 'pointer',
              fontSize: '0.85rem',
              color: '#0B63FF',
              fontWeight: 600,
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(11, 99, 255, 0.2)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isExpanded ? 'rgba(11, 99, 255, 0.15)' : 'rgba(11, 99, 255, 0.1)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <span>{isExpanded ? '▼' : '▶'}</span>
            <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
          </button>
        </div>

        {isExpanded && (
          <div className="formula-builder-content">
            {/* Formula Preview */}
            <div style={{
              marginBottom: '1rem',
              padding: '0.75rem',
              background: '#ffffff',
              border: '2px solid rgba(11, 99, 255, 0.2)',
              borderRadius: '6px',
              minHeight: '40px',
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
              {formula ? (
                <code style={{ 
                  fontSize: '0.9rem', 
                  color: '#0B63FF',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all'
                }}>
                  {formula}
                </code>
              ) : (
                <span style={{ color: '#6c757d', fontStyle: 'italic' }}>Formula will appear here...</span>
              )}
            </div>

            {/* Function Builder - Collapsible */}
            <div style={{ marginBottom: '1rem', border: '1px solid rgba(11, 99, 255, 0.15)', borderRadius: '6px', overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => toggleSection('functions')}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: collapsedSections.functions ? 'rgba(11, 99, 255, 0.05)' : 'rgba(11, 99, 255, 0.1)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: '#2c3e50',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>📊</span>
                  <span>Add Calculation Function</span>
                </span>
                <span style={{ fontSize: '0.75rem', color: '#6c757d' }}>
                  {collapsedSections.functions ? '▶' : '▼'}
                </span>
              </button>
              {!collapsedSections.functions && (
                <div style={{ padding: '1rem', background: 'white' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#2c3e50' }}>
                Select function, source, and field:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <select
                  value={currentFunction}
                  onChange={(e) => setCurrentFunction(e.target.value)}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid rgba(11, 99, 255, 0.2)',
                    borderRadius: '4px',
                    fontSize: '0.9rem'
                  }}
                >
                  <option value="">Select function...</option>
                  <option value="sum">➕ Sum</option>
                  <option value="avg">📊 Average</option>
                  <option value="count">🔢 Count</option>
                  <option value="min">📉 Min</option>
                  <option value="max">📈 Max</option>
                </select>
                <select
                  value={currentSource}
                  onChange={(e) => {
                    setCurrentSource(e.target.value);
                    setCurrentField('');
                  }}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid rgba(11, 99, 255, 0.2)',
                    borderRadius: '4px',
                    fontSize: '0.9rem'
                  }}
                >
                  <option value="">Select source...</option>
                  {calculationSources.map(source => (
                    <option key={source.value} value={source.value}>
                      {source.label}
                    </option>
                  ))}
                </select>
                {currentFunction !== 'count' && (
                  <select
                    value={currentField}
                    onChange={(e) => setCurrentField(e.target.value)}
                    disabled={!currentSource}
                    style={{
                      padding: '0.5rem',
                      border: '1px solid rgba(11, 99, 255, 0.2)',
                      borderRadius: '4px',
                      fontSize: '0.9rem',
                      opacity: currentSource ? 1 : 0.5
                    }}
                  >
                    <option value="">Select field...</option>
                    {currentSource && getFieldsFromSource(currentSource).map(field => (
                      <option key={field.value} value={field.value}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                )}
                {currentFunction === 'count' && <div></div>}
                <button
                  type="button"
                  onClick={addFunction}
                  disabled={!currentFunction || !currentSource || (currentFunction !== 'count' && !currentField)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: (currentFunction && currentSource && (currentFunction === 'count' || currentField))
                      ? 'linear-gradient(135deg, #0B63FF 0%, #1E88E5 100%)'
                      : '#e9ecef',
                    color: (currentFunction && currentSource && (currentFunction === 'count' || currentField))
                      ? 'white'
                      : '#6c757d',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: (currentFunction && currentSource && (currentFunction === 'count' || currentField))
                      ? 'pointer'
                      : 'not-allowed',
                    fontSize: '0.85rem',
                    fontWeight: 600
                  }}
                >
                  Add
                </button>
              </div>
                </div>
              )}
            </div>

            {/* Operators - Collapsible */}
            <div style={{ marginBottom: '1rem', border: '1px solid rgba(11, 99, 255, 0.15)', borderRadius: '6px', overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => toggleSection('operators')}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: collapsedSections.operators ? 'rgba(11, 99, 255, 0.05)' : 'rgba(11, 99, 255, 0.1)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: '#2c3e50',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>➕</span>
                  <span>Add Operator</span>
                </span>
                <span style={{ fontSize: '0.75rem', color: '#6c757d' }}>
                  {collapsedSections.operators ? '▶' : '▼'}
                </span>
              </button>
              {!collapsedSections.operators && (
                <div style={{ padding: '1rem', background: 'white' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#2c3e50' }}>
                Click an operator to add it:
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {['+', '-', '*', '/'].map(op => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => addOperator(op)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: 'white',
                      border: '2px solid rgba(11, 99, 255, 0.3)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '1.2rem',
                      fontWeight: 'bold',
                      color: '#0B63FF',
                      minWidth: '50px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(11, 99, 255, 0.1)';
                      e.currentTarget.style.transform = 'scale(1.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'white';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    {op}
                  </button>
                ))}
              </div>
                </div>
              )}
            </div>

            {/* Number Input - Collapsible */}
            <div style={{ marginBottom: '1rem', border: '1px solid rgba(11, 99, 255, 0.15)', borderRadius: '6px', overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => toggleSection('numbers')}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: collapsedSections.numbers ? 'rgba(11, 99, 255, 0.05)' : 'rgba(11, 99, 255, 0.1)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: '#2c3e50',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🔢</span>
                  <span>Add Number</span>
                </span>
                <span style={{ fontSize: '0.75rem', color: '#6c757d' }}>
                  {collapsedSections.numbers ? '▶' : '▼'}
                </span>
              </button>
              {!collapsedSections.numbers && (
                <div style={{ padding: '1rem', background: 'white' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#2c3e50' }}>
                Enter a number to add:
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="number"
                  value={currentNumber}
                  onChange={(e) => setCurrentNumber(e.target.value)}
                  placeholder="Enter number..."
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    border: '1px solid rgba(11, 99, 255, 0.2)',
                    borderRadius: '4px',
                    fontSize: '0.9rem'
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addNumber();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={addNumber}
                  disabled={!currentNumber}
                  style={{
                    padding: '0.5rem 1rem',
                    background: currentNumber
                      ? 'linear-gradient(135deg, #0B63FF 0%, #1E88E5 100%)'
                      : '#e9ecef',
                    color: currentNumber ? 'white' : '#6c757d',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: currentNumber ? 'pointer' : 'not-allowed',
                    fontSize: '0.85rem',
                    fontWeight: 600
                  }}
                >
                  Add
                </button>
              </div>
                </div>
              )}
            </div>

            {/* Parentheses - Always visible, compact */}
            <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#2c3e50', marginRight: '0.5rem' }}>
                📐 Grouping:
              </label>
              <button
                type="button"
                onClick={() => addParenthesis(true)}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'white',
                  border: '2px solid rgba(11, 99, 255, 0.3)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  color: '#0B63FF',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(11, 99, 255, 0.1)';
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                (
              </button>
              <button
                type="button"
                onClick={() => addParenthesis(false)}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'white',
                  border: '2px solid rgba(11, 99, 255, 0.3)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  color: '#0B63FF',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(11, 99, 255, 0.1)';
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                )
              </button>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(11, 99, 255, 0.2)' }}>
              <button
                type="button"
                onClick={clearFormula}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#ff6b6b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}
              >
                🗑️ Clear All
              </button>
              <button
                type="button"
                onClick={removeLast}
                disabled={!formula}
                style={{
                  padding: '0.5rem 1rem',
                  background: formula ? '#ffa500' : '#e9ecef',
                  color: formula ? 'white' : '#6c757d',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: formula ? 'pointer' : 'not-allowed',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}
              >
                ⌫ Remove Last
              </button>
            </div>

            {/* Quick Examples - Collapsible */}
            <div style={{
              marginTop: '1rem',
              border: '1px solid rgba(11, 99, 255, 0.15)',
              borderRadius: '6px',
              overflow: 'hidden'
            }}>
              <button
                type="button"
                onClick={() => toggleSection('examples')}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: collapsedSections.examples ? 'rgba(11, 99, 255, 0.05)' : 'rgba(11, 99, 255, 0.1)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: '#2c3e50',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>💡</span>
                  <span>Quick Examples</span>
                </span>
                <span style={{ fontSize: '0.75rem', color: '#6c757d' }}>
                  {collapsedSections.examples ? '▶' : '▼'}
                </span>
              </button>
              {!collapsedSections.examples && (
                <div style={{ padding: '1rem', background: '#f8f9fa', fontSize: '0.85rem', color: '#6c757d' }}>
              <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#2c3e50' }}>Click to use these examples:</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <button
                  type="button"
                  onClick={() => onFormulaChange('sum(items.Amount)')}
                  style={{
                    textAlign: 'left',
                    padding: '0.5rem',
                    background: 'white',
                    border: '1px solid rgba(11, 99, 255, 0.2)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    color: '#0B63FF'
                  }}
                >
                  Sum of all amounts: <code>sum(items.Amount)</code>
                </button>
                <button
                  type="button"
                  onClick={() => onFormulaChange('avg(items.Price) * 1.1')}
                  style={{
                    textAlign: 'left',
                    padding: '0.5rem',
                    background: 'white',
                    border: '1px solid rgba(11, 99, 255, 0.2)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    color: '#0B63FF'
                  }}
                >
                  Average with 10% markup: <code>avg(items.Price) * 1.1</code>
                </button>
                <button
                  type="button"
                  onClick={() => onFormulaChange('count(items) * header.unitPrice')}
                  style={{
                    textAlign: 'left',
                    padding: '0.5rem',
                    background: 'white',
                    border: '1px solid rgba(11, 99, 255, 0.2)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    color: '#0B63FF'
                  }}
                >
                  Count times unit price: <code>count(items) * header.unitPrice</code>
                </button>
              </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="table-editor-modal-backdrop" onClick={handleCancel} />
      <div className="table-editor-modal">
        <div className="table-editor-modal-header">
          <h2>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.75rem' }}>📊</span>
              {tableLabel || (tableType === 'contentDetailTable' && 'contentName' in editedTable 
                ? `Edit Table: ${editedTable.contentName}` 
                : 'Edit Table')}
            </span>
          </h2>
          <button className="table-editor-modal-close" onClick={handleCancel}>
            ×
          </button>
        </div>

        <div className="table-editor-modal-tabs">
          <button
            className={`tab-button ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            📋 General
          </button>
          <button
            className={`tab-button ${activeTab === 'columns' ? 'active' : ''}`}
            onClick={() => setActiveTab('columns')}
          >
            📊 Columns ({editedTable.columns.length})
          </button>
          <button
            className={`tab-button ${activeTab === 'finalRows' ? 'active' : ''}`}
            onClick={() => setActiveTab('finalRows')}
          >
            ➕ Final Rows ({(editedTable.finalRows || []).length})
          </button>
          <button
            className={`tab-button ${activeTab === 'style' ? 'active' : ''}`}
            onClick={() => setActiveTab('style')}
          >
            🎨 Style
          </button>
        </div>

        <div className="table-editor-modal-content">
          {activeTab === 'general' && (
            <div className="tab-content">
              <div className="form-section">
                <h3>Layout</h3>
                <div className="form-group">
                  <label>
                    Orientation:
                    <select
                      value={editedTable.orientation || 'vertical'}
                      onChange={(e) => updateTable({ orientation: e.target.value as 'vertical' | 'horizontal' })}
                    >
                      <option value="vertical">Vertical (Normal)</option>
                      <option value="horizontal">Horizontal (Transposed)</option>
                    </select>
                  </label>
                </div>
                <div className="form-group">
                  <label>
                    Position X:
                    <input
                      type="number"
                      value={editedTable.x || 0}
                      onChange={(e) => updateTable({ x: parseFloat(e.target.value) || 0 })}
                    />
                  </label>
                </div>
                <div className="form-group">
                  <label>
                    Position Y:
                    <input
                      type="number"
                      value={editedTable.y || 0}
                      onChange={(e) => updateTable({ y: parseFloat(e.target.value) || 0 })}
                    />
                  </label>
                </div>
                {tableType === 'contentDetailTable' && (
                  <div className="form-group">
                    <label>
                      Rows Per Page:
                      <input
                        type="number"
                        value={(editedTable as ContentDetailsTableConfig).rowsPerPage || ''}
                        min="1"
                        onChange={(e) => updateTable({ 
                          rowsPerPage: e.target.value ? parseInt(e.target.value) : undefined 
                        } as ContentDetailsTableConfig)}
                        placeholder="Auto"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'columns' && (
            <div className="tab-content">
              <div className="columns-header">
                <div className="columns-actions">
                  <button className="action-btn primary" onClick={addColumn}>
                    + Add Column
                  </button>
                  <button className="action-btn" onClick={toggleAllColumns}>
                    {selectedColumns.size === editedTable.columns.length ? 'Deselect All' : 'Select All'}
                  </button>
                  {selectedColumns.size > 0 && (
                    <button className="action-btn danger" onClick={deleteSelectedColumns}>
                      Delete Selected ({selectedColumns.size})
                    </button>
                  )}
                </div>
              </div>

              <div className="columns-list">
                {editedTable.columns.map((col, index) => (
                  <div
                    key={index}
                    className={`column-card ${selectedColumns.has(index) ? 'selected' : ''} ${expandedColumn === index ? 'expanded' : ''}`}
                  >
                    <div className="column-card-header">
                      <label className="column-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedColumns.has(index)}
                          onChange={() => toggleColumnSelection(index)}
                        />
                        <span className="column-number">Column #{index + 1}</span>
                      </label>
                      <div className="column-card-actions">
                        <button
                          className="expand-btn"
                          onClick={() => setExpandedColumn(expandedColumn === index ? null : index)}
                        >
                          {expandedColumn === index ? '▼' : '▶'}
                        </button>
                        <button className="delete-btn" onClick={() => deleteColumn(index)}>
                          ×
                        </button>
                      </div>
                    </div>

                    {expandedColumn === index && (
                      <div className="column-card-content">
                        <div className="form-row">
                          <div className="form-group">
                            <label>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>🏷️</span> Column Label
                              </span>
                              <input
                                type="text"
                                value={col.label}
                                onChange={(e) => updateColumn(index, { label: e.target.value })}
                                placeholder="e.g., Item Name, Quantity, Price"
                              />
                            </label>
                            <small className="field-hint">The text displayed in the table header</small>
                          </div>
                          <div className="form-group">
                            <label>
                              Data Binding:
                              <div className="binding-input-wrapper">
                                <input
                                  type="text"
                                  value={col.bind}
                                  onChange={(e) => updateColumn(index, { bind: e.target.value })}
                                  placeholder="Select or type field name"
                                  onFocus={() => setShowBindingSuggestions({ ...showBindingSuggestions, [index]: true })}
                                  onBlur={() => setTimeout(() => setShowBindingSuggestions({ ...showBindingSuggestions, [index]: false }), 200)}
                                />
                                {bindingOptions.length > 0 && (
                                  <button
                                    type="button"
                                    className="binding-selector-btn"
                                    onClick={() => setShowBindingSuggestions({ ...showBindingSuggestions, [index]: !showBindingSuggestions[index] })}
                                    title="Select from available fields"
                                  >
                                    📋
                                  </button>
                                )}
                                {showBindingSuggestions[index] && bindingOptions.length > 0 && (
                                  <div className="binding-suggestions">
                                    <div className="binding-suggestions-header">
                                      <span>Available Fields</span>
                                      <button
                                        type="button"
                                        className="close-suggestions"
                                        onClick={() => setShowBindingSuggestions({ ...showBindingSuggestions, [index]: false })}
                                      >
                                        ×
                                      </button>
                                    </div>
                                    <div className="binding-suggestions-list">
                                      {Object.entries(groupedBindings).map(([category, fields]) => (
                                        <div key={category} className="binding-category">
                                          <div className="binding-category-header">{category}</div>
                                          {fields.map((field) => (
                                            <div
                                              key={field.value}
                                              className="binding-option"
                                              onClick={() => {
                                                updateColumn(index, { bind: field.value });
                                                setShowBindingSuggestions({ ...showBindingSuggestions, [index]: false });
                                              }}
                                            >
                                              <span className="binding-label">{field.label}</span>
                                              <code className="binding-value">{field.value}</code>
                                            </div>
                                          ))}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <small className="field-hint">
                                💡 Click the 📋 button to see available fields from your data
                              </small>
                            </label>
                          </div>
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>📏</span> Width (px)
                              </span>
                              <input
                                type="number"
                                value={col.width || ''}
                                min="0"
                                onChange={(e) => updateColumn(index, { width: e.target.value ? parseFloat(e.target.value) : undefined })}
                                placeholder="Auto - fits content"
                              />
                            </label>
                          </div>
                          <div className="form-group">
                            <label>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>📐</span> Height (px)
                              </span>
                              <input
                                type="number"
                                value={col.height || ''}
                                min="0"
                                onChange={(e) => updateColumn(index, { height: e.target.value ? parseFloat(e.target.value) : undefined })}
                                placeholder="Auto - fits content"
                              />
                            </label>
                          </div>
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>↔️</span> Text Alignment
                              </span>
                              <select
                                value={col.align || 'left'}
                                onChange={(e) => updateColumn(index, { align: e.target.value as 'left' | 'center' | 'right' })}
                              >
                                <option value="left">⬅️ Left</option>
                                <option value="center">↔️ Center</option>
                                <option value="right">➡️ Right</option>
                              </select>
                            </label>
                          </div>
                          <div className="form-group">
                            <label>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>⬆️</span> Row Span
                              </span>
                              <input
                                type="number"
                                value={col.rowSpan || ''}
                                min="1"
                                onChange={(e) => updateColumn(index, { rowSpan: e.target.value ? parseInt(e.target.value) : undefined })}
                                placeholder="1 (default)"
                              />
                            </label>
                            <small className="field-hint">Number of rows to merge</small>
                          </div>
                          <div className="form-group">
                            <label>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>⬅️➡️</span> Column Span
                              </span>
                              <input
                                type="number"
                                value={col.colSpan || ''}
                                min="1"
                                onChange={(e) => updateColumn(index, { colSpan: e.target.value ? parseInt(e.target.value) : undefined })}
                                placeholder="1 (default)"
                              />
                            </label>
                            <small className="field-hint">Number of columns to merge</small>
                          </div>
                        </div>

                        <div className="form-section" style={{ marginTop: '1rem', padding: '1.25rem', background: 'linear-gradient(135deg, rgba(11, 99, 255, 0.08) 0%, rgba(30, 136, 229, 0.04) 100%)', border: '2px solid rgba(11, 99, 255, 0.2)' }}>
                          <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <span>🔢</span> Data Calculation
                          </h4>
                          <small style={{ display: 'block', marginBottom: '1.25rem', color: '#6c757d', fontStyle: 'italic' }}>
                            Automatically calculate values from your data
                          </small>
                          
                          <div className="form-group">
                            <label>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>⚙️</span> Calculation Type
                              </span>
                              <select
                                value={col.calculationType || 'none'}
                                onChange={(e) => {
                                  const newType = e.target.value as any;
                                  updateColumn(index, { 
                                    calculationType: newType,
                                    // Clear fields when changing type
                                    calculationSource: newType === 'none' ? undefined : col.calculationSource,
                                    calculationField: newType === 'none' ? undefined : col.calculationField,
                                    calculationFormula: newType !== 'custom' ? undefined : col.calculationFormula
                                  });
                                }}
                              >
                                <option value="none">❌ None - No calculation</option>
                                <option value="sum">➕ Sum - Add all values</option>
                                <option value="avg">📊 Average - Calculate mean</option>
                                <option value="count">🔢 Count - Count items</option>
                                <option value="min">📉 Min - Find minimum</option>
                                <option value="max">📈 Max - Find maximum</option>
                                <option value="custom">✨ Custom Formula - Advanced calculation</option>
                              </select>
                            </label>
                            {col.calculationType && col.calculationType !== 'none' && (
                              <div className="calculation-preview" style={{ 
                                marginTop: '0.75rem', 
                                padding: '0.75rem', 
                                background: col.calculationSource && (col.calculationType === 'custom' ? col.calculationFormula : col.calculationField)
                                  ? 'rgba(11, 99, 255, 0.12)' 
                                  : 'rgba(255, 193, 7, 0.15)', 
                                borderRadius: '6px',
                                border: `1px solid ${col.calculationSource && (col.calculationType === 'custom' ? col.calculationFormula : col.calculationField)
                                  ? 'rgba(11, 99, 255, 0.3)' 
                                  : 'rgba(255, 193, 7, 0.4)'}`
                              }}>
                                <strong style={{ 
                                  color: col.calculationSource && (col.calculationType === 'custom' ? col.calculationFormula : col.calculationField)
                                    ? '#0B63FF' 
                                    : '#ff9800', 
                                  fontSize: '0.85rem' 
                                }}>
                                  {col.calculationSource && (col.calculationType === 'custom' ? col.calculationFormula : col.calculationField)
                                    ? '📋' 
                                    : '⚠️'} {getCalculationDescription(col.calculationType, col.calculationSource, col.calculationField)}
                                  {!col.calculationSource && col.calculationType !== 'custom' && ' - Please select a data source'}
                                  {col.calculationSource && !col.calculationField && col.calculationType !== 'custom' && ' - Please select a field'}
                                  {col.calculationType === 'custom' && !col.calculationFormula && ' - Please enter a formula'}
                                </strong>
                              </div>
                            )}
                          </div>

                          {col.calculationType && col.calculationType !== 'none' && (
                            <>
                              {col.calculationType !== 'custom' && (
                                <>
                                  <div className="form-group">
                                    <label>
                                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span>📊</span> Data Source
                                      </span>
                                      <select
                                        value={col.calculationSource || ''}
                                        onChange={(e) => {
                                          updateColumn(index, { 
                                            calculationSource: e.target.value,
                                            // Clear field when source changes
                                            calculationField: undefined
                                          });
                                        }}
                                      >
                                        <option value="">Select data source...</option>
                                        {calculationSources.map(source => (
                                          <option key={source.value} value={source.value}>
                                            {source.label} - {source.description}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <small className="field-hint">
                                      💡 Select which table/array to calculate from
                                    </small>
                                  </div>
                                  
                                  {col.calculationSource && (
                                    <div className="form-group">
                                      <label>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                          <span>🔤</span> Field to Calculate
                                        </span>
                                        <select
                                          value={col.calculationField || ''}
                                          onChange={(e) => updateColumn(index, { calculationField: e.target.value })}
                                        >
                                          <option value="">Select field...</option>
                                          {getFieldsFromSource(col.calculationSource).map(field => (
                                            <option key={field.value} value={field.value}>
                                              {field.label}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                      <small className="field-hint">
                                        💡 Choose which field to perform the calculation on
                                      </small>
                                    </div>
                                  )}
                                </>
                              )}
                              {col.calculationType === 'custom' && (
                                <div className="form-group">
                                  <label>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <span>✨</span> Custom Formula
                                    </span>
                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                      <input
                                        type="text"
                                        value={col.calculationFormula || ''}
                                        onChange={(e) => updateColumn(index, { calculationFormula: e.target.value })}
                                        placeholder="e.g., sum(items.rate) * header.exchangeRate"
                                        className="formula-input"
                                        style={{ flex: 1 }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setShowFormulaBuilder({ ...showFormulaBuilder, [`col-${index}`]: !showFormulaBuilder[`col-${index}`] })}
                                        style={{
                                          padding: '0.5rem 1rem',
                                          background: 'linear-gradient(135deg, #0B63FF 0%, #1E88E5 100%)',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          fontSize: '0.85rem',
                                          fontWeight: 600,
                                          whiteSpace: 'nowrap'
                                        }}
                                      >
                                        🧮 {showFormulaBuilder[`col-${index}`] ? 'Hide' : 'Show'} Builder
                                      </button>
                                    </div>
                                  </label>
                                  <small className="field-hint">
                                    💡 Use the formula builder below or type directly
                                  </small>
                                  <FormulaBuilder
                                    formula={col.calculationFormula || ''}
                                    onFormulaChange={(formula) => updateColumn(index, { calculationFormula: formula })}
                                    id={`col-${index}`}
                                  />
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        <div className="form-group">
                          <label className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={col.visible}
                              onChange={(e) => updateColumn(index, { visible: e.target.checked })}
                            />
                            Visible
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'finalRows' && (
            <div className="tab-content">
              <div className="final-rows-header">
                <button className="action-btn primary" onClick={addFinalRow}>
                  + Add Final Row
                </button>
              </div>

              <div className="final-rows-list">
                {(editedTable.finalRows || []).length === 0 ? (
                  <div className="empty-state">
                    <p>No final rows. Click "Add Final Row" to create one.</p>
                  </div>
                ) : (
                  (editedTable.finalRows || []).map((finalRow, rowIndex) => (
                    <div key={rowIndex} className="final-row-card">
                      <div className="final-row-header">
                        <h4>Row {rowIndex + 1}</h4>
                        <div className="final-row-actions">
                          <button
                            className="action-btn small"
                            onClick={() => addCellToFinalRow(rowIndex)}
                          >
                            + Cell
                          </button>
                          <button
                            className="action-btn small danger"
                            onClick={() => deleteFinalRow(rowIndex)}
                          >
                            Delete Row
                          </button>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={finalRow.visible !== false}
                            onChange={(e) => updateFinalRow(rowIndex, { visible: e.target.checked })}
                          />
                          Visible
                        </label>
                      </div>

                      <div className="form-group">
                        <label>
                          Background Color:
                          <input
                            type="color"
                            value={finalRow.backgroundColor || '#ffffff'}
                            onChange={(e) => updateFinalRow(rowIndex, { backgroundColor: e.target.value })}
                          />
                        </label>
                      </div>

                      <div className="form-group">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={finalRow.borderTop || false}
                            onChange={(e) => updateFinalRow(rowIndex, { borderTop: e.target.checked })}
                          />
                          Show Top Border
                        </label>
                      </div>

                      <div className="final-row-cells">
                        <h5>Cells</h5>
                        {finalRow.cells.map((cell, cellIndex) => {
                          const cellKey = `row-${rowIndex}-cell-${cellIndex}`;
                          const isExpanded = expandedCells[cellKey] !== false; // Default to expanded
                          
                          return (
                          <div key={cellIndex} className={`final-row-cell ${isExpanded ? 'expanded' : ''}`}>
                            <div className="cell-header">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                                <button
                                  className="expand-btn"
                                  onClick={() => setExpandedCells({ ...expandedCells, [cellKey]: !isExpanded })}
                                  style={{
                                    background: 'transparent',
                                    border: '1px solid #ced4da',
                                    borderRadius: '4px',
                                    padding: '0.375rem 0.75rem',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem',
                                    transition: 'all 0.2s ease'
                                  }}
                                >
                                  {isExpanded ? '▼' : '▶'}
                                </button>
                                <span style={{ fontWeight: 600, color: '#495057' }}>Cell {cellIndex + 1}</span>
                                {cell.label && (
                                  <span style={{ fontSize: '0.85rem', color: '#6c757d', fontStyle: 'italic' }}>
                                    - {cell.label}
                                  </span>
                                )}
                              </div>
                              <button
                                className="delete-btn small"
                                onClick={() => deleteCellFromFinalRow(rowIndex, cellIndex)}
                              >
                                ×
                              </button>
                            </div>

                            {isExpanded && (
                            <div className="cell-content" style={{ paddingTop: '1rem', borderTop: '1px solid #e9ecef', animation: 'slideDown 0.2s ease' }}>

                            <div className="form-group">
                              <label>
                                Label:
                                <input
                                  type="text"
                                  value={cell.label || ''}
                                  onChange={(e) => updateFinalRowCell(rowIndex, cellIndex, { label: e.target.value })}
                                  placeholder="e.g., Sub Total"
                                />
                              </label>
                            </div>

                            <div className="form-group">
                              <label>
                                Value Type:
                                <select
                                  value={cell.valueType || 'static'}
                                  onChange={(e) => updateFinalRowCell(rowIndex, cellIndex, { valueType: e.target.value as any })}
                                >
                                  <option value="static">Static</option>
                                  <option value="calculation">Calculation</option>
                                  <option value="formula">Formula</option>
                                </select>
                              </label>
                            </div>

                            {cell.valueType === 'static' && (
                              <div className="form-group">
                                <label>
                                  Value:
                                  <input
                                    type="text"
                                    value={cell.value || ''}
                                    onChange={(e) => updateFinalRowCell(rowIndex, cellIndex, { value: e.target.value })}
                                    placeholder="e.g., 400"
                                  />
                                </label>
                              </div>
                            )}

                            {cell.valueType === 'calculation' && (
                              <div className="form-section" style={{ marginTop: '1rem', padding: '1rem', background: 'linear-gradient(135deg, rgba(11, 99, 255, 0.08) 0%, rgba(30, 136, 229, 0.04) 100%)', border: '2px solid rgba(11, 99, 255, 0.2)' }}>
                                <h5 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                  <span>🔢</span> Calculation Settings
                                </h5>
                                <div className="form-group">
                                  <label>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <span>⚙️</span> Calculation Type
                                    </span>
                                    <select
                                      value={cell.calculationType || 'sum'}
                                      onChange={(e) => {
                                        updateFinalRowCell(rowIndex, cellIndex, { 
                                          calculationType: e.target.value as any,
                                          calculationField: undefined
                                        });
                                      }}
                                    >
                                      <option value="sum">➕ Sum - Add all values</option>
                                      <option value="avg">📊 Average - Calculate mean</option>
                                      <option value="count">🔢 Count - Count items</option>
                                      <option value="min">📉 Min - Find minimum</option>
                                      <option value="max">📈 Max - Find maximum</option>
                                    </select>
                                  </label>
                                </div>
                                <div className="form-group">
                                  <label>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <span>📊</span> Data Source
                                    </span>
                                    <select
                                      value={cell.calculationSource || ''}
                                      onChange={(e) => {
                                        updateFinalRowCell(rowIndex, cellIndex, { 
                                          calculationSource: e.target.value,
                                          calculationField: undefined
                                        });
                                      }}
                                    >
                                      <option value="">Select data source...</option>
                                      {calculationSources.map(source => (
                                        <option key={source.value} value={source.value}>
                                          {source.label} - {source.description}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <small className="field-hint">
                                    💡 Select which table/array to calculate from
                                  </small>
                                </div>
                                {cell.calculationSource && (
                                  <div className="form-group">
                                    <label>
                                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span>🔤</span> Field to Calculate
                                      </span>
                                      <select
                                        value={cell.calculationField || ''}
                                        onChange={(e) => updateFinalRowCell(rowIndex, cellIndex, { calculationField: e.target.value })}
                                      >
                                        <option value="">Select field...</option>
                                        {getFieldsFromSource(cell.calculationSource).map(field => (
                                          <option key={field.value} value={field.value}>
                                            {field.label}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <small className="field-hint">
                                      💡 Choose which field to perform the calculation on
                                    </small>
                                    {cell.calculationType && (
                                      <div className="calculation-preview" style={{ 
                                        marginTop: '0.75rem', 
                                        padding: '0.75rem', 
                                        background: cell.calculationSource && cell.calculationField
                                          ? 'rgba(11, 99, 255, 0.12)' 
                                          : 'rgba(255, 193, 7, 0.15)', 
                                        borderRadius: '6px',
                                        border: `1px solid ${cell.calculationSource && cell.calculationField
                                          ? 'rgba(11, 99, 255, 0.3)' 
                                          : 'rgba(255, 193, 7, 0.4)'}`
                                      }}>
                                        <strong style={{ 
                                          color: cell.calculationSource && cell.calculationField
                                            ? '#0B63FF' 
                                            : '#ff9800', 
                                          fontSize: '0.85rem' 
                                        }}>
                                          {cell.calculationSource && cell.calculationField
                                            ? '📋' 
                                            : '⚠️'} {getCalculationDescription(cell.calculationType, cell.calculationSource, cell.calculationField)}
                                          {!cell.calculationSource && ' - Please select a data source'}
                                          {cell.calculationSource && !cell.calculationField && ' - Please select a field'}
                                        </strong>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {cell.valueType === 'formula' && (
                              <div className="form-group">
                                <label>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span>✨</span> Custom Formula
                                  </span>
                                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <input
                                      type="text"
                                      value={cell.formula || ''}
                                      onChange={(e) => updateFinalRowCell(rowIndex, cellIndex, { formula: e.target.value })}
                                      placeholder="e.g., sum(items.rate) * header.exchangeRate"
                                      className="formula-input"
                                      style={{ flex: 1 }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setShowFormulaBuilder({ ...showFormulaBuilder, [`cell-${rowIndex}-${cellIndex}`]: !showFormulaBuilder[`cell-${rowIndex}-${cellIndex}`] })}
                                      style={{
                                        padding: '0.5rem 1rem',
                                        background: 'linear-gradient(135deg, #0B63FF 0%, #1E88E5 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      🧮 {showFormulaBuilder[`cell-${rowIndex}-${cellIndex}`] ? 'Hide' : 'Show'} Builder
                                    </button>
                                  </div>
                                </label>
                                <small className="field-hint">
                                  💡 Use the formula builder below or type directly
                                </small>
                                <FormulaBuilder
                                  formula={cell.formula || ''}
                                  onFormulaChange={(formula) => updateFinalRowCell(rowIndex, cellIndex, { formula })}
                                  id={`cell-${rowIndex}-${cellIndex}`}
                                />
                              </div>
                            )}

                            <div className="form-row">
                              <div className="form-group">
                                <label>
                                  Alignment:
                                  <select
                                    value={cell.align || 'left'}
                                    onChange={(e) => updateFinalRowCell(rowIndex, cellIndex, { align: e.target.value as any })}
                                  >
                                    <option value="left">Left</option>
                                    <option value="center">Center</option>
                                    <option value="right">Right</option>
                                  </select>
                                </label>
                              </div>
                              <div className="form-group">
                                <label>
                                  Column Span:
                                  <input
                                    type="number"
                                    value={cell.colSpan || 1}
                                    min="1"
                                    onChange={(e) => updateFinalRowCell(rowIndex, cellIndex, { colSpan: parseInt(e.target.value) || 1 })}
                                  />
                                </label>
                              </div>
                            </div>

                            <div className="form-row">
                              <div className="form-group">
                                <label>
                                  Font Size:
                                  <input
                                    type="number"
                                    value={cell.fontSize || ''}
                                    min="8"
                                    onChange={(e) => updateFinalRowCell(rowIndex, cellIndex, { fontSize: e.target.value ? parseFloat(e.target.value) : undefined })}
                                    placeholder="Auto"
                                  />
                                </label>
                              </div>
                              <div className="form-group">
                                <label>
                                  Text Color:
                                  <input
                                    type="color"
                                    value={cell.color || '#000000'}
                                    onChange={(e) => updateFinalRowCell(rowIndex, cellIndex, { color: e.target.value })}
                                  />
                                </label>
                              </div>
                            </div>

                            <div className="form-group">
                              <label className="checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={cell.fontWeight === 'bold'}
                                  onChange={(e) => updateFinalRowCell(rowIndex, cellIndex, { fontWeight: e.target.checked ? 'bold' : 'normal' })}
                                />
                                Bold
                              </label>
                            </div>
                            </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'style' && (
            <div className="tab-content">
              <div className="form-section">
                <h3>Borders</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>
                      Border Color:
                      <input
                        type="color"
                        value={editedTable.borderColor || '#dddddd'}
                        onChange={(e) => updateTable({ borderColor: e.target.value })}
                      />
                    </label>
                  </div>
                  <div className="form-group">
                    <label>
                      Border Width:
                      <input
                        type="number"
                        value={editedTable.borderWidth || 1}
                        min="0"
                        step="0.5"
                        onChange={(e) => updateTable({ borderWidth: parseFloat(e.target.value) || 1 })}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Header</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>
                      Background Color:
                      <input
                        type="color"
                        value={editedTable.headerBackgroundColor || '#f0f0f0'}
                        onChange={(e) => updateTable({ headerBackgroundColor: e.target.value })}
                      />
                    </label>
                  </div>
                  <div className="form-group">
                    <label>
                      Text Color:
                      <input
                        type="color"
                        value={editedTable.headerTextColor || '#000000'}
                        onChange={(e) => updateTable({ headerTextColor: e.target.value })}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Table Style</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>
                      Cell Padding:
                      <input
                        type="number"
                        value={editedTable.cellPadding || 10}
                        min="0"
                        step="1"
                        onChange={(e) => updateTable({ cellPadding: parseFloat(e.target.value) || 10 })}
                      />
                    </label>
                  </div>
                  <div className="form-group">
                    <label>
                      Font Size:
                      <input
                        type="number"
                        value={editedTable.fontSize || ''}
                        min="8"
                        step="1"
                        onChange={(e) => updateTable({ fontSize: e.target.value ? parseFloat(e.target.value) : undefined })}
                        placeholder="Auto"
                      />
                    </label>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>
                      Table Width:
                      <input
                        type="number"
                        value={editedTable.tableWidth || ''}
                        min="100"
                        step="10"
                        onChange={(e) => updateTable({ tableWidth: e.target.value ? parseFloat(e.target.value) : undefined })}
                        placeholder="Auto"
                      />
                    </label>
                  </div>
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={!!editedTable.alternateRowColor}
                        onChange={(e) => updateTable({ alternateRowColor: e.target.checked ? '#f9f9f9' : undefined })}
                      />
                      Alternate Row Color
                    </label>
                  </div>
                </div>
                {editedTable.alternateRowColor && (
                  <div className="form-group">
                    <label>
                      Alternate Row Color:
                      <input
                        type="color"
                        value={editedTable.alternateRowColor}
                        onChange={(e) => updateTable({ alternateRowColor: e.target.value })}
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="table-editor-modal-footer">
          <button className="btn btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </>
  );
};

export default TableEditorModal;

