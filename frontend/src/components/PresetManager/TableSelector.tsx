import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../services/api';
import type { TableInfo } from '../../services/types';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

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
    <div className="space-y-4">
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-900">Data Sources</h3>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            placeholder="Search data sources..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8 text-slate-500">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-sm font-medium">Loading data sources...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-3">
          <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span className="text-sm">{error}</span>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="border border-slate-200 rounded-lg bg-white divide-y divide-slate-200 max-h-96 overflow-y-auto">
            {displayTables.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-900 mb-1">No data sources found</p>
                <span className="text-xs text-slate-500">Try a different search term</span>
              </div>
            ) : (
              displayTables.map((table) => {
                const selected = isTableSelected(table.name);
                return (
                  <div
                    key={table.name}
                    onClick={() => handleTableClick(table.name)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors",
                      selected 
                        ? "bg-blue-50 hover:bg-blue-100" 
                        : "hover:bg-slate-50"
                    )}
                  >
                    <div className={cn(
                      "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
                      selected ? "bg-blue-100" : "bg-slate-100"
                    )}>
                      <svg 
                        className={cn("w-6 h-6", selected ? "text-blue-600" : "text-slate-600")} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        {table.type === 'table' ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        )}
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-sm font-medium truncate",
                          selected ? "text-blue-900" : "text-slate-900"
                        )}>
                          {table.name}
                        </span>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full flex-shrink-0",
                          selected 
                            ? "bg-blue-100 text-blue-700" 
                            : "bg-slate-200 text-slate-600"
                        )}>
                          {table.type === 'table' ? 'Table' : 'View'}
                        </span>
                      </div>
                      {table.rowCount !== undefined && table.rowCount !== null && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {table.rowCount.toLocaleString()} records
                        </p>
                      )}
                    </div>
                    {selected && (
                      <div className="flex-shrink-0">
                        <div className="flex items-center justify-center w-6 h-6 bg-blue-600 rounded-full">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {selectedTables.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-blue-900">
                  {selectedTables.length} {selectedTables.length === 1 ? 'source' : 'sources'} selected
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TableSelector;
