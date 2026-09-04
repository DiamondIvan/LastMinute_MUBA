import time

_NOW = time.time()

SAMPLE_SUI_STABLECOINS = [
    {"symbol": "USDC", "name": "USD Coin", "circulating_usd": 900_000_000.0, "price": 0.9999, "peg_type": "peggedUSD", "peg_mechanism": "fiat-backed", "source": "sample", "fetched_at": _NOW},
    {"symbol": "USDT", "name": "Tether", "circulating_usd": 250_000_000.0, "price": 1.0001, "peg_type": "peggedUSD", "peg_mechanism": "fiat-backed", "source": "sample", "fetched_at": _NOW},
    {"symbol": "USDSUI", "name": "Sui Dollar", "circulating_usd": 300_000_000.0, "price": 1.0000, "peg_type": "peggedUSD", "peg_mechanism": "tokenized-treasury", "source": "sample", "fetched_at": _NOW},
    {"symbol": "SUIUSDE", "name": "Ethena USDe (Sui)", "circulating_usd": 120_000_000.0, "price": 0.9985, "peg_type": "peggedUSD", "peg_mechanism": "synthetic-delta-neutral", "source": "sample", "fetched_at": _NOW},
    {"symbol": "AUSD", "name": "Agora Dollar", "circulating_usd": 40_000_000.0, "price": 1.0002, "peg_type": "peggedUSD", "peg_mechanism": "fiat-backed", "source": "sample", "fetched_at": _NOW},
    {"symbol": "FDUSD", "name": "First Digital USD", "circulating_usd": 30_000_000.0, "price": 0.9970, "peg_type": "peggedUSD", "peg_mechanism": "fiat-backed", "source": "sample", "fetched_at": _NOW},
    {"symbol": "USDY", "name": "Ondo US Dollar Yield", "circulating_usd": 25_000_000.0, "price": 1.0450, "peg_type": "peggedUSD", "peg_mechanism": "tokenized-treasury", "source": "sample", "fetched_at": _NOW},
]
