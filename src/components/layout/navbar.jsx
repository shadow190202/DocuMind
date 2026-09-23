"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Sparkles, Menu, X, ArrowRight, LayoutDashboard } from "lucide-react";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function Navbar({ onOpenDemoModal }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/80 transition-colors">
      <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 font-bold text-xl tracking-tight group">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/30 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5" />
          </div>
          <span>
            Docu<span className="text-blue-600 dark:text-blue-500">Mind</span>
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-300">
          <a href="#features" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            Features
          </a>
          <a href="#how-it-works" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            How It Works
          </a>
          <a href="#architecture" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            Architecture
          </a>
          <a href="#security" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            Security
          </a>
        </nav>

        {/* Action Buttons with Clerk Auth State */}
        <div className="hidden md:flex items-center gap-3">
          {onOpenDemoModal && (
            <Button variant="ghost" size="sm" onClick={onOpenDemoModal}>
              Preview Modal
            </Button>
          )}

          {/* Shown when user is logged out */}
          <SignedOut>
            <Button variant="outline" size="sm" asChild>
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button size="sm" className="gap-1.5 shadow-sm" asChild>
              <Link href="/sign-up">
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </SignedOut>

          {/* Shown when user is logged in */}
          <SignedIn>
            <Button size="sm" variant="outline" className="gap-1.5" asChild>
              <Link href="/dashboard">
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
            </Button>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "h-9 w-9",
                },
              }}
            />
          </SignedIn>
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex md:hidden items-center gap-3">
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md px-4 pt-3 pb-6 space-y-3 animate-in slide-in-from-top-2">
          <nav className="flex flex-col space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              How It Works
            </a>
            <a
              href="#architecture"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Architecture
            </a>
            <a
              href="#security"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Security
            </a>
          </nav>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
            <SignedOut>
              <Button variant="outline" className="w-full justify-center" asChild>
                <Link href="/sign-in" onClick={() => setMobileMenuOpen(false)}>
                  Sign In
                </Link>
              </Button>
              <Button className="w-full justify-center gap-1.5" asChild>
                <Link href="/sign-up" onClick={() => setMobileMenuOpen(false)}>
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </SignedOut>
            <SignedIn>
              <Button className="w-full justify-center gap-1.5" asChild>
                <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Link>
              </Button>
            </SignedIn>
          </div>
        </div>
      )}
    </header>
  );
}
