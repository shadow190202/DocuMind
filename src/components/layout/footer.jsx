import React from "react";
import Link from "next/link";
import { FileText, Shield } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-theme-divider bg-theme-panel transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5 font-semibold text-base tracking-tight text-theme-text">
              <div className="h-7 w-7 rounded-md bg-theme-text text-theme-panel flex items-center justify-center shadow-xs">
                <FileText className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <span className="text-theme-text">
                Docu<span className="text-theme-primary">Mind</span>
              </span>
            </div>
            <p className="text-sm text-theme-muted max-w-sm leading-relaxed">
              Document intelligence platform. Query PDF, DOCX, TXT, and CSV documents with verifiable source citations and pgvector similarity search.
            </p>
            <div className="flex items-center gap-2 text-xs text-theme-muted">
              <Shield className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.5} />
              <span>User-isolated vector boundaries and data privacy</span>
            </div>
          </div>

          {/* Core Features */}
          <div>
            <h4 className="text-xs font-semibold text-theme-text mb-3">Capabilities</h4>
            <ul className="space-y-2 text-xs text-theme-muted">
              <li>
                <a href="#features" className="hover:text-theme-text transition-colors">
                  Semantic retrieval
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-theme-text transition-colors">
                  Source citations
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-theme-text transition-colors">
                  Document summaries
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-theme-text transition-colors">
                  Revision comparison
                </a>
              </li>
            </ul>
          </div>

          {/* Architecture / Tech Stack */}
          <div>
            <h4 className="text-xs font-semibold text-theme-text mb-3">Architecture</h4>
            <ul className="space-y-2 text-xs text-theme-muted">
              <li>Next.js App Router (React)</li>
              <li>PostgreSQL &amp; pgvector</li>
              <li>Drizzle ORM</li>
              <li>Tailwind CSS</li>
              <li>Clerk Authentication</li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-theme-divider flex flex-col sm:flex-row items-center justify-between text-xs text-theme-muted gap-4">
          <p>© {new Date().getFullYear()} DocuMind. Licensed under MIT.</p>
          <div className="flex items-center gap-6">
            <Link href="/terms" className="hover:text-theme-text transition-colors">
              Terms of service
            </Link>
            <Link href="/privacy" className="hover:text-theme-text transition-colors">
              Privacy policy
            </Link>
            <span className="text-theme-muted font-mono text-xs hidden md:inline">
              pgvector 768d
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
