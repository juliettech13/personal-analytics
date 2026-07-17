/**
 * TypeScript port of the Instagram Graph API fetch logic that used to live
 * embedded in .github/workflows/instagram-sync.yml as a Python script. Same
 * endpoints, same v22 API, same "optional insight" tolerance pattern: a
 * failure to fetch the base account/media list aborts the whole sync, but a
 * missing per-post/per-story insight just defaults to 0 rather than failing
 * the run (many insights aren't available for every media type).
 */

import { mirrorImageToBlob } from "./media";

const GRAPH_BASE = "https://graph.facebook.com/v22.0";

type GraphParams = Record<string, string | number>;

/** Graph API responses are arbitrary JSON we only ever read a handful of
 * known fields from -- a recursive structural type gets us real property
 * access without resorting to `any`. */
type GraphNode = {
  [key: string]: GraphNode | GraphNode[] | string | number | boolean | null | undefined;
};

async function apiGet(path: string, params: GraphParams, optional = false): Promise<GraphNode> {
  const token = process.env.IG_TOKEN;
  if (!token) throw new Error("IG_TOKEN not configured");

  const qs = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    access_token: token,
  });
  const url = `${GRAPH_BASE}${path}?${qs}`;

  let data: GraphNode;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    data = await res.json();
  } catch (err) {
    if (optional) {
      console.warn(`  ⚠ (optional) request failed on ${path}: ${err}`);
      return {};
    }
    throw new Error(`Request failed on ${path}: ${err}`);
  }

  if (data.error) {
    const err = data.error as GraphNode;
    if (optional) {
      console.warn(
        `  ⚠ (optional) Graph API error on ${path}: code=${err.code} — ${err.message}`,
      );
      return {};
    }
    throw new Error(
      `Graph API error on ${path}: code=${err.code} type=${err.type} message=${err.message}`,
    );
  }

  return data;
}

/** Reads a metric's value out of an insights `data[]` entry, trying every
 * shape the Graph API has used across versions (value / total_value.value /
 * values[-1].value). */
function insightValue(item: GraphNode): number {
  if (typeof item.value === "number") return item.value;
  const totalValue = item.total_value as GraphNode | undefined;
  if (typeof totalValue?.value === "number") return totalValue.value;
  const values = (item.values as GraphNode[] | undefined) ?? [];
  const last = values[values.length - 1];
  return typeof last?.value === "number" ? last.value : 0;
}

