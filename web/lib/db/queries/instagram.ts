import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "../client";
import {
  instagramAccountObservations,
  instagramPosts,
  instagramPostObservations,
  instagramStories,
  instagramStoryObservations,
} from "../schema";

/** VIDEO's own media_url is an .mp4 file, not displayable as <img> -- its
 * thumbnail_url is the real preview image. Every other type (IMAGE,
 * CAROUSEL_ALBUM) has the actual photo directly in media_url. */
export function displayImageUrl(
  mediaType: string | null,
  mediaUrl: string | null,
  thumbnailUrl: string | null,
): string | null {
  if (mediaType === "VIDEO") return thumbnailUrl || mediaUrl || null;
  return mediaUrl || thumbnailUrl || null;
}

export interface EnrichedPost {
  id: string;
  postedAt: Date;
  mediaType: string;
  productType: string;
  caption: string | null;
  permalink: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  isSharedToFeed: boolean;
  likes: number;
  comments: number;
  reach: number;
  saves: number;
  shares: number;
  totalInteractions: number;
  profileVisits: number;
  follows: number;
  plays: number;
  avgWatchTimeMs: number;
}

export interface EnrichedStory {
  id: string;
  postedAt: Date;
  mediaType: string | null;
  caption: string | null;
  permalink: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  impressions: number;
  reach: number;
  replies: number;
  tapsForward: number;
  tapsBack: number;
  exits: number;
}

