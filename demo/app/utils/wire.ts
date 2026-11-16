/** Helpers for describing and pretty-printing A2UI wire messages. */

const KINDS = [
  'createSurface',
  'updateComponents',
  'updateDataModel',
  'deleteSurface',
  'callFunction',
  'action',
  'error',
] as const;

export type MessageKind = (typeof KINDS)[number] | 'unknown';

export interface MessageSummary {
  kind: MessageKind;
  surfaceId: string;
  /** Short human hint, e.g. "12 components" or "/status". */
  detail: string;
}

const encoder = new TextEncoder();

export function byteSize(value: unknown): number {
  return encoder.encode(JSON.stringify(value)).length;
}

export function formatBytes(n: number): string {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} kB`;
}

export function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Works out what an agent-to-client message does. */
export function summarize(message: unknown): MessageSummary {
  const msg = record(message) ?? {};
  for (const kind of KINDS) {
    const body = record(msg[kind]);
    if (!body) continue;
    const surfaceId =
      typeof body['surfaceId'] === 'string' ? body['surfaceId'] : '';
    let detail = '';
    if (kind === 'updateComponents' && Array.isArray(body['components'])) {
      const n = body['components'].length;
      detail = `${n} component${n === 1 ? '' : 's'}`;
    } else if (kind === 'updateDataModel') {
      detail = typeof body['path'] === 'string' ? body['path'] : '/';
    } else if (kind === 'action' && typeof body['name'] === 'string') {
      detail = body['name'];
    }
    return { kind, surfaceId, detail };
  }
  return { kind: 'unknown', surfaceId: '', detail: '' };
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const TOKEN =
  /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

/**
 * Syntax-highlights a JSON string as HTML. Every piece of the input is
 * escaped, so the result is safe to insert as markup.
 */
export function highlightJson(json: string): string {
  let out = '';
  let last = 0;
  for (const m of json.matchAll(TOKEN)) {
    out += escapeHtml(json.slice(last, m.index));
    const [whole, str, colon, literal, num] = m;
    if (str !== undefined) {
      const cls = colon ? 'j-key' : 'j-str';
      out += `<span class="${cls}">${escapeHtml(str)}</span>${colon ? escapeHtml(colon) : ''}`;
    } else if (literal !== undefined) {
      out += `<span class="j-lit">${literal}</span>`;
    } else if (num !== undefined) {
      out += `<span class="j-num">${num}</span>`;
    } else {
      out += escapeHtml(whole);
    }
    last = (m.index ?? 0) + whole.length;
  }
  return out + escapeHtml(json.slice(last));
}
