import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { syncRuns, uploadAttempts } from "@/lib/db/schema";
import { Window } from "@/components/retro/window";

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const db = getDb();
  const [runs, uploads] = await Promise.all([
    db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(10),
    db.select().from(uploadAttempts).orderBy(desc(uploadAttempts.attemptedAt)).limit(10),
  ]);

  return (
    <div className="min-h-screen p-6">
      <Window label="📊 Recent Instagram Sync Runs">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="p-1.5 text-left text-[10px] text-neutral-500 uppercase">Started</th>
              <th className="p-1.5 text-left text-[10px] text-neutral-500 uppercase">Status</th>
              <th className="p-1.5 text-right text-[10px] text-neutral-500 uppercase">Posts</th>
              <th className="p-1.5 text-right text-[10px] text-neutral-500 uppercase">Stories</th>
              <th className="p-1.5 text-left text-[10px] text-neutral-500 uppercase">Error</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="even:[&>td]:bg-secondary">
                <td className="border-t border-border p-1.5">{r.startedAt.toISOString()}</td>
                <td className={`border-t border-border p-1.5 ${r.status === "ok" ? "text-retro-teal" : "text-destructive"}`}>
                  {r.status}
                </td>
                <td className="border-t border-border p-1.5 text-right">{r.postsSynced ?? "—"}</td>
                <td className="border-t border-border p-1.5 text-right">{r.storiesSynced ?? "—"}</td>
                <td className="border-t border-border p-1.5 text-[10px] text-neutral-500">{r.errorMessage ?? ""}</td>
              </tr>
            ))}
            {runs.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-neutral-400">
                  No sync runs yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Window>

      <Window label="📤 Recent Upload Attempts">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="p-1.5 text-left text-[10px] text-neutral-500 uppercase">Time</th>
              <th className="p-1.5 text-left text-[10px] text-neutral-500 uppercase">Platform</th>
              <th className="p-1.5 text-left text-[10px] text-neutral-500 uppercase">Result</th>
              <th className="p-1.5 text-right text-[10px] text-neutral-500 uppercase">Rows</th>
              <th className="p-1.5 text-left text-[10px] text-neutral-500 uppercase">Error</th>
            </tr>
          </thead>
          <tbody>
            {uploads.map((u) => (
              <tr key={u.id} className="even:[&>td]:bg-secondary">
                <td className="border-t border-border p-1.5">{u.attemptedAt.toISOString()}</td>
                <td className="border-t border-border p-1.5">{u.platform}</td>
                <td className={`border-t border-border p-1.5 ${u.succeeded ? "text-retro-teal" : "text-destructive"}`}>
                  {u.succeeded ? "ok" : "failed"}
                </td>
                <td className="border-t border-border p-1.5 text-right">{u.rowCount ?? "—"}</td>
                <td className="border-t border-border p-1.5 text-[10px] text-neutral-500">{u.errorMessage ?? ""}</td>
              </tr>
            ))}
            {uploads.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-neutral-400">
                  No upload attempts yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Window>
    </div>
  );
}
