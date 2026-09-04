// Thin client for the backend. Paths are relative — Vite proxies /api to :8787 in dev.

export interface Analysis {
  sentiment: 'bullish' | 'bearish' | 'neutral' | 'mixed';
  confidence: number;
  risk: 'low' | 'medium' | 'high';
  keyDevelopments: string[];
  risks: string[];
}

export interface ResearchResponse {
  title: string;
  summary: string;
  analysis: Analysis;
  sources: { title: string; url: string; publisher: string }[];
  contentHash: string;
  generatedAt: string;
  reportObjectId: string | null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      (json as { error?: string }).error ?? `${res.status} ${res.statusText}`,
      res.status,
    );
  }
  return json as T;
}

export function research(question: string) {
  return post<ResearchResponse>('/api/research', { question });
}

// ---- wallet sign-in ---------------------------------------------------------
// The server derives the caller address from this token, never from a request
// body — see docs/SECURITY.md, Finding 1.

export function getNonce(address: string) {
  return post<{ nonce: string; message: string }>('/api/auth/nonce', { address });
}

export function verifyAuth(address: string, nonce: string, signature: string) {
  return post<{ token: string }>('/api/auth/verify', { address, nonce, signature });
}

/** Requires a session token proving control of the wallet that bought access. */
export function unlockReport(contentHash: string, token: string) {
  return post<{ full: string }>(`/api/reports/${contentHash}/unlock`, {}, token);
}

export interface ScrapedNews {
  source: string;
  title: string;
  link: string;
}

export interface AssetPrediction {
  symbol: string;
  predictedGrowth: string;
}

export interface StablecoinAnalysisResponse {
  news: ScrapedNews[];
  strategyPlan: string;
  riskAnalysis: string;
  importantNewsIndices: number[];
  assetPredictions: AssetPrediction[];
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

export async function fetchStablecoinAnalysis(): Promise<StablecoinAnalysisResponse> {
  const res = await fetch('/api/forecast/stablecoin-news');
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((json as any).error ?? res.statusText, res.status);
  return json as StablecoinAnalysisResponse;
}

export async function fetchNewsImpact(title: string, coin: string, walletBalanceSui: number): Promise<NewsImpactAnalysis> {
  const res = await fetch('/api/forecast/news-impact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, coin, walletBalanceSui }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((json as any).error ?? res.statusText, res.status);
  return json as NewsImpactAnalysis;
}

export async function fetchCoinAnalysis(symbol: string): Promise<CoinAnalysis> {
  const res = await fetch(`/api/forecast/coin/${encodeURIComponent(symbol)}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((json as any).error ?? res.statusText, res.status);
  return json as CoinAnalysis;
}
