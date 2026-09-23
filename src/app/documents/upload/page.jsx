"use client";

import React from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UploadCloud, ArrowLeft } from "lucide-react";

export default function UploadPage() {
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-16 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/documents" className="gap-1.5 text-xs text-slate-500">
                <ArrowLeft className="w-4 h-4" />
                Back to Documents
              </Link>
            </Button>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Upload Document</h1>
          </div>
        </header>

        <div className="p-6 md:p-8 max-w-4xl mx-auto w-full space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Document Ingestion (Phase 5)</CardTitle>
              <CardDescription>
                Protected upload zone. Will support PDF, DOCX, TXT, and CSV formats.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
                <UploadCloud className="w-12 h-12 text-blue-500 mx-auto" />
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    File Ingestion Pipeline
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Route protected by Clerk. Active backend processing will be connected in Phase 5.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
