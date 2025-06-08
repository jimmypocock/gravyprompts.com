'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export default function Navigation() {
  const { user, loading } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-primary">
              Gravy Prompts
            </Link>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                href="/editor"
                className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-primary"
              >
                Editor
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-primary"
              >
                How It Works
              </Link>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {loading ? (
              <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></div>
            ) : user ? (
              <>
                <Link
                  href="/profile"
                  className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-primary"
                >
                  Profile
                </Link>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {user.email}
                </span>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-primary"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}