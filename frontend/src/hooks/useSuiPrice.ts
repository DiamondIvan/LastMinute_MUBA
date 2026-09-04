import { useEffect, useState } from 'react';
import { getMidPrice } from '../lib/deepbook';

/**
 * Live SUI/USDC mid price from DeepBook V3's SUI_USDC mainnet pool.
 *
 * Unlike the stablecoin balances (see useStablecoinBalances.ts), DeepBook is
 * the *correct* source here — SUI genuinely is the base asset priced against
 * USDC in that pool, not a coin structurally excluded from it.
 *
 * Module-level cache so every component that mounts this hook on the same
 * page (KpiCards, DashboardScreen, TransactionScreen) doesn't each fire its
 * own DeepBook query.
 */

const POOL_KEY = 'SUI_USDC';
const CACHE_TTL_MS = 60_000;

/** Used only if the live DeepBook query fails — clearly not "live" when active. */
const FALLBACK_PRICE = 1.65;

let cache: { price: number; at: number } | null = null;

export function useSuiPrice() {
  const [price, setPrice] = useState<number>(cache?.price ?? FALLBACK_PRICE);
  const [loading, setLoading] = useState(!cache);
  const [isLive, setIsLive] = useState(Boolean(cache));

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
        setPrice(cache.price);
        setIsLive(true);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const live = await getMidPrice(POOL_KEY);
        if (live > 0) {
          cache = { price: live, at: Date.now() };
          if (!cancelled) {
            setPrice(live);
            setIsLive(true);
          }
        } else {
          throw new Error('DeepBook returned a zero price');
        }
      } catch (e) {
        console.warn('Live SUI price unavailable, using fallback:', e);
        if (!cancelled) {
          setPrice(FALLBACK_PRICE);
          setIsLive(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { price, loading, isLive };
}
