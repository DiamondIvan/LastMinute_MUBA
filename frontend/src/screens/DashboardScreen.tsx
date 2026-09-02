import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import { KpiCards } from '../components/KpiCards';
import { GrowthChart } from '../components/GrowthChart';
import { OnChainAssetsFeed } from '../components/OnChainAssetsFeed';
import { ResearchCard } from '../components/ResearchCard';
import { VerifyPanel } from '../components/VerifyPanel';
import { useSuiBalance } from '../hooks/useSuiBalance';
import { useResearchAccess } from '../hooks/useResearchAccess';
import { DEMO_REPORT_OBJECT_ID } from '../contracts/constants';
import { DEMO_REPORT_TEXT } from '../demoReport';

export function DashboardScreen() {
  const { balance, loading: balanceLoading, refreshBalance } = useSuiBalance();
  const {
    objects: reports,
    loading: accessLoading,
    reload: reloadAccess,
  } = useResearchAccess();

  function afterPurchase() {
    reloadAccess();
    refreshBalance();
  }

  return (
    <div className="min-h-screen bg-[#F4F7FE] flex p-4 gap-4">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 bg-white rounded-4xl p-8 shadow-sm border border-gray-100 overflow-y-auto">
          <KpiCards
            balance={balance}
            balanceLoading={balanceLoading}
            reportCount={reports.length}
            accessLoading={accessLoading}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2">
              <GrowthChart />
            </div>
            <div>
              <OnChainAssetsFeed reports={reports} />
            </div>
          </div>

          {/* Ask -> free summary -> buy access on-chain -> unlock the body. */}
          <ResearchCard reportObjectId={DEMO_REPORT_OBJECT_ID} onPurchased={afterPurchase} />

          {/* Browser-side integrity check against the chain. */}
          {DEMO_REPORT_OBJECT_ID && (
            <VerifyPanel reportObjectId={DEMO_REPORT_OBJECT_ID} initialText={DEMO_REPORT_TEXT} />
          )}
        </main>
      </div>
    </div>
  );
}
