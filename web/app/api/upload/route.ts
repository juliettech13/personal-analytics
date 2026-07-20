import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { uploadAttempts } from "@/lib/db/schema";
import { isNativeLinkedInData, upsertLinkedInNative, upsertLinkedInGenericRows } from "@/lib/db/queries/linkedin";
import { upsertTwitterRows } from "@/lib/db/queries/twitter";
import { tagUntaggedContent } from "@/lib/tagging/tag-content";

// No password field anymore -- this route is already behind proxy.ts's
// whole-dashboard session gate, so reaching this handler at all implies an
// authenticated session. Replaces api/upload.js's GitHub Contents API
// merge-and-commit logic with Postgres upserts.
export async function POST(req: NextRequest) {
  const db = getDb();
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  let platform: string | undefined;
  try {
    const body = await req.json();
    platform = body?.platform;
    const data = body?.data;

    if (!platform || data == null) {
      return Response.json({ error: "Missing platform or data" }, { status: 400 });
    }

    let rowCount: number;
    if (platform === "linkedin") {
      if (isNativeLinkedInData(data)) {
        rowCount = await upsertLinkedInNative(data);
      } else if (Array.isArray(data)) {
        rowCount = await upsertLinkedInGenericRows(data);
      } else {
        throw new Error("Unrecognized LinkedIn data shape");
      }
    } else if (platform === "twitter") {
      if (!Array.isArray(data)) throw new Error("Expected an array of tweet rows");
      rowCount = await upsertTwitterRows(data);
    } else {
      return Response.json({ error: `Unknown platform: ${platform}` }, { status: 400 });
    }

    await db.insert(uploadAttempts).values({ platform, succeeded: true, rowCount, ip });

    // Best-effort: tag whatever's newly untagged now that the upload landed --
    // a tagging failure shouldn't make an otherwise-successful upload report
    // as failed, untagged rows just get picked up next time.
    try {
      await tagUntaggedContent();
    } catch (err) {
      console.warn(`  ⚠ (optional) post-upload tagging failed: ${err}`);
    }

    return Response.json({ ok: true, total: rowCount });
  } catch (err) {
    await db.insert(uploadAttempts).values({
      platform: platform ?? "unknown",
      succeeded: false,
      ip,
      errorMessage: String(err),
    });
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
