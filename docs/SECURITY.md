# Security review

Scope: the `news_platform` Move package, the backend service, and the frontend,
as of the current `main`. Written to state assumptions plainly, including the
ones that are weak.

## Summary

The Move package is the strongest part: it holds no funds, uses capability-based
authorisation, and its payment and expiry logic is covered by 17 passing tests.
The **backend is where the real weaknesses are** — one of them, the unlock
endpoint, is a genuine authorisation bypass and is listed as Finding 1.

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

### 1. `/api/reports/:hash/unlock` does not authenticate the caller — **High**

`POST /api/reports/:contentHash/unlock` takes `{ address }` in the body and
checks whether **that address** owns a `ResearchAccess`. It never proves the
caller controls that address.

Anyone who knows a buyer's wallet address — public information on any
explorer — can send it and receive the premium body without paying.

The on-chain access check is correct; the flaw is that we ask "does *this
address* have access" instead of "does *this caller* have access".

**Fix (not yet applied):** the nonce/signature endpoints already exist in
`backend/src/auth/`. Require a session token from `POST /api/auth/verify` and
take the address from the verified token, never from the request body.

```
POST /api/auth/nonce   { address }              -> { nonce, message }
   wallet signs message
POST /api/auth/verify  { address, nonce, sig }  -> { token }
POST /api/reports/:hash/unlock  Authorization: Bearer <token>
```

Nothing else needs to change — `verifySessionToken()` already returns the
verified address.

### 2. No rate limiting on `/api/research` — **Medium**

Each call runs four Claude calls plus web search. There is no auth, no quota and
no cost ceiling, so an unauthenticated caller can drain the API budget.

Accepted for a local hackathon demo. Do not expose this endpoint publicly
without a per-address quota behind the auth from Finding 1.

### 3. Admin key sits in plaintext `.env` — **Medium (accepted)**

`ADMIN_SECRET_KEY` grants `register_report` and `update_treasury`. It is in
`backend/.env`, gitignored, testnet-only, and never sent to the frontend.

Acceptable for a testnet hackathon. Production needs a KMS or signer service.
Compromise lets an attacker register junk reports and redirect the treasury; it
does **not** let them touch user funds or existing access objects.

### 4. In-memory state is lost on restart — **Low**

Report bodies (`reportsByHash`) and auth nonces are plain `Map`s. A restart
makes previously purchased reports unservable even though the on-chain
`ResearchAccess` is still valid — the user keeps the asset but we lose the
content. Walrus is the intended fix: serve from the blob id recorded on-chain.

### 5. Walrus blobs are public — **Low, by design**

Anything uploaded is publicly retrievable by blob id. Premium bodies stored
there are therefore not confidential; the on-chain access object gates *our*
delivery, not the blob itself. Never upload keys or personal data.

### 6. UpgradeCap is a standing risk — **Low (inherent)**

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
| 1 | Unlock endpoint trusts a client-supplied address | High | **open** — fix before any public deploy |
| 2 | No rate limit on the AI endpoint | Medium | accepted for local demo |
| 3 | Admin key in plaintext `.env` | Medium | accepted for testnet |
| 4 | In-memory report/nonce state | Low | accepted; Walrus is the path out |
| 5 | Walrus blobs public | Low | by design, documented |
| 6 | UpgradeCap retained | Low | deliberate, disclosed |

Finding 1 is the only one that should block a public deployment. Everything else
is a conscious hackathon tradeoff rather than an oversight.
