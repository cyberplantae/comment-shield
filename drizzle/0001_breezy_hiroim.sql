ALTER TABLE "policies" ADD COLUMN "category_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "protected_identities" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "identity_attack_action" text DEFAULT 'hide' NOT NULL;