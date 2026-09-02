interface AiBriefingCardProps {
  onUnlock: () => void;
  purchasing: boolean;
  purchaseError: string | null;
  canPurchase: boolean;
}

export function AiBriefingCard({ onUnlock, purchasing, purchaseError, canPurchase }: AiBriefingCardProps) {
  return (
    <div className="bg-gradient-to-r from-purple-900 to-brand text-white p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
      <div>
        <span className="bg-white/20 text-white px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">Latest AI Briefing</span>
        <h3 className="text-2xl font-bold mt-2">Sui Ecosystem & Walrus Storage Integrity Report</h3>
        <p className="text-white/80 text-sm mt-1 max-w-xl">
          Cryptographically anchored intelligence compiled by Claude multi-agent pipeline. Secure your 7-day access pass on-chain instantly.
        </p>
        {purchaseError && <p className="text-pink-300 text-xs mt-2">{purchaseError}</p>}
      </div>
      <button
        onClick={onUnlock}
        disabled={purchasing || !canPurchase}
        className="bg-white text-brand hover:bg-gray-100 font-bold px-6 py-3.5 rounded-2xl shadow-md transition-all whitespace-nowrap disabled:opacity-50 cursor-pointer"
      >
        {purchasing ? 'Confirming in Wallet...' : 'Unlock Intelligence — 0.005 SUI'}
      </button>
    </div>
  );
}