export interface FetchedPost {
  id: string;
  postedAt: Date;
  mediaType: string;
  productType: string;
  caption: string;
  permalink: string;
  mediaUrl: string;
  thumbnailUrl: string;
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

export interface FetchedStory {
  id: string;
  postedAt: Date;
  mediaType: string;
  caption: string;
  permalink: string;
  mediaUrl: string;
  thumbnailUrl: string;
  impressions: number;
  reach: number;
  replies: number;
  tapsForward: number;
  tapsBack: number;
  exits: number;
  extra: Record<string, number>;
}

export interface InstagramSnapshot {
  username: string;
  followers: number;
  following: number;
  biography: string;
  website: string;
  profilePicUrl: string;
  mediaCount: number;
  posts: FetchedPost[];
  stories: FetchedStory[];
  accountMetrics: Record<string, number>;
  fetchedAt: Date;
}

function str(node: GraphNode, key: string, fallback = ""): string {
  const v = node[key];
  return typeof v === "string" ? v : fallback;
}
function num(node: GraphNode, key: string, fallback = 0): number {
  const v = node[key];
  return typeof v === "number" ? v : fallback;
}
function bool(node: GraphNode, key: string, fallback = false): boolean {
  const v = node[key];
  return typeof v === "boolean" ? v : fallback;
}
function arr(node: GraphNode, key: string): GraphNode[] {
  const v = node[key];
  return Array.isArray(v) ? v : [];
}

async function fetchPost(m: GraphNode): Promise<FetchedPost> {
  const mediaType = str(m, "media_type");
  const productType = str(m, "media_product_type", "FEED");
  const isReel = productType === "REELS";
  const isVideo = mediaType === "VIDEO";
  const id = str(m, "id");

  // media_url is the actual photo for IMAGE/CAROUSEL_ALBUM, but an .mp4 file
  // for VIDEO -- thumbnail_url is the displayable preview image for video.
  // Only mirror whichever one is actually the "picture" for this media type
  // (no point re-hosting a multi-MB video file we never display).
  const mediaUrl = isVideo
    ? ""
    : await mirrorImageToBlob(str(m, "media_url"), `instagram/posts/${id}.jpg`);
  const thumbnailUrl = isVideo
    ? await mirrorImageToBlob(str(m, "thumbnail_url"), `instagram/posts/${id}.jpg`)
    : "";

  const post: FetchedPost = {
    id,
    postedAt: new Date(str(m, "timestamp") || Date.now()),
    mediaType,
    productType,
    caption: str(m, "caption").slice(0, 300),
    permalink: str(m, "permalink"),
    mediaUrl,
    thumbnailUrl,
    isSharedToFeed: bool(m, "is_shared_to_feed"),
    likes: num(m, "like_count"),
    comments: num(m, "comments_count"),
    reach: 0,
    saves: 0,
    shares: 0,
    totalInteractions: 0,
    profileVisits: 0,
    follows: 0,
    plays: 0,
    avgWatchTimeMs: 0,
  };

  // Base insights (all media types, v22+ compatible) -- required.
  const baseIns = await apiGet(`/${id}/insights`, {
    metric: "reach,saved,shares,total_interactions",
    period: "lifetime",
  });
  for (const item of arr(baseIns, "data")) {
    const name = str(item, "name");
    const value = insightValue(item) || 0;
    if (name === "reach") post.reach = value;
    else if (name === "saved") post.saves = value;
    else if (name === "shares") post.shares = value;
    else if (name === "total_interactions") post.totalInteractions = value;
  }

  // profile_visits + follows -- only supported for some media types (optional).
  const pvIns = await apiGet(
    `/${id}/insights`,
    { metric: "profile_visits,follows", period: "lifetime" },
    true,
  );
  for (const item of arr(pvIns, "data")) {
    const name = str(item, "name");
    if (name === "profile_visits") post.profileVisits = insightValue(item) || 0;
    if (name === "follows") post.follows = insightValue(item) || 0;
  }

  // Reel-specific insights (optional -- not all video posts are Reels).
  // 'plays' was deprecated in favor of 'views' at some point after the
  // original script was written (confirmed live: Graph API now rejects
  // 'plays' entirely) -- same rename pattern already handled for stories.
  if (isReel || isVideo) {
    const reelIns = await apiGet(
      `/${id}/insights`,
      { metric: "views,ig_reels_avg_watch_time", period: "lifetime" },
      true,
    );
    for (const item of arr(reelIns, "data")) {
      const name = str(item, "name");
      if (name === "views") post.plays = insightValue(item) || 0;
      else if (name === "ig_reels_avg_watch_time") post.avgWatchTimeMs = num(item, "value");
    }
  }

  return post;
}

/** Reads the per-category results out of a metric's total_value.breakdowns[0],
 * e.g. navigation's story_navigation_action_type breakdown: [{dimension_values:
 * ["tap_forward"], value: N}, ...]. */
function breakdownResults(item: GraphNode): Array<{ key: string; value: number }> {
  const totalValue = item.total_value as GraphNode | undefined;
  const breakdowns = (totalValue?.breakdowns as GraphNode[] | undefined) ?? [];
  const results = (breakdowns[0]?.results as GraphNode[] | undefined) ?? [];
  return results.map((r) => {
    const dims = (r.dimension_values as string[] | undefined) ?? [];
    return { key: dims[0] ?? "", value: num(r, "value") };
  });
}

async function fetchStory(s: GraphNode): Promise<FetchedStory> {
  const id = str(s, "id");
  const isVideo = str(s, "media_type") === "VIDEO";
  const mediaUrl = isVideo ? "" : await mirrorImageToBlob(str(s, "media_url"), `instagram/stories/${id}.jpg`);
  const thumbnailUrl = isVideo
    ? await mirrorImageToBlob(str(s, "thumbnail_url"), `instagram/stories/${id}.jpg`)
    : "";

  const story: FetchedStory = {
    id,
    postedAt: new Date(str(s, "timestamp") || Date.now()),
    mediaType: str(s, "media_type"),
    caption: str(s, "caption").slice(0, 200),
    permalink: str(s, "permalink"),
    mediaUrl,
    thumbnailUrl,
    impressions: 0,
    reach: 0,
    replies: 0,
    tapsForward: 0,
    tapsBack: 0,
    exits: 0,
    extra: {},
  };

  // 'impressions' was deprecated in favor of 'views' (Graph API v22, Apr 2025).
  // taps_forward/taps_back/exits were later deprecated entirely in favor of a
  // single combined 'navigation' metric with a per-action-type breakdown --
  // confirmed live (the old flat metric names now hard-error the whole call,
  // which silently zeroed out every story since this request is optional).
  // The breakdown requires its own call: Graph API rejects mixing a
  // breakdown-bearing metric with plain metrics in one request.
  const ins = await apiGet(`/${id}/insights`, { metric: "views,reach,replies" }, true);
  for (const item of arr(ins, "data")) {
    const name = str(item, "name");
    const val = insightValue(item) || 0;
    if (name === "views") story.impressions = val;
    else if (name === "reach") story.reach = val;
    else if (name === "replies") story.replies = val;
  }

  const navIns = await apiGet(
    `/${id}/insights`,
    { metric: "navigation", metric_type: "total_value", breakdown: "story_navigation_action_type" },
    true,
  );
  for (const item of arr(navIns, "data")) {
    for (const { key, value } of breakdownResults(item)) {
      if (key === "tap_forward") story.tapsForward = value;
      else if (key === "tap_back") story.tapsBack = value;
      else if (key === "tap_exit") story.exits = value;
      else if (key) story.extra[key] = value; // e.g. swipe_forward -- new category, no dedicated column
    }
  }

  return story;
}

export async function fetchInstagramSnapshot(): Promise<InstagramSnapshot> {
  // ── Discover Instagram Business Account ID ──
  const pagesResp = await apiGet("/me/accounts", {
    fields: "id,name,instagram_business_account",
  });
  let igUserId: string | undefined;
  for (const page of arr(pagesResp, "data")) {
    const igBiz = page.instagram_business_account as GraphNode | undefined;
    const id = igBiz ? str(igBiz, "id") : "";
    if (id) {
      igUserId = id;
      break;
    }
  }
  if (!igUserId) {
    throw new Error(
      `No Instagram Business Account found. Pages visible: ${arr(pagesResp, "data")
        .map((p) => str(p, "name"))
        .join(", ")}`,
    );
  }

  // ── Profile ──
  const profile = await apiGet(`/${igUserId}`, {
    fields: "id,username,followers_count,follows_count,biography,website,profile_picture_url",
  });

  // ── Account-level insights (last 7 days, aggregated) ──
  // Graph API now requires metric_type=total_value for these account-level
  // metrics (added after the original script was written -- without it,
  // the API rejects the request with code 100 and this silently came back
  // empty). With total_value, the API returns one pre-aggregated number per
  // metric directly, so no more manual summing of a daily values[] array.
  const nowSec = Math.floor(Date.now() / 1000);
  const sevenDaysAgoSec = nowSec - 7 * 24 * 60 * 60;
  const acctIns = await apiGet(
    `/${igUserId}/insights`,
    {
      metric: "reach,profile_views,website_clicks,accounts_engaged,follows_and_unfollows",
      metric_type: "total_value",
      period: "day",
      since: sevenDaysAgoSec,
      until: nowSec,
    },
    true,
  );
  const accountMetrics: Record<string, number> = {};
  for (const item of arr(acctIns, "data")) {
    accountMetrics[str(item, "name")] = insightValue(item);
  }

  // ── Recent media (up to 20) ──
  const mediaResp = await apiGet(`/${igUserId}/media`, {
    fields:
      "id,caption,media_type,media_product_type,timestamp,like_count,comments_count,permalink,media_url,thumbnail_url,is_shared_to_feed",
    limit: 20,
  });
  const posts: FetchedPost[] = [];
  for (const m of arr(mediaResp, "data")) {
    posts.push(await fetchPost(m));
  }

  // ── Stories (active only -- Instagram stories expire after 24h) ──
  const storiesResp = await apiGet(
    `/${igUserId}/stories`,
    { fields: "id,caption,media_type,timestamp,permalink,media_url,thumbnail_url" },
    true,
  );
  const stories: FetchedStory[] = [];
  for (const s of arr(storiesResp, "data")) {
    stories.push(await fetchStory(s));
  }

  return {
    username: str(profile, "username"),
    followers: num(profile, "followers_count"),
    following: num(profile, "follows_count"),
    biography: str(profile, "biography"),
    website: str(profile, "website"),
    profilePicUrl: str(profile, "profile_picture_url"),
    mediaCount: posts.length,
    posts,
    stories,
    accountMetrics,
    fetchedAt: new Date(),
  };
}
