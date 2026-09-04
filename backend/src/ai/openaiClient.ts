import 'dotenv/config';
import OpenAI from 'openai';

/**
 * Model for every agent. Swap here if the team standardises on another.
 *
 * Kept identical to `ai-layer/ai_layer.py` and `ai-layer/news_agent.py` so both
 * halves of the project speak to the same model. If this string is rejected,
 * change it in those three places.
 */
export const MODEL = 'gpt-5.6';

let client: OpenAI | null = null;

/**
 * The OpenAI client, constructed on first use.
 *
 * Deliberately lazy: `new OpenAI()` throws immediately when `OPENAI_API_KEY` is
 * unset, so constructing at module load would stop the whole server booting on
 * a machine without a key. Building it here keeps the server up and lets the
 * AI routes answer 503 instead.
 */
export function openaiClient(): OpenAI {
  if (!client) {
    assertAiConfigured();
    client = new OpenAI();
  }
  return client;
}

export function aiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function assertAiConfigured(): void {
  if (!aiConfigured()) throw new Error('OPENAI_API_KEY is not set');
}
