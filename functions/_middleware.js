// Security headers on every response; no secrets ever reach the browser.
export async function onRequest({ request, next }) {
  const res = await next();
  const h = new Headers(res.headers);
  h.set('x-content-type-options', 'nosniff');
  h.set('x-frame-options', 'DENY');
  h.set('referrer-policy', 'strict-origin-when-cross-origin');
  h.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  h.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  h.set('content-security-policy',
    "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; script-src 'self'; connect-src 'self'; frame-ancestors 'none'");
  return new Response(res.body, { status: res.status, headers: h });
}
