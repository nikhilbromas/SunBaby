import React from 'react';
import type { WhereCondition, WhereOperator } from '../../services/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface WhereBuilderProps {
  conditions: WhereCondition[];
  availableColumns: string[];
  onChange: (conditions: WhereCondition[]) => void;
}

// User-friendly labels for operators
const OPERATOR_LABELS: Record<WhereOperator, string> = {
  '=': 'equals',
  '!=': 'not equals',
  '>': 'greater than',
  '<': 'less than',
  '>=': 'at least',
  '<=': 'at most',
  'LIKE': 'contains',
  'IN': 'is one of',
  'IS NULL': 'is empty',
  'IS NOT NULL': 'is not empty'
};

const OPERATORS: WhereOperator[] = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN', 'IS NULL', 'IS NOT NULL'];

const WhereBuilder: React.FC<WhereBuilderProps> = ({
  conditions,
  availableColumns,
  onChange
}) => {
  const addCondition = () => {
    const newCondition: WhereCondition = {
      column: availableColumns[0] || '',
      operator: '=',
      value: '',
      isParameter: false,
      andOr: conditions.length > 0 ? 'AND' : undefined
    };
    onChange([...conditions, newCondition]);
  };

  const removeCondition = (index: number) => {
    const updated = conditions.filter((_, i) => i !== index);
    if (updated.length > 0 && updated[0].andOr) {
      updated[0] = { ...updated[0], andOr: undefined };
    }
    onChange(updated);
  };

  const updateCondition = (index: number, updates: Partial<WhereCondition>) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const needsValue = (operator: WhereOperator) => {
    return operator !== 'IS NULL' && operator !== 'IS NOT NULL';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-base font-semibold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filters
        </h4>
        <Button
          type="button"
          onClick={addCondition}
          disabled={availableColumns.length === 0}
          size="sm"
          className="bg-white text-black hover:bg-white/90"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Filter
        </Button>
      </div>

      {conditions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-white/20 rounded-lg bg-black">
          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </div>
          <h4 className="text-sm font-semibold text-white mb-1">No filters added</h4>
          <p className="text-xs text-white/60">Add filters to show only the records you need</p>
        </div>
      ) : (
        <div className="space-y-3">
          {conditions.map((condition, index) => (
            <div key={index} className="space-y-2">
              {index > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 border-t border-white/20"></div>
                  <select
                    value={condition.andOr || 'AND'}
                    onChange={(e) => updateCondition(index, { andOr: e.target.value as 'AND' | 'OR' })}
                    className="px-3 py-1.5 border border-white/20 rounded-md focus:outline-none focus:ring-2 focus:ring-white/30 text-sm font-medium bg-black text-white"
                  >
                    <option value="AND" className="bg-black text-white">AND (all must match)</option>
                    <option value="OR" className="bg-black text-white">OR (any can match)</option>
                  </select>
                  <div className="flex-1 border-t border-white/20"></div>
                </div>
              )}

              <Card className="border border-white/20 shadow-sm bg-black">
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                    <div className="md:col-span-4">
                      <label className="block text-xs font-medium text-white mb-1.5">Field</label>
                      <select
                        value={condition.column}
                        onChange={(e) => updateCondition(index, { column: e.target.value })}
                        className="w-full px-3 py-2 border border-white/20 rounded-md focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 text-sm bg-black text-white"
                      >
                        {availableColumns.map(col => (
                          <option key={col} value={col} className="bg-black text-white">{col}</option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-white mb-1.5">Condition</label>
                      <select
                        value={condition.operator}
                        onChange={(e) => updateCondition(index, { operator: e.target.value as WhereOperator })}
                        className="w-full px-3 py-2 border border-white/20 rounded-md focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 text-sm bg-black text-white"
                      >
                        {OPERATORS.map(op => (
                          <option key={op} value={op} className="bg-black text-white">{OPERATOR_LABELS[op]}</option>
                        ))}
                      </select>
                    </div>

                    {needsValue(condition.operator) && (
                      <div className="md:col-span-4">
                        <label className="block text-xs font-medium text-white mb-1.5">Value</label>
                        {condition.operator === 'IN' ? (
                          <input
                            type="text"
                            placeholder="value1, value2, ..."
                            value={Array.isArray(condition.value) ? condition.value.join(', ') : condition.value || ''}
                            onChange={(e) => {
                              const values = e.target.value.split(',').map(v => v.trim());
                              updateCondition(index, { value: values });
                            }}
                            className="w-full px-3 py-2 border border-white/20 rounded-md focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 text-sm bg-black text-white placeholder:text-white/40"
                          />
                        ) : (
                          <div className="relative">
                            <input
                              type="text"
                              placeholder={condition.operator === 'LIKE' ? '%search%' : 'Enter value or @parameter'}
                              value={condition.value as string || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                const isParam = val.startsWith('@');
                                updateCondition(index, { value: val, isParameter: isParam });
                              }}
                              className="w-full px-3 py-2 border border-white/20 rounded-md focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 text-sm bg-black text-white placeholder:text-white/40"
                            />
                            {condition.isParameter && (
                              <span 
                                className="absolute -top-2 right-2 px-2 py-0.5 bg-white/10 text-white text-xs rounded-full font-medium border border-white/20"
                                title="This is a parameter - value will be provided at runtime"
                              >
                                Parameter
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className={cn("md:col-span-1 flex", needsValue(condition.operator) ? "items-end" : "md:col-span-5 items-end")}>
                      <Button
                        type="button"
                        onClick={() => removeCondition(index)}
                        variant="outline"
                        size="sm"
                        className="border-red-500/50 text-red-400 hover:bg-red-500/20 w-full md:w-auto"
                        title="Remove filter"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}

      {conditions.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-lg">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-white">
            {conditions.length} filter{conditions.length !== 1 ? 's' : ''} active
          </span>
        </div>
      )}
    </div>
  );
};

export default WhereBuilder;