export async function getLatestAccountObservation() {
  const db = getDb();
  const rows = await db
    .select()
    .from(instagramAccountObservations)
    .orderBy(desc(instagramAccountObservations.fetchedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getAccountHistory(limit = 500) {
  const db = getDb();
  const rows = await db
    .select({
      fetchedAt: instagramAccountObservations.fetchedAt,
      followers: instagramAccountObservations.followers,
    })
    .from(instagramAccountObservations)
    .orderBy(desc(instagramAccountObservations.fetchedAt))
    .limit(limit);
  return rows.reverse(); // chronological order for charting
}

/** Each post's most recent observation, joined onto its dimension row --
 * "current state" view, same shape the old data/latest.json posts[] had. */
export async function getPostsWithLatestMetrics(limit = 20): Promise<EnrichedPost[]> {
  const db = getDb();
  const latestPerPost = db
    .select({
      postId: instagramPostObservations.postId,
      maxFetchedAt: sql<string>`max(${instagramPostObservations.fetchedAt})`.as("max_fetched_at"),
    })
    .from(instagramPostObservations)
    .groupBy(instagramPostObservations.postId)
    .as("latest_per_post");

  const rows = await db
    .select({
      id: instagramPosts.id,
      postedAt: instagramPosts.postedAt,
      mediaType: instagramPosts.mediaType,
      productType: instagramPosts.productType,
      caption: instagramPosts.caption,
      permalink: instagramPosts.permalink,
      mediaUrl: instagramPosts.mediaUrl,
      thumbnailUrl: instagramPosts.thumbnailUrl,
      isSharedToFeed: instagramPosts.isSharedToFeed,
      likes: instagramPostObservations.likes,
      comments: instagramPostObservations.comments,
      reach: instagramPostObservations.reach,
      saves: instagramPostObservations.saves,
      shares: instagramPostObservations.shares,
      totalInteractions: instagramPostObservations.totalInteractions,
      profileVisits: instagramPostObservations.profileVisits,
      follows: instagramPostObservations.follows,
      plays: instagramPostObservations.plays,
      avgWatchTimeMs: instagramPostObservations.avgWatchTimeMs,
    })
    .from(instagramPosts)
    .innerJoin(
      latestPerPost,
      eq(instagramPosts.id, latestPerPost.postId),
    )
    .innerJoin(
      instagramPostObservations,
      sql`${instagramPostObservations.postId} = ${latestPerPost.postId} AND ${instagramPostObservations.fetchedAt} = ${latestPerPost.maxFetchedAt}`,
    )
    .orderBy(desc(instagramPosts.postedAt))
    .limit(limit);

  return rows as EnrichedPost[];
}

export async function getActiveStoriesWithLatestMetrics(): Promise<EnrichedStory[]> {
  const db = getDb();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const latestPerStory = db
    .select({
      storyId: instagramStoryObservations.storyId,
      maxFetchedAt: sql<string>`max(${instagramStoryObservations.fetchedAt})`.as("max_fetched_at"),
    })
    .from(instagramStoryObservations)
    .groupBy(instagramStoryObservations.storyId)
    .as("latest_per_story");

  const rows = await db
    .select({
      id: instagramStories.id,
      postedAt: instagramStories.postedAt,
      mediaType: instagramStories.mediaType,
      caption: instagramStories.caption,
      permalink: instagramStories.permalink,
      mediaUrl: instagramStories.mediaUrl,
      thumbnailUrl: instagramStories.thumbnailUrl,
      impressions: instagramStoryObservations.impressions,
      reach: instagramStoryObservations.reach,
      replies: instagramStoryObservations.replies,
      tapsForward: instagramStoryObservations.tapsForward,
      tapsBack: instagramStoryObservations.tapsBack,
      exits: instagramStoryObservations.exits,
    })
    .from(instagramStories)
    .innerJoin(latestPerStory, eq(instagramStories.id, latestPerStory.storyId))
    .innerJoin(
      instagramStoryObservations,
      sql`${instagramStoryObservations.storyId} = ${latestPerStory.storyId} AND ${instagramStoryObservations.fetchedAt} = ${latestPerStory.maxFetchedAt}`,
    )
    .where(sql`${instagramStories.postedAt} > ${oneDayAgo}`)
    .orderBy(desc(instagramStories.postedAt));

  return rows as EnrichedStory[];
}

/** One row per PAST (expired, >24h old) story, using its most recent
 * observation -- a real "past stories" log, not one row per sync. Every
 * observation is still preserved in instagram_story_observations for real
 * trend-over-time queries; this view just collapses to "latest known
 * metrics per story" so the same still-active story doesn't appear to
 * repeat every time the cron re-syncs it. */
export async function getStoriesHistory(limit = 50): Promise<EnrichedStory[]> {
  const db = getDb();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const latestPerStory = db
    .select({
      storyId: instagramStoryObservations.storyId,
      maxFetchedAt: sql<string>`max(${instagramStoryObservations.fetchedAt})`.as("max_fetched_at"),
    })
    .from(instagramStoryObservations)
    .groupBy(instagramStoryObservations.storyId)
    .as("latest_per_story_hist");

  const rows = await db
    .select({
      id: instagramStories.id,
      postedAt: instagramStories.postedAt,
      mediaType: instagramStories.mediaType,
      caption: instagramStories.caption,
      permalink: instagramStories.permalink,
      mediaUrl: instagramStories.mediaUrl,
      thumbnailUrl: instagramStories.thumbnailUrl,
      impressions: instagramStoryObservations.impressions,
      reach: instagramStoryObservations.reach,
      replies: instagramStoryObservations.replies,
      tapsForward: instagramStoryObservations.tapsForward,
      tapsBack: instagramStoryObservations.tapsBack,
      exits: instagramStoryObservations.exits,
    })
    .from(instagramStories)
    .innerJoin(latestPerStory, eq(instagramStories.id, latestPerStory.storyId))
    .innerJoin(
      instagramStoryObservations,
      sql`${instagramStoryObservations.storyId} = ${latestPerStory.storyId} AND ${instagramStoryObservations.fetchedAt} = ${latestPerStory.maxFetchedAt}`,
    )
    .where(
      sql`${instagramStories.postedAt} <= ${oneDayAgo}
          AND (${instagramStoryObservations.reach} > 0
               OR ${instagramStoryObservations.impressions} > 0
               OR ${instagramStories.mediaUrl} IS NOT NULL
               OR ${instagramStories.thumbnailUrl} IS NOT NULL)`,
    )
    .orderBy(desc(instagramStories.postedAt))
    .limit(limit);

  return rows as EnrichedStory[];
}
