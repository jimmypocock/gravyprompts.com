'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useTemplateApi, type Template } from '@/lib/api/templates';

export default function Home() {
  const api = useTemplateApi();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await api.listTemplates({
        filter: 'public',
        limit: 9,
        sortBy: 'viewCount',
        sortOrder: 'desc',
      });
      setTemplates(response.items);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Navigate to templates page with search query
    const params = new URLSearchParams();
    if (searchQuery) params.append('search', searchQuery);
    if (selectedTag) params.append('tag', selectedTag);
    window.location.href = `/templates?${params.toString()}`;
  };

  // Extract all unique tags from templates
  const allTags = Array.from(
    new Set(templates.flatMap(t => t.tags))
  ).slice(0, 10).sort();
  return (
    <div className="min-h-screen">
      {/* Hero Section */}

      <section className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Create & Share AI Prompt Templates
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8">
            Build reusable templates with variables, share with your team, and streamline your AI workflow.
          </p>
          
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-8">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-lg"
              />
              <button
                type="submit"
                className="px-8 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
              >
                Search
              </button>
            </div>
          </form>
          
          {/* Popular Tags */}
          {allTags.length > 0 && (
            <div className="flex gap-2 justify-center flex-wrap mb-8">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => {
                    setSelectedTag(tag);
                    handleSearch(new Event('submit') as any);
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-full text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/editor"
              className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
            >
              Create Your First Template
            </Link>
            <Link 
              href="/templates" 
              className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Browse All Templates
            </Link>
          </div>
        </div>
      </section>

      {/* Popular Templates Section */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-3xl font-bold text-center mb-8">Popular Templates</h2>
        
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : templates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {templates.map(template => (
              <Link
                key={template.templateId}
                href={`/templates/${template.templateId}`}
                className="glass-card p-6 hover:shadow-lg transition group"
              >
                <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition">
                  {template.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  By {template.authorEmail}
                </p>
                <div className="flex justify-between items-center text-sm text-gray-500">
                  <span>{template.variableCount || template.variables?.length || 0} variables</span>
                  <span>{template.viewCount || 0} views</span>
                </div>
                {template.tags.length > 0 && (
                  <div className="flex gap-2 flex-wrap mt-3">
                    {template.tags.slice(0, 3).map(tag => (
                      <span
                        key={tag}
                        className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-600 dark:text-gray-400">
            <p>No templates available yet. Be the first to create one!</p>
          </div>
        )}
        
        <div className="text-center">
          <Link
            href="/templates"
            className="inline-block px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            View All Templates →
          </Link>
        </div>
      </section>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="glass-card p-6">
            <div className="w-12 h-12 rounded-full mb-4 flex items-center justify-center" style={{ backgroundColor: 'var(--primary)' }}>
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3">Store Templates</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Save and organize your favorite AI prompts with custom categories and tags.
            </p>
          </div>

          <div className="glass-card p-6">
            <div className="w-12 h-12 rounded-full mb-4 flex items-center justify-center" style={{ backgroundColor: 'var(--secondary)' }}>
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3">Dynamic Variables</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Use [[variables]] in your prompts and populate them instantly with our editor.
            </p>
          </div>

          <div className="glass-card p-6">
            <div className="w-12 h-12 rounded-full mb-4 flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3">Share & Rate</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Share your best prompts with the community and discover top-rated templates.
            </p>
          </div>
        </div>

        {/* Getting Started Section */}
        <div className="glass-card p-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Level Up Your AI Prompts?</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-2xl mx-auto">
            Join thousands of users who are creating, sharing, and discovering amazing AI prompts. 
            Start building your prompt library today.
          </p>
          <Link href="/editor" className="btn-primary inline-block">
            Try the Editor
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-200 dark:border-gray-700 mt-20">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <p className="text-gray-600 dark:text-gray-300">
                © 2024 Gravy Prompts. All rights reserved.
              </p>
            </div>
            <div className="flex space-x-6">
              <Link href="/privacy" className="text-gray-600 dark:text-gray-300 hover:text-primary transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="text-gray-600 dark:text-gray-300 hover:text-primary transition-colors">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}