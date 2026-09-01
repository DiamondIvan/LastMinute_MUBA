import { Transaction } from '@mysten/sui/transactions';
import { config } from '../config.js';
import { suiClient, adminKeypair } from './suiClient.js';

const CLOCK_ID = '0x6';

export interface RegisterReportInput {
  title: string;
  contentHash: string; // sha256 hex
  walrusBlobId: string;
}

export interface RegisterReportResult {
  digest: string;
  reportObjectId: string | null;
}

/**
 * Admin-only: calls `news_platform::register_report(adminCap, config, title,
 * content_hash, walrus_blob_id, clock)` and returns the new ResearchReport id.
 */
export async function registerReport(input: RegisterReportInput): Promise<RegisterReportResult> {
  const { packageId, configId, adminCapId } = config.contracts;

  const tx = new Transaction();
  tx.moveCall({
    target: `${packageId}::news_platform::register_report`,
    arguments: [
      tx.object(adminCapId),
      tx.object(configId),
      tx.pure.string(input.title),
      tx.pure.string(input.contentHash),
      tx.pure.string(input.walrusBlobId),
      tx.object(CLOCK_ID),
    ],
  });

  const result = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer: adminKeypair(),
    include: { effects: true, objectTypes: true },
  });

  if (result.$kind === 'FailedTransaction') {
    throw new Error(`register_report failed: ${JSON.stringify(result.FailedTransaction.status)}`);
  }

  const txn = result.Transaction;
  const reportType = `${packageId}::news_platform::ResearchReport`;
  const types = (txn.objectTypes ?? {}) as Record<string, string>;

  let reportObjectId: string | null =
    Object.entries(types).find(([, t]) => t === reportType)?.[0] ?? null;

  if (!reportObjectId) {
    const created = txn.effects?.changedObjects?.find((o) => o.idOperation === 'Created');
    reportObjectId = created?.objectId ?? null;
  }

  return { digest: txn.digest, reportObjectId };
}
