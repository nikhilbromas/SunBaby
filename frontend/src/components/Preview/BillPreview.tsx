import React, { useState, useEffect } from 'react';
import ParameterForm from './ParameterForm';
import apiClient from '../../services/api';
import type { Template } from '../../services/types';
import './BillPreview.css';

const BillPreview: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

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
    setError(null);
    
    // Auto-generate PDF when parameters are submitted
    await handleGeneratePdf(params);
  };

  const handleGeneratePdf = async (params?: Record<string, any>) => {
    const paramsToUse = params || parameters;
    
    if (!selectedTemplate || Object.keys(paramsToUse).length === 0) {
      setError('Please select a template and enter parameters');
      return;
    }

    setIsGeneratingPdf(true);
    setError(null);

    try {
      const pdfBase64String = await apiClient.generatePreviewPdf({
        templateId: selectedTemplate.TemplateId,
        parameters: paramsToUse,
      });
      setPdfBase64(pdfBase64String);
    } catch (err: any) {
      setError(err.message || 'Failed to generate PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!pdfBase64 || !selectedTemplate) return;

    const byteCharacters = atob(pdfBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedTemplate.TemplateName || 'bill'}_${Date.now()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getPdfUrl = (): string | null => {
    if (!pdfBase64) return null;
    return `data:application/pdf;base64,${pdfBase64}`;
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
                  setParameters({});
                  setError(null);
                  setPdfBase64(null);
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
          
          {selectedTemplate && Object.keys(parameters).length > 0 && (
            <button
              className="generate-pdf-button"
              onClick={() => handleGeneratePdf()}
              disabled={isGeneratingPdf}
            >
              {isGeneratingPdf ? 'Generating PDF...' : 'Generate PDF'}
            </button>
          )}
        </div>
      </div>

      <div className="preview-content">
        <div className="preview-left">
          <ParameterForm
            template={selectedTemplate}
            onSubmit={handleGeneratePreview}
          />
          {selectedTemplate && Object.keys(parameters).length > 0 && pdfBase64 && (
            <div className="pdf-download-controls">
              <button onClick={handleDownloadPdf} className="download-pdf-button" title="Download PDF">
                📥 Download PDF
              </button>
              <p className="download-hint">
                💡 Click to download the PDF file.
              </p>
            </div>
          )}
        </div>

        <div className="preview-right">
          {error && <div className="error-message">{error}</div>}
          {selectedTemplate && Object.keys(parameters).length > 0 && (
            <>
              {pdfBase64 && (
                <div className="pdf-preview-container">
                  <iframe
                    src={getPdfUrl() || undefined}
                    title="PDF Preview"
                    className="pdf-preview-iframe"
                    style={{ width: '100%', height: '100%', border: 'none' }}
                  />
                </div>
              )}
              {isGeneratingPdf && (
                <div className="preview-placeholder">
                  <p>Generating PDF preview...</p>
                </div>
              )}
              {!pdfBase64 && !isGeneratingPdf && (
                <div className="preview-placeholder">
                  <p>Enter parameters and submit to generate PDF preview</p>
                </div>
              )}
            </>
          )}
          {(!selectedTemplate || Object.keys(parameters).length === 0) && !error && (
            <div className="preview-placeholder">
              <p>Select a template and enter parameters to generate preview</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BillPreview;

