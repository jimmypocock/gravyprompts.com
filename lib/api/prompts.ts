import { fetchWithAuth } from './auth';

// Use proxy for local development to avoid CORS issues
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return '/api/proxy';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'https://api.gravyprompts.com';
};

export interface UserPrompt {
  promptId: string;
  templateId: string;
  userId: string;
  templateTitle: string;
  populatedContent: string;
  variableValues: Record<string, string>;
  createdAt: string;
  updatedAt?: string;
}

export interface SavePromptRequest {
  templateId: string;
  templateTitle: string;
  populatedContent: string;
  variableValues: Record<string, string>;
}

// Save a user prompt
export async function savePrompt(data: SavePromptRequest): Promise<UserPrompt> {
  const response = await fetchWithAuth(`${getApiBaseUrl()}/prompts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to save prompt');
  }

  const result = await response.json();
  return result.prompt;
}

// List user prompts
export async function listPrompts(limit = 20, lastKey?: string): Promise<{
  prompts: UserPrompt[];
  lastKey?: string;
}> {
  const params = new URLSearchParams();
  params.append('limit', limit.toString());
  if (lastKey) {
    params.append('lastKey', lastKey);
  }

  const response = await fetchWithAuth(`${getApiBaseUrl()}/prompts?${params}`);

  if (!response.ok) {
    throw new Error('Failed to fetch prompts');
  }

  return response.json();
}

// Delete a user prompt
export async function deletePrompt(promptId: string): Promise<void> {
  const response = await fetchWithAuth(`${getApiBaseUrl()}/prompts/${promptId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete prompt');
  }
}

// Get a specific prompt
export async function getPrompt(promptId: string): Promise<UserPrompt> {
  const response = await fetchWithAuth(`${getApiBaseUrl()}/prompts/${promptId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch prompt');
  }

  const result = await response.json();
  return result.prompt;
}