# frontend

Not scaffolded yet. Create the Vite app **into this folder**:

```bash
# from the repo root
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

Then add the Sui packages. **Verify the exact package + client API against the
current docs first** (https://sdk.mystenlabs.com/dapp-kit) — the ChatGPT tutorial
referenced `@mysten/dapp-kit-react` + `SuiGrpcClient`, which may not match the
released API. The widely-documented setup is:

```bash
npm install @mysten/dapp-kit @mysten/sui @tanstack/react-query
```

with `SuiClientProvider` + `WalletProvider` + `ConnectButton` from
`@mysten/dapp-kit` and `SuiClient` from `@mysten/sui/client`.

## What this app needs to do (Tier 1)

1. Connect a Sui wallet.
2. Take a question, call the backend AI, show the free summary.
3. "Unlock — 0.005 SUI" button → build a PTB that calls
   `blockchain::news_platform::purchase_report` with
   `[config, report, coinWithBalance({ balance: 5_000_000 }), object("0x6")]`.
4. After success, list the wallet's `ResearchAccess` objects
   (`type: ${PACKAGE_ID}::news_platform::ResearchAccess`) and unlock the report
   whose `report_id` matches.
5. Show "Verified on Sui ✓" with the content hash + Walrus blob id.

Contract ids go in `frontend/src/contracts/constants.ts` after `sui client publish`.
