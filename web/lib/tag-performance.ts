/** Groups content by tag for "performance by tag" comparisons. A post with
 * multiple tags contributes to every one of its tags' groups (not just the
 * first) -- that's the whole point of allowing multiple tags per post.
 * Untagged content (not yet classified, or classification found nothing
 * worth tagging) groups under "untagged" rather than silently vanishing
 * from the comparison. */
export function groupByTag<T>(items: T[], getTags: (item: T) => string[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const tags = getTags(item);
    const effectiveTags = tags.length ? tags : ["untagged"];
    for (const tag of effectiveTags) {
      if (!groups.has(tag)) groups.set(tag, []);
      groups.get(tag)!.push(item);
    }
  }
  return groups;
}
