import React from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Shield, FileText, Scale, Database, Lock, AlertCircle, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Terms of Service | DocuMind",
  description: "Terms and conditions governing the use of the DocuMind Document Intelligence Platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Navbar />

      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-6 py-16">
          {/* Header Block */}
          <div className="space-y-4 mb-12">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-md gap-1.5 text-xs font-medium">
                <Scale className="w-3.5 h-3.5 text-blue-600 dark:text-blue-500" />
                Legal &amp; Compliance
              </Badge>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Terms of Service
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">
              Effective Date: October 25, 2026 • DocuMind Engine v1.0
            </p>
          </div>

          {/* Legal Document Body */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-10 shadow-xs space-y-10 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {/* Section 1 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="text-blue-600 dark:text-blue-500 font-mono">1.</span> Acceptance of Terms
              </h2>
              <p>
                By creating an account, accessing, or utilizing the DocuMind platform (&quot;DocuMind&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), you (&quot;User&quot; or &quot;Customer&quot;) agree to be legally bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, you must immediately terminate your access to and use of our platform.
              </p>
            </section>

            {/* Section 2 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="text-blue-600 dark:text-blue-500 font-mono">2.</span> Platform Architecture &amp; Services
              </h2>
              <p>
                DocuMind is an enterprise document intelligence and conversational retrieval engine. Platform capabilities include:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-400">
                <li><strong>Multi-Format Ingestion:</strong> Parsing, extraction, and validation of PDF, DOCX, CSV, and plain text (.txt) documents.</li>
                <li><strong>Text Chunking &amp; Vector Indexing:</strong> Semantic segment splitting and vector embedding generation indexed in PostgreSQL using the <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">pgvector</code> extension.</li>
                <li><strong>Grounded Retrieval-Augmented Generation (RAG):</strong> Natural-language semantic query execution with page- and paragraph-level verifiable source citations.</li>
                <li><strong>Executive Summarization:</strong> Multidimensional structured synthesis across executive, key metrics, and action-item criteria.</li>
                <li><strong>Document Comparison:</strong> Side-by-side comparative analysis contrasting clauses, dates, and metric discrepancies across multiple document revisions.</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="text-blue-600 dark:text-blue-500 font-mono">3.</span> Account Security &amp; Access Control
              </h2>
              <p>
                User authentication and session verification are managed through Clerk. You are responsible for maintaining the confidentiality of your authentication credentials and for all actions executed under your account. DocuMind enforces strict Role-Based Access Control (RBAC) and per-document sharing permissions:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-400">
                <li><strong>Owner:</strong> Full document management privileges, including sharing rights, re-processing triggers, and permanent deletion.</li>
                <li><strong>Editor (Write):</strong> Privileges to query, re-process, and annotate shared documents without administrative ownership transfer.</li>
                <li><strong>Viewer (Read):</strong> Read-only access to query and inspect extracted passages without mutation privileges.</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="text-blue-600 dark:text-blue-500 font-mono">4.</span> User Content &amp; Intellectual Property
              </h2>
              <p>
                <strong>You retain 100% ownership, copyright, and title to all uploaded documents, data files, and extracted text.</strong> DocuMind claims no ownership interest in any user content. DocuMind processes your uploaded files strictly to execute your indexing, vectorization, and conversational retrieval requests. Your documents are never used to train public foundation models without your explicit, separate written authorization.
              </p>
            </section>

            {/* Section 5 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="text-blue-600 dark:text-blue-500 font-mono">5.</span> Acceptable Use &amp; Upload Restrictions
              </h2>
              <p>
                You agree not to utilize DocuMind for unlawful purposes or in violation of these Terms. Prohibited activities include:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-400">
                <li>Uploading files containing malicious code, embedded viruses, trojans, or corrupted data payloads.</li>
                <li>Attempting to bypass tenant isolation boundaries or query vector chunks belonging to other accounts.</li>
                <li>Interfering with, circumventing, or overloading API rate limiters, token budgets, or CSRF safeguards.</li>
                <li>Uploading classified national security information, unauthorized healthcare data, or data in violation of third-party copyright.</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="text-blue-600 dark:text-blue-500 font-mono">6.</span> Grounded AI Output &amp; Verification Disclaimer
              </h2>
              <p>
                DocuMind utilizes advanced Large Language Models (including Google Gemini) configured strictly for grounded retrieval. While answers and summaries are anchored to retrieved document passages and cross-referenced with exact similarity scores and page numbers:
              </p>
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <p>
                  <strong>Verification Requirement:</strong> Automated synthesis may occasionally misinterpret nuance or omit relevant context. Generated answers do not constitute formal legal, financial, accounting, or medical advice. Users must verify all critical findings against original source document text before acting on platform outputs.
                </p>
              </div>
            </section>

            {/* Section 7 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="text-blue-600 dark:text-blue-500 font-mono">7.</span> API Quotas, Rate Limiting &amp; Telemetry
              </h2>
              <p>
                To maintain high availability and prevent resource exhaustion, DocuMind enforces sliding-window rate limiters and operational token tracking. Request rates and cumulative token consumption are recorded in audit logs. Excessive queries exceeding provisioned rate limits will receive HTTP 429 (Too Many Requests) responses with standard <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">Retry-After</code> headers.
              </p>
            </section>

            {/* Section 8 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="text-blue-600 dark:text-blue-500 font-mono">8.</span> Limitation of Liability &amp; Termination
              </h2>
              <p>
                To the maximum extent permitted by applicable law, DocuMind and its operators shall not be liable for indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to access the platform. Either party may terminate account access at any time. Upon termination, users may delete their documents, which triggers irreversible cascading deletion across all relational records and vector tables.
              </p>
            </section>
          </div>

          {/* Bottom Navigation */}
          <div className="mt-8 flex items-center justify-between text-xs text-slate-500">
            <Link href="/" className="inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Landing Page
            </Link>
            <Link href="/privacy" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Read Privacy Policy →
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
