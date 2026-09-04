import { useState, useEffect, useCallback } from 'react';
import { useCurrentAccount, useCurrentClient, useDAppKit } from '@mysten/dapp-kit-react';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import { DEMO_REPORT_OBJECT_ID, REPORT_PRICE_MIST, RESEARCH_ACCESS_TYPE, contractsConfigured } from '../contracts/constants';
import { buildPurchaseReportTx } from '../contracts/purchaseReport';
import { useOnChainReport } from '../hooks/useOnChainReport';
import { SignalsPanel } from '../components/SignalsPanel';
import { PaperTradingPanel } from '../components/PaperTradingPanel';
import {
  fetchSignals,
  fetchPaperLedger,
  openPaperPosition,
  closePaperPosition,
  type SignalsSnapshot,
  type PaperLedger,
} from '../api';

/**
 * A real on-chain purchase — calls news_platform::purchase_report and mints
 * a ResearchAccess object.
 *
 * This used to be a "Buy Stablecoins" flow that just split SUI and sent it to
 * CONFIG_ID: no Move call, no minted object, framed as buying USDC/FDUSD/BUCK/
 * USDsui. That mapped onto nothing real — this project has no swap/DEX
 * contract deployed at all, and DeepBook can't fill the gap either: its
 * testnet pools carry no liquidity (see lib/deepbook.ts), so a real swap
 * would abort on every call. purchase_report is the only genuine
 * token-moving call this contract actually has, so that's what this screen
 * does now: buy access to the one registered demo report, for real.
 */
