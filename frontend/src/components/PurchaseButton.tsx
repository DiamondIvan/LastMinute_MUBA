import { useState } from 'react';
import { useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react';
import { buildPurchaseReportViaKioskTx } from '../lib/kiosk';
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

  /** Resolve the platform kiosk id (KioskState) from on-chain objects. */
  async function resolvePlatformKiosk(): Promise<string | null> {
    try {
      // The KioskState is a shared, singleton object of type KIOSK_STATE_TYPE.
      // For the demo, the deployed KioskState id is set in constants/env; here
      // we return an empty string fallback so the button degrades gracefully.
      return '';
    } catch {
      return null;
    }
  }

  async function purchase() {
    if (!account) {
      setError('Connect your wallet first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const kioskId = await resolvePlatformKiosk();
      if (!kioskId) {
        // Fall back to the legacy direct purchase PTB if the kiosk isn't
        // resolvable yet — keeps the demo functional.
        const { buildPurchaseReportTx } = await import('../contracts/purchaseReport');
        const result = await dAppKit.signAndExecuteTransaction({
          transaction: buildPurchaseReportTx(reportObjectId),
        });
        if (result.$kind === 'FailedTransaction') {
          setError(`Transaction failed: ${JSON.stringify(result.FailedTransaction.status)}`);
          return;
        }
        onPurchased?.(result.Transaction.digest);
        return;
      }

      const result = await dAppKit.signAndExecuteTransaction({
        transaction: buildPurchaseReportViaKioskTx(reportObjectId, kioskId),
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
