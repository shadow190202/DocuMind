"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { AdminHeader } from "@/components/admin/admin-header";
import {
  Search,
  FileText,
  RefreshCw,
  Trash2,
  AlertCircle,
  CheckCircle,
  FileCode,
  HardDrive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function AdminDocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fileTypeFilter, setFileTypeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [processingDocId, setProcessingDocId] = useState(null);
  const [deletingDocId, setDeletingDocId] = useState(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        status: statusFilter,
        fileType: fileTypeFilter,
      });
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/documents?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to load global documents repository.");
      }
      const data = await res.json();
      if (data.success) {
        setDocuments(data.documents || []);
        setPagination(data.pagination);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, statusFilter, fileTypeFilter, search]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleReprocess = async (docId) => {
    setProcessingDocId(docId);
    setActionSuccess(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/documents/${docId}/reprocess`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reprocess document.");
      }
      setActionSuccess(`Document reprocessed successfully. Created ${data.chunksCount} chunks.`);
      fetchDocuments();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingDocId(null);
    }
  };

  const handleDelete = async (docId, filename) => {
    if (!confirm(`Are you sure you want to delete '${filename}'? This action cascades deletion to chunks and cannot be undone.`)) {
      return;
    }
    setDeletingDocId(docId);
    setActionSuccess(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/documents/${docId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete document.");
      }
      setActionSuccess(`Document '${filename}' deleted successfully.`);
      fetchDocuments();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingDocId(null);
    }
  };

  const getStatusBadge = (status) => {
    if (status === "completed") {
      return (
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 text-[10px]">
          Completed
        </Badge>
      );
    }
    if (status === "processing") {
      return (
        <Badge className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 text-[10px] animate-pulse">
          Processing...
        </Badge>
      );
    }
    if (status === "failed") {
      return (
        <Badge className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 text-[10px]">
          Failed
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-[10px]">
        {status}
      </Badge>
    );
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 w-full overflow-y-auto flex flex-col">
        <AdminHeader
          title="Global Document Repository"
          subtitle="Surveillance across all tenant documents with administrative reprocessing and deletion"
        />

        <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {actionSuccess && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* Search & Status Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search documents by filename or owner..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Status filter */}
              <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-0.5 text-xs font-medium">
                {["all", "completed", "failed", "processing"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-2.5 py-1 rounded-md capitalize transition-colors ${
                      statusFilter === s
                        ? "bg-purple-600 text-white font-semibold"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchDocuments}
                disabled={loading}
                className="text-xs gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Global Documents Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                  <tr>
                    <th className="px-6 py-3.5">Document</th>
                    <th className="px-4 py-3.5">Owner</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-center">Chunks</th>
                    <th className="px-4 py-3.5 text-right">Size</th>
                    <th className="px-4 py-3.5">Uploaded</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {documents.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                        No documents match the specified filters.
                      </td>
                    </tr>
                  )}

                  {documents.map((doc) => {
                    const isProcessingThis = processingDocId === doc.id;
                    const isDeletingThis = deletingDocId === doc.id;
                    return (
                      <tr key={doc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 dark:text-white truncate">
                                {doc.filename}
                              </p>
                              <span className="text-[10px] uppercase font-bold text-slate-400">
                                {doc.fileType}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
                              {doc.owner?.name || "Unnamed"}
                            </p>
                            <p className="text-[11px] text-slate-400 font-mono truncate">
                              {doc.owner?.email || doc.owner?.id}
                            </p>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          {getStatusBadge(doc.processingStatus)}
                        </td>

                        <td className="px-4 py-4 text-center font-mono text-slate-600 dark:text-slate-300">
                          {doc.chunksCount}
                        </td>

                        <td className="px-4 py-4 text-right font-mono text-slate-600 dark:text-slate-300">
                          {doc.fileSize > 1024 * 1024
                            ? `${(doc.fileSize / (1024 * 1024)).toFixed(2)} MB`
                            : `${(doc.fileSize / 1024).toFixed(1)} KB`}
                        </td>

                        <td className="px-4 py-4 text-slate-400 text-[11px]">
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isProcessingThis || isDeletingThis}
                              onClick={() => handleReprocess(doc.id)}
                              className="text-xs gap-1"
                              title="Re-extract, chunk, and embed this document"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isProcessingThis ? "animate-spin" : ""}`} />
                              <span>Reprocess</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isProcessingThis || isDeletingThis}
                              onClick={() => handleDelete(doc.id, doc.filename)}
                              className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/60 p-2"
                              title="Delete document permanently"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
