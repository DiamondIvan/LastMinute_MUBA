interface KpiCardsProps {
  balance: string;
  balanceLoading: boolean;
  reportCount: number;
  accessLoading: boolean;
}

export function KpiCards({ balance, balanceLoading, reportCount, accessLoading }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div className="bg-brand text-white p-6 rounded-3xl shadow-md shadow-brand/10">
        <p className="text-white/80 text-xs font-semibold uppercase tracking-wider mb-2">My SUI Balance</p>
        <h2 className="text-3xl font-extrabold">{balanceLoading ? '...' : `${balance} SUI`}</h2>
      </div>
      <div className="bg-purple-50 p-6 rounded-3xl border border-purple-100">
        <p className="text-purple-600 text-xs font-semibold uppercase tracking-wider mb-2">Active Passes</p>
        <h2 className="text-3xl font-extrabold text-gray-900">0</h2>
      </div>
      <div className="bg-pink-50 p-6 rounded-3xl border border-pink-100">
        <p className="text-pink-600 text-xs font-semibold uppercase tracking-wider mb-2">Reports Unlocked</p>
        <h2 className="text-3xl font-extrabold text-gray-900">{accessLoading ? '...' : reportCount}</h2>
      </div>
      <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
        <p className="text-blue-600 text-xs font-semibold uppercase tracking-wider mb-2">Agent Status</p>
        <h2 className="text-3xl font-extrabold text-gray-900 flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span> Online
        </h2>
      </div>
    </div>
  );
}