import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api';
import type { Preset } from '../../services/types';
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

  useEffect(() => {
    if (preset) {
      // Only reset parameters if preset actually changed
      if (preset.PresetId !== lastPresetId) {
        extractParameters();
        setLastPresetId(preset.PresetId);
      }
    } else {
      setParameters({});
      setLastPresetId(null);
    }
  }, [preset, lastPresetId]);

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

  const extractParameters = () => {
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
      const uniqueParams = Array.from(paramMap.values());

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
  };

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
    <div className="parameter-input">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4 style={{ margin: 0 }}>Query Parameters</h4>
        {templateId && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {hasDefaults && defaultParameters && Object.keys(defaultParameters).length > 0 && (
              <button
                onClick={handleLoadDefaults}
                disabled={loading || saving}
                className="load-defaults-button"
                title="Load saved default values"
              >
                Load Defaults
              </button>
            )}
            {onSaveParameters && (
              <button
                onClick={handleSaveDefaults}
                disabled={loading || saving || paramNames.length === 0}
                className="save-defaults-button"
                title="Save current values as template defaults"
              >
                {saving ? 'Saving...' : 'Save as Default'}
              </button>
            )}
          </div>
        )}
      </div>
      {error && <div className="error-message">{error}</div>}
      {hasDefaults && (
        <div style={{ 
          fontSize: '0.875rem', 
          color: '#28a745', 
          marginBottom: '0.5rem',
          padding: '0.5rem',
          background: '#f0f9ff',
          borderRadius: '4px'
        }}>
          ✓ Default parameters loaded
        </div>
      )}

      {paramNames.length === 0 ? (
        <p className="no-params">No parameters required for this preset</p>
      ) : (
        <>
          <div className="parameter-inputs">
            {paramNames.map((paramName) => (
              <div key={paramName} className="parameter-input-group">
                <label>
                  {paramName}:
                  <input
                    type="text"
                    value={parameters[paramName] || ''}
                    onChange={(e) => handleParameterChange(paramName, e.target.value)}
                    placeholder={`Enter ${paramName}`}
                    required
                  />
                </label>
              </div>
            ))}
          </div>
          <button
            onClick={handleExecute}
            disabled={loading || saving}
            className="execute-button"
          >
            {loading ? 'Executing...' : 'Execute Query & Load Data'}
          </button>
        </>
      )}
    </div>
  );
};

export default ParameterInput;

