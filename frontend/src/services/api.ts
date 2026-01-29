/**
 * Typed API client for backend communication.
 */
import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  Preset,
  PresetCreate,
  PresetUpdate,
  PresetListResponse,
  Template,
  TemplateCreate,
  TemplateUpdate,
  TemplateListResponse,
  TemplateParameter,
  TemplateParameterCreate,
  TemplateParameterUpdate,
  TemplateParameterListResponse,
  BulkTemplateParameterUpdate,
  PreviewRequest,
  PreviewData,
  LoginResponse,
  CompanySelectResponse,
  MeResponse,
  Image,
  ImageListResponse,
  TemplateConfig,
  TemplateConfigCreate,
  TemplateConfigUpdate,
  TemplateConfigListResponse,
  Department,
  Shop,
  Interface,
  TableListResponse,
  ColumnListResponse,
  RelationshipListResponse,
  AnalyticsRunRequest,
  AnalyticsRunResponse,
  AnalyticsRunMultiRequest,
  AnalyticsRunMultiResponse,
  AnalyticsCompareRequest,
  AnalyticsCompareResponse,
  PresetAnalyticsRunRequest,
  PresetAnalyticsRunResponse,
  Dashboard,
  DashboardCreate,
  DashboardUpdate,
  DashboardListResponse,
  RunDashboardResponse,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

