import { MENU, LEAD_HOURS, MIN_ORDER, DELIVERY_FEE, SERVICE_HOURS } from '../_lib/menu.js';
import { json } from '../_lib/util.js';

export const onRequestGet = () =>
  json({ ok: true, menu: MENU, leadHours: LEAD_HOURS, minOrder: MIN_ORDER, deliveryFee: DELIVERY_FEE, hours: SERVICE_HOURS },
       200, { 'cache-control': 'public, max-age=300' });
