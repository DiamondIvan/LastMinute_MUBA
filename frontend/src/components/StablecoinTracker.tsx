import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { TokenBalance } from '../hooks/useStablecoinBalances';
import { fetchStablecoinHistory } from '../api';
import type { HistoryTimeframe, HistoryPoint } from '../api';

/**
 * Price chart + holdings list for the coins this app can show a real wallet
 * balance for (see useStablecoinBalances.ts's KNOWN_STABLECOINS).
 *
 * Every number here is now real: price and peg status come from
 * useStablecoinBalances (DefiLlama, via the backend — see commit 805ebbe),
 * and the chart history comes from a real per-day peg-price series (see
 * backend/src/scraper/stablecoinHistory.ts) — not the hand-typed fake dataset
 * this file used to hardcode.
 *
 * There is deliberately no 24H timeframe: the history source is daily
 * resolution, and there's no free intraday price feed for these coins to
 * fill that in honestly.
 */

const TIMEFRAMES: HistoryTimeframe[] = ['7D', '30D', '1Y'];

function periodChangePct(points: HistoryPoint[]): number | null {
  if (points.length < 2) return null;
  const first = points[0]!.price;
  const last = points[points.length - 1]!.price;
  if (first === 0) return null;
  return ((last - first) / first) * 100;
}

interface StablecoinTrackerProps {
  liveTokens?: TokenBalance[];
}

export function StablecoinTracker({ liveTokens }: StablecoinTrackerProps) {
  const navigate = useNavigate();
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<HistoryTimeframe>('7D');
  const [history, setHistory] = useState<Record<string, Record<HistoryTimeframe, HistoryPoint[]>>>({});
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchStablecoinHistory()
      .then((h) => {
        if (!cancelled) setHistory(h);
      })
      .catch((e) => {
        if (!cancelled) setHistoryError(e instanceof Error ? e.message : 'Failed to load price history');
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const coins = liveTokens ?? [];
  const activeSymbol = selectedSymbol ?? coins[0]?.symbol ?? null;
  const selectedCoin = coins.find((c) => c.symbol === activeSymbol) ?? coins[0] ?? null;

  const chartData = useMemo(
    () => (activeSymbol ? (history[activeSymbol]?.[timeframe] ?? []) : []),
    [history, activeSymbol, timeframe],
  );
  const activeChange = useMemo(() => periodChangePct(chartData), [chartData]);
  const isPositive = (activeChange ?? 0) >= 0;

  if (coins.length === 0) {
    return (
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-center h-64 text-sm text-gray-400">
        Loading holdings…
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold text-gray-900">{selectedCoin?.name}</h3>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {selectedCoin?.symbol}
            </span>
            {selectedCoin?.pegStatus && (
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  selectedCoin.pegStatus === 'Optimal'
                    ? 'bg-emerald-50 text-emerald-700'
                    : selectedCoin.pegStatus === 'Yield-Bearing'
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-amber-50 text-amber-700'
                }`}
              >
                {selectedCoin.pegStatus}
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-extrabold text-gray-900">${selectedCoin?.usdPrice.toFixed(4)}</span>
            {activeChange !== null && (
              <span className={`text-xs font-bold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                {isPositive ? `+${activeChange.toFixed(2)}%` : `${activeChange.toFixed(2)}%`} ({timeframe})
              </span>
            )}
          </div>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl gap-1 self-stretch sm:self-auto justify-center">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                timeframe === tf ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="h-48 w-full">
        {historyLoading ? (
          <div className="h-full flex items-center justify-center text-sm text-gray-400">Loading price history…</div>
        ) : historyError ? (
          <div className="h-full flex items-center justify-center text-sm text-rose-500">{historyError}</div>
        ) : chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-gray-400">
            No history available for {activeSymbol}.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="pegGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isPositive ? '#10B981' : '#F43F5E'} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={isPositive ? '#10B981' : '#F43F5E'} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
              <YAxis
                domain={['dataMin - 0.002', 'dataMax + 0.002']}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: '#9CA3AF' }}
                tickFormatter={(v) => `$${v.toFixed(3)}`}
              />
              <Tooltip
                formatter={(val: any) => [`$${Number(val ?? 0).toFixed(4)}`, 'Price']}
                contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: '12px' }}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={isPositive ? '#10B981' : '#F43F5E'}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#pegGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Your Stablecoin Holdings
        </p>
        <div className="divide-y divide-gray-50">
          {coins.map((coin) => {
            const coinChange = periodChangePct(history[coin.symbol]?.[timeframe] ?? []);
            const coinIsUp = (coinChange ?? 0) >= 0;
            const isSelected = coin.symbol === activeSymbol;

            return (
              <div
                key={coin.symbol}
                onClick={() => setSelectedSymbol(coin.symbol)}
                className={`py-3 px-3 rounded-2xl flex items-center justify-between cursor-pointer transition-all ${
                  isSelected ? 'bg-purple-50/70 border border-purple-100' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-xs text-gray-700">
                    {coin.symbol.slice(0, 3)}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">{coin.symbol}</h4>
                    <p className="text-xs text-gray-400">{coin.name}</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm font-extrabold text-gray-900">
                    {coin.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {coin.symbol}
                  </p>
                  <p className="text-xs flex items-center justify-end gap-1 font-medium text-gray-500">
                    ≈ ${(coin.balance * coin.usdPrice).toFixed(2)}
                    {coinChange !== null && (
                      <span className={`font-bold ${coinIsUp ? 'text-emerald-600' : 'text-rose-600'}`}>
                        ({coinIsUp ? `+${coinChange.toFixed(2)}%` : `${coinChange.toFixed(2)}%`})
                      </span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <p
          onClick={() => activeSymbol && navigate(`/coin/${activeSymbol}`)}
          className="text-xs text-brand font-bold text-center pt-4 cursor-pointer hover:underline"
        >
          View AI analysis for {activeSymbol} →
        </p>
      </div>
    </div>
  );
}
