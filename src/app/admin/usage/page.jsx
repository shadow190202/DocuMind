"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { AdminHeader } from "@/components/admin/admin-header";
import { StatCard } from "@/components/admin/stat-card";
import { AdminAreaChart } from "@/components/admin/admin-charts";
import {
  Sparkles,
  MessageSquare,
  FileText,
  GitCompare,
  Info,
  RefreshCw,
  AlertCircle,
  Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function AdminUsagePage() {
  const [data, setData] = useState(null);
  const [timeRange, setTimeRange] = useState("30d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUsageData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/usage?timeRange=${timeRange}`);
      if (!res.ok) {
        throw new Error("Failed to load AI usage telemetry.");
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
    fetchUsageData();
  }, [fetchUsageData]);

  const summary = data?.summary;
  const modelBreakdown = data?.modelBreakdown || [];
  const topConsumers = data?.topConsumers || [];
  const tokenTimeline = data?.tokenTimeline || [];

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 w-full overflow-y-auto flex flex-col">
        <AdminHeader
          title="AI Operations & Usage Telemetry"
          subtitle="Grounded token tracking, model distributions, and user consumption leaderboard"
        />

        <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Time Range Selector */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Observed AI Consumption
              </h2>
              <p className="text-xs text-slate-500">
                Tracking Gemini 3.8 Flash chat, summarization, and comparison requests
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
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                    }`}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchUsageData}
                disabled={loading}
                className="text-xs gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Disclaimer Banner (Phase 9.5 & 14 Invariant) */}
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-blue-900 dark:text-blue-200">
                Platform-Observed Telemetry vs. Provider Quotas
              </p>
              <p className="text-blue-700 dark:text-blue-300 leading-relaxed">
                DocuMind tracks token consumption returned directly in LLM responses. Provider free-tier rate limits (15 RPM / 1M TPM) are managed independently in Google AI Studio and cannot be probed via API. Embedding calls (<code>gemini-embedding-001</code>) do not return token metadata and are transparently recorded without fabricated token numbers.
              </p>
            </div>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Recorded Total Tokens"
              value={
                summary
                  ? summary.recordedTokens > 1000000
                    ? `${(summary.recordedTokens / 1000000).toFixed(2)}M`
                    : `${(summary.recordedTokens / 1000).toFixed(1)}k`
                  : "..."
              }
              icon={Sparkles}
              subtext={`${summary?.promptTokens?.toLocaleString() ?? 0} prompt / ${summary?.completionTokens?.toLocaleString() ?? 0} completion`}
              badgeText="Observed"
              badgeVariant="success"
            />
            <StatCard
              title="Chat Questions"
              value={summary ? summary.chatCount.toLocaleString() : "..."}
              icon={MessageSquare}
              subtext="Grounded RAG generation"
              badgeText="Chat"
            />
            <StatCard
              title="Document Summaries"
              value={summary ? summary.summarizeCount.toLocaleString() : "..."}
              icon={FileText}
              subtext="Multi-dimension synthesis"
              badgeText="Summarize"
            />
            <StatCard
              title="Document Comparisons"
              value={summary ? summary.compareCount.toLocaleString() : "..."}
              icon={GitCompare}
              subtext="Bilateral alignment synthesis"
              badgeText="Compare"
            />
          </div>

          {/* Token Usage Timeline */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span>Daily Token Consumption Timeline</span>
                <span className="text-xs font-normal text-slate-400">Sum of prompt + completion</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Tokens consumed daily over the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdminAreaChart
                data={tokenTimeline.map((t) => ({ date: t.date, count: t.tokens }))}
                color="indigo"
                label="tokens"
                height={220}
              />
            </CardContent>
          </Card>

          {/* Model Breakdown & Top Consumers Leaderboard */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Model Breakdown */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-purple-600" />
                  <span>Model Distribution</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Active Gemini models and token counts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {modelBreakdown.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No model usage logged</p>
                ) : (
                  modelBreakdown.map((m) => (
                    <div
                      key={m.model}
                      className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-900 dark:text-white font-mono">{m.model}</span>
                        <span className="text-purple-600">{m.totalTokens.toLocaleString()} tokens</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>{m.operations} total operations</span>
                        <span>{m.promptTokens.toLocaleString()} in / {m.completionTokens.toLocaleString()} out</span>
                      </div>
                    </div>
                  ))
                )}

                {/* Explicit Embedding Transparency Note */}
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 space-y-1">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    gemini-embedding-001
                  </p>
                  <p className="text-[10px] leading-relaxed">
                    Vector embedding operations are recorded without fabricated token metrics because the official API returns null usage metadata.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Top Active Consumers Leaderboard */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span>Top Active Consumers</span>
                  <span className="text-xs font-normal text-slate-400">Top 10 users by tokens</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Users generating the highest AI workload on the platform
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 text-[10px] uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-2.5">User</th>
                        <th className="px-3 py-2.5 text-center">Chat</th>
                        <th className="px-3 py-2.5 text-center">Summary</th>
                        <th className="px-3 py-2.5 text-center">Compare</th>
                        <th className="px-4 py-2.5 text-right">Total Tokens</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {topConsumers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                            No consumer activity recorded yet.
                          </td>
                        </tr>
                      ) : (
                        topConsumers.map((c, i) => (
                          <tr key={c.userId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <span className="font-bold text-slate-400 w-4 text-[11px] font-mono">
                                  #{i + 1}
                                </span>
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-900 dark:text-white truncate">
                                    {c.name}
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-mono truncate">{c.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-center font-mono text-slate-600 dark:text-slate-300">
                              {c.chatCount}
                            </td>
                            <td className="px-3 py-3 text-center font-mono text-slate-600 dark:text-slate-300">
                              {c.summarizeCount}
                            </td>
                            <td className="px-3 py-3 text-center font-mono text-slate-600 dark:text-slate-300">
                              {c.compareCount}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-purple-600 dark:text-purple-400">
                              {c.totalTokens.toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
