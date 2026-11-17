"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

export function ChunksTab({ chunksData }) {
  if (!chunksData?.chunks || chunksData.chunks.length === 0) {
    return (
      <div className="p-12 text-center border-2 border-dashed border-theme-divider rounded-2xl space-y-3">
        <p className="text-xs text-theme-muted">
          No vector chunks available. Click &quot;Re-extract Text&quot; or &quot;Process Document&quot; to generate chunks and 768-dim embeddings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
      {chunksData.chunks.map((chunk) => (
        <div
          key={chunk.id}
          className="rounded-xl border border-theme-divider bg-theme-panel overflow-hidden shadow-xs"
        >
          <div className="bg-theme-body px-4 py-2.5 border-b border-theme-divider flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-theme-text">
                Chunk #{chunk.chunkIndex + 1}
              </span>
              <Badge variant="outline" className="text-[10px]">
                {chunk.pageNumber !== null ? `Page ${chunk.pageNumber}` : "Document Content"}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-theme-muted">
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
          <div className="p-4 text-xs font-mono text-theme-text whitespace-pre-wrap leading-relaxed select-text">
            {chunk.content}
          </div>
        </div>
      ))}
    </div>
  );
}
