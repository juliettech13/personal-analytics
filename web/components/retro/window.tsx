import { cn } from "@/lib/utils";

export function Window({
  label,
  tag,
  children,
  bodyClassName,
  className,
}: {
  label: string;
  tag?: string;
  children: React.ReactNode;
  bodyClassName?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-3 overflow-hidden rounded-[7px] border-2 border-foreground bg-card shadow-[4px_4px_0_rgba(0,0,0,0.28)]",
        className,
      )}
    >
      <div className="flex min-h-[24px] items-center gap-1.5 bg-gradient-to-b from-[#585858] to-chrome-dark px-2 py-1">
        <div className="flex gap-1">
          <span className="h-[11px] w-[11px] rounded-full border border-black/30 bg-[#FF5F57]" />
          <span className="h-[11px] w-[11px] rounded-full border border-black/30 bg-[#FEBC2E]" />
          <span className="h-[11px] w-[11px] rounded-full border border-black/30 bg-[#28C840]" />
        </div>
        <div className="flex-1 text-center font-retro-mono text-[11px] font-semibold tracking-wide text-white uppercase">
          {label}
        </div>
        {tag && (
          <span className="rounded-xs bg-white/10 px-1.5 py-0.5 font-retro-mono text-[8px] tracking-wide text-neutral-300">
            {tag}
          </span>
        )}
      </div>
      <div className={cn("p-3", bodyClassName)}>{children}</div>
    </div>
  );
}
