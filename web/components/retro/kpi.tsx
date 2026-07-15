import { cn } from "@/lib/utils";

const ACCENT_CLASS = {
  r: "text-reel",
  f: "text-feed",
  g: "text-retro-teal",
  o: "text-retro-gold",
  p: "text-retro-purple",
  t: "text-retro-teal",
} as const;

export function KpiRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

export function Kpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: keyof typeof ACCENT_CLASS;
}) {
  return (
    <div className="min-w-20 flex-1 rounded-sm border border-border bg-white p-2.5 text-center">
      <div className="mb-0.5 font-retro-mono text-[10px] font-medium tracking-wide text-neutral-500 uppercase">
        {label}
      </div>
      <div
        className={cn(
          "font-pixel text-[30px] leading-none text-foreground",
          accent && ACCENT_CLASS[accent],
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[10px] text-neutral-400">{sub}</div>}
    </div>
  );
}
