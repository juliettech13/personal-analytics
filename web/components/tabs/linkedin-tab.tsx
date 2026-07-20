"use client";

import { useMemo } from "react";
import { Window } from "@/components/retro/window";
import { Kpi, KpiRow } from "@/components/retro/kpi";
import { ChartCanvas } from "@/components/retro/chart-canvas";
import { SortableTable, type Column } from "@/components/retro/sortable-table";
import { UploadDialog } from "./upload-dialog";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}
function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}
// LinkedIn reports very small demographic shares as the literal text "< 1%"
// rather than a number -- Number("< 1%".replace("%","")) is NaN, so every
// such entry silently became 0. When every entry in a category is "< 1%"
// (e.g. Company, in a small-following account), the whole pie's total is 0
// and Chart.js renders nothing at all. 0.5 is a reasonable stand-in for
// "some small nonzero share" so the slice is at least visible.
function parsePct(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed.startsWith("<")) return 0.5;
  return Number(trimmed.replace("%", "")) || 0;
}
// LinkedIn's export has no post-text column at all -- only the URL. Its own
// URLs are self-titling though: /posts/{author}_{slugified-post-opening}-{ugcPost|share|activity}-{id}-{suffix}.
// Deriving a readable snippet from that slug is the only local way to tell
// posts apart without a new API integration.
function extractPostSnippet(url: string): string {
  const match = url.match(/\/posts\/([^/?]+)/);
  if (!match) return "";
  let slug = match[1]!;
  const underscoreIdx = slug.indexOf("_");
  if (underscoreIdx >= 0) slug = slug.slice(underscoreIdx + 1);
  slug = slug.replace(/-(ugcPost|activity|share)-[\w-]+$/i, "");
  const words = slug.split("-").filter(Boolean);
  if (!words.length) return "";
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export interface LinkedInDailyRow {
  date: string;
  impressions: number | null;
  engagements: number | null;
  extra: { demographics?: Array<{ category: string; value: string; pct: string }> } & Record<string, unknown>;
}
export interface LinkedInPostRow {
  url: string;
  publishedAt: string | null;
  impressions: number | null;
  engagements: number | null;
  extra: Record<string, unknown>;
}

export function LinkedInTab({
  dailyEngagement,
  posts,
}: {
  dailyEngagement: LinkedInDailyRow[];
  posts: LinkedInPostRow[];
}) {
  const hasNative = dailyEngagement.length > 0;
  const hasAny = hasNative || posts.length > 0;

  const totals = useMemo(() => {
    const totalImpr = dailyEngagement.reduce((s, r) => s + (r.impressions ?? 0), 0);
    const totalEng = dailyEngagement.reduce((s, r) => s + (r.engagements ?? 0), 0);
    const engRate = totalImpr > 0 ? (totalEng / totalImpr) * 100 : 0;
    return { totalImpr, totalEng, engRate };
  }, [dailyEngagement]);

  const demographics = useMemo(() => {
    const withDemo = [...dailyEngagement].reverse().find((r) => (r.extra?.demographics?.length ?? 0) > 0);
    const groups: Record<string, Array<{ value: string; pct: string }>> = {};
    for (const { category, value, pct } of withDemo?.extra?.demographics ?? []) {
      (groups[category] ??= []).push({ value, pct });
    }
    return groups;
  }, [dailyEngagement]);

  const monthlyFromPosts = useMemo(() => {
    const byMonth: Record<string, number> = {};
    for (const p of posts) {
      const month = (p.publishedAt ?? "").slice(0, 7);
      if (month) byMonth[month] = (byMonth[month] ?? 0) + (p.impressions ?? 0);
    }
    return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b));
  }, [posts]);

  const columns: Column<LinkedInPostRow>[] = [
    { key: "date", label: "Date", render: (p) => p.publishedAt ?? "—", sortValue: (p) => p.publishedAt ?? "" },
    {
      key: "post",
      label: "Post",
      render: (p) => (
        <span className="max-w-[240px] overflow-hidden text-ellipsis text-[10px] text-neutral-600" title={extractPostSnippet(p.url)}>
          {extractPostSnippet(p.url) || "—"}
        </span>
      ),
    },
    { key: "impressions", label: "Impressions", align: "right", render: (p) => fmt(p.impressions ?? 0), sortValue: (p) => p.impressions ?? 0 },
    {
      key: "engagements",
      label: "Engagements",
      align: "right",
      // null means "LinkedIn's export didn't include an engagement count
      // for this post" (its top-by-engagement ranking can be empty for a
      // given export), which is a different fact than "confirmed zero
      // engagements" -- collapsing both to "0" would be actively misleading.
      render: (p) => (p.engagements == null ? "—" : fmt(p.engagements)),
      sortValue: (p) => p.engagements ?? -1,
    },
    {
      key: "url",
      label: "Link",
      render: (p) =>
        p.url.startsWith("http") ? (
          <a href={p.url} target="_blank" rel="noreferrer" className="text-[#0A66C2] hover:underline">
            view post
          </a>
        ) : (
          "—"
        ),
    },
  ];

  if (!hasAny) {
    return (
      <Window label="💼 LinkedIn Analytics — Import Data">
        <div className="py-8 text-center">
          <div className="mb-2 font-pixel text-3xl text-[#0A66C2]">⬛ NO DATA</div>
          <div className="mb-5 font-retro-mono text-[11px] text-neutral-500">
            Export your LinkedIn analytics and upload it below.
          </div>
          <UploadDialog platform="linkedin" />
        </div>
      </Window>
    );
  }

  return (
    <div>
      <div className="mb-3 text-right">
        <UploadDialog platform="linkedin" />
      </div>

      <Window label="💼 LinkedIn Analytics" bodyClassName="p-2.5">
        <KpiRow>
          <Kpi label="Total Impressions" value={fmt(totals.totalImpr)} />
          <Kpi label="Total Engagements" value={fmt(totals.totalEng)} accent="o" />
          <Kpi label="Eng. Rate" value={pct(totals.engRate)} accent="g" />
        </KpiRow>
      </Window>

      {hasNative && (
        <Window label="📈 Daily Impressions & Engagement">
          <ChartCanvas
            config={{
              type: "line",
              data: {
                labels: dailyEngagement.map((r) => r.date),
                datasets: [
                  { label: "Impressions", data: dailyEngagement.map((r) => r.impressions ?? 0), borderColor: "#0A66C2", backgroundColor: "#0A66C220", fill: true, tension: 0.3, yAxisID: "y" },
                  { label: "Engagements", data: dailyEngagement.map((r) => r.engagements ?? 0), borderColor: "#C8973A", backgroundColor: "#C8973A20", fill: true, tension: 0.3, yAxisID: "y1" },
                ],
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true }, y1: { beginAtZero: true, position: "right", grid: { display: false } } },
              },
            }}
          />
        </Window>
      )}

      {!hasNative && monthlyFromPosts.length > 0 && (
        <Window label="📈 Impressions Over Time">
          <ChartCanvas
            config={{
              type: "line",
              data: {
                labels: monthlyFromPosts.map(([m]) => m),
                datasets: [{ data: monthlyFromPosts.map(([, v]) => v), borderColor: "#0A66C2", backgroundColor: "#0A66C220", fill: true, tension: 0.35, pointRadius: 3 }],
              },
              options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
            }}
          />
        </Window>
      )}

      {Object.keys(demographics).length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Object.entries(demographics).map(([category, items]) => (
            <Window key={category} label={category}>
              <ChartCanvas
                height={180}
                config={{
                  type: "pie",
                  data: {
                    labels: items.map((i) => i.value),
                    datasets: [{ data: items.map((i) => parsePct(i.pct)) }],
                  },
                  options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "right", labels: { boxWidth: 8, font: { size: 9 } } } } },
                }}
              />
            </Window>
          ))}
        </div>
      )}

      <Window label={`🏆 Top Posts · ${posts.length}`}>
        <div className="max-h-[300px] overflow-y-auto">
          <SortableTable columns={columns} rows={posts} rowKey={(p) => p.url} defaultSortKey="impressions" />
        </div>
      </Window>
    </div>
  );
}
