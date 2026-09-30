"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Download,
  AlertCircle,
  Clock,
  Zap,
  Layers,
  Calendar,
  Hash,
  CheckSquare,
  FileText,
  BookOpen,
  Info,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

const SUMMARY_DIMENSIONS = [
  {
    id: "executive",
    label: "Executive",
    icon: Sparkles,
    title: "Executive Summary",
    description: "High-level 150–250 word synthesis capturing the core thesis, key findings, and bottom-line conclusions.",
  },
  {
    id: "detailed",
    label: "Detailed",
    icon: BookOpen,
    title: "Detailed Summary",
    description: "In-depth, structured section-by-section breakdown covering context, terms, analysis, and implications.",
  },
  {
    id: "key_points",
    label: "Key Points",
    icon: FileText,
    title: "Key Takeaways",
    description: "Bulleted list of the top 5 to 10 critical takeaways, arguments, and policy terms.",
  },
  {
    id: "dates",
    label: "Dates",
    icon: Calendar,
    title: "Important Dates & Timeline",
    description: "Chronological catalog of deadlines, historical markers, milestones, and effective dates.",
  },
  {
    id: "numbers",
    label: "Numbers",
    icon: Hash,
    title: "Key Numbers & Metrics",
    description: "Quantitative inventory of financial figures, percentages, metrics, and data points with context.",
  },
  {
    id: "action_items",
    label: "Action Items",
    icon: CheckSquare,
    title: "Action Items & Next Steps",
    description: "Actionable checklist of tasks, obligations, deliverables, and recommendations from the text.",
  },
  {
    id: "comprehensive",
    label: "All-in-One",
    icon: Layers,
    title: "Comprehensive Briefing",
    description: "Unified briefing combining Executive Summary, Key Points, Dates, Numbers, and Action Items.",
  },
];

import {
  parseMarkdownBoldSegments,
  isMarkdownTable,
  parseTableCells,
} from "@/lib/markdown";

export { parseMarkdownBoldSegments, isMarkdownTable, parseTableCells };

/**
 * Lightweight inline markdown formatter that converts **bold text** to <strong>.
 * Preserves plain text without injecting HTML or heavy dependencies.
 */
export function renderFormattedText(text) {
  if (typeof text !== "string" || !text.includes("**")) {
    return text;
  }

  const segments = parseMarkdownBoldSegments(text);
  return segments.map((seg, idx) =>
    seg.bold ? (
      <strong
        key={`bold-${idx}`}
        className="font-semibold text-slate-900 dark:text-slate-100"
      >
        {seg.text}
      </strong>
    ) : (
      seg.text
    )
  );
}

