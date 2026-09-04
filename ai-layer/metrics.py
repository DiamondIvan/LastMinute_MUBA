from __future__ import annotations
from typing import Any

import config


def get_metadata(symbol: str) -> dict[str, Any]:
    meta = config.STABLECOIN_METADATA.get(symbol.upper())
    if meta is None:
        return dict(config.DEFAULT_METADATA)
    merged = dict(config.DEFAULT_METADATA)
    merged.update(meta)
    return merged


def peg_deviation_score(price: float | None, yield_accruing: bool) -> tuple[float, float | None]:
    """
    Returns (risk_score_0_100, raw_deviation_fraction).
    Yield-accruing tokens (e.g. USDY) are expected to trade above $1 by
    design, so we don't penalize upward drift for them -- only flag if they
    trade meaningfully BELOW $1, which would be abnormal.
    """
    if price is None:
        return 60.0, None  # unknown price -> moderately high uncertainty risk

    deviation = price - 1.0

    if yield_accruing:
        if deviation >= 0:
            return 5.0, deviation
        # trading below $1 is abnormal for a yield-accruing treasury token
        abs_dev = abs(deviation)
    else:
        abs_dev = abs(deviation)

    # Piecewise scaling: small deviations are normal noise, large ones
    # escalate sharply (depeg events are rarely gradual).
    if abs_dev <= 0.001:       # <=10bps
        score = 5.0
    elif abs_dev <= 0.003:     # <=30bps
        score = 15.0
    elif abs_dev <= 0.01:      # <=1%
        score = 40.0
    elif abs_dev <= 0.03:      # <=3%
        score = 70.0
    else:
        score = 95.0

    return score, deviation


def mechanism_score(mechanism: str) -> float:
    return float(config.MECHANISM_RISK.get(mechanism, config.MECHANISM_RISK["unknown"]))


def issuer_regulatory_score(regulated: bool) -> float:
    return float(config.REGULATED_RISK.get(regulated, config.REGULATED_RISK[False]))


def attestation_score(attestation: str) -> float:
    return float(config.ATTESTATION_RISK.get(attestation, config.ATTESTATION_RISK["none"]))


def liquidity_score(circulating_usd: float, all_circulating: list[float]) -> float:
    """
    Smaller supply on Sui relative to peers = thinner liquidity = harder to
    exit a position without slippage = higher risk. We rank against the
    other discovered Sui stablecoins rather than using an absolute dollar
    cutoff, since "enough liquidity" is relative to the ecosystem's size.
    """
    if not all_circulating or circulating_usd <= 0:
        return 90.0

    sorted_vals = sorted(all_circulating)
    rank = sorted_vals.index(circulating_usd) if circulating_usd in sorted_vals else 0
    percentile = rank / max(len(sorted_vals) - 1, 1)  # 0 = smallest, 1 = largest

    # Invert: smallest percentile -> highest risk score
    return round(100 * (1 - percentile), 1)


def compute_all_metrics(stablecoins: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Given the raw discovered stablecoin records (from data_sources), attach
    metadata + all sub-scores to each one. Returns a new list of enriched
    records ready for scoring.py.
    """
    all_supplies = [c["circulating_usd"] for c in stablecoins]
    enriched = []

    for coin in stablecoins:
        symbol = coin["symbol"]
        meta = get_metadata(symbol)

        peg_score, deviation = peg_deviation_score(
            coin.get("price"), meta.get("yield_accruing", False)
        )

        record = dict(coin)
        record["metadata"] = meta
        record["peg_deviation_score"] = peg_score
        record["peg_deviation_fraction"] = deviation
        record["mechanism_score"] = mechanism_score(meta["mechanism"])
        record["issuer_regulatory_score"] = issuer_regulatory_score(meta["regulated"])
        record["attestation_score"] = attestation_score(meta["attestation"])
        record["liquidity_score"] = liquidity_score(coin["circulating_usd"], all_supplies)
        record["peg_alert"] = (
            deviation is not None
            and not meta.get("yield_accruing", False)
            and abs(deviation) >= config.PEG_ALERT_THRESHOLD
        )

        enriched.append(record)

    return enriched
