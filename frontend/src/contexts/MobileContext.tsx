import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// Types for element placement
export interface PlacementItem {
  type: 'text' | 'table' | 'pageNumber' | 'totalPages' | 'data-field' | 'image';
  targetSection?: 'pageHeader' | 'pageFooter' | 'header' | 'billContent' | 'billFooter';
  field?: string;
  dataType?: string;
  imageId?: number;
  imageUrl?: string;
}

interface MobileContextType {
  // Device detection
  isMobile: boolean;
  isTablet: boolean;
  isTouchDevice: boolean;
  
  // Placement mode for tap-to-add workflow
  isPlacementMode: boolean;
  placementItem: PlacementItem | null;
  enterPlacementMode: (item: PlacementItem) => void;
  exitPlacementMode: () => void;
  
  // Mobile designer tabs
  activeDesignerTab: 'canvas' | 'elements' | 'data' | 'properties';
  setActiveDesignerTab: (tab: 'canvas' | 'elements' | 'data' | 'properties') => void;
  
  // Canvas zoom/pan state
  canvasZoom: number;
  setCanvasZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

const MobileContext = createContext<MobileContextType | undefined>(undefined);

interface MobileProviderProps {
  children: ReactNode;
}

export const MobileProvider: React.FC<MobileProviderProps> = ({ children }) => {
  // Device detection
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  
  // Placement mode state
  const [isPlacementMode, setIsPlacementMode] = useState(false);
  const [placementItem, setPlacementItem] = useState<PlacementItem | null>(null);
  
  // Mobile designer tabs
  const [activeDesignerTab, setActiveDesignerTab] = useState<'canvas' | 'elements' | 'data' | 'properties'>('canvas');
  
  // Canvas zoom
  const [canvasZoom, setCanvasZoom] = useState(1);

  // Detect device type
  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
      setIsTouchDevice(hasTouchScreen);
      
      // Default zoom is always 100% - user can manually zoom out if needed
      // Zoom is preserved on resize, only set initial on first load
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // Enter placement mode with selected item
  const enterPlacementMode = useCallback((item: PlacementItem) => {
    setPlacementItem(item);
    setIsPlacementMode(true);
    // Switch to canvas tab when entering placement mode on mobile
    if (window.innerWidth < 768) {
      setActiveDesignerTab('canvas');
    }
  }, []);

  // Exit placement mode
  const exitPlacementMode = useCallback(() => {
    setPlacementItem(null);
    setIsPlacementMode(false);
  }, []);

  // Zoom controls
  const zoomIn = useCallback(() => {
    setCanvasZoom(prev => Math.min(2, prev + 0.1));
  }, []);

  const zoomOut = useCallback(() => {
    setCanvasZoom(prev => Math.max(0.2, prev - 0.1));
  }, []);

  const resetZoom = useCallback(() => {
    // Reset zoom to 100% on all devices
    setCanvasZoom(1);
  }, []);

  const value: MobileContextType = {
    isMobile,
    isTablet,
    isTouchDevice,
    isPlacementMode,
    placementItem,
    enterPlacementMode,
    exitPlacementMode,
    activeDesignerTab,
    setActiveDesignerTab,
    canvasZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    setCanvasZoom,
  };

  return (
    <MobileContext.Provider value={value}>
      {children}
    </MobileContext.Provider>
  );
};

export const useMobile = (): MobileContextType => {
  const context = useContext(MobileContext);
  if (context === undefined) {
    throw new Error('useMobile must be used within a MobileProvider');
  }
  return context;
};

export default MobileContext;

