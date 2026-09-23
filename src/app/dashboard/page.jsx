"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  FileText,
  Upload,
  MessageSquare,
  Sparkles,
  HardDrive,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Search,
  Filter,
} from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function DashboardPage() {
  const [filterQuery, setFilterQuery] = useState("");

  const sampleRecentDocs = [
    {
      name: "Q3_Financial_Review.pdf",
      size: "2.4 MB",
      type: "PDF",
      pages: 38,
      status: "completed",
      updated: "10 mins ago",
    },
    {
      name: "Vendor_Master_Service_Agreement.docx",
      size: "840 KB",
      type: "DOCX",
      pages: 14,
      status: "completed",
      updated: "2 hours ago",
    },
    {
      name: "Product_Roadmap_2026.csv",
      size: "120 KB",
      type: "CSV",
      pages: 1,
      status: "completed",
      updated: "Yesterday",
    },
  ];

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="h-16 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Workspace Dashboard
            </h1>
            <Badge variant="secondary" className="text-[11px]">
              Phase 2 Layout Preview
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link href="/">Back to Landing Page</Link>
            </Button>
            <Button size="sm" className="gap-1.5" asChild>
              <Link href="/documents/upload">
                <Upload className="w-4 h-4" />
                Upload Document
              </Link>
            </Button>
          </div>
        </header>

        {/* Dashboard Body */}
        <div className="p-6 md:p-8 space-y-8 max-w-7xl w-full mx-auto">
          {/* Welcome Banner */}
          <div className="rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6 sm:p-8 text-white shadow-md">
            <div className="max-w-2xl space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-200">
                AI Knowledge Assistant
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Welcome to DocuMind
              </h2>
              <p className="text-sm text-blue-100 leading-relaxed">
                Your frontend foundation is configured and ready. In upcoming phases, you will be able to upload real documents, process them into pgvector chunks, and ask conversational AI questions.
              </p>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-slate-500">Total Documents</CardTitle>
                <FileText className="w-4 h-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">3</div>
                <p className="text-[10px] text-slate-400 mt-1">PDF, DOCX, CSV ingested</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-slate-500">Vector Chunks</CardTitle>
                <HardDrive className="w-4 h-4 text-indigo-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">294</div>
                <p className="text-[10px] text-slate-400 mt-1">Indexed in pgvector</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-slate-500">Questions Answered</CardTitle>
                <MessageSquare className="w-4 h-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">18</div>
                <p className="text-[10px] text-slate-400 mt-1">100% cited with page numbers</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-slate-500">Retrieval Accuracy</CardTitle>
                <TrendingUp className="w-4 h-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">98.6%</div>
                <p className="text-[10px] text-slate-400 mt-1">Cosine similarity score</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Documents Table Preview */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Recent Documents</CardTitle>
                <CardDescription>Documents indexed and ready for semantic AI querying.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-48 sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <Input
                    placeholder="Search documents..."
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {sampleRecentDocs.map((doc) => (
                  <div key={doc.name} className="py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/50 px-2 rounded-lg transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate text-slate-900 dark:text-slate-100">
                          {doc.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {doc.type} • {doc.size} • {doc.pages} {doc.pages === 1 ? "page" : "pages"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <Badge variant="success" className="text-[10px]">
                        {doc.status}
                      </Badge>
                      <span className="hidden sm:inline text-xs text-slate-400">
                        {doc.updated}
                      </span>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href="/chat">
                          Chat
                          <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
