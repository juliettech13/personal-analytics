"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { parseUploadFile } from "@/lib/uploads/parse";
import { cn } from "@/lib/utils";

const PLATFORM_INFO = {
  linkedin: {
    icon: "💼",
    name: "LinkedIn",
    steps: [
      <>
        Go to <strong>linkedin.com</strong> → your profile → <strong>Analytics</strong>
      </>,
      <>
        Click <strong>Post impressions</strong> → top-right <strong>Export</strong>
      </>,
      "Choose a date range and download the CSV",
      "Drop the file below",
    ],
  },
  twitter: {
    icon: "𝕏",
    name: "Twitter / X",
    steps: [
      <>
        Go to <strong>analytics.twitter.com</strong>
      </>,
      <>
        Click <strong>Export data</strong> → <strong>By tweet</strong>
      </>,
      "Select your date range → download CSV",
      "Drop the file below",
    ],
  },
} as const;

export function UploadDialog({ platform }: { platform: "linkedin" | "twitter" }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const info = PLATFORM_INFO[platform];

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const data = await parseUploadFile(platform, file);
      const count = Array.isArray(data) ? data.length : (data.topByImpressions ?? []).length;
      if (!count && !(("totalImpressions" in data) && data.totalImpressions)) {
        toast.warning("No data found — check the file format");
        setBusy(false);
        return;
      }

      toast.loading("Saving…", { id: "upload" });
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, data }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(`Save failed: ${body.error ?? res.status}`, { id: "upload" });
        setBusy(false);
        return;
      }
      const result = await res.json();
      toast.success(`Saved — ${result.total} records stored`, { id: "upload" });
      setOpen(false);

      // Fresh data just landed -- regenerate recommendations now rather than
      // waiting for the next Refresh, so they reflect this upload immediately.
      // Awaited (this takes ~30s, an LLM call) so the reload below actually
      // shows the new recommendation instead of racing ahead of it. A failure
      // here doesn't undo the successful upload above -- just skip the reload
      // delay and let the page reload with whatever recommendation already existed.
      toast.loading("Updating recommendations…", { id: "recommendations" });
      try {
        await fetch("/api/recommendations", { method: "POST" });
        toast.success("Recommendations updated", { id: "recommendations" });
      } catch {
        toast.dismiss("recommendations");
      }

      location.reload();
    } catch (err) {
      toast.error(`Could not parse file — ${err}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="border-chrome-dark bg-chrome-dark font-retro-mono text-[10px] text-retro-gold hover:bg-black">
          ⬆ Upload new export
        </Button>
      </DialogTrigger>
      <DialogContent className="border-2 border-foreground bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-retro-mono text-sm">
            {info.icon} {info.name} — Import Data
          </DialogTitle>
        </DialogHeader>
        <div className="rounded border border-border bg-secondary p-3 text-left text-xs">
          <div className="mb-1.5 font-retro-mono text-[10px] tracking-wide text-neutral-500 uppercase">How to export</div>
          <ol className="list-decimal space-y-1.5 pl-4 text-[11px] text-neutral-600">
            {info.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          className={cn(
            "mx-auto max-w-xs cursor-pointer rounded border-2 border-dashed border-border p-7 text-center font-pixel text-xl text-neutral-400 transition-colors select-none",
            dragOver && "border-foreground bg-secondary text-foreground",
            busy && "pointer-events-none opacity-50",
          )}
        >
          <div>⬛ {busy ? "PROCESSING…" : "DROP CSV or XLSX HERE"}</div>
          <div className="mt-1.5 font-retro-mono text-[11px] text-neutral-400">or click to browse</div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
