import {
  pgTable,
  bigserial,
  text,
  integer,
  boolean,
  timestamp,
  date,
  numeric,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

// ── Instagram: dimension tables (upserted — rarely-changing metadata) ──────

export const instagramPosts = pgTable("instagram_posts", {
  id: text("id").primaryKey(), // Instagram media id
  postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
  mediaType: text("media_type").notNull(),
  productType: text("product_type"),
  caption: text("caption"),
  permalink: text("permalink"),
  // Instagram's CDN URLs are signed/time-limited -- these stay reasonably
  // fresh because every sync re-fetches and overwrites them (onConflictDoUpdate),
  // but a post that falls out of the most-recent-20 window stops being
  // refreshed and its stored URL will eventually expire.
  mediaUrl: text("media_url"),
  thumbnailUrl: text("thumbnail_url"),
  isSharedToFeed: boolean("is_shared_to_feed").notNull().default(true),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const instagramStories = pgTable("instagram_stories", {
  id: text("id").primaryKey(),
  postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
  mediaType: text("media_type"),
  caption: text("caption"),
  permalink: text("permalink"),
  mediaUrl: text("media_url"),
  thumbnailUrl: text("thumbnail_url"),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Instagram: fact tables (append-only — one row per sync fetch, never overwritten) ──

export const instagramAccountObservations = pgTable(
  "instagram_account_observations",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    followers: integer("followers").notNull(),
    following: integer("following"),
    mediaCount: integer("media_count"),
    biography: text("biography"),
    website: text("website"),
    profilePicUrl: text("profile_pic_url"),
    accountReach7d: integer("account_reach_7d"),
    accountProfileViews7d: integer("account_profile_views_7d"),
    accountWebsiteClicks7d: integer("account_website_clicks_7d"),
    extra: jsonb("extra").notNull().default({}),
  },
  (t) => [index("idx_ig_account_obs_fetched_at").on(t.fetchedAt.desc())],
);

export const instagramPostObservations = pgTable(
  "instagram_post_observations",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => instagramPosts.id),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    likes: integer("likes").notNull().default(0),
    comments: integer("comments").notNull().default(0),
    reach: integer("reach").notNull().default(0),
    saves: integer("saves").notNull().default(0),
    shares: integer("shares").notNull().default(0),
    totalInteractions: integer("total_interactions").notNull().default(0),
    profileVisits: integer("profile_visits").notNull().default(0),
    follows: integer("follows").notNull().default(0),
    plays: integer("plays").notNull().default(0),
    avgWatchTimeMs: integer("avg_watch_time_ms").notNull().default(0),
    extra: jsonb("extra").notNull().default({}),
  },
  (t) => [
    index("idx_ig_post_obs_post_fetched").on(t.postId, t.fetchedAt.desc()),
  ],
);

export const instagramStoryObservations = pgTable(
  "instagram_story_observations",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    storyId: text("story_id")
      .notNull()
      .references(() => instagramStories.id),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    impressions: integer("impressions").notNull().default(0),
    reach: integer("reach").notNull().default(0),
    replies: integer("replies").notNull().default(0),
    tapsForward: integer("taps_forward").notNull().default(0),
    tapsBack: integer("taps_back").notNull().default(0),
    exits: integer("exits").notNull().default(0),
    extra: jsonb("extra").notNull().default({}),
  },
  (t) => [
    index("idx_ig_story_obs_story_fetched").on(t.storyId, t.fetchedAt.desc()),
  ],
);

// Audit trail the old system never had — answers "did last night's sync work" directly.
export const syncRuns = pgTable("sync_runs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  source: text("source").notNull().default("instagram"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status", { enum: ["ok", "error"] }).notNull(),
  postsSynced: integer("posts_synced"),
  storiesSynced: integer("stories_synced"),
  errorMessage: text("error_message"),
});

// ── LinkedIn / Twitter: uploaded exports are already date-stamped by the
//    source, so upsert-by-natural-key already preserves full history at the
//    source's own granularity.

