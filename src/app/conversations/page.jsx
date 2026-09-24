"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  History,
  Search,
  Plus,
  MessageSquare,
  Filter,
  Calendar,
  ArrowUpDown,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  FileText,
} from "lucide-react";
import { ConversationCard } from "@/components/conversations/conversation-card";
import { RenameModal } from "@/components/conversations/rename-modal";
import { DeleteModal } from "@/components/conversations/delete-modal";

export default function ConversationsPage() {
  const [conversations, setConversations] = useState([]);
  const [documentsList, setDocumentsList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination State
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [timeRange, setTimeRange] = useState("all");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const limit = 12;
  const [total, setTotal] = useState(0);

  // Modal State
  const [renameTarget, setRenameTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // 1. Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // reset to page 1 on new search
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // 2. Fetch documents list for filter dropdown
  useEffect(() => {
    async function loadDocuments() {
      try {
        const res = await fetch("/api/documents");
        if (res.ok) {
          const data = await res.json();
          const completed = (data.documents || []).filter(
            (d) => d.processingStatus === "completed"
          );
          setDocumentsList(completed);
        }
      } catch (err) {
        console.warn("Could not load documents list:", err);
      }
    }
    loadDocuments();
  }, []);

  // 3. Fetch conversations list
  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (documentId) params.set("documentId", documentId);
      if (timeRange && timeRange !== "all") params.set("timeRange", timeRange);
      if (sort) params.set("sort", sort);
      params.set("limit", limit.toString());
      params.set("offset", ((page - 1) * limit).toString());

      const res = await fetch(`/api/conversations?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
        setTotal(data.pagination?.total || 0);
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, documentId, timeRange, sort, page]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Handlers for modal updates
  const handleRenameSuccess = (updated) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === updated.id
          ? { ...c, title: updated.title, updatedAt: updated.updatedAt }
          : c
      )
    );
  };

  const handleDeleteSuccess = (deletedId) => {
    setConversations((prev) => prev.filter((c) => c.id !== deletedId));
    setTotal((prev) => Math.max(0, prev - 1));
  };

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setDocumentId("");
    setTimeRange("all");
    setSort("recent");
    setPage(1);
  };

  const totalPages = Math.ceil(total / limit) || 1;
  const hasActiveFilters = Boolean(
    debouncedSearch.trim() || documentId || timeRange !== "all" || sort !== "recent"
  );

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Universal Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header */}
        <header className="h-16 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
                Conversation History
              </h1>
              <p className="text-xs text-slate-500">
                {total} {total === 1 ? "conversation" : "conversations"} recorded
              </p>
            </div>
          </div>

          <Button size="sm" className="gap-1.5 shadow-sm" asChild>
            <Link href="/chat">
              <Plus className="w-4 h-4" />
              New Chat
            </Link>
          </Button>
        </header>

        {/* Dashboard Body */}
        <div className="p-6 md:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* Filter & Controls Toolbar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search conversations by title..."
                  className="pl-9 pr-8 text-sm"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Time Range Selector */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <select
                    value={timeRange}
                    onChange={(e) => {
                      setTimeRange(e.target.value);
                      setPage(1);
                    }}
                    className="h-9 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="all">All Time</option>
                    <option value="24h">Last 24 Hours</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                  </select>
                </div>

                {/* Sort Selector */}
                <div className="relative">
                  <select
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value);
                      setPage(1);
                    }}
                    className="h-9 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="recent">Most Recent</option>
                    <option value="oldest">Oldest First</option>
                    <option value="most_questions">Most Questions</option>
                    <option value="title">Title (A-Z)</option>
                  </select>
                </div>

                {/* Document Scope Filter */}
                <div className="relative">
                  <select
                    value={documentId}
                    onChange={(e) => {
                      setDocumentId(e.target.value);
                      setPage(1);
                    }}
                    className="h-9 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer max-w-[180px] truncate"
                  >
                    <option value="">All Scopes</option>
                    {documentsList.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.filename}
                      </option>
                    ))}
                  </select>
                </div>

                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-xs h-9 text-slate-500 hover:text-slate-700"
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Conversations Grid / List */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-44 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse p-5 space-y-3"
                >
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
                  <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                  <div className="h-4 bg-slate-100 dark:bg-slate-800/60 rounded w-full" />
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            /* Empty State */
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center max-w-lg mx-auto space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {hasActiveFilters
                    ? "No conversations match your criteria"
                    : "No conversation history yet"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  {hasActiveFilters
                    ? "Try adjusting your search keywords, time range, or document scope filter."
                    : "Ask questions about your uploaded documents to start your first grounded AI conversation."}
                </p>
              </div>

              {hasActiveFilters ? (
                <Button size="sm" variant="outline" onClick={clearFilters}>
                  Clear all filters
                </Button>
              ) : (
                <Button size="sm" asChild>
                  <Link href="/chat">
                    <Plus className="w-4 h-4 mr-1.5" />
                    Start New Chat
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Conversation Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {conversations.map((conv) => (
                  <ConversationCard
                    key={conv.id}
                    conversation={conv}
                    onRename={(c) => setRenameTarget(c)}
                    onDelete={(c) => setDeleteTarget(c)}
                  />
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                  <span>
                    Showing {(page - 1) * limit + 1} to{" "}
                    {Math.min(page * limit, total)} of {total} conversations
                  </span>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="h-8 px-2.5 text-xs"
                    >
                      <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                      Previous
                    </Button>
                    <span className="text-xs font-medium px-2">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="h-8 px-2.5 text-xs"
                    >
                      Next
                      <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Rename Modal */}
      <RenameModal
        isOpen={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        conversation={renameTarget}
        onSuccess={handleRenameSuccess}
      />

      {/* Delete Modal */}
      <DeleteModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        conversation={deleteTarget}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  );
}
