import React, { useState, useEffect } from 'react';
import ParameterForm from './ParameterForm';
import ExportControls from './ExportControls';
import TemplateHtmlPreview from './TemplateHtmlPreview';
import apiClient from '../../services/api';
import type { Template } from '../../services/types';
import './BillPreview.css';

type PreviewMode = 'pdf' | 'html';

const BillPreview: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [previewPdf, setPreviewPdf] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('pdf');
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await apiClient.getTemplates();
      setTemplates(response.templates);
      if (response.templates.length > 0) {
        setSelectedTemplate(response.templates[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load templates');
    }
  };

  const handleGeneratePreview = async (params: Record<string, any>) => {
    if (!selectedTemplate) {
      setError('Please select a template');
      return;
    }

    setParameters(params);
    setLoading(true);
    setError(null);

    try {
      if (previewMode === 'pdf') {
        // Generate PDF preview (base64 encoded)
        const pdfBase64 = await apiClient.generatePreviewPdf({
          templateId: selectedTemplate.TemplateId,
          parameters: params,
        });
        
        // Store the base64 PDF for preview
        setPreviewPdf(pdfBase64);
      }
      // HTML preview is handled by TemplateHtmlPreview component automatically
    } catch (err: any) {
      setError(err.message || 'Failed to generate preview');
      setPreviewPdf(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPdf = () => {
    if (!selectedTemplate) {
      setError('Please select a template');
      return;
    }

    if (!previewPdf) {
      setError('Please generate preview first');
      return;
    }

    try {
      // Convert base64 to blob and download
      const byteCharacters = atob(previewPdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bill_${selectedTemplate.TemplateId}_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Failed to export PDF');
    }
  };

  const handlePrintHtml = () => {
    window.print();
  };

  return (
    <div className="bill-preview">
      <div className="preview-header">
        <h2>Bill Preview</h2>
        <div className="header-controls">
          <div className="template-selector">
            <label>
              Select Template:
              <select
                value={selectedTemplate?.TemplateId || ''}
                onChange={(e) => {
                  const template = templates.find(
                    (t) => t.TemplateId === parseInt(e.target.value)
                  );
                  setSelectedTemplate(template || null);
                  setPreviewPdf(null);
                  setError(null);
                }}
              >
                <option value="">-- Select Template --</option>
                {templates.map((template) => (
                  <option key={template.TemplateId} value={template.TemplateId}>
                    {template.TemplateName}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="preview-mode-toggle">
            <button
              className={`mode-button ${previewMode === 'pdf' ? 'active' : ''}`}
              onClick={() => {
                setPreviewMode('pdf');
                setError(null);
              }}
              title="PDF Preview"
            >
              📄 PDF
            </button>
            <button
              className={`mode-button ${previewMode === 'html' ? 'active' : ''}`}
              onClick={() => {
                setPreviewMode('html');
                setError(null);
              }}
              title="HTML Preview"
            >
              🌐 HTML
            </button>
          </div>
        </div>
      </div>

      <div className="preview-content">
        <div className="preview-left">
          <ParameterForm
            template={selectedTemplate}
            onSubmit={handleGeneratePreview}
          />
          {selectedTemplate && previewPdf && previewMode === 'pdf' && (
            <ExportControls
              onPrint={() => {
                // Open PDF in new window for printing
                const pdfDataUri = `data:application/pdf;base64,${previewPdf}`;
                const printWindow = window.open(pdfDataUri, '_blank');
                if (printWindow) {
                  printWindow.onload = () => {
                    setTimeout(() => {
                      printWindow.print();
                    }, 250);
                  };
                } else {
                  setError('Unable to open print window. Please allow pop-ups and try again.');
                }
              }}
              onExportPdf={handleExportPdf}
            />
          )}
          {previewMode === 'html' && selectedTemplate && Object.keys(parameters).length > 0 && (
            <div className="html-print-controls">
              <button onClick={handlePrintHtml} className="print-html-button" title="Print HTML Preview">
                🖨️ Print Preview
              </button>
              <p className="print-hint">
                💡 Click to print the HTML preview. Use your browser's print dialog to save as PDF.
              </p>
            </div>
          )}
        </div>

        <div className="preview-right">
          {error && <div className="error-message">{error}</div>}
          {loading && previewMode === 'pdf' && (
            <div className="loading-message">Generating preview...</div>
          )}
          {previewMode === 'pdf' && previewPdf && (
            <iframe
              className="preview-iframe"
              src={`data:application/pdf;base64,${previewPdf}`}
              title="Bill Preview"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: 'white',
              }}
            />
          )}
          {previewMode === 'pdf' && !previewPdf && !loading && !error && (
            <div className="preview-placeholder">
              <p>Select a template and enter parameters to generate preview</p>
            </div>
          )}
          {previewMode === 'html' && selectedTemplate && Object.keys(parameters).length > 0 && (
            <TemplateHtmlPreview
              templateId={selectedTemplate.TemplateId}
              parameters={parameters}
              onError={(err) => setError(err)}
            />
          )}
          {previewMode === 'html' && (!selectedTemplate || Object.keys(parameters).length === 0) && (
            <div className="preview-placeholder">
              <p>Select a template and enter parameters to generate HTML preview</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BillPreview;

