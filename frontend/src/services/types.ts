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
  fontFamily?: string; // Font family (e.g., 'Helvetica', 'Times-Roman', 'Courier')
  color?: string;
  fieldType?: 'text' | 'pageNumber' | 'totalPages' | 'currentDate' | 'currentTime';
  width?: string; // Supports px (numeric), % (percentage), or "auto"
  value?: string; // Static value for non-bound fields
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

export interface ZoneConfig {
  x?: number; // Horizontal position
  y?: number; // Vertical position
  width?: number; // Zone width
  height?: number; // Zone height
  marginTop?: number; // Top margin
  marginBottom?: number; // Bottom margin
  marginLeft?: number; // Left margin
  marginRight?: number; // Right margin
  padding?: number; // Internal padding
  align?: 'left' | 'center' | 'right'; // Horizontal alignment
  verticalAlign?: 'top' | 'middle' | 'bottom'; // Vertical alignment
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
  zoneConfigs?: Record<string, ZoneConfig>; // Zone configurations: 'pageHeader', 'pageFooter', 'billHeader', 'billContent', 'billFooter'
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
  presetId?: number;
  isActive?: boolean;
}

export interface TemplateListResponse {
  templates: Template[];
  total: number;
}

export interface TemplateParameter {
  ParameterId: number;
  TemplateId: number;
  ParameterName: string;
  ParameterValue?: string | null;
  CreatedBy?: string | null;
  CreatedOn: string;
  UpdatedOn?: string | null;
  IsActive: boolean;
}

export interface TemplateParameterCreate {
  templateId: number;
  parameterName: string;
  parameterValue?: string | null;
  createdBy?: string | null;
}

export interface TemplateParameterUpdate {
  parameterValue?: string | null;
  isActive?: boolean;
}

export interface TemplateParameterListResponse {
  parameters: TemplateParameter[];
  total: number;
}

