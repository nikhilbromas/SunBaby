import React, { useEffect, useRef, useState } from 'react';
import ParameterForm from './ParameterForm';
import apiClient from '@/services/api';
import type { Template } from '@/services/types';

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

const MIN_SIDEBAR = 280;
const MAX_SIDEBAR = 480;

const BillPreview: React.FC = () => {
  /* -------------------- State -------------------- */
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [missingParams, setMissingParams] = useState<string[]>([]);

  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [zoom, setZoom] = useState(1);

  const [sidebarWidth, setSidebarWidth] = useState(
    Number(localStorage.getItem('bp_sidebar_width')) || 360
  );
  const [collapsed, setCollapsed] = useState(false);

  const resizingRef = useRef(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  /* -------------------- Load Templates -------------------- */
  useEffect(() => {
    apiClient.getTemplates().then(res => {
      setTemplates(res.templates);
      setSelectedTemplate(res.templates[0] || null);
    });
  }, []);

  /* -------------------- Restore Params -------------------- */
  useEffect(() => {
    if (!selectedTemplate) return;

    const saved = localStorage.getItem(
      `bp_params_${selectedTemplate.TemplateId}`
    );

    setParameters(saved ? JSON.parse(saved) : {});
    setMissingParams([]);
    setPdfBase64(null);
    setError(null);
  }, [selectedTemplate]);

  /* -------------------- Sidebar Resize (FIXED) -------------------- */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizingRef.current || !sidebarRef.current) return;

      const rect = sidebarRef.current.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;

      const width = Math.min(
        MAX_SIDEBAR,
        Math.max(MIN_SIDEBAR, newWidth)
      );

      setSidebarWidth(width);
      localStorage.setItem('bp_sidebar_width', String(width));
    };

    const onUp = () => (resizingRef.current = false);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  /* -------------------- Validation -------------------- */
  const validateParams = (params: Record<string, any>) => {
    const missing = Object.entries(params)
      .filter(([_, v]) => v === '' || v === null || v === undefined)
      .map(([k]) => k);

    setMissingParams(missing);
    return missing.length === 0;
  };

  /* -------------------- Generate PDF -------------------- */
  const generatePdf = async (formParameters?: Record<string, any>) => {
    if (!selectedTemplate) return;
    
    // Use form parameters if provided, otherwise use state parameters
    const paramsToUse = formParameters || parameters;
    
    if (!validateParams(paramsToUse)) return;

    setLoading(true);
    setError(null);

    // Update state with the parameters being used
    setParameters(paramsToUse);

    localStorage.setItem(
      `bp_params_${selectedTemplate.TemplateId}`,
      JSON.stringify(paramsToUse)
    );

    try {
      // API client will automatically add companyId from cache if available
      const pdf = await apiClient.generatePreviewPdf({
        templateId: selectedTemplate.TemplateId,
        parameters: paramsToUse,
        // companyId will be added automatically by apiClient if available in cache
      });
      setPdfBase64(pdf);
    } catch (err: any) {
      setError(err.message || 'Failed to generate PDF');
    } finally {
      setLoading(false);
    }
  };

  const pdfUrl = pdfBase64
    ? `data:application/pdf;base64,${pdfBase64}`
    : null;

  /* -------------------- Download -------------------- */
  const downloadPdf = () => {
    if (!pdfBase64 || !selectedTemplate) return;

    const bytes = atob(pdfBase64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);

    const blob = new Blob([arr], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTemplate.TemplateName}_${Date.now()}.pdf`;
    a.click();

    URL.revokeObjectURL(url);
  };

  /* -------------------- UI -------------------- */
  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-[1700px] mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Bill Preview Studio
            </h1>
            <p className="text-sm text-white/60">
              Generate and preview PDF bills
            </p>
          </div>

          <Button
            onClick={generatePdf}
            disabled={loading || !selectedTemplate}
            className="bg-white text-black hover:bg-white/90"
          >
            {loading ? 'Generating…' : 'Generate PDF'}
          </Button>
        </div>

        {/* Template Selector */}
        <Card className="bg-black border-white/20">
  <CardContent className="pt-6">
    <div className="flex items-center gap-4">
      <span className="text-sm font-medium text-white">
        Template
      </span>

      <select
        className="border border-white/20 rounded-md px-3 py-2 text-sm w-[260px] bg-black text-white"
        value={selectedTemplate?.TemplateId || ''}
        onChange={(e) => {
          const t = templates.find(
            x => x.TemplateId === Number(e.target.value)
          );
          setSelectedTemplate(t || null);
        }}
      >
        <option value="" className="bg-black text-white">Select Template</option>
        {templates.map(t => (
          <option key={t.TemplateId} value={t.TemplateId} className="bg-black text-white">
            {t.TemplateName}
          </option>
        ))}
      </select>
    </div>
  </CardContent>
</Card>


        {/* Main Layout */}
        <div className="flex h-[calc(100vh-190px)]">

          {/* Sidebar */}
          {!collapsed && (
            <div
              ref={sidebarRef}
              style={{ width: sidebarWidth }}
              className="relative bg-black border-r border-white/20"
            >
              <div
                className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-white/20"
                onMouseDown={() => (resizingRef.current = true)}
              />

              <Card className="h-full rounded-none bg-black border-white/20">
                <CardHeader className="flex-row justify-between text-white">
                  <CardTitle className="text-white">Parameters</CardTitle>
                  <Button size="sm" onClick={() => setCollapsed(true)} className="bg-white/10 text-white hover:bg-white/20 border-white/20">
                    ◀
                  </Button>
                </CardHeader>

                <CardContent className="p-0 h-[calc(100%-64px)]">
                  <ScrollArea className="h-full px-4 py-4">
                    <ParameterForm
                      template={selectedTemplate}
                      onSubmit={generatePdf}
                    
                     // missingFields={missingParams}
                    />

                    {pdfBase64 && (
                      <Button
                        variant="outline"
                        className="w-full mt-4 border-white/20 text-white hover:bg-white/10"
                        onClick={downloadPdf}
                      >
                        Download PDF
                      </Button>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}

          {collapsed && (
            <Button
              className="h-full rounded-none bg-black border-white/20 text-white hover:bg-white/10"
              onClick={() => setCollapsed(false)}
            >
              ▶
            </Button>
          )}

          {/* Preview */}
          <div className="flex-1 px-4">
            <Card className="h-full bg-black border-white/20">
              <CardHeader className="flex-row justify-between text-white">
                <CardTitle className="text-white">PDF Preview</CardTitle>

                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setZoom(z => z + 0.1)} className="bg-white/10 text-white hover:bg-white/20 border-white/20">+</Button>
                  <Button size="sm" onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="bg-white/10 text-white hover:bg-white/20 border-white/20">-</Button>
                  <Button size="sm" onClick={() => setZoom(1)} className="bg-white/10 text-white hover:bg-white/20 border-white/20">Reset</Button>
                </div>
              </CardHeader>

              <CardContent className="h-[calc(100%-64px)] p-2">
                {error && (
                  <div className="text-sm text-red-400 mb-2">{error}</div>
                )}

                {pdfUrl ? (
                  <div className="w-full h-full overflow-auto">
                    <div
                      style={{
                        transform: `scale(${zoom})`,
                        transformOrigin: 'top left',
                      }}
                      className="w-full h-full"
                    >
                      <iframe
                        src={pdfUrl}
                        title="PDF Preview"
                        className="w-full h-full border border-white/20 rounded"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-white/60">
                    Generate PDF to preview
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
};

export default BillPreview;
