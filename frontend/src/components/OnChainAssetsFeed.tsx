interface OnChainAssetsFeedProps {
  reports: any[];
}

export function OnChainAssetsFeed({ reports }: OnChainAssetsFeedProps) {
  return (
    <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 flex flex-col">
      <h3 className="font-bold text-lg text-gray-800 mb-1">On-Chain Assets</h3>
      <p className="text-xs text-gray-400 mb-4">Your owned ResearchAccess objects</p>
      
      <div className="flex-1 overflow-y-auto space-y-3 max-h-60">
        {reports.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            No active report accesses found in this wallet.
          </div>
        ) : (
          reports.map((r, idx) => (
            <div key={idx} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-800 truncate w-36">Report ID:</p>
                <p className="text-[10px] text-gray-400 font-mono truncate w-36">{r.reportId}</p>
              </div>
              <span className="bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-xl text-[10px] font-semibold">Unlocked</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}