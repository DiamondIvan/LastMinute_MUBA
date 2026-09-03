from __future__ import annotations
import time
from typing import Any

import requests

DEFILLAMA_STABLECOINS_URL = "https://stablecoins.llama.fi/stablecoins?includePrices=true"
COINGECKO_SIMPLE_PRICE_URL = "https://api.coingecko.com/api/v3/simple/price"
SUI_RPC_URL = "https://fullnode.mainnet.sui.io:443"

USE_SUI_RPC = False  # set True if you want an extra on-chain supply cross-check
REQUEST_TIMEOUT = 15


def _get(url: str, params: dict | None = None) -> dict | None:
    try:
        resp = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        print(f"[data_sources] WARNING: request to {url} failed: {exc}")
        return None


def discover_sui_stablecoins() -> list[dict[str, Any]]:
    """
    Returns a list of stablecoins that currently have circulating supply on
    Sui, per DefiLlama's aggregated stablecoin dataset.

    Each record looks like:
      {
        "symbol": "USDC",
        "name": "USD Coin",
        "circulating_usd": 123456789.0,
        "price": 0.9998,
        "peg_type": "peggedUSD",
        "peg_mechanism": "fiat-backed",   # DefiLlama's own tag, if present
        "source": "live" | "sample",
      }
    """
    data = _get(DEFILLAMA_STABLECOINS_URL)
    if data is None or "peggedAssets" not in data:
        from sample_data import SAMPLE_SUI_STABLECOINS
        print("[data_sources] Falling back to bundled sample data.")
        return SAMPLE_SUI_STABLECOINS

    results = []
    for asset in data["peggedAssets"]:
        chain_circ = asset.get("chainCirculating", {}).get("Sui")
        if not chain_circ:
            continue
        current = chain_circ.get("current", {})
        # DefiLlama nests supply by peg unit, e.g. {"peggedUSD": 123.0}
        circulating_usd = sum(v for v in current.values() if isinstance(v, (int, float)))
        if circulating_usd <= 0:
            continue

        price = None
        prices = asset.get("price")
        if isinstance(prices, (int, float)):
            price = prices

        results.append(
            {
                "symbol": asset.get("symbol", "UNKNOWN").upper(),
                "name": asset.get("name", "Unknown"),
                "circulating_usd": circulating_usd,
                "price": price,
                "peg_type": asset.get("pegType", "unknown"),
                "peg_mechanism": asset.get("pegMechanism", "unknown"),
                "source": "live",
                "fetched_at": time.time(),
            }
        )

    if not results:
        from sample_data import SAMPLE_SUI_STABLECOINS
        print("[data_sources] Live query returned no Sui stablecoins -- falling back to sample data.")
        return SAMPLE_SUI_STABLECOINS

    return results


def cross_check_price_coingecko(coingecko_id: str) -> float | None:
    """Optional secondary price source, e.g. for peg-deviation cross-checks."""
    data = _get(COINGECKO_SIMPLE_PRICE_URL, params={"ids": coingecko_id, "vs_currencies": "usd"})
    if not data or coingecko_id not in data:
        return None
    return data[coingecko_id].get("usd")


def sui_rpc_total_supply(coin_type: str) -> float | None:
    """
    Optional: query Sui full-node JSON-RPC directly for a coin's total
    supply, for teams that want an on-chain-verified number rather than
    trusting an indexer. `coin_type` is the fully-qualified Move type, e.g.
    "0x...::usdc::USDC".
    """
    if not USE_SUI_RPC:
        return None
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "suix_getTotalSupply",
        "params": [coin_type],
    }
    try:
        resp = requests.post(SUI_RPC_URL, json=payload, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        result = resp.json().get("result", {})
        return float(result.get("value", 0))
    except Exception as exc:  # noqa: BLE001
        print(f"[data_sources] Sui RPC call failed: {exc}")
        return None
