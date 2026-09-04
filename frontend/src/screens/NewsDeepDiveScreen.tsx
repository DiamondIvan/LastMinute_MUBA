import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCurrentAccount, useCurrentClient } from '@mysten/dapp-kit-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import { fetchNewsImpact } from '../api';
import type { NewsImpactAnalysis } from '../api';

const STABLECOINS = ['USDsui', 'USDC', 'FDUSD', 'BUCK', 'USDY'];

export function NewsDeepDiveScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const account = useCurrentAccount();
  const client = useCurrentClient();
  const { title, url } = location.state || {};

  const [rawBalance, setRawBalance] = useState(0);
  
  useEffect(() => {
    if (account?.address && client) {
      client.getBalance({ owner: account.address }).then((res: any) => {
        setRawBalance(Number(res.totalBalance) / 1e9);
      });
    }
  }, [account, client]);

  const [selectedCoin, setSelectedCoin] = useState('USDsui');
  const [impact, setImpact] = useState<NewsImpactAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!title) {
      navigate('/forecast');
      return;
    }

    const loadImpact = async () => {
      setLoading(true);
      try {
        const data = await fetchNewsImpact(title, selectedCoin, rawBalance);
        setImpact(data);
      } catch (err: any) {
        setError(err.message || 'Failed to analyze impact');
      } finally {
        setLoading(false);
      }
    };
    loadImpact();
  }, [title, selectedCoin, rawBalance, navigate]);

  return (
    <div className="min-h-screen bg-[#F4F7FE] flex p-4 gap-4">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 bg-white rounded-4xl p-8 shadow-sm border border-gray-100 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={() => navigate('/forecast')}
              className="text-sm font-bold text-gray-500 hover:text-gray-900 flex items-center gap-2 cursor-pointer"
            >
              ← Back to Forecast
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-500">Analyze Impact On:</span>
              <select
                value={selectedCoin}
                onChange={(e) => setSelectedCoin(e.target.value)}
                className="bg-gray-50 border border-gray-200 text-gray-900 text-sm font-bold rounded-lg focus:ring-brand focus:border-brand block p-2 outline-none cursor-pointer"
              >
                {STABLECOINS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <h1 className="text-3xl font-extrabold text-gray-900 mb-2 leading-snug">
            {title}
          </h1>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-8">
            Source: {url ? new URL(url).hostname.replace('www.', '') : 'Unknown'}
          </p>

          {loading && (
            <div className="text-center py-20 text-gray-400">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto mb-4"></div>
              <p className="text-sm font-medium">AI is generating deep-dive impact analysis for {selectedCoin}...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-6 text-sm font-medium border border-red-200">
              Error: {error}
            </div>
          )}

          {impact && !loading && (
            <div className="space-y-8">
              {/* Chart Section */}
              <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
                <h3 className="text-lg font-black text-gray-900 mb-6">AI Predicted 30-Day Growth ({selectedCoin})</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={impact.chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} dy={10} />
                      <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} dx={-10} tickFormatter={(v) => `$${v.toFixed(3)}`} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: any) => [`$${Number(value).toFixed(3)}`, 'Price']}
                      />
                      <Line type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={4} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Impact Sections */}
              <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100">
                <h3 className="text-lg font-black text-blue-900 mb-3">Market Impact</h3>
                <p className="text-sm text-blue-800 leading-relaxed whitespace-pre-wrap">
                  {impact.marketImpact}
                </p>
              </div>

              <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-lg font-black text-emerald-900">Investor Action Plan</h3>
                  {!account && (
                    <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-1 rounded-full font-bold uppercase tracking-wider">
                      Wallet Not Connected
                    </span>
                  )}
                </div>
                <p className="text-sm text-emerald-800 leading-relaxed whitespace-pre-wrap">
                  {impact.investorActionPlan}
                </p>
              </div>

              {/* Action Button */}
              <div className="pt-8 border-t border-gray-100 text-center">
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block bg-gray-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-800 transition"
                >
                  Read Full Original Article ↗
                </a>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
