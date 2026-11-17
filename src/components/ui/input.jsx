import React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef(({ className, type = "text", error, ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-lg border border-theme-divider bg-theme-panel text-theme-text px-3 py-2 text-sm placeholder:text-theme-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50",
        "user-invalid:border-rose-500 user-invalid:focus-visible:ring-rose-500",
        error && "border-rose-500 focus-visible:ring-rose-500",
        className
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";
