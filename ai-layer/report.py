from __future__ import annotations
import json
from datetime import datetime, timezone
from typing import Any

import scoring


def build_json_report(
    scored_records: list[dict[str, Any]],
    ai_assessment: dict[str, Any] | None,
    proposed_allocations: dict[str, float] | None,
) -> dict[str, Any]:
    hhi = scoring.portfolio_hhi(proposed_allocations) if proposed_allocations else None
    violations = (
        scoring.check_allocation_against_policy(scored_records, proposed_allocations)
        if proposed_allocations
        else []
    )
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "chain": "Sui",
        "stablecoins": scored_records,
        "proposed_allocations": proposed_allocations,
        "portfolio_hhi": hhi,
        "portfolio_hhi_label": scoring.hhi_label(hhi) if hhi is not None else None,
        "policy_violations": violations,
        "ai_assessment": ai_assessment,
    }


def build_markdown_report(json_report: dict[str, Any]) -> str:
    lines = []
    lines.append(f"# Sui Stablecoin Risk Report")
    lines.append(f"_Generated: {json_report['generated_at']}_\n")

    lines.append("## Risk-ranked stablecoins\n")
    lines.append("| Symbol | Score | Band | Max Alloc | Mechanism | Issuer | Sui Circulating (USD) | Source |")
    lines.append("|---|---|---|---|---|---|---|---|")
    for r in json_report["stablecoins"]:
        alert = " ⚠️" if r.get("peg_alert") else ""
        lines.append(
            f"| {r['symbol']}{alert} | {r['composite_score']} | {r['risk_band']} "
            f"| {r['suggested_max_allocation']:.0%} | {r['metadata']['mechanism']} "
            f"| {r['metadata']['issuer']} | {r['circulating_usd']:,.0f} | {r['source']} |"
        )

    flagged = [r for r in json_report["stablecoins"] if r.get("peg_alert")]
    if flagged:
        lines.append("\n### ⚠️ Peg alerts")
        for r in flagged:
            dev = r.get("peg_deviation_fraction")
            lines.append(f"- **{r['symbol']}**: trading {dev:+.2%} off peg.")

    if json_report.get("proposed_allocations"):
        lines.append("\n## Proposed portfolio")
        for symbol, w in json_report["proposed_allocations"].items():
            lines.append(f"- {symbol}: {w:.1%}")
        hhi = json_report["portfolio_hhi"]
        lines.append(f"\n**Concentration (HHI):** {hhi} — {json_report['portfolio_hhi_label']}")

        if json_report["policy_violations"]:
            lines.append("\n### Policy violations")
            for v in json_report["policy_violations"]:
                lines.append(f"- **{v['symbol']}**: {v['issue']}")
        else:
            lines.append("\nNo policy violations against suggested allocation caps.")

    ai = json_report.get("ai_assessment")
    if ai:
        lines.append("\n## AI risk narrative")
        for coin in ai.get("per_coin", []):
            lines.append(f"\n**{coin['symbol']}** — {coin['narrative']}")
            for flag in coin.get("follow_up_flags", []):
                lines.append(f"  - Follow-up: {flag}")
        if ai.get("portfolio_commentary"):
            lines.append(f"\n### Portfolio commentary\n{ai['portfolio_commentary']}")
        if ai.get("top_priority_actions"):
            lines.append("\n### Top priority actions")
            for action in ai["top_priority_actions"]:
                lines.append(f"- {action}")
    else:
        lines.append(
            "\n_AI narrative layer not run (no ANTHROPIC_API_KEY or "
            "anthropic package) — showing quantitative scores only._"
        )

    return "\n".join(lines)


def save_reports(json_report: dict[str, Any], md_report: str, out_dir: str) -> tuple[str, str]:
    import os
    os.makedirs(out_dir, exist_ok=True)
    json_path = os.path.join(out_dir, "risk_report.json")
    md_path = os.path.join(out_dir, "risk_report.md")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(json_report, f, indent=2, default=str)
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_report)
    return json_path, md_path
