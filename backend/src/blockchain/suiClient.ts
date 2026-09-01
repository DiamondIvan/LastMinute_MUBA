import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { config } from '../config.js';

export const suiClient = new SuiGrpcClient({
  network: config.sui.network,
  baseUrl: config.sui.grpcUrl,
});

let cachedAdmin: Ed25519Keypair | null = null;

/**
 * The admin keypair, from ADMIN_SECRET_KEY (a `suiprivkey1...` bech32 string,
 * e.g. `sui keytool export --key-identity <addr>`). Server-side only.
 */
export function adminKeypair(): Ed25519Keypair {
  if (cachedAdmin) return cachedAdmin;
  const secret = process.env.ADMIN_SECRET_KEY;
  if (!secret) throw new Error('ADMIN_SECRET_KEY is not set');
  cachedAdmin = Ed25519Keypair.fromSecretKey(secret);
  return cachedAdmin;
}

export function adminAddress(): string {
  return adminKeypair().getPublicKey().toSuiAddress();
}
