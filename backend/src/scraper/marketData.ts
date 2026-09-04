import axios from 'axios';

/**
 * Live quantitative data for the Latest Forecast table.
 *
 * Source is DefiLlama's public stablecoin JSON API — the same endpoint
 * `ai-layer/data_sources.py` already uses, chosen over scraping defillama.com
 * because the HTML page answers 403 to a plain GET while the API answers 200
 * with real per-chain circulating supply and prices.
 *
 * This replaces the hardcoded `FORECAST_ASSETS` array the forecast screen used
 * to render (fake peg status, fake volume, fake APY).
 */

const DEFILLAMA_URL = 'https://stablecoins.llama.fi/stablecoins?includePrices=true';
const TIMEOUT_MS = 15_000;

/** DefiLlama uppercases symbols; map back to the casing the UI uses. */
const SYMBOL_DISPLAY: Record<string, string> = {
  USDC: 'USDC',
  USDT: 'USDT',
  USDSUI: 'USDsui',
  FDUSD: 'FDUSD',
  BUCK: 'BUCK',
  USDY: 'USDY',
  AUSD: 'AUSD',
  SUIUSDE: 'suiUSDe',
};

/**
 * Coins whose price legitimately sits above $1.00 — they accrue yield by
 * design, so measuring them against a $1 peg would wrongly flag them as
 * depegged. `ai-layer/config.py` makes the same distinction.
 */
const YIELD_BEARING = new Set(['USDY']);

export type PegStatus = 'Optimal' | 'Minor Stress' | 'High Risk' | 'Yield-Bearing';

export interface CoinMarketData {
  symbol: string;
  name: string;
  price: number | null;
  /** USD value circulating specifically on Sui. */
  circulatingUsd: number;
  /** Signed deviation from $1.00 in basis points. Null for yield-bearing coins. */
  pegDeviationBps: number | null;
  pegStatus: PegStatus;
  mechanism: string;
  source: 'defillama' | 'unavailable';
}

function classifyPeg(symbol: string, price: number | null): { status: PegStatus; bps: number | null } {
  if (YIELD_BEARING.has(symbol)) return { status: 'Yield-Bearing', bps: null };
  if (price === null || !Number.isFinite(price)) return { status: 'Optimal', bps: null };

  const bps = Math.round((price - 1) * 10_000);
  const abs = Math.abs(bps);
  // 30bps matches PEG_ALERT_THRESHOLD in ai-layer/config.py.
  if (abs <= 30) return { status: 'Optimal', bps };
  if (abs <= 100) return { status: 'Minor Stress', bps };
  return { status: 'High Risk', bps };
}

interface LlamaAsset {
  symbol?: string;
  name?: string;
  price?: unknown;
  pegMechanism?: string;
  chainCirculating?: Record<string, { current?: Record<string, unknown> }>;
}

/**
 * Returns every stablecoin with live circulating supply on Sui, largest first.
 * On failure returns an empty array — the caller decides how to degrade, so a
 * dead API never fabricates numbers.
 */
export async function fetchSuiStablecoinMarket(): Promise<CoinMarketData[]> {
  try {
    const res = await axios.get(DEFILLAMA_URL, { timeout: TIMEOUT_MS });
    const assets: LlamaAsset[] = res.data?.peggedAssets ?? [];

    const out: CoinMarketData[] = [];
    for (const asset of assets) {
      const suiCirc = asset.chainCirculating?.Sui;
      if (!suiCirc) continue;

      const current = suiCirc.current ?? {};
      const circulatingUsd = Object.values(current).reduce<number>(
        (sum, v) => (typeof v === 'number' ? sum + v : sum),
        0,
      );
      if (circulatingUsd <= 0) continue;

      const rawSymbol = (asset.symbol ?? 'UNKNOWN').toUpperCase();
      const symbol = SYMBOL_DISPLAY[rawSymbol] ?? asset.symbol ?? rawSymbol;
      const price = typeof asset.price === 'number' ? asset.price : null;
      const { status, bps } = classifyPeg(symbol, price);

      out.push({
        symbol,
        name: asset.name ?? symbol,
        price,
        circulatingUsd,
        pegDeviationBps: bps,
        pegStatus: status,
        mechanism: asset.pegMechanism ?? 'unknown',
        source: 'defillama',
      });
    }

    out.sort((a, b) => b.circulatingUsd - a.circulatingUsd);
    return out;
  } catch (err) {
    console.warn('[marketData] DefiLlama request failed:', (err as Error).message);
    return [];
  }
}

const CACHE_TTL_MS = 60_000;
let cached: { at: number; data: CoinMarketData[] } | null = null;

/**
 * Same data as `fetchSuiStablecoinMarket`, cached in-memory for a minute.
 * DefiLlama's API is free/unkeyed but there's no reason to refetch on every
 * wallet-balance refresh — prices don't move meaningfully within a minute for
 * pegged assets, and this is polite to a public endpoint we don't control.
 */
export async function getCachedStablecoinMarket(): Promise<CoinMarketData[]> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;
  const data = await fetchSuiStablecoinMarket();
  cached = { at: Date.now(), data };
  return data;
}

/** Compact, token-cheap shape for handing to the narration model. */
export function summariseForAi(market: CoinMarketData[]) {
  return market.map((c) => ({
    symbol: c.symbol,
    price: c.price === null ? null : Number(c.price.toFixed(4)),
    peg_deviation_bps: c.pegDeviationBps,
    peg_status: c.pegStatus,
    circulating_on_sui_usd: Math.round(c.circulatingUsd),
    mechanism: c.mechanism,
  }));
}
