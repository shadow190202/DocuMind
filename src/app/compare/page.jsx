"use client";

import React, { Suspense } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { GitCompare, Loader2 } from "lucide-react";
import { ComparisonView } from "@/components/compare/comparison-view";

function ComparisonLoadingFallback() {
  return (
    <div className="py-16 text-center space-y-2">
      <Loader2 className="w-5 h-5 text-theme-muted animate-spin mx-auto" strokeWidth={1.5} />
      <p className="text-xs text-theme-muted">Loading document comparison...</p>
    </div>
  );
}

export default function ComparePage() {
  return (
    <DashboardLayout>
      <header className="h-14 px-4 sm:px-6 shrink-0 border-b border-theme-divider bg-theme-panel flex items-center justify-between gap-3 sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-md bg-theme-body flex items-center justify-center text-theme-muted shrink-0">
            <GitCompare className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-theme-text leading-tight">
              Document comparison
            </h1>
          </div>
        </div>
        <Badge variant="secondary" className="text-xs font-normal">
          Diff engine
        </Badge>
      </header>

      <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto w-full space-y-6">
        <Suspense fallback={<ComparisonLoadingFallback />}>
          <ComparisonView />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}