export interface BulkTemplateParameterUpdate {
  templateId: number;
  parameters: Record<string, string>;
  createdBy?: string | null;
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
  AllowTemplateConfig: boolean;
  // New analytics/dashboards permissions (optional for backward compatibility)
  AllowAnalytics?: boolean;
  AllowDashboard?: boolean;
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

// ---- Template Config ----

export interface TemplateConfig {
  ConfigId: number;
  TemplateId: number;
  PresetId: number;
  InterfaceId: number;
  DepartmentId?: number | null;
  ShopId?: number | null;
  Type: string;
  Description?: string | null;
  CreatedBy?: string | null;
  CreatedOn: string;
  UpdatedOn?: string | null;
  IsActive: boolean;
}

export interface TemplateConfigCreate {
  templateId: number;
  presetId: number;
  interfaceId: number;
  departmentId?: number | null;
  shopId?: number | null;
  type: string;
  description?: string | null;
  createdBy?: string | null;
}

export interface TemplateConfigUpdate {
  templateId?: number;
  presetId?: number;
  interfaceId?: number;
  departmentId?: number | null;
  shopId?: number | null;
  type?: string;
  description?: string | null;
  isActive?: boolean;
}

export interface TemplateConfigListResponse {
  configs: TemplateConfig[];
  total: number;
}

// ---- Lookup Types ----

export interface Department {
  DepartmentID: number;
  DepartmentName: string;
  CompanyID?: number | null;
}

export interface Shop {
  ShopID: number;
  ShopName: string;
  DepartmentID?: number | null;
  ShopLocation?: string | null;
}

export interface Interface {
  InterfaceID: number;
  InterfaceName: string;
  ModuleCode?: string | null;
  CompanyID?: number | null;
}

// ============================================================================
// Query Builder Types
// ============================================================================

// Schema Types
export interface TableInfo {
  name: string;
  type: 'table' | 'view';
  schema?: string;
  rowCount?: number;
}

export interface TableListResponse {
  tables: TableInfo[];
  total: number;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  maxLength?: number;
  numericPrecision?: number;
  numericScale?: number;
}

export interface ColumnListResponse {
  columns: ColumnInfo[];
}

export interface RelationshipInfo {
  constraintName: string;
  parentTable: string;
  parentColumn: string;
  childTable: string;
  childColumn: string;
}

export interface RelationshipListResponse {
  relationships: RelationshipInfo[];
}

// Expression Types
export type ExpressionNodeType = 'column' | 'literal' | 'function' | 'operator' | 'parameter';

export interface ExpressionNode {
  id?: string;
  type: ExpressionNodeType;
  value?: string | number;
  operator?: '+' | '-' | '*' | '/' | '(' | ')';
  left?: ExpressionNode;
  right?: ExpressionNode;
  function?: string;
  arguments?: ExpressionNode[];
}

export interface CalculatedColumn {
  type: 'calculated';
  expression: ExpressionNode;
  alias: string;
}

// Window Function Types
export type WindowFunctionType = 'ROW_NUMBER' | 'RANK' | 'DENSE_RANK' | 'NTILE' | 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' | 'LEAD' | 'LAG' | 'FIRST_VALUE' | 'LAST_VALUE';

export interface WindowFunction {
  type: 'window';
  function: WindowFunctionType;
  partitionBy?: string[];
  orderBy?: { column: string; direction: 'ASC' | 'DESC' }[];
  frameClause?: string;
  alias: string;
}

// Column Types
export type ColumnType = 'simple' | 'calculated' | 'window' | 'aggregate';

export interface SimpleColumn {
  type: 'simple';
  table: string;
  column: string;
  alias?: string;
}

export interface AggregateColumn {
  type: 'aggregate';
  function: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX';
  column: string;
  distinct?: boolean;
  alias: string;
}

export type ColumnConfig = SimpleColumn | CalculatedColumn | WindowFunction | AggregateColumn;

// Join Types
export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL OUTER' | 'CROSS';

export interface JoinConfig {
  type: JoinType;
  table: string;
  alias?: string;
  conditions: JoinCondition[];
}

export interface JoinCondition {
  leftColumn: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=';
  rightColumn: string;
  andOr?: 'AND' | 'OR';
}

// WHERE Types
export type WhereOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'IS NULL' | 'IS NOT NULL';

export interface WhereCondition {
  column: string;
  operator: WhereOperator;
  value?: string | number | string[];
  isParameter?: boolean;
  andOr?: 'AND' | 'OR';
}

// Query State
export interface QueryState {
  tables: { name: string; alias?: string }[];
  joins: JoinConfig[];
  columns: ColumnConfig[];
  where: WhereCondition[];
  groupBy: string[];
  orderBy: { column: string; direction: 'ASC' | 'DESC' }[];
}

// SQL Function Types
export interface SQLFunction {
  name: string;
  category: string;
  signature: string;
  description: string;
  example: string;
  parameters: FunctionParameter[];
}

export interface FunctionParameter {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

// ============================================================================
// Analytics & Dashboards Types
// ============================================================================

export type AnalyticsFieldType = 'number' | 'string' | 'date' | 'boolean' | 'unknown';

export interface AnalyticsFieldsMetadata {
  header?: Record<string, AnalyticsFieldType>;
  items?: Record<string, AnalyticsFieldType>;
  contentDetails?: Record<string, Record<string, AnalyticsFieldType>>;
}

export interface AnalyticsDataset {
  headerRow: Record<string, any> | null;
  itemsRows: Record<string, any>[];
  contentDetails: Record<string, Record<string, any>[]>;
  fieldsMetadata: AnalyticsFieldsMetadata;
}

export type AnalyticsWidgetType = 'kpi' | 'chart' | 'table';

export interface AnalyticsWidgetRequest {
  id: string;
  type: AnalyticsWidgetType;
  config: Record<string, any>;
}

export interface AnalyticsWidgetResult {
  id: string;
  type: AnalyticsWidgetType;
  // Shape depends on widget type (value/series/rows/etc.)
  [key: string]: any;
}

export interface AnalyticsRunRequest {
  preset_id: number;
  parameters: Record<string, any>;
  company_id?: number;
  widgetRequests?: AnalyticsWidgetRequest[];
}

export interface AnalyticsRunResponse {
  dataset: AnalyticsDataset;
  widgets?: AnalyticsWidgetResult[];
}

export interface AnalyticsRunMultiPresetSpec {
  preset_id: number;
  parameters: Record<string, any>;
}

export interface AnalyticsRunMultiRequest {
  presets: AnalyticsRunMultiPresetSpec[];
  company_id?: number;
  unionMode?: string | null;
}

export interface AnalyticsRunMultiResponse {
  results: AnalyticsDataset[];
}

export interface AnalyticsCompareSide {
  preset_id: number;
  parameters: Record<string, any>;
}

export interface AnalyticsCompareRequest {
  left: AnalyticsCompareSide;
  right: AnalyticsCompareSide;
  company_id?: number;
  joinKeys?: string[];
}

export interface AnalyticsCompareSummary {
  leftCount: number;
  rightCount: number;
  countVariance: {
    absolute: number | null;
    percent: number | null;
  };
}

export interface AnalyticsCompareResponse {
  left: AnalyticsDataset;
  right: AnalyticsDataset;
  summary: AnalyticsCompareSummary;
}

// Data Analytics (new preset analytics service)
export interface AnalyticsFilter {
  field: string;
  operator: 'equals' | 'in' | 'range' | 'contains';
  value?: any;
  min?: any;
  max?: any;
}

export interface DataAnalyticsDataset {
  data: {
    header: Record<string, any> | null;
    items: Record<string, any> | Record<string, any>[]; // object if 1 row, array if 0 or >1
    contentDetails: Record<string, Record<string, any> | Record<string, any>[]>; // same shape rule
  };
  fieldsMetadata: AnalyticsFieldsMetadata;
  shape: {
    header: 'object' | 'none';
    items: 'object' | 'array';
    contentDetails: Record<string, 'object' | 'array'>;
  };
  references: Record<string, any>; // billId, documentNo, createdAt, etc.
  insights: Array<{
    id: string;
    type: 'anomaly' | 'summary';
    severity: 'info' | 'warning' | 'error';
    message: string;
    field?: string;
    value?: any;
    stats?: Record<string, any>;
    affectedKeys?: any[];
  }>;
}

export interface PresetAnalyticsRunRequest {
  preset_id: number;
  parameters: Record<string, any>;
  company_id?: number;
  filters?: AnalyticsFilter[];
  widgetRequests?: AnalyticsWidgetRequest[];
}

export interface PresetAnalyticsRunResponse {
  dataset: DataAnalyticsDataset;
  widgets?: AnalyticsWidgetResult[];
}

// Dashboards

export type DashboardWidgetType = 'kpi' | 'chart' | 'table';

export interface DashboardWidgetConfig {
  chartType?: string;
  datasetRef?: string;
  xField?: string;
  yField?: string;
  seriesField?: string;
  agg?: string;
  sort?: string;
  limit?: number;
  filters?: Record<string, any>[];
  metric?: string;
  field?: string;
  columns?: string[];
  pageSize?: number;
}

export interface DashboardPresetBinding {
  presetId: number;
  parameters: Record<string, any>;
}

export interface DashboardWidget {
  WidgetId: number;
  DashboardId: number;
  Title: string;
  Type: DashboardWidgetType;
  Config: DashboardWidgetConfig;
  PresetBinding: DashboardPresetBinding;
  OrderIndex: number;
  CreatedOn: string;
  UpdatedOn?: string | null;
  IsActive: boolean;
}

export interface DashboardWidgetCreate {
  Title: string;
  Type: DashboardWidgetType;
  Config: DashboardWidgetConfig;
  PresetBinding: DashboardPresetBinding;
  OrderIndex?: number;
}

export interface Dashboard {
  DashboardId: number;
  Name: string;
  Description?: string | null;
  CreatedBy?: string | null;
  CreatedOn: string;
  UpdatedOn?: string | null;
  IsActive: boolean;
  Widgets: DashboardWidget[];
}

export interface DashboardListItem {
  DashboardId: number;
  Name: string;
  Description?: string | null;
  CreatedBy?: string | null;
  CreatedOn: string;
  UpdatedOn?: string | null;
  IsActive: boolean;
}

export interface DashboardListResponse {
  dashboards: DashboardListItem[];
  total: number;
}

export interface DashboardCreate {
  Name: string;
  Description?: string | null;
  CreatedBy?: string | null;
  Widgets: DashboardWidgetCreate[];
}

export interface DashboardUpdate {
  Name?: string;
  Description?: string | null;
  Widgets?: DashboardWidgetCreate[];
}

export interface RunDashboardResponse {
  dashboard: Dashboard;
  widgets: Record<
    string,
    {
      widgetId: number;
      dashboardId: number;
      title: string;
      type: DashboardWidgetType;
      config: DashboardWidgetConfig;
      presetBinding: DashboardPresetBinding;
      dataset: AnalyticsDataset;
      analyticsDataset?: DataAnalyticsDataset;
      output?: any;
    }
  >;
}

// Analytics Metrics (SPEC-001)
export interface MetricDataPoint {
  label: string;
  value: number;
}

export interface MetricResponse {
  metric: string;
  unit: string;
  bucket?: string | null;
  data: MetricDataPoint[];
}

export interface MetricErrorContext {
  preset?: string | null;
  column?: string | null;
  metric?: string | null;
}

export interface MetricErrorResponse {
  error_code: string;
  message: string;
  context: MetricErrorContext;
}

// Dashboard Widget Configuration (SPEC-001)
export interface MetricDashboardWidget {
  id: string;
  title: string;
  metric: string;
  visualization: 'card' | 'line' | 'bar' | 'table';
}

