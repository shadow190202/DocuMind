"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Root Layout Global Error Boundary
 * Catch-all for catastrophic errors thrown in the root layout.
 */
export default function GlobalError({ error, reset }) {
  const referenceId = error?.digest || error?.requestId || null;

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm text-center">
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
          </div>

          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Application Error
          </h2>

          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            A critical system error occurred. Please refresh or try again.
          </p>

          {referenceId && (
            <div className="mb-6 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-500 break-all select-all">
              Reference ID: {referenceId}
            </div>
          )}

          <Button
            onClick={() => reset()}
            variant="default"
            size="sm"
            className="w-full gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reload Application
          </Button>
        </div>
      </body>
    </html>
  );
}
