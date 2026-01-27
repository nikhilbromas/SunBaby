import React, { useMemo, useState, useEffect } from 'react';
import Lottie from 'lottie-react';
import ParameterInput from './ParameterInput';
import ParameterCopyModal from './ParameterCopyModal';
import apiClient from '@/services/api';
import type { Preset, Template } from '@/services/types';
import lottieAnimation from '../../Printer.json';

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

type SetupStep = 'template' | 'preset' | 'createTemplate' | 'parameters';

interface SetupPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPresetId?: number;
  selectedTemplateId?: number;
  onPresetSelect: (presetId: number) => void;
  onTemplateSelect: (templateId: number) => void;
  onDataReceived: any;
}

const SetupPanel: React.FC<SetupPanelProps> = (props) => {
  const {
    isOpen,
    onClose,
    selectedPresetId,
    selectedTemplateId,
    onPresetSelect,
    onTemplateSelect,
    onDataReceived,
  } = props;

  /* ---------------- State (UNCHANGED) ---------------- */
  const [step, setStep] = useState<SetupStep>('template');
  const [presets, setPresets] = useState<Preset[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const [localPresetId, setLocalPresetId] = useState<number | null>(null);
  const [localTemplateId, setLocalTemplateId] = useState<number | null>(null);
  const [templateName, setTemplateName] = useState('');

  const [defaultParameters, setDefaultParameters] = useState<Record<string, string>>({});
  const [showParameterCopyModal, setShowParameterCopyModal] = useState(false);
  const [copyModalType, setCopyModalType] = useState<'template' | 'preset' | null>(null);
  const [loadingParameters, setLoadingParameters] = useState(false);

  /* ---------------- Init ---------------- */
  useEffect(() => {
    if (!isOpen) return;

    setLocalPresetId(selectedPresetId ?? null);
    setLocalTemplateId(selectedTemplateId ?? null);
    setSearchQuery('');
    loadData();

    setStep(
      selectedTemplateId && selectedPresetId
        ? 'parameters'
        : 'template'
    );
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    const t = await apiClient.getTemplates();
    const p = await apiClient.getPresets();
    setTemplates(t.templates);
    setPresets(p.presets);
    setLoading(false);
  };

  const currentPreset = presets.find(p => p.PresetId === localPresetId);

  /* ---------------- Filtering ---------------- */
  const filteredTemplates = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return templates.filter(t =>
      t.TemplateName.toLowerCase().includes(q)
    );
  }, [templates, searchQuery]);

  const filteredPresets = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return presets.filter(p =>
      p.PresetName.toLowerCase().includes(q)
    );
  }, [presets, searchQuery]);

  if (!isOpen) return null;
  const loadDefaultParameters = async () => {
    if (!localTemplateId) return;
  
    try {
      setLoadingParameters(true);
  
      const response = await apiClient.getTemplateParameters(
        localTemplateId
      );
  
      const params: Record<string, string> = {};
  
      response.parameters.forEach((param) => {
        if (param.ParameterValue) {
          params[param.ParameterName] = param.ParameterValue;
        }
      });
  
      setDefaultParameters(params);
    } catch (error) {
      console.error('Error loading default parameters:', error);
      setDefaultParameters({});
    } finally {
      setLoadingParameters(false);
    }
  };
  
  const handleParameterExecute = async (dataOrParams: any) => { // If it's data (has header/items structure), it's from onDataReceived // If it's just parameters object, we need to fetch data 
  if (dataOrParams && (dataOrParams.header || dataOrParams.items)) { onDataReceived(dataOrParams); 
    // Close panel after execution completes 
    setTimeout(() => { onClose(); }, 300); } };
    const handleSaveParameters = async (
      parameters: Record<string, string>
    ) => {
      if (!localTemplateId) return;
    
      try {
        await apiClient.bulkUpdateTemplateParameters(
          localTemplateId,
          parameters
        );
    
        // Reload to refresh state
        await loadDefaultParameters();
      } catch (error: any) {
        throw new Error(error.message || 'Failed to save parameters');
      }
    };
    const handleCopyFromTemplate = async (sourceTemplateId: number) => {
      if (!localTemplateId) return;
    
      try {
        // Get source template parameters
        const sourceParams = await apiClient.getTemplateParameters(sourceTemplateId);
    
        const params: Record<string, string> = {};
        sourceParams.parameters.forEach((param) => {
          if (param.ParameterValue) {
            params[param.ParameterName] = param.ParameterValue;
          }
        });
    
        // Filter parameters based on current preset SQL
        if (currentPreset) {
          const sqlJson = JSON.parse(currentPreset.SqlJson);
          const paramRegex = /@(\w+)/g;
          const validParams = new Set<string>();
    
          if (sqlJson.headerQuery) {
            let match;
            while ((match = paramRegex.exec(sqlJson.headerQuery)) !== null) {
              validParams.add(match[1]);
            }
          }
    
          if (sqlJson.itemQuery) {
            let match;
            while ((match = paramRegex.exec(sqlJson.itemQuery)) !== null) {
              validParams.add(match[1]);
            }
          }
    
          if (sqlJson.contentDetails && Array.isArray(sqlJson.contentDetails)) {
            sqlJson.contentDetails.forEach((cd: any) => {
              if (cd.query) {
                let match;
                while ((match = paramRegex.exec(cd.query)) !== null) {
                  validParams.add(match[1]);
                }
              }
            });
          }
    
          const filteredParams: Record<string, string> = {};
          Object.keys(params).forEach((key) => {
            if (validParams.has(key)) {
              filteredParams[key] = params[key];
            }
          });
    
          await apiClient.bulkUpdateTemplateParameters(
            localTemplateId,
            filteredParams
          );
        }
    
        await loadDefaultParameters();
        setShowParameterCopyModal(false);
      } catch (error: any) {
        alert(`Failed to copy parameters: ${error.message}`);
      }
    };
    const handleCopyFromPreset = async (sourcePresetId: number) => {
      if (!localTemplateId) return;
    
      try {
        const templatesWithPreset = templates.filter(
          t =>
            t.PresetId === sourcePresetId &&
            t.TemplateId !== localTemplateId
        );
    
        if (templatesWithPreset.length > 0) {
          await handleCopyFromTemplate(
            templatesWithPreset[0].TemplateId
          );
        } else {
          alert('No templates found with this preset to copy parameters from');
        }
      } catch (error: any) {
        alert(`Failed to copy parameters: ${error.message}`);
      }
    };
        
  /* ================= UI ================= */
  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-[900px] bg-white h-full flex flex-col shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">
            {{
              template: 'Select Template',
              preset: 'Select Preset',
              createTemplate: 'Create Template',
              parameters: 'Enter Parameters',
            }[step]}
          </h2>

          <Button variant="ghost" onClick={onClose}>✕</Button>
        </div>

        {/* Lottie */}
        <div className="flex justify-center py-4">
          <Lottie animationData={lottieAnimation} style={{ width: 140 }} />
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 px-6 pb-6">

          {/* Search */}
          {(step === 'template' || step === 'preset') && (
            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          )}

          {/* TEMPLATE LIST */}
          {step === 'template' && (
            <div className="grid sm:grid-cols-2 gap-4">
              <Card
                className="border-dashed cursor-pointer hover:bg-muted"
                onClick={() => setStep('preset')}
              >
                <CardContent className="flex flex-col items-center justify-center py-10">
                  <div className="text-3xl">＋</div>
                  <p className="mt-2 text-sm font-medium">Create New Template</p>
                </CardContent>
              </Card>

              {filteredTemplates.map(t => (
                <Card
                  key={t.TemplateId}
                  className={cn(
                    'cursor-pointer hover:border-primary',
                    localTemplateId === t.TemplateId && 'border-primary'
                  )}
                  onClick={() => {
                    setLocalTemplateId(t.TemplateId);
                    setLocalPresetId(t.PresetId);
                    onPresetSelect(t.PresetId);
                    onTemplateSelect(t.TemplateId);
                    setStep('parameters');
                  }}
                >
                  <CardHeader>
                    <CardTitle className="text-sm">{t.TemplateName}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    Preset #{t.PresetId}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* PRESET LIST */}
          {step === 'preset' && (
            <div className="grid sm:grid-cols-2 gap-4">
              {filteredPresets.map(p => (
                <Card
                  key={p.PresetId}
                  className="cursor-pointer hover:border-primary"
                  onClick={() => {
                    setLocalPresetId(p.PresetId);
                    onPresetSelect(p.PresetId);
                    setStep('createTemplate');
                  }}
                >
                  <CardHeader>
                    <CardTitle className="text-sm">{p.PresetName}</CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}

          {/* CREATE TEMPLATE */}
          {step === 'createTemplate' && currentPreset && (
            <Card>
              <CardHeader>
                <CardTitle>Template Name</CardTitle>
              </CardHeader>
              <CardContent className="flex gap-3">
                <Input
                  placeholder="Enter template name"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                />
                <Button
                  onClick={async () => {
                    const t = await apiClient.createTemplate({
                      presetId: currentPreset.PresetId,
                      templateName,
                      templateJson: '{}',
                    });
                    onTemplateSelect(t.TemplateId);
                    setLocalTemplateId(t.TemplateId);
                    setStep('parameters');
                  }}
                >
                  Create
                </Button>
              </CardContent>
            </Card>
          )}

          {/* PARAMETERS */}
          {step === 'parameters' && currentPreset && (
            <>
              <div className="flex gap-2 mb-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCopyModalType('template');
                    setShowParameterCopyModal(true);
                  }}
                >
                  Copy from Template
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCopyModalType('preset');
                    setShowParameterCopyModal(true);
                  }}
                >
                  Copy from Preset
                </Button>
              </div>
              <ParameterInput
  preset={currentPreset}
  templateId={localTemplateId || undefined}
  defaultParameters={defaultParameters}

  // ✅ ADD THIS
  onExecute={() => {}}

  onDataReceived={handleParameterExecute}
  onSaveParameters={handleSaveParameters}
/>

            </>
          )}

{showParameterCopyModal && (
  <ParameterCopyModal
    isOpen={showParameterCopyModal}
    onClose={() => {
      setShowParameterCopyModal(false);
      setCopyModalType(null);
    }}
    type={copyModalType || 'template'}
    templates={templates}
    presets={presets}
    currentTemplateId={localTemplateId}

    // ✅ REQUIRED FIX
    onCopyFromTemplate={handleCopyFromTemplate}
    onCopyFromPreset={handleCopyFromPreset}
  />
)}

        </ScrollArea>

        {/* Footer */}
        {step !== 'template' && (
          <div className="border-t px-6 py-3">
            <Button variant="ghost" onClick={() => setStep('template')}>
              ← Back
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SetupPanel;
