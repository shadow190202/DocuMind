import React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = {
  default: "border-transparent bg-theme-primary text-theme-primaryBtn hover:bg-theme-primaryHover",
  secondary: "border-transparent bg-theme-body text-theme-text",
  outline: "text-theme-text border-theme-divider bg-theme-panel",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  destructive: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  ai: "border-theme-ai/30 bg-theme-ai/10 text-theme-aiAccent",
};

export function Badge({ className, variant = "default", children, ...props }) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2",
        badgeVariants[variant] || badgeVariants.default,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
