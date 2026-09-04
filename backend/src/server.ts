import express from 'express';
import cors from 'cors';
import { getCachedForecast, setCachedForecast, getCachedNewsImpact, setCachedNewsImpact, getCachedCoinAnalysis, setCachedCoinAnalysis } from './db/newsCache.js';
import { config, chainConfigured } from './config.js';
import { generateIntelligenceReport } from './ai/synthesisAgent.js';
import { aiConfigured } from './ai/claude.js';
import { sha256Hex } from './util/hash.js';
import { uploadToWalrus, readFromWalrus } from './walrus/uploadReport.js';
import { encryptReportFor, decryptReport } from './seal/sealService.js';
import { registerReport } from './blockchain/registerReport.js';
import { hasResearchAccess } from './blockchain/access.js';
import { adminAddress } from './blockchain/suiClient.js';
import { scrapeStablecoinNews } from './scraper/stablecoinScraper.js';
import { analyzeStablecoinNews, analyzeNewsImpact, analyzeAssetPredictions, analyzeCoin } from './ai/openrouter.js';
// import { openRouterConfigured } from './ai/openrouter.js';
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
}
const reportIndex = new Map<string, ReportIndexEntry>();

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    network: config.sui.network,
    aiConfigured: aiConfigured(),
    chainConfigured: chainConfigured(),
    walrusConfigured: true,
    admin: chainConfigured() ? safe(() => adminAddress()) : null,
  });
});

// Run the AI pipeline. Returns the FREE summary + the content hash.
// The full report is Seal-encrypted and stored on Walrus (see seal/).
app.post('/api/research', async (req, res) => {
  if (!aiConfigured()) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not set' });
  const question = String(req.body?.question ?? '').trim();
  if (!question) return res.status(400).json({ error: 'question is required' });

  const report = await generateIntelligenceReport(question);
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

  if (!entry.blobId) {
    return res.status(503).json({ error: 'blob not stored on Walrus yet' });
  }

  // Fetch the encrypted blob from Walrus, then decrypt via Seal. Decryption is
  // gated on the caller holding the on-chain access object (checked above).
  const encryptedObject = await readFromWalrus(entry.blobId);
  const { plaintext } = await decryptReport(encryptedObject, {
    buyerAddress: address,
  });
  res.json({ full: plaintext });
});

// Admin: generate (or accept) a report, encrypt + store on Walrus, anchor on Sui.
app.post('/api/reports/register', async (req, res) => {
  if (!aiConfigured()) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not set' });
  if (!chainConfigured()) {
    return res
      .status(503)
      .json({ error: 'chain not configured (ADMIN_SECRET_KEY / PACKAGE_ID / CONFIG_ID / ADMIN_CAP_ID)' });
  }
  const question = String(req.body?.question ?? '').trim();
  if (!question) return res.status(400).json({ error: 'question is required' });

  const report = await generateIntelligenceReport(question);
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
  });

  res.json({ digest, reportObjectId, contentHash, blobId });
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