"use client";

import React from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export default function AdminDashboardPage() {
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-16 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-purple-700 dark:text-purple-400">Admin Console</h1>
            <Badge variant="secondary" className="border-purple-200 text-purple-700 dark:border-purple-800 dark:text-purple-300">
              Role: Admin Only
            </Badge>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard" className="gap-1.5">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
          </Button>
        </header>

        <div className="p-6 md:p-8 max-w-4xl mx-auto w-full space-y-6">
          <Card className="border-purple-200 dark:border-purple-900/40">
            <CardHeader>
              <CardTitle className="text-purple-900 dark:text-purple-300">
                Administration Portal (Phase 14)
              </CardTitle>
              <CardDescription>
                Role-based protected route. Access is restricted to users with `admin` metadata in Clerk.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-12 text-center border-2 border-dashed border-purple-200 dark:border-purple-900/40 rounded-2xl space-y-3">
                <ShieldAlert className="w-12 h-12 text-purple-500 mx-auto" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Role Authorization Foundation Active
                </p>
                <p className="text-xs text-slate-500">
                  System telemetry, user management, and AI usage monitoring will be implemented in Phase 14.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
