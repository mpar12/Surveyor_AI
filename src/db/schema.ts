import { pgSchema, uuid, char, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";

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
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow(),
  prolificPid: text("prolific_pid"),
  prolificStudyId: text("prolific_study_id"),
  prolificSessionId: text("prolific_session_id")
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

// ============================================
// Survey Builder Tables (Listen Labs Style)
// ============================================

export const surveys = drizzleSchema.table("surveys", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").references(() => sessions.sessionId),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft"), // draft, published
  version: integer("version").notNull().default(1),
  accessType: text("access_type").notNull().default("anonymous"), // anonymous, unique_links, verified
  settings: jsonb("settings"), // global survey settings (welcome message, etc.)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true })
});

export const surveySections = drizzleSchema.table("survey_sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  surveyId: uuid("survey_id").references(() => surveys.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

export const surveyQuestions = drizzleSchema.table("survey_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sectionId: uuid("section_id").references(() => surveySections.id).notNull(),
  type: text("type").notNull(), // multiple_choice, open_ended, statement
  text: text("text").notNull(),
  description: text("description"), // optional helper text
  order: integer("order").notNull().default(0),
  settings: jsonb("settings"), // type-specific settings (options, follow-up config, etc.)
  skipLogic: jsonb("skip_logic"), // conditions for skipping
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

export const surveyResponses = drizzleSchema.table("survey_responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  surveyId: uuid("survey_id").references(() => surveys.id).notNull(),
  surveyVersion: integer("survey_version").notNull(),
  respondentId: text("respondent_id"), // for unique links
  respondentEmail: text("respondent_email"), // for verified access
  status: text("status").notNull().default("in_progress"), // in_progress, completed, abandoned
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true })
});

export const surveyAnswers = drizzleSchema.table("survey_answers", {
  id: uuid("id").primaryKey().defaultRandom(),
  responseId: uuid("response_id").references(() => surveyResponses.id).notNull(),
  questionId: uuid("question_id").references(() => surveyQuestions.id).notNull(),
  answerType: text("answer_type").notNull(), // choice, text, voice
  choiceIds: jsonb("choice_ids"), // array of selected option IDs for MC
  textValue: text("text_value"), // for text responses
  voiceUrl: text("voice_url"), // URL to voice recording
  transcript: text("transcript"), // Whisper transcription
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

export const surveyFollowups = drizzleSchema.table("survey_followups", {
  id: uuid("id").primaryKey().defaultRandom(),
  answerId: uuid("answer_id").references(() => surveyAnswers.id).notNull(),
  questionText: text("question_text").notNull(), // AI-generated follow-up
  answerType: text("answer_type"), // text, voice
  textValue: text("text_value"),
  voiceUrl: text("voice_url"),
  transcript: text("transcript"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

export const surveyChatHistory = drizzleSchema.table("survey_chat_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  surveyId: uuid("survey_id").references(() => surveys.id).notNull(),
  messages: jsonb("messages").notNull(), // array of chat messages
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});
