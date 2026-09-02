import { useState } from 'react';
import { useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import { KpiCards } from '../components/KpiCards';
import { GrowthChart } from '../components/GrowthChart';
import { OnChainAssetsFeed } from '../components/OnChainAssetsFeed';
import { AiBriefingCard } from '../components/AiBriefingCard';
import { useSuiBalance } from '../hooks/useSuiBalance';
import { useResearchAccess } from '../hooks/useResearchAccess';
import { buildPurchaseReportTx } from '../contracts/purchaseReport';
import { contractsConfigured } from '../contracts/constants';

export function DashboardScreen() {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const { balance, loading: balanceLoading, refreshBalance } = useSuiBalance();
    const { objects: reports, loading: accessLoading, reload: reloadAccess } = useResearchAccess();
    const reportCount = reports.length;
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const demoReportId = '0x0047c06a35bf05d6148797eeeeada97d134f64410ff65ed88e8792770df87b9b';

  async function handleUnlockReport() {
    if (!account) return;
    setPurchasing(true);
    setPurchaseError(null);
    try {
      const result = await dAppKit.signAndExecuteTransaction({
        transaction: buildPurchaseReportTx(demoReportId),
      });

      if (result.$kind === 'FailedTransaction') {
        throw new Error(`Transaction failed: ${JSON.stringify(result.FailedTransaction.status)}`);
      }

      alert('Intelligence unlocked successfully! ResearchAccess object minted to your wallet.');
      reloadAccess();
      refreshBalance();
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : String(err));
    } finally {
      setPurchasing(false);
    }
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
            reportCount={reportCount} 
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
          <AiBriefingCard 
            onUnlock={handleUnlockReport} 
            purchasing={purchasing} 
            purchaseError={purchaseError} 
            canPurchase={contractsConfigured()} 
          />
        </main>
      </div>
    </div>
  );
}