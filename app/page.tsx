'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useSearch } from '@/lib/search-context';
import { useTemplateApi, type Template } from '@/lib/api/templates';
import TemplateQuickview from '@/components/TemplateQuickview';

export default function HomePage() {
  const { user } = useAuth();
  const { searchQuery, setSearchQuery, setNavSearchVisible } = useSearch();
  const api = useTemplateApi();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heroSearchRef = useRef<HTMLDivElement>(null);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [popularTemplates, setPopularTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isQuickviewOpen, setIsQuickviewOpen] = useState(false);
  const [recentPrompts, setRecentPrompts] = useState<Array<{
    id: string;
    templateTitle: string;
    content: string;
    variables: Record<string, string>;
    createdAt: string;
  }>>([]);

  const popularTags = [
    'ai', 'react', 'marketing', 'sql', 'data-analysis', 'linkedin',
    'project-management', 'ux', 'hr', 'git', 'agile', 'frontend'
  ];

  // Load popular templates and recent prompts on mount
  useEffect(() => {
    // Load recent prompts from localStorage
    const stored = localStorage.getItem('recentPrompts');
    if (stored) {
      try {
        setRecentPrompts(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to load recent prompts:', e);
      }
    }

    // Give the API a moment to start when first loading
    const timer = setTimeout(() => {
      loadPopularTemplates();
    }, 1000);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle scroll detection for search bar transition
  useEffect(() => {
    const handleScroll = () => {
      if (heroSearchRef.current) {
        const rect = heroSearchRef.current.getBoundingClientRect();
        // Show nav search when hero search is about to go under the fixed navbar (64px height)
        const shouldShowNavSearch = rect.bottom < 120;
        setNavSearchVisible(shouldShowNavSearch);
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initial position

    return () => {
      window.removeEventListener('scroll', handleScroll);
      setNavSearchVisible(false); // Reset when leaving home page
    };
  }, [setNavSearchVisible]);

  const loadPopularTemplates = async (retryCount = 0) => {
    try {
      const response = await api.getPopularTemplates({ limit: 12 });
      setPopularTemplates(response.items);
      setInitialLoading(false);
    } catch (error) {
      // Check if it's a network error (API not ready)
      const errorMessage = error instanceof Error ? error.message : '';
      const errorStatus = error && typeof error === 'object' && 'status' in error ? (error as { status: number }).status : -1;
      if (errorMessage === 'Failed to fetch' || errorStatus === 0) {
        if (retryCount < 5) {
          const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s, 8s, 16s
          console.log(`API not ready, retrying in ${delay}ms... (attempt ${retryCount + 1}/5)`);
          setTimeout(() => {
            loadPopularTemplates(retryCount + 1);
          }, delay);
          return;
        }
      }

      console.error('Failed to load popular templates:', error);
      setInitialLoading(false);
    }
  };

  // Debounced search function
  const searchTemplates = useCallback(async (query: string, tags: string[]) => {
    if (!query && tags.length === 0) {
      setTemplates([]);
      return;
    }

    setLoading(true);
    try {
      // When only tags are selected, we need to get more templates to filter
      const limit = tags.length > 0 && !query ? 50 : 20;

      const response = await api.listTemplates({
        search: query || undefined,
        filter: 'public',
        sortBy: 'useCount',
        sortOrder: 'desc',
        limit: limit,
      });

      // Filter by selected tags locally
      let results = response.items;
      if (tags.length > 0) {
        results = results.filter(template => {
          const templateTags = Array.isArray(template.tags) ? template.tags : 
                              (template.tags ? [template.tags] : []);
          return tags.some(tag => templateTags.includes(tag));
        });
      }

      setTemplates(results);
    } catch (error) {
      console.error('Search failed:', error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  // Handle search input change with debouncing
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      searchTemplates(value, selectedTags);
    }, 300);
  };

  // Handle tag selection
  const toggleTag = (tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];

    setSelectedTags(newTags);
    searchTemplates(searchQuery, newTags);
  };

  // Handle template selection
  const selectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setIsQuickviewOpen(true);
  };

  // Handle save prompt
  const handleSavePrompt = async (content: string, variables: Record<string, string>) => {
    if (!selectedTemplate) return;

    // Save to recent prompts
    const newPrompt = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      templateTitle: selectedTemplate.title,
      content: content,
      variables: variables,
      createdAt: new Date().toISOString()
    };

    const updatedPrompts = [newPrompt, ...recentPrompts].slice(0, 10);
    setRecentPrompts(updatedPrompts);
    localStorage.setItem('recentPrompts', JSON.stringify(updatedPrompts));

    // Save to user account if logged in
    if (user) {
      try {
        await api.savePrompt({
          templateId: selectedTemplate.templateId,
          templateTitle: selectedTemplate.title,
          content: content,
          variables: variables
        });
        alert('Prompt saved to your account!');
      } catch (error) {
        console.error('Failed to save prompt:', error);
      }
    }

    // Track usage
    try {
      await api.populateTemplate(
        selectedTemplate.templateId,
        { variables: variables }
      );
    } catch {
      console.error('Failed to track usage');
    }
  };

  const getCategoryIcon = (template: Template) => {
    const content = (template.content || '').toLowerCase();
    const title = (template.title || '').toLowerCase();

    if (content.includes('email') || title.includes('email')) return '✉️';
    if (content.includes('code') || title.includes('code')) return '💻';
    if (content.includes('blog') || title.includes('article')) return '✍️';
    if (content.includes('sales') || title.includes('marketing')) return '📢';
    if (content.includes('support') || title.includes('customer')) return '💬';
    if (content.includes('data') || title.includes('analysis')) return '📊';
    if (content.includes('game') || title.includes('game')) return '🎮';
    if (content.includes('design') || title.includes('design')) return '🎨';
    if (content.includes('research') || title.includes('research')) return '🔬';
    return '📝';
  };

  // Display templates - either search results or popular templates
  const displayTemplates = searchQuery || selectedTags.length > 0 ? templates : popularTemplates;
  const showingResults = searchQuery || selectedTags.length > 0;

  return (
    <div className="flex flex-col flex-1">
      {/* Hero Search Section */}
      <div ref={heroSearchRef} className="bg-gradient-to-b from-gray-50 to-white py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Find the perfect <span className="text-primary">prompt</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Search thousands of AI prompts for every use case
          </p>

          {/* Big Search Bar */}
          <div className="relative max-w-2xl mx-auto mb-6">
            <input
              type="text"
              placeholder="Search for templates... (e.g., 'email response', 'blog post outline')"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full px-6 py-4 pl-14 text-lg border-2 border-gray-300 rounded-full focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all shadow-lg hover:shadow-xl hover:border-gray-400"
              autoFocus
            />
            <svg className="absolute left-5 top-1/2 transform -translate-y-1/2 w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {(loading || initialLoading) && (
              <div className="absolute right-5 top-1/2 transform -translate-y-1/2">
                <svg className="animate-spin h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            )}
          </div>

          {/* Tag Pills */}
          <div className="flex gap-2 flex-wrap justify-center">
            {popularTags.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedTags.includes(tag)
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-white hover:bg-gray-50 border border-gray-300'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">
            {showingResults
              ? `${displayTemplates.length} Results`
              : '🔥 Popular Templates'}
          </h2>

          {initialLoading || (loading && displayTemplates.length === 0) ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-lg shadow-md border border-gray-200 p-6 animate-pulse"
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 bg-gray-200 rounded"></div>
                    <div className="flex-1">
                      <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-full"></div>
                    <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <div className="h-6 bg-gray-200 rounded-full w-16"></div>
                    <div className="h-6 bg-gray-200 rounded-full w-20"></div>
                  </div>
                </div>
              ))}
                <div className="text-center pt-4">
                  <p className="text-sm text-gray-500">
                    Loading templates... If this takes too long, the API might still be starting up.
                  </p>
                </div>
            </div>
          ) : displayTemplates.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                {showingResults
                  ? 'No templates found. Try different keywords or tags.'
                  : 'No templates available.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayTemplates.map(template => (
                <button
                  key={template.templateId}
                  onClick={() => selectTemplate(template)}
                  className="bg-white rounded-lg shadow-md border border-gray-200 p-6 text-left transition-all hover:shadow-xl hover:border-primary hover:transform hover:-translate-y-1 group"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-3xl">{getCategoryIcon(template)}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 group-hover:text-primary transition-colors">
                        {template.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {template.useCount || 0} uses • {template.variableCount || 0} variables
                      </p>
                    </div>
                  </div>

                  {/* Preview text */}
                  <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                    {template.content.replace(/<[^>]*>/g, '').substring(0, 100)}...
                  </p>

                  {template.tags && template.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {(Array.isArray(template.tags) ? template.tags : [template.tags])
                        .slice(0, 3)
                        .map(tag => (
                          <span
                            key={tag}
                            className="px-2 py-1 text-xs bg-gray-100 group-hover:bg-primary/10 rounded-full transition-colors"
                          >
                            {tag}
                          </span>
                        ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Template Quickview */}
      <TemplateQuickview
        template={selectedTemplate}
        isOpen={isQuickviewOpen}
        onClose={() => setIsQuickviewOpen(false)}
        onSavePrompt={handleSavePrompt}
      />
    </div>
  );
}