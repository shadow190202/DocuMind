import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { saveFile } from "@/lib/storage";
import { getOrCreateCurrentUser } from "@/lib/auth-user";
import {
  fileUploadSchema,
  getNormalizedFileType,
  validateDocumentBuffer,
} from "@/lib/validations/document";
import { checkRateLimit, applyRateLimitHeaders } from "@/lib/rate-limiter";
import { assertValidOrigin } from "@/lib/auth/csrf";
import { handleApiError } from "@/lib/errors";
import { handleUpload } from "@vercel/blob/client";
import { eq } from "drizzle-orm";

export async function POST(req) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // --------------------------------------------------------------------------
    // 1. JSON Payloads: Vercel Blob direct uploads, token generation & webhooks
    // --------------------------------------------------------------------------
    if (contentType.includes("application/json")) {
      const body = await req.json();

      // Case 1A: Direct client registration after client-side upload to Vercel Blob
      if (body?.action === "register") {
        assertValidOrigin(req);

        const { userId } = await getAuthSession(req);
        if (!userId) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const rateLimit = checkRateLimit(req, "ingest", userId);
        if (!rateLimit.success) {
          return applyRateLimitHeaders(
            NextResponse.json(
              {
                error: "Too Many Requests",
                message: "Upload rate limit exceeded. Please wait before retrying.",
                retryAfter: rateLimit.retryAfter,
              },
              { status: 429 }
            ),
            rateLimit
          );
        }

        if (!db) {
          return NextResponse.json(
            { error: "Database service unavailable." },
            { status: 503 }
          );
        }

        await getOrCreateCurrentUser(req);

        const { blobUrl, filename, fileSize, fileType } = body;
        if (!blobUrl || typeof blobUrl !== "string") {
          return NextResponse.json(
            { error: "Missing or invalid blobUrl." },
            { status: 400 }
          );
        }

        // Security check: validate that blobUrl begins with https and points to a valid Vercel Blob origin
        try {
          const parsedUrl = new URL(blobUrl);
          if (
            parsedUrl.protocol !== "https:" ||
            !parsedUrl.hostname.endsWith(".blob.vercel-storage.com")
          ) {
            return NextResponse.json(
              { error: "Security violation: invalid storage URL origin." },
              { status: 400 }
            );
          }
        } catch {
          return NextResponse.json(
            { error: "Security violation: malformed storage URL." },
            { status: 400 }
          );
        }

        const validationResult = fileUploadSchema.safeParse({
          filename,
          size: fileSize,
          type: fileType,
        });

        if (!validationResult.success) {
          return NextResponse.json(
            { error: validationResult.error.errors[0]?.message || "Invalid file metadata." },
            { status: 400 }
          );
        }

        const normalizedType = getNormalizedFileType(filename, fileType);
        if (!normalizedType) {
          return NextResponse.json(
            { error: "Unsupported file format. Supported formats: .pdf, .docx, .txt, .csv" },
            { status: 400 }
          );
        }

        // Idempotency: check if document was already inserted
        const existing = await db
          .select()
          .from(documents)
          .where(eq(documents.storageUrl, blobUrl))
          .limit(1);

        let insertedDoc;
        if (existing.length > 0) {
          insertedDoc = existing[0];
        } else {
          const [newDoc] = await db
            .insert(documents)
            .values({
              userId,
              filename,
              fileType: normalizedType,
              fileSize,
              storageUrl: blobUrl,
              processingStatus: "pending",
            })
            .returning();
          insertedDoc = newDoc;
        }

        const response = NextResponse.json(
          {
            message: "Document uploaded successfully.",
            document: insertedDoc,
          },
          { status: 201 }
        );

        return applyRateLimitHeaders(response, rateLimit);
      }

      // Case 1B: @vercel/blob client token exchange or completion webhook via handleUpload
      const isWebhook = Boolean(req.headers.get("x-vercel-signature"));
      if (!isWebhook) {
        assertValidOrigin(req);
      }

      try {
        const jsonResponse = await handleUpload({
          body,
          request: req,
          onBeforeGenerateToken: async (pathname, clientPayload) => {
            const { userId } = await getAuthSession(req);
            if (!userId) {
              throw new Error("Unauthorized");
            }

            const rateLimit = checkRateLimit(req, "ingest", userId);
            if (!rateLimit.success) {
              throw new Error("Upload rate limit exceeded. Please wait before retrying.");
            }

            if (!db) {
              throw new Error("Database service unavailable.");
            }

            await getOrCreateCurrentUser(req);

            let payloadData = {};
            if (clientPayload) {
              try {
                payloadData = JSON.parse(clientPayload);
              } catch {}
            }

            const filename = payloadData.filename || pathname || "untitled";
            const fileSize = payloadData.size || 1;
            const mimeType = payloadData.type;

            const validationResult = fileUploadSchema.safeParse({
              filename,
              size: fileSize,
              type: mimeType,
            });

            if (!validationResult.success) {
              throw new Error(
                validationResult.error.errors[0]?.message || "Invalid file."
              );
            }

            const normalizedType = getNormalizedFileType(filename, mimeType);
            if (!normalizedType) {
              throw new Error(
                "Unsupported file format. Supported formats: .pdf, .docx, .txt, .csv"
              );
            }

            return {
              allowedContentTypes: [
                "application/pdf",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "text/plain",
                "text/csv",
                "application/csv",
              ],
              maximumSizeInBytes: 20 * 1024 * 1024,
              tokenPayload: JSON.stringify({
                userId,
                filename,
                fileSize,
                fileType: normalizedType,
              }),
            };
          },
          onUploadCompleted: async ({ blob, tokenPayload }) => {
            if (!tokenPayload) return;
            try {
              const { userId, filename, fileSize, fileType } = JSON.parse(tokenPayload);
              if (!db || !userId) return;

              const existing = await db
                .select({ id: documents.id })
                .from(documents)
                .where(eq(documents.storageUrl, blob.url))
                .limit(1);

              if (existing.length === 0) {
                await db.insert(documents).values({
                  userId,
                  filename: filename || "untitled",
                  fileType: fileType || "txt",
                  fileSize: fileSize || 0,
                  storageUrl: blob.url,
                  processingStatus: "pending",
                });
              }
            } catch (err) {
              console.error("Error in onUploadCompleted webhook:", err);
            }
          },
        });

        return NextResponse.json(jsonResponse);
      } catch (blobErr) {
        return NextResponse.json(
          { error: blobErr.message || "Failed to process blob upload token." },
          { status: blobErr.message === "Unauthorized" ? 401 : 400 }
        );
      }
    }

    // --------------------------------------------------------------------------
    // 2. Multipart Form-Data Upload (Local filesystem storage & automated tests)
    // --------------------------------------------------------------------------
    assertValidOrigin(req);

    const { userId } = await getAuthSession(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = checkRateLimit(req, "ingest", userId);
    if (!rateLimit.success) {
      return applyRateLimitHeaders(
        NextResponse.json(
          {
            error: "Too Many Requests",
            message: "Upload rate limit exceeded. Please wait before retrying.",
            retryAfter: rateLimit.retryAfter,
          },
          { status: 429 }
        ),
        rateLimit
      );
    }

    if (!db) {
      return NextResponse.json(
        { error: "Database service unavailable." },
        { status: 503 }
      );
    }

    await getOrCreateCurrentUser(req);

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "No document file was uploaded." },
        { status: 400 }
      );
    }

    const filename = file.name || "untitled";
    const fileSize = file.size;
    const mimeType = file.type;

    // Validate metadata using Zod schema (20 MB limit enforced)
    const validationResult = fileUploadSchema.safeParse({
      filename,
      size: fileSize,
      type: mimeType,
    });

    if (!validationResult.success) {
      const errorMessage =
        validationResult.error.errors[0]?.message || "Invalid file.";
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const normalizedType = getNormalizedFileType(filename, mimeType);
    if (!normalizedType) {
      return NextResponse.json(
        {
          error:
            "Unsupported file format. Supported formats: .pdf, .docx, .txt, .csv",
        },
        { status: 400 }
      );
    }

    // Convert file to Node buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Deep binary magic-byte and archive integrity validation (20 MB limit preserved)
    const bufferValidation = validateDocumentBuffer(buffer, normalizedType);
    if (!bufferValidation.valid) {
      return NextResponse.json({ error: bufferValidation.error }, { status: 400 });
    }

    // Save to private file storage (local disk or Vercel Blob based on configured provider)
    const { storageUrl } = await saveFile(buffer, filename, userId);

    // Insert document record into PostgreSQL via Drizzle
    const [insertedDoc] = await db
      .insert(documents)
      .values({
        userId,
        filename,
        fileType: normalizedType,
        fileSize,
        storageUrl,
        processingStatus: "pending",
      })
      .returning();

    const response = NextResponse.json(
      {
        message: "Document uploaded successfully.",
        document: insertedDoc,
      },
      { status: 201 }
    );

    return applyRateLimitHeaders(response, rateLimit);
  } catch (error) {
    return handleApiError(error, req);
  }
}
