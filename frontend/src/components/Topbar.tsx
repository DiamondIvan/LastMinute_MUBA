import { useCurrentAccount } from '@mysten/dapp-kit-react';

export function Topbar() {
  const account = useCurrentAccount();
  const displayAddress = account?.address 
    ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}` 
    : 'Connected Wallet';

  return (
    <header className="bg-white rounded-4xl px-8 py-4 mb-4 shadow-sm border border-gray-100 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-gray-900">Overview Dashboard</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* No search backend exists yet — disabled rather than an input that silently does nothing when you type. */}
        <div className="relative hidden md:block" title="Search coming soon">
          <input
            type="text"
            disabled
            placeholder="Search coming soon…"
            className="bg-gray-50 border border-gray-100 px-4 py-2.5 rounded-2xl text-sm w-64 text-gray-400 placeholder-gray-300 cursor-not-allowed"
          />
        </div>

        <div className="bg-brand-light text-brand px-4 py-2.5 rounded-2xl font-semibold text-sm flex items-center gap-2 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-brand animate-pulse"></span>
          {displayAddress}
        </div>
      </div>
    </header>
  );
}