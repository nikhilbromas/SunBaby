import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../services/api';
import type { Preset, Template } from '../../services/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
  const [savedParameterNames, setSavedParameterNames] = useState<Set<string>>(new Set());

  // Load saved template parameters when template is available
  useEffect(() => {
    const loadSavedParameters = async () => {
      if (template && template.TemplateId) {
        try {
          const response = await apiClient.getTemplateParameters(template.TemplateId);
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
  }, [template]);

  useEffect(() => {
    if (template) {
      loadPreset(template.PresetId);
    }
  }, [template]);

  const extractParameters = useCallback((sqlJson: any): string[] => {
    // Use Map to track unique parameters case-insensitively
    // Key: lowercase name, Value: original name (first occurrence)
    const paramMap = new Map<string, string>();
    const paramRegex = /@(\w+)/g;
    
    // Helper function to extract params from a query string
    const extractFromQuery = (query: string) => {
      if (!query) return;
      const matches = query.matchAll(paramRegex);
      for (const match of matches) {
        const paramName = match[1];
        const lowerName = paramName.toLowerCase();
        // Only add if not already present (case-insensitive)
        if (!paramMap.has(lowerName)) {
          paramMap.set(lowerName, paramName);
        }
      }
    };
    
    if (sqlJson.headerQuery) {
      extractFromQuery(sqlJson.headerQuery);
    }
    
    if (sqlJson.itemQuery) {
      extractFromQuery(sqlJson.itemQuery);
    }
    
    // Extract parameters from contentDetails
    if (sqlJson.contentDetails && Array.isArray(sqlJson.contentDetails)) {
      sqlJson.contentDetails.forEach((contentDetail: any) => {
        if (contentDetail.query) {
          extractFromQuery(contentDetail.query);
        }
      });
    }
    
    // Get all unique parameter names (using original case from first occurrence)
    const allUniqueParams = Array.from(paramMap.values());
    
    // Filter to only show parameters that are saved in the database (if template exists)
    let uniqueParams: string[] = allUniqueParams;
    if (template && template.TemplateId && savedParameterNames.size > 0) {
      // Only include parameters that are saved in the database (case-insensitive)
      uniqueParams = allUniqueParams.filter((param) => 
        savedParameterNames.has(param.toLowerCase())
      );
    }
    
    return uniqueParams;
  }, [template, savedParameterNames]);

  const loadPreset = useCallback(async (presetId: number) => {
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
  }, [extractParameters]);
  
  // Reload preset when savedParameterNames changes (to re-filter parameters)
  useEffect(() => {
    if (template && preset && savedParameterNames.size >= 0) {
      // Re-extract parameters with updated savedParameterNames filter
      const sqlJson = JSON.parse(preset.SqlJson);
      const paramNames = extractParameters(sqlJson);
      
      // Update parameters state with filtered list
      setParameters((prevParams) => {
        const newParams: Record<string, any> = {};
        // Preserve existing values for parameters that are still in the filtered list
        paramNames.forEach((param) => {
          const lowerParam = param.toLowerCase();
          // Find existing value (case-insensitive)
          const existingKey = Object.keys(prevParams).find(
            k => k.toLowerCase() === lowerParam
          );
          newParams[param] = existingKey ? prevParams[existingKey] : '';
        });
        return newParams;
      });
    }
  }, [savedParameterNames, preset, extractParameters, template]);

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

