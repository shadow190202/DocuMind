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
  Search,
  SlidersHorizontal,
  MessageSquare,
  Send,
  Bot,
  User,
  ChevronDown,
  ChevronUp,
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
import { SummaryTab } from "@/components/documents/summary-tab";
import { ShareDialog } from "@/components/documents/share-dialog";

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
  const [activeTab, setActiveTab] = useState("full"); // "full" | "pages" | "chunks" | "search" | "qa" | "metadata"
  const [copied, setCopied] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Semantic search state
  const [searchQueryText, setSearchQueryText] = useState("");
  const [topK, setTopK] = useState(5);
  const [threshold, setThreshold] = useState(0.5);
  const [includeContext, setIncludeContext] = useState(true);
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [copiedContext, setCopiedContext] = useState(false);

  // AI Q&A State
  const [qaQuestion, setQaQuestion] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const [qaError, setQaError] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [messagesList, setMessagesList] = useState([]);
  const [expandedSources, setExpandedSources] = useState({});
  const [qaTopK, setQaTopK] = useState(5);
  const [qaThreshold, setQaThreshold] = useState(0.5);

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
      setLoading(false);
    }
  };

  useEffect(() => {
    if (documentId) {
      fetchData();
      fetchDocumentConversation();
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

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQueryText.trim()) return;

    try {
      setSearching(true);
      setSearchError(null);
      const res = await fetch(`/api/documents/${documentId}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQueryText.trim(),
          topK: Number(topK),
          threshold: Number(threshold),
          includeContext: Boolean(includeContext),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to execute semantic search.");
      }

      setSearchResults(data);
    } catch (err) {
      console.error("Semantic search error:", err);
      setSearchError(err.message || "Failed to execute semantic search.");
    } finally {
      setSearching(false);
    }
  };

  const handleCopyContext = () => {
    if (!searchResults?.context?.contextText) return;
    navigator.clipboard.writeText(searchResults.context.contextText);
    setCopiedContext(true);
    setTimeout(() => setCopiedContext(false), 2000);
  };

  const fetchDocumentConversation = async () => {
    if (!documentId) return;
    try {
      const res = await fetch(`/api/conversations?documentId=${documentId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.conversations && data.conversations.length > 0) {
          const latestConv = data.conversations[0];
          setConversationId(latestConv.id);
          const mRes = await fetch(`/api/conversations/${latestConv.id}`);
          if (mRes.ok) {
            const mData = await mRes.json();
            setMessagesList(mData.messages || []);
          }
        }
      }
    } catch (err) {
      console.warn("Could not fetch document conversation history:", err);
    }
  };

  const handleAskQuestion = async (overrideQuestion) => {
    const q = (typeof overrideQuestion === "string" ? overrideQuestion : qaQuestion).trim();
    if (!q || qaLoading) return;

    setQaQuestion("");
    setQaError(null);

    // Optimistic user message
    const tempUserMsg = {
      id: "temp-user-" + Date.now(),
      role: "user",
      content: q,
      createdAt: new Date().toISOString(),
    };
    setMessagesList((prev) => [...prev, tempUserMsg]);
    setQaLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          documentId,
          conversationId,
          topK: Number(qaTopK),
          threshold: Number(qaThreshold),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate answer.");
      }

      setConversationId(data.conversationId);
      const assistantMsg = {
        id: data.assistantMessageId,
        role: "assistant",
        content: data.answer,
        sources: data.sources || [],
        createdAt: new Date().toISOString(),
      };
      setMessagesList((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error("Ask question error:", err);
      setQaError(err.message || "Failed to generate answer.");
    } finally {
      setQaLoading(false);
    }
  };

  const toggleSourceExpanded = (msgId, srcNum) => {
    const key = `${msgId}-${srcNum}`;
    setExpandedSources((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleClearChat = async () => {
    if (!conversationId) {
      setMessagesList([]);
      return;
    }
    try {
      await fetch(`/api/conversations/${conversationId}`, { method: "DELETE" });
      setConversationId(null);
      setMessagesList([]);
    } catch (err) {
      console.error("Error clearing chat:", err);
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
              {document && (
                document.isOwner ? (
                  <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 text-xs">
                    Owner
                  </Badge>
                ) : document.role === "write" ? (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 text-xs">
                    Editor
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30 text-xs">
                    Viewer
                  </Badge>
                )
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Share action: Owner only */}
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

            {/* Reprocess action: Owner or Editor allowed; Viewer disabled */}
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

            {/* Delete action: Owner only */}
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
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs pt-4 border-t border-slate-100 dark:border-slate-800">
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

                    <div className="space-y-1">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-blue-500" /> Vector Chunks
                      </span>
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {chunksData?.totalChunks !== undefined
                          ? `${chunksData.totalChunks} Chunks`
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

              {/* Extracted Text & Vector Chunks Section */}
              <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-600" /> Document Intelligence & Embeddings
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {chunksData?.totalChunks
                        ? `${chunksData.totalChunks} semantic chunks with 768-dimensional Gemini embeddings indexed in PostgreSQL.`
                        : extracted
                        ? "Text extracted; ready for vector embeddings."
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
                          onClick={() => setActiveTab("chunks")}
                          className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                            activeTab === "chunks"
                              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
                              : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                          }`}
                        >
                          Chunks & Vectors ({chunksData?.totalChunks || 0})
                        </button>
                        <button
                          onClick={() => setActiveTab("search")}
                          className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                            activeTab === "search"
                              ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                              : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                          }`}
                        >
                          <Search className="w-3.5 h-3.5" />
                          Semantic Search
                        </button>
                        <button
                          onClick={() => setActiveTab("qa")}
                          className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                            activeTab === "qa"
                              ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                              : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                          }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          Ask AI
                        </button>
                        <button
                          onClick={() => setActiveTab("summary")}
                          className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                            activeTab === "summary"
                              ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                              : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Summary
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

                      {activeTab === "full" && (
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
                      )}
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
                  ) : activeTab === "chunks" ? (
                    <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
                      {!chunksData?.chunks || chunksData.chunks.length === 0 ? (
                        <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                          <p className="text-xs text-slate-500">
                            No vector chunks available. Click &quot;Re-extract Text&quot; or &quot;Process Document&quot; to generate chunks and 768-dim embeddings.
                          </p>
                        </div>
                      ) : (
                        chunksData.chunks.map((chunk) => (
                          <div
                            key={chunk.id}
                            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs"
                          >
                            <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                  Chunk #{chunk.chunkIndex + 1}
                                </span>
                                <Badge variant="outline" className="text-[10px]">
                                  {chunk.pageNumber !== null ? `Page ${chunk.pageNumber}` : "Document Content"}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                <span>{chunk.characterCount} chars</span>
                                <span>•</span>
                                <span>~{chunk.estimatedTokenCount} tokens (est.)</span>
                                <span>•</span>
                                <Badge variant="success" className="text-[10px] py-0 px-1.5 gap-1">
                                  <Check className="w-2.5 h-2.5" />
                                  768-dim vector
                                </Badge>
                              </div>
                            </div>
                            <div className="p-4 text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed select-text">
                              {chunk.content}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : activeTab === "search" ? (
                    <div className="space-y-6">
                      {/* Search Input and Configuration Controls */}
                      <form onSubmit={handleSearch} className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="relative flex-1">
                            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                            <Input
                              placeholder="Search document semantically (e.g. 'quarterly revenue', 'security requirements')..."
                              value={searchQueryText}
                              onChange={(e) => setSearchQueryText(e.target.value)}
                              className="pl-9 h-10 text-sm"
                            />
                          </div>
                          <Button
                            type="submit"
                            disabled={searching || !searchQueryText.trim()}
                            className="gap-2 shrink-0"
                          >
                            {searching ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Searching...
                              </>
                            ) : (
                              <>
                                <Search className="w-4 h-4" />
                                Vector Search
                              </>
                            )}
                          </Button>
                        </div>

                        {/* Search Parameters Controls */}
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
                          <div className="flex items-center gap-6 flex-wrap">
                            {/* Top K */}
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-600 dark:text-slate-400">
                                Top-K Chunks:
                              </span>
                              <select
                                value={topK}
                                onChange={(e) => setTopK(Number(e.target.value))}
                                className="h-7 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-0.5"
                              >
                                <option value={3}>3 chunks</option>
                                <option value={5}>5 chunks (default)</option>
                                <option value={10}>10 chunks</option>
                                <option value={20}>20 chunks (max)</option>
                              </select>
                            </div>

                            {/* Threshold */}
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-600 dark:text-slate-400">
                                Min Similarity Threshold:
                              </span>
                              <input
                                type="range"
                                min="0.0"
                                max="1.0"
                                step="0.05"
                                value={threshold}
                                onChange={(e) => setThreshold(Number(e.target.value))}
                                className="w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                              />
                              <span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300 w-8">
                                {Number(threshold).toFixed(2)}
                              </span>
                            </div>

                            {/* RAG Context Assembly */}
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={includeContext}
                                onChange={(e) => setIncludeContext(e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                              />
                              <span className="text-slate-700 dark:text-slate-300 font-medium">
                                Assemble RAG Context Block
                              </span>
                            </label>
                          </div>

                          <div className="text-[11px] text-slate-400 font-mono">
                            pgvector &lt;=&gt; cosine distance • 768-dim
                          </div>
                        </div>
                      </form>

                      {/* Error Alert */}
                      {searchError && (
                        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{searchError}</span>
                        </div>
                      )}

                      {/* Search Results Display */}
                      {searchResults && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800 pb-2">
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              Retrieved {searchResults.count} chunk{searchResults.count === 1 ? "" : "s"} for query &quot;{searchResults.query}&quot;
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              Threshold: &gt;= {searchResults.threshold}
                            </Badge>
                          </div>

                          {searchResults.count === 0 ? (
                            <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                No matching chunks found
                              </p>
                              <p className="text-xs text-slate-500 max-w-md mx-auto">
                                No chunks met the minimum similarity score of {searchResults.threshold}. Try lowering the similarity threshold or using different keywords.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {searchResults.results.map((chunk, idx) => (
                                <div
                                  key={chunk.chunkId}
                                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                                >
                                  <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                        Rank #{idx + 1} • Chunk #{chunk.chunkIndex + 1}
                                      </span>
                                      <Badge variant="outline" className="text-[10px]">
                                        {chunk.pageNumber !== null ? `Page ${chunk.pageNumber}` : "General Section"}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge
                                        variant="default"
                                        className="text-[11px] font-mono py-0.5 px-2 bg-blue-600 text-white"
                                      >
                                        {(chunk.similarityScore * 100).toFixed(1)}% Match
                                      </Badge>
                                      <span className="text-[11px] text-slate-400">
                                        ~{chunk.estimatedTokenCount} tokens (est.)
                                      </span>
                                    </div>
                                  </div>
                                  <div className="p-4 text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed select-text">
                                    {chunk.content}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Assembled RAG Prompt Context Block */}
                          {searchResults.context && (
                            <div className="mt-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-200 overflow-hidden shadow-md">
                              <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Sparkles className="w-4 h-4 text-blue-400" />
                                  <span className="text-xs font-semibold text-white">
                                    Assembled RAG Prompt Context (LLM-Ready)
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs">
                                  <span className="text-slate-400">
                                    Budget: ~{searchResults.context.totalEstimatedTokens} tokens (est.)
                                  </span>
                                  <span className="text-slate-400">
                                    Used: {searchResults.context.chunksUsed} chunks
                                  </span>
                                  {searchResults.context.chunksOmitted > 0 && (
                                    <span className="text-amber-400">
                                      Omitted: {searchResults.context.chunksOmitted} (budget limit)
                                    </span>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCopyContext}
                                    className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 gap-1.5"
                                  >
                                    {copiedContext ? (
                                      <>
                                        <Check className="w-3 h-3 text-green-400" />
                                        Copied
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3" />
                                        Copy Context
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                              <div className="p-4 text-xs font-mono text-slate-300 max-h-80 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text">
                                {searchResults.context.contextText || (
                                  <span className="text-slate-500 italic">No context generated.</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : activeTab === "qa" ? (
                    <div className="space-y-4">
                      {/* Q&A Controls Bar */}
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            Grounded Document Intelligence
                          </span>
                          <Badge variant="outline" className="text-[10px] font-mono">
                            gemini-3.8-flash
                          </Badge>
                        </div>

                        <div className="flex items-center gap-4 flex-wrap">
                          {/* Top K */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500">Top-K Chunks:</span>
                            <select
                              value={qaTopK}
                              onChange={(e) => setQaTopK(Number(e.target.value))}
                              className="h-7 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-0.5"
                            >
                              <option value={3}>3</option>
                              <option value={5}>5 (default)</option>
                              <option value={10}>10</option>
                            </select>
                          </div>

                          {/* Threshold */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500">Min Score:</span>
                            <input
                              type="range"
                              min="0.0"
                              max="1.0"
                              step="0.05"
                              value={qaThreshold}
                              onChange={(e) => setQaThreshold(Number(e.target.value))}
                              className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                            <span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                              {Number(qaThreshold).toFixed(2)}
                            </span>
                          </div>

                          {messagesList.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleClearChat}
                              className="h-7 text-xs text-slate-500 hover:text-red-600"
                            >
                              Clear Chat
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Messages Thread Container */}
                      <div className="min-h-[380px] max-h-[520px] overflow-y-auto space-y-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                        {messagesList.length === 0 ? (
                          <div className="py-12 text-center space-y-4">
                            <div className="h-12 w-12 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                              <Bot className="w-6 h-6" />
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                Ask anything about {document?.filename}
                              </h4>
                              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                                Answers are strictly synthesized from retrieved document chunks with verifiable source citations.
                              </p>
                            </div>

                            {/* Suggested Starter Questions */}
                            <div className="pt-2 flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
                              {[
                                "What is the primary summary of this document?",
                                "What are the key conclusions or findings?",
                                "List important figures, metrics, or dates mentioned.",
                              ].map((suggestedQ, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => handleAskQuestion(suggestedQ)}
                                  className="text-xs px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors shadow-2xs text-left"
                                >
                                  {suggestedQ}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          messagesList.map((msg, idx) => (
                            <div
                              key={msg.id || idx}
                              className={`flex flex-col ${
                                msg.role === "user" ? "items-end" : "items-start"
                              }`}
                            >
                              <div
                                className={`max-w-[85%] rounded-2xl p-4 text-xs ${
                                  msg.role === "user"
                                    ? "bg-blue-600 text-white rounded-br-xs shadow-xs"
                                    : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-xs shadow-xs"
                                }`}
                              >
                                <div className="flex items-center gap-2 mb-1.5 opacity-80 text-[10px] font-semibold">
                                  {msg.role === "user" ? (
                                    <>
                                      <User className="w-3 h-3" />
                                      <span>You</span>
                                    </>
                                  ) : (
                                    <>
                                      <Bot className="w-3.5 h-3.5 text-blue-500" />
                                      <span>DocuMind AI</span>
                                    </>
                                  )}
                                </div>

                                <div className="whitespace-pre-wrap leading-relaxed select-text font-sans">
                                  {msg.content}
                                </div>

                                {/* Source Citations Container */}
                                {msg.sources && msg.sources.length > 0 && (
                                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60 space-y-2">
                                    <div className="text-[10px] font-semibold text-slate-500 flex items-center gap-1.5">
                                      <Sparkles className="w-3 h-3 text-blue-500" />
                                      <span>
                                        Grounded in {msg.sources.length} document source
                                        {msg.sources.length === 1 ? "" : "s"}:
                                      </span>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                      {msg.sources.map((src) => {
                                        const isExp =
                                          expandedSources[`${msg.id}-${src.sourceNumber}`];
                                        return (
                                          <div
                                            key={src.sourceNumber}
                                            className="rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/60 text-[11px] overflow-hidden"
                                          >
                                            <div
                                              onClick={() =>
                                                toggleSourceExpanded(msg.id, src.sourceNumber)
                                              }
                                              className="p-2 flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                                            >
                                              <div className="flex items-center gap-2 truncate">
                                                <Badge
                                                  variant="default"
                                                  className="text-[10px] py-0 px-1.5 bg-blue-600 text-white font-mono"
                                                >
                                                  SOURCE {src.sourceNumber}
                                                </Badge>
                                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                                  {src.pageNumber !== null
                                                    ? `Page ${src.pageNumber}`
                                                    : "General Section"}
                                                </span>
                                                <span className="text-slate-400 text-[10px]">
                                                  Chunk #{src.chunkIndex + 1}
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <Badge
                                                  variant="outline"
                                                  className="text-[10px] py-0"
                                                >
                                                  {(src.similarityScore * 100).toFixed(1)}% Match
                                                </Badge>
                                                {isExp ? (
                                                  <ChevronUp className="w-3 h-3 text-slate-400" />
                                                ) : (
                                                  <ChevronDown className="w-3 h-3 text-slate-400" />
                                                )}
                                              </div>
                                            </div>
                                            {isExp && (
                                              <div className="p-3 border-t border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-950 font-mono text-[10px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap select-text leading-relaxed">
                                                {src.content || "(Grounded passage excerpt)"}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        )}

                        {qaLoading && (
                          <div className="flex items-start gap-2">
                            <div className="rounded-2xl p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 rounded-bl-xs shadow-xs flex items-center gap-2">
                              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                              <span>Synthesizing grounded answer with Gemini 3.8 Flash...</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Error Alert */}
                      {qaError && (
                        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{qaError}</span>
                        </div>
                      )}

                      {/* Question Input Form */}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleAskQuestion();
                        }}
                        className="flex gap-2"
                      >
                        <div className="relative flex-1">
                          <Input
                            placeholder={`Ask a question about ${document?.filename || "this document"}...`}
                            value={qaQuestion}
                            onChange={(e) => setQaQuestion(e.target.value)}
                            disabled={qaLoading}
                            className="h-10 text-xs pl-3 pr-10"
                          />
                        </div>
                        <Button
                          type="submit"
                          disabled={qaLoading || !qaQuestion.trim()}
                          className="h-10 px-4 gap-1.5 shrink-0"
                        >
                          {qaLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              <span>Ask</span>
                            </>
                          )}
                        </Button>
                      </form>
                    </div>
                  ) : activeTab === "summary" ? (
                    <SummaryTab documentId={documentId} document={document} />
                  ) : (
                    <div className="rounded-xl bg-slate-900 p-5 font-mono text-xs text-slate-200 overflow-x-auto border border-slate-800">
                      <pre>{JSON.stringify(extracted?.metadata || {}, null, 2)}</pre>
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

      {/* Share Document Dialog */}
      <ShareDialog
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        documentId={documentId}
        documentTitle={document?.filename}
        onPermissionsUpdated={fetchData}
      />
    </div>
  );
}
