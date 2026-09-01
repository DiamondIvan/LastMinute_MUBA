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
├── frontend/             React app (scaffold with Vite — see frontend/README.md)
└── backend/              AI + news + Walrus + admin registration
```

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

### Re-deploying (new package)

```bash
sui client switch --env testnet
sui client gas                            # need ~0.03 SUI; sui client faucet / faucet.sui.io if empty
cd blockchain
sui client publish --gas-budget 100000000
```

Then update the PackageID + PlatformConfig id in `frontend/src/contracts/constants.ts`
and `backend/.env` (+ AdminCap id in `backend/.env`).

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

## Priorities (from the track rubric: *complete > complexity*)

1. **Tier 1 (must work):** connect wallet → ask AI → report → `purchase_report` → `ResearchAccess` → premium unlock.
2. **Tier 2:** Walrus blob + on-chain content hash.
3. **Tier 3:** sponsored transactions (platform pays gas).
4. **Tier 4:** zkLogin ("Continue with Google").

Do not build a token, DAO, NFT marketplace, or DeFi.
