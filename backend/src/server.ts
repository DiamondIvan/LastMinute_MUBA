import express from 'express';
import cors from 'cors';
import { config, chainConfigured } from './config.js';
import { generateIntelligenceReport } from './ai/synthesisAgent.js';
import { aiConfigured } from './ai/claude.js';
import { sha256Hex } from './util/hash.js';
import { uploadToWalrus } from './walrus/uploadReport.js';
import { registerReport } from './blockchain/registerReport.js';
import { hasResearchAccess } from './blockchain/access.js';
import { adminAddress } from './blockchain/suiClient.js';
import { issueNonce } from './auth/nonces.js';
import { buildSignInMessage, verifyWalletSignature } from './auth/verifySignature.js';
import type { IntelligenceReport } from './ai/types.js';

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '1mb' }));

// Full report bodies, keyed by content hash. Swap for a DB later.
const reportsByHash = new Map<string, IntelligenceReport>();

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    network: config.sui.network,
    aiConfigured: aiConfigured(),
    chainConfigured: chainConfigured(),
    admin: chainConfigured() ? safe(() => adminAddress()) : null,
  });
});

// Run the AI pipeline. Returns the FREE summary + the content hash.
app.post('/api/research', async (req, res) => {
  if (!aiConfigured()) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not set' });
  const question = String(req.body?.question ?? '').trim();
  if (!question) return res.status(400).json({ error: 'question is required' });

  const report = await generateIntelligenceReport(question);
  const contentHash = sha256Hex(report.full);
  reportsByHash.set(contentHash, report);

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

// Premium body — gated on the caller owning a ResearchAccess for the demo report.
app.post('/api/reports/:contentHash/unlock', async (req, res) => {
  const report = reportsByHash.get(req.params.contentHash);
  if (!report) return res.status(404).json({ error: 'unknown report' });

  const address = String(req.body?.address ?? '').trim();
  if (!address.startsWith('0x')) return res.status(400).json({ error: 'address required' });

  if (!config.demoReportObjectId) {
    return res.status(503).json({ error: 'DEMO_REPORT_OBJECT_ID not set' });
  }
  const allowed = await hasResearchAccess(address, config.demoReportObjectId);
  if (!allowed) {
    return res.status(403).json({ error: 'no ResearchAccess for this report' });
  }
  res.json({ full: report.full });
});

// Admin: generate (or accept) a report, store on Walrus, anchor on Sui.
app.post('/api/reports/register', async (req, res) => {
  if (!aiConfigured()) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not set' });
  if (!chainConfigured()) {
    return res.status(503).json({ error: 'chain not configured (ADMIN_SECRET_KEY / PACKAGE_ID / CONFIG_ID / ADMIN_CAP_ID)' });
  }
  const question = String(req.body?.question ?? '').trim();
  if (!question) return res.status(400).json({ error: 'question is required' });

  const report = await generateIntelligenceReport(question);
  const contentHash = sha256Hex(report.full);
  reportsByHash.set(contentHash, report);

  const { blobId } = await uploadToWalrus(report.full);
  const { digest, reportObjectId } = await registerReport({
    title: report.title,
    contentHash,
    walrusBlobId: blobId,
  });

  res.json({ digest, reportObjectId, contentHash, blobId });
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

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

app.listen(config.port, () => {
  console.log(`MUBA backend on http://localhost:${config.port}  (network: ${config.sui.network}, chain configured: ${chainConfigured()})`);
});
