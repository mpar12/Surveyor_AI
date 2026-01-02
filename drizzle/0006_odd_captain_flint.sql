CREATE TABLE IF NOT EXISTS "drizzle"."convai_transcripts" (
	"conversation_id" text PRIMARY KEY NOT NULL,
	"session_id" uuid,
	"pin_code" char(4),
	"dynamic_variables" jsonb NOT NULL,
	"transcript" jsonb NOT NULL,
	"analysis" jsonb,
	"completed_at" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now(),
	"prolific_pid" text,
	"prolific_study_id" text,
	"prolific_session_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "drizzle"."email_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid,
	"recipients" jsonb NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text NOT NULL,
	"provider_response" jsonb,
	"sent_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "drizzle"."responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid,
	"submitted_at" timestamp with time zone,
	"answers" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "drizzle"."session_contexts" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"requester" text,
	"prompt" text,
	"company" text,
	"product" text,
	"feedback_desired" text,
	"desired_icp" text,
	"desired_icp_industry" text,
	"desired_icp_region" text,
	"key_questions" text,
	"survey_questions" jsonb,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "drizzle"."sessions" (
	"session_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pin_code" char(4) NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "drizzle"."convai_transcripts" ADD CONSTRAINT "convai_transcripts_session_id_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "drizzle"."sessions"("session_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "drizzle"."responses" ADD CONSTRAINT "responses_session_id_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "drizzle"."sessions"("session_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "drizzle"."session_contexts" ADD CONSTRAINT "session_contexts_session_id_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "drizzle"."sessions"("session_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
