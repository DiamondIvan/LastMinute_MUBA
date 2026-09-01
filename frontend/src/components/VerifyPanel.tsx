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
 * `ResearchReport`. Our backend is not trusted or even involved.
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
    <div className="card">
      <strong>Verify research against Sui</strong>
      <p className="muted">
        Hashed in your browser and compared to the on-chain record. Edit one character below and
        verification will fail.
      </p>

      {loading && <p className="muted">Reading the on-chain report…</p>}
      {error && <p className="muted">Could not read report: {error}</p>}

      {report && (
        <>
          <p className="muted">
            On-chain: <strong>{report.title || '(untitled)'}</strong>
            <br />
            creator {report.creator}
            <br />
            content hash {report.contentHash}
            {report.walrusBlobId && (
              <>
                <br />
                walrus blob {report.walrusBlobId}
              </>
            )}
          </p>

          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setVerdict({ kind: 'idle' });
            }}
            rows={10}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem' }}
            placeholder="Paste the report text to verify…"
          />

          <button onClick={verify} disabled={!text || verdict.kind === 'checking'}>
            {verdict.kind === 'checking' ? 'Hashing…' : 'Verify'}
          </button>

          {verdict.kind === 'verified' && (
            <div className="card">
              <strong>✓ VERIFIED ON SUI</strong>
              <p className="muted">
                This is the exact text registered on-chain.
                <br />
                creator {report.creator}
                <br />
                registered {report.createdAt ? new Date(report.createdAt).toUTCString() : 'unknown'}
                <br />
                hash {verdict.localHash}
              </p>
              <p className="muted">
                This proves this exact version existed and was registered by that wallet — it is a
                provenance and integrity record, not a legal copyright claim.
              </p>
            </div>
          )}

          {verdict.kind === 'failed' && (
            <div className="card">
              <strong>✗ VERIFICATION FAILED</strong>
              <p className="muted">
                This text does not match the version registered on Sui.
                <br />
                on-chain {verdict.chainHash}
                <br />
                this text {verdict.localHash}
              </p>
            </div>
          )}

          {verdict.kind === 'error' && <p className="muted">{verdict.message}</p>}
        </>
      )}
    </div>
  );
}
