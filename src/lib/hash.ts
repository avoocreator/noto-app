const toHex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function hashBytes(data: Uint8Array): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', data as BufferSource));
}

export async function hashText(s: string): Promise<string> {
  return hashBytes(new TextEncoder().encode(s));
}

export function randomId(bytes = 8): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}
