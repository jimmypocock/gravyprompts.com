'use client';

import { useState, useEffect } from 'react';
import { getApprovalQueue, processApproval, ApprovalQueueItem } from '@/lib/api/admin';
import { formatDistanceToNow } from 'date-fns';
import { Check, X, Eye } from 'lucide-react';

export default function ApprovalQueue() {
  const [queue, setQueue] = useState<ApprovalQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<ApprovalQueueItem | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [notes, setNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'rejected'>('pending');

  useEffect(() => {
    loadQueue();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function loadQueue() {
    try {
      setLoading(true);
      const data = await getApprovalQueue(activeTab);
      setQueue(data.templates);
    } catch (error) {
      console.error('Error loading approval queue:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleApproval(templateId: string, action: 'approve' | 'reject') {
    if (action === 'reject' && !rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    try {
      setProcessing(templateId);
      await processApproval(
        templateId, 
        action, 
        action === 'reject' ? rejectionReason : undefined,
        notes.trim() || undefined
      );
      
      // Remove from queue
      setQueue(queue.filter(t => t.templateId !== templateId));
      
      // Reset form
      setSelectedTemplate(null);
      setRejectionReason('');
      setNotes('');
    } catch (error) {
      console.error('Error processing approval:', error);
      alert('Failed to process approval');
    } finally {
      setProcessing(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div data-testid="loading-spinner" className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveTab('pending')}
              className={`${
                activeTab === 'pending'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors`}
            >
              Pending ({activeTab === 'pending' ? queue.length : '...'})
            </button>
            <button
              onClick={() => setActiveTab('rejected')}
              className={`${
                activeTab === 'rejected'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors`}
            >
              Rejected
            </button>
          </nav>
        </div>

        <div className="p-6">
          {queue.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No templates {activeTab === 'pending' ? 'pending approval' : 'rejected'}
            </p>
          ) : (
            <div className="space-y-4">
              {queue.map((template) => (
                <div
                  key={template.templateId}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {template.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        By {template.authorEmail} • {formatDistanceToNow(new Date(template.createdAt))} ago
                      </p>
                      {template.tags && template.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {template.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => setSelectedTemplate(template)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        title="Preview"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      {activeTab === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApproval(template.templateId, 'approve')}
                            disabled={processing === template.templateId}
                            className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                            title="Approve"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedTemplate(template);
                              setRejectionReason('');
                              setNotes('');
                            }}
                            disabled={processing === template.templateId}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                            title="Reject"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div role="dialog" className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b">
              <h2 className="text-2xl font-bold">{selectedTemplate.title}</h2>
              <p className="text-gray-600 mt-1">
                By {selectedTemplate.authorEmail} • {formatDistanceToNow(new Date(selectedTemplate.createdAt))} ago
              </p>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="prose max-w-none">
                <div dangerouslySetInnerHTML={{ __html: selectedTemplate.content }} />
              </div>
              
              {selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
                <div className="mt-6 pt-6 border-t">
                  <h3 className="font-semibold mb-2">Variables:</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.variables.map((variable) => (
                      <span
                        key={variable}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm"
                      >
                        {variable}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Approval/Rejection Form */}
            {activeTab === 'pending' && (
              <div className="p-6 border-t bg-gray-50">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes (optional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                      rows={2}
                      placeholder="Add any notes about this template..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rejection Reason (required for rejection)
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                      rows={2}
                      placeholder="Explain why this template is being rejected..."
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => {
                  setSelectedTemplate(null);
                  setRejectionReason('');
                  setNotes('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                Close
              </button>
              {activeTab === 'pending' && (
                <>
                  <button
                    onClick={() => handleApproval(selectedTemplate.templateId, 'reject')}
                    disabled={processing === selectedTemplate.templateId || !rejectionReason.trim()}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    Reject Template
                  </button>
                  <button
                    onClick={() => handleApproval(selectedTemplate.templateId, 'approve')}
                    disabled={processing === selectedTemplate.templateId}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    Approve Template
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}