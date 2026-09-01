import { useState } from 'react';
import { useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react';
import { buildPurchaseReportTx } from '../contracts/purchaseReport';
import { contractsConfigured } from '../contracts/constants';

interface Props {
  reportObjectId: string;
  onPurchased?: (digest: string) => void;
}

export function PurchaseButton({ reportObjectId, onPurchased }: Props) {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function purchase() {
    if (!account) {
      setError('Connect your wallet first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await dAppKit.signAndExecuteTransaction({
        transaction: buildPurchaseReportTx(reportObjectId),
      });

      if (result.$kind === 'FailedTransaction') {
        setError(`Transaction failed: ${JSON.stringify(result.FailedTransaction.status)}`);
        return;
      }
      onPurchased?.(result.Transaction.digest);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button onClick={purchase} disabled={busy || !contractsConfigured()}>
        {busy ? 'Confirm in wallet…' : 'Unlock Full Intelligence — 0.005 SUI'}
      </button>
      {!contractsConfigured() && (
        <p className="muted">Set PACKAGE_ID / CONFIG_ID in src/contracts/constants.ts first.</p>
      )}
      {error && <p className="muted">{error}</p>}
    </div>
  );
}
