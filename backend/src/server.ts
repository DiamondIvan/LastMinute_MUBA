import express from 'express';
import cors from 'cors';
import { getCachedForecast, setCachedForecast, getCachedNewsImpact, setCachedNewsImpact, getCachedCoinAnalysis, setCachedCoinAnalysis, getCachedDailyForecast, setCachedDailyForecast } from './db/newsCache.js';
import { config, chainConfigured } from './config.js';
import { generateIntelligenceReport } from './ai/synthesisAgent.js';
import { sha256Hex } from './util/hash.js';
import { uploadToWalrus, readFromWalrus } from './walrus/uploadReport.js';
import { encryptReportFor, decryptReport } from './seal/sealService.js';
import { registerReport } from './blockchain/registerReport.js';
import { hasResearchAccess } from './blockchain/access.js';
import { adminAddress } from './blockchain/suiClient.js';
import { scrapeStablecoinNews } from './scraper/stablecoinScraper.js';
import { fetchDailyFeeds, TRACKED_SYMBOLS } from './scraper/cryptoFeeds.js';
import { fetchSuiStablecoinMarket, getCachedStablecoinMarket } from './scraper/marketData.js';
import { getCachedStablecoinHistory } from './scraper/stablecoinHistory.js';
import { getTradeablePrices, getTradeableHistory, isTradeableSymbol } from './scraper/tradeableAssets.js';
import { getCachedSignals, signalForSymbol } from './ai/tradingSignals.js';
import { listPositions, openPosition, closePosition } from './db/paperTrades.js';
import { narrateDailyForecast, gonkaConfigured } from './ai/gonka.js';
import { analyzeStablecoinNews, analyzeNewsImpact, analyzeAssetPredictions, analyzeCoin } from './ai/openrouter.js';
import { issueNonce } from './auth/nonces.js';
import {
  buildSignInMessage,
  verifyWalletSignature,
  verifySessionToken,
} from './auth/verifySignature.js';
import type { IntelligenceReport } from './ai/types.js';

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '5mb' }));

/**
 * Decentralized report index.
 *
 * Keyed by content hash. Keeps only lightweight metadata in memory; the full
 * premium body lives on Walrus as an immutable, Seal-encrypted blob. This
 * replaces the old in-process Map<String, IntelligenceReport> (centralized
 * storage).
 *
 * In a full production deployment this metadata map would itself be replaced
 * by an on-chain registry (the Move `report_registry` already stores the
 * content_hash -> blob_id mapping).
 */
interface ReportIndexEntry {
  title: string;
  summary: string;
  analysis: IntelligenceReport['analysis'];
  sources: IntelligenceReport['sources'];
  generatedAt: string;
  /** Walrus blobId that holds the full (Seal-encrypted) report body. */
  blobId: string;
  /** SHA-256 of the plaintext — the on-chain content_hash. */
  contentHash: string;
  /**
   * Plaintext body, kept so unlock still works when Seal/Walrus is
   * unconfigured. Seal needs key servers (SEAL_KEY_SERVER_*) and a
   * `seal_approve*` entry in the Move package; without both, encryption throws
   * and the blob is never written. Serving from here keeps the paid flow
   * working meanwhile. See docs/SECURITY.md, Finding 4.
   */
  full: string;
}
const reportIndex = new Map<string, ReportIndexEntry>();

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    network: config.sui.network,
    aiConfigured: gonkaConfigured(),
    chainConfigured: chainConfigured(),
    walrusConfigured: true,
    admin: chainConfigured() ? safe(() => adminAddress()) : null,
  });
});

