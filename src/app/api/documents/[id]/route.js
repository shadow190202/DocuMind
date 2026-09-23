import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { deleteFile, deleteExtractedData } from "@/lib/storage";

export const dynamic = "force-dynamic";

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

    return NextResponse.json({ document: doc });
  } catch (error) {
    console.error("GET /api/documents/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching document." },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: "Document ID required" }, { status: 400 });
    }

    // Retrieve document to get storageUrl and verify ownership
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

    // Delete from storage
    if (doc.storageUrl) {
      await deleteFile(doc.storageUrl);
    }
    await deleteExtractedData(id, userId);

    // Delete from database (cascades to chunks and permissions)
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
