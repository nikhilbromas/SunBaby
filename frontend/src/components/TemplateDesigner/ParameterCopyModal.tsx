import React, { useState, useMemo } from 'react';
import type { Template, Preset } from '../../services/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import './ParameterCopyModal.css';
import '../TemplateDesigner/SetupPanel.css';

interface ParameterCopyModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'template' | 'preset';
  templates: Template[];
  presets: Preset[];
  currentTemplateId: number | null;
  onCopyFromTemplate: (templateId: number) => void;
  onCopyFromPreset: (presetId: number) => void;
}

const ParameterCopyModal: React.FC<ParameterCopyModalProps> = ({
  isOpen,
  onClose,
  type,
  templates,
  presets,
  currentTemplateId,
  onCopyFromTemplate,
  onCopyFromPreset,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return templates.filter((t) => {
      if (t.TemplateId === currentTemplateId) return false; // Exclude current template
      if (!q) return true;
      return (
        t.TemplateName.toLowerCase().includes(q) ||
        (t.CreatedBy && t.CreatedBy.toLowerCase().includes(q))
      );
    });
  }, [templates, searchQuery, currentTemplateId]);

  const filteredPresets = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return presets.filter((p) => {
      if (!q) return true;
      return (
        p.PresetName.toLowerCase().includes(q) ||
        (p.CreatedBy && p.CreatedBy.toLowerCase().includes(q))
      );
    });
  }, [presets, searchQuery]);

  if (!isOpen) return null;

  return (
    <div 
      className="parameter-copy-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="parameter-copy-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="parameter-copy-modal-header">
          <h4>Copy Parameters {type === 'template' ? 'from Template' : 'from Preset'}</h4>
          <button
            className="parameter-copy-modal-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="parameter-copy-modal-body">
          <p style={{ marginBottom: '1rem', color: '#6c757d', fontSize: '0.875rem' }}>
            {type === 'template' 
              ? 'Select a template to copy parameter values from. Only matching parameter names will be copied.'
              : 'Select a preset to copy parameter values from templates using that preset.'}
          </p>
          <div className="search-container" style={{ marginBottom: '1rem' }}>
            <input
              type="text"
              className="search-input"
              placeholder={`Search ${type === 'template' ? 'templates' : 'presets'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="search-icon">🔍</span>
          </div>
          <div className="parameter-copy-list">
            {type === 'template' ? (
              filteredTemplates.length === 0 ? (
                <div className="no-results">
                  {searchQuery ? `No templates found matching "${searchQuery}"` : 'No other templates available'}
                </div>
              ) : (
                filteredTemplates.map((template) => (
                  <div
                    key={template.TemplateId}
                    className="parameter-copy-item"
                    onClick={() => onCopyFromTemplate(template.TemplateId)}
                  >
                    <div className="parameter-copy-item-header">
                      <strong>{template.TemplateName}</strong>
                    </div>
                    <div className="parameter-copy-item-meta">
                      Template ID: {template.TemplateId}
                      {template.CreatedBy && <span> • Created by: {template.CreatedBy}</span>}
                    </div>
                  </div>
                ))
              )
            ) : (
              filteredPresets.length === 0 ? (
                <div className="no-results">
                  {searchQuery ? `No presets found matching "${searchQuery}"` : 'No presets available'}
                </div>
              ) : (
                filteredPresets.map((preset) => (
                  <div
                    key={preset.PresetId}
                    className="parameter-copy-item"
                    onClick={() => onCopyFromPreset(preset.PresetId)}
                  >
                    <div className="parameter-copy-item-header">
                      <strong>{preset.PresetName}</strong>
                    </div>
                    <div className="parameter-copy-item-meta">
                      Preset ID: {preset.PresetId}
                      {preset.CreatedBy && <span> • Created by: {preset.CreatedBy}</span>}
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParameterCopyModal;

