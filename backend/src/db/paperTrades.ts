import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { TradeableSymbol } from '../scraper/tradeableAssets.js';

/**
 * Paper-trading ledger, keyed by wallet address.
 *
 * Deliberately a SEPARATE file from `data/news_db.json`. That one is a
 * disposable cache — deleting it costs nothing and it gets rewritten on every
 * scrape. This is user state: someone's simulated positions and their
 * realised results. Mixing the two would mean clearing a cache silently wipes
 * a user's trade history.
 *
 * Not behind the auth/session flow: these positions hold no value and grant no
 * access, so requiring a wallet signature to look at fake money would be
 * friction without a security benefit. The address is an identifier here, not
 * a credential — which is exactly why nothing in this file is allowed to
 * affect a real balance or an on-chain call.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../../../data/paper_trades.json');

export interface PaperPosition {
  id: string;
  symbol: TradeableSymbol;
  /** USD put in at entry. */
  notionalUsd: number;
  /** Units of the asset bought, = notionalUsd / entryPrice. */
  units: number;
  entryPrice: number;
  openedAt: string;
  /** The AI signal that was live for this symbol when the position opened. */
  signalAtEntry: string | null;
  /** Set once closed. */
  closedAt?: string;
  exitPrice?: number;
  realisedPnlUsd?: number;
}

interface DBShape {
  /** wallet address -> that wallet's positions (open and closed). */
  byAddress: Record<string, PaperPosition[]>;
}

let memCache: DBShape | null = null;

async function loadDB(): Promise<DBShape> {
  if (memCache) return memCache;
  try {
    const raw = await fs.readFile(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as DBShape;
    memCache = parsed?.byAddress ? parsed : { byAddress: {} };
  } catch {
    // Missing or unreadable file just means nobody has traded yet.
    memCache = { byAddress: {} };
  }
  return memCache;
}

async function saveDB(): Promise<void> {
  if (!memCache) return;
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(memCache, null, 2), 'utf-8');
}

function normaliseAddress(address: string): string {
  return address.trim().toLowerCase();
}

export async function listPositions(address: string): Promise<PaperPosition[]> {
  const db = await loadDB();
  return db.byAddress[normaliseAddress(address)] ?? [];
}

export async function openPosition(
  address: string,
  input: { symbol: TradeableSymbol; notionalUsd: number; entryPrice: number; signalAtEntry: string | null },
): Promise<PaperPosition> {
  const db = await loadDB();
  const key = normaliseAddress(address);

  const position: PaperPosition = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    symbol: input.symbol,
    notionalUsd: input.notionalUsd,
    units: input.notionalUsd / input.entryPrice,
    entryPrice: input.entryPrice,
    openedAt: new Date().toISOString(),
    signalAtEntry: input.signalAtEntry,
  };

  db.byAddress[key] = [...(db.byAddress[key] ?? []), position];
  await saveDB();
  return position;
}

export async function closePosition(
  address: string,
  positionId: string,
  exitPrice: number,
): Promise<PaperPosition | null> {
  const db = await loadDB();
  const key = normaliseAddress(address);
  const positions = db.byAddress[key];
  if (!positions) return null;

  const position = positions.find((p) => p.id === positionId);
  if (!position || position.closedAt) return null;

  position.closedAt = new Date().toISOString();
  position.exitPrice = exitPrice;
  position.realisedPnlUsd = position.units * exitPrice - position.notionalUsd;

  await saveDB();
  return position;
}
