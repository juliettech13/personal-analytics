"use client";

import { useMemo } from "react";
import { Window } from "@/components/retro/window";
import { Kpi, KpiRow } from "@/components/retro/kpi";
import { Pill, Pills } from "@/components/retro/pill";
import { ChartCanvas } from "@/components/retro/chart-canvas";
import { SortableTable, type Column } from "@/components/retro/sortable-table";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}
function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

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
  issueDate: string;
  subject: string | null;
  recipients: number | null;
  openRate: string | null;
  clickRate: string | null;
  extra: { webViews?: number; unsubs?: number; url?: string } & Record<string, unknown>;
}

const SOURCE_COLORS = ["#7048A0", "#3A8C84", "#C8973A", "#3A6890", "#C84860", "#888"];

export function NewsletterTab({
  snapshots,
  issues,
}: {
  snapshots: NewsletterSnapshotRow[];
  issues: NewsletterIssueRow[];
}) {
  const latest = snapshots[snapshots.length - 1];

  const avgOpen = useMemo(
    () => (issues.length ? issues.reduce((s, i) => s + Number(i.openRate ?? 0), 0) / issues.length : 0),
    [issues],
  );
  const avgClick = useMemo(
    () => (issues.length ? issues.reduce((s, i) => s + Number(i.clickRate ?? 0), 0) / issues.length : 0),
    [issues],
  );

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
    { key: "recipients", label: "Recipients", align: "right", render: (i) => fmt(i.recipients ?? 0), sortValue: (i) => i.recipients ?? 0 },
    { key: "openRate", label: "Open %", align: "right", render: (i) => pct(Number(i.openRate ?? 0)), sortValue: (i) => Number(i.openRate ?? 0) },
    { key: "clickRate", label: "Click %", align: "right", render: (i) => pct(Number(i.clickRate ?? 0)), sortValue: (i) => Number(i.clickRate ?? 0) },
    { key: "webViews", label: "Web Views", align: "right", render: (i) => fmt(i.extra?.webViews ?? 0), sortValue: (i) => i.extra?.webViews ?? 0 },
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

  return (
    <div>
      <Window label="✉️ Newsletter Analytics" bodyClassName="p-2.5">
        <KpiRow>
          <Kpi label="Active Subscribers" value={fmt(latest?.activeSubscribers ?? 0)} accent="p" />
          <Kpi label="Total Signups" value={fmt(latest?.totalSignups ?? 0)} />
          <Kpi label="Churned" value={fmt(latest?.churned ?? 0)} accent="r" />
          <Kpi label="Avg Open Rate" value={pct(avgOpen)} accent="g" />
          <Kpi label="Avg Click Rate" value={pct(avgClick)} accent="t" />
        </KpiRow>
      </Window>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Window label="📊 Open Rate by Issue">
          <ChartCanvas
            config={{
              type: "bar",
              data: {
                labels: issues.map((i) => i.issueDate),
                datasets: [{ label: "Open %", data: issues.map((i) => Number(i.openRate ?? 0)), backgroundColor: "#7048A0" }],
              },
              options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
            }}
          />
        </Window>

        {latest?.extra?.sources && latest.extra.sources.length > 0 && (
          <Window label="🍩 Acquisition Sources">
            <ChartCanvas
              config={{
                type: "doughnut",
                data: {
                  labels: latest.extra.sources.map((s) => s.name),
                  datasets: [{ data: latest.extra.sources.map((s) => s.count), backgroundColor: SOURCE_COLORS }],
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } } } },
              }}
            />
          </Window>
        )}
      </div>

      <Window label="💡 Auto Insights">
        <Pills>
          <Pill variant={avgOpen > 50 ? "good" : "info"}>Avg open rate: {pct(avgOpen)}</Pill>
          <Pill variant="info">{issues.length} issues tracked</Pill>
        </Pills>
      </Window>

      <Window label={`📰 Issue Explorer · ${issues.length}`}>
        <div className="max-h-[300px] overflow-y-auto">
          <SortableTable columns={columns} rows={issues} rowKey={(i) => i.issueDate} defaultSortKey="date" />
        </div>
      </Window>
    </div>
  );
}
