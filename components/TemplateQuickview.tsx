"use client";

import { useState, useRef, useEffect } from "react";
import { Template } from "@/lib/api/templates";
import { useAuth } from "@/lib/auth-context";
import GravyJS from "gravyjs";
import type { GravyJSRef } from "gravyjs";
import "gravyjs/dist/index.css";
import Link from "next/link";

interface TemplateQuickviewProps {
  template: Template | null;
  isOpen: boolean;
  onClose: () => void;
  onSavePrompt?: (content: string, variables: Record<string, string>) => void;
}

export default function TemplateQuickview({
  template,
  isOpen,
  onClose,
  onSavePrompt,
}: TemplateQuickviewProps) {
  const { user } = useAuth();
  const editorRef = useRef<GravyJSRef | null>(null);
  const [variableInputs, setVariableInputs] = useState<Record<string, string>>(
    {},
  );
  const [populatedContent, setPopulatedContent] = useState<{
    html: string;
    plainText: string;
    variables: Record<string, string>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingComplete, setLoadingComplete] = useState(false);

  // Reset when template changes
  useEffect(() => {
    if (template) {
      // Check if we're loading (template exists but no content yet)
      setIsLoading(!template.content);
      setLoadingComplete(false);
      
      if (template.content) {
        // Content is loaded, trigger completion animation
        setLoadingComplete(true);
        
        if (editorRef.current) {
          editorRef.current.setContent(template.content);
          setPopulatedContent(null);

          // Initialize variable inputs
          const initialVars: Record<string, string> = {};
          if (template.variables) {
            template.variables.forEach((variable) => {
              initialVars[variable] = "";
            });
          }
          setVariableInputs(initialVars);
        }
        
        // Remove loading state after animation completes
        setTimeout(() => {
          setIsLoading(false);
        }, 300);
      }
    }
  }, [template]);

  // Check if all variables are filled
  const allVariablesFilled =
    template?.variables?.every(
      (variable) => variableInputs[variable]?.trim() !== "",
    ) ?? false;

  const handlePopulate = async () => {
    if (!editorRef.current || !allVariablesFilled) return;

    try {
      // Generate populated content with the variable values
      const populatedHtml =
        await editorRef.current.generatePopulatedContent(variableInputs);

      // Create a temporary div to extract plain text
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = populatedHtml;
      const plainText = tempDiv.textContent || tempDiv.innerText || "";

      setPopulatedContent({
        html: populatedHtml,
        plainText: plainText,
        variables: variableInputs,
      });
    } catch (error) {
      console.error("Failed to populate template:", error);
    }
  };

  const copyToClipboard = async (text: string, type = "plain") => {
    try {
      if (type === "html" && populatedContent) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([populatedContent.html], {
              type: "text/html",
            }),
            "text/plain": new Blob([populatedContent.plainText], {
              type: "text/plain",
            }),
          }),
        ]);
        alert("Copied to clipboard with formatting!");
      } else {
        await navigator.clipboard.writeText(text);
        alert("Copied to clipboard!");
      }
    } catch {
      // Fallback for older browsers
      const tempTextarea = document.createElement("textarea");
      tempTextarea.value = text;
      document.body.appendChild(tempTextarea);
      tempTextarea.select();
      document.execCommand("copy");
      document.body.removeChild(tempTextarea);
      alert("Copied to clipboard!");
    }
  };

  const handleSave = () => {
    if (populatedContent && onSavePrompt) {
      onSavePrompt(populatedContent.plainText, populatedContent.variables);
    }
  };

  if (!template) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black transition-opacity duration-500 ease-in-out z-40 ${
          isOpen ? "bg-opacity-50" : "bg-opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Slide-out Panel */}
      <div
        className={`fixed right-0 top-16 h-[calc(100vh-4rem)] w-full md:w-[80%] max-w-5xl bg-white shadow-2xl transform transition-transform duration-500 ease-in-out z-50 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between relative">
            {/* Loading bar */}
            {isLoading && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-200">
                <div 
                  className={`h-full bg-primary ${
                    loadingComplete ? 'animate-loading-bar-complete' : 'animate-loading-bar'
                  }`}
                ></div>
              </div>
            )}
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold text-gray-900">
                {template.title}
              </h2>
              <Link
                href={`/templates/${template.templateId}`}
                className="text-sm text-primary hover:text-primary-hover transition-colors flex items-center gap-1"
              >
                View Full Template
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
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </Link>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Template Preview */}
              <div>
                {/* Template Info */}
                <div className="mb-6">
                  <p className="text-sm text-gray-600">
                    By {template.authorEmail} • {template.useCount || 0} uses
                  </p>
                  {template.tags && template.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-2">
                      {(Array.isArray(template.tags)
                        ? template.tags
                        : [template.tags]
                      ).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 text-xs bg-gray-100 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Template Preview */}
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-3">Template Preview</h3>
                  <div className="border border-gray-300 rounded-lg overflow-hidden">
                    {!template.content ? (
                      <div className="min-h-[400px] p-6 animate-pulse">
                        <div className="space-y-3">
                          <div className="h-4 bg-gray-200 rounded w-full"></div>
                          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                          <div className="h-4 bg-gray-200 rounded w-4/6"></div>
                          <div className="h-4 bg-gray-200 rounded w-full mt-6"></div>
                          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                        </div>
                      </div>
                    ) : (
                      <GravyJS
                        ref={editorRef}
                        initialValue={template.content}
                        placeholder="Loading template content..."
                        className="min-h-[400px]"
                        variablePrefix="[["
                        variableSuffix="]]"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column - Variable Inputs */}
              <div>
                {!template.content ? (
                  // Loading skeleton for variables
                  <div className="animate-pulse">
                    <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                    <div className="space-y-4">
                      <div>
                        <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                        <div className="h-10 bg-gray-200 rounded w-full"></div>
                      </div>
                      <div>
                        <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                        <div className="h-10 bg-gray-200 rounded w-full"></div>
                      </div>
                    </div>
                    <div className="h-12 bg-gray-200 rounded w-full mt-6"></div>
                  </div>
                ) : template.variables && template.variables.length > 0 ? (
                  <>
                    <h3 className="text-lg font-medium mb-4">
                      Fill in Variables
                    </h3>
                    <div className="space-y-4 mb-6">
                      {template.variables.map((variable) => (
                        <div key={variable}>
                          <label
                            htmlFor={`var-${variable}`}
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            {variable}
                          </label>
                          <input
                            id={`var-${variable}`}
                            type="text"
                            value={variableInputs[variable] || ""}
                            onChange={(e) =>
                              setVariableInputs({
                                ...variableInputs,
                                [variable]: e.target.value,
                              })
                            }
                            placeholder={`Enter ${variable}...`}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Populate Button */}
                    <button
                      onClick={handlePopulate}
                      disabled={!allVariablesFilled}
                      className={`w-full px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
                        allVariablesFilled
                          ? "bg-primary text-white hover:bg-primary/90"
                          : "bg-gray-200 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      🔄 Populate Template
                    </button>
                    {!allVariablesFilled && (
                      <p className="text-sm text-gray-500 mt-2 text-center">
                        Fill in all variables to populate the template
                      </p>
                    )}
                  </>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-6 text-center">
                    <p className="text-gray-600">
                      This template has no variables to fill in.
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      You can copy the template content directly.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Populated Result */}
            {populatedContent && (
              <div className="mt-8 col-span-full border-t pt-8">
                <div className="bg-gradient-to-r from-green-50 to-green-100/50 rounded-lg p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      <svg
                        className="w-5 h-5 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Your Populated Template
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          copyToClipboard(populatedContent.html, "html")
                        }
                        className="px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition flex items-center gap-1"
                      >
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
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        Copy HTML
                      </button>
                      <button
                        onClick={() =>
                          copyToClipboard(populatedContent.plainText, "plain")
                        }
                        className="px-3 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition flex items-center gap-1"
                      >
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
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        Copy Text
                      </button>
                      {user && onSavePrompt && (
                        <button
                          onClick={handleSave}
                          className="px-3 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 transition flex items-center gap-1"
                        >
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
                              d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V2"
                            />
                          </svg>
                          Save
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-green-200">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: populatedContent.html,
                      }}
                      className="prose prose-sm max-w-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
