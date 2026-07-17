"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { refreshAllData } from "@/lib/refresh-client";

const TABS = [
  { key: "ig", label: "📸 Instagram" },
  { key: "newsletter", label: "✉️ Newsletter" },
  { key: "linkedin", label: "💼 LinkedIn" },
  { key: "twitter", label: "𝕏 Twitter/X" },
] as const;

export type TabKey = (typeof TABS)[number]["key"];

export function Dock({
  activeTab,
  onTabChange,
}: {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}) {
  const [syncing, setSyncing] = useState(false);

  async function handleRefresh() {
    setSyncing(true);
    try {
      const result = await refreshAllData();
      if (!result.ok) {
        toast.error(result.error ?? "Sync error");
        setSyncing(false);
        return;
      }
      toast.success("Synced — reloading…");
      setTimeout(() => location.reload(), 1200);
    } catch {
      toast.error("Network error");
      setSyncing(false);
    }
  }

  return (
    <div className="fixed bottom-2.5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-border/90 bg-[#F5F0EB]/85 px-3.5 py-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.18)] backdrop-blur-sm">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={cn(
            "rounded-md border px-2.5 py-1 font-retro-mono text-[10px] transition-all",
            activeTab === tab.key
              ? "border-chrome-dark bg-chrome-dark text-retro-gold"
              : "border-[#bbb] bg-white text-neutral-700 hover:border-chrome-dark hover:bg-chrome-dark hover:text-retro-gold",
          )}
        >
          {tab.label}
        </button>
      ))}
      <button
        onClick={handleRefresh}
        disabled={syncing}
        className="rounded-md border border-[#bbb] bg-white px-2.5 py-1 font-retro-mono text-[10px] text-neutral-700 transition-all hover:border-chrome-dark hover:bg-chrome-dark hover:text-retro-gold disabled:opacity-50"
      >
        {syncing ? "⏳ syncing…" : "↺ Refresh"}
      </button>
    </div>
  );
}
