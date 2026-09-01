import { useState } from 'react';
import { DAppKitProvider, useCurrentAccount } from '@mysten/dapp-kit-react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { dAppKit } from './dapp-kit';
import { PurchaseButton } from './components/PurchaseButton';
import { useResearchAccess } from './hooks/useResearchAccess';
import { contractsConfigured } from './contracts/constants';
import { research, unlockReport, type ResearchResponse } from './api';

function WalletPanel() {
  const account = useCurrentAccount();
  return (
    <div className="card">
      <ConnectButton />
      <p className="muted">{account ? `Connected: ${account.address}` : 'Wallet not connected'}</p>
    </div>
  );
}

function AnalysisChips({ a }: { a: ResearchResponse['analysis'] }) {
  return (
    <p className="muted">
      Sentiment: <strong>{a.sentiment}</strong> · Confidence:{' '}
      <strong>{Math.round(a.confidence * 100)}%</strong> · Risk: <strong>{a.risk}</strong>
    </p>
  );
}

function ResearchPanel() {
  const account = useCurrentAccount();
  const { reload } = useResearchAccess();

  const [question, setQuestion] = useState("What's happening with Bitcoin?");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResearchResponse | null>(null);
  const [full, setFull] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runResearch() {
    setLoading(true);
    setError(null);
    setResult(null);
    setFull(null);
    try {
      setResult(await research(question.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function unlock() {
    if (!result || !account) return;
    // The ResearchAccess object can lag a beat behind tx finality.
    for (let i = 0; i < 4; i++) {
      try {
        const { full: body } = await unlockReport(result.contentHash, account.address);
        setFull(body);
        return;
      } catch (e) {
        if (i === 3) setError(e instanceof Error ? e.message : String(e));
        else await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }

  return (
    <div className="card">
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}
      />
      <button onClick={runResearch} disabled={loading || !question.trim()}>
        {loading ? 'Researching…' : 'Research'}
      </button>
      {error && <p className="muted">{error}</p>}

      {result && (
        <div style={{ marginTop: '1rem' }}>
          <strong>{result.title}</strong>
          <AnalysisChips a={result.analysis} />
          <pre style={{ whiteSpace: 'pre-wrap' }}>{result.summary}</pre>

          {!full && result.reportObjectId && (
            <PurchaseButton reportObjectId={result.reportObjectId} onPurchased={() => { void unlock(); void reload(); }} />
          )}
          {!full && !result.reportObjectId && (
            <p className="muted">Set DEMO_REPORT_OBJECT_ID in backend/.env to enable unlocking.</p>
          )}

          {full && (
            <div className="card">
              <strong>✓ Verified on Sui — full report</strong>
              <p className="muted">content hash: {result.contentHash}</p>
              <pre style={{ whiteSpace: 'pre-wrap' }}>{full}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AccessPanel() {
  const { objects, loading, error } = useResearchAccess();
  if (!contractsConfigured()) return null;
  return (
    <div className="card">
      <strong>Your on-chain research access</strong>
      {loading && <p className="muted">Loading…</p>}
      {error && <p className="muted">{error}</p>}
      {!loading && !error && objects.length === 0 && <p className="muted">None yet.</p>}
      <ul>
        {objects.map((o) => (
          <li key={o.objectId} className="muted">
            {o.objectId} → report {o.reportId ?? '?'}
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
      <ResearchPanel />
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
