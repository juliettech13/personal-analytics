import { getTagColor } from "@/lib/tag-colors";

// Content-category tags (e.g. "investors", "ai", "tech") -- each tag gets a
// deterministic color (shared with the tag pie charts) so a color becomes a
// recognizable shorthand for a category across the whole UI.
export function TagBadges({ tags }: { tags: string[] }) {
  if (!tags.length) return <span className="text-neutral-300">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => {
        const color = getTagColor(tag);
        return (
          <span
            key={tag}
            className="inline-block rounded-xs border px-1.5 py-0.5 text-[9px] tracking-wide uppercase"
            style={{ color, borderColor: color, backgroundColor: `${color}1a` }}
          >
            {tag}
          </span>
        );
      })}
    </div>
  );
}
