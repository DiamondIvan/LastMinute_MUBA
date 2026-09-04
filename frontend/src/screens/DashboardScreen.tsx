import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import { KpiCards } from '../components/KpiCards';
import { StablecoinTracker } from '../components/StablecoinTracker';
import { StablecoinNewsFeed } from '../components/StablecoinNewsFeed';
import { useSuiBalance } from '../hooks/useSuiBalance';
import { useStablecoinBalances } from '../hooks/useStablecoinBalances';

export function DashboardScreen() {
  const { balance, loading: balanceLoading } = useSuiBalance();
  const { tokens, totalStableUsd } = useStablecoinBalances();

  const SUI_TESTNET_EST_PRICE = 1.65;
  const totalPortfolioUsd = (Number(balance) * SUI_TESTNET_EST_PRICE + totalStableUsd).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  return (
    <div className="min-h-screen bg-[#F4F7FE] flex p-4 gap-4">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 bg-white rounded-4xl p-8 shadow-sm border border-gray-100 overflow-y-auto">
          <KpiCards
            balance={balance}
            balanceLoading={balanceLoading}
            estimatedUsdValue={totalPortfolioUsd}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2">
              <StablecoinTracker liveTokens={tokens} />
            </div>
            <div>
              <StablecoinNewsFeed />
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}