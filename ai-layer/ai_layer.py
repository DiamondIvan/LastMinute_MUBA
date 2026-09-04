from __future__ import annotations
import json
import os
from typing import Any

try:
    import openai
except ImportError:  
    openai = None

MODEL = "gpt-5.6"  

SYSTEM_PROMPT = """You are a crypto financial-risk analyst embedded in an
automated risk-monitoring pipeline for stablecoins circulating on the Sui
blockchain. You are given deterministic, already-computed quantitative risk
scores (0-100, higher = riskier) for each stablecoin, plus qualitative
metadata about issuer and backing mechanism.

Your job:
1. Write a short, plain-English risk narrative for each stablecoin (2-3
   sentences) that a non-technical risk committee member could understand.
2. Flag anything in the metadata/notes that deserves human follow-up
   (e.g. thin track record, prior depeg history, unregulated issuer).
3. Comment on the proposed portfolio allocation, if one is provided --
   is it consistent with the risk bands, and does the diversification
   (HHI) look reasonable?
4. If recent news items are provided, weigh them into each coin's
   narrative and follow_up_flags -- e.g. a "critical" severity depeg or
   regulatory story should be called out explicitly even if the
   quantitative score hasn't caught up yet.
5. Do NOT invent facts, prices, or events not present in the input data.
   If you are uncertain about something, say so explicitly rather than
   guessing.

Respond ONLY with valid JSON matching this schema, no other text:
{
  "per_coin": [
    {"symbol": "...", "narrative": "...", "follow_up_flags": ["..."]}
  ],
  "portfolio_commentary": "...",
  "top_priority_actions": ["...", "..."]
}
"""


def _build_user_prompt(scored_records: list[dict[str, Any]],
                        proposed_allocations: dict[str, float] | None,
                        hhi: float | None,
                        news_context: list[dict[str, Any]] | None = None) -> str:
    slim_records = [
        {
            "symbol": r["symbol"],
            "name": r.get("name"),
            "composite_score": r["composite_score"],
            "risk_band": r["risk_band"],
            "suggested_max_allocation": r["suggested_max_allocation"],
            "peg_deviation_fraction": r.get("peg_deviation_fraction"),
            "peg_alert": r.get("peg_alert"),
            "circulating_usd_on_sui": r.get("circulating_usd"),
            "mechanism": r["metadata"]["mechanism"],
            "issuer": r["metadata"]["issuer"],
            "regulated": r["metadata"]["regulated"],
            "attestation": r["metadata"]["attestation"],
            "notes": r["metadata"]["notes"],
            "data_source": r.get("source"),
        }
        for r in scored_records
    ]

    payload = {
        "computed_risk_data": slim_records,
        "proposed_allocations": proposed_allocations,
        "portfolio_hhi": hhi,
        "recent_news": news_context or [],
    }
    return (
        "Here is the computed risk data for stablecoins currently circulating "
        "on Sui. Analyze it per the system instructions.\n\n"
        + json.dumps(payload, indent=2)
    )


def generate_ai_risk_assessment(
    scored_records: list[dict[str, Any]],
    proposed_allocations: dict[str, float] | None = None,
    hhi: float | None = None,
    news_context: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    Calls OpenAI with the deterministic risk scores and returns the parsed
    JSON assessment. Raises RuntimeError with a clear message if the
    openai package or API key isn't available, so callers can catch it
    and fall back to the quantitative-only report (see report.py).
    """
    if openai is None:
        raise RuntimeError(
            "The 'openai' package isn't installed. Run: pip install openai"
        )
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY environment variable is not set. "
        )

    client = openai.OpenAI(api_key=api_key)
    user_prompt = _build_user_prompt(scored_records, proposed_allocations, hhi, news_context)

    response = client.chat.completions.create(
        model=MODEL,
        response_format={"type": "json_object"},  # forces valid JSON, no fence-stripping needed
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    )

    text = response.choices[0].message.content.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"Model's response wasn't valid JSON: {exc}\nRaw response:\n{text}"
        ) from exc
