import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { conversations, messages, documents } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { exportConversationQuerySchema } from "@/lib/validations/conversation";
import { checkRateLimit, applyRateLimitHeaders } from "@/lib/rate-limiter";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

function sanitizeFilename(name) {
  return (name || "conversation")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

/**
 * GET /api/conversations/:id/export?format=markdown|json
 * Server-authorized export of conversation transcripts.
 */
export async function GET(req, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = checkRateLimit(req, "general", userId);
    if (!rateLimit.success) {
      return applyRateLimitHeaders(
        NextResponse.json(
          {
            error: "Too Many Requests",
            message: "Rate limit exceeded. Please slow down.",
            retryAfter: rateLimit.retryAfter,
          },
          { status: 429 }
        ),
        rateLimit
      );
    }

    const resolvedParams = await params;
    const id = resolvedParams?.id || params?.id;
    if (!id) {
      return NextResponse.json(
        { error: "Conversation ID is required." },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const formatValidation = exportConversationQuerySchema.safeParse({
      format: searchParams.get("format") || "markdown",
    });

    if (!formatValidation.success) {
      return NextResponse.json(
        { error: "Invalid export format. Must be 'markdown' or 'json'." },
        { status: 400 }
      );
    }

    const format = formatValidation.data.format;

    // 1. Query conversation with user ownership check
    const [conv] = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        documentId: conversations.documentId,
        documentName: documents.filename,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .leftJoin(documents, eq(conversations.documentId, documents.id))
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));

    if (!conv) {
      return NextResponse.json(
        { error: "Conversation not found or access denied." },
        { status: 404 }
      );
    }

    // 2. Query all messages for conversation in chronological order
    const rawMessages = await db
      .select({
        role: messages.role,
        content: messages.content,
        sources: messages.sources,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.createdAt));

    // 3. Build sanitized data structure
    const documentScope = conv.documentName
      ? conv.documentName
      : "Entire Document Vault";
    const exportTimestamp = new Date().toISOString();

    const sanitizedMessages = rawMessages.map((m) => {
      const sanitizedMsg = {
        role: m.role,
        content: m.content,
        timestamp: m.createdAt ? new Date(m.createdAt).toISOString() : null,
      };

      if (m.role === "assistant" && Array.isArray(m.sources) && m.sources.length > 0) {
        sanitizedMsg.sources = m.sources.map((s) => ({
          sourceNumber: s.sourceNumber || null,
          documentName: s.documentName || null,
          pageNumber: s.pageNumber || null,
          chunkIndex: typeof s.chunkIndex === "number" ? s.chunkIndex : null,
          similarityScore:
            typeof s.similarityScore === "number"
              ? Math.round(s.similarityScore * 1000) / 1000
              : null,
        }));
      }

      return sanitizedMsg;
    });

    const sanitizedExportData = {
      title: conv.title,
      documentScope,
      createdAt: conv.createdAt ? new Date(conv.createdAt).toISOString() : null,
      updatedAt: conv.updatedAt ? new Date(conv.updatedAt).toISOString() : null,
      exportTimestamp,
      totalMessages: sanitizedMessages.length,
      messages: sanitizedMessages,
    };

    const fileSlug = sanitizeFilename(conv.title);

    // 4. Return formatted attachment based on requested format
    if (format === "json") {
      const jsonContent = JSON.stringify(sanitizedExportData, null, 2);
      const res = new NextResponse(jsonContent, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="documind-${fileSlug}.json"`,
        },
      });
      return applyRateLimitHeaders(res, rateLimit);
    }

    // Default: Markdown export
    let md = `# ${conv.title}\n\n`;
    md += `**Document Scope:** ${documentScope}  \n`;
    md += `**Started:** ${conv.createdAt ? new Date(conv.createdAt).toLocaleString() : "N/A"}  \n`;
    md += `**Last Updated:** ${conv.updatedAt ? new Date(conv.updatedAt).toLocaleString() : "N/A"}  \n`;
    md += `**Exported via DocuMind:** ${new Date(exportTimestamp).toLocaleString()}  \n\n`;
    md += `---\n\n`;

    let turnNumber = 1;
    for (const msg of sanitizedMessages) {
      const timeStr = msg.timestamp
        ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "";
      if (msg.role === "user") {
        md += `### Question ${turnNumber} (User) ${timeStr ? `— ${timeStr}` : ""}\n\n`;
        md += `${msg.content}\n\n`;
      } else {
        md += `### Answer (DocuMind Assistant) ${timeStr ? `— ${timeStr}` : ""}\n\n`;
        md += `${msg.content}\n\n`;

        if (Array.isArray(msg.sources) && msg.sources.length > 0) {
          md += `**Sources Cited:**\n`;
          for (const src of msg.sources) {
            const pageStr = src.pageNumber ? ` (Page ${src.pageNumber})` : "";
            const scoreStr =
              typeof src.similarityScore === "number"
                ? ` — ${Math.round(src.similarityScore * 100)}% match`
                : "";
            md += `- [SOURCE ${src.sourceNumber}] ${src.documentName || "Document"}${pageStr}${scoreStr}\n`;
          }
          md += `\n`;
        }

        turnNumber++;
      }
      md += `---\n\n`;
    }

    const res = new NextResponse(md, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="documind-${fileSlug}.md"`,
      },
    });
    return applyRateLimitHeaders(res, rateLimit);
  } catch (error) {
    return handleApiError(error, req);
  }
}
