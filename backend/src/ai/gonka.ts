import 'dotenv/config';
import type { CoinMarketData } from '../scraper/marketData.js';
import { summariseForAi } from '../scraper/marketData.js';
import type { FeedItem } from '../scraper/cryptoFeeds.js';

/**
 * Gonka-powered narration for the daily crypto forecast.
 *
 * Gonka is an OpenAI-wire-compatible chat-completions provider, so this is a
 * plain `fetch` client — no SDK, same approach as `orClient.ts`.
 *
 * Two things about Gonka drive the design here:
 *
 * 1. **Base URL and model id are broker-specific.** Gonka is accessed through
 *    a broker/gateway, each with its own host and its own (case-sensitive)
 *    model catalogue, so neither can be hardcoded — both are env vars.
 * 2. **It has no hosted web-search tool.** That's fine for this job: the model
 *    never searches, it only writes over data we scraped ourselves and pass in
 *    as context. Grounded-search work must stay on a provider that supports it.
 *
 * With `GONKA_API_KEY` unset, every function returns clearly-labelled demo text
 * derived from the real numbers, matching the fallback convention used by
 * `orClient.ts` and `openrouter.ts` so the app runs with no key configured.
 */

/** Broker gateway root, including `/v1`. Override per broker. */
const DEFAULT_BASE_URL = 'https://api.gonkarouter.io/v1';

/**
 * Model ids are case-sensitive and vary per broker; this is the id used in
 * Gonka's own quickstart. Override with GONKA_MODEL to match your broker's
 * catalogue.
 */
const DEFAULT_MODEL = 'MiniMaxAI/MiniMax-M2.7';

export function gonkaConfigured(): boolean {
  return Boolean(process.env.GONKA_API_KEY);
}

function baseUrl(): string {
  return (process.env.GONKA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

export function gonkaModel(): string {
  return process.env.GONKA_MODEL || DEFAULT_MODEL;
}

export class GonkaError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(`Gonka ${status}: ${message.slice(0, 300)}`);
  }
}

interface ChatOpts {
  system?: string;
  user: string;
  /** Ask for a JSON object back. Not every broker/model honours this. */
  json?: boolean;
}

