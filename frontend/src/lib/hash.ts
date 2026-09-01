/**
 * SHA-256 of a string, lowercase hex — computed in the browser via Web Crypto.
 *
 * This must produce the same digest as the backend's `sha256Hex` (node:crypto
 * over UTF-8), so the user can verify a report without trusting our server.
 */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
