import { cn } from "@/lib/utils";

const VARIANT_CLASS = {
  good: "bg-[#E8F8EE] border-[#3A8C60] text-[#1A5C38]",
  warn: "bg-[#FFF4E0] border-[#C87820] text-[#7A4800]",
  info: "bg-[#E8EEFF] border-[#3048A0] text-[#102070]",
  hot: "bg-[#FFE8E8] border-[#C84848] text-[#800020]",
} as const;

export function Pills({ children }: { children: React.ReactNode }) {
  return <div className="mb-2.5 flex flex-wrap gap-1.5">{children}</div>;
}

export function Pill({
  variant,
  children,
}: {
  variant: keyof typeof VARIANT_CLASS;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] tracking-wide",
        VARIANT_CLASS[variant],
      )}
    >
      {children}
    </span>
  );
}
