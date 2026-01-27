import React, { useState } from 'react';
import Toolbar from './Toolbar';
import ImageGallery from './ImageGallery';
import DataPreview from './DataPreview';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Puzzle, BarChart } from 'lucide-react';
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
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)} className="w-full h-full flex flex-col">
        <TabsList className="side-panel-tabs flex-shrink-0">
          <TabsTrigger value="elements" className="tab-button">
            <span className="tab-icon"><Puzzle size={16} /></span>
            Elements
          </TabsTrigger>
          <TabsTrigger value="data" className="tab-button" disabled={!sampleData}>
            <span className="tab-icon"><BarChart size={16} /></span>
            Data Fields
          </TabsTrigger>
        </TabsList>
        <div className="flex-1 min-h-0 overflow-hidden">
          <TabsContent value="elements" className="side-panel-content h-full m-0">
            <ScrollArea className="h-full">
              <ImageGallery />
              <Toolbar />
            </ScrollArea>
          </TabsContent>
          <TabsContent value="data" className="side-panel-content h-full m-0">
            <ScrollArea className="h-full">
              {sampleData ? (
                <DataPreview
                  headerData={sampleData.header.data}
                  headerFields={sampleData.header.fields}
                  itemsData={sampleData.items.data}
                  itemsFields={sampleData.items.fields}
                  contentDetails={sampleData.contentDetails}
                />
              ) : (
                <div className="no-data-message">
                  <p>Execute query to see available data fields</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default SidePanel;

