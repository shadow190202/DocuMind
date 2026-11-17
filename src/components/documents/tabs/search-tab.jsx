"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, AlertCircle, FileText, Check, Copy } from "lucide-react";

export function SearchTab({ documentId }) {
  const [searchQueryText, setSearchQueryText] = useState("");
  const [topK, setTopK] = useState(5);
  const [threshold, setThreshold] = useState(0.5);
  const [includeContext, setIncludeContext] = useState(true);
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [copiedContext, setCopiedContext] = useState(false);

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

  return (
    <div className="space-y-6">
      {/* Search Input and Configuration Controls */}
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-theme-muted" />
            <Input
              placeholder="Search document semantically (e.g. 'quarterly revenue', 'security requirements')..."
              value={searchQueryText}
              onChange={(e) => setSearchQueryText(e.target.value)}
              className="pl-9 h-10 text-sm"
            />
          </div>
          <Button
            type="submit"
            variant="ai"
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
        <div className="p-3 rounded-xl bg-theme-body border border-theme-divider flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="font-medium text-theme-muted">
                Top-K Chunks:
              </span>
              <select
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                className="h-7 text-xs rounded-md border border-theme-divider bg-theme-panel text-theme-text px-2 py-0.5"
              >
                <option value={3}>3 chunks</option>
                <option value={5}>5 chunks (default)</option>
                <option value={10}>10 chunks</option>
                <option value={20}>20 chunks (max)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-medium text-theme-muted">
                Min Similarity Threshold:
              </span>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-24 h-1.5 bg-theme-divider rounded-lg appearance-none cursor-pointer accent-theme-ai"
              />
              <span className="font-mono text-[11px] font-semibold text-theme-text w-8">
                {Number(threshold).toFixed(2)}
              </span>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeContext}
                onChange={(e) => setIncludeContext(e.target.checked)}
                className="rounded border-theme-divider text-theme-ai focus:ring-theme-ai w-3.5 h-3.5"
              />
              <span className="text-theme-text font-medium">
                Assemble RAG Context Block
              </span>
            </label>
          </div>

          <div className="text-[11px] text-theme-muted font-mono">
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
          <div className="flex items-center justify-between text-xs border-b border-theme-divider pb-2">
            <span className="font-medium text-theme-text">
              Retrieved {searchResults.count} chunk{searchResults.count === 1 ? "" : "s"} for query &quot;{searchResults.query}&quot;
            </span>
            <Badge variant="outline" className="text-[10px]">
              Threshold: &gt;= {searchResults.threshold}
            </Badge>
          </div>

          {searchResults.count === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-theme-divider rounded-2xl space-y-2">
              <p className="text-sm font-medium text-theme-text">
                No matching chunks found
              </p>
              <p className="text-xs text-theme-muted max-w-md mx-auto">
                No chunks met the minimum similarity score of {searchResults.threshold}. Try lowering the similarity threshold or using different keywords.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {searchResults.results.map((chunk, idx) => (
                <div
                  key={chunk.chunkId}
                  className="rounded-xl border border-theme-divider bg-theme-panel overflow-hidden shadow-xs hover:border-theme-ai/50 transition-colors"
                >
                  <div className="bg-theme-body px-4 py-2.5 border-b border-theme-divider flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-theme-text">
                        Rank #{idx + 1} • Chunk #{chunk.chunkIndex + 1}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {chunk.pageNumber !== null ? `Page ${chunk.pageNumber}` : "General Section"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="ai"
                        className="text-[11px] font-mono py-0.5 px-2"
                      >
                        {(chunk.similarityScore * 100).toFixed(1)}% Match
                      </Badge>
                      <span className="text-[11px] text-theme-muted">
                        ~{chunk.estimatedTokenCount} tokens (est.)
                      </span>
                    </div>
                  </div>
                  <div className="p-4 text-xs font-mono text-theme-text whitespace-pre-wrap leading-relaxed select-text">
                    {chunk.content}
                  </div>
                </div>
              ))}
            </div>
          )}

          {searchResults.context && (
            <div className="mt-8 rounded-xl border border-theme-divider bg-theme-panel text-theme-text overflow-hidden shadow-sm">
              <div className="bg-theme-body px-4 py-3 border-b border-theme-divider flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-theme-aiAccent" />
                  <span className="text-xs font-semibold text-theme-text">
                    Assembled RAG Prompt Context (LLM-Ready)
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-theme-muted">
                    Budget: ~{searchResults.context.totalEstimatedTokens} tokens (est.)
                  </span>
                  <span className="text-theme-muted">
                    Used: {searchResults.context.chunksUsed} chunks
                  </span>
                  {searchResults.context.chunksOmitted > 0 && (
                    <span className="text-amber-500 font-medium">
                      Omitted: {searchResults.context.chunksOmitted} (budget limit)
                    </span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyContext}
                    className="h-7 text-xs border-theme-divider bg-theme-panel text-theme-text hover:bg-theme-body gap-1.5"
                  >
                    {copiedContext ? (
                      <>
                        <Check className="w-3 h-3 text-green-500" />
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
              <div className="p-4 text-xs font-mono text-theme-text max-h-80 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text">
                {searchResults.context.contextText || (
                  <span className="text-theme-muted italic">No context generated.</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
