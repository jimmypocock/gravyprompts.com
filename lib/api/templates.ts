// Template API service for frontend integration

// Use proxy for local development to avoid CORS issues
const getApiBaseUrl = () => {
  if (
    typeof window !== "undefined" &&
    window.location.hostname === "localhost"
  ) {
    // Use Next.js API proxy in local development
    return "/api/proxy";
  }
  // Use direct API URL in production
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:7429";
};

export interface Template {
  templateId: string;
  title: string;
  content?: string; // Full content (only in get by id)
  preview?: string; // Limited preview (in list responses)
  variables: string[];
  variableCount?: number; // Added for list responses
  visibility: "public" | "private";
  tags: string[];
  authorEmail: string;
  createdAt: string;
  updatedAt: string;
  viewCount: number;
  useCount: number;
  isOwner?: boolean;
  moderationStatus?: string;
  moderationDetails?: any; // Details about moderation
}

export interface CreateTemplateRequest {
  title: string;
  content: string;
  visibility: "public" | "private";
  tags: string[];
  viewers?: string[];
}

export interface UpdateTemplateRequest {
  title?: string;
  content?: string;
  visibility?: "public" | "private";
  tags?: string[];
}

export interface ShareTemplateRequest {
  action: "add" | "remove" | "generate_link";
  emails?: string[];
  expiresIn?: number;
}

export interface PopulateTemplateRequest {
  variables: Record<string, string>;
  returnHtml?: boolean;
}

export interface UserPrompt {
  promptId: string;
  userId: string;
  templateId?: string;
  templateTitle: string;
  content: string;
  variables: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface SavePromptRequest {
  templateId?: string;
  templateTitle: string;
  content: string;
  variables: Record<string, string>;
}

export interface ListTemplatesParams {
  filter?: "public" | "mine" | "all" | "popular";
  tag?: string;
  search?: string;
  limit?: number;
  nextToken?: string;
  sortBy?: "createdAt" | "viewCount" | "useCount";
  sortOrder?: "asc" | "desc";
}

export class TemplateApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "TemplateApiError";
  }
}

class TemplateApi {
  private baseUrl: string;
  private getAuthToken: () => Promise<string | null>;

  constructor(baseUrl: string, getAuthToken: () => Promise<string | null>) {
    this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.getAuthToken = getAuthToken;
  }

  private async fetchWithAuth(
    path: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const token = await this.getAuthToken();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      // Handle 401 Unauthorized specifically
      if (response.status === 401 && typeof window !== "undefined") {
        // Import dynamically to avoid SSR issues
        const { signOut } = await import("aws-amplify/auth");
        await signOut();
        window.location.href = "/login";
        throw new TemplateApiError(
          401,
          "Session expired. Please log in again.",
        );
      }

      const error = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw new TemplateApiError(
        response.status,
        error.error || `HTTP ${response.status}`,
        error.details,
      );
    }

    return response;
  }

  async createTemplate(data: CreateTemplateRequest): Promise<Template> {
    const response = await this.fetchWithAuth("/templates", {
      method: "POST",
      body: JSON.stringify(data),
    });
    const result = await response.json();
    return result.template;
  }

  async getTemplate(templateId: string, token?: string): Promise<Template> {
    const query = token ? `?token=${encodeURIComponent(token)}` : "";
    const response = await this.fetchWithAuth(
      `/templates/${templateId}${query}`,
    );
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

    const query = queryParams.toString() ? `?${queryParams.toString()}` : "";
    const response = await this.fetchWithAuth(`/templates${query}`);
    return response.json();
  }

  async getPopularTemplates(
    params: { limit?: number; category?: string } = {},
  ): Promise<{
    items: Template[];
    count: number;
  }> {
    // Use the list endpoint with filter=popular instead of a separate endpoint
    return this.listTemplates({
      filter: "popular",
      limit: params.limit,
      tag: params.category,
    });
  }

  async updateTemplate(
    templateId: string,
    data: UpdateTemplateRequest,
  ): Promise<Template> {
    const response = await this.fetchWithAuth(`/templates/${templateId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    const result = await response.json();
    return result.template;
  }

  async deleteTemplate(templateId: string): Promise<void> {
    await this.fetchWithAuth(`/templates/${templateId}`, {
      method: "DELETE",
    });
  }

  async shareTemplate(
    templateId: string,
    data: ShareTemplateRequest,
  ): Promise<{
    shareUrl?: string;
    viewers?: string[];
    message: string;
  }> {
    const response = await this.fetchWithAuth(
      `/templates/${templateId}/share`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
    return response.json();
  }

  async populateTemplate(
    templateId: string,
    data: PopulateTemplateRequest,
    token?: string,
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
    const query = token ? `?token=${encodeURIComponent(token)}` : "";
    const response = await this.fetchWithAuth(
      `/templates/${templateId}/populate${query}`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
    return response.json();
  }

  // User Prompts methods
  async savePrompt(data: SavePromptRequest): Promise<UserPrompt> {
    const response = await this.fetchWithAuth("/prompts", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async listPrompts(
    params: { limit?: number; lastKey?: string } = {},
  ): Promise<{
    items: UserPrompt[];
    count: number;
    lastKey?: string;
  }> {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append("limit", String(params.limit));
    if (params.lastKey) queryParams.append("lastKey", params.lastKey);

    const query = queryParams.toString() ? `?${queryParams.toString()}` : "";
    const response = await this.fetchWithAuth(`/prompts${query}`);
    return response.json();
  }

  async deletePrompt(promptId: string): Promise<void> {
    await this.fetchWithAuth(`/prompts/${promptId}`, {
      method: "DELETE",
    });
  }
}

// Factory function to create template API instance
export function createTemplateApi(
  baseUrl: string,
  getAuthToken: () => Promise<string | null>,
): TemplateApi {
  return new TemplateApi(baseUrl, getAuthToken);
}

// Hook for using template API in React components
import { useAuth } from "@/lib/auth-context";
import { useMemo } from "react";

export function useTemplateApi() {
  const { user, getIdToken } = useAuth();

  const api = useMemo(() => {
    const apiUrl = getApiBaseUrl();
    return createTemplateApi(apiUrl, async () => {
      if (!user) return null;
      try {
        return await getIdToken();
      } catch (error) {
        console.error("Failed to get auth token:", error);
        return null;
      }
    });
  }, [user, getIdToken]);

  return api;
}
