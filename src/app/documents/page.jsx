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

export default function DocumentsPage() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [docToDelete, setDocToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [processingId, setProcessingId] = useState(null);

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

  const filteredDocs = docs.filter((doc) =>
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <Button size="sm" asChild className="gap-1.5 shadow-sm">
            <Link href="/documents/upload">
              <Upload className="w-4 h-4" />
              Upload Document
            </Link>
          </Button>
        </header>

        <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Document Vault</CardTitle>
                <CardDescription>
                  Your isolated document repository backed by PostgreSQL.
                </CardDescription>
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
                              <Link
                                href={`/documents/${doc.id}`}
                                className="font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 truncate max-w-xs block transition-colors"
                              >
                                {doc.filename}
                              </Link>
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
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                              onClick={(e) => handleProcess(doc.id, e)}
                              disabled={processingId === doc.id}
                              title={
                                doc.processingStatus === "completed"
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
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50"
                              onClick={() => setDocToDelete(doc)}
                              title="Delete Document"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
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
    </div>
  );
}
