"use client";

import { useMemo, useState } from "react";
import { Window } from "@/components/retro/window";
import { Kpi, KpiRow } from "@/components/retro/kpi";
import { Pill, Pills } from "@/components/retro/pill";
import { ChartCanvas } from "@/components/retro/chart-canvas";
import { SortableTable, type Column } from "@/components/retro/sortable-table";
import { DateRangeFilter } from "@/components/retro/date-range-filter";
import { TagBadges } from "@/components/retro/tag-badges";
import { ALL_TIME_RANGE, inDateRange, type DateRange } from "@/lib/date-range";
import { groupByTag } from "@/lib/tag-performance";
import { getTagColor, getTagColors } from "@/lib/tag-colors";

const REEL_CLR = "#C84860";
const FEED_CLR = "#3A6890";
const GOLD_CLR = "#C8973A";
const TEAL_CLR = "#3A8C84";
const PURP_CLR = "#7048A0";
const SOURCE_COLORS = [FEED_CLR, REEL_CLR, GOLD_CLR, TEAL_CLR, PURP_CLR, "#888"];

// Newsletter numbers (subscriber counts, recipients) read better in full --
// unlike the Instagram tab's K/M abbreviation, the old dashboard kept these
// comma-grouped, not abbreviated ("1,110", not "1.1K").
function fmt(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}
function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}
// Array.from iterates by code point, not UTF-16 code unit, so it never cuts
// a surrogate-pair emoji in half the way a plain .slice(0, n) can.
function truncate(str: string, maxLen: number): string {
  const chars = Array.from(str);
  return chars.length > maxLen ? chars.slice(0, maxLen).join("") + "…" : str;
}

// Static "about" copy for the profile header -- not Beehiiv data, doesn't
// belong in the DB, changes about as often as a bio does.
const PROFILE = {
  name: "nerd_splash",
  handle: "newsletter.juliet.tech",
  bio: "Weekly dispatches on tech, money, and being a nerd in the world.",
};
const OPEN_RATE_INDUSTRY_AVG = 21;
const CLICK_RATE_INDUSTRY_AVG = 2;

export interface NewsletterSnapshotRow {
  snapshotDate: string;
  activeSubscribers: number;
  totalSignups: number | null;
  churned: number | null;
  avgOpenRate: string | null;
  avgClickRate: string | null;
  revenueCents: number | null;
  extra: { sources?: Array<{ name: string; count: number }> } & Record<string, unknown>;
}
export interface NewsletterIssueRow {
  id: string;
  issueDate: string;
  subject: string | null;
  recipients: number | null;
  openRate: string | null;
  clickRate: string | null;
  tags: string[];
  extra: { webViews?: number; unsubs?: number; url?: string } & Record<string, unknown>;
}

