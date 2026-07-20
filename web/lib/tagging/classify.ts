/**
 * Content-category tagging via Claude (Vercel AI Gateway) -- same model/
 * auth as app/api/recommendations/route.ts. Uses generateObject + a zod
 * schema rather than generateText, so the result is a validated array
 * every time instead of something to regex out of free-form prose.
 */

import { generateObject } from "ai";
import { z } from "zod";

export const SEED_TAGS = ["investors", "ai", "tech", "sale", "lifestyle", "travel"];

const MODEL = "anthropic/claude-sonnet-4.6";

const ResultSchema = z.object({
  tags: z.array(z.string().min(1).max(30)).min(1).max(4),
});

/** `existingTags` is the full set already in use across every content
 * table -- passed in so the model reuses "tech" instead of inventing
 * "technology", per the ask to bundle related content together rather than
 * let the tag vocabulary sprawl. Only a genuinely new category (nothing
 * existing fits) should produce a tag outside that set. */
export async function classifyContent(text: string, existingTags: string[]): Promise<string[]> {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const vocabulary = [...new Set([...SEED_TAGS, ...existingTags])].sort();

  const { object } = await generateObject({
    model: MODEL,
    schema: ResultSchema,
    prompt: `Categorize this piece of content with 1-4 short topic tags.

Seed tags (prefer these when relevant): ${SEED_TAGS.join(", ")}
Tags already in use elsewhere (reuse one of these over inventing a near-duplicate, e.g. "tech" not "technology"): ${vocabulary.join(", ")}

Only introduce a brand new tag if none of the above genuinely fit. Tags should be short, lowercase, single words or short hyphenated phrases (e.g. "ai", "investors", "sale").

Content:
"""
${trimmed.slice(0, 2000)}
"""`,
  });

  // Normalize casing/whitespace so "AI" and "ai" don't become two tags.
  return [...new Set(object.tags.map((t) => t.trim().toLowerCase()))];
}
