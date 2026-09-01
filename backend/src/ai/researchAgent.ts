import type { Source } from './types.js';
import { fetchNews } from '../news/newsService.js';

/**
 * STUB. Collects and de-duplicates sources for a question.
 * Later: expand the query, pull from several providers, dedupe by URL/title,
 * drop low-signal items.
 */
export async function research(question: string): Promise<Source[]> {
  const raw = await fetchNews(question);
  const seen = new Set<string>();
  return raw.filter((s) => {
    const key = s.url || s.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
