import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db/client";
import { fetchBeehiivSnapshot } from "@/lib/beehiiv/sync";
import { SESSION_COOKIE, isValidSessionCookie } from "@/lib/auth";
import { newsletterSnapshots, newsletterIssues, syncRuns } from "@/lib/db/schema";

// Beehiiv data changes far less often than Instagram's -- daily is plenty,
// see vercel.json. Pagination over every subscriber (~1 page per 100) is the
// only part of this that scales with account size; still comfortably inside
// a serverless function's time budget for a personal-newsletter-sized list.
export const maxDuration = 60;

// GET, guarded by Authorization: Bearer $CRON_SECRET -- same pattern as
// /api/cron/instagram, called directly by Vercel Cron.
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

  let snapshot;
  try {
    snapshot = await fetchBeehiivSnapshot();
  } catch (err) {
    await db.insert(syncRuns).values({
      source: "newsletter",
      status: "error",
      startedAt,
      finishedAt: new Date(),
      errorMessage: String(err),
    });
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }

  // newsletter_snapshots is upserted by date -- one row per day this runs,
  // same "today's snapshot" model as the old manual script, just written by
  // a real sync instead of by hand. newsletter_issues is upserted by Beehiiv's
  // own post id now (see drizzle/0002_*), so re-running never duplicates or
  // orphans a row the way date-keying could.
  const snapshotDate = snapshot.fetchedAt.toISOString().slice(0, 10);
  const queries: Parameters<typeof db.batch>[0][number][] = [
    db
      .insert(newsletterSnapshots)
      .values({
        snapshotDate,
        activeSubscribers: snapshot.activeSubscribers,
        totalSignups: snapshot.totalSignups,
        churned: snapshot.churned,
        avgOpenRate: snapshot.avgOpenRate.toFixed(2),
        avgClickRate: snapshot.avgClickRate.toFixed(2),
        extra: { sources: snapshot.sources },
      })
      .onConflictDoUpdate({
        target: newsletterSnapshots.snapshotDate,
        set: {
          activeSubscribers: snapshot.activeSubscribers,
          totalSignups: snapshot.totalSignups,
          churned: snapshot.churned,
          avgOpenRate: snapshot.avgOpenRate.toFixed(2),
          avgClickRate: snapshot.avgClickRate.toFixed(2),
          extra: { sources: snapshot.sources },
        },
      }),
  ];

  for (const issue of snapshot.issues) {
    queries.push(
      db
        .insert(newsletterIssues)
        .values({
          id: issue.id,
          issueDate: issue.issueDate.toISOString().slice(0, 10),
          subject: issue.title,
          recipients: issue.recipients,
          openRate: issue.openRate.toFixed(2),
          clickRate: issue.clickRate.toFixed(2),
          extra: { webViews: issue.webViews, unsubs: issue.unsubs, url: issue.url },
        })
        .onConflictDoUpdate({
          target: newsletterIssues.id,
          set: {
            subject: issue.title,
            recipients: issue.recipients,
            openRate: issue.openRate.toFixed(2),
            clickRate: issue.clickRate.toFixed(2),
            extra: { webViews: issue.webViews, unsubs: issue.unsubs, url: issue.url },
          },
        }),
    );
  }

  queries.push(
    db.insert(syncRuns).values({
      source: "newsletter",
      status: "ok",
      startedAt,
      finishedAt: new Date(),
      postsSynced: snapshot.issues.length,
    }),
  );

  try {
    await db.batch(queries as [(typeof queries)[number], ...(typeof queries)[number][]]);
  } catch (err) {
    await db.insert(syncRuns).values({
      source: "newsletter",
      status: "error",
      startedAt,
      finishedAt: new Date(),
      errorMessage: String(err),
    });
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }

  return Response.json({ ok: true, issues: snapshot.issues.length });
}

// Manual trigger from the dashboard's Refresh button -- gated by the session
// cookie directly (proxy.ts excludes /api/cron/* entirely, same reasoning as
// the Instagram route: this isn't reachable through the browser's auth gate).
export async function POST() {
  const jar = await cookies();
  if (!isValidSessionCookie(jar.get(SESSION_COOKIE)?.value)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return runSync();
}
