/**
 * Canonical JSON serialization ensuring consistent object key ordering across platforms.
 */
export function canonicalJSON(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map((item) => canonicalJSON(item)).join(',') + ']';
  }

  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const entries = keys.map(
    (key) => `${JSON.stringify(key)}:${canonicalJSON((obj as Record<string, unknown>)[key])}`
  );

  return '{' + entries.join(',') + '}';
}

/**
 * Computes SHA-256 hash using Web Crypto API if available, with a Node.js crypto fallback for tests.
 */
export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Node.js environment fallback for Vitest runs
  try {
    const nodeCrypto = await import('node:crypto');
    return nodeCrypto.createHash('sha256').update(buffer).digest('hex');
  } catch (err) {
    throw new Error('No cryptographic implementation available for sha256: ' + String(err));
  }
}
