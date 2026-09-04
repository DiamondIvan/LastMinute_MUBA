import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import { fetchDailyForecast } from '../api';
import type { DailyForecastResponse, CoinMarketData, PegStatus } from '../api';
import { useWishlist, TRACKABLE_COINS } from '../hooks/useWishlist';

/**
 * The daily crypto forecast — "weather report" framing.
 *
 * Everything on this screen is live: peg/price/supply come from DefiLlama's
 * stablecoin API, headlines from five scraped sources (RSS where available),
 * and the narrative from Gonka. The previous version of this screen rendered a
 * hardcoded FORECAST_ASSETS array with invented peg/APY/volume figures; none of
 * that survives here.
 */

const PEG_STYLES: Record<PegStatus, string> = {
  Optimal: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Minor Stress': 'bg-amber-50 text-amber-700 border-amber-200',
  'High Risk': 'bg-rose-50 text-rose-700 border-rose-200',
  'Yield-Bearing': 'bg-blue-50 text-blue-700 border-blue-200',
};

function formatUsd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatAge(iso: string | null): string {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diffMs)) return '';
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function StarToggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={on ? 'Remove from wishlist' : 'Add to wishlist'}
      className={`text-lg leading-none transition-all cursor-pointer ${
        on ? 'text-amber-400 hover:text-amber-500' : 'text-gray-300 hover:text-gray-400'
      }`}
    >
      {on ? '★' : '☆'}
    </button>
  );
}

