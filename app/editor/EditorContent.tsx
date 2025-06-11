'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import GravyJS from 'gravyjs';
import type { GravyJSRef } from 'gravyjs';
import 'gravyjs/dist/index.css';
import { useAuth } from '@/lib/auth-context';
import { useTemplateApi, type Template } from '@/lib/api/templates';

const sampleSnippets = [
  {
    title: 'Email Signature',
    content: `
      <p>Best regards,<br>
      [[name]]<br>
      [[title]]<br>
      [[company]]</p>
    `
  },
  {
    title: 'Meeting Reminder',
    content: '<p>Don\'t forget about our meeting at [[time]] on [[date]].</p>'
  },
  {
    title: 'Welcome Message',
    content: '<p>Welcome to [[company]], [[name]]! We\'re excited to have you on board.</p>'
  }
];

export default function EditorContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = useTemplateApi();

  const templateId = searchParams.get('templateId');

  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [populatedContent, setPopulatedContent] = useState<{html: string, plainText: string} | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [originalTemplate, setOriginalTemplate] = useState<Template | null>(null);
  const editorRef = useRef<GravyJSRef | null>(null);

  useEffect(() => {
    if (templateId) {
      loadTemplate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  const loadTemplate = async () => {
    if (!templateId) return;

    try {
      setLoading(true);
      const template = await api.getTemplate(templateId);

      if (!template.isOwner) {
        alert('You can only edit your own templates');
        router.push('/templates');
        return;
      }

      setOriginalTemplate(template);
      setTitle(template.title);
      setContent(template.content);
      setTags(template.tags);
      setVisibility(template.visibility);

      if (editorRef.current) {
        editorRef.current.setContent(template.content);
      }
    } catch {
      alert('Failed to load template');
      router.push('/templates');
    } finally {
      setLoading(false);
    }
  };

  const handlePopulateVariables = async () => {
    if (editorRef.current) {
      const result = await editorRef.current.populateVariables();
      if (result) {
        setPopulatedContent(result);
      }
    }
  };

  const handleSave = async () => {
    if (!user) {
      alert('Please log in to save templates');
      return;
    }

    if (!title.trim()) {
      alert('Please enter a title');
      return;
    }

    if (!content.trim()) {
      alert('Please add some content');
      return;
    }

    try {
      setSaving(true);

      if (templateId && originalTemplate) {
        await api.updateTemplate(templateId, {
          title,
          content,
          tags,
          visibility,
        });
        alert('Template updated successfully!');
      } else {
        const result = await api.createTemplate({
          title,
          content,
          tags,
          visibility,
        });
        alert('Template created successfully!');
        router.push(`/templates/${result.templateId}`);
      }
    } catch (err) {
      console.error('Save template error:', err);
      if (err instanceof Error) {
        // Check if it's a TemplateApiError with details
        const apiError = err as any;
        if (apiError.details) {
          console.error('Validation details:', apiError.details);
          alert(`Validation failed:\n${Array.isArray(apiError.details) ? apiError.details.join('\n') : apiError.message}`);
        } else {
          alert(err.message);
        }
      } else {
        alert('Failed to save template');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      
      // Split by comma to support comma-separated tags
      const newTags = tagInput
        .split(',')
        .map(tag => tag.trim().toLowerCase())
        .filter(tag => tag.length > 0 && !tags.includes(tag));
      
      // Add all new tags (up to the limit)
      const remainingSlots = 10 - tags.length;
      const tagsToAdd = newTags.slice(0, remainingSlots);
      
      if (tagsToAdd.length > 0) {
        setTags([...tags, ...tagsToAdd]);
        setTagInput('');
      }
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const copyToClipboard = async (text: string, type = 'html') => {
    try {
      if (type === 'html' && populatedContent) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([populatedContent.html], { type: 'text/html' }),
            'text/plain': new Blob([populatedContent.plainText], { type: 'text/plain' })
          })
        ]);
        alert('Content copied to clipboard with formatting!');
      } else {
        await navigator.clipboard.writeText(text);
        alert('Content copied to clipboard!');
      }
    } catch (error) {
      console.error('Failed to copy:', error);
      const tempTextarea = document.createElement('textarea');
      tempTextarea.value = text;
      document.body.appendChild(tempTextarea);
      tempTextarea.select();
      document.execCommand('copy');
      document.body.removeChild(tempTextarea);
      alert('Content copied to clipboard!');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          {templateId ? 'Edit Template' : 'Create Template'}
        </h1>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter template title..."
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Visibility
                  </label>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="private">Private</option>
                    <option value="public">Public</option>
                  </select>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Tags (up to 10)
                </label>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder="Type tags and press Enter (comma-separated for multiple)..."
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
                {tags.length > 0 && (
                  <div className="flex gap-2 flex-wrap mt-2">
                    {tags.map(tag => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-gray-200 dark:bg-gray-600 rounded-full text-sm flex items-center gap-1"
                      >
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="text-red-600 hover:text-red-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mb-4 flex gap-4 flex-wrap">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : (templateId ? '💾 Update Template' : '💾 Save Template')}
                </button>
                <button
                  onClick={handlePopulateVariables}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  🔄 Populate Variables
                </button>
                <button
                  onClick={() => {
                    if (editorRef.current) {
                      editorRef.current.setContent('');
                    }
                    setPopulatedContent(null);
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                >
                  🗑️ Clear Content
                </button>
                {templateId && (
                  <button
                    onClick={() => router.push(`/templates/${templateId}`)}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                  >
                    👁️ View Template
                  </button>
                )}
              </div>

              <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                <GravyJS
                  ref={editorRef}
                  initialValue={content}
                  onChange={setContent}
                  snippets={sampleSnippets}
                  placeholder="Create your template here... Use [[variable]] syntax for variables"
                  className="min-h-[300px]"
                  variablePrefix="[["
                  variableSuffix="]]"
                />
              </div>
            </div>

            {populatedContent && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                    Populated Content
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(populatedContent.html, 'html')}
                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
                    >
                      📋 Copy with Formatting
                    </button>
                    <button
                      onClick={() => copyToClipboard(populatedContent.plainText, 'plain')}
                      className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm"
                    >
                      📄 Copy as Plain Text
                    </button>
                  </div>
                </div>
                <div
                  className="prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: populatedContent.html }}
                />
              </div>
            )}

            {visibility === 'public' && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 mb-6">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Note:</strong> Public templates will be reviewed for inappropriate content before being made visible to others.
                </p>
              </div>
            )}

            <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2 text-blue-900 dark:text-blue-200">
                💡 How to Use
              </h3>
              <ol className="list-decimal list-inside space-y-1 text-blue-800 dark:text-blue-300">
                <li>Type your content in the editor above</li>
                <li>Use [[variable]] syntax to create placeholders</li>
                <li>Select snippets from the dropdown or create your own</li>
                <li>Click &quot;Populate Variables&quot; to fill in the values</li>
                <li>Copy the result with formatting preserved</li>
              </ol>
            </div>
          </>
        )}
      </div>
    </div>
  );
}