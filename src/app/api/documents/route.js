import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { documents, documentPermissions, users } from "@/db/schema";
import { eq, and, or, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/documents
 * Retrieves all documents accessible to the authenticated user:
 * - Documents owned by the user (role: 'owner')
 * - Documents shared with the user via document_permissions (role: 'write' or 'read')
 *
 * Server-only data safety: storageUrl is strictly omitted from client responses.
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!db) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      );
    }

    const rawDocs = await db
      .select({
        id: documents.id,
        filename: documents.filename,
        fileType: documents.fileType,
        fileSize: documents.fileSize,
        processingStatus: documents.processingStatus,
        errorMessage: documents.errorMessage,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
        ownerId: documents.userId,
        ownerName: users.name,
        ownerEmail: users.email,
        sharedPermission: documentPermissions.permission,
      })
      .from(documents)
      .leftJoin(users, eq(users.id, documents.userId))
      .leftJoin(
        documentPermissions,
        and(
          eq(documentPermissions.documentId, documents.id),
          eq(documentPermissions.userId, userId)
        )
      )
      .where(
        or(
          eq(documents.userId, userId),
          eq(documentPermissions.userId, userId)
        )
      )
      .orderBy(desc(documents.createdAt));

    const userDocs = rawDocs.map((doc) => {
      const isOwner = doc.ownerId === userId;
      const role = isOwner ? "owner" : doc.sharedPermission || "read";
      return {
        id: doc.id,
        filename: doc.filename,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        processingStatus: doc.processingStatus,
        errorMessage: doc.errorMessage,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        role,
        isOwner,
        owner: {
          id: doc.ownerId,
          name: doc.ownerName || null,
          email: doc.ownerEmail || null,
        },
      };
    });

    return NextResponse.json({ documents: userDocs });
  } catch (error) {
    console.error("GET /api/documents error:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}
