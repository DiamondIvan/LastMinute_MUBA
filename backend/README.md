# backend

Node + Express + TypeScript. AI pipeline → Walrus → Sui `register_report`, plus
wallet-signature auth and a live-scraped daily crypto forecast.

## Status

Two independent AI-backed pipelines, both on OpenAI-wire-compatible providers
over plain `fetch` (no SDK):

- **Research pipeline** (`/api/research`) — targets **OpenRouter**
  (`OPENROUTER_API_KEY`). Runs a grounded web-search call plus three
  reasoning calls. Degrades to labelled demo data with no key set.
- **Forecast pipeline** (`/api/forecast/*`) — targets **Gonka**
  (`GONKA_API_KEY` / `GONKA_BASE_URL` / `GONKA_MODEL`, all broker-specific —
  Gonka is accessed through a broker/gateway and model ids are
  case-sensitive per broker). No hosted web search; it only writes prose over
  data already scraped/fetched by this backend. Degrades to labelled demo
  data with no key set.

Every AI call degrades to demo data on **either** a missing key or a failed
call (bad key, provider error, safety refusal) — never a bare 500.

```bash
cd backend
npm install
cp .env.example .env      # then fill it in
npm run dev               # http://localhost:8787
```

## Layout

```
src/
├── server.ts                Express app + routes
├── config.ts                env loading + chainConfigured() guard
├── ai/
│   ├── orClient.ts           OpenRouter client — chat(), parseJson()
│   ├── researchAgent.ts      OpenRouter + web plugin → briefing + sources
│   ├── credibilityAgent.ts   structured call → score 0..1, drop weak, sort
│   ├── analysisAgent.ts      structured call → sentiment / confidence / risk / key points
│   ├── synthesisAgent.ts     orchestrates the 4-call pipeline → { title, summary, full }
│   ├── types.ts              IntelligenceReport / Analysis / Source / ResearchResult
│   ├── gonka.ts               Gonka client — gonkaChat(), gonkaChatJson(), daily narration
│   └── openrouter.ts          stablecoin news/prediction analysis (despite the filename, runs on Gonka — see file header)
├── scraper/
│   ├── cryptoFeeds.ts         RSS-first daily news collector (forecast tab)
│   ├── marketData.ts          live peg/price/supply from DefiLlama's API
│   └── stablecoinScraper.ts   older anchor-scraping fallback (dashboard news widget)
├── db/newsCache.ts           JSON-file cache (data/news_db.json) — forecast + coin/news-impact TTLs
├── blockchain/
│   ├── suiClient.ts           SuiGrpcClient + admin Ed25519Keypair
│   ├── registerReport.ts      builds+signs the register_report PTB, returns the new object id
│   └── access.ts              hasResearchAccess(address, reportId) — read-only ownership check
├── walrus/uploadReport.ts    HTTP publisher upload / aggregator read
├── seal/sealService.ts       Seal encrypt/decrypt (falls back to plaintext — see docs/SECURITY.md)
├── auth/
│   ├── nonces.ts               in-memory nonce store
│   ├── verifySignature.ts      verifyPersonalMessageSignature + HMAC session token
│   └── zkLogin.ts               zkLogin JWT verification — not yet wired into a route
└── util/hash.ts               sha256 hex (the on-chain content_hash)
```

## Routes

| Method + path | Purpose |
| --- | --- |
| `GET /health` | status, network, AI/chain configuration flags |
| `POST /api/research` | `{ question }` → free summary + `analysis` + `contentHash` + `reportObjectId` |
| `POST /api/reports/:contentHash/unlock` | Bearer session token → `{ full }` iff that wallet owns a `ResearchAccess` |
| `POST /api/reports/register` | admin: generate → Walrus → `register_report` on Sui. Needs the chain env |
| `GET /api/forecast/daily` | live scraped + narrated daily forecast. `?coins=` filters, `?refresh=1` forces a fresh run |
| `GET /api/forecast/stablecoin-news` | older dashboard news widget — `stablecoinScraper.ts` + Gonka analysis |
| `POST /api/forecast/news-impact` | `{ title, coin, walletBalanceSui }` → Gonka-written market-impact analysis |
| `GET /api/forecast/coin/:symbol` | Gonka-written per-coin analysis |
| `POST /api/auth/nonce` | `{ address }` → `{ nonce, message }` |
| `POST /api/auth/verify` | `{ address, nonce, signature }` → `{ token }` |

## Env (`.env.example`)

`OPENROUTER_API_KEY` powers `/api/research`. `GONKA_API_KEY` +
`GONKA_BASE_URL` + `GONKA_MODEL` power `/api/forecast/*`'s narration —
`GONKA_MODEL` must be copied exactly (case-sensitive) from your broker's
model catalogue. `ADMIN_SECRET_KEY` is a `suiprivkey1...` string:
`sui keytool export --key-identity <your-testnet-address>`. Server-side only —
never in the frontend or git. `PACKAGE_ID` / `CONFIG_ID` / `ADMIN_CAP_ID` come
from `sui client publish`.

## Report → chain flow

1. `generateIntelligenceReport(question)` — the OpenRouter research pipeline.
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
- Gonka broker/model config is env-specific — verify `GONKA_BASE_URL` and
  `GONKA_MODEL` against your broker's own docs before assuming the defaults
  in `.env.example` still apply.
