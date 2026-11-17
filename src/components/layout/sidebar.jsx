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
  Activity,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  Info,
  Menu,
  X,
} from "lucide-react";
import { UserButton, SignedIn } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const navigationItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Upload document", href: "/documents/upload", icon: Upload },
  { label: "Grounded Q&A", href: "/chat", icon: MessageSquare },
  { label: "Conversations", href: "/conversations", icon: History },
  { label: "Compare documents", href: "/compare", icon: GitCompare },
  { label: "Profile", href: "/profile", icon: User },
];

const adminItems = [
  { label: "Admin console", href: "/admin/dashboard", icon: Shield, badge: "Admin" },
];

function NavLinks({ pathname, collapsed, onItemClick }) {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        {!collapsed && (
          <p className="px-3 text-xs font-medium text-theme-muted mb-1">
            Workspace
          </p>
        )}
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onItemClick}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-2.5 px-3 h-9 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-theme-body text-theme-text font-medium"
                  : "text-theme-muted hover:bg-theme-body/60 hover:text-theme-text"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-theme-text" : "text-theme-muted")} strokeWidth={1.5} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </div>

      <div className="space-y-1 pt-3 border-t border-theme-divider">
        {!collapsed && (
          <p className="px-3 text-xs font-medium text-theme-muted mb-1">
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
              onClick={onItemClick}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center justify-between px-3 h-9 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-theme-body text-theme-text font-medium"
                  : "text-theme-muted hover:bg-theme-body/60 hover:text-theme-text"
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-theme-text" : "text-theme-muted")} strokeWidth={1.5} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </div>
              {!collapsed && item.badge && (
                <Badge variant="secondary" className="text-xs py-0 px-1.5 ml-2 font-normal">
                  {item.badge}
                </Badge>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function UsageWidgets({ usageData, collapsed }) {
  const { aiUsage, vaultUsage } = usageData;
  const requestsCount = aiUsage.requestsCount ?? aiUsage.operationsCount ?? aiUsage.questionsCount ?? 0;

  const activityFill =
    requestsCount === 0 || aiUsage.totalTokens === 0
      ? 0
      : Math.min(
          100,
          Math.max(
            12,
            Math.round((Math.log10(Math.max(10, aiUsage.totalTokens)) / 6) * 100)
          )
        );

  if (collapsed) {
    return (
      <div className="p-3 flex flex-col items-center gap-3 text-theme-muted">
        <div
          title={`Document vault: ${vaultUsage.documentCount} of ${vaultUsage.maxDocuments} documents`}
          className="p-1.5 rounded-lg hover:bg-theme-body cursor-default"
        >
          <HardDrive className="w-4 h-4 text-theme-muted" strokeWidth={1.5} />
        </div>
        <div
          title={`Token usage: ${requestsCount} requests, ${aiUsage.totalTokens.toLocaleString()} tokens`}
          className="p-1.5 rounded-lg hover:bg-theme-body cursor-default"
        >
          <Activity className="w-4 h-4 text-theme-muted" strokeWidth={1.5} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-3 my-2 space-y-2">
      {/* Document Vault Widget */}
      <div className="p-3 rounded-lg bg-theme-body border border-theme-divider text-xs space-y-2">
        <div className="flex items-center justify-between font-normal text-theme-text">
          <span className="flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-theme-muted" strokeWidth={1.5} />
            Document vault
          </span>
          <span className="text-theme-muted tabular-nums">
            {vaultUsage.documentCount} / {vaultUsage.maxDocuments}
          </span>
        </div>
        <div className="w-full bg-theme-divider h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-theme-primary h-full rounded-full transition-all duration-300"
            style={{ width: `${vaultUsage.percentage}%` }}
          />
        </div>
        <p className="text-xs text-theme-muted">pgvector index active</p>
      </div>

      {/* AI Usage Widget */}
      <div className="p-3 rounded-lg bg-theme-body border border-theme-divider text-xs space-y-2">
        <div className="flex items-center justify-between font-normal text-theme-text">
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-theme-muted" strokeWidth={1.5} />
            Token usage
          </span>
          <span className="text-theme-muted tabular-nums">
            {requestsCount === 1 ? "1 request" : `${requestsCount.toLocaleString()} requests`}
          </span>
        </div>

        <div className="w-full bg-theme-divider h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-theme-primary h-full rounded-full transition-all duration-300"
            style={{ width: `${activityFill}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="font-medium text-theme-text tabular-nums">
            {aiUsage.totalTokens.toLocaleString()} tokens used
          </span>
        </div>

        <p className="text-xs leading-tight text-theme-muted flex items-center gap-1">
          <Info className="w-3 h-3 shrink-0" strokeWidth={1.5} />
          Internal tracking. Provider quotas may differ.
        </p>
      </div>
    </div>
  );
}

export function Sidebar({ className }) {
  const pathname = usePathname() || "/dashboard";
  const [collapsed, setCollapsed] = useState(false);
  const [usageData, setUsageData] = useState({
    aiUsage: { totalTokens: 0, requestsCount: 0 },
    vaultUsage: { documentCount: 0, maxDocuments: 50, percentage: 0 },
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
      console.error("Failed to load usage data:", err);
    }
  }, []);

  useEffect(() => {
    fetchUsage();

    const handleUsageUpdate = () => fetchUsage();
    window.addEventListener("documind:ai-usage-updated", handleUsageUpdate);
    return () => {
      window.removeEventListener("documind:ai-usage-updated", handleUsageUpdate);
    };
  }, [fetchUsage, pathname]);

  useEffect(() => {
    const popover = typeof document !== "undefined" ? document.getElementById("sidebar-mobile-drawer") : null;
    if (popover && popover.matches && popover.matches(":popover-open")) {
      popover.hidePopover();
    }
  }, [pathname]);

  return (
    <>
      {/* Mobile Top Header (< md) */}
      <header className="flex md:hidden items-center justify-between px-4 h-14 border-b border-theme-divider bg-theme-panel text-theme-text sticky top-0 z-40 w-full shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            popovertarget="sidebar-mobile-drawer"
            className="p-1.5 -ml-1 rounded-lg text-theme-muted hover:bg-theme-body hover:text-theme-text transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" strokeWidth={1.5} />
          </button>
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-theme-text flex items-center justify-center text-theme-panel shadow-xs">
              <FileText className="w-3.5 h-3.5" strokeWidth={1.5} />
            </div>
            <span className="font-semibold text-sm tracking-tight text-theme-text">
              DocuMind
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>
      </header>

      {/* Desktop Sidebar (>= md) */}
      <aside
        className={cn(
          "hidden md:flex relative flex-col border-r border-theme-divider bg-theme-panel shrink-0 transition-all duration-200",
          collapsed ? "w-16" : "w-64",
          className
        )}
      >
        <div className="flex h-14 items-center justify-between px-4 border-b border-theme-divider">
          <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
            <div className="h-7 w-7 shrink-0 rounded-md bg-theme-text flex items-center justify-center text-theme-panel shadow-xs">
              <FileText className="w-4 h-4" strokeWidth={1.5} />
            </div>
            {!collapsed && (
              <span className="font-semibold text-sm tracking-tight truncate text-theme-text">
                DocuMind
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex p-1.5 rounded-lg text-theme-muted hover:text-theme-text hover:bg-theme-body transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" strokeWidth={1.5} /> : <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          <NavLinks pathname={pathname} collapsed={collapsed} />
        </div>

        <UsageWidgets usageData={usageData} collapsed={collapsed} />

        <div className="p-3 border-t border-theme-divider">
          <SignedIn>
            <div className={cn("flex items-center gap-3", collapsed ? "justify-center" : "px-2 py-1")}>
              <UserButton afterSignOutUrl="/" showName={!collapsed} />
            </div>
          </SignedIn>
        </div>
      </aside>

      {/* Mobile Drawer (Native HTML Popover API) */}
      <div
        id="sidebar-mobile-drawer"
        popover="auto"
        className="fixed inset-y-0 left-0 m-0 p-0 border-0 bg-transparent h-[100dvh] max-w-[85vw] w-64 md:hidden shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      >
        <div className="w-full h-full bg-theme-panel border-r border-theme-divider flex flex-col shadow-2xl">
          <div className="flex h-14 items-center justify-between px-4 border-b border-theme-divider shrink-0">
            <Link
              href="/"
              className="flex items-center gap-2.5 overflow-hidden"
            >
              <div className="h-7 w-7 shrink-0 rounded-md bg-theme-text flex items-center justify-center text-theme-panel shadow-xs">
                <FileText className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <span className="font-semibold text-sm tracking-tight truncate text-theme-text">
                DocuMind
              </span>
            </Link>
            <button
              type="button"
              popovertarget="sidebar-mobile-drawer"
              popovertargetaction="hide"
              className="p-1.5 rounded-lg text-theme-muted hover:text-theme-text hover:bg-theme-body transition-colors"
              aria-label="Close navigation menu"
            >
              <X className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
            <NavLinks pathname={pathname} collapsed={false} />
          </div>

          <UsageWidgets usageData={usageData} collapsed={false} />

          <div className="p-3 border-t border-theme-divider shrink-0">
            <SignedIn>
              <div className="flex items-center gap-3 px-2 py-1">
                <UserButton afterSignOutUrl="/" showName />
              </div>
            </SignedIn>
          </div>
        </div>
      </div>
    </>
  );
}

export default Sidebar;
