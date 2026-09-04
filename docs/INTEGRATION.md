# Integration specification

The contract API as the frontend and backend actually call it. Everything here
is verified against the deployed package and the committed source.

## Deployment (Sui testnet)

| | |
| --- | --- |
| Network | `testnet` |
| gRPC endpoint | `https://fullnode.testnet.sui.io:443` |
| PackageID | `0x0047c06a35bf05d6148797eeeeada97d134f64410ff65ed88e8792770df87b9b` |
| Module | `news_platform` |
| PlatformConfig (shared) | `0x6df54fa32eff53523793d1ee1fe602076309dbede5803b9e300ffffb11b90c77` |
| AdminCap (deployer wallet) | `0xa8d9900d8e2f9e2264d229297c97c2e8ccce5383e9da9997527d960e591edb94` |
| UpgradeCap (deployer wallet) | `0xfd6fb64f453e3fec51501beed0eeb72d3a96171627b3f6c0fbc2d695c4105ab5` |
| Demo ResearchReport (verifiable) | `0xc63fd6d76b573c69dfc54162b6ded41f5601c0354d2276330ae09297505d4a69` |
| Clock (system) | `0x6` |
| Publish digest | `VqQjyNqo1AginGHMQ3HtiRwPvdVNDh2M3MbXB4Y7TjY` |

Prices are compiled into the package: subscription **10_000_000 MIST (0.01 SUI)**,
report **5_000_000 MIST (0.005 SUI)**, both durations **7 days**.

## SDK

The Sui 2.0 stack. `@mysten/dapp-kit` is deprecated (JSON-RPC only) — do not use it.

| Concern | Package |
| --- | --- |
| React bindings | `@mysten/dapp-kit-react` + `@mysten/dapp-kit-core` |
| Client | `SuiGrpcClient` from `@mysten/sui/grpc` |
| Transactions | `Transaction`, `coinWithBalance` from `@mysten/sui/transactions` |
| Server signing | `Ed25519Keypair` from `@mysten/sui/keypairs/ed25519` |
| Signature verify | `verifyPersonalMessageSignature` from `@mysten/sui/verify` |

## Objects

| Type | Ownership | Fields |
| --- | --- | --- |
| `PlatformConfig` | **shared** | `treasury: address`, `subscription_price: u64`, `report_price: u64`, `subscription_duration_ms: u64`, `report_access_duration_ms: u64`, `report_registry: Table<vector<u8>, ID>` |
| `AdminCap` | owned (admin wallet) | `id` only — a bare capability |
| `PremiumPass` | owned (subscriber) | `owner: address`, `expires_at: u64` |
| `ResearchReport` | **shared** | `title: String`, `content_hash: String`, `walrus_blob_id: String`, `creator: address`, `created_at: u64` |
| `ResearchAccess` | owned (buyer) | `report_id: ID`, `owner: address`, `purchased_at: u64`, `expires_at: u64` |

Full type strings are `<PACKAGE_ID>::news_platform::<Name>`.

## Functions

### `subscribe(config, payment, clock, ctx)`

Buys a fresh 7-day `PremiumPass`.

| | |
| --- | --- |
| Arguments | `&PlatformConfig` (shared), `Coin<SUI>`, `&Clock`, ctx |
| Signature required | yes — the buyer |
| Payment | **exactly** `subscription_price`; any other value aborts `EIncorrectPayment (1)` |
| Result | `PremiumPass` transferred to sender; coin transferred to `treasury` |
| Event | `SubscriptionPurchased { user, expires_at, amount }` |

### `renew(config, pass, payment, clock, ctx)`

Extends an existing pass.

| | |
| --- | --- |
| Arguments | `&PlatformConfig`, `&mut PremiumPass` (owned by sender), `Coin<SUI>`, `&Clock`, ctx |
| Signature required | yes — must be `pass.owner`, else aborts `ENotOwner (2)` |
| Payment | exactly `subscription_price` |
| Expiry rule | `base = max(pass.expires_at, now)`, then `base + duration` — remaining time is never lost |
| Event | `SubscriptionPurchased` |

