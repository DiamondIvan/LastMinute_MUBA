import type { TradeProposal } from '../api';

/**
 * Suggested trades awaiting a decision.
 *
 * Each card separates the two things that produced it, on purpose: Gonka's
 * market read (context) and the deterministic rule that turned that read into
 * a proposed action (the actual decision logic). The AI is not the thing
 * telling you to trade — it's the thing explaining what the data shows.
 *
 * Approving executes against the simulated ledger only.
 */

interface Props {
  proposals: TradeProposal[];
  loading: boolean;
  error: string | null;
  busyId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export function ProposalsPanel({ proposals, loading, error, busyId, onApprove, onReject }: Props) {
  return (
    <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h3 className="text-lg font-black text-gray-900">Suggested Trades</h3>
        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-amber-100 text-amber-800 whitespace-nowrap">
          Simulated
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-5">
        You decide — nothing executes without your approval, and approving only affects the practice
        portfolio.
      </p>

      {loading && proposals.length === 0 && (
        <p className="text-sm text-gray-400 py-4 text-center">Checking for suggestions…</p>
      )}
      {error && <p className="text-sm text-rose-600 py-2">{error}</p>}

      {!loading && !error && proposals.length === 0 && (
        <div className="text-center py-6">
          <p className="text-sm text-gray-500 font-medium">No suggestions right now.</p>
          <p className="text-xs text-gray-400 mt-1">
            Suggestions appear when an asset&apos;s signal turns strengthening (and you hold none) or
            weakening (and you do).
          </p>
        </div>
      )}

      <div className="space-y-3">
        {proposals.map((p) => {
          const busy = busyId === p.id;
          const isOpen = p.action === 'open';
          return (
            <div key={p.id} className="border border-gray-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    isOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {isOpen ? 'Open' : 'Close'}
                </span>
                <span className="font-black text-gray-900">{p.symbol}</span>
                {isOpen && p.notionalUsd !== undefined && (
                  <span className="text-sm font-bold text-gray-700">${p.notionalUsd}</span>
                )}
                <span className="text-xs text-gray-400 ml-auto">@ ${p.price.toFixed(4)}</span>
              </div>

              <p className="text-xs text-gray-500 mb-1">
                <span className="font-bold text-gray-700">Why this was suggested:</span> {p.basis}
              </p>
              <p className="text-xs text-gray-500 mb-3">
                <span className="font-bold text-gray-700">Gonka&apos;s read:</span> {p.rationale}
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => onApprove(p.id)}
                  disabled={busy}
                  className="flex-1 bg-brand text-white font-bold text-sm py-2.5 rounded-xl hover:bg-brand/90 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {busy ? 'Working…' : 'Approve'}
                </button>
                <button
                  onClick={() => onReject(p.id)}
                  disabled={busy}
                  className="flex-1 bg-gray-100 text-gray-600 font-bold text-sm py-2.5 rounded-xl hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
