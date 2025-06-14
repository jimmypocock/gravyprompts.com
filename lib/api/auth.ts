// Shared authentication utilities for API calls

export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Get auth token
  let token: string | null = null;
  
  try {
    // Import dynamically to avoid SSR issues
    const { fetchAuthSession } = await import('aws-amplify/auth');
    const session = await fetchAuthSession();
    token = session.tokens?.idToken?.toString() || null;
  } catch (error) {
    console.error('Error fetching auth session:', error);
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // Handle 401 Unauthorized specifically
    if (response.status === 401 && typeof window !== 'undefined') {
      // Import dynamically to avoid SSR issues
      const { signOut } = await import('aws-amplify/auth');
      await signOut();
      window.location.href = '/login';
      throw new Error('Session expired. Please log in again.');
    }
    
    // Try to parse error response
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      // If response isn't JSON, try text
      try {
        const text = await response.text();
        if (text) errorMessage = text;
      } catch {
        // Use default error message
      }
    }
    
    console.error('API Error:', {
      url,
      status: response.status,
      statusText: response.statusText,
      error: errorMessage
    });
    
    throw new Error(errorMessage);
  }

  return response;
}