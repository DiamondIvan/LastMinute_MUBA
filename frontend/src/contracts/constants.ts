// Fill these in after `sui client publish` (see repo README, "Deploy to Sui Testnet").
// PLACEHOLDERS — the app will not transact until these are real object ids.
export const PACKAGE_ID = '0xYOUR_PACKAGE_ID';
export const CONFIG_ID = '0xYOUR_PLATFORMCONFIG_OBJECT_ID';

// Shared Clock object — fixed address on every Sui network.
export const CLOCK_ID = '0x6';

// Must match the constants in blockchain/sources/news_platform.move.
export const REPORT_PRICE_MIST = 5_000_000; // 0.005 SUI
export const SUBSCRIPTION_PRICE_MIST = 10_000_000; // 0.01 SUI

export const RESEARCH_ACCESS_TYPE = `${PACKAGE_ID}::news_platform::ResearchAccess`;
export const PREMIUM_PASS_TYPE = `${PACKAGE_ID}::news_platform::PremiumPass`;

export function contractsConfigured(): boolean {
  return !PACKAGE_ID.startsWith('0xYOUR') && !CONFIG_ID.startsWith('0xYOUR');
}
