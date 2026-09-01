import type { Analysis, Source } from './types.js';

/**
 * STUB. Turns sources into sentiment / confidence / risk / key points.
 * Later: call the LLM with the sources and a structured-output schema.
 */
export async function analyze(question: string, sources: Source[]): Promise<Analysis> {
  return {
    sentiment: 'neutral',
    confidence: 0.5,
    risk: 'medium',
    keyDevelopments: sources.slice(0, 3).map((s) => s.title),
    risks: ['Stubbed analysis — implement analyze() with a real model call.'],
  };
}
