import { useState } from 'react';
import { useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react';
import { Transaction } from '@mysten/sui/transactions';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import { CONFIG_ID } from '../contracts/constants';

const STABLECOINS = [
  { symbol: 'USDsui', name: 'Sui Dollar', priceUsd: 1.0 },
  { symbol: 'USDC', name: 'Native USD Coin', priceUsd: 1.0 },
  { symbol: 'FDUSD', name: 'First Digital USD', priceUsd: 1.0 },
  { symbol: 'BUCK', name: 'Bucket Protocol', priceUsd: 1.0 },
];

export function TransactionScreen() {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();

  const [selectedCoin, setSelectedCoin] = useState(STABLECOINS[0]);
  const [suiAmount, setSuiAmount] = useState('');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const suiPriceUsd = 1.65; // Simulated SUI price
  const estimatedOutput = Number(suiAmount) * suiPriceUsd;

  const handleBuy = async () => {
    if (!account) return;
    setError(null);
    setTxHash(null);
    setIsPending(true);
    try {
      const amountMist = Math.floor(Number(suiAmount) * 1e9);
      if (amountMist <= 0 || isNaN(amountMist)) {
        throw new Error('Please enter a valid amount');
      }

      const tx = new Transaction();
      // Simulating a purchase by splitting SUI and sending to the platform treasury
      const [payment] = tx.splitCoins(tx.gas, [amountMist]);
      tx.transferObjects([payment], CONFIG_ID);

      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      if (result) {
        if (result.$kind === 'FailedTransaction') {
          throw new Error('Transaction failed in the wallet');
        }
        setTxHash(result.Transaction?.digest || 'Success');
        setSuiAmount('');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Transaction failed');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FE] flex p-4 gap-4">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 bg-white rounded-4xl p-8 shadow-sm border border-gray-100 overflow-y-auto flex justify-center items-start pt-16">
          <div className="w-full max-w-md bg-white border border-gray-100 rounded-3xl p-8 shadow-lg">
            <h2 className="text-2xl font-black text-gray-900 mb-6">Buy Stablecoins</h2>

            <div className="space-y-6">
              {/* Asset Selection */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Select Asset</label>
                <div className="grid grid-cols-2 gap-3">
                  {STABLECOINS.map(coin => (
                    <button
                      key={coin.symbol}
                      onClick={() => setSelectedCoin(coin)}
                      className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                        selectedCoin.symbol === coin.symbol 
                          ? 'border-brand bg-brand/5' 
                          : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <div className="font-bold text-gray-900">{coin.symbol}</div>
                      <div className="text-xs text-gray-500 mt-1">{coin.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Input */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Pay with SUI</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={suiAmount}
                    onChange={(e) => setSuiAmount(e.target.value)}
                    placeholder="0.00"
                    className="bg-transparent text-3xl font-black text-gray-900 outline-none w-full placeholder-gray-300"
                  />
                  <span className="text-gray-900 font-bold text-lg bg-white px-3 py-1 rounded-lg border border-gray-200">SUI</span>
                </div>
              </div>

              {/* Output Display */}
              <div className="flex items-center justify-between px-2">
                <span className="text-sm font-bold text-gray-500">Estimated Output</span>
                <span className="text-xl font-black text-emerald-600">
                  {estimatedOutput > 0 ? `~${estimatedOutput.toFixed(2)} ${selectedCoin.symbol}` : '0.00'}
                </span>
              </div>

              {/* Error & Success States */}
              {error && (
                <div className="bg-red-50 text-red-700 text-sm font-bold p-3 rounded-xl border border-red-100">
                  {error}
                </div>
              )}
              {txHash && (
                <div className="bg-emerald-50 text-emerald-700 text-sm font-bold p-4 rounded-xl border border-emerald-100 break-words">
                  Transaction Successful! <br/>
                  <a 
                    href={`https://suiscan.xyz/testnet/tx/${txHash}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="underline text-emerald-800 text-xs mt-2 inline-block"
                  >
                    View on Explorer
                  </a>
                </div>
              )}

              {/* Action Button */}
              {!account ? (
                <div className="bg-amber-50 text-amber-800 text-sm font-bold p-4 rounded-xl text-center border border-amber-200">
                  Please connect your wallet to transact.
                </div>
              ) : (
                <button
                  onClick={handleBuy}
                  disabled={isPending || !suiAmount || Number(suiAmount) <= 0}
                  className="w-full bg-brand text-white font-black text-lg py-4 rounded-2xl hover:bg-brand/90 transition-all shadow-md shadow-brand/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isPending ? 'Confirm in Wallet...' : `Buy ${selectedCoin.symbol}`}
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
