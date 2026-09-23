"use client";

import React from "react";
import Link from "next/link";
import { UserProfile } from "@clerk/nextjs";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function ProfilePage() {
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-16 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard" className="gap-1.5 text-xs text-slate-500">
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Link>
            </Button>
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Account Profile & Security
            </h1>
          </div>
        </header>

        <div className="p-6 md:p-8 flex justify-center max-w-5xl mx-auto w-full">
          <UserProfile
            appearance={{
              elements: {
                rootBox: "w-full shadow-md rounded-2xl border border-slate-200 dark:border-slate-800",
                card: "border-none shadow-none rounded-2xl",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
