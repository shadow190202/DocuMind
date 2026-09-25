"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { AdminHeader } from "@/components/admin/admin-header";
import { StatCard } from "@/components/admin/stat-card";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  FileText,
  AlertCircle,
  Play,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function AdminProcessingPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [retryingId, setRetryingId] = useState(null);

  const fetchProcessingData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/processing");
      if (!res.ok) {
        throw new Error("Failed to load processing telemetry.");
      }
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProcessingData();
  }, [fetchProcessingData]);

  const handleRetry = async (docId) => {
    setRetryingId(docId);
    setActionSuccess(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/documents/${docId}/reprocess`, {
        method: "POST",
      });
      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || "Retry failed.");
      }
      setActionSuccess("Document reprocessed successfully!");
      fetchProcessingData();
    } catch (err) {
      setError(err.message);
    } finally {
      setRetryingId(null);
    }
  };

  const queue = data?.queue;
  const failedDocs = data?.failedDocuments || [];
  const activeJobs = data?.activeJobs || [];

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AdminHeader
          title="Processing Pipeline & Failure Diagnostics"
          subtitle="Real-time ingestion monitoring, error diagnostics, and administrative retry workflows"
        />

        <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {actionSuccess && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* Queue Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Processed Documents"
              value={queue ? queue.completed.toLocaleString() : "..."}
              icon={CheckCircle}
              badgeText="Completed"
              badgeVariant="success"
              subtext="Indexed into pgvector"
            />
            <StatCard
              title="Failed Documents"
              value={queue ? queue.failed.toLocaleString() : "..."}
              icon={AlertTriangle}
              badgeText={queue?.failed > 0 ? "Requires Action" : "Clean"}
              badgeVariant={queue?.failed > 0 ? "danger" : "success"}
              subtext="Parsing or embedding errors"
            />
            <StatCard
              title="In-Flight Jobs"
              value={queue ? (queue.processing + queue.pending).toLocaleString() : "..."}
              icon={Clock}
              badgeText="Active"
              subtext="Synchronous execution pipeline"
            />
            <StatCard
              title="Ingestion Success Rate"
              value={queue ? `${queue.successRate}%` : "..."}
              icon={RotateCcw}
              badgeText="Reliability"
              badgeVariant="success"
              subtext="Completed vs total attempted"
            />
          </div>

          {/* Active Jobs Section (if any) */}
          {activeJobs.length > 0 && (
            <Card className="border-blue-200 dark:border-blue-900/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-blue-900 dark:text-blue-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                  Currently In-Flight Ingestion Jobs ({activeJobs.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {activeJobs.map((job) => (
                    <div key={job.id} className="py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-blue-500" />
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{job.filename}</p>
                          <p className="text-[11px] text-slate-400">Owner: {job.owner.email || job.owner.name}</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 animate-pulse">
                        Chunking & Embedding...
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Failed Ingestions Diagnostic Table */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <span>Failed Documents Diagnostic Log</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 font-normal">
                    {failedDocs.length} Failures
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Captured diagnostic error messages and one-click administrative retry
                </CardDescription>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchProcessingData}
                disabled={loading}
                className="text-xs gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh Log
              </Button>
            </CardHeader>

            <CardContent>
              {failedDocs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs space-y-1">
                  <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    Zero Ingestion Failures
                  </p>
                  <p className="text-[11px]">All document uploads have processed successfully.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {failedDocs.map((doc) => {
                    const isRetrying = retryingId === doc.id;
                    return (
                      <div
                        key={doc.id}
                        className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 dark:text-white">
                              {doc.filename}
                            </span>
                            <span className="text-[10px] font-mono uppercase bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">
                              {doc.fileType}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              Owner: {doc.owner.email || doc.owner.name}
                            </span>
                          </div>

                          {/* Error Callout */}
                          <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 font-mono text-[11px] text-rose-800 dark:text-rose-300 break-words">
                            {doc.errorMessage}
                          </div>

                          <p className="text-[10px] text-slate-400 font-mono">
                            Failed at: {new Date(doc.failedAt).toLocaleString()}
                          </p>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          <Button
                            size="sm"
                            disabled={isRetrying}
                            onClick={() => handleRetry(doc.id)}
                            className="text-xs gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? "animate-spin" : ""}`} />
                            <span>Retry Ingestion</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
