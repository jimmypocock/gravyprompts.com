'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useTemplateApi, type Template } from '@/lib/api/templates';

export default function TemplatesPage() {
  const { user } = useAuth();
  const api = useTemplateApi();
  
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'public' | 'mine' | 'all'>('public');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [nextToken, setNextToken] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, selectedTag]);

  const loadTemplates = async (append = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.listTemplates({
        filter,
        tag: selectedTag || undefined,
        search: searchQuery || undefined,
        limit: 20,
        nextToken: append ? (nextToken || undefined) : undefined,
      });

      if (append) {
        setTemplates(prev => [...prev, ...response.items]);
      } else {
        setTemplates(response.items);
      }
      
      setNextToken(response.nextToken || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadTemplates();
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    try {
      await api.deleteTemplate(templateId);
      setTemplates(prev => prev.filter(t => t.templateId !== templateId));
    } catch {
      alert('Failed to delete template');
    }
  };

  // Extract all unique tags from templates
  const allTags = Array.from(
    new Set(templates.flatMap(t => t.tags))
  ).sort();

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Template Library</h1>
          {user && (
            <Link
              href="/editor"
              className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
            >
              Create Template
            </Link>
          )}
        </div>

        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          <form onSubmit={handleSearch} className="flex gap-4">
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            />
            <button
              type="submit"
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
            >
              Search
            </button>
          </form>

          <div className="flex gap-4 flex-wrap items-center">
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('public')}
                className={`px-4 py-2 rounded-lg transition ${
                  filter === 'public'
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Public
              </button>
              {user && (
                <>
                  <button
                    onClick={() => setFilter('mine')}
                    className={`px-4 py-2 rounded-lg transition ${
                      filter === 'mine'
                        ? 'bg-primary text-white'
                        : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    My Templates
                  </button>
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2 rounded-lg transition ${
                      filter === 'all'
                        ? 'bg-primary text-white'
                        : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    All
                  </button>
                </>
              )}
            </div>

            {allTags.length > 0 && (
              <div className="flex gap-2 items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Tags:</span>
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    className={`px-3 py-1 text-sm rounded-full transition ${
                      selectedTag === tag
                        ? 'bg-primary text-white'
                        : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Templates Grid */}
        {loading && templates.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-600">
            <p>{error}</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12 text-gray-600 dark:text-gray-400">
            <p>No templates found</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map(template => (
                <div
                  key={template.templateId}
                  className="border rounded-lg p-6 hover:shadow-lg transition dark:border-gray-700"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-semibold">{template.title}</h3>
                    {template.visibility === 'private' && (
                      <span className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded">
                        Private
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    <p>By {template.authorEmail}</p>
                    <p>{template.variables.length} variables</p>
                    <p>{template.viewCount} views • {template.useCount} uses</p>
                  </div>

                  {template.tags.length > 0 && (
                    <div className="flex gap-2 flex-wrap mb-4">
                      {template.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Link
                      href={`/templates/${template.templateId}`}
                      className="flex-1 px-4 py-2 text-center bg-primary text-white rounded hover:bg-primary/90 transition"
                    >
                      View
                    </Link>
                    {template.isOwner && (
                      <>
                        <Link
                          href={`/editor?templateId=${template.templateId}`}
                          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(template.templateId)}
                          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {nextToken && (
              <div className="text-center mt-8">
                <button
                  onClick={() => loadTemplates(true)}
                  disabled={loading}
                  className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}