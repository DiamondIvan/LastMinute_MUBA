import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import { fetchStablecoinAnalysis } from '../api';
import type { StablecoinAnalysisResponse } from '../api';

interface ForecastAsset {
  symbol: string;
  name: string;
  pegStatus: 'Optimal' | 'Minor Stress' | 'High Risk';
  riskScore: number;
  apy30d: string;
  trend: 'Bullish Expansion' | 'Neutral Stability' | 'Liquidity Outflow';
  volume24h: string;
  currentGrowth24h: string;
}

const FORECAST_ASSETS: ForecastAsset[] = [
  {
    symbol: 'USDsui',
    name: 'Sui Dollar',
    pegStatus: 'Optimal',
    riskScore: 12,
    apy30d: '6.4%',
    trend: 'Bullish Expansion',
    volume24h: '$4.2M',
    currentGrowth24h: '+1.2%',
  },
  {
    symbol: 'USDC',
    name: 'Native USD Coin',
    pegStatus: 'Optimal',
    riskScore: 8,
    apy30d: '4.8%',
    trend: 'Neutral Stability',
    volume24h: '$12.8M',
    currentGrowth24h: '+0.5%',
  },
  {
    symbol: 'FDUSD',
    name: 'First Digital USD',
    pegStatus: 'Optimal',
    riskScore: 18,
    apy30d: '5.1%',
    trend: 'Neutral Stability',
    volume24h: '$1.1M',
    currentGrowth24h: '-0.2%',
  },
  {
    symbol: 'BUCK',
    name: 'Bucket Protocol',
    pegStatus: 'Minor Stress',
    riskScore: 34,
    apy30d: '8.2%',
    trend: 'Liquidity Outflow',
    volume24h: '$800K',
    currentGrowth24h: '-2.1%',
  },
  {
    symbol: 'USDY',
    name: 'Ondo US Dollar Yield',
    pegStatus: 'Optimal',
    riskScore: 14,
    apy30d: '5.2%',
    trend: 'Bullish Expansion',
    volume24h: '$2.5M',
    currentGrowth24h: '+0.8%',
  },
];

export function LatestForecastScreen() {
  const [filter, setFilter] = useState<'All' | 'Optimal' | 'Minor Stress'>('All');
  const [analysisData, setAnalysisData] = useState<StablecoinAnalysisResponse | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const loadAnalysis = async () => {
    setIsLoadingAnalysis(true);
    setAnalysisError(null);
    try {
      const data = await fetchStablecoinAnalysis();
      setAnalysisData(data);
    } catch (err: any) {
      setAnalysisError(err.message || 'Failed to fetch analysis');
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  useEffect(() => {
    // Optionally load on mount, but we provide a button to trigger it manually as well
    loadAnalysis();
  }, []);

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
            <div className="bg-gray-50/80 px-6 py-4 border-b border-gray-100 grid grid-cols-12 text-xs font-bold text-gray-500 uppercase tracking-wider gap-4">
              <div className="col-span-3">Asset</div>
              <div className="col-span-2">Peg Health</div>
              <div className="col-span-3">24h Vol & Growth</div>
              <div className="col-span-2">Est. 30D APY</div>
              <div className="col-span-2">AI Predicted Growth</div>
            </div>

            <div className="divide-y divide-gray-100">
              {filteredAssets.map((asset) => {
                const predictedGrowth = analysisData?.assetPredictions?.find(p => p.symbol === asset.symbol)?.predictedGrowth || '...';
                return (
                  <div
                    key={asset.symbol}
                    className="px-6 py-4.5 grid grid-cols-12 items-center hover:bg-gray-50/50 transition-colors gap-4"
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

                    <div className="col-span-3 flex flex-col justify-center">
                      <span className="text-sm font-bold text-gray-900">{asset.volume24h}</span>
                      <span className={`text-[11px] font-bold ${asset.currentGrowth24h.startsWith('+') ? 'text-emerald-500' : 'text-red-500'}`}>
                        {asset.currentGrowth24h}
                      </span>
                    </div>

                    <div className="col-span-2">
                      <span className="text-sm font-black text-gray-900">{asset.apy30d}</span>
                    </div>

                    <div className="col-span-2">
                      <span className="text-sm font-black text-brand flex items-center gap-1">
                        <span className="text-xs">✨</span> {predictedGrowth}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Market Intelligence Section */}
          <div className="mt-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">AI Market Intelligence & Trending News</h2>
              <button
                onClick={loadAnalysis}
                disabled={isLoadingAnalysis}
                className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-brand/90 transition disabled:opacity-50"
              >
                {isLoadingAnalysis ? 'Scraping & Analyzing...' : 'Refresh Analysis'}
              </button>
            </div>

            {analysisError && (
              <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-6 text-sm font-medium border border-red-200">
                Error: {analysisError}. Please check your backend and OPENROUTER_API_KEY.
              </div>
            )}

            {isLoadingAnalysis && !analysisData && (
              <div className="text-center py-12 text-gray-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mx-auto mb-4"></div>
                <p className="text-sm font-medium">Scraping latest news and running AI analysis...</p>
              </div>
            )}

            {analysisData && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* News Panel */}
                <div className="lg:col-span-1 bg-gray-50/80 rounded-3xl p-6 border border-gray-100">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-4">
                    Latest Stablecoin News
                  </h3>
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                    {analysisData.news.map((item, idx) => {
                      const isImportant = analysisData.importantNewsIndices?.includes(idx);
                      return (
                        <Link
                          key={idx}
                          to="/forecast/news"
                          state={{ title: item.title, url: item.link }}
                          className={`block p-4 rounded-xl shadow-xs border transition-colors relative overflow-hidden ${
                            isImportant
                              ? 'bg-amber-50/30 border-amber-300 hover:border-amber-400'
                              : 'bg-white border-gray-100 hover:border-brand/30'
                          }`}
                        >
                          {isImportant && (
                            <div className="absolute top-0 right-0 bg-amber-400 text-amber-900 text-[9px] font-black uppercase px-2 py-0.5 rounded-bl-lg tracking-wider">
                              Market Mover
                            </div>
                          )}
                          <h4 className={`text-sm font-bold mb-1 leading-snug ${isImportant ? 'text-amber-950 pr-16' : 'text-gray-900'}`}>
                            {item.title}
                          </h4>
                          <p className={`text-[10px] font-bold uppercase tracking-wider ${isImportant ? 'text-amber-700/70' : 'text-gray-400'}`}>
                            Source: {new URL(item.source).hostname.replace('www.', '')}
                          </p>
                        </Link>
                      );
                    })}
                    {analysisData.news.length === 0 && (
                      <p className="text-sm text-gray-500 italic">No recent news found.</p>
                    )}
                  </div>
                </div>

                {/* AI Analysis Panel */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Strategy Plan */}
                  <div className="bg-emerald-50/50 rounded-3xl p-6 border border-emerald-100">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold">
                        ✦
                      </div>
                      <h3 className="text-lg font-black text-gray-900">Strategy Plan</h3>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {analysisData.strategyPlan}
                    </p>
                  </div>

                  {/* Risk Analysis */}
                  <div className="bg-amber-50/50 rounded-3xl p-6 border border-amber-100">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold">
                        !
                      </div>
                      <h3 className="text-lg font-black text-gray-900">Risk Analysis</h3>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {analysisData.riskAnalysis}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}