"use client";

import React from "react";
import Link from "next/link";
import { UserProfile } from "@clerk/nextjs";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function ProfilePage() {
  return (
    <DashboardLayout>
      <header className="min-h-16 h-auto py-3 px-4 sm:px-6 shrink-0 border-b border-theme-divider bg-theme-panel/80 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard" className="gap-1.5 text-xs text-theme-muted">
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Link>
            </Button>
            <h1 className="text-base font-bold text-theme-text">
              Account Profile & Security
            </h1>
          </div>
        </header>

        <div className="p-4 sm:p-6 md:p-8 flex justify-center max-w-5xl mx-auto w-full">
          <UserProfile
            appearance={{
              elements: {
                rootBox: "w-full shadow-md rounded-2xl border border-theme-divider bg-theme-panel text-theme-text",
                card: "border-none shadow-none rounded-2xl bg-theme-panel text-theme-text",
              },
            }}
          />
        </div>
    </DashboardLayout>
  );
}
