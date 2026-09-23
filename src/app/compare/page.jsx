"use client";

import React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitCompare } from "lucide-react";

export default function ComparePage() {
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-16 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Document Comparison</h1>
            <Badge variant="secondary">Protected Route</Badge>
          </div>
        </header>

        <div className="p-6 md:p-8 max-w-4xl mx-auto w-full space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Comparative Analysis (Phase 12)</CardTitle>
              <CardDescription>
                Select two documents to extract key differences, metric revisions, and clause discrepancies.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                <GitCompare className="w-12 h-12 text-purple-500 mx-auto" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Protected Document Comparison
                </p>
                <p className="text-xs text-slate-500">
                  Authentication verified. Multi-document comparative intelligence will be implemented in Phase 12.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
