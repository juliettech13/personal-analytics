CREATE TABLE "instagram_account_observations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"followers" integer NOT NULL,
	"following" integer,
	"media_count" integer,
	"biography" text,
	"website" text,
	"profile_pic_url" text,
	"account_reach_7d" integer,
	"account_profile_views_7d" integer,
	"account_website_clicks_7d" integer,
	"extra" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instagram_post_observations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"reach" integer DEFAULT 0 NOT NULL,
	"saves" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"total_interactions" integer DEFAULT 0 NOT NULL,
	"profile_visits" integer DEFAULT 0 NOT NULL,
	"follows" integer DEFAULT 0 NOT NULL,
	"plays" integer DEFAULT 0 NOT NULL,
	"avg_watch_time_ms" integer DEFAULT 0 NOT NULL,
	"extra" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instagram_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"posted_at" timestamp with time zone NOT NULL,
	"media_type" text NOT NULL,
	"product_type" text,
	"caption" text,
	"permalink" text,
	"thumbnail_url" text,
	"is_shared_to_feed" boolean DEFAULT true NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instagram_stories" (
	"id" text PRIMARY KEY NOT NULL,
	"posted_at" timestamp with time zone NOT NULL,
	"media_type" text,
	"caption" text,
	"permalink" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instagram_story_observations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"reach" integer DEFAULT 0 NOT NULL,
	"replies" integer DEFAULT 0 NOT NULL,
	"taps_forward" integer DEFAULT 0 NOT NULL,
	"taps_back" integer DEFAULT 0 NOT NULL,
	"exits" integer DEFAULT 0 NOT NULL,
	"extra" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "linkedin_daily_engagement" (
	"date" date PRIMARY KEY NOT NULL,
	"impressions" integer,
	"engagements" integer,
	"extra" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "linkedin_posts" (
	"url" text PRIMARY KEY NOT NULL,
	"published_at" date,
	"impressions" integer,
	"engagements" integer,
	"clicks" integer,
	"extra" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "newsletter_issues" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"issue_date" date NOT NULL,
	"subject" text,
	"recipients" integer,
	"open_rate" numeric(5, 2),
	"click_rate" numeric(5, 2),
	"extra" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "newsletter_issues_issue_date_unique" UNIQUE("issue_date")
);
--> statement-breakpoint
CREATE TABLE "newsletter_snapshots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"snapshot_date" date NOT NULL,
	"active_subscribers" integer NOT NULL,
	"total_signups" integer,
	"churned" integer,
	"avg_open_rate" numeric(5, 2),
	"avg_click_rate" numeric(5, 2),
	"revenue_cents" integer,
	"extra" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "newsletter_snapshots_snapshot_date_unique" UNIQUE("snapshot_date")
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source" text DEFAULT 'instagram' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"posts_synced" integer,
	"stories_synced" integer,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "twitter_posts" (
	"url" text PRIMARY KEY NOT NULL,
	"posted_at" timestamp with time zone,
	"text" text,
	"impressions" integer,
	"engagements" integer,
	"likes" integer,
	"retweets" integer,
	"replies" integer,
	"extra" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upload_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"succeeded" boolean NOT NULL,
	"row_count" integer,
	"ip" text,
	"error_message" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "instagram_post_observations" ADD CONSTRAINT "instagram_post_observations_post_id_instagram_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."instagram_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instagram_story_observations" ADD CONSTRAINT "instagram_story_observations_story_id_instagram_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."instagram_stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ig_account_obs_fetched_at" ON "instagram_account_observations" USING btree ("fetched_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_ig_post_obs_post_fetched" ON "instagram_post_observations" USING btree ("post_id","fetched_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_ig_story_obs_story_fetched" ON "instagram_story_observations" USING btree ("story_id","fetched_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_li_posts_impressions" ON "linkedin_posts" USING btree ("impressions" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_tw_posts_impressions" ON "twitter_posts" USING btree ("impressions" DESC NULLS LAST);