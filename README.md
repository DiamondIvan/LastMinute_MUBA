# MUBA AI Intelligence Marketplace

AI turns thousands of news sources into actionable intelligence; **Sui** makes that
intelligence verifiable, ownable, and accessible.

Built for the MUBA Blockchain Hackathon — AI × Sui track.

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | React + TypeScript + Vite + Sui dApp Kit |
| Backend | Node + Express, AI research/analysis agents |
| Storage | Walrus (full report blobs) |
| Chain | Sui + Move 2024 (`blockchain/` package) |

## Architecture

```
News sources ──▶ AI agents ──▶ Intelligence report
                                     │
                        ┌────────────┴────────────┐
                        ▼                         ▼
                     Walrus                  SHA-256 hash
                  (full report)                   │
                        └────────────┬────────────┘
                                     ▼
                                    Sui
                     payment · ownership · access · provenance
```

Sui stores only the minimum: report title, content hash, Walrus blob id, and the
per-user `ResearchAccess` / `PremiumPass` objects. The report body never goes
on-chain.

## Repo layout

```
muba-ai-news/
├── blockchain/           Sui Move package
│   ├── Move.toml
│   ├── sources/news_platform.move
│   └── tests/news_platform_tests.move
├── frontend/             React app (Vite + Tailwind + Sui dApp Kit)
├── backend/              AI research agents + Walrus + admin registration
└── ai-layer/             Python stablecoin risk pipeline (standalone)
```

## `ai-layer/` — Sui stablecoin risk pipeline

A standalone Python pipeline, independent of the Node backend and the contract:

```
data_sources.py → metrics.py → scoring.py → ai_layer.py → report.py
(live Sui data)   (sub-scores)  (0-100 + band)  (LLM narrative)  (md + JSON)
```

**Deterministic first, AI second.** Every risk *number* is computed by
rule-based logic, so the scores are reproducible and auditable; the model only
writes the narrative on top. With `--no-ai` it produces a full quantitative
report and makes no model calls at all.

```bash
cd ai-layer
pip install -r requirements.txt
python main.py --no-ai --out ./reports     # quant only, no API key needed
python main.py --with-news                 # adds the news agent
```

Verified working: pulls 8 live Sui stablecoins and ranks them USDC (8.0, LOW)
through BUCK (45.5, HIGH).

> **Note:** this layer calls **OpenAI** (`openai` in `requirements.txt`,
> `MODEL = "gpt-5.6"`), while the Node backend in `backend/` uses **Claude**.
> The `ai-layer` README text refers to Claude; the code does not. Worth
> reconciling before the pitch so the stack story is consistent.

## Blockchain — build & test

Requires the Sui toolchain (not bundled). Install it first:

```bash
# Windows: download suiup from https://github.com/MystenLabs/suiup/releases
# put suiup.exe on your PATH, then:
suiup install sui@testnet
suiup install walrus
sui --version
```

Then:

```bash
cd blockchain
sui move build
sui move test
```

If `sui move build` complains about the edition, open `blockchain/Move.toml` and
try `edition = "2024.beta"` instead of `edition = "2024"`. If it reports an
unbound module `transfer` / `object` / `tx_context`, add the matching
`use sui::<module>;` line at the top of `news_platform.move` (newer toolchains
import these implicitly; older ones do not).

## Deployed to Sui Testnet

Current deployment (2026-09-02, tx `VqQjyNqo1AginGHMQ3HtiRwPvdVNDh2M3MbXB4Y7TjY`):

