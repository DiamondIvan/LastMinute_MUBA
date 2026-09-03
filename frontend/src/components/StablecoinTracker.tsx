import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { TokenBalance } from '../hooks/useStablecoinBalances';

export type Timeframe = '24H' | '7D' | '30D' | '1Y';

export interface StablecoinData {
  symbol: string;
  name: string;
  decimals: number;
  balance: number;
  price: number;
  changePercent: Record<Timeframe, number>;
  history: Record<Timeframe, { time: string; price: number }[]>;
}

const STABLECOINS: StablecoinData[] = [
  {
    symbol: 'USDC',
    name: 'Native USD Coin',
    decimals: 6,
    balance: 0.0,
    price: 1.0001,
    changePercent: { '24H': 0.01, '7D': 0.03, '30D': -0.02, '1Y': 0.05 },
    history: {
      '24H': [
        { time: '00:00', price: 0.9998 },
        { time: '06:00', price: 1.0002 },
        { time: '12:00', price: 0.9999 },
        { time: '18:00', price: 1.0001 },
      ],
      '7D': [
        { time: 'Mon', price: 0.9997 },
        { time: 'Wed', price: 1.0003 },
        { time: 'Fri', price: 1.0000 },
        { time: 'Sun', price: 1.0001 },
      ],
      '30D': [
        { time: 'W1', price: 1.0004 },
        { time: 'W2', price: 0.9996 },
        { time: 'W3', price: 1.0002 },
        { time: 'W4', price: 1.0001 },
      ],
      '1Y': [
        { time: 'Q1', price: 0.9995 },
        { time: 'Q2', price: 1.0005 },
        { time: 'Q3', price: 0.9998 },
        { time: 'Q4', price: 1.0001 },
      ],
    },
  },
  {
    symbol: 'USDsui',
    name: 'Sui Dollar (Yield-Backing)',
    decimals: 6,
    balance: 0.0,
    price: 1.0012,
    changePercent: { '24H': 0.04, '7D': 0.18, '30D': 0.62, '1Y': 4.85 },
    history: {
      '24H': [
        { time: '00:00', price: 1.0008 },
        { time: '06:00', price: 1.0009 },
        { time: '12:00', price: 1.0011 },
        { time: '18:00', price: 1.0012 },
      ],
      '7D': [
        { time: 'Mon', price: 0.9995 },
        { time: 'Wed', price: 1.0002 },
        { time: 'Fri', price: 1.0008 },
        { time: 'Sun', price: 1.0012 },
      ],
      '30D': [
        { time: 'W1', price: 0.9950 },
        { time: 'W2', price: 0.9975 },
        { time: 'W3', price: 0.9998 },
        { time: 'W4', price: 1.0012 },
      ],
      '1Y': [
        { time: 'Q1', price: 0.9550 },
        { time: 'Q2', price: 0.9720 },
        { time: 'Q3', price: 0.9890 },
        { time: 'Q4', price: 1.0012 },
      ],
    },
  },
  {
    symbol: 'FDUSD',
    name: 'First Digital USD',
    decimals: 6,
    balance: 0.0,
    price: 0.9996,
    changePercent: { '24H': -0.03, '7D': -0.01, '30D': 0.04, '1Y': -0.08 },
    history: {
      '24H': [
        { time: '00:00', price: 0.9999 },
        { time: '06:00', price: 0.9995 },
        { time: '12:00', price: 0.9998 },
        { time: '18:00', price: 0.9996 },
      ],
      '7D': [
        { time: 'Mon', price: 0.9997 },
        { time: 'Wed', price: 0.9994 },
        { time: 'Fri', price: 0.9998 },
        { time: 'Sun', price: 0.9996 },
      ],
      '30D': [
        { time: 'W1', price: 0.9992 },
        { time: 'W2', price: 0.9998 },
        { time: 'W3', price: 0.9995 },
        { time: 'W4', price: 0.9996 },
      ],
      '1Y': [
        { time: 'Q1', price: 1.0004 },
        { time: 'Q2', price: 0.9991 },
        { time: 'Q3', price: 0.9999 },
        { time: 'Q4', price: 0.9996 },
      ],
    },
  },
  {
    symbol: 'BUCK',
    name: 'Bucket Protocol USD',
    decimals: 9,
    balance: 0.0,
    price: 0.9989,
    changePercent: { '24H': -0.08, '7D': 0.12, '30D': -0.15, '1Y': 0.22 },
    history: {
      '24H': [
        { time: '00:00', price: 0.9997 },
        { time: '06:00', price: 0.9991 },
        { time: '12:00', price: 0.9986 },
        { time: '18:00', price: 0.9989 },
      ],
      '7D': [
        { time: 'Mon', price: 0.9978 },
        { time: 'Wed', price: 0.9985 },
        { time: 'Fri', price: 0.9992 },
        { time: 'Sun', price: 0.9989 },
      ],
      '30D': [
        { time: 'W1', price: 1.0004 },
        { time: 'W2', price: 0.9980 },
        { time: 'W3', price: 0.9975 },
        { time: 'W4', price: 0.9989 },
      ],
      '1Y': [
        { time: 'Q1', price: 0.9965 },
        { time: 'Q2', price: 0.9980 },
        { time: 'Q3', price: 1.0010 },
        { time: 'Q4', price: 0.9989 },
      ],
    },
  },
  {
    symbol: 'USDY',
    name: 'Ondo US Dollar Yield',
    decimals: 6,
    balance: 0.0,
    price: 1.0542,
    changePercent: { '24H': 0.02, '7D': 0.11, '30D': 0.44, '1Y': 5.24 },
    history: {
      '24H': [
        { time: '00:00', price: 1.0540 },
        { time: '06:00', price: 1.0541 },
        { time: '12:00', price: 1.0541 },
        { time: '18:00', price: 1.0542 },
      ],
      '7D': [
        { time: 'Mon', price: 1.0530 },
        { time: 'Wed', price: 1.0535 },
        { time: 'Fri', price: 1.0539 },
        { time: 'Sun', price: 1.0542 },
      ],
      '30D': [
        { time: 'W1', price: 1.0495 },
        { time: 'W2', price: 1.0512 },
        { time: 'W3', price: 1.0528 },
        { time: 'W4', price: 1.0542 },
      ],
      '1Y': [
        { time: 'Q1', price: 1.0010 },
        { time: 'Q2', price: 1.0180 },
        { time: 'Q3', price: 1.0360 },
        { time: 'Q4', price: 1.0542 },
      ],
    },
  },
  {
    symbol: 'AUSD',
    name: 'Agora Dollar',
    decimals: 6,
    balance: 0.0,
    price: 1.0000,
    changePercent: { '24H': 0.00, '7D': 0.01, '30D': 0.02, '1Y': 0.01 },
    history: {
      '24H': [
        { time: '00:00', price: 1.0000 },
        { time: '06:00', price: 1.0001 },
        { time: '12:00', price: 0.9999 },
        { time: '18:00', price: 1.0000 },
      ],
      '7D': [
        { time: 'Mon', price: 0.9999 },
        { time: 'Wed', price: 1.0000 },
        { time: 'Fri', price: 1.0001 },
        { time: 'Sun', price: 1.0000 },
      ],
      '30D': [
        { time: 'W1', price: 0.9998 },
        { time: 'W2', price: 1.0000 },
        { time: 'W3', price: 1.0002 },
        { time: 'W4', price: 1.0000 },
      ],
      '1Y': [
        { time: 'Q1', price: 0.9997 },
        { time: 'Q2', price: 1.0002 },
        { time: 'Q3', price: 0.9999 },
        { time: 'Q4', price: 1.0000 },
      ],
    },
  },
];

