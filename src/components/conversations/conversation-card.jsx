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
    <div className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all flex flex-col justify-between">
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

            <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {relativeTime}
            </span>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onRename(conversation)}
              title="Rename conversation"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>

            {/* Export Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                title="Export transcript"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg py-1 z-20 text-xs animate-in fade-in duration-100">
                  <button
                    onClick={() => handleExport("markdown")}
                    className="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                  >
                    <span>Markdown (.md)</span>
                  </button>
                  <button
                    onClick={() => handleExport("json")}
                    className="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                  >
                    <span>JSON (.json)</span>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => onDelete(conversation)}
              title="Delete conversation"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-snug line-clamp-2">
          {conversation.title}
        </h3>

        {/* Latest message preview snippet */}
        {conversation.lastMessageSnippet ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 italic">
            &ldquo;{conversation.lastMessageSnippet}&rdquo;
          </p>
        ) : (
          <p className="text-xs text-slate-400 italic">No messages yet</p>
        )}
      </div>

      {/* Card Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="flex items-center gap-1 font-medium">
            <MessageSquare className="w-3 h-3 text-slate-400" />
            {conversation.messageCount}{" "}
            {conversation.messageCount === 1 ? "msg" : "msgs"}
          </span>
          <span>•</span>
          <span>
            {conversation.questionCount}{" "}
            {conversation.questionCount === 1 ? "question" : "questions"}
          </span>
        </div>

        <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" asChild>
          <Link href={`/chat?id=${conversation.id}`}>
            Resume
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
