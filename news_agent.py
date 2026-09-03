from __future__ import annotations
import hashlib
import json
import os
from datetime import datetime, timezone
from typing import Any

try:
    import openai
except ImportError:  # pragma: no cover
    openai = None

MODEL = "gpt-5.6"  # check platform.openai.com/docs/models for the current flagship model string

DEFAULT_SYMBOLS = ["USDC", "USDT", "USDSUI", "SUIUSDE", "AUSD", "FDUSD", "USDY"]

SYSTEM_PROMPT = """You are a crypto news intelligence agent inside an
automated risk-monitoring pipeline. You have a web_search tool -- use it to
find CURRENT news (prioritize the last 24-72 hours, but include anything
materially relevant from the last 2 weeks) about stablecoins circulating on
the Sui blockchain.

For each relevant story you find, extract:
  - "symbols": which tracked stablecoin symbol(s) it concerns
  - "event_type": one of "depeg", "regulatory", "hack_or_exploit",
    "issuance_change", "partnership_or_integration", "market_move", "other"
  - "severity": one of "info", "watch", "warning", "critical"
  - "summary": a 1-2 sentence summary IN YOUR OWN WORDS. Never copy
    sentences or phrases verbatim from the source -- paraphrase fully.
  - "source_url": the URL you found it at
  - "source_name": publication name

Only include stories that are genuinely relevant to stablecoin risk
(peg stability, issuer solvency, regulatory status, smart contract
security, liquidity). Skip generic price-action noise unless it's extreme.

If you find nothing relevant, return an empty "stories" array -- do not
invent stories to fill space.

Respond ONLY with valid JSON, no other text, matching this schema:
{
  "stories": [
    {"symbols": ["..."], "event_type": "...", "severity": "...",
     "summary": "...", "source_url": "...", "source_name": "..."}
  ],
  "overall_risk_signal": "none" | "elevated" | "high",
  "signal_rationale": "1-2 sentence explanation of the overall_risk_signal"
}
"""


def fetch_news_intelligence(symbols: list[str] | None = None) -> dict[str, Any]:
    """
    Runs one OpenAI Responses API call with web_search enabled, scoped to
    the given stablecoin symbols (defaults to the coins tracked elsewhere
    in this project). Returns the parsed intelligence report as a dict.
    """
    if openai is None:
        raise RuntimeError("The 'openai' package isn't installed. Run: pip install openai")
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY environment variable is not set.")

    symbols = symbols or DEFAULT_SYMBOLS
    client = openai.OpenAI(api_key=api_key)

    user_prompt = (
        "Search for and analyze the latest crypto news relevant to these "
        f"stablecoins on Sui: {', '.join(symbols)}. Focus on anything that "
        "could affect peg stability, issuer solvency, regulatory standing, "
        "or smart contract security."
    )

    response = client.responses.create(
        model=MODEL,
        instructions=SYSTEM_PROMPT,
        tools=[{"type": "web_search"}],
        input=user_prompt,
    )

    # response.output_text already concatenates the model's final text
    # output, skipping over the interleaved web_search tool-call events.
    text = response.output_text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]

    try:
        report = json.loads(text)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"News agent response wasn't valid JSON: {exc}\nRaw:\n{text}") from exc

    report["generated_at"] = datetime.now(timezone.utc).isoformat()
    report["symbols_scanned"] = symbols
    return report


def hash_report(report: dict[str, Any]) -> tuple[str, bytes]:
    """
    Deterministically serializes the report and returns (sha256_hex, bytes).
    This is the hash your Move package writes on-chain (see architecture
    diagram: Intelligence report -> SHA-256 hash -> Sui). The `bytes`
    returned here are exactly what you upload to Walrus as the full report
    body, so the hash you store on-chain matches the blob you can later
    fetch and re-hash to verify integrity.
    """
    payload = json.dumps(report, sort_keys=True, indent=2).encode("utf-8")
    digest = hashlib.sha256(payload).hexdigest()
    return digest, payload


def save_news_report(report: dict[str, Any], out_dir: str = "./reports") -> dict[str, Any]:
    """
    Writes the report to disk and returns everything your backend needs to
    hand off to Walrus + your Move package:
      - path: local file to upload to Walrus
      - sha256: hash to write on-chain
      - size_bytes: for reference/logging
    """
    os.makedirs(out_dir, exist_ok=True)
    digest, payload = hash_report(report)
    path = os.path.join(out_dir, "news_intelligence_report.json")
    with open(path, "wb") as f:
        f.write(payload)
    return {"path": path, "sha256": digest, "size_bytes": len(payload)}


def summarize_for_risk_layer(report: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Slims the news report down to just what ai_layer.py needs as extra
    context (symbol, severity, summary) -- keeps the risk-scoring prompt
    focused instead of dumping the entire news report into it.
    """
    return [
        {"symbols": s["symbols"], "event_type": s["event_type"],
         "severity": s["severity"], "summary": s["summary"]}
        for s in report.get("stories", [])
    ]
