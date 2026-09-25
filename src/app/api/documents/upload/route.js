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

export async function POST(req) {
  try {
    // 1. CSRF same-origin defense for mutative uploads
    assertValidOrigin(req);

    const { userId } = await getAuthSession(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Application-level rate limiting for ingestion
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

    // Ensure user exists in our local PostgreSQL database for FK integrity
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

    // Save to private local file storage with path traversal protection
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