export function SummaryTab({ documentId, document }) {
  const [activeType, setActiveType] = useState("executive");
  const [summariesMap, setSummariesMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);

  // Fetch cached summaries on load
  const loadSummaries = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/documents/${documentId}/summary?type=all`);
      const data = await res.json();

      if (res.ok && data.summaries) {
        const map = {};
        for (const s of data.summaries) {
          map[s.summaryType] = s;
        }
        setSummariesMap(map);
      }
    } catch (err) {
      console.error("Failed to load cached summaries:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (documentId) {
      loadSummaries();
    }
  }, [documentId]);

  const activeSummary = summariesMap[activeType];
  const activeDimension = SUMMARY_DIMENSIONS.find((d) => d.id === activeType) || SUMMARY_DIMENSIONS[0];

  const handleGenerate = async (isRegenerate = false) => {
    if (showRegenerateDialog) {
      setShowRegenerateDialog(false);
    }

    try {
      setGenerating(true);
      setError(null);

      const res = await fetch(`/api/documents/${documentId}/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summaryType: activeType,
          regenerate: isRegenerate,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errObj = new Error(data.error || "Failed to generate summary.");
        errObj.code = data.code;
        errObj.status = res.status;
        throw errObj;
      }

      if (data.summary) {
        setSummariesMap((prev) => ({
          ...prev,
          [activeType]: data.summary,
        }));

        // Dispatch real-time AI usage update event only on successful generation
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("documind:ai-usage-updated"));
        }
      }
    } catch (err) {
      console.error("Summarization error:", err);
      setError({
        message: err.message || "Failed to generate summary.",
        code: err.code,
        status: err.status,
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!activeSummary?.content) return;
    navigator.clipboard.writeText(activeSummary.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!activeSummary?.content) return;
    const blob = new Blob([activeSummary.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    const sanitizedFilename = (document?.filename || "document").replace(/\.[^/.]+$/, "");
    link.href = url;
    link.download = `${sanitizedFilename}-${activeType}-summary.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isDocumentCompleted = document?.processingStatus === "completed";

  return (
    <div className="space-y-6">
      {/* Dimension Pill Navigation */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
        {SUMMARY_DIMENSIONS.map((dim) => {
          const Icon = dim.icon;
          const isSelected = activeType === dim.id;
          const hasCached = Boolean(summariesMap[dim.id]);

          return (
            <button
              key={dim.id}
              onClick={() => {
                setActiveType(dim.id);
                setError(null);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs md:text-sm font-medium rounded-lg transition-all ${
                isSelected
                  ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/80 dark:border-slate-700/80"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{dim.label}</span>
              {hasCached && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"
                  title="Cached summary available"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Error Alert */}
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
            className={`flex items-start gap-3 p-4 rounded-xl border text-sm transition-all shadow-xs ${
              isAmber
                ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200"
                : "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-300"
            }`}
          >
            <AlertCircle
              className={`w-5 h-5 shrink-0 mt-0.5 ${
                isAmber
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            />
            <div className="flex-1">
              <p className="font-semibold text-sm">
                {isHighDemand
                  ? "AI Service Temporarily Busy"
                  : isRateLimit
                  ? "Rate Limit Reached"
                  : "Summarization Notice"}
              </p>
              <p
                className={`mt-0.5 text-xs md:text-sm leading-relaxed ${
                  isAmber
                    ? "text-amber-700 dark:text-amber-300"
                    : "text-red-700 dark:text-red-300"
                }`}
              >
                {errMsg}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleGenerate(false)}
              disabled={generating}
              className={`shrink-0 text-xs gap-1.5 font-medium ${
                isAmber
                  ? "border-amber-300 dark:border-amber-800 bg-amber-100/50 hover:bg-amber-100 dark:bg-amber-900/30 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-100"
                  : "border-red-300 dark:border-red-800 bg-red-100/50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/60 text-red-900 dark:text-red-100"
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </Button>
          </div>
        );
      })()}

      {/* Loading Skeleton */}
      {loading && !activeSummary && (
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="py-16 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Loading document summaries...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Generating State */}
      {generating && (
        <Card className="border-blue-200 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-950/20">
          <CardContent className="py-16 text-center space-y-3">
            <div className="relative inline-flex">
              <div className="w-12 h-12 rounded-full border-2 border-blue-500/20 border-t-blue-600 animate-spin mx-auto" />
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Synthesizing {activeDimension.title}
            </h3>
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              Analyzing document text with Gemini 3.8 Flash. Extracting grounded facts, figures, and key takeaways strictly from source content...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty State: No Summary Generated for this Dimension */}
      {!loading && !generating && !activeSummary && (
        <Card className="border-dashed border-2 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
          <CardContent className="py-16 text-center max-w-lg mx-auto space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-sm">
              <activeDimension.icon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {activeDimension.title}
              </h3>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
                {activeDimension.description}
              </p>
            </div>

            {!isDocumentCompleted ? (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg text-xs text-amber-800 dark:text-amber-300">
                This document is currently {document?.processingStatus || "pending"}. Please process the document to extract text chunks before generating summaries.
              </div>
            ) : (
              <Button
                onClick={() => handleGenerate(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate {activeDimension.label} Summary
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Active Summary View */}
      {!generating && activeSummary && (
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <activeDimension.icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {activeDimension.title}
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {activeDimension.description}
                </CardDescription>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  className="text-xs gap-1.5 shadow-xs"
                  title="Copy markdown text"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownload}
                  className="text-xs gap-1.5 shadow-xs"
                  title="Download as Markdown"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowRegenerateDialog(true)}
                  className="text-xs gap-1.5 hover:text-blue-600 dark:hover:text-blue-400 shadow-xs"
                  title="Regenerate summary with Gemini"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Regenerate</span>
                </Button>
              </div>
            </div>

            {/* Metadata Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-3 text-xs text-slate-500 dark:text-slate-400">
              <Badge variant="secondary" className="gap-1 font-normal text-[11px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                <Zap className="w-3 h-3 text-emerald-500" />
                Cached (0 new Gemini tokens)
              </Badge>

              <Badge variant="outline" className="font-normal text-[11px]">
                {activeSummary.model || "gemini-3.8-flash"}
              </Badge>

              {activeSummary.totalTokens !== null && activeSummary.totalTokens !== undefined ? (
                <Badge variant="outline" className="font-normal text-[11px]">
                  {activeSummary.totalTokens.toLocaleString()} tokens
                </Badge>
              ) : (
                <Badge variant="outline" className="font-normal text-[11px] text-slate-400">
                  Tokens unavailable
                </Badge>
              )}

              <span className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 ml-auto">
                <Clock className="w-3 h-3" />
                {new Date(activeSummary.updatedAt || activeSummary.createdAt).toLocaleString()}
              </span>
            </div>
          </CardHeader>

          {/* Formatted Markdown Content */}
          <CardContent className="pt-6">
            <div className="prose prose-slate dark:prose-invert max-w-none text-sm md:text-base leading-relaxed break-words">
              {activeSummary.content.split("\n\n").map((block, idx) => {
                const trimmed = block.trim();
                if (!trimmed) return null;

                // Markdown Tables
                if (isMarkdownTable(trimmed)) {
                  const lines = trimmed
                    .split("\n")
                    .map((l) => l.trim())
                    .filter(Boolean);
                  const sepIdx = lines.findIndex(
                    (line, i) =>
                      i > 0 &&
                      (/^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(line) ||
                        (/^[\s|:-]+$/.test(line) && line.includes("-") && line.includes("|")))
                  );

                  const headerLines = sepIdx !== -1 ? lines.slice(0, sepIdx) : [lines[0]];
                  const bodyLines = sepIdx !== -1 ? lines.slice(sepIdx + 1) : lines.slice(1);

                  return (
                    <div
                      key={idx}
                      className="my-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm"
                    >
                      <table className="w-full text-left text-xs md:text-sm border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-800">
                          {headerLines.map((hLine, hIdx) => (
                            <tr key={`th-row-${hIdx}`}>
                              {parseTableCells(hLine).map((cell, cIdx) => (
                                <th
                                  key={`th-${cIdx}`}
                                  className="px-3.5 py-2.5 font-semibold text-slate-900 dark:text-slate-100"
                                >
                                  {renderFormattedText(cell)}
                                </th>
                              ))}
                            </tr>
                          ))}
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                          {bodyLines.map((bLine, bIdx) => (
                            <tr
                              key={`tb-row-${bIdx}`}
                              className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors"
                            >
                              {parseTableCells(bLine).map((cell, cIdx) => (
                                <td key={`td-${cIdx}`} className="px-3.5 py-2">
                                  {renderFormattedText(cell)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                }

                // Headers
                if (trimmed.startsWith("### ")) {
                  return (
                    <h3 key={idx} className="text-base font-bold text-slate-900 dark:text-slate-100 mt-5 mb-2">
                      {renderFormattedText(trimmed.replace(/^###\s+/, ""))}
                    </h3>
                  );
                }
                if (trimmed.startsWith("## ")) {
                  return (
                    <h2 key={idx} className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-3 pb-1 border-b border-slate-100 dark:border-slate-800">
                      {renderFormattedText(trimmed.replace(/^##\s+/, ""))}
                    </h2>
                  );
                }
                if (trimmed.startsWith("# ")) {
                  return (
                    <h1 key={idx} className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-6 mb-3">
                      {renderFormattedText(trimmed.replace(/^#\s+/, ""))}
                    </h1>
                  );
                }

                // Bullet Lists
                if (trimmed.split("\n").some((l) => l.trim().startsWith("- ") || l.trim().startsWith("* "))) {
                  const items = trimmed.split("\n").filter((l) => l.trim().length > 0);
                  return (
                    <ul key={idx} className="space-y-1.5 my-3 list-disc pl-5 text-slate-700 dark:text-slate-300">
                      {items.map((it, itIdx) => (
                        <li key={itIdx}>
                          {renderFormattedText(it.replace(/^[-*]\s+/, ""))}
                        </li>
                      ))}
                    </ul>
                  );
                }

                // Standard Paragraph
                return (
                  <p key={idx} className="text-slate-700 dark:text-slate-300 my-3 leading-relaxed">
                    {renderFormattedText(trimmed)}
                  </p>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog for Regeneration */}
      <Dialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-blue-600" />
              Regenerate {activeDimension.title}?
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm text-slate-600 dark:text-slate-400">
              Regenerating will submit a new synthesis request to Gemini 3.8 Flash and consume free-tier quota.
              Your existing summary will only be replaced if the new generation succeeds.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button
              size="sm"
              onClick={() => handleGenerate(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Confirm & Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
