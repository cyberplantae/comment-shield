ALTER TABLE "app_settings" ADD COLUMN "meta_app_id" text;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "meta_app_secret_enc" text;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "meta_verify_token" text;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "public_base_url" text;