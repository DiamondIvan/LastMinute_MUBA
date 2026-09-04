import type { Response as OpenAIResponse } from 'openai/resources/responses/responses';
import { openaiClient, MODEL } from './openaiClient.js';
import type { ResearchResult, Source } from './types.js';

const SYSTEM = [
  'You are a financial and crypto news research agent.',
  'Use web search to gather recent, reputable information on the question.',
  'Then write a tight, factual briefing: what happened, when, who said it, and the numbers.',
  'Prefer primary sources and major outlets. No hype, no predictions, no investment advice.',
].join(' ');

/**
 * Runs a real web search and returns a written briefing plus the sources found.
 * One Responses API call with the hosted `web_search` tool.
 *
 * Sources come from the `url_citation` annotations the model attaches to its
 * output text, so they are the pages it actually cited rather than everything
 * the search happened to surface.
 */
export async function research(question: string): Promise<ResearchResult> {
  const response = await openaiClient().responses.create({
    model: MODEL,
    instructions: SYSTEM,
    tools: [{ type: 'web_search' }],
    input: `Research this question:\n\n${question}`,
  });

  return {
    findings: (response.output_text ?? '').trim(),
    sources: extractSources(response),
  };
}

function extractSources(response: OpenAIResponse): Source[] {
  const out: Source[] = [];
  const seen = new Set<string>();

  for (const item of response.output ?? []) {
    if (item.type !== 'message') continue;
    for (const block of item.content ?? []) {
      if (block.type !== 'output_text') continue;
      for (const ann of block.annotations ?? []) {
        if (ann.type !== 'url_citation' || !ann.url || seen.has(ann.url)) continue;
        seen.add(ann.url);
        out.push({
          title: ann.title || ann.url,
          url: ann.url,
          publisher: hostOf(ann.url),
          snippet: '',
        });
      }
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
