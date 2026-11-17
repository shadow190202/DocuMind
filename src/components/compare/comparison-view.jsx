"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GitCompare,
  ArrowLeftRight,
  SlidersHorizontal,
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
  Loader2,
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
          className="font-semibold text-theme-text"
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
      <Card className="border-theme-divider bg-theme-panel/70 backdrop-blur-sm shadow-xs">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2 font-medium">
            <GitCompare className="w-4 h-4 text-theme-muted" strokeWidth={1.5} />
            <span>Select document pair to compare</span>
          </CardTitle>
          <CardDescription className="text-xs text-theme-muted">
            Choose a baseline document and a revised version to extract additions, omissions, modified terms, and numerical changes.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,auto,1fr] gap-4 items-center">
            {/* Document A (Base) */}
            <div className="space-y-2 p-3.5 rounded-lg border border-theme-divider bg-theme-body/50">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-theme-muted flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-theme-muted" />
                  Document A (baseline)
                </label>
                {sourceDoc && (
                  <Badge variant="outline" className="text-xs font-normal">
                    {sourceDoc.fileType?.toLowerCase()}
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
                className="w-full px-3 py-2 text-xs bg-theme-panel border border-theme-divider rounded-lg text-theme-text focus:outline-none focus:ring-1 focus:ring-theme-primary font-normal"
              >
                <option value="">-- Select base document --</option>
                {completedDocuments.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.filename}{!doc.isOwner ? ` (Shared by ${doc.owner?.name || doc.owner?.email || "colleague"})` : ""}
                  </option>
                ))}
              </select>

              {sourceDoc && (
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-theme-muted tabular-nums">
                  <span>Size: {formatFileSize(sourceDoc.fileSize)}</span>
                  <span>•</span>
                  <span>
                    Uploaded:{" "}
                    {new Date(sourceDoc.createdAt).toLocaleDateString()}
                  </span>
                  {!sourceDoc.isOwner && (
                    <>
                      <span>•</span>
                      <span className="text-theme-muted font-medium">
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
                className="h-8 w-8 p-0 rounded-md border-theme-divider hover:bg-theme-body hover:text-theme-text"
                title="Swap Document A and Document B"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" strokeWidth={1.5} />
              </Button>
            </div>

            {/* Document B (Revised) */}
            <div className="space-y-2 p-3.5 rounded-lg border border-theme-divider bg-theme-body/50">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-theme-muted flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-theme-primary" />
                  Document B (revised)
                </label>
                {targetDoc && (
                  <Badge variant="outline" className="text-xs font-normal">
                    {targetDoc.fileType?.toLowerCase()}
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
                className="w-full px-3 py-2 text-xs bg-theme-panel border border-theme-divider rounded-lg text-theme-text focus:outline-none focus:ring-1 focus:ring-theme-primary font-normal"
              >
                <option value="">-- Select revised document --</option>
                {completedDocuments.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.filename} {doc.id === sourceId ? "(Selected as base)" : !doc.isOwner ? `(Shared by ${doc.owner?.name || doc.owner?.email || "colleague"})` : ""}
                  </option>
                ))}
              </select>

              {targetDoc && (
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-theme-muted tabular-nums">
                  <span>Size: {formatFileSize(targetDoc.fileSize)}</span>
                  <span>•</span>
                  <span>
                    Uploaded:{" "}
                    {new Date(targetDoc.createdAt).toLocaleDateString()}
                  </span>
                  {!targetDoc.isOwner && (
                    <>
                      <span>•</span>
                      <span className="text-theme-muted font-medium">
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
                variant="ai"
                onClick={() => handleCompare(false)}
                disabled={
                  !sourceId ||
                  !targetId ||
                  sourceId === targetId ||
                  generating ||
                  loading
                }
                className="font-medium text-xs gap-2"
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                    <span>Analyzing documents...</span>
                  </>
                ) : (
                  <>
                    <GitCompare className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span>
                      {comparison ? "View / re-analyze" : "Compare documents"}
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
                  <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Regenerate</span>
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
              <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Recent Comparisons Quick-Picks */}
      {recentComparisons.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-theme-muted">
            Recent comparisons
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
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    isCurrent
                      ? "bg-theme-panel border-theme-primary text-theme-primary"
                      : "bg-theme-panel border-theme-divider text-theme-muted hover:bg-theme-body hover:text-theme-text"
                  }`}
                >
                  <span className="truncate max-w-[140px] font-medium">
                    {item.sourceFilename}
                  </span>
                  <span className="text-theme-muted">→</span>
                  <span className="truncate max-w-[140px] font-medium">
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
        <Card className="border-theme-divider">
          <CardContent className="py-12 text-center space-y-3">
            <Loader2 className="w-6 h-6 text-theme-muted animate-spin mx-auto" strokeWidth={1.5} />
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-theme-text">
                Running comparative analysis...
              </h3>
              <p className="text-xs text-theme-muted max-w-md mx-auto leading-relaxed">
                Comparing document sections, aligning semantic vectors, and
                categorizing additions, omissions, altered terms, and numerical
                revisions.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. Comparison Results Display */}
      {comparison && !generating && (
        <Card className="border-theme-divider bg-theme-panel shadow-sm">
          <CardHeader className="border-b border-theme-divider pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base md:text-lg flex items-center gap-2 text-theme-text">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>
                    Comparative Report: {sourceDoc?.filename || "Base"} vs{" "}
                    {targetDoc?.filename || "Revised"}
                  </span>
                </CardTitle>
                <CardDescription className="text-xs text-theme-muted mt-1">
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
                  className="text-xs gap-1.5 shadow-xs"
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
                  className="text-xs gap-1.5 hover:text-theme-text"
                  title="Regenerate comparison with Gemini"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Regenerate</span>
                </Button>
              </div>
            </div>

            {/* Metadata Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-3 text-xs text-theme-muted">
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
                  className="font-normal text-[11px] text-theme-muted"
                >
                  Tokens unavailable
                </Badge>
              )}

              <span className="flex items-center gap-1 text-[11px] text-theme-muted ml-auto">
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
                      className="my-4 overflow-x-auto rounded-lg border border-theme-divider shadow-xs"
                    >
                      <table className="w-full text-left text-xs md:text-sm border-collapse">
                        <thead className="bg-theme-body text-theme-text font-semibold border-b border-theme-divider">
                          {headerLines.map((hLine, hIdx) => (
                            <tr key={`th-row-${hIdx}`}>
                              {parseTableCells(hLine).map((cell, cIdx) => (
                                <th
                                  key={`th-${cIdx}`}
                                  className="px-3.5 py-2.5 font-semibold text-theme-text"
                                >
                                  {renderFormattedText(cell)}
                                </th>
                              ))}
                            </tr>
                          ))}
                        </thead>
                        <tbody className="divide-y divide-theme-divider text-theme-text">
                          {bodyLines.map((bLine, bIdx) => (
                            <tr
                              key={`tb-row-${bIdx}`}
                              className="hover:bg-theme-body/50 transition-colors"
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
                      className="text-base font-bold text-theme-text mt-5 mb-2"
                    >
                      {renderFormattedText(trimmed.replace(/^###\s+/, ""))}
                    </h3>
                  );
                }
                if (trimmed.startsWith("## ")) {
                  return (
                    <h2
                      key={idx}
                      className="text-lg font-bold text-theme-text mt-6 mb-3 pb-1 border-b border-theme-divider"
                    >
                      {renderFormattedText(trimmed.replace(/^##\s+/, ""))}
                    </h2>
                  );
                }
                if (trimmed.startsWith("# ")) {
                  return (
                    <h1
                      key={idx}
                      className="text-xl font-bold text-theme-text mt-6 mb-3"
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
                      className="space-y-1.5 my-3 list-disc pl-5 text-theme-text"
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
                    className="text-theme-text my-3 leading-relaxed"
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
        <Card className="border border-dashed border-theme-divider bg-transparent">
          <CardContent className="py-12 text-center space-y-2">
            <GitCompare className="w-8 h-8 text-theme-muted mx-auto" strokeWidth={1.5} />
            <h3 className="text-sm font-medium text-theme-text">
              {sourceId && targetId && sourceId !== targetId
                ? "No cached report for this pair"
                : "Select two documents to compare"}
            </h3>
            <p className="text-xs text-theme-muted max-w-sm mx-auto leading-relaxed">
              {sourceId && targetId && sourceId !== targetId
                ? "Click 'Compare documents' above to run grounded comparative analysis."
                : "Choose a baseline and a revised document to identify additions, omissions, and discrepancies."}
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
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <RefreshCw className="w-4 h-4 text-theme-muted" strokeWidth={1.5} />
              <span>Regenerate document comparison?</span>
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2 text-xs">
              <span>
                This will analyze the pair again to update comparative findings between{" "}
                <strong>{sourceDoc?.filename || "baseline"}</strong> and{" "}
                <strong>{targetDoc?.filename || "revised"}</strong>.
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
              variant="ai"
              size="sm"
              onClick={() => handleCompare(true)}
            >
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
