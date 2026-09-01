# backend

Not scaffolded yet.

```bash
# from the repo root
cd backend
npm init -y
npm install express cors dotenv @mysten/sui
npm install -D typescript tsx @types/express @types/cors @types/node
npx tsc --init
```

Copy `.env.example` to `.env` and fill it in.

## Planned structure

```
backend/src/
├── server.ts
├── ai/            researchAgent.ts · analysisAgent.ts · credibilityAgent.ts · synthesisAgent.ts
├── news/          newsService.ts · scraper.ts
├── blockchain/    suiClient.ts · registerReport.ts   (uses ADMIN_PRIVATE_KEY + AdminCap)
├── walrus/        uploadReport.ts
└── auth/          verifySignature.ts   (verifyPersonalMessageSignature — nonce challenge)
```

## Report → chain flow

1. AI agents produce the intelligence report (off-chain).
2. `sha256(report)` → content hash.
3. Upload the full report to Walrus → blob id. **Walrus blobs are public — never
   upload keys, personal data, or paid-only content you don't want leaked.**
4. Admin wallet calls `news_platform::register_report(adminCap, config, title,
   contentHash, walrusBlobId, clock, ...)`.

The admin private key lives only here, only in `.env`, only on the server.
