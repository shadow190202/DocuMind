"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Upload,
  MessageSquare,
  History,
  GitCompare,
  User,
  Shield,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  Info,
} from "lucide-react";
import { UserButton, SignedIn } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const navigationItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Upload Document", href: "/documents/upload", icon: Upload },
  { label: "AI Chat & Q&A", href: "/chat", icon: MessageSquare },
  { label: "Conversations", href: "/conversations", icon: History },
  { label: "Compare Documents", href: "/compare", icon: GitCompare },
  { label: "Profile", href: "/profile", icon: User },
];

const adminItems = [
  { label: "Admin Console", href: "/admin/dashboard", icon: Shield, badge: "Admin" },
];

export function Sidebar({ className }) {
  const pathname = usePathname() || "/dashboard";
  const [collapsed, setCollapsed] = useState(false);
  const [usageData, setUsageData] = useState({
    aiUsage: {
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      questionsCount: 0,
      tokensUnavailableCount: 0,
      hasUnavailableTokenCounts: false,
      lastUsedAt: null,
    },
    vaultUsage: {
      documentCount: 0,
      maxDocuments: 50,
      percentage: 0,
    },
  });

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/usage");
      if (res.ok) {
        const data = await res.json();
        if (data?.success) {
          setUsageData({
            aiUsage: data.aiUsage,
            vaultUsage: data.vaultUsage,
          });
        }
      }
    } catch (err) {
      // Non-fatal error; UI gracefully defaults to zero
      console.error("Failed to load usage data:", err);
    }
  }, []);

  useEffect(() => {
    fetchUsage();

    const handleUsageUpdate = () => {
      fetchUsage();
    };

    window.addEventListener("documind:ai-usage-updated", handleUsageUpdate);
    return () => {
      window.removeEventListener("documind:ai-usage-updated", handleUsageUpdate);
    };
  }, [fetchUsage, pathname]);

  const aiUsage = usageData.aiUsage;
  const vaultUsage = usageData.vaultUsage;

  // Relative application activity visual fill (smooth log-scale from 0% up to 100%)
  // Does NOT represent Google provider quota or any percentage denominator
  const activityFill =
    aiUsage.questionsCount === 0 || aiUsage.totalTokens === 0
      ? 0
      : Math.min(
          100,
          Math.max(
            12,
            Math.round((Math.log10(Math.max(10, aiUsage.totalTokens)) / 6) * 100)
          )
        );

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 transition-all duration-300",
        collapsed ? "w-20" : "w-64",
        className
      )}
    >
      {/* Sidebar Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800">
        <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/30">
            <Sparkles className="w-5 h-5" />
          </div>
          {!collapsed && (
            <span className="font-bold text-lg tracking-tight truncate">
              Docu<span className="text-blue-600 dark:text-blue-500">Mind</span>
            </span>
          )}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        <div className="space-y-1">
          {!collapsed && (
            <p className="px-3 text-[10px] font-semibold tracking-wider text-slate-400 uppercase mb-2">
              Workspace
            </p>
          )}
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                )}
              >
                <Icon className={cn("w-5 h-5 shrink-0", isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400")} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </div>

        {/* Administration Section */}
        <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
          {!collapsed && (
            <p className="px-3 text-[10px] font-semibold tracking-wider text-slate-400 uppercase mb-2">
              Management
            </p>
          )}
          {adminItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 font-semibold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={cn("w-5 h-5 shrink-0", isActive ? "text-purple-600 dark:text-purple-400" : "text-slate-400")} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </div>
                {!collapsed && item.badge && (
                  <Badge variant="secondary" className="text-[10px] py-0 px-1.5 ml-2">
                    {item.badge}
                  </Badge>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Storage & AI Usage Widgets */}
      {!collapsed ? (
        <div className="mx-3 my-2 space-y-2.5">
          {/* Document Vault Widget */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
            <div className="flex items-center justify-between font-medium">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <HardDrive className="w-3.5 h-3.5 text-blue-500" />
                Document Vault
              </span>
              <span className="text-slate-500">
                {vaultUsage.documentCount} / {vaultUsage.maxDocuments} Docs
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${vaultUsage.percentage}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400">pgvector RAG Index active</p>
          </div>

          {/* AI Usage Indicator Widget (Placed directly below Document Vault) */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
            <div className="flex items-center justify-between font-medium">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                AI Usage
              </span>
              <span className="text-slate-500">
                {aiUsage.questionsCount === 1
                  ? "1 question"
                  : `${aiUsage.questionsCount.toLocaleString()} questions`}
              </span>
            </div>

            {/* Visual Activity Bar (Unambiguous application activity, never Google quota) */}
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${activityFill}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {aiUsage.totalTokens.toLocaleString()} tokens used
              </span>
            </div>

            <p className="text-[9.5px] leading-tight text-slate-400">
              ⓘ Usage tracked by DocuMind. Provider-side quota may differ.
            </p>
          </div>
        </div>
      ) : (
        /* Collapsed Sidebar View */
        <div className="p-3 flex flex-col items-center gap-3 text-slate-400">
          <div
            title={`Document Vault: ${vaultUsage.documentCount} of ${vaultUsage.maxDocuments} documents used`}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-default"
          >
            <HardDrive className="w-5 h-5 text-blue-500" />
          </div>
          <div
            title={`AI Usage: ${aiUsage.questionsCount} questions, ${aiUsage.totalTokens.toLocaleString()} tokens used. Usage tracked by DocuMind. Provider-side quota may differ.`}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-default"
          >
            <Sparkles className="w-5 h-5 text-indigo-500" />
          </div>
        </div>
      )}

      {/* Authenticated User Status Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
        <SignedIn>
          <div className={cn("flex items-center gap-3", collapsed ? "justify-center" : "px-2 py-1")}>
            <UserButton afterSignOutUrl="/" showName={!collapsed} />
          </div>
        </SignedIn>
      </div>
    </aside>
  );
}
