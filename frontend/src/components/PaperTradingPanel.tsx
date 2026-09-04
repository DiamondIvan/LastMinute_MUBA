import { useState } from 'react';
import type { PaperLedger, SignalsSnapshot } from '../api';

/**
 * Simulated portfolio. Nothing here moves funds or touches the chain — but the
 * prices are the same live feed the rest of the app uses, so the P&L is real
 * even though the trade isn't. Labelled loudly for exactly that reason.
 */

const TRADEABLE = ['SUI', 'USDC', 'USDsui', 'FDUSD', 'BUCK'];

/**
 * Anything smaller than half a unit of the last displayed digit is zero as far
 * as the reader is concerned. Without this, floating-point dust (a real
 * -1.4e-14 was observed on a position whose entry and current price were
 * identical) renders as a red "-$0.0000" — a flat position looking like a loss.
 */
function clampDust(n: number, digits: number): number {
  return Math.abs(n) < 0.5 * 10 ** -digits ? 0 : n;
}

function usd(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined) return '—';
  const v = clampDust(n, digits);
  const sign = v < 0 ? '-' : '';
  return `${sign}$${Math.abs(v).toFixed(digits)}`;
}

function pnlClass(n: number | null | undefined, digits = 4): string {
  if (n === null || n === undefined || clampDust(n, digits) === 0) return 'text-gray-500';
  return n > 0 ? 'text-emerald-600' : 'text-rose-600';
}

interface Props {
  ledger: PaperLedger | null;
  signals: SignalsSnapshot | null;
  loading: boolean;
  error: string | null;
  busy: boolean;
  onOpen: (symbol: string, notionalUsd: number) => void;
  onClose: (positionId: string) => void;
}

export function PaperTradingPanel({ ledger, signals, loading, error, busy, onOpen, onClose }: Props) {
  const [symbol, setSymbol] = useState('SUI');
  const [amount, setAmount] = useState('100');

  const signalFor = (s: string) => signals?.signals.find((x) => x.symbol === s)?.signal ?? null;
  const amountNum = Number(amount);
  const canOpen = Number.isFinite(amountNum) && amountNum > 0 && !busy;

  return (
    <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h3 className="text-lg font-black text-gray-900">Paper Portfolio</h3>
        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-amber-100 text-amber-800 whitespace-nowrap">
          Simulated
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-5">
        Practice positions only — no funds move and nothing is sent to the chain. Prices and P&amp;L are
        real, from the same live feed as the rest of the app.
      </p>

      {/* Open a position */}
      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 mb-5">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Open a position</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="bg-white border border-gray-200 text-gray-900 text-sm font-bold rounded-xl p-2.5 outline-none cursor-pointer"
          >
            {TRADEABLE.map((s) => {
              const sig = signalFor(s);
              return (
                <option key={s} value={s}>
                  {s}
                  {sig ? ` — ${sig}` : ''}
                </option>
              );
            })}
          </select>
          <div className="flex items-center gap-2 flex-1 bg-white border border-gray-200 rounded-xl px-3">
            <span className="text-gray-400 text-sm font-bold">$</span>
            <input
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100"
              className="bg-transparent outline-none py-2.5 w-full text-sm font-bold text-gray-900"
            />
          </div>
          <button
            onClick={() => onOpen(symbol, amountNum)}
            disabled={!canOpen}
            className="bg-brand text-white font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-brand/90 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
          >
            {busy ? 'Working…' : 'Open'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-rose-600 mb-4">{error}</p>}
      {loading && !ledger && <p className="text-sm text-gray-400 py-4 text-center">Loading portfolio…</p>}

      {ledger && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Unrealised</p>
              <p className={`text-lg font-black ${pnlClass(ledger.summary.unrealisedPnlUsd)}`}>
                {usd(ledger.summary.unrealisedPnlUsd, 4)}
              </p>
              <p className="text-[10px] text-gray-400">{ledger.summary.openCount} open</p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Realised</p>
              <p className={`text-lg font-black ${pnlClass(ledger.summary.realisedPnlUsd)}`}>
                {usd(ledger.summary.realisedPnlUsd, 4)}
              </p>
              <p className="text-[10px] text-gray-400">{ledger.summary.closedCount} closed</p>
            </div>
          </div>

          {/* Open positions */}
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Open positions</p>
          {ledger.open.length === 0 ? (
            <p className="text-sm text-gray-400 italic mb-5">No open positions.</p>
          ) : (
            <div className="space-y-2 mb-5">
              {ledger.open.map((p) => (
                <div key={p.id} className="border border-gray-100 rounded-2xl p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-gray-900">{p.symbol}</span>
                      {p.signalAtEntry && (
                        <span className="text-[9px] font-bold uppercase bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                          {p.signalAtEntry} @ entry
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {usd(p.notionalUsd)} in · entry ${p.entryPrice.toFixed(4)} · now $
                      {p.currentPrice?.toFixed(4) ?? '—'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-black ${pnlClass(p.unrealisedPnlUsd)}`}>
                      {usd(p.unrealisedPnlUsd, 4)}
                    </p>
                    <button
                      onClick={() => onClose(p.id)}
                      disabled={busy}
                      className="text-[11px] font-bold text-gray-500 hover:text-rose-600 disabled:opacity-50 cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Trade history */}
          {ledger.closed.length > 0 && (
            <>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Trade history</p>
              <div className="space-y-1.5">
                {ledger.closed
                  .slice()
                  .reverse()
                  .map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-50 last:border-0">
                      <span className="text-gray-600">
                        <span className="font-bold text-gray-900">{p.symbol}</span> {usd(p.notionalUsd)} ·{' '}
                        {p.entryPrice.toFixed(4)} → {p.exitPrice?.toFixed(4)}
                        {p.signalAtEntry && <span className="text-gray-400"> · {p.signalAtEntry} @ entry</span>}
                      </span>
                      <span className={`font-black ${pnlClass(p.realisedPnlUsd)}`}>{usd(p.realisedPnlUsd, 4)}</span>
                    </div>
                  ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
