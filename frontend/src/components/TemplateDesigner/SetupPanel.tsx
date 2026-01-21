import React, { useMemo, useState, useEffect } from 'react';
import Lottie from 'lottie-react';
import ParameterInput from './ParameterInput';
import apiClient from '../../services/api';
import type { Preset, Template } from '../../services/types';
import lottieAnimation from '../../Printer.json';
import './SetupPanel.css';

type SetupStep = 'template' | 'preset' | 'createTemplate' | 'parameters';

interface SetupPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPresetId?: number;
  selectedTemplateId?: number;
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
  onPresetSelect,
  onTemplateSelect,
  onDataReceived,
}) => {
  const [step, setStep] = useState<SetupStep>('template');
  const [presets, setPresets] = useState<Preset[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [localPresetId, setLocalPresetId] = useState<number | null>(selectedPresetId || null);
  const [localTemplateId, setLocalTemplateId] = useState<number | null>(selectedTemplateId || null);
  const [templateName, setTemplateName] = useState('');
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLocalPresetId(selectedPresetId || null);
      setLocalTemplateId(selectedTemplateId || null);
      setSearchQuery('');
      setTemplateName('');
      loadPresetsAndTemplates();
      
      // If template and preset are already selected, go directly to parameters
      if (selectedTemplateId && selectedPresetId) {
        setStep('parameters');
      } else {
        setStep('template');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedTemplateId, selectedPresetId]);

  useEffect(() => {
    // keep parent in sync when preset changes during create flow
    if (!localPresetId) return;
    // Only sync if it's different from the current selected preset to avoid unnecessary updates
    if (localPresetId !== selectedPresetId) {
      onPresetSelect(localPresetId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localPresetId]);

  const loadPresetsAndTemplates = async () => {
    try {
      setLoading(true);
      const [presetResp, templateResp] = await Promise.all([
        apiClient.getPresets(),
        apiClient.getTemplates(undefined),
      ]);
      setPresets(presetResp.presets);
      setTemplates(templateResp.templates);
    } catch (error) {
      console.error('Error loading presets/templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const response = await apiClient.getTemplates(undefined);
      setTemplates(response.templates);
    } catch (error) {
      console.error('Error loading templates:', error);
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handlePresetSelectForCreate = (presetId: number) => {
    setLocalPresetId(presetId);
    onPresetSelect(presetId);
    setStep('createTemplate');
  };

  const handleExistingTemplateSelect = (template: Template) => {
    setLocalTemplateId(template.TemplateId);
    setLocalPresetId(template.PresetId);
    onPresetSelect(template.PresetId);
    onTemplateSelect(template.TemplateId);
    setStep('parameters');
  };

  const handleCreateNewClick = () => {
    setLocalPresetId(null);
    setLocalTemplateId(null);
    setTemplateName('');
    setStep('preset');
  };

  const handleCreateTemplateConfirm = async () => {
    if (!localPresetId) {
      alert('Please select a preset');
      return;
    }
    if (!templateName.trim()) {
      alert('Please enter a template name');
      return;
    }
    try {
      setCreatingTemplate(true);
      const newTemplate = await apiClient.createTemplate({
        presetId: localPresetId,
        templateName: templateName.trim(),
        templateJson: JSON.stringify({
          page: { size: 'A4', orientation: 'portrait' },
          header: [],
        }),
      });
      setLocalTemplateId(newTemplate.TemplateId);
      onTemplateSelect(newTemplate.TemplateId);
      await loadAllTemplates();
      setStep('parameters');
    } catch (error: any) {
      alert(`Failed to create template: ${error.message}`);
    } finally {
      setCreatingTemplate(false);
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
    if (step === 'preset') {
      setStep('template');
      return;
    }
    if (step === 'createTemplate') {
      setStep('preset');
      return;
    }
    if (step === 'parameters') {
      // If we came from an existing template selection, go back to template list
      // Otherwise, if we created a new template, go back to createTemplate step
      if (selectedTemplateId && localTemplateId === selectedTemplateId) {
        // We're using an existing template, go back to template list
        setStep('template');
      } else if (localTemplateId && !selectedTemplateId) {
        // We created a new template, go back to createTemplate step
        setStep('createTemplate');
      } else {
        // Default: go back to template list
        setStep('template');
      }
    }
  };

  const presetById = useMemo(() => {
    const m = new Map<number, Preset>();
    for (const p of presets) m.set(p.PresetId, p);
    return m;
  }, [presets]);

  const filteredTemplates = templates.filter((t) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const presetName = presetById.get(t.PresetId)?.PresetName || '';
    return (
      t.TemplateName.toLowerCase().includes(q) ||
      presetName.toLowerCase().includes(q) ||
      (t.CreatedBy && t.CreatedBy.toLowerCase().includes(q))
    );
  });

  const filteredPresets = presets.filter((preset) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      preset.PresetName.toLowerCase().includes(q) ||
      (preset.CreatedBy && preset.CreatedBy.toLowerCase().includes(q))
    );
  });

  const currentPreset = presets.find(p => p.PresetId === localPresetId);

  if (!isOpen) return null;

  return (
    <>
      <div className="setup-panel-backdrop" onClick={onClose} />
      <div className={`setup-panel ${isOpen ? 'open' : ''}`}>
        <div className="setup-panel-header">
          <h3>
            {step === 'template' && 'Select Template'}
            {step === 'preset' && 'Select Preset'}
            {step === 'createTemplate' && 'Create Template'}
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
          {step === 'template' && (
            <div className="template-selection">
              {selectedTemplateId && localTemplateId === selectedTemplateId && (
                <div className="current-template-banner" style={{
                  background: 'linear-gradient(135deg, rgba(11, 99, 255, 0.1) 0%, rgba(11, 99, 255, 0.05) 100%)',
                  border: '1px solid rgba(11, 99, 255, 0.2)',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <strong style={{ color: 'var(--brand-600)' }}>Current Template Selected</strong>
                    <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                      Template ID: {selectedTemplateId}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const template = templates.find(t => t.TemplateId === selectedTemplateId);
                      if (template) {
                        handleExistingTemplateSelect(template);
                      }
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      background: 'var(--brand-600)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 600
                    }}
                  >
                    Continue to Parameters →
                  </button>
                </div>
              )}
              <div className="search-container">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search templates by name, preset, or creator..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <span className="search-icon">🔍</span>
              </div>

              {loading ? (
                <div className="loading-state">Loading templates...</div>
              ) : (
                <div className="template-cards">
                  <div className="template-card template-card-create" onClick={handleCreateNewClick}>
                    <div className="template-card-create-icon">＋</div>
                    <div className="template-card-create-title">Create New Template</div>
                    <div className="template-card-create-subtitle">Select a preset → name → parameters</div>
                  </div>

                  {loadingTemplates && (
                    <div className="loading-state">Refreshing templates...</div>
                  )}

                  {filteredTemplates.length === 0 ? (
                    <div className="no-results">No templates found matching "{searchQuery}"</div>
                  ) : (
                    filteredTemplates.map((template) => {
                      const presetName = presetById.get(template.PresetId)?.PresetName || `Preset #${template.PresetId}`;
                      return (
                        <div
                          key={template.TemplateId}
                          className={`template-card ${localTemplateId === template.TemplateId ? 'selected' : ''}`}
                          onClick={() => handleExistingTemplateSelect(template)}
                        >
                          <div className="template-card-header">
                            <h4>{template.TemplateName}</h4>
                            {localTemplateId === template.TemplateId && <span className="check-mark">✓</span>}
                          </div>
                          <div className="template-card-meta">
                            <span className="template-card-pill">{presetName}</span>
                            {template.CreatedBy && <span className="template-card-muted">by {template.CreatedBy}</span>}
                          </div>
                          <div className="template-card-date">
                            {new Date(template.CreatedOn).toLocaleDateString()}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

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
                        onClick={() => handlePresetSelectForCreate(preset.PresetId)}
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

          {step === 'createTemplate' && currentPreset && (
            <div className="create-template-flow">
              <div className="selected-preset-info">
                <h4>Preset: {currentPreset.PresetName}</h4>
              </div>
              <div className="create-template-section">
                <h5>Template Name</h5>
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
                    onClick={handleCreateTemplateConfirm}
                    disabled={!templateName.trim() || creatingTemplate}
                  >
                    {creatingTemplate ? 'Creating...' : '+ Create'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'parameters' && currentPreset && (
            <div className="parameters-section">
              {localTemplateId && (
                <div className="selected-template-info" style={{ 
                  background: '#f8f9fa', 
                  padding: '1rem', 
                  borderRadius: '8px', 
                  marginBottom: '1rem',
                  borderLeft: '4px solid #007bff'
                }}>
                  <strong>Template ID: {localTemplateId}</strong>
                  {localTemplateId === selectedTemplateId && (
                    <span style={{ marginLeft: '0.5rem', color: '#6c757d', fontSize: '0.875rem' }}>
                      (Currently Selected)
                    </span>
                  )}
                </div>
              )}
              <ParameterInput
                preset={currentPreset}
                onExecute={() => {}} // onExecute is called but we use onDataReceived for closing
                onDataReceived={handleParameterExecute}
              />
            </div>
          )}

          {step !== 'template' && (
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