// Run the AI pipeline. Returns the FREE summary + the content hash.
// The full report is Seal-encrypted and stored on Walrus (see seal/).
app.post('/api/research', async (req, res) => {
  const question = String(req.body?.question ?? '').trim();
  if (!question) return res.status(400).json({ error: 'question is required' });

  // No 503 without a key: the pipeline degrades to demo data. `/health` shows
  // `aiConfigured` so the UI can badge it.
  let report;
  try {
    report = await generateIntelligenceReport(question);
  } catch (err) {
    const { status, error } = aiErrorResponse(err);
    console.error('/api/research failed:', err);
    return res.status(status).json({ error });
  }
  const contentHash = sha256Hex(report.full);

  // Encrypt then push the premium body to Walrus (decentralized, at-rest
  // encrypted). Falls back to serving only the free summary if Walrus is down.
  let blobId: string | undefined;
  try {
    const { encryptedObject } = await encryptReportFor(report.full, {
      ownerAddress: adminAddress(),
      id: contentHash,
    });
    blobId = (await uploadToWalrus(encryptedObject)).blobId;
  } catch (e) {
    console.error('Encrypt/Walrus upload failed for /api/research:', e);
  }

  reportIndex.set(contentHash, {
    title: report.title,
    summary: report.summary,
    analysis: report.analysis,
    sources: report.sources,
    generatedAt: report.generatedAt,
    blobId: blobId ?? '',
    contentHash,
    full: report.full,
  });

  res.json({
    title: report.title,
    summary: report.summary,
    analysis: report.analysis,
    sources: report.sources,
    contentHash,
    generatedAt: report.generatedAt,
    // The on-chain report the frontend should buy access to for this demo.
    reportObjectId: config.demoReportObjectId || null,
  });
});

/**
 * Premium body — gated on the caller owning a ResearchAccess for the demo report.
 *
 * The address is taken from a verified session token, NEVER from the request
 * body. Trusting a body-supplied address would let anyone who knows a buyer's
 * wallet (public on any explorer) read the report without paying.
 * See docs/SECURITY.md, Finding 1.
 */
app.post('/api/reports/:contentHash/unlock', async (req, res) => {
  const address = addressFromBearer(req);
  if (!address) {
    return res
      .status(401)
      .json({ error: 'sign in first: POST /api/auth/nonce then /api/auth/verify' });
  }

  const entry = reportIndex.get(req.params.contentHash);
  if (!entry) return res.status(404).json({ error: 'unknown report' });

  if (!config.demoReportObjectId) {
    return res.status(503).json({ error: 'DEMO_REPORT_OBJECT_ID not set' });
  }
  const allowed = await hasResearchAccess(address, config.demoReportObjectId);
  if (!allowed) {
    return res.status(403).json({ error: 'no ResearchAccess for this report' });
  }

  // Preferred path: fetch the encrypted blob from Walrus and decrypt via Seal.
  // Access is already gated by the on-chain check above; Seal adds encryption
  // at rest. It is skipped when Seal has no key servers configured.
  if (entry.blobId) {
    try {
      const encryptedObject = await readFromWalrus(entry.blobId);
      const { plaintext } = await decryptReport(encryptedObject, { buyerAddress: address });
      return res.json({ full: plaintext, source: 'walrus+seal' });
    } catch (e) {
      console.error('Walrus/Seal read failed, serving stored body instead:', e);
    }
  }

  if (!entry.full) {
    return res.status(503).json({ error: 'report body unavailable' });
  }
  res.json({ full: entry.full, source: 'server' });
});

// Admin: generate (or accept) a report, encrypt + store on Walrus, anchor on Sui.
app.post('/api/reports/register', async (req, res) => {
  if (!chainConfigured()) {
    return res
      .status(503)
      .json({ error: 'chain not configured (ADMIN_SECRET_KEY / PACKAGE_ID / CONFIG_ID / ADMIN_CAP_ID)' });
  }
  const question = String(req.body?.question ?? '').trim();
  if (!question) return res.status(400).json({ error: 'question is required' });

  let report;
  try {
    report = await generateIntelligenceReport(question);
  } catch (err) {
    const { status, error } = aiErrorResponse(err);
    console.error('/api/reports/register failed:', err);
    return res.status(status).json({ error });
  }
  const contentHash = sha256Hex(report.full);

  // Seal: encrypt the premium body under the admin identity. Only a holder of
  // the on-chain PremiumPass/ResearchAccess can decrypt (policy enforced on
  // chain). The encrypted blob (not plaintext) goes to Walrus.
  const { encryptedObject } = await encryptReportFor(report.full, {
    ownerAddress: adminAddress(),
    id: contentHash,
  });

  // Encrypted body -> Walrus blob (decentralized, immutable, encrypted-at-rest).
  const { blobId } = await uploadToWalrus(encryptedObject);

  // Anchor provenance on Sui: content_hash + walrus_blob_id.
  const { digest, reportObjectId } = await registerReport({
    title: report.title,
    contentHash,
    walrusBlobId: blobId,
  });

  reportIndex.set(contentHash, {
    title: report.title,
    summary: report.summary,
    analysis: report.analysis,
    sources: report.sources,
    generatedAt: report.generatedAt,
    blobId,
    contentHash,
    full: report.full,
  });

  res.json({ digest, reportObjectId, contentHash, blobId });
});

