// Template API service for frontend integration

export interface Template {
  templateId: string;
  title: string;
  content: string;
  variables: string[];
  variableCount?: number; // Added for list responses
  visibility: 'public' | 'private';
  tags: string[];
  authorEmail: string;
  createdAt: string;
  updatedAt: string;
  viewCount: number;
  useCount: number;
  isOwner?: boolean;
  moderationStatus?: string;
}

export interface CreateTemplateRequest {
  title: string;
  content: string;
  visibility: 'public' | 'private';
  tags: string[];
  viewers?: string[];
}

export interface UpdateTemplateRequest {
  title?: string;
  content?: string;
  visibility?: 'public' | 'private';
  tags?: string[];
}

export interface ShareTemplateRequest {
  action: 'add' | 'remove' | 'generate_link';
  emails?: string[];
  expiresIn?: number;
}

export interface PopulateTemplateRequest {
  variables: Record<string, string>;
  returnHtml?: boolean;
}

export interface ListTemplatesParams {
  filter?: 'public' | 'mine' | 'all';
  tag?: string;
  search?: string;
  limit?: number;
  nextToken?: string;
  sortBy?: 'createdAt' | 'viewCount' | 'useCount';
  sortOrder?: 'asc' | 'desc';
}

export class TemplateApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
    this.name = 'TemplateApiError';
  }
}

class TemplateApi {
  private baseUrl: string;
  private getAuthToken: () => Promise<string | null>;

  constructor(baseUrl: string, getAuthToken: () => Promise<string | null>) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.getAuthToken = getAuthToken;
  }

  private async fetchWithAuth(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const token = await this.getAuthToken();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    // For local development, use a mock token
    const isLocal = this.baseUrl.includes('localhost');
    if (isLocal) {
      headers['Authorization'] = 'Bearer local-dev-token';
    } else if (token) {
      headers['Authorization'] = token;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new TemplateApiError(
        response.status,
        error.error || `HTTP ${response.status}`,
        error.details
      );
    }

    return response;
  }

  async createTemplate(data: CreateTemplateRequest): Promise<Template> {
    const response = await this.fetchWithAuth('/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const result = await response.json();
    return result.template;
  }

  async getTemplate(templateId: string, token?: string): Promise<Template> {
    const query = token ? `?token=${encodeURIComponent(token)}` : '';
    const response = await this.fetchWithAuth(`/templates/${templateId}${query}`);
    return response.json();
  }

  async listTemplates(params: ListTemplatesParams = {}): Promise<{
    items: Template[];
    nextToken?: string;
    count: number;
  }> {
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });

    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    const response = await this.fetchWithAuth(`/templates${query}`);
    return response.json();
  }

  async updateTemplate(
    templateId: string,
    data: UpdateTemplateRequest
  ): Promise<Template> {
    const response = await this.fetchWithAuth(`/templates/${templateId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    const result = await response.json();
    return result.template;
  }

  async deleteTemplate(templateId: string): Promise<void> {
    await this.fetchWithAuth(`/templates/${templateId}`, {
      method: 'DELETE',
    });
  }

  async shareTemplate(
    templateId: string,
    data: ShareTemplateRequest
  ): Promise<{
    shareUrl?: string;
    viewers?: string[];
    message: string;
  }> {
    const response = await this.fetchWithAuth(`/templates/${templateId}/share`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async populateTemplate(
    templateId: string,
    data: PopulateTemplateRequest,
    token?: string
  ): Promise<{
    templateId: string;
    title: string;
    populatedContent: string;
    variables: {
      required: string[];
      provided: string[];
      missing: string[];
      used: string[];
    };
    warning?: string;
  }> {
    const query = token ? `?token=${encodeURIComponent(token)}` : '';
    const response = await this.fetchWithAuth(
      `/templates/${templateId}/populate${query}`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    return response.json();
  }
}

// Factory function to create template API instance
export function createTemplateApi(
  baseUrl: string,
  getAuthToken: () => Promise<string | null>
): TemplateApi {
  return new TemplateApi(baseUrl, getAuthToken);
}

// Hook for using template API in React components
import { useAuth } from '@/lib/auth-context';
import { useMemo } from 'react';

export function useTemplateApi() {
  const { user, getIdToken } = useAuth();
  
  const api = useMemo(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
    return createTemplateApi(apiUrl, async () => {
      if (!user) return null;
      try {
        return await getIdToken();
      } catch (error) {
        console.error('Failed to get auth token:', error);
        return null;
      }
    });
  }, [user, getIdToken]);

  return api;
}