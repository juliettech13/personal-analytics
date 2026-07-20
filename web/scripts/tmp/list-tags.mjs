import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const tables = ["instagram_posts", "instagram_stories", "newsletter_issues", "linkedin_posts", "twitter_posts"];
const all = new Set();
for (const t of tables) {
  const r = await sql.query(`SELECT DISTINCT unnest(tags) AS tag FROM ${t}`);
  for (const row of r) all.add(row.tag);
}
console.log([...all].sort());
