"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  Upload,
  MessageSquare,
  Sparkles,
  HardDrive,
  TrendingUp,
  Search,
  ArrowRight,
  Loader2,
  Eye,
} from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function DashboardPage() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState("");

  useEffect(() => {
    async function loadDocs() {
      try {
        setLoading(true);
        const res = await fetch("/api/documents");
        const data = await res.json();
        if (res.ok) {
          setDocs(data.documents || []);
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDocs();
  }, []);

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const filteredDocs = docs.filter((doc) =>
    doc.filename.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 w-full overflow-y-auto flex flex-col">
        {/* Top Header */}
        <header className="min-h-16 h-auto py-3 px-4 sm:px-6 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Workspace Dashboard
            </h1>
            <Badge variant="secondary" className="text-[11px] gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              RAG Pipeline Active
            </Badge>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Button variant="outline" size="sm" asChild className="flex-1 sm:flex-initial justify-center">
              <Link href="/">Landing Page</Link>
            </Button>
            <Button size="md" className="gap-2 shadow-sm flex-1 sm:flex-initial justify-center" asChild>
              <Link href="/documents/upload">
                <Upload className="w-4 h-4" />
                Upload Document
              </Link>
            </Button>
          </div>
        </header>

        {/* Dashboard Body */}
        <div className="p-4 sm:p-6 md:p-8 space-y-6 md:space-y-8 max-w-7xl w-full mx-auto">
          {/* Welcome Banner */}
          <div className="rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6 sm:p-8 text-white shadow-md">
            <div className="max-w-2xl space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-200">
                AI Knowledge Assistant
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Welcome to DocuMind
              </h2>
              <p className="text-sm text-blue-100 leading-relaxed">
                Your PostgreSQL database and secure document vault are active. Upload PDFs, Word documents, CSVs, or text files to begin building your grounded vector knowledge base.
              </p>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-slate-500">Total Documents</CardTitle>
                <FileText className="w-4 h-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? "..." : docs.length}</div>
                <p className="text-[10px] text-slate-400 mt-1">Uploaded in private vault</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-slate-500">Pending Extraction</CardTitle>
                <HardDrive className="w-4 h-4 text-indigo-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading
                    ? "..."
                    : docs.filter((d) => d.processingStatus === "pending").length}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Queued for text extraction</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-slate-500">Vector Status</CardTitle>
                <Sparkles className="w-4 h-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">pgvector</div>
                <p className="text-[10px] text-slate-400 mt-1">768-dim table ready</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-slate-500">Database Engine</CardTitle>
                <TrendingUp className="w-4 h-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">PostgreSQL</div>
                <p className="text-[10px] text-slate-400 mt-1">Drizzle ORM connected</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Documents Table */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Recent Documents</CardTitle>
                <CardDescription>Live documents stored in your PostgreSQL vault.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-48 sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <Input
                    placeholder="Filter documents..."
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-12 text-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
                  <p className="text-xs text-slate-400">Loading documents...</p>
                </div>
              ) : filteredDocs.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                  <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs text-slate-500">
                    {filterQuery
                      ? "No documents match your search."
                      : "No documents uploaded yet. Upload your first document to get started."}
                  </p>
                  {!filterQuery && (
                    <Button asChild size="md" className="gap-2 shadow-sm">
                      <Link href="/documents/upload">
                        <Upload className="w-4 h-4" />
                        Upload Document
                      </Link>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredDocs.slice(0, 5).map((doc) => (
                    <div
                      key={doc.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 p-3.5 transition-all hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs space-y-2.5"
                    >
                      {/* Top Tier: Document Info & Status */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 shrink-0 shadow-2xs">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/documents/${doc.id}`}
                              className="text-sm font-semibold truncate text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 block transition-colors"
                            >
                              {doc.filename}
                            </Link>
                            <p className="text-xs text-slate-400 mt-0.5">
                              <span className="uppercase font-mono font-medium">{doc.fileType}</span> •{" "}
                              {formatFileSize(doc.fileSize)} • {formatDate(doc.createdAt)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pl-9 sm:pl-0 shrink-0">
                          <Badge
                            variant={
                              doc.processingStatus === "completed"
                                ? "success"
                                : doc.processingStatus === "failed"
                                ? "destructive"
                                : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {doc.processingStatus}
                          </Badge>
                        </div>
                      </div>

                      {/* Bottom Tier: Full-Width Actions Bar */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                          <span className="text-xs text-slate-400 font-medium mr-1 select-none">
                            Actions:
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="gap-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="View Document & Extracted Text"
                          >
                            <Link href={`/documents/${doc.id}`}>
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="gap-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Browse all documents in vault"
                          >
                            <Link href="/documents">
                              <span>All Documents</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
