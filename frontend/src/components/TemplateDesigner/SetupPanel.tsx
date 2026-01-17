import React, { useState, useEffect } from 'react';
import Lottie from 'lottie-react';
import ParameterInput from './ParameterInput';
import apiClient from '../../services/api';
import type { Preset, Template } from '../../services/types';
import lottieAnimation from '../../Printer.json';
import './SetupPanel.css';

type SetupStep = 'preset' | 'template' | 'parameters';

interface SetupPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPresetId?: number;
  selectedTemplateId?: number;
  selectedPreset: Preset | null;
  onPresetSelect: (presetId: number) => void;
  onTemplateSelect: (templateId: number) => void;
  onDataReceived: (data: {
    header: { data: Record<string, any> | null; fields: string[] };
    items: { data: Record<string, any>[]; fields: string[]; sampleCount: number };
    contentDetails?: Record<string, { data: Record<string, any>[] | Record<string, any> | null; fields: string[]; sampleCount: number; dataType?: 'array' | 'object' }>;
  }) => void;
}

const SetupPanel: React.FC<SetupPanelProps> = ({
  isOpen,
  onClose,
  selectedPresetId,
  selectedTemplateId,
  selectedPreset,
  onPresetSelect,
  onTemplateSelect,
  onDataReceived,
}) => {
  const [step, setStep] = useState<SetupStep>('preset');
  const [presets, setPresets] = useState<Preset[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [localPresetId, setLocalPresetId] = useState<number | null>(selectedPresetId || null);
  const [localTemplateId, setLocalTemplateId] = useState<number | null>(selectedTemplateId || null);
  const [templateName, setTemplateName] = useState('');
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep('preset');
      setLocalPresetId(selectedPresetId || null);
      setLocalTemplateId(selectedTemplateId || null);
      setSearchQuery('');
      setTemplateName('');
      loadPresets();
    }
  }, [isOpen]);

  useEffect(() => {
    if (localPresetId) {
      loadTemplates(localPresetId);
      const preset = presets.find(p => p.PresetId === localPresetId);
      if (preset) {
        onPresetSelect(localPresetId);
      }
    }
  }, [localPresetId]);

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

  const handlePresetSelect = (presetId: number) => {
    setLocalPresetId(presetId);
    onPresetSelect(presetId);
    setStep('template');
  };

  const handleTemplateSelect = async (templateId: number | null) => {
    if (templateId) {
      setLocalTemplateId(templateId);
      onTemplateSelect(templateId);
      setStep('parameters');
    } else {
      // Create new template
      if (!templateName.trim()) {
        alert('Please enter a template name');
        return;
      }
      try {
        setCreatingTemplate(true);
        const newTemplate = await apiClient.createTemplate({
          presetId: localPresetId!,
          templateName: templateName.trim(),
          templateJson: JSON.stringify({
            page: { size: 'A4', orientation: 'portrait' },
            header: [],
          }),
        });
        setLocalTemplateId(newTemplate.TemplateId);
        onTemplateSelect(newTemplate.TemplateId);
        await loadTemplates(localPresetId!);
        setStep('parameters');
      } catch (error: any) {
        alert(`Failed to create template: ${error.message}`);
      } finally {
        setCreatingTemplate(false);
      }
    }
  };

  const handleParameterExecute = async (dataOrParams: any) => {
    // If it's data (has header/items structure), it's from onDataReceived
    // If it's just parameters object, we need to fetch data
    if (dataOrParams && (dataOrParams.header || dataOrParams.items)) {
      onDataReceived(dataOrParams);
      // Close panel after execution completes
      setTimeout(() => {
        onClose();
      }, 300);
    }
  };

  const handleBack = () => {
    if (step === 'template') {
      setStep('preset');
      setLocalTemplateId(null);
    } else if (step === 'parameters') {
      setStep('template');
    }
  };

  const filteredPresets = presets.filter(preset =>
    preset.PresetName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (preset.CreatedBy && preset.CreatedBy.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const currentPreset = presets.find(p => p.PresetId === localPresetId);

  if (!isOpen) return null;

  return (
    <>
      <div className="setup-panel-backdrop" onClick={onClose} />
      <div className={`setup-panel ${isOpen ? 'open' : ''}`}>
        <div className="setup-panel-header">
          <h3>
            {step === 'preset' && 'Select Preset'}
            {step === 'template' && 'Select Template'}
            {step === 'parameters' && 'Enter Parameters'}
          </h3>
          <button className="setup-panel-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="setup-panel-lottie">
          <Lottie 
            animationData={lottieAnimation} 
            loop={true}
            autoplay={true}
            style={{ width: 200, height: 200 }}
          />
        </div>
        <div className="setup-panel-content">
          {step === 'preset' && (
            <div className="preset-selection">
              <div className="search-container">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search presets by name or creator..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <span className="search-icon">🔍</span>
              </div>
              {loading ? (
                <div className="loading-state">Loading presets...</div>
              ) : (
                <div className="preset-cards">
                  {filteredPresets.length === 0 ? (
                    <div className="no-results">No presets found matching "{searchQuery}"</div>
                  ) : (
                    filteredPresets.map((preset) => (
                      <div
                        key={preset.PresetId}
                        className={`preset-card ${localPresetId === preset.PresetId ? 'selected' : ''}`}
                        onClick={() => handlePresetSelect(preset.PresetId)}
                      >
                        <div className="preset-card-header">
                          <h4>{preset.PresetName}</h4>
                          {localPresetId === preset.PresetId && <span className="check-mark">✓</span>}
                        </div>
                        {preset.CreatedBy && (
                          <div className="preset-card-meta">
                            <span>Created by: {preset.CreatedBy}</span>
                          </div>
                        )}
                        <div className="preset-card-date">
                          {new Date(preset.CreatedOn).toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {step === 'template' && currentPreset && (
            <div className="template-selection">
              <div className="selected-preset-info">
                <h4>Preset: {currentPreset.PresetName}</h4>
              </div>
              
              <div className="template-options">
                <div className="create-template-section">
                  <h5>Create New Template</h5>
                  <div className="create-template-form">
                    <input
                      type="text"
                      className="template-name-input"
                      placeholder="Enter template name..."
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                    />
                    <button
                      className="create-template-btn"
                      onClick={() => handleTemplateSelect(null)}
                      disabled={!templateName.trim() || creatingTemplate}
                    >
                      {creatingTemplate ? 'Creating...' : '+ Create New Template'}
                    </button>
                  </div>
                </div>

                {templates.length > 0 && (
                  <>
                    <div className="divider">OR</div>
                    <div className="existing-templates-section">
                      <h5>Select Existing Template</h5>
                      <div className="template-list">
                        {templates.map((template) => (
                          <div
                            key={template.TemplateId}
                            className={`template-item ${localTemplateId === template.TemplateId ? 'selected' : ''}`}
                            onClick={() => handleTemplateSelect(template.TemplateId)}
                          >
                            <span>{template.TemplateName}</span>
                            {localTemplateId === template.TemplateId && <span className="check-mark">✓</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {step === 'parameters' && currentPreset && (
            <div className="parameters-section">
              <ParameterInput
                preset={currentPreset}
                onExecute={() => {}} // onExecute is called but we use onDataReceived for closing
                onDataReceived={handleParameterExecute}
              />
            </div>
          )}

          {step !== 'preset' && (
            <div className="setup-panel-actions">
              <button className="back-button" onClick={handleBack}>
                ← Back
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SetupPanel;

