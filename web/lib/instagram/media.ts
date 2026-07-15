import { put } from "@vercel/blob";

/**
 * Instagram's CDN URLs are signed and expire. Rather than store the
 * ephemeral URL directly, download the image once per sync and re-host it
 * in Vercel Blob under a stable path -- same path every time, so this is
 * an overwrite, not an ever-growing pile of orphaned files. The Blob URL
 * never expires, so images stay visible even for a post that later falls
 * out of the "most recent 20" sync window.
 */
export async function mirrorImageToBlob(sourceUrl: string, path: string): Promise<string> {
  if (!sourceUrl) return "";
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) return "";
    const bytes = await res.arrayBuffer();
    const blob = await put(path, Buffer.from(bytes), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: res.headers.get("content-type") ?? "image/jpeg",
    });
    return blob.url;
  } catch (err) {
    console.warn(`  ⚠ failed to mirror image to blob (${path}): ${err}`);
    return "";
  }
}