/**
 * Live per-coin price, peg deviation and Sui circulating supply, from
 * DefiLlama. Used by the frontend's stablecoin balances hook — DeepBook's
 * mainnet pools price SUI/WUSDT/DEEP against USDC, they have no way to price
 * USDC/USDsui/FDUSD/BUCK themselves (those coins already play the role of the
 * quote currency in those pools), so this is a different, correct source for
 * that question rather than a fix to the DeepBook lookup.
 */
app.get('/api/market/stablecoins', async (_req, res) => {
  try {
    const market = await getCachedStablecoinMarket();
    res.json({ market });
  } catch (error) {
    console.error('Stablecoin market error:', error);
    res.status(502).json({ error: error instanceof Error ? error.message : 'Failed to fetch market data' });
  }
});

/**
 * Real daily peg-price history (7D/30D/1Y) for the coins the frontend tracks
 * with a real wallet coin-type. See stablecoinHistory.ts for the source and
 * why there is no 24H timeframe (no free intraday data for these coins).
 */
app.get('/api/market/stablecoins/history', async (_req, res) => {
  try {
    const history = await getCachedStablecoinHistory();
    res.json({ history });
  } catch (error) {
    console.error('Stablecoin history error:', error);
    res.status(502).json({ error: error instanceof Error ? error.message : 'Failed to fetch history' });
  }
});

/**
 * Daily AI market signals (Gonka) for every tradeable asset. Cached 24h and
 * regenerated off the request path — never blocks a user action, since Gonka
 * latency ranges from ~2s to well over a minute. `?refresh=1` forces a rerun.
 */
app.get('/api/signals', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    res.json(await getCachedSignals(forceRefresh));
  } catch (error) {
    console.error('Signals error:', error);
    res.status(502).json({ error: error instanceof Error ? error.message : 'Failed to generate signals' });
  }
});

/** Current prices + 30d history for everything the paper ledger can hold. */
app.get('/api/market/tradeable', async (_req, res) => {
  try {
    const [prices, history] = await Promise.all([getTradeablePrices(), getTradeableHistory()]);
    res.json({ prices, history });
  } catch (error) {
    console.error('Tradeable assets error:', error);
    res.status(502).json({ error: error instanceof Error ? error.message : 'Failed to fetch prices' });
  }
});

/**
 * Paper-trading ledger. SIMULATED ONLY — nothing here touches a real balance
 * or the chain. Positions are valued against the same live price feed the rest
 * of the app uses, so the P&L is real even though the trade isn't.
 */
app.get('/api/paper/:address', async (req, res) => {
  try {
    const address = String(req.params.address ?? '');
    if (!address.startsWith('0x')) return res.status(400).json({ error: 'valid address required' });

    const [positions, prices] = await Promise.all([listPositions(address), getTradeablePrices()]);

    const open = positions.filter((p) => !p.closedAt);
    const closed = positions.filter((p) => p.closedAt);

    const openWithValue = open.map((p) => {
      const current = prices[p.symbol];
      const currentValueUsd = current === undefined ? null : p.units * current;
      return {
        ...p,
        currentPrice: current ?? null,
        currentValueUsd,
        unrealisedPnlUsd: currentValueUsd === null ? null : currentValueUsd - p.notionalUsd,
      };
    });

    const realisedPnlUsd = closed.reduce((sum, p) => sum + (p.realisedPnlUsd ?? 0), 0);
    const unrealisedPnlUsd = openWithValue.reduce((sum, p) => sum + (p.unrealisedPnlUsd ?? 0), 0);

    res.json({
      simulated: true,
      open: openWithValue,
      closed,
      summary: { realisedPnlUsd, unrealisedPnlUsd, openCount: open.length, closedCount: closed.length },
    });
  } catch (error) {
    console.error('Paper ledger error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load ledger' });
  }
});

