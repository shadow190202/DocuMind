"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  FileText,
  Sparkles,
  Database,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  UploadCloud,
  Search,
  MessageSquare,
  GitCompare,
  Layers,
  Lock,
  ChevronRight,
  BookOpen,
  FileSearch,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

export default function HomePage() {
  const [demoDialogOpen, setDemoDialogOpen] = useState(false);
  const [searchDemo, setSearchDemo] = useState("");
  const [selectedFormat, setSelectedFormat] = useState("PDF");

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
    <div className="min-h-screen flex flex-col bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-x-hidden">
      {/* Navbar */}
      <Navbar />

      <main className="flex-1">
        {/* ============================================================ */}
        {/* 1. HERO SECTION */}
        {/* ============================================================ */}
        <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-32">
          {/* Subtle background glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] max-w-full bg-gradient-to-tr from-blue-500/10 via-indigo-500/10 to-purple-500/10 blur-3xl -z-10 rounded-full pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
            {/* Version Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900 shadow-sm animate-in fade-in">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>DocuMind v1.0 — AI Document Intelligence Platform</span>
            </div>

            {/* Headline */}
            <div className="space-y-4 max-w-4xl mx-auto">
              <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.15]">
                Turn Static Documents into an{" "}
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Interactive Knowledge Base
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
                Upload PDFs, DOCX, TXT, and CSV files. Ask natural-language questions, receive hallucination-free answers backed by verifiable page-level citations, and compare documents effortlessly.
              </p>
            </div>

            {/* CTA Group */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              {isLoaded && isSignedIn ? (
                <Button size="lg" className="w-full sm:w-auto gap-2 shadow-md shadow-blue-500/20" asChild>
                  <Link href="/dashboard">
                    Open Workspace
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button size="lg" className="w-full sm:w-auto gap-2 shadow-md shadow-blue-500/20" asChild>
                    <Link href="/sign-up">
                      Get Started Free
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </Button>
                  <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2" asChild>
                    <Link href="/sign-in">
                      Sign In to Account
                    </Link>
                  </Button>
                </>
              )}

              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto gap-2"
                onClick={() => setDemoDialogOpen(true)}
              >
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Interactive Product Tour
              </Button>
            </div>

            {/* Supported Document Types Ticker */}
            <div className="pt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Supported Formats:</span>
              {["PDF", "DOCX", "TXT", "CSV"].map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setSelectedFormat(fmt)}
                  className={`px-2.5 py-1 rounded-md font-mono border transition-all ${
                    selectedFormat === fmt
                      ? "bg-blue-600 text-white border-blue-600 font-bold"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-400"
                  }`}
                >
                  .{fmt.toLowerCase()}
                </button>
              ))}
            </div>

            {/* ============================================================ */}
            {/* HERO VISUAL MOCKUP: RAG Q&A WITH CITATIONS */}
            {/* ============================================================ */}
            <div className="pt-10 max-w-5xl mx-auto">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-2xl overflow-hidden backdrop-blur-md">
                {/* Browser-style Chrome bar */}
                <div className="h-10 px-4 bg-slate-100 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400/80" />
                    <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
                  </div>
                  <div className="text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-emerald-500" />
                    documind.app/dashboard/chat
                  </div>
                  <div className="text-xs text-slate-400">pgvector RAG session</div>
                </div>

                {/* Mockup Content Grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 min-h-[380px] text-left">
                  {/* Left Column: Uploaded Document Context */}
                  <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 p-5 bg-slate-50/50 dark:bg-slate-950/40 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Document</span>
                      <Badge variant="success" className="text-[10px]">Indexed</Badge>
                    </div>

                    <div className="p-3.5 rounded-xl border border-blue-200/80 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-950/30 flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-blue-600 text-white shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">FY2026_Q3_Financial_Review.pdf</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">38 Pages • 248 Chunks • 768-dim (pgvector)</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-500">Document Highlights</p>
                      <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
                        <span className="font-semibold text-slate-900 dark:text-slate-200">Executive Summary:</span> Revenue grew 24% YoY with gross margins expanding 320 bps.
                      </div>
                      <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
                        <span className="font-semibold text-slate-900 dark:text-slate-200">Risk Factors:</span> Supply chain lead times extended by 18 days in APAC region.
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Grounded AI Q&A with Citations */}
                  <div className="md:col-span-8 p-6 flex flex-col justify-between space-y-6">
                    <div className="space-y-4">
                      {/* User Message */}
                      <div className="flex items-start gap-3 justify-end">
                        <div className="max-w-md rounded-2xl rounded-tr-sm bg-blue-600 text-white px-4 py-3 text-sm shadow-sm">
                          What was the operating margin in Q3, and what caused the expansion?
                        </div>
                      </div>

                      {/* AI Response with Source Citations */}
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div className="max-w-lg space-y-3">
                          <div className="rounded-2xl rounded-tl-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-sm space-y-2 shadow-sm">
                            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                              In Q3 FY2026, the operating margin reached <strong className="text-blue-600 dark:text-blue-400">28.4%</strong>, representing a 320 basis point expansion year-over-year.
                            </p>
                            <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-xs">
                              The primary drivers cited include:
                            </p>
                            <ul className="list-disc pl-4 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                              <li>Automated cloud optimization reducing infrastructure overhead by 14%.</li>
                              <li>Shift toward enterprise recurring contracts with higher gross margins.</li>
                            </ul>

                            {/* Citations Box */}
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                Verified Citations:
                              </span>
                              <Badge variant="outline" className="text-[10px] gap-1 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">
                                <BookOpen className="w-3 h-3 text-blue-500" />
                                Page 14, ¶ 3 (Score: 0.94)
                              </Badge>
                              <Badge variant="outline" className="text-[10px] gap-1 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">
                                <BookOpen className="w-3 h-3 text-blue-500" />
                                Page 19, Table 4.1
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Chat Input Bar Mock */}
                    <div className="relative pt-2">
                      <Input
                        placeholder="Ask anything about this document..."
                        value={searchDemo}
                        onChange={(e) => setSearchDemo(e.target.value)}
                        className="pr-12 text-xs sm:text-sm h-11 bg-slate-50 dark:bg-slate-950"
                      />
                      <Button size="icon" className="absolute right-1 bottom-1 h-9 w-9">
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 2. CORE FEATURES & CONCEPTS */}
        {/* ============================================================ */}
        <section id="features" className="py-20 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
              <Badge variant="secondary">Core Capabilities</Badge>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Built for Precision, Transparency, and Scale
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
                DocuMind combines modern text extraction pipelines with PostgreSQL vector embeddings to deliver answers you can trust and verify.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Concept 1: Ingestion & Extraction */}
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <CardTitle>Multi-Format Ingestion</CardTitle>
                  <CardDescription>
                    Native parsing for PDF, DOCX, TXT, and CSV documents with metadata preservation and structure awareness.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-slate-500 space-y-2">
                  <p>• Automated text chunking with sliding window overlap.</p>
                  <p>• Robust handling of document tables and structured CSV rows.</p>
                  <p>• Status indicators: Pending → Processing → Completed.</p>
                </CardContent>
              </Card>

              {/* Concept 2: Vector Search & Citations */}
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="h-12 w-12 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
                    <Database className="w-6 h-6" />
                  </div>
                  <CardTitle>Vector Search & Citations</CardTitle>
                  <CardDescription>
                    PostgreSQL with pgvector performs semantic similarity lookups across thousands of chunks in milliseconds.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-slate-500 space-y-2">
                  <p>• Cosine distance ranking ensures top context relevance.</p>
                  <p>• Every answer links directly to the exact page and paragraph.</p>
                  <p>• Zero hallucinations: AI strictly relies on retrieved source chunks.</p>
                </CardContent>
              </Card>

              {/* Concept 3: Multi-Document Knowledge & Comparison */}
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="h-12 w-12 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4">
                    <GitCompare className="w-6 h-6" />
                  </div>
                  <CardTitle>Document Comparison</CardTitle>
                  <CardDescription>
                    Select two documents and generate instant comparative intelligence highlighting key differences and agreements.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-slate-500 space-y-2">
                  <p>• Contrast contract revisions, proposals, or annual reports.</p>
                  <p>• Automated extraction of key dates, metrics, and action items.</p>
                  <p>• Side-by-side discrepancy identification.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 3. HOW IT WORKS (STEPPER) */}
        {/* ============================================================ */}
        <section id="how-it-works" className="py-20 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
              <Badge variant="secondary">The Workflow</Badge>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">How DocuMind Works</h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
                From raw file to grounded intelligence in four transparent steps.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
              <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm">
                  1
                </div>
                <h3 className="font-semibold text-base">Secure Upload</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Upload PDF, DOCX, TXT, or CSV files. Files are verified for type and size, stored securely, and tied to your user ID.
                </p>
              </div>

              <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm">
                  2
                </div>
                <h3 className="font-semibold text-base">Text Chunking</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Documents are extracted and split into semantic chunks with context-preserving overlaps and page tracking.
                </p>
              </div>

              <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm">
                  3
                </div>
                <h3 className="font-semibold text-base">Vector Embeddings</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Mathematical embeddings are generated for each chunk and indexed inside PostgreSQL with the pgvector extension.
                </p>
              </div>

              <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm">
                  4
                </div>
                <h3 className="font-semibold text-base">Grounded RAG</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Your question retrieves the closest matching chunks. The AI answers exclusively with that context and cites every claim.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 4. SECURITY & DATA ISOLATION */}
        {/* ============================================================ */}
        <section id="security" className="py-20 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 p-8 sm:p-12 overflow-hidden shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-6">
                  <Badge variant="outline" className="gap-1.5 border-emerald-300 text-emerald-700 dark:text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    Enterprise Security Standard
                  </Badge>
                  <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                    Your Documents Remain Strictly Private
                  </h2>
                  <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                    DocuMind is engineered with a strict principle: <strong>A user must never be able to retrieve documents or chunks belonging to another user.</strong>
                  </p>

                  <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span><strong>User-Level Isolation:</strong> Every database and vector search query filters strictly by authenticated user ID.</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span><strong>Granular Permissions:</strong> Share documents explicitly with read or write permissions without leaking private vaults.</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span><strong>Role-Based Access:</strong> Administrator controls for system health monitoring without compromising user confidentiality.</span>
                    </li>
                  </ul>
                </div>

                <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <span className="text-xs font-semibold uppercase text-slate-400">Vector Isolation Policy</span>
                    <Badge variant="success" className="text-[10px]">Active</Badge>
                  </div>
                  <div className="font-mono text-xs p-3 rounded-lg bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-300 space-y-1 overflow-x-auto">
                    <p className="text-blue-600 dark:text-blue-400">SELECT content, page_number, 1 - (embedding &lt;=&gt; query_vector) AS score</p>
                    <p className="text-slate-500">FROM document_chunks</p>
                    <p className="text-emerald-600 dark:text-emerald-400">WHERE document_id IN (SELECT id FROM documents WHERE user_id = :auth_user)</p>
                    <p className="text-purple-600 dark:text-purple-400">ORDER BY embedding &lt;=&gt; query_vector LIMIT 4;</p>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Enforced at SQL query level: No vector search executes without authenticated tenant scoping.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 5. CALL TO ACTION SECTION */}
        {/* ============================================================ */}
        <section className="py-20 border-t border-slate-200 dark:border-slate-800 text-center">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Ready to Interact with Your Documents?
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-base max-w-xl mx-auto">
              DocuMind empowers you to extract answers, summarize agreements, and compare complex documents with verifiable accuracy.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
              {isLoaded && isSignedIn ? (
                <>
                  <Button size="lg" className="w-full sm:w-auto gap-2 shadow-lg shadow-blue-500/25" asChild>
                    <Link href="/dashboard">
                      Launch DocuMind Workspace
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto gap-2"
                    asChild
                  >
                    <Link href="/documents">
                      Browse Document Vault
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button size="lg" className="w-full sm:w-auto gap-2 shadow-lg shadow-blue-500/25" asChild>
                    <Link href="/sign-up">
                      Get Started Free
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto gap-2"
                    asChild
                  >
                    <Link href="/sign-in">
                      Sign In to Account
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer />

      {/* ============================================================ */}
      {/* INTERACTIVE PRODUCT TOUR MODAL (Verifiable Grounded Citations) */}
      {/* ============================================================ */}
      <Dialog open={demoDialogOpen} onOpenChange={setDemoDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1 text-blue-600 dark:text-blue-400">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Product Tour</span>
            </div>
            <DialogTitle>Grounded RAG with Verifiable Citations</DialogTitle>
            <DialogDescription>
              Every answer generated in DocuMind is strictly anchored to your uploaded document passages with zero hallucinations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Context Header */}
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5 truncate">
                <div className="p-1.5 rounded-lg bg-blue-600 text-white shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                    Enterprise_Service_Agreement_2026.pdf
                  </p>
                  <p className="text-[10px] text-slate-400">pgvector chunking • 768-dim embeddings</p>
                </div>
              </div>
              <Badge variant="success" className="text-[10px] shrink-0">Indexed</Badge>
            </div>

            {/* Q&A Simulation */}
            <div className="space-y-2.5">
              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/40 text-blue-900 dark:text-blue-200">
                <span className="font-semibold text-[11px] uppercase tracking-wide text-blue-600 dark:text-blue-400 block mb-1">
                  Sample Query:
                </span>
                &quot;What is the maximum liability limit and indemnification exception?&quot;
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 text-slate-700 dark:text-slate-300 leading-relaxed shadow-xs">
                <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold text-[11px]">
                  <Sparkles className="w-3.5 h-3.5" />
                  DocuMind Synthesized Answer
                </div>
                <p>
                  Total cumulative liability is capped at <strong>2x the annual contract value</strong> for standard breaches{" "}
                  <Badge variant="secondary" className="text-[9px] py-0 px-1 font-mono align-baseline">
                    # SOURCE 1
                  </Badge>
                  . Gross negligence, willful misconduct, and confidentiality breaches are expressly uncapped{" "}
                  <Badge variant="secondary" className="text-[9px] py-0 px-1 font-mono align-baseline">
                    # SOURCE 2
                  </Badge>
                  .
                </p>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-[10px] text-slate-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Cross-checked against Section 14.1 & 14.3 (95.8% similarity score)</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button variant="outline">Close Tour</Button>
            </DialogClose>
            {isLoaded && isSignedIn ? (
              <Button size="md" className="gap-1.5 shadow-sm" asChild>
                <Link href="/dashboard">
                  Explore Workspace
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            ) : (
              <Button size="md" className="gap-1.5 shadow-sm" asChild>
                <Link href="/sign-up">
                  Get Started Free
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
