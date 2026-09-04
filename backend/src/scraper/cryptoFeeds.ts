import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Daily multi-source news collection for the Latest Forecast tab.
 *
 * RSS-first by deliberate design. Probing the six requested sites showed that
 * theblock.co, defillama.com and bloomberg.com/crypto all answer **403** to a
 * plain HTML GET (Cloudflare / anti-bot), while their RSS endpoints answer 200
 * with clean, structured headlines. Parsing a feed is also far less brittle
 * than the "read every <a> tag" heuristic in `stablecoinScraper.ts`, which
 * mostly picks up nav chrome.
 *
 * Only circle.com has no working feed, so it stays on HTML — but scoped to
 * heading elements rather than every anchor.
 *
 * Every source is independently try/caught: one dead site must never kill the
 * daily run. `fetchDailyFeeds` reports per-source outcomes so the UI (and a
 * demo) can show what was actually live.
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const TIMEOUT_MS = 12_000;

interface SourceDef {
  name: string;
  url: string;
  mode: 'rss' | 'html';
  /** Public page a reader should land on, when the feed url isn't browsable. */
  siteUrl: string;
}

const SOURCES: SourceDef[] = [
  { name: 'The Block', url: 'https://www.theblock.co/rss.xml', mode: 'rss', siteUrl: 'https://www.theblock.co/' },
  { name: 'Chainalysis', url: 'https://www.chainalysis.com/feed/', mode: 'rss', siteUrl: 'https://www.chainalysis.com/blog/' },
  { name: 'Bloomberg Crypto', url: 'https://feeds.bloomberg.com/crypto/news.rss', mode: 'rss', siteUrl: 'https://www.bloomberg.com/crypto' },
  { name: 'Tether', url: 'https://tether.io/feed/', mode: 'rss', siteUrl: 'https://tether.io/blog/' },
  { name: 'Circle', url: 'https://www.circle.com/blog', mode: 'html', siteUrl: 'https://www.circle.com/blog' },
];

/** Symbols the product tracks, with the words that imply them in a headline. */
const COIN_KEYWORDS: Record<string, string[]> = {
  USDC: ['usdc', 'usd coin', 'circle'],
  USDsui: ['usdsui', 'usd sui', 'sui dollar'],
  FDUSD: ['fdusd', 'first digital'],
  BUCK: ['buck', 'bucket protocol'],
  USDY: ['usdy', 'ondo'],
  AUSD: ['ausd', 'agora'],
};

export const TRACKED_SYMBOLS = Object.keys(COIN_KEYWORDS);

/** Broader market terms — used to keep genuinely relevant non-coin-specific news. */
const MARKET_KEYWORDS = [
  'stablecoin', 'depeg', 'peg', 'tether', 'usdt', 'reserve', 'attestation',
  'regulat', 'sec ', 'treasury', 'liquidity', 'yield', 'sui', 'custody', 'audit',
];

export interface FeedItem {
  /** Hostname, e.g. "theblock.co" — matches the shape the existing UI expects. */
  source: string;
  sourceName: string;
  title: string;
  link: string;
  publishedAt: string | null;
  /** Tracked symbols this headline appears to concern. May be empty. */
  coins: string[];
}

export interface SourceReport {
  name: string;
  url: string;
  mode: 'rss' | 'html';
  ok: boolean;
  items: number;
  note?: string;
}

export interface DailyFeedResult {
  items: FeedItem[];
  sources: SourceReport[];
  /** True when every source failed and the canned set was substituted. */
  usedFallback: boolean;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Word-boundary match so "buck" doesn't fire on "bucks" or "Starbucks". */
function mentions(haystack: string, needle: string): boolean {
  if (needle.includes(' ')) return haystack.includes(needle);
  return new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(haystack);
}

function tagCoins(title: string): string[] {
  const lower = title.toLowerCase();
  return Object.entries(COIN_KEYWORDS)
    .filter(([, words]) => words.some((w) => mentions(lower, w)))
    .map(([symbol]) => symbol);
}

/**
 * Nav chrome and calls-to-action that survive the heading filter on HTML pages
 * ("subscribe to the Circle newsletter" is an <h3> that mentions Circle).
 */
const JUNK_PATTERNS = [
  /subscribe/i,
  /newsletter/i,
  /sign\s?up/i,
  /contact (us|sales)/i,
  /learn more/i,
  /get started/i,
  /read more/i,
  /privacy policy/i,
  /cookie/i,
  /all rights reserved/i,
];

function isJunk(title: string): boolean {
  return JUNK_PATTERNS.some((p) => p.test(title));
}

function isRelevant(title: string, coins: string[]): boolean {
  if (isJunk(title)) return false;
  if (coins.length > 0) return true;
  const lower = title.toLowerCase();
  return MARKET_KEYWORDS.some((k) => lower.includes(k));
}

async function fetchRss(src: SourceDef): Promise<FeedItem[]> {
  const res = await axios.get(src.url, {
    headers: { 'User-Agent': UA, Accept: 'application/rss+xml,application/xml,text/xml,*/*' },
    timeout: TIMEOUT_MS,
  });
  const body = typeof res.data === 'string' ? res.data : String(res.data);
  const $ = cheerio.load(body, { xmlMode: true });

  const items: FeedItem[] = [];
  $('item, entry').each((_, el) => {
    const node = $(el);
    const title = node.find('title').first().text().trim().replace(/\s+/g, ' ');
    if (!title) return;

    // RSS puts the url in <link> text; Atom puts it in a href attribute.
    const linkEl = node.find('link').first();
    const link = (linkEl.text().trim() || linkEl.attr('href') || src.siteUrl).trim();

    const rawDate =
      node.find('pubDate').first().text().trim() ||
      node.find('published').first().text().trim() ||
      node.find('updated').first().text().trim();
    const parsed = rawDate ? new Date(rawDate) : null;

    const coins = tagCoins(title);
    items.push({
      source: hostOf(src.siteUrl),
      sourceName: src.name,
      title,
      link,
      publishedAt: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null,
      coins,
    });
  });
  return items;
}

async function fetchHtml(src: SourceDef): Promise<FeedItem[]> {
  const res = await axios.get(src.url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    timeout: TIMEOUT_MS,
  });
  const html = typeof res.data === 'string' ? res.data : '';
  const $ = cheerio.load(html);

