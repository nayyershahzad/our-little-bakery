(() => {
  const WHATSAPP = '923320808986';
  document.getElementById('waLink').href = `https://wa.me/${WHATSAPP}`;

  const $ = s => document.querySelector(s);
  const rs = n => 'Rs ' + Number(n).toLocaleString('en-PK');
  let cfg = { menu: [], leadHours: 8, minOrder: 1500, deliveryFee: 200, hours: { open: 8, close: 20 } };
  const qty = {};

  // ---- menu ----
  fetch('/api/menu').then(r => r.json()).then(d => {
    cfg = d;
    const box = $('#menu'); box.innerHTML = '';
    for (const m of d.menu) {
      qty[m.sku] = 0;
      const row = document.createElement('div');
      row.className = 'item';
      row.innerHTML = `
        <img class="thumb" src="/img/${m.sku}.webp" alt="" width="72" height="72" loading="lazy">
        <div class="info"><div class="name">${m.name}</div>
             <div class="meta">${rs(m.price)} / ${m.unit}${m.min > 1 ? ` · min ${m.min}` : ''}</div></div>
        <div class="qty">
          <button type="button" data-sku="${m.sku}" data-d="-1" aria-label="less">−</button>
          <input type="number" min="0" max="500" value="0" data-sku="${m.sku}" inputmode="numeric">
          <button type="button" data-sku="${m.sku}" data-d="1" aria-label="more">+</button>
        </div>`;
      box.appendChild(row);
    }
    box.addEventListener('click', e => {
      const b = e.target.closest('button[data-sku]'); if (!b) return;
      const m = d.menu.find(x => x.sku === b.dataset.sku);
      const cur = qty[m.sku];
      let next = cur + Number(b.dataset.d) * (cur === 0 && b.dataset.d === '1' ? m.min : 1);
      if (next > 0 && next < m.min) next = b.dataset.d === '1' ? m.min : 0;
      qty[m.sku] = Math.max(0, Math.min(500, next));
      box.querySelector(`input[data-sku="${m.sku}"]`).value = qty[m.sku];
      totals();
    });
    box.addEventListener('input', e => {
      const i = e.target.closest('input[data-sku]'); if (!i) return;
      qty[i.dataset.sku] = Math.max(0, Math.min(500, parseInt(i.value, 10) || 0));
      totals();
    });
    setMinDate();
    $('#leadHint').textContent = `Earliest slot is ${d.leadHours} hours from now. Deliveries ${d.hours.open}:00–${d.hours.close}:00.`;
  }).catch(() => { $('#menu').innerHTML = '<p class="msg err" style="display:block">Menu failed to load — refresh the page.</p>'; });

  function totals() {
    const sub = cfg.menu.reduce((s, m) => s + m.price * (qty[m.sku] || 0), 0);
    const fee = sub === 0 ? 0 : (sub >= cfg.minOrder ? 0 : cfg.deliveryFee);
    $('#subtotal').textContent = rs(sub);
    $('#delivery').textContent = fee ? rs(fee) : (sub ? 'Free' : rs(0));
    $('#total').textContent = rs(sub + fee);
  }

  // ---- delivery time: earliest = now + lead hours, rounded up to 15 min, in local (PKT) time ----
  function setMinDate() {
    const t = new Date(Date.now() + cfg.leadHours * 3.6e6);
    t.setMinutes(Math.ceil(t.getMinutes() / 15) * 15, 0, 0);
    const pad = n => String(n).padStart(2, '0');
    const local = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`;
    const el = $('#delivery_at'); el.min = local; if (!el.value) el.value = local;
  }

  // ---- submit ----
  $('#orderForm').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#msg'); msg.className = 'msg'; msg.textContent = '';
    const items = Object.entries(qty).filter(([, q]) => q > 0).map(([sku, q]) => ({ sku, qty: q }));
    if (!items.length) return show('Add at least one item from the menu.', 'err');
    const f = new FormData(e.target);
    const body = Object.fromEntries(f.entries()); body.items = items;
    const btn = $('#submitBtn'); btn.disabled = true; btn.textContent = 'Placing order…';
    try {
      const r = await fetch('/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!d.ok) return show(d.error || 'Something went wrong', 'err');
      show(`Order ${d.id} received — total ${rs(d.total)}. We'll confirm on WhatsApp shortly. Save your order ID.`, 'ok');
      e.target.reset(); for (const k in qty) qty[k] = 0;
      document.querySelectorAll('#menu input[data-sku]').forEach(i => i.value = 0);
      totals(); setMinDate();
      $('#trackId').value = d.id;
    } catch { show('Network error — please try again.', 'err'); }
    finally { btn.disabled = false; btn.textContent = 'Place pre-order'; }
  });
  function show(t, cls) { const m = $('#msg'); m.textContent = t; m.className = 'msg ' + cls; m.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }

  // ---- track ----
  $('#trackBtn').addEventListener('click', async () => {
    const id = $('#trackId').value.trim().toUpperCase(), ph = $('#trackPhone').value.trim();
    const out = $('#trackOut'); out.textContent = 'Checking…';
    const r = await fetch(`/api/orders/${encodeURIComponent(id)}?phone=${encodeURIComponent(ph)}`);
    const d = await r.json();
    if (!d.ok) { out.textContent = 'No order found with that ID and phone.'; return; }
    const o = d.order;
    const when = new Date(o.delivery_at).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' });
    out.innerHTML = `<b>${o.id}</b> — status: <b>${o.status}</b><br>Delivery ${when} to ${o.org_name}<br>` +
      o.items.map(i => `${i.qty} × ${i.name}`).join(', ') + `<br>Total ${rs(o.total)}`;
  });
})();
