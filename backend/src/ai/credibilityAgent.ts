import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { openaiClient, MODEL } from './openaiClient.js';
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
 * One structured Responses call.
 */
export async function assessCredibility(sources: Source[]): Promise<Source[]> {
  if (sources.length === 0) return sources;

  const response = await openaiClient().responses.parse({
    model: MODEL,
    instructions:
      'Rate each source 0..1 for credibility on this topic: outlet reputation, primary vs. ' +
      'aggregator, recency, and evident bias. Be strict. Return one assessment per input url.',
    input: JSON.stringify(
      sources.map((s) => ({ url: s.url, title: s.title, publisher: s.publisher })),
    ),
    text: { format: zodTextFormat(Schema, 'credibility_assessments') },
  });

  const byUrl = new Map(
    (response.output_parsed?.assessments ?? []).map((a) => [a.url, a.credibility]),
  );

  return sources
    .map((s) => ({ ...s, credibility: byUrl.get(s.url) ?? 0.5 }))
    .filter((s) => (s.credibility ?? 0) >= MIN_CREDIBILITY)
    .sort((a, b) => (b.credibility ?? 0) - (a.credibility ?? 0));
}