### `register_report(adminCap, config, title, content_hash, walrus_blob_id, clock, ctx)`

Anchors a report's provenance. **Admin only.**

| | |
| --- | --- |
| Arguments | `&AdminCap`, `&mut PlatformConfig`, three `vector<u8>`, `&Clock`, ctx |
| Signature required | yes — the AdminCap holder (the backend wallet) |
| Duplicates | a `content_hash` already in the registry aborts `EReportAlreadyExists (3)` |
| Result | `ResearchReport` **shared**; registry entry added |
| Event | `ReportRegistered { report_id, creator }` |

Pass the three byte-vector args as `tx.pure.string(...)` from TypeScript.

### `purchase_report(config, report, payment, clock, ctx)`

Buys 7-day access to one report. **This is the core demo call.**

| | |
| --- | --- |
| Arguments | `&PlatformConfig`, `&ResearchReport` (shared), `Coin<SUI>`, `&Clock`, ctx |
| Signature required | yes — the buyer |
| Payment | exactly `report_price` |
| Result | `ResearchAccess` transferred to sender; coin transferred to `treasury` |
| Event | `ReportPurchased { report_id, buyer, expires_at, amount }` |

### `update_treasury(adminCap, config, new_treasury)`

Admin only. Changes the payout address. Emits no event.

### Read helpers (no transaction, no gas)

`subscription_is_active(pass, clock) -> bool` and
`access_is_active(access, clock) -> bool`. Both are `now < expires_at` — expiry
is **exclusive**.

## Events

| Event | Fields |
| --- | --- |
| `SubscriptionPurchased` | `user: address`, `expires_at: u64`, `amount: u64` |
| `ReportRegistered` | `report_id: ID`, `creator: address` |
| `ReportPurchased` | `report_id: ID`, `buyer: address`, `expires_at: u64`, `amount: u64` |

## Error codes

| Code | Constant | Meaning |
| --- | --- | --- |
| 1 | `EIncorrectPayment` | coin value did not equal the exact price |
| 2 | `ENotOwner` | caller is not the owner of the pass being renewed |
| 3 | `EReportAlreadyExists` | that content hash is already registered |

## TypeScript

### Client setup — `frontend/src/dapp-kit.ts`

```ts
import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';

const GRPC_URLS = { testnet: 'https://fullnode.testnet.sui.io:443' } as const;

export const dAppKit = createDAppKit({
  networks: ['testnet'],
  createClient(network) {
    return new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] });
  },
});

declare module '@mysten/dapp-kit-react' {
  interface Register { dAppKit: typeof dAppKit; }
}
```

### Purchase — one PTB, one approval

```ts
import { Transaction, coinWithBalance } from '@mysten/sui/transactions';

const tx = new Transaction();
tx.moveCall({
  target: `${PACKAGE_ID}::news_platform::purchase_report`,
  arguments: [
    tx.object(CONFIG_ID),
    tx.object(reportObjectId),
    coinWithBalance({ balance: 5_000_000 }), // exact price — contract asserts ==
    tx.object('0x6'),
  ],
});

const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
if (result.$kind === 'FailedTransaction') throw new Error('purchase failed');
console.log(result.Transaction.digest);
```

Coin selection, the move call, object creation and transfer all settle in this
single block. The user approves once.

### Does this wallet have access?

```ts
const res = await client.listOwnedObjects({
  owner: address,
  type: `${PACKAGE_ID}::news_platform::ResearchAccess`,
  limit: 50,
  include: { json: true },
});
const ok = res.objects.some((o) => (o.json as any)?.report_id === reportObjectId);
```

> **`include: { json: true }`, not `{ content: true }`.** `content` returns raw
> BCS bytes, not parsed fields — reading `.content.fields` silently yields
> nothing. This bit us once; see `docs/SECURITY.md`.

