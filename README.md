# Sui Stablecoin AI Risk Layer

An AI-augmented risk-management pipeline for stablecoins circulating on the
**Sui** blockchain. Currently tracked at launch: **USDC, USDT, USDsui,
suiUSDe, AUSD, FDUSD, USDY** (auto-discovered live, not hardcoded — the list
updates itself as new stablecoins launch on Sui).

## How it works

```
data_sources.py   -->  metrics.py       -->  scoring.py        -->  ai_layer.py       -->  report.py
(live market data)     (per-factor       (composite 0-100      (Claude reasons        (markdown + JSON
                        risk sub-scores)  score + risk band)     on top of the          risk report)
                                                                  numbers, doesn't
                                                                  invent them)
```

**Deterministic first, AI second.** All actual risk *numbers* are computed
by rule-based logic in `metrics.py`/`scoring.py`/`config.py` — reproducible,
auditable, no LLM hallucination risk in the numbers themselves. Claude
(`ai_layer.py`) is layered on top purely to turn those numbers into a
plain-English narrative, surface follow-up flags, and comment on your
proposed portfolio. If Claude/the API key isn't available, the pipeline
still runs and gives you the full quantitative report.

## Risk factors scored per stablecoin

| Factor | What it captures |
|---|---|
| Peg deviation | How far off $1.00 the coin is currently trading |
| Mechanism | fiat-backed vs. tokenized-treasury vs. crypto-collateralized vs. synthetic-delta-neutral vs. algorithmic |
| Issuer/regulatory | Regulated, identifiable issuer vs. unknown/offshore |
| Attestation cadence | Real-time / monthly / quarterly / none |
| Liquidity | Circulating supply on Sui, ranked relative to peers (thin liquidity = harder to exit) |

These combine into a **0–100 composite score** → **LOW / MEDIUM / HIGH /
CRITICAL** band → a **suggested max single-asset allocation cap**, all
configurable in `config.py`.

There's also a **portfolio-level check**: feed in your proposed allocation
weights and get back an HHI concentration score plus any violations of the
per-coin allocation caps.

## News agent (`news_agent.py`)

Maps to the **News sources → AI agents → Intelligence report** step in your
architecture diagram. It uses Claude's server-side `web_search` tool to find
and synthesize current crypto news relevant to your tracked Sui stablecoins
(peg stability, issuer solvency, regulatory action, exploits) — no scraper
library to maintain, since Claude handles search + read + summarize in one
call.

```bash
python main.py --with-news
```

What it produces, and how it hands off to your existing Walrus/Sui stack:

1. `fetch_news_intelligence()` → structured JSON: `{stories: [...],
   overall_risk_signal, ...}`. Every story summary is paraphrased by
   Claude, never copy-pasted from the source (keeps you clear of
   reproducing article text).
2. `save_news_report()` → writes `reports/news_intelligence_report.json`
   and returns its **SHA-256 hash** — this is exactly the hash your Move
   package should write on-chain per the diagram (`Intelligence report →
   SHA-256 hash → Sui`). Upload the same JSON file to Walrus as the full
   report body; the hash you stored on-chain lets anyone re-hash the
   Walrus blob later and verify it hasn't been altered.
3. `summarize_for_risk_layer()` → a slimmed version fed into
   `ai_layer.generate_ai_risk_assessment()` as live context, so the AI
   narrative reflects breaking news (e.g. a live depeg or regulatory
   action) instead of only static issuer metadata.

Wiring this into your `blockchain/` Move package (not included in this
zip — you already have `sources/news_platform.move`): after
`save_news_report()` returns `{path, sha256, size_bytes}`, upload `path` to
Walrus to get a `blob_id`, then call your Move entry function with
`(report_title, sha256, blob_id)` to mint/update the on-chain record gated
by your `ResearchAccess`/`PremiumPass` objects.

## Setup

```bash
pip install -r requirements.txt
export OPENAI_API_KEY=sk-...   # only needed for the AI narrative + news agent layers
```

## Usage

```bash
# Quant-only report (no AI narrative, no API key needed)
python main.py --no-ai

# Full pipeline with AI narrative
python main.py

# Include a proposed portfolio for allocation/concentration checks
python main.py --allocations allocations_example.json

# Custom output directory
python main.py --out ./reports
```

Outputs `risk_report.md` (human-readable) and `risk_report.json`
(machine-readable, for feeding dashboards/alerting systems) to the `--out`
directory.

## What to configure for your actual risk mandate

Everything qualitative lives in **`config.py`** — nothing is buried in
code logic:

- `STABLECOIN_METADATA` — issuer, backing mechanism, regulatory status,
  attestation cadence per coin. **Review and update this periodically** —
  issuer/backing details change over time and this file is a starting
  point, not a live feed.
- `MECHANISM_RISK`, `ATTESTATION_RISK`, `REGULATED_RISK` — the risk
  weight assigned to each qualitative category.
- `SCORE_WEIGHTS` — how much each factor (peg/mechanism/issuer/attestation/
  liquidity) contributes to the composite score. Must sum to 1.0.
- `RISK_BANDS` — score cutoffs for LOW/MEDIUM/HIGH/CRITICAL.
- `MAX_ALLOCATION_BY_BAND` — your policy's max allocation per risk band.
- `PEG_ALERT_THRESHOLD` — deviation (in bps) that triggers an immediate
  alert regardless of composite score.

## Data sources

- **Live**: [DefiLlama stablecoins API](https://stablecoins.llama.fi/stablecoins?includePrices=true)
  (no API key required) — auto-discovers every stablecoin with circulating
  supply on Sui and its current price.
- **Fallback**: `sample_data.py` — used automatically if the live call
  fails (offline dev/testing), clearly tagged `"source": "sample"` in
  every output so you never mistake it for live data.
- **Optional**: direct Sui JSON-RPC (`data_sources.sui_rpc_total_supply`)
  for teams that want an on-chain-verified supply number rather than
  trusting an indexer — off by default, flip `USE_SUI_RPC = True`.

## Extending this

- **Alerting**: cron/schedule `main.py`, watch `risk_report.json` for
  `"peg_alert": true` or band changes, push to Slack/PagerDuty.
- **Historical tracking**: `sui_rpc_total_supply`/DefiLlama both support
  time-series; store daily snapshots to build peg-volatility history
  instead of just point-in-time deviation.
- **Dashboard**: `risk_report.json` is designed to be dashboard-ready —
  see the companion HTML dashboard for a visual front end.
- **More chains**: `data_sources.py`'s DefiLlama call already returns
  every chain; change `"Sui"` to any other chain key to reuse this whole
  pipeline elsewhere.

## Disclaimer

This is a decision-support tool, not financial advice, and not a
substitute for your own risk/compliance review. Verify issuer, audit, and
regulatory details independently before setting real allocation policy.
