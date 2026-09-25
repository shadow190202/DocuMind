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
  Sparkles,
  SlidersHorizontal,
  Check,
  Copy,
  Users,
} from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process document.");
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
      alert(err.message || "Failed to process document.");
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

  useEffect(() => {
    fetchDocuments();
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
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-16 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">My Documents</h1>
            <Badge variant="outline" className="text-xs">
              {docs.length} {docs.length === 1 ? "File" : "Files"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchModalOpen(true)}
              className="gap-1.5 shadow-sm text-blue-600 dark:text-blue-400"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Vault Semantic Search
            </Button>
            <Button size="sm" asChild className="gap-1.5 shadow-sm">
              <Link href="/documents/upload">
                <Upload className="w-4 h-4" />
                Upload Document
              </Link>
            </Button>
          </div>
        </header>

        <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Document Vault</CardTitle>
                <CardDescription>
                  Your document repository backed by PostgreSQL.
                </CardDescription>
              </div>

              {/* Segmented Filter Tabs */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setFilterTab("all")}
                  className={`px-3 py-1.5 rounded-md transition ${
                    filterTab === "all"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm font-semibold"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  All ({docs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("mine")}
                  className={`px-3 py-1.5 rounded-md transition ${
                    filterTab === "mine"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm font-semibold"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  My Documents ({docs.filter((d) => d.isOwner).length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("shared")}
                  className={`px-3 py-1.5 rounded-md transition ${
                    filterTab === "shared"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm font-semibold"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
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
                  className="pl-9 h-9 text-xs"
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
                <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
                  <div className="h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {searchQuery ? "No matching documents" : "No documents uploaded yet"}
                    </h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      {searchQuery
                        ? "Try searching for a different keyword."
                        : "Upload your first PDF, DOCX, TXT, or CSV file to start building your AI knowledge base."}
                    </p>
                  </div>
                  {!searchQuery && (
                    <Button asChild size="sm" className="gap-1.5">
                      <Link href="/documents/upload">
                        <Upload className="w-4 h-4" />
                        Upload Document
                      </Link>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-xs text-slate-400">
                        <th className="pb-3 font-semibold">Document Name</th>
                        <th className="pb-3 font-semibold">Format</th>
                        <th className="pb-3 font-semibold">Size</th>
                        <th className="pb-3 font-semibold">Status</th>
                        <th className="pb-3 font-semibold">Uploaded</th>
                        <th className="pb-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredDocs.map((doc) => (
                        <tr key={doc.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors">
                          <td className="py-3.5 pr-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 shrink-0">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <Link
                                    href={`/documents/${doc.id}`}
                                    className="font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 truncate max-w-xs block transition-colors"
                                  >
                                    {doc.filename}
                                  </Link>
                                  {doc.isOwner ? (
                                    <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 text-[10px] px-1.5 py-0">
                                      Owner
                                    </Badge>
                                  ) : doc.role === "write" ? (
                                    <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 text-[10px] px-1.5 py-0">
                                      Editor
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30 text-[10px] px-1.5 py-0">
                                      Viewer
                                    </Badge>
                                  )}
                                </div>
                                {!doc.isOwner && (
                                  <span className="text-[11px] text-slate-400 block truncate">
                                    Shared by {doc.owner?.name || doc.owner?.email || "colleague"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 pr-4">
                            <span className="font-mono text-xs uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                              {doc.fileType}
                            </span>
                          </td>
                          <td className="py-3.5 pr-4 text-xs text-slate-500">
                            {formatFileSize(doc.fileSize)}
                          </td>
                          <td className="py-3.5 pr-4">
                            {getStatusBadge(doc.processingStatus)}
                          </td>
                          <td className="py-3.5 pr-4 text-xs text-slate-500">
                            {formatDate(doc.createdAt)}
                          </td>
                          <td className="py-3.5 text-right space-x-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                              className="text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                              title="View Document & Extracted Text"
                            >
                              <Link href={`/documents/${doc.id}`}>
                                <Eye className="w-4 h-4" />
                              </Link>
                            </Button>
                            {/* Process Document: enabled for Owner and Editor; disabled for Viewer */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                              onClick={(e) => handleProcess(doc.id, e)}
                              disabled={processingId === doc.id || doc.role === "read"}
                              title={
                                doc.role === "read"
                                  ? "Only the owner or an editor can reprocess this document."
                                  : doc.processingStatus === "completed"
                                  ? "Re-extract Text"
                                  : "Extract / Process Document"
                              }
                            >
                              {processingId === doc.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                              ) : (
                                <RefreshCw className="w-4 h-4" />
                              )}
                            </Button>
                            {/* Share button: Owner only */}
                            {doc.isOwner && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
                                onClick={() => setShareDoc(doc)}
                                title="Share Document"
                              >
                                <Users className="w-4 h-4" />
                              </Button>
                            )}
                            {/* Delete button: Owner only */}
                            {doc.isOwner && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50"
                                onClick={() => setDocToDelete(doc)}
                                title="Delete Document"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!docToDelete} onOpenChange={(open) => !open && setDocToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong className="text-slate-900 dark:text-slate-100">
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
          <DialogHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
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
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <Input
                    placeholder="Search across your documents (e.g. 'financial forecast', 'user authentication')..."
                    value={vaultQuery}
                    onChange={(e) => setVaultQuery(e.target.value)}
                    className="pl-9 h-10 text-sm"
                  />
                </div>
                <Button
                  type="submit"
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
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Document Scope */}
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-slate-600 dark:text-slate-400">Scope:</span>
                    <select
                      value={vaultSelectedDocId}
                      onChange={(e) => setVaultSelectedDocId(e.target.value)}
                      className="h-7 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-0.5 max-w-[150px] truncate"
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
                    <span className="font-medium text-slate-600 dark:text-slate-400">Top-K:</span>
                    <select
                      value={vaultTopK}
                      onChange={(e) => setVaultTopK(Number(e.target.value))}
                      className="h-7 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-0.5"
                    >
                      <option value={3}>3 chunks</option>
                      <option value={5}>5 chunks</option>
                      <option value={10}>10 chunks</option>
                      <option value={20}>20 chunks</option>
                    </select>
                  </div>

                  {/* Threshold */}
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-slate-600 dark:text-slate-400">Min Threshold:</span>
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.05"
                      value={vaultThreshold}
                      onChange={(e) => setVaultThreshold(Number(e.target.value))}
                      className="w-20 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300 w-7">
                      {Number(vaultThreshold).toFixed(2)}
                    </span>
                  </div>

                  {/* Context Toggle */}
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={vaultIncludeContext}
                      onChange={(e) => setVaultIncludeContext(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                    />
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
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
                <div className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Retrieved {vaultSearchResults.count} chunk{vaultSearchResults.count === 1 ? "" : "s"} for &quot;{vaultSearchResults.query}&quot;
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    Min Score: &gt;= {vaultSearchResults.threshold}
                  </Badge>
                </div>

                {vaultSearchResults.count === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      No matching chunks found
                    </p>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      No document chunks met the similarity threshold of {vaultSearchResults.threshold}. Try lowering the threshold or refining your search keywords.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {vaultSearchResults.results.map((chunk, idx) => (
                      <div
                        key={chunk.chunkId}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                      >
                        <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              #{idx + 1}
                            </span>
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                              {chunk.documentName}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {chunk.pageNumber !== null ? `Page ${chunk.pageNumber}` : "General Section"}
                            </Badge>
                            <span className="text-[10px] text-slate-400">
                              Chunk #{chunk.chunkIndex + 1}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="default"
                              className="text-[10px] font-mono py-0.5 px-2 bg-blue-600 text-white"
                            >
                              {(chunk.similarityScore * 100).toFixed(1)}% Match
                            </Badge>
                            <span className="text-[10px] text-slate-400">
                              ~{chunk.estimatedTokenCount} tokens
                            </span>
                          </div>
                        </div>
                        <div className="p-3.5 text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed select-text">
                          {chunk.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Assembled RAG Prompt Context */}
                {vaultSearchResults.context && (
                  <div className="mt-6 rounded-xl border border-slate-700 bg-slate-900 text-slate-200 overflow-hidden shadow-md">
                    <div className="bg-slate-800/90 px-4 py-2.5 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-xs font-semibold text-white">
                          Assembled RAG Context (LLM Prompt-Ready)
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="text-slate-400">
                          Budget: ~{vaultSearchResults.context.totalEstimatedTokens} tokens (est.)
                        </span>
                        <span className="text-slate-400">
                          Used: {vaultSearchResults.context.chunksUsed} chunks
                        </span>
                        {vaultSearchResults.context.chunksOmitted > 0 && (
                          <span className="text-amber-400">
                            Omitted: {vaultSearchResults.context.chunksOmitted}
                          </span>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCopyVaultContext}
                          className="h-6 text-[11px] bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 gap-1"
                        >
                          {vaultCopiedContext ? (
                            <>
                              <Check className="w-3 h-3 text-green-400" />
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
                    <div className="p-3.5 text-xs font-mono text-slate-300 max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text">
                      {vaultSearchResults.context.contextText || (
                        <span className="text-slate-500 italic">No context generated.</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-slate-100 dark:border-slate-800">
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
    </div>
  );
}
