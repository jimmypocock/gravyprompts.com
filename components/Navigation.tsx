'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useSearch } from '@/lib/search-context';
import { usePathname, useRouter } from 'next/navigation';
import { checkAdminAccess } from '@/lib/api/admin';

export default function Navigation() {
  const { user, loading } = useAuth();
  const { searchQuery, setSearchQuery, isNavSearchVisible } = useSearch();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isHomePage = pathname === '/';

  // Show search in nav on all pages except home (unless scrolled on home)
  const showSearch = !isHomePage || isNavSearchVisible;

  // Check admin access when user changes
  useEffect(() => {
    async function checkAdmin() {
      if (user) {
        const hasAccess = await checkAdminAccess();
        setIsAdmin(hasAccess);
      } else {
        setIsAdmin(false);
      }
    }
    checkAdmin();
  }, [user]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    // If not on home page and user starts searching, redirect to home
    if (!isHomePage && value.trim()) {
      router.push('/');
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/images/logo.png"
                alt="GravyPrompts Logo"
                width={32}
                height={32}
                className="h-8 w-8"
              />
              <span className="text-xl font-bold text-primary mb-2">gravy prompts</span>
            </Link>
          </div>

          {/* Search Bar - Centered */}
          <div className={`flex-1 max-w-2xl mx-8 transition-all duration-300 ${
            showSearch ? 'opacity-100 visible' : 'opacity-0 invisible'
          }`}>
            <div className="relative">
              <input
                type="text"
                placeholder="Search for templates..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full px-4 py-2 pl-10 text-sm border border-gray-300 rounded-full focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Right side menu */}
          <div className="flex items-center space-x-2">
            {loading ? (
              <div className="h-8 w-20 bg-gray-200 animate-pulse rounded-full"></div>
            ) : (
              <>
                {/* Desktop menu */}
                <div className="hidden md:flex items-center space-x-4">
                  {user && (
                    <>
                      <Link
                        href="/editor"
                        className="text-sm font-medium text-primary border-primary hover:bg-primary hover:text-white px-4 py-2 rounded-full border transition-colors"
                      >
                        Create Template
                      </Link>
                      {isAdmin && (
                        <Link
                          href="/admin"
                          className="text-sm font-medium text-gray-700 hover:text-gray-900 px-4 py-2 rounded-full hover:bg-gray-100 transition-colors"
                        >
                          Admin
                        </Link>
                      )}
                    </>
                  )}

                  {user ? (
                    <Link
                      href="/profile"
                      className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-medium">
                        {user.email?.[0]?.toUpperCase() || 'U'}
                      </div>
                    </Link>
                  ) : (
                    <>
                      <Link
                        href="/login"
                        className="text-sm font-medium text-gray-700 hover:text-gray-900 px-4 py-2 rounded-full hover:bg-gray-100 transition-colors"
                      >
                        Log in
                      </Link>
                      <Link
                        href="/signup"
                        className="text-sm font-medium px-4 py-2 bg-primary text-white rounded-full hover:bg-primary-hover transition-colors"
                      >
                        Sign up
                      </Link>
                    </>
                  )}
                </div>

                {/* Mobile menu button */}
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {isMobileMenuOpen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    )}
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200">
          <div className="px-4 py-4 space-y-2">
            <Link
              href="/"
              className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Browse Templates
            </Link>
            {user && (
              <>
                <Link
                  href="/editor"
                  className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Create Template
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Admin
                  </Link>
                )}
              </>
            )}
            {user ? (
              <Link
                href="/profile"
                className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Profile
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="block px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-center"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}