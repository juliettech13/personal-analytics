"use client";

import { useMemo } from "react";
import { Window } from "@/components/retro/window";
import { Kpi, KpiRow } from "@/components/retro/kpi";
import { ChartCanvas } from "@/components/retro/chart-canvas";
import { SortableTable, type Column } from "@/components/retro/sortable-table";
import { TagBadges } from "@/components/retro/tag-badges";
import { groupByTag } from "@/lib/tag-performance";
import { getTagColor, getTagColors } from "@/lib/tag-colors";
import { UploadDialog } from "./upload-dialog";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}
function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}
// Tweet text is emoji-heavy; a plain .slice(0, n) can split a surrogate pair
// in half, which serializes differently between server and client and shows
// up as a real hydration mismatch (seen on Instagram captions -- same fix).
function truncate(str: string, maxLen: number): string {
  const chars = Array.from(str);
  return chars.length > maxLen ? chars.slice(0, maxLen).join("") + "…" : str;
}

export interface TwitterPostRow {
  url: string;
  postedAt: string | null;
  text: string | null;
  impressions: number | null;
  engagements: number | null;
  likes: number | null;
  retweets: number | null;
  replies: number | null;
  tags: string[];
}

export function TwitterTab({ posts }: { posts: TwitterPostRow[] }) {
  const totals = useMemo(() => {
    const totalImpr = posts.reduce((s, p) => s + (p.impressions ?? 0), 0);
    const totalEng = posts.reduce((s, p) => s + (p.engagements ?? 0), 0);
    const totalLikes = posts.reduce((s, p) => s + (p.likes ?? 0), 0);
    const totalRT = posts.reduce((s, p) => s + (p.retweets ?? 0), 0);
    const totalReplies = posts.reduce((s, p) => s + (p.replies ?? 0), 0);
    const avgImpr = posts.length ? totalImpr / posts.length : 0;
    const avgEngRate = totalImpr > 0 ? (totalEng / totalImpr) * 100 : 0;
    return { totalImpr, totalEng, totalLikes, totalRT, totalReplies, avgImpr, avgEngRate };
  }, [posts]);

  const monthly = useMemo(() => {
    const byMonth: Record<string, { impr: number; eng: number }> = {};
    for (const p of posts) {
      const month = (p.postedAt ?? "").slice(0, 7);
      if (!month) continue;
      byMonth[month] ??= { impr: 0, eng: 0 };
      byMonth[month]!.impr += p.impressions ?? 0;
      byMonth[month]!.eng += p.engagements ?? 0;
    }
    return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b));
  }, [posts]);

  const tagPerformance = useMemo(() => {
    const groups = groupByTag(posts, (p) => p.tags);
    return [...groups.entries()]
      .map(([tag, group]) => ({
        tag,
        count: group.length,
        avgImpressions: group.length ? group.reduce((s, p) => s + (p.impressions ?? 0), 0) / group.length : 0,
        avgEngRate: (() => {
          const totalImpr = group.reduce((s, p) => s + (p.impressions ?? 0), 0);
          const totalEng = group.reduce((s, p) => s + (p.engagements ?? 0), 0);
          return totalImpr > 0 ? (totalEng / totalImpr) * 100 : 0;
        })(),
      }))
      .sort((a, b) => b.avgImpressions - a.avgImpressions);
  }, [posts]);

  const columns: Column<TwitterPostRow>[] = [
    { key: "text", label: "Tweet", render: (p) => <span className="max-w-[220px] overflow-hidden text-ellipsis text-[9px] text-neutral-500">{truncate(p.text ?? "", 70)}</span> },
    { key: "date", label: "Date", render: (p) => (p.postedAt ?? "").slice(0, 10), sortValue: (p) => p.postedAt ?? "" },
    { key: "tags", label: "Tags", render: (p) => <TagBadges tags={p.tags} /> },
    { key: "impressions", label: "Impressions", align: "right", render: (p) => fmt(p.impressions ?? 0), sortValue: (p) => p.impressions ?? 0 },
    { key: "likes", label: "Likes", align: "right", render: (p) => fmt(p.likes ?? 0), sortValue: (p) => p.likes ?? 0 },
    { key: "retweets", label: "RTs", align: "right", render: (p) => fmt(p.retweets ?? 0), sortValue: (p) => p.retweets ?? 0 },
    { key: "replies", label: "Replies", align: "right", render: (p) => fmt(p.replies ?? 0), sortValue: (p) => p.replies ?? 0 },
  ];

  if (!posts.length) {
    return (
      <Window label="𝕏 Twitter / X Analytics — Import Data">
        <div className="py-8 text-center">
          <div className="mb-2 font-pixel text-3xl">⬛ NO DATA</div>
          <div className="mb-5 font-retro-mono text-[11px] text-neutral-500">
            Export your Twitter/X analytics and upload it below.
          </div>
          <UploadDialog platform="twitter" />
        </div>
      </Window>
    );
  }

  return (
    <div>
      <div className="mb-3 text-right">
        <UploadDialog platform="twitter" />
      </div>

      <Window label={`𝕏 Twitter / X Analytics · ${posts.length} tweets`} bodyClassName="p-2.5">
        <KpiRow>
          <Kpi label="Total Impressions" value={fmt(totals.totalImpr)} />
          <Kpi label="Avg / Tweet" value={fmt(totals.avgImpr)} />
          <Kpi label="Avg Eng Rate" value={pct(totals.avgEngRate)} accent="g" />
          <Kpi label="Total Likes" value={fmt(totals.totalLikes)} accent="o" />
          <Kpi label="Retweets" value={fmt(totals.totalRT)} accent="r" />
          <Kpi label="Replies" value={fmt(totals.totalReplies)} accent="f" />
        </KpiRow>
      </Window>

      {monthly.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Window label="📈 Impressions Over Time">
            <ChartCanvas
              config={{
                type: "line",
                data: { labels: monthly.map(([m]) => m), datasets: [{ data: monthly.map(([, v]) => v.impr), borderColor: "#1C1C1C", backgroundColor: "#1C1C1C20", fill: true, tension: 0.35 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
              }}
            />
          </Window>
          <Window label="💫 Engagement Trend">
            <ChartCanvas
              config={{
                type: "line",
                data: { labels: monthly.map(([m]) => m), datasets: [{ data: monthly.map(([, v]) => (v.impr > 0 ? (v.eng / v.impr) * 100 : 0)), borderColor: "#3A8C84", backgroundColor: "#3A8C8420", fill: true, tension: 0.35 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
              }}
            />
          </Window>
        </div>
      )}

      {tagPerformance.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Window label="🏷 Performance by Tag" className="md:col-span-2">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  <th className="p-1 text-left text-neutral-500">Tag</th>
                  <th className="p-1 text-right text-neutral-500">Tweets</th>
                  <th className="p-1 text-right text-neutral-500">Avg Impressions</th>
                  <th className="p-1 text-right text-neutral-500">Avg Eng. Rate</th>
                </tr>
              </thead>
              <tbody>
                {tagPerformance.map((row) => (
                  <tr key={row.tag}>
                    <td className="border-t border-border p-1 text-left uppercase tracking-wide text-neutral-600">
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: getTagColor(row.tag) }} />
                      {row.tag}
                    </td>
                    <td className="border-t border-border p-1 text-right">{row.count}</td>
                    <td className="border-t border-border p-1 text-right font-pixel text-base text-retro-teal">{fmt(row.avgImpressions)}</td>
                    <td className="border-t border-border p-1 text-right">{pct(row.avgEngRate)}</td>
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
                  labels: tagPerformance.map((r) => r.tag),
                  datasets: [
                    {
                      data: tagPerformance.map((r) => r.count),
                      backgroundColor: getTagColors(tagPerformance.map((r) => r.tag)),
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

      <Window label="🏆 Top Tweets by Impressions">
        <div className="max-h-[300px] overflow-y-auto">
          <SortableTable columns={columns} rows={posts} rowKey={(p) => p.url} defaultSortKey="impressions" />
        </div>
      </Window>
    </div>
  );
}