const TIMEFRAMES: Timeframe[] = ['24H', '7D', '30D', '1Y'];

interface StablecoinTrackerProps {
  liveTokens?: TokenBalance[];
}

export function StablecoinTracker({ liveTokens }: StablecoinTrackerProps) {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('USDC');
  const [timeframe, setTimeframe] = useState<Timeframe>('7D');

  const coins = useMemo(() => {
    if (!liveTokens || liveTokens.length === 0) return STABLECOINS;
    return STABLECOINS.map((coin) => {
      const match = liveTokens.find(
        (lt) => lt.symbol.toLowerCase() === coin.symbol.toLowerCase()
      );
      return match ? { ...coin, balance: match.balance } : coin;
    });
  }, [liveTokens]);

  const selectedCoin = useMemo(
    () => coins.find((c) => c.symbol === selectedSymbol) || coins[0],
    [selectedSymbol, coins]
  );

  const chartData = selectedCoin.history[timeframe];
  const activeChange = selectedCoin.changePercent[timeframe];
  const isPositive = activeChange >= 0;

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold text-gray-900">{selectedCoin.name}</h3>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {selectedCoin.symbol}
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-extrabold text-gray-900">${selectedCoin.price.toFixed(4)}</span>
            <span className={`text-xs font-bold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
              {isPositive ? `+${activeChange}%` : `${activeChange}%`} ({timeframe})
            </span>
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
      </div>

      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Your Stablecoin Holdings (Slush Portfolio)
        </p>
        <div className="divide-y divide-gray-50">
          {coins.map((coin) => {
            const coinDelta = coin.changePercent[timeframe];
            const coinIsUp = coinDelta >= 0;
            const isSelected = coin.symbol === selectedSymbol;

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
                    ≈ ${(coin.balance * coin.price).toFixed(2)}
                    <span className={`font-bold ${coinIsUp ? 'text-emerald-600' : 'text-rose-600'}`}>
                      ({coinIsUp ? `+${coinDelta}%` : `${coinDelta}%`})
                    </span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}