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
        // Merge default parameters, but preserve any user edits
        Object.keys(defaultParameters).forEach((key) => {
          if (!(key in newParams) || newParams[key] === '') {
            newParams[key] = defaultParameters[key] || '';
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
      const paramRegex = /@(\w+)/g;
      const paramNames = new Set<string>();

      if (sqlJson.headerQuery) {
        let match;
        while ((match = paramRegex.exec(sqlJson.headerQuery)) !== null) {
          paramNames.add(match[1]);
        }
      }

      if (sqlJson.itemQuery) {
        let match;
        while ((match = paramRegex.exec(sqlJson.itemQuery)) !== null) {
          paramNames.add(match[1]);
        }
      }

      // Extract parameters from contentDetails
      if (sqlJson.contentDetails && Array.isArray(sqlJson.contentDetails)) {
        sqlJson.contentDetails.forEach((contentDetail: any) => {
          if (contentDetail.query) {
            let match;
            while ((match = paramRegex.exec(contentDetail.query)) !== null) {
              paramNames.add(match[1]);
            }
          }
        });
      }

      // Preserve existing parameter values, only initialize new ones
      setParameters((prevParams) => {
        const newParams: Record<string, any> = { ...prevParams };
        Array.from(paramNames).forEach((param) => {
          // Only set to empty if parameter doesn't exist yet
          if (!(param in newParams)) {
            newParams[param] = '';
          }
        });
        // Remove parameters that are no longer needed
        Object.keys(newParams).forEach((key) => {
          if (!paramNames.has(key)) {
            delete newParams[key];
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
        // Overwrite with defaults
        Object.keys(defaultParameters).forEach((key) => {
          newParams[key] = defaultParameters[key] || '';
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

