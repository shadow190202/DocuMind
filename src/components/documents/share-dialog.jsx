"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Mail,
  Trash2,
  Shield,
  ShieldCheck,
  Check,
  Loader2,
  AlertCircle,
  UserPlus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function ShareDialog({
  isOpen,
  onClose,
  documentId,
  documentTitle,
  onPermissionsUpdated,
}) {
  const [collaborators, setCollaborators] = useState([]);
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Invite state
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState("read"); // 'read' | 'write'
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [inviteSuccess, setInviteSuccess] = useState(null);

  // Action states
  const [updatingId, setUpdatingId] = useState(null);
  const [revokingId, setRevokingId] = useState(null);

  const fetchCollaborators = async () => {
    if (!documentId) return;
    try {
      setLoading(true);
      setFetchError(null);
      const res = await fetch(`/api/documents/${documentId}/permissions`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load collaborators.");
      }
      setOwner(data.owner || null);
      setCollaborators(data.collaborators || []);
    } catch (err) {
      setFetchError(err.message || "Could not fetch collaborators.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && documentId) {
      fetchCollaborators();
      setEmail("");
      setPermission("read");
      setInviteError(null);
      setInviteSuccess(null);
    }
  }, [isOpen, documentId]);

  const handleShare = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      setInviting(true);
      setInviteError(null);
      setInviteSuccess(null);

      const res = await fetch(`/api/documents/${documentId}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          permission,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to share document.");
      }

      setInviteSuccess(
        `Shared with ${data.permission?.email} as ${
          data.permission?.permission === "write" ? "Editor" : "Viewer"
        }.`
      );
      setEmail("");
      fetchCollaborators();
      if (onPermissionsUpdated) onPermissionsUpdated();
    } catch (err) {
      setInviteError(err.message || "Failed to share document.");
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (permissionId, newRole) => {
    try {
      setUpdatingId(permissionId);
      const res = await fetch(
        `/api/documents/${documentId}/permissions/${permissionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ permission: newRole }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update collaborator role.");
      }

      fetchCollaborators();
      if (onPermissionsUpdated) onPermissionsUpdated();
    } catch (err) {
      setFetchError(err.message || "Failed to update role.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRevoke = async (permissionId) => {
    try {
      setRevokingId(permissionId);
      const res = await fetch(
        `/api/documents/${documentId}/permissions/${permissionId}`,
        {
          method: "DELETE",
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to revoke access.");
      }

      fetchCollaborators();
      if (onPermissionsUpdated) onPermissionsUpdated();
    } catch (err) {
      setFetchError(err.message || "Failed to revoke access.");
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-w-lg bg-theme-panel border-theme-divider text-theme-text">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-theme-primary/10 text-theme-primary">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-theme-text">
                Share Document
              </DialogTitle>
              <DialogDescription className="text-sm text-theme-muted truncate max-w-sm">
                {documentTitle || "Manage collaborator access"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Invite Form */}
        <form onSubmit={handleShare} className="space-y-3 pt-2">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-theme-text">
              Invite by email
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-theme-muted" />
                <Input
                  type="email"
                  placeholder="colleague@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  pattern="^[^@\s]+@[^@\s]+\.[^@\s]+$"
                  className="pl-9 bg-theme-panel border-theme-divider text-theme-text placeholder:text-theme-muted text-sm"
                />
              </div>
              <select
                value={permission}
                onChange={(e) => setPermission(e.target.value)}
                className="bg-theme-panel border border-theme-divider text-theme-text rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-theme-primary"
              >
                <option value="read">Viewer</option>
                <option value="write">Editor</option>
              </select>
              <Button
                type="submit"
                disabled={inviting || !email.trim()}
                className="bg-theme-primary hover:bg-theme-primaryHover text-theme-primaryBtn shrink-0"
              >
                {inviting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-1.5" />
                    Share
                  </>
                )}
              </Button>
            </div>
          </div>

          {inviteError && (
            <div className="p-2.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{inviteError}</span>
            </div>
          )}

          {inviteSuccess && (
            <div className="p-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-500 flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{inviteSuccess}</span>
            </div>
          )}
        </form>

        {/* Collaborators List */}
        <div className="space-y-2 pt-2 border-t border-theme-divider">
          <div className="text-xs font-semibold uppercase tracking-wider text-theme-muted">
            People with access
          </div>

          {loading ? (
            <div className="py-6 flex items-center justify-center text-theme-muted text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading collaborators...
            </div>
          ) : fetchError ? (
            <div className="p-3 text-xs text-rose-500 bg-rose-500/10 rounded-md">
              {fetchError}
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {/* Owner Row */}
              {owner && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-theme-body border border-theme-divider">
                  <div className="min-w-0 pr-2">
                    <p className="text-sm font-medium text-theme-text truncate">
                      {owner.name || "Owner"}
                    </p>
                    <p className="text-xs text-theme-muted truncate">{owner.email}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs font-normal">
                    Owner
                  </Badge>
                </div>
              )}

              {/* Collaborators Rows */}
              {collaborators.length === 0 ? (
                <div className="py-4 text-center text-xs text-theme-muted">
                  No other collaborators yet. Invite someone above!
                </div>
              ) : (
                collaborators.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-theme-body border border-theme-divider hover:border-theme-divider transition"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-medium text-theme-text truncate">
                        {c.name || "Collaborator"}
                      </p>
                      <p className="text-xs text-theme-muted truncate">{c.email}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {updatingId === c.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-theme-muted" />
                      ) : (
                        <select
                          value={c.permission}
                          onChange={(e) => handleRoleChange(c.id, e.target.value)}
                          className="bg-theme-panel border border-theme-divider text-xs text-theme-text rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-theme-primary"
                        >
                          <option value="read">Viewer</option>
                          <option value="write">Editor</option>
                        </select>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={revokingId === c.id}
                        onClick={() => handleRevoke(c.id)}
                        className="text-theme-muted hover:text-rose-500 hover:bg-rose-500/10 p-1.5 h-auto rounded"
                        title="Revoke access"
                      >
                        {revokingId === c.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 border-t border-theme-divider">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto border-theme-divider text-theme-text hover:bg-theme-body"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
