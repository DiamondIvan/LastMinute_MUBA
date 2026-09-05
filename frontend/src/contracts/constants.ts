// Deployed to Sui testnet on 2026-09-02 (tx VqQjyNqo1AginGHMQ3HtiRwPvdVNDh2M3MbXB4Y7TjY).
export const PACKAGE_ID = '0x0047c06a35bf05d6148797eeeeada97d134f64410ff65ed88e8792770df87b9b';
export const CONFIG_ID = '0x6df54fa32eff53523793d1ee1fe602076309dbede5803b9e300ffffb11b90c77';

// Shared Clock object — fixed address on every Sui network.
export const CLOCK_ID = '0x6';

// A registered ResearchReport used by the verification demo. Set this to the
// report whose content_hash is sha256(DEMO_REPORT_TEXT) — see repo README,
// "Register the verification demo report". Empty string hides the verify panel.
export const DEMO_REPORT_OBJECT_ID =
  '0xc63fd6d76b573c69dfc54162b6ded41f5601c0354d2276330ae09297505d4a69';

// Must match the constants in blockchain/sources/news_platform.move.
export const REPORT_PRICE_MIST = 5_000_000; // 0.005 SUI
export const SUBSCRIPTION_PRICE_MIST = 10_000_000; // 0.01 SUI

export const RESEARCH_ACCESS_TYPE = `${PACKAGE_ID}::news_platform::ResearchAccess`;
export const PREMIUM_PASS_TYPE = `${PACKAGE_ID}::news_platform::PremiumPass`;
export const RESEARCH_REPORT_TYPE = `${PACKAGE_ID}::news_platform::ResearchReport`;
export const KIOSK_STATE_TYPE = `${PACKAGE_ID}::news_kiosk::KioskState`;

export function contractsConfigured(): boolean {
  return !PACKAGE_ID.startsWith('0xYOUR') && !CONFIG_ID.startsWith('0xYOUR');
}

// swap-contract package — separate deployment, testnet 2026-09-05. Real SUI <->
// TestUSD swap (a custom demo coin this app mints itself, oracle-priced by the
// backend), backing the AI-suggested-trade "Approve" flow for SUI proposals
// only. See swap-contract/Published.toml for the rest of the deployed ids.
export const SWAP_PACKAGE_ID = '0xec277d5aef1f357f6c137dd9d4c771a1041a63a1da9a02bc239717fbfd4de0b7';
export const SWAP_CONFIG_ID = '0x0c7972a91b47533f67e538c23a27208f487bc0320fdcdfaddf9c92169c113d47';
export const SWAP_TESTUSD_TYPE = `${SWAP_PACKAGE_ID}::swap::SWAP`;

export function swapContractConfigured(): boolean {
  return !!SWAP_PACKAGE_ID && !!SWAP_CONFIG_ID;
}
