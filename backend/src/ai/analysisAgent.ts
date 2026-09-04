import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { openaiClient, MODEL } from './openaiClient.js';
import type { Analysis, Source } from './types.js';

const Schema = z.object({
  sentiment: z.enum(['bullish', 'bearish', 'neutral', 'mixed']),
  confidence: z.number(), // 0..1, calibrated
  risk: z.enum(['low', 'medium', 'high']),
  keyDevelopments: z.array(z.string()),
  risks: z.array(z.string()),
});

const INSTRUCTIONS = [
  'You are a market-intelligence analyst. From the briefing only, extract: overall sentiment,',
  'a calibrated confidence (0..1), overall risk, the key developments, and the main risks.',
  'Do not invent facts not in the briefing. No investment advice.',
].join(' ');

/**
 * Turns the research briefing into structured sentiment / confidence / risk /
 * key points. Grounded strictly in the briefing.
 */
export async function analyze(
  question: string,
  findings: string,
  sources: Source[],
): Promise<Analysis> {
  const sourceList = sources.map((s) => `- ${s.publisher}: ${s.title}`).join('\n');
  const input = [
    `Question: ${question}`,
    '',
    'Briefing:',
    findings,
    '',
    'Sources:',
    sourceList,
  ].join('\n');

  const response = await openaiClient().responses.parse({
    model: MODEL,
    instructions: INSTRUCTIONS,
    input,
    text: { format: zodTextFormat(Schema, 'analysis') },
  });

  if (!response.output_parsed) {
    throw new Error('analysis: model did not return structured output');
  }
  return response.output_parsed;
}
