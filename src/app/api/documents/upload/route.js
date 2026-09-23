import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { saveFile } from "@/lib/storage";
import { getOrCreateCurrentUser } from "@/lib/auth-user";
import {
  fileUploadSchema,
  getNormalizedFileType,
  MAX_FILE_SIZE,
} from "@/lib/validations/document";

export async function POST(req) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!db) {
      return NextResponse.json(
        { error: "Database service unavailable." },
        { status: 503 }
      );
    }

    // Ensure user exists in our local PostgreSQL database for FK integrity
    await getOrCreateCurrentUser();

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

    // Validate using Zod schema
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

    // Save to private local file storage
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

    return NextResponse.json(
      {
        message: "Document uploaded successfully.",
        document: insertedDoc,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/documents/upload error:", error);
    return NextResponse.json(
      { error: "Internal server error during document upload." },
      { status: 500 }
    );
  }
}
