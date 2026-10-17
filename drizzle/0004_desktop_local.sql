ALTER TABLE "app_settings" ADD COLUMN "desktop_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "next_attempt_at" timestamp with time zone;