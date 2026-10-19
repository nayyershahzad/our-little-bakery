export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

export const bad = (msg, status = 400) => json({ ok: false, error: msg }, status);

// Constant-time compare for the admin token (avoids timing leaks).
export async function tokenMatches(given, expected) {
  if (!given || !expected) return false;
  const enc = new TextEncoder();
  const a = await crypto.subtle.digest('SHA-256', enc.encode(given));
  const b = await crypto.subtle.digest('SHA-256', enc.encode(expected));
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export function requireAdmin(request, env) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return tokenMatches(token, env.ADMIN_TOKEN);
}

// Order id like OLB-251020-7F3K
export function orderId() {
  const d = new Date();
  const ymd = d.toISOString().slice(2, 10).replace(/-/g, '');
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const tail = [...bytes].map(b => alphabet[b % alphabet.length]).join('');
  return `OLB-${ymd}-${tail}`;
}

// Pakistani mobile: 03xx-xxxxxxx or +923xxxxxxxxx
export function normalizePhone(p) {
  const digits = String(p || '').replace(/\D/g, '');
  if (/^03\d{9}$/.test(digits)) return '+92' + digits.slice(1);
  if (/^923\d{9}$/.test(digits)) return '+' + digits;
  return null;
}

const KARACHI_OFFSET_MS = 5 * 60 * 60 * 1000; // PKT has no DST

// "2026-10-21T12:30" (local PKT, from the form) -> Date (UTC)
export function parseKarachiLocal(s) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s || '')) return null;
  const t = Date.parse(s + ':00Z');
  if (Number.isNaN(t)) return null;
  return new Date(t - KARACHI_OFFSET_MS);
}

export function karachiHour(date) {
  return new Date(date.getTime() + KARACHI_OFFSET_MS).getUTCHours();
}
