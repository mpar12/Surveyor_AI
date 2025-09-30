CREATE TABLE IF NOT EXISTS "drizzle"."session_contexts" (
    "session_id" uuid PRIMARY KEY REFERENCES "drizzle"."sessions"("session_id") ON DELETE CASCADE,
    "requester" text,
    "company" text,
    "product" text,
    "feedback_desired" text,
    "desired_icp" text,
    "desired_icp_industry" text,
    "desired_icp_region" text,
    "key_questions" text,
    "updated_at" timestamptz DEFAULT now()
);

ALTER TABLE "drizzle"."convai_transcripts"
  ADD COLUMN IF NOT EXISTS "analysis" jsonb;