| Value | ID | Wired into |
| --- | --- | --- |
| PackageID | `0x0047c06a35bf05d6148797eeeeada97d134f64410ff65ed88e8792770df87b9b` | `frontend/src/contracts/constants.ts`, `backend/.env.example` |
| PlatformConfig (shared) | `0x6df54fa32eff53523793d1ee1fe602076309dbede5803b9e300ffffb11b90c77` | same |
| AdminCap (deployer wallet) | `0xa8d9900d8e2f9e2264d229297c97c2e8ccce5383e9da9997527d960e591edb94` | `backend/.env` only — never the frontend |
| UpgradeCap (deployer wallet) | `0xfd6fb64f453e3fec51501beed0eeb72d3a96171627b3f6c0fbc2d695c4105ab5` | keep for `sui client upgrade` |
| Demo ResearchReport (verifiable) | `0xc63fd6d76b573c69dfc54162b6ded41f5601c0354d2276330ae09297505d4a69` | `DEMO_REPORT_OBJECT_ID` in `backend/.env` and `frontend/src/contracts/constants.ts` |

### Re-deploying (new package)

```bash
sui client switch --env testnet
sui client gas                            # need ~0.03 SUI; sui client faucet / faucet.sui.io if empty
cd blockchain
sui client publish --gas-budget 100000000
```

Then update the PackageID + PlatformConfig id in `frontend/src/contracts/constants.ts`
and `backend/.env` (+ AdminCap id in `backend/.env`).

## Register a demo report

Creates one on-chain `ResearchReport` so the frontend has something to buy. No
API key or backend needed — just the AdminCap holder wallet:

```bash
sui client call \
  --package 0x0047c06a35bf05d6148797eeeeada97d134f64410ff65ed88e8792770df87b9b \
  --module news_platform \
  --function register_report \
  --args \
    0xa8d9900d8e2f9e2264d229297c97c2e8ccce5383e9da9997527d960e591edb94 \
    0x6df54fa32eff53523793d1ee1fe602076309dbede5803b9e300ffffb11b90c77 \
    "BTC Intelligence Report" \
    "0000000000000000000000000000000000000000000000000000000000000000" \
    "demo-walrus-blob-id" \
    0x6 \
  --gas-budget 20000000
```

