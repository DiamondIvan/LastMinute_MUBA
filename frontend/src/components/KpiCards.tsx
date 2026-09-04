interface KpiCardsProps {
  balance: string;
  balanceLoading: boolean;
  estimatedUsdValue?: string; 
}

export function KpiCards({ balance, balanceLoading, estimatedUsdValue = "$0.00" }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {/* SUI Balance Card */}
      <div className="bg-brand text-white p-6 rounded-3xl shadow-md shadow-brand/10">
        <p className="text-white/80 text-xs font-semibold uppercase tracking-wider mb-2">My SUI Balance</p>
        <h2 className="text-3xl font-extrabold">{balanceLoading ? '...' : `${balance} SUI`}</h2>
      </div>

      {/* New: Estimated Total USD Balance */}
      <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
        <p className="text-emerald-600 text-xs font-semibold uppercase tracking-wider mb-2">Est. Total Balance (USD)</p>
        <h2 className="text-3xl font-extrabold text-gray-900">{balanceLoading ? '...' : estimatedUsdValue}</h2>
      </div>

      {/* Agent Status Card */}
      <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
        <p className="text-blue-600 text-xs font-semibold uppercase tracking-wider mb-2">Agent Status</p>
        <h2 className="text-3xl font-extrabold text-gray-900 flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span> Online
        </h2>
      </div>
    </div>
  );
}