class ApiClient {
  private client: AxiosInstance;
  private cachedCompanyId: number | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config: any) => {
        // Add auth token if available
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error: any) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response: any) => response,
      (error: AxiosError) => {
        if (error.response) {
          // Server responded with error
          if (error.response.status === 401) {
            // Session invalid/expired (backend uses in-memory sessions). Clear local auth and force re-login.
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_email');
            localStorage.removeItem('auth_user_id');
            localStorage.removeItem('auth_company_id');
            this.invalidateCompanyIdCache();
          }
          const message = (error.response.data as any)?.detail || error.message;
          console.error('API Error:', message);
          throw new Error(message);
        } else if (error.request) {
          // Request made but no response
          console.error('Network Error:', error.message);
          throw new Error('Network error. Please check your connection.');
        } else {
          // Something else happened
          console.error('Error:', error.message);
          throw error;
        }
      }
    );
  }

  private getCompanyId(): number | undefined {
    if (this.cachedCompanyId !== null) {
      return this.cachedCompanyId;
    }
    const companyIdFromStorage = localStorage.getItem('auth_company_id');
    const companyId = companyIdFromStorage ? parseInt(companyIdFromStorage, 10) : undefined;
    if (companyId !== undefined) {
      this.cachedCompanyId = companyId;
    }
    return companyId;
  }

  private invalidateCompanyIdCache(): void {
    this.cachedCompanyId = null;
  }

  // Preset endpoints
  async getPresets(skip = 0, limit = 100): Promise<PresetListResponse> {
    const companyId = this.getCompanyId();
    const response = await this.client.get<PresetListResponse>('/presets', {
      params: { company_id: companyId, skip, limit },
    });
    return response.data;
  }

  async getPreset(presetId: number): Promise<Preset> {
    const companyId = this.getCompanyId();
    const response = await this.client.get<Preset>(`/presets/${presetId}`, {
      params: { company_id: companyId },
    });
    return response.data;
  }

  async createPreset(data: PresetCreate): Promise<Preset> {
    // Auto-include company_id from cache if available
    const companyId = this.getCompanyId();
    const response = await this.client.post<Preset>('/presets', data, {
      params: companyId ? { company_id: companyId } : {},
    });
    return response.data;
  }

  async updatePreset(presetId: number, data: PresetUpdate): Promise<Preset> {
    // Auto-include company_id from cache if available
    const companyId = this.getCompanyId();
    const response = await this.client.put<Preset>(`/presets/${presetId}`, data, {
      params: companyId ? { company_id: companyId } : {},
    });
    return response.data;
  }

  async deletePreset(presetId: number): Promise<void> {
    // Auto-include company_id from cache if available
    const companyId = this.getCompanyId();
    await this.client.delete(`/presets/${presetId}`, {
      params: companyId ? { company_id: companyId } : {},
    });
  }

  async testPresetQueries(presetId: number, parameters: Record<string, any>): Promise<{
    header: { data: Record<string, any> | null; fields: string[] };
    items: { data: Record<string, any>[]; fields: string[]; sampleCount: number };
    contentDetails?: Record<string, { data: Record<string, any>[]; fields: string[]; sampleCount: number }>;
  }> {
    // Auto-include company_id from cache if available
    const companyId = this.getCompanyId();
    const response = await this.client.post(`/presets/${presetId}/test`, { parameters }, {
      params: companyId ? { company_id: companyId } : {},
    });
    return response.data;
  }

  // Template endpoints
  async getTemplates(presetId?: number, skip = 0, limit = 100): Promise<TemplateListResponse> {
    const companyId = this.getCompanyId();

    const response = await this.client.get<TemplateListResponse>('/templates', {
      params: { presetId, company_id: companyId, skip, limit },
    });
    return response.data;
  }

  async getTemplate(templateId: number): Promise<Template> {
    // Auto-include company_id from cache if available
    const companyId = this.getCompanyId();
    const response = await this.client.get<Template>(`/templates/${templateId}`, {
      params: companyId ? { company_id: companyId } : {},
    });
    return response.data;
  }

  async createTemplate(data: TemplateCreate): Promise<Template> {
    // Auto-include company_id from cache if available
    const companyId = this.getCompanyId();
    const response = await this.client.post<Template>('/templates', data, {
      params: companyId ? { company_id: companyId } : {},
    });
    return response.data;
  }

  async updateTemplate(templateId: number, data: TemplateUpdate): Promise<Template> {
    // Auto-include company_id from cache if available
    const companyId = this.getCompanyId();
    const response = await this.client.put<Template>(`/templates/${templateId}`, data, {
      params: companyId ? { company_id: companyId } : {},
    });
    return response.data;
  }

  async deleteTemplate(templateId: number): Promise<void> {
    // Auto-include company_id from cache if available
    const companyId = this.getCompanyId();
    await this.client.delete(`/templates/${templateId}`, {
      params: companyId ? { company_id: companyId } : {},
    });
  }

  // Template Parameter endpoints
  async getTemplateParameters(templateId: number): Promise<TemplateParameterListResponse> {
    const companyId = this.getCompanyId();
    const response = await this.client.get<TemplateParameterListResponse>(
      `/template-parameters/template/${templateId}`,
      {
        params: companyId ? { company_id: companyId } : {},
      }
    );
    return response.data;
  }

  async createTemplateParameter(data: TemplateParameterCreate): Promise<TemplateParameter> {
    const companyId = this.getCompanyId();
    const response = await this.client.post<TemplateParameter>('/template-parameters', data, {
      params: companyId ? { company_id: companyId } : {},
    });
    return response.data;
  }

  async updateTemplateParameter(parameterId: number, data: TemplateParameterUpdate): Promise<TemplateParameter> {
    const companyId = this.getCompanyId();
    const response = await this.client.put<TemplateParameter>(`/template-parameters/${parameterId}`, data, {
      params: companyId ? { company_id: companyId } : {},
    });
    return response.data;
  }

  async deleteTemplateParameter(parameterId: number): Promise<void> {
    const companyId = this.getCompanyId();
    await this.client.delete(`/template-parameters/${parameterId}`, {
      params: companyId ? { company_id: companyId } : {},
    });
  }

  async bulkUpdateTemplateParameters(templateId: number, parameters: Record<string, string>, createdBy?: string): Promise<TemplateParameterListResponse> {
    const companyId = this.getCompanyId();
    const response = await this.client.post<TemplateParameterListResponse>(
      '/template-parameters/bulk',
      {
        templateId,
        parameters,
        createdBy,
      } as BulkTemplateParameterUpdate,
      {
        params: companyId ? { company_id: companyId } : {},
      }
    );
    return response.data;
  }

  // Preview endpoints
  async generatePreviewHtml(request: PreviewRequest): Promise<string> {
    const response = await this.client.post<string>('/preview/', request, {
      responseType: 'text',
    });
    return response.data;
  }

  async generatePreviewPdf(request: PreviewRequest): Promise<string> {
    // If the caller didn't provide companyId, try using the selected company from cache.
    // This is required when backend needs to switch to the correct company DB to find templates/presets.
    const cachedCompanyId = this.getCompanyId();
    const companyId = request.companyId ?? cachedCompanyId;

    const payload = companyId ? { ...request, companyId } : request;

    const response = await this.client.post<{ pdf: string }>('/preview/pdf', payload);
    return response.data.pdf;
  }

  async getPreviewData(templateId: number, parameters: Record<string, any>): Promise<PreviewData> {
    const response = await this.client.post<PreviewData>(`/preview/data/${templateId}`, parameters);
    return response.data;
  }

  // Auth endpoints
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>('/auth/login', { email, password });
    return response.data;
  }

  async selectCompany(companyId: number): Promise<CompanySelectResponse> {
    const response = await this.client.post<CompanySelectResponse>('/auth/select-company', { company_id: companyId });
    // Update cache when company is selected
    this.cachedCompanyId = companyId;
    return response.data;
  }

  async getCurrentUser(): Promise<MeResponse> {
    const response = await this.client.get<MeResponse>('/auth/me');
    return response.data;
  }

  async logout(): Promise<{ success: boolean }> {
    const response = await this.client.post<{ success: boolean }>('/auth/logout');
    return response.data;
  }

  // Image endpoints
  async uploadImage(file: File): Promise<Image> {
    const companyId = this.getCompanyId();
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await this.client.post<Image>('/images/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      params: companyId ? { company_id: companyId } : {},
    });
    return response.data;
  }

  async getImages(skip = 0, limit = 100): Promise<ImageListResponse> {
    const companyId = this.getCompanyId();
    const response = await this.client.get<ImageListResponse>('/images', {
      params: { company_id: companyId, skip, limit },
    });
    return response.data;
  }

  async getImage(imageId: number): Promise<Image> {
    const companyId = this.getCompanyId();
    const response = await this.client.get<Image>(`/images/${imageId}`, {
      params: companyId ? { company_id: companyId } : {},
    });
    return response.data;
  }

  async deleteImage(imageId: number): Promise<void> {
    const companyId = this.getCompanyId();
    await this.client.delete(`/images/${imageId}`, {
      params: companyId ? { company_id: companyId } : {},
    });
  }

  // Template Config endpoints
  async getTemplateConfigs(
    templateId?: number,
    presetId?: number,
    interfaceId?: number,
    departmentId?: number,
    shopId?: number,
    skip = 0,
    limit = 100
  ): Promise<TemplateConfigListResponse> {
    const companyId = this.getCompanyId();
    const response = await this.client.get<TemplateConfigListResponse>('/template-configs', {
      params: {
        company_id: companyId,
        template_id: templateId,
        preset_id: presetId,
        interface_id: interfaceId,
        department_id: departmentId,
        shop_id: shopId,
        skip,
        limit,
      },
    });
    return response.data;
  }

  async getTemplateConfig(configId: number): Promise<TemplateConfig> {
    const companyId = this.getCompanyId();
    const response = await this.client.get<TemplateConfig>(`/template-configs/${configId}`, {
      params: companyId ? { company_id: companyId } : {},
    });
    return response.data;
  }

  async createTemplateConfig(data: TemplateConfigCreate): Promise<TemplateConfig> {
    const companyId = this.getCompanyId();
    const response = await this.client.post<TemplateConfig>('/template-configs', data, {
      params: companyId ? { company_id: companyId } : {},
    });
    return response.data;
  }

  async updateTemplateConfig(configId: number, data: TemplateConfigUpdate): Promise<TemplateConfig> {
    const companyId = this.getCompanyId();
    const response = await this.client.put<TemplateConfig>(`/template-configs/${configId}`, data, {
      params: companyId ? { company_id: companyId } : {},
    });
    return response.data;
  }

  async deleteTemplateConfig(configId: number): Promise<void> {
    const companyId = this.getCompanyId();
    await this.client.delete(`/template-configs/${configId}`, {
      params: companyId ? { company_id: companyId } : {},
    });
  }

  // Lookup endpoints
  async getDepartments(): Promise<Department[]> {
    const companyId = this.getCompanyId();
    const response = await this.client.get<Department[]>('/lookups/departments', {
      params: companyId ? { company_id: companyId } : {},
    });
    return response.data;
  }

  async getShops(departmentId?: number): Promise<Shop[]> {
    const companyId = this.getCompanyId();
    const response = await this.client.get<Shop[]>('/lookups/shops', {
      params: {
        company_id: companyId,
        department_id: departmentId,
      },
    });
    return response.data;
  }

  async getInterfaces(skip = 0, limit = 100, search?: string): Promise<Interface[]> {
    const companyId = this.getCompanyId();
    const response = await this.client.get<Interface[]>('/lookups/interfaces', {
      params: {
        company_id: companyId,
        skip,
        limit,
        search,
      },
    });
    return response.data;
  }

  // Schema endpoints for query builder
  async getTables(search?: string, skip = 0, limit = 500): Promise<TableListResponse> {
    const companyId = this.getCompanyId();
    const response = await this.client.get<TableListResponse>('/schema/tables', {
      params: {
        company_id: companyId,
        search,
        skip,
        limit,
      },
    });
    return response.data;
  }

  async getTableColumns(tableName: string): Promise<ColumnListResponse> {
    const companyId = this.getCompanyId();
    const response = await this.client.get<ColumnListResponse>(`/schema/tables/${tableName}/columns`, {
      params: companyId ? { company_id: companyId } : {},
    });
    return response.data;
  }

  async getRelationships(): Promise<RelationshipListResponse> {
    const companyId = this.getCompanyId();
    const response = await this.client.get<RelationshipListResponse>('/schema/relationships', {
      params: companyId ? { company_id: companyId } : {},
    });
    return response.data;
  }

  // Analytics endpoints
  async runAnalytics(request: AnalyticsRunRequest): Promise<AnalyticsRunResponse> {
    const companyId = this.getCompanyId();
    const payload = companyId && !request.company_id ? { ...request, company_id: companyId } : request;
    const response = await this.client.post<AnalyticsRunResponse>('/analytics/run', payload);
    return response.data;
  }

  async runMultiAnalytics(request: AnalyticsRunMultiRequest): Promise<AnalyticsRunMultiResponse> {
    const companyId = this.getCompanyId();
    const payload = companyId && !request.company_id ? { ...request, company_id: companyId } : request;
    const response = await this.client.post<AnalyticsRunMultiResponse>('/analytics/run-multi', payload);
    return response.data;
  }

  async compareAnalytics(request: AnalyticsCompareRequest): Promise<AnalyticsCompareResponse> {
    const companyId = this.getCompanyId();
    const payload = companyId && !request.company_id ? { ...request, company_id: companyId } : request;
    const response = await this.client.post<AnalyticsCompareResponse>('/analytics/compare', payload);
    return response.data;
  }

  async runPresetAnalytics(request: PresetAnalyticsRunRequest): Promise<PresetAnalyticsRunResponse> {
    const companyId = this.getCompanyId();
    const payload = companyId && !request.company_id ? { ...request, company_id: companyId } : request;
    const response = await this.client.post<PresetAnalyticsRunResponse>('/analytics/preset-analytics', payload);
    return response.data;
  }

  // Dashboard endpoints
  async getDashboards(skip = 0, limit = 100): Promise<DashboardListResponse> {
    const response = await this.client.get<DashboardListResponse>('/dashboards', {
      params: { skip, limit },
    });
    return response.data;
  }

  async getDashboard(dashboardId: number): Promise<Dashboard> {
    const response = await this.client.get<Dashboard>(`/dashboards/${dashboardId}`);
    return response.data;
  }

  async createDashboard(data: DashboardCreate): Promise<Dashboard> {
    const response = await this.client.post<Dashboard>('/dashboards', data);
    return response.data;
  }

  async updateDashboard(dashboardId: number, data: DashboardUpdate): Promise<Dashboard> {
    const response = await this.client.put<Dashboard>(`/dashboards/${dashboardId}`, data);
    return response.data;
  }

  async deleteDashboard(dashboardId: number): Promise<void> {
    await this.client.delete(`/dashboards/${dashboardId}`);
  }

  async runDashboard(dashboardId: number): Promise<RunDashboardResponse> {
    const response = await this.client.get<RunDashboardResponse>(`/dashboards/${dashboardId}/run`);
    return response.data;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;

