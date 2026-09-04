import { useCallback, useEffect, useState } from 'react';

/**
 * The coins a user wants the forecast scoped to.
 *
 * Persisted in localStorage — deliberately per-browser rather than per-wallet,
 * since scoping a view is a UI preference, not something worth an account
 * system or an on-chain write for a hackathon build.
 *
 * An empty wishlist means "show everything", which is also the first-run state.
 */

const STORAGE_KEY = 'muba.forecast.wishlist';

/** Symbols the backend tracks — mirrors TRACKED_SYMBOLS in scraper/cryptoFeeds.ts. */
export const TRACKABLE_COINS = ['USDC', 'USDsui', 'FDUSD', 'BUCK', 'USDY', 'AUSD'] as const;

function readStored(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Drop anything no longer trackable, so a stale entry can't silently filter
    // the whole table down to nothing.
    return parsed.filter((s): s is string => typeof s === 'string' && (TRACKABLE_COINS as readonly string[]).includes(s));
  } catch {
    return [];
  }
}

export function useWishlist() {
  const [wishlist, setWishlist] = useState<string[]>(() => readStored());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(wishlist));
    } catch {
      /* private mode / storage disabled — the wishlist just won't persist */
    }
  }, [wishlist]);

  const toggle = useCallback((symbol: string) => {
    setWishlist((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol],
    );
  }, []);

  const clear = useCallback(() => setWishlist([]), []);

  const has = useCallback((symbol: string) => wishlist.includes(symbol), [wishlist]);

  return { wishlist, toggle, clear, has, isFiltered: wishlist.length > 0 };
}
