import { z } from 'zod';
import { gonkaChatJson, gonkaConfigured } from './gonka.js';
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
 * With no key, passes everything through unranked. In practice `sources` is
 * usually empty now — researchAgent.ts stopped attaching sources once the
 * pipeline lost web grounding — so this mostly short-circuits on length 0.
 */
export async function assessCredibility(sources: Source[]): Promise<Source[]> {
  if (sources.length === 0 || !gonkaConfigured()) return sources;

  const system =
    'Rate each source 0..1 for credibility on this topic: outlet reputation, primary vs. ' +
    'aggregator, recency, and evident bias. Be strict. Return one assessment per input url. ' +
    'Respond with a JSON object: { "assessments": [ { "url", "credibility", "reason" } ] }';

  const parsed = await gonkaChatJson<z.infer<typeof Schema>>({
    system,
    user: JSON.stringify(sources.map((s) => ({ url: s.url, title: s.title, publisher: s.publisher }))),
  });

  let byUrl = new Map<string, number>();
  try {
    if (!parsed) throw new Error('no parseable JSON');
    const validated = Schema.parse(parsed);
    byUrl = new Map(validated.assessments.map((a) => [a.url, a.credibility]));
  } catch {
    return sources; // model returned something unparseable — don't drop sources
  }

  return sources
    .map((s) => ({ ...s, credibility: byUrl.get(s.url) ?? 0.5 }))
    .filter((s) => (s.credibility ?? 0) >= MIN_CREDIBILITY)
    .sort((a, b) => (b.credibility ?? 0) - (a.credibility ?? 0));
}
