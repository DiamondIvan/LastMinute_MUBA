CHAIN = "Sui"

STABLECOIN_METADATA = {
    "USDC": {
        "issuer": "Circle",
        "mechanism": "fiat-backed",       # fiat-backed | tokenized-treasury | crypto-collateralized | synthetic-delta-neutral | algorithmic
        "regulated": True,
        "attestation": "monthly",         # none | monthly | real-time
        "notes": "Fiat/cash-equivalent reserves, monthly attestations, US-regulated issuer.",
    },
    "USDT": {
        "issuer": "Tether",
        "mechanism": "fiat-backed",
        "regulated": False,
        "attestation": "quarterly",
        "notes": "Largest stablecoin by supply; reserve composition and audit history remain a recurring risk-committee discussion point.",
    },
    "USDSUI": {
        "issuer": "Bridge (Stripe)",
        "mechanism": "tokenized-treasury",
        "regulated": True,
        "attestation": "monthly",
        "notes": "Sui-native stablecoin issued via Bridge's Open Issuance platform; reserves in US Treasuries held by BlackRock/Fidelity/Superstate. Launched Mar 2026 -- limited track record.",
    },
    "SUIUSDE": {
        "issuer": "Ethena",
        "mechanism": "synthetic-delta-neutral",
        "regulated": False,
        "attestation": "real-time",
        "notes": "Delta-neutral synthetic dollar; depends on perp funding rates and hedging execution rather than pure cash reserves. Higher structural risk than fiat-backed coins.",
    },
    "AUSD": {
        "issuer": "Agora",
        "mechanism": "fiat-backed",
        "regulated": True,
        "attestation": "monthly",
        "notes": "Fiat-backed multi-chain stablecoin.",
    },
    "FDUSD": {
        "issuer": "First Digital Labs",
        "mechanism": "fiat-backed",
        "regulated": False,
        "attestation": "monthly",
        "notes": "Has previously experienced brief depeg episodes tied to issuer scrutiny; monitor peg closely.",
    },
    "USDY": {
        "issuer": "Ondo Finance",
        "mechanism": "tokenized-treasury",
        "regulated": True,
        "attestation": "monthly",
        "yield_accruing": True,  
        "notes": "Yield-bearing tokenized short-term US Treasuries / bank deposits note; price accrues above $1 over time by design.",
    },
    "USDB": {
        "issuer": "Unknown / verify per-deployment",
        "mechanism": "crypto-collateralized",
        "regulated": False,
        "attestation": "none",
        "notes": "Symbol reused across ecosystems (e.g. CDP-style issuers) -- confirm the specific issuer on Sui before trusting this default.",
    },
}

DEFAULT_METADATA = {
    "issuer": "Unknown",
    "mechanism": "unknown",
    "regulated": False,
    "attestation": "none",
    "notes": "No curated metadata for this coin yet -- treat as high uncertainty until reviewed.",
}

MECHANISM_RISK = {
    "fiat-backed": 15,
    "tokenized-treasury": 20,
    "crypto-collateralized": 45,
    "synthetic-delta-neutral": 55,
    "algorithmic": 90,
    "unknown": 80,
}

ATTESTATION_RISK = {
    "real-time": 5,
    "monthly": 20,
    "quarterly": 40,
    "none": 75,
}

REGULATED_RISK = {
    True: 10,
    False: 45,
}

SCORE_WEIGHTS = {
    "peg_deviation": 0.30,
    "mechanism": 0.20,
    "issuer_regulatory": 0.15,
    "attestation": 0.10,
    "liquidity": 0.25,
}

RISK_BANDS = [
    (0, 25, "LOW"),
    (25, 45, "MEDIUM"),
    (45, 70, "HIGH"),
    (70, 101, "CRITICAL"),
]

MAX_ALLOCATION_BY_BAND = {
    "LOW": 0.40,
    "MEDIUM": 0.20,
    "HIGH": 0.08,
    "CRITICAL": 0.00,
}

# Peg deviation alert threshold (fraction away from $1.00) that should raise
# an immediate monitoring flag regardless of composite score.
PEG_ALERT_THRESHOLD = 0.003  # 30 bps
