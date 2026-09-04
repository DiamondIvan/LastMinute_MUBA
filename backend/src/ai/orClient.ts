import 'dotenv/config';

/**
 * Shared OpenRouter client for the research -> credibility -> analysis ->
 * synthesis pipeline (the buy/unlock flow). The stablecoin-forecast feature has
 * its own module, `openrouter.ts`; both talk to the same provider and key.
 *
 * OpenRouter is OpenAI-wire-compatible over plain `fetch`, so no SDK is needed.
 * When `OPENROUTER_API_KEY` is unset, callers fall back to canned data so the
 * demo still runs without a paid key.
 */

const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** Model for every agent in this pipeline. One place to swap. */
export const MODEL = 'anthropic/claude-3.5-sonnet';

export function aiConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export function assertAiConfigured(): void {
  if (!aiConfigured()) throw new Error('OPENROUTER_API_KEY is not set');
}

interface ChatOpts {
  system?: string;
  user: string;
  /** Ask OpenRouter to ground the answer with a live web search. */
  web?: boolean;
  /** Force a JSON object response. */
  json?: boolean;
}

export interface ChatResult {
  text: string;
  /** URL citations, when `web` was set and the model returned annotations. */
  citations: { title: string; url: string }[];
}

/** One OpenRouter chat call. Throws on a non-2xx response. */
export async function chat(opts: ChatOpts): Promise<ChatResult> {
  assertAiConfigured();

  const messages: { role: string; content: string }[] = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: opts.user });

  const body: Record<string, unknown> = { model: MODEL, messages };
  if (opts.json) body.response_format = { type: 'json_object' };
  if (opts.web) body.plugins = [{ id: 'web' }];

  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/DiamondIvan/LastMinute_MUBA',
      'X-Title': 'MUBA AI Intelligence Marketplace',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new OpenRouterError(res.status, detail || res.statusText);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string; annotations?: unknown[] } }[];
  };
  const msg = data.choices?.[0]?.message;
  const text = (msg?.content ?? '').trim();

  const citations: { title: string; url: string }[] = [];
  for (const ann of (msg?.annotations ?? []) as Array<Record<string, unknown>>) {
    const c = (ann.url_citation ?? ann) as Record<string, unknown>;
    if (typeof c.url === 'string') {
      citations.push({ title: typeof c.title === 'string' ? c.title : c.url, url: c.url });
    }
  }
  return { text, citations };
}

export class OpenRouterError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(`OpenRouter ${status}: ${message.slice(0, 300)}`);
  }
}

/** Parse a JSON object out of a model response, tolerating ``` fences. */
export function parseJson<T>(text: string): T {
  let s = text.trim();
  if (s.startsWith('```')) s = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  return JSON.parse(s) as T;
}
