import { useCallback, useEffect, useState } from 'react';
import { useCurrentAccount, useCurrentClient } from '@mysten/dapp-kit-react';
import { PACKAGE_ID, RESEARCH_ACCESS_TYPE, contractsConfigured } from '../contracts/constants';

export interface ResearchAccessObject {
  objectId: string;
  /** Move fields, present when the client returns object content. */
  reportId?: string;
  expiresAt?: string;
  raw: unknown;
}

/**
 * Lists the connected wallet's `ResearchAccess` objects.
 * Returns `[]` until a wallet is connected and the contract ids are filled in.
 *
 * NOTE: the exact `include` option and content shape on the gRPC client still
 * need confirming at runtime — adjust the parsing below once you see a response.
 */
export function useResearchAccess() {
  const account = useCurrentAccount();
  const client = useCurrentClient();
  const [objects, setObjects] = useState<ResearchAccessObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!account || !contractsConfigured()) {
      setObjects([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // `include: { json: true }` — the `content` field is raw BCS bytes, not
      // parsed fields. Field names can vary by transport, so read defensively.
      const res = await client.listOwnedObjects({
        owner: account.address,
        type: RESEARCH_ACCESS_TYPE,
        limit: 50,
        include: { json: true },
      } as Parameters<typeof client.listOwnedObjects>[0]);

      const parsed: ResearchAccessObject[] = (res.objects ?? []).map((o: any) => {
        const json = (o?.json ?? {}) as Record<string, unknown>;
        return {
          objectId: o.objectId,
          reportId: (json.report_id ?? json.reportId) as string | undefined,
          expiresAt: (json.expires_at ?? json.expiresAt) as string | undefined,
          raw: o,
        };
      });
      setObjects(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [account, client]);

  useEffect(() => {
    void load();
  }, [load]);

  return { objects, loading, error, reload: load, packageId: PACKAGE_ID };
}
