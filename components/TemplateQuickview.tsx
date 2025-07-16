"use client";

import { useState, useRef, useEffect } from "react";
import { Template } from "@/lib/api/templates";
import { useAuth } from "@/lib/auth-context";
import dynamic from "next/dynamic";
import type { GravyJSRef } from "gravyjs";

const GravyJS = dynamic(
  () => import("gravyjs").then(mod => {
    // Handle different export formats
    const component = mod.default || mod.GravyJS || mod;
    return component;
  }), 
  {
    ssr: false,
    loading: () => <div className="animate-pulse h-64 bg-gray-100 rounded" />
  }
);
import Link from "next/link";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/Toast";

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
  const { toasts, showToast, removeToast } = useToast();
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
  const [showVariableInputs, setShowVariableInputs] = useState(false);

  // Reset when template changes
  useEffect(() => {
    if (template) {
      // Check if we're loading (template exists but no content yet)
      setIsLoading(!template.content);
      setLoadingComplete(false);
      setShowVariableInputs(false);

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
        showToast("Copied to clipboard with formatting!", "success");
      } else {
        await navigator.clipboard.writeText(text);
        showToast("Copied to clipboard!", "success");
      }
    } catch {
      // Fallback for older browsers
      const tempTextarea = document.createElement("textarea");
      tempTextarea.value = text;
      document.body.appendChild(tempTextarea);
      tempTextarea.select();
      document.execCommand("copy");
      document.body.removeChild(tempTextarea);
      showToast("Copied to clipboard!", "success");
    }
  };

  const handleSave = () => {
    if (populatedContent && onSavePrompt) {
      onSavePrompt(populatedContent.plainText, populatedContent.variables);
      showToast("Template saved to your library!", "success");
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
          <div className="border-b border-gray-100 px-8 py-6 relative bg-gradient-to-r from-gray-50/50 to-white">
            {/* Loading bar */}
            {isLoading && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-100">
                <div
                  className={`h-full bg-gradient-to-r from-primary to-primary-hover ${
                    loadingComplete ? 'animate-loading-bar-complete' : 'animate-loading-bar'
                  }`}
                ></div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  {template.title}
                </h2>
                <div className="flex items-center gap-4">
                  <p className="text-sm text-gray-500">
                    By {template.authorName || template.authorEmail.split('@')[0]}
                  </p>
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                    <span>{template.useCount || 0} uses</span>
                  </div>
                  <Link
                    href={`/templates/${template.templateId}`}
                    className="text-sm text-primary hover:text-primary-hover transition-all flex items-center gap-1 group"
                  >
                    View full page
                    <svg
                      className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform"
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
              </div>
              <button
                onClick={onClose}
                className="p-3 hover:bg-gray-100 rounded-xl transition-all hover:rotate-90 transform duration-300"
                aria-label="Close panel"
              >
                <svg
                  className="w-5 h-5 text-gray-400"
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
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto p-6">
              {/* Tags */}
              {template.tags && template.tags.length > 0 && (
                <div className="mb-8">
                  <div className="flex gap-2 flex-wrap">
                    {(Array.isArray(template.tags)
                      ? template.tags
                      : [template.tags]
                    ).map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors cursor-default"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mb-8 flex flex-wrap gap-3">
                {template.variables && template.variables.length > 0 && (
                  <button
                    onClick={() => setShowVariableInputs(!showVariableInputs)}
                    className="group px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary-hover transition-all font-medium shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                  >
                    <span className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Populate Template
                    </span>
                  </button>
                )}
                <button
                  onClick={() => {
                    if (template.content) {
                      const tempDiv = document.createElement("div");
                      tempDiv.innerHTML = template.content;
                      const plainText = tempDiv.textContent || tempDiv.innerText || "";
                      copyToClipboard(plainText, 'plain');
                    }
                  }}
                  className="group px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all font-medium shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy Template
                  </span>
                </button>
              </div>

              {/* Variable Inputs (shown when button clicked) */}
              <div className={`transition-all duration-500 ease-in-out overflow-hidden ${
                showVariableInputs ? 'max-h-[1000px] opacity-100 mb-8' : 'max-h-0 opacity-0'
              }`}>
                {template.variables && template.variables.length > 0 && (
                  <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-8 border border-primary/10">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Customize Your Template</h3>
                        <p className="text-sm text-gray-600">Fill in the variables below to personalize your content</p>
                      </div>
                    </div>
                    <div className="space-y-4 mb-6">
                      {template.variables.map((variable, index) => (
                        <div key={variable} className="animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                          <label
                            htmlFor={`var-${variable}`}
                            className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"
                          >
                            <span className="inline-flex items-center justify-center w-6 h-6 bg-primary/10 text-primary text-xs font-bold rounded-full">
                              {index + 1}
                            </span>
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
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all placeholder-gray-400 shadow-sm focus:shadow-md"
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={handlePopulate}
                      disabled={!allVariablesFilled}
                      className={`w-full px-6 py-4 rounded-xl font-medium transition-all transform ${
                        allVariablesFilled
                          ? "bg-primary text-white hover:bg-primary-hover shadow-md hover:shadow-lg hover:-translate-y-0.5"
                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      <span className="flex items-center justify-center gap-2">
                        {allVariablesFilled ? (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Generate Populated Template
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0h-2m5.354-9.354a2 2 0 112.828 2.828l-.793.793a4.022 4.022 0 01-.128 5.565A4 4 0 0112 18.99a4 4 0 01-5.239-2.157 4.022 4.022 0 01-.128-5.565l-.793-.793a2 2 0 112.828-2.828l.793.793a4.022 4.022 0 015.878 0l.793-.793z" />
                            </svg>
                            Fill All Variables to Continue
                          </>
                        )}
                      </span>
                    </button>
                    {!allVariablesFilled && (
                      <div className="mt-3 flex items-center justify-center gap-2 text-sm text-gray-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Complete all fields to generate your personalized template</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Template Content */}
              <div className="mb-8">
                {!template.content ? (
                  <div className="min-h-[400px] space-y-4">
                    <div className="bg-gray-50 rounded-xl p-6 animate-pulse">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                        <div className="h-6 bg-gray-200 rounded w-32"></div>
                      </div>
                      <div className="space-y-3">
                        <div className="h-4 bg-gray-200 rounded-full w-full"></div>
                        <div className="h-4 bg-gray-200 rounded-full w-5/6"></div>
                        <div className="h-4 bg-gray-200 rounded-full w-4/6"></div>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-6 animate-pulse" style={{ animationDelay: '150ms' }}>
                      <div className="space-y-3">
                        <div className="h-4 bg-gray-200 rounded-full w-full"></div>
                        <div className="h-4 bg-gray-200 rounded-full w-3/4"></div>
                        <div className="h-4 bg-gray-200 rounded-full w-5/6"></div>
                        <div className="h-4 bg-gray-200 rounded-full w-2/3"></div>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-6 animate-pulse" style={{ animationDelay: '300ms' }}>
                      <div className="space-y-3">
                        <div className="h-4 bg-gray-200 rounded-full w-4/5"></div>
                        <div className="h-4 bg-gray-200 rounded-full w-full"></div>
                        <div className="h-4 bg-gray-200 rounded-full w-3/5"></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-lg max-w-none">
                    <GravyJS
                      ref={editorRef}
                      initialValue={template.content}
                      placeholder="Loading template content..."
                      className="min-h-[400px] !border-0 !shadow-none"
                      variablePrefix="[["
                      variableSuffix="]]"
                      noStyles={true}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Populated Result */}
            {populatedContent && (
              <div className="mx-auto p-6 animate-fade-in">
                <div className="border-t-2 border-gray-100 pt-8">
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 border border-green-100 shadow-lg">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3 mb-2">
                          <div className="p-2 bg-green-100 rounded-xl">
                            <svg
                              className="w-6 h-6 text-green-600"
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
                          </div>
                          Your Populated Template
                        </h3>
                        <p className="text-sm text-gray-600">Ready to copy and use in your project</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() =>
                            copyToClipboard(populatedContent.html, "html")
                          }
                          className="group px-5 py-2.5 bg-white border-2 border-green-200 text-green-700 rounded-xl hover:bg-green-50 hover:border-green-300 transition-all flex items-center gap-2 shadow-sm hover:shadow-md"
                        >
                          <svg
                            className="w-4 h-4 transform group-hover:scale-110 transition-transform"
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
                          <span className="font-medium">Copy HTML</span>
                        </button>
                        <button
                          onClick={() =>
                            copyToClipboard(populatedContent.plainText, "plain")
                          }
                          className="group px-5 py-2.5 bg-white border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center gap-2 shadow-sm hover:shadow-md"
                        >
                          <svg
                            className="w-4 h-4 transform group-hover:scale-110 transition-transform"
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
                          <span className="font-medium">Copy Text</span>
                        </button>
                        {user && onSavePrompt && (
                          <button
                            onClick={handleSave}
                            className="group px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-hover transition-all flex items-center gap-2 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                          >
                            <svg
                              className="w-4 h-4 transform group-hover:scale-110 transition-transform"
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
                            <span className="font-medium">Save to Library</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="bg-white rounded-xl p-8 shadow-inner border border-gray-100">
                      <div className="mb-4 pb-4 border-b border-gray-100">
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Populated Content</p>
                      </div>
                      <div
                        dangerouslySetInnerHTML={{
                          __html: populatedContent.html,
                        }}
                        className="prose prose-lg max-w-none text-gray-800"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