app.post('/api/paper/:address/open', async (req, res) => {
  try {
    const address = String(req.params.address ?? '');
    if (!address.startsWith('0x')) return res.status(400).json({ error: 'valid address required' });

    const symbol = String(req.body?.symbol ?? '');
    const notionalUsd = Number(req.body?.notionalUsd);

    if (!isTradeableSymbol(symbol)) return res.status(400).json({ error: `not a tradeable symbol: ${symbol}` });
    if (!Number.isFinite(notionalUsd) || notionalUsd <= 0) {
      return res.status(400).json({ error: 'notionalUsd must be a positive number' });
    }

    // Refuse rather than invent an entry price — a position opened at a made-up
    // price produces P&L that means nothing.
    const prices = await getTradeablePrices();
    const entryPrice = prices[symbol];
    if (entryPrice === undefined) {
      return res.status(503).json({ error: `no live price available for ${symbol} right now` });
    }

    const position = await openPosition(address, {
      symbol,
      notionalUsd,
      entryPrice,
      signalAtEntry: await signalForSymbol(symbol),
    });
    res.json({ simulated: true, position });
  } catch (error) {
    console.error('Paper open error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to open position' });
  }
});

app.post('/api/paper/:address/close', async (req, res) => {
  try {
    const address = String(req.params.address ?? '');
    if (!address.startsWith('0x')) return res.status(400).json({ error: 'valid address required' });

    const positionId = String(req.body?.positionId ?? '');
    if (!positionId) return res.status(400).json({ error: 'positionId required' });

    const positions = await listPositions(address);
    const target = positions.find((p) => p.id === positionId);
    if (!target) return res.status(404).json({ error: 'position not found' });
    if (target.closedAt) return res.status(409).json({ error: 'position already closed' });

    const prices = await getTradeablePrices();
    const exitPrice = prices[target.symbol];
    if (exitPrice === undefined) {
      return res.status(503).json({ error: `no live price available for ${target.symbol} right now` });
    }

    const closed = await closePosition(address, positionId, exitPrice);
    if (!closed) return res.status(409).json({ error: 'could not close position' });
    res.json({ simulated: true, position: closed });
  } catch (error) {
    console.error('Paper close error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to close position' });
  }
});

app.get('/api/forecast/stablecoin-news', async (_req, res) => {
  try {
    const cached = await getCachedForecast();
    if (cached) {
      return res.json(cached);
    }

    // 1. Scrape news
    const news = await scrapeStablecoinNews();

    if (news.length === 0) {
       return res.status(500).json({ error: 'Failed to scrape any news data.' });
    }

    // 2. Analyze with AI (includes importantNewsIndices)
    const analysis = await analyzeStablecoinNews(news);

    // 3. Asset predictions (Mocking the list of assets for now, or we can just send the ones we care about)
    const assetsToPredict = [
      { symbol: 'USDsui' }, { symbol: 'USDC' }, { symbol: 'FDUSD' }, { symbol: 'BUCK' }, { symbol: 'USDY' }
    ];
    const assetPredictions = await analyzeAssetPredictions(assetsToPredict);

    // 4. Return combined response
    const finalData = {
      news,
      strategyPlan: analysis.strategyPlan,
      riskAnalysis: analysis.riskAnalysis,
      importantNewsIndices: analysis.importantNewsIndices,
      assetPredictions
    };

    await setCachedForecast(finalData);
    res.json(finalData);
  } catch (error) {
    console.error('Stablecoin news error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Analysis failed' });
  }
});

/**
 * Daily crypto "weather forecast".
 *
 * One scrape + one narration call per day (24h cache), regardless of how many
 * users or wishlists hit it. The cached snapshot always covers every tracked
 * coin; the `coins` query param filters the *response*, so changing a wishlist
 * never triggers a re-scrape.
 *
 *   GET /api/forecast/daily                     -> everything
 *   GET /api/forecast/daily?coins=USDC,BUCK     -> scoped to a wishlist
 *   GET /api/forecast/daily?refresh=1           -> force a fresh run
 */
