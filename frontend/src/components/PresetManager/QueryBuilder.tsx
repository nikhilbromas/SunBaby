import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { QueryState, SimpleColumn, ColumnInfo } from '../../services/types';
import { generateSQL } from '../../utils/sqlGenerator';
import { parseSQL } from '../../utils/sqlParser';
import apiClient from '../../services/api';
import TableSelector from './TableSelector';
import ColumnSelector from './ColumnSelector';
import JoinBuilder from './JoinBuilder';
import WhereBuilder from './WhereBuilder';
import GroupByBuilder from './GroupByBuilder';
import OrderByBuilder from './OrderByBuilder';
import ExpressionBuilder from './ExpressionBuilder';
import WindowFunctionBuilder from './WindowFunctionBuilder';
import './QueryBuilder.css';

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
  { id: 'preview', label: 'Preview', icon: '👁️', description: 'Review and apply your selection' },
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
  const [generatedSQL, setGeneratedSQL] = useState('');
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const parsedInitial = useRef(false);
  
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
        setQueryState({
          tables: result.state.tables || [],
          joins: result.state.joins || [],
          columns: result.state.columns || [],
          where: result.state.where || [],
          groupBy: result.state.groupBy || [],
          orderBy: result.state.orderBy || []
        });
        
        // If we parsed some data, go to preview tab
        if (result.state.tables && result.state.tables.length > 0) {
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
    <div className="query-builder">
      {/* Header */}
      <div className="query-builder-header">
        <h2>Query Builder</h2>
        <div className="query-builder-actions">
          <button onClick={onCancel} className="cancel-btn">Cancel</button>
          <button onClick={() => onApply(generatedSQL)} className="apply-btn">
            ✓ Apply Query
          </button>
        </div>
      </div>

      {/* Parse Warnings */}
      {parseWarnings.length > 0 && (
        <div className="parse-warnings">
          <div className="parse-warnings-header">
            <span>⚠️ Some parts of the existing query couldn't be fully parsed:</span>
            <button onClick={() => setParseWarnings([])} className="dismiss-btn">✕</button>
          </div>
          <ul>
            {parseWarnings.slice(0, 3).map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
            {parseWarnings.length > 3 && (
              <li>...and {parseWarnings.length - 3} more</li>
            )}
          </ul>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="query-tabs">
        {TABS.map((tab, index) => {
          const status = getTabStatus(tab.id);
          return (
            <button
              key={tab.id}
              className={`query-tab ${status === 'active' ? 'active' : ''} ${status === 'completed' ? 'completed' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-number">
                {status === 'completed' ? '' : index + 1}
              </span>
              <span className="tab-icon">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content */}
      <div className="query-builder-content">
        <div className="query-builder-left">
          {/* Tab Header */}
          <div className="tab-panel-header">
            <h3>{currentTab.icon} {currentTab.label}</h3>
            <p>{currentTab.description}</p>
          </div>

          {/* Tab: Select Tables */}
          {activeTab === 'tables' && (
            <div className="builder-section">
              <TableSelector
                selectedTables={availableTables}
                onTableSelect={handleTableSelect}
                onTableDeselect={handleTableDeselect}
              />
            </div>
          )}

          {/* Tab: Choose Columns */}
          {activeTab === 'columns' && (
            <div className="builder-section">
              {columnsLoading && (
                <div className="columns-loading-indicator">Loading columns...</div>
              )}
              {showExpressionBuilder ? (
                <ExpressionBuilder
                  availableColumns={allAvailableColumns}
                  onAdd={(col) => {
                    setQueryState(prev => ({
                      ...prev,
                      columns: [...prev.columns, col]
                    }));
                    setShowExpressionBuilder(false);
                  }}
                  onCancel={() => setShowExpressionBuilder(false)}
                />
              ) : showWindowBuilder ? (
                <WindowFunctionBuilder
                  availableColumns={allAvailableColumns}
                  onAdd={(windowFunc) => {
                    setQueryState(prev => ({
                      ...prev,
                      columns: [...prev.columns, windowFunc]
                    }));
                    setShowWindowBuilder(false);
                  }}
                  onCancel={() => setShowWindowBuilder(false)}
                />
              ) : (
                <ColumnSelector
                  selectedTables={availableTables}
                  selectedColumns={queryState.columns.filter(c => c.type === 'simple') as SimpleColumn[]}
                  tableColumns={allTableColumns}
                  onChange={(columns) => {
                    const otherColumns = queryState.columns.filter(c => c.type !== 'simple');
                    setQueryState(prev => ({
                      ...prev,
                      columns: [...columns, ...otherColumns]
                    }));
                  }}
                  onAddCalculated={() => setShowExpressionBuilder(true)}
                  onAddWindow={() => setShowWindowBuilder(true)}
                />
              )}
            </div>
          )}

          {/* Tab: Link Tables */}
          {activeTab === 'links' && (
            <div className="builder-section">
              <JoinBuilder
                joins={queryState.joins}
                availableTables={availableTables}
                availableColumns={allAvailableColumns}
                onChange={(joins) => setQueryState(prev => ({ ...prev, joins }))}
              />
            </div>
          )}

          {/* Tab: Filters */}
          {activeTab === 'filters' && (
            <>
              <div className="builder-section" style={{ marginBottom: '16px' }}>
                <WhereBuilder
                  conditions={queryState.where}
                  availableColumns={allAvailableColumns}
                  onChange={(where) => setQueryState(prev => ({ ...prev, where }))}
                />
              </div>

              <div className="builder-section" style={{ marginBottom: '16px' }}>
                <GroupByBuilder
                  groupBy={queryState.groupBy}
                  availableColumns={allAvailableColumns}
                  onChange={(groupBy) => setQueryState(prev => ({ ...prev, groupBy }))}
                />
              </div>

              <div className="builder-section">
                <OrderByBuilder
                  orderBy={queryState.orderBy}
                  availableColumns={allAvailableColumns}
                  onChange={(orderBy) => setQueryState(prev => ({ ...prev, orderBy }))}
                />
              </div>
            </>
          )}

          {/* Tab: Preview */}
          {activeTab === 'preview' && (
            <div className="builder-section">
              <div className="builder-section-content">
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 12px 0', color: '#1e293b' }}>📊 Summary</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                    <div className="item-card">
                      <span className="item-icon">📋</span>
                      <span className="item-name">Tables: {queryState.tables.length}</span>
                    </div>
                    <div className="item-card">
                      <span className="item-icon">✏️</span>
                      <span className="item-name">Fields: {queryState.columns.length}</span>
                    </div>
                    <div className="item-card">
                      <span className="item-icon">🔗</span>
                      <span className="item-name">Links: {queryState.joins.length}</span>
                    </div>
                    <div className="item-card">
                      <span className="item-icon">🔍</span>
                      <span className="item-name">Filters: {queryState.where.length}</span>
                    </div>
                  </div>
                </div>

                <h4 style={{ margin: '0 0 12px 0', color: '#1e293b' }}>📄 Generated Query</h4>
                <pre style={{
                  background: '#1e293b',
                  color: '#e2e8f0',
                  padding: '16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  overflow: 'auto',
                  maxHeight: '300px'
                }}>
                  {generatedSQL || 'SELECT *'}
                </pre>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="tab-navigation">
            <button
              className="nav-btn prev"
              onClick={goToPrevTab}
              disabled={currentTabIndex === 0}
            >
              ← Previous
            </button>
            {currentTabIndex < TABS.length - 1 ? (
              <button className="nav-btn next" onClick={goToNextTab}>
                Next →
              </button>
            ) : (
              <button className="nav-btn next" onClick={() => onApply(generatedSQL)}>
                ✓ Apply Query
              </button>
            )}
          </div>
        </div>

        {/* SQL Preview Panel */}
        <div className="query-builder-right">
          <div className="sql-preview">
            <div className="sql-preview-header">
              <h3>Live Preview</h3>
              <button
                onClick={() => navigator.clipboard.writeText(generatedSQL)}
                className="copy-btn"
              >
                📋 Copy
              </button>
            </div>
            <pre className="sql-preview-content">{generatedSQL || 'SELECT *'}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QueryBuilder;
