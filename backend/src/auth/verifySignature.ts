import { createHmac } from 'node:crypto';
import { verifyPersonalMessageSignature } from '@mysten/sui/verify';
import { config } from '../config.js';
import { consumeNonce } from './nonces.js';

export function buildSignInMessage(nonce: string): string {
  return `Sign in to MUBA AI.\nNonce: ${nonce}\nThis signature does not authorize any blockchain transaction.`;
}

export interface VerifyInput {
  address: string;
  nonce: string;
  /** base64 signature from the wallet's signPersonalMessage result. */
  signature: string;
}

/**
 * Verifies a wallet's personal-message signature over the sign-in message and
 * returns a short session token. Throws on any failure.
 */
export async function verifyWalletSignature(input: VerifyInput): Promise<{ token: string }> {
  if (!consumeNonce(input.address, input.nonce)) {
    throw new Error('Invalid or expired nonce');
  }

  const message = new TextEncoder().encode(buildSignInMessage(input.nonce));
  // Throws if the signature is invalid or does not match `address`.
  const publicKey = await verifyPersonalMessageSignature(message, input.signature, {
    address: input.address,
  });

  if (publicKey.toSuiAddress() !== input.address) {
    throw new Error('Signature does not match address');
  }

  return { token: issueSessionToken(input.address) };
}

/** Minimal HMAC session token: `address.expiry.sig`. Replace with real JWT if needed. */
function issueSessionToken(address: string): string {
  const payload = `${address}.${Date.now() + 24 * 60 * 60 * 1000}`;
  const sig = createHmac('sha256', config.authSessionSecret).update(payload).digest('hex');
  return `${Buffer.from(payload).toString('base64url')}.${sig}`;
}

export function verifySessionToken(token: string): string | null {
  const [b64, sig] = token.split('.');
  if (!b64 || !sig) return null;
  const payload = Buffer.from(b64, 'base64url').toString('utf8');
  const expected = createHmac('sha256', config.authSessionSecret).update(payload).digest('hex');
  if (expected !== sig) return null;
  const [address, expiry] = payload.split('.');
  if (!address || !expiry || Number(expiry) < Date.now()) return null;
  return address;
}
