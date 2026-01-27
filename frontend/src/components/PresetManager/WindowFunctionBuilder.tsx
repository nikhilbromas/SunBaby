import React, { useState } from 'react';
import type { WindowFunction, WindowFunctionType } from '../../services/types';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WindowFunctionBuilderProps {
  availableColumns: string[];
  initialValue?: WindowFunction;
  onAdd: (windowFunc: WindowFunction) => void;
  onCancel: () => void;
}

// User-friendly function descriptions
const WINDOW_FUNCTION_INFO: Record<WindowFunctionType, { label: string; description: string; category: string }> = {
  'ROW_NUMBER': { label: 'Row Number', description: 'Assigns a unique number to each row (1, 2, 3...)', category: 'Ranking' },
  'RANK': { label: 'Rank', description: 'Assigns rank with gaps for ties (1, 2, 2, 4...)', category: 'Ranking' },
  'DENSE_RANK': { label: 'Dense Rank', description: 'Assigns rank without gaps (1, 2, 2, 3...)', category: 'Ranking' },
  'NTILE': { label: 'Split into Groups', description: 'Divides rows into equal groups', category: 'Ranking' },
  'SUM': { label: 'Running Sum', description: 'Calculates running total', category: 'Running Totals' },
  'AVG': { label: 'Running Average', description: 'Calculates running average', category: 'Running Totals' },
  'COUNT': { label: 'Running Count', description: 'Calculates running count', category: 'Running Totals' },
  'MIN': { label: 'Running Minimum', description: 'Tracks the lowest value so far', category: 'Running Totals' },
  'MAX': { label: 'Running Maximum', description: 'Tracks the highest value so far', category: 'Running Totals' },
  'LEAD': { label: 'Next Row Value', description: 'Gets value from the next row', category: 'Row Navigation' },
  'LAG': { label: 'Previous Row Value', description: 'Gets value from the previous row', category: 'Row Navigation' },
  'FIRST_VALUE': { label: 'First Value', description: 'Gets the first value in the group', category: 'Row Navigation' },
  'LAST_VALUE': { label: 'Last Value', description: 'Gets the last value in the group', category: 'Row Navigation' }
};

const WINDOW_FUNCTIONS: WindowFunctionType[] = [
  'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'NTILE',
  'SUM', 'AVG', 'COUNT', 'MIN', 'MAX',
  'LEAD', 'LAG', 'FIRST_VALUE', 'LAST_VALUE'
];

