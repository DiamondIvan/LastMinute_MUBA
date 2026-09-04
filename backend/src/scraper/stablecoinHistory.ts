import axios from 'axios';

/**
 * Real historical peg-price series for the stablecoin tracker chart.
 *
 * Replaces a hardcoded, hand-typed dataset that used to live in the frontend
 * (frontend/src/components/StablecoinTracker.tsx) — invented prices for every
 * coin, every timeframe.
 *
 * Source: DefiLlama's per-coin, per-chain history endpoint
 * (stablecoincharts/Sui?stablecoin={id}), which returns daily circulating
 * supply in both native units and USD terms. The ratio
 * totalCirculatingUSD/totalCirculating is the implied peg price for that
 * day — verified live: USDY (a yield-bearing coin) comes back at ~$1.14,
 * matching its live spot price elsewhere in this app, so the ratio is a
 * genuine price signal, not a supply artifact.
 *
 * This is daily-resolution data only — there is no free intraday source for
 * these coins, so there is deliberately no "24H" timeframe here.
 */

const TIMEOUT_MS = 15_000;

/**
 * DefiLlama's numeric ids for the coins this app tracks with a real Sui
 * wallet coin-type (see frontend's useStablecoinBalances.ts KNOWN_STABLECOINS)
 * — looked up once via https://stablecoins.llama.fi/stablecoins.
 */
const DEFILLAMA_IDS: Record<string, string> = {
  USDC: '2',
  USDsui: '373',
  FDUSD: '119',
  BUCK: '154',
};

export const HISTORY_SYMBOLS = Object.keys(DEFILLAMA_IDS);

export interface HistoryPoint {
  time: string;
  price: number;
}

export type HistoryTimeframe = '7D' | '30D' | '1Y';

interface RawEntry {
  date: string; // unix seconds, as a string
  totalCirculating?: { peggedUSD?: number };
  totalCirculatingUSD?: { peggedUSD?: number };
}

function formatDay(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Evenly-spaced sample of `points`, keeping the most recent point. */
function stride<T>(points: T[], maxCount: number): T[] {
  if (points.length <= maxCount) return points;
  const step = points.length / maxCount;
  const out: T[] = [];
  for (let i = 0; i < maxCount; i++) {
    out.push(points[Math.min(points.length - 1, Math.floor(i * step))]!);
  }
  if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]!);
  return out;
}

function toDailyPrices(raw: RawEntry[]): { unixSeconds: number; price: number }[] {
  const out: { unixSeconds: number; price: number }[] = [];
  for (const entry of raw) {
    const circ = entry.totalCirculating?.peggedUSD;
    const circUsd = entry.totalCirculatingUSD?.peggedUSD;
    if (!circ || !circUsd || circ <= 0) continue;
    out.push({ unixSeconds: Number(entry.date), price: circUsd / circ });
  }
  return out;
}

/** Fetches and derives one coin's daily peg-price history. Empty array on failure. */
async function fetchCoinHistory(symbol: string): Promise<{ unixSeconds: number; price: number }[]> {
  const id = DEFILLAMA_IDS[symbol];
  if (!id) return [];
  try {
    const res = await axios.get(`https://stablecoins.llama.fi/stablecoincharts/Sui`, {
      params: { stablecoin: id },
      timeout: TIMEOUT_MS,
    });
    const raw: RawEntry[] = res.data ?? [];
    return toDailyPrices(raw);
  } catch (err) {
    console.warn(`[stablecoinHistory] ${symbol} (id ${id}) fetch failed:`, (err as Error).message);
    return [];
  }
}

function buildTimeframes(
  daily: { unixSeconds: number; price: number }[],
): Record<HistoryTimeframe, HistoryPoint[]> {
  const toPoints = (pts: { unixSeconds: number; price: number }[]): HistoryPoint[] =>
    pts.map((p) => ({ time: formatDay(p.unixSeconds), price: Number(p.price.toFixed(4)) }));

  return {
    '7D': toPoints(daily.slice(-7)),
    '30D': toPoints(daily.slice(-30)),
    '1Y': toPoints(stride(daily.slice(-365), 52)),
  };
}

/**
 * Fetches every tracked coin's history in parallel and buckets each into
 * 7D/30D/1Y point arrays ready to hand to a chart. One coin failing does not
 * fail the others — a coin with no data just gets empty arrays.
 */
export async function fetchAllStablecoinHistory(): Promise<Record<string, Record<HistoryTimeframe, HistoryPoint[]>>> {
  const entries = await Promise.all(
    HISTORY_SYMBOLS.map(async (symbol) => [symbol, buildTimeframes(await fetchCoinHistory(symbol))] as const),
  );
  return Object.fromEntries(entries);
}

const CACHE_TTL_MS = 30 * 60 * 1000; // this is daily-resolution data; no need to refetch often
let cached: { at: number; data: Record<string, Record<HistoryTimeframe, HistoryPoint[]>> } | null = null;

export async function getCachedStablecoinHistory() {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;
  const data = await fetchAllStablecoinHistory();
  cached = { at: Date.now(), data };
  return data;
}
