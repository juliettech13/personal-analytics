/**
 * One-time backfill: reads the legacy git-committed JSON/JSONL files from
 * the old static-site pipeline and loads them into Postgres.
 *
 * Usage:
 *   npm run backfill -- --dev              (targets whatever DATABASE_URL
 *                                            is in .env.local -- the Neon
 *                                            dev branch, by default)
 *   dotenv -e .env.production.local -- tsx scripts/backfill.ts --yes-production
 *
 * Every write is idempotent (upsert for dimension tables, existence-check
 * before insert for observation tables), so it's always safe to re-run
 * after fixing a bug -- it will not duplicate history.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "../lib/db/client";
import {
  instagramPosts,
  instagramStories,
  instagramAccountObservations,
  instagramPostObservations,
  instagramStoryObservations,
} from "../lib/db/schema";

const REPO_ROOT = join(__dirname, "..", "..");
const DATA_DIR = join(REPO_ROOT, "data");

const args = process.argv.slice(2);
if (!args.includes("--dev") && !args.includes("--yes-production")) {
  console.error(
    "Refusing to run without an explicit target flag.\n" +
      "  --dev              run against .env.local's DATABASE_URL (the Neon dev branch)\n" +
      "  --yes-production   run against whatever DATABASE_URL is currently loaded -- only pass this when you deliberately pointed it at production",
  );
  process.exit(1);
}

const db = getDb();

// ── Shapes of the legacy JSON files (loose -- every field but the ones we
//    truly depend on is optional, since the schema has visibly drifted) ──

const legacyPostSchema = z
  .object({
    id: z.string(),
    date: z.string(), // "YYYY-MM-DD", no time component
    type: z.string(),
    product_type: z.string().optional(),
    caption: z.string().optional(),
    url: z.string().optional(),
    thumbnail_url: z.string().optional(),
    is_shared_to_feed: z.boolean().optional(),
    likes: z.number().optional(),
    comments: z.number().optional(),
    reach: z.number().optional(),
    saves: z.number().optional(),
    shares: z.number().optional(),
    total_interactions: z.number().optional(),
    profile_visits: z.number().optional(),
    follows: z.number().optional(),
    plays: z.number().optional(),
    avg_watch_time_ms: z.number().optional(),
  })
  .passthrough();

const legacyStorySchema = z
  .object({
    id: z.string(),
    date: z.string().optional(),
    timestamp: z.string().optional(),
    media_type: z.string().optional(),
    caption: z.string().optional(),
    url: z.string().optional(),
    impressions: z.number().optional(),
    reach: z.number().optional(),
    replies: z.number().optional(),
    taps_forward: z.number().optional(),
    taps_back: z.number().optional(),
    exits: z.number().optional(),
  })
  .passthrough();

const legacySnapshotSchema = z.object({
  username: z.string().optional(),
  followers: z.number(),
  following: z.number().optional(),
  media_count: z.number().optional(),
  biography: z.string().optional(),
  website: z.string().optional(),
  profile_pic: z.string().optional(),
  account_metrics: z.record(z.string(), z.unknown()).optional(),
  posts: z.array(legacyPostSchema).optional(),
  stories: z.array(legacyStorySchema).optional(),
  fetched_at: z.string(),
});

const historyLineSchema = z
  .object({
    t: z.string(),
    f: z.number().optional(),
    fw: z.number().optional(), // following (current field name)
    mc: z.number().optional(), // media_count (old field name -- NOT the same as fw, never conflate)
    pc: z.number().optional(),
    tl: z.number().optional(),
    tc: z.number().optional(),
    al: z.number().optional(),
    tr: z.number().optional(),
    ts: z.number().optional(),
    tp: z.number().optional(),
    tf: z.number().optional(),
    ar: z.number().optional(),
    pv: z.number().optional(),
    wc: z.number().optional(),
  })
  .passthrough();

const storiesJsonlLineSchema = z
  .object({
    sync_at: z.string(),
    id: z.string(),
    date: z.string().optional(),
    timestamp: z.string().optional(),
    media_type: z.string().optional(),
    caption: z.string().optional(),
    url: z.string().optional(),
    impressions: z.number().optional(),
    reach: z.number().optional(),
    replies: z.number().optional(),
    taps_forward: z.number().optional(),
    taps_back: z.number().optional(),
    exits: z.number().optional(),
  })
  .passthrough();

// ── Helpers ──

const seenAccountFetchedAt = new Set<string>(); // ISO strings already inserted this run
const knownPostIds = new Set<string>();
const knownStoryIds = new Set<string>();

function dateOnlyToTimestamp(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

async function upsertPostDimension(post: z.infer<typeof legacyPostSchema>) {
  if (knownPostIds.has(post.id)) return;
  await db
    .insert(instagramPosts)
    .values({
      id: post.id,
      postedAt: dateOnlyToTimestamp(post.date),
      mediaType: post.type,
      productType: post.product_type,
      caption: post.caption,
      permalink: post.url,
      thumbnailUrl: post.thumbnail_url,
      isSharedToFeed: post.is_shared_to_feed ?? true,
    })
    .onConflictDoNothing({ target: instagramPosts.id });
  knownPostIds.add(post.id);
}

async function insertPostObservationIfMissing(
  post: z.infer<typeof legacyPostSchema>,
  fetchedAt: Date,
) {
  const existing = await db.query.instagramPostObservations.findFirst({
    where: and(
      eq(instagramPostObservations.postId, post.id),
      eq(instagramPostObservations.fetchedAt, fetchedAt),
    ),
  });
  if (existing) return;

  await db.insert(instagramPostObservations).values({
    postId: post.id,
    fetchedAt,
    likes: post.likes ?? 0,
    comments: post.comments ?? 0,
    reach: post.reach ?? 0,
    saves: post.saves ?? 0,
    shares: post.shares ?? 0,
    totalInteractions: post.total_interactions ?? 0,
    profileVisits: post.profile_visits ?? 0,
    follows: post.follows ?? 0,
    plays: post.plays ?? 0,
    avgWatchTimeMs: post.avg_watch_time_ms ?? 0,
  });
}

async function upsertStoryDimension(story: z.infer<typeof legacyStorySchema>) {
  if (knownStoryIds.has(story.id)) return;
  const postedAt = story.timestamp
    ? new Date(story.timestamp)
    : story.date
      ? dateOnlyToTimestamp(story.date)
      : new Date();
  await db
    .insert(instagramStories)
    .values({
      id: story.id,
      postedAt,
      mediaType: story.media_type,
      caption: story.caption,
      permalink: story.url,
    })
    .onConflictDoNothing({ target: instagramStories.id });
  knownStoryIds.add(story.id);
}

async function insertStoryObservationIfMissing(
  story: z.infer<typeof legacyStorySchema>,
  fetchedAt: Date,
) {
  const existing = await db.query.instagramStoryObservations.findFirst({
    where: and(
      eq(instagramStoryObservations.storyId, story.id),
      eq(instagramStoryObservations.fetchedAt, fetchedAt),
    ),
  });
  if (existing) return;

  await db.insert(instagramStoryObservations).values({
    storyId: story.id,
    fetchedAt,
    impressions: story.impressions ?? 0,
    reach: story.reach ?? 0,
    replies: story.replies ?? 0,
    tapsForward: story.taps_forward ?? 0,
    tapsBack: story.taps_back ?? 0,
    exits: story.exits ?? 0,
  });
}

async function insertAccountObservationIfMissing(opts: {
  fetchedAt: Date;
  followers: number;
  following?: number;
  mediaCount?: number;
  biography?: string;
  website?: string;
  profilePicUrl?: string;
  accountReach7d?: number;
  accountProfileViews7d?: number;
  accountWebsiteClicks7d?: number;
  extra?: Record<string, unknown>;
}) {
  const key = opts.fetchedAt.toISOString();
  if (seenAccountFetchedAt.has(key)) return false;

  const existing = await db.query.instagramAccountObservations.findFirst({
    where: eq(instagramAccountObservations.fetchedAt, opts.fetchedAt),
  });
  seenAccountFetchedAt.add(key);
  if (existing) return false;

  await db.insert(instagramAccountObservations).values({
    fetchedAt: opts.fetchedAt,
    followers: opts.followers,
    following: opts.following,
    mediaCount: opts.mediaCount,
    biography: opts.biography,
    website: opts.website,
    profilePicUrl: opts.profilePicUrl,
    accountReach7d: opts.accountReach7d,
    accountProfileViews7d: opts.accountProfileViews7d,
    accountWebsiteClicks7d: opts.accountWebsiteClicks7d,
    extra: opts.extra ?? {},
  });
  return true;
}

async function processSnapshot(raw: unknown, label: string) {
  const snap = legacySnapshotSchema.parse(raw);
  const fetchedAt = new Date(snap.fetched_at);

  const inserted = await insertAccountObservationIfMissing({
    fetchedAt,
    followers: snap.followers,
    following: snap.following,
    mediaCount: snap.media_count,
    biography: snap.biography,
    website: snap.website,
    profilePicUrl: snap.profile_pic,
    extra: snap.account_metrics,
  });

  for (const post of snap.posts ?? []) {
    await upsertPostDimension(post);
    await insertPostObservationIfMissing(post, fetchedAt);
  }
  for (const story of snap.stories ?? []) {
    await upsertStoryDimension(story);
    await insertStoryObservationIfMissing(story, fetchedAt);
  }

  console.log(
    `[${label}] fetched_at=${snap.fetched_at} account_observation=${inserted ? "inserted" : "skipped(dup)"} posts=${snap.posts?.length ?? 0} stories=${snap.stories?.length ?? 0}`,
  );
}

async function backfillDailySnapshots() {
  const dailyDir = join(DATA_DIR, "daily");
  const files = readdirSync(dailyDir).filter((f) => f.endsWith(".json"));
  for (const file of files.sort()) {
    const raw = JSON.parse(readFileSync(join(dailyDir, file), "utf-8"));
    await processSnapshot(raw, `daily/${file}`);
  }
}

async function backfillLatest() {
  const raw = JSON.parse(readFileSync(join(DATA_DIR, "latest.json"), "utf-8"));
  await processSnapshot(raw, "latest.json");
}

async function backfillStoriesJsonl() {
  const lines = readFileSync(join(DATA_DIR, "stories.jsonl"), "utf-8")
    .split("\n")
    .filter((l) => l.trim());

  for (const line of lines) {
    const parsed = storiesJsonlLineSchema.safeParse(JSON.parse(line));
    if (!parsed.success) {
      console.warn(`[stories.jsonl] skipping malformed line: ${line.slice(0, 80)}`);
      continue;
    }
    const story = parsed.data;
    await upsertStoryDimension(story);
    await insertStoryObservationIfMissing(story, new Date(story.sync_at));
  }
  console.log(`[stories.jsonl] processed ${lines.length} lines`);
}

async function backfillHistoryJsonl() {
  const lines = readFileSync(join(DATA_DIR, "history.jsonl"), "utf-8")
    .split("\n")
    .filter((l) => l.trim());

  let inserted = 0;
  let skippedBootstrap = 0;
  let skippedDup = 0;

  for (const line of lines) {
    const parsed = historyLineSchema.safeParse(JSON.parse(line));
    if (!parsed.success) {
      console.warn(`[history.jsonl] skipping malformed line: ${line.slice(0, 80)}`);
      continue;
    }
    const row = parsed.data;

    // Known-broken bootstrap record from the very first run: zero followers
    // AND zero posts fetched together is the bootstrap signature, not a
    // real observation (a real account can plausibly show zero of *one*
    // metric on a slow day, but not both at once on day one).
    if ((row.f ?? 0) === 0 && (row.pc ?? 0) === 0) {
      skippedBootstrap++;
      continue;
    }

    const fetchedAt = new Date(row.t);
    const wasNew = await insertAccountObservationIfMissing({
      fetchedAt,
      followers: row.f ?? 0,
      following: row.fw, // NEW field name -- never mapped from `mc`
      mediaCount: row.mc, // OLD field name -- never mapped from `fw`
      extra: {
        top_likes: row.tl,
        top_comments: row.tc,
        avg_likes: row.al,
        total_reach: row.tr,
        total_saves: row.ts,
        total_plays: row.tp,
        total_follows_from_posts: row.tf,
        account_reach_7d_legacy: row.ar,
        account_profile_views_7d_legacy: row.pv,
        account_website_clicks_7d_legacy: row.wc,
      },
    });

    if (wasNew) inserted++;
    else skippedDup++;
  }

  console.log(
    `[history.jsonl] ${lines.length} lines: ${inserted} inserted, ${skippedDup} skipped (already covered by a daily/latest snapshot), ${skippedBootstrap} skipped (broken bootstrap record)`,
  );
}

async function main() {
  console.log("Backfilling from legacy data/ files into Postgres...\n");

  await backfillDailySnapshots();
  await backfillLatest();
  await backfillStoriesJsonl();
  await backfillHistoryJsonl();

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
