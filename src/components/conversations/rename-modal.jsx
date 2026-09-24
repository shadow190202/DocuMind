"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Edit3, X } from "lucide-react";

export function RenameModal({ isOpen, onClose, conversation, onSuccess }) {
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (conversation) {
      setTitle(conversation.title || "");
      setError(null);
    }
  }, [conversation]);

  if (!isOpen || !conversation) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Title cannot be empty.");
      return;
    }
    if (trimmed.length > 100) {
      setError("Title cannot exceed 100 characters.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/conversations/${conversation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update conversation title.");
      }

      if (onSuccess) {
        onSuccess(data.conversation);
      }
      onClose();
    } catch (err) {
      console.error("Rename error:", err);
      setError(err.message || "Failed to rename conversation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-semibold text-sm">
            <Edit3 className="w-4 h-4 text-blue-600" />
            Rename Conversation
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Conversation Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 Financials Analysis"
              maxLength={100}
              disabled={loading}
              autoFocus
              className="w-full text-sm"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
              <span>Descriptive name for quick reference</span>
              <span>{title.length}/100</span>
            </div>
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading || !title.trim()}>
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
