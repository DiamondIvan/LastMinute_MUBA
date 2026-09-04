import { chat, aiConfigured } from './orClient.js';
import type { ResearchResult, Source } from './types.js';

const SYSTEM = [
  'You are a financial and crypto news research agent.',
  'Use the web search results to gather recent, reputable information on the question.',
  'Then write a tight, factual briefing: what happened, when, who said it, and the numbers.',
  'Prefer primary sources and major outlets. No hype, no predictions, no investment advice.',
].join(' ');

/**
 * Runs a web-grounded search and returns a written briefing plus the sources
 * cited. One OpenRouter call with the `web` plugin.
 *
 * With no `OPENROUTER_API_KEY`, returns a canned briefing so the rest of the
 * pipeline (and the demo) still works.
 */
export async function research(question: string): Promise<ResearchResult> {
  if (!aiConfigured()) return cannedResearch(question);

  const { text, citations } = await chat({
    system: SYSTEM,
    user: `Research this question and cite your sources:\n\n${question}`,
    web: true,
  });

  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const c of citations) {
    if (!c.url || seen.has(c.url)) continue;
    seen.add(c.url);
    sources.push({ title: c.title || c.url, url: c.url, publisher: hostOf(c.url), snippet: '' });
  }

  return { findings: text, sources };
}

function cannedResearch(question: string): ResearchResult {
  return {
    findings:
      `[[demo data - set OPENROUTER_API_KEY for live research]]\n\n` +
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

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