const WindowFunctionBuilder: React.FC<WindowFunctionBuilderProps> = ({
  availableColumns,
  initialValue,
  onAdd,
  onCancel
}) => {
  const [selectedFunction, setSelectedFunction] = useState<WindowFunctionType>(
    initialValue?.function || 'ROW_NUMBER'
  );
  const [alias, setAlias] = useState(initialValue?.alias || '');
  const [usePartitionBy, setUsePartitionBy] = useState(
    (initialValue?.partitionBy && initialValue.partitionBy.length > 0) || false
  );
  const [partitionColumns, setPartitionColumns] = useState<string[]>(
    initialValue?.partitionBy || []
  );
  const [useOrderBy, setUseOrderBy] = useState<boolean>(
    (initialValue?.orderBy && initialValue.orderBy.length > 0) || true
  );
  const [orderByItems, setOrderByItems] = useState<{ column: string; direction: 'ASC' | 'DESC' }[]>(
    initialValue?.orderBy || [
      { column: availableColumns[0] || '', direction: 'ASC' }
    ]
  );

  const handleAdd = () => {
    const windowFunc: WindowFunction = {
      type: 'window',
      function: selectedFunction,
      alias: alias || selectedFunction.toLowerCase(),
      partitionBy: usePartitionBy ? partitionColumns : undefined,
      orderBy: useOrderBy ? orderByItems : undefined
    };
    onAdd(windowFunc);
  };

  const addPartitionColumn = () => {
    if (availableColumns.length > 0) {
      setPartitionColumns([...partitionColumns, availableColumns[0]]);
    }
  };

  const addOrderByItem = () => {
    if (availableColumns.length > 0) {
      setOrderByItems([...orderByItems, { column: availableColumns[0], direction: 'ASC' }]);
    }
  };

  const functionInfo = WINDOW_FUNCTION_INFO[selectedFunction];

  // Group functions by category
  const functionsByCategory = WINDOW_FUNCTIONS.reduce((acc, fn) => {
    const cat = WINDOW_FUNCTION_INFO[fn].category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(fn);
    return acc;
  }, {} as Record<string, WindowFunctionType[]>);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-lg shadow-md border border-slate-200 mb-6 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                {initialValue ? 'Edit Ranking or Running Calculation' : 'Add Ranking or Running Calculation'}
              </h3>
              <p className="text-sm text-slate-600">
                {initialValue ? 'Update your ranking or running calculation' : 'Add row numbers, rankings, or running totals to your results'}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
            <label className="block text-sm font-medium text-slate-700 mb-4">
              Choose Function
            </label>
            <div className="space-y-4">
              {Object.entries(functionsByCategory).map(([category, fns]) => (
                <div key={category}>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{category}</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {fns.map(fn => (
                      <button
                        key={fn}
                        type="button"
                        onClick={() => setSelectedFunction(fn)}
                        title={WINDOW_FUNCTION_INFO[fn].description}
                        className={cn(
                          "p-3 border rounded-lg text-sm font-medium transition-colors text-center",
                          selectedFunction === fn
                            ? "bg-blue-100 border-blue-500 text-blue-900"
                            : "border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                        )}
                      >
                        {WINDOW_FUNCTION_INFO[fn].label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {functionInfo && (
              <div className="mt-4 flex items-start gap-2 text-sm text-blue-900 bg-blue-50 border border-blue-200 rounded px-3 py-2">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{functionInfo.description}</span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Display Name
            </label>
            <Input
              type="text"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder={`e.g., ${WINDOW_FUNCTION_INFO[selectedFunction].label.replace(/\s+/g, '')}`}
              className="w-full"
            />
            <p className="text-xs text-slate-500 mt-1.5">This name will appear as the column header</p>
          </div>

          <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
            <label className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                checked={usePartitionBy}
                onChange={(e) => setUsePartitionBy(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-900">Reset for each group</span>
            </label>
            <p className="text-xs text-slate-500 mb-4">
              Start numbering from 1 for each unique combination of these fields
            </p>
            {usePartitionBy && (
              <div className="space-y-3">
                {partitionColumns.length === 0 ? (
                  <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                    Click "Add Field" to choose grouping fields
                  </div>
                ) : (
                  partitionColumns.map((col, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <select
                        value={col}
                        onChange={(e) => {
                          const updated = [...partitionColumns];
                          updated[index] = e.target.value;
                          setPartitionColumns(updated);
                        }}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      >
                        {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <Button
                        type="button"
                        onClick={() => setPartitionColumns(partitionColumns.filter((_, i) => i !== index))}
                        variant="outline"
                        size="sm"
                        className="border-red-200 text-red-600 hover:bg-red-50 flex-shrink-0"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </Button>
                    </div>
                  ))
                )}
                <Button
                  type="button"
                  onClick={addPartitionColumn}
                  variant="outline"
                  size="sm"
                  className="w-full border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Field
                </Button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
            <label className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                checked={useOrderBy}
                onChange={(e) => setUseOrderBy(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-900">Sort within each group</span>
            </label>
            <p className="text-xs text-slate-500 mb-4">
              Determine the order in which numbering or calculations are applied
            </p>
            {useOrderBy && (
              <div className="space-y-3">
                {orderByItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold">
                      {index + 1}
                    </span>
                    <select
                      value={item.column}
                      onChange={(e) => {
                        const updated = [...orderByItems];
                        updated[index].column = e.target.value;
                        setOrderByItems(updated);
                      }}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select
                      value={item.direction}
                      onChange={(e) => {
                        const updated = [...orderByItems];
                        updated[index].direction = e.target.value as 'ASC' | 'DESC';
                        setOrderByItems(updated);
                      }}
                      className="px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      <option value="ASC">A → Z / Smallest First</option>
                      <option value="DESC">Z → A / Largest First</option>
                    </select>
                    <Button
                      type="button"
                      onClick={() => setOrderByItems(orderByItems.filter((_, i) => i !== index))}
                      disabled={orderByItems.length <= 1}
                      variant="outline"
                      size="sm"
                      className="border-red-200 text-red-600 hover:bg-red-50 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  onClick={addOrderByItem}
                  variant="outline"
                  size="sm"
                  className="w-full border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Sort Field
                </Button>
              </div>
            )}
          </div>

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
                className="bg-blue-600 text-white hover:bg-blue-700 font-semibold shadow-md"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {initialValue ? 'Update' : `Add ${WINDOW_FUNCTION_INFO[selectedFunction].label}`}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WindowFunctionBuilder;
