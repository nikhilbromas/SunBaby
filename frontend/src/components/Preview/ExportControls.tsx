import React from 'react';
import './ExportControls.css';

interface ExportControlsProps {
  onPrint: () => void;
  onExportPdf: () => void;
}

const ExportControls: React.FC<ExportControlsProps> = ({ onPrint, onExportPdf }) => {
  return (
    <div className="export-controls">
      <h4>Export Options</h4>
      <div className="export-buttons">
        <button onClick={onPrint} className="export-button print-button" title="Print or Save as PDF">
          🖨️ Print / Save PDF
        </button>
        <button onClick={onExportPdf} className="export-button pdf-button" title="Export PDF (requires server support)">
          📄 Export PDF
        </button>
      </div>
      <p className="export-hint">
        💡 Tip: Use Print button and select "Save as PDF" if server PDF export is not available.
      </p>
    </div>
  );
};

export default ExportControls;

