import Link from "next/link";
import { FileQuestion, Home, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Custom 404 Not Found Page for DocuMind
 */
export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm text-center">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-900 flex items-center justify-center mx-auto mb-4">
          <FileQuestion className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Page Not Found
        </h1>

        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
          The document, conversation, or page you requested could not be located. It may have been deleted or moved.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild variant="default" size="sm" className="w-full sm:w-auto gap-2">
            <Link href="/dashboard">
              <Home className="w-4 h-4" />
              Dashboard
            </Link>
          </Button>

          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto gap-2">
            <Link href="/documents">
              <FileText className="w-4 h-4" />
              Documents
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
