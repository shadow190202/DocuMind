import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { documentPermissions, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  updatePermissionSchema,
  permissionParamsSchema,
} from "@/lib/validations/permission";
import { verifyDocumentAccess } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/documents/:id/permissions/:permissionId
 * Updates a collaborator's role (read <-> write).
 *
 * MANDATORY SECURITY REQUIREMENTS:
 * 1. Owner authorization: only the document owner can update roles.
 * 2. Document scoping: DB operation MUST filter on BOTH permission.id AND permission.documentId.
 *    A permission UUID belonging to another document must not be actionable.
 * 3. Explicit updatedAt advancement: updatedAt must be updated to new Date().
 */
export async function PATCH(req, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const documentId = resolvedParams?.id || params?.id;
    const permissionId = resolvedParams?.permissionId || params?.permissionId;

    const paramCheck = permissionParamsSchema.safeParse({
      id: documentId,
      permissionId,
    });
    if (!paramCheck.success) {
      return NextResponse.json(
        {
          error: "Invalid request parameters.",
          details: paramCheck.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Owner authorization required to modify roles
    const access = await verifyDocumentAccess({
      documentId,
      userId,
      requiredPermission: "owner",
    });

    if (!access.authorized) {
      return access.errorResponse;
    }

    let body = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    const validation = updatePermissionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed.",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { permission } = validation.data;
    const now = new Date();

    // STRICT DOCUMENT SCOPING: Must match BOTH permissionId AND documentId
    const [updated] = await db
      .update(documentPermissions)
      .set({
        permission,
        updatedAt: now,
      })
      .where(
        and(
          eq(documentPermissions.id, permissionId),
          eq(documentPermissions.documentId, documentId)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Permission record not found for this document." },
        { status: 404 }
      );
    }

    // Fetch user details for clean response
    const [collaboratorUser] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, updated.userId));

    return NextResponse.json({
      permission: {
        id: updated.id,
        documentId: updated.documentId,
        userId: updated.userId,
        name: collaboratorUser?.name || null,
        email: collaboratorUser?.email || null,
        permission: updated.permission,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
      message: "Permission updated successfully.",
    });
  } catch (error) {
    console.error("PATCH /api/documents/:id/permissions/:permissionId error:", error);
    return NextResponse.json(
      { error: "Failed to update permission." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents/:id/permissions/:permissionId
 * Revokes a collaborator's access, or allows a collaborator to leave a shared document.
 *
 * MANDATORY SECURITY REQUIREMENTS:
 * 1. Access authorization: only the document owner OR the collaborator themselves can revoke.
 * 2. Document scoping: DB query and delete MUST filter on BOTH permission.id AND permission.documentId.
 *    A permission UUID belonging to another document must not be actionable.
 */
export async function DELETE(req, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const documentId = resolvedParams?.id || params?.id;
    const permissionId = resolvedParams?.permissionId || params?.permissionId;

    const paramCheck = permissionParamsSchema.safeParse({
      id: documentId,
      permissionId,
    });
    if (!paramCheck.success) {
      return NextResponse.json(
        {
          error: "Invalid request parameters.",
          details: paramCheck.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // 1. First retrieve the permission row with STRICT document scoping
    const [permRow] = await db
      .select()
      .from(documentPermissions)
      .where(
        and(
          eq(documentPermissions.id, permissionId),
          eq(documentPermissions.documentId, documentId)
        )
      );

    if (!permRow) {
      return NextResponse.json(
        { error: "Permission record not found for this document." },
        { status: 404 }
      );
    }

    // 2. Verify document access for the requesting user
    const access = await verifyDocumentAccess({
      documentId,
      userId,
      requiredPermission: "read",
    });

    if (!access.authorized) {
      return access.errorResponse;
    }

    // 3. Authorization check: Either document owner OR the collaborator themselves
    const isOwner = access.isOwner;
    const isSelfCollaborator = permRow.userId === userId;

    if (!isOwner && !isSelfCollaborator) {
      return NextResponse.json(
        { error: "Only the document owner or the collaborator can remove this permission." },
        { status: 403 }
      );
    }

    // 4. Delete the permission row with STRICT document scoping
    await db
      .delete(documentPermissions)
      .where(
        and(
          eq(documentPermissions.id, permissionId),
          eq(documentPermissions.documentId, documentId)
        )
      );

    return NextResponse.json({
      message: isSelfCollaborator && !isOwner
        ? "You have left the shared document."
        : "Permission revoked successfully.",
      id: permissionId,
    });
  } catch (error) {
    console.error("DELETE /api/documents/:id/permissions/:permissionId error:", error);
    return NextResponse.json(
      { error: "Failed to revoke permission." },
      { status: 500 }
    );
  }
}
