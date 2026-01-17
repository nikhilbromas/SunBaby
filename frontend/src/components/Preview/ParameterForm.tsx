import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api';
import type { Preset, Template } from '../../services/types';
import './ParameterForm.css';

interface ParameterFormProps {
  template: Template | null;
  onSubmit: (parameters: Record<string, any>) => void;
}

const ParameterForm: React.FC<ParameterFormProps> = ({ template, onSubmit }) => {
  const [preset, setPreset] = useState<Preset | null>(null);
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (template) {
      loadPreset(template.PresetId);
    }
  }, [template]);

  const loadPreset = async (presetId: number) => {
    try {
      setLoading(true);
      const loaded = await apiClient.getPreset(presetId);
      setPreset(loaded);
      
      // Extract parameters from SQL JSON
      const sqlJson = JSON.parse(loaded.SqlJson);
      const paramNames = extractParameters(sqlJson);
      
      // Initialize parameters
      const initialParams: Record<string, any> = {};
      paramNames.forEach((param) => {
        initialParams[param] = '';
      });
      setParameters(initialParams);
    } catch (err: any) {
      setError(err.message || 'Failed to load preset');
    } finally {
      setLoading(false);
    }
  };

  const extractParameters = (sqlJson: any): string[] => {
    const params = new Set<string>();
    const paramRegex = /@(\w+)/g;
    
    if (sqlJson.headerQuery) {
      let match;
      while ((match = paramRegex.exec(sqlJson.headerQuery)) !== null) {
        params.add(match[1]);
      }
    }
    
    if (sqlJson.itemQuery) {
      let match;
      while ((match = paramRegex.exec(sqlJson.itemQuery)) !== null) {
        params.add(match[1]);
      }
    }
    
    // Extract parameters from contentDetails
    if (sqlJson.contentDetails && Array.isArray(sqlJson.contentDetails)) {
      sqlJson.contentDetails.forEach((contentDetail: any) => {
        if (contentDetail.query) {
          let match;
          while ((match = paramRegex.exec(contentDetail.query)) !== null) {
            params.add(match[1]);
          }
        }
      });
    }
    
    return Array.from(params);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validate required parameters
    const missingParams = Object.keys(parameters).filter(
      (key) => !parameters[key] || parameters[key].toString().trim() === ''
    );
    
    if (missingParams.length > 0) {
      setError(`Please fill in all required parameters: ${missingParams.join(', ')}`);
      return;
    }
    
    onSubmit(parameters);
  };

  const handleParameterChange = (paramName: string, value: any) => {
    setParameters((prev) => ({
      ...prev,
      [paramName]: value,
    }));
  };

  if (loading) {
    return <div className="parameter-form loading">Loading preset...</div>;
  }

  if (!preset) {
    return (
      <div className="parameter-form">
        <p>Please select a template first</p>
      </div>
    );
  }

  const paramNames = Object.keys(parameters);

  return (
    <form className="parameter-form" onSubmit={handleSubmit}>
      <h3>Enter Parameters</h3>
      {error && <div className="error-message">{error}</div>}
      
      {paramNames.length === 0 ? (
        <p>No parameters required for this preset</p>
      ) : (
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
      )}
      
      <button type="submit" className="submit-button">
        Generate Preview
      </button>
    </form>
  );
};

export default ParameterForm;

