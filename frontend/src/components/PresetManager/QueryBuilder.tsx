import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { QueryState, SimpleColumn, ColumnInfo, CalculatedColumn, WindowFunction } from '../../services/types';
import { generateSQL } from '../../utils/sqlGenerator';
import { parseSQL } from '../../utils/sqlParser';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import apiClient from '../../services/api';
import TableSelector from './TableSelector';
import ColumnSelector from './ColumnSelector';
import JoinBuilder from './JoinBuilder';
import WhereBuilder from './WhereBuilder';
import GroupByBuilder from './GroupByBuilder';
import OrderByBuilder from './OrderByBuilder';
import ExpressionBuilder from './ExpressionBuilder';
import WindowFunctionBuilder from './WindowFunctionBuilder';
import { Table, Columns, Link2, Filter } from "lucide-react";


interface QueryBuilderProps {
  initialSQL?: string;
  onApply: (sql: string) => void;
  onCancel: () => void;
}

type TabId = 'tables' | 'columns' | 'links' | 'filters' | 'preview';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
  description: string;
}

const TABS: Tab[] = [
  { id: 'tables', label: 'Select Data', icon: '📋', description: 'Choose which tables or data sources to include' },
  { id: 'columns', label: 'Choose Fields', icon: '✏️', description: 'Select the fields (columns) you want to display' },
  { id: 'links', label: 'Link Data', icon: '🔗', description: 'Connect related tables together' },
  { id: 'filters', label: 'Add Filters', icon: '🔍', description: 'Filter and sort your results' },
  { id: 'preview', label: 'Preview', icon: '', description: 'Review and apply your selection' },
];

