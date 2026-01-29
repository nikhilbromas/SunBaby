import React, { useMemo, useState, useEffect, useCallback } from 'react';
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

type SetupStep = 'preset' | 'createTemplate' | 'params';

// Memoized Preset List Component
interface PresetListProps {
  presets: Preset[];
  onSelect: (presetId: number) => void;
}

const PresetList: React.FC<PresetListProps> = React.memo(({ presets, onSelect }) => {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {presets.map(p => (
        <Card
          key={p.PresetId}
          className="cursor-pointer hover:border-white/40 bg-black border-white/20"
          onClick={() => onSelect(p.PresetId)}
        >
          <CardHeader>
            <CardTitle className="text-sm text-white">{p.PresetName}</CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
});

PresetList.displayName = 'PresetList';

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

  /* ---------------- State ---------------- */
  const [step, setStep] = useState<SetupStep>('preset');
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
    setStep('preset');
    loadData();
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

  const templatesForPreset = useMemo(() => {
    if (!localPresetId) return [];
    return templates.filter(t => t.PresetId === localPresetId);
  }, [templates, localPresetId]);

  const loadDefaultParameters = useCallback(async () => {
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
  }, [localTemplateId]);

  // Load default parameters when entering params step
  useEffect(() => {
    if (step === 'params' && localTemplateId) {
      loadDefaultParameters();
    }
  }, [step, localTemplateId, loadDefaultParameters]);

  const handleParameterExecute = useCallback(async (dataOrParams: any) => {
    if (dataOrParams && (dataOrParams.header || dataOrParams.items)) {
      onDataReceived(dataOrParams);
      // Close panel after execution completes
      setTimeout(() => { onClose(); }, 300);
    }
  }, [onDataReceived, onClose]);

  const handleSaveParameters = useCallback(async (
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
  }, [localTemplateId, loadDefaultParameters]);

  const handleCopyFromTemplate = useCallback(async (sourceTemplateId: number) => {
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
        const currentPreset = presets.find(p => p.PresetId === localPresetId);
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
    }, [localTemplateId, presets, localPresetId, loadDefaultParameters]);

  const handleCopyFromPreset = useCallback(async (sourcePresetId: number) => {
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
  }, [localTemplateId, templates, handleCopyFromTemplate]);

  if (!isOpen) return null;
        
  /* ================= UI ================= */
  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-[900px] bg-black h-full flex flex-col shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/20">
          <h2 className="text-lg font-semibold text-white">
            {{
              preset: 'Select Preset',
              createTemplate: 'Create Template',
              params: 'Enter Parameters',
            }[step]}
          </h2>

          <Button variant="ghost" onClick={onClose} className="text-black bg-white hover:bg-neutral-300 hover:text-black">✕</Button>
        </div>

        {/* Lottie */}
        <div className="flex justify-center py-4">
          <Lottie animationData={lottieAnimation} style={{ width: 140 }} />
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 px-6 pb-6">

          {/* Search */}
          {step === 'preset' && (
            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 h-4 w-4 text-white/60" />
              <Input
                className="pl-9 bg-black border-white/20 text-white placeholder:text-white/40"
                placeholder="Search…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          )}

          {/* PRESET LIST */}
          {step === 'preset' && (
            <PresetList
              presets={filteredPresets}
              onSelect={(presetId) => {
                setLocalPresetId(presetId);
                onPresetSelect(presetId);
                setStep('createTemplate');
              }}
            />
          )}

          {/* CREATE TEMPLATE */}
          {step === 'createTemplate' && currentPreset && (
            <div className="space-y-4">
              {/* Existing Templates */}
              {templatesForPreset.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-white mb-3">Or select existing template:</h3>
                  <div className="grid sm:grid-cols-2 gap-4 mb-4">
                    {templatesForPreset.map(t => (
                      <Card
                        key={t.TemplateId}
                        className={cn(
                          'cursor-pointer hover:border-white/40 bg-black border-white/20',
                          localTemplateId === t.TemplateId && 'border-white'
                        )}
                        onClick={() => {
                          setLocalTemplateId(t.TemplateId);
                          onTemplateSelect(t.TemplateId);
                          setStep('params');
                        }}
                      >
                        <CardHeader>
                          <CardTitle className="text-sm text-white">{t.TemplateName}</CardTitle>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Create New Template */}
              <Card className="bg-black border-white/20">
                <CardHeader>
                  <CardTitle className="text-white">Create New Template</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-3">
                  <Input
                    placeholder="Enter template name"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    className="bg-black border-white/20 text-white placeholder:text-white/40"
                  />
                  <Button
                    onClick={async () => {
                      // Create template with default page configuration
                      const defaultTemplateJson = JSON.stringify({
                        page: {
                          size: 'A4',
                          orientation: 'portrait'
                        },
                        header: [],
                        pageHeader: [],
                        pageFooter: []
                      });
                      
                      const t = await apiClient.createTemplate({
                        presetId: currentPreset.PresetId,
                        templateName,
                        templateJson: defaultTemplateJson,
                      });
                      onTemplateSelect(t.TemplateId);
                      setLocalTemplateId(t.TemplateId);
                      setStep('params');
                    }}
                    className="border-white/20 bg-white text-black hover:bg-black hover:text-white/40"
                    disabled={!templateName.trim()}
                  >
                    Create
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* PARAMETERS */}
          {step === 'params' && currentPreset && (
            <>
              <div className="flex gap-2 mb-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCopyModalType('template');
                    setShowParameterCopyModal(true);
                  }}
                  className="border-white/20 bg-white text-black hover:bg-black hover:text-white/40"
                >
                  Copy from Template
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCopyModalType('preset');
                    setShowParameterCopyModal(true);
                  }}
                  className="border-white/20 bg-white text-black hover:bg-black hover:text-white/40"
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
        {step !== 'preset' && (
          <div className="border-t border-white/20 px-6 py-3">
            <Button
              variant="ghost"
              onClick={() => {
                if (step === 'params') {
                  setStep('createTemplate');
                } else if (step === 'createTemplate') {
                  setStep('preset');
                }
              }}
              className="text-white hover:bg-white/10"
            >
              ← Back
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SetupPanel;
