import { fetchWithAuth } from "./auth";

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
  return process.env.NEXT_PUBLIC_API_URL || "https://api.gravyprompts.com";
};

export interface UserPermission {
  userId: string;
  permission: string;
  grantedAt: string;
  grantedBy: string;
}

export interface ApprovalQueueItem {
  templateId: string;
  title: string;
  content: string;
  authorEmail: string;
  createdAt: string;
  tags?: string[];
  variables?: string[];
}

export interface ApprovalHistoryItem {
  historyId: string;
  templateId: string;
  templateTitle: string;
  templateAuthor: string;
  reviewerId: string;
  reviewerEmail: string;
  action: "approve" | "reject";
  previousStatus: string;
  newStatus: string;
  reason?: string;
  notes?: string;
  timestamp: string;
}

// Permissions management
export async function getUsersWithPermissions(
  permission?: string,
): Promise<UserPermission[]> {
  const url = permission
    ? `${getApiBaseUrl()}/admin/permissions/users?permission=${permission}`
    : `${getApiBaseUrl()}/admin/permissions/users`;

  const response = await fetchWithAuth(url);
  if (!response.ok) {
    throw new Error("Failed to fetch users with permissions");
  }
  const data = await response.json();
  return data.users;
}

export async function getUserPermissions(userId: string): Promise<string[]> {
  const response = await fetchWithAuth(
    `${getApiBaseUrl()}/admin/permissions/user/${userId}`,
  );
  if (!response.ok) {
    throw new Error("Failed to fetch user permissions");
  }
  const data = await response.json();
  return data.permissions;
}

export async function grantPermission(
  userId: string,
  permission: string,
): Promise<void> {
  const response = await fetchWithAuth(`${getApiBaseUrl()}/admin/permissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, permission }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to grant permission");
  }
}

export async function revokePermission(
  userId: string,
  permission: string,
): Promise<void> {
  const response = await fetchWithAuth(
    `${getApiBaseUrl()}/admin/permissions/${userId}/${permission}`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to revoke permission");
  }
}

// Approval management
export async function getApprovalQueue(
  status: "pending" | "rejected" = "pending",
  limit = 20,
): Promise<{
  templates: ApprovalQueueItem[];
  lastKey?: string;
}> {
  const response = await fetchWithAuth(
    `${getApiBaseUrl()}/admin/approval/queue?status=${status}&limit=${limit}`,
  );
  if (!response.ok) {
    throw new Error("Failed to fetch approval queue");
  }
  return response.json();
}

export async function getApprovalHistory(filters?: {
  templateId?: string;
  reviewerId?: string;
  limit?: number;
}): Promise<{
  history: ApprovalHistoryItem[];
}> {
  const params = new URLSearchParams();
  if (filters?.templateId) params.append("templateId", filters.templateId);
  if (filters?.reviewerId) params.append("reviewerId", filters.reviewerId);
  if (filters?.limit) params.append("limit", filters.limit.toString());

  const response = await fetchWithAuth(
    `${getApiBaseUrl()}/admin/approval/history?${params}`,
  );
  if (!response.ok) {
    throw new Error("Failed to fetch approval history");
  }
  return response.json();
}

export async function processApproval(
  templateId: string,
  action: "approve" | "reject",
  reason?: string,
  notes?: string,
): Promise<void> {
  const response = await fetchWithAuth(
    `${getApiBaseUrl()}/admin/approval/template/${templateId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, reason, notes }),
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to process approval");
  }
}

// Check if current user has admin permissions (approval or admin)
export async function checkAdminAccess(): Promise<boolean> {
  try {
    // Use the /me endpoint to get current user's permissions
    const response = await fetchWithAuth(
      `${getApiBaseUrl()}/admin/permissions/me`,
    );

    if (!response.ok) {
      console.log("Failed to fetch user permissions:", response.status);
      return false;
    }

    const data = await response.json();
    const permissions = data.permissions || [];

    // Check if user has admin or approval permission
    const hasAdminAccess =
      permissions.includes("admin") || permissions.includes("approval");

    if (hasAdminAccess) {
      console.log("User has admin access with permissions:", permissions);
    }

    return hasAdminAccess;
  } catch (error) {
    // Log the actual error for debugging
    if (error instanceof Error) {
      console.log("Admin access check failed:", error.message);
      // If it's an API error, log additional details
      if ('status' in error) {
        console.log("API Error details:", {
          status: (error as any).status,
          statusText: (error as any).statusText,
          url: (error as any).url,
          body: (error as any).body,
        });
      }
    } else {
      console.log("Admin access check failed:", error);
    }
    return false;
  }
}
