import { gonkaChat, gonkaConfigured } from './gonka.js';
import type { ResearchResult } from './types.js';

/**
 * Gonka has no hosted web-search tool (see gonka.ts's header), so this agent
 * lost live grounding when the pipeline moved off OpenRouter — a deliberate,
 * accepted tradeoff. It's a plain reasoning call now: no real citations exist
 * to return, so `sources` is always empty rather than inventing plausible-
 * looking ones. The prompt is written to make the model say so rather than
 * assert specific "current" facts it cannot actually know.
 */
const SYSTEM = [
  'You are a financial and crypto news research agent.',
  'You do NOT have live web access or a search tool. Write from general',
  'knowledge only.',
  'Do not invent specific recent events, dates, numbers, quotes, or named',
  'sources as if they were verified current facts - you cannot know what is',
  'happening right now. Instead, give grounded background and context on the',
  'topic, and say plainly that you have no live data for anything time-',
  'sensitive.',
  'No hype, no predictions, no investment advice.',
].join(' ');

/**
 * Writes a background briefing on the question. No sources are attached -
 * Gonka cannot ground this in real citations, and returning fabricated ones
 * would be worse than returning none.
 *
 * With no `GONKA_API_KEY`, returns a canned briefing so the rest of the
 * pipeline (and the demo) still works.
 */
export async function research(question: string): Promise<ResearchResult> {
  if (!gonkaConfigured()) return cannedResearch(question);

  const text = await gonkaChat({
    system: SYSTEM,
    user: `Give background and context on this question:\n\n${question}`,
  });

  return { findings: text, sources: [] };
}

function cannedResearch(question: string): ResearchResult {
  return {
    findings:
      `[[demo data - set GONKA_API_KEY for live research]]\n\n` +
      `Briefing for: ${question}\n` +
      `- Market conditions are mixed with elevated volatility.\n` +
      `- Institutional flows have been broadly positive over the past week.\n` +
      `- Regulatory tone has softened in two major jurisdictions.\n` +
      `- Leverage across major venues remains high.`,
    sources: [
      {
        title: 'Reuters - Markets',
        url: 'https://www.reuters.com/markets/',
        publisher: 'reuters.com',
        snippet: '',
      },
      { title: 'CoinDesk', url: 'https://www.coindesk.com/', publisher: 'coindesk.com', snippet: '' },
    ],
  };
}
