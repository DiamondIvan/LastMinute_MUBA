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

// ---- daily crypto forecast --------------------------------------------------
// Scraped feeds + live DefiLlama market data + a Gonka-written narrative.
// The backend caches one snapshot per day; `coins` only filters the response.

export type PegStatus = 'Optimal' | 'Minor Stress' | 'High Risk' | 'Yield-Bearing';

export interface CoinMarketData {
  symbol: string;
  name: string;
  price: number | null;
  circulatingUsd: number;
  pegDeviationBps: number | null;
  pegStatus: PegStatus;
  mechanism: string;
  source: 'defillama' | 'unavailable';
}

export interface FeedItem {
  source: string;
  sourceName: string;
  title: string;
  link: string;
  publishedAt: string | null;
  coins: string[];
}

export interface SourceReport {
  name: string;
  url: string;
  mode: 'rss' | 'html';
  ok: boolean;
  items: number;
  note?: string;
}

export interface CoinNarrative {
  symbol: string;
  narrative: string;
  watchItems: string[];
}

export interface DailyNarrative {
  headline: string;
  outlook: string;
  perCoin: CoinNarrative[];
  whatChanged: string[];
  generatedBy: 'gonka' | 'demo';
  model?: string;
}

export interface DailyForecastResponse {
  date: string;
  generatedAt: string;
  market: CoinMarketData[];
  news: FeedItem[];
  sources: SourceReport[];
  usedFallbackNews: boolean;
  narrative: DailyNarrative;
  trackedSymbols: string[];
  wishlist: string[];
  aiConfigured: boolean;
}

