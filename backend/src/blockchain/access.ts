import { config } from '../config.js';
import { suiClient } from './suiClient.js';

const RESEARCH_ACCESS_TYPE = () =>
  `${config.contracts.packageId}::news_platform::ResearchAccess`;

/**
 * True if `address` owns an unexpired `ResearchAccess` for `reportObjectId`.
 * Read-only gRPC query — no signing, no gas.
 */
export async function hasResearchAccess(
  address: string,
  reportObjectId: string,
): Promise<boolean> {
  if (!config.contracts.packageId || !reportObjectId) return false;

  // `include: { json: true }` — `content` is raw BCS bytes, not parsed fields.
  const res = await suiClient.listOwnedObjects({
    owner: address,
    type: RESEARCH_ACCESS_TYPE(),
    limit: 50,
    include: { json: true },
  } as Parameters<typeof suiClient.listOwnedObjects>[0]);

  const now = Date.now();
  for (const obj of res.objects ?? []) {
    const fields = readFields(obj);
    const reportId = String(fields.report_id ?? '');
    const expiresAt = Number(fields.expires_at ?? 0);
    if (reportId === reportObjectId && (expiresAt === 0 || expiresAt > now)) {
      return true;
    }
  }
  return false;
}

function readFields(obj: unknown): Record<string, unknown> {
  return ((obj as { json?: Record<string, unknown> })?.json ?? {}) as Record<string, unknown>;
}
