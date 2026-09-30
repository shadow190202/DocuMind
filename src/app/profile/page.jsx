"use client";

import React from "react";
import Link from "next/link";
import { UserProfile } from "@clerk/nextjs";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function ProfilePage() {
  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 w-full overflow-y-auto flex flex-col">
        <header className="min-h-16 h-auto py-3 px-4 sm:px-6 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
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

        <div className="p-4 sm:p-6 md:p-8 flex justify-center max-w-5xl mx-auto w-full">
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
