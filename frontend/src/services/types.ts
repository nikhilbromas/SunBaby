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

export interface ImageFieldConfig {
  type: 'image';
  imageId: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  visible: boolean;
  watermark?: boolean;
}

export interface TableColumnConfig {
  bind: string;
  label: string;
  visible: boolean;
  width?: number;
  height?: number; // Column-based height customization
  align?: 'left' | 'center' | 'right';
  rowSpan?: number; // Row merging (number of rows to span)
  colSpan?: number; // Column merging (number of columns to span)
  // Data manipulation properties
  calculationType?: 'none' | 'sum' | 'avg' | 'count' | 'min' | 'max' | 'custom'; // Calculation type
  calculationSource?: string; // Source table/array (e.g., 'items', 'contentDetails.items')
  calculationField?: string; // Field to calculate from (e.g., 'rate', 'price')
  calculationFormula?: string; // Custom formula (e.g., 'sum(items.rate) * header.exchangeRate')
}

export interface FinalRowCellConfig {
  label?: string; // Static label/text for the cell
  valueType?: 'static' | 'calculation' | 'formula'; // Type of value
  value?: string; // Static value or calculation/formula
  // For calculation type
  calculationType?: 'sum' | 'avg' | 'count' | 'min' | 'max';
  calculationSource?: string; // Source table/array (e.g., 'items', 'contentDetails.items')
  calculationField?: string; // Field to calculate from (e.g., 'rate', 'price')
  // For formula type
  formula?: string; // Custom formula (e.g., 'sum(items.rate) * header.exchangeRate')
  // Cell properties
  align?: 'left' | 'center' | 'right';
  colSpan?: number; // Number of columns to span
  fontWeight?: 'normal' | 'bold';
  fontSize?: number;
  color?: string;
}

export interface FinalRowConfig {
  cells: FinalRowCellConfig[]; // One cell per column (or merged columns)
  visible?: boolean;
  backgroundColor?: string;
  borderTop?: boolean; // Whether to show top border (separator)
}

export interface ItemsTableConfig {
  columns: TableColumnConfig[];
  x?: number;
  y?: number;
  // Layout properties
  orientation?: 'vertical' | 'horizontal'; // Table orientation: vertical (normal) or horizontal (transposed)
  // Style properties
  borderColor?: string;
  borderWidth?: number;
  headerBackgroundColor?: string;
  headerTextColor?: string;
  cellPadding?: number;
  fontSize?: number;
  alternateRowColor?: string;
  tableWidth?: number;
  // Final rows (custom rows at the end of table)
  finalRows?: FinalRowConfig[];
}

export interface ContentDetailsTableConfig {
  contentName: string; // Reference to content detail name from preset
  columns: TableColumnConfig[];
  x?: number;
  y?: number;
  // Layout properties
  orientation?: 'vertical' | 'horizontal'; // Table orientation: vertical (normal) or horizontal (transposed)
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
  // Final rows (custom rows at the end of table)
  finalRows?: FinalRowConfig[];
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
  pageHeaderImages?: ImageFieldConfig[];
  pageFooter?: TextFieldConfig[];
  pageFooterImages?: ImageFieldConfig[];
  header: TextFieldConfig[];
  headerImages?: ImageFieldConfig[];
  billContent?: TextFieldConfig[];
  billContentImages?: ImageFieldConfig[];
  billContentTables?: ItemsTableConfig[];
  billFooter?: TextFieldConfig[];
  billFooterImages?: ImageFieldConfig[];
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
  companyId?: number;
  templateId: number;
  parameters: Record<string, any>;
}

export interface PreviewData {
  header: Record<string, any> | null;
  items: Record<string, any>[];
  contentDetails?: Record<string, { data: Record<string, any>[] | Record<string, any> | null; fields: string[]; sampleCount: number; dataType?: 'array' | 'object' }>;
  templateId: number;
}

// ---- Auth / Company Selection ----

export interface UserPermissions {
  AllowPreset: boolean;
  AllowTemplate: boolean;
  AllowPreview: boolean;
}

export interface Company {
  CompanyId: number;
  CompanyName?: string | null;
  PermanentAddress?: string | null;
  CompanyDescription?: string | null;
  PhoneNo?: string | null;
  Permissions: UserPermissions;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user_id: number;
  email: string;
  companies: Company[];
}

export interface CompanySelectRequest {
  company_id: number;
}

export interface CompanySelectResponse {
  success: boolean;
  company_id: number;
  company_name?: string | null;
  permissions: UserPermissions;
}

export interface MeResponse {
  user_id: number;
  email: string;
  company_id?: number | null;
  company_name?: string | null;
  permissions?: UserPermissions | null;
}

// ---- Image Management ----

export interface Image {
  ImageId: number;
  ImageName: string;
  FilePath: string;
  Base64Data: string;
  FileSize: number;
  Width: number;
  Height: number;
  MimeType: string;
  CreatedBy?: string | null;
  CreatedOn: string;
  IsActive: boolean;
}

export interface ImageListResponse {
  images: Image[];
  total: number;
}

