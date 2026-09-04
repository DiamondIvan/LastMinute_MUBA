import axios from 'axios';
import { getCachedStablecoinMarket } from './marketData.js';
import { getCachedStablecoinHistory } from './stablecoinHistory.js';

/**
 * Prices for everything the paper-trading ledger can hold: the tracked Sui
 * stablecoins plus SUI itself.
 *
 * SUI needs a separate source. `stablecoinHistory.ts` uses DefiLlama's
 * stablecoin-specific endpoint, which by definition doesn't cover SUI, and
 * `lib/deepbook.ts` (frontend) only ever gives a *current* mid price, no
 * history. DefiLlama's coins API covers both, and keeping it in the same
 * provider family as the rest of the market data means entry price,
 * valuation, and history all agree with each other — which matters, because
 * a P&L computed across two disagreeing price sources is just wrong. (For
 * reference, DeepBook's SUI mid and DefiLlama's SUI spot sat ~0.7% apart when
 * this was written; that gap would show up as phantom P&L if mixed.)
 */

const LLAMA_COINS = 'https://coins.llama.fi';
const SUI_COIN_KEY = 'coingecko:sui';
const TIMEOUT_MS = 15_000;

export interface PricePoint {
  time: string;
  price: number;
}

function formatDay(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---- SUI ---------------------------------------------------------------

let suiPriceCache: { at: number; price: number } | null = null;
const SUI_PRICE_TTL_MS = 60_000;

/** Current SUI price in USD. Returns null on failure — callers must not invent one. */
export async function fetchSuiPrice(): Promise<number | null> {
  if (suiPriceCache && Date.now() - suiPriceCache.at < SUI_PRICE_TTL_MS) return suiPriceCache.price;
  try {
    const res = await axios.get(`${LLAMA_COINS}/prices/current/${SUI_COIN_KEY}`, { timeout: TIMEOUT_MS });
    const price = res.data?.coins?.[SUI_COIN_KEY]?.price;
    if (typeof price !== 'number' || price <= 0) return null;
    suiPriceCache = { at: Date.now(), price };
    return price;
  } catch (err) {
    console.warn('[tradeableAssets] SUI price fetch failed:', (err as Error).message);
    return null;
  }
}

let suiHistoryCache: { at: number; points: PricePoint[] } | null = null;
const SUI_HISTORY_TTL_MS = 30 * 60 * 1000;

/** Daily SUI price history (~30 days). Empty array on failure. */
export async function fetchSuiHistory(): Promise<PricePoint[]> {
  if (suiHistoryCache && Date.now() - suiHistoryCache.at < SUI_HISTORY_TTL_MS) return suiHistoryCache.points;
  try {
    const res = await axios.get(`${LLAMA_COINS}/chart/${SUI_COIN_KEY}`, {
      params: { span: 30, period: '1d' },
      timeout: TIMEOUT_MS,
    });
    const raw: { timestamp: number; price: number }[] = res.data?.coins?.[SUI_COIN_KEY]?.prices ?? [];
    const points = raw
      .filter((p) => typeof p.price === 'number' && p.price > 0)
      .map((p) => ({ time: formatDay(p.timestamp), price: Number(p.price.toFixed(4)) }));
    suiHistoryCache = { at: Date.now(), points };
    return points;
  } catch (err) {
    console.warn('[tradeableAssets] SUI history fetch failed:', (err as Error).message);
    return [];
  }
}

// ---- Unified view ------------------------------------------------------

/** Symbols the paper ledger accepts. SUI first — it's the one with real movement. */
export const TRADEABLE_SYMBOLS = ['SUI', 'USDC', 'USDsui', 'FDUSD', 'BUCK'] as const;
export type TradeableSymbol = (typeof TRADEABLE_SYMBOLS)[number];

export function isTradeableSymbol(s: string): s is TradeableSymbol {
  return (TRADEABLE_SYMBOLS as readonly string[]).includes(s);
}

/**
 * Current USD price for every tradeable symbol. A symbol whose price could not
 * be fetched is omitted entirely rather than defaulted — a paper trade priced
 * off a made-up number is worse than one that refuses to open.
 */
export async function getTradeablePrices(): Promise<Partial<Record<TradeableSymbol, number>>> {
  const [sui, market] = await Promise.all([fetchSuiPrice(), getCachedStablecoinMarket()]);

  const out: Partial<Record<TradeableSymbol, number>> = {};
  if (sui !== null) out.SUI = sui;
  for (const coin of market) {
    if (isTradeableSymbol(coin.symbol) && coin.price !== null && coin.price > 0) {
      out[coin.symbol] = coin.price;
    }
  }
  return out;
}

/** ~30 days of daily history per tradeable symbol, for charting a position. */
export async function getTradeableHistory(): Promise<Partial<Record<TradeableSymbol, PricePoint[]>>> {
  const [suiPoints, stableHistory] = await Promise.all([fetchSuiHistory(), getCachedStablecoinHistory()]);

  const out: Partial<Record<TradeableSymbol, PricePoint[]>> = {};
  if (suiPoints.length > 0) out.SUI = suiPoints;
  for (const [symbol, frames] of Object.entries(stableHistory)) {
    if (isTradeableSymbol(symbol)) out[symbol] = frames['30D'] ?? [];
  }
  return out;
}
