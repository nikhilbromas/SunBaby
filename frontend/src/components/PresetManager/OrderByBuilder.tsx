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
        <h4 className="text-base font-semibold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          Sort Results
        </h4>
        <Button
          type="button"
          onClick={addColumn}
          disabled={availableColumns.length === 0}
          size="sm"
          className="bg-white text-black hover:bg-white/90"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Sort
        </Button>
      </div>

      {orderBy.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-white/20 rounded-lg bg-black">
          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </div>
          <h4 className="text-sm font-semibold text-white mb-1">No sorting applied</h4>
          <p className="text-xs text-white/60">Add sorting to arrange your results in a specific order</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white/10 border border-white/20 rounded-lg px-4 py-3 flex items-start gap-3">
            <svg className="w-5 h-5 text-white flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-white">
              First sort is applied first, then second, and so on. Use the arrows to change priority.
            </p>
          </div>

          <div className="space-y-2">
            {orderBy.map((item, index) => (
              <Card key={index} className="border border-white/20 shadow-sm bg-black">
                <div className="p-3 flex items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      className={cn(
                        "w-7 h-7 flex items-center justify-center rounded border transition-colors",
                        index === 0 
                          ? "border-white/20 bg-white/5 text-white/30 cursor-not-allowed" 
                          : "border-white/20 bg-black text-white/60 hover:bg-white/10 hover:border-white/40"
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
                          ? "border-white/20 bg-white/5 text-white/30 cursor-not-allowed" 
                          : "border-white/20 bg-black text-white/60 hover:bg-white/10 hover:border-white/40"
                      )}
                      title="Move down (lower priority)"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex-shrink-0 w-8 h-8 bg-white/10 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                    {index + 1}
                  </div>

                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-white mb-1.5">Sort by</label>
                      <select
                        value={item.column}
                        onChange={(e) => updateColumn(index, e.target.value)}
                        className="w-full px-3 py-2 border border-white/20 rounded-md focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 text-sm bg-black text-white"
                      >
                        {availableColumns.map(col => (
                          <option key={col} value={col} className="bg-black text-white">{col}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-white mb-1.5">Order</label>
                      <select
                        value={item.direction}
                        onChange={(e) => updateDirection(index, e.target.value as 'ASC' | 'DESC')}
                        className="w-full px-3 py-2 border border-white/20 rounded-md focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 text-sm bg-black text-white"
                      >
                        <option value="ASC" className="bg-black text-white">A → Z / Smallest First</option>
                        <option value="DESC" className="bg-black text-white">Z → A / Largest First</option>
                      </select>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => removeColumn(index)}
                    variant="outline"
                    size="sm"
                    className="border-red-500/50 text-red-400 hover:bg-red-500/20 flex-shrink-0"
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
