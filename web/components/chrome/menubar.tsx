"use client";

import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { refreshAllData } from "@/lib/refresh-client";
import type { TabKey } from "./dock";

const VIEW_ITEMS: Array<{ key: TabKey; label: string }> = [
  { key: "ig", label: "📸 Instagram" },
  { key: "newsletter", label: "✉️ Newsletter" },
  { key: "linkedin", label: "💼 LinkedIn" },
  { key: "twitter", label: "𝕏 Twitter/X" },
];

export function Menubar({
  activeTab,
  onTabChange,
  lastUpdatedText,
}: {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  lastUpdatedText: string;
}) {
  async function triggerSync() {
    try {
      const result = await refreshAllData();
      if (result.ok) {
        toast.success("Sync triggered — reloading in a moment");
        setTimeout(() => location.reload(), 1200);
      } else {
        toast.error(result.error ?? "Sync error");
      }
    } catch {
      toast.error("Network error");
    }
  }

  return (
    <div className="fixed top-0 right-0 left-0 z-[999] flex h-6 items-center gap-4 border-b border-[#bbb] bg-gradient-to-b from-[#F8F4EE] to-[#E8E2D8] px-2.5 text-xs">
      <span className="font-retro-serif text-sm tracking-wide">nerd_splash</span>
      <div className="flex gap-0.5 font-retro-mono text-neutral-800">
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded px-2 py-0.5 hover:bg-chrome-dark hover:text-white data-[state=open]:bg-chrome-dark data-[state=open]:text-white">
            File
          </DropdownMenuTrigger>
          <DropdownMenuContent className="font-retro-mono text-[11px]">
            <DropdownMenuItem onClick={() => window.print()}>🖨 Print</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="rounded px-2 py-0.5 hover:bg-chrome-dark hover:text-white data-[state=open]:bg-chrome-dark data-[state=open]:text-white">
            View
          </DropdownMenuTrigger>
          <DropdownMenuContent className="font-retro-mono text-[11px]">
            {VIEW_ITEMS.map((item) => (
              <DropdownMenuItem
                key={item.key}
                onClick={() => onTabChange(item.key)}
                className={item.key === activeTab ? "font-bold text-retro-gold" : undefined}
              >
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="rounded px-2 py-0.5 hover:bg-chrome-dark hover:text-white data-[state=open]:bg-chrome-dark data-[state=open]:text-white">
            Data
          </DropdownMenuTrigger>
          <DropdownMenuContent className="font-retro-mono text-[11px]">
            <DropdownMenuItem onClick={triggerSync}>↺ Sync now</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/admin/status">📊 Sync status</a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="rounded px-2 py-0.5 hover:bg-chrome-dark hover:text-white data-[state=open]:bg-chrome-dark data-[state=open]:text-white">
            Help
          </DropdownMenuTrigger>
          <DropdownMenuContent className="font-retro-mono text-[11px]">
            <DropdownMenuItem asChild>
              <a href="https://github.com/juliettech13/personal-analytics" target="_blank" rel="noreferrer">
                ↗ View source
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="ml-auto flex items-center gap-2.5 text-neutral-600">
        <span className="inline-block h-1.5 w-1.5 animate-[blink_2.5s_ease-in-out_infinite] rounded-full bg-[#2CB840] shadow-[0_0_5px_#2CB840]" />
        <span>{lastUpdatedText}</span>
      </div>
    </div>
  );
}
