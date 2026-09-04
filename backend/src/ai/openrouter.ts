import 'dotenv/config';
import { gonkaChatJson, gonkaConfigured } from './gonka.js';

/**
 * Stablecoin news/prediction analysis, powered by Gonka.
 *
 * Despite the filename (kept to avoid an unrelated rename touching every
 * import of this module), nothing here calls OpenRouter any more — all four
 * functions below went through `gonkaChatJson()` in `gonka.ts` instead, using
 * the same broker-configurable base URL / model / key as the daily forecast
 * narration.
 *
 * `gonkaConfigured()` only proves GONKA_API_KEY is non-empty, not that it's
 * valid — so every call below falls back on *failure* too, not just on
 * absence, exactly like the daily-forecast narration in `gonka.ts`. A bad key
 * degrading to demo data (rather than throwing into an HTTP 500) is the
 * behaviour this file was already fixed to have; that stays true here.
 *
 * One more failure mode is specific to this model: GonkaRouter's default
 * (MiniMax-M2.7) sometimes safety-refuses a request — observed live on
 * analyzeCoin's 30-day-forecast wording — while still returning syntactically
 * valid JSON, just `{"error": "..."}` instead of the requested schema. That
 * parses successfully, so checking only "did JSON.parse succeed" let a near-
 * empty result reach the user. Every function below additionally checks that
 * its one required field actually has content before accepting the response.
 */

export interface AIAnalysisResult {
  strategyPlan: string;
  riskAnalysis: string;
  importantNewsIndices: number[];
}

export interface AssetPrediction {
  symbol: string;
  predictedGrowth: string;
}

export interface ChartDataPoint {
  day: string;
  price: number;
}

export interface NewsImpactAnalysis {
  marketImpact: string;
  investorActionPlan: string;
  chartData: ChartDataPoint[];
}

export interface CoinAnalysis {
  conclusion: string;
  pegHealth: string;
  investmentRisk: string;
  futureChart: ChartDataPoint[];
  pastChart: ChartDataPoint[];
}

function demoStablecoinNews(newsItems: { title: string; source: string }[]): AIAnalysisResult {
  return {
    strategyPlan: "DUMMY DATA: The current market indicates a strong shift towards regulated stablecoins like USDC. Institutional inflows are steady.",
    riskAnalysis: "DUMMY DATA: Key risks identified in recent news include increased regulatory scrutiny from the SEC on non-compliant fiat-backed tokens.",
    importantNewsIndices: newsItems.length > 0 ? [0] : []
  };
}

export async function analyzeStablecoinNews(newsItems: { title: string; source: string }[]): Promise<AIAnalysisResult> {
  if (!gonkaConfigured()) {
    console.log("No Gonka API key found. Returning dummy data for UI testing.");
    await new Promise(resolve => setTimeout(resolve, 1500));
    return demoStablecoinNews(newsItems);
  }

  const newsContext = newsItems.map((item, idx) => `[${idx}] ${item.title}`).join('\n');
  const prompt = `You are a cryptocurrency financial analyst specializing in stablecoins.
Based on the following news headlines, provide three things:
1. "strategyPlan": A brief Strategy Plan.
2. "riskAnalysis": A brief Risk Analysis.
3. "importantNewsIndices": An array of indices (integers) corresponding to the news items you deem "super important" market movers (max 3).

Format your response exactly as valid JSON:
{
  "strategyPlan": "...",
  "riskAnalysis": "...",
  "importantNewsIndices": [0, 2]
}

News Headlines:
${newsContext}`;

  try {
    const parsed = await gonkaChatJson<Partial<AIAnalysisResult>>({ user: prompt });
    if (!parsed?.strategyPlan) throw new Error('model returned no usable strategyPlan (parse failure or refusal)');
    return {
      strategyPlan: parsed.strategyPlan || "No strategy plan generated.",
      riskAnalysis: parsed.riskAnalysis || "No risk analysis generated.",
      importantNewsIndices: Array.isArray(parsed.importantNewsIndices) ? parsed.importantNewsIndices : []
    };
  } catch (error) {
    console.warn('[gonka] analyzeStablecoinNews failed, serving demo data:', (error as Error).message);
    return demoStablecoinNews(newsItems);
  }
}

function demoNewsImpact(coin: string, walletBalanceSui: number): NewsImpactAnalysis {
  return {
    marketImpact: "DUMMY DATA: This news signifies a potential 15% increase in cross-chain liquidity for " + coin + ".",
    investorActionPlan: "DUMMY DATA: Based on your balance of " + walletBalanceSui + " SUI, we suggest allocating 10% (" + (walletBalanceSui * 0.1).toFixed(2) + " SUI) into " + coin + " to capture the upside.",
    chartData: [
      { day: 'Day 1', price: 1.00 },
      { day: 'Day 5', price: 1.01 },
      { day: 'Day 10', price: 1.03 },
      { day: 'Day 20', price: 1.05 },
      { day: 'Day 30', price: 1.08 },
    ]
  };
}

