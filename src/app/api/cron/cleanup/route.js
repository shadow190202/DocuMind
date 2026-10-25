import { NextResponse } from "next/server";
import { cleanupExpiredDocuments } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/cleanup
 * Automated cleanup endpoint triggered hourly by Vercel Cron.
 * Purges documents whose 24-hour retention lifecycle has elapsed.
 */
export async function GET() {
  try {
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
