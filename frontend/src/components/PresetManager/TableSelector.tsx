import React, { useState, useEffect } from 'react';
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

  const handleTableClick = (tableName: string) => {
    if (selectedTables.includes(tableName)) {
      onTableDeselect(tableName);
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
          {tables.length === 0 ? (
            <div className="table-list-empty">
              <div className="empty-icon">📋</div>
              <p>No data sources found</p>
              <span>Try a different search term</span>
            </div>
          ) : (
            tables.map((table) => (
              <div
                key={table.name}
                className={`table-item ${selectedTables.includes(table.name) ? 'selected' : ''}`}
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
                {selectedTables.includes(table.name) && (
                  <span className="selected-badge">✓ Selected</span>
                )}
              </div>
            ))
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
