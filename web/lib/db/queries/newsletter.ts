import { asc } from "drizzle-orm";
import { getDb } from "../client";
import { newsletterSnapshots, newsletterIssues } from "../schema";

export async function getNewsletterSnapshots() {
  const db = getDb();
  return db.select().from(newsletterSnapshots).orderBy(asc(newsletterSnapshots.snapshotDate));
}

export async function getNewsletterIssues() {
  const db = getDb();
  return db.select().from(newsletterIssues).orderBy(asc(newsletterIssues.issueDate));
}
