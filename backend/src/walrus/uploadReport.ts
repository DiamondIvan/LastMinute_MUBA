import { config } from '../config.js';

export interface WalrusUploadResult {
  blobId: string;
  raw: unknown;
}

/**
 * Uploads text to Walrus testnet via the HTTP publisher.
 * PUT {publisher}/v1/blobs?epochs=N  ->  { newlyCreated | alreadyCertified } with blobId.
 *
 * WARNING: Walrus blobs are PUBLIC. Only store report bodies here, never keys or
 * personal data.
 */
export async function uploadToWalrus(content: string): Promise<WalrusUploadResult> {
  const url = `${config.walrus.publisherUrl}/v1/blobs?epochs=${config.walrus.epochs}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain' },
    body: content,
  });

  if (!res.ok) {
    throw new Error(`Walrus upload failed: ${res.status} ${await res.text()}`);
  }

  const json: any = await res.json();
  const blobId: string | undefined =
    json?.newlyCreated?.blobObject?.blobId ?? json?.alreadyCertified?.blobId;

  if (!blobId) {
    throw new Error(`Walrus upload: could not read blobId from response ${JSON.stringify(json)}`);
  }
  return { blobId, raw: json };
}

/** Reads a blob back from the Walrus aggregator. */
export async function readFromWalrus(blobId: string): Promise<string> {
  const res = await fetch(`${config.walrus.aggregatorUrl}/v1/blobs/${blobId}`);
  if (!res.ok) throw new Error(`Walrus read failed: ${res.status}`);
  return res.text();
}
