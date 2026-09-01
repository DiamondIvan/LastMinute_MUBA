# frontend

React + TypeScript + Vite + Sui dApp Kit (the **2.0 / gRPC** stack).

## Stack — verified against the official Sui 2.0 migration guide

https://sdk.mystenlabs.com/sui/migrations/sui-2.0/dapp-kit

- `@mysten/dapp-kit-react` + `@mysten/dapp-kit-core` — the current React bindings.
  The old `@mysten/dapp-kit` is **deprecated** (JSON-RPC only, no more updates).
- `@mysten/sui` with `SuiGrpcClient` from `@mysten/sui/grpc` — gRPC, because
  public JSON-RPC fullnodes are shut off.
- `@tanstack/react-query` is **optional** now (only if you want query/mutation
  state helpers). The starter below skips it.

## Scaffold

```bash
# from the repo root
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install @mysten/dapp-kit-react @mysten/dapp-kit-core @mysten/sui
npm run dev
```

## `src/dapp-kit.ts`

```ts
import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';

const GRPC_URLS = {
  testnet: 'https://fullnode.testnet.sui.io:443',
} as const;

export const dAppKit = createDAppKit({
  networks: ['testnet'],
  createClient(network) {
    return new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] });
  },
});

// Global type registration — required for the hooks to infer network/client types.
declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
```

## `src/App.tsx`

```tsx
import { DAppKitProvider, useCurrentAccount } from '@mysten/dapp-kit-react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { dAppKit } from './dapp-kit';

function WalletStatus() {
  const account = useCurrentAccount();
  return account
    ? <p>Connected: {account.address}</p>
    : <p>Wallet not connected</p>;
}

export default function App() {
  return (
    <DAppKitProvider dAppKit={dAppKit}>
      <main>
        <h1>MUBA AI Intelligence Marketplace</h1>
        <ConnectButton />
        <WalletStatus />
      </main>
    </DAppKitProvider>
  );
}
```

## `src/contracts/constants.ts`

Fill in after `sui client publish`.

```ts
export const PACKAGE_ID = '0xYOUR_PACKAGE_ID';
export const CONFIG_ID  = '0xYOUR_PLATFORMCONFIG_OBJECT_ID';
export const CLOCK_ID   = '0x6'; // shared Clock, fixed address

export const REPORT_PRICE_MIST       = 5_000_000; // 0.005 SUI
export const SUBSCRIPTION_PRICE_MIST = 10_000_000; // 0.01 SUI
```

## `src/contracts/purchaseReport.ts`

Wired to our contract: `news_platform::purchase_report(config, report, payment, clock)`.

```ts
import { Transaction, coinWithBalance } from '@mysten/sui/transactions';
import { PACKAGE_ID, CONFIG_ID, CLOCK_ID, REPORT_PRICE_MIST } from './constants';

export function buildPurchaseReportTx(reportObjectId: string) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::news_platform::purchase_report`,
    arguments: [
      tx.object(CONFIG_ID),
      tx.object(reportObjectId),
      coinWithBalance({ balance: REPORT_PRICE_MIST }), // exact-price coin (contract asserts ==)
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}
```

## `src/PurchaseButton.tsx`

```tsx
import { useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react';
import { buildPurchaseReportTx } from './contracts/purchaseReport';

export function PurchaseButton({ reportObjectId }: { reportObjectId: string }) {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();

  async function purchase() {
    if (!account) return alert('Connect your wallet first.');
    const tx = buildPurchaseReportTx(reportObjectId);
    const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
    if (result.$kind === 'FailedTransaction') {
      console.error('purchase failed', result.FailedTransaction);
      return;
    }
    console.log('digest', result.Transaction.digest);
    // result.Transaction.effects is included by default
  }

  return <button onClick={purchase}>Unlock Full Intelligence — 0.005 SUI</button>;
}
```

## `src/hooks/useResearchAccess.ts`

Answers "does this wallet own access to this report?".

```ts
import { useCurrentAccount, useCurrentClient } from '@mysten/dapp-kit-react';
import { useEffect, useState } from 'react';
import { PACKAGE_ID } from '../contracts/constants';

export function useResearchAccess() {
  const account = useCurrentAccount();
  const client = useCurrentClient();
  const [objects, setObjects] = useState<any[]>([]);

  useEffect(() => {
    if (!account) { setObjects([]); return; }
    client
      .listOwnedObjects({
        owner: account.address,
        type: `${PACKAGE_ID}::news_platform::ResearchAccess`,
        include: { content: true },
        limit: 50,
      })
      .then((res) => setObjects(res.objects))
      .catch(console.error);
  }, [account, client]);

  return objects; // each has .objectId and (with content) the Move fields incl. report_id
}
```

## Tier-1 flow

connect wallet → ask AI (backend) → show free summary → `PurchaseButton` →
`signAndExecuteTransaction` → `useResearchAccess()` sees the new object → unlock
the matching report → show content hash + Walrus blob id + "Verified on Sui ✓".

## Still to confirm when you build

- Exact `SuiGrpcClient` option name if `baseUrl` errors (published type allows
  `{ network, baseUrl }` or `{ network, transport }`).
- Whether `listOwnedObjects` `include` takes `{ content: true }` vs another key on
  the gRPC client — check the response and adjust.
