import type { IntelligenceReport } from './types.js';
import { research } from './researchAgent.js';
import { assessCredibility } from './credibilityAgent.js';
import { analyze } from './analysisAgent.js';

/**
 * Orchestrates the pipeline: research -> credibility -> analysis -> synthesis.
 * The `summary` is the free teaser; `full` is what a ResearchAccess unlocks.
 * STUB synthesis — replace the string building with an LLM synthesis call.
 */
export async function generateIntelligenceReport(question: string): Promise<IntelligenceReport> {
  const sources = await assessCredibility(await research(question));
  const analysis = await analyze(question, sources);

  const title = `Intelligence: ${question}`.slice(0, 120);

  const summary = [
    `${title}`,
    `Sentiment: ${analysis.sentiment} (confidence ${(analysis.confidence * 100).toFixed(0)}%)`,
    `Risk: ${analysis.risk}`,
    `Top signals:`,
    ...analysis.keyDevelopments.map((k) => `- ${k}`),
  ].join('\n');

  const full = [
    summary,
    '',
    'Risks:',
    ...analysis.risks.map((r) => `- ${r}`),
    '',
    'Sources:',
    ...sources.map((s) => `- ${s.publisher}: ${s.title} (${s.url})`),
    '',
    'AI conclusion: (stub) implement synthesisAgent with a real model call.',
  ].join('\n');

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
