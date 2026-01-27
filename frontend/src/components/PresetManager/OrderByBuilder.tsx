import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface OrderByItem {
  column: string;
  direction: 'ASC' | 'DESC';
}

interface OrderByBuilderProps {
  orderBy: OrderByItem[];
  availableColumns: string[];
  onChange: (orderBy: OrderByItem[]) => void;
}

const OrderByBuilder: React.FC<OrderByBuilderProps> = ({
  orderBy,
  availableColumns,
  onChange
}) => {
  const addColumn = () => {
    if (availableColumns.length > 0) {
      const newItem: OrderByItem = {
        column: availableColumns[0],
        direction: 'ASC'
      };
      onChange([...orderBy, newItem]);
    }
  };

  const removeColumn = (index: number) => {
    onChange(orderBy.filter((_, i) => i !== index));
  };

  const updateColumn = (index: number, column: string) => {
    const updated = [...orderBy];
    updated[index] = { ...updated[index], column };
    onChange(updated);
  };

  const updateDirection = (index: number, direction: 'ASC' | 'DESC') => {
    const updated = [...orderBy];
    updated[index] = { ...updated[index], direction };
    onChange(updated);
  };

  const moveUp = (index: number) => {
    if (index > 0) {
      const updated = [...orderBy];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      onChange(updated);
    }
  };

  const moveDown = (index: number) => {
    if (index < orderBy.length - 1) {
      const updated = [...orderBy];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      onChange(updated);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          Sort Results
        </h4>
        <Button
          type="button"
          onClick={addColumn}
          disabled={availableColumns.length === 0}
          size="sm"
          className="bg-blue-600 text-white hover:bg-blue-700"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Sort
        </Button>
      </div>

      {orderBy.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-slate-200 rounded-lg bg-white">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </div>
          <h4 className="text-sm font-semibold text-slate-900 mb-1">No sorting applied</h4>
          <p className="text-xs text-slate-500">Add sorting to arrange your results in a specific order</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-blue-900">
              First sort is applied first, then second, and so on. Use the arrows to change priority.
            </p>
          </div>

          <div className="space-y-2">
            {orderBy.map((item, index) => (
              <Card key={index} className="border border-slate-200 shadow-sm bg-white">
                <div className="p-3 flex items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      className={cn(
                        "w-7 h-7 flex items-center justify-center rounded border transition-colors",
                        index === 0 
                          ? "border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed" 
                          : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-400"
                      )}
                      title="Move up (higher priority)"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDown(index)}
                      disabled={index === orderBy.length - 1}
                      className={cn(
                        "w-7 h-7 flex items-center justify-center rounded border transition-colors",
                        index === orderBy.length - 1
                          ? "border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed" 
                          : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-400"
                      )}
                      title="Move down (lower priority)"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold text-sm">
                    {index + 1}
                  </div>

                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">Sort by</label>
                      <select
                        value={item.column}
                        onChange={(e) => updateColumn(index, e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      >
                        {availableColumns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">Order</label>
                      <select
                        value={item.direction}
                        onChange={(e) => updateDirection(index, e.target.value as 'ASC' | 'DESC')}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      >
                        <option value="ASC">A → Z / Smallest First</option>
                        <option value="DESC">Z → A / Largest First</option>
                      </select>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => removeColumn(index)}
                    variant="outline"
                    size="sm"
                    className="border-red-200 text-red-600 hover:bg-red-50 flex-shrink-0"
                    title="Remove sorting"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderByBuilder;
