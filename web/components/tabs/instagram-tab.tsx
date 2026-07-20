"use client";

import { useMemo, useState } from "react";
import { Window } from "@/components/retro/window";
import { Kpi, KpiRow } from "@/components/retro/kpi";
import { Pill, Pills } from "@/components/retro/pill";
import { TypeBadge } from "@/components/retro/badge";
import { ChartCanvas } from "@/components/retro/chart-canvas";
import { SortableTable, type Column } from "@/components/retro/sortable-table";
import { DateRangeFilter } from "@/components/retro/date-range-filter";
import { TagBadges } from "@/components/retro/tag-badges";
import { ALL_TIME_RANGE, inDateRange, type DateRange } from "@/lib/date-range";
import { groupByTag } from "@/lib/tag-performance";
import { getTagColor, getTagColors } from "@/lib/tag-colors";
import {
  displayImageUrl,
  type AccountHistoryPoint,
  type EnrichedPost,
  type EnrichedStory,
} from "@/lib/db/queries/instagram";

const REEL_CLR = "#C84860";
const FEED_CLR = "#3A6890";
const GOLD_CLR = "#C8973A";
const TEAL_CLR = "#3A8C84";
const PURP_CLR = "#7048A0";

// Matches the old dashboard's fmt(): abbreviate to K/M so KPI tiles read
// "41.0K" rather than "41,027" -- these tiles are small, abbreviated is legible.
function fmt(n: number): string {
  if (n == null || Number.isNaN(n)) return "─";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}
function pct(n: number): string {
  if (n == null || Number.isNaN(n)) return "─";
  return `${n.toFixed(1)}%`;
}
function avg<T>(arr: T[], key: (x: T) => number): number {
  if (!arr.length) return 0;
  return arr.reduce((s, x) => s + key(x), 0) / arr.length;
}
function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}
// Plain .slice(0, n) on a caption can split a surrogate pair (most emoji are
// 2 UTF-16 code units) right down the middle -- the resulting lone surrogate
// serializes differently between the server's RSC payload and the browser's
// parser, which showed up as a real hydration mismatch on a caption ending
// mid-emoji. Array.from iterates by code point, so it never cuts one in half.
function truncate(str: string, maxLen: number): string {
  const chars = Array.from(str);
  return chars.length > maxLen ? chars.slice(0, maxLen).join("") + "…" : str;
}

type RatedPost = EnrichedPost & { engRate: number; saveRate: number };

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
  history: AccountHistoryPoint[];
  activeStories: EnrichedStory[];
  allStories: EnrichedStory[];
  username: string;
}

