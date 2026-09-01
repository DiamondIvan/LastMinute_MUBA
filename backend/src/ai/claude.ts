import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Model for every agent. Swap here if your team standardises on another.
 * (Anthropic's guidance is to default to the most capable model.)
 */
export const MODEL = 'claude-opus-5';

// Reads ANTHROPIC_API_KEY from the environment (loaded from backend/.env by dotenv).
export const anthropic = new Anthropic();

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function assertAiConfigured(): void {
  if (!aiConfigured()) throw new Error('ANTHROPIC_API_KEY is not set');
}
