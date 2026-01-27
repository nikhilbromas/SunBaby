import React, { useState, useEffect } from 'react';
import PresetEditor from './PresetEditor';
import apiClient from '../../services/api';
import type { Preset } from '../../services/types';
import './PresetList.css';

const PresetList: React.FC = () => {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getPresets();
      setPresets(response.presets);
    } catch (err: any) {
      setError(err.message || 'Failed to load presets');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedPreset(null);
    setIsEditing(true);
  };

  const handleEdit = (preset: Preset) => {
    setSelectedPreset(preset);
    setIsEditing(true);
  };

  const handleDelete = async (presetId: number) => {
    if (!confirm('Are you sure you want to delete this preset?')) {
      return;
    }

    try {
      await apiClient.deletePreset(presetId);
      await loadPresets();
      if (selectedPreset?.PresetId === presetId) {
        setSelectedPreset(null);
        setIsEditing(false);
      }
    } catch (err: any) {
      alert(`Failed to delete preset: ${err.message}`);
    }
  };

  const handleSave = async () => {
    await loadPresets();
    setIsEditing(false);
    setSelectedPreset(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSelectedPreset(null);
  };

  if (isEditing) {
    return (
      <div className="preset-manager">
        <PresetEditor
          preset={selectedPreset}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </div>
    );
  }

  return (
    <div className="preset-manager">
      <div className="preset-header">
        <h2>SQL Presets</h2>
        <button onClick={handleCreateNew} className="create-button">
          + Create New Preset
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {loading && <div className="loading-message">Loading presets...</div>}

      <div className="preset-list">
        {presets.length === 0 ? (
          <div className="empty-state">
            <p>No presets found. Create your first preset to get started.</p>
          </div>
        ) : (
          <>
            {/* Desktop table view */}
            <table className="preset-table desktop-only">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Created By</th>
                  <th>Created On</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {presets.map((preset) => (
                  <tr key={preset.PresetId}>
                    <td>{preset.PresetName}</td>
                    <td>{preset.CreatedBy || 'N/A'}</td>
                    <td>{new Date(preset.CreatedOn).toLocaleDateString()}</td>
                    <td>
                      <button
                        onClick={() => handleEdit(preset)}
                        className="action-button edit-button"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(preset.PresetId)}
                        className="action-button delete-button"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile card view */}
            <div className="preset-cards mobile-only">
              {presets.map((preset) => (
                <div key={preset.PresetId} className="preset-card">
                  <div className="preset-card-header">
                    <h3 className="preset-card-title">{preset.PresetName}</h3>
                  </div>
                  <div className="preset-card-meta">
                    <div className="preset-card-info">
                      <span className="preset-card-label">Created by:</span>
                      <span className="preset-card-value">{preset.CreatedBy || 'N/A'}</span>
                    </div>
                    <div className="preset-card-info">
                      <span className="preset-card-label">Date:</span>
                      <span className="preset-card-value">{new Date(preset.CreatedOn).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="preset-card-actions">
                    <button
                      onClick={() => handleEdit(preset)}
                      className="action-button edit-button"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(preset.PresetId)}
                      className="action-button delete-button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PresetList;