export function InstagramTab({ account, posts, history, activeStories, allStories, username }: InstagramTabProps) {
  const [range, setRange] = useState<DateRange>(ALL_TIME_RANGE);

  // Filtered once here, up front -- everything below derives from these via
  // its own useMemo chain, so the range filter reaches every KPI/chart/table
  // for free with no further changes needed downstream. activeStories is
  // deliberately NOT filtered -- "currently live right now" doesn't make
  // sense to narrow into the past.
  const filteredPosts = useMemo(() => posts.filter((p) => inDateRange(p.postedAt, range)), [posts, range]);
  const filteredHistory = useMemo(() => history.filter((h) => inDateRange(h.fetchedAt, range)), [history, range]);
  const filteredAllStories = useMemo(() => allStories.filter((s) => inDateRange(s.postedAt, range)), [allStories, range]);

  // eng_rate = total_interactions/reach*100, save_rate = saves/reach*100 -- matches
  // the old dashboard's enrich() exactly. (Not likes/followers -- a different, less
  // useful ratio the previous version of this tab used by mistake.)
  const rated = useMemo<RatedPost[]>(
    () =>
      filteredPosts.map((p) => ({
        ...p,
        engRate: p.reach > 0 ? (p.totalInteractions / p.reach) * 100 : 0,
        saveRate: p.reach > 0 ? (p.saves / p.reach) * 100 : 0,
      })),
    [filteredPosts],
  );

  const topByReach = useMemo(() => [...rated].sort((a, b) => b.reach - a.reach), [rated]);
  const top15ByReach = useMemo(() => topByReach.slice(0, 15), [topByReach]);
  const top12ByReach = useMemo(() => topByReach.slice(0, 12), [topByReach]);

  const totals = useMemo(() => {
    return {
      totalReach: rated.reduce((s, p) => s + p.reach, 0),
      totalSaves: rated.reduce((s, p) => s + p.saves, 0),
      totalShares: rated.reduce((s, p) => s + p.shares, 0),
      totalFollows: rated.reduce((s, p) => s + p.follows, 0),
      avgReach: avg(rated, (p) => p.reach),
      avgLikes: avg(rated, (p) => p.likes),
      avgEngRate: avg(rated, (p) => p.engRate),
      avgSaveRate: avg(rated, (p) => p.saveRate),
    };
  }, [rated]);

  const mix = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of rated) counts[p.productType || p.mediaType] = (counts[p.productType || p.mediaType] ?? 0) + 1;
    return counts;
  }, [rated]);

  const typeComparison = useMemo(() => {
    const reels = rated.filter((p) => p.productType === "REELS");
    const feed = rated.filter((p) => p.productType !== "REELS");
    const metrics: Array<{ label: string; key: (p: RatedPost) => number; fmt: (v: number) => string }> = [
      { label: "Avg Reach", key: (p) => p.reach, fmt },
      { label: "Avg Likes", key: (p) => p.likes, fmt },
      { label: "Avg Eng. Rate", key: (p) => p.engRate, fmt: pct },
      { label: "Avg Save Rate", key: (p) => p.saveRate, fmt: pct },
      { label: "Avg Profile Vis", key: (p) => p.profileVisits, fmt },
      { label: "Avg Follows", key: (p) => p.follows, fmt },
    ];
    return {
      reelsCount: reels.length,
      feedCount: feed.length,
      rows: metrics.map((m) => {
        const rv = reels.length ? avg(reels, m.key) : null;
        const fv = feed.length ? avg(feed, m.key) : null;
        const winner = rv != null && fv != null ? (rv > fv ? "reels" : rv < fv ? "feed" : "tie") : null;
        return { label: m.label, reelsVal: rv, feedVal: fv, winner, fmtFn: m.fmt };
      }),
    };
  }, [rated]);

  const postTagPerformance = useMemo(() => {
    const groups = groupByTag(rated, (p) => p.tags);
    return [...groups.entries()]
      .map(([tag, posts]) => ({
        tag,
        count: posts.length,
        avgReach: avg(posts, (p) => p.reach),
        avgEngRate: avg(posts, (p) => p.engRate),
        avgSaveRate: avg(posts, (p) => p.saveRate),
      }))
      .sort((a, b) => b.avgReach - a.avgReach);
  }, [rated]);

  const insights = useMemo(() => {
    const pills: Array<{ variant: "good" | "warn" | "info" | "hot"; text: string }> = [];
    const reels = rated.filter((p) => p.productType === "REELS");
    const feed = rated.filter((p) => p.productType !== "REELS");

    if (reels.length && feed.length) {
      const rr = avg(reels, (p) => p.reach);
      const fr = avg(feed, (p) => p.reach);
      if (rr > 0 && fr > 0) {
        const reelsWin = rr > fr;
        const ratio = Math.round((Math.max(rr, fr) / Math.min(rr, fr)) * 10) / 10;
        pills.push({
          variant: "info",
          text: `${reelsWin ? "REELS" : "FEED"} gets ${ratio}× more reach than ${reelsWin ? "FEED" : "REELS"}`,
        });
      }
    }

    const topPost = topByReach[0];
    if (topPost) {
      const cap = truncate(topPost.caption ?? "", 35);
      pills.push({
        variant: "good",
        text: `Top post: ${dateStr(topPost.postedAt)} · ${topPost.productType ?? topPost.mediaType} · ${fmt(topPost.reach)} reach${cap ? ` — "${cap}"` : ""}`,
      });
    }

    if (totals.avgSaveRate > 1) {
      pills.push({ variant: "good", text: `Strong save rate ${pct(totals.avgSaveRate)} · audience finds content worth bookmarking` });
    }
    if (totals.avgSaveRate < 0.5) {
      pills.push({ variant: "warn", text: `Low save rate ${pct(totals.avgSaveRate)} · try more actionable or educational content` });
    }

    const highEr = rated.filter((p) => p.engRate > totals.avgEngRate * 1.5);
    if (highEr.length) {
      pills.push({ variant: "hot", text: `${highEr.length} posts at 1.5× avg eng. rate — study what made them pop` });
    }

    const topFollowPost = [...rated].sort((a, b) => b.follows - a.follows)[0];
    if (topFollowPost && topFollowPost.follows > 0) {
      const cap = truncate(topFollowPost.caption ?? "", 35);
      pills.push({
        variant: "good",
        text: `Best follow-driver: ${dateStr(topFollowPost.postedAt)} · ${topFollowPost.follows} follows${cap ? ` — "${cap}"` : ""}`,
      });
    }

    const highReach = rated.filter((p) => p.reach > totals.avgReach * 1.5);
    if (highReach.length) {
      pills.push({ variant: "info", text: `${highReach.length} posts exceeded 1.5× avg reach — analyze for patterns` });
    }

    return pills;
  }, [rated, topByReach, totals]);

  const top5ByReach = useMemo(() => topByReach.slice(0, 5), [topByReach]);
  const top5BySaves = useMemo(() => [...rated].sort((a, b) => b.saves - a.saves).slice(0, 5), [rated]);
  const top5ByFollows = useMemo(() => [...rated].sort((a, b) => b.follows - a.follows).slice(0, 5), [rated]);

  const storiesStats = useMemo(
    () => ({
      count: filteredAllStories.length,
      avgImp: avg(filteredAllStories, (s) => s.impressions),
      avgReach: avg(filteredAllStories, (s) => s.reach),
      totalReplies: filteredAllStories.reduce((s, x) => s + x.replies, 0),
      avgFwd: avg(filteredAllStories, (s) => s.tapsForward),
      avgExits: avg(filteredAllStories, (s) => s.exits),
    }),
    [filteredAllStories],
  );
  const storiesChartData = useMemo(
    () => [...filteredAllStories].sort((a, b) => a.postedAt.getTime() - b.postedAt.getTime()).slice(-30),
    [filteredAllStories],
  );
  const activeStoriesImpressions = useMemo(() => activeStories.reduce((s, x) => s + x.impressions, 0), [activeStories]);

  const storyTagPerformance = useMemo(() => {
    const groups = groupByTag(filteredAllStories, (s) => s.tags);
    return [...groups.entries()]
      .map(([tag, stories]) => ({
        tag,
        count: stories.length,
        avgImp: avg(stories, (s) => s.impressions),
        avgReach: avg(stories, (s) => s.reach),
        avgExits: avg(stories, (s) => s.exits),
      }))
      .sort((a, b) => b.avgReach - a.avgReach);
  }, [filteredAllStories]);

  const columns: Column<RatedPost>[] = [
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
    { key: "date", label: "Date", render: (p) => dateStr(p.postedAt), sortValue: (p) => p.postedAt.getTime() },
    { key: "type", label: "Type", render: (p) => <TypeBadge type={p.productType || p.mediaType} />, sortValue: (p) => p.productType },
    { key: "caption", label: "Caption", render: (p) => <span className="max-w-[200px] overflow-hidden text-ellipsis text-[9px] text-neutral-500">{truncate(p.caption ?? "", 60)}</span> },
    { key: "tags", label: "Tags", render: (p) => <TagBadges tags={p.tags} /> },
    { key: "reach", label: "Reach", align: "right", render: (p) => fmt(p.reach), sortValue: (p) => p.reach },
    { key: "likes", label: "Likes", align: "right", render: (p) => fmt(p.likes), sortValue: (p) => p.likes },
    { key: "comments", label: "Comm.", align: "right", render: (p) => fmt(p.comments), sortValue: (p) => p.comments },
    { key: "saves", label: "Saves", align: "right", render: (p) => fmt(p.saves), sortValue: (p) => p.saves },
    { key: "shares", label: "Shares", align: "right", render: (p) => fmt(p.shares), sortValue: (p) => p.shares },
    { key: "profileVisits", label: "Prof. Vis.", align: "right", render: (p) => fmt(p.profileVisits), sortValue: (p) => p.profileVisits },
    { key: "follows", label: "Follows", align: "right", render: (p) => fmt(p.follows), sortValue: (p) => p.follows },
    { key: "engRate", label: "Eng. Rate", align: "right", render: (p) => pct(p.engRate), sortValue: (p) => p.engRate },
    { key: "saveRate", label: "Save Rate", align: "right", render: (p) => pct(p.saveRate), sortValue: (p) => p.saveRate },
  ];

  const storyColumns: Column<EnrichedStory>[] = [
    {
      key: "thumb",
      label: "",
      render: (s) => {
        const src = displayImageUrl(s.mediaType, s.mediaUrl, s.thumbnailUrl);
        return src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-8 w-8 rounded-sm object-cover" />
        ) : (
          <div className="h-8 w-8 rounded-sm bg-neutral-200" />
        );
      },
    },
    { key: "date", label: "Date", render: (s) => dateStr(s.postedAt), sortValue: (s) => s.postedAt.getTime() },
    { key: "impressions", label: "Impressions", align: "right", render: (s) => fmt(s.impressions), sortValue: (s) => s.impressions },
    { key: "reach", label: "Reach", align: "right", render: (s) => fmt(s.reach), sortValue: (s) => s.reach },
    { key: "replies", label: "Replies", align: "right", render: (s) => fmt(s.replies), sortValue: (s) => s.replies },
    { key: "tapsForward", label: "Taps Fwd", align: "right", render: (s) => fmt(s.tapsForward), sortValue: (s) => s.tapsForward },
    { key: "tapsBack", label: "Taps Back", align: "right", render: (s) => fmt(s.tapsBack), sortValue: (s) => s.tapsBack },
    { key: "exits", label: "Exits", align: "right", render: (s) => fmt(s.exits), sortValue: (s) => s.exits },
    { key: "caption", label: "Caption", render: (s) => <span className="max-w-[200px] overflow-hidden text-ellipsis text-[9px] text-neutral-500">{truncate(s.caption ?? "", 60)}</span> },
    { key: "tags", label: "Tags", render: (s) => <TagBadges tags={s.tags} /> },
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

      <DateRangeFilter range={range} onChange={setRange} />

      <Window label={`Performance Vitals · Last ${filteredPosts.length} Posts`} bodyClassName="p-2.5">
        <KpiRow>
          <Kpi label="Total Reach" value={fmt(totals.totalReach)} sub="across all posts" />
          <Kpi label="Avg Reach/Post" value={fmt(totals.avgReach)} sub="per post" accent="o" />
          <Kpi label="Avg Eng. Rate" value={pct(totals.avgEngRate)} sub="interactions ÷ reach" accent="g" />
          <Kpi label="Total Saves" value={fmt(totals.totalSaves)} sub="bookmarks" accent="r" />
          <Kpi label="Followers Gained" value={fmt(totals.totalFollows)} sub="from posts" accent="f" />
          <Kpi label="Avg Likes" value={fmt(totals.avgLikes)} sub="per post" />
          <Kpi label="Total Shares" value={fmt(totals.totalShares)} sub="reposts" accent="r" />
        </KpiRow>
      </Window>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Window label="📈 Follower Growth Monitor" className="md:col-span-2">
          <div className="mb-1.5 text-[9px] text-neutral-400">Follower count over time · each point = one sync</div>
          <ChartCanvas
            config={{
              type: "line",
              data: {
                labels: filteredHistory.map((h) => h.fetchedAt.toISOString().slice(5, 16).replace("T", " ")),
                datasets: [
                  {
                    label: "Followers",
                    data: filteredHistory.map((h) => h.followers),
                    borderColor: REEL_CLR,
                    backgroundColor: `${REEL_CLR}22`,
                    pointBackgroundColor: REEL_CLR,
                    pointRadius: filteredHistory.length > 60 ? 0 : 3,
                    tension: 0.3,
                    fill: true,
                    yAxisID: "y",
                  },
                  {
                    label: "Avg Likes/Post",
                    data: filteredHistory.map((h) => h.avgLikes),
                    borderColor: GOLD_CLR,
                    backgroundColor: "transparent",
                    pointBackgroundColor: GOLD_CLR,
                    pointRadius: filteredHistory.length > 60 ? 0 : 2,
                    tension: 0.3,
                    borderDash: [4, 2],
                    yAxisID: "y2",
                  },
                ],
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: true, position: "top", labels: { boxWidth: 10, font: { size: 10 } } } },
                scales: {
                  x: { ticks: { maxTicksLimit: 8, maxRotation: 0 } },
                  y: { position: "left", title: { display: true, text: "Followers", font: { size: 9 } } },
                  y2: { position: "right", grid: { display: false }, title: { display: true, text: "Avg Likes", font: { size: 9 } } },
                },
              },
            }}
          />
        </Window>

        <Window label="🍩 Content Mix">
          <div className="mb-1.5 text-[9px] text-neutral-400">Post type breakdown</div>
          {filteredPosts.length === 0 ? (
            <div className="py-6 text-center text-[11px] text-neutral-400">No posts in this date range</div>
          ) : (
            <>
              <ChartCanvas
                height={140}
                config={{
                  type: "doughnut",
                  data: {
                    labels: Object.keys(mix),
                    datasets: [
                      {
                        data: Object.values(mix),
                        backgroundColor: [REEL_CLR, FEED_CLR, GOLD_CLR, TEAL_CLR, PURP_CLR],
                        borderWidth: 2,
                        borderColor: "#F4EFE6",
                      },
                    ],
                  },
                  options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } } } },
                }}
              />
              <table className="mt-2.5 w-full border-collapse text-[10px]">
                <thead>
                  <tr>
                    <th className="p-1 text-left text-neutral-500"></th>
                    <th className="p-1 text-center text-reel">REELS</th>
                    <th className="p-1 text-center text-feed">FEED</th>
                    <th className="p-1 text-center text-neutral-500">Winner</th>
                  </tr>
                </thead>
                <tbody>
                  {typeComparison.rows.map((r) => (
                    <tr key={r.label}>
                      <td className="border-t border-border p-1 text-left text-neutral-500">{r.label}</td>
                      <td className="border-t border-border p-1 text-center">{r.reelsVal != null ? r.fmtFn(r.reelsVal) : "─"}</td>
                      <td className="border-t border-border p-1 text-center">{r.feedVal != null ? r.fmtFn(r.feedVal) : "─"}</td>
                      <td className="border-t border-border p-1 text-center">
                        {r.winner === "reels" ? "🔴 REELS" : r.winner === "feed" ? "🔵 FEED" : r.winner === "tie" ? "⚖️ Tie" : "─"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Window>
      </div>

      {filteredPosts.length === 0 ? (
        <Window label="📊 Post Analytics">
          <div className="py-8 text-center text-[11px] text-neutral-400">No posts in this date range — try widening it.</div>
        </Window>
      ) : (
        <>
      <Window label={`📊 Post Reach · All ${filteredPosts.length} Posts · Sorted by Reach ↓`}>
        <div className="mb-1.5 text-[9px] text-neutral-400">Reach per post colored by type · Engagement rate % overlay</div>
        <ChartCanvas
          config={{
            type: "bar",
            data: {
              labels: topByReach.map((p) => dateStr(p.postedAt).slice(5)),
              datasets: [
                {
                  type: "bar",
                  label: "Reach",
                  data: topByReach.map((p) => p.reach),
                  backgroundColor: topByReach.map((p) => `${p.productType === "REELS" ? REEL_CLR : FEED_CLR}CC`),
                  borderColor: topByReach.map((p) => (p.productType === "REELS" ? REEL_CLR : FEED_CLR)),
                  borderWidth: 1,
                  order: 2,
                  yAxisID: "y",
                },
                {
                  type: "line",
                  label: "Eng. Rate %",
                  data: topByReach.map((p) => Number(p.engRate.toFixed(2))),
                  borderColor: GOLD_CLR,
                  backgroundColor: "transparent",
                  pointBackgroundColor: GOLD_CLR,
                  pointRadius: 3,
                  tension: 0.3,
                  order: 1,
                  yAxisID: "y2",
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                x: { ticks: { maxRotation: 45, font: { size: 9 } } },
                y: { position: "left", title: { display: true, text: "Reach", font: { size: 9 } } },
                y2: { position: "right", grid: { display: false }, title: { display: true, text: "Eng.%", font: { size: 9 } }, min: 0 },
              },
            },
          }}
          height={220}
        />
      </Window>

      <Window label="🔍 What's Working · Auto Analysis">
        <div className="mb-1.5 text-[9px] text-neutral-400">AI-readable signals from your last {filteredPosts.length} posts</div>
        <Pills>
          {insights.map((p, i) => (
            <Pill key={i} variant={p.variant}>
              {p.text}
            </Pill>
          ))}
        </Pills>
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
          {[
            { title: "📊 Top 5 by Reach", rows: top5ByReach, value: (p: RatedPost) => fmt(p.reach), color: "text-retro-teal" },
            { title: "💾 Top 5 by Saves", rows: top5BySaves, value: (p: RatedPost) => fmt(p.saves), color: "text-reel" },
            { title: "➕ Top 5 Follow Drivers", rows: top5ByFollows, value: (p: RatedPost) => fmt(p.follows), color: "text-retro-gold" },
          ].map((card) => (
            <div key={card.title} className="rounded-sm border border-border bg-white p-2.5">
              <div className="mb-2 text-[9px] text-neutral-400">{card.title}</div>
              {card.rows.map((p) => (
                <div key={p.id} className="border-b border-border py-1 last:border-b-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px]">
                      {dateStr(p.postedAt)} <TypeBadge type={p.productType || p.mediaType} />
                      {p.permalink && (
                        <a href={p.permalink} target="_blank" rel="noreferrer" className="ml-1 opacity-60">
                          ↗
                        </a>
                      )}
                    </span>
                    <span className={`font-pixel text-base ${card.color}`}>{card.value(p)}</span>
                  </div>
                  {p.caption && <div className="mt-0.5 text-[9px] text-neutral-400 italic">&ldquo;{truncate(p.caption, 40)}&rdquo;</div>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </Window>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Window label="💾 Engagement Signals · Saves · Shares · Profile Visits">
          <div className="mb-1.5 text-[9px] text-neutral-400">Deeper engagement by post (top 15 by reach) · saves = content value</div>
          <ChartCanvas
            config={{
              type: "bar",
              data: {
                labels: top15ByReach.map((p) => dateStr(p.postedAt).slice(5)),
                datasets: [
                  { label: "Saves", data: top15ByReach.map((p) => p.saves), backgroundColor: `${TEAL_CLR}CC`, stack: "s" },
                  { label: "Shares", data: top15ByReach.map((p) => p.shares), backgroundColor: `${GOLD_CLR}CC`, stack: "s" },
                  { label: "Profile Visits", data: top15ByReach.map((p) => p.profileVisits), backgroundColor: `${PURP_CLR}CC`, stack: "s" },
                ],
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: true, position: "top", labels: { boxWidth: 10, font: { size: 10 } } } },
                scales: { x: { stacked: true, ticks: { font: { size: 9 }, maxRotation: 45 } }, y: { stacked: true } },
              },
            }}
            height={220}
          />
        </Window>

        <Window label="🎯 Discovery Funnel">
          <div className="mb-1.5 text-[9px] text-neutral-400">Reach → Profile Visits → Follows · top 12 posts</div>
          <ChartCanvas
            config={{
              type: "bar",
              data: {
                labels: top12ByReach.map((p) => `${dateStr(p.postedAt).slice(5)} ${(p.productType ?? p.mediaType ?? "")[0] ?? ""}`),
                datasets: [
                  { label: "Reach÷100", data: top12ByReach.map((p) => Math.round(p.reach / 100)), backgroundColor: `${FEED_CLR}44`, borderColor: FEED_CLR, borderWidth: 1 },
                  { label: "Profile Visits", data: top12ByReach.map((p) => p.profileVisits), backgroundColor: `${PURP_CLR}AA` },
                  { label: "Follows", data: top12ByReach.map((p) => p.follows), backgroundColor: `${REEL_CLR}CC` },
                ],
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: true, position: "top", labels: { boxWidth: 10, font: { size: 10 } } } },
                scales: { x: { ticks: { font: { size: 9 }, maxRotation: 45 } } },
              },
            }}
            height={220}
          />
        </Window>
      </div>

      {postTagPerformance.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Window label="🏷 Performance by Tag" className="md:col-span-2">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  <th className="p-1 text-left text-neutral-500">Tag</th>
                  <th className="p-1 text-right text-neutral-500">Posts</th>
                  <th className="p-1 text-right text-neutral-500">Avg Reach</th>
                  <th className="p-1 text-right text-neutral-500">Avg Eng. Rate</th>
                  <th className="p-1 text-right text-neutral-500">Avg Save Rate</th>
                </tr>
              </thead>
              <tbody>
                {postTagPerformance.map((row) => (
                  <tr key={row.tag}>
                    <td className="border-t border-border p-1 text-left uppercase tracking-wide text-neutral-600">
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: getTagColor(row.tag) }} />
                      {row.tag}
                    </td>
                    <td className="border-t border-border p-1 text-right">{row.count}</td>
                    <td className="border-t border-border p-1 text-right font-pixel text-base text-retro-teal">{fmt(row.avgReach)}</td>
                    <td className="border-t border-border p-1 text-right">{pct(row.avgEngRate)}</td>
                    <td className="border-t border-border p-1 text-right">{pct(row.avgSaveRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Window>

          <Window label="🥧 Content Mix by Tag">
            <ChartCanvas
              height={200}
              config={{
                type: "pie",
                data: {
                  labels: postTagPerformance.map((r) => r.tag),
                  datasets: [
                    {
                      data: postTagPerformance.map((r) => r.count),
                      backgroundColor: getTagColors(postTagPerformance.map((r) => r.tag)),
                      borderWidth: 2,
                      borderColor: "#F4EFE6",
                    },
                  ],
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 8, font: { size: 9 } } } } },
              }}
            />
          </Window>
        </div>
      )}

      <Window label={`🗂 Post Explorer · ${filteredPosts.length} posts`}>
        <div className="max-h-[300px] overflow-y-auto">
          <SortableTable columns={columns} rows={rated} rowKey={(p) => p.id} defaultSortKey="reach" />
        </div>
      </Window>
        </>
      )}

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

      <Window label="📱 Stories Analytics">
        {activeStories.length > 0 && (
          <div className="mb-2.5 rounded-sm border border-[#C89038] bg-[#FFF3D0] px-2.5 py-1.5 text-[11px] text-[#7A4A00]">
            📱 {activeStories.length} active stor{activeStories.length === 1 ? "y" : "ies"} live right now · {fmt(activeStoriesImpressions)} impressions so far
          </div>
        )}

        {filteredAllStories.length === 0 ? (
          <div className="rounded-sm border border-border bg-neutral-50 p-3 text-center text-[11px] text-neutral-400">
            {allStories.length === 0
              ? "⏳ No stories logged yet — data appears after the next sync captures a live story."
              : "No stories in this date range — try widening it."}
          </div>
        ) : (
          <>
            <KpiRow>
              <Kpi label="Stories Logged" value={fmt(storiesStats.count)} sub="since tracking started" accent="o" />
              <Kpi label="Avg Impressions" value={fmt(storiesStats.avgImp)} sub="per story" />
              <Kpi label="Avg Reach" value={fmt(storiesStats.avgReach)} sub="unique views" accent="g" />
              <Kpi label="Total Replies" value={fmt(storiesStats.totalReplies)} sub="all stories" accent="r" />
              <Kpi label="Avg Taps Fwd" value={fmt(storiesStats.avgFwd)} sub="skip-ahead signal" accent="f" />
              <Kpi label="Avg Exits" value={fmt(storiesStats.avgExits)} sub="drop-off" />
            </KpiRow>

            <div className="mt-3 mb-1.5 text-[9px] text-neutral-400">Impressions &amp; reach per story · most recent 30 · chronological</div>
            <ChartCanvas
              config={{
                type: "bar",
                data: {
                  labels: storiesChartData.map((s) => dateStr(s.postedAt).slice(5)),
                  datasets: [
                    {
                      type: "bar",
                      label: "Impressions",
                      data: storiesChartData.map((s) => s.impressions),
                      backgroundColor: `${GOLD_CLR}CC`,
                      borderColor: GOLD_CLR,
                      borderWidth: 1,
                      yAxisID: "y",
                    },
                    {
                      type: "line",
                      label: "Reach",
                      data: storiesChartData.map((s) => s.reach),
                      borderColor: TEAL_CLR,
                      backgroundColor: `${TEAL_CLR}30`,
                      borderWidth: 2,
                      pointRadius: 2,
                      tension: 0.3,
                      yAxisID: "y",
                    },
                  ],
                },
                options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: true, labels: { font: { size: 10 }, boxWidth: 10 } } },
                  scales: { x: { ticks: { font: { size: 9 }, maxRotation: 45 } }, y: { min: 0 } },
                },
              }}
              height={180}
            />

            {storyTagPerformance.length > 0 && (
              <>
                <div className="mt-3 mb-1.5 text-[9px] text-neutral-400">Performance by tag</div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <table className="w-full border-collapse text-[11px] md:col-span-2">
                    <thead>
                      <tr>
                        <th className="p-1 text-left text-neutral-500">Tag</th>
                        <th className="p-1 text-right text-neutral-500">Stories</th>
                        <th className="p-1 text-right text-neutral-500">Avg Impressions</th>
                        <th className="p-1 text-right text-neutral-500">Avg Reach</th>
                        <th className="p-1 text-right text-neutral-500">Avg Exits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {storyTagPerformance.map((row) => (
                        <tr key={row.tag}>
                          <td className="border-t border-border p-1 text-left uppercase tracking-wide text-neutral-600">
                            <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: getTagColor(row.tag) }} />
                            {row.tag}
                          </td>
                          <td className="border-t border-border p-1 text-right">{row.count}</td>
                          <td className="border-t border-border p-1 text-right">{fmt(row.avgImp)}</td>
                          <td className="border-t border-border p-1 text-right font-pixel text-base text-retro-teal">{fmt(row.avgReach)}</td>
                          <td className="border-t border-border p-1 text-right">{fmt(row.avgExits)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div>
                    <ChartCanvas
                      height={200}
                      config={{
                        type: "pie",
                        data: {
                          labels: storyTagPerformance.map((r) => r.tag),
                          datasets: [
                            {
                              data: storyTagPerformance.map((r) => r.count),
                              backgroundColor: getTagColors(storyTagPerformance.map((r) => r.tag)),
                              borderWidth: 2,
                              borderColor: "#F4EFE6",
                            },
                          ],
                        },
                        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 8, font: { size: 9 } } } } },
                      }}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="mt-3 mb-1.5 text-[9px] text-neutral-400">Story history · newest first</div>
            <div className="max-h-[260px] overflow-y-auto">
              <SortableTable columns={storyColumns} rows={filteredAllStories} rowKey={(s) => s.id} defaultSortKey="date" />
            </div>
          </>
        )}
      </Window>
    </div>
  );
}
