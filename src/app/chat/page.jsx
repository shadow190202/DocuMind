"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  MessageSquare,
  Sparkles,
  Send,
  Bot,
  User,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileText,
  SlidersHorizontal,
  Edit3,
  Download,
  HardDrive,
  RefreshCw,
} from "lucide-react";
import { RenameModal } from "@/components/conversations/rename-modal";
import { DeleteModal } from "@/components/conversations/delete-modal";
import { ChatMessageContent } from "@/components/chat/chat-message-content";

function ChatContent() {
  const searchParams = useSearchParams();
  const urlConvId = searchParams.get("id") || searchParams.get("conversationId");

  const [conversationsList, setConversationsList] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [documentsList, setDocumentsList] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(""); // "" = Entire Vault

  const [question, setQuestion] = useState("");
  const [lastPrompt, setLastPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);
  const [error, setError] = useState(null);
  const [topK, setTopK] = useState(5);
  const [threshold, setThreshold] = useState(0.5);
  const [expandedSources, setExpandedSources] = useState({});

  // Modals & Export state
  const [renameTarget, setRenameTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // 1. Fetch user's completed documents for scope filter
  const fetchDocuments = async () => {
    try {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data = await res.json();
        const completed = (data.documents || []).filter(
          (d) => d.processingStatus === "completed"
        );
        setDocumentsList(completed);
      }
    } catch (err) {
      console.warn("Could not fetch documents list:", err);
    }
  };

  // 2. Fetch user's conversations list
  const fetchConversations = async () => {
    try {
      setLoadingConv(true);
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversationsList(data.conversations || []);
      }
    } catch (err) {
      console.warn("Could not fetch conversations:", err);
    } finally {
      setLoadingConv(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    fetchConversations();
  }, []);

  // 3. Load active conversation messages
  const selectConversation = async (convId) => {
    if (!convId) return;
    setActiveConversationId(convId);
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${convId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        if (data.conversation?.documentId) {
          setSelectedDocId(data.conversation.documentId);
        } else {
          setSelectedDocId("");
        }
      }
    } catch (err) {
      console.error("Could not load conversation:", err);
      setError("Failed to load conversation history.");
    }
  };

  // 3b. Deep linking support: load conversation from URL parameter
  useEffect(() => {
    if (urlConvId && urlConvId !== activeConversationId) {
      selectConversation(urlConvId);
    }
  }, [urlConvId]);

  // 4. Start a new conversation
  const startNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    setError(null);
    setQuestion("");
    setLastPrompt("");
    setShowExportMenu(false);
  };

  // 5. Submit question to /api/chat
  const handleAsk = async (overrideQ) => {
    const q = (typeof overrideQ === "string" ? overrideQ : question).trim();
    if (!q || loading) return;

    setLastPrompt(q);
    setQuestion("");
    setError(null);

    // Optimistic user message
    const tempUserMsg = {
      id: "temp-" + Date.now(),
      role: "user",
      content: q,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setLoading(true);

    try {
      const payload = {
        question: q,
        conversationId: activeConversationId || undefined,
        topK: Number(topK),
        threshold: Number(threshold),
      };
      if (selectedDocId) {
        payload.documentId = selectedDocId;
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        const errObj = new Error(data.error || "Failed to generate answer.");
        errObj.code = data.code;
        errObj.status = res.status;
        throw errObj;
      }

      // If this was a new conversation, update active conversation state
      if (!activeConversationId) {
        setActiveConversationId(data.conversationId);
        fetchConversations();
      }

      const assistantMsg = {
        id: data.assistantMessageId,
        role: "assistant",
        content: data.answer,
        sources: data.sources || [],
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Notify sidebar to refresh live AI usage counters
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("documind:ai-usage-updated", {
            detail: data.usage,
          })
        );
      }
    } catch (err) {
      console.error("Chat error:", err);
      // Remove optimistic message if query failed so conversation remains clean
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      setError({
        message: err.message || "Failed to generate answer.",
        code: err.code,
        status: err.status,
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleSource = (msgId, srcNum) => {
    const key = `${msgId}-${srcNum}`;
    setExpandedSources((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSourcePillClick = (msgId, srcNum) => {
    const key = `${msgId}-${srcNum}`;
    setExpandedSources((prev) => ({
      ...prev,
      [key]: true,
    }));
    setTimeout(() => {
      const el = document.getElementById(`source-${msgId}-${srcNum}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, 50);
  };

  // Find active conversation details
  const activeConv = conversationsList.find((c) => c.id === activeConversationId);

  const handleRenameSuccess = (updated) => {
    setConversationsList((prev) =>
      prev.map((c) => (c.id === updated.id ? { ...c, title: updated.title } : c))
    );
  };

  const handleDeleteSuccess = (deletedId) => {
    setConversationsList((prev) => prev.filter((c) => c.id !== deletedId));
    if (activeConversationId === deletedId) {
      startNewChat();
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Universal Sidebar */}
      <Sidebar />

      {/* Main Chat Interface */}
      <div className="flex-1 flex min-w-0 overflow-hidden">
        {/* Left Sub-Sidebar: Conversations Thread List */}
        <div className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0 hidden md:flex">
          {/* Action Header */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800">
            <Button
              onClick={startNewChat}
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 shadow-sm font-medium text-xs"
            >
              <Plus className="w-4 h-4 text-blue-600" />
              New Chat
            </Button>
          </div>

          {/* Conversations History Scrollable Area */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <div className="px-2 py-1 flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <span>Recent Chats</span>
              {loadingConv && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
            </div>

            {conversationsList.length === 0 && !loadingConv ? (
              <div className="text-center py-8 px-3 text-slate-400 text-xs">
                No past conversations yet.
              </div>
            ) : (
              conversationsList.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={`group p-2.5 rounded-xl cursor-pointer text-xs flex items-center justify-between transition-colors ${
                    activeConversationId === conv.id
                      ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 font-medium"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="truncate flex-1 pr-2">
                    <p className="truncate">{conv.title || "Untitled Chat"}</p>
                    <span className="text-[10px] text-slate-400 block truncate">
                      {conv.documentName ? conv.documentName : "Vault-Wide"}
                    </span>
                  </div>

                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenameTarget(conv);
                      }}
                      title="Rename conversation"
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(conv);
                      }}
                      title="Delete conversation"
                      className="p-1 rounded-md text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Active Chat Workspace */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950">
          {/* Header */}
          <header className="h-16 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 truncate min-w-0">
              <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="truncate min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                    {activeConv ? activeConv.title : "Vault-Wide Knowledge Assistant"}
                  </h1>
                  {activeConv && (
                    <button
                      onClick={() => setRenameTarget(activeConv)}
                      title="Rename conversation"
                      className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 truncate">
                  {activeConv?.documentName
                    ? `Scoped to ${activeConv.documentName}`
                    : "Grounded Q&A powered by Gemini 3.8 Flash & pgvector retrieval"}
                </p>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {activeConversationId && (
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="gap-1.5 text-xs shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Export</span>
                  </Button>

                  {showExportMenu && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg py-1 z-20 text-xs animate-in fade-in duration-100">
                      <button
                        onClick={() => {
                          setShowExportMenu(false);
                          window.location.href = `/api/conversations/${activeConversationId}/export?format=markdown`;
                        }}
                        className="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                      >
                        <span>Markdown (.md)</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowExportMenu(false);
                          window.location.href = `/api/conversations/${activeConversationId}/export?format=json`;
                        }}
                        className="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                      >
                        <span>JSON (.json)</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Scope Filter Dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 hidden sm:inline">Scope:</span>
                <select
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="h-9 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 max-w-[180px] truncate shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Entire Document Vault</option>
                  {documentsList.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.filename}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </header>

          {/* Messages Thread */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 max-w-4xl mx-auto w-full">
            {messages.length === 0 ? (
              <div className="py-20 text-center space-y-4 max-w-md mx-auto">
                <div className="h-14 w-14 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-sm">
                  <Bot className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Ask your Document Vault
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Ask natural-language questions across your uploaded documents. Answers are strictly grounded in retrieved passages with verifiable citations.
                  </p>
                </div>

                {/* Suggested Starters */}
                <div className="pt-2 flex flex-col gap-2 text-left">
                  {[
                    "What are the main key points discussed across these documents?",
                    "Summarize the major findings and metrics reported.",
                    "Are there any conflicting requirements or numbers mentioned?",
                  ].map((starter, i) => (
                    <button
                      key={i}
                      onClick={() => handleAsk(starter)}
                      className="p-3 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-blue-400 dark:hover:border-blue-600 hover:text-blue-600 transition-colors shadow-sm text-left flex items-center justify-between"
                    >
                      <span className="truncate">{starter}</span>
                      <Sparkles className="w-3.5 h-3.5 shrink-0 text-blue-500 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    {!isUser && (
                      <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed space-y-3 shadow-sm ${
                        isUser
                          ? "bg-blue-600 text-white rounded-tr-sm"
                          : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm"
                      }`}
                    >
                      {/* Message Content Body */}
                      <ChatMessageContent
                        content={msg.content}
                        isUser={isUser}
                        onSourceClick={(srcNum) => handleSourcePillClick(msg.id, srcNum)}
                      />

                      {/* Source Citations Accordion (Assistant Only) */}
                      {!isUser && Array.isArray(msg.sources) && msg.sources.length > 0 && (
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-blue-500" />
                            Grounded Sources ({msg.sources.length}):
                          </p>

                          <div className="space-y-1.5">
                            {msg.sources.map((src) => {
                              const isExpanded =
                                expandedSources[`${msg.id}-${src.sourceNumber}`];
                              return (
                                <div
                                  key={src.sourceNumber}
                                  id={`source-${msg.id}-${src.sourceNumber}`}
                                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-2.5 text-[11px]"
                                >
                                  <div
                                    onClick={() => toggleSource(msg.id, src.sourceNumber)}
                                    className="flex items-center justify-between cursor-pointer font-medium text-slate-700 dark:text-slate-300"
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                                        SOURCE {src.sourceNumber}
                                      </Badge>
                                      <span className="truncate">{src.documentName}</span>
                                      {src.pageNumber && (
                                        <span className="text-slate-400">
                                          (Page {src.pageNumber})
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <Badge variant="outline" className="text-[10px] py-0">
                                        {Math.round(src.similarityScore * 100)}% match
                                      </Badge>
                                      {isExpanded ? (
                                        <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                                      ) : (
                                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                      )}
                                    </div>
                                  </div>

                                  {isExpanded && src.chunkContent && (
                                    <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-mono text-[10.5px] leading-normal bg-white dark:bg-slate-900 p-2 rounded">
                                      {src.chunkContent}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {isUser && (
                      <div className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Loading Indicator */}
            {loading && (
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 flex items-center gap-2 shadow-sm">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  Generating grounded answer with citations...
                </div>
              </div>
            )}

            {/* Error Message / High Demand / Rate Limit Banner */}
            {error && (() => {
              const errMsg = typeof error === "string" ? error : error.message;
              const errCode = error?.code;
              const isHighDemand =
                errCode === "UPSTREAM_HIGH_DEMAND" ||
                error?.status === 503 ||
                errMsg?.toLowerCase().includes("high traffic") ||
                errMsg?.toLowerCase().includes("high demand") ||
                errMsg?.toLowerCase().includes("unavailable");
              const isRateLimit =
                errCode === "UPSTREAM_RATE_LIMITED" ||
                error?.status === 429 ||
                errMsg?.toLowerCase().includes("rate limit");

              const isAmber = isHighDemand || isRateLimit;

              return (
                <div
                  className={`p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs ${
                    isAmber
                      ? "bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200"
                      : "bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <AlertCircle
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        isAmber
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    />
                    <div>
                      <p className="font-semibold text-[13px]">
                        {isHighDemand
                          ? "AI Service Temporarily Busy"
                          : isRateLimit
                          ? "Rate Limit Reached"
                          : "Request Failed"}
                      </p>
                      <p className="mt-0.5 opacity-90 leading-relaxed">{errMsg}</p>
                    </div>
                  </div>

                  {lastPrompt && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAsk(lastPrompt)}
                      disabled={loading}
                      className={`shrink-0 text-xs gap-1.5 font-medium ${
                        isAmber
                          ? "border-amber-300 dark:border-amber-800 bg-amber-100/50 hover:bg-amber-100 dark:bg-amber-900/30 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-100"
                          : "border-red-300 dark:border-red-800 bg-red-100/50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/60 text-red-900 dark:text-red-100"
                      }`}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry</span>
                    </Button>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Bottom Chat Input Bar & Tuning Controls */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
            <div className="max-w-4xl mx-auto space-y-3">
              {/* Question Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAsk();
                }}
                className="flex items-center gap-2"
              >
                <Input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={
                    selectedDocId
                      ? "Ask a question about this document..."
                      : "Ask any question across your entire document vault..."
                  }
                  disabled={loading}
                  className="flex-1 text-xs"
                />
                <Button type="submit" disabled={loading || !question.trim()} size="sm" className="gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  Ask AI
                </Button>
              </form>

              {/* RAG Parameter Tuning Bar */}
              <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-3 pt-1">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3 h-3 text-slate-500" />
                    <span>Top-K:</span>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={topK}
                      onChange={(e) => setTopK(e.target.value)}
                      className="w-16 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                      {topK}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span>Threshold:</span>
                    <input
                      type="range"
                      min="0.1"
                      max="0.9"
                      step="0.05"
                      value={threshold}
                      onChange={(e) => setThreshold(e.target.value)}
                      className="w-16 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                      {Number(threshold).toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="font-mono text-[10px]">
                  Free Tier: gemini-3.8-flash • pgvector &lt;=&gt; cosine
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rename Modal */}
      <RenameModal
        isOpen={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        conversation={renameTarget}
        onSuccess={handleRenameSuccess}
      />

      {/* Delete Modal */}
      <DeleteModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        conversation={deleteTarget}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      }
    >
      <ChatContent />
    </Suspense>
  );
}
