"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  FileText,
  ArrowLeft,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  Clock,
  Layers,
  FileCode,
  HardDrive,
  Calendar,
  Loader2,
  Search,
  MessageSquare,
  Users,
  Upload,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatExpirationCountdown } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { SummaryTab } from "@/components/documents/summary-tab";
import { ShareDialog } from "@/components/documents/share-dialog";
import { TextTab } from "@/components/documents/tabs/text-tab";
import { ChunksTab } from "@/components/documents/tabs/chunks-tab";
import { SearchTab } from "@/components/documents/tabs/search-tab";
import { QaTab } from "@/components/documents/tabs/qa-tab";
import { MetadataTab } from "@/components/documents/tabs/metadata-tab";

export default function DocumentDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params?.id;

  const [document, setDocument] = useState(null);
  const [extracted, setExtracted] = useState(null);
  const [chunksData, setChunksData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("full");
  const [copied, setCopied] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [, setTicker] = useState(0);

  const fetchData = useCallback(
    async (isInitial = false) => {
      if (!documentId) return;

      try {
        if (isInitial) {
          setLoading(true);
        }
        setError(null);

        const res = await fetch(`/api/documents/${documentId}/text`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to load document details.");
        }

        setDocument(data.document);
        setExtracted(data.extracted);

        try {
          const cRes = await fetch(`/api/documents/${documentId}/chunks`);
          if (cRes.ok) {
            const cData = await cRes.json();
            setChunksData(cData);
          }
        } catch (cErr) {
          console.warn("Could not fetch chunks:", cErr);
        }
      } catch (err) {
        console.error("Fetch error:", err);
        setError(err.message || "Failed to load document details.");
      } finally {
        if (isInitial) {
          setLoading(false);
        }
      }
    },
    [documentId]
  );

  // Fetch document data once on mount / ID change
  useEffect(() => {
    if (documentId) {
      fetchData(true);
    }
  }, [documentId, fetchData]);

  // Periodic ticker for expiration countdown recalculation without network polling
  useEffect(() => {
    const tickInterval = setInterval(() => {
      setTicker((t) => t + 1);
    }, 60000);

    return () => clearInterval(tickInterval);
  }, []);

  const handleProcess = async () => {
    try {
      setProcessing(true);
      setError(null);

      const res = await fetch(`/api/documents/${documentId}/process`, {
        method: "POST",
      });
      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error(`Server returned non-JSON response (${res.status})`);
      }

      if (!res.ok) {
        throw new Error(data?.error || "Processing failed.");
      }

      await fetchData(false);
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
    <DashboardLayout>
      {/* Top Header */}
      <header className="min-h-16 h-auto py-2.5 px-4 sm:px-6 shrink-0 border-b border-theme-divider bg-theme-panel/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2 text-theme-muted hover:text-theme-text">
            <Link href="/documents">
              <ArrowLeft className="w-4 h-4" />
              Back to Documents
            </Link>
          </Button>
          <span className="text-theme-divider">|</span>
          <div className="flex items-center gap-2 truncate max-w-sm sm:max-w-md">
            <FileText className="w-4 h-4 text-theme-primary shrink-0" />
            <h1 className="text-sm font-semibold text-theme-text truncate">
              {document?.filename || "Document Details"}
            </h1>
            {document && (
              document.isOwner ? (
                <Badge variant="secondary" className="text-xs font-normal">
                  Owner
                </Badge>
              ) : document.role === "write" ? (
                <Badge variant="outline" className="bg-theme-primary/10 text-theme-primary border-theme-primary/30 text-xs">
                  Editor
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-theme-muted/10 text-theme-muted border-theme-divider text-xs">
                  Viewer
                </Badge>
              )
            )}
            {document && (() => {
              const countdown = formatExpirationCountdown(document.expiresAt, document.createdAt);
              return (
                <span
                  className={`text-xs hidden sm:flex items-center gap-1 font-medium ml-1.5 ${
                    countdown.isExpired
                      ? "text-rose-600 dark:text-rose-400"
                      : countdown.isExpiringSoon
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-theme-muted"
                  }`}
                  title={countdown.isExpired ? "This document has expired" : `Automatic deletion scheduled in ${countdown.label}`}
                >
                  <Clock className={`w-3.5 h-3.5 ${countdown.isExpired ? "text-rose-500" : countdown.isExpiringSoon ? "text-amber-500" : "text-theme-muted"}`} strokeWidth={1.5} />
                  {countdown.label}
                </span>
              );
            })()}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {document?.isOwner && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowShareModal(true)}
              className="gap-1.5"
            >
              <Users className="w-3.5 h-3.5" />
              Share
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleProcess}
            disabled={processing || loading || document?.role === "read"}
            title={
              document?.role === "read"
                ? "Only the owner or an editor can reprocess this document."
                : undefined
            }
            className="gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${processing ? "animate-spin" : ""}`} />
            {processing
              ? "Extracting Text..."
              : document?.processingStatus === "completed"
              ? "Re-extract Text"
              : "Process Document"}
          </Button>

          {document?.isOwner && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteModal(true)}
              className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Main Content Body */}
      <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto w-full space-y-6">
        {loading ? (
          <div className="py-24 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-theme-primary animate-spin mx-auto" />
            <p className="text-xs text-theme-muted">Loading document intelligence...</p>
          </div>
        ) : error || !document ? (
          <Card className="p-8 text-center max-w-lg mx-auto space-y-4 border-theme-divider">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <Clock className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-theme-text">
                Document Unavailable or Expired
              </h3>
              <p className="text-xs text-theme-muted leading-relaxed">
                This document may have exceeded its 24-hour retention lifecycle and been automatically purged, or you may not have permission to view it.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button size="sm" variant="outline" asChild>
                <Link href="/documents">
                  <ArrowLeft className="w-4 h-4 mr-1.5" />
                  Back to Vault
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/documents/upload">
                  <Upload className="w-4 h-4 mr-1.5" />
                  Upload New File
                </Link>
              </Button>
            </div>
          </Card>
        ) : (
          <>
            {/* Overview Metadata Card */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="truncate">{document?.filename}</span>
                      <Badge variant="outline" className="font-mono uppercase text-xs shrink-0">
                        {document?.fileType}
                      </Badge>
                    </CardTitle>
                  </div>
                  <div>{getStatusBadge(document?.processingStatus)}</div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-xs pt-4 border-t border-theme-divider">
                  <div className="space-y-1 min-w-0">
                    <span className="text-theme-muted flex items-center gap-1.5 truncate">
                      <HardDrive className="w-3.5 h-3.5 shrink-0" /> File Size
                    </span>
                    <p className="font-medium text-theme-text truncate">
                      {formatFileSize(document?.fileSize)}
                    </p>
                  </div>

                  <div className="space-y-1 min-w-0">
                    <span className="text-theme-muted flex items-center gap-1.5 truncate">
                      <Calendar className="w-3.5 h-3.5 shrink-0" /> Uploaded
                    </span>
                    <p className="font-medium text-theme-text truncate">
                      {formatDate(document?.createdAt)}
                    </p>
                  </div>

                  <div className="space-y-1 min-w-0">
                    <span className="text-theme-muted flex items-center gap-1.5 truncate">
                      <Layers className="w-3.5 h-3.5 shrink-0" /> Sections / Pages
                    </span>
                    <p className="font-medium text-theme-text truncate">
                      {extracted?.pageCount ?? "—"}
                    </p>
                  </div>

                  <div className="space-y-1 min-w-0">
                    <span className="text-theme-muted flex items-center gap-1.5 truncate">
                      <FileCode className="w-3.5 h-3.5 shrink-0" /> Word Count
                    </span>
                    <p className="font-medium text-theme-text truncate">
                      {extracted?.metadata?.wordCount
                        ? `${extracted.metadata.wordCount.toLocaleString()} words`
                        : "—"}
                    </p>
                  </div>

                  <div className="space-y-1 min-w-0">
                    <span className="text-theme-muted flex items-center gap-1.5 truncate">
                      <Layers className="w-3.5 h-3.5 text-theme-primary shrink-0" /> Chunks
                    </span>
                    <p className="font-medium text-theme-text truncate">
                      {chunksData?.totalChunks !== undefined
                        ? `${chunksData.totalChunks} Chunks`
                        : "—"}
                    </p>
                  </div>

                  <div className="space-y-1 min-w-0">
                    <span className="text-theme-muted flex items-center gap-1.5 truncate">
                      <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" /> Retention
                    </span>
                    <p className="font-medium text-theme-text truncate">
                      {formatExpirationCountdown(document?.expiresAt, document?.createdAt).label}
                    </p>
                  </div>
                </div>

                {document?.errorMessage && (
                  <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs">
                    <strong>Processing Error:</strong> {document.errorMessage}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Extracted Text & Analysis Section */}
            <Card>
              <CardHeader className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-theme-divider pb-4">
                <div className="space-y-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-4 h-4 text-theme-primary" /> Document Content & Analysis
                  </CardTitle>
                </div>

                {extracted && (
                  <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end overflow-hidden">
                    <div className="flex items-center gap-1 rounded-lg bg-theme-body border border-theme-divider p-1 text-xs overflow-x-auto whitespace-nowrap max-w-full scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                      {[
                        { id: "full", label: "Full Text" },
                        { id: "pages", label: `By Page (${extracted.pages?.length || 0})` },
                        { id: "chunks", label: `Chunks (${chunksData?.totalChunks || 0})` },
                        { id: "search", label: "Semantic Search", icon: Search },
                        { id: "qa", label: "Ask AI", icon: MessageSquare },
                        { id: "summary", label: "Summary", icon: FileText },
                        { id: "metadata", label: "Metadata" },
                      ].map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`shrink-0 px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                              isActive
                                ? "bg-theme-panel text-theme-primary shadow-xs"
                                : "text-theme-muted hover:text-theme-text"
                            }`}
                          >
                            {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
                            <span>{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {activeTab === "full" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopy}
                        className="gap-1.5 text-xs shadow-xs shrink-0"
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
                    )}
                  </div>
                )}
              </CardHeader>

              <CardContent className="p-6">
                {processing ? (
                  <div className="py-20 text-center space-y-4">
                    <div className="relative inline-flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full border-4 border-theme-divider border-t-theme-primary animate-spin" />
                      <FileText className="w-5 h-5 text-theme-primary absolute" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-theme-text">
                        Extracting Text from {document?.filename}...
                      </h4>
                      <p className="text-xs text-theme-muted max-w-sm mx-auto">
                        Parsing file structure, decoding content, and segmenting sections.
                      </p>
                    </div>
                  </div>
                ) : !extracted ? (
                  <div className="p-12 text-center border-2 border-dashed border-theme-divider rounded-2xl space-y-4">
                    <div className="h-12 w-12 rounded-xl bg-theme-primary/10 text-theme-primary flex items-center justify-center mx-auto">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-theme-text">
                        Ready for Text Extraction
                      </h4>
                      <p className="text-xs text-theme-muted max-w-sm mx-auto">
                        Click below to execute text extraction pipeline on this {document?.fileType?.toUpperCase()} document.
                      </p>
                    </div>
                    <Button onClick={handleProcess} size="sm" className="gap-2 shadow-sm">
                      <RefreshCw className="w-4 h-4" />
                      Process Document Now
                    </Button>
                  </div>
                ) : activeTab === "full" ? (
                  <TextTab extracted={extracted} viewMode="full" />
                ) : activeTab === "pages" ? (
                  <TextTab extracted={extracted} viewMode="pages" />
                ) : activeTab === "chunks" ? (
                  <ChunksTab chunksData={chunksData} />
                ) : activeTab === "search" ? (
                  <SearchTab documentId={documentId} />
                ) : activeTab === "qa" ? (
                  <QaTab documentId={documentId} filename={document?.filename} />
                ) : activeTab === "summary" ? (
                  <SummaryTab documentId={documentId} document={document} />
                ) : (
                  <MetadataTab metadata={extracted?.metadata} />
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{" "}
              <strong className="text-theme-text">
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

      {/* Share Document Dialog */}
      <ShareDialog
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        documentId={documentId}
        documentTitle={document?.filename}
        onPermissionsUpdated={() => fetchData(false)}
      />
    </DashboardLayout>
  );
}
