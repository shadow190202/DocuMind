"use client";

import React from "react";
import Link from "next/link";
import {
  FileText,
  Database,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  UploadCloud,
  MessageSquare,
  GitCompare,
  Layers,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const FEATURES = [
  {
    icon: UploadCloud,
    title: "Multi-format ingestion",
    description: "Parse PDF, DOCX, TXT, and CSV files with automated text chunking, sliding-window overlap, and page-level metadata tracking.",
  },
  {
    icon: Database,
    title: "pgvector semantic search",
    description: "Store 768-dimensional embeddings directly in PostgreSQL. Execute cosine-distance similarity searches in milliseconds.",
  },
  {
    icon: MessageSquare,
    title: "Grounded RAG with citations",
    description: "Ask questions and receive answers strictly synthesized from retrieved source chunks, complete with page and paragraph citations.",
  },
  {
    icon: GitCompare,
    title: "Document comparison",
    description: "Diff two documents side-by-side. Surface shared themes, unique clauses, and discrepancies with AI-powered comparative analysis.",
  },
  {
    icon: Sparkles,
    title: "Map-reduce summarization",
    description: "Generate structured executive summaries for documents of any size using multi-stage hierarchical map-reduce summarization.",
  },
  {
    icon: ShieldCheck,
    title: "Tenant isolation and RBAC",
    description: "Strict user-scoped vector filtering prevents cross-tenant data leakage. Share documents granularly with read or write permissions.",
  },
];

const WORKFLOW_STEPS = [
  { step: "01", title: "Upload", desc: "Upload PDF, DOCX, TXT, or CSV files. Content is validated, stored, and queued for extraction." },
  { step: "02", title: "Chunk and embed", desc: "Documents are split into structured chunks and converted into 768-dim embeddings via Gemini." },
  { step: "03", title: "Index in pgvector", desc: "Embeddings and page metadata are stored in PostgreSQL with indexed vector similarity search." },
  { step: "04", title: "Retrieve and cite", desc: "User queries retrieve the most relevant passages to synthesize strictly grounded answers." },
];

export default function HomePage() {
  let isLoaded = false;
  let isSignedIn = false;
  try {
    const auth = useAuth();
    isLoaded = Boolean(auth?.isLoaded);
    isSignedIn = Boolean(auth?.isSignedIn);
  } catch {
    isLoaded = false;
    isSignedIn = false;
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-theme-body text-theme-text">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="pt-20 pb-16 md:pt-28 md:pb-24">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-normal bg-theme-panel text-theme-muted border border-theme-divider shadow-2xs">
              <FileText className="w-3.5 h-3.5 text-theme-primary" strokeWidth={1.5} />
              <span>PostgreSQL pgvector and grounded RAG platform</span>
            </div>

            <div className="space-y-4 max-w-3xl mx-auto">
              <h1 className="text-4xl sm:text-5xl font-medium tracking-tight text-theme-text leading-tight">
                Document intelligence with verifiable citations
              </h1>
              <p className="text-base sm:text-lg text-theme-muted max-w-2xl mx-auto leading-relaxed">
                Ingest documents, index semantic embeddings in PostgreSQL, and ask questions with confidence. Every claim links back to exact source passages.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              {isLoaded && isSignedIn ? (
                <Button size="md" className="w-full sm:w-auto gap-2 bg-theme-primary text-theme-primaryBtn hover:bg-theme-primaryHover" asChild>
                  <Link href="/dashboard">
                    Open workspace
                    <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button size="md" className="w-full sm:w-auto gap-2 bg-theme-primary text-theme-primaryBtn hover:bg-theme-primaryHover" asChild>
                    <Link href="/sign-up">
                      Get started
                      <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                    </Link>
                  </Button>
                  <Button variant="outline" size="md" className="w-full sm:w-auto border-theme-divider text-theme-text hover:bg-theme-panel" asChild>
                    <Link href="/sign-in">Sign in</Link>
                  </Button>
                </>
              )}
            </div>

            {/* Architecture Overview Card */}
            <div className="pt-10 max-w-4xl mx-auto">
              <div className="rounded-xl border border-theme-divider bg-theme-panel p-6 text-left shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-theme-divider pb-4 mb-5">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-theme-muted" strokeWidth={1.5} />
                    <span className="font-medium text-sm text-theme-text">Retrieval pipeline</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-theme-muted">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                    <span>pgvector active • Gemini 3.8 Flash</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3.5 rounded-lg bg-theme-body border border-theme-divider space-y-1">
                    <span className="font-medium text-theme-text block">1. Ingest and parse</span>
                    <p className="text-theme-muted">PDF, DOCX, TXT, CSV parsing with layout and table extraction.</p>
                  </div>
                  <div className="p-3.5 rounded-lg bg-theme-body border border-theme-divider space-y-1">
                    <span className="font-medium text-theme-text block">2. Chunk and embed</span>
                    <p className="text-theme-muted">Sliding-window token chunks embedded into 768-dim vectors.</p>
                  </div>
                  <div className="p-3.5 rounded-lg bg-theme-body border border-theme-divider space-y-1">
                    <span className="font-medium text-theme-text block">3. Similarity search</span>
                    <p className="text-theme-muted">Cosine distance lookup scoped to authenticated user documents.</p>
                  </div>
                  <div className="p-3.5 rounded-lg bg-theme-body border border-theme-divider space-y-1">
                    <span className="font-medium text-theme-text block">4. Synthesize and cite</span>
                    <p className="text-theme-muted">Grounded answers returned with verifiable page and paragraph tags.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Capabilities */}
        <section id="features" className="py-16 border-t border-theme-divider bg-theme-panel">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
              <Badge variant="secondary" className="font-normal text-xs">Capabilities</Badge>
              <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-theme-text">
                Built for precision, transparency, and scale
              </h2>
              <p className="text-theme-muted text-sm">
                Multi-format extraction pipelines with PostgreSQL vector embeddings to deliver answers you can verify.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <Card key={feature.title} className="p-5 space-y-2 border-theme-divider bg-theme-panel shadow-2xs">
                    <div className="h-8 w-8 rounded-md bg-theme-body border border-theme-divider text-theme-primary flex items-center justify-center mb-2">
                      <Icon className="w-4 h-4" strokeWidth={1.5} />
                    </div>
                    <CardTitle className="text-sm font-medium text-theme-text">{feature.title}</CardTitle>
                    <CardDescription className="text-xs leading-relaxed text-theme-muted">
                      {feature.description}
                    </CardDescription>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Pipeline Steps */}
        <section id="how-it-works" className="py-16 border-t border-theme-divider bg-theme-body">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
              <Badge variant="secondary" className="font-normal text-xs">Pipeline</Badge>
              <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-theme-text">How DocuMind works</h2>
              <p className="text-theme-muted text-sm">
                From raw document to cited intelligence in four transparent stages.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {WORKFLOW_STEPS.map((step) => (
                <div key={step.step} className="p-5 rounded-xl bg-theme-panel border border-theme-divider space-y-2 shadow-2xs">
                  <span className="text-xs font-mono font-medium text-theme-muted tabular-nums">{step.step}</span>
                  <h3 className="font-medium text-sm text-theme-text">{step.title}</h3>
                  <p className="text-xs text-theme-muted leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Security & Isolation */}
        <section id="security" className="py-16 border-t border-theme-divider bg-theme-panel">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-xl border border-theme-divider bg-theme-body p-6 sm:p-8">
              <div className="max-w-2xl space-y-4">
                <Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-normal text-xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.5} />
                  Security and isolation
                </Badge>
                <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-theme-text">
                  Tenant isolation by design
                </h2>
                <p className="text-sm text-theme-muted leading-relaxed">
                  DocuMind strictly enforces user and organization boundary controls across all storage and query layers:
                </p>

                <ul className="space-y-2.5 text-xs text-theme-muted">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" strokeWidth={1.5} />
                    <span><strong className="font-medium text-theme-text">User-level isolation:</strong> Every database query and vector similarity lookup is strictly filtered by the authenticated user ID or active permission grants.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" strokeWidth={1.5} />
                    <span><strong className="font-medium text-theme-text">Zero cross-tenant leakage:</strong> Document chunks, vectors, and chat histories cannot be accessed by unauthorized users under any circumstances.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" strokeWidth={1.5} />
                    <span><strong className="font-medium text-theme-text">Granular permissions:</strong> Share specific documents with individual users with read or write rights while preserving complete privacy for the rest of your vault.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 border-t border-theme-divider bg-theme-body text-center">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
            <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-theme-text">
              Ready to interact with your documents?
            </h2>
            <p className="text-theme-muted text-sm max-w-lg mx-auto">
              Extract insights, summarize long reports, and compare documents with verifiable accuracy.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              {isLoaded && isSignedIn ? (
                <Button size="md" className="w-full sm:w-auto gap-2 bg-theme-primary text-theme-primaryBtn hover:bg-theme-primaryHover" asChild>
                  <Link href="/dashboard">
                    Launch workspace
                    <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                  </Link>
                </Button>
              ) : (
                <Button size="md" className="w-full sm:w-auto gap-2 bg-theme-primary text-theme-primaryBtn hover:bg-theme-primaryHover" asChild>
                  <Link href="/sign-up">
                    Get started
                    <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
