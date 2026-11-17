"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Edit3 } from "lucide-react";

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!conversation) return;
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {conversation && (
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-theme-text font-semibold text-sm">
              <Edit3 className="w-4 h-4 text-theme-primary" />
              <DialogTitle className="text-base font-semibold text-theme-text">
                Rename Conversation
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-theme-muted mt-1">
              Choose a descriptive title for easy recall and retrieval.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div>
              <label className="block text-xs font-medium text-theme-text mb-1.5">
                Conversation Title
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Q3 Financials Analysis"
                maxLength={100}
                required
                disabled={loading}
                autoFocus
                className="w-full text-sm"
              />
              <div className="flex items-center justify-between text-[11px] text-theme-muted mt-1">
                <span>Descriptive name for quick reference</span>
                <span>{title.length}/100</span>
              </div>
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600">
                {error}
              </div>
            )}

            <DialogFooter className="gap-2.5 pt-2">
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
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
