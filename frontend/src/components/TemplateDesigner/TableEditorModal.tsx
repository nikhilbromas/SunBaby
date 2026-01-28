import React, { useState } from 'react';
import type { ItemsTableConfig, ContentDetailsTableConfig, TableColumnConfig, FinalRowConfig, FinalRowCellConfig } from '../../services/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogOverlay } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { 
  Table, FileText, Plus, Palette, Tag, Ruler, Triangle, 
  AlignLeft, AlignCenter, AlignRight, ArrowUp, Columns,
  Calculator, Settings, Type, Sparkles, Lightbulb, 
  AlertTriangle, X, TrendingUp, TrendingDown, Hash,
  ClipboardList, BarChart3
} from 'lucide-react';
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
            <Calculator style={{ width: '16px', height: '16px' }} />
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
                  <BarChart3 style={{ width: '16px', height: '16px' }} />
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
                  <option value="sum">Sum</option>
                  <option value="avg">Average</option>
                  <option value="count">Count</option>
                  <option value="min">Min</option>
                  <option value="max">Max</option>
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
                  <Plus style={{ width: '16px', height: '16px' }} />
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
                  <Hash style={{ width: '16px', height: '16px' }} />
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
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#2c3e50', marginRight: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Triangle style={{ width: '14px', height: '14px' }} /> Grouping:
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
                  <Lightbulb style={{ width: '16px', height: '16px' }} />
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="max-w-5xl sm:max-w-5xl w-[100vw] sm:w-auto h-[100vh] sm:h-[90vh] p-0 gap-0 flex flex-col sm:rounded-lg rounded-none">
        <DialogHeader className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white border-b-0 flex-shrink-0">
          <DialogTitle className="flex items-center gap-3 text-2xl font-semibold">
            <Table className="w-8 h-8" />
            <span>
              {tableLabel || (tableType === 'contentDetailTable' && 'contentName' in editedTable 
                ? `Edit Table: ${editedTable.contentName}` 
                : 'Edit Table')}
            </span>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="flex flex-col flex-1 min-h-0">
          <TabsList className="w-full justify-start rounded-none border-b bg-gradient-to-b from-blue-50 to-white px-6 h-auto gap-2 overflow-x-auto flex-shrink-0">
            <TabsTrigger value="general" className="gap-2 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 data-[state=active]:shadow-md">
              <FileText className="w-4 h-4" /> General
            </TabsTrigger>
            <TabsTrigger value="columns" className="gap-2 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 data-[state=active]:shadow-md">
              <BarChart3 className="w-4 h-4" /> Columns ({editedTable.columns.length})
            </TabsTrigger>
            <TabsTrigger value="finalRows" className="gap-2 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 data-[state=active]:shadow-md">
              <Plus className="w-4 h-4" /> Final Rows ({(editedTable.finalRows || []).length})
            </TabsTrigger>
            <TabsTrigger value="style" className="gap-2 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 data-[state=active]:shadow-md">
              <Palette className="w-4 h-4" /> Style
            </TabsTrigger>
          </TabsList>

        <div className="flex-1 min-h-0 overflow-hidden bg-gradient-to-b from-white to-blue-50">
          <ScrollArea className="h-full">
          <TabsContent value="general" className="p-6 space-y-6 m-0">
            <Card className="p-6 bg-gradient-to-b from-white to-blue-50 border-blue-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-700 mb-6 pb-2 border-b-2 border-blue-200">Layout</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="orientation" className="text-sm font-semibold text-gray-700">
                    Orientation:
                  </Label>
                  <select
                    id="orientation"
                    value={editedTable.orientation || 'vertical'}
                    onChange={(e) => updateTable({ orientation: e.target.value as 'vertical' | 'horizontal' })}
                    className="w-full px-3 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="vertical">Vertical (Normal)</option>
                    <option value="horizontal">Horizontal (Transposed)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="positionX" className="text-sm font-semibold text-gray-700">
                    Position X:
                  </Label>
                  <Input
                    id="positionX"
                    type="number"
                    value={editedTable.x || 0}
                    onChange={(e) => updateTable({ x: parseFloat(e.target.value) || 0 })}
                    className="border-blue-200 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="positionY" className="text-sm font-semibold text-gray-700">
                    Position Y:
                  </Label>
                  <Input
                    id="positionY"
                    type="number"
                    value={editedTable.y || 0}
                    onChange={(e) => updateTable({ y: parseFloat(e.target.value) || 0 })}
                    className="border-blue-200 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                {tableType === 'contentDetailTable' && (
                  <div className="space-y-2">
                    <Label htmlFor="rowsPerPage" className="text-sm font-semibold text-gray-700">
                      Rows Per Page:
                    </Label>
                    <Input
                      id="rowsPerPage"
                      type="number"
                      value={(editedTable as ContentDetailsTableConfig).rowsPerPage || ''}
                      min="1"
                      onChange={(e) => updateTable({ 
                        rowsPerPage: e.target.value ? parseInt(e.target.value) : undefined 
                      } as ContentDetailsTableConfig)}
                      placeholder="Auto"
                      className="border-blue-200 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="columns" className="p-6 space-y-6 m-0">
            <div className="flex gap-3 flex-wrap">
              <Button onClick={addColumn} className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-md">
                + Add Column
              </Button>
              <Button onClick={toggleAllColumns} variant="outline" className="border-blue-300 hover:bg-blue-50">
                {selectedColumns.size === editedTable.columns.length ? 'Deselect All' : 'Select All'}
              </Button>
              {selectedColumns.size > 0 && (
                <Button onClick={deleteSelectedColumns} variant="destructive" className="shadow-md">
                  Delete Selected ({selectedColumns.size})
                </Button>
              )}
            </div>

            <div className="space-y-4">
                {editedTable.columns.map((col, index) => (
                  <Card
                    key={index}
                    className={cn(
                      "p-4 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 border-2",
                      selectedColumns.has(index) 
                        ? "border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 shadow-md" 
                        : "border-gray-200 bg-white hover:border-blue-400",
                      expandedColumn === index && "border-blue-500 shadow-xl"
                    )}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <label className="flex items-center gap-2 cursor-pointer font-semibold text-gray-700">
                        <Checkbox
                          checked={selectedColumns.has(index)}
                          onCheckedChange={() => toggleColumnSelection(index)}
                          className="border-blue-500"
                        />
                        <span>Column #{index + 1}</span>
                      </label>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExpandedColumn(expandedColumn === index ? null : index)}
                          className="h-8 w-8 p-0 border-gray-300 hover:border-gray-400"
                        >
                          {expandedColumn === index ? '▼' : '▶'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteColumn(index)}
                          className="h-8 w-8 p-0 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                        >
                          ×
                        </Button>
                      </div>
                    </div>

                    {expandedColumn === index && (
                      <div className="pt-4 border-t border-gray-200 space-y-4 animate-in slide-in-from-top-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                              <Tag className="w-4 h-4" /> Column Label
                            </Label>
                            <Input
                              type="text"
                              value={col.label}
                              onChange={(e) => updateColumn(index, { label: e.target.value })}
                              placeholder="e.g., Item Name, Quantity, Price"
                              className="border-blue-200 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <small className="text-xs text-blue-600 italic">The text displayed in the table header</small>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold text-gray-700">
                              Data Binding:
                            </Label>
                            <div className="relative">
                              <Input
                                type="text"
                                value={col.bind}
                                onChange={(e) => updateColumn(index, { bind: e.target.value })}
                                placeholder="Select or type field name"
                                onFocus={() => setShowBindingSuggestions({ ...showBindingSuggestions, [index]: true })}
                                onBlur={() => setTimeout(() => setShowBindingSuggestions({ ...showBindingSuggestions, [index]: false }), 200)}
                                className="pr-12 border-blue-200 focus:ring-blue-500 focus:border-blue-500"
                              />
                              {bindingOptions.length > 0 && (
                                <Button
                                  type="button"
                                  onClick={() => setShowBindingSuggestions({ ...showBindingSuggestions, [index]: !showBindingSuggestions[index] })}
                                  title="Select from available fields"
                                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
                                  size="sm"
                                >
                                  <ClipboardList className="w-4 h-4" />
                                </Button>
                              )}
                              {showBindingSuggestions[index] && bindingOptions.length > 0 && (
                                <Card className="absolute top-full left-0 right-0 mt-2 z-50 border-2 border-blue-500 shadow-xl max-h-80 overflow-hidden flex flex-col">
                                  <div className="flex justify-between items-center px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold text-sm">
                                    <span>Available Fields</span>
                                    <Button
                                      type="button"
                                      onClick={() => setShowBindingSuggestions({ ...showBindingSuggestions, [index]: false })}
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-white hover:bg-white/20 rounded-full"
                                    >
                                      ×
                                    </Button>
                                  </div>
                                  <ScrollArea className="flex-1 p-2">
                                    {Object.entries(groupedBindings).map(([category, fields]) => (
                                      <div key={category} className="mb-3">
                                        <div className="px-3 py-2 bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700 font-semibold text-sm rounded mb-2">
                                          {category}
                                        </div>
                                        {fields.map((field) => (
                                          <div
                                            key={field.value}
                                            onClick={() => {
                                              updateColumn(index, { bind: field.value });
                                              setShowBindingSuggestions({ ...showBindingSuggestions, [index]: false });
                                            }}
                                            className="flex justify-between items-center px-3 py-2 mb-1 rounded cursor-pointer transition-all hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 hover:border-blue-200 hover:translate-x-1 border border-transparent"
                                          >
                                            <span className="font-medium text-gray-700 text-sm">{field.label}</span>
                                            <code className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded border border-gray-200">
                                              {field.value}
                                            </code>
                                          </div>
                                        ))}
                                      </div>
                                    ))}
                                  </ScrollArea>
                                </Card>
                              )}
                            </div>
                            <small className="text-xs text-blue-600 italic flex items-center gap-1">
                              <Lightbulb className="w-3 h-3" /> Click the <ClipboardList className="w-3 h-3 inline" /> button to see available fields from your data
                            </small>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                              <Ruler className="w-4 h-4" /> Width (px)
                            </Label>
                            <Input
                              type="number"
                              value={col.width || ''}
                              min="0"
                              onChange={(e) => updateColumn(index, { width: e.target.value ? parseFloat(e.target.value) : undefined })}
                              placeholder="Auto - fits content"
                              className="border-blue-200 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                              <Triangle className="w-4 h-4" /> Height (px)
                            </Label>
                            <Input
                              type="number"
                              value={col.height || ''}
                              min="0"
                              onChange={(e) => updateColumn(index, { height: e.target.value ? parseFloat(e.target.value) : undefined })}
                              placeholder="Auto - fits content"
                              className="border-blue-200 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                              <AlignCenter className="w-4 h-4" /> Text Alignment
                            </Label>
                            <select
                              value={col.align || 'left'}
                              onChange={(e) => updateColumn(index, { align: e.target.value as 'left' | 'center' | 'right' })}
                              className="w-full px-3 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                            >
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                              <option value="right">Right</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                              <ArrowUp className="w-4 h-4" /> Row Span
                            </Label>
                            <Input
                              type="number"
                              value={col.rowSpan || ''}
                              min="1"
                              onChange={(e) => updateColumn(index, { rowSpan: e.target.value ? parseInt(e.target.value) : undefined })}
                              placeholder="1 (default)"
                              className="border-blue-200 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <small className="text-xs text-blue-600 italic">Number of rows to merge</small>
                          </div>
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                              <Columns className="w-4 h-4" /> Column Span
                            </Label>
                            <Input
                              type="number"
                              value={col.colSpan || ''}
                              min="1"
                              onChange={(e) => updateColumn(index, { colSpan: e.target.value ? parseInt(e.target.value) : undefined })}
                              placeholder="1 (default)"
                              className="border-blue-200 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <small className="text-xs text-blue-600 italic">Number of columns to merge</small>
                          </div>
                        </div>

                        <Card className="mt-4 p-5 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200">
                          <h4 className="flex items-center gap-2 mb-2 text-base font-semibold text-gray-700">
                            <Calculator className="w-4 h-4" /> Data Calculation
                          </h4>
                          <small className="block mb-5 text-gray-600 italic">
                            Automatically calculate values from your data
                          </small>
                          
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                              <Settings className="w-4 h-4" /> Calculation Type
                            </Label>
                            <select
                              value={col.calculationType || 'none'}
                              onChange={(e) => {
                                const newType = e.target.value as any;
                                updateColumn(index, { 
                                  calculationType: newType,
                                  calculationSource: newType === 'none' ? undefined : col.calculationSource,
                                  calculationField: newType === 'none' ? undefined : col.calculationField,
                                  calculationFormula: newType !== 'custom' ? undefined : col.calculationFormula
                                });
                              }}
                              className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                            >
                              <option value="none">None - No calculation</option>
                              <option value="sum">Sum - Add all values</option>
                              <option value="avg">Average - Calculate mean</option>
                              <option value="count">Count - Count items</option>
                              <option value="min">Min - Find minimum</option>
                              <option value="max">Max - Find maximum</option>
                              <option value="custom">Custom Formula - Advanced calculation</option>
                            </select>
                            {col.calculationType && col.calculationType !== 'none' && (
                              <div className={cn(
                                "mt-3 p-3 rounded-md border transition-all",
                                col.calculationSource && (col.calculationType === 'custom' ? col.calculationFormula : col.calculationField)
                                  ? "bg-blue-100 border-blue-300" 
                                  : "bg-yellow-50 border-yellow-300"
                              )}>
                                <strong className={cn(
                                  "text-sm flex items-center gap-2",
                                  col.calculationSource && (col.calculationType === 'custom' ? col.calculationFormula : col.calculationField)
                                    ? "text-blue-700" 
                                    : "text-yellow-700"
                                )}>
                                  {col.calculationSource && (col.calculationType === 'custom' ? col.calculationFormula : col.calculationField)
                                    ? <ClipboardList className="w-4 h-4" />
                                    : <AlertTriangle className="w-4 h-4" />} {getCalculationDescription(col.calculationType, col.calculationSource, col.calculationField)}
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
                                  <div className="space-y-2">
                                    <Label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                      <BarChart3 className="w-4 h-4" /> Data Source
                                    </Label>
                                    <select
                                      value={col.calculationSource || ''}
                                      onChange={(e) => {
                                        updateColumn(index, { 
                                          calculationSource: e.target.value,
                                          calculationField: undefined
                                        });
                                      }}
                                      className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                    >
                                      <option value="">Select data source...</option>
                                      {calculationSources.map(source => (
                                        <option key={source.value} value={source.value}>
                                          {source.label} - {source.description}
                                        </option>
                                      ))}
                                    </select>
                                    <small className="text-xs text-blue-600 italic flex items-center gap-1">
                                      <Lightbulb className="w-3 h-3" /> Select which table/array to calculate from
                                    </small>
                                  </div>
                                  
                                  {col.calculationSource && (
                                    <div className="space-y-2">
                                      <Label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                        <Type className="w-4 h-4" /> Field to Calculate
                                      </Label>
                                      <select
                                        value={col.calculationField || ''}
                                        onChange={(e) => updateColumn(index, { calculationField: e.target.value })}
                                        className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                      >
                                        <option value="">Select field...</option>
                                        {getFieldsFromSource(col.calculationSource).map(field => (
                                          <option key={field.value} value={field.value}>
                                            {field.label}
                                          </option>
                                        ))}
                                      </select>
                                      <small className="text-xs text-blue-600 italic flex items-center gap-1">
                                        <Lightbulb className="w-3 h-3" /> Choose which field to perform the calculation on
                                      </small>
                                    </div>
                                  )}
                                </>
                              )}
                              {col.calculationType === 'custom' && (
                                <div className="space-y-2">
                                  <Label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                    <Sparkles className="w-4 h-4" /> Custom Formula
                                  </Label>
                                  <div className="flex gap-2">
                                    <Input
                                      type="text"
                                      value={col.calculationFormula || ''}
                                      onChange={(e) => updateColumn(index, { calculationFormula: e.target.value })}
                                      placeholder="e.g., sum(items.rate) * header.exchangeRate"
                                      className="flex-1 font-mono text-sm border-blue-300 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    <Button
                                      type="button"
                                      onClick={() => setShowFormulaBuilder({ ...showFormulaBuilder, [`col-${index}`]: !showFormulaBuilder[`col-${index}`] })}
                                      className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 whitespace-nowrap"
                                    >
                                      🧮 {showFormulaBuilder[`col-${index}`] ? 'Hide' : 'Show'} Builder
                                    </Button>
                                  </div>
                                  <small className="text-xs text-blue-600 italic flex items-center gap-1">
                                    <Lightbulb className="w-3 h-3" /> Use the formula builder below or type directly
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
                        </Card>

                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`visible-${index}`}
                            checked={col.visible}
                            onCheckedChange={(checked) => updateColumn(index, { visible: !!checked })}
                            className="border-blue-500"
                          />
                          <Label htmlFor={`visible-${index}`} className="text-sm font-medium cursor-pointer">
                            Visible
                          </Label>
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
          </TabsContent>

          <TabsContent value="finalRows" className="p-6 space-y-6 m-0">
            <Button onClick={addFinalRow} className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-md">
              + Add Final Row
            </Button>

            <div className="space-y-6">
              {(editedTable.finalRows || []).length === 0 ? (
                <div className="text-center py-12 text-gray-500 italic">
                  <p>No final rows. Click "Add Final Row" to create one.</p>
                </div>
              ) : (
                  (editedTable.finalRows || []).map((finalRow, rowIndex) => (
                    <Card key={rowIndex} className="p-6 bg-gradient-to-b from-white to-blue-50 border-2 border-blue-200 shadow-sm">
                      <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200">
                        <h4 className="text-lg font-semibold text-gray-700">Row {rowIndex + 1}</h4>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addCellToFinalRow(rowIndex)}
                            className="border-blue-300 hover:bg-blue-50"
                          >
                            + Cell
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteFinalRow(rowIndex)}
                          >
                            Delete Row
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`visible-row-${rowIndex}`}
                            checked={finalRow.visible !== false}
                            onCheckedChange={(checked) => updateFinalRow(rowIndex, { visible: !!checked })}
                            className="border-blue-500"
                          />
                          <Label htmlFor={`visible-row-${rowIndex}`} className="text-sm font-medium cursor-pointer">
                            Visible
                          </Label>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`bg-color-${rowIndex}`} className="text-sm font-semibold text-gray-700">
                            Background Color:
                          </Label>
                          <input
                            id={`bg-color-${rowIndex}`}
                            type="color"
                            value={finalRow.backgroundColor || '#ffffff'}
                            onChange={(e) => updateFinalRow(rowIndex, { backgroundColor: e.target.value })}
                            className="w-full h-10 border border-blue-200 rounded-md cursor-pointer"
                          />
                        </div>

                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`border-top-${rowIndex}`}
                            checked={finalRow.borderTop || false}
                            onCheckedChange={(checked) => updateFinalRow(rowIndex, { borderTop: !!checked })}
                            className="border-blue-500"
                          />
                          <Label htmlFor={`border-top-${rowIndex}`} className="text-sm font-medium cursor-pointer">
                            Show Top Border
                          </Label>
                        </div>

                      <div className="mt-4">
                        <h5 className="text-base font-semibold text-gray-700 mb-4">Cells</h5>
                        {finalRow.cells.map((cell, cellIndex) => {
                          const cellKey = `row-${rowIndex}-cell-${cellIndex}`;
                          const isExpanded = expandedCells[cellKey] !== false;
                          
                          return (
                          <Card key={cellIndex} className={cn(
                            "p-4 transition-all border",
                            isExpanded ? "bg-gradient-to-b from-white to-blue-50 border-blue-300 shadow-md" : "bg-gray-50 border-gray-200"
                          )}>
                            <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-200">
                              <div className="flex items-center gap-2 flex-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setExpandedCells({ ...expandedCells, [cellKey]: !isExpanded })}
                                  className="h-8 w-8 p-0 border-gray-300"
                                >
                                  {isExpanded ? '▼' : '▶'}
                                </Button>
                                <span className="font-semibold text-gray-700">Cell {cellIndex + 1}</span>
                                {cell.label && (
                                  <span className="text-sm text-gray-600 italic">
                                    - {cell.label}
                                  </span>
                                )}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteCellFromFinalRow(rowIndex, cellIndex)}
                                className="h-6 w-6 p-0 border-red-300 text-red-600 hover:bg-red-50"
                              >
                                ×
                              </Button>
                            </div>

                            {isExpanded && (
                            <div className="pt-4 space-y-4 animate-in slide-in-from-top-2">

                            <div className="space-y-2">
                              <Label htmlFor={`label-${rowIndex}-${cellIndex}`} className="text-sm font-semibold text-gray-700">
                                Label:
                              </Label>
                              <Input
                                id={`label-${rowIndex}-${cellIndex}`}
                                type="text"
                                value={cell.label || ''}
                                onChange={(e) => updateFinalRowCell(rowIndex, cellIndex, { label: e.target.value })}
                                placeholder="e.g., Sub Total"
                                className="border-blue-200 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`value-type-${rowIndex}-${cellIndex}`} className="text-sm font-semibold text-gray-700">
                                Value Type:
                              </Label>
                              <select
                                id={`value-type-${rowIndex}-${cellIndex}`}
                                value={cell.valueType || 'static'}
                                onChange={(e) => updateFinalRowCell(rowIndex, cellIndex, { valueType: e.target.value as any })}
                                className="w-full px-3 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                              >
                                <option value="static">Static</option>
                                <option value="calculation">Calculation</option>
                                <option value="formula">Formula</option>
                              </select>
                            </div>

                            {cell.valueType === 'static' && (
                              <div className="space-y-2">
                                <Label htmlFor={`value-${rowIndex}-${cellIndex}`} className="text-sm font-semibold text-gray-700">
                                  Value:
                                </Label>
                                <Input
                                  id={`value-${rowIndex}-${cellIndex}`}
                                  type="text"
                                  value={cell.value || ''}
                                  onChange={(e) => updateFinalRowCell(rowIndex, cellIndex, { value: e.target.value })}
                                  placeholder="e.g., 400"
                                  className="border-blue-200 focus:ring-blue-500 focus:border-blue-500"
                                />
                              </div>
                            )}

                            {cell.valueType === 'calculation' && (
                              <Card className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200">
                                <h5 className="flex items-center gap-2 mb-3 text-base font-semibold text-gray-700">
                                  <Calculator className="w-4 h-4" /> Calculation Settings
                                </h5>
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                      <Settings className="w-4 h-4" /> Calculation Type
                                    </Label>
                                    <select
                                      value={cell.calculationType || 'sum'}
                                      onChange={(e) => {
                                        updateFinalRowCell(rowIndex, cellIndex, { 
                                          calculationType: e.target.value as any,
                                          calculationField: undefined
                                        });
                                      }}
                                      className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                    >
                                      <option value="sum">Sum - Add all values</option>
                                      <option value="avg">Average - Calculate mean</option>
                                      <option value="count">Count - Count items</option>
                                      <option value="min">Min - Find minimum</option>
                                      <option value="max">Max - Find maximum</option>
                                    </select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                      <BarChart3 className="w-4 h-4" /> Data Source
                                    </Label>
                                    <select
                                      value={cell.calculationSource || ''}
                                      onChange={(e) => {
                                        updateFinalRowCell(rowIndex, cellIndex, { 
                                          calculationSource: e.target.value,
                                          calculationField: undefined
                                        });
                                      }}
                                      className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                    >
                                      <option value="">Select data source...</option>
                                      {calculationSources.map(source => (
                                        <option key={source.value} value={source.value}>
                                          {source.label} - {source.description}
                                        </option>
                                      ))}
                                    </select>
                                    <small className="text-xs text-blue-600 italic flex items-center gap-1">
                                      <Lightbulb className="w-3 h-3" /> Select which table/array to calculate from
                                    </small>
                                  </div>
                                  {cell.calculationSource && (
                                    <div className="space-y-2">
                                      <Label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                        <Type className="w-4 h-4" /> Field to Calculate
                                      </Label>
                                      <select
                                        value={cell.calculationField || ''}
                                        onChange={(e) => updateFinalRowCell(rowIndex, cellIndex, { calculationField: e.target.value })}
                                        className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                      >
                                        <option value="">Select field...</option>
                                        {getFieldsFromSource(cell.calculationSource).map(field => (
                                          <option key={field.value} value={field.value}>
                                            {field.label}
                                          </option>
                                        ))}
                                      </select>
                                      <small className="text-xs text-blue-600 italic flex items-center gap-1">
                                        <Lightbulb className="w-3 h-3" /> Choose which field to perform the calculation on
                                      </small>
                                      {cell.calculationType && (
                                        <div className={cn(
                                          "mt-3 p-3 rounded-md border transition-all",
                                          cell.calculationSource && cell.calculationField
                                            ? "bg-blue-100 border-blue-300" 
                                            : "bg-yellow-50 border-yellow-300"
                                        )}>
                                          <strong className={cn(
                                            "text-sm flex items-center gap-2",
                                            cell.calculationSource && cell.calculationField
                                              ? "text-blue-700" 
                                              : "text-yellow-700"
                                          )}>
                                            {cell.calculationSource && cell.calculationField
                                              ? <ClipboardList className="w-4 h-4" />
                                              : <AlertTriangle className="w-4 h-4" />} {getCalculationDescription(cell.calculationType, cell.calculationSource, cell.calculationField)}
                                            {!cell.calculationSource && ' - Please select a data source'}
                                            {cell.calculationSource && !cell.calculationField && ' - Please select a field'}
                                          </strong>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </Card>
                            )}

                            {cell.valueType === 'formula' && (
                              <div className="space-y-2">
                                <Label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                  <Sparkles className="w-4 h-4" /> Custom Formula
                                </Label>
                                <div className="flex gap-2">
                                  <Input
                                    type="text"
                                    value={cell.formula || ''}
                                    onChange={(e) => updateFinalRowCell(rowIndex, cellIndex, { formula: e.target.value })}
                                    placeholder="e.g., sum(items.rate) * header.exchangeRate"
                                    className="flex-1 font-mono text-sm border-blue-300 focus:ring-blue-500 focus:border-blue-500"
                                  />
                                  <Button
                                    type="button"
                                    onClick={() => setShowFormulaBuilder({ ...showFormulaBuilder, [`cell-${rowIndex}-${cellIndex}`]: !showFormulaBuilder[`cell-${rowIndex}-${cellIndex}`] })}
                                    className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 whitespace-nowrap"
                                  >
                                    🧮 {showFormulaBuilder[`cell-${rowIndex}-${cellIndex}`] ? 'Hide' : 'Show'} Builder
                                  </Button>
                                </div>
                                <small className="text-xs text-blue-600 italic">
                                  💡 Use the formula builder below or type directly
                                </small>
                                <FormulaBuilder
                                  formula={cell.formula || ''}
                                  onFormulaChange={(formula) => updateFinalRowCell(rowIndex, cellIndex, { formula })}
                                  id={`cell-${rowIndex}-${cellIndex}`}
                                />
                              </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-700">
                                  Alignment:
                                </Label>
                                <select
                                  value={cell.align || 'left'}
                                  onChange={(e) => updateFinalRowCell(rowIndex, cellIndex, { align: e.target.value as any })}
                                  className="w-full px-3 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                >
                                  <option value="left">Left</option>
                                  <option value="center">Center</option>
                                  <option value="right">Right</option>
                                </select>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-700">
                                  Column Span:
                                </Label>
                                <Input
                                  type="number"
                                  value={cell.colSpan || 1}
                                  min="1"
                                  onChange={(e) => updateFinalRowCell(rowIndex, cellIndex, { colSpan: parseInt(e.target.value) || 1 })}
                                  className="border-blue-200 focus:ring-blue-500 focus:border-blue-500"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-700">
                                  Font Size:
                                </Label>
                                <Input
                                  type="number"
                                  value={cell.fontSize || ''}
                                  min="8"
                                  onChange={(e) => updateFinalRowCell(rowIndex, cellIndex, { fontSize: e.target.value ? parseFloat(e.target.value) : undefined })}
                                  placeholder="Auto"
                                  className="border-blue-200 focus:ring-blue-500 focus:border-blue-500"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-700">
                                  Text Color:
                                </Label>
                                <input
                                  type="color"
                                  value={cell.color || '#000000'}
                                  onChange={(e) => updateFinalRowCell(rowIndex, cellIndex, { color: e.target.value })}
                                  className="w-full h-10 border border-blue-200 rounded-md cursor-pointer"
                                />
                              </div>
                            </div>

                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`bold-${rowIndex}-${cellIndex}`}
                                checked={cell.fontWeight === 'bold'}
                                onCheckedChange={(checked) => updateFinalRowCell(rowIndex, cellIndex, { fontWeight: checked ? 'bold' : 'normal' })}
                                className="border-blue-500"
                              />
                              <Label htmlFor={`bold-${rowIndex}-${cellIndex}`} className="text-sm font-medium cursor-pointer">
                                Bold
                              </Label>
                            </div>
                            </div>
                            )}
                          </Card>
                          );
                        })}
                      </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
          </TabsContent>

          <TabsContent value="style" className="p-6 space-y-6 m-0">
            <Card className="p-6 bg-gradient-to-b from-white to-blue-50 border-blue-200 shadow-sm">
              <h3 className="text-lg font-semibold text-blue-700 mb-6 pb-2 border-b-2 border-blue-200">Borders</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="border-color" className="text-sm font-semibold text-gray-700">
                    Border Color:
                  </Label>
                  <input
                    id="border-color"
                    type="color"
                    value={editedTable.borderColor || '#dddddd'}
                    onChange={(e) => updateTable({ borderColor: e.target.value })}
                    className="w-full h-10 border border-blue-200 rounded-md cursor-pointer"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="border-width" className="text-sm font-semibold text-gray-700">
                    Border Width:
                  </Label>
                  <Input
                    id="border-width"
                    type="number"
                    value={editedTable.borderWidth || 1}
                    min="0"
                    step="0.5"
                    onChange={(e) => updateTable({ borderWidth: parseFloat(e.target.value) || 1 })}
                    className="border-blue-200 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-b from-white to-blue-50 border-blue-200 shadow-sm">
              <h3 className="text-lg font-semibold text-blue-700 mb-6 pb-2 border-b-2 border-blue-200">Header</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="header-bg-color" className="text-sm font-semibold text-gray-700">
                    Background Color:
                  </Label>
                  <input
                    id="header-bg-color"
                    type="color"
                    value={editedTable.headerBackgroundColor || '#f0f0f0'}
                    onChange={(e) => updateTable({ headerBackgroundColor: e.target.value })}
                    className="w-full h-10 border border-blue-200 rounded-md cursor-pointer"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="header-text-color" className="text-sm font-semibold text-gray-700">
                    Text Color:
                  </Label>
                  <input
                    id="header-text-color"
                    type="color"
                    value={editedTable.headerTextColor || '#000000'}
                    onChange={(e) => updateTable({ headerTextColor: e.target.value })}
                    className="w-full h-10 border border-blue-200 rounded-md cursor-pointer"
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-b from-white to-blue-50 border-blue-200 shadow-sm">
              <h3 className="text-lg font-semibold text-blue-700 mb-6 pb-2 border-b-2 border-blue-200">Table Style</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cell-padding" className="text-sm font-semibold text-gray-700">
                      Cell Padding:
                    </Label>
                    <Input
                      id="cell-padding"
                      type="number"
                      value={editedTable.cellPadding || 10}
                      min="0"
                      step="1"
                      onChange={(e) => updateTable({ cellPadding: parseFloat(e.target.value) || 10 })}
                      className="border-blue-200 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="font-size" className="text-sm font-semibold text-gray-700">
                      Font Size:
                    </Label>
                    <Input
                      id="font-size"
                      type="number"
                      value={editedTable.fontSize || ''}
                      min="8"
                      step="1"
                      onChange={(e) => updateTable({ fontSize: e.target.value ? parseFloat(e.target.value) : undefined })}
                      placeholder="Auto"
                      className="border-blue-200 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="table-width" className="text-sm font-semibold text-gray-700">
                      Table Width:
                    </Label>
                    <Input
                      id="table-width"
                      type="number"
                      value={editedTable.tableWidth || ''}
                      min="100"
                      step="10"
                      onChange={(e) => updateTable({ tableWidth: e.target.value ? parseFloat(e.target.value) : undefined })}
                      placeholder="Auto"
                      className="border-blue-200 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="flex items-center space-x-2 pt-7">
                    <Checkbox
                      id="alternate-row-color"
                      checked={!!editedTable.alternateRowColor}
                      onCheckedChange={(checked) => updateTable({ alternateRowColor: checked ? '#f9f9f9' : undefined })}
                      className="border-blue-500"
                    />
                    <Label htmlFor="alternate-row-color" className="text-sm font-medium cursor-pointer">
                      Alternate Row Color
                    </Label>
                  </div>
                </div>
                {editedTable.alternateRowColor && (
                  <div className="space-y-2">
                    <Label htmlFor="alt-row-color" className="text-sm font-semibold text-gray-700">
                      Alternate Row Color:
                    </Label>
                    <input
                      id="alt-row-color"
                      type="color"
                      value={editedTable.alternateRowColor}
                      onChange={(e) => updateTable({ alternateRowColor: e.target.value })}
                      className="w-full h-10 border border-blue-200 rounded-md cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>
          </ScrollArea>
        </div>

        <DialogFooter className="px-6 py-4 bg-gradient-to-b from-blue-50 to-white border-t gap-2 flex-shrink-0">
          <Button onClick={handleCancel} variant="outline" className="border-gray-300 hover:bg-gray-50">
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-md">
            Save Changes
          </Button>
        </DialogFooter>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default TableEditorModal;

