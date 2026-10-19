import { menuBySku, LEAD_HOURS, MIN_ORDER, DELIVERY_FEE, SERVICE_HOURS } from '../../_lib/menu.js';
import { json, bad, requireAdmin, orderId, normalizePhone, parseKarachiLocal, karachiHour } from '../../_lib/util.js';

const ORG_TYPES = new Set(['school', 'showroom', 'office', 'other']);
const clean = (s, max) => String(s ?? '').trim().slice(0, max);

// POST /api/orders — public: place a pre-order
export async function onRequestPost({ request, env }) {
  if ((request.headers.get('content-type') || '').indexOf('application/json') !== 0) return bad('Send JSON');
  let body;
  try { body = await request.json(); } catch { return bad('Invalid JSON'); }

  // Simple per-IP throttle: 10 orders / 10 min
  if (env.RATE) {
    const ip = request.headers.get('cf-connecting-ip') || 'x';
    const key = `rl:${ip}`;
    const n = Number(await env.RATE.get(key)) || 0;
    if (n >= 10) return bad('Too many orders from this network, try again later', 429);
    await env.RATE.put(key, String(n + 1), { expirationTtl: 600 });
  }

  const org_name = clean(body.org_name, 120);
  const org_type = clean(body.org_type, 20);
  const contact_name = clean(body.contact_name, 80);
  const address = clean(body.address, 300);
  const notes = clean(body.notes, 500);
  const phone = normalizePhone(body.phone);

  if (org_name.length < 2) return bad('Organisation name is required');
  if (!ORG_TYPES.has(org_type)) return bad('Pick an organisation type');
  if (contact_name.length < 2) return bad('Contact name is required');
  if (!phone) return bad('Enter a valid Pakistani mobile number (03xx-xxxxxxx)');
  if (address.length < 8) return bad('Delivery address is required');

  const deliveryAt = parseKarachiLocal(body.delivery_at);
  if (!deliveryAt) return bad('Pick a delivery date and time');
  const hoursAhead = (deliveryAt.getTime() - Date.now()) / 3.6e6;
  if (hoursAhead < LEAD_HOURS) return bad(`Orders need at least ${LEAD_HOURS} hours notice — please choose a later time`);
  if (hoursAhead > 24 * 14) return bad('Orders can be placed up to 14 days ahead');
  const h = karachiHour(deliveryAt);
  if (h < SERVICE_HOURS.open || h >= SERVICE_HOURS.close)
    return bad(`We deliver between ${SERVICE_HOURS.open}:00 and ${SERVICE_HOURS.close}:00`);

  const menu = menuBySku();
  const items = [];
  for (const it of Array.isArray(body.items) ? body.items : []) {
    const m = menu[it?.sku];
    const qty = Number.parseInt(it?.qty, 10);
    if (!m || !Number.isInteger(qty) || qty <= 0) continue;
    if (qty > 500) return bad(`Maximum 500 of ${m.name} per order — call us for larger events`);
    if (qty < m.min) return bad(`${m.name}: minimum ${m.min} ${m.unit}`);
    items.push({ sku: m.sku, name: m.name, unit_price: m.price, qty });
  }
  if (!items.length) return bad('Add at least one item');

  const subtotal = items.reduce((s, i) => s + i.unit_price * i.qty, 0);
  const delivery_fee = subtotal >= MIN_ORDER ? 0 : DELIVERY_FEE;
  const total = subtotal + delivery_fee;
  const id = orderId();

  const stmts = [
    env.DB.prepare(
      `INSERT INTO orders (id, org_name, org_type, contact_name, phone, address, delivery_at, notes, subtotal, delivery_fee, total)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
    ).bind(id, org_name, org_type, contact_name, phone, address, deliveryAt.toISOString(), notes || null, subtotal, delivery_fee, total),
    ...items.map(i =>
      env.DB.prepare(`INSERT INTO order_items (order_id, sku, name, unit_price, qty) VALUES (?1, ?2, ?3, ?4, ?5)`)
        .bind(id, i.sku, i.name, i.unit_price, i.qty)),
  ];
  await env.DB.batch(stmts);

  // Optional WhatsApp/SMS hook: set NOTIFY_WEBHOOK to any URL (e.g. a CallMeBot or n8n endpoint)
  if (env.NOTIFY_WEBHOOK) {
    const lines = items.map(i => `${i.qty} × ${i.name}`).join(', ');
    const msg = `New order ${id}: ${org_name} (${contact_name}, ${phone}) — ${lines}. Deliver ${body.delivery_at} to ${address}. Total Rs ${total}.`;
    try {
      await fetch(env.NOTIFY_WEBHOOK, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: msg }) });
    } catch { /* never fail the order because of a notification */ }
  }

  return json({ ok: true, id, subtotal, delivery_fee, total, items }, 201);
}

// GET /api/orders?status=new&day=2026-10-21 — admin only
export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return bad('Unauthorized', 401);
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const day = url.searchParams.get('day'); // YYYY-MM-DD (PKT)
  const where = [], binds = [];
  if (status && /^[a-z]+$/.test(status)) { where.push('status = ?'); binds.push(status); }
  if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
    // PKT day = UTC [day-1 19:00, day 19:00)
    const start = new Date(Date.parse(day + 'T00:00:00Z') - 5 * 3.6e6).toISOString();
    const end = new Date(Date.parse(day + 'T00:00:00Z') + 19 * 3.6e6).toISOString();
    where.push('delivery_at >= ? AND delivery_at < ?'); binds.push(start, end);
  }
  const sql = `SELECT * FROM orders ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY delivery_at ASC LIMIT 300`;
  const { results: orders } = await env.DB.prepare(sql).bind(...binds).all();
  if (!orders.length) return json({ ok: true, orders: [] });

  const ids = orders.map(o => o.id);
  const { results: items } = await env.DB
    .prepare(`SELECT order_id, sku, name, unit_price, qty FROM order_items WHERE order_id IN (${ids.map(() => '?').join(',')})`)
    .bind(...ids).all();
  const byOrder = {};
  for (const it of items) (byOrder[it.order_id] ||= []).push(it);
  for (const o of orders) o.items = byOrder[o.id] || [];
  return json({ ok: true, orders });
}
