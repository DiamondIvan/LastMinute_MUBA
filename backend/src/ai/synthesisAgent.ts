import { z } from 'zod';
import { gonkaChatJson, gonkaConfigured } from './gonka.js';
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
  'a note on sources if any were provided (omit the section entirely if none were),',
  'and an explicit "This is not financial advice" line.',
  'Respond with a JSON object: { "title": "...", "summary": "...", "full": "..." }',
].join(' ');

/**
 * Pipeline: research -> credibility filter -> analysis -> synthesis, all on
 * Gonka. Up to four calls. `summary` is the free teaser, `full` is what a
 * ResearchAccess unlocks. Every step degrades to demo data without a key.
 *
 * The research stage has no live web grounding (Gonka has no search tool),
 * so `sources` is typically empty end to end - an accepted tradeoff, not a
 * bug. See researchAgent.ts.
 */
export async function generateIntelligenceReport(question: string): Promise<IntelligenceReport> {
  const { findings, sources: rawSources } = await research(question);
  const sources = await assessCredibility(rawSources);
  const analysis = await analyze(question, findings, sources);

  let title = `Intelligence: ${question}`.slice(0, 120);
  let summary = findings.split('\n').slice(0, 6).join('\n');
  const sourcesBlock =
    sources.length > 0
      ? `\n\nSources:\n${sources.map((s) => `- ${s.publisher}: ${s.title} (${s.url})`).join('\n')}`
      : '';
  let full = `${findings}${sourcesBlock}\n\nThis is not financial advice.`;

  if (gonkaConfigured()) {
    const raw = await gonkaChatJson<z.infer<typeof Schema>>({
      system: SYSTEM,
      user: JSON.stringify({
        question,
        findings,
        analysis,
        sources: sources.map((s) => ({ title: s.title, url: s.url, publisher: s.publisher })),
      }),
    });
    try {
      if (!raw) throw new Error('no parseable JSON');
      const parsed = Schema.parse(raw);
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
