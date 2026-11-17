import React from "react";
import Link from "next/link";
import { FileText, ArrowLeft } from "lucide-react";

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-[100dvh] flex flex-col justify-center items-center p-4 bg-theme-body text-theme-text relative">
      {/* Back to Home Button */}
      <div className="absolute top-6 left-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-theme-muted hover:text-theme-text transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to DocuMind
        </Link>
      </div>

      {/* Brand Header */}
      <div className="mb-6 flex flex-col items-center space-y-2">
        <div className="h-10 w-10 rounded-lg bg-theme-text text-theme-body flex items-center justify-center shadow-xs">
          <FileText className="w-5 h-5" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">
          Docu<span className="text-theme-primary">Mind</span>
        </h1>
        <p className="text-xs text-theme-muted">
          AI Document Intelligence & Knowledge Assistant
        </p>
      </div>

      {/* Auth Component Container */}
      <div className="w-full flex justify-center">{children}</div>
    </div>
  );
}
