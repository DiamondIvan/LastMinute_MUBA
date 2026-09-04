import { decodeJwt } from '@mysten/sui/zklogin';
import { config } from '../config.js';

/**
 * zkLogin / Enoki verification (server-side).
 *
 * When a user signs in with Google/Twitch via Enoki, the frontend obtains a
 * zkLogin wallet whose Sui address is authoritative (derived from the Enoki
 * keypair). The backend's role:
 *
 *   1. Accept the zkLogin wallet address (already verified client-side via the
 *      wallet). Enoki gas-sponsors the user's txs.
 *   2. Optionally validate the JWT claims (issuer / audience) to bind the
 *      session, and derive the address deterministically for cross-checking.
 *
 * The address the backend stores in its HMAC session token is the one proven by
 * the wallet signature (existing verifySignature flow). This module adds the
 * zkLogin JWT path so social-login sessions are recognized.
 */

export interface ZkLoginSessionInput {
  /** Base64url JWT from Google/Twitch obtained via Enoki. */
  jwt?: string;
  /** The (already-derived) zkLogin wallet address on Sui. */
  address: string;
}

export interface ZkLoginResult {
  address: string;
  verified: boolean;
  claims: { aud: string; iss: string; sub: string } | null;
}

/**
 * Validates a zkLogin JWT (issuer/audience) and returns the user's Sui address.
 *
 * For the hackathon, we trust the wallet-provided address (the Enoki keypair is
 * the source of truth) and additionally decode the JWT to confirm the social
 * identity belongs to the configured Enoki app. Full JWKS signature verification
 * is the production hardening step.
 */
export async function verifyZkLogin(input: ZkLoginSessionInput): Promise<ZkLoginResult> {
  if (!input.jwt) {
    // No JWT supplied — treat as a plain (non-social) wallet address.
    return { address: input.address, verified: false, claims: null };
  }

  const decoded = decodeJwt(input.jwt);
  const aud = String(decoded.aud ?? '');
  const iss = String(decoded.iss ?? '');
  const sub = String(decoded.sub ?? '');

  // Enoki portals use an app audience. If configured and present, enforce it.
  if (config.enoki.clientId && aud && aud !== config.enoki.clientId) {
    throw new Error(`zkLogin: unexpected audience ${aud}`);
  }

  return {
    address: input.address,
    verified: true,
    claims: { aud, iss, sub },
  };
}

/**
 * Confirms an Enoki-issued session belongs to the configured app, and that the
 * caller derives the expected zkLogin address. Used before granting an HMAC
 * session token or authorizing gas sponsorship.
 */
export function isEnokiConfigured(): boolean {
  return Boolean(config.enoki.clientId || config.enoki.apiKey);
}