import { NextResponse } from "next/server";
import { cleanupExpiredDocuments } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/cleanup
 * Automated cron endpoint triggered hourly by Vercel Cron.
 * Purges documents whose 3-hour retention lifecycle has elapsed.
 */
export async function GET(req) {
  try {
    // Authenticate cron trigger via CRON_SECRET if configured or running in production
    const isProd = process.env.NODE_ENV === "production";
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret || isProd) {
      const authHeader = req.headers.get("authorization");
      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { error: "Unauthorized: Invalid or missing cron secret." },
          { status: 401 }
        );
      }
    }

    const startTime = Date.now();
    const result = await cleanupExpiredDocuments();
    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${result.cleanedCount} expired document(s).`,
      cleanedCount: result.cleanedCount,
      errors: result.errors,
      durationMs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron document cleanup failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to execute cron cleanup.",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
