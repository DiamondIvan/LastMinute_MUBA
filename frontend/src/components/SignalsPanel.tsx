import type { SignalsSnapshot, SignalKind } from '../api';

/**
 * Daily AI market signals from Gonka.
 *
 * These are descriptive reads of the data ("SUI gained 12.7% over 30 days"),
 * deliberately not buy/sell calls — see backend/src/ai/tradingSignals.ts for
 * why that framing is both the project's stated position and the thing that
 * keeps the model from safety-refusing the prompt outright.
 */

const SIGNAL_STYLES: Record<SignalKind, string> = {
  strengthening: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  stable: 'bg-gray-50 text-gray-600 border-gray-200',
  weakening: 'bg-rose-50 text-rose-700 border-rose-200',
  watch: 'bg-amber-50 text-amber-700 border-amber-200',
};

interface Props {
  data: SignalsSnapshot | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  refreshing: boolean;
}

export function SignalsPanel({ data, loading, error, onRefresh, refreshing }: Props) {
  return (
    <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h3 className="text-lg font-black text-gray-900">AI Market Signals</h3>
        <div className="flex items-center gap-2">
          {data && (
            <span
              className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full whitespace-nowrap ${
                data.generatedBy === 'gonka' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
              }`}
            >
              {data.generatedBy === 'gonka' ? 'Gonka AI' : 'Demo text'}
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={refreshing || loading}
            className="text-xs font-bold text-brand hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer whitespace-nowrap"
          >
            {refreshing ? 'Regenerating…' : 'Refresh'}
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Descriptive read of live prices, peg data and today&apos;s headlines — not investment advice, and
        never a buy or sell instruction.
        {data && <span className="text-gray-400"> · {data.date} · {data.headlineCount} headlines</span>}
      </p>

      {loading && !data && (
        <p className="text-sm text-gray-400 py-6 text-center">Loading signals…</p>
      )}
      {error && <p className="text-sm text-rose-600 py-2">{error}</p>}

      {data && (
        <div className="space-y-3">
          {data.signals.map((s) => (
            <div key={s.symbol} className="border border-gray-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-black text-gray-900 text-sm">{s.symbol}</span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${SIGNAL_STYLES[s.signal]}`}
                >
                  {s.signal}
                </span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{s.rationale}</p>
              {s.watchItems.length > 0 && (
                <ul className="mt-2 pt-2 border-t border-gray-50 space-y-1">
                  {s.watchItems.map((w, i) => (
                    <li key={i} className="text-xs text-gray-500 flex gap-2">
                      <span className="text-amber-400">▸</span>
                      {w}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
