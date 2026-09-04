import { gonkaChatJson, gonkaConfigured, gonkaModel } from './gonka.js';
import { fetchDailyFeeds } from '../scraper/cryptoFeeds.js';
import { getCachedStablecoinMarket } from '../scraper/marketData.js';
import { getTradeablePrices, getTradeableHistory, TRADEABLE_SYMBOLS } from '../scraper/tradeableAssets.js';

/**
 * Daily per-asset market signals, written by Gonka over data this backend
 * already collected (headlines, live prices, real price history).
 *
 * What this deliberately is NOT: buy/sell direction or position sizing.
 * docs/SECURITY.md's stated line — followed everywhere else in this codebase —
 * is that AI output supplies context and the user decides. There's a practical
 * reason too, observed live: MiniMax-M2.7 safety-refuses prompts shaped like
 * investment advice, and its refusal is *valid JSON* ({"error": "..."}), so a
 * naive caller reads it as success and renders nothing. Asking for a
 * descriptive signal instead of a recommendation both respects the policy and
 * avoids tripping the refusal path.
 *
 * Signals are generated at most once a day and read from cache — never on the
 * request path of a user action. Gonka latency was measured between 2s and
 * 137s on identical call shapes, with occasional 502s.
 */

export type SignalKind = 'strengthening' | 'stable' | 'weakening' | 'watch';

const VALID_SIGNALS: SignalKind[] = ['strengthening', 'stable', 'weakening', 'watch'];

export interface AssetSignal {
  symbol: string;
  signal: SignalKind;
  rationale: string;
  watchItems: string[];
}

export interface SignalsSnapshot {
  date: string;
  generatedAt: string;
  signals: AssetSignal[];
  /** How many headlines the model was given. Lets the UI show provenance. */
  headlineCount: number;
  generatedBy: 'gonka' | 'demo';
  model?: string;
}

const SYSTEM = [
  'You are a market analyst producing short, factual daily signals on crypto',
  'assets held on the Sui blockchain, for a non-technical reader.',
  '',
  'You are given already-computed data: current prices, deviation from the $1',
  'peg where applicable, circulating supply on Sui, recent price history, and',
  'recent news headlines. You have no other information and no live lookup.',
  '',
  'For each asset, classify a "signal":',
  '  "strengthening" - the supplied data points to improving conditions',
  '  "stable"        - conditions look steady and unremarkable',
  '  "weakening"     - the supplied data points to deteriorating conditions',
  '  "watch"         - something specific warrants attention, or data is thin',
  '',
  'Rules:',
  '- This is descriptive market commentary, NOT financial advice. Do NOT tell',
  '  the reader to buy, sell or hold, and do NOT suggest position sizes or',
  '  allocation percentages. Describe what the data shows and why it matters.',
  '- Use ONLY the supplied data. Never invent prices, events, dates or sources.',
  '  If the data is thin for an asset, say so and use "watch".',
  '- Assets marked peg_status "Yield-Bearing" are SUPPOSED to trade above',
  '  $1.00; never describe those as depegged.',
  '- SUI is a volatile asset, not a stablecoin - do not assess it against a',
  '  $1 peg.',
  '- Be concrete and cite the actual numbers you were given. Two sentences max.',
  '',
  'Respond ONLY with valid JSON matching this schema, no other text:',
  '{',
  '  "signals": [',
  '    {"symbol": "...", "signal": "strengthening|stable|weakening|watch",',
  '     "rationale": "1-2 sentences citing the supplied numbers",',
  '     "watchItems": ["what would change this read"]}',
  '  ]',
  '}',
].join('\n');

function periodChangePct(points: { price: number }[]): number | null {
  if (points.length < 2) return null;
  const first = points[0]!.price;
  const last = points[points.length - 1]!.price;
  if (first === 0) return null;
  return Number((((last - first) / first) * 100).toFixed(2));
}

/**
 * Deterministic stand-in built from the real numbers, used when Gonka is
 * unconfigured or the call fails/refuses. Every rationale is prefixed so it
 * can never be mistaken for model output.
 */
