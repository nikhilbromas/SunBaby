/**
 * TypeScript interfaces matching backend models.
 */

export interface ContentDetail {
  name: string;
  query: string;
  dataType?: 'array' | 'object'; // 'array' for multiple rows (like items), 'object' for single row (like header)
}

export interface SqlJson {
  headerQuery?: string;
  itemQuery?: string;
  contentDetails?: ContentDetail[];
}

export interface Preset {
  PresetId: number;
  PresetName: string;
  SqlJson: string;
  ExpectedParams?: string;
  CreatedBy?: string;
  CreatedOn: string;
  UpdatedOn?: string | null;
  IsActive: boolean;
}

export interface PresetCreate {
  presetName: string;
  sqlJson: string;
  expectedParams?: string;
  createdBy?: string;
}

export interface PresetUpdate {
  presetName?: string;
  sqlJson?: string;
  expectedParams?: string;
  isActive?: boolean;
}

export interface PresetListResponse {
  presets: Preset[];
  total: number;
}

export interface PageConfig {
  size: string;
  orientation: 'portrait' | 'landscape';
}

export interface TextFieldConfig {
  type: string;
  label: string;
  bind: string;
  x: number;
  y: number;
  visible: boolean;
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  fieldType?: 'text' | 'pageNumber' | 'totalPages' | 'currentDate' | 'currentTime';
}

export interface TableColumnConfig {
  bind: string;
  label: string;
  visible: boolean;
  width?: number;
  align?: 'left' | 'center' | 'right';
}

export interface ItemsTableConfig {
  columns: TableColumnConfig[];
  x?: number;
  y?: number;
  // Style properties
  borderColor?: string;
  borderWidth?: number;
  headerBackgroundColor?: string;
  headerTextColor?: string;
  cellPadding?: number;
  fontSize?: number;
  alternateRowColor?: string;
  tableWidth?: number;
}

export interface ContentDetailsTableConfig {
  contentName: string; // Reference to content detail name from preset
  columns: TableColumnConfig[];
  x?: number;
  y?: number;
  // Style properties
  borderColor?: string;
  borderWidth?: number;
  headerBackgroundColor?: string;
  headerTextColor?: string;
  cellPadding?: number;
  fontSize?: number;
  alternateRowColor?: string;
  tableWidth?: number;
  rowsPerPage?: number;
}

export interface PaginationConfig {
  rowsPerPage?: number;
  repeatHeader?: boolean;
}

export interface SectionHeights {
  pageHeader?: number;
  billHeader?: number;
  billContent?: number;
  billFooter?: number;
  pageFooter?: number;
}

export interface TemplateJson {
  page: PageConfig;
  pageHeader?: TextFieldConfig[];
  pageFooter?: TextFieldConfig[];
  header: TextFieldConfig[];
  billContent?: TextFieldConfig[];
  billContentTables?: ItemsTableConfig[];
  billFooter?: TextFieldConfig[];
  itemsTable?: ItemsTableConfig;
  contentDetailsTables?: ContentDetailsTableConfig[];
  pagination?: PaginationConfig;
  sectionHeights?: SectionHeights;
}

export interface Template {
  TemplateId: number;
  PresetId: number;
  TemplateName: string;
  TemplateJson: string;
  CreatedBy?: string;
  CreatedOn: string;
  UpdatedOn?: string | null;
  IsActive: boolean;
}

export interface TemplateCreate {
  presetId: number;
  templateName: string;
  templateJson: string;
  createdBy?: string;
}

export interface TemplateUpdate {
  templateName?: string;
  templateJson?: string;
  isActive?: boolean;
}

export interface TemplateListResponse {
  templates: Template[];
  total: number;
}

export interface PreviewRequest {
  templateId: number;
  parameters: Record<string, any>;
}

export interface PreviewData {
  header: Record<string, any> | null;
  items: Record<string, any>[];
  contentDetails?: Record<string, { data: Record<string, any>[] | Record<string, any> | null; fields: string[]; sampleCount: number; dataType?: 'array' | 'object' }>;
  templateId: number;
}

