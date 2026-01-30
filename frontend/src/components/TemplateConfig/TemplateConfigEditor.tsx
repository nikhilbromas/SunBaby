import React, { useEffect, useState } from 'react';
import apiClient from '@/services/api';
import type {
  TemplateConfig,
  TemplateConfigCreate,
  TemplateConfigUpdate,
  Template,
  Preset,
  Department,
  Shop,
  Interface,
} from '@/services/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

import {
  FileText,
  Layers,
  Plug,
  Building2,
  Store,
  Tag,
  AlignLeft,
  Info,
} from 'lucide-react';

/* ---------------------------------- */
/* Small helper for icon labels        */
/* ---------------------------------- */
const IconLabel = ({
  icon,
  text,
  className,
  required,
  hint,
}: {
  icon: React.ReactNode;
  text: string;
  className?: string;
  required?: boolean;
  hint?: string;
}) => (
  <div className="flex items-center gap-2 mb-1">
    <span className="text-blue-600">{icon}</span>
    <span className={`text-sm font-medium ${className}`}>
      {text}
      {required && <span className="text-red-500 ml-1">*</span>}
    </span>
    {hint && (
      <span title={hint} className="text-slate-400 cursor-help">
        <Info className="w-3 h-3" />
      </span>
    )}
  </div>
);

interface Props {
  value?: TemplateConfig | null;
  onCancel: () => void;
  onSaved: () => void;
}

