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
  const s = String(value ?? "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** Generic CSV/XLSX exports from LinkedIn/Twitter don't always include a
 * stable per-row identifier. When no URL-like column exists, synthesize one
 * from the row's own content so re-uploading identical data upserts in
 * place instead of duplicating (same spirit as the old client's
 * JSON-stringify-based array dedup). */
export function syntheticRowKey(row: Record<string, unknown>): string {
  return `csv:${createHash("sha256").update(JSON.stringify(row)).digest("hex").slice(0, 16)}`;
}
