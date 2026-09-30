"use client";

import React, { Suspense } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Badge } from "@/components/ui/badge";
import { GitCompare } from "lucide-react";
import { ComparisonView } from "@/components/compare/comparison-view";

function ComparisonLoadingFallback() {
  return (
    <div className="p-8 text-center space-y-3">
      <GitCompare className="w-8 h-8 text-purple-500 animate-spin mx-auto" />
      <p className="text-sm text-slate-500">Loading Document Comparison...</p>
    </div>
  );
}

export default function ComparePage() {
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-16 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">
                Document Comparison
              </h1>
              <p className="text-xs text-slate-500">
                Cross-document semantic diffing & comparative intelligence
              </p>
            </div>
          </div>
          <Badge
            variant="secondary"
            className="bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 text-[11px] font-medium"
          >
            Comparative AI
          </Badge>
        </header>

        <div className="p-6 md:p-8 max-w-5xl mx-auto w-full space-y-6">
          <Suspense fallback={<ComparisonLoadingFallback />}>
            <ComparisonView />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
