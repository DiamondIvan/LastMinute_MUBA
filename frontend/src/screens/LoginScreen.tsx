import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';

export function LoginScreen() {
  const account = useCurrentAccount();
  const [email, setEmail] = useState('');

  if (account) return <Navigate to="/dashboard" replace />;

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Email login requested for: ${email}\n(zkLogin integration ready)`);
  };

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
        <p className="text-gray-400 text-sm mb-8">Access verifiable intelligence on Sui</p>

        <div className="mb-6 flex justify-center">
          <ConnectButton className="!bg-brand hover:!bg-brand-dark !text-white !font-semibold !py-3 !px-6 !rounded-2xl !w-full !transition-all" />
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-3 text-gray-400 font-medium">Or continue with</span></div>
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-100 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand/50 transition-all"
            required
          />
          <button
            type="submit"
            className="w-full py-3 rounded-2xl bg-gray-900 hover:bg-black text-white font-medium text-sm transition-all shadow-sm"
          >
            Continue with Email
          </button>
        </form>
      </div>
    </div>
  );
}