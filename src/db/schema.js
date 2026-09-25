import {
  pgTable,
  text,
  integer,
  timestamp,
  uuid,
  jsonb,
  vector,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================
// 1. USERS TABLE (Linked to Clerk Authentication)
// ============================================================
export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user ID (e.g., user_2xxx)
  name: text("name"),
  email: text("email").notNull(),
  role: text("role").default("user").notNull(), // 'user' | 'admin'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================
// 2. DOCUMENTS TABLE
// ============================================================
export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  fileType: text("file_type").notNull(), // 'pdf' | 'docx' | 'txt' | 'csv'
  fileSize: integer("file_size").notNull(), // Size in bytes
  storageUrl: text("storage_url").notNull(),
  processingStatus: text("processing_status").default("pending").notNull(), // 'pending' | 'processing' | 'completed' | 'failed'
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================
// 3. DOCUMENT CHUNKS TABLE (With PostgreSQL + pgvector)
// ============================================================
export const documentChunks = pgTable("document_chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").default(0).notNull(),
  content: text("content").notNull(),
  pageNumber: integer("page_number"),
  // 768 dimensions for Gemini gemini-embedding-001
  embedding: vector("embedding", { dimensions: 768 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================
// 4. CONVERSATIONS TABLE
// ============================================================
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "cascade",
    }), // Optional: if null, multi-document conversation
    title: text("title").default("New Conversation").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("conversations_user_updated_idx").on(table.userId, table.updatedAt),
    index("conversations_user_created_idx").on(table.userId, table.createdAt),
  ]
);

// ============================================================
// 5. MESSAGES TABLE
// ============================================================
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // 'user' | 'assistant' | 'system'
    content: text("content").notNull(),
    sources: jsonb("sources"), // Grounded citations: [{ chunkId, pageNumber, docName, score }]
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt
    ),
  ]
);

// ============================================================
// 6. DOCUMENT PERMISSIONS TABLE (Sharing & Access Control)
// ============================================================
export const documentPermissions = pgTable("document_permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  permission: text("permission").default("read").notNull(), // 'read' | 'write'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================
// 7. AI USAGE LOGS TABLE (Transparent Free-Tier Token Tracking)
// ============================================================
export const aiUsageLogs = pgTable(
  "ai_usage_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    model: text("model").notNull(), // 'gemini-2.5-flash'
    operation: text("operation").notNull(), // 'chat'
    promptTokens: integer("prompt_tokens"), // nullable if usageMetadata unavailable
    completionTokens: integer("completion_tokens"), // nullable if usageMetadata unavailable
    totalTokens: integer("total_tokens"), // nullable if usageMetadata unavailable
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("ai_usage_logs_user_created_idx").on(table.userId, table.createdAt),
  ]
);

// ============================================================
// 8. DOCUMENT SUMMARIES TABLE (Phase 11 Cached Summaries)
// ============================================================
export const documentSummaries = pgTable(
  "document_summaries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    summaryType: text("summary_type").notNull(), // 'executive' | 'detailed' | 'key_points' | 'dates' | 'numbers' | 'action_items' | 'comprehensive'
    content: text("content").notNull(), // Authoritative generated Markdown content
    structuredData: jsonb("structured_data"), // Optional, defaults to null in Phase 11
    model: text("model").notNull(), // 'gemini-2.5-flash'
    promptTokens: integer("prompt_tokens"), // Nullable if usageMetadata unavailable
    completionTokens: integer("completion_tokens"),
    totalTokens: integer("total_tokens"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // Unique constraint: strictly guarantees only one cached summary per document and summary type
    uniqueIndex("doc_summaries_doc_type_uniq_idx").on(
      table.documentId,
      table.summaryType
    ),
    index("doc_summaries_user_created_idx").on(table.userId, table.createdAt),
    index("doc_summaries_doc_idx").on(table.documentId),
  ]
);

// ============================================================
// DOCUMENT COMPARISONS (Phase 12)
// ============================================================
export const documentComparisons = pgTable(
  "document_comparisons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceDocumentId: uuid("source_document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    targetDocumentId: uuid("target_document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    content: text("content").notNull(), // Authoritative generated Markdown comparison report
    structuredData: jsonb("structured_data"), // Nullable and NULL for Phase 12
    model: text("model").notNull(), // 'gemini-2.5-flash'
    promptTokens: integer("prompt_tokens"), // Nullable if usageMetadata unavailable
    completionTokens: integer("completion_tokens"),
    totalTokens: integer("total_tokens"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // Directional unique pair: (sourceDocumentId, targetDocumentId)
    // (A, B) and (B, A) are separate directional records
    uniqueIndex("doc_comparisons_pair_uniq_idx").on(
      table.sourceDocumentId,
      table.targetDocumentId
    ),
    index("doc_comparisons_user_created_idx").on(table.userId, table.createdAt),
    index("doc_comparisons_source_idx").on(table.sourceDocumentId),
    index("doc_comparisons_target_idx").on(table.targetDocumentId),
  ]
);

// ============================================================
// DRIZZLE RELATIONS DEFINITIONS
// ============================================================
export const usersRelations = relations(users, ({ many }) => ({
  documents: many(documents),
  conversations: many(conversations),
  permissions: many(documentPermissions),
  aiUsageLogs: many(aiUsageLogs),
  summaries: many(documentSummaries),
  comparisons: many(documentComparisons),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
  chunks: many(documentChunks),
  conversations: many(conversations),
  permissions: many(documentPermissions),
  summaries: many(documentSummaries),
  sourceComparisons: many(documentComparisons, { relationName: "sourceComparisons" }),
  targetComparisons: many(documentComparisons, { relationName: "targetComparisons" }),
}));

export const documentChunksRelations = relations(documentChunks, ({ one }) => ({
  document: one(documents, {
    fields: [documentChunks.documentId],
    references: [documents.id],
  }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  document: one(documents, {
    fields: [conversations.documentId],
    references: [documents.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const documentPermissionsRelations = relations(documentPermissions, ({ one }) => ({
  document: one(documents, {
    fields: [documentPermissions.documentId],
    references: [documents.id],
  }),
  user: one(users, {
    fields: [documentPermissions.userId],
    references: [users.id],
  }),
}));

export const aiUsageLogsRelations = relations(aiUsageLogs, ({ one }) => ({
  user: one(users, {
    fields: [aiUsageLogs.userId],
    references: [users.id],
  }),
}));

export const documentSummariesRelations = relations(documentSummaries, ({ one }) => ({
  document: one(documents, {
    fields: [documentSummaries.documentId],
    references: [documents.id],
  }),
  user: one(users, {
    fields: [documentSummaries.userId],
    references: [users.id],
  }),
}));

export const documentComparisonsRelations = relations(documentComparisons, ({ one }) => ({
  user: one(users, {
    fields: [documentComparisons.userId],
    references: [users.id],
  }),
  sourceDocument: one(documents, {
    fields: [documentComparisons.sourceDocumentId],
    references: [documents.id],
    relationName: "sourceComparisons",
  }),
  targetDocument: one(documents, {
    fields: [documentComparisons.targetDocumentId],
    references: [documents.id],
    relationName: "targetComparisons",
  }),
}));