(PowerShell: use a backtick `` ` `` for line continuation, or put it all on one line.)
In the output, the **Created Object** of type `...::news_platform::ResearchReport`
is the report id — put it in `backend/.env` as `DEMO_REPORT_OBJECT_ID`.

If the CLI rejects the string args for `vector<u8>`, pass hex instead, e.g.
`0x42544320496e74656c6c6967656e6365205265706f7274` for the title.

## Register the verification demo report

The report registered above uses a placeholder hash, so verification will always
fail against it. For the **Verify** demo you need a report whose `content_hash`
is the real SHA-256 of a known text.

`frontend/src/demoReport.ts` holds that text; its hash is
`f88ab174c94559767c52fc0864404a241f8c5c90691dde84779e04ef149525c9`.

```bash
sui client call --package 0x0047c06a35bf05d6148797eeeeada97d134f64410ff65ed88e8792770df87b9b --module news_platform --function register_report --args 0xa8d9900d8e2f9e2264d229297c97c2e8ccce5383e9da9997527d960e591edb94 0x6df54fa32eff53523793d1ee1fe602076309dbede5803b9e300ffffb11b90c77 "BTC Intelligence Report (verifiable)" "f88ab174c94559767c52fc0864404a241f8c5c90691dde84779e04ef149525c9" "demo-walrus-blob-id" 0x6 --gas-budget 20000000
```

**Already done** — the current demo report is `0xc63fd6d76b573c69dfc54162b6ded41f5601c0354d2276330ae09297505d4a69`,
registered with the real hash and wired into both `backend/.env.example` and
`frontend/src/contracts/constants.ts`. Re-run the command above only if you
change `DEMO_REPORT_TEXT`.

If you edit `DEMO_REPORT_TEXT`, the hash changes: run the app, click **Verify**,
and the failure panel prints the new hash — register a fresh report with that.

## Move module: `blockchain::news_platform`

| Object | Meaning |
| --- | --- |
| `PlatformConfig` | shared singleton: prices, durations, treasury, report registry |
| `AdminCap` | capability to register reports / change settings — admin wallet only |
| `PremiumPass` | time-boxed "all reports" subscription, owned by the subscriber |
| `ResearchReport` | shared provenance record: title, content hash, Walrus blob id, creator |
| `ResearchAccess` | proof a wallet bought time-boxed access to one report |

| Entry function | Who | Effect |
| --- | --- | --- |
| `subscribe` | anyone | pays exact `subscription_price`, gets a `PremiumPass` |
| `renew` | pass owner | extends their `PremiumPass` |
| `register_report` | `AdminCap` holder | anchors a report's hash + Walrus id on-chain (rejects duplicate hashes) |
| `purchase_report` | anyone | pays exact `report_price`, gets a `ResearchAccess` |
| `update_treasury` | `AdminCap` holder | changes the payout address |

Design notes:

- **No `withdraw()`.** Every payment is forwarded to the treasury in the same
  call, so the contract never holds a balance — nothing to withdraw, and a whole
  class of bugs disappears.
- **Exact payment only** (`amount == price`, not `>=`) keeps the MVP
  deterministic. The frontend splits the exact coin with `coinWithBalance`.
- `register_report` and `purchase_report` both take the shared `Clock` (`0x6`)
  for timestamps — pass `tx.object("0x6")` as the clock argument.

## Documentation

| Doc | Contents |
| --- | --- |
| [docs/INTEGRATION.md](docs/INTEGRATION.md) | Contract API as the app calls it: object ids, function signatures, events, error codes, TypeScript examples, backend HTTP API, env vars |
| [docs/SECURITY.md](docs/SECURITY.md) | Trust model, findings with severities, what the Move package actually enforces, and the limits of what an on-chain record proves |

## Test coverage

`sui move test` — **17/17 passing**.

| Area | Covered |
| --- | --- |
| Subscription | exact payment issues a pass with correct owner + expiry; underpayment aborts; **overpayment aborts** (exact-match policy); payment forwarded to treasury |
| Expiry | active before expiry, inactive at and after it (`now < expires_at`, exclusive) |
| Renewal | while active, extends from the **existing expiry** (no lost time); after expiry, restarts from now; a non-owner holding the object still cannot renew (`ENotOwner`) |
| Provenance | title / content hash / Walrus id / creator / timestamp all recorded; duplicate content hash aborts (`EReportAlreadyExists`); two different hashes both register |
| Purchase | buyer receives an owned `ResearchAccess` pointing at the right report, with correct purchase time and expiry; wrong price aborts; payment forwarded to treasury |
| Access | active before expiry, inactive at and after |
| Admin | AdminCap holder can move the treasury, and payments follow it |

Not runtime-testable by design: "a non-admin cannot register a report or change
config". `register_report` and `update_treasury` take `&AdminCap`, so a caller
without that object cannot construct the call at all — authorisation is enforced
by the type system, not a checked condition.

## Why Sui (the judge question)

| Feature | Why it needs a chain |
| --- | --- |
| Payment + access in one step | `purchase_report` settles payment **and** mints the access object atomically in one PTB — one wallet approval, no reconciliation between a payment processor and a database. |
| Access is an owned object | `ResearchAccess` lives in the buyer's wallet. Access is portable and independently checkable; it is not a boolean row in our database that we could flip. |
| Provenance | The report's SHA-256 is anchored on-chain with its creator and timestamp. Anyone can verify a report is the exact registered version **without trusting our server** — the check is browser-side against the chain. |
| No custody | Payments forward to the treasury inside the same call, so the contract never holds a balance. There is no pot to drain and no withdraw function to get wrong. |

What this is **not**: the on-chain record is a provenance and integrity record —
proof that this exact version existed and was registered by that wallet. It is
not a legal copyright claim.

## Priorities (from the track rubric: *complete > complexity*)

1. **Tier 1 (must work):** connect wallet → ask AI → report → `purchase_report` → `ResearchAccess` → premium unlock.
2. **Tier 2:** Walrus blob + on-chain content hash.
3. **Tier 3:** sponsored transactions (platform pays gas).
4. **Tier 4:** zkLogin ("Continue with Google").

Do not build a token, DAO, NFT marketplace, or DeFi.
