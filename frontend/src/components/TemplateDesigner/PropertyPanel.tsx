import React, { useState } from 'react';
import type { TemplateJson, TextFieldConfig, ItemsTableConfig, ContentDetailsTableConfig, TableColumnConfig, FinalRowConfig, ImageFieldConfig } from '../../services/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Target, Settings, Palette, Save, Move } from 'lucide-react';
import './PropertyPanel.css';

interface PropertyPanelProps {
  selectedElement: { type: 'field' | 'table' | 'contentDetailTable' | 'billContentTable' | 'image'; index: number; section?: 'pageHeader' | 'pageFooter' | 'header' | 'billContent' | 'billFooter' } | null;
  template: TemplateJson;
  onUpdateField: (index: number, updates: Partial<TextFieldConfig>, section?: 'pageHeader' | 'pageFooter' | 'header' | 'billContent' | 'billFooter') => void;
  onUpdateImage?: (index: number, updates: Partial<ImageFieldConfig>, section?: 'pageHeader' | 'pageFooter' | 'header' | 'billContent' | 'billFooter') => void;
  onUpdateTable: (table: ItemsTableConfig) => void;
  onUpdateContentDetailTable?: (index: number, table: ContentDetailsTableConfig) => void;
  onUpdateBillContentTable?: (index: number, table: ItemsTableConfig) => void;
  onUpdatePage?: (page: { size?: string; orientation?: 'portrait' | 'landscape' }) => void;
  onUpdatePagination?: (pagination: { rowsPerPage?: number; repeatHeader?: boolean }) => void;
  onSave?: () => void;
  isSaving?: boolean;
  onSetup?: () => void;
  onOpenTableModal?: (type: 'itemsTable' | 'billContentTable' | 'contentDetailTable', index?: number) => void;
  onOpenZoneConfig?: () => void;
  fullSampleData?: {
    header?: { data: Record<string, any> | null; fields: string[] };
    items?: { data: Record<string, any>[]; fields: string[]; sampleCount: number };
    contentDetails?: Record<string, { data: Record<string, any>[] | Record<string, any> | null; fields: string[]; sampleCount: number; dataType?: 'array' | 'object' }>;
  } | null;
}

