import { useState, useEffect, useCallback } from 'react';
import { useCurrentAccount, useCurrentClient } from '@mysten/dapp-kit-react';

export function useSuiBalance() {
  const account = useCurrentAccount();
  const client = useCurrentClient();
  const [balance, setBalance] = useState<string>('0.00');
  const [loading, setLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!account) {
      setBalance('0.00');
      return;
    }
    setLoading(true);
    try {
      const res = await client.getBalance({ owner: account.address });
      const balanceStr = (res as any)?.balance?.balance ?? (res as any)?.totalBalance ?? '0';
      const suiValue = Number(balanceStr) / 1_000_000_000;
      setBalance(suiValue.toFixed(4));
    } catch (err) {
      console.error('Failed to fetch balance:', err);
      setBalance('0.00');
    } finally {
      setLoading(false);
    }
  }, [account, client]);

  useEffect(() => {
    void fetchBalance();
  }, [fetchBalance]);

  return { balance, loading, refreshBalance: fetchBalance };
}