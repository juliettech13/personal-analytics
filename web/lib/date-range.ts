/** Shared by the Instagram and Newsletter tabs' date-range filters -- one
 * source since the logic (not just the numbers) is identical for both,
 * unlike the trivial per-tab fmt/pct duplication elsewhere in this app. */

export interface DateRange {
  start: Date | null; // null = no lower bound
  end: Date | null; // null = no upper bound
}

export const ALL_TIME_RANGE: DateRange = { start: null, end: null };

/** Accepts either a Date (Instagram's postedAt/fetchedAt) or an ISO date
 * string (Newsletter's issueDate, e.g. "2026-07-15") so one helper covers
 * both tabs' data shapes. */
export function inDateRange(value: Date | string, range: DateRange): boolean {
  if (!range.start && !range.end) return true;
  const t = typeof value === "string" ? new Date(value).getTime() : value.getTime();
  if (range.start && t < range.start.getTime()) return false;
  if (range.end && t > range.end.getTime()) return false;
  return true;
}

export const DATE_RANGE_PRESETS: Array<{ label: string; days: number | null }> = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y", days: 365 },
  { label: "All", days: null },
];

export function presetToRange(days: number | null): DateRange {
  if (days == null) return ALL_TIME_RANGE;
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end };
}

/** A range counts as matching a preset only if it was actually produced by
 * applying that preset (fresh Date.now() each time) -- used just to decide
 * which button looks "active"; a manually-picked custom range simply matches
 * none of them, which is correct (no preset highlighted). Compares to the
 * day, not the millisecond, so the button stays highlighted after you pick it. */
export function matchesPreset(range: DateRange, days: number | null): boolean {
  if (days == null) return range.start == null && range.end == null;
  if (!range.start || !range.end) return false;
  const expectedStart = presetToRange(days).start!;
  return Math.abs(range.start.getTime() - expectedStart.getTime()) < 24 * 60 * 60 * 1000;
}
