import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api';
import type {
  TemplateConfig,
  TemplateConfigCreate,
  TemplateConfigUpdate,
  Template,
  Preset,
  Department,
  Shop,
  Interface,
} from '../../services/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import TemplateConfigEditor from './TemplateConfigEditor';
import { cn } from '@/lib/utils';
import './TemplateConfigList.css';

function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}


const TemplateConfigList: React.FC = () => {
  const [configs, setConfigs] = useState<TemplateConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<TemplateConfig | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [templateId, setTemplateId] = useState<number>(0);
  const [presetId, setPresetId] = useState<number>(0);
  const [interfaceId, setInterfaceId] = useState<number>(0);
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [shopId, setShopId] = useState<number | null>(null);
  const [type, setType] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // Lookup data
  const [templates, setTemplates] = useState<Template[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  // const [interfaces, setInterfaces] = useState<Interface[]>([]);
  const [interfaceSearch, setInterfaceSearch] = useState<string>('');
  const [loadingLookups, setLoadingLookups] = useState(false);

  const [showInterfaceDropdown, setShowInterfaceDropdown] = useState(false);
  
  const debouncedInterfaceSearch = useDebounce(interfaceSearch, 300);

  const [allInterfaces, setAllInterfaces] = useState<Interface[]>([]);
const [filteredInterfaces, setFilteredInterfaces] = useState<Interface[]>([]);

  

useEffect(() => {
  const fetchInterfaces = async () => {
    if (!debouncedInterfaceSearch.trim()) {
      setFilteredInterfaces(allInterfaces);
      return;
    }

    const res = await apiClient.getInterfaces(0, 50, debouncedInterfaceSearch);
    setFilteredInterfaces(res);
  };

  fetchInterfaces();
}, [debouncedInterfaceSearch, allInterfaces]);

  
  useEffect(() => {
    loadConfigs();
    loadLookupData();
  }, []);

  useEffect(() => {
    // When department changes, reload shops
    if (departmentId) {
      loadShops(departmentId);
    } else {
      setShops([]);
      setShopId(null);
    }
  }, [departmentId]);

  useEffect(() => {
    // When template is selected, automatically select its preset
    if (templateId && templateId > 0) {
      const selectedTemplate = templates.find((t) => t.TemplateId === templateId);
      if (selectedTemplate) {
        setPresetId(selectedTemplate.PresetId);
      }
    } else {
      // Reset preset when template is cleared
      setPresetId(0);
    }
  }, [templateId, templates]);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getTemplateConfigs();
      
      setConfigs(response.configs);
      
      // After loading configs, load shops for all departments referenced in configs
      const uniqueDeptIds = [...new Set(response.configs
        .map(c => c.DepartmentId)
        .filter(id => id !== null && id !== undefined))] as number[];
      
      // Also get all shop IDs from configs to ensure we load them
      const uniqueShopIds = [...new Set(response.configs
        .map(c => c.ShopId)
        .filter(id => id !== null && id !== undefined))] as number[];
      
      // Load shops for all departments
      const allShops: Shop[] = [];
      if (uniqueDeptIds.length > 0) {
        for (const deptId of uniqueDeptIds) {
          try {
            const shopsRes = await apiClient.getShops(deptId);
            allShops.push(...shopsRes);
          } catch (err) {
            console.error(`Failed to load shops for department ${deptId}:`, err);
          }
        }
      }
      
      // Also load shops without department filter to catch any shops that might not have DepartmentID set
      // or shops that are referenced but their department isn't in the list
      if (uniqueShopIds.length > 0) {
        try {
          // Load all shops (without department filter) to find any missing ones
          const allShopsRes = await apiClient.getShops();
          // Filter to only shops we need
          const neededShops = allShopsRes.filter(s => uniqueShopIds.includes(s.ShopID));
          allShops.push(...neededShops);
        } catch (err) {
          console.error('Failed to load all shops:', err);
        }
      }
      
      // Merge with existing shops, avoiding duplicates
      if (allShops.length > 0) {
        setShops(prev => {
          const existingIds = new Set(prev.map(s => s.ShopID));
          const newShops = allShops.filter(s => !existingIds.has(s.ShopID));
          return [...prev, ...newShops];
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load template configs');
    } finally {
      setLoading(false);
    }
  };

  const loadLookupData = async () => {
    try {
      setLoadingLookups(true);
      // Load all interfaces (increase limit to handle 647+ records)
      // Load in batches if needed
      const [templatesRes, presetsRes, deptsRes] = await Promise.all([
        apiClient.getTemplates(),
        apiClient.getPresets(),
        apiClient.getDepartments(),
      ]);
      setTemplates(templatesRes.templates);
      setPresets(presetsRes.presets);
      setDepartments(deptsRes);
      
      
      // Load all interfaces in batches
      let allInterfaces: Interface[] = [];
      let skip = 0;
      const limit = 1000; // Large limit to get all interfaces
      let hasMore = true;
      
      while (hasMore) {
        try {
          const interfacesRes = await apiClient.getInterfaces(skip, limit);
          allInterfaces.push(...interfacesRes);
          if (interfacesRes.length < limit) {
            hasMore = false;
          } else {
            skip += limit;
          }
        } catch (err) {
          console.error('Failed to load interfaces:', err);
          hasMore = false;
        }
      }
      setAllInterfaces(allInterfaces);
setFilteredInterfaces(allInterfaces);

     
    } catch (err: any) {
      setError(err.message || 'Failed to load lookup data');
    } finally {
      setLoadingLookups(false);
    }
  };

  const loadShops = async (deptId: number) => {
    try {
      const shopsRes = await apiClient.getShops(deptId);
      setShops(shopsRes);
    } catch (err: any) {
      console.error('Failed to load shops:', err);
    }
  };

  // const handleSearchInterfaces = async (search: string) => {
  //   setInterfaceSearch(search);
  //   try {
  //     const interfacesRes = await apiClient.getInterfaces(0, 100, search);
  //     setAllInterfaces(interfacesRes);
  //   } catch (err: any) {
  //     console.error('Failed to search interfaces:', err);
  //   }
  // };

  const handleCreateNew = () => {
    setSelectedConfig(null);
    setTemplateId(0);
    setPresetId(0);
    setInterfaceId(0);
    setInterfaceSearch('');
    setDepartmentId(null);
    setShopId(null);
    setType('');
    setDescription('');
    setIsEditing(true);
  };
  

  const handleEdit = (config: TemplateConfig) => {
    setSelectedConfig(config);
    setTemplateId(config.TemplateId);
    setPresetId(config.PresetId);
    setInterfaceId(config.InterfaceId);
    setDepartmentId(config.DepartmentId || null);
    setShopId(config.ShopId || null);
    setType(config.Type);
    setDescription(config.Description || '');
    setIsEditing(true);
    const interfaceItem = allInterfaces.find(
      i => i.InterfaceID === config.InterfaceId
    );
   
    setInterfaceSearch(
      interfaceItem
        ? `${interfaceItem.InterfaceName}${interfaceItem.ModuleCode ? ` (${interfaceItem.ModuleCode})` : ''}`
        : ''
    );
  
    if (config.DepartmentId) {
      loadShops(config.DepartmentId);
    }
   
  };

  const handleDelete = async (configId: number) => {
    if (!confirm('Are you sure you want to delete this template config?')) {
      return;
    }

    try {
      await apiClient.deleteTemplateConfig(configId);
      await loadConfigs();
      if (selectedConfig?.ConfigId === configId) {
        setSelectedConfig(null);
        setIsEditing(false);
      }
    } catch (err: any) {
      alert(`Failed to delete template config: ${err.message}`);
    }
  };

  const handleSave = async () => {
    if (!templateId || !presetId || !interfaceId || !type.trim()) {
      alert('Please fill in all required fields (Template, Preset, Interface, Type)');
      return;
    }

    try {
      setLoading(true);
      if (selectedConfig) {
        // Update
        const updateData: TemplateConfigUpdate = {
          templateId,
          presetId,
          interfaceId,
          departmentId: departmentId || null,
          shopId: shopId || null,
          type: type.trim(),
          description: description.trim() || null,
        };
        await apiClient.updateTemplateConfig(selectedConfig.ConfigId, updateData);
      } else {
        // Create
        const createData: TemplateConfigCreate = {
          templateId,
          presetId,
          interfaceId,
          departmentId: departmentId || null,
          shopId: shopId || null,
          type: type.trim(),
          description: description.trim() || null,
        };
        await apiClient.createTemplateConfig(createData);
      }
      await loadConfigs();
      setIsEditing(false);
      setSelectedConfig(null);
    } catch (err: any) {
      alert(`Failed to save template config: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSelectedConfig(null);
  };

  if (isEditing) {
    return (
      <TemplateConfigEditor
        value={selectedConfig}
        onCancel={() => setIsEditing(false)}
        onSaved={() => {
          setIsEditing(false);
          setSelectedConfig(null);
          loadConfigs();
        }}
      />
    );
  }
  
  

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="bg-black text-white shadow-lg">
  <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <h2 className="text-2xl font-bold">
        Template Configurations
      </h2>
      <p className="text-neutral-300 text-sm mt-1">
        Manage template ↔ interface mappings and scope
      </p>
    </div>

    <button
      onClick={handleCreateNew}
      className="
        bg-white 
        text-black 
        font-semibold 
        px-4 py-2 
        rounded-md 
        border border-white
        transition
        hover:bg-black 
        hover:text-white
        hover:border-white
      "
    >
      + Create New Config
    </button>
  </div>
</div>

  
      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
  
        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
  
        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-lg shadow border p-12 flex flex-col items-center text-slate-500">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4" />
            Loading template configs…
          </div>
        )}
  
        {/* Empty */}
        {!loading && configs.length === 0 && (
          <div className="bg-white rounded-lg shadow border p-12 text-center">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              No template configurations
            </h3>
            <p className="text-slate-600 mb-6">
              Create your first template configuration to get started.
            </p>
            <button
              onClick={handleCreateNew}
              className="bg-blue-600 text-white px-5 py-2 rounded-md hover:bg-blue-700"
            >
              + Create First Config
            </button>
          </div>
        )}
  
        {/* Desktop Table */}
        {!loading && configs.length > 0 && (
          <>
            <div className="hidden md:block bg-white rounded-lg shadow border overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-black border-b border-neutral-800">
  <tr>
    <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase">
      Template
    </th>
    <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase">
      Preset
    </th>
    <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase">
      Interface
    </th>
    <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase">
      Scope
    </th>
    <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase">
      Type
    </th>
    <th className="px-6 py-3 text-right text-xs font-semibold text-white uppercase">
      Actions
    </th>
  </tr>
</thead>

  
                <tbody className="divide-y divide-slate-200">
                  {configs.map((config) => {
                    const template = templates.find(t => t.TemplateId === config.TemplateId);
                    const preset = presets.find(p => p.PresetId === config.PresetId);
                    const interfaceItem = allInterfaces.find(i => i.InterfaceID === config.InterfaceId);
                    const department = departments.find(d => d.DepartmentID === config.DepartmentId);
                    const shop = shops.find(s => s.ShopID === config.ShopId);
  
                    return (
                      <tr
                      key={config.ConfigId}
                      className="bg-black text-white hover:bg-neutral-900 transition-colors"
                    >
                      {/* Template */}
                      <td className="px-6 py-4 font-medium text-white">
                        {template?.TemplateName || `Template ${config.TemplateId}`}
                      </td>
                    
                      {/* Preset */}
                      <td className="px-6 py-4 text-neutral-200">
                        {preset?.PresetName || `Preset ${config.PresetId}`}
                      </td>
                    
                      {/* Interface */}
                      <td className="px-6 py-4 text-neutral-200">
                        {interfaceItem ? (
                          <div className="leading-tight">
                            <div className="font-medium text-white">
                              {interfaceItem.InterfaceName}
                            </div>
                            {interfaceItem.ModuleCode && (
                              <div className="text-xs text-neutral-400">
                                {interfaceItem.ModuleCode}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-neutral-400">
                            Interface {config.InterfaceId}
                          </span>
                        )}
                      </td>
                    
                      {/* Scope */}
                      <td className="px-6 py-4">
                        {!config.DepartmentId && !config.ShopId && (
                          <span className="px-2 py-1 text-xs rounded border border-white text-white">
                            Global
                          </span>
                        )}
                        {config.DepartmentId && !config.ShopId && (
                          <span className="px-2 py-1 text-xs rounded border border-white text-white">
                            Dept: {department?.DepartmentName}
                          </span>
                        )}
                        {config.ShopId && (
                          <span className="px-2 py-1 text-xs rounded border border-white text-white">
                            Shop: {shop?.ShopName}
                          </span>
                        )}
                      </td>
                    
                      {/* Type */}
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-xs rounded border border-white text-white">
                          {config.Type}
                        </span>
                      </td>
                    
                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                        <Button
  onClick={() => handleEdit(config)}
  size="sm"
  variant="outline"
  className="
    border-white 
    text-white 
    bg-transparent
    hover:bg-white 
    hover:text-black
  "
>
  <svg
    className="w-4 h-4 mr-1"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
    />
  </svg>
  Edit
</Button>

                    
<Button
  onClick={() => handleDelete(config.ConfigId)}
  size="sm"
  variant="outline"
  className="
    border-white 
    text-white 
    bg-transparent
    hover:bg-white 
    hover:text-black
  "
>
  <svg
    className="w-4 h-4 mr-1"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
  Delete
</Button>

                        </div>
                      </td>
                    </tr>
                    
                    );
                  })}
                </tbody>
              </table>
            </div>
  
            {/* Mobile Cards */}
            <div className="md:hidden space-y-4 mt-6">
              {configs.map((config) => {
                const template = templates.find(t => t.TemplateId === config.TemplateId);
                const preset = presets.find(p => p.PresetId === config.PresetId);
                const interfaceItem = allInterfaces.find(i => i.InterfaceID === config.InterfaceId);
  
                return (
                  <div
                    key={config.ConfigId}
                    className="bg-white rounded-lg shadow border p-4"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-slate-900">
                          {template?.TemplateName}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          {preset?.PresetName}
                        </p>
                      </div>
                      <span className="px-2 py-1 text-xs rounded bg-indigo-100 text-indigo-700">
                        {config.Type}
                      </span>
                    </div>
  
                    <div className="text-sm text-slate-700 mb-3">
                      {interfaceItem?.InterfaceName}
                    </div>
  
                    <div className="flex gap-2 pt-3 border-t">
                      <button
                        onClick={() => handleEdit(config)}
                        className="flex-1 px-3 py-2 rounded border border-blue-200 text-blue-600 hover:bg-blue-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(config.ConfigId)}
                        className="flex-1 px-3 py-2 rounded border border-red-200 text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
  
  

};

export default TemplateConfigList;

