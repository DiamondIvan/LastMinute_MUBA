import Anthropic from '@anthropic-ai/sdk';
import { anthropic, MODEL } from './claude.js';
import type { ResearchResult, Source } from './types.js';

const SYSTEM = [
  'You are a financial and crypto news research agent.',
  'Use web search to gather recent, reputable information on the question.',
  'Then write a tight, factual briefing: what happened, when, who said it, and the numbers.',
  'Prefer primary sources and major outlets. No hype, no predictions, no investment advice.',
].join(' ');

/**
 * Runs a real web search and returns a written briefing plus the sources found.
 * One Claude call with the server-side web_search tool.
 */
export async function research(question: string): Promise<ResearchResult> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: SYSTEM,
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }],
    messages: [{ role: 'user', content: `Research this question:\n\n${question}` }],
  });

  const findings = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  return { findings, sources: extractSources(response.content) };
}

function extractSources(content: Anthropic.ContentBlock[]): Source[] {
  const out: Source[] = [];
  const seen = new Set<string>();

  for (const block of content) {
    if (block.type !== 'web_search_tool_result') continue;
    if (!Array.isArray(block.content)) continue; // error object, not results
    for (const r of block.content) {
      if (!r.url || seen.has(r.url)) continue;
      seen.add(r.url);
      out.push({
        title: r.title || r.url,
        url: r.url,
        publisher: hostOf(r.url),
        publishedAt: r.page_age ?? undefined,
        snippet: '',
      });
    }
  }
  return out;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
