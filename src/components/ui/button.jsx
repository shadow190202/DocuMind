import React from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = {
  variant: {
    default: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm focus-visible:ring-blue-500",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
    outline: "border border-slate-300 bg-transparent hover:bg-slate-100 text-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800",
    ghost: "hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800",
    destructive: "bg-red-600 text-white hover:bg-red-700 shadow-sm focus-visible:ring-red-500",
    link: "text-blue-600 underline-offset-4 hover:underline dark:text-blue-400 p-0 h-auto",
  },
  size: {
    sm: "min-h-[2.25rem] h-9 px-3.5 py-1.5 text-xs rounded-lg font-medium",
    md: "min-h-[2.5rem] h-10 px-4 py-2 text-sm rounded-lg font-medium",
    lg: "min-h-[2.75rem] h-12 px-6 py-2.5 text-base rounded-lg font-medium",
    icon: "h-9 w-9 min-w-[2.25rem] p-0 rounded-lg flex items-center justify-center shrink-0",
  },
};

export const Button = React.forwardRef(
  ({ className, variant = "default", size = "md", disabled, asChild = false, children, ...props }, ref) => {
    const baseClasses = cn(
      "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]",
      buttonVariants.variant[variant] || buttonVariants.variant.default,
      buttonVariants.size[size] || buttonVariants.size.md,
      className
    );

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        ref,
        className: cn(baseClasses, children.props.className),
        ...props,
      });
    }

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={baseClasses}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
