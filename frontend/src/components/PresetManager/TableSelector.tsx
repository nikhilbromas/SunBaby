import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../services/api';
import type { TableInfo } from '../../services/types';
import './TableSelector.css';

interface TableSelectorProps {
  selectedTables: string[];
  onTableSelect: (tableName: string) => void;
  onTableDeselect: (tableName: string) => void;
}

const TableSelector: React.FC<TableSelectorProps> = ({
  selectedTables,
  onTableSelect,
  onTableDeselect
}) => {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTables();
  }, [searchTerm]);

  const loadTables = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getTables(searchTerm || undefined, 0, 100);
      setTables(response.tables);
    } catch (err: any) {
      setError(err.message || 'Failed to load data sources');
    } finally {
      setLoading(false);
    }
  };

  // Combine selected tables with API results, ensuring selected tables always appear
  const displayTables = useMemo(() => {
    const tableNames = new Set(tables.map(t => t.name.toLowerCase()));
    
    // Create placeholder entries for selected tables not in API results
    const missingSelectedTables: TableInfo[] = selectedTables
      .filter(name => !tableNames.has(name.toLowerCase()))
      .map(name => ({
        name,
        schemaName: 'dbo',
        type: 'table' as const,
        rowCount: undefined
      }));
    
    // If searching, filter to only show matching tables but always include selected
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchingTables = tables.filter(t => 
        t.name.toLowerCase().includes(searchLower) ||
        selectedTables.some(s => s.toLowerCase() === t.name.toLowerCase())
      );
      const matchingMissing = missingSelectedTables.filter(t =>
        t.name.toLowerCase().includes(searchLower) ||
        selectedTables.some(s => s.toLowerCase() === t.name.toLowerCase())
      );
      
      // Sort: selected tables first, then alphabetically
      return [...matchingMissing, ...matchingTables].sort((a, b) => {
        const aSelected = selectedTables.some(s => s.toLowerCase() === a.name.toLowerCase());
        const bSelected = selectedTables.some(s => s.toLowerCase() === b.name.toLowerCase());
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        return a.name.localeCompare(b.name);
      });
    }
    
    // No search - show selected first, then all tables
    const allTables = [...missingSelectedTables, ...tables];
    return allTables.sort((a, b) => {
      const aSelected = selectedTables.some(s => s.toLowerCase() === a.name.toLowerCase());
      const bSelected = selectedTables.some(s => s.toLowerCase() === b.name.toLowerCase());
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [tables, selectedTables, searchTerm]);

  // Case-insensitive check for table selection
  const isTableSelected = (tableName: string): boolean => {
    return selectedTables.some(s => s.toLowerCase() === tableName.toLowerCase());
  };

  const handleTableClick = (tableName: string) => {
    if (isTableSelected(tableName)) {
      // Find the exact name in selectedTables (case-insensitive match)
      const exactName = selectedTables.find(s => s.toLowerCase() === tableName.toLowerCase());
      if (exactName) {
        onTableDeselect(exactName);
      }
    } else {
      onTableSelect(tableName);
    }
  };

  return (
    <div className="table-selector">
      <div className="table-selector-header">
        <h3>Data Sources</h3>
        <input
          type="text"
          className="table-search"
          placeholder="Search data sources..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading && <div className="table-selector-loading">Loading data sources...</div>}
      {error && <div className="table-selector-error">{error}</div>}

      {!loading && !error && (
        <div className="table-list">
          {displayTables.length === 0 ? (
            <div className="table-list-empty">
              <div className="empty-icon">📋</div>
              <p>No data sources found</p>
              <span>Try a different search term</span>
            </div>
          ) : (
            displayTables.map((table) => {
              const selected = isTableSelected(table.name);
              return (
                <div
                  key={table.name}
                  className={`table-item ${selected ? 'selected' : ''}`}
                  onClick={() => handleTableClick(table.name)}
                >
                  <span className="table-icon">
                    {table.type === 'table' ? '📋' : '👁️'}
                  </span>
                  <div className="table-info">
                    <span className="table-name">{table.name}</span>
                    <span className="table-type">
                      {table.type === 'table' ? 'Table' : 'View'}
                    </span>
                  </div>
                  {table.rowCount !== undefined && table.rowCount !== null && (
                    <span className="table-rows">{table.rowCount.toLocaleString()} records</span>
                  )}
                  {selected && (
                    <span className="selected-badge">✓ Selected</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {selectedTables.length > 0 && (
        <div className="selected-summary">
          <span className="selected-count">{selectedTables.length} selected</span>
        </div>
      )}
    </div>
  );
};

export default TableSelector;
