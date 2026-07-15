/**
 * Ongoing entry mechanism for newsletter stats -- replaces the hardcoded
 * BEEHIIV object literal that used to live in index.html. Edit the values
 * below whenever you have new Beehiiv numbers to record, then run:
 *
 *   npm run update-newsletter
 *
 * Safe to re-run: every write is an upsert keyed by date, so fixing a typo
 * and re-running just corrects that row in place.
 */
import { getDb } from "../lib/db/client";
import { newsletterSnapshots, newsletterIssues } from "../lib/db/schema";

const SNAPSHOT_DATE = "2026-06-25"; // date this snapshot reflects

const STATS = {
  activeSubscribers: 1110,
  totalSignups: 1321,
  churned: 211,
  avgOpenRate: 55.11,
  avgClickRate: 7.11,
  revenueCents: 2200,
};

const SOURCES = [
  { name: "Import", count: 953 },
  { name: "Twitter", count: 31 },
  { name: "Direct", count: 31 },
  { name: "Instagram", count: 30 },
  { name: "Embed", count: 22 },
  { name: "Other", count: 54 },
];

const ISSUES = [
  { title: "The Empire Strikes Back", date: "2026-06-25", recipients: 1055, openRate: 48.54, clickRate: 1.4, webViews: 162, unsubs: 5, url: "https://newsletter.juliet.tech/p/the-empire-strikes-back" },
  { title: "I built the room", date: "2026-06-04", recipients: 1024, openRate: 53.5, clickRate: 8.22, webViews: 43, unsubs: 3, url: "https://newsletter.juliet.tech/p/i-built-the-room" },
  { title: "The ROI of a good date", date: "2026-05-14", recipients: 1037, openRate: 45.02, clickRate: 6.19, webViews: 28, unsubs: 13, url: "https://newsletter.juliet.tech/p/the-roi-of-a-good-date" },
  { title: "I think the web is dying", date: "2025-11-20", recipients: 1097, openRate: 53.0, clickRate: 4.94, webViews: 77, unsubs: 9, url: "https://newsletter.juliet.tech/p/i-think-the-web-is-dying" },
  { title: "Hygene, why nots & conviction", date: "2025-11-06", recipients: 1103, openRate: 51.25, clickRate: 5.25, webViews: 35, unsubs: 9, url: "https://newsletter.juliet.tech/p/hygene-why-nots-and-conviction" },
  { title: "Money, grandmas, and scrappy batman", date: "2025-09-18", recipients: 1112, openRate: 53.63, clickRate: 5.52, webViews: 56, unsubs: 11, url: "https://newsletter.juliet.tech/p/money-grandmas-and-scrappy-batman" },
  { title: "24 people. 3 days. 1st of 6.", date: "2025-09-04", recipients: 1115, openRate: 53.89, clickRate: 1.41, webViews: 32, unsubs: 5, url: "https://newsletter.juliet.tech/p/24-people-3-days-1st-of-6" },
  { title: "Life's greatest paradox", date: "2025-06-05", recipients: 1115, openRate: 58.77, clickRate: 3.37, webViews: 31, unsubs: 4, url: "https://newsletter.juliet.tech/p/lifes-greatest-paradox" },
  { title: "Self-driving cars & camping grounds", date: "2025-04-17", recipients: 1123, openRate: 57.38, clickRate: 5.05, webViews: 40, unsubs: 9, url: "https://newsletter.juliet.tech/p/self-driving-cars-and-camping-grounds" },
  { title: "The post I almost didn't publish", date: "2024-12-05", recipients: 1123, openRate: 59.44, clickRate: 4.85, webViews: 55, unsubs: 3, url: "https://newsletter.juliet.tech/p/the-post-i-almost-didnt-publish" },
  { title: "Holiday gift guide for nerds", date: "2024-11-28", recipients: 1112, openRate: 54.14, clickRate: 21.04, webViews: 52, unsubs: 3, url: "https://newsletter.juliet.tech/p/holiday-gift-guide-for-nerds" },
  { title: "I got my heart broken", date: "2024-11-14", recipients: 1121, openRate: 57.2, clickRate: 2.29, webViews: 83, unsubs: 9, url: "https://newsletter.juliet.tech/p/i-got-my-heart-broken" },
  { title: "Guys, we're the aliens", date: "2024-11-07", recipients: 1122, openRate: 55.31, clickRate: 3.9, webViews: 49, unsubs: 3, url: "https://newsletter.juliet.tech/p/guys-were-the-aliens" },
];

async function main() {
  const db = getDb();

  await db
    .insert(newsletterSnapshots)
    .values({
      snapshotDate: SNAPSHOT_DATE,
      activeSubscribers: STATS.activeSubscribers,
      totalSignups: STATS.totalSignups,
      churned: STATS.churned,
      avgOpenRate: STATS.avgOpenRate.toString(),
      avgClickRate: STATS.avgClickRate.toString(),
      revenueCents: STATS.revenueCents,
      extra: { sources: SOURCES },
    })
    .onConflictDoUpdate({
      target: newsletterSnapshots.snapshotDate,
      set: {
        activeSubscribers: STATS.activeSubscribers,
        totalSignups: STATS.totalSignups,
        churned: STATS.churned,
        avgOpenRate: STATS.avgOpenRate.toString(),
        avgClickRate: STATS.avgClickRate.toString(),
        revenueCents: STATS.revenueCents,
        extra: { sources: SOURCES },
      },
    });
  console.log(`Upserted newsletter_snapshots for ${SNAPSHOT_DATE}`);

  for (const issue of ISSUES) {
    await db
      .insert(newsletterIssues)
      .values({
        issueDate: issue.date,
        subject: issue.title,
        recipients: issue.recipients,
        openRate: issue.openRate.toString(),
        clickRate: issue.clickRate.toString(),
        extra: { webViews: issue.webViews, unsubs: issue.unsubs, url: issue.url },
      })
      .onConflictDoUpdate({
        target: newsletterIssues.issueDate,
        set: {
          subject: issue.title,
          recipients: issue.recipients,
          openRate: issue.openRate.toString(),
          clickRate: issue.clickRate.toString(),
          extra: { webViews: issue.webViews, unsubs: issue.unsubs, url: issue.url },
        },
      });
  }
  console.log(`Upserted ${ISSUES.length} newsletter_issues rows`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
