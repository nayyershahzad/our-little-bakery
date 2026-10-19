(() => {
  const $ = s => document.querySelector(s);
  const rs = n => 'Rs ' + Number(n).toLocaleString('en-PK');
  const STATUSES = ['new', 'confirmed', 'preparing', 'delivered', 'cancelled'];
  // Token lives only in this tab's memory (sessionStorage), never in a cookie or the URL.
  try { $('#token').value = sessionStorage.getItem('olb_token') || ''; } catch {}
  const today = new Date(Date.now() + 5 * 3.6e6).toISOString().slice(0, 10);
  $('#day').value = today;

  const hdr = () => ({ authorization: 'Bearer ' + $('#token').value.trim() });
  let orders = [];

  async function load() {
    try { sessionStorage.setItem('olb_token', $('#token').value.trim()); } catch {}
    const q = new URLSearchParams();
    if ($('#day').value) q.set('day', $('#day').value);
    if ($('#status').value) q.set('status', $('#status').value);
    const r = await fetch('/api/orders?' + q, { headers: hdr() });
    if (r.status === 401) { $('#list').innerHTML = '<p class="msg err" style="display:block">Wrong token.</p>'; return; }
    orders = (await r.json()).orders || [];
    render();
  }

  function render() {
    const list = $('#list'); list.innerHTML = '';
    const bake = {};
    let revenue = 0;
    for (const o of orders) {
      if (o.status !== 'cancelled') { revenue += o.total; for (const i of o.items) bake[i.name] = (bake[i.name] || 0) + i.qty; }
      const when = new Date(o.delivery_at).toLocaleString('en-PK', { weekday: 'short', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
      const div = document.createElement('div'); div.className = 'order';
      div.innerHTML = `
        <div class="top"><span class="id">${o.id}</span><span class="pill ${o.status}">${o.status}</span></div>
        <div><b>${when}</b> — ${esc(o.org_name)} (${o.org_type})</div>
        <div>${esc(o.contact_name)} · <a href="https://wa.me/${o.phone.replace('+', '')}">${o.phone}</a></div>
        <div class="hint">${esc(o.address)}${o.notes ? ' · <i>' + esc(o.notes) + '</i>' : ''}</div>
        <ul>${o.items.map(i => `<li>${i.qty} × ${esc(i.name)} — ${rs(i.unit_price * i.qty)}</li>`).join('')}</ul>
        <div><b>${rs(o.total)}</b>${o.delivery_fee ? ' (incl. delivery ' + rs(o.delivery_fee) + ')' : ''}</div>
        <select data-id="${o.id}">${STATUSES.map(s => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select>`;
      list.appendChild(div);
    }
    const bakeLines = Object.entries(bake).map(([n, q]) => `${q} × ${n}`).join(' · ');
    $('#summary').innerHTML = orders.length
      ? `<b>${orders.length} orders · ${rs(revenue)}</b><br><b>Bake list:</b> ${bakeLines}`
      : 'No orders for this filter.';
  }

  $('#list').addEventListener('change', async e => {
    const s = e.target.closest('select[data-id]'); if (!s) return;
    const r = await fetch('/api/orders/' + s.dataset.id, { method: 'PATCH', headers: { ...hdr(), 'content-type': 'application/json' }, body: JSON.stringify({ status: s.value }) });
    if (!r.ok) alert('Update failed'); else load();
  });
  $('#load').addEventListener('click', load);
  $('#print').addEventListener('click', () => window.print());
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  if ($('#token').value) load();
})();
