import { randomBytes } from 'node:crypto';

interface Entry {
  nonce: string;
  expiresAt: number;
}

// In-memory nonce store. Fine for a hackathon; swap for Redis if you scale.
const store = new Map<string, Entry>();
const TTL_MS = 5 * 60 * 1000;

export function issueNonce(address: string): string {
  const nonce = randomBytes(16).toString('hex');
  store.set(address.toLowerCase(), { nonce, expiresAt: Date.now() + TTL_MS });
  return nonce;
}

/** Returns true and consumes the nonce if it matches and is unexpired. */
export function consumeNonce(address: string, nonce: string): boolean {
  const key = address.toLowerCase();
  const entry = store.get(key);
  if (!entry) return false;
  store.delete(key);
  return entry.nonce === nonce && entry.expiresAt > Date.now();
}
