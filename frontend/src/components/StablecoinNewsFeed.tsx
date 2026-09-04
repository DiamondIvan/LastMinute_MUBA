import { useNavigate } from 'react-router-dom';

interface NewsItem {
  id: string;
  title: string;
  source: string;
  time: string;
  tag: string;
  tagColor: string;
}

const NEWS_ITEMS: NewsItem[] = [
  {
    id: '1',
    title: 'USDsui Reserve Yield Allocations Expand SUI Buyback Program',
    source: 'Sui Foundation',
    time: '2h ago',
    tag: 'Yield',
    tagColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    id: '2',
    title: 'DeepBook CLOB Records Spike in Native USDC/USDsui Swaps',
    source: 'DeFi Llama',
    time: '5h ago',
    tag: 'Liquidity',
    tagColor: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    id: '3',
    title: 'FDUSD Publishes Monthly Attestation with 100% Cash Backing',
    source: 'Reserve Audit',
    time: '12h ago',
    tag: 'Audit',
    tagColor: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    id: '4',
    title: 'Bucket Protocol Risk Desk: BUCK Collateral Ratio Safe at 142%',
    source: 'Risk Desk',
    time: '1d ago',
    tag: 'Risk',
    tagColor: 'bg-purple-50 text-purple-700 border-purple-200',
  },
];

export function StablecoinNewsFeed() {
  const navigate = useNavigate();

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col h-full">
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Latest News & Alerts</h3>
                <p className="text-xs text-gray-500">
                  On-chain order book &amp; macro updates (via DeepBook V3)
                </p>
              </div>
              <button
                onClick={() => navigate('/forecast')}
                className="text-xs font-bold text-brand hover:underline flex items-center gap-1 cursor-pointer"
              >
                View All &rarr;
              </button>
            </div>

      <div className="divide-y divide-gray-50 flex-1 flex flex-col justify-between pt-2">
        {NEWS_ITEMS.map((item) => (
          <div
            key={item.id}
            onClick={() => navigate('/forecast')}
            className="py-3.5 px-2 rounded-2xl cursor-pointer hover:bg-gray-50 transition-colors flex flex-col gap-1.5"
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${item.tagColor}`}>
                {item.tag}
              </span>
              <span className="text-[11px] text-gray-400">{item.time}</span>
            </div>
            <h4 className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2">
              {item.title}
            </h4>
            <p className="text-xs text-gray-400">{item.source}</p>
          </div>
        ))}
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