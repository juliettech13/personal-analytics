import { asc, desc } from "drizzle-orm";
import { getDb } from "../client";
import { linkedinDailyEngagement, linkedinPosts } from "../schema";
import { pickColumn, toNumber, toDateString, syntheticRowKey } from "./upload-helpers";

export async function getLinkedInDailyEngagement() {
  const db = getDb();
  return db.select().from(linkedinDailyEngagement).orderBy(asc(linkedinDailyEngagement.date));
}

export async function getLinkedInPosts(limit = 50) {
  const db = getDb();
  return db
    .select()
    .from(linkedinPosts)
    .orderBy(desc(linkedinPosts.impressions))
    .limit(limit);
}

interface NativeLinkedInData {
  period?: string;
  totalImpressions?: number;
  membersReached?: number;
  totalFollowers?: number;
  newFollowers?: number;
  dailyEngagement?: Array<{ date: string; impressions: number; engagements: number }>;
  topByImpressions?: Array<{ url: string; date: string; impressions: number }>;
  topByEngagements?: Array<{ url: string; date: string; engagements: number }>;
  demographics?: Array<{ category: string; value: string; pct: string }>;
}

export function isNativeLinkedInData(data: unknown): data is NativeLinkedInData {
  return (
    !!data &&
    typeof data === "object" &&
    Array.isArray((data as NativeLinkedInData).dailyEngagement)
  );
}

/** LinkedIn's native multi-sheet XLSX export, already parsed client-side into
 * {dailyEngagement, topByImpressions, topByEngagements, demographics, ...}. */
export async function upsertLinkedInNative(data: NativeLinkedInData): Promise<number> {
  const db = getDb();
  let count = 0;

  const dailyRows = data.dailyEngagement ?? [];
  const latestDate = dailyRows.reduce<string | null>(
    (max, r) => (!max || r.date > max ? r.date : max),
    null,
  );

  for (const row of dailyRows) {
    const isLatest = row.date === latestDate;
    await db
      .insert(linkedinDailyEngagement)
      .values({
        date: row.date,
        impressions: row.impressions,
        engagements: row.engagements,
        // Whole-export summary fields (period totals, demographics) aren't
        // per-day -- they're attached to the most recent day's row rather
        // than duplicated across every day.
        extra: isLatest
          ? {
              period: data.period,
              totalImpressions: data.totalImpressions,
              membersReached: data.membersReached,
              totalFollowers: data.totalFollowers,
              newFollowers: data.newFollowers,
              demographics: data.demographics ?? [],
            }
          : {},
      })
      .onConflictDoUpdate({
        target: linkedinDailyEngagement.date,
        set: {
          impressions: row.impressions,
          engagements: row.engagements,
          ...(isLatest
            ? {
                extra: {
                  period: data.period,
                  totalImpressions: data.totalImpressions,
                  membersReached: data.membersReached,
                  totalFollowers: data.totalFollowers,
                  newFollowers: data.newFollowers,
                  demographics: data.demographics ?? [],
                },
              }
            : {}),
        },
      });
    count++;
  }

  // topByImpressions and topByEngagements are two separately-ranked lists
  // that often partially overlap by URL -- upsert each list's fields onto
  // whatever row already exists for that URL rather than assuming 1:1.
  for (const row of data.topByImpressions ?? []) {
    if (!row.url) continue;
    await db
      .insert(linkedinPosts)
      .values({
        url: row.url,
        publishedAt: toDateString(row.date),
        impressions: row.impressions,
      })
      .onConflictDoUpdate({
        target: linkedinPosts.url,
        set: { publishedAt: toDateString(row.date), impressions: row.impressions, lastUploadedAt: new Date() },
      });
    count++;
  }
  for (const row of data.topByEngagements ?? []) {
    if (!row.url) continue;
    await db
      .insert(linkedinPosts)
      .values({
        url: row.url,
        publishedAt: toDateString(row.date),
        engagements: row.engagements,
      })
      .onConflictDoUpdate({
        target: linkedinPosts.url,
        set: { publishedAt: toDateString(row.date), engagements: row.engagements, lastUploadedAt: new Date() },
      });
    count++;
  }

  return count;
}

/** Generic CSV/XLSX fallback rows (fuzzy-matched column names, mirrors the
 * client's renderLinkedInCSV column detection). These exports don't reliably
 * include a post URL, so rows without one get a content-derived synthetic
 * key instead of being dropped. */
export async function upsertLinkedInGenericRows(
  rows: Array<Record<string, unknown>>,
): Promise<number> {
  if (!rows.length) return 0;
  const db = getDb();
  const sample = rows[0]!;
  const col = {
    date: pickColumn(sample, ["published_date", "published_at", "date"]),
    impr: pickColumn(sample, ["impressions", "unique_impressions"]),
    reactions: pickColumn(sample, ["reactions", "likes"]),
    comments: pickColumn(sample, ["comments"]),
    reposts: pickColumn(sample, ["reposts", "shares"]),
    url: pickColumn(sample, ["url", "post_url", "link", "permalink"]),
  };

  let count = 0;
  for (const row of rows) {
    const impressions = col.impr ? toNumber(row[col.impr]) : 0;
    const reactions = col.reactions ? toNumber(row[col.reactions]) : 0;
    const comments = col.comments ? toNumber(row[col.comments]) : 0;
    const reposts = col.reposts ? toNumber(row[col.reposts]) : 0;
    const url = (col.url ? String(row[col.url] ?? "").trim() : "") || syntheticRowKey(row);

    await db
      .insert(linkedinPosts)
      .values({
        url,
        publishedAt: col.date ? toDateString(row[col.date]) : null,
        impressions,
        engagements: reactions + comments + reposts,
        extra: { reactions, comments, reposts },
      })
      .onConflictDoUpdate({
        target: linkedinPosts.url,
        set: {
          impressions,
          engagements: reactions + comments + reposts,
          extra: { reactions, comments, reposts },
          lastUploadedAt: new Date(),
        },
      });
    count++;
  }
  return count;
}
