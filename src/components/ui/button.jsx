import React from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = {
  variant: {
    default: "bg-theme-primary text-theme-primaryBtn hover:bg-theme-primaryHover shadow-sm focus-visible:ring-theme-primary",
    ai: "bg-theme-ai text-white hover:bg-theme-aiHover shadow-sm focus-visible:ring-theme-ai",
    "ai-outline": "border border-theme-ai/30 bg-theme-ai/10 text-theme-aiAccent hover:bg-theme-ai/20",
    secondary: "bg-theme-body text-theme-text hover:bg-theme-divider",
    outline: "border border-theme-divider bg-transparent hover:bg-theme-body text-theme-text",
    ghost: "hover:bg-theme-body text-theme-text",
    destructive: "bg-red-600 text-white hover:bg-red-700 shadow-sm focus-visible:ring-red-500",
    link: "text-theme-primary underline-offset-4 hover:underline p-0 h-auto",
  },
  size: {
    sm: "min-h-[2.25rem] h-9 px-3.5 py-1.5 text-xs rounded-md font-medium",
    md: "min-h-[2.5rem] h-10 px-4 py-2 text-sm rounded-md font-medium",
    lg: "min-h-[2.75rem] h-12 px-6 py-2.5 text-base rounded-md font-medium",
    icon: "h-9 w-9 min-w-[2.25rem] p-0 rounded-md flex items-center justify-center shrink-0",
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
