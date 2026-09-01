/**
 * A fixed report used for the verification demo, so the flow works without an
 * AI key or a backend.
 *
 * Its SHA-256 is registered on-chain as a `ResearchReport.content_hash`, so
 * `VerifyPanel` shows VERIFIED for this exact string and FAILED as soon as a
 * single character changes.
 *
 * Do not reformat this string — any edit changes the hash and breaks the demo.
 * If you must edit it, recompute the hash and re-register the report
 * (see repo README, "Register the verification demo report").
 */
export const DEMO_REPORT_TEXT = [
  'BTC Intelligence Report',
  '',
  'Sentiment: bullish (confidence 84%)',
  'Risk: medium',
  '',
  'Key developments:',
  '- Institutional inflows continued for a third consecutive week.',
  '- Regulatory tone improved in two major jurisdictions.',
  '- Spot ETF volumes remained above the 30-day average.',
  '',
  'Risks:',
  '- Leverage remains elevated across major venues.',
  '- Macro liquidity conditions could tighten on the next rate decision.',
  '',
  'AI conclusion: short-term setup is constructive, volatility stays high.',
  '',
  'This is not financial advice.',
].join('\n');

/**
 * SHA-256 of `DEMO_REPORT_TEXT` — the value to register on-chain as
 * `content_hash`. Recorded here only so the README command is copy-pasteable;
 * nothing reads it at runtime (VerifyPanel always hashes the live text).
 *
 * To regenerate after editing the text: run the app, click Verify, and the
 * failure panel prints the new "this text" hash. Register that.
 */
export const DEMO_REPORT_HASH =
  'f88ab174c94559767c52fc0864404a241f8c5c90691dde84779e04ef149525c9';
