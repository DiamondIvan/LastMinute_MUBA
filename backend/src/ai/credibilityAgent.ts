import type { Source } from './types.js';

/**
 * STUB. Scores/filters sources for credibility.
 * Later: reputation lists, cross-source corroboration, recency weighting,
 * an LLM check for obvious low-quality content.
 */
export async function assessCredibility(sources: Source[]): Promise<Source[]> {
  // For now, pass everything through unchanged.
  return sources;
}
