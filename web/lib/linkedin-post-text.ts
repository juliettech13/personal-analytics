// LinkedIn's export has no post-text column at all -- only the URL. Its own
// URLs are self-titling though: /posts/{author}_{slugified-post-opening}-{ugcPost|share|activity}-{id}-{suffix}.
// Deriving a readable snippet from that slug is the only local way to tell
// posts apart (for display) or classify them (for tagging) without a new
// API integration. Shared between the LinkedIn tab's UI and the tagging
// pipeline so both derive the same text the same way.
export function extractPostSnippet(url: string): string {
  const match = url.match(/\/posts\/([^/?]+)/);
  if (!match) return "";
  let slug = match[1]!;
  const underscoreIdx = slug.indexOf("_");
  if (underscoreIdx >= 0) slug = slug.slice(underscoreIdx + 1);
  slug = slug.replace(/-(ugcPost|activity|share)-[\w-]+$/i, "");
  const words = slug.split("-").filter(Boolean);
  if (!words.length) return "";
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
