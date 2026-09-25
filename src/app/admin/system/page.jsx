"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { AdminHeader } from "@/components/admin/admin-header";
import { StatCard } from "@/components/admin/stat-card";
import {
  Database,
  Layers,
  HardDrive,
  Activity,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Server,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function AdminSystemPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSystemData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/system");
      if (!res.ok) {
        throw new Error("Failed to load system diagnostics.");
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
    fetchSystemData();
  }, [fetchSystemData]);

  const dbInfo = data?.database;
  const pgvectorInfo = data?.pgvector;
  const storageInfo = data?.storage;
  const envInfo = data?.environment;
  const tableCounts = data?.tableRowCounts || {};

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AdminHeader
          title="System Health & Infrastructure Diagnostics"
          subtitle="Operational diagnostics, database latency, pgvector extension, and storage statistics"
        />

        <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Live Infrastructure Status
              </h2>
              <p className="text-xs text-slate-500">
                Server-side verified operational health and resource metrics
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchSystemData}
              disabled={loading}
              className="text-xs gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Ping Health
            </Button>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Infrastructure KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="PostgreSQL Database"
              value={dbInfo ? `${dbInfo.latencyMs} ms` : "..."}
              icon={Database}
              badgeText={dbInfo?.status === "connected" ? "Connected" : "Offline"}
              badgeVariant={dbInfo?.status === "connected" ? "success" : "danger"}
              subtext="Neon serverless connection"
            />
            <StatCard
              title="pgvector Extension"
              value={pgvectorInfo ? `v${pgvectorInfo.version}` : "..."}
              icon={Layers}
              badgeText={pgvectorInfo?.installed ? "Active" : "Missing"}
              badgeVariant={pgvectorInfo?.installed ? "success" : "danger"}
              subtext={`${pgvectorInfo?.expectedEmbeddingDimensions ?? 768}-dim cosine index`}
            />
            <StatCard
              title="Storage Footprint"
              value={storageInfo ? storageInfo.formattedSize : "..."}
              icon={HardDrive}
              badgeText={`${storageInfo?.totalDocuments ?? 0} Files`}
              subtext="Originals & extracted JSON"
            />
            <StatCard
              title="Environment Runtime"
              value={envInfo ? envInfo.nodeEnv : "..."}
              icon={Server}
              badgeText="Next.js 14"
              subtext="Pure JavaScript App Router"
            />
          </div>

          {/* Configuration & Security Posture */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Lock className="w-4 h-4 text-purple-600" />
                <span>Security & Environment Sanitization</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Zero secrets or filesystem paths are exposed in administrative telemetry responses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      DATABASE_URL
                    </span>
                    {envInfo?.isDatabaseConfigured ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-500" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Connection string active & sanitized (URI obscured)
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      GEMINI_API_KEY
                    </span>
                    {envInfo?.isGeminiKeyConfigured ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-500" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Official Google GenAI client key present
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Clerk Authentication
                    </span>
                    {envInfo?.isClerkConfigured ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-500" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Publishable & secret keys configured
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Database Table Row Counts Grid */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span>Database Tables Telemetry</span>
                <span className="text-xs font-normal text-slate-400">9 Application Tables</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time record counts for core platform entities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-3">
                {Object.entries(tableCounts).map(([tableName, count]) => (
                  <div
                    key={tableName}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-xs flex items-center justify-between"
                  >
                    <span className="font-mono text-slate-600 dark:text-slate-400">
                      {tableName}
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {Number(count).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
