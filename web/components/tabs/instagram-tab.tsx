"use client";

import { useMemo } from "react";
import { Window } from "@/components/retro/window";
import { Kpi, KpiRow } from "@/components/retro/kpi";
import { Pill, Pills } from "@/components/retro/pill";
import { TypeBadge } from "@/components/retro/badge";
import { ChartCanvas } from "@/components/retro/chart-canvas";
import { SortableTable, type Column } from "@/components/retro/sortable-table";
import { displayImageUrl, type EnrichedPost, type EnrichedStory } from "@/lib/db/queries/instagram";

const REEL_CLR = "#C84860";
const FEED_CLR = "#3A6890";
const GOLD_CLR = "#C8973A";
const TEAL_CLR = "#3A8C84";
const PURP_CLR = "#7048A0";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}
function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export interface InstagramTabProps {
  account: {
    followers: number;
    following: number | null;
    mediaCount: number | null;
    biography: string | null;
    website: string | null;
    profilePicUrl: string | null;
  } | null;
  posts: EnrichedPost[];
  history: Array<{ fetchedAt: Date; followers: number }>;
  activeStories: EnrichedStory[];
  storiesHistory: EnrichedStory[];
  username: string;
}

export function InstagramTab({
  account,
  posts,
  history,
  activeStories,
  storiesHistory,
  username,
}: InstagramTabProps) {
  const totals = useMemo(() => {
    const n = posts.length || 1;
    const totalLikes = posts.reduce((s, p) => s + p.likes, 0);
    const totalComments = posts.reduce((s, p) => s + p.comments, 0);
    const totalReach = posts.reduce((s, p) => s + p.reach, 0);
    const totalShares = posts.reduce((s, p) => s + p.shares, 0);
    const totalSaves = posts.reduce((s, p) => s + p.saves, 0);
    const avgLikes = totalLikes / n;
    const avgComments = totalComments / n;
    const avgReach = totalReach / n;
    const engRate =
      account && account.followers > 0
        ? ((totalLikes + totalComments + totalShares + totalSaves) / posts.length / account.followers) * 100
        : 0;
    return { totalLikes, totalComments, totalReach, totalShares, totalSaves, avgLikes, avgComments, avgReach, engRate };
  }, [posts, account]);

  const mix = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of posts) counts[p.productType || p.mediaType] = (counts[p.productType || p.mediaType] ?? 0) + 1;
    return counts;
  }, [posts]);

  const reelVsFeed = useMemo(() => {
    const reels = posts.filter((p) => p.productType === "REELS");
    const feed = posts.filter((p) => p.productType !== "REELS");
    const avg = (arr: EnrichedPost[], key: keyof EnrichedPost) =>
      arr.length ? (arr.reduce((s, p) => s + (p[key] as number), 0) / arr.length) : 0;
    return {
      reels: { count: reels.length, avgLikes: avg(reels, "likes"), avgReach: avg(reels, "reach"), avgComments: avg(reels, "comments") },
      feed: { count: feed.length, avgLikes: avg(feed, "likes"), avgReach: avg(feed, "reach"), avgComments: avg(feed, "comments") },
    };
  }, [posts]);

  const topByReach = useMemo(() => [...posts].sort((a, b) => b.reach - a.reach), [posts]);

  const insights = useMemo(() => {
    const pills: Array<{ variant: "good" | "warn" | "info" | "hot"; text: string }> = [];
    if (reelVsFeed.reels.count > 0 && reelVsFeed.feed.count > 0) {
      if (reelVsFeed.reels.avgReach > reelVsFeed.feed.avgReach) {
        pills.push({ variant: "hot", text: `Reels reach ${fmt(reelVsFeed.reels.avgReach)} avg vs Feed's ${fmt(reelVsFeed.feed.avgReach)} — lean into Reels` });
      }
    }
    if (totals.engRate > 0) {
      pills.push({
        variant: totals.engRate > 3 ? "good" : "info",
        text: `Engagement rate: ${pct(totals.engRate)}`,
      });
    }
    const top = topByReach[0];
    if (top) {
      pills.push({ variant: "info", text: `Top post: ${fmt(top.reach)} reach on ${top.postedAt.toISOString().slice(0, 10)}` });
    }
    return pills;
  }, [reelVsFeed, totals, topByReach]);

  const columns: Column<EnrichedPost>[] = [
    {
      key: "thumb",
      label: "",
      render: (p) => {
        const src = displayImageUrl(p.mediaType, p.mediaUrl, p.thumbnailUrl);
        return src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-9 w-9 rounded-sm object-cover" />
        ) : (
          <div className="h-9 w-9 rounded-sm bg-neutral-200" />
        );
      },
    },
    { key: "date", label: "Date", render: (p) => p.postedAt.toISOString().slice(0, 10), sortValue: (p) => p.postedAt.getTime() },
    { key: "type", label: "Type", render: (p) => <TypeBadge type={p.productType || p.mediaType} />, sortValue: (p) => p.productType },
    { key: "caption", label: "Caption", render: (p) => <span className="max-w-[200px] overflow-hidden text-ellipsis text-[9px] text-neutral-500">{(p.caption ?? "").slice(0, 60)}</span> },
    { key: "likes", label: "Likes", align: "right", render: (p) => fmt(p.likes), sortValue: (p) => p.likes },
    { key: "comments", label: "Comm.", align: "right", render: (p) => fmt(p.comments), sortValue: (p) => p.comments },
    { key: "reach", label: "Reach", align: "right", render: (p) => fmt(p.reach), sortValue: (p) => p.reach },
    { key: "saves", label: "Saves", align: "right", render: (p) => fmt(p.saves), sortValue: (p) => p.saves },
    { key: "shares", label: "Shares", align: "right", render: (p) => fmt(p.shares), sortValue: (p) => p.shares },
  ];

  return (
    <div>
      <Window label="👤 Profile" className="overflow-visible">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#FFD060] bg-neutral-600 text-xl">
            {account?.profilePicUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={account.profilePicUrl} alt={username} className="h-full w-full object-cover" />
            ) : (
              "📷"
            )}
          </div>
          <div>
            <div className="font-pixel text-2xl leading-none">@{username}</div>
            <div className="mt-1 max-w-[360px] text-[9px] text-neutral-500">{account?.biography}</div>
          </div>
          <div className="ml-auto flex gap-4">
            <div className="text-center">
              <div className="font-pixel text-xl leading-none">{fmt(account?.followers ?? 0)}</div>
              <div className="mt-0.5 text-[8px] tracking-wide text-neutral-500 uppercase">Followers</div>
            </div>
            <div className="text-center">
              <div className="font-pixel text-xl leading-none">{fmt(account?.following ?? 0)}</div>
              <div className="mt-0.5 text-[8px] tracking-wide text-neutral-500 uppercase">Following</div>
            </div>
            <div className="text-center">
              <div className="font-pixel text-xl leading-none">{posts.length}</div>
              <div className="mt-0.5 text-[8px] tracking-wide text-neutral-500 uppercase">Posts</div>
            </div>
          </div>
        </div>
      </Window>

      <Window label="Performance Vitals" bodyClassName="p-2.5">
        <KpiRow>
          <Kpi label="Avg Likes" value={fmt(totals.avgLikes)} accent="r" />
          <Kpi label="Avg Comments" value={fmt(totals.avgComments)} accent="f" />
          <Kpi label="Avg Reach" value={fmt(totals.avgReach)} accent="g" />
          <Kpi label="Eng. Rate" value={pct(totals.engRate)} accent="o" />
          <Kpi label="Total Shares" value={fmt(totals.totalShares)} />
          <Kpi label="Total Saves" value={fmt(totals.totalSaves)} />
        </KpiRow>
      </Window>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Window label="📈 Follower Growth" className="md:col-span-2">
          <ChartCanvas
            config={{
              type: "line",
              data: {
                labels: history.map((h) => h.fetchedAt.toISOString().slice(0, 10)),
                datasets: [
                  {
                    data: history.map((h) => h.followers),
                    borderColor: GOLD_CLR,
                    backgroundColor: `${GOLD_CLR}20`,
                    fill: true,
                    tension: 0.35,
                    pointRadius: history.length > 60 ? 0 : 2,
                  },
                ],
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: false } },
              },
            }}
          />
        </Window>

        <Window label="🍩 Content Mix">
          <ChartCanvas
            config={{
              type: "doughnut",
              data: {
                labels: Object.keys(mix),
                datasets: [
                  {
                    data: Object.values(mix),
                    backgroundColor: [REEL_CLR, FEED_CLR, GOLD_CLR, TEAL_CLR, PURP_CLR],
                  },
                ],
              },
              options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } } } },
            }}
          />
        </Window>
      </div>

      <Window label="🎬 Reels vs Feed">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <th className="p-1"></th>
              <th className="p-1 text-center text-[10px] text-neutral-500 uppercase">Reels ({reelVsFeed.reels.count})</th>
              <th className="p-1 text-center text-[10px] text-neutral-500 uppercase">Feed ({reelVsFeed.feed.count})</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border-t border-border p-1.5 text-left text-neutral-500">Avg Likes</td>
              <td className="border-t border-border p-1.5 text-center font-pixel text-lg text-reel">{fmt(reelVsFeed.reels.avgLikes)}</td>
              <td className="border-t border-border p-1.5 text-center font-pixel text-lg text-feed">{fmt(reelVsFeed.feed.avgLikes)}</td>
            </tr>
            <tr>
              <td className="border-t border-border p-1.5 text-left text-neutral-500">Avg Reach</td>
              <td className="border-t border-border p-1.5 text-center font-pixel text-lg text-reel">{fmt(reelVsFeed.reels.avgReach)}</td>
              <td className="border-t border-border p-1.5 text-center font-pixel text-lg text-feed">{fmt(reelVsFeed.feed.avgReach)}</td>
            </tr>
            <tr>
              <td className="border-t border-border p-1.5 text-left text-neutral-500">Avg Comments</td>
              <td className="border-t border-border p-1.5 text-center font-pixel text-lg text-reel">{fmt(reelVsFeed.reels.avgComments)}</td>
              <td className="border-t border-border p-1.5 text-center font-pixel text-lg text-feed">{fmt(reelVsFeed.feed.avgComments)}</td>
            </tr>
          </tbody>
        </table>
      </Window>

      <Window label="📊 Reach by Post (Top 15)">
        <ChartCanvas
          config={{
            type: "bar",
            data: {
              labels: topByReach.slice(0, 15).map((p) => p.postedAt.toISOString().slice(5, 10)),
              datasets: [
                {
                  label: "Reach",
                  data: topByReach.slice(0, 15).map((p) => p.reach),
                  backgroundColor: topByReach.slice(0, 15).map((p) => (p.productType === "REELS" ? REEL_CLR : FEED_CLR)),
                },
              ],
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
          }}
        />
      </Window>

      <Window label="💡 Auto Insights">
        <Pills>
          {insights.map((p, i) => (
            <Pill key={i} variant={p.variant}>
              {p.text}
            </Pill>
          ))}
        </Pills>
      </Window>

      <Window label={`🗂 Post Explorer · ${posts.length} posts`}>
        <div className="max-h-[300px] overflow-y-auto">
          <SortableTable columns={columns} rows={posts} rowKey={(p) => p.id} defaultSortKey="reach" />
        </div>
      </Window>

      {activeStories.length > 0 && (
        <Window label={`👻 Active Stories (${activeStories.length})`}>
          <div className="flex flex-wrap gap-2.5">
            {activeStories.map((s) => {
              const src = displayImageUrl(s.mediaType, s.mediaUrl, s.thumbnailUrl);
              return (
                <div key={s.id} className="w-24 overflow-hidden rounded border border-border bg-white">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" className="h-32 w-24 object-cover" />
                  ) : (
                    <div className="flex h-32 w-24 items-center justify-center bg-neutral-200 text-2xl">👻</div>
                  )}
                  <div className="p-1 text-center">
                    <div className="font-pixel text-lg leading-none">{fmt(s.reach)}</div>
                    <div className="text-[8px] tracking-wide text-neutral-500 uppercase">reach</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Window>
      )}

      {storiesHistory.length > 0 && (
        <Window label="📜 Stories History">
          <div className="max-h-[240px] overflow-y-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="bg-chrome-dark px-1.5 py-1 text-left text-[10px] text-[#F0E8D8] uppercase"></th>
                  <th className="bg-chrome-dark px-1.5 py-1 text-left text-[10px] text-[#F0E8D8] uppercase">Date</th>
                  <th className="bg-chrome-dark px-1.5 py-1 text-right text-[10px] text-[#F0E8D8] uppercase">Reach</th>
                  <th className="bg-chrome-dark px-1.5 py-1 text-right text-[10px] text-[#F0E8D8] uppercase">Replies</th>
                  <th className="bg-chrome-dark px-1.5 py-1 text-right text-[10px] text-[#F0E8D8] uppercase">Exits</th>
                </tr>
              </thead>
              <tbody>
                {storiesHistory.map((s) => {
                  const src = displayImageUrl(s.mediaType, s.mediaUrl, s.thumbnailUrl);
                  return (
                    <tr key={s.id} className="even:[&>td]:bg-[#EDE7DC]">
                      <td className="border-b border-[#E8E0D0] px-1.5 py-1">
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={src} alt="" className="h-7 w-7 rounded-sm object-cover" />
                        ) : (
                          <div className="h-7 w-7 rounded-sm bg-neutral-200" />
                        )}
                      </td>
                      <td className="border-b border-[#E8E0D0] px-1.5 py-1">{s.postedAt.toISOString().slice(0, 10)}</td>
                      <td className="border-b border-[#E8E0D0] px-1.5 py-1 text-right">{fmt(s.reach)}</td>
                      <td className="border-b border-[#E8E0D0] px-1.5 py-1 text-right">{fmt(s.replies)}</td>
                      <td className="border-b border-[#E8E0D0] px-1.5 py-1 text-right">{fmt(s.exits)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Window>
      )}
    </div>
  );
}
