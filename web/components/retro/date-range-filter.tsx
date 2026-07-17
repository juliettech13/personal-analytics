"use client";

import { cn } from "@/lib/utils";
import { DATE_RANGE_PRESETS, matchesPreset, presetToRange, type DateRange } from "@/lib/date-range";

function toInputValue(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export function DateRangeFilter({ range, onChange }: { range: DateRange; onChange: (r: DateRange) => void }) {
  function setStart(value: string) {
    onChange({ ...range, start: value ? new Date(`${value}T00:00:00.000Z`) : null });
  }
  function setEnd(value: string) {
    // Inclusive of the whole selected day, not just its midnight instant.
    onChange({ ...range, end: value ? new Date(`${value}T23:59:59.999Z`) : null });
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-sm border border-border bg-white px-2.5 py-1.5">
      <span className="text-[9px] tracking-wide text-neutral-400 uppercase">🗓 Range</span>
      <div className="flex gap-1">
        {DATE_RANGE_PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => onChange(presetToRange(p.days))}
            className={cn(
              "rounded-xs border px-2 py-0.5 font-retro-mono text-[10px] transition-colors",
              matchesPreset(range, p.days)
                ? "border-chrome-dark bg-chrome-dark text-retro-gold"
                : "border-border bg-white text-neutral-600 hover:border-chrome-dark",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <span className="text-neutral-300">|</span>
      <label className="flex items-center gap-1 text-[10px] text-neutral-500">
        From
        <input
          type="date"
          value={toInputValue(range.start)}
          onChange={(e) => setStart(e.target.value)}
          className="rounded-xs border border-border bg-white px-1 py-0.5 font-retro-mono text-[10px]"
        />
      </label>
      <label className="flex items-center gap-1 text-[10px] text-neutral-500">
        To
        <input
          type="date"
          value={toInputValue(range.end)}
          onChange={(e) => setEnd(e.target.value)}
          className="rounded-xs border border-border bg-white px-1 py-0.5 font-retro-mono text-[10px]"
        />
      </label>
    </div>
  );
}