const QueryBuilder: React.FC<QueryBuilderProps> = ({
  initialSQL,
  onApply,
  onCancel
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('tables');
  const [queryState, setQueryState] = useState<QueryState>({
    tables: [],
    joins: [],
    columns: [],
    where: [],
    groupBy: [],
    orderBy: []
  });

  const [showExpressionBuilder, setShowExpressionBuilder] = useState(false);
  const [showWindowBuilder, setShowWindowBuilder] = useState(false);
  const [editingCalculated, setEditingCalculated] = useState<{ column: CalculatedColumn; index: number } | null>(null);
  const [editingWindow, setEditingWindow] = useState<{ column: WindowFunction; index: number } | null>(null);
  const [generatedSQL, setGeneratedSQL] = useState('');
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const parsedInitial = useRef(false);
  
  // Extract parameters from generated SQL (only those actually used)
  const extractParametersFromSQL = useCallback((sql: string): string[] => {
    if (!sql) return [];
    const paramMap = new Map<string, string>(); // lowercase -> original case
    const matches = sql.matchAll(/@(\w+)/g);
    for (const match of matches) {
      const paramName = match[1];
      const lowerName = paramName.toLowerCase();
      if (!paramMap.has(lowerName)) {
        paramMap.set(lowerName, paramName);
      }
    }
    return Array.from(paramMap.values());
  }, []);
  
  const queryParameters = useMemo(() => {
    return extractParametersFromSQL(generatedSQL);
  }, [generatedSQL, extractParametersFromSQL]);
  
  // Centralized column storage for ALL tables (FROM + JOINed tables)
  const [allTableColumns, setAllTableColumns] = useState<Record<string, ColumnInfo[]>>({});
  const loadedTablesRef = useRef<Set<string>>(new Set());
  const [columnsLoading, setColumnsLoading] = useState(false);

  // Load columns for specified tables
  const loadColumnsForTables = useCallback(async (tableNames: string[]) => {
    const tablesToLoad = tableNames.filter(t => !loadedTablesRef.current.has(t));
    if (tablesToLoad.length === 0) return;
    
    setColumnsLoading(true);
    const newColumns: Record<string, ColumnInfo[]> = {};
    
    for (const tableName of tablesToLoad) {
      try {
        const response = await apiClient.getTableColumns(tableName);
        newColumns[tableName] = response.columns;
        loadedTablesRef.current.add(tableName);
      } catch (error) {
        console.error(`Failed to load columns for ${tableName}`, error);
        newColumns[tableName] = [];
        loadedTablesRef.current.add(tableName);
      }
    }
    
    if (Object.keys(newColumns).length > 0) {
      setAllTableColumns(prev => ({ ...prev, ...newColumns }));
    }
    setColumnsLoading(false);
  }, []);

  // Get all table names (FROM tables + JOINed tables)
  const getAllTableNames = useCallback((): string[] => {
    const fromTables = queryState.tables.map(t => t.name);
    const joinTables = queryState.joins.map(j => j.table).filter(t => t && t.trim());
    const allNames = [...new Set([...fromTables, ...joinTables])];
    return allNames;
  }, [queryState.tables, queryState.joins]);

  // Load columns when tables or joins change
  useEffect(() => {
    const allTableNames = getAllTableNames();
    
    // Remove columns for tables that are no longer selected
    const currentTables = new Set(allTableNames);
    const tablesToRemove = Array.from(loadedTablesRef.current).filter(t => !currentTables.has(t));
    
    if (tablesToRemove.length > 0) {
      tablesToRemove.forEach(t => loadedTablesRef.current.delete(t));
      setAllTableColumns(prev => {
        const updated = { ...prev };
        tablesToRemove.forEach(t => delete updated[t]);
        return updated;
      });
    }
    
    // Load columns for new tables
    if (allTableNames.length > 0) {
      loadColumnsForTables(allTableNames);
    }
  }, [queryState.tables, queryState.joins, getAllTableNames, loadColumnsForTables]);

  // Parse initial SQL when provided
  useEffect(() => {
    if (initialSQL && initialSQL.trim() && !parsedInitial.current) {
      parsedInitial.current = true;
      const result = parseSQL(initialSQL);
      
      if (result.state) {
        // Merge FROM tables and JOIN tables into the tables list
        // This ensures all tables appear in TableSelector
        const fromTables = result.state.tables || [];
        const joinTables = (result.state.joins || [])
          .filter(j => j.table && j.table.trim())
          .map(j => ({ name: j.table, alias: j.alias }));
        
        // Deduplicate tables (case-insensitive)
        const tableMap = new Map<string, { name: string; alias?: string }>();
        [...fromTables, ...joinTables].forEach(t => {
          const key = t.name.toLowerCase();
          if (!tableMap.has(key)) {
            tableMap.set(key, t);
          }
        });
        const allTables = Array.from(tableMap.values());
        
        setQueryState({
          tables: allTables,
          joins: result.state.joins || [],
          columns: result.state.columns || [],
          where: result.state.where || [],
          groupBy: result.state.groupBy || [],
          orderBy: result.state.orderBy || []
        });
        
        // If we parsed some data, go to preview tab
        if (allTables.length > 0) {
          setActiveTab('preview');
        }
      }
      
      if (result.warnings.length > 0) {
        setParseWarnings(result.warnings);
      }
      
      // If parsing failed, keep the original SQL in generatedSQL
      if (!result.success || result.errors.length > 0) {
        setGeneratedSQL(initialSQL);
      }
    }
  }, [initialSQL]);

  // Generate SQL whenever query state changes
  useEffect(() => {
    try {
      const sql = generateSQL(queryState);
      setGeneratedSQL(sql);
    } catch (error) {
      console.error('Error generating SQL:', error);
    }
  }, [queryState]);

  const handleTableSelect = (tableName: string) => {
    setQueryState(prev => ({
      ...prev,
      tables: [...prev.tables, { name: tableName }]
    }));
  };

  const handleTableDeselect = (tableName: string) => {
    setQueryState(prev => ({
      ...prev,
      tables: prev.tables.filter(t => t.name !== tableName),
      columns: prev.columns.filter(c => 
        c.type !== 'simple' || (c as SimpleColumn).table !== tableName
      )
    }));
  };

  const availableTables = queryState.tables.map(t => t.name);
  
  // Get all tables including joined tables
  const allTables = getAllTableNames();
  
  // Compute ALL available columns from all tables (for JoinBuilder, WhereBuilder, etc.)
  const allAvailableColumns = React.useMemo(() => {
    const columns: string[] = [];
    
    // Add columns from all tables in Table.Column format
    for (const tableName of allTables) {
      const tableColList = allTableColumns[tableName] || [];
      for (const col of tableColList) {
        columns.push(`${tableName}.${col.name}`);
      }
    }
    
    // Also include any groupBy columns that might not be in the table columns
    for (const gb of queryState.groupBy) {
      if (!columns.includes(gb)) {
        columns.push(gb);
      }
    }
    
    return columns;
  }, [allTables, allTableColumns, queryState.groupBy]);
  

  const getTabStatus = (tabId: TabId): 'pending' | 'active' | 'completed' => {
    if (tabId === activeTab) return 'active';
    
    switch (tabId) {
      case 'tables':
        return queryState.tables.length > 0 ? 'completed' : 'pending';
      case 'columns':
        return queryState.columns.length > 0 ? 'completed' : 'pending';
      case 'links':
        return queryState.joins.length > 0 || queryState.tables.length <= 1 ? 'completed' : 'pending';
      case 'filters':
        return 'completed'; // Filters are optional
      case 'preview':
        return 'pending';
      default:
        return 'pending';
    }
  };

  const goToNextTab = () => {
    const currentIndex = TABS.findIndex(t => t.id === activeTab);
    if (currentIndex < TABS.length - 1) {
      setActiveTab(TABS[currentIndex + 1].id);
    }
  };

  const goToPrevTab = () => {
    const currentIndex = TABS.findIndex(t => t.id === activeTab);
    if (currentIndex > 0) {
      setActiveTab(TABS[currentIndex - 1].id);
    }
  };

  const currentTabIndex = TABS.findIndex(t => t.id === activeTab);
  const currentTab = TABS[currentTabIndex];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-gradient-to-r bg-black text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-black text-white rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">Query Builder</h2>
                <p className="text-blue-100 text-sm">Build your SQL query step by step</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={onCancel}
                variant="outline"
                className="bg-white text-black   hover:bg-black hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={() => onApply(generatedSQL)}
                className="bg-white text-black hover:bg-black hover:text-white font-semibold shadow-md"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Apply Query
              </Button>
            </div>
          </div>
        </div>
      </div>

      {parseWarnings.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="font-medium text-amber-900 text-sm mb-2">Some parts of the existing query couldn't be fully parsed:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-amber-800">
                    {parseWarnings.slice(0, 3).map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                    {parseWarnings.length > 3 && (
                      <li>...and {parseWarnings.length - 3} more</li>
                    )}
                  </ul>
                </div>
              </div>
              <button
                onClick={() => setParseWarnings([])}
                className="flex-shrink-0 text-amber-600 hover:text-amber-900 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-black p-4 text-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map((tab, index) => {
              const status = getTabStatus(tab.id);
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap relative",
                    status === 'active'
                      ? "border-white text-black bg-white"
                      : status === 'completed'
                      ? "border-white text-white bg-black hover:bg-black"
                      : "border-transparent text-black bg-white hover:bg-white"
                  )}
                >
                  {status === 'completed' ? (
                    <div className="w-5 h-5   rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : tab.id === 'preview' ? (
                    <svg className={cn("w-5 h-5 flex-shrink-0", status === 'active' ? "text-black" : "text-white")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0",
                      status === 'active'
                        ? "bg-black text-white"
                        : "bg-white text-black"
                    )}>
                      {index + 1}
                    </div>
                  )}
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-black text-white">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-white mb-1">{currentTab.label}</h3>
              <p className="text-sm text-white">{currentTab.description}</p>
            </div>

            {activeTab === 'tables' && (
              <TableSelector
                selectedTables={availableTables}
                onTableSelect={handleTableSelect}
                onTableDeselect={handleTableDeselect}
              />
            )}

            {activeTab === 'columns' && !showExpressionBuilder && !showWindowBuilder && columnsLoading && (
              <div className="flex items-center justify-center py-8 text-slate-500">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="text-sm font-medium">Loading columns...</p>
                </div>
              </div>
            )}

            {activeTab === 'columns' && (
              <>
                {showExpressionBuilder ? (
                  <ExpressionBuilder
                  availableColumns={allAvailableColumns}
                  initialValue={editingCalculated?.column}
                  onAdd={(col) => {
                    if (editingCalculated) {
                      // Update existing
                      setQueryState(prev => ({
                        ...prev,
                        columns: prev.columns.map((c, i) => 
                          i === editingCalculated.index ? col : c
                        )
                      }));
                      setEditingCalculated(null);
                    } else {
                      // Add new
                      setQueryState(prev => ({
                        ...prev,
                        columns: [...prev.columns, col]
                      }));
                    }
                    setShowExpressionBuilder(false);
                  }}
                  onUpdate={(col) => {
                    if (editingCalculated) {
                      setQueryState(prev => ({
                        ...prev,
                        columns: prev.columns.map((c, i) => 
                          i === editingCalculated.index ? col : c
                        )
                      }));
                      setEditingCalculated(null);
                      setShowExpressionBuilder(false);
                    }
                  }}
                  onCancel={() => {
                    setShowExpressionBuilder(false);
                    setEditingCalculated(null);
                  }}
                />
              ) : showWindowBuilder ? (
                <WindowFunctionBuilder
                  availableColumns={allAvailableColumns}
                  initialValue={editingWindow?.column}
                  onAdd={(windowFunc) => {
                    if (editingWindow) {
                      // Update existing
                      setQueryState(prev => ({
                        ...prev,
                        columns: prev.columns.map((c, i) => 
                          i === editingWindow.index ? windowFunc : c
                        )
                      }));
                      setEditingWindow(null);
                    } else {
                      // Add new
                      setQueryState(prev => ({
                        ...prev,
                        columns: [...prev.columns, windowFunc]
                      }));
                    }
                    setShowWindowBuilder(false);
                  }}
                  onCancel={() => {
                    setShowWindowBuilder(false);
                    setEditingWindow(null);
                  }}
                />
              ) : (
                <ColumnSelector
                  selectedTables={availableTables}
                  selectedColumns={queryState.columns.filter(c => c.type === 'simple') as SimpleColumn[]}
                  calculatedColumns={queryState.columns.filter(c => c.type === 'calculated') as CalculatedColumn[]}
                  windowColumns={queryState.columns.filter(c => c.type === 'window') as WindowFunction[]}
                  tableColumns={allTableColumns}
                  onChange={(columns) => {
                    const otherColumns = queryState.columns.filter(c => c.type !== 'simple');
                    setQueryState(prev => ({
                      ...prev,
                      columns: [...columns, ...otherColumns]
                    }));
                  }}
                  onCalculatedChange={(columns) => {
                    const otherColumns = queryState.columns.filter(c => c.type !== 'calculated');
                    setQueryState(prev => ({
                      ...prev,
                      columns: [...otherColumns, ...columns]
                    }));
                  }}
                  onWindowChange={(columns) => {
                    const otherColumns = queryState.columns.filter(c => c.type !== 'window');
                    setQueryState(prev => ({
                      ...prev,
                      columns: [...otherColumns, ...columns]
                    }));
                  }}
                  onAddCalculated={() => {
                    setEditingCalculated(null);
                    setShowExpressionBuilder(true);
                  }}
                  onAddWindow={() => {
                    setEditingWindow(null);
                    setShowWindowBuilder(true);
                  }}
                  onEditCalculated={(col, index) => {
                    // Find the actual index in queryState.columns
                    const actualIndex = queryState.columns.findIndex((c, i) => {
                      let calcIndex = 0;
                      for (let j = 0; j < i; j++) {
                        if (queryState.columns[j].type === 'calculated') calcIndex++;
                      }
                      return c.type === 'calculated' && calcIndex === index;
                    });
                    if (actualIndex >= 0) {
                      setEditingCalculated({ column: col, index: actualIndex });
                      setShowExpressionBuilder(true);
                    }
                  }}
                  onEditWindow={(col, index) => {
                    // Find the actual index in queryState.columns
                    const actualIndex = queryState.columns.findIndex((c, i) => {
                      let windowIndex = 0;
                      for (let j = 0; j < i; j++) {
                        if (queryState.columns[j].type === 'window') windowIndex++;
                      }
                      return c.type === 'window' && windowIndex === index;
                    });
                    if (actualIndex >= 0) {
                      setEditingWindow({ column: col, index: actualIndex });
                      setShowWindowBuilder(true);
                    }
                  }}
                />
              )}
            </>
            )}

            {activeTab === 'links' && (
              <JoinBuilder
                joins={queryState.joins}
                availableTables={availableTables}
                availableColumns={allAvailableColumns}
                onChange={(joins) => setQueryState(prev => ({ ...prev, joins }))}
              />
            )}

            {activeTab === 'filters' && (
              <div className="space-y-6">
                <WhereBuilder
                  conditions={queryState.where}
                  availableColumns={allAvailableColumns}
                  onChange={(where) => setQueryState(prev => ({ ...prev, where }))}
                />

                <GroupByBuilder
                  groupBy={queryState.groupBy}
                  availableColumns={allAvailableColumns}
                  onChange={(groupBy) => setQueryState(prev => ({ ...prev, groupBy }))}
                />

                <OrderByBuilder
                  orderBy={queryState.orderBy}
                  availableColumns={allAvailableColumns}
                  onChange={(orderBy) => setQueryState(prev => ({ ...prev, orderBy }))}
                />
              </div>
            )}

            {activeTab === 'preview' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-base font-semibold text-slate-900 mb-4">Summary</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
                    <Table className="mx-auto mb-2 h-7 w-7 text-slate-600" />
                      <div className="text-2xl font-bold text-slate-900">{queryState.tables.length}</div>
                      <div className="text-xs text-slate-600 mt-1">Tables</div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
                    <Columns className="mx-auto mb-2 h-7 w-7 text-slate-600" />
                      <div className="text-2xl font-bold text-slate-900">{queryState.columns.length}</div>
                      <div className="text-xs text-slate-600 mt-1">Fields</div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
                    <Link2 className="mx-auto mb-2 h-7 w-7 text-slate-600" />
                      <div className="text-2xl font-bold text-slate-900">{queryState.joins.length}</div>
                      <div className="text-xs text-slate-600 mt-1">Links</div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
                    <Filter className="mx-auto mb-2 h-7 w-7 text-slate-600" />
                      <div className="text-2xl font-bold text-slate-900">{queryState.where.length}</div>
                      <div className="text-xs text-slate-600 mt-1">Filters</div>
                    </div>
                  </div>
                </div>

                {queryParameters.length > 0 && (
                  <div>
                    <h4 className="text-base font-semibold text-slate-900 mb-4">Required Parameters</h4>
                    <div className="bg-white border border-slate-200 rounded-lg p-4">
                      <div className="flex flex-wrap gap-2">
                        {queryParameters.map((param: string) => (
                          <span key={param} className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium">
                            @{param}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-base font-semibold text-slate-900">Generated Query</h4>
                    <Button
                      onClick={() => navigator.clipboard.writeText(generatedSQL)}
                      variant="outline"
                      size="sm"
                      className="border-slate-300 text-slate-700"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </Button>
                  </div>
                  <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-auto max-h-96 font-mono leading-relaxed">
                    {generatedSQL || 'SELECT *'}
                  </pre>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-8 pt-6 border-t border-slate-200">
              <Button
                onClick={goToPrevTab}
                disabled={currentTabIndex === 0}
                variant="outline"
                className="border-slate-300 text-black bg-white hover:bg-black hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Previous
              </Button>
              {currentTabIndex < TABS.length - 1 ? (
                <Button onClick={goToNextTab} className="ml-auto bg-white text-black hover:bg-black hover:text-white">
                  Next
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Button>
              ) : (
                <Button onClick={() => onApply(generatedSQL)} className="ml-auto bg-blue-600 text-white hover:bg-blue-700 font-semibold">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Apply Query
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="hidden lg:block w-96 border-l border-slate-200 bg-white overflow-y-auto">
          <div className="sticky top-0 bg-black border-b border-slate-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Live Preview</h3>
              <Button
                onClick={() => navigator.clipboard.writeText(generatedSQL)}
                variant="outline"
                size="sm"
                className="border-slate-300 text-slate-700"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </Button>
            </div>
          </div>
          <div className="p-4 bg-black text-white">
            <pre className="bg-slate-900 text-black bg-white p-3 rounded-lg text-xs overflow-auto font-mono leading-relaxed">
              {generatedSQL || 'SELECT *'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QueryBuilder;


