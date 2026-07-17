CREATE TABLE "ai_recommendations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"model" text NOT NULL,
	"content" text NOT NULL
);
--> statement-breakpoint
-- newsletter_issues switches from a bigserial id (unique-by-issue_date) to a real
-- Beehiiv post id as primary key. The 13 existing rows are hand-typed placeholder
-- data being fully replaced by the first real Beehiiv sync, so this is a clean
-- drop-and-recreate rather than an in-place ALTER COLUMN TYPE (which would just
-- cast "1".."13" to text -- meaningless ids that could never match a real post
-- and would upsert nothing, just sit there orphaned forever).
DROP TABLE "newsletter_issues";--> statement-breakpoint
CREATE TABLE "newsletter_issues" (
	"id" text PRIMARY KEY NOT NULL,
	"issue_date" date NOT NULL,
	"subject" text,
	"recipients" integer,
	"open_rate" numeric(5, 2),
	"click_rate" numeric(5, 2),
	"extra" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_newsletter_issues_date" ON "newsletter_issues" USING btree ("issue_date" DESC NULLS LAST);