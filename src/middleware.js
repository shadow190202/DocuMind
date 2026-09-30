import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { parseE2ETestSession } from "./lib/auth/e2e-session.js";

// Define public routes that do not require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/health",
  "/api/webhooks(.*)",
  "/__clerk(.*)",
]);

// Define administrative routes for role check foundation
const isAdminRoute = createRouteMatcher([
  "/admin(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // Controlled E2E Test Session Bypass (Active ONLY when DOCUMIND_E2E_MODE is explicitly enabled)
  if (
    process.env.DOCUMIND_E2E_MODE === "enabled" &&
    process.env.DOCUMIND_E2E_SECRET &&
    process.env.DOCUMIND_E2E_SECRET.length >= 16
  ) {
    const e2eSession = await parseE2ETestSession(req);
    if (e2eSession?.userId) {
      if (isAdminRoute(req) && e2eSession.role !== "admin") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
      return NextResponse.next();
    }
  }

  // If the user is trying to access a protected route and is unauthenticated, redirect to sign-in
  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  // Foundation for role-based admin authorization
  if (isAdminRoute(req)) {
    const { sessionClaims } = await auth();
    const role = sessionClaims?.metadata?.role || sessionClaims?.role;
    if (role !== "admin") {
      const dashboardUrl = new URL("/dashboard", req.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  const response = NextResponse.next();

  // Production-aware HSTS:
  // Strictly enforce HSTS ONLY when running in production AND served over HTTPS.
  // In development, HSTS is omitted to ensure seamless http://localhost:3000 operation.
  const isProd = process.env.NODE_ENV === "production";
  const isHttps = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";

  if (isProd && isHttps) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  return response;
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    // Always run for Clerk proxy routes (needed for Vercel production domain verification)
    "/__clerk/:path*",
  ],
};
