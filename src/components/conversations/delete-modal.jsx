"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";

export function DeleteModal({ isOpen, onClose, conversation, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!conversation) return null;

  const handleDelete = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/conversations/${conversation.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete conversation.");
      }

      if (onSuccess) {
        onSuccess(conversation.id);
      }
      onClose();
    } catch (err) {
      console.error("Delete error:", err);
      setError(err.message || "Failed to delete conversation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-rose-600 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4" />
            <DialogTitle className="text-base text-rose-600 font-semibold">
              Delete Conversation
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-theme-muted mt-1">
            All messages and grounded source citations in this conversation will be permanently removed.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <p className="text-sm text-theme-text">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-theme-text">
              &ldquo;{conversation.title}&rdquo;
            </span>
            ?
          </p>

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2.5 pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
            Delete Conversation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
