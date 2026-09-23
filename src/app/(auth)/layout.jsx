import React from "react";
import Link from "next/link";
import { Sparkles, ArrowLeft } from "lucide-react";

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 relative">
      {/* Back to Home Button */}
      <div className="absolute top-6 left-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to DocuMind
        </Link>
      </div>

      {/* Brand Header */}
      <div className="mb-6 flex flex-col items-center space-y-2">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
          <Sparkles className="w-5 h-5" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">
          Docu<span className="text-blue-600 dark:text-blue-500">Mind</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          AI Document Intelligence & Knowledge Assistant
        </p>
      </div>

      {/* Auth Component Container */}
      <div className="w-full flex justify-center">{children}</div>
    </div>
  );
}