app.get('/api/forecast/daily', async (req, res) => {
  try {
    const requested = String(req.query.coins ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // Only symbols we actually track, matched case-insensitively.
    const coins = requested
      .map((r) => TRACKED_SYMBOLS.find((s) => s.toLowerCase() === r.toLowerCase()))
      .filter((s): s is string => Boolean(s));

    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    let snapshot = forceRefresh ? null : await getCachedDailyForecast();

    if (!snapshot) {
      // Market data and headlines are independent; fetch concurrently.
      const [market, feeds] = await Promise.all([fetchSuiStablecoinMarket(), fetchDailyFeeds()]);

      // Narrate every tracked coin that has data, so any wishlist can be served
      // from this one snapshot without another AI call.
      const narrative = await narrateDailyForecast({
        market,
        news: feeds.items,
        coins: market.map((m) => m.symbol).filter((s) => TRACKED_SYMBOLS.includes(s)),
      });

      snapshot = {
        date: new Date().toISOString().slice(0, 10),
        generatedAt: new Date().toISOString(),
        market,
        news: feeds.items,
        sources: feeds.sources,
        usedFallbackNews: feeds.usedFallback,
        narrative,
      };
      await setCachedDailyForecast(snapshot);
    }

    // Scope to the wishlist, when one was supplied.
    const scoped =
      coins.length === 0
        ? snapshot
        : {
            ...snapshot,
            market: snapshot.market.filter((m: any) => coins.includes(m.symbol)),
            news: snapshot.news.filter(
              (n: any) => n.coins.length === 0 || n.coins.some((c: string) => coins.includes(c)),
            ),
            narrative: {
              ...snapshot.narrative,
              perCoin: (snapshot.narrative?.perCoin ?? []).filter((p: any) => coins.includes(p.symbol)),
            },
          };

    res.json({
      ...scoped,
      trackedSymbols: TRACKED_SYMBOLS,
      wishlist: coins,
      aiConfigured: gonkaConfigured(),
    });
  } catch (error) {
    console.error('Daily forecast error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Daily forecast failed' });
  }
});

app.post('/api/forecast/news-impact', async (req, res) => {
  try {
    const title = String(req.body?.title ?? '').trim();
    const coin = String(req.body?.coin ?? 'USDsui').trim();
    const walletBalanceSui = Number(req.body?.walletBalanceSui ?? 0);

    if (!title) return res.status(400).json({ error: 'title is required' });

    const cacheKey = `${title}-${coin}-${walletBalanceSui}`;
    const cached = await getCachedNewsImpact(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const impact = await analyzeNewsImpact(title, coin, walletBalanceSui);
    await setCachedNewsImpact(cacheKey, impact);
    res.json(impact);
  } catch (error) {
    console.error('News impact error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Impact analysis failed' });
  }
});

app.get('/api/forecast/coin/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol;
    const cached = await getCachedCoinAnalysis(symbol);
    if (cached) {
      return res.json(cached);
    }
    const analysis = await analyzeCoin(symbol);
    await setCachedCoinAnalysis(symbol, analysis);
    res.json(analysis);
  } catch (error) {
    console.error('Coin analysis error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Coin analysis failed' });
  }
});

app.post('/api/auth/nonce', (req, res) => {
  const address = String(req.body?.address ?? '').trim();
  if (!address.startsWith('0x')) return res.status(400).json({ error: 'valid address required' });
  const nonce = issueNonce(address);
  res.json({ nonce, message: buildSignInMessage(nonce) });
});

app.post('/api/auth/verify', async (req, res) => {
  const { address, nonce, signature } = req.body ?? {};
  if (!address || !nonce || !signature) {
    return res.status(400).json({ error: 'address, nonce, signature required' });
  }
  try {
    const { token } = await verifyWalletSignature({ address, nonce, signature });
    res.json({ token });
  } catch (err) {
    res.status(401).json({ error: err instanceof Error ? err.message : 'verification failed' });
  }
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err instanceof Error ? err.message : 'internal error' });
});

/**
 * Turns a Gonka failure into a status + message the UI can show, instead
 * of a bare 5xx (or a 502 from the Vite dev proxy) with the cause buried in the
 * server log.
 */
function aiErrorResponse(err: unknown): { status: number; error: string } {
  const status = (err as { status?: number })?.status;
  const message = err instanceof Error ? err.message : String(err);

  if (status === 401) return { status: 401, error: 'Gonka rejected the API key (401).' };
  if (status === 402 || /insufficient|credit|quota/i.test(message)) {
    return { status: 402, error: `Gonka: out of credits. ${message}` };
  }
  if (status === 404 || /model/i.test(message)) {
    return { status: 502, error: `Gonka did not accept the model. ${message}` };
  }
  if (status === 429) return { status: 429, error: `Gonka rate limit. ${message}` };
  return { status: 502, error: `AI pipeline failed: ${message}` };
}

/** The wallet address proven by the `Authorization: Bearer *** header, if any. */
function addressFromBearer(req: express.Request): string | null {
  const header = req.header('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? verifySessionToken(match[1]!) : null;
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

app.listen(config.port, () => {
  console.log(
    `MUBA backend on http://localhost:${config.port}  (network: ${config.sui.network}, chain configured: ${chainConfigured()})`,
  );
});