import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import {
  enokiFlow,
  googleClientId,
  twitchClientId,
  enokiRedirectUrl,
  enokiConfigured,
} from '../lib/enoki';

export function LoginScreen() {
  const account = useCurrentAccount();
  const [email, setEmail] = useState('');
  const [socialBusy, setSocialBusy] = useState(false);
  const [socialError, setSocialError] = useState<string | null>(null);

  if (account) return <Navigate to="/dashboard" replace />;

  async function zkLogin(provider: 'google' | 'twitch') {
    const clientId = provider === 'google' ? googleClientId : twitchClientId;
    if (!enokiFlow || !clientId) {
      setSocialError(`Enoki / ${provider} not configured (VITE_ENOKI_API_KEY etc).`);
      return;
    }
    setSocialBusy(true);
    setSocialError(null);
    try {
      const url = await enokiFlow.createAuthorizationURL({
        provider,
        clientId,
        redirectUrl: enokiRedirectUrl,
        network: 'testnet',
      });
      window.location.assign(url);
    } catch (e) {
      setSocialError(e instanceof Error ? e.message : 'Failed to start zkLogin');
      setSocialBusy(false);
    }
  }

  // No email/passwordless auth backend exists yet. Kept as a disabled form
  // rather than removed, since wallet + Google zkLogin above are the two
  // working sign-in paths — this one just isn't built yet.

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F4F7FE]">
      <div className="bg-white w-full max-w-md p-8 rounded-4xl shadow-sm border border-gray-100 text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-brand flex items-center justify-center text-white font-bold text-xl shadow-md shadow-brand/20">
            M
          </div>
          <span className="text-2xl font-bold tracking-tight text-gray-900">MUBA AI</span>
        </div>

        <h2 className="text-xl font-bold text-gray-800 mb-2">Welcome Back</h2>
        <p className="text-gray-400 text-sm mb-8">
          Access verifiable intelligence on Sui — sign in with your social account, no seed phrase
          needed
        </p>

        {socialError && <p className="text-xs text-rose-600 mb-3">{socialError}</p>}

        {enokiConfigured && (
          <div className="space-y-3 mb-6">
            <button
              onClick={() => zkLogin('google')}
              disabled={socialBusy}
              className="w-full py-3 rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 font-medium text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span className="font-bold">G</span> Continue with Google
            </button>
            {twitchClientId && (
              <button
                onClick={() => zkLogin('twitch')}
                disabled={socialBusy}
                className="w-full py-3 rounded-2xl bg-[#9146FF] hover:opacity-90 text-white font-medium text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                Continue with Twitch
              </button>
            )}
            <p className="text-[10px] text-gray-400 mt-1">
              Gas fees are sponsored by Enoki — a zkLogin account is created for you with zero
              friction.
            </p>
          </div>
        )}

        <div className="mb-5">
          <div className="text-xs uppercase tracking-wider text-gray-400 font-medium mb-3">
            Or connect a wallet
          </div>
          <div className="flex justify-center">
            <ConnectButton className="!bg-brand hover:!bg-brand-dark !text-white !font-semibold !py-3 !px-6 !rounded-2xl !w-full !transition-all" />
          </div>
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 text-gray-400 font-medium">Or continue with</span>
          </div>
        </div>

        <div className="space-y-3" title="Coming soon">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            disabled
            className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-100 text-sm text-gray-400 placeholder-gray-300 cursor-not-allowed"
          />
          <button
            type="button"
            disabled
            className="w-full py-3 rounded-2xl bg-gray-100 text-gray-400 font-medium text-sm cursor-not-allowed flex items-center justify-center gap-2"
          >
            Continue with Email
            <span className="text-[9px] font-black uppercase bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">Soon</span>
          </button>
        </div>
      </div>
    </div>
  );
}