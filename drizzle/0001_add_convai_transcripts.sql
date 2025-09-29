CREATE TABLE IF NOT EXISTS "drizzle"."convai_transcripts" (
    "conversation_id" text PRIMARY KEY,
    "session_id" uuid REFERENCES "drizzle"."sessions"("session_id"),
    "pin_code" char(4),
    "dynamic_variables" jsonb NOT NULL,
    "transcript" jsonb NOT NULL,
    "completed_at" timestamptz,
    "received_at" timestamptz DEFAULT now()
);