export function LatestForecastScreen() {
  const navigate = useNavigate();
  const { wishlist, toggle, clear, has, isFiltered } = useWishlist();

  const [data, setData] = useState<DailyForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      refresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      try {
        setData(await fetchDailyForecast(wishlist, refresh));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load the forecast');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [wishlist],
  );

  // Re-fetch when the wishlist changes. The backend serves this from its daily
  // snapshot, so toggling coins never triggers a re-scrape.
  useEffect(() => {
    load(false);
  }, [load]);

  const market: CoinMarketData[] = data?.market ?? [];
  const totalSupply = market.reduce((s, c) => s + c.circulatingUsd, 0);
  const offPeg = market.filter((c) => c.pegStatus === 'Minor Stress' || c.pegStatus === 'High Risk');
  const liveSources = data?.sources.filter((s) => s.ok).length ?? 0;

  return (
    <div className="min-h-screen bg-[#F4F7FE] flex p-4 gap-4">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 bg-white rounded-4xl p-8 shadow-sm border border-gray-100 overflow-y-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">Daily Crypto Forecast</h1>
              <p className="text-sm text-gray-500 mt-1">
                Live peg &amp; supply data with a plain-English read on what it means.
                {data && (
                  <span className="text-gray-400">
                    {' '}· {data.date} · {liveSources}/{data.sources.length} sources live
                  </span>
                )}
              </p>
            </div>

            <button
              onClick={() => load(true)}
              disabled={refreshing || loading}
              className="bg-brand text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-brand-dark transition disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              {refreshing ? 'Re-scraping…' : 'Refresh forecast'}
            </button>
          </div>

          {/* Wishlist picker */}
          <div className="bg-gray-50/80 rounded-3xl p-5 border border-gray-100 mb-8">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">My wishlist</h3>
                <p className="text-xs text-gray-500">
                  {isFiltered
                    ? `Forecast scoped to ${wishlist.length} coin${wishlist.length === 1 ? '' : 's'}.`
                    : 'No coins selected — showing everything.'}
                </p>
              </div>
              {isFiltered && (
                <button
                  onClick={clear}
                  className="text-xs font-bold text-gray-500 hover:text-gray-900 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {TRACKABLE_COINS.map((symbol) => {
                const on = has(symbol);
                return (
                  <button
                    key={symbol}
                    onClick={() => toggle(symbol)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      on
                        ? 'bg-brand text-white border-brand shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-brand/40 hover:text-gray-900'
                    }`}
                  >
                    {on ? '★ ' : ''}
                    {symbol}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-6 text-sm font-medium border border-red-200">
              {error}
            </div>
          )}

          {loading && !data && (
            <div className="text-center py-16 text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mx-auto mb-4" />
              <p className="text-sm font-medium">Collecting today's data…</p>
            </div>
          )}

          {data && (
            <>
              {/* Today's outlook — the "weather report" */}
              <div className="bg-gradient-to-br from-purple-50 to-blue-50/50 rounded-3xl p-6 border border-purple-100 mb-8">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h2 className="text-lg font-black text-gray-900">Today's outlook</h2>
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full whitespace-nowrap ${
                      data.narrative.generatedBy === 'gonka'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {data.narrative.generatedBy === 'gonka' ? `Gonka AI` : 'Demo text'}
                  </span>
                </div>
                <p className="text-base font-bold text-gray-900 leading-snug mb-2">
                  {data.narrative.headline}
                </p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {data.narrative.outlook}
                </p>

                {data.narrative.whatChanged.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-purple-100">
                    <p className="text-xs font-bold uppercase tracking-wider text-purple-700 mb-2">
                      What changed
                    </p>
                    <ul className="space-y-1">
                      {data.narrative.whatChanged.map((c, i) => (
                        <li key={i} className="text-sm text-gray-700 flex gap-2">
                          <span className="text-purple-400">•</span>
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Computed-from-real-data metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-purple-50/70 p-5 rounded-3xl border border-purple-100">
                  <p className="text-xs font-bold uppercase tracking-wider text-purple-700 mb-1">
                    Stablecoin supply on Sui
                  </p>
                  <h3 className="text-2xl font-black text-gray-900">{formatUsd(totalSupply)}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    across {market.length} asset{market.length === 1 ? '' : 's'} · DefiLlama
                  </p>
                </div>

                <div className="bg-emerald-50/70 p-5 rounded-3xl border border-emerald-100">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1">
                    Holding peg
                  </p>
                  <h3 className="text-2xl font-black text-gray-900">
                    {market.length - offPeg.length}/{market.length}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {offPeg.length === 0 ? 'no coins off peg' : `${offPeg.map((c) => c.symbol).join(', ')} off peg`}
                  </p>
                </div>

                <div className="bg-blue-50/70 p-5 rounded-3xl border border-blue-100">
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-1">
                    Headlines today
                  </p>
                  <h3 className="text-2xl font-black text-gray-900">{data.news.length}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    from {liveSources} live source{liveSources === 1 ? '' : 's'}
                  </p>
                </div>
              </div>

              {/* Asset table — all live */}
              <div className="border border-gray-100 rounded-3xl overflow-hidden shadow-xs mb-8">
                <div className="bg-gray-50/80 px-6 py-4 border-b border-gray-100 grid grid-cols-12 text-xs font-bold text-gray-500 uppercase tracking-wider gap-4">
                  <div className="col-span-4">Asset</div>
                  <div className="col-span-2">Price</div>
                  <div className="col-span-2">Peg deviation</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2 text-right">Supply on Sui</div>
                </div>

                <div className="divide-y divide-gray-100">
                  {market.length === 0 && (
                    <div className="px-6 py-10 text-center text-sm text-gray-400">
                      No market data for this selection.
                    </div>
                  )}
                  {market.map((asset) => (
                    <div
                      key={asset.symbol}
                      className="px-6 py-4 grid grid-cols-12 items-center hover:bg-gray-50/50 transition-colors gap-4"
                    >
                      <div className="col-span-4 flex items-center gap-3">
                        <StarToggle
                          on={has(asset.symbol)}
                          onClick={() => toggle(asset.symbol)}
                        />
                        <div
                          onClick={() => navigate(`/coin/${asset.symbol}`)}
                          className="flex items-center gap-3 cursor-pointer min-w-0"
                        >
                          <div className="w-9 h-9 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-xs shrink-0">
                            {asset.symbol.slice(0, 3)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-gray-900 truncate">{asset.symbol}</h4>
                            <p className="text-xs text-gray-400 truncate">{asset.mechanism}</p>
                          </div>
                        </div>
                      </div>

                      <div className="col-span-2 text-sm font-bold text-gray-900">
                        {asset.price === null ? '—' : `$${asset.price.toFixed(4)}`}
                      </div>

                      <div className="col-span-2">
                        {asset.pegDeviationBps === null ? (
                          <span className="text-xs text-gray-400">n/a</span>
                        ) : (
                          <span
                            className={`text-sm font-bold ${
                              Math.abs(asset.pegDeviationBps) <= 30
                                ? 'text-gray-700'
                                : asset.pegDeviationBps > 0
                                  ? 'text-emerald-600'
                                  : 'text-rose-600'
                            }`}
                          >
                            {asset.pegDeviationBps > 0 ? '+' : ''}
                            {asset.pegDeviationBps} bps
                          </span>
                        )}
                      </div>

                      <div className="col-span-2">
                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${PEG_STYLES[asset.pegStatus]}`}
                        >
                          {asset.pegStatus}
                        </span>
                      </div>

                      <div className="col-span-2 text-right text-sm font-black text-gray-900">
                        {formatUsd(asset.circulatingUsd)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Per-coin narrative + news */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  <h2 className="text-lg font-bold text-gray-900">
                    {isFiltered ? 'Your coins, explained' : 'Coin-by-coin'}
                  </h2>

                  {data.narrative.perCoin.length === 0 && (
                    <p className="text-sm text-gray-400 italic">
                      No per-coin narrative for this selection.
                    </p>
                  )}

                  {data.narrative.perCoin.map((coin) => (
                    <div
                      key={coin.symbol}
                      className="bg-white rounded-3xl p-5 border border-gray-100 shadow-xs"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-[10px]">
                          {coin.symbol.slice(0, 3)}
                        </div>
                        <h3 className="font-black text-gray-900">{coin.symbol}</h3>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {coin.narrative}
                      </p>
                      {coin.watchItems.length > 0 && (
                        <ul className="mt-3 space-y-1 border-t border-gray-100 pt-3">
                          {coin.watchItems.map((w, i) => (
                            <li key={i} className="text-xs text-gray-500 flex gap-2">
                              <span className="text-amber-400">▸</span>
                              {w}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}

                  <p className="text-xs text-gray-400 leading-relaxed pt-2">
                    Informational only — this is a summary of public data and news, not
                    investment advice, and it does not tell you what to buy or sell.
                  </p>
                </div>

                {/* Headlines */}
                <div className="lg:col-span-1">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Today's headlines</h2>
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                    {data.news.length === 0 && (
                      <p className="text-sm text-gray-400 italic">No headlines for this selection.</p>
                    )}
                    {data.news.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() =>
                          navigate('/forecast/news', { state: { title: item.title, url: item.link } })
                        }
                        className="block p-4 rounded-xl bg-gray-50/80 border border-gray-100 hover:border-brand/30 hover:bg-white transition-all cursor-pointer"
                      >
                        <h4 className="text-sm font-bold text-gray-900 leading-snug mb-1.5">
                          {item.title}
                        </h4>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            {item.sourceName}
                          </span>
                          {item.publishedAt && (
                            <span className="text-[10px] text-gray-400">· {formatAge(item.publishedAt)}</span>
                          )}
                          {item.coins.map((c) => (
                            <span
                              key={c}
                              className="text-[9px] font-black uppercase bg-brand/10 text-brand px-1.5 py-0.5 rounded"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Source transparency — what was actually live this run. */}
                  <div className="mt-5 pt-4 border-t border-gray-100">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                      Sources this run
                    </p>
                    <div className="space-y-1">
                      {data.sources.map((s) => (
                        <div key={s.name} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-gray-600">
                            <span className={s.ok ? 'text-emerald-500' : 'text-rose-400'}>
                              {s.ok ? '●' : '○'}
                            </span>
                            {s.name}
                          </span>
                          <span className="text-gray-400">
                            {s.ok ? `${s.items} items` : (s.note ?? 'failed')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
