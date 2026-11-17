"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  Upload,
  Layers,
  HardDrive,
  Eye,
  Database,
  ArrowRight,
  Search,
  Loader2,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function DashboardPage() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState("");

  useEffect(() => {
    async function loadDocuments() {
      try {
        const res = await fetch("/api/documents");
        if (res.ok) {
          const data = await res.json();
          setDocs(data.documents || []);
        }
      } catch (err) {
        console.error("Failed to load documents", err);
      } finally {
        setLoading(false);
      }
    }
    loadDocuments();
  }, []);

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const filteredDocs = docs.filter((doc) =>
    doc.filename.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      {/* Top Header */}
      <header className="h-14 px-4 sm:px-6 shrink-0 border-b border-theme-divider bg-theme-panel flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-theme-text">
            Dashboard
          </h1>
          <Badge variant="secondary" className="text-xs gap-1.5 font-normal">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Active
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-2" asChild>
            <Link href="/documents/upload">
              <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />
              Upload document
            </Link>
          </Button>
        </div>
      </header>

      {/* Dashboard Body */}
      <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-6xl w-full mx-auto">
        {/* Workspace Summary */}
        <div className="rounded-xl border border-theme-divider bg-theme-panel p-5 sm:p-6 text-theme-text space-y-1.5">
          <h2 className="text-base font-semibold tracking-tight text-theme-text">
            Workspace overview
          </h2>
          <p className="text-xs text-theme-muted max-w-2xl leading-relaxed">
            Your PostgreSQL database and secure document vault are active. Upload PDF, DOCX, CSV, or TXT files to query with grounded citations and semantic vector retrieval.
          </p>
        </div>

        {/* Quick Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-theme-muted font-normal">Total documents</span>
              <FileText className="w-4 h-4 text-theme-muted" strokeWidth={1.5} />
            </div>
            <div className="text-2xl font-medium tracking-tight tabular-nums text-theme-text">
              {loading ? "—" : docs.length}
            </div>
            <p className="text-xs text-theme-muted">Stored in private vault</p>
          </Card>

          <Card className="p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-theme-muted font-normal">Pending extraction</span>
              <HardDrive className="w-4 h-4 text-theme-muted" strokeWidth={1.5} />
            </div>
            <div className="text-2xl font-medium tracking-tight tabular-nums text-theme-text">
              {loading
                ? "—"
                : docs.filter((d) => d.processingStatus === "pending").length}
            </div>
            <p className="text-xs text-theme-muted">Queued for parsing</p>
          </Card>

          <Card className="p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-theme-muted font-normal">Vector index</span>
              <Layers className="w-4 h-4 text-theme-muted" strokeWidth={1.5} />
            </div>
            <div className="text-2xl font-medium tracking-tight text-theme-text">
              pgvector
            </div>
            <p className="text-xs text-theme-muted">768-dim cosine index</p>
          </Card>

          <Card className="p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-theme-muted font-normal">Database</span>
              <Database className="w-4 h-4 text-theme-muted" strokeWidth={1.5} />
            </div>
            <div className="text-2xl font-medium tracking-tight text-theme-text">
              PostgreSQL
            </div>
            <p className="text-xs text-theme-muted">Drizzle ORM schema</p>
          </Card>
        </div>

        {/* Recent Documents Card */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5">
            <div>
              <CardTitle className="text-sm font-semibold">Recent documents</CardTitle>
              <CardDescription className="text-xs text-theme-muted">Live files stored in your vault</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-48 sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-theme-muted" strokeWidth={1.5} />
                <Input
                  placeholder="Filter documents..."
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  className="pl-9 h-8 text-xs"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            {loading ? (
              <div className="py-12 text-center space-y-2">
                <Loader2 className="w-5 h-5 animate-spin text-theme-muted mx-auto" strokeWidth={1.5} />
                <p className="text-xs text-theme-muted">Loading documents...</p>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-theme-divider rounded-lg space-y-3">
                <FileText className="w-6 h-6 text-theme-muted mx-auto" strokeWidth={1.5} />
                <p className="text-xs text-theme-muted">
                  {filterQuery
                    ? "No documents match your query."
                    : "No documents uploaded yet."}
                </p>
                {!filterQuery && (
                  <Button asChild size="sm" className="gap-2">
                    <Link href="/documents/upload">
                      <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />
                      Upload document
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDocs.slice(0, 5).map((doc) => (
                  <div
                    key={doc.id}
                    className="rounded-lg border border-theme-divider bg-theme-panel p-3.5 transition-colors hover:bg-theme-body flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-md bg-theme-body text-theme-muted shrink-0">
                        <FileText className="w-4 h-4" strokeWidth={1.5} />
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/documents/${doc.id}`}
                          className="text-xs font-medium truncate text-theme-text hover:text-theme-primary block transition-colors"
                        >
                          {doc.filename}
                        </Link>
                        <p className="text-xs text-theme-muted mt-0.5 tabular-nums">
                          <span className="font-mono">{doc.fileType?.toLowerCase()}</span> •{" "}
                          {formatFileSize(doc.fileSize)} • {formatDate(doc.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant={
                          doc.processingStatus === "completed"
                            ? "success"
                            : doc.processingStatus === "failed"
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-xs font-normal capitalize"
                      >
                        {doc.processingStatus}
                      </Badge>

                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="h-8 px-2.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                      >
                        <Link href={`/documents/${doc.id}`}>
                          <Eye className="w-3.5 h-3.5 mr-1" strokeWidth={1.5} />
                          View
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}

                <div className="pt-2 flex justify-end">
                  <Button variant="ghost" size="sm" asChild className="text-xs gap-1.5 text-slate-500">
                    <Link href="/documents">
                      All documents
                      <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
