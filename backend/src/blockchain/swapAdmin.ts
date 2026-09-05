import { Transaction } from '@mysten/sui/transactions';
import { suiClient, adminKeypair } from './suiClient.js';
import { fetchSuiPrice } from '../scraper/tradeableAssets.js';

const CLOCK_ID = '0x6';

export interface SwapContracts {
  packageId: string;
  configId: string;
  adminCapId: string;
}

/** Reads swap-contract env vars. Deliberately separate from `config.contracts` (news_platform's), since this is a different, independently-deployed package. */
export function swapContracts(): SwapContracts | null {
  const packageId = process.env.SWAP_PACKAGE_ID ?? '';
  const configId = process.env.SWAP_CONFIG_ID ?? '';
  const adminCapId = process.env.SWAP_ADMIN_CAP_ID ?? '';
  if (!packageId || !configId || !adminCapId) return null;
  return { packageId, configId, adminCapId };
}

export function swapConfigured(): boolean {
  return swapContracts() !== null;
}

/**
 * Fetches the live SUI/USD price and pushes it on-chain via
 * `swap::update_price`. Same admin keypair (ADMIN_SECRET_KEY) as
 * registerReport.ts — it's the same deployer wallet that holds both
 * news_platform's AdminCap and this package's AdminCap, confirmed at publish
 * time (both were sent to the same address in the same transaction chain).
 */
export async function syncSwapPrice(): Promise<{ digest: string; priceUsdMicros: number; priceUsd: number }> {
  const contracts = swapContracts();
  if (!contracts) throw new Error('Swap contract env vars are not set (SWAP_PACKAGE_ID / SWAP_CONFIG_ID / SWAP_ADMIN_CAP_ID)');

  const priceUsd = await fetchSuiPrice();
  if (priceUsd === null) throw new Error('Could not fetch a live SUI price to push');

  const priceUsdMicros = Math.round(priceUsd * 1_000_000);

  const tx = new Transaction();
  tx.moveCall({
    target: `${contracts.packageId}::swap::update_price`,
    arguments: [
      tx.object(contracts.configId),
      tx.pure.u64(priceUsdMicros),
      tx.object(CLOCK_ID),
      tx.object(contracts.adminCapId),
    ],
  });

  const result = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer: adminKeypair(),
    include: { effects: true },
  });

  if (result.$kind === 'FailedTransaction') {
    throw new Error(`update_price failed: ${JSON.stringify(result.FailedTransaction.status)}`);
  }

  return { digest: result.Transaction.digest, priceUsdMicros, priceUsd };
}

export interface SwapConfigSnapshot {
  priceUsdMicros: number;
  priceUsd: number;
  suiReserveMist: number;
  suiReserveSui: number;
  lastUpdatedMs: number;
}

/** Read-only: current on-chain swap state. No key needed. */
export async function readSwapConfig(): Promise<SwapConfigSnapshot | null> {
  const contracts = swapContracts();
  if (!contracts) return null;

  const res = await suiClient.getObject({
    objectId: contracts.configId,
    include: { json: true },
  });
  const json = (res.object?.json ?? {}) as Record<string, unknown>;

  const priceUsdMicros = Number(json.price_usd_micros ?? 0);
  const suiReserveMist = Number(json.sui_reserve ?? 0);

  return {
    priceUsdMicros,
    priceUsd: priceUsdMicros / 1_000_000,
    suiReserveMist,
    suiReserveSui: suiReserveMist / 1_000_000_000,
    lastUpdatedMs: Number(json.last_updated_ms ?? 0),
  };
}
