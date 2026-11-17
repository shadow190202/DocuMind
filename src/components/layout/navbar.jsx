"use client";

import React from "react";
import Link from "next/link";
import { FileText, Menu, X, ArrowRight, LayoutDashboard } from "lucide-react";
import { useAuth, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function Navbar() {
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
    <header className="sticky top-0 z-40 w-full border-b border-theme-divider bg-theme-panel/95 backdrop-blur-md text-theme-text transition-colors">
      <div className="max-w-7xl mx-auto flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-base tracking-tight text-theme-text">
          <div className="h-7 w-7 rounded-md bg-theme-text flex items-center justify-center text-theme-panel shadow-xs">
            <FileText className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <span className="text-theme-text">
            Docu<span className="text-theme-primary">Mind</span>
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-theme-muted">
          <a href="#features" className="hover:text-theme-text transition-colors">
            Features
          </a>
          <a href="#how-it-works" className="hover:text-theme-text transition-colors">
            Pipeline
          </a>
          <a href="#security" className="hover:text-theme-text transition-colors">
            Security
          </a>
        </nav>

        {/* Action Buttons */}
        <div className="hidden md:flex items-center gap-3">
          {isLoaded && isSignedIn ? (
            <>
              <Button
                size="sm"
                className="bg-theme-body text-theme-text border border-theme-divider hover:bg-theme-divider gap-1.5 shadow-2xs"
                asChild
              >
                <Link href="/dashboard">
                  <LayoutDashboard className="w-3.5 h-3.5 text-theme-muted" strokeWidth={1.5} />
                  Workspace
                </Link>
              </Button>
              <UserButton afterSignOutUrl="/" />
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button size="sm" className="gap-1.5" asChild>
                <Link href="/sign-up">
                  Get started
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                </Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile Header Right Section */}
        <div className="flex md:hidden items-center gap-2">
          {isLoaded && isSignedIn ? (
            <UserButton afterSignOutUrl="/" />
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild className="text-xs px-2.5 h-8">
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button size="sm" asChild className="text-xs px-3 h-8">
                <Link href="/sign-up">Sign up</Link>
              </Button>
            </>
          )}
          <button
            type="button"
            popovertarget="navbar-mobile-menu"
            className="p-1.5 rounded-lg text-theme-muted hover:text-theme-text hover:bg-theme-body transition-colors"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu (Native HTML Popover API) */}
      <div
        id="navbar-mobile-menu"
        popover="auto"
        className="fixed top-14 inset-x-0 w-full border-b border-theme-divider bg-theme-panel px-4 pt-2 pb-4 space-y-2 shadow-xl m-0 md:hidden backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      >
        <nav className="flex flex-col space-y-1 text-sm font-medium text-theme-text">
          <a
            href="#features"
            className="px-3 py-2 rounded-lg hover:bg-theme-body transition-colors"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="px-3 py-2 rounded-lg hover:bg-theme-body transition-colors"
          >
            Pipeline
          </a>
          <a
            href="#security"
            className="px-3 py-2 rounded-lg hover:bg-theme-body transition-colors"
          >
            Security
          </a>
        </nav>
        {isLoaded && isSignedIn && (
          <div className="pt-2 border-t border-theme-divider">
            <Button
              size="sm"
              className="w-full bg-theme-body text-theme-text border border-theme-divider hover:bg-theme-divider gap-1.5 justify-center shadow-2xs"
              asChild
            >
              <Link href="/dashboard">
                <LayoutDashboard className="w-3.5 h-3.5 text-theme-muted" strokeWidth={1.5} />
                Workspace
              </Link>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}

export default Navbar;
