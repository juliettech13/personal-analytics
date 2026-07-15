import {
  getLatestAccountObservation,
  getAccountHistory,
  getPostsWithLatestMetrics,
  getActiveStoriesWithLatestMetrics,
  getStoriesHistory,
} from "@/lib/db/queries/instagram";
import { getLinkedInDailyEngagement, getLinkedInPosts } from "@/lib/db/queries/linkedin";
import { getTwitterPosts } from "@/lib/db/queries/twitter";
import { getNewsletterSnapshots, getNewsletterIssues } from "@/lib/db/queries/newsletter";
import { DashboardClient, type DashboardData } from "./dashboard-client";

type LinkedInDailyExtra = { demographics?: Array<{ category: string; value: string; pct: string }> };
type NewsletterSnapshotExtra = { sources?: Array<{ name: string; count: number }> };
type NewsletterIssueExtra = { webViews?: number; unsubs?: number; url?: string };

// This is a personal, low-traffic dashboard -- always render fresh from
// Postgres rather than caching, so a sync/upload is reflected immediately
// without a rebuild. This is the direct fix for the bug that started this
// whole migration (data changes requiring a full site redeploy to show up).
export const dynamic = "force-dynamic";

export default async function Home() {
  const [account, history, posts, activeStories, storiesHistory, liDaily, liPosts, twPosts, nlSnapshots, nlIssues] =
    await Promise.all([
      getLatestAccountObservation(),
      getAccountHistory(),
      getPostsWithLatestMetrics(),
      getActiveStoriesWithLatestMetrics(),
      getStoriesHistory(),
      getLinkedInDailyEngagement(),
      getLinkedInPosts(),
      getTwitterPosts(),
      getNewsletterSnapshots(),
      getNewsletterIssues(),
    ]);

  const data: DashboardData = {
    instagram: {
      account: account
        ? {
            followers: account.followers,
            following: account.following,
            mediaCount: account.mediaCount,
            biography: account.biography,
            website: account.website,
            profilePicUrl: account.profilePicUrl,
          }
        : null,
      posts,
      history,
      activeStories,
      storiesHistory,
      username: "_juliettech",
    },
    newsletter: {
      snapshots: nlSnapshots.map((s) => ({ ...s, extra: s.extra as NewsletterSnapshotExtra })),
      issues: nlIssues.map((i) => ({ ...i, extra: i.extra as NewsletterIssueExtra })),
    },
    linkedin: {
      dailyEngagement: liDaily.map((r) => ({ ...r, extra: r.extra as LinkedInDailyExtra })),
      posts: liPosts.map((p) => ({ ...p, extra: p.extra as Record<string, unknown> })),
    },
    twitter: {
      posts: twPosts.map((p) => ({
        ...p,
        postedAt: p.postedAt ? p.postedAt.toISOString() : null,
      })),
    },
    lastUpdatedText: account
      ? account.fetchedAt.toISOString().replace("T", " ").slice(0, 16) + " UTC"
      : "never",
  };

  return <DashboardClient data={data} />;
}
