import { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';

interface ForecastAsset {
  symbol: string;
  name: string;
  pegStatus: 'Optimal' | 'Minor Stress' | 'High Risk';
  riskScore: number; // 0 - 100 (lower is safer)
  apy30d: string;
  trend: 'Bullish Expansion' | 'Neutral Stability' | 'Liquidity Outflow';
  aiSummary: string;
}

const FORECAST_ASSETS: ForecastAsset[] = [
  {
    symbol: 'USDsui',
    name: 'Sui Dollar',
    pegStatus: 'Optimal',
    riskScore: 12,
    apy30d: '6.4%',
    trend: 'Bullish Expansion',
    aiSummary:
      'Strong reserve yield backing channelled into SUI buybacks. Treasury collateralization ratio remains above 105%.',
  },
  {
    symbol: 'USDC',
    name: 'Native USD Coin',
    pegStatus: 'Optimal',
    riskScore: 8,
    apy30d: '4.8%',
    trend: 'Neutral Stability',
    aiSummary:
      'Deepest liquidity on DeepBook CLOB. Cross-chain CCTP volume steady with institutional inflows.',
  },
  {
    symbol: 'FDUSD',
    name: 'First Digital USD',
    pegStatus: 'Optimal',
    riskScore: 18,
    apy30d: '5.1%',
    trend: 'Neutral Stability',
    aiSummary:
      'Monthly attestation verified 100% cash and cash equivalents. Stable trading bands against native pairs.',
  },
  {
    symbol: 'BUCK',
    name: 'Bucket Protocol',
    pegStatus: 'Minor Stress',
    riskScore: 34,
    apy30d: '8.2%',
    trend: 'Liquidity Outflow',
    aiSummary:
      'Crypto-collateral collateral ratio healthy at 142%, but SUI price volatility requires tighter liquidation buffer monitoring.',
  },
  {
    symbol: 'USDY',
    name: 'Ondo US Dollar Yield',
    pegStatus: 'Optimal',
    riskScore: 14,
    apy30d: '5.2%',
    trend: 'Bullish Expansion',
    aiSummary:
      'Tokenized short-term US Treasuries compounding daily. Low redemption volatility observed over 90 days.',
  },
];

export function LatestForecastScreen() {
  const [filter, setFilter] = useState<'All' | 'Optimal' | 'Minor Stress'>('All');

  const filteredAssets =
    filter === 'All' ? FORECAST_ASSETS : FORECAST_ASSETS.filter((a) => a.pegStatus === filter);

  return (
    <div className="min-h-screen bg-[#F4F7FE] flex p-4 gap-4">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 bg-white rounded-4xl p-8 shadow-sm border border-gray-100 overflow-y-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">Latest Market Forecast</h1>
              <p className="text-sm text-gray-500 mt-1">
                AI-driven peg stability diagnostics, collateral health, and APY yield projections.
              </p>
            </div>

            {/* Status Filter */}
            <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
              {(['All', 'Optimal', 'Minor Stress'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    filter === status
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-purple-50/70 p-5 rounded-3xl border border-purple-100">
              <p className="text-xs font-bold uppercase tracking-wider text-purple-700 mb-1">
                Overall Peg Health
              </p>
              <h3 className="text-2xl font-black text-gray-900">99.2% Stable</h3>
              <p className="text-xs text-gray-500 mt-1">Weighted across all Sui pools</p>
            </div>

            <div className="bg-emerald-50/70 p-5 rounded-3xl border border-emerald-100">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1">
                Average Ecosystem APY
              </p>
              <h3 className="text-2xl font-black text-gray-900">5.94%</h3>
              <p className="text-xs text-gray-500 mt-1">Auto-compounding yield positions</p>
            </div>

            <div className="bg-blue-50/70 p-5 rounded-3xl border border-blue-100">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-1">
                DeepBook 24H Liquidity
              </p>
              <h3 className="text-2xl font-black text-gray-900">$18.4M</h3>
              <p className="text-xs text-gray-500 mt-1">Zero slippage range</p>
            </div>
          </div>

          {/* Asset Forecast Table / Cards */}
          <div className="border border-gray-100 rounded-3xl overflow-hidden shadow-xs">
            <div className="bg-gray-50/80 px-6 py-4 border-b border-gray-100 grid grid-cols-12 text-xs font-bold text-gray-500 uppercase tracking-wider">
              <div className="col-span-3">Asset</div>
              <div className="col-span-2">Peg Health</div>
              <div className="col-span-2">Risk Index</div>
              <div className="col-span-2">Est. 30D APY</div>
              <div className="col-span-3">AI Synthesis</div>
            </div>

            <div className="divide-y divide-gray-100">
              {filteredAssets.map((asset) => (
                <div
                  key={asset.symbol}
                  className="px-6 py-4.5 grid grid-cols-12 items-center hover:bg-gray-50/50 transition-colors"
                >
                  <div className="col-span-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-xs">
                      {asset.symbol.slice(0, 3)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">{asset.symbol}</h4>
                      <p className="text-xs text-gray-400">{asset.name}</p>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                        asset.pegStatus === 'Optimal'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {asset.pegStatus}
                    </span>
                  </div>

                  <div className="col-span-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-gray-900">{asset.riskScore}/100</span>
                      <span className="text-[11px] text-gray-400">
                        {asset.riskScore < 20 ? 'Low' : 'Moderate'}
                      </span>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <span className="text-sm font-black text-emerald-600">{asset.apy30d}</span>
                  </div>

                  <div className="col-span-3">
                    <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                      {asset.aiSummary}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}