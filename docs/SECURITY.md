# Security review

Scope: the `news_platform` Move package, the backend service, and the frontend,
as of the current `main`. Written to state assumptions plainly, including the
ones that are weak.

## Summary

The Move package is the strongest part: it holds no funds, uses capability-based
authorisation, and its payment and expiry logic is covered by 17 passing tests.

Three genuine defects have been found and fixed: the unlock endpoint trusting a
client-supplied address (Finding 1), an ungated `mint_report` that allowed
forging provenance (Finding 2), and a Seal integration that silently broke the
paid unlock path (Finding 3). The remaining items are accepted hackathon
tradeoffs, each stated with its reason.

A separate table at the end lists features that **compile but do not function** —
kiosk royalties, the undeployed `news_kiosk` module, and zkLogin. None are
security issues; all three are things that must not be claimed to judges.

## Trust model

| Party | Trusted for | Not trusted for |
| --- | --- | --- |
| Sui network | payment settlement, object ownership, provenance record, timestamps | availability |
| Our backend | generating reports, holding the admin key, serving premium bodies | **nothing security-critical to the user** — report integrity is verifiable without it |
| Frontend | UX only | never holds the admin key; all its inputs are attacker-controlled |
| User wallet | approving their own transactions | — |

The central claim we make to a judge — *"this report is the exact version
registered on-chain"* — does **not** depend on trusting us. The browser hashes
the text and compares to the chain directly.

---

## Findings

### 1. Unlock endpoint authentication — **High — FIXED**

*Was:* `POST /api/reports/:contentHash/unlock` took `{ address }` from the
request body and checked whether **that address** owned a `ResearchAccess`,
without ever proving the caller controlled it. Anyone who knew a buyer's wallet
address — public on any explorer — could fetch the premium body without paying.

*Now:* the address comes from a verified session token
(`Authorization: Bearer <token>`) and is never read from the body. The token is
issued only after the wallet signs a server-generated nonce:

```
POST /api/auth/nonce   { address }              -> { nonce, message }
   wallet signs `message`
POST /api/auth/verify  { address, nonce, sig }  -> { token }
POST /api/reports/:hash/unlock  Authorization: Bearer <token>
```

`verifyWalletSignature` consumes the nonce (single use, 5-minute TTL),
reconstructs the message server-side rather than trusting client-supplied bytes,
verifies the signature with `verifyPersonalMessageSignature`, and confirms the
recovered public key maps to the claimed address.

Authentication also runs *before* the report lookup, so an anonymous caller
cannot probe which content hashes exist.

Verified against a running server:

| Request | Response |
| --- | --- |
| body-supplied address, no token (the original attack) | **401** |
| forged `Bearer` token | **401** |

Remaining caveat: the session token is an HMAC blob signed with
`AUTH_SESSION_SECRET`, valid 24h, with no revocation list. Adequate here; a real
deployment wants short-lived tokens plus refresh.

### 2. `mint_report` was an ungated public constructor — **High — FIXED**

Added on `frontend2.0`. `news_platform::mint_report` was `public fun` and took
`creator` and `created_at` as plain arguments, touched no capability, and never
wrote to `report_registry`.

Any wallet could therefore have minted a `ResearchReport` naming **someone else**
as creator, with a forged timestamp and a duplicate content hash — forging
exactly the provenance the product exists to prove. `VerifyPanel` would have
shown **✓ VERIFIED** against such a report, because it only compares the hash to
whatever the object says.

It also bypassed `EReportAlreadyExists`, so the one-record-per-content guarantee
no longer held.

*Fixed:* `mint_report` is now `public(package)`. External callers cannot reach
it, which leaves `news_kiosk::mint_report_into_kiosk` — gated on `MintCap` — as
the only way in. `sui move build` clean, 17/17 tests still pass.

Residual: inside that path an admin still supplies `creator` freely. That is
consistent with the trust model (the admin is trusted to register honestly), but
it is a weaker guarantee than `register_report`, which derives `creator` from
`ctx.sender()`.

### 3. Seal encryption is not operational, and the unlock path depended on it — **High — FIXED**