const PropertyPanel: React.FC<PropertyPanelProps> = ({
  selectedElement,
  template,
  onUpdateField,
  onUpdateImage,
  onUpdateTable,
  onUpdateContentDetailTable,
  onUpdateBillContentTable,
  onUpdatePage,
  onUpdatePagination,
  onSave,
  isSaving,
  onSetup,
  onOpenTableModal,
  onOpenZoneConfig,
  fullSampleData,
}) => {
  // State for Available Fields modal
  const [showFieldsModal, setShowFieldsModal] = useState(false);
  const [modalPosition, setModalPosition] = useState({ top: 0, left: 0 });
  const dataBindingInputRef = React.useRef<HTMLInputElement>(null);
  
  // State for Font Selection modal
  const [showFontModal, setShowFontModal] = useState(false);
  const [fontModalPosition, setFontModalPosition] = useState({ top: 0, left: 0 });
  const fontInputRef = React.useRef<HTMLInputElement>(null);
  
  // State for table column selection (must be at top level - Rules of Hooks)
  const [itemsTableSelectedColumns, setItemsTableSelectedColumns] = useState<Set<number>>(new Set());
  const [contentDetailTableSelectedColumns, setContentDetailTableSelectedColumns] = useState<Set<number>>(new Set());
  const [billContentTableSelectedColumns, setBillContentTableSelectedColumns] = useState<Set<number>>(new Set());
  
  // State for Position Editor modal
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [positionModalPosition, setPositionModalPosition] = useState({ top: 0, left: 0 });
  const [positionValues, setPositionValues] = useState({ x: 0, y: 0 });
  const [positionUpdateCallback, setPositionUpdateCallback] = useState<((x: number, y: number) => void) | null>(null);
  const positionXInputRef = React.useRef<HTMLInputElement>(null);
  const positionYInputRef = React.useRef<HTMLInputElement>(null);
  
  // State for Width Editor modal
  const [showWidthModal, setShowWidthModal] = useState(false);
  const [widthModalPosition, setWidthModalPosition] = useState({ top: 0, left: 0 });
  const [widthValue, setWidthValue] = useState<string>('');
  const [widthUpdateCallback, setWidthUpdateCallback] = useState<((value: string) => void) | null>(null);
  const widthInputRef = React.useRef<HTMLInputElement>(null);
  
  // State for Font Size Editor modal
  const [showFontSizeModal, setShowFontSizeModal] = useState(false);
  const [fontSizeModalPosition, setFontSizeModalPosition] = useState({ top: 0, left: 0 });
  const [fontSizeValue, setFontSizeValue] = useState<number>(12);
  const [fontSizeUpdateCallback, setFontSizeUpdateCallback] = useState<((value: number | undefined) => void) | null>(null);
  const fontSizeInputRef = React.useRef<HTMLInputElement>(null);
  
  // State for Table Padding Editor modal
  const [showTablePaddingModal, setShowTablePaddingModal] = useState(false);
  const [tablePaddingModalPosition, setTablePaddingModalPosition] = useState({ top: 0, left: 0 });
  const [tablePaddingValue, setTablePaddingValue] = useState<number>(10);
  const [tablePaddingUpdateCallback, setTablePaddingUpdateCallback] = useState<((value: number) => void) | null>(null);
  const tablePaddingInputRef = React.useRef<HTMLInputElement>(null);
  
  // State for Table Font Size Editor modal
  const [showTableFontSizeModal, setShowTableFontSizeModal] = useState(false);
  const [tableFontSizeModalPosition, setTableFontSizeModalPosition] = useState({ top: 0, left: 0 });
  const [tableFontSizeValue, setTableFontSizeValue] = useState<number | undefined>(12);
  const [tableFontSizeUpdateCallback, setTableFontSizeUpdateCallback] = useState<((value: number | undefined) => void) | null>(null);
  const tableFontSizeInputRef = React.useRef<HTMLInputElement>(null);
  
  // State for Table Width Editor modal
  const [showTableWidthModal, setShowTableWidthModal] = useState(false);
  const [tableWidthModalPosition, setTableWidthModalPosition] = useState({ top: 0, left: 0 });
  const [tableWidthValue, setTableWidthValue] = useState<number | undefined>(undefined);
  const [tableWidthUpdateCallback, setTableWidthUpdateCallback] = useState<((value: number | undefined) => void) | null>(null);
  const tableWidthInputRef = React.useRef<HTMLInputElement>(null);
  
  // State for Column Binding Editor modal
  const [showColumnBindingModal, setShowColumnBindingModal] = useState(false);
  const [columnBindingModalPosition, setColumnBindingModalPosition] = useState({ top: 0, left: 0 });
  const [columnBindingValue, setColumnBindingValue] = useState<string>('');
  const [columnBindingUpdateCallback, setColumnBindingUpdateCallback] = useState<((value: string) => void) | null>(null);
  const columnBindingInputRef = React.useRef<HTMLInputElement>(null);
  
  // State for Column Width Editor modal
  const [showColumnWidthModal, setShowColumnWidthModal] = useState(false);
  const [columnWidthModalPosition, setColumnWidthModalPosition] = useState({ top: 0, left: 0 });
  const [columnWidthValue, setColumnWidthValue] = useState<number | undefined>(undefined);
  const [columnWidthUpdateCallback, setColumnWidthUpdateCallback] = useState<((value: number | undefined) => void) | null>(null);
  const columnWidthInputRef = React.useRef<HTMLInputElement>(null);
  
  // State for Column Height Editor modal
  const [showColumnHeightModal, setShowColumnHeightModal] = useState(false);
  const [columnHeightModalPosition, setColumnHeightModalPosition] = useState({ top: 0, left: 0 });
  const [columnHeightValue, setColumnHeightValue] = useState<number | undefined>(undefined);
  const [columnHeightUpdateCallback, setColumnHeightUpdateCallback] = useState<((value: number | undefined) => void) | null>(null);
  const columnHeightInputRef = React.useRef<HTMLInputElement>(null);
  
  // State for Column Row Span Editor modal
  const [showColumnRowSpanModal, setShowColumnRowSpanModal] = useState(false);
  const [columnRowSpanModalPosition, setColumnRowSpanModalPosition] = useState({ top: 0, left: 0 });
  const [columnRowSpanValue, setColumnRowSpanValue] = useState<number | undefined>(1);
  const [columnRowSpanUpdateCallback, setColumnRowSpanUpdateCallback] = useState<((value: number | undefined) => void) | null>(null);
  const columnRowSpanInputRef = React.useRef<HTMLInputElement>(null);
  
  // State for Column Column Span Editor modal
  const [showColumnColSpanModal, setShowColumnColSpanModal] = useState(false);
  const [columnColSpanModalPosition, setColumnColSpanModalPosition] = useState({ top: 0, left: 0 });
  const [columnColSpanValue, setColumnColSpanValue] = useState<number | undefined>(1);
  const [columnColSpanUpdateCallback, setColumnColSpanUpdateCallback] = useState<((value: number | undefined) => void) | null>(null);
  const columnColSpanInputRef = React.useRef<HTMLInputElement>(null);
  
  // State for Column Calculation Editor modal
  const [showColumnCalculationModal, setShowColumnCalculationModal] = useState(false);
  const [columnCalculationModalPosition, setColumnCalculationModalPosition] = useState({ top: 0, left: 0 });
  const [columnCalculationValue, setColumnCalculationValue] = useState<string>('none');
  const [columnCalculationSource, setColumnCalculationSource] = useState<string>('');
  const [columnCalculationField, setColumnCalculationField] = useState<string>('');
  const [columnCalculationFormula, setColumnCalculationFormula] = useState<string>('');
  const [columnCalculationUpdateCallback, setColumnCalculationUpdateCallback] = useState<((value: { calculationType: string; calculationSource?: string; calculationField?: string; calculationFormula?: string }) => void) | null>(null);
  const columnCalculationInputRef = React.useRef<HTMLSelectElement>(null);
  
  // State for Final Row Cell Col Span Editor modal
  const [showFinalRowColSpanModal, setShowFinalRowColSpanModal] = useState(false);
  const [finalRowColSpanModalPosition, setFinalRowColSpanModalPosition] = useState({ top: 0, left: 0 });
  const [finalRowColSpanValue, setFinalRowColSpanValue] = useState<number | undefined>(1);
  const [finalRowColSpanUpdateCallback, setFinalRowColSpanUpdateCallback] = useState<((value: number | undefined) => void) | null>(null);
  const finalRowColSpanInputRef = React.useRef<HTMLInputElement>(null);
  
  // State for Final Row Cell Calculation Source Editor modal
  const [showFinalRowCalculationSourceModal, setShowFinalRowCalculationSourceModal] = useState(false);
  const [finalRowCalculationSourceModalPosition, setFinalRowCalculationSourceModalPosition] = useState({ top: 0, left: 0 });
  const [finalRowCalculationSourceValue, setFinalRowCalculationSourceValue] = useState<string>('');
  const [finalRowCalculationSourceUpdateCallback, setFinalRowCalculationSourceUpdateCallback] = useState<((value: string) => void) | null>(null);
  const finalRowCalculationSourceInputRef = React.useRef<HTMLInputElement>(null);
  
  // State for Final Row Cell Calculation Field Editor modal
  const [showFinalRowCalculationFieldModal, setShowFinalRowCalculationFieldModal] = useState(false);
  const [finalRowCalculationFieldModalPosition, setFinalRowCalculationFieldModalPosition] = useState({ top: 0, left: 0 });
  const [finalRowCalculationFieldValue, setFinalRowCalculationFieldValue] = useState<string>('');
  const [finalRowCalculationSourceForField, setFinalRowCalculationSourceForField] = useState<string>('');
  const [finalRowCalculationFieldUpdateCallback, setFinalRowCalculationFieldUpdateCallback] = useState<((value: string) => void) | null>(null);
  const finalRowCalculationFieldInputRef = React.useRef<HTMLInputElement>(null);
  
  // Available fonts (common PDF fonts)
  const availableFonts = [
    { name: 'Helvetica', label: 'Helvetica' },
    { name: 'Helvetica-Bold', label: 'Helvetica Bold' },
    { name: 'Times-Roman', label: 'Times Roman' },
    { name: 'Times-Bold', label: 'Times Bold' },
    { name: 'Courier', label: 'Courier' },
    { name: 'Courier-Bold', label: 'Courier Bold' },
    { name: 'Arial', label: 'Arial' },
    { name: 'Arial-Bold', label: 'Arial Bold' },
  ];
  // Fixed Action Bar Component
  const ActionBar = () => {
    if (!onSave && !onSetup) return null;
    
    return (
      <div className="property-panel-actions">
        {onSetup && (
          <Button 
            variant="secondary"
            className="setup-button"
            onClick={onSetup}
          >
            <Settings size={16} className="mr-2" />
            Start
          </Button>
        )}
       {onSave && (
  <Button
    onClick={onSave}
    disabled={isSaving}
    className="
      bg-black text-white
      hover:bg-neutral-800
      disabled:bg-neutral-400
      disabled:text-white
      border border-black
    "
  >
    <Save size={16} className="mr-2" />
    {isSaving ? 'Saving...' : 'Save'}
  </Button>
)}

      </div>
    );
  };
  // Reusable function to calculate modal position near input
  const calculateModalPosition = (inputRef: React.RefObject<HTMLInputElement | HTMLSelectElement> | HTMLElement | null, modalWidth: number = 350, modalHeight: number = 300) => {
    let element: HTMLElement | null = null;
    
    if (inputRef && 'current' in inputRef && inputRef.current) {
      element = inputRef.current;
    } else if (inputRef && !('current' in inputRef)) {
      element = inputRef as HTMLElement;
    }
    
    if (element) {
      const rect = element.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let top = rect.bottom + 8;
      let left = rect.left;
      
      // Adjust for viewport boundaries
      if (left + modalWidth > viewportWidth - 16) {
        left = viewportWidth - modalWidth - 16;
      }
      if (left < 16) left = 16;
      if (top + modalHeight > viewportHeight - 16) {
        top = rect.top - modalHeight - 8;
        if (top < 16) top = 16;
      }
      
      return { top, left };
    }
    return { top: 0, left: 0 };
  };

  // Helper function to open position editor modal
  const openPositionModal = (x: number, y: number, onSave: (x: number, y: number) => void, inputElement: HTMLElement | React.RefObject<HTMLInputElement> | null = null) => {
    setPositionValues({ x, y });
    setPositionUpdateCallback(() => onSave);
    // Use provided element/ref or default to X ref
    let elementToUse: HTMLElement | null = null;
    if (inputElement) {
      if ('current' in inputElement && inputElement.current) {
        elementToUse = inputElement.current;
      } else if (!('current' in inputElement)) {
        elementToUse = inputElement as HTMLElement;
      }
    }
    if (!elementToUse && positionXInputRef.current) {
      elementToUse = positionXInputRef.current;
    }
    const pos = calculateModalPosition(elementToUse, 400, 350);
    setPositionModalPosition(pos);
    setShowPositionModal(true);
  };

  const handlePositionSave = () => {
    if (positionUpdateCallback) {
      positionUpdateCallback(positionValues.x, positionValues.y);
    }
    setShowPositionModal(false);
  };

  // Helper function to open width editor modal
  const openWidthModal = (currentValue: string, onSave: (value: string) => void, inputElement: HTMLElement | React.RefObject<HTMLInputElement>) => {
    setWidthValue(currentValue || '');
    setWidthUpdateCallback(() => onSave);
    let element: HTMLElement | null = null;
    if ('current' in inputElement && inputElement.current) {
      element = inputElement.current;
    } else if (!('current' in inputElement)) {
      element = inputElement as HTMLElement;
    }
    const pos = calculateModalPosition(element, 350, 280);
    setWidthModalPosition(pos);
    setShowWidthModal(true);
  };

  const handleWidthSave = () => {
    if (widthUpdateCallback) {
      widthUpdateCallback(widthValue.trim() || '');
    }
    setShowWidthModal(false);
  };

  // Helper function to open font size editor modal
  const openFontSizeModal = (currentValue: number | undefined, onSave: (value: number | undefined) => void, inputElement: HTMLElement | React.RefObject<HTMLInputElement>) => {
    setFontSizeValue(currentValue || 12);
    setFontSizeUpdateCallback(() => onSave);
    let element: HTMLElement | null = null;
    if ('current' in inputElement && inputElement.current) {
      element = inputElement.current;
    } else if (!('current' in inputElement)) {
      element = inputElement as HTMLElement;
    }
    const pos = calculateModalPosition(element, 300, 250);
    setFontSizeModalPosition(pos);
    setShowFontSizeModal(true);
  };

  const handleFontSizeSave = () => {
    if (fontSizeUpdateCallback) {
      fontSizeUpdateCallback(fontSizeValue > 0 ? fontSizeValue : undefined);
    }
    setShowFontSizeModal(false);
  };

  // Helper function to open table padding editor modal
  const openTablePaddingModal = (currentValue: number, onSave: (value: number) => void, inputElement: HTMLElement | React.RefObject<HTMLInputElement>) => {
    setTablePaddingValue(currentValue || 10);
    setTablePaddingUpdateCallback(() => onSave);
    let element: HTMLElement | null = null;
    if ('current' in inputElement && inputElement.current) {
      element = inputElement.current;
    } else if (!('current' in inputElement)) {
      element = inputElement as HTMLElement;
    }
    const pos = calculateModalPosition(element, 300, 250);
    setTablePaddingModalPosition(pos);
    setShowTablePaddingModal(true);
  };

  const handleTablePaddingSave = () => {
    if (tablePaddingUpdateCallback) {
      tablePaddingUpdateCallback(Math.max(0, tablePaddingValue));
    }
    setShowTablePaddingModal(false);
  };

  // Helper function to open table font size editor modal
  const openTableFontSizeModal = (currentValue: number | undefined, onSave: (value: number | undefined) => void, inputElement: HTMLElement | React.RefObject<HTMLInputElement>) => {
    setTableFontSizeValue(currentValue || 12);
    setTableFontSizeUpdateCallback(() => onSave);
    let element: HTMLElement | null = null;
    if ('current' in inputElement && inputElement.current) {
      element = inputElement.current;
    } else if (!('current' in inputElement)) {
      element = inputElement as HTMLElement;
    }
    const pos = calculateModalPosition(element, 300, 250);
    setTableFontSizeModalPosition(pos);
    setShowTableFontSizeModal(true);
  };

  const handleTableFontSizeSave = () => {
    if (tableFontSizeUpdateCallback) {
      tableFontSizeUpdateCallback(tableFontSizeValue && tableFontSizeValue > 0 ? tableFontSizeValue : undefined);
    }
    setShowTableFontSizeModal(false);
  };

  // Helper function to open table width editor modal
  const openTableWidthModal = (currentValue: number | undefined, onSave: (value: number | undefined) => void, inputElement: HTMLElement | React.RefObject<HTMLInputElement>) => {
    setTableWidthValue(currentValue);
    setTableWidthUpdateCallback(() => onSave);
    let element: HTMLElement | null = null;
    if ('current' in inputElement && inputElement.current) {
      element = inputElement.current;
    } else if (!('current' in inputElement)) {
      element = inputElement as HTMLElement;
    }
    const pos = calculateModalPosition(element, 300, 250);
    setTableWidthModalPosition(pos);
    setShowTableWidthModal(true);
  };

  const handleTableWidthSave = () => {
    if (tableWidthUpdateCallback) {
      tableWidthUpdateCallback(tableWidthValue && tableWidthValue >= 100 ? tableWidthValue : undefined);
    }
    setShowTableWidthModal(false);
  };

  // Helper function to open column binding editor modal
  const openColumnBindingModal = (currentValue: string, onSave: (value: string) => void, inputElement: HTMLElement | null) => {
    setColumnBindingValue(currentValue || '');
    setColumnBindingUpdateCallback(() => onSave);
    const pos = calculateModalPosition(inputElement, 400, 300);
    setColumnBindingModalPosition(pos);
    setShowColumnBindingModal(true);
  };

  const handleColumnBindingSave = () => {
    if (columnBindingUpdateCallback) {
      columnBindingUpdateCallback(columnBindingValue.trim());
    }
    setShowColumnBindingModal(false);
  };

  // Helper function to open column width editor modal
  const openColumnWidthModal = (currentValue: number | undefined, onSave: (value: number | undefined) => void, inputElement: HTMLElement | null) => {
    setColumnWidthValue(currentValue);
    setColumnWidthUpdateCallback(() => onSave);
    const pos = calculateModalPosition(inputElement, 300, 250);
    setColumnWidthModalPosition(pos);
    setShowColumnWidthModal(true);
  };

  const handleColumnWidthSave = () => {
    if (columnWidthUpdateCallback) {
      columnWidthUpdateCallback(columnWidthValue && columnWidthValue >= 0 ? columnWidthValue : undefined);
    }
    setShowColumnWidthModal(false);
  };

  // Helper function to open column height editor modal
  const openColumnHeightModal = (currentValue: number | undefined, onSave: (value: number | undefined) => void, inputElement: HTMLElement | null) => {
    setColumnHeightValue(currentValue);
    setColumnHeightUpdateCallback(() => onSave);
    const pos = calculateModalPosition(inputElement, 300, 250);
    setColumnHeightModalPosition(pos);
    setShowColumnHeightModal(true);
  };

  const handleColumnHeightSave = () => {
    if (columnHeightUpdateCallback) {
      columnHeightUpdateCallback(columnHeightValue && columnHeightValue >= 0 ? columnHeightValue : undefined);
    }
    setShowColumnHeightModal(false);
  };

  // Helper function to open column row span editor modal
  const openColumnRowSpanModal = (currentValue: number | undefined, onSave: (value: number | undefined) => void, inputElement: HTMLElement | null) => {
    setColumnRowSpanValue(currentValue || 1);
    setColumnRowSpanUpdateCallback(() => onSave);
    const pos = calculateModalPosition(inputElement, 300, 250);
    setColumnRowSpanModalPosition(pos);
    setShowColumnRowSpanModal(true);
  };

  const handleColumnRowSpanSave = () => {
    if (columnRowSpanUpdateCallback) {
      columnRowSpanUpdateCallback(columnRowSpanValue && columnRowSpanValue >= 1 ? columnRowSpanValue : undefined);
    }
    setShowColumnRowSpanModal(false);
  };

  // Helper function to open column col span editor modal
  const openColumnColSpanModal = (currentValue: number | undefined, onSave: (value: number | undefined) => void, inputElement: HTMLElement | null) => {
    setColumnColSpanValue(currentValue || 1);
    setColumnColSpanUpdateCallback(() => onSave);
    const pos = calculateModalPosition(inputElement, 300, 250);
    setColumnColSpanModalPosition(pos);
    setShowColumnColSpanModal(true);
  };

  const handleColumnColSpanSave = () => {
    if (columnColSpanUpdateCallback) {
      columnColSpanUpdateCallback(columnColSpanValue && columnColSpanValue >= 1 ? columnColSpanValue : undefined);
    }
    setShowColumnColSpanModal(false);
  };

  // Helper function to open column calculation editor modal
  const openColumnCalculationModal = (
    currentValue: { calculationType?: string; calculationSource?: string; calculationField?: string; calculationFormula?: string },
    onSave: (value: { calculationType: string; calculationSource?: string; calculationField?: string; calculationFormula?: string }) => void,
    inputElement: HTMLElement | null
  ) => {
    setColumnCalculationValue(currentValue.calculationType || 'none');
    setColumnCalculationSource(currentValue.calculationSource || '');
    setColumnCalculationField(currentValue.calculationField || '');
    setColumnCalculationFormula(currentValue.calculationFormula || '');
    setColumnCalculationUpdateCallback(() => onSave);
    const pos = calculateModalPosition(inputElement, 400, 400);
    setColumnCalculationModalPosition(pos);
    setShowColumnCalculationModal(true);
  };

  const handleColumnCalculationSave = () => {
    if (columnCalculationUpdateCallback) {
      const result: any = { calculationType: columnCalculationValue };
      if (columnCalculationValue !== 'none' && columnCalculationValue !== 'custom') {
        result.calculationSource = columnCalculationSource;
        result.calculationField = columnCalculationField;
      } else if (columnCalculationValue === 'custom') {
        result.calculationFormula = columnCalculationFormula;
      }
      columnCalculationUpdateCallback(result);
    }
    setShowColumnCalculationModal(false);
  };

  // Helper function to open final row cell col span editor modal
  const openFinalRowColSpanModal = (currentValue: number | undefined, onSave: (value: number | undefined) => void, inputElement: HTMLElement | null) => {
    setFinalRowColSpanValue(currentValue || 1);
    setFinalRowColSpanUpdateCallback(() => onSave);
    const pos = calculateModalPosition(inputElement, 300, 250);
    setFinalRowColSpanModalPosition(pos);
    setShowFinalRowColSpanModal(true);
  };

  const handleFinalRowColSpanSave = () => {
    if (finalRowColSpanUpdateCallback) {
      finalRowColSpanUpdateCallback(finalRowColSpanValue && finalRowColSpanValue >= 1 ? finalRowColSpanValue : undefined);
    }
    setShowFinalRowColSpanModal(false);
  };

  // Helper function to open final row cell calculation source editor modal
  const openFinalRowCalculationSourceModal = (currentValue: string, onSave: (value: string) => void, inputElement: HTMLElement | null) => {
    setFinalRowCalculationSourceValue(currentValue || '');
    setFinalRowCalculationSourceUpdateCallback(() => onSave);
    const pos = calculateModalPosition(inputElement, 500, 400);
    setFinalRowCalculationSourceModalPosition(pos);
    setShowFinalRowCalculationSourceModal(true);
  };

  const handleFinalRowCalculationSourceSave = () => {
    if (finalRowCalculationSourceUpdateCallback) {
      finalRowCalculationSourceUpdateCallback(finalRowCalculationSourceValue.trim());
    }
    setShowFinalRowCalculationSourceModal(false);
  };

  // Helper function to open final row cell calculation field editor modal
  const openFinalRowCalculationFieldModal = (currentValue: string, sourcePath: string, onSave: (value: string) => void, inputElement: HTMLElement | null) => {
    setFinalRowCalculationFieldValue(currentValue || '');
    setFinalRowCalculationSourceForField(sourcePath);
    setFinalRowCalculationFieldUpdateCallback(() => onSave);
    const pos = calculateModalPosition(inputElement, 400, 350);
    setFinalRowCalculationFieldModalPosition(pos);
    setShowFinalRowCalculationFieldModal(true);
  };

  const handleFinalRowCalculationFieldSave = () => {
    if (finalRowCalculationFieldUpdateCallback) {
      finalRowCalculationFieldUpdateCallback(finalRowCalculationFieldValue.trim());
    }
    setShowFinalRowCalculationFieldModal(false);
  };

  const getFieldForSelected = (): TextFieldConfig | null => {
    if (!selectedElement || selectedElement.type !== 'field') return null;
    const section = selectedElement.section || 'header';
    if (section === 'pageHeader') return template.pageHeader?.[selectedElement.index] || null;
    if (section === 'pageFooter') return template.pageFooter?.[selectedElement.index] || null;
    if (section === 'billFooter') return template.billFooter?.[selectedElement.index] || null;
    if (section === 'billContent') return template.billContent?.[selectedElement.index] || null;
    return template.header[selectedElement.index] || null;
  };

  // Get available fields for data binding
  const getAvailableFields = (): { header: string[]; contentDetails: Record<string, string[]> } => {
    const result = {
      header: [] as string[],
      contentDetails: {} as Record<string, string[]>
    };
    
    if (fullSampleData) {
      if (fullSampleData.header?.fields) {
        result.header = fullSampleData.header.fields;
      }
      if (fullSampleData.contentDetails) {
        Object.keys(fullSampleData.contentDetails).forEach(name => {
          const detail = fullSampleData.contentDetails![name];
          if (detail.fields) {
            result.contentDetails[name] = detail.fields;
          }
        });
      }
    }
    
    return result;
  };

  // Get available data sources for calculations (arrays/tables)
  const getAvailableDataSources = (): Array<{ path: string; label: string; fields: string[] }> => {
    const sources: Array<{ path: string; label: string; fields: string[] }> = [];
    
    if (fullSampleData) {
      // Check for items array (root-level array)
      if (fullSampleData.items) {
        const items = fullSampleData.items;
        if (items.fields && items.fields.length > 0) {
          const itemCount = items.sampleCount || (Array.isArray(items.data) ? items.data.length : 0);
          sources.push({
            path: 'items',
            label: `Items (${itemCount} rows)`,
            fields: items.fields
          });
        }
      }
      
      // Check contentDetails arrays
      if (fullSampleData.contentDetails) {
        Object.keys(fullSampleData.contentDetails).forEach(name => {
          const detail = fullSampleData.contentDetails![name];
          // Only include if it's an array type (has dataType: 'array' or has array data)
          if (detail.dataType === 'array' || (Array.isArray(detail.data) && detail.data.length > 0)) {
            if (detail.fields && detail.fields.length > 0) {
              sources.push({
                path: `contentDetails.${name}`,
                label: `${name} (${detail.sampleCount || (Array.isArray(detail.data) ? detail.data.length : 0)} items)`,
                fields: detail.fields
              });
            }
          }
        });
      }
    }
    
    return sources;
  };

  // Binding validation helper
  const validateBindPath = (bindPath: string): { valid: boolean; error?: string } => {
    if (!bindPath || !bindPath.trim()) {
      return { valid: true }; // Empty bind is valid (static field)
    }

    if (!fullSampleData) {
      return { valid: true }; // No sample data available, allow any bind
    }

    const trimmed = bindPath.trim();
    
    // Check for contentDetails binding: contentDetails.name.field
    if (trimmed.startsWith('contentDetails.')) {
      const parts = trimmed.split('.');
      if (parts.length === 3) {
        const [, contentName, fieldName] = parts;
        const contentDetail = fullSampleData.contentDetails?.[contentName];
        if (contentDetail && contentDetail.fields) {
          if (contentDetail.fields.includes(fieldName)) {
            return { valid: true };
          } else {
            return { 
              valid: false, 
              error: `Field "${fieldName}" not found in contentDetails.${contentName}. Available: ${contentDetail.fields.join(', ')}` 
            };
          }
        } else {
          return { 
            valid: false, 
            error: `Content detail "${contentName}" not found in sample data` 
          };
        }
      } else {
        return { 
          valid: false, 
          error: 'Invalid contentDetails binding format. Expected: contentDetails.name.field' 
        };
      }
    }
    
    // Check for header binding: header.FieldName or direct field name
    let fieldName = trimmed;
    if (trimmed.includes('.')) {
      const parts = trimmed.split('.');
      if (parts[0] === 'header' && parts.length === 2) {
        fieldName = parts[1];
      } else {
        // Allow other dot-separated paths (might be valid but not in sample data)
        return { valid: true }; // Don't validate unknown patterns
      }
    }
    
    // Check if field exists in header
    if (fullSampleData.header?.fields) {
      if (fullSampleData.header.fields.includes(fieldName)) {
        return { valid: true };
      } else {
        return { 
          valid: false, 
          error: `Field "${fieldName}" not found in header. Available: ${fullSampleData.header.fields.join(', ')}` 
        };
      }
    }
    
    return { valid: true }; // Default to valid if we can't validate
  };

  const getImageForSelected = (): ImageFieldConfig | null => {
    if (!selectedElement || selectedElement.type !== 'image' || !onUpdateImage) return null;
    const section = selectedElement.section || 'header';
    const sectionKey = section === 'pageHeader' ? 'pageHeaderImages' :
                      section === 'pageFooter' ? 'pageFooterImages' :
                      section === 'header' ? 'headerImages' :
                      section === 'billContent' ? 'billContentImages' :
                      'billFooterImages';
    const images = (template[sectionKey as keyof TemplateJson] as ImageFieldConfig[]) || [];
    return images[selectedElement.index] || null;
  };
  // Position Editor Modal Component (always rendered)
  const PositionModal = () => {
    if (!showPositionModal) return null;
    
    return (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-70"
          onClick={() => setShowPositionModal(false)}
        />
        {/* Modal positioned near input */}
        <div 
          className="fixed z-50 bg-black border border-white border-opacity-20 rounded-lg shadow-xl w-96 max-h-[60vh] flex flex-col"
          style={{
            top: `${positionModalPosition.top}px`,
            left: `${positionModalPosition.left}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b border-white border-opacity-20">
            <h3 className="text-lg font-semibold text-white">Edit Position</h3>
            <button
              type="button"
              onClick={() => setShowPositionModal(false)}
              className="text-white text-opacity-60 hover:text-white text-2xl font-bold transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          
          {/* Modal Content */}
          <div className="p-4 overflow-y-auto flex-1">
            <p className="text-sm text-white text-opacity-80 mb-4">
              Adjust the X and Y coordinates. Use the arrow buttons for fine adjustments or type values directly.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">X:</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPositionValues(prev => ({ ...prev, x: Math.max(0, prev.x - 1) }))}
                    className="px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white hover:bg-opacity-20 transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    className="flex-1 px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={positionValues.x}
                    onChange={(e) => setPositionValues(prev => ({ ...prev, x: parseFloat(e.target.value) || 0 }))}
                  />
                  <button
                    type="button"
                    onClick={() => setPositionValues(prev => ({ ...prev, x: prev.x + 1 }))}
                    className="px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white hover:bg-opacity-20 transition-colors"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setPositionValues(prev => ({ ...prev, x: Math.max(0, prev.x - 10) }))}
                    className="px-2 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white text-sm hover:bg-opacity-20 transition-colors"
                  >
                    -10
                  </button>
                  <button
                    type="button"
                    onClick={() => setPositionValues(prev => ({ ...prev, x: prev.x + 10 }))}
                    className="px-2 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white text-sm hover:bg-opacity-20 transition-colors"
                  >
                    +10
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Y:</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPositionValues(prev => ({ ...prev, y: Math.max(0, prev.y - 1) }))}
                    className="px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white hover:bg-opacity-20 transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    className="flex-1 px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={positionValues.y}
                    onChange={(e) => setPositionValues(prev => ({ ...prev, y: parseFloat(e.target.value) || 0 }))}
                  />
                  <button
                    type="button"
                    onClick={() => setPositionValues(prev => ({ ...prev, y: prev.y + 1 }))}
                    className="px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white hover:bg-opacity-20 transition-colors"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setPositionValues(prev => ({ ...prev, y: Math.max(0, prev.y - 10) }))}
                    className="px-2 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white text-sm hover:bg-opacity-20 transition-colors"
                  >
                    -10
                  </button>
                  <button
                    type="button"
                    onClick={() => setPositionValues(prev => ({ ...prev, y: prev.y + 10 }))}
                    className="px-2 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white text-sm hover:bg-opacity-20 transition-colors"
                  >
                    +10
                  </button>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPositionValues({ x: 0, y: 0 })}
                  className="flex-1 px-4 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white hover:bg-opacity-20 transition-colors text-sm"
                >
                  Reset to (0, 0)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const centerX = 400; // Approximate center for A4
                    const centerY = 560;
                    setPositionValues({ x: centerX, y: centerY });
                  }}
                  className="flex-1 px-4 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white hover:bg-opacity-20 transition-colors text-sm"
                >
                  Center
                </button>
              </div>
            </div>
          </div>
          
          {/* Modal Footer */}
          <div className="p-4 border-t border-white border-opacity-20 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowPositionModal(false)}
              className="px-4 py-2 bg-white bg-opacity-10 text-white rounded-md hover:bg-opacity-20 transition-colors border border-white border-opacity-20"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePositionSave}
              className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-md hover:bg-opacity-30 transition-colors border border-white border-opacity-20"
            >
              Save Position
            </button>
          </div>
        </div>
      </>
    );
  };

  // Width Editor Modal Component (always rendered)
  const WidthModal = () => {
    if (!showWidthModal) return null;
    
    const parseWidthValue = (value: string): { numeric: number; unit: string } => {
      const trimmed = value.trim();
      if (!trimmed || trimmed === 'auto') return { numeric: 0, unit: 'auto' };
      if (trimmed.endsWith('%')) {
        return { numeric: parseFloat(trimmed) || 0, unit: '%' };
      }
      if (trimmed.endsWith('px')) {
        return { numeric: parseFloat(trimmed) || 0, unit: 'px' };
      }
      // Assume px if just a number
      return { numeric: parseFloat(trimmed) || 0, unit: 'px' };
    };

    const formatWidthValue = (numeric: number, unit: string): string => {
      if (unit === 'auto') return 'auto';
      if (unit === '%') return `${numeric}%`;
      return `${numeric}px`;
    };

    const currentWidth = parseWidthValue(widthValue);
    
    const handleIncrement = (amount: number) => {
      if (currentWidth.unit === 'auto') {
        setWidthValue('100px');
      } else {
        const newNumeric = Math.max(0, currentWidth.numeric + amount);
        setWidthValue(formatWidthValue(newNumeric, currentWidth.unit));
      }
    };

    const handleDecrement = (amount: number) => {
      if (currentWidth.unit === 'auto') {
        setWidthValue('100px');
      } else {
        const newNumeric = Math.max(0, currentWidth.numeric - amount);
        setWidthValue(formatWidthValue(newNumeric, currentWidth.unit));
      }
    };

    return (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-70"
          onClick={() => setShowWidthModal(false)}
        />
        {/* Modal positioned near input */}
        <div 
          className="fixed z-50 bg-black border border-white border-opacity-20 rounded-lg shadow-xl w-80 max-h-[60vh] flex flex-col"
          style={{
            top: `${widthModalPosition.top}px`,
            left: `${widthModalPosition.left}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b border-white border-opacity-20">
            <h3 className="text-lg font-semibold text-white">Edit Width</h3>
            <button
              type="button"
              onClick={() => setShowWidthModal(false)}
              className="text-white text-opacity-60 hover:text-white text-2xl font-bold transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          
          {/* Modal Content */}
          <div className="p-4 overflow-y-auto flex-1">
            <p className="text-sm text-white text-opacity-80 mb-4">
              Adjust width. Supports px, %, or "auto".
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Width:</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDecrement(1)}
                    className="px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white hover:bg-opacity-20 transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={widthValue}
                    onChange={(e) => setWidthValue(e.target.value)}
                    placeholder="e.g., 100px, 50%, auto"
                  />
                  <button
                    type="button"
                    onClick={() => handleIncrement(1)}
                    className="px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white hover:bg-opacity-20 transition-colors"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecrement(10)}
                    className="px-2 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white text-sm hover:bg-opacity-20 transition-colors"
                  >
                    -10
                  </button>
                  <button
                    type="button"
                    onClick={() => handleIncrement(10)}
                    className="px-2 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white text-sm hover:bg-opacity-20 transition-colors"
                  >
                    +10
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Quick Presets:</label>
                <div className="flex flex-wrap gap-2">
                  {['auto', '50%', '100%', '200px', '300px'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setWidthValue(preset)}
                      className={`px-3 py-2 rounded-md text-sm transition-colors ${
                        widthValue === preset
                          ? 'bg-white bg-opacity-30 border border-white border-opacity-40 text-white'
                          : 'bg-white bg-opacity-10 border border-white border-opacity-20 text-white hover:bg-opacity-20'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {/* Modal Footer */}
          <div className="p-4 border-t border-white border-opacity-20 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowWidthModal(false)}
              className="px-4 py-2 bg-white bg-opacity-10 text-white rounded-md hover:bg-opacity-20 transition-colors border border-white border-opacity-20"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleWidthSave}
              className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-md hover:bg-opacity-30 transition-colors border border-white border-opacity-20"
            >
              Save Width
            </button>
          </div>
        </div>
      </>
    );
  };

  // Font Size Editor Modal Component (always rendered)
  const FontSizeModal = () => {
    if (!showFontSizeModal) return null;
    
    return (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-70"
          onClick={() => setShowFontSizeModal(false)}
        />
        {/* Modal positioned near input */}
        <div 
          className="fixed z-50 bg-black border border-white border-opacity-20 rounded-lg shadow-xl w-72 max-h-[60vh] flex flex-col"
          style={{
            top: `${fontSizeModalPosition.top}px`,
            left: `${fontSizeModalPosition.left}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b border-white border-opacity-20">
            <h3 className="text-lg font-semibold text-white">Edit Font Size</h3>
            <button
              type="button"
              onClick={() => setShowFontSizeModal(false)}
              className="text-white text-opacity-60 hover:text-white text-2xl font-bold transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          
          {/* Modal Content */}
          <div className="p-4 overflow-y-auto flex-1">
            <p className="text-sm text-white text-opacity-80 mb-4">
              Adjust font size. Use buttons for fine adjustments or type directly.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Font Size:</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFontSizeValue(prev => Math.max(1, prev - 1))}
                    className="px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white hover:bg-opacity-20 transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    className="flex-1 px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={fontSizeValue}
                    onChange={(e) => setFontSizeValue(Math.max(1, parseFloat(e.target.value) || 12))}
                  />
                  <button
                    type="button"
                    onClick={() => setFontSizeValue(prev => prev + 1)}
                    className="px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white hover:bg-opacity-20 transition-colors"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setFontSizeValue(prev => Math.max(1, prev - 2))}
                    className="px-2 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white text-sm hover:bg-opacity-20 transition-colors"
                  >
                    -2
                  </button>
                  <button
                    type="button"
                    onClick={() => setFontSizeValue(prev => prev + 2)}
                    className="px-2 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white text-sm hover:bg-opacity-20 transition-colors"
                  >
                    +2
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Quick Presets:</label>
                <div className="flex flex-wrap gap-2">
                  {[8, 10, 12, 14, 16, 18, 20, 24, 28, 32].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setFontSizeValue(size)}
                      className={`px-3 py-2 rounded-md text-sm transition-colors ${
                        fontSizeValue === size
                          ? 'bg-white bg-opacity-30 border border-white border-opacity-40 text-white'
                          : 'bg-white bg-opacity-10 border border-white border-opacity-20 text-white hover:bg-opacity-20'
                      }`}
                    >
                      {size}px
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {/* Modal Footer */}
          <div className="p-4 border-t border-white border-opacity-20 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowFontSizeModal(false)}
              className="px-4 py-2 bg-white bg-opacity-10 text-white rounded-md hover:bg-opacity-20 transition-colors border border-white border-opacity-20"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleFontSizeSave}
              className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-md hover:bg-opacity-30 transition-colors border border-white border-opacity-20"
            >
              Save Font Size
            </button>
          </div>
        </div>
      </>
    );
  };

  // Table Padding Editor Modal Component (always rendered)
  const TablePaddingModal = () => {
    if (!showTablePaddingModal) return null;
    
    return (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-70"
          onClick={() => setShowTablePaddingModal(false)}
        />
        {/* Modal positioned near input */}
        <div 
          className="fixed z-50 bg-black border border-white border-opacity-20 rounded-lg shadow-xl w-72 max-h-[60vh] flex flex-col"
          style={{
            top: `${tablePaddingModalPosition.top}px`,
            left: `${tablePaddingModalPosition.left}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b border-white border-opacity-20">
            <h3 className="text-lg font-semibold text-white">Edit Table Padding</h3>
            <button
              type="button"
              onClick={() => setShowTablePaddingModal(false)}
              className="text-white text-opacity-60 hover:text-white text-2xl font-bold transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          
          {/* Modal Content */}
          <div className="p-4 overflow-y-auto flex-1">
            <p className="text-sm text-white text-opacity-80 mb-4">
              Adjust cell padding. Use buttons for fine adjustments or type directly.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Padding:</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTablePaddingValue(prev => Math.max(0, prev - 1))}
                    className="px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white hover:bg-opacity-20 transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="0"
                    className="flex-1 px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={tablePaddingValue}
                    onChange={(e) => setTablePaddingValue(Math.max(0, parseFloat(e.target.value) || 10))}
                  />
                  <button
                    type="button"
                    onClick={() => setTablePaddingValue(prev => prev + 1)}
                    className="px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white hover:bg-opacity-20 transition-colors"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setTablePaddingValue(prev => Math.max(0, prev - 5))}
                    className="px-2 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white text-sm hover:bg-opacity-20 transition-colors"
                  >
                    -5
                  </button>
                  <button
                    type="button"
                    onClick={() => setTablePaddingValue(prev => prev + 5)}
                    className="px-2 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white text-sm hover:bg-opacity-20 transition-colors"
                  >
                    +5
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Quick Presets:</label>
                <div className="flex flex-wrap gap-2">
                  {[0, 5, 10, 15, 20].map((padding) => (
                    <button
                      key={padding}
                      type="button"
                      onClick={() => setTablePaddingValue(padding)}
                      className={`px-3 py-2 rounded-md text-sm transition-colors ${
                        tablePaddingValue === padding
                          ? 'bg-white bg-opacity-30 border border-white border-opacity-40 text-white'
                          : 'bg-white bg-opacity-10 border border-white border-opacity-20 text-white hover:bg-opacity-20'
                      }`}
                    >
                      {padding}px
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {/* Modal Footer */}
          <div className="p-4 border-t border-white border-opacity-20 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowTablePaddingModal(false)}
              className="px-4 py-2 bg-white bg-opacity-10 text-white rounded-md hover:bg-opacity-20 transition-colors border border-white border-opacity-20"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleTablePaddingSave}
              className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-md hover:bg-opacity-30 transition-colors border border-white border-opacity-20"
            >
              Save Padding
            </button>
          </div>
        </div>
      </>
    );
  };

  // Table Font Size Editor Modal Component (always rendered)
  const TableFontSizeModal = () => {
    if (!showTableFontSizeModal) return null;
    
    return (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-70"
          onClick={() => setShowTableFontSizeModal(false)}
        />
        {/* Modal positioned near input */}
        <div 
          className="fixed z-50 bg-black border border-white border-opacity-20 rounded-lg shadow-xl w-72 max-h-[60vh] flex flex-col"
          style={{
            top: `${tableFontSizeModalPosition.top}px`,
            left: `${tableFontSizeModalPosition.left}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b border-white border-opacity-20">
            <h3 className="text-lg font-semibold text-white">Edit Table Font Size</h3>
            <button
              type="button"
              onClick={() => setShowTableFontSizeModal(false)}
              className="text-white text-opacity-60 hover:text-white text-2xl font-bold transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          
          {/* Modal Content */}
          <div className="p-4 overflow-y-auto flex-1">
            <p className="text-sm text-white text-opacity-80 mb-4">
              Adjust font size. Use buttons for fine adjustments or type directly.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Font Size:</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTableFontSizeValue(prev => prev ? Math.max(1, prev - 1) : 12)}
                    className="px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white hover:bg-opacity-20 transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    className="flex-1 px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={tableFontSizeValue || ''}
                    onChange={(e) => setTableFontSizeValue(e.target.value ? Math.max(1, parseFloat(e.target.value) || 12) : undefined)}
                  />
                  <button
                    type="button"
                    onClick={() => setTableFontSizeValue(prev => (prev || 12) + 1)}
                    className="px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white hover:bg-opacity-20 transition-colors"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setTableFontSizeValue(prev => prev ? Math.max(1, prev - 2) : 12)}
                    className="px-2 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white text-sm hover:bg-opacity-20 transition-colors"
                  >
                    -2
                  </button>
                  <button
                    type="button"
                    onClick={() => setTableFontSizeValue(prev => (prev || 12) + 2)}
                    className="px-2 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white text-sm hover:bg-opacity-20 transition-colors"
                  >
                    +2
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Quick Presets:</label>
                <div className="flex flex-wrap gap-2">
                  {[8, 10, 12, 14, 16, 18, 20].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setTableFontSizeValue(size)}
                      className={`px-3 py-2 rounded-md text-sm transition-colors ${
                        (tableFontSizeValue ?? 0) === size
                          ? 'bg-white bg-opacity-30 border border-white border-opacity-40 text-white'
                          : 'bg-white bg-opacity-10 border border-white border-opacity-20 text-white hover:bg-opacity-20'
                      }`}
                    >
                      {size}px
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {/* Modal Footer */}
          <div className="p-4 border-t border-white border-opacity-20 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowTableFontSizeModal(false)}
              className="px-4 py-2 bg-white bg-opacity-10 text-white rounded-md hover:bg-opacity-20 transition-colors border border-white border-opacity-20"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleTableFontSizeSave}
              className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-md hover:bg-opacity-30 transition-colors border border-white border-opacity-20"
            >
              Save Font Size
            </button>
          </div>
        </div>
      </>
    );
  };

  // Table Width Editor Modal Component (always rendered)
  const TableWidthModal = () => {
    if (!showTableWidthModal) return null;
    
    return (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-70"
          onClick={() => setShowTableWidthModal(false)}
        />
        {/* Modal positioned near input */}
        <div 
          className="fixed z-50 bg-black border border-white border-opacity-20 rounded-lg shadow-xl w-72 max-h-[60vh] flex flex-col"
          style={{
            top: `${tableWidthModalPosition.top}px`,
            left: `${tableWidthModalPosition.left}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b border-white border-opacity-20">
            <h3 className="text-lg font-semibold text-white">Edit Table Width</h3>
            <button
              type="button"
              onClick={() => setShowTableWidthModal(false)}
              className="text-white text-opacity-60 hover:text-white text-2xl font-bold transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          
          {/* Modal Content */}
          <div className="p-4 overflow-y-auto flex-1">
            <p className="text-sm text-white text-opacity-80 mb-4">
              Adjust table width. Use buttons for fine adjustments or type directly.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Width:</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTableWidthValue(prev => prev ? Math.max(100, prev - 10) : 100)}
                    className="px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white hover:bg-opacity-20 transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="100"
                    className="flex-1 px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={tableWidthValue || ''}
                    onChange={(e) => setTableWidthValue(e.target.value ? Math.max(100, parseFloat(e.target.value) || 100) : undefined)}
                  />
                  <button
                    type="button"
                    onClick={() => setTableWidthValue(prev => (prev || 100) + 10)}
                    className="px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white hover:bg-opacity-20 transition-colors"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setTableWidthValue(prev => prev ? Math.max(100, prev - 50) : 100)}
                    className="px-2 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white text-sm hover:bg-opacity-20 transition-colors"
                  >
                    -50
                  </button>
                  <button
                    type="button"
                    onClick={() => setTableWidthValue(prev => (prev || 100) + 50)}
                    className="px-2 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white text-sm hover:bg-opacity-20 transition-colors"
                  >
                    +50
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Quick Presets:</label>
                <div className="flex flex-wrap gap-2">
                  {[100, 200, 300, 400, 500, 600].map((width) => (
                    <button
                      key={width}
                      type="button"
                      onClick={() => setTableWidthValue(width)}
                      className={`px-3 py-2 rounded-md text-sm transition-colors ${
                        tableWidthValue === width
                          ? 'bg-white bg-opacity-30 border border-white border-opacity-40 text-white'
                          : 'bg-white bg-opacity-10 border border-white border-opacity-20 text-white hover:bg-opacity-20'
                      }`}
                    >
                      {width}px
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {/* Modal Footer */}
          <div className="p-4 border-t border-white border-opacity-20 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowTableWidthModal(false)}
              className="px-4 py-2 bg-white bg-opacity-10 text-white rounded-md hover:bg-opacity-20 transition-colors border border-white border-opacity-20"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleTableWidthSave}
              className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-md hover:bg-opacity-30 transition-colors border border-white border-opacity-20"
            >
              Save Width
            </button>
          </div>
        </div>
      </>
    );
  };

  // Column Binding Editor Modal Component (always rendered)
  const ColumnBindingModal = () => {
    if (!showColumnBindingModal) return null;
    
    const availableFields = getAvailableFields();
    
    return (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-70"
          onClick={() => setShowColumnBindingModal(false)}
        />
        {/* Modal positioned near input */}
        <div 
          className="fixed z-50 bg-black border border-white border-opacity-20 rounded-lg shadow-xl w-96 max-h-[60vh] flex flex-col"
          style={{
            top: `${columnBindingModalPosition.top}px`,
            left: `${columnBindingModalPosition.left}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b border-white border-opacity-20">
            <h3 className="text-lg font-semibold text-white">Edit Column Binding</h3>
            <button
              type="button"
              onClick={() => setShowColumnBindingModal(false)}
              className="text-white text-opacity-60 hover:text-white text-2xl font-bold transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          
          {/* Modal Content */}
          <div className="p-4 overflow-y-auto flex-1">
            <div className="mb-4">
              <label className="block text-sm font-medium text-white mb-2">Binding Path:</label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={columnBindingValue}
                onChange={(e) => setColumnBindingValue(e.target.value)}
                placeholder="e.g., items.rate, header.BillNo"
              />
            </div>
            {(availableFields.header.length > 0 || Object.keys(availableFields.contentDetails).length > 0) && (
              <div>
                <strong className="text-sm text-white block mb-2">Available Fields:</strong>
                {availableFields.header.length > 0 && (
                  <div className="mb-4">
                    <strong className="text-xs text-white text-opacity-80 block mb-2">Header:</strong>
                    <div className="flex flex-wrap gap-2">
                      {availableFields.header.map(fieldName => (
                        <button
                          key={fieldName}
                          type="button"
                          onClick={() => {
                            setColumnBindingValue(fieldName);
                            setShowColumnBindingModal(false);
                            if (columnBindingUpdateCallback) {
                              columnBindingUpdateCallback(fieldName);
                            }
                          }}
                          className="text-sm px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md cursor-pointer text-white hover:bg-opacity-20 hover:border-opacity-30 transition-colors"
                        >
                          {fieldName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {Object.keys(availableFields.contentDetails).map(contentName => {
                  const contentFields = availableFields.contentDetails[contentName];
                  if (!contentFields || !Array.isArray(contentFields)) return null;
                  return (
                    <div key={contentName} className="mb-4">
                      <strong className="text-xs text-white text-opacity-80 block mb-2">contentDetails.{contentName}:</strong>
                      <div className="flex flex-wrap gap-2">
                        {contentFields.map((fieldName: string) => (
                        <button
                          key={fieldName}
                          type="button"
                          onClick={() => {
                            setColumnBindingValue(`contentDetails.${contentName}.${fieldName}`);
                            setShowColumnBindingModal(false);
                            if (columnBindingUpdateCallback) {
                              columnBindingUpdateCallback(`contentDetails.${contentName}.${fieldName}`);
                            }
                          }}
                          className="text-sm px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md cursor-pointer text-white hover:bg-opacity-20 hover:border-opacity-30 transition-colors"
                        >
                          {fieldName}
                        </button>
                      ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Modal Footer */}
          <div className="p-4 border-t border-white border-opacity-20 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowColumnBindingModal(false)}
              className="px-4 py-2 bg-white bg-opacity-10 text-white rounded-md hover:bg-opacity-20 transition-colors border border-white border-opacity-20"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleColumnBindingSave}
              className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-md hover:bg-opacity-30 transition-colors border border-white border-opacity-20"
            >
              Save Binding
            </button>
          </div>
        </div>
      </>
    );
  };

  // Column Width Editor Modal Component (always rendered)
  const ColumnWidthModal = () => {
    if (!showColumnWidthModal) return null;
    
    return (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-70"
          onClick={() => setShowColumnWidthModal(false)}
        />
        {/* Modal positioned near input */}
        <div 
          className="fixed z-50 bg-black border border-white border-opacity-20 rounded-lg shadow-xl w-72 max-h-[60vh] flex flex-col"
          style={{
            top: `${columnWidthModalPosition.top}px`,
            left: `${columnWidthModalPosition.left}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b border-white border-opacity-20">
            <h3 className="text-lg font-semibold text-white">Edit Column Width</h3>
            <button
              type="button"
              onClick={() => setShowColumnWidthModal(false)}
              className="text-white text-opacity-60 hover:text-white text-2xl font-bold transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          
          {/* Modal Content */}
          <div className="p-4 overflow-y-auto flex-1">
            <p className="text-sm text-white text-opacity-80 mb-4">
              Adjust column width. Use buttons for fine adjustments or type directly.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Width:</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setColumnWidthValue(prev => prev ? Math.max(0, prev - 1) : 0)}
                    className="px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white hover:bg-opacity-20 transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="0"
                    className="flex-1 px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={columnWidthValue || ''}
                    onChange={(e) => setColumnWidthValue(e.target.value ? Math.max(0, parseFloat(e.target.value) || 0) : undefined)}
                  />
                  <button
                    type="button"
                    onClick={() => setColumnWidthValue(prev => (prev || 0) + 1)}
                    className="px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white hover:bg-opacity-20 transition-colors"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setColumnWidthValue(prev => prev ? Math.max(0, prev - 10) : 0)}
                    className="px-2 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white text-sm hover:bg-opacity-20 transition-colors"
                  >
                    -10
                  </button>
                  <button
                    type="button"
                    onClick={() => setColumnWidthValue(prev => (prev || 0) + 10)}
                    className="px-2 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white text-sm hover:bg-opacity-20 transition-colors"
                  >
                    +10
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Quick Presets:</label>
                <div className="flex flex-wrap gap-2">
                  {[50, 100, 150, 200, 250, 300].map((width) => (
                    <button
                      key={width}
                      type="button"
                      onClick={() => setColumnWidthValue(width)}
                      className={`px-3 py-2 rounded-md text-sm transition-colors ${
                        columnWidthValue === width
                          ? 'bg-white bg-opacity-30 border border-white border-opacity-40 text-white'
                          : 'bg-white bg-opacity-10 border border-white border-opacity-20 text-white hover:bg-opacity-20'
                      }`}
                    >
                      {width}px
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {/* Modal Footer */}
          <div className="p-4 border-t border-white border-opacity-20 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowColumnWidthModal(false)}
              className="px-4 py-2 bg-white bg-opacity-10 text-white rounded-md hover:bg-opacity-20 transition-colors border border-white border-opacity-20"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleColumnWidthSave}
              className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-md hover:bg-opacity-30 transition-colors border border-white border-opacity-20"
            >
              Save Width
            </button>
          </div>
        </div>
      </>
    );
  };

  // Column Height Editor Modal Component (always rendered)
  const ColumnHeightModal = () => {
    if (!showColumnHeightModal) return null;
    
    return (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-70"
          onClick={() => setShowColumnHeightModal(false)}
        />
        {/* Modal positioned near input */}
        <div 
          className="fixed z-50 bg-black border border-white border-opacity-20 rounded-lg shadow-xl w-72 max-h-[60vh] flex flex-col"
          style={{
            top: `${columnHeightModalPosition.top}px`,
            left: `${columnHeightModalPosition.left}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b border-white border-opacity-20">
            <h3 className="text-lg font-semibold text-white">Edit Column Height</h3>
            <button
              type="button"
              onClick={() => setShowColumnHeightModal(false)}
              className="text-white text-opacity-60 hover:text-white text-2xl font-bold transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          
          {/* Modal Content */}
          <div className="p-4 overflow-y-auto flex-1">
            <p className="text-sm text-white text-opacity-80 mb-4">
              Adjust column height. Use buttons for fine adjustments or type directly.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Height:</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setColumnHeightValue(prev => prev ? Math.max(0, prev - 1) : 0)}
                    className="px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white hover:bg-opacity-20 transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="0"
                    className="flex-1 px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={columnHeightValue || ''}
                    onChange={(e) => setColumnHeightValue(e.target.value ? Math.max(0, parseFloat(e.target.value) || 0) : undefined)}
                  />
                  <button
                    type="button"
                    onClick={() => setColumnHeightValue(prev => (prev || 0) + 1)}
                    className="px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white hover:bg-opacity-20 transition-colors"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setColumnHeightValue(prev => prev ? Math.max(0, prev - 10) : 0)}
                    className="px-2 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white text-sm hover:bg-opacity-20 transition-colors"
                  >
                    -10
                  </button>
                  <button
                    type="button"
                    onClick={() => setColumnHeightValue(prev => (prev || 0) + 10)}
                    className="px-2 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white text-sm hover:bg-opacity-20 transition-colors"
                  >
                    +10
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Quick Presets:</label>
                <div className="flex flex-wrap gap-2">
                  {[20, 30, 40, 50, 60, 80].map((height) => (
                    <button
                      key={height}
                      type="button"
                      onClick={() => setColumnHeightValue(height)}
                      className={`px-3 py-2 rounded-md text-sm transition-colors ${
                        columnHeightValue === height
                          ? 'bg-white bg-opacity-30 border border-white border-opacity-40 text-white'
                          : 'bg-white bg-opacity-10 border border-white border-opacity-20 text-white hover:bg-opacity-20'
                      }`}
                    >
                      {height}px
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {/* Modal Footer */}
          <div className="p-4 border-t border-white border-opacity-20 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowColumnHeightModal(false)}
              className="px-4 py-2 bg-white bg-opacity-10 text-white rounded-md hover:bg-opacity-20 transition-colors border border-white border-opacity-20"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleColumnHeightSave}
              className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-md hover:bg-opacity-30 transition-colors border border-white border-opacity-20"
            >
              Save Height
            </button>
          </div>
        </div>
      </>
    );
  };

  // Column Row Span Editor Modal Component (always rendered)
  const ColumnRowSpanModal = () => {
    if (!showColumnRowSpanModal) return null;
    
    return (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-70"
          onClick={() => setShowColumnRowSpanModal(false)}
        />
        {/* Modal positioned near input */}
        <div 
          className="fixed z-50 bg-black border border-white border-opacity-20 rounded-lg shadow-xl w-72 max-h-[60vh] flex flex-col"
          style={{
            top: `${columnRowSpanModalPosition.top}px`,
            left: `${columnRowSpanModalPosition.left}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b border-white border-opacity-20">
            <h3 className="text-lg font-semibold text-white">Edit Row Span</h3>
            <button
              type="button"
              onClick={() => setShowColumnRowSpanModal(false)}
              className="text-white text-opacity-60 hover:text-white text-2xl font-bold transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          
          {/* Modal Content */}
          <div className="p-4 overflow-y-auto flex-1">
            <p className="text-sm text-white text-opacity-80 mb-4">
              Adjust row span. Use buttons for fine adjustments or type directly.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Row Span:</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setColumnRowSpanValue(prev => prev ? Math.max(1, prev - 1) : 1)}
                    className="px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white hover:bg-opacity-20 transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    className="flex-1 px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={columnRowSpanValue || 1}
                    onChange={(e) => setColumnRowSpanValue(e.target.value ? Math.max(1, parseInt(e.target.value) || 1) : undefined)}
                  />
                  <button
                    type="button"
                    onClick={() => setColumnRowSpanValue(prev => (prev || 1) + 1)}
                    className="px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white hover:bg-opacity-20 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Quick Presets:</label>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((span) => (
                    <button
                      key={span}
                      type="button"
                      onClick={() => setColumnRowSpanValue(span)}
                      className={`px-3 py-2 rounded-md text-sm transition-colors ${
                        columnRowSpanValue === span
                          ? 'bg-white bg-opacity-30 border border-white border-opacity-40 text-white'
                          : 'bg-white bg-opacity-10 border border-white border-opacity-20 text-white hover:bg-opacity-20'
                      }`}
                    >
                      {span}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {/* Modal Footer */}
          <div className="p-4 border-t border-white border-opacity-20 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowColumnRowSpanModal(false)}
              className="px-4 py-2 bg-white bg-opacity-10 text-white rounded-md hover:bg-opacity-20 transition-colors border border-white border-opacity-20"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleColumnRowSpanSave}
              className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-md hover:bg-opacity-30 transition-colors border border-white border-opacity-20"
            >
              Save Row Span
            </button>
          </div>
        </div>
      </>
    );
  };

  // Column Col Span Editor Modal Component (always rendered)
  const ColumnColSpanModal = () => {
    if (!showColumnColSpanModal) return null;
    
    return (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-70"
          onClick={() => setShowColumnColSpanModal(false)}
        />
        {/* Modal positioned near input */}
        <div 
          className="fixed z-50 bg-black border border-white border-opacity-20 rounded-lg shadow-xl w-72 max-h-[60vh] flex flex-col"
          style={{
            top: `${columnColSpanModalPosition.top}px`,
            left: `${columnColSpanModalPosition.left}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b border-white border-opacity-20">
            <h3 className="text-lg font-semibold text-white">Edit Column Span</h3>
            <button
              type="button"
              onClick={() => setShowColumnColSpanModal(false)}
              className="text-white text-opacity-60 hover:text-white text-2xl font-bold transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          
          {/* Modal Content */}
          <div className="p-4 overflow-y-auto flex-1">
            <p className="text-sm text-white text-opacity-80 mb-4">
              Adjust column span. Use buttons for fine adjustments or type directly.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Column Span:</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setColumnColSpanValue(prev => prev ? Math.max(1, prev - 1) : 1)}
                    className="px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white hover:bg-opacity-20 transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    className="flex-1 px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={columnColSpanValue || 1}
                    onChange={(e) => setColumnColSpanValue(e.target.value ? Math.max(1, parseInt(e.target.value) || 1) : undefined)}
                  />
                  <button
                    type="button"
                    onClick={() => setColumnColSpanValue(prev => (prev || 1) + 1)}
                    className="px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white hover:bg-opacity-20 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Quick Presets:</label>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((span) => (
                    <button
                      key={span}
                      type="button"
                      onClick={() => setColumnColSpanValue(span)}
                      className={`px-3 py-2 rounded-md text-sm transition-colors ${
                        columnColSpanValue === span
                          ? 'bg-white bg-opacity-30 border border-white border-opacity-40 text-white'
                          : 'bg-white bg-opacity-10 border border-white border-opacity-20 text-white hover:bg-opacity-20'
                      }`}
                    >
                      {span}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {/* Modal Footer */}
          <div className="p-4 border-t border-white border-opacity-20 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowColumnColSpanModal(false)}
              className="px-4 py-2 bg-white bg-opacity-10 text-white rounded-md hover:bg-opacity-20 transition-colors border border-white border-opacity-20"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleColumnColSpanSave}
              className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-md hover:bg-opacity-30 transition-colors border border-white border-opacity-20"
            >
              Save Column Span
            </button>
          </div>
        </div>
      </>
    );
  };

  // Column Calculation Editor Modal Component (always rendered)
  const ColumnCalculationModal = () => {
    if (!showColumnCalculationModal) return null;
    
    const availableSources = getAvailableDataSources();
    const selectedSource = availableSources.find(s => s.path === columnCalculationSource);
    const availableFieldsForSource = selectedSource?.fields || [];
    
    return (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-70"
          onClick={() => setShowColumnCalculationModal(false)}
        />
        {/* Modal positioned near input */}
        <div 
          className="fixed z-50 bg-black border border-white border-opacity-20 rounded-lg shadow-xl w-[500px] max-h-[75vh] flex flex-col"
          style={{
            top: `${columnCalculationModalPosition.top}px`,
            left: `${columnCalculationModalPosition.left}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b border-white border-opacity-20">
            <h3 className="text-lg font-semibold text-white">Edit Data Manipulation</h3>
            <button
              type="button"
              onClick={() => setShowColumnCalculationModal(false)}
              className="text-white text-opacity-60 hover:text-white text-2xl font-bold transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          
          {/* Modal Content */}
          <div className="p-4 overflow-y-auto flex-1">
            <p className="text-sm text-white text-opacity-80 mb-4">
              Select calculation type and choose data from available sources.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Calculation Type:</label>
                <select
                  className="w-full px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={columnCalculationValue}
                  onChange={(e) => {
                    setColumnCalculationValue(e.target.value);
                    // Clear fields when changing calculation type
                    if (e.target.value === 'none' || e.target.value === 'custom') {
                      setColumnCalculationSource('');
                      setColumnCalculationField('');
                    }
                  }}
                >
                  <option value="none" className="bg-black">None</option>
                  <option value="sum" className="bg-black">Sum</option>
                  <option value="avg" className="bg-black">Average</option>
                  <option value="count" className="bg-black">Count</option>
                  <option value="min" className="bg-black">Min</option>
                  <option value="max" className="bg-black">Max</option>
                  <option value="custom" className="bg-black">Custom Formula</option>
                </select>
                {columnCalculationValue !== 'none' && columnCalculationValue !== 'custom' && (
                  <p className="text-xs text-white text-opacity-60 mt-1">
                    {columnCalculationValue === 'sum' && 'Add all values together'}
                    {columnCalculationValue === 'avg' && 'Calculate the average value'}
                    {columnCalculationValue === 'count' && 'Count the number of items'}
                    {columnCalculationValue === 'min' && 'Find the smallest value'}
                    {columnCalculationValue === 'max' && 'Find the largest value'}
                  </p>
                )}
              </div>
              {columnCalculationValue !== 'none' && columnCalculationValue !== 'custom' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Select Data Source:</label>
                    {availableSources.length > 0 ? (
                      <select
                        className="w-full px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={columnCalculationSource}
                        onChange={(e) => {
                          setColumnCalculationSource(e.target.value);
                          // Clear field when changing source
                          setColumnCalculationField('');
                        }}
                      >
                        <option value="" className="bg-black">-- Select a data source --</option>
                        {availableSources.map(source => (
                          <option key={source.path} value={source.path} className="bg-black">
                            {source.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="w-full px-3 py-2 bg-white bg-opacity-5 border border-white border-opacity-10 rounded-md text-white text-opacity-60">
                        <p className="text-sm">No data sources available. Please ensure sample data is loaded.</p>
                        <input
                          type="text"
                          className="w-full mt-2 px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-white placeholder-opacity-50"
                          value={columnCalculationSource}
                          onChange={(e) => setColumnCalculationSource(e.target.value)}
                          placeholder="Enter source path manually (e.g., items, contentDetails.items)"
                        />
                      </div>
                    )}
                    {columnCalculationSource && (
                      <p className="text-xs text-white text-opacity-60 mt-1">
                        Selected: <code className="bg-white bg-opacity-10 px-1 rounded">{columnCalculationSource}</code>
                      </p>
                    )}
                  </div>
                  {columnCalculationSource && (
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">Select Field to Calculate:</label>
                      {availableFieldsForSource.length > 0 ? (
                        <>
                          <select
                            className="w-full px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={columnCalculationField}
                            onChange={(e) => setColumnCalculationField(e.target.value)}
                          >
                            <option value="" className="bg-black">-- Select a field --</option>
                            {availableFieldsForSource.map(field => (
                              <option key={field} value={field} className="bg-black">
                                {field}
                              </option>
                            ))}
                          </select>
                          <div className="mt-2 p-2 bg-white bg-opacity-5 rounded-md">
                            <p className="text-xs text-white text-opacity-70 mb-1">Available fields:</p>
                            <div className="flex flex-wrap gap-1">
                              {availableFieldsForSource.map(field => (
                                <button
                                  key={field}
                                  type="button"
                                  onClick={() => setColumnCalculationField(field)}
                                  className={`text-xs px-2 py-1 rounded transition-colors ${
                                    columnCalculationField === field
                                      ? 'bg-white bg-opacity-30 border border-white border-opacity-40 text-white'
                                      : 'bg-white bg-opacity-10 border border-white border-opacity-20 text-white hover:bg-opacity-20'
                                  }`}
                                >
                                  {field}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : (
                        <input
                          type="text"
                          className="w-full px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-white placeholder-opacity-50"
                          value={columnCalculationField}
                          onChange={(e) => setColumnCalculationField(e.target.value)}
                          placeholder="Enter field name manually (e.g., rate, price)"
                        />
                      )}
                      {columnCalculationField && (
                        <p className="text-xs text-white text-opacity-60 mt-1">
                          Will calculate <strong>{columnCalculationValue}</strong> of <code className="bg-white bg-opacity-10 px-1 rounded">{columnCalculationField}</code> from <code className="bg-white bg-opacity-10 px-1 rounded">{columnCalculationSource}</code>
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
              {columnCalculationValue === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Custom Formula:</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-white placeholder-opacity-50 font-mono text-sm"
                    value={columnCalculationFormula}
                    onChange={(e) => setColumnCalculationFormula(e.target.value)}
                    placeholder="e.g., sum(items.rate) * header.exchangeRate"
                  />
                  <p className="text-xs text-white text-opacity-60 mt-1">
                    For advanced users only. Use field paths like <code className="bg-white bg-opacity-10 px-1 rounded">items.rate</code> or <code className="bg-white bg-opacity-10 px-1 rounded">header.exchangeRate</code>
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Modal Footer */}
          <div className="p-4 border-t border-white border-opacity-20 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowColumnCalculationModal(false)}
              className="px-4 py-2 bg-white bg-opacity-10 text-white rounded-md hover:bg-opacity-20 transition-colors border border-white border-opacity-20"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleColumnCalculationSave}
              className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-md hover:bg-opacity-30 transition-colors border border-white border-opacity-20"
            >
              Save Calculation
            </button>
          </div>
        </div>
      </>
    );
  };

  // Final Row Cell Col Span Editor Modal Component (always rendered)
  const FinalRowColSpanModal = () => {
    if (!showFinalRowColSpanModal) return null;
    
    return (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-70"
          onClick={() => setShowFinalRowColSpanModal(false)}
        />
        {/* Modal positioned near input */}
        <div 
          className="fixed z-50 bg-black border border-white border-opacity-20 rounded-lg shadow-xl w-72 max-h-[60vh] flex flex-col"
          style={{
            top: `${finalRowColSpanModalPosition.top}px`,
            left: `${finalRowColSpanModalPosition.left}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b border-white border-opacity-20">
            <h3 className="text-lg font-semibold text-white">Edit Column Span</h3>
            <button
              type="button"
              onClick={() => setShowFinalRowColSpanModal(false)}
              className="text-white text-opacity-60 hover:text-white text-2xl font-bold transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          
          {/* Modal Content */}
          <div className="p-4 overflow-y-auto flex-1">
            <p className="text-sm text-white text-opacity-80 mb-4">
              Adjust column span. Use buttons for fine adjustments or type directly.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Column Span:</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFinalRowColSpanValue(prev => prev ? Math.max(1, prev - 1) : 1)}
                    className="px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white hover:bg-opacity-20 transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    className="flex-1 px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={finalRowColSpanValue || 1}
                    onChange={(e) => setFinalRowColSpanValue(e.target.value ? Math.max(1, parseInt(e.target.value) || 1) : undefined)}
                  />
                  <button
                    type="button"
                    onClick={() => setFinalRowColSpanValue(prev => (prev || 1) + 1)}
                    className="px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white hover:bg-opacity-20 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Quick Presets:</label>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((span) => (
                    <button
                      key={span}
                      type="button"
                      onClick={() => setFinalRowColSpanValue(span)}
                      className={`px-3 py-2 rounded-md text-sm transition-colors ${
                        finalRowColSpanValue === span
                          ? 'bg-white bg-opacity-30 border border-white border-opacity-40 text-white'
                          : 'bg-white bg-opacity-10 border border-white border-opacity-20 text-white hover:bg-opacity-20'
                      }`}
                    >
                      {span}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {/* Modal Footer */}
          <div className="p-4 border-t border-white border-opacity-20 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowFinalRowColSpanModal(false)}
              className="px-4 py-2 bg-white bg-opacity-10 text-white rounded-md hover:bg-opacity-20 transition-colors border border-white border-opacity-20"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleFinalRowColSpanSave}
              className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-md hover:bg-opacity-30 transition-colors border border-white border-opacity-20"
            >
              Save Column Span
            </button>
          </div>
        </div>
      </>
    );
  };

  // Final Row Cell Calculation Source Editor Modal Component (always rendered)
  const FinalRowCalculationSourceModal = () => {
    if (!showFinalRowCalculationSourceModal) return null;
    
    const availableSources = getAvailableDataSources();
    
    return (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-70"
          onClick={() => setShowFinalRowCalculationSourceModal(false)}
        />
        {/* Modal positioned near input */}
        <div 
          className="fixed z-50 bg-black border border-white border-opacity-20 rounded-lg shadow-xl w-[500px] max-h-[70vh] flex flex-col"
          style={{
            top: `${finalRowCalculationSourceModalPosition.top}px`,
            left: `${finalRowCalculationSourceModalPosition.left}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b border-white border-opacity-20">
            <h3 className="text-lg font-semibold text-white">Select Data Source</h3>
            <button
              type="button"
              onClick={() => setShowFinalRowCalculationSourceModal(false)}
              className="text-white text-opacity-60 hover:text-white text-2xl font-bold transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          
          {/* Modal Content */}
          <div className="p-4 overflow-y-auto flex-1">
            <p className="text-sm text-white text-opacity-80 mb-4">
              Select the data source (table/array) to use for calculation.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Data Source:</label>
                {availableSources.length > 0 ? (
                  <select
                    className="w-full px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={finalRowCalculationSourceValue}
                    onChange={(e) => setFinalRowCalculationSourceValue(e.target.value)}
                  >
                    <option value="" className="bg-black">-- Select a data source --</option>
                    {availableSources.map(source => (
                      <option key={source.path} value={source.path} className="bg-black">
                        {source.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-white placeholder-opacity-50"
                    value={finalRowCalculationSourceValue}
                    onChange={(e) => setFinalRowCalculationSourceValue(e.target.value)}
                    placeholder="Enter source path manually (e.g., items, contentDetails.items)"
                  />
                )}
                {finalRowCalculationSourceValue && (
                  <p className="text-xs text-white text-opacity-60 mt-1">
                    Selected: <code className="bg-white bg-opacity-10 px-1 rounded">{finalRowCalculationSourceValue}</code>
                  </p>
                )}
              </div>
              {availableSources.length > 0 && (
                <div>
                  <strong className="text-sm text-white block mb-2">Available Sources:</strong>
                  <div className="flex flex-wrap gap-2">
                    {availableSources.map(source => (
                      <button
                        key={source.path}
                        type="button"
                        onClick={() => {
                          setFinalRowCalculationSourceValue(source.path);
                          setShowFinalRowCalculationSourceModal(false);
                          if (finalRowCalculationSourceUpdateCallback) {
                            finalRowCalculationSourceUpdateCallback(source.path);
                          }
                        }}
                        className={`text-sm px-3 py-2 rounded-md transition-colors ${
                          finalRowCalculationSourceValue === source.path
                            ? 'bg-white bg-opacity-30 border border-white border-opacity-40 text-white'
                            : 'bg-white bg-opacity-10 border border-white border-opacity-20 text-white hover:bg-opacity-20'
                        }`}
                      >
                        {source.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Modal Footer */}
          <div className="p-4 border-t border-white border-opacity-20 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowFinalRowCalculationSourceModal(false)}
              className="px-4 py-2 bg-white bg-opacity-10 text-white rounded-md hover:bg-opacity-20 transition-colors border border-white border-opacity-20"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleFinalRowCalculationSourceSave}
              className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-md hover:bg-opacity-30 transition-colors border border-white border-opacity-20"
            >
              Save Source
            </button>
          </div>
        </div>
      </>
    );
  };

  // Final Row Cell Calculation Field Editor Modal Component (always rendered)
  const FinalRowCalculationFieldModal = () => {
    if (!showFinalRowCalculationFieldModal) return null;
    
    const availableSources = getAvailableDataSources();
    const selectedSource = availableSources.find(s => s.path === finalRowCalculationSourceForField);
    const availableFieldsForSource = selectedSource?.fields || [];
    
    return (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-70"
          onClick={() => setShowFinalRowCalculationFieldModal(false)}
        />
        {/* Modal positioned near input */}
        <div 
          className="fixed z-50 bg-black border border-white border-opacity-20 rounded-lg shadow-xl w-96 max-h-[70vh] flex flex-col"
          style={{
            top: `${finalRowCalculationFieldModalPosition.top}px`,
            left: `${finalRowCalculationFieldModalPosition.left}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b border-white border-opacity-20">
            <h3 className="text-lg font-semibold text-white">Select Field</h3>
            <button
              type="button"
              onClick={() => setShowFinalRowCalculationFieldModal(false)}
              className="text-white text-opacity-60 hover:text-white text-2xl font-bold transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          
          {/* Modal Content */}
          <div className="p-4 overflow-y-auto flex-1">
            <p className="text-sm text-white text-opacity-80 mb-4">
              Select the field to calculate from {finalRowCalculationSourceForField || 'selected source'}.
            </p>
            <div className="space-y-4">
              {finalRowCalculationSourceForField && availableFieldsForSource.length > 0 ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Field:</label>
                    <select
                      className="w-full px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={finalRowCalculationFieldValue}
                      onChange={(e) => setFinalRowCalculationFieldValue(e.target.value)}
                    >
                      <option value="" className="bg-black">-- Select a field --</option>
                      {availableFieldsForSource.map(field => (
                        <option key={field} value={field} className="bg-black">
                          {field}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="p-2 bg-white bg-opacity-5 rounded-md">
                    <p className="text-xs text-white text-opacity-70 mb-2">Available fields:</p>
                    <div className="flex flex-wrap gap-2">
                      {availableFieldsForSource.map(field => (
                        <button
                          key={field}
                          type="button"
                          onClick={() => {
                            setFinalRowCalculationFieldValue(field);
                            setShowFinalRowCalculationFieldModal(false);
                            if (finalRowCalculationFieldUpdateCallback) {
                              finalRowCalculationFieldUpdateCallback(field);
                            }
                          }}
                          className={`text-xs px-2 py-1 rounded transition-colors ${
                            finalRowCalculationFieldValue === field
                              ? 'bg-white bg-opacity-30 border border-white border-opacity-40 text-white'
                              : 'bg-white bg-opacity-10 border border-white border-opacity-20 text-white hover:bg-opacity-20'
                          }`}
                        >
                          {field}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Field:</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-white placeholder-opacity-50"
                    value={finalRowCalculationFieldValue}
                    onChange={(e) => setFinalRowCalculationFieldValue(e.target.value)}
                    placeholder="Enter field name manually (e.g., rate, price)"
                  />
                  {!finalRowCalculationSourceForField && (
                    <p className="text-xs text-white text-opacity-60 mt-1">
                      Please select a data source first to see available fields.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Modal Footer */}
          <div className="p-4 border-t border-white border-opacity-20 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowFinalRowCalculationFieldModal(false)}
              className="px-4 py-2 bg-white bg-opacity-10 text-white rounded-md hover:bg-opacity-20 transition-colors border border-white border-opacity-20"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleFinalRowCalculationFieldSave}
              className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-md hover:bg-opacity-30 transition-colors border border-white border-opacity-20"
            >
              Save Field
            </button>
          </div>
        </div>
      </>
    );
  };

  if (!selectedElement) {
    return (
      <>
      <div className="property-panel">
        {onUpdatePage && (
          <div className="property-group">
            <h4>Page Layout</h4>
            <label>
              Size:
              <select
                value={template.page.size}
                onChange={(e) => onUpdatePage({ size: e.target.value })}
              >
                <option value="A4">A4</option>
                <option value="Letter">Letter</option>
                <option value="Legal">Legal</option>
              </select>
            </label>
            <label>
              Orientation:
              <select
                value={template.page.orientation}
                onChange={(e) => onUpdatePage({ orientation: e.target.value as 'portrait' | 'landscape' })}
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </label>
          </div>
        )}
        {onOpenZoneConfig && (
          <div className="property-group">
            <h4>Zone Configuration</h4>
            <button
  className="zone-config-button"
  onClick={onOpenZoneConfig}
  style={{
    width: '100%',
    padding: '0.75rem 1.5rem',
    background: 'linear-gradient(135deg, #111 0%, #333 100%)',
    color: 'white',
    border: '1px solid #222',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: 600,
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = 'translateY(-2px)';
    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = 'translateY(0)';
    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.25)';
  }}
>
  <Target
    size={16}
    style={{
      display: 'inline-block',
      marginRight: '0.5rem',
      verticalAlign: 'middle',
      color: 'white',
    }}
  />
  Configure Zones
</button>

<small
  style={{
    display: 'block',
    marginTop: '0.5rem',
    color: '#6b7280',
    fontSize: '0.8rem',
  }}
>
  Position and size zones (headers, footers, content areas)
</small>

          </div>
        )}
        <div className="no-selection-container">
          <p className="no-selection">Select an element to edit properties</p>
        </div>
        <ActionBar />
      </div>
        <PositionModal />
        <WidthModal />
        <FontSizeModal />
      </>
    );
  }

  if (selectedElement.type === 'image' && onUpdateImage) {
    const image = getImageForSelected();
    if (!image) return null;
    const section = selectedElement.section || 'header';

    return (
      <>
      <div className="property-panel">
        <div className="property-group">
          <h4>Info</h4>
          <label>
            Section: <strong>{section === 'pageHeader' ? 'Page Header' : section === 'pageFooter' ? 'Page Footer' : section === 'billFooter' ? 'Bill Footer' : section === 'billContent' ? 'Bill Content' : 'Bill Header'}</strong>
          </label>
        </div>
        <div className="property-group">
          <h4>Position</h4>
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="block text-sm font-medium mb-1">X:</span>
              <div className="relative">
            <input
                  ref={positionXInputRef}
              type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
              value={image.x}
              onChange={(e) => onUpdateImage(selectedElement.index, { x: parseFloat(e.target.value) || 0 }, section)}
            />
                <button
                  type="button"
                  onClick={() => openPositionModal(image.x, image.y, (x, y) => {
                    onUpdateImage(selectedElement.index, { x, y }, section);
                  }, positionXInputRef)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  title="Open position editor"
                >
                  <Move className="h-4 w-4" />
                </button>
              </div>
          </label>
            <label className="flex-1">
              <span className="block text-sm font-medium mb-1">Y:</span>
              <div className="relative">
            <input
                  ref={positionYInputRef}
              type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
              value={image.y}
              onChange={(e) => onUpdateImage(selectedElement.index, { y: parseFloat(e.target.value) || 0 }, section)}
            />
                <button
                  type="button"
                  onClick={() => openPositionModal(image.x, image.y, (x, y) => {
                    onUpdateImage(selectedElement.index, { x, y }, section);
                  }, positionYInputRef)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  title="Open position editor"
                >
                  <Move className="h-4 w-4" />
                </button>
              </div>
          </label>
          </div>
        </div>
        <div className="property-group">
          <h4>Size</h4>
          <label>
            Width:
            <input
              type="number"
              value={image.width || ''}
              onChange={(e) => onUpdateImage(selectedElement.index, { width: e.target.value ? parseFloat(e.target.value) : undefined }, section)}
              placeholder="Auto"
            />
          </label>
          <label>
            Height:
            <input
              type="number"
              value={image.height || ''}
              onChange={(e) => onUpdateImage(selectedElement.index, { height: e.target.value ? parseFloat(e.target.value) : undefined }, section)}
              placeholder="Auto"
            />
          </label>
        </div>
        <div className="property-group">
          <h4>Options</h4>
          <label>
            <input
              type="checkbox"
              checked={image.visible}
              onChange={(e) => onUpdateImage(selectedElement.index, { visible: e.target.checked }, section)}
            />
            Visible
          </label>
          {section === 'billContent' && (
            <label>
              <input
                type="checkbox"
                checked={image.watermark || false}
                onChange={(e) => onUpdateImage(selectedElement.index, { watermark: e.target.checked }, section)}
              />
              Watermark (render behind content with opacity)
            </label>
          )}
        </div>
        <ActionBar />
      </div>
        <PositionModal />
        <WidthModal />
        <FontSizeModal />
      </>
    );
  }

  if (selectedElement.type === 'field') {
    const field = getFieldForSelected();
    if (!field) return null;
    const section = selectedElement.section || 'header';
    const isPageSection = section === 'pageHeader' || section === 'pageFooter';
    const hasBind = field.bind && field.bind.trim() !== '';
    const bindValidation = validateBindPath(field.bind || '');
    const availableFields = getAvailableFields();

    return (
      <>
      <div className="property-panel">
        <div className="property-group">
          <h4>Info</h4>
            <label className="block">
              <span className="text-sm font-medium">Section: </span>
              <strong className="text-sm">{section === 'pageHeader' ? 'Page Header' : section === 'pageFooter' ? 'Page Footer' : section === 'billFooter' ? 'Bill Footer' : section === 'billContent' ? 'Bill Content' : 'Bill Header'}</strong>
          </label>
        </div>
        <div className="property-group">
          <h4>Field</h4>
          <label className="block mb-2">
            <span className="block text-sm font-medium mb-1">Type:</span>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={field.fieldType || 'text'}
              onChange={(e) => {
                const newFieldType = e.target.value === 'text' ? undefined : e.target.value as any;
                // If setting to static type, clear bind; if setting to text and has bind, keep bind
                const updates: Partial<TextFieldConfig> = { fieldType: newFieldType };
                if (newFieldType && newFieldType !== 'text') {
                  updates.bind = ''; // Clear bind for static types
                }
                onUpdateField(selectedElement.index, updates, section);
              }}
            >
              <option value="text">Text</option>
              {/* Hide static-only options when field has bind */}
              {!hasBind && isPageSection && (
                <>
                  <option value="pageNumber">Page #</option>
                  <option value="totalPages">Total Pages</option>
                </>
              )}
              {!hasBind && (
                <>
              <option value="currentDate">Date</option>
              <option value="currentTime">Time</option>
                </>
              )}
            </select>
          </label>
          <label className="block mb-2">
            <span className="block text-sm font-medium mb-1">Label:</span>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={field.label}
              onChange={(e) => onUpdateField(selectedElement.index, { label: e.target.value }, section)}
            />
          </label>
          {/* Always show binding for text fields (fieldType === 'text' or undefined) */}
          {(field.fieldType === 'text' || !field.fieldType) && (
            <label className="block mb-2">
              <span className="block text-sm font-medium mb-1">Data Binding:</span>
              <input
                ref={dataBindingInputRef}
                type="text"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  bindValidation.valid ? 'border-gray-300' : 'border-red-500'
                }`}
                value={field.bind || ''}
                onChange={(e) => onUpdateField(selectedElement.index, { bind: e.target.value }, section)}
                placeholder="header.Field or contentDetails.name.field"
              />
              {!bindValidation.valid && bindValidation.error && (
                <div className="mt-1 text-xs text-red-600 p-1 bg-yellow-100 rounded">
                  ⚠ {bindValidation.error}
                </div>
              )}
              {bindValidation.valid && field.bind && field.bind.trim() && (
                <div className="mt-1 text-xs text-green-600 p-1 bg-green-50 rounded">
                  ✓ Binding valid
                </div>
              )}
              {(availableFields.header.length > 0 || Object.keys(availableFields.contentDetails).length > 0) && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (dataBindingInputRef.current) {
                        const rect = dataBindingInputRef.current.getBoundingClientRect();
                        const viewportWidth = window.innerWidth;
                        const viewportHeight = window.innerHeight;
                        const modalWidth = 384; // w-96 = 384px
                        const modalHeight = Math.min(480, viewportHeight * 0.6); // max-h-[60vh]
                        
                        // Calculate position: below the input field
                        let top = rect.bottom + 8;
                        let left = rect.left;
                        
                        // Adjust if modal would go off right edge
                        if (left + modalWidth > viewportWidth) {
                          left = viewportWidth - modalWidth - 16; // 16px padding from edge
                        }
                        
                        // Adjust if modal would go off left edge
                        if (left < 16) {
                          left = 16;
                        }
                        
                        // Adjust if modal would go off bottom edge
                        if (top + modalHeight > viewportHeight) {
                          // Position above input instead
                          top = rect.top - modalHeight - 8;
                          // If still off screen, position at top
                          if (top < 16) {
                            top = 16;
                          }
                        }
                        
                        setModalPosition({ top, left });
                      }
                      setShowFieldsModal(true);
                    }}
                    className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer underline"
                  >
                    Available Fields
                  </button>
                  
                  {/* Available Fields Modal */}
                  {showFieldsModal && (
                    <>
                      {/* Backdrop */}
                      <div 
                        className="fixed inset-0 z-50 bg-black bg-opacity-70"
                        onClick={() => setShowFieldsModal(false)}
                      />
                      {/* Modal positioned near input */}
                      <div 
                        className="fixed z-50 bg-black border border-white border-opacity-20 rounded-lg shadow-xl w-96 max-h-[60vh] flex flex-col"
                        style={{
                          top: `${modalPosition.top}px`,
                          left: `${modalPosition.left}px`,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white border-opacity-20">
                          <h3 className="text-lg font-semibold text-white">Available Fields</h3>
                          <button
                            type="button"
                            onClick={() => setShowFieldsModal(false)}
                            className="text-white text-opacity-60 hover:text-white text-2xl font-bold transition-colors"
                            aria-label="Close"
                          >
                            ×
                          </button>
                        </div>
                        
                        {/* Modal Content */}
                        <div className="p-4 overflow-y-auto flex-1">
                          {availableFields.header.length > 0 && (
                            <div className="mb-4">
                              <strong className="text-sm text-white block mb-2">Header:</strong>
                              <div className="flex flex-wrap gap-2">
                                {availableFields.header.map(fieldName => (
                                  <button
                                    key={fieldName}
                                    type="button"
                                    onClick={() => {
                                      onUpdateField(selectedElement.index, { bind: fieldName }, section);
                                      setShowFieldsModal(false);
                                    }}
                                    className="text-sm px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md cursor-pointer text-white hover:bg-opacity-20 hover:border-opacity-30 transition-colors"
                                    title={`Click to bind to ${fieldName}`}
                                  >
                                    {fieldName}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {Object.keys(availableFields.contentDetails).length > 0 && (
                            <div>
                              <strong className="text-sm text-white block mb-2">Content Details:</strong>
                              {Object.keys(availableFields.contentDetails).map(contentName => (
                                <div key={contentName} className="mb-4">
                                  <div className="text-sm font-medium text-white text-opacity-80 mb-2">
                                    {contentName}:
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {availableFields.contentDetails[contentName].map(fieldName => (
                                      <button
                                        key={fieldName}
                                        type="button"
                                        onClick={() => {
                                          onUpdateField(selectedElement.index, { bind: `contentDetails.${contentName}.${fieldName}` }, section);
                                          setShowFieldsModal(false);
                                        }}
                                        className="text-sm px-3 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md cursor-pointer text-white hover:bg-opacity-20 hover:border-opacity-30 transition-colors"
                                        title={`Click to bind to contentDetails.${contentName}.${fieldName}`}
                                      >
                                        {fieldName}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {/* Modal Footer */}
                        <div className="p-4 border-t border-white border-opacity-20 flex justify-end">
                          <button
                            type="button"
                            onClick={() => setShowFieldsModal(false)}
                            className="px-4 py-2 bg-white bg-opacity-10 text-white rounded-md hover:bg-opacity-20 transition-colors border border-white border-opacity-20"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
              <div className="mt-1 text-xs text-gray-500 italic">
                {/* Format: header.FieldName, contentDetails.name.field */}
              </div>
            </label>
          )}
          {/* Show static value input for non-bound fields or when bind is empty */}
          {(!field.bind || field.bind.trim() === '' || field.fieldType !== 'text') && (
            <label className="block mb-2">
              <span className="block text-sm font-medium mb-1">Static Value:</span>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={field.value || ''}
                onChange={(e) => onUpdateField(selectedElement.index, { value: e.target.value }, section)}
                placeholder="Enter static text value"
              />
              <div className="mt-1 text-xs text-gray-500 italic">
                Used when field is not bound to data
              </div>
            </label>
          )}
        </div>
        <div className="property-group">
          <h4>Position</h4>
          <div className="flex gap-2 mb-2">
            <label className="flex-1">
              <span className="block text-sm font-medium mb-1">X:</span>
              <div className="relative">
            <input
                  ref={positionXInputRef}
              type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
              value={field.x}
              onChange={(e) => onUpdateField(selectedElement.index, { x: parseFloat(e.target.value) || 0 }, section)}
            />
                <button
                  type="button"
                  onClick={() => openPositionModal(field.x, field.y, (x, y) => {
                    onUpdateField(selectedElement.index, { x, y }, section);
                  }, positionXInputRef)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  title="Open position editor"
                >
                  <Move className="h-4 w-4" />
                </button>
              </div>
          </label>
            <label className="flex-1">
              <span className="block text-sm font-medium mb-1">Y:</span>
              <div className="relative">
            <input
                  ref={positionYInputRef}
              type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
              value={field.y}
              onChange={(e) => onUpdateField(selectedElement.index, { y: parseFloat(e.target.value) || 0 }, section)}
            />
                <button
                  type="button"
                  onClick={() => openPositionModal(field.x, field.y, (x, y) => {
                    onUpdateField(selectedElement.index, { x, y }, section);
                  }, positionYInputRef)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  title="Open position editor"
                >
                  <Move className="h-4 w-4" />
                </button>
              </div>
            </label>
          </div>
          <label className="block mb-2">
            <span className="block text-sm font-medium mb-1">Width:</span>
            <div className="relative">
              <input
                ref={widthInputRef}
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                value={field.width || ''}
                onChange={(e) => {
                  const value = e.target.value.trim();
                  // Allow empty, numeric (px), percentage, or "auto"
                  onUpdateField(selectedElement.index, { width: value || undefined }, section);
                }}
                placeholder="e.g., 100, 50%, auto"
                title="Width in px (numeric), % (percentage), or 'auto'"
              />
              <button
                type="button"
                onClick={() => openWidthModal(field.width || '', (value) => {
                  onUpdateField(selectedElement.index, { width: value || undefined }, section);
                }, widthInputRef)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                title="Open width editor"
              >
                <Move className="h-4 w-4" />
              </button>
            </div>
          </label>
        </div>
        <div className="property-group">
          <h4>Font</h4>
          <label className="block mb-2">
            <span className="block text-sm font-medium mb-1">Family:</span>
            <div className="relative">
            <input
                ref={fontInputRef}
                type="text"
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer bg-white"
                value={field.fontFamily || 'Helvetica'}
                onClick={() => {
                  if (fontInputRef.current) {
                    const rect = fontInputRef.current.getBoundingClientRect();
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;
                    const modalWidth = 300;
                    const modalHeight = Math.min(400, viewportHeight * 0.6);
                    
                    let top = rect.bottom + 8;
                    let left = rect.left;
                    
                    if (left + modalWidth > viewportWidth) {
                      left = viewportWidth - modalWidth - 16;
                    }
                    if (left < 16) {
                      left = 16;
                    }
                    if (top + modalHeight > viewportHeight) {
                      top = rect.top - modalHeight - 8;
                      if (top < 16) {
                        top = 16;
                      }
                    }
                    
                    setFontModalPosition({ top, left });
                  }
                  setShowFontModal(true);
                }}
                placeholder="Select font"
              />
              <button
                type="button"
                onClick={() => {
                  if (fontInputRef.current) {
                    const rect = fontInputRef.current.getBoundingClientRect();
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;
                    const modalWidth = 300;
                    const modalHeight = Math.min(400, viewportHeight * 0.6);
                    
                    let top = rect.bottom + 8;
                    let left = rect.left;
                    
                    if (left + modalWidth > viewportWidth) {
                      left = viewportWidth - modalWidth - 16;
                    }
                    if (left < 16) {
                      left = 16;
                    }
                    if (top + modalHeight > viewportHeight) {
                      top = rect.top - modalHeight - 8;
                      if (top < 16) {
                        top = 16;
                      }
                    }
                    
                    setFontModalPosition({ top, left });
                  }
                  setShowFontModal(true);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Open font selector"
              >
                ▼
              </button>
            </div>
          </label>
          <label className="block mb-2">
            <span className="block text-sm font-medium mb-1">Size:</span>
            <div className="relative">
              <input
                ref={fontSizeInputRef}
              type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
              value={field.fontSize || ''}
              onChange={(e) => onUpdateField(selectedElement.index, { fontSize: parseFloat(e.target.value) || undefined }, section)}
              placeholder="Auto"
            />
              <button
                type="button"
                onClick={() => openFontSizeModal(field.fontSize, (value) => {
                  onUpdateField(selectedElement.index, { fontSize: value }, section);
                }, fontSizeInputRef)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                title="Open font size editor"
              >
                <Move className="h-4 w-4" />
              </button>
            </div>
          </label>
          <label className="block mb-2">
            <span className="block text-sm font-medium mb-1">Weight:</span>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={field.fontWeight || ''}
              onChange={(e) => onUpdateField(selectedElement.index, { fontWeight: e.target.value || undefined }, section)}
            >
              <option value="">Normal</option>
              <option value="normal">Normal</option>
              <option value="bold">Bold</option>
            </select>
          </label>
          <label className="block mb-2">
            <span className="block text-sm font-medium mb-1">Color:</span>
            <div className="flex items-center gap-2">
            <input
              type="color"
                className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
              value={field.color || '#000000'}
              onChange={(e) => onUpdateField(selectedElement.index, { color: e.target.value }, section)}
            />
              <input
                type="text"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={field.color || '#000000'}
                onChange={(e) => onUpdateField(selectedElement.index, { color: e.target.value }, section)}
                placeholder="#000000"
              />
            </div>
          </label>
          
          {/* Font Selection Modal */}
          {showFontModal && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0 z-50 bg-black bg-opacity-70"
                onClick={() => setShowFontModal(false)}
              />
              {/* Modal positioned near input */}
              <div 
                className="fixed z-50 bg-black border border-white border-opacity-20 rounded-lg shadow-xl w-80 max-h-[60vh] flex flex-col"
                style={{
                  top: `${fontModalPosition.top}px`,
                  left: `${fontModalPosition.left}px`,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between p-4 border-b border-white border-opacity-20">
                  <h3 className="text-lg font-semibold text-white">Select Font</h3>
                  <button
                    type="button"
                    onClick={() => setShowFontModal(false)}
                    className="text-white text-opacity-60 hover:text-white text-2xl font-bold transition-colors"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                
                {/* Modal Content */}
                <div className="p-4 overflow-y-auto flex-1">
                  <div className="space-y-1">
                    {availableFonts.map((font) => (
                      <button
                        key={font.name}
                        type="button"
                        onClick={() => {
                          onUpdateField(selectedElement.index, { fontFamily: font.name }, section);
                          setShowFontModal(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                          (field.fontFamily || 'Helvetica') === font.name
                            ? 'bg-white bg-opacity-20 border border-white border-opacity-30 text-white'
                            : 'bg-white bg-opacity-10 border border-white border-opacity-20 text-white hover:bg-opacity-20 hover:border-opacity-30'
                        }`}
                        style={{ fontFamily: font.name.replace('-Bold', '') }}
                      >
                        {font.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Modal Footer */}
                <div className="p-4 border-t border-white border-opacity-20 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowFontModal(false)}
                    className="px-4 py-2 bg-white bg-opacity-10 text-white rounded-md hover:bg-opacity-20 transition-colors border border-white border-opacity-20"
                  >
                    Close
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="property-group">
          <h4>Options</h4>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              checked={field.visible}
              onChange={(e) => onUpdateField(selectedElement.index, { visible: e.target.checked }, section)}
            />
            <span className="text-sm font-medium">Visible</span>
          </label>
        </div>
        <ActionBar />
      </div>
        <PositionModal />
        <WidthModal />
        <FontSizeModal />
        <TablePaddingModal />
        <TableFontSizeModal />
        <TableWidthModal />
        <ColumnBindingModal />
        <ColumnWidthModal />
        <ColumnHeightModal />
        <ColumnRowSpanModal />
        <ColumnColSpanModal />
        <ColumnCalculationModal />
      </>
    );
  }

  if (selectedElement.type === 'contentDetailTable' && template.contentDetailsTables && onUpdateContentDetailTable) {
    const table = template.contentDetailsTables[selectedElement.index];
    if (!table) return null;
    
    const selectedColumns = contentDetailTableSelectedColumns;
    const setSelectedColumns = setContentDetailTableSelectedColumns;

    const updateColumn = (index: number, updates: Partial<TableColumnConfig>) => {
      const newColumns = table.columns.map((col, i) =>
        i === index ? { ...col, ...updates } : col
      );
      onUpdateContentDetailTable(selectedElement.index, { ...table, columns: newColumns });
    };

    const toggleColumnSelection = (index: number) => {
      const newSelected = new Set(selectedColumns);
      if (newSelected.has(index)) {
        newSelected.delete(index);
      } else {
        newSelected.add(index);
      }
      setSelectedColumns(newSelected);
    };

    const deleteSelectedColumns = () => {
      const newColumns = table.columns.filter((_, i) => !selectedColumns.has(i));
      onUpdateContentDetailTable(selectedElement.index, { ...table, columns: newColumns });
      setSelectedColumns(new Set());
    };

    const toggleAllColumns = () => {
      if (selectedColumns.size === table.columns.length) {
        setSelectedColumns(new Set());
      } else {
        setSelectedColumns(new Set(table.columns.map((_, i) => i)));
      }
    };

    return (
      <>
      <div className="property-panel">
        <div className="property-group">
          <h4>Content Detail Table: {table.contentName}</h4>
          {onOpenTableModal && (
           <button
           className="open-modal-button"
           onClick={() =>
             onOpenTableModal('contentDetailTable', selectedElement.index)
           }
           style={{
             marginTop: '0.5rem',
             padding: '0.75rem 1.5rem',
             background: '#000',
             color: '#fff',
             border: '1px solid #000',
             borderRadius: '6px',
             cursor: 'pointer',
             fontSize: '0.95rem',
             fontWeight: 600,
             width: '100%',
             transition: 'background-color 0.2s ease, color 0.2s ease',
           }}
           onMouseEnter={(e) => {
             e.currentTarget.style.background = '#fff';
             e.currentTarget.style.color = '#000';
           }}
           onMouseLeave={(e) => {
             e.currentTarget.style.background = '#000';
             e.currentTarget.style.color = '#fff';
           }}
         >
           <Palette
             size={16}
             style={{
               display: 'inline-block',
               marginRight: '0.5rem',
               verticalAlign: 'middle',
             }}
           />
           Open Table Editor
         </button>
         
          )}
        </div>
        <div className="property-group">
          <h4>Layout</h4>
          <label>
            Orientation:
            <select
              value={table.orientation || 'vertical'}
              onChange={(e) => onUpdateContentDetailTable(selectedElement.index, { ...table, orientation: e.target.value as 'vertical' | 'horizontal' })}
            >
              <option value="vertical">Vertical (Normal)</option>
              <option value="horizontal">Horizontal (Transposed)</option>
            </select>
          </label>
        </div>
        <div className="property-group">
          <h4>Position</h4>
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="block text-sm font-medium mb-1">X:</span>
              <div className="relative">
            <input
                  ref={positionXInputRef}
              type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
              value={table.x || 0}
              onChange={(e) => onUpdateContentDetailTable(selectedElement.index, { ...table, x: parseFloat(e.target.value) || 0 })}
            />
                <button
                  type="button"
                  onClick={() => openPositionModal(table.x || 0, table.y || 0, (x, y) => {
                    onUpdateContentDetailTable(selectedElement.index, { ...table, x, y });
                  }, positionXInputRef)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  title="Open position editor"
                >
                  <Move className="h-4 w-4" />
                </button>
              </div>
          </label>
            <label className="flex-1">
              <span className="block text-sm font-medium mb-1">Y:</span>
              <div className="relative">
            <input
                  ref={positionYInputRef}
              type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
              value={table.y || 0}
              onChange={(e) => onUpdateContentDetailTable(selectedElement.index, { ...table, y: parseFloat(e.target.value) || 0 })}
            />
                <button
                  type="button"
                  onClick={() => openPositionModal(table.x || 0, table.y || 0, (x, y) => {
                    onUpdateContentDetailTable(selectedElement.index, { ...table, x, y });
                  }, positionYInputRef)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  title="Open position editor"
                >
                  <Move className="h-4 w-4" />
                </button>
              </div>
          </label>
          </div>
        </div>
        <div className="property-group">
          <h4>Borders</h4>
          <label>
            Color:
            <input
              type="color"
              value={table.borderColor || '#dddddd'}
              onChange={(e) => onUpdateContentDetailTable(selectedElement.index, { ...table, borderColor: e.target.value })}
            />
          </label>
          <label>
            Width:
            <input
              type="number"
              value={table.borderWidth || 1}
              min="0"
              step="0.5"
              onChange={(e) => onUpdateContentDetailTable(selectedElement.index, { ...table, borderWidth: parseFloat(e.target.value) || 1 })}
            />
          </label>
        </div>
        <div className="property-group">
          <h4>Header</h4>
          <label>
            Bg Color:
            <input
              type="color"
              value={table.headerBackgroundColor || '#f0f0f0'}
              onChange={(e) => onUpdateContentDetailTable(selectedElement.index, { ...table, headerBackgroundColor: e.target.value })}
            />
          </label>
          <label>
            Text Color:
            <input
              type="color"
              value={table.headerTextColor || '#000000'}
              onChange={(e) => onUpdateContentDetailTable(selectedElement.index, { ...table, headerTextColor: e.target.value })}
            />
          </label>
        </div>
        <div className="property-group">
          <h4>Style</h4>
          <label>
            Padding:
            <div className="relative">
            <input
                ref={tablePaddingInputRef}
              type="number"
              value={table.cellPadding || 10}
              min="0"
              step="1"
                className="w-full pr-10"
              onChange={(e) => onUpdateContentDetailTable(selectedElement.index, { ...table, cellPadding: parseFloat(e.target.value) || 10 })}
            />
              <button
                type="button"
                onClick={() => openTablePaddingModal(table.cellPadding || 10, (value) => {
                  onUpdateContentDetailTable(selectedElement.index, { ...table, cellPadding: value });
                }, tablePaddingInputRef)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                title="Open padding editor"
              >
                <Move className="h-4 w-4" />
              </button>
            </div>
          </label>
          <label>
            Font Size:
            <div className="relative">
            <input
                ref={tableFontSizeInputRef}
              type="number"
              value={table.fontSize || ''}
              min="8"
              step="1"
                className="w-full pr-10"
              onChange={(e) => onUpdateContentDetailTable(selectedElement.index, { ...table, fontSize: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="Auto"
            />
              <button
                type="button"
                onClick={() => openTableFontSizeModal(table.fontSize, (value) => {
                  onUpdateContentDetailTable(selectedElement.index, { ...table, fontSize: value });
                }, tableFontSizeInputRef)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                title="Open font size editor"
              >
                <Move className="h-4 w-4" />
              </button>
            </div>
          </label>
          <label>
            <input
              type="checkbox"
              checked={!!table.alternateRowColor}
              onChange={(e) => onUpdateContentDetailTable(selectedElement.index, { ...table, alternateRowColor: e.target.checked ? '#f9f9f9' : undefined })}
            />
            Alt Row Color
          </label>
          {table.alternateRowColor && (
            <label>
              Alt Row Color:
              <input
                type="color"
                value={table.alternateRowColor}
                onChange={(e) => onUpdateContentDetailTable(selectedElement.index, { ...table, alternateRowColor: e.target.value })}
              />
            </label>
          )}
          <label>
            Width:
            <div className="relative">
            <input
                ref={tableWidthInputRef}
              type="number"
              value={table.tableWidth || ''}
              min="100"
              step="10"
                className="w-full pr-10"
              onChange={(e) => onUpdateContentDetailTable(selectedElement.index, { ...table, tableWidth: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="Auto"
            />
              <button
                type="button"
                onClick={() => openTableWidthModal(table.tableWidth, (value) => {
                  onUpdateContentDetailTable(selectedElement.index, { ...table, tableWidth: value });
                }, tableWidthInputRef)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                title="Open width editor"
              >
                <Move className="h-4 w-4" />
              </button>
            </div>
          </label>
        </div>
        <div className="property-group column-group">
          <div className="column-header">
            <h4>Columns ({table.columns.length})</h4>
            <div className="column-actions">
              <button
                type="button"
                className="action-button"
                onClick={toggleAllColumns}
              >
                {selectedColumns.size === table.columns.length ? 'Deselect' : 'Select All'}
              </button>
              {selectedColumns.size > 0 && (
                <button
                  type="button"
                  className="action-button delete-button"
                  onClick={deleteSelectedColumns}
                >
                  Delete ({selectedColumns.size})
                </button>
              )}
            </div>
          </div>
          {table.columns.map((col, index) => (
            <div
              key={index}
              className={`column-item ${selectedColumns.has(index) ? 'selected' : ''}`}
            >
              <label className="column-select">
                <input
                  type="checkbox"
                  checked={selectedColumns.has(index)}
                  onChange={() => toggleColumnSelection(index)}
                />
                <span className="column-number">#{index + 1}</span>
              </label>
              <div className="column-fields">
                <label>
                  Label:
                  <input
                    type="text"
                    value={col.label}
                    onChange={(e) => updateColumn(index, { label: e.target.value })}
                  />
                </label>
                <label>
                  Binding:
                  <div className="relative">
                  <input
                      ref={columnBindingInputRef}
                    type="text"
                      className="w-full pr-10"
                    value={col.bind}
                    onChange={(e) => updateColumn(index, { bind: e.target.value })}
                    placeholder="Field"
                  />
                    <button
                      type="button"
                      onClick={(e) => {
                        const inputElement = (e.currentTarget.parentElement?.querySelector('input') as HTMLElement) || null;
                        openColumnBindingModal(col.bind || '', (value) => {
                          updateColumn(index, { bind: value });
                        }, inputElement);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                      title="Open binding editor"
                    >
                      <Move className="h-4 w-4" />
                    </button>
                  </div>
                </label>
                <label>
                  Width:
                  <div className="relative">
                  <input
                      ref={columnWidthInputRef}
                    type="number"
                    value={col.width || ''}
                    min="0"
                    step="1"
                      className="w-full pr-10"
                    onChange={(e) => updateColumn(index, { width: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="Auto"
                  />
                    <button
                      type="button"
                      onClick={(e) => {
                        const inputElement = (e.currentTarget.parentElement?.querySelector('input') as HTMLElement) || null;
                        openColumnWidthModal(col.width, (value) => {
                          updateColumn(index, { width: value });
                        }, inputElement);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                      title="Open width editor"
                    >
                      <Move className="h-4 w-4" />
                    </button>
                  </div>
                </label>
                <label>
                  Height:
                  <div className="relative">
                  <input
                      ref={columnHeightInputRef}
                    type="number"
                    value={col.height || ''}
                    min="0"
                    step="1"
                      className="w-full pr-10"
                    onChange={(e) => updateColumn(index, { height: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="Auto"
                  />
                    <button
                      type="button"
                      onClick={(e) => {
                        const inputElement = (e.currentTarget.parentElement?.querySelector('input') as HTMLElement) || null;
                        openColumnHeightModal(col.height, (value) => {
                          updateColumn(index, { height: value });
                        }, inputElement);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                      title="Open height editor"
                    >
                      <Move className="h-4 w-4" />
                    </button>
                  </div>
                </label>
                <label>
                  Align:
                  <select
                    value={col.align || 'left'}
                    onChange={(e) => updateColumn(index, { align: e.target.value as 'left' | 'center' | 'right' })}
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </label>
                <label>
                  Row Span:
                  <div className="relative">
                  <input
                      ref={columnRowSpanInputRef}
                    type="number"
                    value={col.rowSpan || ''}
                    min="1"
                    step="1"
                      className="w-full pr-10"
                    onChange={(e) => updateColumn(index, { rowSpan: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="1"
                  />
                    <button
                      type="button"
                      onClick={(e) => {
                        const inputElement = (e.currentTarget.parentElement?.querySelector('input') as HTMLElement) || null;
                        openColumnRowSpanModal(col.rowSpan, (value) => {
                          updateColumn(index, { rowSpan: value });
                        }, inputElement);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                      title="Open row span editor"
                    >
                      <Move className="h-4 w-4" />
                    </button>
                  </div>
                </label>
                <label>
                  Column Span:
                  <div className="relative">
                  <input
                      ref={columnColSpanInputRef}
                    type="number"
                    value={col.colSpan || ''}
                    min="1"
                    step="1"
                      className="w-full pr-10"
                    onChange={(e) => updateColumn(index, { colSpan: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="1"
                  />
                    <button
                      type="button"
                      onClick={(e) => {
                        const inputElement = (e.currentTarget.parentElement?.querySelector('input') as HTMLElement) || null;
                        openColumnColSpanModal(col.colSpan, (value) => {
                          updateColumn(index, { colSpan: value });
                        }, inputElement);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                      title="Open column span editor"
                    >
                      <Move className="h-4 w-4" />
                    </button>
                  </div>
                </label>
                <div className="property-group" style={{ marginTop: '0.5rem', padding: '0.75rem', background: '#f8f9fa', borderRadius: '6px' }}>
                  <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 600 }}>Data Manipulation</h5>
                  <label>
                    Calculation Type:
                    <div className="relative">
                    <select
                        ref={columnCalculationInputRef}
                        className="w-full pr-10"
                      value={col.calculationType || 'none'}
                      onChange={(e) => updateColumn(index, { calculationType: e.target.value as any })}
                    >
                      <option value="none">None</option>
                      <option value="sum">Sum</option>
                      <option value="avg">Average</option>
                      <option value="count">Count</option>
                      <option value="min">Min</option>
                      <option value="max">Max</option>
                      <option value="custom">Custom Formula</option>
                    </select>
                      <button
                        type="button"
                        onClick={(e) => {
                          const selectElement = (e.currentTarget.parentElement?.querySelector('select') as HTMLElement) || null;
                          openColumnCalculationModal({
                            calculationType: col.calculationType || 'none',
                            calculationSource: col.calculationSource,
                            calculationField: col.calculationField,
                            calculationFormula: col.calculationFormula,
                          }, (value) => {
                            updateColumn(index, value as any);
                          }, selectElement);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                        title="Open calculation editor"
                      >
                        <Move className="h-4 w-4" />
                      </button>
                    </div>
                  </label>
                  {(col.calculationType && col.calculationType !== 'none') && (
                    <>
                      {col.calculationType !== 'custom' && (
                        <>
                          <label>
                            Source Table/Array:
                            <input
                              type="text"
                              value={col.calculationSource || ''}
                              onChange={(e) => updateColumn(index, { calculationSource: e.target.value })}
                              placeholder="e.g., items, contentDetails.items"
                            />
                          </label>
                          <label>
                            Field to Calculate:
                            <input
                              type="text"
                              value={col.calculationField || ''}
                              onChange={(e) => updateColumn(index, { calculationField: e.target.value })}
                              placeholder="e.g., rate, price"
                            />
                          </label>
                        </>
                      )}
                      {col.calculationType === 'custom' && (
                        <label>
                          Custom Formula:
                          <input
                            type="text"
                            value={col.calculationFormula || ''}
                            onChange={(e) => updateColumn(index, { calculationFormula: e.target.value })}
                            placeholder="e.g., sum(items.rate) * header.exchangeRate"
                            style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                          />
                        </label>
                      )}
                    </>
                  )}
                </div>
                <label>
                  <input
                    type="checkbox"
                    checked={col.visible}
                    onChange={(e) => updateColumn(index, { visible: e.target.checked })}
                  />
                  Visible
                </label>
              </div>
            </div>
          ))}
        </div>
        <div className="property-group column-group">
          <div className="column-header">
            <h4>Final Rows</h4>
            <button
              type="button"
              className="action-button"
              onClick={() => {
                const visibleColumns = table.columns.filter(col => col.visible !== false);
                const newRow: FinalRowConfig = {
                  cells: visibleColumns.map(() => ({
                    label: '',
                    valueType: 'static',
                    value: '',
                    align: 'left',
                    colSpan: 1,
                  })),
                  visible: true,
                };
                onUpdateContentDetailTable(selectedElement.index, {
                  ...table,
                  finalRows: [...(table.finalRows || []), newRow],
                });
              }}
              style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
            >
              + Add Row
            </button>
          </div>
          {table.finalRows && table.finalRows.length > 0 ? (
            <div className="flex flex-col gap-4">
              {table.finalRows.map((finalRow, rowIndex) => (
                <div key={rowIndex} className="border border-white border-opacity-20 rounded-lg p-3 bg-black text-white">
                  <div className="flex justify-between items-center mb-2">
                    <strong className="text-sm text-white">Row {rowIndex + 1}</strong>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const newRows = [...table.finalRows!];
                          // Add a new cell at the end
                          newRows[rowIndex].cells.push({
                            label: '',
                            valueType: 'static',
                            value: '',
                            align: 'left',
                            colSpan: 1,
                          });
                          onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                        }}
                        className="px-2 py-1 text-xs bg-green-600 text-white border-none rounded cursor-pointer"
                        title="Add cell to row"
                      >
                        + Cell
                      </button>
                      {rowIndex > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newRows = [...table.finalRows!];
                            [newRows[rowIndex], newRows[rowIndex - 1]] = [newRows[rowIndex - 1], newRows[rowIndex]];
                            onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                          }}
                          className="px-2 py-1 text-xs text-white"
                        >
                          ↑
                        </button>
                      )}
                      {rowIndex < table.finalRows!.length - 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newRows = [...table.finalRows!];
                            [newRows[rowIndex], newRows[rowIndex + 1]] = [newRows[rowIndex + 1], newRows[rowIndex]];
                            onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                          }}
                          className="px-2 py-1 text-xs text-white"
                        >
                          ↓
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const newRows = table.finalRows!.filter((_, i) => i !== rowIndex);
                          onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows.length > 0 ? newRows : undefined });
                        }}
                        className="px-2 py-1 text-xs text-red-500"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {finalRow.cells.map((cell, cellIndex) => {
                      const column = table.columns[cellIndex];
                      if (column && column.visible === false) return null;
                      return (
                        <div key={cellIndex} className="flex flex-col gap-1 p-2 bg-black text-white rounded border border-white border-opacity-20 relative">
                          <div className="flex justify-between items-center">
                            <div className="text-xs text-white font-semibold">
                              Cell {cellIndex + 1} ({column?.label || 'Column ' + (cellIndex + 1)})
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newRows = [...table.finalRows!];
                                newRows[rowIndex].cells = newRows[rowIndex].cells.filter((_, i) => i !== cellIndex);
                                // If no cells left, remove the row
                                if (newRows[rowIndex].cells.length === 0) {
                                  newRows.splice(rowIndex, 1);
                                  onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows.length > 0 ? newRows : undefined });
                                } else {
                                  onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                                }
                              }}
                              className="px-2 py-1 text-xs text-red-500 bg-transparent border border-red-500 rounded cursor-pointer"
                              title="Delete cell"
                            >
                              ×
                            </button>
                          </div>
                          <label className="text-sm text-white">
                            Label:
                            <input
                              type="text"
                              value={cell.label || ''}
                              onChange={(e) => {
                                const newRows = [...table.finalRows!];
                                newRows[rowIndex].cells[cellIndex].label = e.target.value;
                                onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                              }}
                              placeholder="e.g., Sub Total"
                              className="w-full mt-1 px-2 py-1 bg-white bg-opacity-10 border border-white border-opacity-20 rounded text-white placeholder-white placeholder-opacity-50"
                            />
                          </label>
                          <label className="text-sm text-white">
                            Value Type:
                            <select
                              value={cell.valueType || 'static'}
                              onChange={(e) => {
                                const newRows = [...table.finalRows!];
                                newRows[rowIndex].cells[cellIndex].valueType = e.target.value as any;
                                onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                              }}
                              className="w-full mt-1 px-2 py-1 bg-white bg-opacity-10 border border-white border-opacity-20 rounded text-white"
                            >
                              <option value="static" className="bg-black">Static</option>
                              <option value="calculation" className="bg-black">Calculation</option>
                              <option value="formula" className="bg-black">Formula</option>
                            </select>
                          </label>
                          {cell.valueType === 'static' && (
                            <label className="text-sm text-white">
                              Value:
                              <input
                                type="text"
                                value={cell.value || ''}
                                onChange={(e) => {
                                  const newRows = [...table.finalRows!];
                                  newRows[rowIndex].cells[cellIndex].value = e.target.value;
                                  onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                                }}
                                placeholder="e.g., 400"
                                className="w-full mt-1 px-2 py-1 bg-white bg-opacity-10 border border-white border-opacity-20 rounded text-white placeholder-white placeholder-opacity-50"
                              />
                            </label>
                          )}
                          {cell.valueType === 'calculation' && (
                            <>
                              <label className="text-sm text-white">
                                Calculation:
                                <select
                                  value={cell.calculationType || 'sum'}
                                  onChange={(e) => {
                                    const newRows = [...table.finalRows!];
                                    newRows[rowIndex].cells[cellIndex].calculationType = e.target.value as any;
                                    onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                                  }}
                                  className="w-full mt-1 px-2 py-1 bg-white bg-opacity-10 border border-white border-opacity-20 rounded text-white"
                                >
                                  <option value="sum" className="bg-black">Sum</option>
                                  <option value="avg" className="bg-black">Average</option>
                                  <option value="count" className="bg-black">Count</option>
                                  <option value="min" className="bg-black">Min</option>
                                  <option value="max" className="bg-black">Max</option>
                                </select>
                              </label>
                              <label className="text-sm text-white">
                                Source Table/Array:
                                <div className="relative">
                                  <input
                                    ref={finalRowCalculationSourceInputRef}
                                    type="text"
                                    value={cell.calculationSource || ''}
                                    onChange={(e) => {
                                      const newRows = [...table.finalRows!];
                                      newRows[rowIndex].cells[cellIndex].calculationSource = e.target.value;
                                      onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                                    }}
                                    placeholder="e.g., items"
                                    className="w-full mt-1 px-2 py-1 pr-8 bg-white bg-opacity-10 border border-white border-opacity-20 rounded text-white placeholder-white placeholder-opacity-50"
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      const inputElement = (e.currentTarget.parentElement?.querySelector('input') as HTMLElement) || null;
                                      openFinalRowCalculationSourceModal(cell.calculationSource || '', (value) => {
                                        const newRows = [...table.finalRows!];
                                        newRows[rowIndex].cells[cellIndex].calculationSource = value;
                                        onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                                      }, inputElement);
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white text-opacity-60 hover:text-white cursor-pointer"
                                    title="Open data source selector"
                                  >
                                    <Move className="h-4 w-4" />
                                  </button>
                                </div>
                              </label>
                              <label className="text-sm text-white">
                                Field:
                                <div className="relative">
                                  <input
                                    ref={finalRowCalculationFieldInputRef}
                                    type="text"
                                    value={cell.calculationField || ''}
                                    onChange={(e) => {
                                      const newRows = [...table.finalRows!];
                                      newRows[rowIndex].cells[cellIndex].calculationField = e.target.value;
                                      onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                                    }}
                                    placeholder="e.g., rate, price"
                                    className="w-full mt-1 px-2 py-1 pr-8 bg-white bg-opacity-10 border border-white border-opacity-20 rounded text-white placeholder-white placeholder-opacity-50"
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      const inputElement = (e.currentTarget.parentElement?.querySelector('input') as HTMLElement) || null;
                                      openFinalRowCalculationFieldModal(cell.calculationField || '', cell.calculationSource || '', (value) => {
                                        const newRows = [...table.finalRows!];
                                        newRows[rowIndex].cells[cellIndex].calculationField = value;
                                        onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                                      }, inputElement);
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white text-opacity-60 hover:text-white cursor-pointer"
                                    title="Open field selector"
                                  >
                                    <Move className="h-4 w-4" />
                                  </button>
                                </div>
                              </label>
                            </>
                          )}
                          {cell.valueType === 'formula' && (
                            <label className="text-sm text-white">
                              Formula:
                              <input
                                type="text"
                                value={cell.formula || ''}
                                onChange={(e) => {
                                  const newRows = [...table.finalRows!];
                                  newRows[rowIndex].cells[cellIndex].formula = e.target.value;
                                  onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                                }}
                                placeholder="e.g., sum(items.rate) * header.exchangeRate"
                                className="w-full mt-1 px-2 py-1 bg-white bg-opacity-10 border border-white border-opacity-20 rounded text-white placeholder-white placeholder-opacity-50 font-mono text-sm"
                              />
                            </label>
                          )}
                          <div className="flex gap-2 mt-1">
                            <label className="text-sm text-white flex-1">
                              Align:
                              <select
                                value={cell.align || 'left'}
                                onChange={(e) => {
                                  const newRows = [...table.finalRows!];
                                  newRows[rowIndex].cells[cellIndex].align = e.target.value as any;
                                  onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                                }}
                                className="w-full mt-1 px-2 py-1 bg-white bg-opacity-10 border border-white border-opacity-20 rounded text-white"
                              >
                                <option value="left" className="bg-black">Left</option>
                                <option value="center" className="bg-black">Center</option>
                                <option value="right" className="bg-black">Right</option>
                              </select>
                            </label>
                            <label className="text-sm text-white flex-1">
                              Col Span:
                              <div className="relative">
                                <input
                                  ref={finalRowColSpanInputRef}
                                  type="number"
                                  value={cell.colSpan || 1}
                                  min="1"
                                  onChange={(e) => {
                                    const newRows = [...table.finalRows!];
                                    newRows[rowIndex].cells[cellIndex].colSpan = parseInt(e.target.value) || 1;
                                    onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                                  }}
                                  className="w-full mt-1 px-2 py-1 pr-8 bg-white bg-opacity-10 border border-white border-opacity-20 rounded text-white"
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    const inputElement = (e.currentTarget.parentElement?.querySelector('input') as HTMLElement) || null;
                                    openFinalRowColSpanModal(cell.colSpan, (value) => {
                                      const newRows = [...table.finalRows!];
                                      newRows[rowIndex].cells[cellIndex].colSpan = value || 1;
                                      onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                                    }, inputElement);
                                  }}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white text-opacity-60 hover:text-white cursor-pointer"
                                  title="Open column span editor"
                                >
                                  <Move className="h-4 w-4" />
                                </button>
                              </div>
                            </label>
                          </div>
                          <label className="text-sm text-white mt-1">
                            <input
                              type="checkbox"
                              checked={cell.fontWeight === 'bold'}
                              onChange={(e) => {
                                const newRows = [...table.finalRows!];
                                newRows[rowIndex].cells[cellIndex].fontWeight = e.target.checked ? 'bold' : 'normal';
                                onUpdateContentDetailTable(selectedElement.index, { ...table, finalRows: newRows });
                              }}
                            />
                            Bold
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.875rem', color: '#6c757d', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>
              No final rows. Click "Add Row" to create one.
            </p>
          )}
        </div>
        <div className="property-group">
          <h4>Pagination</h4>
          <label>
            Rows/Page:
            <input
              type="number"
              value={table.rowsPerPage || ''}
              min="1"
              onChange={(e) => onUpdateContentDetailTable(selectedElement.index, { 
                ...table,
                rowsPerPage: e.target.value ? parseInt(e.target.value) : undefined
              })}
              placeholder="Auto"
            />
          </label>
        </div>
        <ActionBar />
      </div>
        <PositionModal />
        <WidthModal />
        <FontSizeModal />
        <TablePaddingModal />
        <TableFontSizeModal />
        <TableWidthModal />
        <ColumnBindingModal />
        <ColumnWidthModal />
        <ColumnHeightModal />
        <ColumnRowSpanModal />
        <ColumnColSpanModal />
        <ColumnCalculationModal />
        <FinalRowColSpanModal />
        <FinalRowCalculationSourceModal />
        <FinalRowCalculationFieldModal />
      </>
    );
  }

  if (selectedElement.type === 'billContentTable' && template.billContentTables && template.billContentTables[selectedElement.index] && onUpdateBillContentTable) {
    const table = template.billContentTables[selectedElement.index];
    const selectedColumns = billContentTableSelectedColumns;
    const setSelectedColumns = setBillContentTableSelectedColumns;

    const updateColumn = (index: number, updates: Partial<TableColumnConfig>) => {
      const newColumns = table.columns.map((col, i) =>
        i === index ? { ...col, ...updates } : col
      );
      onUpdateBillContentTable(selectedElement.index, { ...table, columns: newColumns });
    };

    const toggleColumnSelection = (index: number) => {
      const newSelected = new Set(selectedColumns);
      if (newSelected.has(index)) {
        newSelected.delete(index);
      } else {
        newSelected.add(index);
      }
      setSelectedColumns(newSelected);
    };

    const deleteSelectedColumns = () => {
      const newColumns = table.columns.filter((_, i) => !selectedColumns.has(i));
      onUpdateBillContentTable(selectedElement.index, { ...table, columns: newColumns });
      setSelectedColumns(new Set());
    };

    const toggleAllColumns = () => {
      if (selectedColumns.size === table.columns.length) {
        setSelectedColumns(new Set());
      } else {
        setSelectedColumns(new Set(table.columns.map((_, i) => i)));
      }
    };

    return (
      <>
      <div className="property-panel">
        <div className="property-group">
          <h4>Bill Content Table</h4>
          {onOpenTableModal && (
           <button
           className="open-modal-button"
           onClick={() =>
             onOpenTableModal('billContentTable', selectedElement.index)
           }
           style={{
             marginTop: '0.5rem',
             padding: '0.75rem 1.5rem',
             background: '#000',
             color: '#fff',
             border: '1px solid #000',
             borderRadius: '6px',
             cursor: 'pointer',
             fontSize: '0.95rem',
             fontWeight: 600,
             width: '100%',
             transition: 'background-color 0.2s ease, color 0.2s ease',
           }}
           onMouseEnter={(e) => {
             e.currentTarget.style.background = '#fff';
             e.currentTarget.style.color = '#000';
           }}
           onMouseLeave={(e) => {
             e.currentTarget.style.background = '#000';
             e.currentTarget.style.color = '#fff';
           }}
         >
           <Palette
             size={16}
             style={{
               display: 'inline-block',
               marginRight: '0.5rem',
               verticalAlign: 'middle',
             }}
           />
           Open Table Editor
         </button>
         
          )}
        </div>
        <div className="property-group">
          <h4>Layout</h4>
          <label>
            Orientation:
            <select
              value={table.orientation || 'vertical'}
              onChange={(e) => onUpdateBillContentTable(selectedElement.index, { ...table, orientation: e.target.value as 'vertical' | 'horizontal' })}
            >
              <option value="vertical">Vertical (Normal)</option>
              <option value="horizontal">Horizontal (Transposed)</option>
            </select>
          </label>
        </div>
        <div className="property-group">
          <h4>Position</h4>
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="block text-sm font-medium mb-1">X:</span>
              <div className="relative">
            <input
                  ref={positionXInputRef}
              type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
              value={table.x || 0}
              onChange={(e) => onUpdateBillContentTable(selectedElement.index, { ...table, x: parseFloat(e.target.value) || 0 })}
            />
                <button
                  type="button"
                  onClick={() => openPositionModal(table.x || 0, table.y || 0, (x, y) => {
                    onUpdateBillContentTable(selectedElement.index, { ...table, x, y });
                  }, positionXInputRef)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  title="Open position editor"
                >
                  <Move className="h-4 w-4" />
                </button>
              </div>
          </label>
            <label className="flex-1">
              <span className="block text-sm font-medium mb-1">Y:</span>
              <div className="relative">
            <input
                  ref={positionYInputRef}
              type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
              value={table.y || 0}
              onChange={(e) => onUpdateBillContentTable(selectedElement.index, { ...table, y: parseFloat(e.target.value) || 0 })}
            />
                <button
                  type="button"
                  onClick={() => openPositionModal(table.x || 0, table.y || 0, (x, y) => {
                    onUpdateBillContentTable(selectedElement.index, { ...table, x, y });
                  }, positionYInputRef)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  title="Open position editor"
                >
                  <Move className="h-4 w-4" />
                </button>
              </div>
          </label>
          </div>
        </div>
        <div className="property-group">
          <h4>Borders</h4>
          <label>
            Color:
            <input
              type="color"
              value={table.borderColor || '#dddddd'}
              onChange={(e) => onUpdateBillContentTable(selectedElement.index, { ...table, borderColor: e.target.value })}
            />
          </label>
          <label>
            Width:
            <input
              type="number"
              value={table.borderWidth || 1}
              min="0"
              step="0.5"
              onChange={(e) => onUpdateBillContentTable(selectedElement.index, { ...table, borderWidth: parseFloat(e.target.value) || 1 })}
            />
          </label>
        </div>
        <div className="property-group">
          <h4>Header</h4>
          <label>
            Bg Color:
            <input
              type="color"
              value={table.headerBackgroundColor || '#f0f0f0'}
              onChange={(e) => onUpdateBillContentTable(selectedElement.index, { ...table, headerBackgroundColor: e.target.value })}
            />
          </label>
          <label>
            Text Color:
            <input
              type="color"
              value={table.headerTextColor || '#000000'}
              onChange={(e) => onUpdateBillContentTable(selectedElement.index, { ...table, headerTextColor: e.target.value })}
            />
          </label>
        </div>
        <div className="property-group">
          <h4>Style</h4>
          <label>
            Padding:
            <div className="relative">
            <input
                ref={tablePaddingInputRef}
              type="number"
              value={table.cellPadding || 10}
              min="0"
              step="1"
                className="w-full pr-10"
              onChange={(e) => onUpdateBillContentTable(selectedElement.index, { ...table, cellPadding: parseFloat(e.target.value) || 10 })}
            />
              <button
                type="button"
                onClick={() => openTablePaddingModal(table.cellPadding || 10, (value) => {
                  onUpdateBillContentTable(selectedElement.index, { ...table, cellPadding: value });
                }, tablePaddingInputRef)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                title="Open padding editor"
              >
                <Move className="h-4 w-4" />
              </button>
            </div>
          </label>
          <label>
            Font Size:
            <div className="relative">
            <input
                ref={tableFontSizeInputRef}
              type="number"
              value={table.fontSize || ''}
              min="8"
              step="1"
                className="w-full pr-10"
              onChange={(e) => onUpdateBillContentTable(selectedElement.index, { ...table, fontSize: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="Auto"
            />
              <button
                type="button"
                onClick={() => openTableFontSizeModal(table.fontSize, (value) => {
                  onUpdateBillContentTable(selectedElement.index, { ...table, fontSize: value });
                }, tableFontSizeInputRef)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                title="Open font size editor"
              >
                <Move className="h-4 w-4" />
              </button>
            </div>
          </label>
          <label>
            <input
              type="checkbox"
              checked={!!table.alternateRowColor}
              onChange={(e) => onUpdateBillContentTable(selectedElement.index, { ...table, alternateRowColor: e.target.checked ? '#f9f9f9' : undefined })}
            />
            Alt Row Color
          </label>
          {table.alternateRowColor && (
            <label>
              Alt Row Color:
              <input
                type="color"
                value={table.alternateRowColor}
                onChange={(e) => onUpdateBillContentTable(selectedElement.index, { ...table, alternateRowColor: e.target.value })}
              />
            </label>
          )}
          <label>
            Width:
            <div className="relative">
            <input
                ref={tableWidthInputRef}
              type="number"
              value={table.tableWidth || ''}
              min="100"
              step="10"
                className="w-full pr-10"
              onChange={(e) => onUpdateBillContentTable(selectedElement.index, { ...table, tableWidth: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="Auto"
            />
              <button
                type="button"
                onClick={() => openTableWidthModal(table.tableWidth, (value) => {
                  onUpdateBillContentTable(selectedElement.index, { ...table, tableWidth: value });
                }, tableWidthInputRef)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                title="Open width editor"
              >
                <Move className="h-4 w-4" />
              </button>
            </div>
          </label>
        </div>
        <div className="property-group column-group">
          <div className="column-header">
            <h4>Columns ({table.columns.length})</h4>
            <div className="column-actions">
              <button
                type="button"
                className="action-button"
                onClick={toggleAllColumns}
              >
                {selectedColumns.size === table.columns.length ? 'Deselect' : 'Select All'}
              </button>
              {selectedColumns.size > 0 && (
                <button
                  type="button"
                  className="action-button delete-button"
                  onClick={deleteSelectedColumns}
                >
                  Delete ({selectedColumns.size})
                </button>
              )}
            </div>
          </div>
          {table.columns.map((col, index) => (
            <div
              key={index}
              className={`column-item ${selectedColumns.has(index) ? 'selected' : ''}`}
            >
              <label className="column-select">
                <input
                  type="checkbox"
                  checked={selectedColumns.has(index)}
                  onChange={() => toggleColumnSelection(index)}
                />
                <span className="column-number">#{index + 1}</span>
              </label>
              <div className="column-fields">
                <label>
                  Label:
                  <input
                    type="text"
                    value={col.label}
                    onChange={(e) => updateColumn(index, { label: e.target.value })}
                  />
                </label>
                <label>
                  Binding:
                  <div className="relative">
                  <input
                      ref={columnBindingInputRef}
                    type="text"
                      className="w-full pr-10"
                    value={col.bind}
                    onChange={(e) => updateColumn(index, { bind: e.target.value })}
                    placeholder="Field"
                  />
                    <button
                      type="button"
                      onClick={(e) => {
                        const inputElement = (e.currentTarget.parentElement?.querySelector('input') as HTMLElement) || null;
                        openColumnBindingModal(col.bind || '', (value) => {
                          updateColumn(index, { bind: value });
                        }, inputElement);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                      title="Open binding editor"
                    >
                      <Move className="h-4 w-4" />
                    </button>
                  </div>
                </label>
                <label>
                  Width:
                  <div className="relative">
                  <input
                      ref={columnWidthInputRef}
                    type="number"
                    value={col.width || ''}
                    min="0"
                    step="1"
                      className="w-full pr-10"
                    onChange={(e) => updateColumn(index, { width: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="Auto"
                  />
                    <button
                      type="button"
                      onClick={(e) => {
                        const inputElement = (e.currentTarget.parentElement?.querySelector('input') as HTMLElement) || null;
                        openColumnWidthModal(col.width, (value) => {
                          updateColumn(index, { width: value });
                        }, inputElement);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                      title="Open width editor"
                    >
                      <Move className="h-4 w-4" />
                    </button>
                  </div>
                </label>
                <label>
                  Height:
                  <div className="relative">
                  <input
                      ref={columnHeightInputRef}
                    type="number"
                    value={col.height || ''}
                    min="0"
                    step="1"
                      className="w-full pr-10"
                    onChange={(e) => updateColumn(index, { height: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="Auto"
                  />
                    <button
                      type="button"
                      onClick={(e) => {
                        const inputElement = (e.currentTarget.parentElement?.querySelector('input') as HTMLElement) || null;
                        openColumnHeightModal(col.height, (value) => {
                          updateColumn(index, { height: value });
                        }, inputElement);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                      title="Open height editor"
                    >
                      <Move className="h-4 w-4" />
                    </button>
                  </div>
                </label>
                <label>
                  Align:
                  <select
                    value={col.align || 'left'}
                    onChange={(e) => updateColumn(index, { align: e.target.value as 'left' | 'center' | 'right' })}
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </label>
                <label>
                  Row Span:
                  <div className="relative">
                  <input
                      ref={columnRowSpanInputRef}
                    type="number"
                    value={col.rowSpan || ''}
                    min="1"
                    step="1"
                      className="w-full pr-10"
                    onChange={(e) => updateColumn(index, { rowSpan: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="1"
                  />
                    <button
                      type="button"
                      onClick={(e) => {
                        const inputElement = (e.currentTarget.parentElement?.querySelector('input') as HTMLElement) || null;
                        openColumnRowSpanModal(col.rowSpan, (value) => {
                          updateColumn(index, { rowSpan: value });
                        }, inputElement);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                      title="Open row span editor"
                    >
                      <Move className="h-4 w-4" />
                    </button>
                  </div>
                </label>
                <label>
                  Column Span:
                  <div className="relative">
                  <input
                      ref={columnColSpanInputRef}
                    type="number"
                    value={col.colSpan || ''}
                    min="1"
                    step="1"
                      className="w-full pr-10"
                    onChange={(e) => updateColumn(index, { colSpan: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="1"
                  />
                    <button
                      type="button"
                      onClick={(e) => {
                        const inputElement = (e.currentTarget.parentElement?.querySelector('input') as HTMLElement) || null;
                        openColumnColSpanModal(col.colSpan, (value) => {
                          updateColumn(index, { colSpan: value });
                        }, inputElement);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                      title="Open column span editor"
                    >
                      <Move className="h-4 w-4" />
                    </button>
                  </div>
                </label>
                <div className="property-group" style={{ marginTop: '0.5rem', padding: '0.75rem', background: '#f8f9fa', borderRadius: '6px' }}>
                  <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 600 }}>Data Manipulation</h5>
                  <label>
                    Calculation Type:
                    <div className="relative">
                    <select
                        ref={columnCalculationInputRef}
                        className="w-full pr-10"
                      value={col.calculationType || 'none'}
                      onChange={(e) => updateColumn(index, { calculationType: e.target.value as any })}
                    >
                      <option value="none">None</option>
                      <option value="sum">Sum</option>
                      <option value="avg">Average</option>
                      <option value="count">Count</option>
                      <option value="min">Min</option>
                      <option value="max">Max</option>
                      <option value="custom">Custom Formula</option>
                    </select>
                      <button
                        type="button"
                        onClick={(e) => {
                          const selectElement = (e.currentTarget.parentElement?.querySelector('select') as HTMLElement) || null;
                          openColumnCalculationModal({
                            calculationType: col.calculationType || 'none',
                            calculationSource: col.calculationSource,
                            calculationField: col.calculationField,
                            calculationFormula: col.calculationFormula,
                          }, (value) => {
                            updateColumn(index, value as any);
                          }, selectElement);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                        title="Open calculation editor"
                      >
                        <Move className="h-4 w-4" />
                      </button>
                    </div>
                  </label>
                  {(col.calculationType && col.calculationType !== 'none') && (
                    <>
                      {col.calculationType !== 'custom' && (
                        <>
                          <label>
                            Source Table/Array:
                            <input
                              type="text"
                              value={col.calculationSource || ''}
                              onChange={(e) => updateColumn(index, { calculationSource: e.target.value })}
                              placeholder="e.g., items, contentDetails.items"
                            />
                          </label>
                          <label>
                            Field to Calculate:
                            <input
                              type="text"
                              value={col.calculationField || ''}
                              onChange={(e) => updateColumn(index, { calculationField: e.target.value })}
                              placeholder="e.g., rate, price"
                            />
                          </label>
                        </>
                      )}
                      {col.calculationType === 'custom' && (
                        <label>
                          Custom Formula:
                          <input
                            type="text"
                            value={col.calculationFormula || ''}
                            onChange={(e) => updateColumn(index, { calculationFormula: e.target.value })}
                            placeholder="e.g., sum(items.rate) * header.exchangeRate"
                            style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                          />
                        </label>
                      )}
                    </>
                  )}
                </div>
                <label>
                  <input
                    type="checkbox"
                    checked={col.visible}
                    onChange={(e) => updateColumn(index, { visible: e.target.checked })}
                  />
                  Visible
                </label>
              </div>
            </div>
          ))}
        </div>
        <div className="property-group column-group">
          <div className="column-header">
            <h4>Final Rows</h4>
            <button
              type="button"
              className="action-button"
              onClick={() => {
                const visibleColumns = table.columns.filter(col => col.visible !== false);
                const newRow: FinalRowConfig = {
                  cells: visibleColumns.map(() => ({
                    label: '',
                    valueType: 'static',
                    value: '',
                    align: 'left',
                    colSpan: 1,
                  })),
                  visible: true,
                };
                onUpdateBillContentTable(selectedElement.index, {
                  ...table,
                  finalRows: [...(table.finalRows || []), newRow],
                });
              }}
              style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
            >
              + Add Row
            </button>
          </div>
          {table.finalRows && table.finalRows.length > 0 ? (
            <div className="flex flex-col gap-4">
              {table.finalRows.map((finalRow, rowIndex) => (
                <div key={rowIndex} className="border border-white border-opacity-20 rounded-lg p-3 bg-black text-white">
                  <div className="flex justify-between items-center mb-2">
                    <strong className="text-sm text-white">Row {rowIndex + 1}</strong>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const newRows = [...table.finalRows!];
                          // Add a new cell at the end
                          newRows[rowIndex].cells.push({
                            label: '',
                            valueType: 'static',
                            value: '',
                            align: 'left',
                            colSpan: 1,
                          });
                          onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                        }}
                        className="px-2 py-1 text-xs bg-green-600 text-white border-none rounded cursor-pointer"
                        title="Add cell to row"
                      >
                        + Cell
                      </button>
                      {rowIndex > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newRows = [...table.finalRows!];
                            [newRows[rowIndex], newRows[rowIndex - 1]] = [newRows[rowIndex - 1], newRows[rowIndex]];
                            onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                          }}
                          className="px-2 py-1 text-xs text-white"
                        >
                          ↑
                        </button>
                      )}
                      {rowIndex < table.finalRows!.length - 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newRows = [...table.finalRows!];
                            [newRows[rowIndex], newRows[rowIndex + 1]] = [newRows[rowIndex + 1], newRows[rowIndex]];
                            onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                          }}
                          className="px-2 py-1 text-xs text-white"
                        >
                          ↓
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const newRows = table.finalRows!.filter((_, i) => i !== rowIndex);
                          onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows.length > 0 ? newRows : undefined });
                        }}
                        className="px-2 py-1 text-xs text-red-500"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {finalRow.cells.map((cell, cellIndex) => {
                      const column = table.columns[cellIndex];
                      if (column && column.visible === false) return null;
                      return (
                        <div key={cellIndex} className="flex flex-col gap-1 p-2 bg-black text-white rounded border border-white border-opacity-20 relative">
                          <div className="flex justify-between items-center">
                            <div className="text-xs text-white font-semibold">
                              Cell {cellIndex + 1} ({column?.label || 'Column ' + (cellIndex + 1)})
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newRows = [...table.finalRows!];
                                newRows[rowIndex].cells = newRows[rowIndex].cells.filter((_, i) => i !== cellIndex);
                                // If no cells left, remove the row
                                if (newRows[rowIndex].cells.length === 0) {
                                  newRows.splice(rowIndex, 1);
                                  onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows.length > 0 ? newRows : undefined });
                                } else {
                                  onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                                }
                              }}
                              className="px-2 py-1 text-xs text-red-500 bg-transparent border border-red-500 rounded cursor-pointer"
                              title="Delete cell"
                            >
                              ×
                            </button>
                          </div>
                          <label className="text-sm text-white">
                            Label:
                            <input
                              type="text"
                              value={cell.label || ''}
                              onChange={(e) => {
                                const newRows = [...table.finalRows!];
                                newRows[rowIndex].cells[cellIndex].label = e.target.value;
                                onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                              }}
                              placeholder="e.g., Sub Total"
                              className="w-full mt-1 px-2 py-1 bg-white bg-opacity-10 border border-white border-opacity-20 rounded text-white placeholder-white placeholder-opacity-50"
                            />
                          </label>
                          <label className="text-sm text-white">
                            Value Type:
                            <select
                              value={cell.valueType || 'static'}
                              onChange={(e) => {
                                const newRows = [...table.finalRows!];
                                newRows[rowIndex].cells[cellIndex].valueType = e.target.value as any;
                                onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                              }}
                              className="w-full mt-1 px-2 py-1 bg-white bg-opacity-10 border border-white border-opacity-20 rounded text-white"
                            >
                              <option value="static" className="bg-black">Static</option>
                              <option value="calculation" className="bg-black">Calculation</option>
                              <option value="formula" className="bg-black">Formula</option>
                            </select>
                          </label>
                          {cell.valueType === 'static' && (
                            <label className="text-sm text-white">
                              Value:
                              <input
                                type="text"
                                value={cell.value || ''}
                                onChange={(e) => {
                                  const newRows = [...table.finalRows!];
                                  newRows[rowIndex].cells[cellIndex].value = e.target.value;
                                  onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                                }}
                                placeholder="e.g., 400"
                                className="w-full mt-1 px-2 py-1 bg-white bg-opacity-10 border border-white border-opacity-20 rounded text-white placeholder-white placeholder-opacity-50"
                              />
                            </label>
                          )}
                          {cell.valueType === 'calculation' && (
                            <>
                              <label className="text-sm text-white">
                                Calculation:
                                <select
                                  value={cell.calculationType || 'sum'}
                                  onChange={(e) => {
                                    const newRows = [...table.finalRows!];
                                    newRows[rowIndex].cells[cellIndex].calculationType = e.target.value as any;
                                    onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                                  }}
                                  className="w-full mt-1 px-2 py-1 bg-white bg-opacity-10 border border-white border-opacity-20 rounded text-white"
                                >
                                  <option value="sum" className="bg-black">Sum</option>
                                  <option value="avg" className="bg-black">Average</option>
                                  <option value="count" className="bg-black">Count</option>
                                  <option value="min" className="bg-black">Min</option>
                                  <option value="max" className="bg-black">Max</option>
                                </select>
                              </label>
                              <label className="text-sm text-white">
                                Source Table/Array:
                                <div className="relative">
                                  <input
                                    ref={finalRowCalculationSourceInputRef}
                                    type="text"
                                    value={cell.calculationSource || ''}
                                    onChange={(e) => {
                                      const newRows = [...table.finalRows!];
                                      newRows[rowIndex].cells[cellIndex].calculationSource = e.target.value;
                                      onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                                    }}
                                    placeholder="e.g., items"
                                    className="w-full mt-1 px-2 py-1 pr-8 bg-white bg-opacity-10 border border-white border-opacity-20 rounded text-white placeholder-white placeholder-opacity-50"
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      const inputElement = (e.currentTarget.parentElement?.querySelector('input') as HTMLElement) || null;
                                      openFinalRowCalculationSourceModal(cell.calculationSource || '', (value) => {
                                        const newRows = [...table.finalRows!];
                                        newRows[rowIndex].cells[cellIndex].calculationSource = value;
                                        onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                                      }, inputElement);
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white text-opacity-60 hover:text-white cursor-pointer"
                                    title="Open data source selector"
                                  >
                                    <Move className="h-4 w-4" />
                                  </button>
                                </div>
                              </label>
                              <label className="text-sm text-white">
                                Field:
                                <div className="relative">
                                  <input
                                    ref={finalRowCalculationFieldInputRef}
                                    type="text"
                                    value={cell.calculationField || ''}
                                    onChange={(e) => {
                                      const newRows = [...table.finalRows!];
                                      newRows[rowIndex].cells[cellIndex].calculationField = e.target.value;
                                      onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                                    }}
                                    placeholder="e.g., rate, price"
                                    className="w-full mt-1 px-2 py-1 pr-8 bg-white bg-opacity-10 border border-white border-opacity-20 rounded text-white placeholder-white placeholder-opacity-50"
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      const inputElement = (e.currentTarget.parentElement?.querySelector('input') as HTMLElement) || null;
                                      openFinalRowCalculationFieldModal(cell.calculationField || '', cell.calculationSource || '', (value) => {
                                        const newRows = [...table.finalRows!];
                                        newRows[rowIndex].cells[cellIndex].calculationField = value;
                                        onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                                      }, inputElement);
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white text-opacity-60 hover:text-white cursor-pointer"
                                    title="Open field selector"
                                  >
                                    <Move className="h-4 w-4" />
                                  </button>
                                </div>
                              </label>
                            </>
                          )}
                          {cell.valueType === 'formula' && (
                            <label className="text-sm text-white">
                              Formula:
                              <input
                                type="text"
                                value={cell.formula || ''}
                                onChange={(e) => {
                                  const newRows = [...table.finalRows!];
                                  newRows[rowIndex].cells[cellIndex].formula = e.target.value;
                                  onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                                }}
                                placeholder="e.g., sum(items.rate) * header.exchangeRate"
                                className="w-full mt-1 px-2 py-1 bg-white bg-opacity-10 border border-white border-opacity-20 rounded text-white placeholder-white placeholder-opacity-50 font-mono text-sm"
                              />
                            </label>
                          )}
                          <div className="flex gap-2 mt-1">
                            <label className="text-sm text-white flex-1">
                              Align:
                              <select
                                value={cell.align || 'left'}
                                onChange={(e) => {
                                  const newRows = [...table.finalRows!];
                                  newRows[rowIndex].cells[cellIndex].align = e.target.value as any;
                                  onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                                }}
                                className="w-full mt-1 px-2 py-1 bg-white bg-opacity-10 border border-white border-opacity-20 rounded text-white"
                              >
                                <option value="left" className="bg-black">Left</option>
                                <option value="center" className="bg-black">Center</option>
                                <option value="right" className="bg-black">Right</option>
                              </select>
                            </label>
                            <label className="text-sm text-white flex-1">
                              Col Span:
                              <div className="relative">
                                <input
                                  ref={finalRowColSpanInputRef}
                                  type="number"
                                  value={cell.colSpan || 1}
                                  min="1"
                                  onChange={(e) => {
                                    const newRows = [...table.finalRows!];
                                    newRows[rowIndex].cells[cellIndex].colSpan = parseInt(e.target.value) || 1;
                                    onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                                  }}
                                  className="w-full mt-1 px-2 py-1 pr-8 bg-white bg-opacity-10 border border-white border-opacity-20 rounded text-white"
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    const inputElement = (e.currentTarget.parentElement?.querySelector('input') as HTMLElement) || null;
                                    openFinalRowColSpanModal(cell.colSpan, (value) => {
                                      const newRows = [...table.finalRows!];
                                      newRows[rowIndex].cells[cellIndex].colSpan = value || 1;
                                      onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                                    }, inputElement);
                                  }}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white text-opacity-60 hover:text-white cursor-pointer"
                                  title="Open column span editor"
                                >
                                  <Move className="h-4 w-4" />
                                </button>
                              </div>
                            </label>
                          </div>
                          <label className="text-sm text-white mt-1">
                            <input
                              type="checkbox"
                              checked={cell.fontWeight === 'bold'}
                              onChange={(e) => {
                                const newRows = [...table.finalRows!];
                                newRows[rowIndex].cells[cellIndex].fontWeight = e.target.checked ? 'bold' : 'normal';
                                onUpdateBillContentTable(selectedElement.index, { ...table, finalRows: newRows });
                              }}
                            />
                            Bold
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.875rem', color: '#6c757d', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>
              No final rows. Click "Add Row" to create one.
            </p>
          )}
        </div>
        <ActionBar />
      </div>
        <PositionModal />
        <WidthModal />
        <FontSizeModal />
        <TablePaddingModal />
        <TableFontSizeModal />
        <TableWidthModal />
        <ColumnBindingModal />
        <ColumnWidthModal />
        <ColumnHeightModal />
        <ColumnRowSpanModal />
        <ColumnColSpanModal />
        <ColumnCalculationModal />
        <FinalRowColSpanModal />
        <FinalRowCalculationSourceModal />
        <FinalRowCalculationFieldModal />
      </>
    );
  }

  if (selectedElement.type === 'table' && template.itemsTable) {
    const table = template.itemsTable;
    const selectedColumns = itemsTableSelectedColumns;
    const setSelectedColumns = setItemsTableSelectedColumns;

    const updateColumn = (index: number, updates: Partial<TableColumnConfig>) => {
      const newColumns = table.columns.map((col, i) =>
        i === index ? { ...col, ...updates } : col
      );
      onUpdateTable({ ...table, columns: newColumns });
    };

    const toggleColumnSelection = (index: number) => {
      const newSelected = new Set(selectedColumns);
      if (newSelected.has(index)) {
        newSelected.delete(index);
      } else {
        newSelected.add(index);
      }
      setSelectedColumns(newSelected);
    };

    const deleteSelectedColumns = () => {
      const newColumns = table.columns.filter((_, i) => !selectedColumns.has(i));
      onUpdateTable({ ...table, columns: newColumns });
      setSelectedColumns(new Set());
    };

    const toggleAllColumns = () => {
      if (selectedColumns.size === table.columns.length) {
        setSelectedColumns(new Set());
      } else {
        setSelectedColumns(new Set(table.columns.map((_, i) => i)));
      }
    };

    return (
      <>
      <div className="property-panel">
        <div className="property-group">
          <h4>Items Table</h4>
          {onOpenTableModal && (
            <button
            className="open-modal-button"
            onClick={() =>
              onOpenTableModal('itemsTable', selectedElement.index)
            }
            style={{
              marginTop: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: '#000',
              color: '#fff',
              border: '1px solid #000',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: 600,
              width: '100%',
              transition: 'background-color 0.2s ease, color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#fff';
              e.currentTarget.style.color = '#000';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#000';
              e.currentTarget.style.color = '#fff';
            }}
          >
            <Palette
              size={16}
              style={{
                display: 'inline-block',
                marginRight: '0.5rem',
                verticalAlign: 'middle',
              }}
            />
            Open Table Editor
          </button>
          
          )}
        </div>
        <div className="property-group">
          <h4>Layout</h4>
          <label>
            Orientation:
            <select
              value={table.orientation || 'vertical'}
              onChange={(e) => onUpdateTable({ ...table, orientation: e.target.value as 'vertical' | 'horizontal' })}
            >
              <option value="vertical">Vertical (Normal)</option>
              <option value="horizontal">Horizontal (Transposed)</option>
            </select>
          </label>
        </div>
        <div className="property-group">
          <h4>Position</h4>
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="block text-sm font-medium mb-1">X:</span>
              <div className="relative">
            <input
                  ref={positionXInputRef}
              type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
              value={table.x || 0}
              onChange={(e) => onUpdateTable({ ...table, x: parseFloat(e.target.value) || 0 })}
            />
                <button
                  type="button"
                  onClick={() => openPositionModal(table.x || 0, table.y || 0, (x, y) => {
                    onUpdateTable({ ...table, x, y });
                  }, positionXInputRef)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  title="Open position editor"
                >
                  <Move className="h-4 w-4" />
                </button>
              </div>
          </label>
            <label className="flex-1">
              <span className="block text-sm font-medium mb-1">Y:</span>
              <div className="relative">
            <input
                  ref={positionYInputRef}
              type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
              value={table.y || 0}
              onChange={(e) => onUpdateTable({ ...table, y: parseFloat(e.target.value) || 0 })}
            />
                <button
                  type="button"
                  onClick={() => openPositionModal(table.x || 0, table.y || 0, (x, y) => {
                    onUpdateTable({ ...table, x, y });
                  }, positionYInputRef)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  title="Open position editor"
                >
                  <Move className="h-4 w-4" />
                </button>
              </div>
          </label>
          </div>
        </div>
        <div className="property-group">
          <h4>Borders</h4>
          <label>
            Color:
            <input
              type="color"
              value={table.borderColor || '#dddddd'}
              onChange={(e) => onUpdateTable({ ...table, borderColor: e.target.value })}
            />
          </label>
          <label>
            Width:
            <input
              type="number"
              value={table.borderWidth || 1}
              min="0"
              step="0.5"
              onChange={(e) => onUpdateTable({ ...table, borderWidth: parseFloat(e.target.value) || 1 })}
            />
          </label>
        </div>
        <div className="property-group">
          <h4>Header</h4>
          <label>
            Bg Color:
            <input
              type="color"
              value={table.headerBackgroundColor || '#f0f0f0'}
              onChange={(e) => onUpdateTable({ ...table, headerBackgroundColor: e.target.value })}
            />
          </label>
          <label>
            Text Color:
            <input
              type="color"
              value={table.headerTextColor || '#000000'}
              onChange={(e) => onUpdateTable({ ...table, headerTextColor: e.target.value })}
            />
          </label>
        </div>
        <div className="property-group">
          <h4>Style</h4>
          <label>
            Padding:
            <div className="relative">
            <input
                ref={tablePaddingInputRef}
              type="number"
              value={table.cellPadding || 10}
              min="0"
              step="1"
                className="w-full pr-10"
              onChange={(e) => onUpdateTable({ ...table, cellPadding: parseFloat(e.target.value) || 10 })}
            />
              <button
                type="button"
                onClick={() => openTablePaddingModal(table.cellPadding || 10, (value) => {
                  onUpdateTable({ ...table, cellPadding: value });
                }, tablePaddingInputRef)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                title="Open padding editor"
              >
                <Move className="h-4 w-4" />
              </button>
            </div>
          </label>
          <label>
            Font Size:
            <div className="relative">
            <input
                ref={tableFontSizeInputRef}
              type="number"
              value={table.fontSize || ''}
              min="8"
              step="1"
                className="w-full pr-10"
              onChange={(e) => onUpdateTable({ ...table, fontSize: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="Auto"
            />
              <button
                type="button"
                onClick={() => openTableFontSizeModal(table.fontSize, (value) => {
                  onUpdateTable({ ...table, fontSize: value });
                }, tableFontSizeInputRef)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                title="Open font size editor"
              >
                <Move className="h-4 w-4" />
              </button>
            </div>
          </label>
          <label>
            <input
              type="checkbox"
              checked={!!table.alternateRowColor}
              onChange={(e) => onUpdateTable({ ...table, alternateRowColor: e.target.checked ? '#f9f9f9' : undefined })}
            />
            Alt Row Color
          </label>
          {table.alternateRowColor && (
            <label>
              Alt Row Color:
              <input
                type="color"
                value={table.alternateRowColor}
                onChange={(e) => onUpdateTable({ ...table, alternateRowColor: e.target.value })}
              />
            </label>
          )}
          <label>
            Width:
            <div className="relative">
            <input
                ref={tableWidthInputRef}
              type="number"
              value={table.tableWidth || ''}
              min="100"
              step="10"
                className="w-full pr-10"
              onChange={(e) => onUpdateTable({ ...table, tableWidth: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="Auto"
            />
              <button
                type="button"
                onClick={() => openTableWidthModal(table.tableWidth, (value) => {
                  onUpdateTable({ ...table, tableWidth: value });
                }, tableWidthInputRef)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                title="Open width editor"
              >
                <Move className="h-4 w-4" />
              </button>
            </div>
          </label>
        </div>
        <div className="property-group column-group">
          <div className="column-header">
            <h4>Columns ({table.columns.length})</h4>
            <div className="column-actions">
              <button
                type="button"
                className="action-button"
                onClick={toggleAllColumns}
              >
                {selectedColumns.size === table.columns.length ? 'Deselect' : 'Select All'}
              </button>
              {selectedColumns.size > 0 && (
                <button
                  type="button"
                  className="action-button delete-button"
                  onClick={deleteSelectedColumns}
                >
                  Delete ({selectedColumns.size})
                </button>
              )}
            </div>
          </div>
          {table.columns.map((col, index) => (
            <div
              key={index}
              className={`column-item ${selectedColumns.has(index) ? 'selected' : ''}`}
            >
              <label className="column-select">
                <input
                  type="checkbox"
                  checked={selectedColumns.has(index)}
                  onChange={() => toggleColumnSelection(index)}
                />
                <span className="column-number">#{index + 1}</span>
              </label>
              <div className="column-fields">
                <label>
                  Label:
                  <input
                    type="text"
                    value={col.label}
                    onChange={(e) => updateColumn(index, { label: e.target.value })}
                  />
                </label>
                <label>
                  Binding:
                  <div className="relative">
                  <input
                      ref={columnBindingInputRef}
                    type="text"
                      className="w-full pr-10"
                    value={col.bind}
                    onChange={(e) => updateColumn(index, { bind: e.target.value })}
                    placeholder="Field"
                  />
                    <button
                      type="button"
                      onClick={(e) => {
                        const inputElement = (e.currentTarget.parentElement?.querySelector('input') as HTMLElement) || null;
                        openColumnBindingModal(col.bind || '', (value) => {
                          updateColumn(index, { bind: value });
                        }, inputElement);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                      title="Open binding editor"
                    >
                      <Move className="h-4 w-4" />
                    </button>
                  </div>
                </label>
                <label>
                  Width:
                  <div className="relative">
                  <input
                      ref={columnWidthInputRef}
                    type="number"
                    value={col.width || ''}
                    min="0"
                    step="1"
                      className="w-full pr-10"
                    onChange={(e) => updateColumn(index, { width: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="Auto"
                  />
                    <button
                      type="button"
                      onClick={(e) => {
                        const inputElement = (e.currentTarget.parentElement?.querySelector('input') as HTMLElement) || null;
                        openColumnWidthModal(col.width, (value) => {
                          updateColumn(index, { width: value });
                        }, inputElement);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                      title="Open width editor"
                    >
                      <Move className="h-4 w-4" />
                    </button>
                  </div>
                </label>
                <label>
                  Height:
                  <div className="relative">
                  <input
                      ref={columnHeightInputRef}
                    type="number"
                    value={col.height || ''}
                    min="0"
                    step="1"
                      className="w-full pr-10"
                    onChange={(e) => updateColumn(index, { height: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="Auto"
                  />
                    <button
                      type="button"
                      onClick={(e) => {
                        const inputElement = (e.currentTarget.parentElement?.querySelector('input') as HTMLElement) || null;
                        openColumnHeightModal(col.height, (value) => {
                          updateColumn(index, { height: value });
                        }, inputElement);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                      title="Open height editor"
                    >
                      <Move className="h-4 w-4" />
                    </button>
                  </div>
                </label>
                <label>
                  Align:
                  <select
                    value={col.align || 'left'}
                    onChange={(e) => updateColumn(index, { align: e.target.value as 'left' | 'center' | 'right' })}
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </label>
                <label>
                  Row Span:
                  <div className="relative">
                  <input
                      ref={columnRowSpanInputRef}
                    type="number"
                    value={col.rowSpan || ''}
                    min="1"
                    step="1"
                      className="w-full pr-10"
                    onChange={(e) => updateColumn(index, { rowSpan: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="1"
                  />
                    <button
                      type="button"
                      onClick={(e) => {
                        const inputElement = (e.currentTarget.parentElement?.querySelector('input') as HTMLElement) || null;
                        openColumnRowSpanModal(col.rowSpan, (value) => {
                          updateColumn(index, { rowSpan: value });
                        }, inputElement);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                      title="Open row span editor"
                    >
                      <Move className="h-4 w-4" />
                    </button>
                  </div>
                </label>
                <label>
                  Column Span:
                  <div className="relative">
                  <input
                      ref={columnColSpanInputRef}
                    type="number"
                    value={col.colSpan || ''}
                    min="1"
                    step="1"
                      className="w-full pr-10"
                    onChange={(e) => updateColumn(index, { colSpan: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="1"
                  />
                    <button
                      type="button"
                      onClick={(e) => {
                        const inputElement = (e.currentTarget.parentElement?.querySelector('input') as HTMLElement) || null;
                        openColumnColSpanModal(col.colSpan, (value) => {
                          updateColumn(index, { colSpan: value });
                        }, inputElement);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                      title="Open column span editor"
                    >
                      <Move className="h-4 w-4" />
                    </button>
                  </div>
                </label>
                <div className="property-group" style={{ marginTop: '0.5rem', padding: '0.75rem', background: '#f8f9fa', borderRadius: '6px' }}>
                  <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 600 }}>Data Manipulation</h5>
                  <label>
                    Calculation Type:
                    <div className="relative">
                    <select
                        ref={columnCalculationInputRef}
                        className="w-full pr-10"
                      value={col.calculationType || 'none'}
                      onChange={(e) => updateColumn(index, { calculationType: e.target.value as any })}
                    >
                      <option value="none">None</option>
                      <option value="sum">Sum</option>
                      <option value="avg">Average</option>
                      <option value="count">Count</option>
                      <option value="min">Min</option>
                      <option value="max">Max</option>
                      <option value="custom">Custom Formula</option>
                    </select>
                      <button
                        type="button"
                        onClick={(e) => {
                          const selectElement = (e.currentTarget.parentElement?.querySelector('select') as HTMLElement) || null;
                          openColumnCalculationModal({
                            calculationType: col.calculationType || 'none',
                            calculationSource: col.calculationSource,
                            calculationField: col.calculationField,
                            calculationFormula: col.calculationFormula,
                          }, (value) => {
                            updateColumn(index, value as any);
                          }, selectElement);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                        title="Open calculation editor"
                      >
                        <Move className="h-4 w-4" />
                      </button>
                    </div>
                  </label>
                  {(col.calculationType && col.calculationType !== 'none') && (
                    <>
                      {col.calculationType !== 'custom' && (
                        <>
                          <label>
                            Source Table/Array:
                            <input
                              type="text"
                              value={col.calculationSource || ''}
                              onChange={(e) => updateColumn(index, { calculationSource: e.target.value })}
                              placeholder="e.g., items, contentDetails.items"
                            />
                          </label>
                          <label>
                            Field to Calculate:
                            <input
                              type="text"
                              value={col.calculationField || ''}
                              onChange={(e) => updateColumn(index, { calculationField: e.target.value })}
                              placeholder="e.g., rate, price"
                            />
                          </label>
                        </>
                      )}
                      {col.calculationType === 'custom' && (
                        <label>
                          Custom Formula:
                          <input
                            type="text"
                            value={col.calculationFormula || ''}
                            onChange={(e) => updateColumn(index, { calculationFormula: e.target.value })}
                            placeholder="e.g., sum(items.rate) * header.exchangeRate"
                            style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                          />
                        </label>
                      )}
                    </>
                  )}
                </div>
                <label>
                  <input
                    type="checkbox"
                    checked={col.visible}
                    onChange={(e) => updateColumn(index, { visible: e.target.checked })}
                  />
                  Visible
                </label>
              </div>
            </div>
          ))}
        </div>
        <div className="property-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h4>Final Rows</h4>
            <button
              type="button"
              className="action-button"
              onClick={() => {
                const visibleColumns = table.columns.filter(col => col.visible !== false);
                const newRow: FinalRowConfig = {
                  cells: visibleColumns.map(() => ({
                    label: '',
                    valueType: 'static',
                    value: '',
                    align: 'left',
                    colSpan: 1,
                  })),
                  visible: true,
                };
                onUpdateTable({
                  ...table,
                  finalRows: [...(table.finalRows || []), newRow],
                });
              }}
              style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
            >
              + Add Row
            </button>
          </div>
          {table.finalRows && table.finalRows.length > 0 ? (
            <div className="flex flex-col gap-4">
              {table.finalRows.map((finalRow, rowIndex) => (
                <div key={rowIndex} className="border border-white border-opacity-20 rounded-lg p-3 bg-black text-white">
                  <div className="flex justify-between items-center mb-2">
                    <strong className="text-sm text-white">Row {rowIndex + 1}</strong>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const newRows = [...table.finalRows!];
                          // Add a new cell at the end
                          newRows[rowIndex].cells.push({
                            label: '',
                            valueType: 'static',
                            value: '',
                            align: 'left',
                            colSpan: 1,
                          });
                          onUpdateTable({ ...table, finalRows: newRows });
                        }}
                        className="px-2 py-1 text-xs bg-green-600 text-white border-none rounded cursor-pointer"
                        title="Add cell to row"
                      >
                        + Cell
                      </button>
                      {rowIndex > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newRows = [...table.finalRows!];
                            [newRows[rowIndex], newRows[rowIndex - 1]] = [newRows[rowIndex - 1], newRows[rowIndex]];
                            onUpdateTable({ ...table, finalRows: newRows });
                          }}
                          className="px-2 py-1 text-xs text-white"
                        >
                          ↑
                        </button>
                      )}
                      {rowIndex < table.finalRows!.length - 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newRows = [...table.finalRows!];
                            [newRows[rowIndex], newRows[rowIndex + 1]] = [newRows[rowIndex + 1], newRows[rowIndex]];
                            onUpdateTable({ ...table, finalRows: newRows });
                          }}
                          className="px-2 py-1 text-xs text-white"
                        >
                          ↓
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const newRows = table.finalRows!.filter((_, i) => i !== rowIndex);
                          onUpdateTable({ ...table, finalRows: newRows.length > 0 ? newRows : undefined });
                        }}
                        className="px-2 py-1 text-xs text-red-500"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {finalRow.cells.map((cell, cellIndex) => {
                      const column = table.columns[cellIndex];
                      if (column && column.visible === false) return null;
                      return (
                        <div key={cellIndex} className="flex flex-col gap-1 p-2 bg-black text-white rounded border border-white border-opacity-20 relative">
                          <div className="flex justify-between items-center">
                            <div className="text-xs text-white font-semibold">
                              Cell {cellIndex + 1} ({column?.label || 'Column ' + (cellIndex + 1)})
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newRows = [...table.finalRows!];
                                newRows[rowIndex].cells = newRows[rowIndex].cells.filter((_, i) => i !== cellIndex);
                                // If no cells left, remove the row
                                if (newRows[rowIndex].cells.length === 0) {
                                  newRows.splice(rowIndex, 1);
                                  onUpdateTable({ ...table, finalRows: newRows.length > 0 ? newRows : undefined });
                                } else {
                                  onUpdateTable({ ...table, finalRows: newRows });
                                }
                              }}
                              className="px-2 py-1 text-xs text-red-500 bg-transparent border border-red-500 rounded cursor-pointer"
                              title="Delete cell"
                            >
                              ×
                            </button>
                          </div>
                          <label className="text-sm text-white">
                            Label:
                            <input
                              type="text"
                              value={cell.label || ''}
                              onChange={(e) => {
                                const newRows = [...table.finalRows!];
                                newRows[rowIndex].cells[cellIndex].label = e.target.value;
                                onUpdateTable({ ...table, finalRows: newRows });
                              }}
                              placeholder="e.g., Sub Total"
                              className="w-full mt-1 px-2 py-1 bg-white bg-opacity-10 border border-white border-opacity-20 rounded text-white placeholder-white placeholder-opacity-50"
                            />
                          </label>
                          <label className="text-sm text-white">
                            Value Type:
                            <select
                              value={cell.valueType || 'static'}
                              onChange={(e) => {
                                const newRows = [...table.finalRows!];
                                newRows[rowIndex].cells[cellIndex].valueType = e.target.value as any;
                                onUpdateTable({ ...table, finalRows: newRows });
                              }}
                              className="w-full mt-1 px-2 py-1 bg-white bg-opacity-10 border border-white border-opacity-20 rounded text-white"
                            >
                              <option value="static" className="bg-black">Static</option>
                              <option value="calculation" className="bg-black">Calculation</option>
                              <option value="formula" className="bg-black">Formula</option>
                            </select>
                          </label>
                          {cell.valueType === 'static' && (
                            <label className="text-sm text-white">
                              Value:
                              <input
                                type="text"
                                value={cell.value || ''}
                                onChange={(e) => {
                                  const newRows = [...table.finalRows!];
                                  newRows[rowIndex].cells[cellIndex].value = e.target.value;
                                  onUpdateTable({ ...table, finalRows: newRows });
                                }}
                                placeholder="e.g., 400"
                                className="w-full mt-1 px-2 py-1 bg-white bg-opacity-10 border border-white border-opacity-20 rounded text-white placeholder-white placeholder-opacity-50"
                              />
                            </label>
                          )}
                          {cell.valueType === 'calculation' && (
                            <>
                              <label className="text-sm text-white">
                                Calculation:
                                <select
                                  value={cell.calculationType || 'sum'}
                                  onChange={(e) => {
                                    const newRows = [...table.finalRows!];
                                    newRows[rowIndex].cells[cellIndex].calculationType = e.target.value as any;
                                    onUpdateTable({ ...table, finalRows: newRows });
                                  }}
                                  className="w-full mt-1 px-2 py-1 bg-white bg-opacity-10 border border-white border-opacity-20 rounded text-white"
                                >
                                  <option value="sum" className="bg-black">Sum</option>
                                  <option value="avg" className="bg-black">Average</option>
                                  <option value="count" className="bg-black">Count</option>
                                  <option value="min" className="bg-black">Min</option>
                                  <option value="max" className="bg-black">Max</option>
                                </select>
                              </label>
                              <label className="text-sm text-white">
                                Source Table/Array:
                                <div className="relative">
                                  <input
                                    ref={finalRowCalculationSourceInputRef}
                                    type="text"
                                    value={cell.calculationSource || ''}
                                    onChange={(e) => {
                                      const newRows = [...table.finalRows!];
                                      newRows[rowIndex].cells[cellIndex].calculationSource = e.target.value;
                                      onUpdateTable({ ...table, finalRows: newRows });
                                    }}
                                    placeholder="e.g., items"
                                    className="w-full mt-1 px-2 py-1 pr-8 bg-white bg-opacity-10 border border-white border-opacity-20 rounded text-white placeholder-white placeholder-opacity-50"
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      const inputElement = (e.currentTarget.parentElement?.querySelector('input') as HTMLElement) || null;
                                      openFinalRowCalculationSourceModal(cell.calculationSource || '', (value) => {
                                        const newRows = [...table.finalRows!];
                                        newRows[rowIndex].cells[cellIndex].calculationSource = value;
                                        onUpdateTable({ ...table, finalRows: newRows });
                                      }, inputElement);
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white text-opacity-60 hover:text-white cursor-pointer"
                                    title="Open data source selector"
                                  >
                                    <Move className="h-4 w-4" />
                                  </button>
                                </div>
                              </label>
                              <label className="text-sm text-white">
                                Field:
                                <div className="relative">
                                  <input
                                    ref={finalRowCalculationFieldInputRef}
                                    type="text"
                                    value={cell.calculationField || ''}
                                    onChange={(e) => {
                                      const newRows = [...table.finalRows!];
                                      newRows[rowIndex].cells[cellIndex].calculationField = e.target.value;
                                      onUpdateTable({ ...table, finalRows: newRows });
                                    }}
                                    placeholder="e.g., rate, price"
                                    className="w-full mt-1 px-2 py-1 pr-8 bg-white bg-opacity-10 border border-white border-opacity-20 rounded text-white placeholder-white placeholder-opacity-50"
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      const inputElement = (e.currentTarget.parentElement?.querySelector('input') as HTMLElement) || null;
                                      openFinalRowCalculationFieldModal(cell.calculationField || '', cell.calculationSource || '', (value) => {
                                        const newRows = [...table.finalRows!];
                                        newRows[rowIndex].cells[cellIndex].calculationField = value;
                                        onUpdateTable({ ...table, finalRows: newRows });
                                      }, inputElement);
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white text-opacity-60 hover:text-white cursor-pointer"
                                    title="Open field selector"
                                  >
                                    <Move className="h-4 w-4" />
                                  </button>
                                </div>
                              </label>
                            </>
                          )}
                          {cell.valueType === 'formula' && (
                            <label className="text-sm text-white">
                              Formula:
                              <input
                                type="text"
                                value={cell.formula || ''}
                                onChange={(e) => {
                                  const newRows = [...table.finalRows!];
                                  newRows[rowIndex].cells[cellIndex].formula = e.target.value;
                                  onUpdateTable({ ...table, finalRows: newRows });
                                }}
                                placeholder="e.g., sum(items.rate) * header.exchangeRate"
                                className="w-full mt-1 px-2 py-1 bg-white bg-opacity-10 border border-white border-opacity-20 rounded text-white placeholder-white placeholder-opacity-50 font-mono text-sm"
                              />
                            </label>
                          )}
                          <div className="flex gap-2 mt-1">
                            <label className="text-sm text-white flex-1">
                              Align:
                              <select
                                value={cell.align || 'left'}
                                onChange={(e) => {
                                  const newRows = [...table.finalRows!];
                                  newRows[rowIndex].cells[cellIndex].align = e.target.value as any;
                                  onUpdateTable({ ...table, finalRows: newRows });
                                }}
                                className="w-full mt-1 px-2 py-1 bg-white bg-opacity-10 border border-white border-opacity-20 rounded text-white"
                              >
                                <option value="left" className="bg-black">Left</option>
                                <option value="center" className="bg-black">Center</option>
                                <option value="right" className="bg-black">Right</option>
                              </select>
                            </label>
                            <label className="text-sm text-white flex-1">
                              Col Span:
                              <div className="relative">
                                <input
                                  ref={finalRowColSpanInputRef}
                                  type="number"
                                  value={cell.colSpan || 1}
                                  min="1"
                                  onChange={(e) => {
                                    const newRows = [...table.finalRows!];
                                    newRows[rowIndex].cells[cellIndex].colSpan = parseInt(e.target.value) || 1;
                                    onUpdateTable({ ...table, finalRows: newRows });
                                  }}
                                  className="w-full mt-1 px-2 py-1 pr-8 bg-white bg-opacity-10 border border-white border-opacity-20 rounded text-white"
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    const inputElement = (e.currentTarget.parentElement?.querySelector('input') as HTMLElement) || null;
                                    openFinalRowColSpanModal(cell.colSpan, (value) => {
                                      const newRows = [...table.finalRows!];
                                      newRows[rowIndex].cells[cellIndex].colSpan = value || 1;
                                      onUpdateTable({ ...table, finalRows: newRows });
                                    }, inputElement);
                                  }}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white text-opacity-60 hover:text-white cursor-pointer"
                                  title="Open column span editor"
                                >
                                  <Move className="h-4 w-4" />
                                </button>
                              </div>
                            </label>
                          </div>
                          <label className="text-sm text-white mt-1">
                            <input
                              type="checkbox"
                              checked={cell.fontWeight === 'bold'}
                              onChange={(e) => {
                                const newRows = [...table.finalRows!];
                                newRows[rowIndex].cells[cellIndex].fontWeight = e.target.checked ? 'bold' : 'normal';
                                onUpdateTable({ ...table, finalRows: newRows });
                              }}
                              className="mr-2"
                            />
                            Bold
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.875rem', color: '#6c757d', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>
              No final rows. Click "Add Row" to create one.
            </p>
          )}
        </div>
        {onUpdatePagination && (
          <div className="property-group">
            <h4>Pagination</h4>
            <label>
              Rows Per Page (auto if empty):
              <input
                type="number"
                value={template.pagination?.rowsPerPage || ''}
                min="1"
                onChange={(e) => onUpdatePagination({ 
                  rowsPerPage: e.target.value ? parseInt(e.target.value) : undefined,
                  repeatHeader: template.pagination?.repeatHeader !== false
                })}
                placeholder="Auto"
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={template.pagination?.repeatHeader !== false}
                onChange={(e) => onUpdatePagination({ 
                  rowsPerPage: template.pagination?.rowsPerPage,
                  repeatHeader: e.target.checked
                })}
              />
              Repeat Table Header on Each Page
            </label>
          </div>
        )}
        <ActionBar />
      </div>
        <PositionModal />
        <WidthModal />
        <FontSizeModal />
        <TablePaddingModal />
        <TableFontSizeModal />
        <TableWidthModal />
        <ColumnBindingModal />
        <ColumnWidthModal />
        <ColumnHeightModal />
        <ColumnRowSpanModal />
        <ColumnColSpanModal />
        <ColumnCalculationModal />
        <FinalRowColSpanModal />
        <FinalRowCalculationSourceModal />
        <FinalRowCalculationFieldModal />
      </>
    );
  }

  return (
    <>
      <PositionModal />
      <WidthModal />
      <FontSizeModal />
      <TablePaddingModal />
      <TableFontSizeModal />
      <TableWidthModal />
      <ColumnBindingModal />
      <ColumnWidthModal />
      <ColumnHeightModal />
      <ColumnRowSpanModal />
      <ColumnColSpanModal />
      <ColumnCalculationModal />
      <FinalRowColSpanModal />
      <FinalRowCalculationSourceModal />
      <FinalRowCalculationFieldModal />
    </>
  );
};

export default PropertyPanel;

