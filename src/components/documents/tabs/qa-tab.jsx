"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChatMessageContent } from "@/components/chat/chat-message-content";
import {
  Bot,
  User,
  Loader2,
  FileText,
  AlertCircle,
  RefreshCw,
  Send,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export function QaTab({ documentId, filename }) {
  const [qaQuestion, setQaQuestion] = useState("");
  const [lastQaQuestion, setLastQaQuestion] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const [qaError, setQaError] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [messagesList, setMessagesList] = useState([]);
  const [expandedSources, setExpandedSources] = useState({});
  const [qaTopK, setQaTopK] = useState(5);
  const [qaThreshold, setQaThreshold] = useState(0.5);

  useEffect(() => {
    async function fetchConversation() {
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
    }
    fetchConversation();
  }, [documentId]);

  const handleAskQuestion = async (overrideQuestion) => {
    const q = (typeof overrideQuestion === "string" ? overrideQuestion : qaQuestion).trim();
    if (!q || qaLoading) return;

    setLastQaQuestion(q);
    setQaQuestion("");
    setQaError(null);

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
        const errObj = new Error(data.error || "Failed to generate answer.");
        errObj.code = data.code;
        errObj.status = res.status;
        throw errObj;
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
      setMessagesList((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      setQaError({
        message: err.message || "Failed to generate answer.",
        code: err.code,
        status: err.status,
      });
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

  const handleSourcePillClick = (msgId, srcNum) => {
    const key = `${msgId}-${srcNum}`;
    setExpandedSources((prev) => ({
      ...prev,
      [key]: true,
    }));
    setTimeout(() => {
      const el = document.getElementById(`doc-source-${msgId}-${srcNum}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, 50);
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

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="p-3 rounded-xl bg-theme-panel border border-theme-divider flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-theme-aiAccent" />
          <span className="font-semibold text-theme-text">
            Grounded Document Intelligence
          </span>
          <Badge variant="outline" className="text-[10px] font-mono">
            gemini-3.8-flash
          </Badge>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-theme-muted">Top-K Chunks:</span>
            <select
              value={qaTopK}
              onChange={(e) => setQaTopK(Number(e.target.value))}
              className="h-7 text-xs rounded-md border border-theme-divider bg-theme-panel text-theme-text px-2 py-0.5"
            >
              <option value={3}>3</option>
              <option value={5}>5 (default)</option>
              <option value={10}>10</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-theme-muted">Min Score:</span>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={qaThreshold}
              onChange={(e) => setQaThreshold(Number(e.target.value))}
              className="w-16 h-1.5 bg-theme-divider rounded-lg appearance-none cursor-pointer accent-theme-primary"
            />
            <span className="font-mono text-[11px] font-semibold text-theme-text">
              {Number(qaThreshold).toFixed(2)}
            </span>
          </div>

          {messagesList.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearChat}
              className="h-7 text-xs text-theme-muted hover:text-red-600"
            >
              Clear Chat
            </Button>
          )}
        </div>
      </div>

      {/* Messages Thread Container */}
      <div className="min-h-[380px] max-h-[520px] overflow-y-auto space-y-4 p-4 rounded-xl border border-theme-divider bg-theme-body/50">
        {messagesList.length === 0 ? (
          <div className="py-12 text-center space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-theme-ai/10 text-theme-aiAccent flex items-center justify-center mx-auto">
              <Bot className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-theme-text">
                Ask anything about {filename}
              </h4>
              <p className="text-xs text-theme-muted max-w-sm mx-auto">
                Answers are strictly synthesized from retrieved document chunks with verifiable source citations.
              </p>
            </div>

            <div className="pt-2 flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
              {[
                "What is the primary summary of this document?",
                "What are the key conclusions or findings?",
                "List important figures, metrics, or dates mentioned.",
              ].map((suggestedQ, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAskQuestion(suggestedQ)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-theme-panel border border-theme-divider hover:border-theme-ai text-theme-text hover:text-theme-aiAccent transition-colors shadow-2xs text-left"
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
                    ? "bg-theme-panel border border-theme-divider text-theme-text rounded-br-xs shadow-xs"
                    : "bg-theme-ai/10 border border-theme-ai/20 text-theme-text rounded-bl-xs shadow-xs"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5 opacity-80 text-[10px] font-semibold">
                  {msg.role === "user" ? (
                    <>
                      <User className="w-3 h-3 text-theme-muted" />
                      <span className="text-theme-muted">You</span>
                    </>
                  ) : (
                    <>
                      <Bot className="w-3.5 h-3.5 text-theme-aiAccent" />
                      <span className="text-theme-aiAccent">DocuMind AI</span>
                    </>
                  )}
                </div>

                <ChatMessageContent
                  content={msg.content}
                  isUser={msg.role === "user"}
                  onSourceClick={(srcNum) =>
                    handleSourcePillClick(msg.id, srcNum)
                  }
                />

                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-theme-divider space-y-2">
                    <div className="text-[10px] font-semibold text-theme-muted flex items-center gap-1.5">
                      <FileText className="w-3 h-3 text-theme-aiAccent" />
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
                            id={`doc-source-${msg.id}-${src.sourceNumber}`}
                            className="rounded-lg border border-theme-divider bg-theme-body text-[11px] overflow-hidden"
                          >
                            <div
                              onClick={() =>
                                toggleSourceExpanded(msg.id, src.sourceNumber)
                              }
                              className="p-2 flex items-center justify-between cursor-pointer hover:bg-theme-panel transition-colors"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <Badge
                                  variant="ai"
                                  className="text-[10px] py-0 px-1.5 font-mono"
                                >
                                  SOURCE {src.sourceNumber}
                                </Badge>
                                <span className="font-medium text-theme-text">
                                  {src.pageNumber !== null
                                    ? `Page ${src.pageNumber}`
                                    : "General Section"}
                                </span>
                                <span className="text-theme-muted text-[10px]">
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
                                  <ChevronUp className="w-3 h-3 text-theme-muted" />
                                ) : (
                                  <ChevronDown className="w-3 h-3 text-theme-muted" />
                                )}
                              </div>
                            </div>
                            {isExp && (
                              <div className="p-3 border-t border-theme-divider bg-theme-panel font-mono text-[10px] text-theme-muted whitespace-pre-wrap select-text leading-relaxed">
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
            <div className="rounded-2xl p-4 bg-theme-panel border border-theme-divider text-xs text-theme-muted rounded-bl-xs shadow-xs flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-theme-aiAccent animate-spin" />
              <span>Synthesizing grounded answer with Gemini 3.8 Flash...</span>
            </div>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {qaError && (() => {
        const errMsg = typeof qaError === "string" ? qaError : qaError.message;
        const errCode = qaError?.code;
        const isHighDemand =
          errCode === "UPSTREAM_HIGH_DEMAND" ||
          qaError?.status === 503 ||
          errMsg?.toLowerCase().includes("high traffic") ||
          errMsg?.toLowerCase().includes("high demand") ||
          errMsg?.toLowerCase().includes("unavailable");
        const isRateLimit =
          errCode === "UPSTREAM_RATE_LIMITED" ||
          qaError?.status === 429 ||
          errMsg?.toLowerCase().includes("rate limit");

        const isAmber = isHighDemand || isRateLimit;

        return (
          <div
            className={`p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs ${
              isAmber
                ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200"
                : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300"
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
                    : "Query Failed"}
                </p>
                <p className="mt-0.5 opacity-90 leading-relaxed">{errMsg}</p>
              </div>
            </div>

            {lastQaQuestion && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAskQuestion(lastQaQuestion)}
                disabled={qaLoading}
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

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAskQuestion();
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Input
            placeholder={`Ask a question about ${filename || "this document"}...`}
            value={qaQuestion}
            onChange={(e) => setQaQuestion(e.target.value)}
            disabled={qaLoading}
            required
            maxLength={2000}
            className="h-10 text-xs pl-3 pr-10"
          />
        </div>
        <Button
          type="submit"
          variant="ai"
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
  );
}
