from __future__ import annotations
from typing import Any

import config


def composite_score(record: dict[str, Any]) -> float:
    w = config.SCORE_WEIGHTS
    score = (
        record["peg_deviation_score"] * w["peg_deviation"]
        + record["mechanism_score"] * w["mechanism"]
        + record["issuer_regulatory_score"] * w["issuer_regulatory"]
        + record["attestation_score"] * w["attestation"]
        + record["liquidity_score"] * w["liquidity"]
    )
    return round(score, 1)


def risk_band(score: float) -> str:
    for low, high, label in config.RISK_BANDS:
        if low <= score < high:
            return label
    return "CRITICAL"


def score_all(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    scored = []
    for r in records:
        c = composite_score(r)
        band = risk_band(c)
        out = dict(r)
        out["composite_score"] = c
        out["risk_band"] = band
        out["suggested_max_allocation"] = config.MAX_ALLOCATION_BY_BAND[band]
        scored.append(out)
    return sorted(scored, key=lambda x: x["composite_score"])


def portfolio_hhi(allocations: dict[str, float]) -> float:
    """
    Herfindahl-Hirschman Index over portfolio weights (each 0-1, should sum
    to ~1.0). Returns a 0-10000 index: <1500 = not concentrated,
    1500-2500 = moderately concentrated, >2500 = highly concentrated.
    Useful as a portfolio-level (not per-coin) risk check.
    """
    total = sum(allocations.values())
    if total <= 0:
        return 0.0
    shares = [(v / total) * 100 for v in allocations.values()]
    return round(sum(s * s for s in shares), 1)


def hhi_label(hhi: float) -> str:
    if hhi < 1500:
        return "well-diversified"
    if hhi < 2500:
        return "moderately concentrated"
    return "highly concentrated"


def check_allocation_against_policy(
    scored_records: list[dict[str, Any]], proposed_allocations: dict[str, float]
) -> list[dict[str, Any]]:
    """
    Compares a proposed portfolio (symbol -> weight, weights should sum to
    ~1.0) against each coin's suggested_max_allocation cap. Returns
    violations (proposed weight exceeds the policy cap for that coin).
    """
    caps = {r["symbol"]: r["suggested_max_allocation"] for r in scored_records}
    violations = []
    for symbol, weight in proposed_allocations.items():
        cap = caps.get(symbol)
        if cap is None:
            violations.append(
                {"symbol": symbol, "weight": weight, "cap": None,
                 "issue": "No risk score on file for this symbol -- treat as CRITICAL until reviewed."}
            )
        elif weight > cap:
            violations.append(
                {"symbol": symbol, "weight": weight, "cap": cap,
                 "issue": f"Proposed weight {weight:.1%} exceeds policy cap {cap:.1%}."}
            )
    return violations
