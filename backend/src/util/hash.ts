import { createHash } from 'node:crypto';

/** SHA-256 of a string, lowercase hex. This is what goes on-chain as content_hash. */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}
