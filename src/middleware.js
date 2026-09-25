import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define public routes that do not require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

// Define administrative routes for role check foundation
const isAdminRoute = createRouteMatcher([
  "/admin(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
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
  ],
};
