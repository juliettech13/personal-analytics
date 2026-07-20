/**
 * Applies content-category tags across every content type. Only ever
 * touches rows with no tags yet (`array_length(tags, 1) is null` -- the
 * standard "is this Postgres array empty" check), so this same function is
 * both the one-time backfill and the ongoing mechanism: new content just
 * shows up untagged and gets picked up next call, no separate code path.
 *
 * Classification runs sequentially, not in parallel, so each call's result
 * feeds into `existingTags` for the next -- reinforces bundling within a
 * single run, not just across runs, and avoids hammering the AI Gateway.
 */

import { sql } from "drizzle-orm";
import { getDb } from "../db/client";
import {
  instagramPosts,
  instagramStories,
  newsletterIssues,
  linkedinPosts,
  twitterPosts,
} from "../db/schema";
import { extractPostSnippet } from "../linkedin-post-text";
import { classifyContent } from "./classify";

type Db = ReturnType<typeof getDb>;

async function getAllExistingTags(db: Db): Promise<string[]> {
  const [ig, st, nl, li, tw] = await Promise.all([
    db.select({ tags: instagramPosts.tags }).from(instagramPosts),
    db.select({ tags: instagramStories.tags }).from(instagramStories),
    db.select({ tags: newsletterIssues.tags }).from(newsletterIssues),
    db.select({ tags: linkedinPosts.tags }).from(linkedinPosts),
    db.select({ tags: twitterPosts.tags }).from(twitterPosts),
  ]);
  const all = [...ig, ...st, ...nl, ...li, ...tw].flatMap((r) => r.tags);
  return [...new Set(all)];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(err: unknown): boolean {
  const msg = String(err);
  return msg.includes("rate_limit_exceeded") || msg.includes("rate-limited") || msg.includes("429");
}

// A large batch fires many sequential classify calls, which trips the AI
// Gateway's free-tier rate limit hard enough that the SDK's own built-in
// retry (a few attempts within seconds) isn't nearly long enough -- this
// free tier's cooldown window is on the order of tens of seconds, not
// single-digit. So rate-limit failures get their own much longer backoff
// and retry the SAME row a few times before giving up on it; any other
// failure just skips the row (same "optional" pattern already used for
// Instagram's per-post insight fetches) -- a failed row just stays
// untagged and gets picked up by the next run, since this whole function
// is idempotent by design.
const CLASSIFY_DELAY_MS = 1500;
const RATE_LIMIT_BACKOFF_MS = 45_000;
const MAX_RATE_LIMIT_RETRIES = 3;

async function classifyWithRateLimitRetry(text: string, existingTags: string[]): Promise<string[] | null> {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    try {
      return await classifyContent(text, existingTags);
    } catch (err) {
      if (isRateLimitError(err) && attempt < MAX_RATE_LIMIT_RETRIES) {
        console.warn(`  ⏳ rate-limited, waiting ${RATE_LIMIT_BACKOFF_MS / 1000}s before retry ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES}`);
        await sleep(RATE_LIMIT_BACKOFF_MS);
        continue;
      }
      console.warn(`  ⚠ (optional) tagging failed, leaving untagged for next run: ${err}`);
      return null;
    }
  }
  return null;
}

async function tagRows<Row>(
  rows: Row[],
  getText: (row: Row) => string | null,
  update: (row: Row, tags: string[]) => Promise<void>,
  existingTags: string[],
): Promise<number> {
  let count = 0;
  for (const row of rows) {
    const text = getText(row);
    if (!text) continue;

    const tags = await classifyWithRateLimitRetry(text, existingTags);
    if (!tags?.length) {
      await sleep(CLASSIFY_DELAY_MS);
      continue;
    }

    await update(row, tags);
    for (const t of tags) if (!existingTags.includes(t)) existingTags.push(t);
    count++;
    await sleep(CLASSIFY_DELAY_MS);
  }
  return count;
}

const UNTAGGED = sql`array_length(tags, 1) is null`;

export interface TaggingCounts {
  instagramPosts: number;
  instagramStories: number;
  newsletterIssues: number;
  linkedinPosts: number;
  twitterPosts: number;
}

export async function tagUntaggedContent(): Promise<TaggingCounts> {
  const db = getDb();
  const existingTags = await getAllExistingTags(db);

  const [untaggedPosts, untaggedStories, untaggedIssues, untaggedLinkedIn, untaggedTwitter] = await Promise.all([
    db.select().from(instagramPosts).where(UNTAGGED),
    db.select().from(instagramStories).where(UNTAGGED),
    db.select().from(newsletterIssues).where(UNTAGGED),
    db.select().from(linkedinPosts).where(UNTAGGED),
    db.select().from(twitterPosts).where(UNTAGGED),
  ]);

  const counts: TaggingCounts = {
    instagramPosts: await tagRows(
      untaggedPosts,
      (r) => r.caption,
      async (r, tags) => {
        await db.update(instagramPosts).set({ tags }).where(sql`${instagramPosts.id} = ${r.id}`);
      },
      existingTags,
    ),
    instagramStories: await tagRows(
      untaggedStories,
      (r) => r.caption,
      async (r, tags) => {
        await db.update(instagramStories).set({ tags }).where(sql`${instagramStories.id} = ${r.id}`);
      },
      existingTags,
    ),
    newsletterIssues: await tagRows(
      untaggedIssues,
      (r) => r.subject,
      async (r, tags) => {
        await db.update(newsletterIssues).set({ tags }).where(sql`${newsletterIssues.id} = ${r.id}`);
      },
      existingTags,
    ),
    linkedinPosts: await tagRows(
      untaggedLinkedIn,
      // LinkedIn's export has no post-text field at all -- derive a snippet
      // from the URL's own self-titling slug instead (same helper the UI
      // uses to display a "Post" preview column).
      (r) => extractPostSnippet(r.url) || null,
      async (r, tags) => {
        await db.update(linkedinPosts).set({ tags }).where(sql`${linkedinPosts.url} = ${r.url}`);
      },
      existingTags,
    ),
    twitterPosts: await tagRows(
      untaggedTwitter,
      (r) => r.text,
      async (r, tags) => {
        await db.update(twitterPosts).set({ tags }).where(sql`${twitterPosts.url} = ${r.url}`);
      },
      existingTags,
    ),
  };

  return counts;
}
