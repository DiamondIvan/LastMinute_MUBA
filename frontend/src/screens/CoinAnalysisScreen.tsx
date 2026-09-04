import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import { fetchCoinAnalysis } from '../api';
import type { CoinAnalysis } from '../api';

export function CoinAnalysisScreen() {
  const { symbol } = useParams();
  const navigate = useNavigate();

  const [analysis, setAnalysis] = useState<CoinAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 'future' | 'past'
  const [chartMode, setChartMode] = useState<'future' | 'past'>('future');

  useEffect(() => {
    if (!symbol) {
      navigate('/dashboard');
      return;
    }

    const loadAnalysis = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchCoinAnalysis(symbol);
        setAnalysis(data);
      } catch (err: any) {
        setError(err.message || 'Failed to analyze coin');
      } finally {
        setLoading(false);
      }
    };
    loadAnalysis();
  }, [symbol, navigate]);

  return (
    <div className="min-h-screen bg-[#F4F7FE] flex p-4 gap-4">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 bg-white rounded-4xl p-8 shadow-sm border border-gray-100 overflow-y-auto">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm font-bold text-gray-500 hover:text-gray-900 mb-6 flex items-center gap-2 cursor-pointer"
          >
            ← Back to Dashboard
          </button>

          <h1 className="text-3xl font-extrabold text-gray-900 mb-2 leading-snug">
            {symbol} AI Analysis
          </h1>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-8">
            Aggregated Market Sentiment & Predictions
          </p>

          {loading && (
            <div className="text-center py-20 text-gray-400">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto mb-4"></div>
              <p className="text-sm font-medium">AI is generating deep-dive impact analysis for {symbol}...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-6 text-sm font-medium border border-red-200">
              Error: {error}
            </div>
          )}

          {analysis && !loading && (
            <div className="space-y-8">
              {/* Chart Section */}
              <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                  <h3 className="text-lg font-black text-gray-900">
                    {chartMode === 'future' ? '30-Day Future Prediction' : 'Past Month Accuracy'}
                  </h3>
                  <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
                    <button
                      onClick={() => setChartMode('future')}
                      className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        chartMode === 'future' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      1M Forecast
                    </button>
                    <button
                      onClick={() => setChartMode('past')}
                      className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        chartMode === 'past' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      Past 30 Days
                    </button>
                  </div>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartMode === 'future' ? analysis.futureChart : analysis.pastChart}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} dy={10} />
                      <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} dx={-10} tickFormatter={(v) => `$${v.toFixed(3)}`} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: any) => [`$${Number(value).toFixed(3)}`, 'Price']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="price" 
                        stroke={chartMode === 'future' ? '#8b5cf6' : '#10b981'} 
                        strokeWidth={4} 
                        dot={{ r: 4, strokeWidth: 2 }} 
                        activeDot={{ r: 6 }} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Impact Sections */}
              <div className="bg-purple-50/50 p-6 rounded-3xl border border-purple-100">
                <h3 className="text-lg font-black text-purple-900 mb-3">Overall Market Conclusion</h3>
                <p className="text-sm text-purple-800 leading-relaxed whitespace-pre-wrap">
                  {analysis.conclusion}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100">
                  <h3 className="text-lg font-black text-blue-900 mb-3">Peg Health</h3>
                  <p className="text-sm text-blue-800 leading-relaxed whitespace-pre-wrap">
                    {analysis.pegHealth}
                  </p>
                </div>

                <div className="bg-red-50/50 p-6 rounded-3xl border border-red-100">
                  <h3 className="text-lg font-black text-red-900 mb-3">Investment Risk</h3>
                  <p className="text-sm text-red-800 leading-relaxed whitespace-pre-wrap">
                    {analysis.investmentRisk}
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
