import { useEffect, useState, useCallback } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { getDeepBookPriceFeed } from '../lib/deepbook';

export interface TokenBalance {
  symbol: string;
  name: string;
  coinType: string;
  decimals: number;
  balance: number;
  usdPrice: number;
  change24h: number;
}

// Known coin type signatures (Testnet package addresses / native coin types).
const KNOWN_STABLECOINS: Omit<TokenBalance, 'balance'>[] = [
  {
    symbol: 'USDC',
    name: 'Native USD Coin',
    coinType: '0xa1ec7fc00c74b464c2142b494d7ffb5707413044a2344779e20bb21ac0b518b9::usdc::USDC',
    decimals: 6,
    usdPrice: 1.0,
    change24h: 0.01,
  },
  {
    symbol: 'USDsui',
    name: 'Sui Dollar',
    coinType: '0x2::sui::SUI_DOLLAR_MOCK',
    decimals: 6,
    usdPrice: 1.001,
    change24h: 0.05,
  },
  {
    symbol: 'FDUSD',
    name: 'First Digital USD',
    coinType: '0x2::fdusd::FDUSD',
    decimals: 6,
    usdPrice: 0.999,
    change24h: -0.02,
  },
  {
    symbol: 'BUCK',
    name: 'Bucket Protocol',
    coinType: '0xce7ff77a83ea0cb6fd39bd8748e2ec89a3f41e8efdc3f4eb123e0ca37b184db2::buck::BUCK',
    decimals: 9,
    usdPrice: 0.998,
    change24h: -0.06,
  },
];

export function useStablecoinBalances() {
  const account = useCurrentAccount();
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [totalStableUsd, setTotalStableUsd] = useState<number>(0);

  const fetchBalances = useCallback(async () => {
    if (!account?.address) {
      setTokens(KNOWN_STABLECOINS.map((c) => ({ ...c, balance: 0 })));
      setTotalStableUsd(0);
      return;
    }

    setLoading(true);
    try {
      const client = new SuiGrpcClient({
        network: 'testnet',
        baseUrl: 'https://fullnode.testnet.sui.io:443',
      });

      // On-chain balances (existing logic — paginated listBalances).
      const response = await client.listBalances({ owner: account.address });
      const allBalances = response.balances;

      // Real-time prices from the DeepBook V3 on-chain order book.
      // Replaces the previous hardcoded usdPrice / change24h.
      let deepBookFeed: Record<string, { price: number; spreadPct: number }> = {};
      try {
        const feed = await getDeepBookPriceFeed();
        deepBookFeed = Object.fromEntries(
          Object.entries(feed).map(([sym, p]) => [sym, { price: p.price, spreadPct: p.spreadPct }]),
        );
      } catch (e) {
        console.warn('DeepBook price feed unavailable; falling back to static prices:', e);
      }

      let sumUsd = 0;
      const updatedTokens: TokenBalance[] = KNOWN_STABLECOINS.map((tokenDef) => {
        const found = allBalances.find(
          (b: any) => b.coinType.toLowerCase() === tokenDef.coinType.toLowerCase(),
        );

        let parsedBalance = 0;
        if (found) {
          // SDK 2.0 uses 'balance' instead of the legacy 'totalBalance'
          parsedBalance = Number(found.balance) / Math.pow(10, tokenDef.decimals);
        }

        // Overlay DeepBook price when a feed exists for this symbol; else keep
        // the static ~$1 stablecoin price as a safe fallback.
        const deep = deepBookFeed[tokenDef.symbol];
        const price = deep?.price && deep.price > 0 ? deep.price : tokenDef.usdPrice;
        const change = deep?.price && deep.price > 0 ? deep.spreadPct : tokenDef.change24h;

        sumUsd += parsedBalance * price;

        return {
          ...tokenDef,
          balance: parsedBalance,
          usdPrice: price,
          change24h: change,
        };
      });

      setTokens(updatedTokens);
      setTotalStableUsd(sumUsd);
    } catch (err) {
      console.warn('Failed to load on-chain stablecoin balances, using fallback:', err);
    } finally {
      setLoading(false);
    }
  }, [account?.address]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  return { tokens, totalStableUsd, loading, refresh: fetchBalances };
}