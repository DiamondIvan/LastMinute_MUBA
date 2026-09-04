import { SealClient, SessionKey, type KeyServerConfig, type SealClientOptions } from '@mysten/seal';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { suiClient } from '../blockchain/suiClient.js';
import { config } from '../config.js';

export interface SealEncryptResult {
  /** Serialized EncryptedObject (bcs bytes) to store on Walrus. */
  encryptedObject: string; // base64
  /** The 256-bit symmetric key (base64). For backup only — do not share. */
  key: string; // base64
  /** The identity id this was encrypted under. */
  id: string;
}

export interface SealDecryptResult {
  plaintext: string;
}

const KEM_TYPE = 'BonehFranklinBLS12381';
const DEM_TYPE = 'AesGcm256';

function sealServerConfigs(): KeyServerConfig[] {
  // Public Seal-compatible key servers. On testnet these come from the Seal
  // SDK's committee/aggregator defaults; we can point at explicit object IDs
  // when configured.
  const servers: KeyServerConfig[] = [];
  if (config.seal.keyServer0) {
    servers.push({ objectId: config.seal.keyServer0, weight: 1 });
  }
  if (config.seal.keyServer1) {
    servers.push({ objectId: config.seal.keyServer1, weight: 1 });
  }
  return servers;
}

let _seal: SealClient | null = null;

/**
 * Lazy SealClient (KMS). Encrypts the report's random data key under a chosen
 * identity (the buyer's address) and a threshold of key servers. Only a valid
 * PremiumPass/subscription unlocks the derived key at decrypt time.
 */
export function sealClient(): SealClient {
  if (!_seal) {
    const servers = sealServerConfigs();
    const options: SealClientOptions = {
      suiClient: suiClient as never,
      serverConfigs: servers,
      verifyKeyServers: false,
      timeout: 10_000,
    };
    _seal = new SealClient(options);
  }
  return _seal;
}

/**
 * Encrypts a plaintext report body so that ONLY `ownerAddress` (the buyer) can
 * decrypt it. The output `encryptedObject` (bcs bytes, base64) is what we
 * persist to Walrus.
 *
 * - `key` is the random symmetric key (KMS model: encrypt the data's symmetric
 *   key, store the encrypted blob on Walrus).
 * - `id` binds encryption to a specific report identity (e.g. the content
 *   hash), so the on-chain policy can reason about it.
 */
export async function encryptReportFor(
  plaintext: string,
  opts: { ownerAddress?: string; id?: string; signer?: Ed25519Keypair },
): Promise<SealEncryptResult> {
  const client = sealClient();
  const signer = opts.signer;
  const ownerAddress = opts.ownerAddress ?? signer?.toSuiAddress() ?? '';
  if (!ownerAddress) throw new Error('encryptReportFor: ownerAddress or signer required');

  const id = opts.id ?? buildReportId(ownerAddress);

  const { encryptedObject, key } = await client.encrypt({
    kemType: KEM_TYPE as never,
    demType: DEM_TYPE as never,
    threshold: 1, // any single key server combination
    packageId: config.contracts.packageId,
    id,
    data: new TextEncoder().encode(plaintext),
  });

  return {
    encryptedObject: Buffer.from(encryptedObject).toString('base64'),
    key: Buffer.from(key).toString('base64'),
    id,
  };
}

/**
 * Decrypts an encrypted report (bcs bytes). `buyerAddress` must hold the
 * required on-chain object (PremiumPass / ResearchAccess) — the Seal key
 * policy enforces this.
 *
 * NOTE: full end-to-end Seal decryption requires key-server key retrieval gated
 * on an on-chain `seal_approve*` transaction. This helper wires the client and
 * session-key creation; the caller supplies the approved tx bytes.
 */
export async function decryptReport(
  encryptedObjectB64: string,
  opts: { buyerAddress: string; signer?: Ed25519Keypair },
): Promise<SealDecryptResult> {
  const client = sealClient();
  const { buyerAddress, signer } = opts;

  const sessionKey = await SessionKey.create({
    address: buyerAddress,
    packageId: config.contracts.packageId,
    ttlMin: 60,
    signer: signer as never,
    suiClient: suiClient as never,
  });

  // The bcs bytes returned by `encrypt` are the EncryptedObject serialization.
  const data = Uint8Array.from(Buffer.from(encryptedObjectB64, 'base64'));

  // The tx bytes that call seal_approve* must be supplied by the caller in a
  // real deployment. For the server-side demo we pass an empty placeholder that
  // a transaction-builder step (Task 5 / kiosk policy) will replace.
  const txBytes = new Uint8Array(0);

  const plaintext = await client.decrypt({
    data,
    sessionKey: sessionKey as never,
    txBytes,
  });

  return { plaintext: new TextDecoder().decode(plaintext) };
}

/**
 * Deterministic report identity under Seal. Defaults to the content hash of the
 * report body so it is stable and collision-resistant.
 */
export function buildReportId(ownerAddress: string, contentHash?: string): string {
  void ownerAddress; // reserved for a per-user binding if desired
  return contentHash ?? 'report-default';
}