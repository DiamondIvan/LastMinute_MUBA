from __future__ import annotations
import argparse
import json
import sys

import data_sources
import metrics
import scoring
import report


def run(allocations_path: str | None, use_ai: bool, out_dir: str, with_news: bool) -> None:
    print("[1/5] Discovering stablecoins circulating on Sui...")
    raw = data_sources.discover_sui_stablecoins()
    print(f"      Found {len(raw)} stablecoin(s). Source: {raw[0]['source'] if raw else 'n/a'}")

    print("[2/5] Computing risk sub-scores...")
    enriched = metrics.compute_all_metrics(raw)

    print("[3/5] Computing composite scores + risk bands...")
    scored = scoring.score_all(enriched)
    for r in scored:
        alert = " [PEG ALERT]" if r.get("peg_alert") else ""
        print(f"      {r['symbol']:>8}  score={r['composite_score']:>5}  band={r['risk_band']:<8}{alert}")

    proposed_allocations = None
    if allocations_path:
        with open(allocations_path) as f:
            proposed_allocations = json.load(f)

    news_context = None
    news_manifest = None
    if with_news:
        print("[news] Scanning current crypto news for Sui stablecoin signals...")
        try:
            from news_agent import fetch_news_intelligence, save_news_report, summarize_for_risk_layer
            symbols = [r["symbol"] for r in scored]
            news_report = fetch_news_intelligence(symbols)
            news_manifest = save_news_report(news_report, out_dir)
            news_context = summarize_for_risk_layer(news_report)
            print(f"       Found {len(news_report.get('stories', []))} relevant stor(y/ies). "
                  f"Overall signal: {news_report.get('overall_risk_signal')}")
            print(f"       Report SHA-256 (for on-chain storage): {news_manifest['sha256']}")
        except Exception as exc:  # noqa: BLE001
            print(f"       Skipping news agent: {exc}")

    ai_assessment = None
    if use_ai:
        print("[4/5] Requesting AI narrative assessment from Claude...")
        try:
            from ai_layer import generate_ai_risk_assessment
            hhi = scoring.portfolio_hhi(proposed_allocations) if proposed_allocations else None
            ai_assessment = generate_ai_risk_assessment(scored, proposed_allocations, hhi, news_context)
        except Exception as exc:  # noqa: BLE001
            print(f"      Skipping AI layer: {exc}")
    else:
        print("[4/5] Skipping AI layer (--no-ai).")

    print("[5/5] Building report...")
    json_report = report.build_json_report(scored, ai_assessment, proposed_allocations)
    if news_manifest:
        json_report["news_manifest"] = news_manifest
    md_report = report.build_markdown_report(json_report)
    json_path, md_path = report.save_reports(json_report, md_report, out_dir)

    print(f"\nDone. Wrote:\n  {json_path}\n  {md_path}")
    if news_manifest:
        print(f"  {news_manifest['path']}  (upload this to Walrus; store sha256 + blob id on-chain)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sui stablecoin AI risk layer")
    parser.add_argument("--allocations", help="Path to a JSON file of proposed {symbol: weight} allocations")
    parser.add_argument("--no-ai", action="store_true", help="Skip the Claude narrative layer, quant scores only")
    parser.add_argument("--with-news", action="store_true", help="Run the news agent (web search) before scoring")
    parser.add_argument("--out", default="./reports", help="Output directory for reports")
    args = parser.parse_args()

    try:
        run(args.allocations, use_ai=not args.no_ai, out_dir=args.out, with_news=args.with_news)
    except KeyboardInterrupt:
        sys.exit(1)
