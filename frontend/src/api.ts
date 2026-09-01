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

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `${res.status} ${res.statusText}`);
  return json as T;
}

export function research(question: string) {
  return post<ResearchResponse>('/api/research', { question });
}

export function unlockReport(contentHash: string, address: string) {
  return post<{ full: string }>(`/api/reports/${contentHash}/unlock`, { address });
}
