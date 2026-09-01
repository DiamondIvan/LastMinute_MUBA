// Deployed to Sui testnet on 2026-09-02 (tx VqQjyNqo1AginGHMQ3HtiRwPvdVNDh2M3MbXB4Y7TjY).
export const PACKAGE_ID = '0x0047c06a35bf05d6148797eeeeada97d134f64410ff65ed88e8792770df87b9b';
export const CONFIG_ID = '0x6df54fa32eff53523793d1ee1fe602076309dbede5803b9e300ffffb11b90c77';

// Shared Clock object — fixed address on every Sui network.
export const CLOCK_ID = '0x6';

// A registered ResearchReport used by the verification demo. Set this to the
// report whose content_hash is sha256(DEMO_REPORT_TEXT) — see repo README,
// "Register the verification demo report". Empty string hides the verify panel.
export const DEMO_REPORT_OBJECT_ID = '';

// Must match the constants in blockchain/sources/news_platform.move.
export const REPORT_PRICE_MIST = 5_000_000; // 0.005 SUI
export const SUBSCRIPTION_PRICE_MIST = 10_000_000; // 0.01 SUI

export const RESEARCH_ACCESS_TYPE = `${PACKAGE_ID}::news_platform::ResearchAccess`;
export const PREMIUM_PASS_TYPE = `${PACKAGE_ID}::news_platform::PremiumPass`;

export function contractsConfigured(): boolean {
  return !PACKAGE_ID.startsWith('0xYOUR') && !CONFIG_ID.startsWith('0xYOUR');
}
