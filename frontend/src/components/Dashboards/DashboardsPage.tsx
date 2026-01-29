import React, { useEffect, useState } from 'react';
import { apiClient } from '@/services/api';
import type {
  DashboardListItem,
  DashboardCreate,
  DashboardWidgetType,
  Preset,
  RunDashboardResponse,
  DataAnalyticsDataset,
} from '@/services/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

function prettifyKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatDateTime(value: any): string {
  if (!value) return '';
  const s = String(value);
  return s.replace('T', ' ').replace('Z', '');
}

const DashboardsPage: React.FC = () => {
  const [dashboards, setDashboards] = useState<DashboardListItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [runResult, setRunResult] = useState<RunDashboardResponse | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingRun, setLoadingRun] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loadingPresets, setLoadingPresets] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simple create form (v1): one widget bound to one preset
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const [newWidgetTitle, setNewWidgetTitle] = useState('Main Widget');
  const [newWidgetType, setNewWidgetType] = useState<DashboardWidgetType>('table');
  const [paramRows, setParamRows] = useState<Array<{ key: string; value: string }>>([{ key: '', value: '' }]);

  const extractExpectedParamKeys = (expectedParams?: string | null): string[] => {
    if (!expectedParams) return [];
    return expectedParams
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const applyExpectedParams = (preset: Preset) => {
    const keys = extractExpectedParamKeys(preset.ExpectedParams);
    if (!keys.length) return;

    // Preserve any existing values for the same keys
    const existing = new Map<string, string>();
    paramRows.forEach((r) => {
      const k = (r.key || '').trim();
      if (!k) return;
      existing.set(k.toLowerCase(), r.value ?? '');
    });

    setParamRows(
      keys.map((k) => ({
        key: k,
        value: existing.get(k.toLowerCase()) ?? '',
      }))
    );
  };

  const loadDashboards = async () => {
    setLoadingList(true);
    setError(null);
    try {
      const resp = await apiClient.getDashboards(0, 100);
      setDashboards(resp.dashboards);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load dashboards.');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    void loadDashboards();
  }, []);

  useEffect(() => {
    const loadPresets = async () => {
      setLoadingPresets(true);
      try {
        const resp = await apiClient.getPresets(0, 200);
        setPresets(resp.presets);
      } catch (e: any) {
        // keep dashboard list usable even if presets fail
        setError(e?.message ?? 'Failed to load presets.');
      } finally {
        setLoadingPresets(false);
      }
    };
    void loadPresets();
  }, []);

  const handleRun = async () => {
    if (!selectedId) return;
    setLoadingRun(true);
    setError(null);
    try {
      const resp = await apiClient.runDashboard(selectedId);
      setRunResult(resp);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to run dashboard.');
      setRunResult(null);
    } finally {
      setLoadingRun(false);
    }
  };

  const renderWidget = (w: any) => {
    const type = (w?.type || '').toLowerCase();
    const title = w?.title ?? 'Widget';
    const output = w?.output;
    const analyticsDataset: DataAnalyticsDataset | undefined = w?.analyticsDataset;

    // If we have analyticsDataset, use it for richer rendering
    if (analyticsDataset) {
      const ds = analyticsDataset;
      const items = Array.isArray(ds.data.items) ? ds.data.items : (ds.data.items ? [ds.data.items] : []);

      return (
        <div className="border border-neutral-800 rounded bg-neutral-950 space-y-3">
          <div className="px-4 py-3 border-b border-neutral-800">
            <div className="text-xs text-neutral-400">{title}</div>
            {ds.references.billId && (
              <div className="text-[11px] text-neutral-500 mt-1">Bill: {ds.references.billId}</div>
            )}
          </div>

          {/* Insights */}
          {ds.insights && ds.insights.length > 0 && (
            <div className="px-4 space-y-1">
              {ds.insights.slice(0, 3).map((insight, idx) => (
                <div
                  key={idx}
                  className={`text-xs p-2 rounded border ${
                    insight.severity === 'error'
                      ? 'border-red-500 bg-red-950/20'
                      : insight.severity === 'warning'
                      ? 'border-yellow-500 bg-yellow-950/20'
                      : 'border-blue-500 bg-blue-950/20'
                  }`}
                >
                  {insight.message}
                </div>
              ))}
            </div>
          )}

          {/* Widget content based on type */}
          {type === 'kpi' && (
            <div className="px-4 pb-4">
              <div className="text-2xl font-semibold text-white">
                {output?.value ?? (ds.references.billId ? ds.references.billId : '-')}
              </div>
              {output?.field && <div className="text-xs text-neutral-500 mt-1">{output.field}</div>}
            </div>
          )}

          {type === 'chart' && (
            <div className="px-4 pb-4">
              {output?.series && output.series.length > 0 ? (
                <div className="space-y-1 max-h-48 overflow-auto">
                  {output.series.slice(0, 20).map((s: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <div className="text-white">{String(s[output.groupBy || 'x'] ?? '-')}</div>
                      <div className="text-neutral-300">{String(s.value ?? '-')}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-neutral-500">No chart data</div>
              )}
            </div>
          )}

          {type === 'table' && (
            <div className="px-4 pb-4 overflow-auto max-h-64">
              {items.length > 0 ? (
                <table className="w-full text-xs">
                  <thead className="text-neutral-400">
                    <tr className="border-b border-neutral-800">
                      {items[0] && Object.keys(items[0]).slice(0, 8).map((k) => (
                        <th key={k} className="py-2 pr-2 text-left font-medium">
                          {prettifyKey(k)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-white">
                    {items.slice(0, 25).map((r, i) => (
                      <tr key={i} className="border-b border-neutral-900">
                        {items[0] && Object.keys(items[0]).slice(0, 8).map((k) => (
                          <td key={k} className="py-2 pr-2">
                            {String(r[k] ?? '-')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-xs text-neutral-500">No items</div>
              )}
            </div>
          )}
        </div>
      );
    }

    // Fallback to original rendering if no analyticsDataset
    if (type === 'kpi') {
      const value = output?.value;
      return (
        <div className="border border-neutral-800 rounded p-4 bg-neutral-950">
          <div className="text-xs text-neutral-400">{title}</div>
          <div className="text-2xl font-semibold text-white mt-1">{value ?? '-'}</div>
        </div>
      );
    }

    if (type === 'chart') {
      const series: Array<any> = output?.series ?? [];
      const groupBy: string = output?.groupBy ?? 'x';
      return (
        <div className="border border-neutral-800 rounded p-4 bg-neutral-950 space-y-2">
          <div className="text-xs text-neutral-400">{title}</div>
          {series.length === 0 ? (
            <div className="text-xs text-neutral-500">No data</div>
          ) : (
            <div className="space-y-1">
              {series.slice(0, 20).map((s, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="text-white">{String(s[groupBy] ?? '-')}</div>
                  <div className="text-neutral-300">{String(s.value ?? '-')}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // table (default)
    const rows: Array<Record<string, any>> = output?.rows ?? [];
    const columns: string[] | undefined = output?.columns;
    const cols = columns && columns.length ? columns : (rows[0] ? Object.keys(rows[0]).slice(0, 8) : []);

    return (
      <div className="border border-neutral-800 rounded bg-neutral-950">
        <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
          <div className="text-xs text-neutral-400">{title}</div>
          <div className="text-[11px] text-neutral-500">{rows.length} rows</div>
        </div>
        <div className="p-3 overflow-auto max-h-64">
          {rows.length === 0 ? (
            <div className="text-xs text-neutral-500">No data</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-neutral-400">
                <tr className="border-b border-neutral-800">
                  {cols.map((c) => (
                    <th key={c} className="py-2 pr-2 text-left font-medium">
                      {prettifyKey(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-white">
                {rows.slice(0, 25).map((r, i) => (
                  <tr key={i} className="border-b border-neutral-900">
                    {cols.map((c) => (
                      <td key={c} className="py-2 pr-2">
                        {String(r[c] ?? '-')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  const handleCreate = async () => {
    setError(null);
    setCreating(true);
    try {
      if (!selectedPresetId) {
        throw new Error('Please select a preset.');
      }

      const parameters: Record<string, any> = {};
      paramRows.forEach((r) => {
        const k = (r.key || '').trim();
        if (!k) return;
        parameters[k] = r.value;
      });

      const payload: DashboardCreate = {
        Name: newName.trim() || 'New Dashboard',
        Description: newDescription.trim() || null,
        Widgets: [
          {
            Title: newWidgetTitle.trim() || 'Widget',
            Type: newWidgetType,
            Config: {},
            PresetBinding: {
              presetId: selectedPresetId,
              parameters,
            },
            OrderIndex: 0,
          },
        ],
      };

      const created = await apiClient.createDashboard(payload);
      // Refresh list and auto-select newly created dashboard
      await loadDashboards();
      setSelectedId(created.DashboardId);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create dashboard.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-4 bg-black border border-neutral-800 text-white">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight">Create Dashboard</h2>
          <Button size="sm" onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Dashboard Name</label>
              <Input
                className="bg-black border-neutral-700 text-white placeholder:text-neutral-500"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Daily Sales"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Description</label>
              <Textarea
                className="bg-black border-neutral-700 text-white placeholder:text-neutral-500"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
          </div>

          {/* Preset selector */}
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-neutral-400">
              Presets {loadingPresets && '(loading...)'}
            </div>
            <div className="space-y-2 max-h-64 overflow-auto pr-1">
              {presets.map((p) => {
                const isSelected = selectedPresetId === p.PresetId;
                return (
                  <button
                    key={p.PresetId}
                    type="button"
                    onClick={() => {
                      setSelectedPresetId(p.PresetId);
                      applyExpectedParams(p);
                    }}
                    className={`w-full text-left px-3 py-2 rounded border text-xs transition-colors ${
                      isSelected
                        ? 'border-white bg-white text-black'
                        : 'border-neutral-700 bg-neutral-900 text-neutral-100 hover:border-white/60'
                    }`}
                  >
                    <div className="font-semibold truncate">{p.PresetName}</div>
                    {p.ExpectedParams && (
                      <div className="mt-1 text-[11px] text-neutral-400 truncate">
                        Params: {p.ExpectedParams}
                      </div>
                    )}
                  </button>
                );
              })}
              {!loadingPresets && presets.length === 0 && (
                <p className="text-xs text-neutral-500">No presets available.</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Widget Type</label>
                <select
                  className="h-10 w-full rounded-md border border-neutral-700 bg-black px-3 text-sm text-white"
                  value={newWidgetType}
                  onChange={(e) => setNewWidgetType(e.target.value as DashboardWidgetType)}
                >
                  <option value="table">table</option>
                  <option value="kpi">kpi</option>
                  <option value="chart">chart</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-neutral-400 mb-1">Widget Title</label>
                <Input
                  className="bg-black border-neutral-700 text-white placeholder:text-neutral-500"
                  value={newWidgetTitle}
                  onChange={(e) => setNewWidgetTitle(e.target.value)}
                  placeholder="e.g. Orders"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Parameters</label>
              <div className="space-y-2">
                {paramRows.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      className="h-9 text-xs bg-black border-neutral-700 text-white placeholder:text-neutral-500"
                      placeholder="Param name (e.g. billid)"
                      value={row.key}
                      onChange={(e) => {
                        const v = e.target.value;
                        setParamRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, key: v } : r)));
                      }}
                    />
                    <Input
                      className="h-9 text-xs bg-black border-neutral-700 text-white placeholder:text-neutral-500"
                      placeholder="Value"
                      value={row.value}
                      onChange={(e) => {
                        const v = e.target.value;
                        setParamRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, value: v } : r)));
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 px-2 text-xs text-neutral-300 hover:bg-neutral-800"
                      onClick={() => {
                        setParamRows((prev) => {
                          const next = prev.filter((_, idx) => idx !== i);
                          return next.length ? next : [{ key: '', value: '' }];
                        });
                      }}
                    >
                      ✕
                    </Button>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 px-2 text-xs text-neutral-300 hover:bg-neutral-800"
                  onClick={() => setParamRows((prev) => [...prev, { key: '', value: '' }])}
                >
                  + Add parameter
                </Button>
                {selectedPresetId && (
                  <div className="text-[11px] text-neutral-500">
                    Tip: check selected preset’s “Params:” hint on the left.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </Card>

      <Card className="p-4 space-y-3 bg-black border border-neutral-800 text-white">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Dashboards</h2>
          <Button size="sm" onClick={loadDashboards} disabled={loadingList}>
            {loadingList ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="space-y-2 max-h-64 overflow-auto">
          {dashboards.map((d) => (
            <button
              key={d.DashboardId}
              type="button"
              className={`w-full text-left px-2 py-1 rounded text-sm ${
                selectedId === d.DashboardId
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
              onClick={() => setSelectedId(d.DashboardId)}
            >
              <div className="font-medium">{d.Name}</div>
              {d.Description && (
                <div className="text-xs text-muted-foreground">{d.Description}</div>
              )}
            </button>
          ))}
          {dashboards.length === 0 && !loadingList && (
            <p className="text-xs text-muted-foreground">No dashboards yet.</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Input
            className="w-24"
            placeholder="Id"
            value={selectedId ?? ''}
            onChange={(e) => {
              const id = parseInt(e.target.value, 10);
              setSelectedId(Number.isNaN(id) ? null : id);
            }}
          />
          <Button size="sm" onClick={handleRun} disabled={!selectedId || loadingRun}>
            {loadingRun ? 'Running...' : 'Run Dashboard'}
          </Button>
        </div>
      </Card>

      {runResult && (
        <Card className="p-4 space-y-3 bg-black border border-neutral-800 text-white">
          <h2 className="text-sm font-semibold">
            Dashboard: {runResult.dashboard.Name}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Object.values(runResult.widgets).map((w: any) => (
              <div key={w.widgetId}>{renderWidget(w)}</div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default DashboardsPage;


