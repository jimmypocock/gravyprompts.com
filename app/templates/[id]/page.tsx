'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTemplateApi, type Template } from '@/lib/api/templates';
import GravyJS from 'gravyjs';
import type { GravyJSRef } from 'gravyjs';
import 'gravyjs/dist/index.css';

export default function TemplateDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const api = useTemplateApi();
  const editorRef = useRef<GravyJSRef | null>(null);

  const templateId = params.id as string;
  const shareToken = searchParams.get('token');

  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [populatedContent, setPopulatedContent] = useState<{html: string, plainText: string} | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [editorContent, setEditorContent] = useState('');

  useEffect(() => {
    loadTemplate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, shareToken]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await api.getTemplate(templateId, shareToken || undefined);
      setTemplate(data);
      setEditorContent(data.content);

      // Wait for next tick and set content in editor
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.setContent(data.content);
        }
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load template');
    } finally {
      setLoading(false);
    }
  };

  const handlePopulate = async () => {
    if (!editorRef.current) {
      console.error('Editor ref not available');
      return;
    }

    // Debug: Check current content
    const currentContent = editorRef.current.getContent();
    console.log('Current editor content:', currentContent);

    // Use GravyJS's built-in populate function
    const result = await editorRef.current.populateVariables();
    console.log('Populate result:', result);

    if (result) {
      setPopulatedContent(result);

      // Track usage in the backend
      try {
        await api.populateTemplate(
          templateId,
          { variables: result.variables || {} },
          shareToken || undefined
        );
      } catch {
        console.error('Failed to track usage');
      }
    }
  };

  const handleShare = async () => {
    if (!template || !template.isOwner) return;

    try {
      setSharing(true);
      const response = await api.shareTemplate(templateId, {
        action: 'generate_link',
        expiresIn: 7,
      });
      setShareUrl(response.shareUrl || null);
    } catch {
      alert('Failed to generate share link');
    } finally {
      setSharing(false);
    }
  };

  const copyToClipboard = async (text: string, type = 'plain') => {
    try {
      if (type === 'html' && populatedContent) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([populatedContent.html], { type: 'text/html' }),
            'text/plain': new Blob([populatedContent.plainText], { type: 'text/plain' })
          })
        ]);
        alert('Copied to clipboard with formatting!');
      } else {
        await navigator.clipboard.writeText(text);
        alert('Copied to clipboard!');
      }
    } catch {
      // Fallback method
      const tempTextarea = document.createElement('textarea');
      tempTextarea.value = text;
      document.body.appendChild(tempTextarea);
      tempTextarea.select();
      document.execCommand('copy');
      document.body.removeChild(tempTextarea);
      alert('Copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Template not found'}</p>
          <Link href="/templates" className="text-primary hover:underline">
            Back to Templates
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link href="/templates" className="text-primary hover:underline mb-4 inline-block">
            ← Back to Templates
          </Link>

          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold mb-2">{template.title}</h1>
              <p className="text-gray-600 dark:text-gray-400">
                By {template.authorEmail} • {template.viewCount} views • {template.useCount} uses
              </p>
            </div>

            <div className="flex gap-2">
              {template.isOwner && (
                <>
                  <Link
                    href={`/editor?templateId=${templateId}`}
                    className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={handleShare}
                    disabled={sharing}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                  >
                    {sharing ? 'Generating...' : 'Share'}
                  </button>
                </>
              )}
            </div>
          </div>

          {template.tags.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-4">
              {template.tags.map(tag => (
                <span
                  key={tag}
                  className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {shareUrl && (
          <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm font-medium mb-2">Share this template:</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border rounded"
              />
              <button
                onClick={() => copyToClipboard(shareUrl)}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition"
              >
                Copy
              </button>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
              This link will expire in 7 days
            </p>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Template Editor</h2>

          <div className="mb-4">
            <button
              onClick={handlePopulate}
              className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
            >
              🔄 Populate Template
            </button>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Click the button above to fill in the variables and generate your content
            </p>
          </div>

          <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
            <GravyJS
              ref={editorRef}
              initialValue={editorContent}
              onChange={(content) => setEditorContent(content)}
              placeholder="Loading template content..."
              className="min-h-[300px]"
              variablePrefix="[["
              variableSuffix="]]"
            />
          </div>

          {template.variables.length > 0 && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded">
              <p className="text-sm font-medium mb-2">Variables in this template:</p>
              <div className="flex gap-2 flex-wrap">
                {template.variables.map(variable => (
                  <span
                    key={variable}
                    className="px-2 py-1 text-sm bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded"
                  >
                    [[{variable}]]
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Populated Result */}
        {populatedContent && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold">Result</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(populatedContent.html, 'html')}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                >
                  📋 Copy with Formatting
                </button>
                <button
                  onClick={() => copyToClipboard(populatedContent.plainText, 'plain')}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
                >
                  📄 Copy as Text
                </button>
              </div>
            </div>
            <div
              dangerouslySetInnerHTML={{
                __html: populatedContent.html
              }}
              className="prose dark:prose-invert max-w-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}