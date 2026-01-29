import React, { useEffect, useState } from 'react';
import { apiClient } from '@/services/api';
import type {
  Preset,
  AnalyticsRunMultiRequest,
  AnalyticsDataset,
} from '@/services/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type ParamRow = { key: string; value: string };
type PresetParamsState = Record<number, ParamRow[]>;

function formatDateTime(value: any): string {
  if (!value) return '';
  const s = String(value);
  // ISO-ish strings render fine as-is; keep it simple
  return s.replace('T', ' ').replace('Z', '');
}

function pickFirst(obj: Record<string, any> | null | undefined, keys: string[]): any {
  if (!obj) return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).length > 0) return obj[k];
  }
  return undefined;
}

function findByKeyPattern(obj: Record<string, any> | null | undefined, patterns: RegExp[]): any {
  if (!obj) return undefined;
  const keys = Object.keys(obj);
  for (const re of patterns) {
    const match = keys.find((k) => re.test(k));
    if (match && obj[match] !== undefined && obj[match] !== null) return obj[match];
  }
  return undefined;
}

function prettifyKey(key: string): string {
  // BillId -> Bill Id, shop_location -> Shop Location
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function prettifySectionTitle(key: string): string {
  const t = prettifyKey(key);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function toNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

const AnalyticsPage: React.FC = () => {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [paramsByPreset, setParamsByPreset] = useState<PresetParamsState>({});
  const [loadingPresets, setLoadingPresets] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<AnalyticsDataset[] | null>(null);

  // Load presets once
  useEffect(() => {
    const load = async () => {
      setLoadingPresets(true);
      setError(null);
      try {
        const resp = await apiClient.getPresets(0, 200);
        setPresets(resp.presets);
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load presets.');
      } finally {
        setLoadingPresets(false);
      }
    };
    void load();
  }, []);

  const togglePreset = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setParamsByPreset((prev) => {
      if (prev[id]) return prev;
      return { ...prev, [id]: [{ key: '', value: '' }] };
    });
  };

  const updateParamRow = (presetId: number, index: number, field: 'key' | 'value', value: string) => {
    setParamsByPreset((prev) => {
      const rows = prev[presetId] ?? [];
      const next = [...rows];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, [presetId]: next };
    });
  };

  const addParamRow = (presetId: number) => {
    setParamsByPreset((prev) => {
      const rows = prev[presetId] ?? [];
      return { ...prev, [presetId]: [...rows, { key: '', value: '' }] };
    });
  };

  const removeParamRow = (presetId: number, index: number) => {
    setParamsByPreset((prev) => {
      const rows = prev[presetId] ?? [];
      const next = rows.filter((_, i) => i !== index);
      return { ...prev, [presetId]: next.length ? next : [{ key: '', value: '' }] };
    });
  };

  const handleRun = async () => {
    if (!selectedIds.length) return;
    setRunning(true);
    setError(null);
    try {
      const request: AnalyticsRunMultiRequest = {
        presets: selectedIds.map((id) => {
          const rows = paramsByPreset[id] ?? [];
          const parameters: Record<string, any> = {};
          rows.forEach((r) => {
            if (!r.key) return;
            parameters[r.key] = r.value;
          });
          return {
            preset_id: id,
            parameters,
          };
        }),
      };
      const resp = await apiClient.runMultiAnalytics(request);
      setResults(resp.results);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to run analytics.');
      setResults(null);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <Card className="p-4 space-y-4 bg-black border border-neutral-800 text-white">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight">Analytics</h2>
          <Button
            variant="outline"
            size="sm"
            className="border-white text-black hover:bg-black hover:text-white"
            onClick={handleRun}
            disabled={running || !selectedIds.length}
          >
            {running ? 'Running...' : 'Run Selected Presets'}
          </Button>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Preset cards */}
          <div className="md:col-span-1 space-y-2 max-h-[420px] overflow-auto pr-1">
            <div className="text-xs uppercase tracking-wide text-neutral-400 mb-1">
              Presets {loadingPresets && '(loading...)'}
            </div>
            {presets.map((p) => {
              const isSelected = selectedIds.includes(p.PresetId);
              return (
                <button
                  key={p.PresetId}
                  type="button"
                  onClick={() => togglePreset(p.PresetId)}
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

          {/* Parameter editors */}
          <div className="md:col-span-2 space-y-3">
            <div className="text-xs uppercase tracking-wide text-neutral-400 mb-1">
              Parameters per preset
            </div>
            {selectedIds.length === 0 && (
              <p className="text-xs text-neutral-500">
                Select one or more presets on the left to configure parameters.
              </p>
            )}
            {selectedIds.map((id) => {
              const preset = presets.find((p) => p.PresetId === id);
              const rows = paramsByPreset[id] ?? [{ key: '', value: '' }];
              return (
                <div
                  key={id}
                  className="border border-neutral-700 rounded p-3 space-y-2 bg-neutral-950"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold">
                      {preset?.PresetName ?? `Preset ${id}`}
                    </div>
                    {preset?.ExpectedParams && (
                      <div className="text-[11px] text-neutral-400">
                        Expected: {preset.ExpectedParams}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    {rows.map((row, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          className="h-7 text-xs bg-black border-neutral-700 text-white placeholder:text-neutral-500"
                          placeholder="Param name"
                          value={row.key}
                          onChange={(e) =>
                            updateParamRow(id, index, 'key', e.target.value)
                          }
                        />
                        <Input
                          className="h-7 text-xs bg-black border-neutral-700 text-white placeholder:text-neutral-500"
                          placeholder="Value"
                          value={row.value}
                          onChange={(e) =>
                            updateParamRow(id, index, 'value', e.target.value)
                          }
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-neutral-300 hover:bg-neutral-800"
                          onClick={() => removeParamRow(id, index)}
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-neutral-300 hover:bg-neutral-800"
                      onClick={() => addParamRow(id)}
                    >
                      + Add parameter
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Results */}
      {results && results.length > 0 && (
        <Card className="p-4 space-y-4 bg-black border border-neutral-800 text-white">
          <h2 className="text-sm font-semibold tracking-tight">Results</h2>
          <div className="space-y-4">
            {results.map((ds, idx) => {
              const header = ds.headerRow ?? null;
              const items = ds.itemsRows ?? [];
              const content = ds.contentDetails ?? {};

              // Detect common "summary" fields without hardcoding exact names.
              const billId =
                pickFirst(header, ['BillId', 'BillID', 'posoBillID', 'BillNo']) ??
                findByKeyPattern(header, [/^bill/i, /bill.*id/i, /poso.*bill/i]);
              const tableName =
                pickFirst(header, ['TableName', 'Table']) ??
                findByKeyPattern(header, [/^table/i, /table.*name/i]);
              const orderType =
                pickFirst(header, ['OrderType']) ??
                findByKeyPattern(header, [/order.*type/i]);
              const orderStatus =
                pickFirst(header, ['OrderStatus', 'Status']) ??
                findByKeyPattern(header, [/order.*status/i, /^status$/i]);
              const createdAt =
                pickFirst(header, ['CreatedAt', 'CreatedOn', 'CreatedDate']) ??
                findByKeyPattern(header, [/created/i, /date/i, /time/i]);
              const amount =
                pickFirst(header, ['Amount', 'TotalAmount', 'NetAmount', 'GrandTotal', 'Total']) ??
                findByKeyPattern(header, [/amount/i, /total/i, /net/i, /grand/i]);

              const itemsCount = items.length;
              const netTotal = items.reduce((sum, r) => sum + (toNumber(r.NetAmount) ?? 0), 0);
              const hasAnyData = Boolean(header) || itemsCount > 0 || Object.keys(content).length > 0;

              return (
                <div key={idx} className="border border-neutral-800 rounded bg-neutral-950">
                  <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
                    <div className="text-xs font-semibold text-white">
                      Preset Result #{idx + 1}
                    </div>
                    {!hasAnyData && (
                      <div className="text-[11px] text-neutral-400">No records</div>
                    )}
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="border border-neutral-800 rounded p-3 bg-black">
                        <div className="text-[11px] uppercase tracking-wide text-neutral-400">Bill</div>
                        <div className="text-sm font-semibold">{billId ?? '-'}</div>
                        <div className="text-xs text-neutral-400">
                          {tableName ? `Table ${tableName}` : 'Table -'}
                        </div>
                      </div>
                      <div className="border border-neutral-800 rounded p-3 bg-black">
                        <div className="text-[11px] uppercase tracking-wide text-neutral-400">Status</div>
                        <div className="text-sm font-semibold">{orderStatus ?? '-'}</div>
                        <div className="text-xs text-neutral-400">{orderType ?? '-'}</div>
                      </div>
                      <div className="border border-neutral-800 rounded p-3 bg-black">
                        <div className="text-[11px] uppercase tracking-wide text-neutral-400">Created</div>
                        <div className="text-sm font-semibold">
                          {createdAt ? formatDateTime(createdAt) : '-'}
                        </div>
                      </div>
                      <div className="border border-neutral-800 rounded p-3 bg-black">
                        <div className="text-[11px] uppercase tracking-wide text-neutral-400">Totals</div>
                        <div className="text-sm font-semibold">
                          {amount ?? (netTotal ? netTotal.toFixed(2) : '-')}
                        </div>
                        <div className="text-xs text-neutral-400">{itemsCount} items</div>
                      </div>
                    </div>

                    {/* Items table */}
                    <div className="border border-neutral-800 rounded bg-black">
                      <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
                        <div className="text-[11px] uppercase tracking-wide text-neutral-400">Items</div>
                        <div className="text-[11px] text-neutral-500">showing up to 25</div>
                      </div>
                      <div className="p-3 overflow-auto">
                        {itemsCount === 0 ? (
                          <div className="text-xs text-neutral-500">No items</div>
                        ) : (
                          <table className="w-full text-xs">
                            <thead className="text-neutral-400">
                              <tr className="border-b border-neutral-800">
                                <th className="py-2 pr-2 text-left font-medium">Item</th>
                                <th className="py-2 px-2 text-right font-medium">Qty</th>
                                <th className="py-2 px-2 text-right font-medium">Rate</th>
                                <th className="py-2 px-2 text-right font-medium">Tax</th>
                                <th className="py-2 pl-2 text-right font-medium">Net</th>
                              </tr>
                            </thead>
                            <tbody className="text-white">
                              {items.slice(0, 25).map((r, i) => (
                                <tr key={i} className="border-b border-neutral-900">
                                  <td className="py-2 pr-2">{r.ItemName ?? '-'}</td>
                                  <td className="py-2 px-2 text-right">{r.Qty ?? '-'}</td>
                                  <td className="py-2 px-2 text-right">{r.Rate ?? '-'}</td>
                                  <td className="py-2 px-2 text-right">{r.TaxAmount ?? '-'}</td>
                                  <td className="py-2 pl-2 text-right">{r.NetAmount ?? '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>

                    {/* contentDetails (data-driven) */}
                    {Object.keys(content).map((sectionKey) => {
                      const rows = (content as any)[sectionKey] as Record<string, any>[] | undefined;
                      if (!rows || rows.length === 0) return null;

                      const first = rows[0] ?? {};
                      const fieldKeys = Object.keys(first);
                      if (fieldKeys.length === 0) return null;

                      // If this "looks like shop", display a nicer title.
                      const isShopLike =
                        fieldKeys.some((k) => /shopname/i.test(k)) ||
                        fieldKeys.some((k) => /shoplocation/i.test(k));

                      const title = isShopLike ? 'Shop' : prettifySectionTitle(sectionKey);

                      return (
                        <div key={sectionKey} className="border border-neutral-800 rounded p-3 bg-black">
                          <div className="text-[11px] uppercase tracking-wide text-neutral-400 mb-2">
                            {title}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                            {fieldKeys.slice(0, 9).map((k) => (
                              <div key={k}>
                                <div className="text-neutral-400">{prettifyKey(k)}</div>
                                <div className="text-white font-medium">{String(first[k] ?? '-')}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};

export default AnalyticsPage;


