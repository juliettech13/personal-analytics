import * as XLSX from "xlsx";

function splitCSVLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (c === "," && !inQ) {
      fields.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  fields.push(cur);
  return fields;
}

export function parseCSV(text: string): Record<string, string>[] {
  const clean = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = clean.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = splitCSVLine(lines[0]!).map((h) =>
    h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
  );
  return lines
    .slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const vals = splitCSVLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        let v = (vals[i] ?? "").trim();
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
        row[h] = v;
      });
      return row;
    });
}

export interface NativeLinkedInParsed {
  period: string;
  totalImpressions: number;
  membersReached: number;
  totalFollowers: number;
  newFollowers: number;
  dailyEngagement: Array<{ date: string; impressions: number; engagements: number }>;
  topByImpressions: Array<{ url: string; date: string; impressions: number }>;
  topByEngagements: Array<{ url: string; date: string; engagements: number }>;
  demographics: Array<{ category: string; value: string; pct: string }>;
}

export function parseLinkedInXLSX(wb: XLSX.WorkBook): NativeLinkedInParsed {
  function sheetRows(name: string): unknown[][] {
    const ws = wb.Sheets[name];
    if (!ws) return [];
    return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false }) as unknown[][];
  }
  function n(v: unknown): number {
    return Number(String(v).replace(/[^0-9.]/g, "")) || 0;
  }

  const d: NativeLinkedInParsed = {
    period: "",
    totalImpressions: 0,
    membersReached: 0,
    totalFollowers: 0,
    newFollowers: 0,
    dailyEngagement: [],
    topByImpressions: [],
    topByEngagements: [],
    demographics: [],
  };

  for (const row of sheetRows("DISCOVERY")) {
    const k = String(row[0]).toLowerCase();
    if (k.includes("impression")) d.totalImpressions = n(row[1]);
    else if (k.includes("member") || k.includes("reach")) d.membersReached = n(row[1]);
    if (row[1] && String(row[1]).includes("-")) d.period = String(row[1]).trim();
  }

  const engRows = sheetRows("ENGAGEMENT");
  for (const row of engRows.slice(1)) {
    const date = String(row[0]).trim();
    if (!date || date.toLowerCase() === "date") continue;
    d.dailyEngagement.push({ date, impressions: n(row[1]), engagements: n(row[2]) });
  }

  const postRows = sheetRows("TOP POSTS");
  for (const row of postRows.slice(2)) {
    if (row[4]) d.topByImpressions.push({ url: String(row[4]).trim(), date: String(row[5]).trim(), impressions: n(row[6]) });
    if (row[0]) d.topByEngagements.push({ url: String(row[0]).trim(), date: String(row[1]).trim(), engagements: n(row[2]) });
  }

  let inDaily = false;
  for (const row of sheetRows("FOLLOWERS")) {
    const k = String(row[0]).toLowerCase();
    if (k.includes("total follower")) d.totalFollowers = n(row[1]);
    if (k === "date") {
      inDaily = true;
      continue;
    }
    if (inDaily && row[0]) d.newFollowers += n(row[1]);
  }

  for (const row of sheetRows("DEMOGRAPHICS").slice(1)) {
    if (row[0] && row[1]) {
      d.demographics.push({ category: String(row[0]).trim(), value: String(row[1]).trim(), pct: String(row[2] ?? "").trim() });
    }
  }

  return d;
}

export function xlsxToRows(wb: XLSX.WorkBook): Record<string, string>[] {
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const ws = wb.Sheets[sheetName];
  const all = XLSX.utils.sheet_to_json(ws!, { header: 1, defval: "", raw: false }) as unknown[][];
  let headerIdx = 0;
  for (let i = 0; i < Math.min(all.length, 15); i++) {
    if ((all[i] ?? []).filter((c) => String(c).trim()).length >= 4) {
      headerIdx = i;
      break;
    }
  }
  const headerRow = all[headerIdx] ?? [];
  const headers = headerRow.map((h) =>
    String(h).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
  );
  return all
    .slice(headerIdx + 1)
    .filter((row) => row.some((c) => String(c).trim()))
    .map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = String(row[i] ?? "").trim();
      });
      return obj;
    });
}

export type ParsedUploadData = NativeLinkedInParsed | Record<string, string>[];

export async function parseUploadFile(
  platform: "linkedin" | "twitter",
  file: File,
): Promise<ParsedUploadData> {
  const isXLSX = /\.xlsx?$/i.test(file.name);

  if (isXLSX) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: "array", raw: false });
    const isLinkedInNative = wb.SheetNames.some((n) => n === "TOP POSTS" || n === "ENGAGEMENT");
    return platform === "linkedin" && isLinkedInNative ? parseLinkedInXLSX(wb) : xlsxToRows(wb);
  }

  const text = await file.text();
  return parseCSV(text);
}
