import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getExtractedData } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * GET /api/documents/:id/text
 * Retrieves the extracted text, pages, and metadata for a processed document.
 */
export async function GET(req, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: "Document ID required" }, { status: 400 });
    }

    // 1. Verify ownership
    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.userId, userId)));

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found or access denied." },
        { status: 404 }
      );
    }

    // 2. Fetch extracted data from storage
    const extractedData = await getExtractedData(id, userId);

    if (!extractedData) {
      return NextResponse.json({
        document: {
          id: doc.id,
          filename: doc.filename,
          fileType: doc.fileType,
          processingStatus: doc.processingStatus,
          errorMessage: doc.errorMessage,
        },
        extracted: null,
        message: "No extracted text available for this document yet.",
      });
    }

    return NextResponse.json({
      document: {
        id: doc.id,
        filename: doc.filename,
        fileType: doc.fileType,
        processingStatus: doc.processingStatus,
        errorMessage: doc.errorMessage,
        fileSize: doc.fileSize,
        createdAt: doc.createdAt,
      },
      extracted: extractedData,
    });
  } catch (error) {
    console.error("GET /api/documents/:id/text error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching document text." },
      { status: 500 }
    );
  }
}
