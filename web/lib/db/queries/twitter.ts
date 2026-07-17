import { desc } from "drizzle-orm";
import { getDb } from "../client";
import { twitterPosts } from "../schema";
import { pickColumn, toNumber, syntheticRowKey } from "./upload-helpers";

export async function getTwitterPosts(limit = 100) {
  const db = getDb();
  return db.select().from(twitterPosts).orderBy(desc(twitterPosts.impressions)).limit(limit);
}

/** Twitter/X analytics exports are per-tweet rows -- mirrors the client's
 * renderTwitter column detection (fuzzy header matching). */
export async function upsertTwitterRows(rows: Array<Record<string, unknown>>): Promise<number> {
  if (!rows.length) return 0;
  const db = getDb();
  const sample = rows[0]!;
  const col = {
    text: pickColumn(sample, ["tweet_text", "text"]),
    date: pickColumn(sample, ["time", "date", "created"]),
    impr: pickColumn(sample, ["impressions"]),
    eng: pickColumn(sample, ["engagements"]),
    rt: pickColumn(sample, ["retweets"]),
    replies: pickColumn(sample, ["replies"]),
    likes: pickColumn(sample, ["likes"]),
    url: pickColumn(sample, ["tweet_permalink", "permalink"]),
  };

  let count = 0;
  for (const row of rows) {
    const impressions = col.impr ? toNumber(row[col.impr]) : 0;
    const engagements = col.eng ? toNumber(row[col.eng]) : 0;
    const likes = col.likes ? toNumber(row[col.likes]) : 0;
    const retweets = col.rt ? toNumber(row[col.rt]) : 0;
    const replies = col.replies ? toNumber(row[col.replies]) : 0;
    const text = col.text ? String(row[col.text] ?? "") : "";
    const dateRaw = col.date ? String(row[col.date] ?? "") : "";
    const postedAt = dateRaw ? new Date(dateRaw) : null;
    const url = (col.url ? String(row[col.url] ?? "").trim() : "") || syntheticRowKey(row);

    await db
      .insert(twitterPosts)
      .values({
        url,
        postedAt: postedAt && !Number.isNaN(postedAt.getTime()) ? postedAt : null,
        text,
        impressions,
        engagements,
        likes,
        retweets,
        replies,
      })
      .onConflictDoUpdate({
        target: twitterPosts.url,
        set: {
          postedAt: postedAt && !Number.isNaN(postedAt.getTime()) ? postedAt : null,
          text,
          impressions,
          engagements,
          likes,
          retweets,
          replies,
          lastUploadedAt: new Date(),
        },
      });
    count++;
  }
  return count;
}
