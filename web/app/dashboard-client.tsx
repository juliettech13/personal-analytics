"use client";

import { useState } from "react";
import { Window } from "@/components/retro/window";
import { RetroMarkdown } from "@/components/retro/markdown";
import { Menubar } from "@/components/chrome/menubar";
import { Ticker } from "@/components/chrome/ticker";
import { Dock, type TabKey } from "@/components/chrome/dock";
import { InstagramTab, type InstagramTabProps } from "@/components/tabs/instagram-tab";
import { NewsletterTab, type NewsletterSnapshotRow, type NewsletterIssueRow } from "@/components/tabs/newsletter-tab";
import { LinkedInTab, type LinkedInDailyRow, type LinkedInPostRow } from "@/components/tabs/linkedin-tab";
import { TwitterTab, type TwitterPostRow } from "@/components/tabs/twitter-tab";

export interface RecommendationRow {
  generatedAt: string;
  content: string;
}

export interface DashboardData {
  instagram: InstagramTabProps;
  newsletter: { snapshots: NewsletterSnapshotRow[]; issues: NewsletterIssueRow[] };
  linkedin: { dailyEngagement: LinkedInDailyRow[]; posts: LinkedInPostRow[] };
  twitter: { posts: TwitterPostRow[] };
  recommendation: RecommendationRow | null;
  lastUpdatedText: string;
}

export function DashboardClient({ data }: { data: DashboardData }) {
  const [activeTab, setActiveTab] = useState<TabKey>("ig");

  return (
    <div className="min-h-screen px-3.5 pt-8 pb-20">
      <Menubar activeTab={activeTab} onTabChange={setActiveTab} lastUpdatedText={data.lastUpdatedText} />
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

      <Window label="🤖 Recommendations" tag={data.recommendation ? `generated ${data.recommendation.generatedAt}` : undefined}>
        {data.recommendation ? (
          <RetroMarkdown content={data.recommendation.content} />
        ) : (
          <div className="py-2 text-center text-[11px] text-neutral-400">
            No recommendations yet — hit ↺ Refresh to generate the first one from your current data.
          </div>
        )}
      </Window>

      <Dock activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