/** One Gonka chat call. Throws on a non-2xx response. */
export async function gonkaChat(opts: ChatOpts): Promise<string> {
  if (!gonkaConfigured()) throw new Error('GONKA_API_KEY is not set');

  const messages: { role: string; content: string }[] = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: opts.user });

  const body: Record<string, unknown> = { model: gonkaModel(), messages };
  if (opts.json) body.response_format = { type: 'json_object' };

  const res = await fetch(`${baseUrl()}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GONKA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new GonkaError(res.status, detail || res.statusText);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return (data.choices?.[0]?.message?.content ?? '').trim();
}

/**
 * Parse a JSON object out of a model response, tolerating ``` fences and a
 * reasoning model's inline chain-of-thought.
 *
 * MiniMax-M2.7 (GonkaRouter's default model) puts its reasoning directly in
 * `message.content` as `<think>...</think>` — verified live, the `reasoning`
 * field it also exposes stays null. The thinking text routinely echoes the
 * system prompt's JSON schema example back to itself, so a naive
 * first-`{`-to-last-`}` slice can capture a `{` from inside the schema
 * quoted mid-reasoning rather than the real answer. Stripping every
 * `<think>` block first removes that failure mode.
 */
function parseJsonLoose<T>(text: string): T | null {
  let s = text.trim();
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  }
  // Some models prepend a sentence before the object.
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start > 0 && end > start) s = s.slice(start, end + 1);
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

/** One Gonka chat call, parsed as JSON. Returns null if the response wasn't parseable JSON. */
export async function gonkaChatJson<T>(opts: ChatOpts): Promise<T | null> {
  const text = await gonkaChat({ ...opts, json: true });
  return parseJsonLoose<T>(text);
}

export interface CoinNarrative {
  symbol: string;
  narrative: string;
  watchItems: string[];
}

export interface DailyNarrative {
  /** One-line "today's weather" summary. */
  headline: string;
  /** Plain-English market outlook paragraph. */
  outlook: string;
  perCoin: CoinNarrative[];
  whatChanged: string[];
  generatedBy: 'gonka' | 'demo';
  model?: string;
}

const SYSTEM = [
  'You are a crypto market analyst writing a daily stablecoin briefing for a',
  'non-technical reader who holds these assets on the Sui blockchain.',
  '',
  'You are given (a) already-computed quantitative data — price, deviation from',
  'the $1 peg in basis points, circulating supply on Sui — and (b) recent news',
  'headlines already collected for you.',
  '',
  'Rules:',
  '- Explain what the numbers MEAN in plain English. "USDC sits 1bp under peg"',
  '  is not useful on its own; say whether that is normal and why it matters.',
  '- Use ONLY the data provided. Never invent prices, events, dates or sources.',
  '  If the data is thin, say so plainly.',
  '- Coins marked peg_status "Yield-Bearing" are SUPPOSED to trade above $1.00;',
  '  never describe those as depegged.',
  '- Give the reader the context to make their own decision. Do NOT tell them to',
  '  buy, sell, or hold, and do NOT suggest allocation percentages or amounts.',
  '- Be concise and concrete. No hype, no filler.',
  '',
  'Respond ONLY with valid JSON matching this schema, no other text:',
  '{',
  '  "headline": "one sentence summarising the day",',
  '  "outlook": "2-4 sentence plain-English market overview",',
  '  "perCoin": [{"symbol": "...", "narrative": "2-3 sentences", "watchItems": ["..."]}],',
  '  "whatChanged": ["notable movement or development", "..."]',
  '}',
].join('\n');

interface NarrateInput {
  market: CoinMarketData[];
  news: FeedItem[];
  /** Symbols the reader has on their wishlist; narrate these specifically. */
  coins: string[];
}

/**
 * Turns the day's scraped numbers + headlines into readable narrative.
 * Falls back to deterministic demo text when no key is configured.
 */
export async function narrateDailyForecast(input: NarrateInput): Promise<DailyNarrative> {
  const { market, news, coins } = input;
  if (!gonkaConfigured()) return demoNarrative(market, news, coins);

  const payload = {
    date: new Date().toISOString().slice(0, 10),
    coins_of_interest: coins,
    market_data: summariseForAi(market),
    recent_headlines: news.slice(0, 25).map((n) => ({
      title: n.title,
      source: n.sourceName,
      published_at: n.publishedAt,
      concerns: n.coins,
    })),
  };

  const user = [
    'Write today\'s stablecoin briefing from this data.',
    coins.length > 0
      ? `Cover these coins specifically in "perCoin": ${coins.join(', ')}.`
      : 'Cover the largest coins by circulating supply in "perCoin".',
    '',
    JSON.stringify(payload, null, 2),
  ].join('\n');

  try {
    const text = await gonkaChat({ system: SYSTEM, user, json: true });
    const parsed = parseJsonLoose<Partial<DailyNarrative>>(text);

    // A model that ignored the JSON instruction still produced prose worth showing.
    if (!parsed) {
      return {
        headline: 'Daily stablecoin briefing',
        outlook: text || 'The model returned an empty response.',
        perCoin: [],
        whatChanged: [],
        generatedBy: 'gonka',
        model: gonkaModel(),
      };
    }

    return {
      headline: parsed.headline ?? 'Daily stablecoin briefing',
      outlook: parsed.outlook ?? '',
      perCoin: Array.isArray(parsed.perCoin)
        ? parsed.perCoin.map((c) => ({
            symbol: c?.symbol ?? '',
            narrative: c?.narrative ?? '',
            watchItems: Array.isArray(c?.watchItems) ? c.watchItems : [],
          }))
        : [],
      whatChanged: Array.isArray(parsed.whatChanged) ? parsed.whatChanged : [],
      generatedBy: 'gonka',
      model: gonkaModel(),
    };
  } catch (err) {
    console.warn('[gonka] narration failed, serving demo text:', (err as Error).message);
    return demoNarrative(market, news, coins);
  }
}

/**
 * Deterministic stand-in built from the real numbers, so the tab stays useful
 * (and honest) with no API key. Every string is prefixed so it can never be
 * mistaken for model output.
 */
function demoNarrative(market: CoinMarketData[], news: FeedItem[], coins: string[]): DailyNarrative {
  const tag = '[demo — set GONKA_API_KEY for AI narration]';
  const wanted = coins.length > 0 ? market.filter((m) => coins.includes(m.symbol)) : market.slice(0, 5);

  const offPeg = market.filter((m) => m.pegStatus === 'Minor Stress' || m.pegStatus === 'High Risk');
  const totalSupply = market.reduce((s, m) => s + m.circulatingUsd, 0);

  return {
    headline:
      `${tag} ${market.length} stablecoins tracked on Sui, ` +
      `$${(totalSupply / 1_000_000).toFixed(1)}M circulating, ${offPeg.length} off peg.`,
    outlook:
      `${tag} Aggregate stablecoin supply on Sui is about ` +
      `$${(totalSupply / 1_000_000).toFixed(1)}M across ${market.length} assets. ` +
      (offPeg.length === 0
        ? 'Every tracked coin is holding its peg within normal tolerance.'
        : `${offPeg.map((c) => c.symbol).join(', ')} ${offPeg.length === 1 ? 'is' : 'are'} showing measurable peg deviation.`) +
      ` ${news.length} relevant headlines were collected today.`,
    perCoin: wanted.map((c) => ({
      symbol: c.symbol,
      narrative:
        `${tag} ${c.symbol} is priced at $${c.price?.toFixed(4) ?? 'n/a'} with ` +
        `$${(c.circulatingUsd / 1_000_000).toFixed(1)}M circulating on Sui. ` +
        (c.pegStatus === 'Yield-Bearing'
          ? 'This is a yield-bearing asset, so trading above $1.00 is expected behaviour rather than a depeg.'
          : `Peg status is ${c.pegStatus.toLowerCase()}${c.pegDeviationBps !== null ? ` at ${c.pegDeviationBps}bps from $1.00` : ''}.`),
      watchItems: news
        .filter((n) => n.coins.includes(c.symbol))
        .slice(0, 3)
        .map((n) => n.title),
    })),
    whatChanged: offPeg.map(
      (c) => `${c.symbol} is ${c.pegDeviationBps}bps from $1.00 (${c.pegStatus.toLowerCase()})`,
    ),
    generatedBy: 'demo',
  };
}
