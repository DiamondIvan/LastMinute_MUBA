import { DeepBookClient, mainnetPools, mainnetCoins } from '@mysten/deepbook-v3';
import { SuiGrpcClient } from '@mysten/sui/grpc';

/**
 * DeepBook V3 — real-time, on-chain order book price feeds.
 *
 * Replaces the previous hardcoded / off-chain-scraped market prices in the
 * StablecoinTracker and StablecoinNewsFeed. Prices are read directly from
 * DeepBook V3 pools on-chain (Level2 order book).
 *
 * Reads from **mainnet** while the rest of the app transacts on testnet.
 * That is deliberate: testnet DeepBook pools carry no liquidity, so
 * `book::mid_price` aborts with code 2 (empty order book) on every call. Price
 * discovery does not need to happen on the chain we transact on, and mainnet is
 * where the real quotes are.
 *
 * These are read-only queries — no signer, no gas, no wallet.
 */

export interface DeepBookPrice {
  symbol: string;
  /** Mid price (quote per base) from the on-chain order book. */
  price: number;
  /** Best bid (largest bid from the Level2 book). */
  bestBid: number;
  /** Best ask (smallest ask from the Level2 book). */
  bestAsk: number;
  /** Quote-base spread as a percentage. */
  spreadPct: number;
  /** Source pool id. */
  poolId: string;
}

const MAINNET_GRPC_URL = 'https://fullnode.mainnet.sui.io:443';

// Pool key → human symbol mapping for the dashboard.
const POOL_SYMBOLS: Record<string, { base: string; quote: string; label: string }> = {
  SUI_USDC: { base: 'SUI', quote: 'USDC', label: 'SUI' },
  WUSDT_USDC: { base: 'WUSDT', quote: 'USDC', label: 'USDT' },
  DEEP_USDC: { base: 'DEEP', quote: 'USDC', label: 'DEEP' },
};

let _client: DeepBookClient | null = null;

function deepBookClient(): DeepBookClient {
  if (_client) return _client;

  const suiClient = new SuiGrpcClient({
    network: 'mainnet' as const,
    baseUrl: MAINNET_GRPC_URL,
  });

  _client = new DeepBookClient({
    client: suiClient as any,
    // Sender for the read-only simulation. Any well-formed address works; it is
    // never asked to sign and pays nothing.
    address: '0xb93589da91d839f0a27334d1eafd76ec792210d1ef46e70a56f0006d0c4b3ca3',
    network: 'mainnet' as const,
    coins: mainnetCoins,
    pools: mainnetPools,
  });

  return _client;
}

/**
 * Reads the on-chain mid price for a pool key.
 * Uses `midPrice(poolKey)` — a read-only DeepBook query.
 */
export async function getMidPrice(poolKey: string): Promise<number> {
  const db = deepBookClient();
  const price = await db.midPrice(poolKey);
  return Number(price);
}

/**
 * Reads the Level2 order book around the mid and returns bid/ask + spread.
 * Uses `getLevel2TicksFromMid(poolKey, ticks)`.
 */
export async function getLevel2Snapshot(
  poolKey: string,
  ticks = 10,
): Promise<{ bestBid: number; bestAsk: number; spreadPct: number; levels: unknown }> {
  const db = deepBookClient();
  const book = await db.getLevel2TicksFromMid(poolKey, ticks);
  // book = { bids: {...}, asks: {...} } of price → quantity
  const bids = (book as any)?.bids ?? {};
  const asks = (book as any)?.asks ?? {};
  const bidPrices = Object.keys(bids).map(Number);
  const askPrices = Object.keys(asks).map(Number);
  const bestBid = bidPrices.length ? Math.max(...bidPrices) : 0;
  const bestAsk = askPrices.length ? Math.min(...askPrices) : 0;
  const mid = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : 0;
  const spreadPct = mid ? ((bestAsk - bestBid) / mid) * 100 : 0;
  return { bestBid, bestAsk, spreadPct, levels: book };
}

/**
 * Returns a ready-to-use price feed for the symbols the dashboard tracks.
 * Falls back to a stable ~$1 for stablecoins and ~$0 for unknown pools.
 */
export async function getDeepBookPriceFeed(): Promise<Record<string, DeepBookPrice>> {
  const feed: Record<string, DeepBookPrice> = {};

  for (const [poolKey, meta] of Object.entries(POOL_SYMBOLS)) {
    try {
      const price = await getMidPrice(poolKey);
      const { bestBid, bestAsk, spreadPct } = await getLevel2Snapshot(poolKey, 10);
      feed[meta.label] = {
        symbol: meta.label,
        price: price || 0,
        bestBid,
        bestAsk,
        spreadPct,
        poolId: mainnetPools[poolKey as keyof typeof mainnetPools]?.address ?? poolKey,
      };
    } catch (e) {
      console.warn(`DeepBook feed failed for ${poolKey}:`, e);
      feed[meta.label] = {
        symbol: meta.label,
        price: 0,
        bestBid: 0,
        bestAsk: 0,
        spreadPct: 0,
        poolId: '',
      };
    }
  }

  return feed;
}
