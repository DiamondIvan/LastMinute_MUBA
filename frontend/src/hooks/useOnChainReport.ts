import { useCallback, useEffect, useState } from 'react';
import { useCurrentClient } from '@mysten/dapp-kit-react';

export interface OnChainReport {
  objectId: string;
  title: string;
  contentHash: string;
  walrusBlobId: string;
  creator: string;
  createdAt: number;
}

/**
 * Reads a `ResearchReport` object straight from Sui. Read-only — no wallet, no gas.
 *
 * Uses `include: { json: true }`: the `content` field is raw BCS bytes, not
 * parsed fields. The SDK warns that `json` field names can vary between
 * transports, so the reads below are defensive (snake_case and camelCase).
 */
export function useOnChainReport(reportObjectId: string | null) {
  const client = useCurrentClient();
  const [report, setReport] = useState<OnChainReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!reportObjectId) {
      setReport(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await client.getObject({
        objectId: reportObjectId,
        include: { json: true },
      } as Parameters<typeof client.getObject>[0]);

      const json = ((res.object as { json?: Record<string, unknown> } | undefined)?.json ??
        {}) as Record<string, unknown>;

      setReport({
        objectId: reportObjectId,
        title: str(json.title),
        contentHash: str(json.content_hash ?? json.contentHash),
        walrusBlobId: str(json.walrus_blob_id ?? json.walrusBlobId),
        creator: str(json.creator),
        createdAt: Number(json.created_at ?? json.createdAt ?? 0),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [client, reportObjectId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { report, loading, error, reload: load };
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}