const TemplateConfigEditor: React.FC<Props> = ({
  value,
  onCancel,
  onSaved,
}) => {
  /* ---------------- Form State ---------------- */
  const [templateId, setTemplateId] = useState(0);
  const [presetId, setPresetId] = useState(0);
  const [interfaceId, setInterfaceId] = useState(0);
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [shopId, setShopId] = useState<number | null>(null);
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');

  /* ---------------- Lookups ---------------- */
  const [templates, setTemplates] = useState<Template[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [interfaces, setInterfaces] = useState<Interface[]>([]);
  const [loading, setLoading] = useState(false);

  /* ---------------- Init ---------------- */
  useEffect(() => {
    if (!templateId) {
      setPresetId(0);
      return;
    }
  
    const selectedTemplate = templates.find(
      t => t.TemplateId === templateId
    );
  
    if (selectedTemplate?.PresetId) {
      setPresetId(selectedTemplate.PresetId);
    }
  }, [templateId, templates]);
  
  useEffect(() => {
    loadLookups();

    if (value) {
      setTemplateId(value.TemplateId);
      setPresetId(value.PresetId);
      setInterfaceId(value.InterfaceId);
      setDepartmentId(value.DepartmentId ?? null);
      setShopId(value.ShopId ?? null);
      setType(value.Type);
      setDescription(value.Description ?? '');
    }
  }, [value]);

  const loadLookups = async () => {
    const [t, p, d, i] = await Promise.all([
      apiClient.getTemplates(),
      apiClient.getPresets(),
      apiClient.getDepartments(),
      apiClient.getInterfaces(0, 1000),
    ]);

    setTemplates(t.templates);
    setPresets(p.presets);
    setDepartments(d);
    setInterfaces(i);
  };

  useEffect(() => {
    if (!departmentId) {
      setShops([]);
      setShopId(null);
      return;
    }
    apiClient.getShops(departmentId).then(setShops);
  }, [departmentId]);

  /* ---------------- Save ---------------- */
  const handleSave = async () => {
    if (!templateId || !presetId || !interfaceId || !type.trim()) return;

    setLoading(true);
    try {
      const payload = {
        templateId,
        presetId,
        interfaceId,
        departmentId,
        shopId,
        type: type.trim(),
        description: description || null,
      };

      if (value) {
        await apiClient.updateTemplateConfig(value.ConfigId, payload as TemplateConfigUpdate);
      } else {
        await apiClient.createTemplateConfig(payload as TemplateConfigCreate);
      }

      onSaved();
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <div className="min-h-screen  bg-black">
    {/* Header */}
    <div className="bg-black border-b border-neutral-800 shadow">
      <div className="max-w-5xl mx-auto px-6 py-6">
        <h2 className="text-2xl font-bold text-white">
          {value ? 'Edit Template Configuration' : 'Create Template Configuration'}
        </h2>
        <p className="text-white text-sm mt-1">
          Define how templates map to interfaces and scope
        </p>
      </div>
    </div>
  
    {/* Content */}
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
  
      {/* Core Mapping */}
      <div className="bg-black border border-neutral-800 rounded-lg shadow p-6 space-y-5">
        <h3 className="font-semibold text-white">Core Mapping</h3>
  
        <div>
          <IconLabel icon={<FileText className="w-4 h-4 text-white" />} text="Template" className="text-white" required />
          <select
            className="w-full bg-black text-white border border-neutral-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-white focus:border-white"
            value={templateId}
            onChange={e => setTemplateId(+e.target.value)}
          >
            <option value={0}>Select Template</option>
            {templates.map(t => (
              <option key={t.TemplateId} value={t.TemplateId}>
                {t.TemplateName}
              </option>
            ))}
          </select>
        </div>
  
        <div>
          <IconLabel icon={<Layers className="w-4 h-4 text-white" />} text="Preset" className="text-white" required />
          <select
            className="w-full bg-neutral-900 text-white border border-neutral-800 rounded-md px-3 py-2 cursor-not-allowed"
            value={presetId}
            disabled
          >
            <option value={0}>Auto-selected</option>
            {presets.map(p => (
              <option key={p.PresetId} value={p.PresetId}>
                {p.PresetName}
              </option>
            ))}
          </select>
  
          <p className="text-xs text-white mt-1">
            Preset is automatically linked to the selected template
          </p>
        </div>
  
        <div>
          <IconLabel
            icon={<Plug className="w-4 h-4 text-white" />}
            text="Interface"
            required
            className="text-white"
            hint="Where this template is used in the system"
          />
          <select
            className="w-full bg-black text-white border border-neutral-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-white focus:border-white"
            value={interfaceId}
            onChange={e => setInterfaceId(+e.target.value)}
          >
            <option value={0}>Select Interface</option>
            {interfaces.map(i => (
              <option key={i.InterfaceID} value={i.InterfaceID}>
                {i.InterfaceName}
              </option>
            ))}
          </select>
        </div>
      </div>
  
      {/* Scope */}
      <div className="bg-black border border-neutral-800 rounded-lg shadow p-6 space-y-5">
        <h3 className="font-semibold text-white">Scope</h3>
  
        <div className="grid grid-cols-2 gap-4">
          <div>
            <IconLabel icon={<Building2 className="w-4 h-4 text-white" />} text="Department" className="text-white" />
            <select
              className="w-full bg-black text-white border border-neutral-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-white focus:border-white"
              value={departmentId ?? ''}
              onChange={e => setDepartmentId(e.target.value ? +e.target.value : null)}
            >
              <option value="">Global</option>
              {departments.map(d => (
                <option key={d.DepartmentID} value={d.DepartmentID}>
                  {d.DepartmentName}
                </option>
              ))}
            </select>
          </div>
  
          <div>
            <IconLabel icon={<Store className="w-4 h-4 text-white" />} text="Shop" className="text-white" />
            <select
              className="w-full bg-black text-white border border-neutral-700 rounded-md px-3 py-2 disabled:opacity-50"
              disabled={!departmentId}
              value={shopId ?? ''}
              onChange={e => setShopId(e.target.value ? +e.target.value : null)}
            >
              <option value="">None</option>
              {shops.map(s => (
                <option key={s.ShopID} value={s.ShopID}>
                  {s.ShopName}
                </option>
              ))}
            </select>
          </div>
        </div>
  
        <div className="pt-2 space-x-2">
          {!departmentId && !shopId && (
            <Badge className="bg-white text-black">Global</Badge>
          )}
          {departmentId && !shopId && (
            <Badge className="bg-neutral-800 text-white">Department</Badge>
          )}
          {shopId && (
            <Badge className="bg-neutral-700 text-white">Shop</Badge>
          )}
        </div>
      </div>
  
      {/* Metadata */}
      <div className="bg-black border border-neutral-800 rounded-lg shadow p-6 space-y-5">
        <h3 className="font-semibold text-white">Metadata</h3>
  
        <div>
          <IconLabel icon={<Tag className="w-4 h-4 text-white" />} text="Type" className="text-white" required />
          <Input
            className="bg-black text-white border-neutral-700 focus:border-white focus:ring-white"
            placeholder="e.g. bill, preview, print"
            value={type}
            onChange={e => setType(e.target.value)}
          />
        </div>
  
        <div>
          <IconLabel icon={<AlignLeft className="w-4 h-4 text-white" />} text="Description" className="text-white" />
          <textarea
            rows={3}
            className="w-full bg-black text-white border border-neutral-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-white focus:border-white"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>
      </div>
  
      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={onCancel}
          className="border-white bg-white text-black hover:bg-black hover:text-white"
        >
          Cancel
        </Button>
  
        <Button
          onClick={handleSave}
          disabled={loading || !templateId || !presetId || !interfaceId || !type.trim()}
          className="bg-white text-black hover:bg-black hover:text-white disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Save Configuration'}
        </Button>
      </div>
  
    </div>
  </div>
  
  );
};

export default TemplateConfigEditor;
