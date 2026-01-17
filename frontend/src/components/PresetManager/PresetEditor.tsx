import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api';
import type { Preset, PresetCreate, PresetUpdate, ContentDetail } from '../../services/types';
import './PresetEditor.css';

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

  return (
    <div className="preset-editor">
      <div className="editor-header">
        <h2>{preset ? 'Edit Preset' : 'Create New Preset'}</h2>
      </div>

      <form onSubmit={handleSubmit} className="editor-form">
        {error && <div className="error-message">{error}</div>}

        <div className="form-group">
          <label>
            Preset Name: *
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              required
              placeholder="e.g., Bill Preview"
            />
          </label>
        </div>

        <div className="form-group">
          <label>
            Created By:
            <input
              type="text"
              value={createdBy}
              onChange={(e) => setCreatedBy(e.target.value)}
              placeholder="Your name"
            />
          </label>
        </div>

        <div className="form-group">
          <label>
            Header Query (SELECT statement with @ParameterName):
            <textarea
              value={headerQuery}
              onChange={(e) => setHeaderQuery(e.target.value)}
              placeholder="SELECT * FROM BillHeader WHERE BillId = @BillId"
              rows={5}
            />
          </label>
        </div>

        <div className="form-group">
          <label>
            Item Query (SELECT statement with @ParameterName):
            <textarea
              value={itemQuery}
              onChange={(e) => setItemQuery(e.target.value)}
              placeholder="SELECT * FROM BillItem WHERE BillId = @BillId"
              rows={5}
            />
          </label>
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <label style={{ margin: 0 }}>Content Details:</label>
            <button
              type="button"
              onClick={() => setContentDetails([...contentDetails, { name: '', query: '', dataType: 'array' as 'array' | 'object' }])}
              className="add-button"
              style={{ padding: '5px 15px', fontSize: '14px' }}
            >
              + Add Content Detail
            </button>
          </div>
          {contentDetails.length === 0 && (
            <small style={{ display: 'block', color: '#666', marginTop: '5px' }}>
              Optional: Add additional content sections with custom queries
            </small>
          )}
          {contentDetails.map((cd, index) => (
            <div key={index} style={{ 
              border: '1px solid #ddd', 
              borderRadius: '4px', 
              padding: '15px', 
              marginBottom: '10px',
              backgroundColor: '#f9f9f9'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <strong>Content Detail {index + 1}</strong>
                <button
                  type="button"
                  onClick={() => setContentDetails(contentDetails.filter((_, i) => i !== index))}
                  className="delete-button"
                  style={{ padding: '5px 10px', fontSize: '12px' }}
                >
                  Remove
                </button>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                  Name: *
                  <input
                    type="text"
                    value={cd.name}
                    onChange={(e) => {
                      const updated = [...contentDetails];
                      updated[index].name = e.target.value;
                      setContentDetails(updated);
                    }}
                    placeholder="e.g., payments, notes"
                    style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                    required
                  />
                </label>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                  Data Type: *
                  <select
                    value={cd.dataType || 'array'}
                    onChange={(e) => {
                      const updated = [...contentDetails];
                      updated[index].dataType = e.target.value as 'array' | 'object';
                      setContentDetails(updated);
                    }}
                    style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                    required
                  >
                    <option value="array">Array (Multiple Rows - like Items)</option>
                    <option value="object">Object (Single Row - like Header)</option>
                  </select>
                  <small style={{ display: 'block', color: '#666', marginTop: '5px' }}>
                    {cd.dataType === 'array' 
                      ? 'Returns multiple rows, displayed as table data'
                      : 'Returns single row, displayed as fields'}
                  </small>
                </label>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                  Query: *
                  <textarea
                    value={cd.query}
                    onChange={(e) => {
                      const updated = [...contentDetails];
                      updated[index].query = e.target.value;
                      setContentDetails(updated);
                    }}
                    placeholder="SELECT * FROM Payments WHERE BillId = @BillId"
                    rows={4}
                    style={{ width: '100%', padding: '8px', marginTop: '5px', fontFamily: 'monospace' }}
                    required
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="form-group">
          <label>
            Expected Parameters (comma-separated):
            <input
              type="text"
              value={expectedParams}
              onChange={(e) => setExpectedParams(e.target.value)}
              placeholder="BillId, CustomerId"
            />
          </label>
          <small>Optional: List of expected parameter names</small>
        </div>

        <div className="form-actions">
          <button type="button" onClick={onCancel} className="cancel-button">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="save-button">
            {saving ? 'Saving...' : 'Save Preset'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PresetEditor;

