// Shared authentication utilities for API calls

export async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  // Get auth token
  let token: string | null = null;

  try {
    // Import dynamically to avoid SSR issues
    const { fetchAuthSession } = await import("aws-amplify/auth");
    const session = await fetchAuthSession();
    token = session.tokens?.idToken?.toString() || null;
  } catch (error) {
    console.error("Error fetching auth session:", error);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Add timeout for local development (30 seconds for cold starts)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (error) {
    clearTimeout(timeoutId);

    // If it's a timeout error, throw a more descriptive error
    if (error instanceof Error && error.name === "AbortError") {
      console.error("Request timed out - Lambda may be cold starting:", url);
      throw new Error(
        "Request timed out. The server may be starting up. Please try again.",
      );
    }
    throw error;
  }

  if (!response.ok) {
    // Handle 401 Unauthorized specifically
    if (response.status === 401 && typeof window !== "undefined") {
      // Don't automatically sign out for admin checks - let the calling code handle it
      if (url.includes("/admin/")) {
        // For admin endpoints, just throw the error without signing out
        // This allows checkAdminAccess to return false gracefully
      } else {
        // For non-admin endpoints, sign out and redirect
        const { signOut } = await import("aws-amplify/auth");
        await signOut();
        window.location.href = "/login";
        throw new Error("Session expired. Please log in again.");
      }
    }

    // Try to parse error response
    let errorMessage = `HTTP ${response.status}`;
    let responseBody: unknown = null;

    try {
      responseBody = await response.json();
      const body = responseBody as { error?: string; message?: string };
      errorMessage = body.error || body.message || errorMessage;
    } catch {
      // If response isn't JSON, try text
      try {
        const text = await response.text();
        if (text) {
          errorMessage = text;
          responseBody = text;
        }
      } catch {
        // Response body already consumed or empty
        responseBody = null;
      }
    }

    // Create a more informative error object
    const errorDetails = {
      message: errorMessage,
      status: response.status,
      statusText: response.statusText,
      url: url,
      body: responseBody,
    };

    console.error("API Error:", errorDetails);

    // Create an error with all the details
    const error = new Error(errorMessage);
    Object.assign(error, errorDetails);
    throw error;
  }

  return response;
}