// Matches LinkedIn's native XLSX export shape exactly: {date, impressions,
// engagements} per day -- no granular reactions/comments/shares breakdown
// is available at daily grain, only the combined "engagements" number.
export const linkedinDailyEngagement = pgTable("linkedin_daily_engagement", {
  date: date("date").primaryKey(),
  impressions: integer("impressions"),
  engagements: integer("engagements"),
  extra: jsonb("extra").notNull().default({}), // demographics + whole-export summary lives here, on the latest day's row
});

export const linkedinPosts = pgTable(
  "linkedin_posts",
  {
    url: text("url").primaryKey(),
    publishedAt: date("published_at"),
    impressions: integer("impressions"),
    engagements: integer("engagements"),
    clicks: integer("clicks"),
    extra: jsonb("extra").notNull().default({}),
    lastUploadedAt: timestamp("last_uploaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("idx_li_posts_impressions").on(t.impressions.desc())],
);

// Twitter analytics exports are per-tweet rows (text/date/impressions/
// engagements/likes/retweets/replies/permalink), not daily aggregates --
// mirrors linkedin_posts, keyed by the tweet's permalink URL.
export const twitterPosts = pgTable(
  "twitter_posts",
  {
    url: text("url").primaryKey(),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    text: text("text"),
    impressions: integer("impressions"),
    engagements: integer("engagements"),
    likes: integer("likes"),
    retweets: integer("retweets"),
    replies: integer("replies"),
    extra: jsonb("extra").notNull().default({}),
    lastUploadedAt: timestamp("last_uploaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("idx_tw_posts_impressions").on(t.impressions.desc())],
);

// ── Newsletter: real table instead of a hardcoded object literal in index.html ──

export const newsletterSnapshots = pgTable("newsletter_snapshots", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  snapshotDate: date("snapshot_date").notNull().unique(),
  activeSubscribers: integer("active_subscribers").notNull(),
  totalSignups: integer("total_signups"),
  churned: integer("churned"),
  avgOpenRate: numeric("avg_open_rate", { precision: 5, scale: 2 }),
  avgClickRate: numeric("avg_click_rate", { precision: 5, scale: 2 }),
  revenueCents: integer("revenue_cents"),
  extra: jsonb("extra").notNull().default({}), // acquisition-source breakdown lives here
});

// Keyed by Beehiiv's own post id (stable, from the real API) rather than
// issue_date -- a hand-typed placeholder dataset never had two issues on the
// same day, but that's not a real invariant to rely on.
export const newsletterIssues = pgTable(
  "newsletter_issues",
  {
    id: text("id").primaryKey(), // Beehiiv post id
    issueDate: date("issue_date").notNull(),
    subject: text("subject"),
    recipients: integer("recipients"),
    openRate: numeric("open_rate", { precision: 5, scale: 2 }),
    clickRate: numeric("click_rate", { precision: 5, scale: 2 }),
    extra: jsonb("extra").notNull().default({}),
  },
  (t) => [index("idx_newsletter_issues_date").on(t.issueDate.desc())],
);

// Append-only, same shape as sync_runs -- each Refresh generates one new row
// (not an overwrite), so there's a free history of past recommendations and
// a normal page load just reads the latest one instead of calling the model.
export const aiRecommendations = pgTable("ai_recommendations", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  generatedAt: timestamp("generated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  model: text("model").notNull(),
  content: text("content").notNull(),
});

// Cheap, worth it: audit trail for the upload endpoint (no password to brute-force
// anymore since the whole dashboard is gated, but still useful to know who/what/when).
export const uploadAttempts = pgTable("upload_attempts", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  platform: text("platform").notNull(),
  succeeded: boolean("succeeded").notNull(),
  rowCount: integer("row_count"),
  ip: text("ip"),
  errorMessage: text("error_message"),
  attemptedAt: timestamp("attempted_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