Added on `frontend2.0`. `/api/reports/:hash/unlock` was rewritten to read an
encrypted blob from Walrus and decrypt it through Seal. Verified by running it:

```
encryptReportFor(...) -> "No key servers found"
```

`sealServerConfigs()` returns an empty array unless `SEAL_KEY_SERVER_0/1` are
set, so encryption throws in `/api/research`, the blob is never written, the
index stores an empty `blobId`, and unlock answered **503 "blob not stored on
Walrus yet"**. The paid flow — buy, then read the report — was broken end to end.

Decryption would not have worked either: `decryptReport` passes
`txBytes = new Uint8Array(0)` (its own comment calls this a placeholder), creates
a `SessionKey` with no signer, and there is **no `seal_approve*` function in the
Move package** for the key servers to check.

*Fixed:* unlock now tries Walrus+Seal first and falls back to the stored
plaintext body, so the flow works whether or not Seal is configured. The
response carries `source: 'walrus+seal' | 'server'` so it is visible which path
served. Access is still gated by the on-chain `ResearchAccess` check either way
— Seal was adding encryption at rest, not the authorisation.

To make Seal real: configure key servers, add a `seal_approve*` entry to the
Move package that checks `ResearchAccess`/`PremiumPass`, and pass the approving
transaction bytes to `decrypt`.

### 4. No rate limiting on `/api/research` — **Medium**

Each call runs four model calls plus web search. There is no auth, no quota and
no cost ceiling, so an unauthenticated caller can drain the API budget.

Accepted for a local hackathon demo. Do not expose this endpoint publicly
without a per-address quota behind the auth from Finding 1.

### 5. Admin key sits in plaintext `.env` — **Medium (accepted)**

`ADMIN_SECRET_KEY` grants `register_report` and `update_treasury`. It is in
`backend/.env`, gitignored, testnet-only, and never sent to the frontend.

Acceptable for a testnet hackathon. Production needs a KMS or signer service.
Compromise lets an attacker register junk reports and redirect the treasury; it
does **not** let them touch user funds or existing access objects.

### 6. In-memory state is lost on restart — **Low**

Report bodies (`reportsByHash`) and auth nonces are plain `Map`s. A restart
makes previously purchased reports unservable even though the on-chain
`ResearchAccess` is still valid — the user keeps the asset but we lose the
content. Walrus is the intended fix: serve from the blob id recorded on-chain.

### 7. Walrus blobs are public — **Low, by design**

Anything uploaded is publicly retrievable by blob id. Premium bodies stored
there are therefore not confidential; the on-chain access object gates *our*
delivery, not the blob itself. Never upload keys or personal data.

### 8. UpgradeCap is a standing risk — **Low (inherent)**

The deployer wallet holds the `UpgradeCap`, so that key can replace the package
logic. Burning it would make the contract immutable and remove the risk, at the
cost of being unable to patch during the event. Keeping it is the right call for
a hackathon; it should be disclosed rather than hidden.

---

## Move package — what is actually enforced

### Authorisation

`register_report` and `update_treasury` take `&AdminCap`. A caller without that
object **cannot construct the call at all** — this is type-system enforcement,
not a runtime `if sender == owner` check that could be bypassed or mis-typed.
That is also why "non-admin cannot register" has no unit test: the failure is
impossible to express.

`renew` additionally checks `ctx.sender() == pass.owner`, because holding a
mutable reference to someone else's pass is conceivable inside a PTB. Tested
(`renew_by_non_owner_aborts`).

### Funds — no custody

Every payment is `transfer::public_transfer(payment, config.treasury)` inside
the same call that accepts it. The module never holds a `Balance` or `Coin`.

Consequences: there is no pot to drain, no withdraw function to get wrong, and
no path by which funds are trapped. Two tests assert the treasury actually
receives the coin in the same transaction
(`subscribe_forwards_payment_to_treasury`, `purchase_forwards_payment_to_treasury`).

This is a deliberate departure from the usual "accumulate then withdraw"
pattern, chosen because the withdrawal path is where that pattern's bugs live.

### Payment amounts