  const items: FeedItem[] = [];
  $('h2, h3').each((_, el) => {
    const node = $(el);
    const title = node.text().trim().replace(/\s+/g, ' ');
    // Headings shorter than this are section labels ("Company", "Developers").
    if (title.length < 20 || title.length > 200) return;

    const href =
      node.closest('a').attr('href') ||
      node.find('a').first().attr('href') ||
      node.parent().find('a').first().attr('href') ||
      '';

    let link = src.siteUrl;
    if (href) {
      try {
        link = new URL(href, src.siteUrl).toString();
      } catch {
        /* keep the site url */
      }
    }

    items.push({
      source: hostOf(src.siteUrl),
      sourceName: src.name,
      title,
      link,
      publishedAt: null,
      coins: tagCoins(title),
    });
  });
  return items;
}

/**
 * Canned items, used only when every single source fails (offline demo). Clearly
 * labelled so nobody mistakes them for live reporting — the existing
 * `stablecoinScraper.ts` fallback presents fake headlines as real, which is a
 * credibility risk in front of judges.
 */
function fallbackItems(): FeedItem[] {
  const note = '[demo data — live sources unreachable]';
  return [
    {
      source: 'circle.com',
      sourceName: 'Circle',
      title: `${note} USDC circulating supply on Sui continues to lead stablecoin liquidity`,
      link: 'https://www.circle.com/blog',
      publishedAt: null,
      coins: ['USDC'],
    },
    {
      source: 'theblock.co',
      sourceName: 'The Block',
      title: `${note} Stablecoin regulation remains the sector's dominant policy story`,
      link: 'https://www.theblock.co/',
      publishedAt: null,
      coins: [],
    },
  ];
}

/**
 * Runs every source once. Intended to be called at most daily — the caller owns
 * caching (see `db/newsCache.ts`).
 */
export async function fetchDailyFeeds(): Promise<DailyFeedResult> {
  const sources: SourceReport[] = [];
  const collected: FeedItem[] = [];

  // Sequential rather than parallel: this runs once a day, and hitting five
  // sites at once from one IP is exactly what trips rate limiting.
  for (const src of SOURCES) {
    try {
      const raw = src.mode === 'rss' ? await fetchRss(src) : await fetchHtml(src);
      const relevant = raw.filter((i) => isRelevant(i.title, i.coins));
      collected.push(...relevant);
      sources.push({
        name: src.name,
        url: src.url,
        mode: src.mode,
        ok: true,
        items: relevant.length,
        note: raw.length > 0 && relevant.length === 0 ? 'fetched, but nothing crypto-relevant today' : undefined,
      });
    } catch (err) {
      const e = err as { response?: { status?: number }; message?: string };
      const status = e.response?.status;
      sources.push({
        name: src.name,
        url: src.url,
        mode: src.mode,
        ok: false,
        items: 0,
        note: status ? `HTTP ${status}` : (e.message ?? 'request failed'),
      });
      console.warn(`[cryptoFeeds] ${src.name} failed:`, status ?? e.message);
    }
  }

  // Dedupe on normalized title (Bloomberg and The Block often carry the same wire story).
  const seen = new Set<string>();
  const deduped = collected.filter((i) => {
    const key = i.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Coin-specific news first, then newest.
  deduped.sort((a, b) => {
    if (a.coins.length !== b.coins.length) return b.coins.length - a.coins.length;
    return (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '');
  });

  if (deduped.length === 0) {
    return { items: fallbackItems(), sources, usedFallback: true };
  }
  return { items: deduped.slice(0, 40), sources, usedFallback: false };
}
