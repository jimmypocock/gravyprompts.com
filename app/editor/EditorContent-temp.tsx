'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
// import GravyJS from 'gravyjs';
// import type { GravyJSRef } from 'gravyjs';
// import 'gravyjs/dist/index.css';
import { useAuth } from '@/lib/auth-context';
import { useTemplateApi, type Template } from '@/lib/api/templates';

// const sampleSnippets = [
//   {
//     title: 'Email Signature',
//     content: `
//       <p>Best regards,<br>
//       [[name]]<br>
//       [[title]]<br>
//       [[company]]</p>
//     `
//   },
//   {
//     title: 'Meeting Agenda',
//     content: `
//       <h3>Meeting: [[meeting_title]]</h3>
//       <p>Date: [[date]]<br>
//       Time: [[time]]<br>
//       Location: [[location]]</p>
//       <p>Agenda:</p>
//       <ul>
//         <li>[[agenda_item_1]]</li>
//         <li>[[agenda_item_2]]</li>
//         <li>[[agenda_item_3]]</li>
//       </ul>
//     `
//   },
//   {
//     title: 'Product Description',
//     content: `
//       <h2>[[product_name]]</h2>
//       <p><strong>Price:</strong> $[[price]]</p>
//       <p><strong>Description:</strong><br>
//       [[product_description]]</p>
//       <p><strong>Features:</strong></p>
//       <ul>
//         <li>[[feature_1]]</li>
//         <li>[[feature_2]]</li>
//         <li>[[feature_3]]</li>
//       </ul>
//     `
//   }
// ];

export default function EditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get('id');
  
  const { user } = useAuth();
  const { 
    // templates,
    // loading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplate
  } = useTemplateApi();
  
  const [templateTitle, setTemplateTitle] = useState('');
  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // TEMPORARY: Remove GravyJS functionality
  // const gravyJSRef = useRef<any>(null);

  // Load template if ID is provided
  useEffect(() => {
    if (templateId) {
      loadTemplate(templateId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  const loadTemplate = async (id: string) => {
    try {
      const template = await getTemplate(id);
      if (template) {
        setCurrentTemplate(template);
        setTemplateTitle(template.title);
        // TEMPORARY: Comment out GravyJS
        // if (gravyJSRef.current) {
        //   gravyJSRef.current.setContent(template.content);
        // }
      }
    } catch (error) {
      console.error('Failed to load template:', error);
    }
  };

  const handleSave = async () => {
    if (!user) {
      alert('Please log in to save templates');
      return;
    }

    if (!templateTitle.trim()) {
      alert('Please enter a template name');
      return;
    }

    setIsSaving(true);
    try {
      // TEMPORARY: Use placeholder content
      const content = '<p>Temporary content - GravyJS not loaded</p>';
      
      if (currentTemplate) {
        // Update existing template
        await updateTemplate(currentTemplate.templateId, {
          title: templateTitle,
          content: content
        });
      } else {
        // Create new template
        const newTemplate = await createTemplate({
          title: templateTitle,
          content: content,
          visibility: 'private',
          tags: []
        });
        setCurrentTemplate(newTemplate);
        // Update URL with new template ID
        router.push(`/editor?id=${newTemplate.templateId}`);
      }
      
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save template:', error);
      alert('Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentTemplate) return;
    
    try {
      await deleteTemplate(currentTemplate.templateId);
      router.push('/editor');
    } catch (error) {
      console.error('Failed to delete template:', error);
      alert('Failed to delete template');
    }
  };

  const handleNew = () => {
    if (hasChanges) {
      if (!confirm('You have unsaved changes. Are you sure you want to create a new template?')) {
        return;
      }
    }
    setCurrentTemplate(null);
    setTemplateTitle('');
    setHasChanges(false);
    router.push('/editor');
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <input
            type="text"
            value={templateTitle}
            onChange={(e) => {
              setTemplateTitle(e.target.value);
              setHasChanges(true);
            }}
            placeholder="Enter template name..."
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : currentTemplate ? 'Update' : 'Save'}
          </button>
          <button
            onClick={handleNew}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            New
          </button>
          {currentTemplate && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="rounded-lg border p-8 bg-gray-50">
        <p className="text-center text-gray-500">
          GravyJS Editor is temporarily disabled for deployment.
          <br />
          This is where the rich text editor will appear.
        </p>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-4">Delete Template?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete &quot;{currentTemplate?.title}&quot;? This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleDelete();
                  setShowDeleteConfirm(false);
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}