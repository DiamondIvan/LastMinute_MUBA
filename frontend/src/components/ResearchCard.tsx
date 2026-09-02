import { useState } from 'react';
import { useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react';
import { research, unlockReport, ApiError, type ResearchResponse } from '../api';
import { getSessionToken, clearSession } from '../lib/session';
import { buildPurchaseReportTx } from '../contracts/purchaseReport';
import { contractsConfigured } from '../contracts/constants';

const sentimentStyle: Record<string, string> = {
  bullish: 'bg-widget-green text-green-900',
  bearish: 'bg-widget-pink text-pink-900',
  neutral: 'bg-widget-blue text-blue-900',
  mixed: 'bg-widget-purple text-brand-dark',
};

function Chip({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-semibold ${tone ?? 'bg-gray-100 text-gray-700'}`}
    >
      {label} {value}
    </span>
  );
}

/**
 * The full premium flow: ask the AI, read the free summary, buy access on-chain,
 * then unlock the body.
 *
 * Unlocking requires a wallet signature — the backend derives the caller address
 * from the resulting session token rather than trusting one we send it
 * (docs/SECURITY.md, Finding 1).
 */
export function ResearchCard({
  reportObjectId,
  onPurchased,
}: {
  reportObjectId: string;
  onPurchased?: () => void;
}) {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();

  const [question, setQuestion] = useState("What's happening with Bitcoin?");
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
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

  async function unlock(contentHash: string) {
    if (!account) return;
    const address = account.address;
    let token = await getSessionToken(address, (args) => dAppKit.signPersonalMessage(args));

    // The ResearchAccess object can lag a beat behind transaction finality.
    for (let i = 0; i < 4; i++) {
      try {
        const { full: body } = await unlockReport(contentHash, token);
        setFull(body);
        return;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401 && i === 0) {
          clearSession(address);
          token = await getSessionToken(address, (args) => dAppKit.signPersonalMessage(args));
          continue;
        }
        if (i === 3) throw e;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }

  async function purchaseAndUnlock() {
    if (!result || !account) return;
    setPurchasing(true);
    setError(null);
    try {
      const tx = await dAppKit.signAndExecuteTransaction({
        transaction: buildPurchaseReportTx(reportObjectId),
      });
      if (tx.$kind === 'FailedTransaction') {
        throw new Error(`Transaction failed: ${JSON.stringify(tx.FailedTransaction.status)}`);
      }
      onPurchased?.();
      await unlock(result.contentHash);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPurchasing(false);
    }
  }

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 mb-8">
      <h3 className="text-lg font-bold text-gray-800">Ask the research agents</h3>
      <p className="text-sm text-gray-500 mb-4">
        Multi-agent pipeline: web research, source credibility, analysis, synthesis.
      </p>

      <div className="flex gap-3 flex-col sm:flex-row">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="flex-1 px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand/40"
          placeholder="What do you want to know?"
        />
        <button
          onClick={runResearch}
          disabled={loading || !question.trim()}
          className="bg-brand hover:bg-brand-dark text-white font-bold px-6 py-3 rounded-2xl transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer"
        >
          {loading ? 'Researching…' : 'Research'}
        </button>
      </div>

      {error && <p className="text-sm text-pink-600 mt-3">{error}</p>}

      {result && (
        <div className="mt-6">
          <h4 className="font-bold text-gray-800">{result.title}</h4>

          <div className="flex gap-2 flex-wrap mt-2">
            <Chip
              label="Sentiment"
              value={result.analysis.sentiment}
              tone={sentimentStyle[result.analysis.sentiment]}
            />
            <Chip label="Confidence" value={`${Math.round(result.analysis.confidence * 100)}%`} />
            <Chip label="Risk" value={result.analysis.risk} />
          </div>

          <pre className="whitespace-pre-wrap text-sm text-gray-700 mt-4 font-sans">
            {result.summary}
          </pre>

          {result.sources.length > 0 && (
            <p className="text-xs text-gray-400 mt-3">
              {result.sources.length} source{result.sources.length === 1 ? '' : 's'} ·{' '}
              {result.sources
                .slice(0, 4)
                .map((s) => s.publisher)
                .join(', ')}
            </p>
          )}

          {!full && (
            <button
              onClick={purchaseAndUnlock}
              disabled={purchasing || !contractsConfigured()}
              className="mt-5 bg-brand hover:bg-brand-dark text-white font-bold px-6 py-3.5 rounded-2xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              {purchasing ? 'Confirming in wallet…' : 'Unlock Full Intelligence — 0.005 SUI'}
            </button>
          )}

          {full && (
            <div className="mt-5 bg-brand-light rounded-2xl p-5">
              <p className="font-bold text-brand-dark">✓ Unlocked — verified on Sui</p>
              <p className="text-xs text-brand-dark/70 break-all mt-1">
                content hash {result.contentHash}
              </p>
              <pre className="whitespace-pre-wrap text-sm text-gray-800 mt-3 font-sans">{full}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
