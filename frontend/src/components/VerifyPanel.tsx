import { useState } from 'react';
import { useOnChainReport } from '../hooks/useOnChainReport';
import { sha256Hex } from '../lib/hash';

type Verdict =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'verified'; localHash: string }
  | { kind: 'failed'; localHash: string; chainHash: string }
  | { kind: 'error'; message: string };

interface Props {
  reportObjectId: string;
  /** Report text to check. Editable so a demo can tamper with it. */
  initialText?: string;
}

/**
 * Proves a report is the exact version registered on Sui.
 *
 * The check is fully client-side against the chain: we hash the text in the
 * browser and compare to the `content_hash` read from the on-chain
 * `ResearchReport`. Our backend is not trusted, or even involved.
 */
export function VerifyPanel({ reportObjectId, initialText = '' }: Props) {
  const { report, loading, error } = useOnChainReport(reportObjectId);
  const [text, setText] = useState(initialText);
  const [verdict, setVerdict] = useState<Verdict>({ kind: 'idle' });

  async function verify() {
    if (!report) return;
    setVerdict({ kind: 'checking' });
    try {
      const localHash = await sha256Hex(text);
      setVerdict(
        localHash === report.contentHash
          ? { kind: 'verified', localHash }
          : { kind: 'failed', localHash, chainHash: report.contentHash },
      );
    } catch (e) {
      setVerdict({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
      <h3 className="text-lg font-bold text-gray-800">Verify research against Sui</h3>
      <p className="text-sm text-gray-500">
        Hashed in your browser and compared to the on-chain record — no server involved. Edit one
        character below and verification will fail.
      </p>

      {loading && <p className="text-sm text-gray-400 mt-3">Reading the on-chain report…</p>}
      {error && <p className="text-sm text-pink-600 mt-3">Could not read report: {error}</p>}

      {report && (
        <>
          <div className="mt-4 text-xs text-gray-500 space-y-0.5">
            <p>
              On-chain: <span className="font-semibold text-gray-700">{report.title || '(untitled)'}</span>
            </p>
            <p className="break-all">creator {report.creator}</p>
            <p className="break-all">content hash {report.contentHash}</p>
            {report.walrusBlobId && <p className="break-all">walrus blob {report.walrusBlobId}</p>}
          </div>

          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setVerdict({ kind: 'idle' });
            }}
            rows={10}
            className="w-full mt-4 px-4 py-3 rounded-2xl border border-gray-200 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-brand/40"
            placeholder="Paste the report text to verify…"
          />

          <button
            onClick={verify}
            disabled={!text || verdict.kind === 'checking'}
            className="mt-3 bg-brand hover:bg-brand-dark text-white font-bold px-6 py-3 rounded-2xl transition-all disabled:opacity-50 cursor-pointer"
          >
            {verdict.kind === 'checking' ? 'Hashing…' : 'Verify'}
          </button>

          {verdict.kind === 'verified' && (
            <div className="mt-4 rounded-2xl p-5 bg-widget-green">
              <p className="font-bold text-green-900">✓ VERIFIED ON SUI</p>
              <div className="text-xs text-green-900/80 mt-2 space-y-0.5">
                <p>This is the exact text registered on-chain.</p>
                <p className="break-all">creator {report.creator}</p>
                <p>
                  registered{' '}
                  {report.createdAt ? new Date(report.createdAt).toUTCString() : 'unknown'}
                </p>
                <p className="break-all">hash {verdict.localHash}</p>
              </div>
              <p className="text-xs text-green-900/60 mt-3">
                This proves this exact version existed and was registered by that wallet — a
                provenance and integrity record, not a legal copyright claim.
              </p>
            </div>
          )}

          {verdict.kind === 'failed' && (
            <div className="mt-4 rounded-2xl p-5 bg-widget-pink">
              <p className="font-bold text-pink-900">✗ VERIFICATION FAILED</p>
              <div className="text-xs text-pink-900/80 mt-2 space-y-0.5">
                <p>This text does not match the version registered on Sui.</p>
                <p className="break-all">on-chain {verdict.chainHash}</p>
                <p className="break-all">this text {verdict.localHash}</p>
              </div>
            </div>
          )}

          {verdict.kind === 'error' && (
            <p className="text-sm text-pink-600 mt-3">{verdict.message}</p>
          )}
        </>
      )}
    </div>
  );
}