export function NewsletterTab({
  snapshots,
  issues,
}: {
  snapshots: NewsletterSnapshotRow[];
  issues: NewsletterIssueRow[];
}) {
  const latest = snapshots[snapshots.length - 1];
  // Acquisition Sources deliberately does NOT get filtered below -- it's a
  // point-in-time breakdown on the snapshot row, same reasoning as why the
  // Profile header/KPI tiles stay bound to `latest` rather than the filtered set.
  const sources = useMemo(() => latest?.extra?.sources ?? [], [latest]);

  const [range, setRange] = useState<DateRange>(ALL_TIME_RANGE);
  const filteredIssues = useMemo(() => issues.filter((i) => inDateRange(i.issueDate, range)), [issues, range]);

  // Issues come from the DB ordered oldest-first (for upsert-by-date sanity);
  // every chart/table here reads newest-first, matching the old dashboard.
  const issuesDesc = useMemo(() => [...filteredIssues].sort((a, b) => (a.issueDate < b.issueDate ? 1 : -1)), [filteredIssues]);

  // Recomputed across the tracked (filtered) issues -- what the chart's
  // avg-line and the pill/badge thresholds compare each issue against.
  const avgOpen = useMemo(
    () => (filteredIssues.length ? filteredIssues.reduce((s, i) => s + Number(i.openRate ?? 0), 0) / filteredIssues.length : 0),
    [filteredIssues],
  );
  const avgClick = useMemo(
    () => (filteredIssues.length ? filteredIssues.reduce((s, i) => s + Number(i.clickRate ?? 0), 0) / filteredIssues.length : 0),
    [filteredIssues],
  );
  // Beehiiv's own lifetime aggregate on the snapshot row -- can differ from
  // avgOpen/avgClick above (e.g. it covers issues sent before tracking started
  // here). The profile header and KPI tiles show this; the chart/pills use
  // the recomputed one since they're inherently about the tracked issue set.
  const snapshotOpenRate = Number(latest?.avgOpenRate ?? 0);
  const snapshotClickRate = Number(latest?.avgClickRate ?? 0);

  const sortedSources = useMemo(() => [...sources].sort((a, b) => b.count - a.count), [sources]);
  const sourcesTotal = useMemo(() => sources.reduce((s, x) => s + x.count, 0), [sources]);

  const tagPerformance = useMemo(() => {
    const groups = groupByTag(issuesDesc, (i) => i.tags);
    return [...groups.entries()]
      .map(([tag, issues]) => ({
        tag,
        count: issues.length,
        avgOpen: issues.length ? issues.reduce((s, i) => s + Number(i.openRate ?? 0), 0) / issues.length : 0,
        avgClick: issues.length ? issues.reduce((s, i) => s + Number(i.clickRate ?? 0), 0) / issues.length : 0,
      }))
      .sort((a, b) => b.avgOpen - a.avgOpen);
  }, [issuesDesc]);

  const insights = useMemo(() => {
    const pills: Array<{ variant: "good" | "warn" | "info" | "hot"; text: string }> = [];
    if (!issuesDesc.length) return pills;

    if (avgOpen > 0) {
      const ratio = (avgOpen / OPEN_RATE_INDUSTRY_AVG).toFixed(1);
      pills.push({ variant: "good", text: `Open rate ${pct(avgOpen)} · ${ratio}× industry average of ${OPEN_RATE_INDUSTRY_AVG}%` });
    }
    if (avgClick > 0) {
      const ratio = (avgClick / CLICK_RATE_INDUSTRY_AVG).toFixed(1);
      pills.push({ variant: "good", text: `Click rate ${pct(avgClick)} · ${ratio}× industry average of ${CLICK_RATE_INDUSTRY_AVG}%` });
    }

    const topClick = [...issuesDesc].sort((a, b) => Number(b.clickRate ?? 0) - Number(a.clickRate ?? 0))[0];
    if (topClick) {
      pills.push({ variant: "hot", text: `Top clicking issue: "${topClick.subject}" at ${pct(Number(topClick.clickRate ?? 0))} — study that CTA` });
    }
    const topOpen = [...issuesDesc].sort((a, b) => Number(b.openRate ?? 0) - Number(a.openRate ?? 0))[0];
    if (topOpen) {
      pills.push({ variant: "good", text: `Most-opened: "${topOpen.subject}" at ${pct(Number(topOpen.openRate ?? 0))} open rate` });
    }
    const highUnsub = [...issuesDesc].sort((a, b) => (b.extra?.unsubs ?? 0) - (a.extra?.unsubs ?? 0))[0];
    if (highUnsub && (highUnsub.extra?.unsubs ?? 0) >= 10) {
      pills.push({ variant: "warn", text: `Highest churn: "${highUnsub.subject}" (${highUnsub.extra?.unsubs} unsubs) · review that issue's tone` });
    }

    const [first, second] = sortedSources;
    if (first && second) {
      pills.push({
        variant: "info",
        text: `Top acquisition: ${first.name} (${fmt(first.count)} subs) + ${second.name} (${fmt(second.count)})`,
      });
    }
    const igSource = sources.find((s) => s.name === "Instagram");
    if (igSource && igSource.count > 0) {
      pills.push({ variant: "info", text: `Instagram sends ${fmt(igSource.count)} subscribers — your IG↔newsletter funnel is working` });
    }

    return pills;
  }, [issuesDesc, avgOpen, avgClick, sortedSources, sources]);

  const columns: Column<NewsletterIssueRow>[] = [
    {
      key: "subject",
      label: "Issue",
      render: (i) =>
        i.extra?.url ? (
          <a href={i.extra.url} target="_blank" rel="noreferrer" className="text-retro-purple hover:underline">
            {i.subject}
          </a>
        ) : (
          i.subject
        ),
    },
    { key: "date", label: "Date", render: (i) => i.issueDate, sortValue: (i) => i.issueDate },
    { key: "tags", label: "Tags", render: (i) => <TagBadges tags={i.tags} /> },
    { key: "recipients", label: "Recipients", align: "right", render: (i) => fmt(i.recipients ?? 0), sortValue: (i) => i.recipients ?? 0 },
    { key: "openRate", label: "Open %", align: "right", render: (i) => pct(Number(i.openRate ?? 0)), sortValue: (i) => Number(i.openRate ?? 0) },
    {
      key: "clickRate",
      label: "Click %",
      align: "right",
      render: (i) => {
        const rate = Number(i.clickRate ?? 0);
        return (
          <span>
            {pct(rate)}
            {rate > 10 && <span className="ml-1 text-[9px] font-bold text-reel">🔥 VIRAL</span>}
            {rate <= 10 && rate >= avgClick * 1.4 && <span className="ml-1 text-[9px] font-bold text-retro-teal">✓ STRONG</span>}
          </span>
        );
      },
      sortValue: (i) => Number(i.clickRate ?? 0),
    },
    { key: "webViews", label: "Web Views", align: "right", render: (i) => fmt(i.extra?.webViews ?? 0), sortValue: (i) => i.extra?.webViews ?? 0 },
    { key: "unsubs", label: "Unsubs", align: "right", render: (i) => fmt(i.extra?.unsubs ?? 0), sortValue: (i) => i.extra?.unsubs ?? 0 },
    {
      key: "link",
      label: "Link",
      align: "right",
      render: (i) =>
        i.extra?.url ? (
          <a
            href={i.extra.url}
            target="_blank"
            rel="noreferrer"
            className="inline-block rounded-xs bg-[#2C2C2C] px-1.5 py-0.5 text-[10px] text-[#FFD060] whitespace-nowrap"
          >
            ↗ View
          </a>
        ) : (
          "─"
        ),
    },
  ];

  if (!latest && !issues.length) {
    return (
      <Window label="✉️ Newsletter Analytics">
        <div className="py-8 text-center font-retro-mono text-[11px] text-neutral-500">
          No newsletter data yet — run{" "}
          <code className="rounded bg-secondary px-1 py-0.5">npm run update-newsletter</code> after editing{" "}
          <code className="rounded bg-secondary px-1 py-0.5">scripts/update-newsletter.ts</code>.
        </div>
      </Window>
    );
  }

  const revenue = latest?.revenueCents != null ? `$${Math.round(latest.revenueCents / 100)}` : "─";

  return (
    <div>
      <Window label="📧 nerd_splash Newsletter · Beehiiv" tag="newsletter.juliet.tech" className="overflow-visible">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#FFD060] bg-neutral-600 text-xl">
            📧
          </div>
          <div>
            <div className="font-pixel text-2xl leading-none">{PROFILE.name}</div>
            <div className="mt-1 max-w-[360px] text-[9px] text-neutral-500">{PROFILE.bio}</div>
          </div>
          <div className="ml-auto flex gap-4">
            <div className="text-center">
              <div className="font-pixel text-xl leading-none">{fmt(latest?.activeSubscribers ?? 0)}</div>
              <div className="mt-0.5 text-[8px] tracking-wide text-neutral-500 uppercase">Active Subs</div>
            </div>
            <div className="text-center">
              <div className="font-pixel text-xl leading-none">{pct(snapshotOpenRate)}</div>
              <div className="mt-0.5 text-[8px] tracking-wide text-neutral-500 uppercase">Avg Open</div>
            </div>
            <div className="text-center">
              <div className="font-pixel text-xl leading-none">{pct(snapshotClickRate)}</div>
              <div className="mt-0.5 text-[8px] tracking-wide text-neutral-500 uppercase">Avg Click</div>
            </div>
            <div className="text-center">
              <div className="font-pixel text-xl leading-none">{revenue}</div>
              <div className="mt-0.5 text-[8px] tracking-wide text-neutral-500 uppercase">Earnings</div>
            </div>
          </div>
        </div>
      </Window>

      <DateRangeFilter range={range} onChange={setRange} />

      <Window label={`Performance Vitals · ${issues.length} Published Issues`} bodyClassName="p-2.5">
        <KpiRow>
          <Kpi label="Active Subscribers" value={fmt(latest?.activeSubscribers ?? 0)} sub="all-time active" accent="g" />
          <Kpi label="Total New Subs" value={fmt(latest?.totalSignups ?? 0)} sub="all-time signups" accent="r" />
          <Kpi label="Churned" value={fmt(latest?.churned ?? 0)} sub="all-time" />
          <Kpi label="Avg Open Rate" value={pct(snapshotOpenRate)} sub={`industry avg ~${OPEN_RATE_INDUSTRY_AVG}%`} accent="o" />
          <Kpi label="Avg Click Rate" value={pct(snapshotClickRate)} sub={`industry avg ~${CLICK_RATE_INDUSTRY_AVG}%`} accent="t" />
          <Kpi label="Revenue" value={revenue} sub="all-time earnings" accent="p" />
        </KpiRow>
      </Window>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Window label="📈 Open Rate by Issue">
          <div className="mb-1.5 text-[9px] text-neutral-400">Unique open rate % per published issue · dashed line = avg</div>
          {issuesDesc.length === 0 ? (
            <div className="py-6 text-center text-[11px] text-neutral-400">No issues in this date range</div>
          ) : (
            <ChartCanvas
              config={{
                type: "bar",
                data: {
                  labels: issuesDesc.map((i) => `${i.issueDate.slice(5)} ${truncate(i.subject ?? "", 12)}`),
                  datasets: [
                    {
                      type: "bar",
                      label: "Open Rate %",
                      data: issuesDesc.map((i) => Number(Number(i.openRate ?? 0).toFixed(1))),
                      backgroundColor: issuesDesc.map((i) => `${Number(i.openRate ?? 0) >= avgOpen ? TEAL_CLR : GOLD_CLR}CC`),
                      borderColor: issuesDesc.map((i) => (Number(i.openRate ?? 0) >= avgOpen ? TEAL_CLR : GOLD_CLR)),
                      borderWidth: 1,
                      order: 2,
                    },
                    {
                      type: "line",
                      label: `Avg (${avgOpen.toFixed(1)}%)`,
                      data: issuesDesc.map(() => Number(avgOpen.toFixed(1))),
                      borderColor: GOLD_CLR,
                      borderDash: [5, 3],
                      backgroundColor: "transparent",
                      pointRadius: 0,
                      order: 1,
                    },
                  ],
                },
                options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: true, position: "top", labels: { boxWidth: 10, font: { size: 10 } } } },
                  scales: {
                    x: { ticks: { font: { size: 8 }, maxRotation: 45 } },
                    y: { min: 0, max: 80, ticks: { callback: (v) => `${v}%` } },
                  },
                },
              }}
              height={220}
            />
          )}
        </Window>

        <Window label="🍩 Acquisition Sources">
          <div className="mb-1.5 text-[9px] text-neutral-400">How readers found the newsletter</div>
          {sources.length > 0 ? (
            <>
              <ChartCanvas
                height={140}
                config={{
                  type: "doughnut",
                  data: {
                    labels: sources.map((s) => s.name),
                    datasets: [{ data: sources.map((s) => s.count), backgroundColor: SOURCE_COLORS, borderWidth: 2, borderColor: "#F4EFE6" }],
                  },
                  options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
                }}
              />
              <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                {sources.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-1.5 text-[10px]">
                    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />
                    <span>
                      <strong>{s.name}</strong> · {fmt(s.count)} ({sourcesTotal > 0 ? Math.round((s.count / sourcesTotal) * 100) : 0}%)
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-6 text-center text-[11px] text-neutral-400">No acquisition data yet</div>
          )}
        </Window>
      </div>

      {issuesDesc.length === 0 ? (
        <Window label="📋 Issue Explorer">
          <div className="py-8 text-center text-[11px] text-neutral-400">No issues in this date range — try widening it.</div>
        </Window>
      ) : (
        <>
          <Window label="🖱️ Click Rate by Issue">
            <div className="mb-1.5 text-[9px] text-neutral-400">Click rate % · high = strong CTA or topic resonance</div>
            <ChartCanvas
              config={{
                type: "bar",
                data: {
                  labels: issuesDesc.map((i) => `${i.issueDate.slice(5)} ${truncate(i.subject ?? "", 12)}`),
                  datasets: [
                    {
                      label: "Click Rate %",
                      data: issuesDesc.map((i) => Number(Number(i.clickRate ?? 0).toFixed(2))),
                      backgroundColor: issuesDesc.map((i) => `${Number(i.clickRate ?? 0) > 10 ? REEL_CLR : PURP_CLR}CC`),
                      borderColor: issuesDesc.map((i) => (Number(i.clickRate ?? 0) > 10 ? REEL_CLR : PURP_CLR)),
                      borderWidth: 1,
                    },
                  ],
                },
                options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { ticks: { font: { size: 8 }, maxRotation: 45 } },
                    y: { min: 0, ticks: { callback: (v) => `${v}%` } },
                  },
                },
              }}
              height={160}
            />
          </Window>

          <Window label="🔍 Newsletter Insights">
            <Pills>
              {insights.map((p, i) => (
                <Pill key={i} variant={p.variant}>
                  {p.text}
                </Pill>
              ))}
            </Pills>
          </Window>

          {tagPerformance.length > 0 && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Window label="🏷 Performance by Tag" className="md:col-span-2">
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr>
                      <th className="p-1 text-left text-neutral-500">Tag</th>
                      <th className="p-1 text-right text-neutral-500">Issues</th>
                      <th className="p-1 text-right text-neutral-500">Avg Open Rate</th>
                      <th className="p-1 text-right text-neutral-500">Avg Click Rate</th>
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
                        <td className="border-t border-border p-1 text-right font-pixel text-base text-retro-teal">{pct(row.avgOpen)}</td>
                        <td className="border-t border-border p-1 text-right">{pct(row.avgClick)}</td>
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

          <Window label={`📋 Issue Explorer · ${filteredIssues.length} Issues`}>
            <div className="max-h-[300px] overflow-y-auto">
              <SortableTable columns={columns} rows={issuesDesc} rowKey={(i) => i.id} defaultSortKey="date" />
            </div>
          </Window>
        </>
      )}
    </div>
  );
}
