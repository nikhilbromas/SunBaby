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
import './TemplateConfigList.css';

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
  const [interfaces, setInterfaces] = useState<Interface[]>([]);
  const [interfaceSearch, setInterfaceSearch] = useState<string>('');
  const [loadingLookups, setLoadingLookups] = useState(false);

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
    } catch (err: any) {
      setError(err.message || 'Failed to load template configs');
    } finally {
      setLoading(false);
    }
  };

  const loadLookupData = async () => {
    try {
      setLoadingLookups(true);
      const [templatesRes, presetsRes, deptsRes, interfacesRes] = await Promise.all([
        apiClient.getTemplates(),
        apiClient.getPresets(),
        apiClient.getDepartments(),
        apiClient.getInterfaces(0, 100),
      ]);
      setTemplates(templatesRes.templates);
      setPresets(presetsRes.presets);
      setDepartments(deptsRes);
      setInterfaces(interfacesRes);
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

  const handleSearchInterfaces = async (search: string) => {
    setInterfaceSearch(search);
    try {
      const interfacesRes = await apiClient.getInterfaces(0, 100, search);
      setInterfaces(interfacesRes);
    } catch (err: any) {
      console.error('Failed to search interfaces:', err);
    }
  };

  const handleCreateNew = () => {
    setSelectedConfig(null);
    setTemplateId(0);
    setPresetId(0);
    setInterfaceId(0);
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
    
    // Load shops if department is set
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
      <div className="template-config-manager">
        <div className="config-form">
          <div className="form-header">
            <h2>{selectedConfig ? 'Edit Template Config' : 'Create New Template Config'}</h2>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label>
              Template *:
              <select
                value={templateId}
                onChange={(e) => setTemplateId(parseInt(e.target.value))}
                required
                disabled={loadingLookups}
              >
                <option value="0">-- Select Template --</option>
                {templates.map((t) => (
                  <option key={t.TemplateId} value={t.TemplateId}>
                    {t.TemplateName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-group">
            <label>
              Preset *:
              <select
                value={presetId}
                onChange={(e) => setPresetId(parseInt(e.target.value))}
                required
                disabled={loadingLookups || (templateId > 0)}
                title={templateId > 0 ? "Preset is automatically selected based on the chosen template" : ""}
              >
                <option value="0">-- Select Preset --</option>
                {presets.map((p) => (
                  <option key={p.PresetId} value={p.PresetId}>
                    {p.PresetName}
                  </option>
                ))}
              </select>
              {templateId > 0 && (
                <small className="form-hint">Preset is automatically set based on the selected template</small>
              )}
            </label>
          </div>

          <div className="form-group">
            <label>
              Interface *:
              <div className="searchable-select">
                <input
                  type="text"
                  placeholder="Search interfaces..."
                  value={interfaceSearch}
                  onChange={(e) => handleSearchInterfaces(e.target.value)}
                  className="search-input"
                />
                <select
                  value={interfaceId}
                  onChange={(e) => setInterfaceId(parseInt(e.target.value))}
                  required
                  disabled={loadingLookups}
                >
                  <option value="0">-- Select Interface --</option>
                  {interfaces.map((i) => (
                    <option key={i.InterfaceID} value={i.InterfaceID}>
                      {i.InterfaceName} {i.ModuleCode ? `(${i.ModuleCode})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </label>
          </div>

          <div className="form-group">
            <label>
              Department:
              <select
                value={departmentId || ''}
                onChange={(e) => {
                  const deptId = e.target.value ? parseInt(e.target.value) : null;
                  setDepartmentId(deptId);
                  setShopId(null); // Reset shop when department changes
                }}
                disabled={loadingLookups}
              >
                <option value="">-- Select Department (Optional) --</option>
                {departments.map((d) => (
                  <option key={d.DepartmentID} value={d.DepartmentID}>
                    {d.DepartmentName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-group">
            <label>
              Shop:
              <select
                value={shopId || ''}
                onChange={(e) => setShopId(e.target.value ? parseInt(e.target.value) : null)}
                disabled={!departmentId || loadingLookups}
              >
                <option value="">-- Select Shop (Optional) --</option>
                {shops.map((s) => (
                  <option key={s.ShopID} value={s.ShopID}>
                    {s.ShopName} {s.ShopLocation ? `(${s.ShopLocation})` : ''}
                  </option>
                ))}
              </select>
              {!departmentId && (
                <small className="form-hint">Please select a department first</small>
              )}
            </label>
          </div>

          <div className="form-group">
            <label>
              Type *:
              <input
                type="text"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="Enter type"
                required
                maxLength={100}
              />
            </label>
          </div>

          <div className="form-group">
            <label>
              Description:
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter description (optional)"
                rows={3}
                maxLength={500}
              />
            </label>
          </div>

          <div className="form-actions">
            <button onClick={handleSave} className="save-button" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </button>
            <button onClick={handleCancel} className="cancel-button" disabled={loading}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="template-config-manager">
      <div className="config-header">
        <h2>Template Configurations</h2>
        <button onClick={handleCreateNew} className="create-button">
          Create New Config
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {loading && <div className="loading-message">Loading...</div>}

      <div className="config-list">
        {configs.length === 0 ? (
          <div className="empty-state">No template configs found. Create one to get started.</div>
        ) : (
          <table className="config-table">
            <thead>
              <tr>
                <th>Template</th>
                <th>Preset</th>
                <th>Interface</th>
                <th>Department</th>
                <th>Shop</th>
                <th>Type</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((config) => {
                const template = templates.find((t) => t.TemplateId === config.TemplateId);
                const preset = presets.find((p) => p.PresetId === config.PresetId);
                const interfaceItem = interfaces.find((i) => i.InterfaceID === config.InterfaceId);
                const department = departments.find((d) => d.DepartmentID === config.DepartmentId);
                const shop = shops.find((s) => s.ShopID === config.ShopId) || 
                            (config.ShopId ? { ShopName: `Shop ${config.ShopId}` } : null);

                return (
                  <tr key={config.ConfigId}>
                    <td>{template?.TemplateName || `Template ${config.TemplateId}`}</td>
                    <td>{preset?.PresetName || `Preset ${config.PresetId}`}</td>
                    <td>{interfaceItem?.InterfaceName || `Interface ${config.InterfaceId}`}</td>
                    <td>{department?.DepartmentName || (config.DepartmentId ? `Dept ${config.DepartmentId}` : '-')}</td>
                    <td>{shop?.ShopName || (config.ShopId ? `Shop ${config.ShopId}` : '-')}</td>
                    <td>{config.Type}</td>
                    <td>{config.Description || '-'}</td>
                    <td>
                      <button
                        onClick={() => handleEdit(config)}
                        className="action-button edit-button"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(config.ConfigId)}
                        className="action-button delete-button"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default TemplateConfigList;

