/**
 * Shareable explorer state in the URL hash:
 *
 * - `#sample=<id>` opens a built-in sample;
 * - `#messages=<data>` opens a custom message list, deflated and base64url
 *   encoded so a whole conversation fits in a link.
 */

export type HashState =
  | { kind: 'sample'; id: string }
  | { kind: 'messages'; data: string }
  | { kind: 'none' };

export function readHash(hash: string = window.location.hash): HashState {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const id = params.get('sample');
  if (id) return { kind: 'sample', id };
  const data = params.get('messages');
  if (data) return { kind: 'messages', data };
  return { kind: 'none' };
}

/** Replaces the hash without adding a history entry or firing hashchange. */
export function writeHash(hash: string): void {
  const url = new URL(window.location.href);
  url.hash = hash;
  window.history.replaceState(window.history.state, '', url);
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeMessages(json: string): Promise<string> {
  const compact = JSON.stringify(JSON.parse(json));
  const bytes = new TextEncoder().encode(compact);
  return toBase64Url(await pipe(bytes, new CompressionStream('deflate-raw')));
}

export async function decodeMessages(data: string): Promise<unknown> {
  const bytes = await pipe(
    fromBase64Url(data),
    new DecompressionStream('deflate-raw'),
  );
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}
