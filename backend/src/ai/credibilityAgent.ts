import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { anthropic, MODEL } from './claude.js';
import type { Source } from './types.js';

const Schema = z.object({
  assessments: z.array(
    z.object({
      url: z.string(),
      credibility: z.number(), // 0..1
      reason: z.string(),
    }),
  ),
});

const MIN_CREDIBILITY = 0.35;

/**
 * Scores each source 0..1 for credibility, drops the weak ones, sorts best-first.
 * One structured Claude call.
 */
export async function assessCredibility(sources: Source[]): Promise<Source[]> {
  if (sources.length === 0) return sources;

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    system:
      'Rate each source 0..1 for credibility on this topic: outlet reputation, primary vs. aggregator, ' +
      'recency, and evident bias. Be strict. Return one assessment per input url.',
    messages: [
      {
        role: 'user',
        content: JSON.stringify(
          sources.map((s) => ({ url: s.url, title: s.title, publisher: s.publisher })),
        ),
      },
    ],
    output_config: { format: zodOutputFormat(Schema) },
  });

  const byUrl = new Map((response.parsed_output?.assessments ?? []).map((a) => [a.url, a.credibility]));

  return sources
    .map((s) => ({ ...s, credibility: byUrl.get(s.url) ?? 0.5 }))
    .filter((s) => (s.credibility ?? 0) >= MIN_CREDIBILITY)
    .sort((a, b) => (b.credibility ?? 0) - (a.credibility ?? 0));
}
