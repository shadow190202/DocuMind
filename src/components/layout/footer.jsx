import React from "react";
import Link from "next/link";
import { Sparkles, Github, Shield, Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5 font-bold text-xl tracking-tight">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/30">
                <Sparkles className="w-4 h-4" />
              </div>
              <span>
                Docu<span className="text-blue-600 dark:text-blue-500">Mind</span>
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
              Enterprise-grade document intelligence platform. Turn your PDFs, DOCX, TXT, and CSV documents into an interactive knowledge base with verifiable citations.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Shield className="w-4 h-4 text-emerald-500" />
              <span>User-isolated vector boundaries & strict data privacy</span>
            </div>
          </div>

          {/* Core Features */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Capabilities</h4>
            <ul className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <li>
                <a href="#features" className="hover:text-blue-600 dark:hover:text-blue-400">
                  Semantic Q&A
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-blue-600 dark:hover:text-blue-400">
                  Source Citations
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-blue-600 dark:hover:text-blue-400">
                  Document Summaries
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-blue-600 dark:hover:text-blue-400">
                  Document Comparison
                </a>
              </li>
            </ul>
          </div>

          {/* Architecture / Tech Stack */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Approved Stack</h4>
            <ul className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <li>Next.js App Router (React)</li>
              <li>PostgreSQL & pgvector</li>
              <li>Drizzle ORM</li>
              <li>Tailwind CSS</li>
              <li>Clerk Authentication</li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-4">
          <p>© {new Date().getFullYear()} DocuMind. Master Spec v1.0. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1">
              Crafted with <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500 inline" /> for full-stack engineering
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
