import { getCachedSignals } from '../ai/tradingSignals.js';
import type { SignalKind } from '../ai/tradingSignals.js';
import { getTradeablePrices, TRADEABLE_SYMBOLS } from '../scraper/tradeableAssets.js';
import { listPositions } from '../db/paperTrades.js';

/**
 * Trade proposals for the approve/reject flow.
 *
 * The split here is deliberate and load-bearing:
 *
 *   Gonka  -> reads the market and explains what the data shows.
 *   This    -> turns that read into a concrete proposed action and size.
 *
 * The model is never asked "what should I buy and how much", for two reasons.
 * One, that's the buy/sell-direction-and-sizing shape docs/SECURITY.md rules
 * out. Two, it doesn't work: MiniMax-M2.7 safety-refuses prompts of that shape
 * and returns valid JSON with no usable fields (see openrouter.ts), so a
 * proposal engine built on it would intermittently produce nothing. Deriving
 * the action in code is both more honest about where the judgement comes from
 * and strictly more reliable.
 *
 * The rules are intentionally simple and inspectable — a reader should be able
 * to predict every proposal the system will make.
 */

/** Default stake per proposed entry. Users can still open any size by hand. */
export const DEFAULT_PROPOSAL_USD = 100;

export type ProposalAction = 'open' | 'close';

export interface TradeProposal {
  /** Stable for a given day+symbol+action, so approve/reject can match it. */
  id: string;
  action: ProposalAction;
  symbol: string;
  /** Set for 'open'. */
  notionalUsd?: number;
  /** Set for 'close' — the position this would close. */
  positionId?: string;
  price: number;
  /** The signal that triggered this proposal. */
  signal: SignalKind;
  /** Gonka's own words on why the market looks this way — context, not advice. */
  rationale: string;
  /** Plain-English statement of the deterministic rule that fired. */
  basis: string;
}

function proposalId(date: string, symbol: string, action: ProposalAction): string {
  return `${date}-${symbol}-${action}`;
}

/**
 * Derives today's proposals from the current signals and the wallet's open
 * positions. Pure function of (signals, positions, prices) — no model call.
 *
 * Rules:
 *   strengthening + nothing open  -> propose opening a default-size position
 *   weakening     + position open -> propose closing it
 *   everything else               -> no proposal
 *
 * Note there is no "short" proposal: the paper ledger only models long
 * positions, so a weakening read on an asset you don't hold produces nothing
 * rather than a trade you couldn't actually express.
 */
export async function buildProposals(address: string): Promise<{
  date: string;
  proposals: TradeProposal[];
  generatedBy: 'gonka' | 'demo';
}> {
  const [snapshot, prices, positions] = await Promise.all([
    getCachedSignals(),
    getTradeablePrices(),
    listPositions(address),
  ]);

  const openBySymbol = new Map<string, string>();
  for (const p of positions) {
    if (!p.closedAt) openBySymbol.set(p.symbol, p.id);
  }

  const proposals: TradeProposal[] = [];

  for (const symbol of TRADEABLE_SYMBOLS) {
    const signal = snapshot.signals.find((s) => s.symbol === symbol);
    const price = prices[symbol];
    if (!signal || price === undefined) continue;

    const openPositionId = openBySymbol.get(symbol);

    if (signal.signal === 'strengthening' && !openPositionId) {
      proposals.push({
        id: proposalId(snapshot.date, symbol, 'open'),
        action: 'open',
        symbol,
        notionalUsd: DEFAULT_PROPOSAL_USD,
        price,
        signal: signal.signal,
        rationale: signal.rationale,
        basis: `Signal is "strengthening" and you hold no ${symbol}, so a $${DEFAULT_PROPOSAL_USD} practice entry is proposed.`,
      });
    }

    if (signal.signal === 'weakening' && openPositionId) {
      proposals.push({
        id: proposalId(snapshot.date, symbol, 'close'),
        action: 'close',
        symbol,
        positionId: openPositionId,
        price,
        signal: signal.signal,
        rationale: signal.rationale,
        basis: `Signal is "weakening" and you hold an open ${symbol} position, so closing it is proposed.`,
      });
    }
  }

  return { date: snapshot.date, proposals, generatedBy: snapshot.generatedBy };
}
