/**
 * Beehiiv API v2 fetch logic -- same "fetch everything, then write it all
 * atomically" shape as lib/instagram/sync.ts. Beehiiv's API is a normal,
 * well-documented REST/JSON API (unlike Graph API's quirky metric-name
 * churn), so this stays much simpler: no GraphNode-style structural typing,
 * just concrete interfaces for the handful of fields actually used.
 *
 * There is no single endpoint for total signups, churn, or acquisition-source
 * breakdown -- those only exist per-subscription, so fetchAllSubscriptions
 * has to paginate every subscriber once per sync to tally them.
 */

const BEEHIIV_BASE = "https://api.beehiiv.com/v2";

// Docs weren't conclusive on whether open_rate/click_rate come back as a
// 0-1 fraction or an already-scaled 0-100 percent. Real email open/click
// rates are essentially never a genuine <1% (this newsletter's are 45-59%),
// so "<=1 means it was a fraction" is a safe, simple heuristic -- confirmed
// against a live response the first time this actually runs.
function toPercent(value: number): number {
  return value > 0 && value <= 1 ? value * 100 : value;
}

async function apiGet<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const apiKey = process.env.BEEHIIV_API_KEY;
  if (!apiKey) throw new Error("BEEHIIV_API_KEY not configured");

  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])));
  const url = `${BEEHIIV_BASE}${path}${qs.toString() ? `?${qs}` : ""}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Beehiiv API error on ${path}: ${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}

function publicationId(): string {
  const id = process.env.BEEHIIV_PUBLICATION_ID;
  if (!id) throw new Error("BEEHIIV_PUBLICATION_ID not configured");
  return id;
}

interface PublicationResponse {
  data: {
    stats?: {
      active_subscriptions: number;
      average_open_rate: number | null;
      average_click_rate: number | null;
    };
  };
}

export interface PublicationStats {
  activeSubscribers: number;
  avgOpenRate: number;
  avgClickRate: number;
}

export async function fetchPublicationStats(): Promise<PublicationStats> {
  const res = await apiGet<PublicationResponse>(`/publications/${publicationId()}`, {
    "expand[]": "stats",
  });
  const stats = res.data.stats;
  return {
    activeSubscribers: stats?.active_subscriptions ?? 0,
    avgOpenRate: toPercent(stats?.average_open_rate ?? 0),
    avgClickRate: toPercent(stats?.average_click_rate ?? 0),
  };
}

interface BeehiivPost {
  id: string;
  title: string;
  publish_date: number | null;
  displayed_date: number | null;
  web_url: string;
  stats?: {
    email?: {
      recipients?: number;
      unique_opens?: number;
      open_rate?: number;
      unique_clicks?: number;
      click_rate?: number;
      unsubscribes?: number;
    };
    web?: {
      views?: number;
    };
  };
}

interface PostsResponse {
  data: BeehiivPost[];
  page: number;
  total_pages: number;
}

export interface FetchedIssue {
  id: string;
  title: string;
  issueDate: Date;
  recipients: number;
  openRate: number;
  clickRate: number;
  webViews: number;
  unsubs: number;
  url: string;
}

export async function fetchAllPosts(): Promise<FetchedIssue[]> {
  const issues: FetchedIssue[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const res = await apiGet<PostsResponse>(`/publications/${publicationId()}/posts`, {
      "expand[]": "stats",
      status: "confirmed", // sent issues only -- default "all" also includes unsent drafts
      order_by: "publish_date",
      direction: "desc",
      limit: 100,
      page,
    });
    totalPages = res.total_pages;
    for (const p of res.data) {
      const dateSec = p.publish_date ?? p.displayed_date;
      issues.push({
        id: p.id,
        title: p.title,
        issueDate: new Date((dateSec ?? Date.now() / 1000) * 1000),
        recipients: p.stats?.email?.recipients ?? 0,
        openRate: toPercent(p.stats?.email?.open_rate ?? 0),
        clickRate: toPercent(p.stats?.email?.click_rate ?? 0),
        webViews: p.stats?.web?.views ?? 0,
        unsubs: p.stats?.email?.unsubscribes ?? 0,
        url: p.web_url,
      });
    }
    page += 1;
  } while (page <= totalPages);

  return issues;
}

interface BeehiivSubscription {
  status: string;
  utm_channel: string | null;
  utm_source: string | null;
}

interface SubscriptionsResponse {
  data: BeehiivSubscription[];
  has_more: boolean;
  next_cursor: string | null;
}

export interface SubscriptionTally {
  totalSignups: number;
  churned: number;
  sources: Array<{ name: string; count: number }>;
}

export async function fetchAllSubscriptions(): Promise<SubscriptionTally> {
  let totalSignups = 0;
  let churned = 0;
  const sourceCounts = new Map<string, number>();

  let cursor: string | undefined;
  do {
    const res = await apiGet<SubscriptionsResponse>(`/publications/${publicationId()}/subscriptions`, {
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });
    for (const sub of res.data) {
      totalSignups += 1;
      if (sub.status === "inactive") churned += 1;
      const source = sub.utm_channel || sub.utm_source || "Other";
      sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  const sources = [...sourceCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return { totalSignups, churned, sources };
}

export interface NewsletterSnapshot {
  activeSubscribers: number;
  totalSignups: number;
  churned: number;
  avgOpenRate: number;
  avgClickRate: number;
  sources: Array<{ name: string; count: number }>;
  issues: FetchedIssue[];
  fetchedAt: Date;
}

export async function fetchBeehiivSnapshot(): Promise<NewsletterSnapshot> {
  const [pubStats, issues, subs] = await Promise.all([
    fetchPublicationStats(),
    fetchAllPosts(),
    fetchAllSubscriptions(),
  ]);

  return {
    activeSubscribers: pubStats.activeSubscribers,
    totalSignups: subs.totalSignups,
    churned: subs.churned,
    avgOpenRate: pubStats.avgOpenRate,
    avgClickRate: pubStats.avgClickRate,
    sources: subs.sources,
    issues,
    fetchedAt: new Date(),
  };
}