export function TransactionScreen() {
  const account = useCurrentAccount();
  const client = useCurrentClient();
  const dAppKit = useDAppKit();
  const { report, loading: reportLoading, error: reportError } = useOnChainReport(
    DEMO_REPORT_OBJECT_ID || null,
  );

  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [alreadyOwned, setAlreadyOwned] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(false);

  // --- AI signals (read from a daily cache; never blocks a user action) ---
  const [signals, setSignals] = useState<SignalsSnapshot | null>(null);
  const [signalsLoading, setSignalsLoading] = useState(true);
  const [signalsRefreshing, setSignalsRefreshing] = useState(false);
  const [signalsError, setSignalsError] = useState<string | null>(null);

  const loadSignals = useCallback(async (refresh = false) => {
    refresh ? setSignalsRefreshing(true) : setSignalsLoading(true);
    setSignalsError(null);
    try {
      setSignals(await fetchSignals(refresh));
    } catch (e) {
      setSignalsError(e instanceof Error ? e.message : 'Failed to load signals');
    } finally {
      setSignalsLoading(false);
      setSignalsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadSignals(false);
  }, [loadSignals]);

  // --- Paper trading ledger (simulated; keyed by wallet address) ---
  const [ledger, setLedger] = useState<PaperLedger | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [ledgerBusy, setLedgerBusy] = useState(false);

  const loadLedger = useCallback(async () => {
    if (!account?.address) {
      setLedger(null);
      return;
    }
    setLedgerLoading(true);
    setLedgerError(null);
    try {
      setLedger(await fetchPaperLedger(account.address));
    } catch (e) {
      setLedgerError(e instanceof Error ? e.message : 'Failed to load portfolio');
    } finally {
      setLedgerLoading(false);
    }
  }, [account?.address]);

  useEffect(() => {
    void loadLedger();
  }, [loadLedger]);

  const handleOpenPosition = async (symbol: string, notionalUsd: number) => {
    if (!account?.address) return;
    setLedgerBusy(true);
    setLedgerError(null);
    try {
      await openPaperPosition(account.address, symbol, notionalUsd);
      await loadLedger();
    } catch (e) {
      setLedgerError(e instanceof Error ? e.message : 'Failed to open position');
    } finally {
      setLedgerBusy(false);
    }
  };

  const handleClosePosition = async (positionId: string) => {
    if (!account?.address) return;
    setLedgerBusy(true);
    setLedgerError(null);
    try {
      await closePaperPosition(account.address, positionId);
      await loadLedger();
    } catch (e) {
      setLedgerError(e instanceof Error ? e.message : 'Failed to close position');
    } finally {
      setLedgerBusy(false);
    }
  };

  const checkAccess = useCallback(async () => {
    if (!account?.address || !DEMO_REPORT_OBJECT_ID) return;
    setCheckingAccess(true);
    try {
      const res = await client.listOwnedObjects({
        owner: account.address,
        type: RESEARCH_ACCESS_TYPE,
        limit: 50,
        include: { json: true },
      } as Parameters<typeof client.listOwnedObjects>[0]);
      const owns = (res.objects as any[]).some(
        (o) => (o.json as any)?.report_id === DEMO_REPORT_OBJECT_ID,
      );
      setAlreadyOwned(owns);
    } catch (e) {
      console.warn('Failed to check existing access:', e);
    } finally {
      setCheckingAccess(false);
    }
  }, [account?.address, client]);

  useEffect(() => {
    void checkAccess();
  }, [checkAccess]);

  const handlePurchase = async () => {
    if (!account || !DEMO_REPORT_OBJECT_ID) return;
    setError(null);
    setTxDigest(null);
    setIsPending(true);
    try {
      const tx = buildPurchaseReportTx(DEMO_REPORT_OBJECT_ID);
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      if (result.$kind === 'FailedTransaction') {
        throw new Error(`Transaction failed: ${JSON.stringify(result.FailedTransaction.status)}`);
      }
      setTxDigest(result.Transaction?.digest ?? 'Success');
      await checkAccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Transaction failed');
    } finally {
      setIsPending(false);
    }
  };

  const priceSui = (REPORT_PRICE_MIST / 1_000_000_000).toString();

  return (
    <div className="min-h-screen bg-[#F4F7FE] flex p-4 gap-4">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 bg-white rounded-4xl p-8 shadow-sm border border-gray-100 overflow-y-auto">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            {/* Left: the real on-chain purchase */}
            <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-lg">
            <h2 className="text-2xl font-black text-gray-900 mb-2">Purchase Report Access</h2>
            <p className="text-sm text-gray-500 mb-6">
              Calls <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">purchase_report</code> on
              Sui testnet — mints a real, on-chain <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">ResearchAccess</code> object.
            </p>

            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-6">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Report</p>
              {reportLoading ? (
                <p className="text-sm text-gray-400">Loading on-chain report…</p>
              ) : reportError ? (
                <p className="text-sm text-rose-500">Could not load the report: {reportError}</p>
              ) : report ? (
                <>
                  <p className="font-bold text-gray-900">{report.title || '(untitled)'}</p>
                  <p className="text-xs text-gray-400 break-all mt-1">content hash {report.contentHash}</p>
                </>
              ) : (
                <p className="text-sm text-rose-500">No report configured.</p>
              )}
            </div>

            <div className="flex items-center justify-between px-2 mb-6">
              <span className="text-sm font-bold text-gray-500">Price</span>
              <span className="text-xl font-black text-gray-900">{priceSui} SUI</span>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 text-sm font-bold p-3 rounded-xl border border-red-100 mb-4">
                {error}
              </div>
            )}
            {txDigest && (
              <div className="bg-emerald-50 text-emerald-700 text-sm font-bold p-4 rounded-xl border border-emerald-100 break-words mb-4">
                Purchase successful — ResearchAccess minted.
                <br />
                <a
                  href={`https://suiscan.xyz/testnet/tx/${txDigest}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline text-emerald-800 text-xs mt-2 inline-block"
                >
                  View on Explorer
                </a>
              </div>
            )}

            {!account ? (
              <div className="bg-amber-50 text-amber-800 text-sm font-bold p-4 rounded-xl text-center border border-amber-200">
                Please connect your wallet to transact.
              </div>
            ) : !contractsConfigured() ? (
              <div className="bg-amber-50 text-amber-800 text-sm font-bold p-4 rounded-xl text-center border border-amber-200">
                Contract not configured.
              </div>
            ) : alreadyOwned ? (
              <div className="bg-blue-50 text-blue-800 text-sm font-bold p-4 rounded-xl text-center border border-blue-200">
                ✓ You already own access to this report.
              </div>
            ) : (
              <button
                onClick={handlePurchase}
                disabled={isPending || checkingAccess || !report}
                className="w-full bg-brand text-white font-black text-lg py-4 rounded-2xl hover:bg-brand/90 transition-all shadow-md shadow-brand/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isPending ? 'Confirm in Wallet…' : `Purchase — ${priceSui} SUI`}
              </button>
            )}
            </div>

            {/* Middle: descriptive AI signals */}
            <SignalsPanel
              data={signals}
              loading={signalsLoading}
              error={signalsError}
              onRefresh={() => void loadSignals(true)}
              refreshing={signalsRefreshing}
            />

            {/* Right: simulated portfolio */}
            {account ? (
              <PaperTradingPanel
                ledger={ledger}
                signals={signals}
                loading={ledgerLoading}
                error={ledgerError}
                busy={ledgerBusy}
                onOpen={handleOpenPosition}
                onClose={handleClosePosition}
              />
            ) : (
              <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
                <h3 className="text-lg font-black text-gray-900 mb-1">Paper Portfolio</h3>
                <p className="text-sm text-gray-500">
                  Connect a wallet to track simulated positions. Nothing here moves real funds.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
