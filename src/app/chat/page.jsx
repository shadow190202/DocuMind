"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";

export default function ChatPage() {
  const [conversationsList, setConversationsList] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [documentsList, setDocumentsList] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(""); // "" = Entire Vault

  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);
  const [error, setError] = useState(null);
  const [topK, setTopK] = useState(5);
  const [threshold, setThreshold] = useState(0.5);
  const [expandedSources, setExpandedSources] = useState({});

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

  // 4. Start a new conversation
  const startNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    setError(null);
    setQuestion("");
  };

  // 5. Delete a conversation
  const handleDeleteConversation = async (convId, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`/api/conversations/${convId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setConversationsList((prev) => prev.filter((c) => c.id !== convId));
        if (activeConversationId === convId) {
          startNewChat();
        }
      }
    } catch (err) {
      console.error("Could not delete conversation:", err);
    }
  };

  // 6. Submit question to /api/chat
  const handleAsk = async (overrideQ) => {
    const q = (typeof overrideQ === "string" ? overrideQ : question).trim();
    if (!q || loading) return;

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
        throw new Error(data.error || "Failed to generate answer.");
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
    } catch (err) {
      console.error("Chat error:", err);
      setError(err.message || "Failed to generate answer.");
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

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex min-w-0 overflow-hidden">
        {/* Left Conversations Panel */}
        <div className="w-72 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md flex flex-col hidden md:flex">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Conversations
              </h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={startNewChat}
              className="h-7 text-xs gap-1 px-2 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              New
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loadingConv ? (
              <div className="py-8 text-center">
                <Loader2 className="w-4 h-4 text-slate-400 animate-spin mx-auto" />
              </div>
            ) : conversationsList.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 px-4">
                No past conversations. Start a new chat below!
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
                  <button
                    onClick={(e) => handleDeleteConversation(conv.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-red-600 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Active Chat Workspace */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950">
          {/* Header */}
          <header className="h-16 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 truncate">
              <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="truncate">
                <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  Vault-Wide Knowledge Assistant
                </h1>
                <p className="text-[11px] text-slate-500 truncate">
                  Grounded Q&A powered by Gemini 2.5 Flash & pgvector retrieval
                </p>
              </div>
            </div>

            {/* Scope Filter Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 hidden sm:inline">Scope:</span>
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="h-8 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 max-w-[180px] truncate"
              >
                <option value="">Entire Document Vault</option>
                {documentsList.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.filename}
                  </option>
                ))}
              </select>
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
                    "What are the key themes and findings across my documents?",
                    "Summarize recent financial or strategic projections.",
                    "What policy or operational guidelines are established?",
                  ].map((starter, i) => (
                    <button
                      key={i}
                      onClick={() => handleAsk(starter)}
                      className="text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors shadow-2xs"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
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
                        : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-xs shadow-xs"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5 opacity-80 text-[10px] font-semibold">
                      {msg.role === "user" ? (
                        <>
                          <User className="w-3 h-3" />
                          <span>You</span>
                        </>
                      ) : (
                        <>
                          <Bot className="w-3.5 h-3.5 text-blue-500" />
                          <span>DocuMind Assistant</span>
                        </>
                      )}
                    </div>

                    <div className="whitespace-pre-wrap leading-relaxed select-text font-sans">
                      {msg.content}
                    </div>

                    {/* Sources Citations */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                        <div className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
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
                                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-[11px] overflow-hidden"
                              >
                                <div
                                  onClick={() =>
                                    toggleSource(msg.id, src.sourceNumber)
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
                                    <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[140px]">
                                      {src.documentName}
                                    </span>
                                    <span className="text-slate-400 text-[10px]">
                                      {src.pageNumber !== null
                                        ? `Page ${src.pageNumber}`
                                        : "General Section"}
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
                                  <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-mono text-[10px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap select-text leading-relaxed">
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

            {loading && (
              <div className="flex items-start gap-2">
                <div className="rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 rounded-bl-xs shadow-xs flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                  <span>Synthesizing grounded answer with Gemini 2.5 Flash...</span>
                </div>
              </div>
            )}
          </div>

          {/* Error Banner */}
          {error && (
            <div className="max-w-4xl mx-auto w-full px-4 md:px-6">
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Input Bar & Controls */}
          <div className="p-4 md:p-6 border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
            <div className="max-w-4xl mx-auto w-full space-y-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAsk();
                }}
                className="flex gap-2"
              >
                <Input
                  placeholder={
                    selectedDocId
                      ? "Ask a question about selected document..."
                      : "Ask anything across your entire document vault..."
                  }
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  disabled={loading}
                  className="h-11 text-xs"
                />
                <Button
                  type="submit"
                  disabled={loading || !question.trim()}
                  className="h-11 px-5 gap-2 shrink-0 shadow-sm"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Ask AI</span>
                    </>
                  )}
                </Button>
              </form>

              {/* Controls Footer */}
              <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span>Top-K:</span>
                    <select
                      value={topK}
                      onChange={(e) => setTopK(Number(e.target.value))}
                      className="h-6 text-[11px] rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5"
                    >
                      <option value={3}>3</option>
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>Min Score:</span>
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.05"
                      value={threshold}
                      onChange={(e) => setThreshold(Number(e.target.value))}
                      className="w-16 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                      {Number(threshold).toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="font-mono text-[10px]">
                  Free Tier: gemini-2.5-flash • pgvector &lt;=&gt; cosine
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
