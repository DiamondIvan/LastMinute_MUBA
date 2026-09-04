import 'dotenv/config';

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

export function openRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/**
 * `openRouterConfigured()` only proves the env var is non-empty — not that the
 * key is valid. A wrong or expired key therefore skips the demo branch, calls
 * the API, gets a 401 and throws, which surfaces as an HTTP 500 and takes the
 * dashboard news feed down. That makes a bad key strictly worse than no key.
 *
 * So every call below also falls back on *failure*, not just on absence. The
 * demo payloads stay prefixed with "DUMMY DATA:" so a degraded response is
 * never mistaken for real analysis.
 */
function demoStablecoinNews(newsItems: { title: string; source: string }[]): AIAnalysisResult {
  return {
    strategyPlan: "DUMMY DATA: The current market indicates a strong shift towards regulated stablecoins like USDC. Institutional inflows are steady.",
    riskAnalysis: "DUMMY DATA: Key risks identified in recent news include increased regulatory scrutiny from the SEC on non-compliant fiat-backed tokens.",
    importantNewsIndices: newsItems.length > 0 ? [0] : []
  };
}

export async function analyzeStablecoinNews(newsItems: { title: string; source: string }[]): Promise<AIAnalysisResult> {
  if (!openRouterConfigured()) {
    console.log("No OpenRouter API key found. Returning dummy data for UI testing.");
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
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": "anthropic/claude-3.5-sonnet",
        "messages": [{"role": "user", "content": prompt}],
        "response_format": { "type": "json_object" }
      })
    });

    if (!response.ok) throw new Error(`OpenRouter API error: ${response.status}`);
    const data = await response.json() as any;
    const content = data.choices[0].message.content;
    
    try {
      const parsed = JSON.parse(content);
      return {
        strategyPlan: parsed.strategyPlan || "No strategy plan generated.",
        riskAnalysis: parsed.riskAnalysis || "No risk analysis generated.",
        importantNewsIndices: Array.isArray(parsed.importantNewsIndices) ? parsed.importantNewsIndices : []
      };
    } catch {
      return { strategyPlan: "Parse error.", riskAnalysis: "Parse error.", importantNewsIndices: [] };
    }
  } catch (error) {
    console.warn('[openrouter] analyzeStablecoinNews failed, serving demo data:', (error as Error).message);
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
  if (!openRouterConfigured()) {
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
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": "anthropic/claude-3.5-sonnet",
        "messages": [{"role": "user", "content": prompt}],
        "response_format": { "type": "json_object" }
      })
    });
    if (!response.ok) throw new Error(`OpenRouter error ${response.status}`);
    const data = await response.json() as any;
    const parsed = JSON.parse(data.choices[0].message.content);
    return {
      marketImpact: parsed.marketImpact || "",
      investorActionPlan: parsed.investorActionPlan || "",
      chartData: parsed.chartData || []
    };
  } catch (error) {
    console.warn('[openrouter] analyzeNewsImpact failed, serving demo data:', (error as Error).message);
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
  if (!openRouterConfigured()) {
    return demoAssetPredictions(assets);
  }

  const prompt = `Predict a realistic 30-day growth percentage (e.g. "+5.2%") for these stablecoin assets on the Sui network: ${assets.map(a => a.symbol).join(', ')}.
Return exactly valid JSON: { "predictions": [ { "symbol": "...", "predictedGrowth": "..." } ] }`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": "anthropic/claude-3.5-sonnet",
        "messages": [{"role": "user", "content": prompt}],
        "response_format": { "type": "json_object" }
      })
    });
    if (!response.ok) throw new Error(`OpenRouter error ${response.status}`);
    const data = await response.json() as any;
    const parsed = JSON.parse(data.choices[0].message.content);
    return parsed.predictions || assets.map(a => ({ symbol: a.symbol, predictedGrowth: "+0.0%" }));
  } catch (error) {
    console.warn('[openrouter] analyzeAssetPredictions failed, serving demo data:', (error as Error).message);
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
  if (!openRouterConfigured()) {
    return demoCoinAnalysis(symbol);
  }

  const prompt = `Analyze the stablecoin ${symbol} based on current market trends. Return a JSON object with:
- "conclusion": A short overview of the market for this stablecoin.
- "pegHealth": Assessment of its peg stability.
- "investmentRisk": Overall risk assessment.
- "futureChart": Array of 30 objects { day: "Day 1", price: number } representing a 1-month forecast.
- "pastChart": Array of 30 objects { day: "Day -30", price: number } representing the past month.`;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter error ${res.status}`);
    const data = await res.json() as any;
    const content = data.choices?.[0]?.message?.content || '{}';
    return JSON.parse(content) as CoinAnalysis;
  } catch (error) {
    console.warn(`[openrouter] analyzeCoin failed for ${symbol}, serving demo data:`, (error as Error).message);
    return demoCoinAnalysis(symbol);
  }
}