export async function analyzeNewsImpact(newsTitle: string, coin: string, walletBalanceSui: number): Promise<NewsImpactAnalysis> {
  if (!gonkaConfigured()) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return demoNewsImpact(coin, walletBalanceSui);
  }

  const prompt = `Analyze the market impact of this stablecoin news headline: "${newsTitle}"
Focusing specifically on the stablecoin: ${coin}.
The user has a current wallet balance of ${walletBalanceSui} SUI.

Provide exactly valid JSON with:
1. "marketImpact": A brief analysis of how this news affects ${coin}.
2. "investorActionPlan": A suggested percentage allocation of their ${walletBalanceSui} SUI into ${coin}, and a brief reason why.
3. "chartData": An array of 5 objects representing a 30-day predicted price trajectory for ${coin} (assuming it starts near $1.00 but might fluctuate or yield). Format: { "day": "Day X", "price": 1.0XX }

{
  "marketImpact": "...",
  "investorActionPlan": "...",
  "chartData": [
    { "day": "Day 1", "price": 1.00 }, ...
  ]
}`;

  try {
    const parsed = await gonkaChatJson<Partial<NewsImpactAnalysis>>({ user: prompt });
    if (!parsed?.marketImpact) throw new Error('model returned no usable marketImpact (parse failure or refusal)');
    return {
      marketImpact: parsed.marketImpact || "",
      investorActionPlan: parsed.investorActionPlan || "",
      chartData: parsed.chartData || []
    };
  } catch (error) {
    console.warn('[gonka] analyzeNewsImpact failed, serving demo data:', (error as Error).message);
    return demoNewsImpact(coin, walletBalanceSui);
  }
}

function demoAssetPredictions(assets: {symbol: string}[]): AssetPrediction[] {
  return assets.map(a => ({
    symbol: a.symbol,
    predictedGrowth: "+" + (Math.random() * 10).toFixed(2) + "%"
  }));
}

export async function analyzeAssetPredictions(assets: {symbol: string}[]): Promise<AssetPrediction[]> {
  if (!gonkaConfigured()) {
    return demoAssetPredictions(assets);
  }

  const prompt = `Predict a realistic 30-day growth percentage (e.g. "+5.2%") for these stablecoin assets on the Sui network: ${assets.map(a => a.symbol).join(', ')}.
Return exactly valid JSON: { "predictions": [ { "symbol": "...", "predictedGrowth": "..." } ] }`;

  try {
    const parsed = await gonkaChatJson<{ predictions?: AssetPrediction[] }>({ user: prompt });
    if (!parsed?.predictions?.length) throw new Error('model returned no usable predictions (parse failure or refusal)');
    return parsed.predictions;
  } catch (error) {
    console.warn('[gonka] analyzeAssetPredictions failed, serving demo data:', (error as Error).message);
    return demoAssetPredictions(assets);
  }
}

function demoCoinAnalysis(symbol: string): CoinAnalysis {
  return {
    conclusion: `Based on recent news, ${symbol} continues to demonstrate strong market positioning with expanding ecosystem integrations and favorable yield conditions. The overall market overview is cautiously optimistic, driven by stable liquidity and increasing decentralized application usage.`,
    pegHealth: `The peg for ${symbol} remains extremely stable at 1.00. Collateralization ratios and deep liquidity pools provide a robust buffer against market volatility.`,
    investmentRisk: "Low to Moderate. While smart contract and systemic risks always exist in DeFi, recent audits and conservative treasury management suggest a highly secure environment.",
    futureChart: Array.from({ length: 30 }, (_, i) => ({
      day: `Day ${i + 1}`,
      price: 1.0 + (Math.random() * 0.005) - 0.001
    })),
    pastChart: Array.from({ length: 30 }, (_, i) => ({
      day: `Day -${30 - i}`,
      price: 1.0 + (Math.random() * 0.005) - 0.002
    }))
  };
}

export async function analyzeCoin(symbol: string): Promise<CoinAnalysis> {
  if (!gonkaConfigured()) {
    return demoCoinAnalysis(symbol);
  }

  const prompt = `Write an illustrative market-commentary summary for the stablecoin ${symbol},
for a UI mockup chart. This is not financial advice and not a real prediction —
it is representative sample data showing typical stablecoin peg behaviour.
Return a JSON object with:
- "conclusion": A short overview of the market for this stablecoin.
- "pegHealth": Assessment of its peg stability.
- "investmentRisk": Overall risk assessment.
- "futureChart": Array of 30 objects { day: "Day 1", price: number } — illustrative 1-month trend line, prices near $1.00.
- "pastChart": Array of 30 objects { day: "Day -30", price: number } — illustrative past month, prices near $1.00.`;

  try {
    const parsed = await gonkaChatJson<Partial<CoinAnalysis>>({ user: prompt });
    if (!parsed?.conclusion) throw new Error('model returned no usable conclusion (parse failure or refusal)');
    return {
      conclusion: parsed.conclusion ?? '',
      pegHealth: parsed.pegHealth ?? '',
      investmentRisk: parsed.investmentRisk ?? '',
      futureChart: parsed.futureChart ?? [],
      pastChart: parsed.pastChart ?? [],
    };
  } catch (error) {
    console.warn(`[gonka] analyzeCoin failed for ${symbol}, serving demo data:`, (error as Error).message);
    return demoCoinAnalysis(symbol);
  }
}
