import { NavLink } from 'react-router-dom';
import { useDAppKit } from '@mysten/dapp-kit-react';

export function Sidebar() {
  const dAppKit = useDAppKit();

  return (
    <aside className="w-64 bg-white rounded-4xl p-6 flex flex-col justify-between shadow-sm border border-gray-100 hidden lg:flex">
      <div>
        <div className="flex items-center gap-3 px-2 mb-10">
          <div className="w-9 h-9 rounded-2xl bg-brand flex items-center justify-center text-white font-bold shadow-md shadow-brand/20">
            M
          </div>
          <span className="text-xl font-bold tracking-tight text-gray-900">MUBA AI</span>
        </div>

        <nav className="space-y-2 font-medium text-sm">
          <NavLink 
            to="/dashboard" 
            className={({ isActive }) => 
              `flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${isActive ? 'bg-brand text-white shadow-md shadow-brand/20' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/forecast"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${
                isActive
                  ? 'bg-brand text-white shadow-md shadow-brand/20'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
              }`
            }
          >
            Latest Forecast
          </NavLink>
          <NavLink
            to="/transaction"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${
                isActive
                  ? 'bg-brand text-white shadow-md shadow-brand/20'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
              }`
            }
          >
            Transaction
          </NavLink>
          {/* Not built yet — disabled rather than a live-looking link to nowhere. */}
          <div
            aria-disabled="true"
            title="Coming soon"
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl font-medium text-sm text-gray-300 cursor-not-allowed select-none"
          >
            History
            <span className="text-[9px] font-black uppercase bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">Soon</span>
          </div>
          <div
            aria-disabled="true"
            title="Coming soon"
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl font-medium text-sm text-gray-300 cursor-not-allowed select-none"
          >
            Settings
            <span className="text-[9px] font-black uppercase bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">Soon</span>
          </div>
        </nav>
      </div>

      <div className="pt-4 border-t border-gray-100">
        <button 
          onClick={() => dAppKit.disconnectWallet()}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-red-500 hover:bg-red-50 font-medium text-sm transition-all"
        >
          Disconnect Wallet
        </button>
      </div>
    </aside>
  );
}