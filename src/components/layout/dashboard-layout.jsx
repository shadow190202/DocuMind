"use client";

import React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";

/**
 * DashboardLayout provides a responsive app shell with:
 * - Desktop: Fixed/collapsible left sidebar navigation (hidden md:flex)
 * - Mobile: Lightweight top navigation bar with hamburger menu toggle and slide-over drawer
 * - Main Content: Full-width responsive container (flex-1 min-w-0 w-full overflow-y-auto)
 */
export function DashboardLayout({ children, className }) {
  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar />
      <div className={cn("flex-1 min-w-0 w-full overflow-y-auto flex flex-col", className)}>
        {children}
      </div>
    </div>
  );
}

export default DashboardLayout;
