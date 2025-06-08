'use client'

import { useRef, useState } from 'react'
import GravyJS from 'gravyjs'
import type { GravyJSRef } from 'gravyjs'
import 'gravyjs/dist/index.css'

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

export default function EditorPage() {
  const [content, setContent] = useState('')
  const [populatedContent, setPopulatedContent] = useState<{html: string, plainText: string} | null>(null)
  const editorRef = useRef<GravyJSRef | null>(null)

  const handlePopulateVariables = async () => {
    if (editorRef.current) {
      const result = await editorRef.current.populateVariables()
      if (result) {
        setPopulatedContent(result)
      }
    }
  }

  const copyToClipboard = async (text: string, type = 'html') => {
    try {
      if (type === 'html' && populatedContent) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([populatedContent.html], { type: 'text/html' }),
            'text/plain': new Blob([populatedContent.plainText], { type: 'text/plain' })
          })
        ])
        alert('Content copied to clipboard with formatting!')
      } else {
        await navigator.clipboard.writeText(text)
        alert('Content copied to clipboard!')
      }
    } catch (error) {
      console.error('Failed to copy:', error)
      // Fallback method
      const tempTextarea = document.createElement('textarea')
      tempTextarea.value = text
      document.body.appendChild(tempTextarea)
      tempTextarea.select()
      document.execCommand('copy')
      document.body.removeChild(tempTextarea)
      alert('Content copied to clipboard!')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          GravyJS Editor Demo
        </h1>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
            Template Editor
          </h2>
          
          <div className="mb-4 flex gap-4">
            <button
              onClick={handlePopulateVariables}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              🔄 Populate Variables
            </button>
            <button
              onClick={() => {
                if (editorRef.current) {
                  editorRef.current.setContent('')
                }
                setPopulatedContent(null)
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              🗑️ Clear Content
            </button>
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
      </div>
    </div>
  )
}