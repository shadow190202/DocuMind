"use client";

import React from "react";

export function TextTab({ extracted, viewMode = "full" }) {
  if (viewMode === "pages") {
    return (
      <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
        {extracted.pages?.map((page) => (
          <div
            key={page.pageNumber}
            className="rounded-xl border border-theme-divider bg-theme-panel overflow-hidden shadow-xs"
          >
            <div className="bg-theme-body px-4 py-2 border-b border-theme-divider flex items-center justify-between">
              <span className="text-xs font-semibold text-theme-text">
                Page {page.pageNumber}
              </span>
              <span className="text-[10px] text-theme-muted">
                {page.text?.length || 0} characters
              </span>
            </div>
            <div className="p-4 text-xs font-mono text-theme-text whitespace-pre-wrap leading-relaxed">
              {page.text || <span className="text-theme-muted italic">Empty page content</span>}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="max-h-[550px] overflow-y-auto rounded-xl bg-theme-panel p-5 font-mono text-xs text-theme-text leading-relaxed whitespace-pre-wrap select-text border border-theme-divider shadow-inner">
        {extracted.text || (
          <span className="text-theme-muted italic">Document text is empty.</span>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-theme-muted">
        <span>Characters: {extracted.metadata?.characterCount?.toLocaleString() ?? 0}</span>
        <span>Lines: {extracted.metadata?.lineCount?.toLocaleString() ?? 0}</span>
      </div>
    </div>
  );
}
