import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface GroupByBuilderProps {
  groupBy: string[];
  availableColumns: string[];
  onChange: (groupBy: string[]) => void;
}

const GroupByBuilder: React.FC<GroupByBuilderProps> = ({
  groupBy,
  availableColumns,
  onChange
}) => {
  const addColumn = () => {
    const availableToAdd = availableColumns.filter(col => !groupBy.includes(col));
    if (availableToAdd.length > 0) {
      onChange([...groupBy, availableToAdd[0]]);
    }
  };

  const removeColumn = (index: number) => {
    onChange(groupBy.filter((_, i) => i !== index));
  };

  const updateColumn = (index: number, value: string) => {
    const updated = [...groupBy];
    updated[index] = value;
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-base font-semibold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Summarize By
        </h4>
        <Button
          type="button"
          onClick={addColumn}
          disabled={availableColumns.length === 0 || availableColumns.filter(col => !groupBy.includes(col)).length === 0}
          size="sm"
          className="bg-white text-black hover:bg-white/90 disabled:opacity-50"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Group
        </Button>
      </div>

      {groupBy.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-white/20 rounded-lg bg-black">
          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h4 className="text-sm font-semibold text-white mb-1">No grouping</h4>
          <p className="text-xs text-white/60">Group your data to see totals, counts, or averages for each category</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white/10 border border-white/20 rounded-lg px-4 py-3 flex items-start gap-3">
            <svg className="w-5 h-5 text-white flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-white">
              Records will be combined based on these fields. Use with SUM, COUNT, or AVG in your formula fields.
            </p>
          </div>

          <div className="space-y-2">
            {groupBy.map((column, index) => (
              <Card key={index} className="border border-white/20 shadow-sm bg-black">
                <div className="p-3 flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-white/10 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                    {index + 1}
                  </div>
                  <select
                    value={column}
                    onChange={(e) => updateColumn(index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-white/20 rounded-md focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 text-sm bg-black text-white"
                  >
                    {availableColumns.map(col => (
                      <option key={col} value={col} className="bg-black text-white">{col}</option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    onClick={() => removeColumn(index)}
                    variant="outline"
                    size="sm"
                    className="border-red-500/50 text-red-400 hover:bg-red-500/20 flex-shrink-0"
                    title="Remove from grouping"
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

export default GroupByBuilder;
