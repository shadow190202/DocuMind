"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  MessageSquare,
  FileText,
  HardDrive,
  Clock,
  ArrowRight,
  Edit3,
  Trash2,
  Download,
  ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function formatRelativeTime(dateString) {
  if (!dateString) return "";
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 30) return `${diffDay}d ago`;

  return new Date(dateString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ConversationCard({ conversation, onRename, onDelete }) {
  const [showExportMenu, setShowExportMenu] = useState(false);

  const scopeLabel = conversation.documentName || "Entire Document Vault";
  const isVaultWide = !conversation.documentId;
  const relativeTime = formatRelativeTime(conversation.updatedAt);

  const handleExport = (format) => {
    setShowExportMenu(false);
    // Direct browser download from server-authorized endpoint
    const url = `/api/conversations/${conversation.id}/export?format=${format}`;
    window.location.href = url;
  };

  return (
    <div className="group relative bg-theme-panel border border-theme-divider rounded-xl p-5 hover:border-theme-divider hover:shadow-xs transition-all flex flex-col justify-between">
      <div className="space-y-3">
        {/* Top Badges & Meta */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={isVaultWide ? "default" : "secondary"}
              className="text-[11px] font-medium flex items-center gap-1 max-w-[200px] truncate"
            >
              {isVaultWide ? (
                <HardDrive className="w-3 h-3 shrink-0" />
              ) : (
                <FileText className="w-3 h-3 shrink-0" />
              )}
              <span className="truncate">{scopeLabel}</span>
            </Badge>

            <span className="text-[11px] text-theme-muted flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {relativeTime}
            </span>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onRename(conversation)}
              title="Rename conversation"
              aria-label="Rename conversation"
              className="p-1.5 rounded-lg text-theme-muted hover:text-theme-text hover:bg-theme-body transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>

            {/* Export Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                title="Export transcript"
                aria-label="Export transcript"
                className="p-1.5 rounded-lg text-theme-muted hover:text-theme-text hover:bg-theme-body transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-theme-panel border border-theme-divider rounded-lg shadow-lg py-1 z-20 text-xs animate-in fade-in duration-100">
                  <button
                    onClick={() => handleExport("markdown")}
                    className="w-full text-left px-3 py-2 text-theme-text hover:bg-theme-body flex items-center gap-2"
                  >
                    <span>Markdown (.md)</span>
                  </button>
                  <button
                    onClick={() => handleExport("json")}
                    className="w-full text-left px-3 py-2 text-theme-text hover:bg-theme-body flex items-center gap-2"
                  >
                    <span>JSON (.json)</span>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => onDelete(conversation)}
              title="Delete conversation"
              aria-label="Delete conversation"
              className="p-1.5 rounded-lg text-theme-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-theme-text text-sm leading-snug line-clamp-2">
          {conversation.title}
        </h3>

        {/* Latest message preview snippet */}
        {conversation.lastMessageSnippet ? (
          <p className="text-xs text-theme-muted line-clamp-2 italic">
            &ldquo;{conversation.lastMessageSnippet}&rdquo;
          </p>
        ) : (
          <p className="text-xs text-theme-muted italic">No messages yet</p>
        )}
      </div>

      {/* Card Footer */}
      <div className="mt-4 pt-3 border-t border-theme-divider flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-theme-muted">
          <span className="flex items-center gap-1 font-medium">
            <MessageSquare className="w-3 h-3 text-theme-muted" />
            {conversation.messageCount}{" "}
            {conversation.messageCount === 1 ? "msg" : "msgs"}
          </span>
          <span>•</span>
          <span>
            {conversation.questionCount}{" "}
            {conversation.questionCount === 1 ? "question" : "questions"}
          </span>
        </div>

        <Button size="sm" variant="ghost" className="gap-1.5 text-xs font-medium" asChild>
          <Link href={`/chat?id=${conversation.id}`}>
            Resume
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
