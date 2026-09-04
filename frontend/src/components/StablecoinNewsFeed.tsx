import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStablecoinAnalysis } from '../api';
import type { StablecoinAnalysisResponse } from '../api';

export function StablecoinNewsFeed() {
  const navigate = useNavigate();
  const [data, setData] = useState<StablecoinAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStablecoinAnalysis()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Filter to show important news first, or limit to 4
  const newsToShow = data?.news.slice(0, 4) || [];

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col h-full min-h-[400px]">
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Latest News & Alerts</h3>
          <p className="text-xs text-gray-500">
            Synced with Latest Forecast
          </p>
        </div>
        <button
          onClick={() => navigate('/forecast')}
          className="text-xs font-bold text-brand hover:underline flex items-center gap-1 cursor-pointer"
        >
          View All &rarr;
        </button>
      </div>

      <div className="divide-y divide-gray-50 flex-1 flex flex-col pt-2 overflow-y-auto">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400 font-medium py-12">
            Loading synced news...
          </div>
        ) : newsToShow.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400 font-medium py-12">
            No recent news.
          </div>
        ) : (
          newsToShow.map((item, idx) => {
            const isImportant = data?.importantNewsIndices?.includes(idx);
            return (
              <div
                key={idx}
                onClick={() => navigate('/forecast/news', { state: { title: item.title, url: item.link } })}
                className="py-3.5 px-2 rounded-2xl cursor-pointer hover:bg-gray-50 transition-colors flex flex-col gap-1.5 relative"
              >
                {isImportant && (
                  <span className="absolute top-3 right-2 text-[9px] font-black uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                    Mover
                  </span>
                )}
                <h4 className={`text-sm font-semibold leading-snug line-clamp-2 pr-10 ${isImportant ? 'text-amber-900' : 'text-gray-800'}`}>
                  {item.title}
                </h4>
                <p className="text-xs text-gray-400 uppercase tracking-wider">{new URL(item.source).hostname.replace('www.', '')}</p>
              </div>
            );
          })
        )}
      </div>

      <button
        onClick={() => navigate('/forecast')}
        className="mt-4 w-full py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100/70 text-brand text-xs font-bold transition-all text-center cursor-pointer"
      >
        Go to Latest Forecast
      </button>
    </div>
  );
}