import { cookies } from "next/headers";
import { generateText } from "ai";
import { getDb } from "@/lib/db/client";
import { SESSION_COOKIE, isValidSessionCookie } from "@/lib/auth";
import { aiRecommendations } from "@/lib/db/schema";
import { getLatestAccountObservation, getPostsWithLatestMetrics } from "@/lib/db/queries/instagram";
import { getNewsletterSnapshots, getNewsletterIssues } from "@/lib/db/queries/newsletter";
import { getLinkedInDailyEngagement, getLinkedInPosts } from "@/lib/db/queries/linkedin";
import { getTwitterPosts } from "@/lib/db/queries/twitter";

const MODEL = "anthropic/claude-sonnet-4.6";

// A real run is ~30s (model generation + one DB insert); this just gives
// headroom for an occasional slow DB round-trip without truncating the
// response mid-generation.
export const maxDuration = 90;

// Only ever called from the dashboard's Refresh button (see dock.tsx/
// menubar.tsx's shared refreshAllData()), never on a plain page load and
// never on a timer -- generating text costs real (if small) money per call,
// so it only runs when the user explicitly asks for fresh numbers.
export async function POST() {
  const jar = await cookies();
  if (!isValidSessionCookie(jar.get(SESSION_COOKIE)?.value)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [account, topPosts, nlSnapshots, nlIssues, liDaily, liPosts, twPosts] = await Promise.all([
    getLatestAccountObservation(),
    getPostsWithLatestMetrics(5),
    getNewsletterSnapshots(),
    getNewsletterIssues(),
    getLinkedInDailyEngagement(),
    getLinkedInPosts(5),
    getTwitterPosts(5),
  ]);

  const igBlock = account
    ? `INSTAGRAM\nFollowers: ${account.followers}\n\nTop 5 posts by reach:\n${topPosts
        .map(
          (p, i) =>
            `  ${i + 1}. [${p.productType ?? p.mediaType}] ${p.postedAt.toISOString().slice(0, 10)}  reach:${p.reach}  likes:${p.likes}  saves:${p.saves}  shares:${p.shares}\n     "${(p.caption ?? "").slice(0, 100)}"`,
        )
        .join("\n")}`
    : "INSTAGRAM\n(no data yet)";

  const latestSnap = nlSnapshots[nlSnapshots.length - 1];
  const recentIssues = [...nlIssues].sort((a, b) => (a.issueDate < b.issueDate ? 1 : -1)).slice(0, 5);
  const nlBlock = latestSnap
    ? `NEWSLETTER\nActive subscribers: ${latestSnap.activeSubscribers}\nAvg open rate: ${latestSnap.avgOpenRate}%\nAvg click rate: ${latestSnap.avgClickRate}%\n\nRecent issues:\n${recentIssues
        .map((i) => `  ${i.issueDate}  "${i.subject}"  open:${i.openRate}%  click:${i.clickRate}%`)
        .join("\n")}`
    : "NEWSLETTER\n(no data yet)";

  const latestLi = liDaily[liDaily.length - 1];
  const liBlock = latestLi
    ? `LINKEDIN\nLatest day (${latestLi.date}): impressions:${latestLi.impressions} engagements:${latestLi.engagements}\n\nTop posts by impressions:\n${liPosts
        .map((p) => `  ${p.publishedAt ?? "?"}  impressions:${p.impressions} engagements:${p.engagements}  ${p.url}`)
        .join("\n")}`
    : "LINKEDIN\n(no data yet)";

  const twBlock = twPosts.length
    ? `TWITTER/X\nTop tweets by impressions:\n${twPosts
        .map((p) => `  ${p.postedAt ?? "?"}  impressions:${p.impressions} engagements:${p.engagements}  "${(p.text ?? "").slice(0, 80)}"`)
        .join("\n")}`
    : "TWITTER/X\n(no data yet)";

  const prompt = `Here is my personal analytics data across Instagram, my newsletter, LinkedIn, and Twitter/X. Please give me 5 specific, actionable recommendations to grow my audience and improve engagement, referencing the actual numbers/posts below rather than generic advice.\n\n${igBlock}\n\n${nlBlock}\n\n${liBlock}\n\n${twBlock}`;

  let text: string;
  try {
    ({ text } = await generateText({ model: MODEL, prompt }));
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }

  const db = getDb();
  await db.insert(aiRecommendations).values({ model: MODEL, content: text });

  return Response.json({ ok: true, content: text });
}
