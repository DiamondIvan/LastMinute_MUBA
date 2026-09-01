import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { anthropic, MODEL } from './claude.js';
import type { Analysis, Source } from './types.js';

const Schema = z.object({
  sentiment: z.enum(['bullish', 'bearish', 'neutral', 'mixed']),
  confidence: z.number(), // 0..1, calibrated
  risk: z.enum(['low', 'medium', 'high']),
  keyDevelopments: z.array(z.string()),
  risks: z.array(z.string()),
});

/**
 * Turns the research briefing into structured sentiment / confidence / risk / key points.
 * One structured Claude call. Grounded strictly in the briefing.
 */
export async function analyze(
  question: string,
  findings: string,
  sources: Source[],
): Promise<Analysis> {
  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    system:
      'You are a market-intelligence analyst. From the briefing only, extract: overall sentiment, ' +
      'a calibrated confidence (0..1), overall risk, the key developments, and the main risks. ' +
      'Do not invent facts not in the briefing. No investment advice.',
    messages: [
      {
        role: 'user',
        content:
          `Question: ${question}\n\n` +
          `Briefing:\n${findings}\n\n` +
          `Sources:\n${sources.map((s) => `- ${s.publisher}: ${s.title}`).join('\n')}`,
      },
    ],
    output_config: { format: zodOutputFormat(Schema) },
  });

  if (!response.parsed_output) {
    throw new Error('analysis: model did not return structured output');
  }
  return response.parsed_output;
}
