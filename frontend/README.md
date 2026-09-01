# frontend

React + TypeScript + Vite, on the **Sui 2.0 / gRPC dApp Kit** stack.

## Status: scaffolded

App skeleton and starter modules are committed. Dependencies are **not** installed
yet and nothing has been run.

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

## Stack — verified against the official Sui 2.0 migration guide

https://sdk.mystenlabs.com/sui/migrations/sui-2.0/dapp-kit

- `@mysten/dapp-kit-react` + `@mysten/dapp-kit-core` — current React bindings.
  The old `@mysten/dapp-kit` is **deprecated** (JSON-RPC only).
- `@mysten/sui` with `SuiGrpcClient` from `@mysten/sui/grpc` — gRPC, because
  public JSON-RPC fullnodes are shut off.
- `@tanstack/react-query` is optional and not included.

## Files

| File | Purpose |
| --- | --- |
| `src/dapp-kit.ts` | `createDAppKit` + `SuiGrpcClient` + global `Register` type |
| `src/App.tsx` | `DAppKitProvider`, `ConnectButton`, demo marketplace UI |
| `src/contracts/constants.ts` | `PACKAGE_ID` / `CONFIG_ID` (placeholders) + prices matching the Move module |
| `src/contracts/purchaseReport.ts` | PTBs for `purchase_report(config, report, payment, clock)` and `subscribe(...)` |
| `src/components/PurchaseButton.tsx` | calls `useDAppKit().signAndExecuteTransaction(...)`, handles the `$kind` result union |
| `src/hooks/useResearchAccess.ts` | `client.listOwnedObjects({ type: ...::ResearchAccess })` |

## To make it transact

1. Publish the contract (repo README → "Deploy to Sui Testnet").
2. Put the real `PackageID` and `PlatformConfig` object id into
   `src/contracts/constants.ts`. `contractsConfigured()` gates the buttons until
   you do.
3. Replace `DEMO_REPORT_ID` in `src/App.tsx` with a registered `ResearchReport`
   object id (comes from the backend calling `register_report`).

## Tier-1 flow

connect wallet → ask AI (backend) → free summary → **PurchaseButton** →
`signAndExecuteTransaction` → `useResearchAccess()` sees the new object → unlock
the matching report → show content hash + Walrus blob id + "Verified on Sui ✓".

## Confirm at build time

- `SuiGrpcClient` option name if `baseUrl` errors (published type allows
  `{ network, baseUrl }` or `{ network, transport }`).
- The `include` option and content shape on `listOwnedObjects` for the gRPC
  client — `useResearchAccess.ts` parses defensively; adjust once you see a real
  response.
- `coinWithBalance` import path (`@mysten/sui/transactions`) and that exact-price
  coin splitting works with the wallet you test.
