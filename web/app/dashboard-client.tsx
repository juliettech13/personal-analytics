"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Menubar } from "@/components/chrome/menubar";
import { Ticker } from "@/components/chrome/ticker";
import { Dock, type TabKey } from "@/components/chrome/dock";
import { InstagramTab, type InstagramTabProps } from "@/components/tabs/instagram-tab";
import { NewsletterTab, type NewsletterSnapshotRow, type NewsletterIssueRow } from "@/components/tabs/newsletter-tab";
import { LinkedInTab, type LinkedInDailyRow, type LinkedInPostRow } from "@/components/tabs/linkedin-tab";
import { TwitterTab, type TwitterPostRow } from "@/components/tabs/twitter-tab";

export interface DashboardData {
  instagram: InstagramTabProps;
  newsletter: { snapshots: NewsletterSnapshotRow[]; issues: NewsletterIssueRow[] };
  linkedin: { dailyEngagement: LinkedInDailyRow[]; posts: LinkedInPostRow[] };
  twitter: { posts: TwitterPostRow[] };
  lastUpdatedText: string;
}

export function DashboardClient({ data }: { data: DashboardData }) {
  const [activeTab, setActiveTab] = useState<TabKey>("ig");

  function analyzeWithClaude() {
    const ig = data.instagram;
    const top5 = [...ig.posts].sort((a, b) => b.reach - a.reach).slice(0, 5);
    const igBlock = `INSTAGRAM (@${ig.username})\nFollowers: ${ig.account?.followers ?? 0}\n\nTop 5 posts by reach:\n${top5
      .map(
        (p, i) =>
          `  ${i + 1}. [${p.productType}] ${p.postedAt.toISOString().slice(0, 10)}  reach:${p.reach}  likes:${p.likes}  saves:${p.saves}  shares:${p.shares}\n     "${(p.caption ?? "").slice(0, 100)}"`,
      )
      .join("\n")}`;

    const latestSnap = data.newsletter.snapshots[data.newsletter.snapshots.length - 1];
    const nlBlock = latestSnap
      ? `NEWSLETTER\nActive subscribers: ${latestSnap.activeSubscribers}`
      : "NEWSLETTER\n(no data yet)";

    const prompt = `Here is my personal analytics data. Please give me 5 specific, actionable recommendations to grow my audience and improve engagement.\n\n${igBlock}\n\n${nlBlock}`;

    navigator.clipboard
      .writeText(prompt)
      .then(() => toast.success("📋 Copied! Open Claude and paste."))
      .catch(() => toast.error("⚠ Clipboard blocked — check browser permissions"));
  }

  return (
    <div className="min-h-screen px-3.5 pt-8 pb-20">
      <Menubar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        lastUpdatedText={data.lastUpdatedText}
        onAnalyzeWithClaude={analyzeWithClaude}
      />
      <Ticker
        text={`⬛ NERD_SPLASH ANALYTICS · @${data.instagram.username} · ${data.instagram.account?.followers ?? 0} FOLLOWERS · UPDATED ${data.lastUpdatedText} · ⬛`}
      />

      <div style={{ display: activeTab === "ig" ? "block" : "none" }}>
        <InstagramTab {...data.instagram} />
      </div>
      <div style={{ display: activeTab === "newsletter" ? "block" : "none" }}>
        <NewsletterTab snapshots={data.newsletter.snapshots} issues={data.newsletter.issues} />
      </div>
      <div style={{ display: activeTab === "linkedin" ? "block" : "none" }}>
        <LinkedInTab dailyEngagement={data.linkedin.dailyEngagement} posts={data.linkedin.posts} />
      </div>
      <div style={{ display: activeTab === "twitter" ? "block" : "none" }}>
        <TwitterTab posts={data.twitter.posts} />
      </div>

      <Dock activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
