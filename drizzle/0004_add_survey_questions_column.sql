ALTER TABLE "drizzle"."session_contexts"
  ADD COLUMN IF NOT EXISTS "survey_questions" jsonb;
