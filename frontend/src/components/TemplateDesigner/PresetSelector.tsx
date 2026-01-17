import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api';
import type { Preset, Template } from '../../services/types';
import './PresetSelector.css';

interface PresetSelectorProps {
  onPresetSelect: (presetId: number) => void;
  onTemplateSelect: (templateId: number) => void;
  selectedPresetId?: number;
  selectedTemplateId?: number;
}

const PresetSelector: React.FC<PresetSelectorProps> = ({
  onPresetSelect,
  onTemplateSelect,
  selectedPresetId,
  selectedTemplateId,
}) => {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPresets();
  }, []);

  useEffect(() => {
    if (selectedPresetId) {
      loadTemplates(selectedPresetId);
    } else {
      setTemplates([]);
    }
  }, [selectedPresetId]);

  const loadPresets = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getPresets();
      setPresets(response.presets);
    } catch (error) {
      console.error('Error loading presets:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async (presetId: number) => {
    try {
      const response = await apiClient.getTemplates(presetId);
      setTemplates(response.templates);
    } catch (error) {
      console.error('Error loading templates:', error);
      setTemplates([]);
    }
  };

  return (
    <div className="preset-selector">
      <div className="selector-group">
        <label>
          Select Preset: *
          <select
            value={selectedPresetId || ''}
            onChange={(e) => {
              const presetId = e.target.value ? parseInt(e.target.value) : undefined;
              onPresetSelect(presetId || 0);
              onTemplateSelect(0); // Reset template selection
            }}
            required
          >
            <option value="">-- Select Preset --</option>
            {presets.map((preset) => (
              <option key={preset.PresetId} value={preset.PresetId}>
                {preset.PresetName}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedPresetId && (
        <div className="selector-group">
          <label>
            Select Template (Optional):
            <select
              value={selectedTemplateId || ''}
              onChange={(e) => {
                const templateId = e.target.value ? parseInt(e.target.value) : undefined;
                onTemplateSelect(templateId || 0);
              }}
            >
              <option value="">-- Create New Template --</option>
              {templates.map((template) => (
                <option key={template.TemplateId} value={template.TemplateId}>
                  {template.TemplateName}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
};

export default PresetSelector;

