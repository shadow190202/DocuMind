import { NextResponse } from "next/server.js";
import crypto from "crypto";

/**
 * DocuMind Centralized Error Hierarchy & Sanitization System
 *
 * Core Security & Operational Invariants:
 * 1. Base AppError for all operational, domain-specific application errors.
 * 2. Uncaught/server errors (status >= 500) NEVER leak SQL syntax, database connection
 *    strings, filesystem paths, API keys, or stack traces to clients.
 * 3. Traceable correlation requestId is generated for server logging and diagnostics.
 * 4. Preserves intentional operational HTTP status codes (400, 401, 403, 404, 409, 413, 422, 429).
 */

export class AppError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR", details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request.", details = null) {
    super(message, 400, "BAD_REQUEST", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized: Authentication required.", details = null) {
    super(message, 401, "UNAUTHORIZED", details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden: Access denied.", details = null) {
    super(message, 403, "FORBIDDEN", details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found.", details = null) {
    super(message, 404, "NOT_FOUND", details);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict: Resource state conflict.", details = null) {
    super(message, 409, "CONFLICT", details);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = "Payload too large.", details = null) {
    super(message, 413, "PAYLOAD_TOO_LARGE", details);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = "Unprocessable entity.", details = null) {
    super(message, 422, "UNPROCESSABLE_ENTITY", details);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests. Please slow down.", retryAfter = 60) {
    super(message, 429, "RATE_LIMIT_EXCEEDED", { retryAfter });
    this.retryAfter = retryAfter;
  }
}

export class InternalServerError extends AppError {
  constructor(message = "Internal server error.", details = null) {
    super(message, 500, "INTERNAL_SERVER_ERROR", details);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "Service temporarily unavailable.", details = null) {
    super(message, 503, "SERVICE_UNAVAILABLE", details);
  }
}

/**
 * Scrubs sensitive patterns (database URLs, connection strings, API keys, absolute paths)
 * from log strings.
 *
 * @param {string} text 
 * @returns {string}
 */
export function sanitizeLogString(text) {
  if (typeof text !== "string") return "";
  return text
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, "[REDACTED_DB_URL]")
    .replace(/(?:AIzaSy|sk_live|sk_test|clerk_)[a-zA-Z0-9_\-]{16,}/g, "[REDACTED_SECRET]")
    .replace(/[a-zA-Z]:\\[a-zA-Z0-9_.\-\\]+/g, "[REDACTED_LOCAL_PATH]")
    .replace(/\/(?:home|Users|var|etc)\/[a-zA-Z0-9_.\-\/]+/g, "[REDACTED_POSIX_PATH]");
}

/**
 * Universal error handler for API route handlers.
 * Guarantees zero sensitive data leakage to clients.
 *
 * @param {Error|AppError|any} error - Caught error
 * @param {Request} [req] - Optional Next.js request object
 * @returns {NextResponse}
 */
export function handleApiError(error, req = null) {
  const requestId = crypto.randomUUID();
  const url = req?.url ? sanitizeLogString(req.url) : "unknown";
  const method = req?.method || "API";

  // 1. Operational AppErrors with explicit status codes < 500
  if (error instanceof AppError && error.isOperational && error.statusCode < 500) {
    const responsePayload = {
      error: error.message,
      code: error.code,
    };
    if (error.details) {
      responsePayload.details = error.details;
    }
    const headers = {};
    if (error.statusCode === 429 && error.retryAfter) {
      headers["Retry-After"] = String(error.retryAfter);
    }
    return NextResponse.json(responsePayload, { status: error.statusCode, headers });
  }

  // 2. Zod validation errors
  if (error?.name === "ZodError" || Array.isArray(error?.errors)) {
    const firstMessage = error.errors?.[0]?.message || "Validation failed.";
    return NextResponse.json(
      {
        error: firstMessage,
        code: "VALIDATION_ERROR",
        details: error.errors,
      },
      { status: 400 }
    );
  }

  // 3. SyntaxError from malformed JSON in req.json()
  if (error instanceof SyntaxError && error.message.includes("JSON")) {
    return NextResponse.json(
      { error: "Invalid JSON payload.", code: "MALFORMED_JSON" },
      { status: 400 }
    );
  }

  // 4. Log detailed server-side error with correlation ID and scrubbed secrets
  const sanitizedMessage = sanitizeLogString(error?.message || String(error));
  const sanitizedStack = sanitizeLogString(error?.stack || "");
  console.error(`[API_ERROR] [${requestId}] ${method} ${url} - ${sanitizedMessage}\n${sanitizedStack}`);

  // 5. Client response: return clean, masked generic message without internal details
  const status = error instanceof AppError ? error.statusCode : 500;
  return NextResponse.json(
    {
      error: "An unexpected error occurred. Please try again later.",
      code: "INTERNAL_SERVER_ERROR",
      requestId,
    },
    { status }
  );
}
