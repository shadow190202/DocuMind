"use client";

import React from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload } from "lucide-react";

export default function DocumentsPage() {
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-16 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">My Documents</h1>
            <Badge variant="secondary">Protected Route</Badge>
          </div>
          <Button size="sm" asChild>
            <Link href="/documents/upload" className="gap-1.5">
              <Upload className="w-4 h-4" />
              Upload Document
            </Link>
          </Button>
        </header>

        <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Document Vault</CardTitle>
              <CardDescription>
                Authenticated document repository. In Phase 5, file uploads and PostgreSQL metadata storage will be connected.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                <FileText className="w-10 h-10 text-slate-400 mx-auto" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Protected Document Repository Ready for Phase 5
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/documents/upload">Go to Upload</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
