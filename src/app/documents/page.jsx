"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  Upload,
  Search,
  Trash2,
  Clock,
  HardDrive,
  AlertCircle,
  Loader2,
  ExternalLink,
  Eye,
  RefreshCw,
  SlidersHorizontal,
  Check,
  Copy,
  Users,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatExpirationCountdown } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { ShareDialog } from "@/components/documents/share-dialog";

export default function DocumentsPage() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState("all"); // "all" | "mine" | "shared"
  const [shareDoc, setShareDoc] = useState(null);
  const [docToDelete, setDocToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  // Vault Semantic Search State
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [vaultQuery, setVaultQuery] = useState("");
  const [vaultTopK, setVaultTopK] = useState(5);
  const [vaultThreshold, setVaultThreshold] = useState(0.5);
  const [vaultSelectedDocId, setVaultSelectedDocId] = useState("");
  const [vaultIncludeContext, setVaultIncludeContext] = useState(true);
  const [vaultSearching, setVaultSearching] = useState(false);
  const [vaultSearchResults, setVaultSearchResults] = useState(null);
  const [vaultSearchError, setVaultSearchError] = useState(null);
  const [vaultCopiedContext, setVaultCopiedContext] = useState(false);

  const handleVaultSearch = async (e) => {
    if (e) e.preventDefault();
    if (!vaultQuery.trim()) return;

    try {
      setVaultSearching(true);
      setVaultSearchError(null);
      const payload = {
        query: vaultQuery.trim(),
        topK: Number(vaultTopK),
        threshold: Number(vaultThreshold),
        includeContext: Boolean(vaultIncludeContext),
      };
      if (vaultSelectedDocId) {
        payload.documentId = vaultSelectedDocId;
      }

      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Vault search failed.");
      }

      setVaultSearchResults(data);
    } catch (err) {
      console.error("Vault search error:", err);
      setVaultSearchError(err.message || "Failed to execute vault search.");
    } finally {
      setVaultSearching(false);
    }
  };

  const handleCopyVaultContext = () => {
    if (!vaultSearchResults?.context?.contextText) return;
    navigator.clipboard.writeText(vaultSearchResults.context.contextText);
    setVaultCopiedContext(true);
    setTimeout(() => setVaultCopiedContext(false), 2000);
  };

  const handleProcess = async (docId, e) => {
    if (e) e.stopPropagation();
    try {
      setProcessingId(docId);
      const res = await fetch(`/api/documents/${docId}/process`, {
        method: "POST",
      });
      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error(`Server returned non-JSON response (${res.status})`);
      }
      if (!res.ok) {
        throw new Error(data?.error || "Failed to process document.");
      }
      // Update local state
      setDocs((prev) =>
        prev.map((d) =>
          d.id === docId
            ? { ...d, processingStatus: "completed", errorMessage: null }
            : d
        )
      );
    } catch (err) {
      console.error("Process error:", err);
      setError(err.message || "Failed to process document.");
      setDocs((prev) =>
        prev.map((d) =>
          d.id === docId
            ? { ...d, processingStatus: "failed", errorMessage: err.message }
            : d
        )
      );
    } finally {
      setProcessingId(null);
    }
  };

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/documents");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load documents.");
      }

      setDocs(data.documents || []);
    } catch (err) {
      console.error("Error fetching documents:", err);
      setError(err.message || "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  };

  const [, setTicker] = useState(0);

  useEffect(() => {
    fetchDocuments();

    // Auto-refresh document list every 30 seconds to synchronize with storage cleanup
    const syncInterval = setInterval(() => {
      fetchDocuments();
    }, 30000);

    // Update countdown timers every 15 seconds
    const tickInterval = setInterval(() => {
      setTicker((t) => t + 1);
    }, 15000);

    return () => {
      clearInterval(syncInterval);
      clearInterval(tickInterval);
    };
  }, []);

  const handleDelete = async () => {
    if (!docToDelete) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/documents/${docToDelete.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete document.");
      }

      // Remove from local state
      setDocs((prev) => prev.filter((d) => d.id !== docToDelete.id));
      setDocToDelete(null);
    } catch (err) {
      console.error("Delete error:", err);
      alert(err.message || "Failed to delete document.");
    } finally {
      setDeleting(false);
    }
  };

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

  const filteredDocs = docs.filter((doc) => {
    const matchesSearch = doc.filename.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (filterTab === "mine") return doc.isOwner;
    if (filterTab === "shared") return !doc.isOwner;
    return true;
  });

  return (
    <DashboardLayout>
        <header className="min-h-16 h-auto py-3 px-4 sm:px-6 shrink-0 border-b border-theme-divider bg-theme-panel/80 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
            <h1 className="text-lg font-bold text-theme-text">My Documents</h1>
            <Badge variant="outline" className="text-xs">
              {docs.length} {docs.length === 1 ? "File" : "Files"}
            </Badge>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <Button
              variant="ai-outline"
              size="md"
              onClick={() => setSearchModalOpen(true)}
              className="gap-2 shadow-xs w-full sm:w-auto justify-center"
            >
              <Search className="w-4 h-4 text-theme-aiAccent" />
              Vault Semantic Search
            </Button>
            <Button size="md" asChild className="gap-2 shadow-xs w-full sm:w-auto justify-center">
              <Link href="/documents/upload">
                <Upload className="w-4 h-4" />
                Upload Document
              </Link>
            </Button>
          </div>
        </header>

        <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
          <Card>
            <CardHeader className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <CardTitle>Document Vault</CardTitle>
                <CardDescription className="flex items-center gap-2 flex-wrap">
                  <span>Your document repository backed by PostgreSQL.</span>
                  <span className="text-xs text-theme-muted flex items-center gap-1 font-normal">
                    <Clock className="w-3.5 h-3.5 text-amber-500" /> 24-hr retention
                  </span>
                </CardDescription>
              </div>

              {/* Segmented Filter Tabs */}
              <div className="flex items-center flex-wrap gap-1.5 p-1 bg-theme-body border border-theme-divider rounded-lg text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setFilterTab("all")}
                  className={`px-3 py-1.5 rounded-md transition ${
                    filterTab === "all"
                      ? "bg-theme-panel text-theme-primary shadow-xs font-semibold"
                      : "text-theme-muted hover:text-theme-text"
                  }`}
                >
                  All ({docs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("mine")}
                  className={`px-3 py-1.5 rounded-md transition ${
                    filterTab === "mine"
                      ? "bg-theme-panel text-theme-primary shadow-xs font-semibold"
                      : "text-theme-muted hover:text-theme-text"
                  }`}
                >
                  My Documents ({docs.filter((d) => d.isOwner).length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("shared")}
                  className={`px-3 py-1.5 rounded-md transition ${
                    filterTab === "shared"
                      ? "bg-theme-panel text-theme-primary shadow-xs font-semibold"
                      : "text-theme-muted hover:text-theme-text"
                  }`}
                >
                  Shared with Me ({docs.filter((d) => !d.isOwner).length})
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <Input
                  placeholder="Filter by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs w-full"
                />
              </div>
            </CardHeader>

            <CardContent>
              {loading ? (
                <div className="py-16 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
                  <p className="text-xs text-slate-500">Loading documents from PostgreSQL...</p>
                </div>
              ) : error ? (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-700 text-xs flex items-center gap-3">
                  <AlertCircle className="w-4 h-4" />
                  <p>{error}</p>
                </div>
              ) : filteredDocs.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-theme-divider rounded-2xl space-y-4">
                  <div className="h-12 w-12 rounded-xl bg-theme-body text-theme-muted flex items-center justify-center mx-auto">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-theme-text">
                      {searchQuery ? "No matching documents" : "No documents uploaded yet"}
                    </h4>
                    <p className="text-xs text-theme-muted max-w-sm mx-auto">
                      {searchQuery
                        ? "Try searching for a different keyword."
                        : "Upload your first PDF, DOCX, TXT, or CSV file to start building your AI knowledge base."}
                    </p>
                  </div>
                  {!searchQuery && (
                    <Button asChild size="md" className="gap-2 shadow-xs">
                      <Link href="/documents/upload">
                        <Upload className="w-4 h-4" />
                        Upload Document
                      </Link>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="rounded-xl border border-theme-divider bg-theme-panel p-4 transition-all hover:border-theme-divider hover:shadow-xs space-y-3"
                    >
                      {/* Top Tier: Document Identity, Metadata & Status */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        {/* Left: Icon, Filename, Owner/Editor/Viewer badge */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2.5 rounded-xl bg-theme-primary/10 text-theme-primary shrink-0 shadow-2xs">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link
                                href={`/documents/${doc.id}`}
                                className="font-semibold text-theme-text hover:text-theme-primary truncate max-w-[200px] sm:max-w-md text-sm transition-colors"
                              >
                                {doc.filename}
                              </Link>
                              {doc.isOwner ? (
                                <Badge
                                  variant="secondary"
                                  className="text-xs font-normal"
                                >
                                  Owner
                                </Badge>
                              ) : doc.role === "write" ? (
                                <Badge
                                  variant="outline"
                                  className="bg-theme-primary/10 text-theme-primary border-theme-primary/30 text-[10px] px-1.5 py-0"
                                >
                                  Editor
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="bg-theme-muted/10 text-theme-muted border-theme-divider text-[10px] px-1.5 py-0"
                                >
                                  Viewer
                                </Badge>
                              )}
                            </div>
                            {!doc.isOwner && (
                              <span className="text-[11px] text-theme-muted block truncate mt-0.5">
                                Shared by {doc.owner?.name || doc.owner?.email || "colleague"}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Middle/Right: Format, Size, Status Badge, Uploaded Date */}
                        <div className="flex items-center gap-3 shrink-0 flex-wrap text-xs text-theme-muted pl-11 md:pl-0">
                          <span className="font-mono text-xs uppercase px-2 py-0.5 rounded bg-theme-body text-theme-text font-semibold border border-theme-divider">
                            {doc.fileType}
                          </span>
                          <span className="text-theme-muted">
                            {formatFileSize(doc.fileSize)}
                          </span>
                          <div>{getStatusBadge(doc.processingStatus)}</div>
                          <span className="text-theme-muted">
                            {formatDate(doc.createdAt)}
                          </span>
                          {(() => {
                            const countdown = formatExpirationCountdown(doc.expiresAt, doc.createdAt);
                            return (
                              <span
                                className={`text-xs flex items-center gap-1 font-medium ${
                                  countdown.isExpired
                                    ? "text-rose-600 dark:text-rose-400"
                                    : countdown.isExpiringSoon
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-theme-muted"
                                }`}
                                title={
                                  countdown.isExpired
                                    ? "This document has expired and will be automatically purged"
                                    : `Automatic deletion scheduled in ${countdown.label}`
                                }
                              >
                                <Clock
                                  className={`w-3.5 h-3.5 ${
                                    countdown.isExpired
                                      ? "text-rose-500"
                                      : countdown.isExpiringSoon
                                      ? "text-amber-500"
                                      : "text-theme-muted"
                                  }`}
                                  strokeWidth={1.5}
                                />
                                {countdown.label}
                              </span>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Bottom Tier: Full-Width Actions Bar */}
                      <div className="pt-2.5 border-t border-theme-divider flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                          <span className="text-xs text-theme-muted font-medium mr-1 select-none">
                            Actions:
                          </span>

                          {/* [ View ] */}
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="gap-1.5 text-xs text-theme-muted hover:text-theme-text hover:bg-theme-body"
                            title="View Document & Extracted Text"
                          >
                            <Link href={`/documents/${doc.id}`}>
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </Link>
                          </Button>

                          {/* [ Reprocess ] */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleProcess(doc.id, e)}
                            disabled={processingId === doc.id || doc.role === "read"}
                            className="gap-1.5 text-xs text-theme-muted hover:text-theme-text hover:bg-theme-body disabled:opacity-50"
                            title={
                              doc.role === "read"
                                ? "Only the owner or an editor can reprocess this document."
                                : doc.processingStatus === "completed"
                                ? "Re-extract Text"
                                : "Extract / Process Document"
                            }
                          >
                            {processingId === doc.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-theme-primary" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5" />
                            )}
                            <span>{doc.processingStatus === "completed" ? "Reprocess" : "Process"}</span>
                          </Button>

                          {/* [ Share ] (Owner only) */}
                          {doc.isOwner && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShareDoc(doc)}
                              className="gap-1.5 text-xs text-theme-muted hover:text-theme-text hover:bg-theme-body"
                              title="Share Document"
                            >
                              <Users className="w-3.5 h-3.5" />
                              <span>Share</span>
                            </Button>
                          )}

                          {/* [ Delete ] (Owner only) */}
                          {doc.isOwner && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDocToDelete(doc)}
                              className="gap-1.5 text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                              title="Delete Document"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!docToDelete} onOpenChange={(open) => !open && setDocToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong className="text-theme-text">
                {docToDelete?.filename}
              </strong>
              ? This will remove the file from storage and cascade deletion in PostgreSQL.
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

      {/* Vault Semantic Search Modal */}
      <Dialog open={searchModalOpen} onOpenChange={setSearchModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader className="pb-3 border-b border-theme-divider">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-theme-primary" />
              <DialogTitle className="text-base font-bold">
                Vault Semantic Vector Search
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Search semantically across your personal document repository using pgvector cosine similarity and 768-dimensional Gemini embeddings.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 py-4 space-y-5 pr-1">
            {/* Search Form */}
            <form onSubmit={handleVaultSearch} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-theme-muted" />
                  <Input
                    placeholder="Search across your documents (e.g. 'financial forecast', 'user authentication')..."
                    value={vaultQuery}
                    onChange={(e) => setVaultQuery(e.target.value)}
                    className="pl-9 h-10 text-sm"
                  />
                </div>
                <Button
                  type="submit"
                  variant="ai"
                  disabled={vaultSearching || !vaultQuery.trim()}
                  className="gap-2 shrink-0"
                >
                  {vaultSearching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Search Vault
                    </>
                  )}
                </Button>
              </div>

              {/* Scope & Parameters Bar */}
              <div className="p-3 rounded-xl bg-theme-body border border-theme-divider flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Document Scope */}
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-theme-muted">Scope:</span>
                    <select
                      value={vaultSelectedDocId}
                      onChange={(e) => setVaultSelectedDocId(e.target.value)}
                      className="h-7 text-xs rounded-md border border-theme-divider bg-theme-panel text-theme-text px-2 py-0.5 max-w-[150px] truncate"
                    >
                      <option value="">All Documents</option>
                      {docs
                        .filter((d) => d.processingStatus === "completed")
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.filename}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Top-K */}
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-theme-muted">Top-K:</span>
                    <select
                      value={vaultTopK}
                      onChange={(e) => setVaultTopK(Number(e.target.value))}
                      className="h-7 text-xs rounded-md border border-theme-divider bg-theme-panel text-theme-text px-2 py-0.5"
                    >
                      <option value={3}>3 chunks</option>
                      <option value={5}>5 chunks</option>
                      <option value={10}>10 chunks</option>
                      <option value={20}>20 chunks</option>
                    </select>
                  </div>

                  {/* Threshold */}
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-theme-muted">Min Threshold:</span>
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.05"
                      value={vaultThreshold}
                      onChange={(e) => setVaultThreshold(Number(e.target.value))}
                      className="w-20 h-1.5 bg-theme-divider rounded-lg appearance-none cursor-pointer accent-theme-ai"
                    />
                    <span className="font-mono text-[11px] font-semibold text-theme-text w-7">
                      {Number(vaultThreshold).toFixed(2)}
                    </span>
                  </div>

                  {/* Context Toggle */}
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={vaultIncludeContext}
                      onChange={(e) => setVaultIncludeContext(e.target.checked)}
                      className="rounded border-theme-divider text-theme-ai focus:ring-theme-ai w-3.5 h-3.5"
                    />
                    <span className="text-theme-text font-medium">
                      Assemble RAG Context
                    </span>
                  </label>
                </div>
              </div>
            </form>

            {/* Error Message */}
            {vaultSearchError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{vaultSearchError}</span>
              </div>
            )}

            {/* Search Results */}
            {vaultSearchResults && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs border-b border-theme-divider pb-2">
                  <span className="font-medium text-theme-text">
                    Retrieved {vaultSearchResults.count} chunk{vaultSearchResults.count === 1 ? "" : "s"} for &quot;{vaultSearchResults.query}&quot;
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    Min Score: &gt;= {vaultSearchResults.threshold}
                  </Badge>
                </div>

                {vaultSearchResults.count === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-theme-divider rounded-xl space-y-1">
                    <p className="text-sm font-medium text-theme-text">
                      No matching chunks found
                    </p>
                    <p className="text-xs text-theme-muted max-w-sm mx-auto">
                      No document chunks met the similarity threshold of {vaultSearchResults.threshold}. Try lowering the threshold or refining your search keywords.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {vaultSearchResults.results.map((chunk, idx) => (
                      <div
                        key={chunk.chunkId}
                        className="rounded-xl border border-theme-divider bg-theme-panel overflow-hidden shadow-xs hover:border-theme-ai/40 transition-colors"
                      >
                        <div className="bg-theme-body px-4 py-2 border-b border-theme-divider flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-theme-text">
                              #{idx + 1}
                            </span>
                            <span className="text-xs font-medium text-theme-text truncate max-w-[200px]">
                              {chunk.documentName}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {chunk.pageNumber !== null ? `Page ${chunk.pageNumber}` : "General Section"}
                            </Badge>
                            <span className="text-[10px] text-theme-muted">
                              Chunk #{chunk.chunkIndex + 1}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="ai"
                              className="text-[10px] font-mono py-0.5 px-2"
                            >
                              {(chunk.similarityScore * 100).toFixed(1)}% Match
                            </Badge>
                            <span className="text-[10px] text-theme-muted">
                              ~{chunk.estimatedTokenCount} tokens
                            </span>
                          </div>
                        </div>
                        <div className="p-3.5 text-xs font-mono text-theme-text whitespace-pre-wrap leading-relaxed select-text">
                          {chunk.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Assembled RAG Prompt Context */}
                {vaultSearchResults.context && (
                  <div className="mt-6 rounded-xl border border-theme-divider bg-theme-panel text-theme-text overflow-hidden shadow-sm">
                    <div className="bg-theme-body px-4 py-2.5 border-b border-theme-divider flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-theme-aiAccent" />
                        <span className="text-xs font-semibold text-theme-text">
                          Assembled RAG Context (LLM Prompt-Ready)
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="text-theme-muted">
                          Budget: ~{vaultSearchResults.context.totalEstimatedTokens} tokens (est.)
                        </span>
                        <span className="text-theme-muted">
                          Used: {vaultSearchResults.context.chunksUsed} chunks
                        </span>
                        {vaultSearchResults.context.chunksOmitted > 0 && (
                          <span className="text-amber-500 font-medium">
                            Omitted: {vaultSearchResults.context.chunksOmitted}
                          </span>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCopyVaultContext}
                          className="h-6 text-[11px] bg-theme-panel border-theme-divider text-theme-text hover:bg-theme-body gap-1"
                        >
                          {vaultCopiedContext ? (
                            <>
                              <Check className="w-3 h-3 text-green-500" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="p-3.5 text-xs font-mono text-theme-text max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text">
                      {vaultSearchResults.context.contextText || (
                        <span className="text-theme-muted italic">No context generated.</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-theme-divider">
            <DialogClose asChild>
              <Button variant="outline" size="sm">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Document Dialog */}
      <ShareDialog
        isOpen={!!shareDoc}
        onClose={() => setShareDoc(null)}
        documentId={shareDoc?.id}
        documentTitle={shareDoc?.filename}
        onPermissionsUpdated={fetchDocuments}
      />
    </DashboardLayout>
  );
}