`assert!(amount == price)` — exact match. Underpayment and **overpayment** both
abort, so excess user funds are never silently kept. On abort the whole
transaction reverts and the user's coin is untouched. Both directions tested.

The frontend splits an exact coin with `coinWithBalance({ balance: price })`, so
the strictness is invisible to the user.

### Time

Expiry uses the shared `Clock` at `0x6` (consensus time), not
`epoch_timestamp_ms` (coarse, ~24h granularity). Active means `now < expires_at`
— exclusive, and tested at exactly the boundary.

Renewal computes `base = max(expires_at, now)` so an early renewal never
discards remaining time, and a stale expiry never produces a shorter-than-full
term. Both branches tested.

### Overflow

`base + duration` is `u64`. Move aborts on arithmetic overflow rather than
wrapping, so the worst case is a failed transaction, not a corrupted expiry. The
values involved (ms timestamps plus 7 days) are ~13 digits against a u64 ceiling
of ~20, so this is unreachable in practice.

### Duplicate provenance

`report_registry: Table<vector<u8>, ID>` keyed by content hash. Registering a
hash twice aborts `EReportAlreadyExists`, so one piece of content has exactly
one provenance record and creator. Tested, including that two *different* hashes
both succeed.

### Object model

- `PlatformConfig` and `ResearchReport` are shared; `PremiumPass` and
  `ResearchAccess` are owned by their user.
- `purchase_report` takes `&ResearchReport` (immutable), so concurrent purchases
  of the same report do not contend. Only `register_report` takes
  `&mut PlatformConfig` — and that is admin-only and low-frequency.
- `ResearchAccess` carries `report_id`, so a pass for report A cannot be
  presented as access to report B. Tested.

### Deliberately absent

No token, no NFT, no DAO, no staking, no marketplace, no on-chain article text,
no AI in Move. Each of those would add attack surface without adding product
value.

---

## Claims we make, and their limits

The on-chain record proves: **this exact byte sequence was registered by this
wallet at this time, and has not changed since.**

It does **not** prove authorship, originality, truthfulness, or copyright. The
product wording says *provenance*, *integrity* and *creator record* — never
"copyright" — and `VerifyPanel` states this on screen. Overclaiming here would
be the easiest thing for a judge to puncture.

A verified report is also not a claim that the AI's *analysis* is correct. It is
a claim that the analysis you are reading is the one that was registered.

---

## Fix priority

| # | Finding | Severity | Status |
| --- | --- | --- | --- |
| 1 | Unlock endpoint trusts a client-supplied address | High | **fixed** — wallet-signature session token |
| 2 | `mint_report` ungated public constructor | High | **fixed** — `public(package)` |
| 3 | Seal non-operational, unlock depended on it | High | **fixed** — falls back to the stored body |
| 4 | No rate limit on the AI endpoint | Medium | accepted for local demo |
| 5 | Admin key in plaintext `.env` | Medium | accepted for testnet |
| 6 | In-memory report/nonce state | Low | accepted; Walrus is the path out |
| 7 | Walrus blobs public | Low | by design, documented |
| 8 | UpgradeCap retained | Low | deliberate, disclosed |

## Features that compile but do not function

Not security findings, but they must not be claimed to judges:

| Feature | Reality |
| --- | --- |
| Kiosk royalty resale | `resolvePlatformKiosk()` returns `''` unconditionally, so `buildPurchaseReportViaKioskTx` is never called and purchase always uses the direct PTB. `set_royalty_policy` is an empty placeholder that assigns its arguments to `_`. No royalty is ever configured or paid. |
| `news_kiosk` module | Compiles, but is **not deployed** — the live package `0x0047c06a…` contains only `news_platform`. Any call to it, or to `mint_report`, fails until the package is republished (which mints a new PackageID and invalidates every recorded object id). |
| zkLogin / "Continue with Email" | `backend/src/auth/zkLogin.ts` exists; the login button still pops an `alert`. |

Findings 1-3 are fixed. Everything remaining is a conscious hackathon tradeoff
rather than an oversight — Finding 4 (no rate limit on the AI endpoint) is the
one to revisit before any public deployment.
