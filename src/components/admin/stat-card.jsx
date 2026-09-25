import React from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  title,
  value,
  subtext,
  icon: Icon,
  badgeText,
  badgeVariant = "default",
  className,
}) {
  return (
    <div
      className={cn(
        "p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {title}
        </span>
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          {value}
        </span>
        {badgeText && (
          <span
            className={cn(
              "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
              badgeVariant === "success" &&
                "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800",
              badgeVariant === "danger" &&
                "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800",
              badgeVariant === "warning" &&
                "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800",
              badgeVariant === "default" &&
                "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
            )}
          >
            {badgeText}
          </span>
        )}
      </div>

      {subtext && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
          {subtext}
        </p>
      )}
    </div>
  );
}
