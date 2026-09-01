import type { Source } from '../ai/types.js';

/**
 * STUB. Replace with real RSS / news API / search calls.
 * Keep the return shape (`Source[]`) so the agents downstream don't change.
 */
export async function fetchNews(question: string): Promise<Source[]> {
  return [
    {
      title: `Placeholder headline about: ${question}`,
      url: 'https://example.com/article',
      publisher: 'ExampleWire',
      publishedAt: new Date().toISOString(),
      snippet:
        'This is stubbed news content. Wire fetchNews() to real sources (RSS, NewsAPI, a search API) and return the same Source[] shape.',
    },
  ];
}