### Verify a report — client-side, no server trust

```ts
const res = await client.getObject({ objectId: reportId, include: { json: true } });
const chainHash = (res.object.json as any).content_hash;

const bytes = new TextEncoder().encode(reportText);
const digest = await crypto.subtle.digest('SHA-256', bytes);
const localHash = [...new Uint8Array(digest)]
  .map((b) => b.toString(16).padStart(2, '0')).join('');

const verified = localHash === chainHash;
```

The browser hashes and compares against the chain. Our backend is not involved
and cannot fake a pass.

### Backend — admin registration

```ts
const tx = new Transaction();
tx.moveCall({
  target: `${packageId}::news_platform::register_report`,
  arguments: [
    tx.object(adminCapId),
    tx.object(configId),
    tx.pure.string(title),
    tx.pure.string(contentHash),
    tx.pure.string(walrusBlobId),
    tx.object('0x6'),
  ],
});

const result = await suiClient.signAndExecuteTransaction({
  transaction: tx,
  signer: adminKeypair(),          // Ed25519Keypair.fromSecretKey('suiprivkey1...')
  include: { effects: true, objectTypes: true },
});
```

The new `ResearchReport` id is in `result.Transaction.objectTypes` (match on the
`::news_platform::ResearchReport` type), with `effects.changedObjects` where
`idOperation === 'Created'` as a fallback.

## Backend HTTP API

Base `http://localhost:8787`; Vite proxies `/api` to it in dev.

| Method + path | Body | Returns |
| --- | --- | --- |
| `GET /health` | — | `{ ok, network, aiConfigured, chainConfigured, admin }` |
| `POST /api/research` | `{ question }` | `{ title, summary, analysis, sources, contentHash, generatedAt, reportObjectId }` — the **free** tier |
| `POST /api/reports/:contentHash/unlock` | `{}` + `Authorization: Bearer <token>` | `{ full }`; **401** without a valid token, **403** if that wallet owns no `ResearchAccess` |
| `POST /api/reports/register` | `{ question }` | `{ digest, reportObjectId, contentHash, blobId }` — admin only |
| `POST /api/auth/nonce` | `{ address }` | `{ nonce, message }` |
| `POST /api/auth/verify` | `{ address, nonce, signature }` | `{ token }` |

`/api/research` returns 503 without `OPENAI_API_KEY`; `/api/reports/register`
also needs the chain env.

### Unlocking requires a wallet signature

The server derives the caller address from the session token, never from the
request body. Get a token first:

```ts
const { nonce, message } = await getNonce(address);
const signed = await dAppKit.signPersonalMessage({
  message: new TextEncoder().encode(message),
});
const { token } = await verifyAuth(address, nonce, signed.signature);

const { full } = await unlockReport(contentHash, token); // sends Bearer header
```

The signature authorises nothing on-chain — it only proves control of the
address. Nonces are single-use with a 5-minute TTL; tokens last 24h and are
cached in `sessionStorage`. `frontend/src/lib/session.ts` wraps this.

## Environment

`backend/.env` (see `.env.example`). Never commit it.

| Var | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | the AI agents |
| `PACKAGE_ID`, `CONFIG_ID` | contract addresses |
| `ADMIN_CAP_ID`, `ADMIN_SECRET_KEY` | admin registration only — **server-side only** |
| `DEMO_REPORT_OBJECT_ID` | the report the demo purchase flow targets |
| `SUI_NETWORK`, `SUI_GRPC_URL` | chain endpoint |
| `WALRUS_PUBLISHER_URL`, `WALRUS_AGGREGATOR_URL`, `WALRUS_EPOCHS` | blob storage |

Frontend constants live in `frontend/src/contracts/constants.ts`. The frontend
must never receive `ADMIN_SECRET_KEY` or `ADMIN_CAP_ID`.
