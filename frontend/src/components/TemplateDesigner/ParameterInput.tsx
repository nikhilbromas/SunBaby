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

  useEffect(() => {
    if (preset) {
      extractParameters();
    } else {
      setParameters({});
    }
  }, [preset]);

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

      const initialParams: Record<string, any> = {};
      Array.from(paramNames).forEach((param) => {
        initialParams[param] = '';
      });
      setParameters(initialParams);
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

    // Validate required parameters
    const missingParams = Object.keys(parameters).filter(
      (key) => !parameters[key] || parameters[key].toString().trim() === ''
    );

    if (missingParams.length > 0) {
      setError(`Please fill in all required parameters: ${missingParams.join(', ')}`);
      return;
    }

    setLoading(true);
    try {
      const data = await apiClient.testPresetQueries(preset.PresetId, parameters);
      onDataReceived(data);
      onExecute(parameters);
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

