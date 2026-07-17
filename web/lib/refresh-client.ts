/** Shared by the Dock's "↺ Refresh" button and the Menubar's "Data → Sync
 * now" item -- both trigger the exact same sequence, so it lives in one
 * place rather than being duplicated. Syncs run first so recommendations
 * (last) see the freshly-synced data within the same refresh. */
export async function refreshAllData(): Promise<{ ok: boolean; error?: string }> {
  const syncResults = await Promise.all([
    fetch("/api/cron/instagram", { method: "POST" }),
    fetch("/api/cron/newsletter", { method: "POST" }),
  ]);
  for (const res of syncResults) {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: `Sync error: ${body.error ?? res.status}` };
    }
  }

  const recRes = await fetch("/api/recommendations", { method: "POST" });
  if (!recRes.ok) {
    const body = await recRes.json().catch(() => ({}));
    return { ok: false, error: `Recommendations error: ${body.error ?? recRes.status}` };
  }

  return { ok: true };
}
