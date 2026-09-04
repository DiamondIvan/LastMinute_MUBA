import {
  WalrusClient,
  TESTNET_WALRUS_PACKAGE_CONFIG,
  MAINNET_WALRUS_PACKAGE_CONFIG,
} from '@mysten/walrus';
import { suiClient, adminKeypair } from '../blockchain/suiClient.js';
import { config } from '../config.js';

export interface WalrusUploadResult {
  blobId: string;
  blobObjectId: string | null;
  raw: unknown;
}

/**
 * Lazy singleton Walrus client (decentralized blob store).
 *
 * Replaces the old HTTP-publisher calls. The WalrusClient reads/writes blobs
 * through the on-chain Walrus package (Sui), storing the report body as an
 * immutable decentralized blob instead of an in-process Map or an HTTP fetch.
 *
 * WARNING: Walrus blobs are PUBLIC. Only store non-secret report bodies here.
 * For premium (paid) reports, combine with Seal encryption (see seal/).
 */
let _walrus: WalrusClient | null = null;

export function walrusClient(): WalrusClient {
  if (!_walrus) {
    const packageConfig =
      config.sui.network === 'mainnet'
        ? MAINNET_WALRUS_PACKAGE_CONFIG
        : TESTNET_WALRUS_PACKAGE_CONFIG;
    _walrus = new WalrusClient({
      network: config.sui.network === 'mainnet' ? 'mainnet' : 'testnet',
      packageConfig,
      suiClient: suiClient as any,
    });
  }
  return _walrus;
}

/**
 * Uploads text as a decentralized blob to Walrus via the on-chain package.
 *
 * Uses the admin keypair as the signer (server-side only). Returns the blobId
 * which is then anchored on-chain by `register_report`.
 */
export async function uploadToWalrus(
  content: string,
  opts?: { owner?: string; signer?: ReturnType<typeof adminKeypair> },
): Promise<WalrusUploadResult> {
  const client = walrusClient();
  const signer = opts?.signer ?? adminKeypair();
  const owner = opts?.owner ?? signer.toSuiAddress();

  // UTF-8 bytes for the blob payload.
  const blob = new TextEncoder().encode(content);

  const res = await client.writeBlob({
    blob,
    owner,
    epochs: config.walrus.epochs,
    deletable: false,
    signer: signer as any, // WalrusClient accepts a Signer; cast keeps types clean
  });

  return {
    blobId: res.blobId,
    blobObjectId: res.blobObject?.id ?? null,
    raw: res,
  };
}

/**
 * Reads a blob back from Walrus as text (aggregator-backed SDK path).
 */
export async function readFromWalrus(blobId: string): Promise<string> {
  const client = walrusClient();
  const res = await client.getBlob({ blobId });
  return (await res.asFile().text()) ?? '';
}

/**
 * Uploads arbitrary bytes (HTML, image) as a blob. Returns the blobId.
 */
export async function uploadBytesToWalrus(
  bytes: Uint8Array,
  opts?: { owner?: string; signer?: ReturnType<typeof adminKeypair> },
): Promise<WalrusUploadResult> {
  const client = walrusClient();
  const signer = opts?.signer ?? adminKeypair();
  const owner = opts?.owner ?? signer.toSuiAddress();

  const res = await client.writeBlob({
    blob: bytes,
    owner,
    epochs: config.walrus.epochs,
    deletable: false,
    signer: signer as any,
  });

  return { blobId: res.blobId, blobObjectId: res.blobObject?.id ?? null, raw: res };
}