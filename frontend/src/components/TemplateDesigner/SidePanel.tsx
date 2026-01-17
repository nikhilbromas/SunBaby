import React, { useState } from 'react';
import Toolbar from './Toolbar';
import DataPreview from './DataPreview';
import './SidePanel.css';

interface SidePanelProps {
  sampleData: {
    header: { data: Record<string, any> | null; fields: string[] };
    items: { data: Record<string, any>[]; fields: string[]; sampleCount: number };
    contentDetails?: Record<string, { data: Record<string, any>[] | Record<string, any> | null; fields: string[]; sampleCount: number; dataType?: 'array' | 'object' }>;
  } | null;
}

type TabType = 'elements' | 'data';

const SidePanel: React.FC<SidePanelProps> = ({
  sampleData,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('elements');

  return (
    <div className="side-panel">
      <div className="side-panel-tabs">
        <button
          className={`tab-button ${activeTab === 'elements' ? 'active' : ''}`}
          onClick={() => setActiveTab('elements')}
        >
          <span className="tab-icon">🧩</span>
          Elements
        </button>
        <button
          className={`tab-button ${activeTab === 'data' ? 'active' : ''}`}
          onClick={() => setActiveTab('data')}
          disabled={!sampleData}
        >
          <span className="tab-icon">📊</span>
          Data Fields
        </button>
      </div>
      <div className="side-panel-content">
        {activeTab === 'elements' && <Toolbar />}
        {activeTab === 'data' && sampleData && (
          <DataPreview
            headerData={sampleData.header.data}
            headerFields={sampleData.header.fields}
            itemsData={sampleData.items.data}
            itemsFields={sampleData.items.fields}
            contentDetails={sampleData.contentDetails}
          />
        )}
        {activeTab === 'data' && !sampleData && (
          <div className="no-data-message">
            <p>Execute query to see available data fields</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SidePanel;

