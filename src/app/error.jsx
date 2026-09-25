"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Global App Route Error Boundary
 *
 * Security & UX Invariants:
 * 1. Catches client/server rendering crashes gracefully.
 * 2. Honest Correlation ID: displays reference ID ONLY when genuinely provided
 *    by Next.js (error.digest) or an API response (error.requestId).
 * 3. Never synthesizes or fabricates a fake request ID when none exists.
 * 4. Never leaks raw stack traces or internal environment variables to clients.
 */
export default function ErrorBoundary({ error, reset }) {
  useEffect(() => {
    // Log error locally on the client console for debugging
    console.error("[AppErrorBoundary]", error);
  }, [error]);

  const referenceId = error?.digest || error?.requestId || null;

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm text-center">
        <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
        </div>

        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Something went wrong
        </h2>

        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
          An unexpected error occurred while loading this page. Our system has logged the event.
        </p>

        {referenceId && (
          <div className="mb-6 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-500 break-all select-all">
            Reference ID: {referenceId}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            onClick={() => reset()}
            variant="default"
            size="sm"
            className="w-full sm:w-auto gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Try again
          </Button>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-full sm:w-auto gap-2"
          >
            <Link href="/dashboard">
              <Home className="w-4 h-4" />
              Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
