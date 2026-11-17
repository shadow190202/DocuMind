"use client";

import React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";

/**
 * DashboardLayout provides the unified responsive application shell:
 * - Desktop: Fixed/collapsible left sidebar navigation
 * - Mobile: Top navigation bar with drawer menu
 * - Main Content: Responsive content area with configurable scrolling
 */
export function DashboardLayout({ children, className, fullBleed = false }) {
  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-theme-body text-theme-text overflow-hidden">
      <Sidebar />
      <div
        className={cn(
          "flex-1 min-w-0 w-full flex flex-col",
          fullBleed ? "overflow-hidden" : "overflow-y-auto",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

export default DashboardLayout;
