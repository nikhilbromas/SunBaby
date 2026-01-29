import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../services/api';
import type { Preset } from '../../services/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Play, Save, RotateCcw, CheckCircle2, Loader2 } from 'lucide-react';
import './ParameterInput.css';

interface ParameterInputProps {
  preset: Preset | null;
  templateId?: number | null;
  defaultParameters?: Record<string, string>;
  onExecute: (parameters: Record<string, any>) => void;
  onDataReceived: (data: {
    header: { data: Record<string, any> | null; fields: string[] };
    items: { data: Record<string, any>[]; fields: string[]; sampleCount: number };
    contentDetails?: Record<string, { data: Record<string, any>[] | Record<string, any> | null; fields: string[]; sampleCount: number; dataType?: 'array' | 'object' }>;
  }) => void;
  onSaveParameters?: (parameters: Record<string, any>) => void;
}

const ParameterInput: React.FC<ParameterInputProps> = ({
  preset,
  templateId,
  defaultParameters,
  onExecute,
  onDataReceived,
  onSaveParameters,
}) => {
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPresetId, setLastPresetId] = useState<number | null>(null);
  const [hasDefaults, setHasDefaults] = useState(false);
  const [savedParameterNames, setSavedParameterNames] = useState<Set<string>>(new Set());

  // Load saved template parameters when templateId is available
  useEffect(() => {
    const loadSavedParameters = async () => {
      if (templateId) {
        try {
          const response = await apiClient.getTemplateParameters(templateId);
          // Create a case-insensitive set of saved parameter names
          const savedNames = new Set<string>();
          response.parameters.forEach((param) => {
            savedNames.add(param.ParameterName.toLowerCase());
          });
          setSavedParameterNames(savedNames);
        } catch (err: any) {
          // If template parameters don't exist or error, use empty set
          console.warn('Failed to load template parameters:', err);
          setSavedParameterNames(new Set());
        }
      } else {
        setSavedParameterNames(new Set());
      }
    };
    loadSavedParameters();
  }, [templateId]);


  // Load default parameters when they're provided
  useEffect(() => {
    if (defaultParameters && Object.keys(defaultParameters).length > 0) {
      setParameters((prevParams) => {
        const newParams: Record<string, any> = { ...prevParams };
        
        // Build a lowercase map of default parameters
        const defaultsLower = new Map<string, string>();
        Object.keys(defaultParameters).forEach((key) => {
          defaultsLower.set(key.toLowerCase(), defaultParameters[key] || '');
        });
        
        // Merge default parameters (case-insensitive), but preserve any user edits
        Object.keys(newParams).forEach((key) => {
          const lowerKey = key.toLowerCase();
          const defaultValue = defaultsLower.get(lowerKey);
          if (defaultValue !== undefined && newParams[key] === '') {
            newParams[key] = defaultValue;
          }
        });
        
        return newParams;
      });
      setHasDefaults(true);
    } else {
      setHasDefaults(false);
    }
  }, [defaultParameters]);

  const extractParameters = useCallback(() => {
    if (!preset) return;

    try {
      const sqlJson = JSON.parse(preset.SqlJson);
      // Use Map to track unique parameters case-insensitively
      // Key: lowercase name, Value: original name (first occurrence)
      const paramMap = new Map<string, string>();

      // Helper function to extract params from a query string
      const extractFromQuery = (query: string) => {
        if (!query) return;
        // Use matchAll for cleaner extraction - creates fresh regex each time
        const matches = query.matchAll(/@(\w+)/g);
        for (const match of matches) {
          const paramName = match[1];
          const lowerName = paramName.toLowerCase();
          // Only add if not already present (case-insensitive)
          if (!paramMap.has(lowerName)) {
            paramMap.set(lowerName, paramName);
          }
        }
      };

      extractFromQuery(sqlJson.headerQuery);
      extractFromQuery(sqlJson.itemQuery);

      // Extract parameters from contentDetails
      if (sqlJson.contentDetails && Array.isArray(sqlJson.contentDetails)) {
        sqlJson.contentDetails.forEach((contentDetail: any) => {
          extractFromQuery(contentDetail.query);
        });
      }

      // Get unique parameter names (using original case from first occurrence)
      const allUniqueParams = Array.from(paramMap.values());

      // Filter to only show parameters that are saved in the database (if templateId exists)
      let uniqueParams: string[] = allUniqueParams;
      if (templateId && savedParameterNames.size > 0) {
        // Only include parameters that are saved in the database (case-insensitive)
        uniqueParams = allUniqueParams.filter((param) => 
          savedParameterNames.has(param.toLowerCase())
        );
      }

      // Preserve existing parameter values, only initialize new ones
      setParameters((prevParams) => {
        const newParams: Record<string, any> = {};
        
        // Build a lowercase map of existing params for case-insensitive lookup
        const prevParamsLower = new Map<string, { key: string; value: any }>();
        Object.keys(prevParams).forEach((key) => {
          prevParamsLower.set(key.toLowerCase(), { key, value: prevParams[key] });
        });
        
        uniqueParams.forEach((param) => {
          const lowerParam = param.toLowerCase();
          // Check if we have an existing value (case-insensitive)
          const existing = prevParamsLower.get(lowerParam);
          if (existing && existing.value !== '') {
            newParams[param] = existing.value;
          } else {
            newParams[param] = '';
          }
        });
        
        return newParams;
      });
    } catch (e) {
      setError('Invalid SQL JSON format');
    }
  }, [preset, templateId, savedParameterNames]);
  
  // Re-extract parameters when preset or savedParameterNames changes
  useEffect(() => {
    if (preset) {
      // Only reset parameters if preset actually changed
      if (preset.PresetId !== lastPresetId) {
        extractParameters();
        setLastPresetId(preset.PresetId);
      } else {
        // Re-extract to apply savedParameterNames filter
        extractParameters();
      }
    } else {
      setParameters({});
      setLastPresetId(null);
    }
  }, [preset, lastPresetId, extractParameters]);

  const handleParameterChange = (paramName: string, value: any) => {
    setParameters((prev) => ({
      ...prev,
      [paramName]: value,
    }));
  };

  const handleLoadDefaults = () => {
    if (defaultParameters && Object.keys(defaultParameters).length > 0) {
      setParameters((prevParams) => {
        const newParams: Record<string, any> = { ...prevParams };
        
        // Build a lowercase map of default parameters
        const defaultsLower = new Map<string, string>();
        Object.keys(defaultParameters).forEach((key) => {
          defaultsLower.set(key.toLowerCase(), defaultParameters[key] || '');
        });
        
        // Overwrite with defaults (case-insensitive)
        Object.keys(newParams).forEach((key) => {
          const lowerKey = key.toLowerCase();
          const defaultValue = defaultsLower.get(lowerKey);
          if (defaultValue !== undefined) {
            newParams[key] = defaultValue;
          }
        });
        
        return newParams;
      });
    }
  };

  const handleSaveDefaults = async () => {
    if (!templateId || !onSaveParameters) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Prepare parameters for saving (only non-empty values)
      const paramsToSave: Record<string, string> = {};
      Object.keys(parameters).forEach((key) => {
        const value = parameters[key];
        if (value !== null && value !== undefined && value.toString().trim() !== '') {
          paramsToSave[key] = typeof value === 'string' ? value.trim() : String(value);
        }
      });

      await onSaveParameters(paramsToSave);
      setHasDefaults(true);
    } catch (err: any) {
      setError(err.message || 'Failed to save parameters');
    } finally {
      setSaving(false);
    }
  };

  const handleExecute = async () => {
    if (!preset) {
      setError('No preset selected');
      return;
    }

    setError(null);

    // Validate required parameters - only check non-empty values
    const filledParams: Record<string, any> = {};
    const missingParams: string[] = [];

    Object.keys(parameters).forEach((key) => {
      const value = parameters[key];
      if (value !== null && value !== undefined && value.toString().trim() !== '') {
        filledParams[key] = value;
      } else {
        missingParams.push(key);
      }
    });

    if (missingParams.length > 0) {
      setError(`Please fill in all required parameters: ${missingParams.join(', ')}`);
      return;
    }

    setLoading(true);
    try {
      // Use filledParams (with trimmed values) for the API call
      const trimmedParams: Record<string, any> = {};
      Object.keys(filledParams).forEach((key) => {
        const value = filledParams[key];
        trimmedParams[key] = typeof value === 'string' ? value.trim() : value;
      });

      const data = await apiClient.testPresetQueries(preset.PresetId, trimmedParams);
      onDataReceived(data);
      onExecute(trimmedParams);
      // Parameters are preserved in state, so fields remain filled
    } catch (err: any) {
      setError(err.message || 'Failed to execute query');
    } finally {
      setLoading(false);
    }
  };

  if (!preset) {
    return (
      <div className="parameter-input">
        <p className="no-preset">Select a preset to enter parameters</p>
      </div>
    );
  }

  const paramNames = Object.keys(parameters);

  return (
    <Card className="parameter-input">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-semibold">Query Parameters</CardTitle>
          {templateId && (
            <div className="flex gap-2">
              {hasDefaults && defaultParameters && Object.keys(defaultParameters).length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadDefaults}
                  disabled={loading || saving}
                  title="Load saved default values"
                >
                  <RotateCcw size={14} className="mr-1.5" />
                  Load Defaults
                </Button>
              )}
              {onSaveParameters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveDefaults}
                  disabled={loading || saving || paramNames.length === 0}
                  title="Save current values as template defaults"
                >
                  {saving ? (
                    <>
                      <Loader2 size={14} className="mr-1.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={14} className="mr-1.5" />
                      Save as Default
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <div className="error-message flex items-start gap-2">
            <span className="text-sm">{error}</span>
          </div>
        )}
        
        {hasDefaults && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
            <CheckCircle2 size={16} />
            <span>Default parameters loaded</span>
          </div>
        )}

        {paramNames.length === 0 ? (
          <p className="no-params text-muted-foreground text-sm italic text-center py-4">
            No parameters required for this preset
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3">
              {paramNames.map((paramName) => (
                <div key={paramName} className="space-y-2">
                  <Label htmlFor={`param-${paramName}`} className="text-sm font-medium">
                    {paramName}
                  </Label>
                  <Input
                    id={`param-${paramName}`}
                    type="text"
                    value={parameters[paramName] || ''}
                    onChange={(e) => handleParameterChange(paramName, e.target.value)}
                    placeholder={`Enter ${paramName}`}
                    required
                    className="w-full"
                  />
                </div>
              ))}
            </div>
            
            <Button
              onClick={handleExecute}
              disabled={loading || saving}
              className="w-full execute-button"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="mr-2 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Play size={18} className="mr-2" />
                  Execute Query & Load Data
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ParameterInput;

