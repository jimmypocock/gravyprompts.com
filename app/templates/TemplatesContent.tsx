"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useTemplateApi, type Template } from "@/lib/api/templates";

export default function TemplatesContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const api = useTemplateApi();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "mine" | "public">("public");
  const [searchQuery, setSearchQuery] = useState(
    searchParams.get("search") || "",
  );
  const [selectedTag, setSelectedTag] = useState(searchParams.get("tag") || "");
  const [sortBy, setSortBy] = useState<"createdAt" | "viewCount" | "useCount">(
    "createdAt",
  );

  useEffect(() => {
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, selectedTag, sortBy]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.listTemplates({
        filter,
        tag: selectedTag || undefined,
        search: searchQuery || undefined,
        sortBy,
        sortOrder: "desc",
        limit: 50, // Show more templates
      });

      setTemplates(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadTemplates();
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      await api.deleteTemplate(templateId);
      setTemplates(templates.filter((t) => t.templateId !== templateId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete template");
    }
  };

  const getCategoryIcon = (template: Template) => {
    const content = (template.content || "").toLowerCase();
    const title = (template.title || "").toLowerCase();

    if (content.includes("email") || title.includes("email")) return "✉️";
    if (content.includes("code") || title.includes("code")) return "💻";
    if (content.includes("blog") || title.includes("article")) return "✍️";
    if (content.includes("sales") || title.includes("marketing")) return "📢";
    if (content.includes("support") || title.includes("customer")) return "💬";
    if (content.includes("data") || title.includes("analysis")) return "📊";
    if (content.includes("game") || title.includes("game")) return "🎮";
    if (content.includes("design") || title.includes("design")) return "🎨";
    if (content.includes("research") || title.includes("research")) return "🔬";
    return "📝";
  };

  return (
    <div className="min-h-screen bg-white pt-20">
      {/* Search and Filters Section */}
      <div className="sticky top-16 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <form onSubmit={handleSearch} className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-full focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <button
              type="submit"
              className="px-6 py-2 bg-primary text-white rounded-full hover:bg-primary-hover transition-colors font-medium"
            >
              Search
            </button>
          </form>

          {/* Filter Pills */}
          <div className="flex gap-2 items-center mt-4 overflow-x-auto pb-2">
            <div className="flex gap-2">
              <button
                onClick={() => setFilter("all")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  filter === "all"
                    ? "bg-gray-900 text-white"
                    : "border border-gray-300 hover:border-gray-400"
                }`}
              >
                All Templates
              </button>
              <button
                onClick={() => setFilter("public")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  filter === "public"
                    ? "bg-gray-900 text-white"
                    : "border border-gray-300 hover:border-gray-400"
                }`}
              >
                Public
              </button>
              {user && (
                <button
                  onClick={() => setFilter("mine")}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    filter === "mine"
                      ? "bg-gray-900 text-white"
                      : "border border-gray-300 hover:border-gray-400"
                  }`}
                >
                  My Templates
                </button>
              )}
            </div>

            <div className="h-6 w-px bg-gray-300 mx-2" />

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-4 py-2 border border-gray-300 rounded-full text-sm bg-transparent focus:ring-2 focus:ring-primary focus:border-primary"
            >
              <option value="createdAt">Newest First</option>
              <option value="viewCount">Most Viewed</option>
              <option value="useCount">Most Used</option>
            </select>

            {selectedTag && (
              <>
                <div className="h-6 w-px bg-gray-300 mx-2" />
                <button
                  onClick={() => setSelectedTag("")}
                  className="px-4 py-2 bg-gray-100 rounded-full text-sm flex items-center gap-2"
                >
                  <span>Tag: {selectedTag}</span>
                  <span className="text-gray-500 hover:text-gray-700">×</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {filter === "mine" ? "My Templates" : "Template Marketplace"}
            </h1>
            <p className="text-gray-600 mt-2">
              {loading
                ? "Loading..."
                : `${templates.length} templates available`}
            </p>
          </div>
          {user && (
            <Link
              href="/editor"
              className="px-6 py-3 bg-primary text-white rounded-full hover:bg-primary-hover transition-colors font-medium"
            >
              Create Template
            </Link>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200"
              >
                <div className="aspect-[4/3] bg-gray-200 animate-pulse" />
                <div className="p-4">
                  <div className="h-6 bg-gray-200 rounded animate-pulse mb-2" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-xl font-semibold mb-2">No templates found</h3>
            <p className="text-gray-600 mb-6">
              {filter === "mine"
                ? "You haven't created any templates yet."
                : "No templates match your criteria."}
            </p>
            {user && (
              <Link
                href="/editor"
                className="inline-block px-6 py-3 bg-primary text-white rounded-full hover:bg-primary-hover transition-colors"
              >
                Create Your First Template
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {templates.map((template) => (
              <div
                key={template.templateId}
                className="group bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200 hover:shadow-lg transition-all"
              >
                {/* Template Preview */}
                <Link href={`/templates/${template.templateId}`}>
                  <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/10" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-6xl opacity-50">
                        {getCategoryIcon(template)}
                      </span>
                    </div>
                    {template.visibility === "private" && (
                      <span className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-900 text-white rounded-full">
                        Private
                      </span>
                    )}
                  </div>
                </Link>

                <div className="p-4">
                  <Link href={`/templates/${template.templateId}`}>
                    <h3 className="font-semibold text-gray-900 group-hover:text-primary transition-colors line-clamp-2 mb-2">
                      {template.title}
                    </h3>
                  </Link>

                  <div className="text-sm text-gray-600 mb-3">
                    <p>By {template.authorEmail}</p>
                    <p>{template.variables?.length || 0} variables</p>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                        {template.viewCount || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                          />
                        </svg>
                        {template.useCount || 0}
                      </span>
                    </div>
                  </div>

                  {template.tags && template.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap mb-3">
                      {template.tags.slice(0, 3).map((tag) => (
                        <button
                          key={tag}
                          onClick={() => setSelectedTag(tag)}
                          className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}

                  {template.isOwner && (
                    <div className="flex gap-2 pt-3 border-t border-gray-200">
                      <Link
                        href={`/editor?templateId=${template.templateId}`}
                        className="flex-1 px-3 py-2 text-sm text-center bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(template.templateId)}
                        className="flex-1 px-3 py-2 text-sm text-center bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
