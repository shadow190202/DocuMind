"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { AdminHeader } from "@/components/admin/admin-header";
import { StatCard } from "@/components/admin/stat-card";
import {
  AdminAreaChart,
  AdminDonutChart,
  AdminBarChart,
} from "@/components/admin/admin-charts";
import {
  Users,
  FileText,
  MessageSquare,
  Sparkles,
  HardDrive,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState("30d");
  const [data, setData] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/stats?timeRange=${timeRange}`);
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("Access denied: Administrator privileges required.");
        }
        throw new Error(`Failed to load admin telemetry: ${res.statusText}`);
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
  }, [timeRange]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const kpis = data?.kpis;
  const charts = data?.charts;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AdminHeader
          title="Admin Overview & Telemetry"
          subtitle="Real-time system metrics, AI operations, and platform health"
        />

        <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* Controls & Time Range Filter */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Platform Telemetry
              </h2>
              <p className="text-xs text-slate-500">
                Aggregated system activity across all active tenants
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-0.5 text-xs font-medium">
                {["7d", "30d", "90d", "all"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTimeRange(t)}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      timeRange === t
                        ? "bg-purple-600 text-white font-semibold"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchStats}
                disabled={loading}
                className="gap-1.5 text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Alert Banner for Failed Processing */}
          {kpis && kpis.failedDocs > 0 && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    {kpis.failedDocs} Document Processing Failure{kpis.failedDocs > 1 ? "s" : ""} Detected
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    One or more files failed text extraction, chunking, or embedding generation.
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="text-xs gap-1.5 shrink-0" asChild>
                <Link href="/admin/processing">
                  Investigate Failures
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </Button>
            </div>
          )}

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Registered Users"
              value={kpis ? kpis.totalUsers.toLocaleString() : "..."}
              icon={Users}
              subtext={`${kpis?.activeUsers ?? 0} active in ${timeRange}`}
              badgeText={`${kpis?.activeUsers ?? 0} Active`}
              badgeVariant="success"
            />
            <StatCard
              title="Total Documents"
              value={kpis ? kpis.totalDocuments.toLocaleString() : "..."}
              icon={FileText}
              subtext={`${kpis?.completedDocs ?? 0} processed successfully`}
              badgeText={`${kpis?.processingSuccessRate ?? 100}% Success`}
              badgeVariant={kpis && kpis.failedDocs > 0 ? "warning" : "success"}
            />
            <StatCard
              title="Questions Asked"
              value={kpis ? kpis.totalQuestions.toLocaleString() : "..."}
              icon={MessageSquare}
              subtext="Grounded user RAG queries"
              badgeText="Chat Q&A"
            />
            <StatCard
              title="Observed AI Tokens"
              value={
                kpis
                  ? kpis.aiUsage.recordedTokens > 1000000
                    ? `${(kpis.aiUsage.recordedTokens / 1000000).toFixed(2)}M`
                    : `${(kpis.aiUsage.recordedTokens / 1000).toFixed(1)}k`
                  : "..."
              }
              icon={Sparkles}
              subtext={`${kpis?.aiUsage.operationsCount ?? 0} total AI operations`}
              badgeText="Free Tier"
              badgeVariant="default"
            />
          </div>

          {/* Visual Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upload Activity Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span>Document Uploads Trend</span>
                  <span className="text-[11px] font-normal text-slate-400">Daily frequency</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Number of documents uploaded over the selected period
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AdminAreaChart
                  data={charts?.uploadsTimeline || []}
                  color="purple"
                  label="documents"
                  height={220}
                />
              </CardContent>
            </Card>

            {/* Questions Over Time Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span>AI Questions Trend</span>
                  <span className="text-[11px] font-normal text-slate-400">Daily queries</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Grounded Q&A questions asked by users
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AdminAreaChart
                  data={charts?.questionsTimeline || []}
                  color="indigo"
                  label="questions"
                  height={220}
                />
              </CardContent>
            </Card>
          </div>

          {/* Distribution & Storage Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Document Formats Distribution */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">
                  Document Formats Breakdown
                </CardTitle>
                <CardDescription className="text-xs">
                  Distribution across supported formats (PDF, DOCX, TXT, CSV)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AdminDonutChart data={charts?.documentTypes || []} size={180} />
              </CardContent>
            </Card>

            {/* Processing State Overview */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">
                  Ingestion Status
                </CardTitle>
                <CardDescription className="text-xs">
                  Current processing state distribution
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AdminBarChart
                  items={[
                    {
                      label: "Completed",
                      count: kpis?.completedDocs || 0,
                      colorClass: "bg-emerald-500",
                    },
                    {
                      label: "In Queue / Processing",
                      count: (kpis?.processingDocs || 0) + (kpis?.pendingDocs || 0),
                      colorClass: "bg-blue-500",
                    },
                    {
                      label: "Failed",
                      count: kpis?.failedDocs || 0,
                      colorClass: "bg-rose-500",
                    },
                  ]}
                />
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs flex items-center justify-between text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                    Storage Consumed:
                  </span>
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                    {kpis
                      ? kpis.storageUsageBytes > 1024 * 1024
                        ? `${(kpis.storageUsageBytes / (1024 * 1024)).toFixed(2)} MB`
                        : `${(kpis.storageUsageBytes / 1024).toFixed(1)} KB`
                      : "0 B"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
