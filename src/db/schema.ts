import { pgSchema, uuid, char, text, timestamp, jsonb } from "drizzle-orm/pg-core";

const drizzleSchema = pgSchema("drizzle");

export const sessions = drizzleSchema.table("sessions", {
  sessionId: uuid("session_id").primaryKey().defaultRandom(),
  pinCode: char("pin_code", { length: 4 }).notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

export const responses = drizzleSchema.table("responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").references(() => sessions.sessionId),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  answers: jsonb("answers")
});

export const convaiTranscripts = drizzleSchema.table("convai_transcripts", {
  conversationId: text("conversation_id").primaryKey(),
  sessionId: uuid("session_id").references(() => sessions.sessionId),
  pinCode: char("pin_code", { length: 4 }),
  dynamicVariables: jsonb("dynamic_variables").notNull(),
  transcript: jsonb("transcript").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow()
});