function demoSignals(
  prices: Partial<Record<string, number>>,
  changes: Record<string, number | null>,
  headlineCount: number,
): SignalsSnapshot {
  const tag = '[demo — set GONKA_API_KEY for AI signals]';
  return {
    date: new Date().toISOString().slice(0, 10),
    generatedAt: new Date().toISOString(),
    headlineCount,
    generatedBy: 'demo',
    signals: TRADEABLE_SYMBOLS.filter((s) => prices[s] !== undefined).map((symbol) => {
      const change = changes[symbol];
      const signal: SignalKind =
        change === null || change === undefined ? 'watch' : change > 2 ? 'strengthening' : change < -2 ? 'weakening' : 'stable';
      return {
        symbol,
        signal,
        rationale:
          `${tag} ${symbol} is priced at $${prices[symbol]?.toFixed(4)}` +
          (change === null || change === undefined ? ' with no usable history.' : ` and moved ${change}% over the last 30 days.`),
        watchItems: [],
      };
    }),
  };
}

/** One Gonka call covering every tradeable asset. */
async function generateSignals(): Promise<SignalsSnapshot> {
  const [prices, history, market, feeds] = await Promise.all([
    getTradeablePrices(),
    getTradeableHistory(),
    getCachedStablecoinMarket(),
    fetchDailyFeeds(),
  ]);

  const changes: Record<string, number | null> = {};
  for (const symbol of TRADEABLE_SYMBOLS) {
    changes[symbol] = periodChangePct(history[symbol] ?? []);
  }

  const headlines = feeds.items.slice(0, 25).map((n) => ({
    title: n.title,
    source: n.sourceName,
    published_at: n.publishedAt,
    concerns: n.coins,
  }));

  if (!gonkaConfigured()) return demoSignals(prices, changes, headlines.length);

  const payload = {
    date: new Date().toISOString().slice(0, 10),
    assets: TRADEABLE_SYMBOLS.filter((s) => prices[s] !== undefined).map((symbol) => {
      const coin = market.find((m) => m.symbol === symbol);
      return {
        symbol,
        price_usd: prices[symbol],
        change_30d_pct: changes[symbol],
        peg_status: symbol === 'SUI' ? 'not-a-stablecoin' : (coin?.pegStatus ?? null),
        peg_deviation_bps: symbol === 'SUI' ? null : (coin?.pegDeviationBps ?? null),
        circulating_on_sui_usd: symbol === 'SUI' ? null : Math.round(coin?.circulatingUsd ?? 0),
      };
    }),
    recent_headlines: headlines,
  };

  try {
    const parsed = await gonkaChatJson<{ signals?: AssetSignal[] }>({
      system: SYSTEM,
      user: `Produce today's signals from this data.\n\n${JSON.stringify(payload, null, 2)}`,
    });

    // A refusal parses as valid JSON — check the payload actually arrived.
    if (!parsed?.signals?.length) {
      throw new Error('model returned no usable signals (parse failure or refusal)');
    }

    const signals: AssetSignal[] = parsed.signals
      .filter((s) => s?.symbol && (TRADEABLE_SYMBOLS as readonly string[]).includes(s.symbol))
      .map((s) => ({
        symbol: s.symbol,
        signal: VALID_SIGNALS.includes(s.signal) ? s.signal : 'watch',
        rationale: typeof s.rationale === 'string' ? s.rationale : '',
        watchItems: Array.isArray(s.watchItems) ? s.watchItems.filter((w) => typeof w === 'string') : [],
      }))
      .filter((s) => s.rationale.length > 0);

    if (signals.length === 0) throw new Error('model returned signals but none were usable');

    return {
      date: new Date().toISOString().slice(0, 10),
      generatedAt: new Date().toISOString(),
      signals,
      headlineCount: headlines.length,
      generatedBy: 'gonka',
      model: gonkaModel(),
    };
  } catch (err) {
    console.warn('[tradingSignals] generation failed, serving demo signals:', (err as Error).message);
    return demoSignals(prices, changes, headlines.length);
  }
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let cached: { at: number; data: SignalsSnapshot } | null = null;

export async function getCachedSignals(forceRefresh = false): Promise<SignalsSnapshot> {
  if (!forceRefresh && cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;
  const data = await generateSignals();
  cached = { at: Date.now(), data };
  return data;
}

/** The signal currently attached to a symbol, for stamping onto a new position. */
export async function signalForSymbol(symbol: string): Promise<string | null> {
  try {
    const snapshot = await getCachedSignals();
    return snapshot.signals.find((s) => s.symbol === symbol)?.signal ?? null;
  } catch {
    return null;
  }
}
