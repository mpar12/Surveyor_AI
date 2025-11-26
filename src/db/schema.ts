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
  analysis: jsonb("analysis"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow()
});

export const emailSends = drizzleSchema.table("email_sends", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id"),
  recipients: jsonb("recipients").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull(),
  providerResponse: jsonb("provider_response"),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow()
});

export const sessionContexts = drizzleSchema.table("session_contexts", {
  sessionId: uuid("session_id")
    .primaryKey()
    .references(() => sessions.sessionId),
  requester: text("requester"),
  prompt: text("prompt"),
  company: text("company"),
  product: text("product"),
  feedbackDesired: text("feedback_desired"),
  desiredIcp: text("desired_icp"),
  desiredIcpIndustry: text("desired_icp_industry"),
  desiredIcpRegion: text("desired_icp_region"),
  keyQuestions: text("key_questions"),
  surveyQuestions: jsonb("survey_questions"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});
