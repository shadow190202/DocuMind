"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  Cpu,
  Sparkles,
  Server,
  ArrowLeft,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const adminTabs = [
  { label: "Overview", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Documents", href: "/admin/documents", icon: FileText },
  { label: "Processing Monitor", href: "/admin/processing", icon: Cpu },
  { label: "AI Usage", href: "/admin/usage", icon: Sparkles },
  { label: "System Health", href: "/admin/system", icon: Server },
];

export function AdminHeader({ title = "Admin Console", subtitle }) {
  const pathname = usePathname();

  return (
    <header className="shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
      {/* Top Banner */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-600/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 dark:text-white">
                {title}
              </h1>
              <Badge
                variant="secondary"
                className="bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 text-[11px]"
              >
                Superadmin
              </Badge>
            </div>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard" className="gap-1.5 text-xs">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to App
          </Link>
        </Button>
      </div>

      {/* Navigation Tabs */}
      <div className="px-6 flex items-center gap-1 overflow-x-auto scrollbar-none py-1">
        {adminTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap",
                isActive
                  ? "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 font-semibold shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/60"
              )}
            >
              <Icon
                className={cn(
                  "w-3.5 h-3.5",
                  isActive
                    ? "text-purple-600 dark:text-purple-400"
                    : "text-slate-400"
                )}
              />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}
