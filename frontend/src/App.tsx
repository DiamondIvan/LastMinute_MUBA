import { DAppKitProvider, useCurrentAccount } from '@mysten/dapp-kit-react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { dAppKit } from './dapp-kit';
import { PurchaseButton } from './components/PurchaseButton';
import { useResearchAccess } from './hooks/useResearchAccess';
import { contractsConfigured } from './contracts/constants';

// Hard-coded while the AI backend + report registry aren't wired up yet.
// Replace with a registered ResearchReport object id once you have one.
const DEMO_REPORT_ID = '0xDEMO_RESEARCH_REPORT_OBJECT_ID';

function WalletPanel() {
  const account = useCurrentAccount();
  return (
    <div className="card">
      <ConnectButton />
      {account ? (
        <p className="muted">Connected: {account.address}</p>
      ) : (
        <p className="muted">Wallet not connected</p>
      )}
    </div>
  );
}

function AccessPanel() {
  const { objects, loading, error } = useResearchAccess();

  if (!contractsConfigured()) {
    return <p className="muted">Publish the contract and fill in src/contracts/constants.ts to enable purchases.</p>;
  }
  return (
    <div className="card">
      <strong>Your on-chain research access</strong>
      {loading && <p className="muted">Loading…</p>}
      {error && <p className="muted">{error}</p>}
      {!loading && !error && objects.length === 0 && <p className="muted">No ResearchAccess objects yet.</p>}
      <ul>
        {objects.map((o) => (
          <li key={o.objectId} className="muted">
            {o.objectId} → report {o.reportId ?? '?'} (expires {o.expiresAt ?? '?'})
          </li>
        ))}
      </ul>
    </div>
  );
}

function Marketplace() {
  return (
    <main>
      <h1>MUBA AI Intelligence Marketplace</h1>
      <p className="muted">
        AI turns news into intelligence; Sui makes it verifiable, ownable, and accessible.
      </p>

      <WalletPanel />

      <div className="card">
        <strong>BTC Intelligence Report (demo)</strong>
        <p className="muted">
          Free summary goes here once the AI backend is connected. Unlock the full report below.
        </p>
        <PurchaseButton
          reportObjectId={DEMO_REPORT_ID}
          onPurchased={(digest) => console.log('purchased, digest:', digest)}
        />
      </div>

      <AccessPanel />
    </main>
  );
}

export default function App() {
  return (
    <DAppKitProvider dAppKit={dAppKit}>
      <Marketplace />
    </DAppKitProvider>
  );
}
