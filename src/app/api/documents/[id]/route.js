import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { deleteFile, deleteExtractedData } from "@/lib/storage";
import {
  verifyDocumentAccess,
  toClientSafeDocument,
} from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

/**
 * GET /api/documents/:id
 * Retrieves document details for an authorized viewer, editor, or owner.
 * Server-only data safety: storageUrl is stripped.
 */
export async function GET(req, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const id = resolvedParams?.id || params?.id;
    if (!id) {
      return NextResponse.json({ error: "Document ID required" }, { status: 400 });
    }

    const access = await verifyDocumentAccess({
      documentId: id,
      userId,
      requiredPermission: "read",
    });

    if (!access.authorized) {
      return access.errorResponse;
    }

    return NextResponse.json({
      document: toClientSafeDocument(access.document, access),
    });
  } catch (error) {
    console.error("GET /api/documents/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching document." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents/:id
 * Deletes a document, its physical storage, extracted data, and DB cascades.
 * Strictly restricted to the document OWNER.
 */
export async function DELETE(req, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const id = resolvedParams?.id || params?.id;
    if (!id) {
      return NextResponse.json({ error: "Document ID required" }, { status: 400 });
    }

    // Owner authorization strictly required
    const access = await verifyDocumentAccess({
      documentId: id,
      userId,
      requiredPermission: "owner",
    });

    if (!access.authorized) {
      return access.errorResponse;
    }

    const doc = access.document;

    // Delete from storage using owner storage path
    if (doc.storageUrl) {
      await deleteFile(doc.storageUrl);
    }
    await deleteExtractedData(id, doc.userId);

    // Delete from database (cascades to chunks, permissions, summaries, comparisons)
    await db.delete(documents).where(eq(documents.id, id));

    return NextResponse.json({
      message: "Document deleted successfully.",
      id,
    });
  } catch (error) {
    console.error("DELETE /api/documents/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error deleting document." },
      { status: 500 }
    );
  }
}
