"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "aws-amplify/auth";

export default function ForceLogoutPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [error, setError] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    async function forceLogout() {
      try {
        // Clear all auth data
        if (typeof window !== "undefined") {
          // Clear Amplify auth storage
          localStorage.clear();
          sessionStorage.clear();

          // Try to sign out if possible
          try {
            await signOut();
          } catch (e) {
            // Ignore signOut errors - we're force clearing anyway
            console.log("SignOut error (ignored):", e);
          }

          setStatus("success");

          // Redirect to login after a brief delay
          setTimeout(() => {
            router.push("/login");
          }, 2000);
        }
      } catch (err) {
        console.error("Force logout error:", err);
        setError((err as Error).message || "Failed to logout");
        setStatus("error");
      }
    }

    forceLogout();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg text-center">
        {status === "loading" && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <h2 className="text-xl font-semibold text-gray-900">
              Clearing session...
            </h2>
            <p className="text-gray-600">
              Please wait while we sign you out completely.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="text-green-500 mx-auto">
              <svg
                className="w-16 h-16 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              Successfully signed out
            </h2>
            <p className="text-gray-600">Redirecting to login page...</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="text-red-500 mx-auto">
              <svg
                className="w-16 h-16 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              Error signing out
            </h2>
            <p className="text-red-600 text-sm">{error}</p>
            <div className="mt-4">
              <Link
                href="/login"
                className="text-primary hover:text-primary/80 font-medium"
              >
                Try going to login page →
              </Link>
            </div>
          </>
        )}

        <div className="mt-8 text-sm text-gray-500">
          <p>Having trouble signing in?</p>
          <p>This page helps clear corrupted authentication data.</p>
        </div>
      </div>
    </div>
  );
}
