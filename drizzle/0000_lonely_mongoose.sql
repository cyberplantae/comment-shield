CREATE TYPE "public"."disposition" AS ENUM('pending', 'auto_hidden', 'hidden', 'deleted', 'kept', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('instagram', 'threads');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('benign', 'rude', 'harassment', 'hateful', 'threatening');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"platform_user_id" text NOT NULL,
	"username" text,
	"access_token_enc" text NOT NULL,
	"token_expires_at" timestamp with time zone,
	"last_refreshed_at" timestamp with time zone,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"disconnected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"total_comments" integer DEFAULT 0 NOT NULL,
	"flagged_comments" integer DEFAULT 0 NOT NULL,
	"alert_sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" uuid,
	"account_id" uuid,
	"action" text NOT NULL,
	"actor" text NOT NULL,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"platform_comment_id" text NOT NULL,
	"platform_media_id" text,
	"parent_comment_id" text,
	"author_username" text,
	"text" text NOT NULL,
	"posted_at" timestamp with time zone,
	"severity" "severity",
	"confidence" integer,
	"summary" text,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"targets_physical_safety" boolean DEFAULT false NOT NULL,
	"disposition" "disposition" DEFAULT 'pending' NOT NULL,
	"disposition_reason" text,
	"acted_at" timestamp with time zone,
	"classified_at" timestamp with time zone,
	"classifier_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policies" (
	"creator_id" uuid PRIMARY KEY NOT NULL,
	"auto_hide_at_or_above" "severity" DEFAULT 'hateful' NOT NULL,
	"surface_at_or_above" "severity" DEFAULT 'rude' NOT NULL,
	"allow_auto_delete" boolean DEFAULT false NOT NULL,
	"allowlist_handles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"blocklist_handles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"custom_sensitivities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"blur_queue_by_default" boolean DEFAULT true NOT NULL,
	"quiet_mode" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_windows" ADD CONSTRAINT "activity_windows_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_platform_user_idx" ON "accounts" USING btree ("platform","platform_user_id");--> statement-breakpoint
CREATE INDEX "accounts_creator_idx" ON "accounts" USING btree ("creator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_window_idx" ON "activity_windows" USING btree ("account_id","window_start");--> statement-breakpoint
CREATE INDEX "audit_comment_idx" ON "audit_log" USING btree ("comment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "comments_platform_id_idx" ON "comments" USING btree ("account_id","platform_comment_id");--> statement-breakpoint
CREATE INDEX "comments_queue_idx" ON "comments" USING btree ("account_id","disposition","created_at");--> statement-breakpoint
CREATE INDEX "comments_unclassified_idx" ON "comments" USING btree ("classified_at");