CREATE TABLE IF NOT EXISTS "drizzle"."email_sends" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "session_id" uuid,
    "recipients" jsonb NOT NULL,
    "subject" text NOT NULL,
    "body" text NOT NULL,
    "status" text NOT NULL,
    "provider_response" jsonb,
    "sent_at" timestamptz DEFAULT now()
);
