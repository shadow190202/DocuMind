import { FileText, Sparkles, Database, ShieldCheck, CheckCircle2 } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-3xl w-full mx-auto space-y-8">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900">
          <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>DocuMind v1.0 — Phase 1 Initialized</span>
        </div>

        {/* Hero Title */}
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            Docu<span className="text-blue-600 dark:text-blue-500">Mind</span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            AI Document Intelligence & Knowledge Assistant. Transform complex documents into interactive knowledge with semantic search, summarization, and RAG.
          </p>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-left">
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 shadow-sm">
            <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400 mb-3" />
            <h3 className="font-semibold text-sm">Multi-Format Ingestion</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Process PDF, DOCX, TXT, and CSV files with intelligent parsing.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 shadow-sm">
            <Database className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mb-3" />
            <h3 className="font-semibold text-sm">Vector Knowledge Base</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              PostgreSQL + pgvector semantic retrieval with page-level citations.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 shadow-sm">
            <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mb-3" />
            <h3 className="font-semibold text-sm">Private & Isolated</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              User-isolated document storage and permission-based sharing.
            </p>
          </div>
        </div>

        {/* Setup Status Box */}
        <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Phase 1 Scaffolding Complete (Pure JavaScript + Next.js App Router)</span>
          </div>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            Node v24
          </span>
        </div>
      </div>
    </main>
  );
}
