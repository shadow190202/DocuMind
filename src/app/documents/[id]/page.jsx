"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  FileText,
  ArrowLeft,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  Clock,
  Layers,
  FileCode,
  HardDrive,
  Calendar,
  Loader2,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

export default function DocumentDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params?.id;

  const [document, setDocument] = useState(null);
  const [extracted, setExtracted] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("full"); // "full" | "pages" | "metadata"
  const [copied, setCopied] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/documents/${documentId}/text`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load document details.");
      }

      setDocument(data.document);
      setExtracted(data.extracted);
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.message || "Failed to load document details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (documentId) {
      fetchData();
    }
  }, [documentId]);

  const handleProcess = async () => {
    try {
      setProcessing(true);
      setError(null);

      const res = await fetch(`/api/documents/${documentId}/process`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Processing failed.");
      }

      // Re-fetch document and extracted data
      await fetchData();
    } catch (err) {
      console.error("Processing error:", err);
      setError(err.message || "Document text extraction failed.");
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete document.");
      }

      router.push("/documents");
    } catch (err) {
      console.error("Delete error:", err);
      alert(err.message || "Failed to delete document.");
      setDeleting(false);
    }
  };

  const handleCopy = () => {
    if (!extracted?.text) return;
    navigator.clipboard.writeText(extracted.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "completed":
        return <Badge variant="success">Completed</Badge>;
      case "processing":
        return <Badge variant="warning">Processing</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "pending":
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Navigation Bar */}
        <header className="h-16 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2 text-slate-600 dark:text-slate-400">
              <Link href="/documents">
                <ArrowLeft className="w-4 h-4" />
                Back to Documents
              </Link>
            </Button>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <div className="flex items-center gap-2 truncate max-w-sm sm:max-w-md">
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {document?.filename || "Document Details"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleProcess}
              disabled={processing || loading}
              className="gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${processing ? "animate-spin" : ""}`} />
              {processing
                ? "Extracting Text..."
                : document?.processingStatus === "completed"
                ? "Re-extract Text"
                : "Process Document"}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteModal(true)}
              className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-6 md:p-8 max-w-6xl mx-auto w-full space-y-6">
          {loading ? (
            <div className="py-24 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
              <p className="text-xs text-slate-500">Loading document intelligence...</p>
            </div>
          ) : error ? (
            <div className="p-5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Document Error</p>
                <p className="text-xs opacity-90">{error}</p>
                <Button size="sm" variant="outline" onClick={handleProcess} className="mt-2 text-xs">
                  Retry Extraction
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Document Overview Metadata Card */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {document?.filename}
                        <Badge variant="outline" className="font-mono uppercase text-xs">
                          {document?.fileType}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        UUID: <span className="font-mono text-slate-500">{document?.id}</span>
                      </CardDescription>
                    </div>
                    <div>{getStatusBadge(document?.processingStatus)}</div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="space-y-1">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5" /> File Size
                      </span>
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {formatFileSize(document?.fileSize)}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" /> Uploaded
                      </span>
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {formatDate(document?.createdAt)}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" /> Sections / Pages
                      </span>
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {extracted?.pageCount ?? "—"}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <FileCode className="w-3.5 h-3.5" /> Word Count
                      </span>
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {extracted?.metadata?.wordCount
                          ? `${extracted.metadata.wordCount.toLocaleString()} words`
                          : "—"}
                      </p>
                    </div>
                  </div>

                  {document?.errorMessage && (
                    <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs">
                      <strong>Processing Error:</strong> {document.errorMessage}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Extracted Text Section */}
              <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-600" /> Extracted Text Content
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {extracted
                        ? `Extracted text ready for Phase 7 chunking and vector embeddings.`
                        : "No text has been extracted from this document yet."}
                    </CardDescription>
                  </div>

                  {extracted && (
                    <div className="flex items-center gap-2">
                      {/* View Switcher Tabs */}
                      <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-xs">
                        <button
                          onClick={() => setActiveTab("full")}
                          className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                            activeTab === "full"
                              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
                              : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                          }`}
                        >
                          Full Text
                        </button>
                        <button
                          onClick={() => setActiveTab("pages")}
                          className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                            activeTab === "pages"
                              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
                              : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                          }`}
                        >
                          By Page ({extracted.pages?.length || 0})
                        </button>
                        <button
                          onClick={() => setActiveTab("metadata")}
                          className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                            activeTab === "metadata"
                              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
                              : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                          }`}
                        >
                          Metadata
                        </button>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopy}
                        className="gap-1.5 text-xs h-8"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-green-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="p-6">
                  {processing ? (
                    <div className="py-20 text-center space-y-4">
                      <div className="relative inline-flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 animate-spin" />
                        <Sparkles className="w-5 h-5 text-blue-600 absolute" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Extracting Text from {document?.filename}...
                        </h4>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                          Parsing file structure, decoding content, and segmenting sections.
                        </p>
                      </div>
                    </div>
                  ) : !extracted ? (
                    <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
                      <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          Ready for Text Extraction
                        </h4>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                          Click below to execute text extraction pipeline on this {document?.fileType?.toUpperCase()} document.
                        </p>
                      </div>
                      <Button onClick={handleProcess} size="sm" className="gap-2 shadow-sm">
                        <RefreshCw className="w-4 h-4" />
                        Process Document Now
                      </Button>
                    </div>
                  ) : activeTab === "full" ? (
                    <div className="relative">
                      <div className="max-h-[550px] overflow-y-auto rounded-xl bg-slate-900 p-5 font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap select-text border border-slate-800 shadow-inner">
                        {extracted.text || (
                          <span className="text-slate-500 italic">Document text is empty.</span>
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                        <span>Characters: {extracted.metadata?.characterCount?.toLocaleString() ?? 0}</span>
                        <span>Lines: {extracted.metadata?.lineCount?.toLocaleString() ?? 0}</span>
                      </div>
                    </div>
                  ) : activeTab === "pages" ? (
                    <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
                      {extracted.pages?.map((page) => (
                        <div
                          key={page.pageNumber}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs"
                        >
                          <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              Page {page.pageNumber}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {page.text?.length || 0} characters
                            </span>
                          </div>
                          <div className="p-4 text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {page.text || <span className="text-slate-400 italic">Empty page content</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-slate-900 p-5 font-mono text-xs text-slate-200 overflow-x-auto border border-slate-800">
                      <pre>{JSON.stringify(extracted.metadata, null, 2)}</pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{" "}
              <strong className="text-slate-900 dark:text-slate-100">
                {document?.filename}
              </strong>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={deleting}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={handleDelete}
              className="gap-2"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Document"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
