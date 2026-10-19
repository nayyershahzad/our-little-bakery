import { json, bad, requireAdmin } from '../../_lib/util.js';

const STATUSES = new Set(['new', 'confirmed', 'preparing', 'delivered', 'cancelled']);

// GET /api/orders/:id — public order lookup (id is the secret; needs matching phone last-4 too)
export async function onRequestGet({ request, env, params }) {
  const id = String(params.id || '').toUpperCase();
  if (!/^OLB-\d{6}-[A-Z2-9]{4}$/.test(id)) return bad('Not found', 404);
  const last4 = new URL(request.url).searchParams.get('phone') || '';
  const o = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
  if (!o) return bad('Not found', 404);
  const isAdmin = await requireAdmin(request, env);
  if (!isAdmin && !(/^\d{4}$/.test(last4) && o.phone.endsWith(last4))) return bad('Not found', 404);
  const { results: items } = await env.DB.prepare('SELECT sku, name, unit_price, qty FROM order_items WHERE order_id = ?').bind(id).all();
  return json({ ok: true, order: { ...o, items } });
}

// PATCH /api/orders/:id {status} — admin only
export async function onRequestPatch({ request, env, params }) {
  if (!(await requireAdmin(request, env))) return bad('Unauthorized', 401);
  let body; try { body = await request.json(); } catch { return bad('Invalid JSON'); }
  const status = String(body.status || '');
  if (!STATUSES.has(status)) return bad('Bad status');
  const r = await env.DB.prepare('UPDATE orders SET status = ? WHERE id = ?').bind(status, String(params.id)).run();
  if (!r.meta.changes) return bad('Not found', 404);
  return json({ ok: true, id: params.id, status });
}
