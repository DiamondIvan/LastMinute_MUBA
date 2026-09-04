import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { openaiClient, MODEL } from './openaiClient.js';
import type { IntelligenceReport } from './types.js';
import { research } from './researchAgent.js';
import { assessCredibility } from './credibilityAgent.js';
import { analyze } from './analysisAgent.js';

const Schema = z.object({
  title: z.string(),
  summary: z.string(), // free teaser
  full: z.string(), // premium body
});

const INSTRUCTIONS = [
  'You write the final intelligence report from the provided briefing and analysis only.',
  '`summary`: a free teaser, at most 6 short lines - headline take, sentiment, confidence,',
  '2-3 bullet signals, and a closing line that the full report is locked.',
  '`full`: the complete report - executive take, key developments, risks, what to watch,',
  'a source list, and an explicit "This is not financial advice" line.',
].join(' ');

/**
 * Pipeline: research (web search) -> credibility filter -> analysis -> synthesis.
 * Four model calls. `summary` is the free teaser, `full` is what a
 * ResearchAccess unlocks.
 */
export async function generateIntelligenceReport(question: string): Promise<IntelligenceReport> {
  const { findings, sources: rawSources } = await research(question);
  const sources = await assessCredibility(rawSources);
  const analysis = await analyze(question, findings, sources);

  const response = await openaiClient().responses.parse({
    model: MODEL,
    instructions: INSTRUCTIONS,
    input: JSON.stringify({
      question,
      findings,
      analysis,
      sources: sources.map((s) => ({ title: s.title, url: s.url, publisher: s.publisher })),
    }),
    text: { format: zodTextFormat(Schema, 'intelligence_report') },
  });

  if (!response.output_parsed) {
    throw new Error('synthesis: model did not return structured output');
  }
  const { title, summary, full } = response.output_parsed;

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
