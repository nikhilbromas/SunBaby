import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api';
import type { Preset } from '../../services/types';
import './ParameterInput.css';

interface ParameterInputProps {
  preset: Preset | null;
  onExecute: (parameters: Record<string, any>) => void;
  onDataReceived: (data: {
    header: { data: Record<string, any> | null; fields: string[] };
    items: { data: Record<string, any>[]; fields: string[]; sampleCount: number };
    contentDetails?: Record<string, { data: Record<string, any>[] | Record<string, any> | null; fields: string[]; sampleCount: number; dataType?: 'array' | 'object' }>;
  }) => void;
}

const ParameterInput: React.FC<ParameterInputProps> = ({
  preset,
  onExecute,
  onDataReceived,
}) => {
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPresetId, setLastPresetId] = useState<number | null>(null);

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
      <h4>Query Parameters</h4>
      {error && <div className="error-message">{error}</div>}

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
            disabled={loading}
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

