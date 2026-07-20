import { createHash } from "node:crypto";

/** Mirrors the client's `col = k => Object.keys(r0).find(h => h.includes(k))`
 * fuzzy header matching from the old index.html upload flow -- tries each
 * candidate substring in order, returns the first header that contains it. */
export function pickColumn(row: Record<string, unknown>, candidates: string[]): string | null {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const found = keys.find((k) => k.includes(candidate));
    if (found) return found;
  }
  return null;
}

/** Mirrors the client's `num()` helper: strips %, commas, whitespace. */
export function toNumber(value: unknown): number {
  const n = Number(String(value ?? "").replace(/[%,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function toDateString(value: unknown): string | null {
  const s = String(value ?? "").trim();
  if (!s) return null;

  // Already ISO (e.g. from a generic CSV column already in this shape).
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // LinkedIn's native XLSX export uses M/D/YYYY (e.g. "9/11/2025") -- parsed
  // by hand rather than `new Date(s)` to avoid any local-timezone date-shift
  // risk around midnight that ambiguous string parsing can introduce.
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    return `${us[3]}-${us[1]!.padStart(2, "0")}-${us[2]!.padStart(2, "0")}`;
  }

  return null;
}

/** Generic CSV/XLSX exports from LinkedIn/Twitter don't always include a
 * stable per-row identifier. When no URL-like column exists, synthesize one
 * from the row's own content so re-uploading identical data upserts in
 * place instead of duplicating (same spirit as the old client's
 * JSON-stringify-based array dedup). */
export function syntheticRowKey(row: Record<string, unknown>): string {
  return `csv:${createHash("sha256").update(JSON.stringify(row)).digest("hex").slice(0, 16)}`;
}
