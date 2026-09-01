import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { anthropic, MODEL } from './claude.js';
import type { IntelligenceReport } from './types.js';
import { research } from './researchAgent.js';
import { assessCredibility } from './credibilityAgent.js';
import { analyze } from './analysisAgent.js';

const Schema = z.object({
  title: z.string(),
  summary: z.string(), // free teaser
  full: z.string(), // premium body
});

/**
 * Pipeline: research (web search) -> credibility filter -> analysis -> synthesis.
 * Four Claude calls. `summary` is the free teaser, `full` is what a
 * ResearchAccess unlocks.
 */
export async function generateIntelligenceReport(question: string): Promise<IntelligenceReport> {
  const { findings, sources: rawSources } = await research(question);
  const sources = await assessCredibility(rawSources);
  const analysis = await analyze(question, findings, sources);

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system:
      'You write the final intelligence report from the provided briefing and analysis only.\n' +
      '`summary`: a free teaser, at most 6 short lines — headline take, sentiment, confidence, ' +
      '2-3 bullet signals, and a closing line that the full report is locked.\n' +
      '`full`: the complete report — executive take, key developments, risks, what to watch, ' +
      'a source list, and an explicit "This is not financial advice" line.',
    messages: [
      {
        role: 'user',
        content: JSON.stringify({
          question,
          findings,
          analysis,
          sources: sources.map((s) => ({ title: s.title, url: s.url, publisher: s.publisher })),
        }),
      },
    ],
    output_config: { format: zodOutputFormat(Schema) },
  });

  if (!response.parsed_output) {
    throw new Error('synthesis: model did not return structured output');
  }
  const { title, summary, full } = response.parsed_output;

  return {
    question,
    title,
    summary,
    full,
    analysis,
    sources,
    generatedAt: new Date().toISOString(),
  };
}
