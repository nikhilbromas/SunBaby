import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api';
import type { Preset, PresetCreate, PresetUpdate, ContentDetail } from '../../services/types';
import QueryBuilder from './QueryBuilder';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface PresetEditorProps {
  preset: Preset | null;
  onSave: () => void;
  onCancel: () => void;
}

const PresetEditor: React.FC<PresetEditorProps> = ({ preset, onSave, onCancel }) => {
  const [presetName, setPresetName] = useState('');
  const [headerQuery, setHeaderQuery] = useState('');
  const [itemQuery, setItemQuery] = useState('');
  const [contentDetails, setContentDetails] = useState<ContentDetail[]>([]);
  const [expectedParams, setExpectedParams] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVisualBuilder, setShowVisualBuilder] = useState<'header' | 'item' | 'content' | null>(null);
  const [contentDetailIndex, setContentDetailIndex] = useState<number>(-1);

  useEffect(() => {
    if (preset) {
      setPresetName(preset.PresetName);
      setCreatedBy(preset.CreatedBy || '');
      setExpectedParams(preset.ExpectedParams || '');
      
      try {
        const sqlJson = JSON.parse(preset.SqlJson);
        setHeaderQuery(sqlJson.headerQuery || '');
        setItemQuery(sqlJson.itemQuery || '');
        // Ensure contentDetails have dataType defaulted to 'array' for backward compatibility
        const contentDetailsList = (sqlJson.contentDetails || []).map((cd: any) => ({
          name: cd.name || '',
          query: cd.query || '',
          dataType: cd.dataType || 'array'
        }));
        setContentDetails(contentDetailsList);
      } catch (e) {
        setError('Invalid SQL JSON format');
      }
    } else {
      // Reset form for new preset
      setPresetName('');
      setHeaderQuery('');
      setItemQuery('');
      setContentDetails([]);
      setExpectedParams('');
      setCreatedBy('');
    }
  }, [preset]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!presetName.trim()) {
      setError('Preset name is required');
      return;
    }

    const hasHeaderQuery = headerQuery.trim().length > 0;
    const hasItemQuery = itemQuery.trim().length > 0;
    const hasContentDetails = contentDetails.length > 0 && 
      contentDetails.every(cd => cd.name.trim() && cd.query.trim());

    if (!hasHeaderQuery && !hasItemQuery && !hasContentDetails) {
      setError('At least one query (header, item, or content detail) is required');
      return;
    }

    // Validate content details
    const contentDetailsErrors = contentDetails
      .map((cd, idx) => {
        if (!cd.name.trim()) return `Content detail ${idx + 1}: name is required`;
        if (!cd.query.trim()) return `Content detail ${idx + 1}: query is required`;
        return null;
      })
      .filter(Boolean);
    
    if (contentDetailsErrors.length > 0) {
      setError(contentDetailsErrors[0] || 'Invalid content details');
      return;
    }

    // Check for duplicate names
    const names = contentDetails.map(cd => cd.name.trim().toLowerCase());
    const uniqueNames = new Set(names);
    if (names.length !== uniqueNames.size) {
      setError('Content detail names must be unique');
      return;
    }

    setSaving(true);

    try {
      const sqlJsonObj: any = {};
      if (hasHeaderQuery) {
        sqlJsonObj.headerQuery = headerQuery.trim();
      }
      if (hasItemQuery) {
        sqlJsonObj.itemQuery = itemQuery.trim();
      }
      if (hasContentDetails) {
        sqlJsonObj.contentDetails = contentDetails.map(cd => ({
          name: cd.name.trim(),
          query: cd.query.trim(),
          dataType: cd.dataType || 'array' // Default to 'array' if not specified
        }));
      }
      
      const sqlJson = JSON.stringify(sqlJsonObj);

      if (preset) {
        // Update existing
        const updateData: PresetUpdate = {
          presetName,
          sqlJson,
          expectedParams: expectedParams.trim() || undefined,
        };
        await apiClient.updatePreset(preset.PresetId, updateData);
      } else {
        // Create new
        const createData: PresetCreate = {
          presetName,
          sqlJson,
          expectedParams: expectedParams.trim() || undefined,
          createdBy: createdBy.trim() || undefined,
        };
        await apiClient.createPreset(createData);
      }

      onSave();
    } catch (err: any) {
      setError(err.message || 'Failed to save preset');
    } finally {
      setSaving(false);
    }
  };

  const handleApplySQL = (sql: string) => {
    if (showVisualBuilder === 'header') {
      setHeaderQuery(sql);
    } else if (showVisualBuilder === 'item') {
      setItemQuery(sql);
    } else if (showVisualBuilder === 'content' && contentDetailIndex >= 0) {
      const updated = [...contentDetails];
      updated[contentDetailIndex].query = sql;
      setContentDetails(updated);
    }
    setShowVisualBuilder(null);
    setContentDetailIndex(-1);
  };

  if (showVisualBuilder) {
    const initialSQL = 
      showVisualBuilder === 'header' ? headerQuery :
      showVisualBuilder === 'item' ? itemQuery :
      showVisualBuilder === 'content' && contentDetailIndex >= 0 ? contentDetails[contentDetailIndex].query :
      '';
    
    return (
      <QueryBuilder
        initialSQL={initialSQL}
        onApply={handleApplySQL}
        onCancel={() => {
          setShowVisualBuilder(null);
          setContentDetailIndex(-1);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 h-12 w-12 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold">{preset ? 'Edit Preset' : 'Create New Preset'}</h2>
              <p className="text-blue-100 text-sm mt-1">Configure your SQL query template</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-3">
              <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">{error}</span>
            </div>
          )}

          <Card className="bg-white border border-slate-200 shadow-md">
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Basic Information
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Preset Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="text"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      required
                      placeholder="e.g., Bill Preview"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Created By
                    </label>
                    <Input
                      type="text"
                      value={createdBy}
                      onChange={(e) => setCreatedBy(e.target.value)}
                      placeholder="Your name"
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="bg-white border border-slate-200 shadow-md">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Header Query
                </h3>
                <Button
                  type="button"
                  onClick={() => setShowVisualBuilder('header')}
                  variant="outline"
                  size="sm"
                  className="border-blue-200 text-blue-600 hover:bg-blue-50"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Visual Builder
                </Button>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  SELECT statement with @ParameterName
                </label>
                <textarea
                  value={headerQuery}
                  onChange={(e) => setHeaderQuery(e.target.value)}
                  placeholder={`SELECT h.*, o.*
FROM LOsPosHeader h
LEFT JOIN orderheader o ON o.BillID = h.poshBillID
WHERE h.poshBillID = @BillID`}
                  rows={8}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-y"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Supports multiple JOINs (LEFT, RIGHT, INNER, FULL OUTER, CROSS). Use table aliases for clarity.
                </p>
              </div>
            </div>
          </Card>

          <Card className="bg-white border border-slate-200 shadow-md">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  Item Query
                </h3>
                <Button
                  type="button"
                  onClick={() => setShowVisualBuilder('item')}
                  variant="outline"
                  size="sm"
                  className="border-blue-200 text-blue-600 hover:bg-blue-50"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Visual Builder
                </Button>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  SELECT statement with @ParameterName
                </label>
                <textarea
                  value={itemQuery}
                  onChange={(e) => setItemQuery(e.target.value)}
                  placeholder={`SELECT i.*, p.ProductName
FROM BillItem i
LEFT JOIN Products p ON p.ProductId = i.ItemProductId
WHERE i.BillId = @BillId`}
                  rows={8}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-y"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Supports multiple JOINs (LEFT, RIGHT, INNER, FULL OUTER, CROSS). Use table aliases for clarity.
                </p>
              </div>
            </div>
          </Card>

          <Card className="bg-white border border-slate-200 shadow-md">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Content Details
                  </h3>
                  {contentDetails.length === 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      Optional: Add additional content sections with custom queries
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  onClick={() => setContentDetails([...contentDetails, { name: '', query: '', dataType: 'array' as 'array' | 'object' }])}
                  variant="outline"
                  size="sm"
                  className="border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                >
                  <span className="mr-1">+</span>
                  Add Content Detail
                </Button>
              </div>

              {contentDetails.length > 0 && (
                <div className="space-y-4">
                  {contentDetails.map((cd, index) => (
                    <div key={index} className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold">
                            {index + 1}
                          </span>
                          <span className="font-medium text-slate-900">Content Detail {index + 1}</span>
                        </div>
                        <Button
                          type="button"
                          onClick={() => setContentDetails(contentDetails.filter((_, i) => i !== index))}
                          variant="outline"
                          size="sm"
                          className="border-red-200 text-red-600 hover:bg-red-50"
                        >
                          Remove
                        </Button>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Name <span className="text-red-500">*</span>
                        </label>
                        <Input
                          type="text"
                          value={cd.name}
                          onChange={(e) => {
                            const updated = [...contentDetails];
                            updated[index].name = e.target.value;
                            setContentDetails(updated);
                          }}
                          placeholder="e.g., payments, notes"
                          required
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Data Type <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={cd.dataType || 'array'}
                          onChange={(e) => {
                            const updated = [...contentDetails];
                            updated[index].dataType = e.target.value as 'array' | 'object';
                            setContentDetails(updated);
                          }}
                          required
                          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="array">Array (Multiple Rows - like Items)</option>
                          <option value="object">Object (Single Row - like Header)</option>
                        </select>
                        <p className="text-xs text-slate-500 mt-2">
                          {cd.dataType === 'array' 
                            ? 'Returns multiple rows, displayed as table data'
                            : 'Returns single row, displayed as fields'}
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-slate-700">
                            Query <span className="text-red-500">*</span>
                          </label>
                          <Button
                            type="button"
                            onClick={() => {
                              setContentDetailIndex(index);
                              setShowVisualBuilder('content');
                            }}
                            variant="outline"
                            size="sm"
                            className="border-blue-200 text-blue-600 hover:bg-blue-50"
                          >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Visual
                          </Button>
                        </div>
                        <textarea
                          value={cd.query}
                          onChange={(e) => {
                            const updated = [...contentDetails];
                            updated[index].query = e.target.value;
                            setContentDetails(updated);
                          }}
                          placeholder={`SELECT p.*, m.PaymentMethodName
FROM Payments p
LEFT JOIN PaymentMethods m ON m.MethodId = p.PaymentMethodId
WHERE p.BillId = @BillId`}
                          rows={6}
                          required
                          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-y"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card className="bg-white border border-slate-200 shadow-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Parameters
              </h3>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Expected Parameters (comma-separated)
                </label>
                <Input
                  type="text"
                  value={expectedParams}
                  onChange={(e) => setExpectedParams(e.target.value)}
                  placeholder="BillId, CustomerId"
                  className="w-full"
                />
                <p className="text-xs text-slate-500 mt-2">Optional: List of expected parameter names</p>
              </div>
            </div>
          </Card>

          <div className="sticky bottom-0 bg-white border-t border-slate-200 shadow-lg rounded-t-lg -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4">
            <div className="max-w-5xl mx-auto flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <Button
                type="button"
                onClick={onCancel}
                variant="outline"
                className="border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-blue-600 text-white hover:bg-blue-700 font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save Preset
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PresetEditor;

