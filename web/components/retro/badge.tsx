import { cn } from "@/lib/utils";

const TYPE_CLASS: Record<string, string> = {
  REELS: "bg-[#FFE0E8] text-[#9A0030]",
  FEED: "bg-[#DFF0FF] text-[#003070]",
  IMAGE: "bg-[#DFF0FF] text-[#003070]",
  CAROUSEL_ALBUM: "bg-[#E0FFE8] text-[#005020]",
  STORY: "bg-[#FFF3D0] text-[#7A4A00]",
};

export function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-xs px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase",
        TYPE_CLASS[type] ?? "bg-neutral-200 text-neutral-700",
      )}
    >
      {type}
    </span>
  );
}
