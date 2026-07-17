import { desc } from "drizzle-orm";
import { getDb } from "../client";
import { aiRecommendations } from "../schema";

export async function getLatestRecommendation() {
  const db = getDb();
  const rows = await db
    .select()
    .from(aiRecommendations)
    .orderBy(desc(aiRecommendations.generatedAt))
    .limit(1);
  return rows[0] ?? null;
}
