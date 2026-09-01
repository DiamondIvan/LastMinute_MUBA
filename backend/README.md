# backend

Node + Express + TypeScript. AI pipeline → Walrus → Sui `register_report`, plus
wallet-signature auth.

## Status: scaffolded

Structure and wiring are in place. The **AI agents are stubs** (typed, but no
model calls yet). Blockchain + Walrus + auth paths use the real SDKs.

```bash
cd backend
npm install
cp .env.example .env      # then fill it in
npm run dev               # http://localhost:8787
```

## Layout

```
src/
├── server.ts              Express app + routes
├── config.ts              env loading + chainConfigured() guard
├── ai/
│   ├── types.ts            IntelligenceReport / Analysis / Source
│   ├── researchAgent.ts    STUB — collect + dedupe sources
│   ├── credibilityAgent.ts STUB — score/filter sources
│   ├── analysisAgent.ts    STUB — sentiment / confidence / risk
│   └── synthesisAgent.ts   orchestrates the pipeline (stub synthesis)
├── news/newsService.ts     STUB — RSS / news API / search
├── blockchain/
│   ├── suiClient.ts         SuiGrpcClient + admin Ed25519Keypair
│   └── registerReport.ts    builds+signs the register_report PTB, returns the new object id
├── walrus/uploadReport.ts   HTTP publisher upload / aggregator read
├── auth/
│   ├── nonces.ts            in-memory nonce store
│   └── verifySignature.ts   verifyPersonalMessageSignature + HMAC session token
└── util/hash.ts             sha256 hex (the on-chain content_hash)
```

## Routes

| Method + path | Purpose |
| --- | --- |
| `GET /health` | status, network, whether the chain env is configured |
| `POST /api/research` | `{ question }` → runs the pipeline, returns the **free** summary + `contentHash` |
| `GET /api/reports/:contentHash/full` | the premium body — **TODO: gate on ResearchAccess ownership** |
| `POST /api/reports/register` | admin: generate → Walrus → `register_report` on Sui. Needs the chain env. |
| `POST /api/auth/nonce` | `{ address }` → `{ nonce, message }` |
| `POST /api/auth/verify` | `{ address, nonce, signature }` → `{ token }` |

## Env (`.env.example`)

`ADMIN_SECRET_KEY` is a `suiprivkey1...` string:
`sui keytool export --key-identity <your-testnet-address>`. Server-side only —
never in the frontend or git. `PACKAGE_ID` / `CONFIG_ID` / `ADMIN_CAP_ID` come
from `sui client publish`.

## Report → chain flow

1. `generateIntelligenceReport(question)` (AI pipeline, stubbed).
2. `sha256Hex(report.full)` → `content_hash`.
3. `uploadToWalrus(report.full)` → `blobId`. **Walrus blobs are public** — body only.
4. `registerReport({ title, contentHash, walrusBlobId })` signs with the AdminCap
   holder and returns the new `ResearchReport` object id.

## Confirm at build time

- `tx.pure.string(...)` for the Move `vector<u8>` params (title / hash / blob id).
- The `include` / result shape on `signAndExecuteTransaction` for the gRPC client
  (`registerReport.ts` reads `result.Transaction.objectTypes` then falls back to
  `effects.changedObjects`).
- Walrus testnet publisher response keys (`newlyCreated.blobObject.blobId` vs
  `alreadyCertified.blobId`).
