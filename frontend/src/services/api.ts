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
  PreviewRequest,
  PreviewData,
  LoginResponse,
  CompanySelectResponse,
  MeResponse,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

class ApiClient {
  private client: AxiosInstance;

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

  // Preset endpoints
  async getPresets(skip = 0, limit = 100): Promise<PresetListResponse> {
    const response = await this.client.get<PresetListResponse>('/presets', {
      params: { skip, limit },
    });
    return response.data;
  }

  async getPreset(presetId: number): Promise<Preset> {
    const response = await this.client.get<Preset>(`/presets/${presetId}`);
    return response.data;
  }

  async createPreset(data: PresetCreate): Promise<Preset> {
    const response = await this.client.post<Preset>('/presets', data);
    return response.data;
  }

  async updatePreset(presetId: number, data: PresetUpdate): Promise<Preset> {
    const response = await this.client.put<Preset>(`/presets/${presetId}`, data);
    return response.data;
  }

  async deletePreset(presetId: number): Promise<void> {
    await this.client.delete(`/presets/${presetId}`);
  }

  async testPresetQueries(presetId: number, parameters: Record<string, any>): Promise<{
    header: { data: Record<string, any> | null; fields: string[] };
    items: { data: Record<string, any>[]; fields: string[]; sampleCount: number };
    contentDetails?: Record<string, { data: Record<string, any>[]; fields: string[]; sampleCount: number }>;
  }> {
    const response = await this.client.post(`/presets/${presetId}/test`, { parameters });
    return response.data;
  }

  // Template endpoints
  async getTemplates(presetId?: number, skip = 0, limit = 100): Promise<TemplateListResponse> {
    const response = await this.client.get<TemplateListResponse>('/templates', {
      params: { presetId, skip, limit },
    });
    return response.data;
  }

  async getTemplate(templateId: number): Promise<Template> {
    const response = await this.client.get<Template>(`/templates/${templateId}`);
    return response.data;
  }

  async createTemplate(data: TemplateCreate): Promise<Template> {
    const response = await this.client.post<Template>('/templates', data);
    return response.data;
  }

  async updateTemplate(templateId: number, data: TemplateUpdate): Promise<Template> {
    const response = await this.client.put<Template>(`/templates/${templateId}`, data);
    return response.data;
  }

  async deleteTemplate(templateId: number): Promise<void> {
    await this.client.delete(`/templates/${templateId}`);
  }

  // Preview endpoints
  async generatePreviewHtml(request: PreviewRequest): Promise<string> {
    const response = await this.client.post<string>('/preview/', request, {
      responseType: 'text',
    });
    return response.data;
  }

  async generatePreviewPdf(request: PreviewRequest): Promise<string> {
    const response = await this.client.post<{ pdf: string }>('/preview/pdf', request);
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
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;

