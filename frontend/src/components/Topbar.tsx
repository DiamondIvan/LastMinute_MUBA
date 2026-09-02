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
        <div className="relative hidden md:block">
          <input 
            type="text" 
            placeholder="Search reports or blobs..." 
            className="bg-gray-50 border border-gray-100 px-4 py-2.5 rounded-2xl text-sm w-64 focus:outline-none focus:ring-2 focus:ring-brand/50 transition-all"
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