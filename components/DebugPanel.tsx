"use client";

import { useEffect, useState } from "react";
import { getCurrentUser } from "aws-amplify/auth";
import { fetchAuthSession } from "aws-amplify/auth";

interface AuthDebugInfo {
  isAuthenticated: boolean;
  userId?: string;
  email?: string;
  permissions?: string[];
  roles?: string[];
  sessionValid?: boolean;
  error?: string;
}

export function DebugPanel() {
  const [debugInfo, setDebugInfo] = useState<AuthDebugInfo>({
    isAuthenticated: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isMinimized, setIsMinimized] = useState(() => {
    // Remember minimize state in localStorage
    if (typeof window !== "undefined") {
      return localStorage.getItem("debugPanelMinimized") === "true";
    }
    return false;
  });

  useEffect(() => {
    // Save minimize state to localStorage whenever it changes
    if (typeof window !== "undefined") {
      localStorage.setItem("debugPanelMinimized", isMinimized.toString());
    }
  }, [isMinimized]);

  useEffect(() => {
    async function loadAuthInfo() {
      try {
        const user = await getCurrentUser();
        const session = await fetchAuthSession();
        
        // Get permissions from API
        let permissions: string[] = [];
        const roles: string[] = [];
        
        try {
          const response = await fetch("/api/proxy/admin/permissions/me", {
            headers: {
              Authorization: `Bearer ${session.tokens?.idToken?.toString()}`,
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            permissions = data.permissions || [];
            
            // Derive roles from permissions
            if (permissions.includes("admin")) roles.push("Admin");
            if (permissions.includes("approval")) roles.push("Moderator");
          }
        } catch (error) {
          console.error("Failed to fetch permissions:", error);
        }

        setDebugInfo({
          isAuthenticated: true,
          userId: user.userId,
          email: user.signInDetails?.loginId || "Unknown",
          permissions,
          roles: roles.length > 0 ? roles : ["User"],
          sessionValid: !!session.tokens?.idToken,
        });
      } catch (error) {
        setDebugInfo({
          isAuthenticated: false,
          error: error instanceof Error ? error.message : "Not authenticated",
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadAuthInfo();
  }, []);

  if (isLoading) {
    return (
      <div className="fixed bottom-4 right-4 bg-gray-900 text-white p-4 rounded-lg shadow-lg text-sm">
        Loading auth info...
      </div>
    );
  }

  // Minimized view
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 bg-gray-900 text-white p-2 rounded-lg shadow-lg text-sm flex items-center gap-2">
        <span className="text-xs">Debug</span>
        <button
          onClick={() => setIsMinimized(false)}
          className="text-gray-400 hover:text-white transition-colors"
          title="Maximize"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white p-4 rounded-lg shadow-lg text-sm max-w-sm">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold">Debug</h3>
        <button
          onClick={() => setIsMinimized(true)}
          className="text-gray-400 hover:text-white transition-colors"
          title="Minimize"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
      </div>
      <div className="space-y-1">
        <div>
          <span className="text-gray-400">Status:</span>{" "}
          <span className={debugInfo.isAuthenticated ? "text-green-400" : "text-red-400"}>
            {debugInfo.isAuthenticated ? "Authenticated" : "Not Authenticated"}
          </span>
        </div>
        {debugInfo.isAuthenticated && (
          <>
            <div>
              <span className="text-gray-400">User ID:</span>{" "}
              <span className="font-mono text-xs">{debugInfo.userId}</span>
            </div>
            <div>
              <span className="text-gray-400">Email:</span> {debugInfo.email}
            </div>
            <div>
              <span className="text-gray-400">Roles:</span>{" "}
              {debugInfo.roles?.join(", ") || "None"}
            </div>
            <div>
              <span className="text-gray-400">Permissions:</span>{" "}
              {debugInfo.permissions?.length
                ? debugInfo.permissions.join(", ")
                : "None"}
            </div>
            <div>
              <span className="text-gray-400">Session:</span>{" "}
              <span className={debugInfo.sessionValid ? "text-green-400" : "text-red-400"}>
                {debugInfo.sessionValid ? "Valid" : "Invalid"}
              </span>
            </div>
          </>
        )}
        {debugInfo.error && (
          <div className="text-red-400 text-xs mt-2">Error: {debugInfo.error}</div>
        )}
      </div>
    </div>
  );
}