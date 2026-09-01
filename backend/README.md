# backend

Node + Express + TypeScript. AI pipeline → Walrus → Sui `register_report`, plus
wallet-signature auth.

## Status: scaffolded, AI agents implemented

The AI agents make **real Claude calls** (`@anthropic-ai/sdk`, model
`claude-opus-5`, set in `src/ai/claude.ts`). Blockchain + Walrus + auth paths
use the real SDKs too. Set `ANTHROPIC_API_KEY` in `.env` to use `/api/research`.

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
│   ├── claude.ts           shared Anthropic client + MODEL constant
│   ├── types.ts            IntelligenceReport / Analysis / Source / ResearchResult
│   ├── researchAgent.ts    Claude + web_search server tool → briefing + sources
│   ├── credibilityAgent.ts structured call → score 0..1, drop weak, sort
│   ├── analysisAgent.ts    structured call → sentiment / confidence / risk / key points
│   └── synthesisAgent.ts   orchestrates the 4-call pipeline → { title, summary, full }
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

`ANTHROPIC_API_KEY` powers the agents (dotenv loads it; the SDK reads it).
`ADMIN_SECRET_KEY` is a `suiprivkey1...` string:
`sui keytool export --key-identity <your-testnet-address>`. Server-side only —
never in the frontend or git. `PACKAGE_ID` / `CONFIG_ID` / `ADMIN_CAP_ID` come
from `sui client publish`.

## AI pipeline (`src/ai/`)

`generateIntelligenceReport(question)` runs four Claude calls:

1. **research** — `claude-opus-5` + the `web_search` server tool → a factual
   briefing plus the sources it cited.
2. **credibility** — structured call scoring each source 0..1; drops anything
   below 0.35, sorts best-first.
3. **analysis** — structured call → `{ sentiment, confidence, risk,
   keyDevelopments, risks }`, grounded only in the briefing.
4. **synthesis** — structured call → `{ title, summary, full }`.

Model is set in `src/ai/claude.ts`. ~4 model calls + web search per report
(tens of seconds). For deterministic RSS sources alongside web search, add a
fetcher and merge into `research()`.

## Report → chain flow

1. `generateIntelligenceReport(question)` (the AI pipeline above).
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
