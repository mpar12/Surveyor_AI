ALTER TABLE "drizzle"."session_contexts"
  ADD COLUMN IF NOT EXISTS "prompt" text;
