CREATE TABLE "app_settings" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"provider" text,
	"model" text,
	"effort" text,
	"anthropic_key_enc" text,
	"openai_key_enc" text,
	"openai_base_url" text,
	"ollama_host" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
