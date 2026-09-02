/**
 * Wallet sign-in: nonce -> personal-message signature -> session token.
 *
 * The token is what proves to the backend which wallet is calling. The backend
 * derives the address from it and never from a request body — see
 * docs/SECURITY.md, Finding 1.
 */
import { getNonce, verifyAuth } from '../api';

type SignPersonalMessage = (args: {
  message: Uint8Array;
}) => Promise<{ signature: string; bytes: string }>;

const key = (address: string) => `muba:token:${address}`;

function readCached(address: string): string | null {
  try {
    return sessionStorage.getItem(key(address));
  } catch {
    return null; // private mode / storage disabled
  }
}

function cache(address: string, token: string): void {
  try {
    sessionStorage.setItem(key(address), token);
  } catch {
    // non-fatal: we just re-sign next time
  }
}

export function clearSession(address: string): void {
  try {
    sessionStorage.removeItem(key(address));
  } catch {
    // ignore
  }
}

/**
 * Returns a session token for `address`, prompting the wallet to sign a nonce
 * if we do not already hold one. The signature authorises nothing on-chain —
 * it only proves control of the address.
 */
export async function getSessionToken(
  address: string,
  signPersonalMessage: SignPersonalMessage,
): Promise<string> {
  const cached = readCached(address);
  if (cached) return cached;

  const { nonce, message } = await getNonce(address);
  const signed = await signPersonalMessage({ message: new TextEncoder().encode(message) });
  const { token } = await verifyAuth(address, nonce, signed.signature);

  cache(address, token);
  return token;
}
