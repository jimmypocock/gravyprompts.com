'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  // Check if this is an auth-related error
  const isAuthError = error.message?.toLowerCase().includes('auth') || 
                      error.message?.toLowerCase().includes('sign') ||
                      error.message?.toLowerCase().includes('session');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg text-center">
        <div className="text-red-500 mx-auto">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900">Something went wrong!</h2>
        
        <p className="text-gray-600">
          {error.message || 'An unexpected error occurred'}
        </p>

        <div className="space-y-4">
          <button
            onClick={reset}
            className="w-full px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
          >
            Try again
          </button>

          {isAuthError && (
            <Link
              href="/auth/force-logout"
              className="block w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
            >
              Clear session and sign in again
            </Link>
          )}

          <Link
            href="/"
            className="block text-primary hover:text-primary/80"
          >
            Go back home
          </Link>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          Error ID: {error.digest}
        </p>
      </div>
    </div>
  );
}