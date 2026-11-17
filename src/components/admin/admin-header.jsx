"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  Cpu,
  Activity,
  Server,
  ArrowLeft,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const adminTabs = [
  { label: "Overview", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Documents", href: "/admin/documents", icon: FileText },
  { label: "Processing monitor", href: "/admin/processing", icon: Cpu },
  { label: "AI usage", href: "/admin/usage", icon: Activity },
  { label: "System health", href: "/admin/system", icon: Server },
];

export function AdminHeader({ title = "Admin console", subtitle }) {
  const pathname = usePathname();

  return (
    <header className="shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      {/* Top Banner */}
      <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
            <Shield className="w-3.5 h-3.5" strokeWidth={1.5} />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h1>
            <Badge variant="secondary" className="text-xs font-normal">
              Admin
            </Badge>
            {subtitle && (
              <span className="text-xs text-slate-400 hidden sm:inline">
                • {subtitle}
              </span>
            )}
          </div>
        </div>

        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard" className="gap-1.5 text-xs text-slate-500">
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
            Back to app
          </Link>
        </Button>
      </div>

      {/* Navigation Tabs */}
      <div className="px-4 sm:px-6 flex items-center gap-1 overflow-x-auto py-1">
        {adminTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 px-3 h-8 text-xs font-medium rounded-lg transition-colors whitespace-nowrap",
                isActive
                  ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100 font-medium"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-900"
              )}
            >
              <Icon
                className={cn(
                  "w-3.5 h-3.5",
                  isActive
                    ? "text-slate-900 dark:text-slate-100"
                    : "text-slate-400"
                )}
                strokeWidth={1.5}
              />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}

export default AdminHeader;