export async function fetchDailyForecast(
  coins: string[] = [],
  refresh = false,
): Promise<DailyForecastResponse> {
  const params = new URLSearchParams();
  if (coins.length > 0) params.set('coins', coins.join(','));
  if (refresh) params.set('refresh', '1');
  const qs = params.toString();

  const res = await fetch(`/api/forecast/daily${qs ? `?${qs}` : ''}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((json as any).error ?? res.statusText, res.status);
  return json as DailyForecastResponse;
}

/**
 * Live per-coin price, peg deviation and Sui circulating supply (DefiLlama,
 * via the backend). Use this for stablecoin USD pricing — DeepBook's mainnet
 * pools price SUI/WUSDT/DEEP against USDC, not USDC/USDsui/FDUSD/BUCK
 * themselves, so they aren't a usable source for these symbols.
 */
export async function fetchStablecoinMarket(): Promise<CoinMarketData[]> {
  const res = await fetch('/api/market/stablecoins');
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((json as any).error ?? res.statusText, res.status);
  return (json as { market: CoinMarketData[] }).market;
}

/**
 * Real daily peg-price history for the stablecoin tracker chart — derived
 * from DefiLlama's circulating-supply-in-USD-terms data, not fabricated.
 * Daily resolution only; there is no 24H timeframe because no free intraday
 * source exists for these coins.
 */
export type HistoryTimeframe = '7D' | '30D' | '1Y';

export interface HistoryPoint {
  time: string;
  price: number;
}

export async function fetchStablecoinHistory(): Promise<Record<string, Record<HistoryTimeframe, HistoryPoint[]>>> {
  const res = await fetch('/api/market/stablecoins/history');
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((json as any).error ?? res.statusText, res.status);
  return (json as { history: Record<string, Record<HistoryTimeframe, HistoryPoint[]>> }).history;
}

// ---- AI trading signals + paper trading ------------------------------------
// Signals are descriptive market commentary, never buy/sell direction. Paper
// trades are SIMULATED — nothing here touches a real balance or the chain —
// but they're valued against the same live price feed as everything else.

export type SignalKind = 'strengthening' | 'stable' | 'weakening' | 'watch';

export interface AssetSignal {
  symbol: string;
  signal: SignalKind;
  rationale: string;
  watchItems: string[];
}

export interface SignalsSnapshot {
  date: string;
  generatedAt: string;
  signals: AssetSignal[];
  headlineCount: number;
  generatedBy: 'gonka' | 'demo';
  model?: string;
}

export interface PaperPosition {
  id: string;
  symbol: string;
  notionalUsd: number;
  units: number;
  entryPrice: number;
  openedAt: string;
  signalAtEntry: string | null;
  closedAt?: string;
  exitPrice?: number;
  realisedPnlUsd?: number;
  currentPrice?: number | null;
  currentValueUsd?: number | null;
  unrealisedPnlUsd?: number | null;
}

export interface PaperLedger {
  simulated: true;
  open: PaperPosition[];
  closed: PaperPosition[];
  summary: {
    realisedPnlUsd: number;
    unrealisedPnlUsd: number;
    openCount: number;
    closedCount: number;
  };
}

export async function fetchSignals(refresh = false): Promise<SignalsSnapshot> {
  const res = await fetch(`/api/signals${refresh ? '?refresh=1' : ''}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((json as any).error ?? res.statusText, res.status);
  return json as SignalsSnapshot;
}

export async function fetchTradeablePrices(): Promise<Record<string, number>> {
  const res = await fetch('/api/market/tradeable');
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((json as any).error ?? res.statusText, res.status);
  return (json as { prices: Record<string, number> }).prices;
}

export async function fetchPaperLedger(address: string): Promise<PaperLedger> {
  const res = await fetch(`/api/paper/${encodeURIComponent(address)}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((json as any).error ?? res.statusText, res.status);
  return json as PaperLedger;
}

export async function openPaperPosition(address: string, symbol: string, notionalUsd: number) {
  return post<{ simulated: true; position: PaperPosition }>(
    `/api/paper/${encodeURIComponent(address)}/open`,
    { symbol, notionalUsd },
  );
}

export async function closePaperPosition(address: string, positionId: string) {
  return post<{ simulated: true; position: PaperPosition }>(
    `/api/paper/${encodeURIComponent(address)}/close`,
    { positionId },
  );
}

// ---- trade proposals (approve / reject) ------------------------------------
// Gonka reads the market; deterministic rules on the backend turn that read
// into a concrete proposed action. Approving executes against the SIMULATED
// ledger only — nothing on-chain, no funds move.

export interface TradeProposal {
  id: string;
  action: 'open' | 'close';
  symbol: string;
  notionalUsd?: number;
  positionId?: string;
  price: number;
  signal: SignalKind;
  /** Gonka's market read — context, not a recommendation. */
  rationale: string;
  /** The deterministic rule that produced this proposal. */
  basis: string;
}

export interface ProposalsResponse {
  date: string;
  simulated: true;
  generatedBy: 'gonka' | 'demo';
  proposals: TradeProposal[];
}

export async function fetchProposals(address: string): Promise<ProposalsResponse> {
  const res = await fetch(`/api/proposals/${encodeURIComponent(address)}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((json as any).error ?? res.statusText, res.status);
  return json as ProposalsResponse;
}

export async function approveProposal(address: string, proposalId: string) {
  return post<{ simulated: true; action: 'open' | 'close'; position: PaperPosition }>(
    `/api/proposals/${encodeURIComponent(address)}/approve`,
    { proposalId },
  );
}

export async function rejectProposal(address: string, proposalId: string) {
  return post<{ rejected: string }>(`/api/proposals/${encodeURIComponent(address)}/reject`, { proposalId });
}

// ---- swap contract (real, on-chain SUI <-> TestUSD) ------------------------

export interface SwapConfigSnapshot {
  configured: boolean;
  priceUsdMicros: number;
  priceUsd: number;
  suiReserveMist: number;
  suiReserveSui: number;
  lastUpdatedMs: number;
}

export async function fetchSwapConfig(): Promise<SwapConfigSnapshot> {
  const res = await fetch('/api/swap/config');
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((json as any).error ?? res.statusText, res.status);
  return json as SwapConfigSnapshot;
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
