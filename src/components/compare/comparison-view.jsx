"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GitCompare,
  ArrowLeftRight,
  Sparkles,
  FileText,
  Copy,
  Check,
  Download,
  RefreshCw,
  Clock,
  Zap,
  AlertCircle,
  Calendar,
  Layers,
  ChevronDown,
  Info,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  isMarkdownTable,
  parseTableCells,
  parseMarkdownBoldSegments,
} from "@/lib/markdown";

export function ComparisonView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [documentsList, setDocumentsList] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  const [sourceId, setSourceId] = useState(searchParams.get("sourceId") || "");
  const [targetId, setTargetId] = useState(searchParams.get("targetId") || "");

  const [comparison, setComparison] = useState(null);
  const [comparisonMode, setComparisonMode] = useState(null);
  const [isCached, setIsCached] = useState(false);

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);

  const [recentComparisons, setRecentComparisons] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  // 1. Fetch available completed documents
  const loadDocuments = useCallback(async () => {
    try {
      setLoadingDocs(true);
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data = await res.json();
        const docs = data.documents || [];
        setDocumentsList(docs);

        // If no source/target in query params and we have at least 2 completed docs, set sensible defaults
        const completedDocs = docs.filter((d) => d.processingStatus === "completed");
        if (!sourceId && completedDocs.length > 0) {
          setSourceId(completedDocs[0].id);
        }
        if (!targetId && completedDocs.length > 1) {
          setTargetId(completedDocs[1].id);
        }
      }
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      setLoadingDocs(false);
    }
  }, [sourceId, targetId]);

  // 2. Fetch recent comparisons
  const loadRecentComparisons = useCallback(async () => {
    try {
      setLoadingRecent(true);
      const res = await fetch("/api/documents/compare?recent=true");
      if (res.ok) {
        const data = await res.json();
        setRecentComparisons(data.comparisons || []);
      }
    } catch (err) {
      console.error("Failed to load recent comparisons:", err);
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
    loadRecentComparisons();
  }, [loadDocuments, loadRecentComparisons]);

  // 3. Fetch existing comparison if pair is selected
  const fetchExistingComparison = useCallback(async (sId, tId) => {
    if (!sId || !tId || sId === tId) {
      setComparison(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/documents/compare?sourceId=${encodeURIComponent(
          sId
        )}&targetId=${encodeURIComponent(tId)}`
      );

      if (res.ok) {
        const data = await res.json();
        if (data.comparison) {
          setComparison(data.comparison);
          setIsCached(true);
          setComparisonMode("cached");
        } else {
          setComparison(null);
        }
      } else {
        // 404 means no comparison yet - user can generate
        setComparison(null);
      }
    } catch (err) {
      console.error("Failed to fetch comparison:", err);
      setComparison(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sourceId && targetId && sourceId !== targetId) {
      fetchExistingComparison(sourceId, targetId);
    } else {
      setComparison(null);
    }
  }, [sourceId, targetId, fetchExistingComparison]);

  // Document Lookups
  const completedDocuments = useMemo(
    () => documentsList.filter((d) => d.processingStatus === "completed"),
    [documentsList]
  );

  const sourceDoc = useMemo(
    () => documentsList.find((d) => d.id === sourceId),
    [documentsList, sourceId]
  );

  const targetDoc = useMemo(
    () => documentsList.find((d) => d.id === targetId),
    [documentsList, targetId]
  );

  // Direction swap
  const handleSwap = () => {
    const prevSource = sourceId;
    const prevTarget = targetId;
    setSourceId(prevTarget);
    setTargetId(prevSource);
    setError(null);
  };

  // Compare / Generate
  const handleCompare = async (isRegenerate = false) => {
    if (!sourceId || !targetId) {
      setError("Please select both a Base and Revised document.");
      return;
    }
    if (sourceId === targetId) {
      setError("Base and Revised documents must be distinct.");
      return;
    }

    if (showRegenerateDialog) {
      setShowRegenerateDialog(false);
    }

    try {
      setGenerating(true);
      setError(null);

      const res = await fetch("/api/documents/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceDocumentId: sourceId,
          targetDocumentId: targetId,
          regenerate: isRegenerate,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to compare documents.");
      }

      if (data.comparison) {
        setComparison(data.comparison);
        setIsCached(Boolean(data.cached));
        setComparisonMode(data.mode || (data.cached ? "cached" : "direct"));

        // Refresh recent comparisons list
        loadRecentComparisons();

        // Dispatch real-time AI usage update event only on successful generation
        if (!data.cached && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("documind:ai-usage-updated"));
        }
      }
    } catch (err) {
      console.error("Document comparison error:", err);
      setError(err.message || "Failed to compare documents.");
    } finally {
      setGenerating(false);
    }
  };

  // Copy to clipboard
  const handleCopy = () => {
    if (!comparison?.content) return;
    navigator.clipboard.writeText(comparison.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download as Markdown
  const handleDownload = () => {
    if (!comparison?.content) return;
    const blob = new Blob([comparison.content], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    const nameA = (sourceDoc?.filename || "docA").replace(/\.[^/.]+$/, "");
    const nameB = (targetDoc?.filename || "docB").replace(/\.[^/.]+$/, "");
    link.href = url;
    link.download = `${nameA}-vs-${nameB}-comparison.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Formatted bold segments helper
  const renderFormattedText = (raw) => {
    const segments = parseMarkdownBoldSegments(raw);
    return segments.map((seg, sIdx) =>
      seg.bold ? (
        <strong
          key={sIdx}
          className="font-semibold text-slate-900 dark:text-slate-100"
        >
          {seg.text}
        </strong>
      ) : (
        <span key={sIdx}>{seg.text}</span>
      )
    );
  };

  // Formatter for file size
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* 1. Document Selection Bar */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <span>Select Document Pair to Compare</span>
          </CardTitle>
          <CardDescription>
            Choose a baseline document and a revised version. DocuMind will
            extract additions, omissions, modified terms, and numerical changes.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,auto,1fr] gap-4 items-center">
            {/* Document A (Base) */}
            <div className="space-y-2 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Document A (Base / Original)
                </label>
                {sourceDoc && (
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {sourceDoc.fileType?.toUpperCase() || "PDF"}
                  </Badge>
                )}
              </div>

              <select
                value={sourceId}
                onChange={(e) => {
                  setSourceId(e.target.value);
                  setError(null);
                }}
                disabled={loadingDocs || generating}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
              >
                <option value="">-- Select Base Document --</option>
                {completedDocuments.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.filename}{!doc.isOwner ? ` (Shared by ${doc.owner?.name || doc.owner?.email || "colleague"})` : ""}
                  </option>
                ))}
              </select>

              {sourceDoc && (
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-400">
                  <span>Size: {formatFileSize(sourceDoc.fileSize)}</span>
                  <span>•</span>
                  <span>
                    Uploaded:{" "}
                    {new Date(sourceDoc.createdAt).toLocaleDateString()}
                  </span>
                  {!sourceDoc.isOwner && (
                    <>
                      <span>•</span>
                      <span className="text-purple-600 dark:text-purple-400 font-medium">
                        Shared ({sourceDoc.role === "write" ? "Editor" : "Viewer"})
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Swap Button */}
            <div className="flex justify-center py-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSwap}
                disabled={!sourceId || !targetId || generating}
                className="h-9 w-9 p-0 rounded-full border-slate-200 dark:border-slate-700 hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-950/40"
                title="Swap Document A and Document B"
              >
                <ArrowLeftRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Document B (Revised) */}
            <div className="space-y-2 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  Document B (Target / Revised)
                </label>
                {targetDoc && (
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {targetDoc.fileType?.toUpperCase() || "PDF"}
                  </Badge>
                )}
              </div>

              <select
                value={targetId}
                onChange={(e) => {
                  setTargetId(e.target.value);
                  setError(null);
                }}
                disabled={loadingDocs || generating}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
              >
                <option value="">-- Select Revised Document --</option>
                {completedDocuments.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.filename} {doc.id === sourceId ? "(Selected as Base)" : !doc.isOwner ? `(Shared by ${doc.owner?.name || doc.owner?.email || "colleague"})` : ""}
                  </option>
                ))}
              </select>

              {targetDoc && (
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-400">
                  <span>Size: {formatFileSize(targetDoc.fileSize)}</span>
                  <span>•</span>
                  <span>
                    Uploaded:{" "}
                    {new Date(targetDoc.createdAt).toLocaleDateString()}
                  </span>
                  {!targetDoc.isOwner && (
                    <>
                      <span>•</span>
                      <span className="text-purple-600 dark:text-purple-400 font-medium">
                        Shared ({targetDoc.role === "write" ? "Editor" : "Viewer"})
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <Button
                onClick={() => handleCompare(false)}
                disabled={
                  !sourceId ||
                  !targetId ||
                  sourceId === targetId ||
                  generating ||
                  loading
                }
                className="bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs md:text-sm gap-2 shadow-sm shadow-purple-500/20"
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Analyzing Documents with Gemini...</span>
                  </>
                ) : (
                  <>
                    <GitCompare className="w-4 h-4" />
                    <span>
                      {comparison ? "View / Re-analyze" : "Compare Documents"}
                    </span>
                  </>
                )}
              </Button>

              {comparison && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRegenerateDialog(true)}
                  disabled={generating}
                  className="text-xs gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Regenerate Analysis</span>
                </Button>
              )}
            </div>

            {sourceId && targetId && sourceId === targetId && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Please select two different documents to compare.
              </p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Recent Comparisons Quick-Picks */}
      {recentComparisons.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Recent Comparisons
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {recentComparisons.map((item) => {
              const isCurrent =
                item.sourceDocumentId === sourceId &&
                item.targetDocumentId === targetId;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setSourceId(item.sourceDocumentId);
                    setTargetId(item.targetDocumentId);
                    setError(null);
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    isCurrent
                      ? "bg-purple-50 dark:bg-purple-950/50 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 shadow-sm"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <span className="truncate max-w-[120px] font-semibold">
                    {item.sourceFilename}
                  </span>
                  <span className="text-slate-400">→</span>
                  <span className="truncate max-w-[120px] font-semibold">
                    {item.targetFilename}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Loading State */}
      {generating && (
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="py-12 text-center space-y-4">
            <div className="relative mx-auto w-12 h-12 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-purple-200 dark:border-purple-900 border-t-purple-600 animate-spin" />
              <GitCompare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Running Grounded Comparative Analysis...
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Comparing document sections, aligning semantic vectors, and
                categorizing additions, omissions, altered terms, and numerical
                revisions with Gemini 3.8 Flash.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. Comparison Results Display */}
      {comparison && !generating && (
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base md:text-lg flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>
                    Comparative Report: {sourceDoc?.filename || "Base"} vs{" "}
                    {targetDoc?.filename || "Revised"}
                  </span>
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Authoritative differences and alignment across six structured
                  analysis dimensions.
                </CardDescription>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 self-start md:self-auto shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  className="h-8 text-xs gap-1.5"
                  title="Copy comparison to clipboard"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Copied!</span>
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
                  className="h-8 text-xs gap-1.5"
                  title="Download as Markdown"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowRegenerateDialog(true)}
                  className="h-8 text-xs gap-1.5 hover:text-purple-600 dark:hover:text-purple-400"
                  title="Regenerate comparison with Gemini"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Regenerate</span>
                </Button>
              </div>
            </div>

            {/* Metadata Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-3 text-xs text-slate-500 dark:text-slate-400">
              <Badge
                variant="secondary"
                className="gap-1 font-normal text-[11px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
              >
                <Zap className="w-3 h-3 text-emerald-500" />
                {isCached ? "Cached (0 new Gemini tokens)" : "Freshly Generated"}
              </Badge>

              <Badge variant="outline" className="font-normal text-[11px]">
                {comparison.model || "gemini-3.8-flash"}
              </Badge>

              {comparison.totalTokens !== null &&
              comparison.totalTokens !== undefined ? (
                <Badge variant="outline" className="font-normal text-[11px]">
                  {comparison.totalTokens.toLocaleString()} tokens
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="font-normal text-[11px] text-slate-400"
                >
                  Tokens unavailable
                </Badge>
              )}

              <span className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 ml-auto">
                <Clock className="w-3 h-3" />
                {new Date(
                  comparison.updatedAt || comparison.createdAt
                ).toLocaleString()}
              </span>
            </div>
          </CardHeader>

          {/* Formatted Markdown Content */}
          <CardContent className="pt-6">
            <div className="prose prose-slate dark:prose-invert max-w-none text-sm md:text-base leading-relaxed break-words">
              {comparison.content.split("\n\n").map((block, idx) => {
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
                        (/^[\s|:-]+$/.test(line) &&
                          line.includes("-") &&
                          line.includes("|")))
                  );

                  const headerLines =
                    sepIdx !== -1 ? lines.slice(0, sepIdx) : [lines[0]];
                  const bodyLines =
                    sepIdx !== -1 ? lines.slice(sepIdx + 1) : lines.slice(1);

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
                    <h3
                      key={idx}
                      className="text-base font-bold text-slate-900 dark:text-slate-100 mt-5 mb-2"
                    >
                      {renderFormattedText(trimmed.replace(/^###\s+/, ""))}
                    </h3>
                  );
                }
                if (trimmed.startsWith("## ")) {
                  return (
                    <h2
                      key={idx}
                      className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-3 pb-1 border-b border-slate-100 dark:border-slate-800"
                    >
                      {renderFormattedText(trimmed.replace(/^##\s+/, ""))}
                    </h2>
                  );
                }
                if (trimmed.startsWith("# ")) {
                  return (
                    <h1
                      key={idx}
                      className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-6 mb-3"
                    >
                      {renderFormattedText(trimmed.replace(/^#\s+/, ""))}
                    </h1>
                  );
                }

                // Bullet Lists
                if (
                  trimmed
                    .split("\n")
                    .some(
                      (l) => l.trim().startsWith("- ") || l.trim().startsWith("* ")
                    )
                ) {
                  const items = trimmed
                    .split("\n")
                    .filter((l) => l.trim().length > 0);
                  return (
                    <ul
                      key={idx}
                      className="space-y-1.5 my-3 list-disc pl-5 text-slate-700 dark:text-slate-300"
                    >
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
                  <p
                    key={idx}
                    className="text-slate-700 dark:text-slate-300 my-3 leading-relaxed"
                  >
                    {renderFormattedText(trimmed)}
                  </p>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. Empty State when no pair selected or no comparison generated yet */}
      {!comparison && !generating && (
        <Card className="border-dashed border-2 border-slate-200 dark:border-slate-800 bg-transparent">
          <CardContent className="py-12 text-center space-y-3">
            <GitCompare className="w-12 h-12 text-purple-400 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {sourceId && targetId && sourceId !== targetId
                ? "No Comparison Report Cached for This Pair"
                : "Select Two Documents to Begin Comparison"}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {sourceId && targetId && sourceId !== targetId
                ? "Click 'Compare Documents' above to run grounded comparative analysis using Gemini 3.8 Flash."
                : "Choose a Base and Revised document to uncover additions, deletions, term alterations, and numerical differences."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* 6. Safe Regeneration Confirmation Dialog */}
      <Dialog
        open={showRegenerateDialog}
        onOpenChange={setShowRegenerateDialog}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-purple-600" />
              <span>Regenerate Document Comparison?</span>
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <span>
                This will invoke Gemini 3.8 Flash again to perform fresh
                comparative analysis between{" "}
                <strong>{sourceDoc?.filename || "Base"}</strong> and{" "}
                <strong>{targetDoc?.filename || "Revised"}</strong>.
              </span>
              <span className="block text-xs text-slate-500">
                DocuMind uses safe regeneration: if the AI request fails, your
                existing comparison will remain preserved in the database.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRegenerateDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => handleCompare(true)}
            >
              Confirm & Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
