import { z } from 'zod';
import { chat, parseJson, aiConfigured } from './orClient.js';
import type { IntelligenceReport } from './types.js';
import { research } from './researchAgent.js';
import { assessCredibility } from './credibilityAgent.js';
import { analyze } from './analysisAgent.js';

const Schema = z.object({
  title: z.string(),
  summary: z.string(), // free teaser
  full: z.string(), // premium body
});

const SYSTEM = [
  'You write the final intelligence report from the provided briefing and analysis only.',
  '`summary`: a free teaser, at most 6 short lines - headline take, sentiment, confidence,',
  '2-3 bullet signals, and a closing line that the full report is locked.',
  '`full`: the complete report - executive take, key developments, risks, what to watch,',
  'a source list, and an explicit "This is not financial advice" line.',
  'Respond with a JSON object: { "title": "...", "summary": "...", "full": "..." }',
].join(' ');

/**
 * Pipeline: research (web) -> credibility filter -> analysis -> synthesis.
 * Up to four OpenRouter calls. `summary` is the free teaser, `full` is what a
 * ResearchAccess unlocks. Every step degrades to demo data without a key.
 */
export async function generateIntelligenceReport(question: string): Promise<IntelligenceReport> {
  const { findings, sources: rawSources } = await research(question);
  const sources = await assessCredibility(rawSources);
  const analysis = await analyze(question, findings, sources);

  let title = `Intelligence: ${question}`.slice(0, 120);
  let summary = findings.split('\n').slice(0, 6).join('\n');
  let full = `${findings}\n\nSources:\n${sources.map((s) => `- ${s.publisher}: ${s.title} (${s.url})`).join('\n')}\n\nThis is not financial advice.`;

  if (aiConfigured()) {
    const { text } = await chat({
      system: SYSTEM,
      user: JSON.stringify({
        question,
        findings,
        analysis,
        sources: sources.map((s) => ({ title: s.title, url: s.url, publisher: s.publisher })),
      }),
      json: true,
    });
    try {
      const parsed = Schema.parse(parseJson(text));
      title = parsed.title;
      summary = parsed.summary;
      full = parsed.full;
    } catch {
      // keep the mechanically-built strings above
    }
  }

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
