import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db/client";
import { fetchInstagramSnapshot } from "@/lib/instagram/sync";
import { SESSION_COOKIE, isValidSessionCookie } from "@/lib/auth";
import {
  instagramPosts,
  instagramStories,
  instagramAccountObservations,
  instagramPostObservations,
  instagramStoryObservations,
  syncRuns,
} from "@/lib/db/schema";

// Fetching + re-hosting ~20 post images and a couple of story images to
// Blob pushes a full sync to ~45s; give it real headroom rather than
// cutting it close (Fluid Compute defaults to 300s on every plan incl. Hobby).
export const maxDuration = 180;

// GET, guarded by Authorization: Bearer $CRON_SECRET -- the only route
// proxy.ts excludes, since Vercel Cron calls it directly, not through a
// browser session.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return runSync();
}

async function runSync() {
  const db = getDb();
  const startedAt = new Date();

  // 1. Fetch everything first -- nothing is written until the full payload
  //    is in hand. Only a failure to fetch the base account/media list
  //    aborts the run (per-post/per-story optional insights already
  //    default to 0 inside fetchInstagramSnapshot, mirroring the old
  //    Python's optional=True pattern).
  let snapshot;
  try {
    snapshot = await fetchInstagramSnapshot();
  } catch (err) {
    await db.insert(syncRuns).values({
      status: "error",
      startedAt,
      finishedAt: new Date(),
      errorMessage: String(err),
    });
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }

  // 2. Write everything as one atomic batch -- a mid-run failure rolls back
  //    cleanly instead of leaving partial file-commits like the old system.
  //    (neon-http doesn't support interactive transactions -- db.batch()
  //    is its atomic-multi-statement equivalent, which is all we need since
  //    none of these statements depend on each other's runtime result.)
  const queries: Parameters<typeof db.batch>[0][number][] = [
    db.insert(instagramAccountObservations).values({
      fetchedAt: snapshot.fetchedAt,
      followers: snapshot.followers,
      following: snapshot.following,
      mediaCount: snapshot.mediaCount,
      biography: snapshot.biography,
      website: snapshot.website,
      profilePicUrl: snapshot.profilePicUrl,
      extra: snapshot.accountMetrics,
    }),
  ];

  for (const post of snapshot.posts) {
    queries.push(
      db
        .insert(instagramPosts)
        .values({
          id: post.id,
          postedAt: post.postedAt,
          mediaType: post.mediaType,
          productType: post.productType,
          caption: post.caption,
          permalink: post.permalink,
          mediaUrl: post.mediaUrl,
          thumbnailUrl: post.thumbnailUrl,
          isSharedToFeed: post.isSharedToFeed,
        })
        .onConflictDoUpdate({
          target: instagramPosts.id,
          set: {
            caption: post.caption,
            permalink: post.permalink,
            // Refreshed on every sync since Instagram's CDN URLs are signed
            // and expire -- this keeps images for currently-synced posts
            // reasonably fresh (see schema.ts comment on this column).
            mediaUrl: post.mediaUrl,
            thumbnailUrl: post.thumbnailUrl,
            isSharedToFeed: post.isSharedToFeed,
          },
        }),
    );
    queries.push(
      db.insert(instagramPostObservations).values({
        postId: post.id,
        fetchedAt: snapshot.fetchedAt,
        likes: post.likes,
        comments: post.comments,
        reach: post.reach,
        saves: post.saves,
        shares: post.shares,
        totalInteractions: post.totalInteractions,
        profileVisits: post.profileVisits,
        follows: post.follows,
        plays: post.plays,
        avgWatchTimeMs: post.avgWatchTimeMs,
      }),
    );
  }

  for (const story of snapshot.stories) {
    queries.push(
      db
        .insert(instagramStories)
        .values({
          id: story.id,
          postedAt: story.postedAt,
          mediaType: story.mediaType,
          caption: story.caption,
          permalink: story.permalink,
          mediaUrl: story.mediaUrl,
          thumbnailUrl: story.thumbnailUrl,
        })
        .onConflictDoUpdate({
          target: instagramStories.id,
          set: {
            caption: story.caption,
            permalink: story.permalink,
            mediaUrl: story.mediaUrl,
            thumbnailUrl: story.thumbnailUrl,
          },
        }),
    );
    queries.push(
      db.insert(instagramStoryObservations).values({
        storyId: story.id,
        fetchedAt: snapshot.fetchedAt,
        impressions: story.impressions,
        reach: story.reach,
        replies: story.replies,
        tapsForward: story.tapsForward,
        tapsBack: story.tapsBack,
        exits: story.exits,
        extra: story.extra,
      }),
    );
  }

  queries.push(
    db.insert(syncRuns).values({
      status: "ok",
      startedAt,
      finishedAt: new Date(),
      postsSynced: snapshot.posts.length,
      storiesSynced: snapshot.stories.length,
    }),
  );

  try {
    await db.batch(queries as [(typeof queries)[number], ...(typeof queries)[number][]]);
  } catch (err) {
    await db.insert(syncRuns).values({
      status: "error",
      startedAt,
      finishedAt: new Date(),
      errorMessage: String(err),
    });
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }

  return Response.json({
    ok: true,
    posts: snapshot.posts.length,
    stories: snapshot.stories.length,
  });
}

// The old "↺ Refresh" dock button becomes a manual trigger of this same
// logic. proxy.ts excludes the whole /api/cron/* path from its session gate
// (so the bearer-token GET above isn't redirected to /login), which means
// THIS handler has to check the session cookie itself -- it's not covered
// by proxy.ts's blanket exclusion.
export async function POST() {
  const jar = await cookies();
  if (!isValidSessionCookie(jar.get(SESSION_COOKIE)?.value)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return runSync();
}
