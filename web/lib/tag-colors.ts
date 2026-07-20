// Retro-toned palette, extending the app's existing --chart-1..5 hues so
// tag colors feel native to the rest of the UI rather than a bolted-on set.
const PALETTE = [
  "#c84860", // retro-reel
  "#3a6890", // retro-feed
  "#c8973a", // retro-gold
  "#3a8c84", // retro-teal
  "#7048a0", // retro-purple
  "#5c6b73", // slate
  "#a08c3a", // olive
  "#a85a72", // mauve
  "#3a7050", // forest
  "#b06a3a", // burnt orange
];

const UNTAGGED_COLOR = "#9c9c9c";

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

// Deterministic per-tag color -- the same tag always renders the same color
// everywhere (badges, pie slices, table swatches) without a shared runtime
// registry, since it's derived purely from the tag string itself.
export function getTagColor(tag: string): string {
  if (tag === "untagged") return UNTAGGED_COLOR;
  return PALETTE[hashString(tag) % PALETTE.length]!;
}

export function getTagColors(tags: string[]): string[] {
  return tags.map(getTagColor);
}
