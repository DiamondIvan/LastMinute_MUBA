import { EnokiFlow, registerEnokiWallets, type AuthProvider } from '@mysten/enoki';
import { SuiGrpcClient } from '@mysten/sui/grpc';

/**
 * zkLogin + Enoki onboarding.
 *
 * - `registerEnokiWallets` lets users sign in with Google/Twitch via zkLogin
 *   (no seed phrase). The resulting Enoki wallets appear alongside the standard
 *   Sui wallets in the `ConnectButton`.
 * - Enoki sponsors transaction gas fees for a frictionless beginner experience.
 *
 * Config comes from Vite env vars (see frontend/.env.local.example). Set:
 *   VITE_ENOKI_API_KEY       — Enoki app API key (Enoki Portal)
 *   VITE_GOOGLE_CLIENT_ID    — Google OAuth client id
 *   VITE_TWITCH_CLIENT_ID    — Twitch OAuth client id
 *   VITE_REDIRECT_URL        — e.g. http://localhost:5173
 */

const TESTNET_GRPC_URL = 'https://fullnode.testnet.sui.io:443';

export const enokiApiKey = import.meta.env.VITE_ENOKI_API_KEY as string | undefined;
export const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
export const twitchClientId = import.meta.env.VITE_TWITCH_CLIENT_ID as string | undefined;
export const enokiRedirectUrl =
  (import.meta.env.VITE_REDIRECT_URL as string | undefined) ??
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');

export const enokiConfigured = Boolean(enokiApiKey && (googleClientId || twitchClientId));

/** EnokiFlow instance used for direct (non-dapp-kit) zkLogin flows. */
export const enokiFlow = enokiApiKey ? new EnokiFlow({ apiKey: enokiApiKey }) : null;

const enokiClient = new SuiGrpcClient({
  network: 'testnet' as const,
  baseUrl: TESTNET_GRPC_URL,
});

/**
 * Registers the Enoki social wallets (Google/Twitch) into dapp-kit's wallet
 * system so `ConnectButton` can show them. Call once at app startup
 * (main.tsx) after `dAppKit` is created.
 */
export function registerEnoki(): { unregister: () => void } | null {
  if (!enokiApiKey) {
    // No Enoki key configured — nothing to register (standard wallets only).
    return null;
  }

  const providers: Partial<Record<AuthProvider, { clientId: string; redirectUrl: string }>> = {};
  if (googleClientId) {
    providers.google = { clientId: googleClientId, redirectUrl: enokiRedirectUrl };
  }
  if (twitchClientId) {
    providers.twitch = { clientId: twitchClientId, redirectUrl: enokiRedirectUrl };
  }

  if (Object.keys(providers).length === 0) {
    return null;
  }

  return registerEnokiWallets({
    providers,
    apiKey: enokiApiKey,
    client: enokiClient as any,
    network: 'testnet',
  });
}