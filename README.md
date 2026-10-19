# Our Little Bakery — pre-order site on Cloudflare

Pre-orders from schools, motor showrooms and offices (minimum 8 hours' notice), a kitchen
pick-list at `/admin.html`, and an optional WhatsApp/SMS hook. Cloudflare Pages + Functions,
D1 (orders) and KV (rate limit). Zero cost on the free tier at this volume.

```
public/            static site  (index.html = order page, admin.html = kitchen)
functions/api/     Pages Functions (the API)
functions/_lib/    menu + prices (server-side source of truth), helpers
migrations/        D1 schema
wrangler.example.toml  bindings reference (dashboard setup below needs no wrangler)
```

## Deploy (one-time, ~10 minutes)

Account: the Cloudflare account registered under nayyeranwar73@gmail.com.

```bash
npm i -g wrangler
wrangler login                                   # opens browser, log in with that account

# 1. clone/copy this folder, then from inside it:
wrangler d1 create our-little-bakery             # paste database_id into wrangler.toml
wrangler kv namespace create RATE                # paste id into wrangler.toml

# 2. schema
wrangler d1 execute our-little-bakery --remote --file=migrations/0001_init.sql

# 3. create the Pages project and deploy
wrangler pages project create our-little-bakery --production-branch main
wrangler pages deploy public --project-name our-little-bakery

# 4. secrets (never commit these)
openssl rand -base64 32 | wrangler pages secret put ADMIN_TOKEN --project-name our-little-bakery
# optional: a URL that posts {text} to WhatsApp/SMS (n8n, Make, CallMeBot, Twilio function)
wrangler pages secret put NOTIFY_WEBHOOK --project-name our-little-bakery
```

Then in the Cloudflare dashboard → Pages → our-little-bakery → Settings → Bindings, confirm `DB` and
`RATE` are attached (wrangler.toml does this on deploy; check once). Add a custom domain under
Custom domains when you buy one, e.g. `order.ourlittlebakery.pk`.

Edit `WHATSAPP` at the top of `public/app.js` with the bakery number before deploying.

## Changing the menu or prices

Edit `functions/_lib/menu.js` and redeploy. Prices are only ever read on the server, so a
customer cannot change what they pay from the browser. `LEAD_HOURS`, `MIN_ORDER`,
`DELIVERY_FEE` and delivery hours live in the same file.

## Daily flow

1. Open `https://<site>/admin.html` on the phone, paste the admin token once per session.
2. Pick tomorrow's date → **Load**. The top line is the bake list (totals per item) for the day.
3. Change each order's status: new → confirmed (after the WhatsApp call) → preparing → delivered.
4. **Print bake list** gives a one-page sheet for the kitchen.

Customers can check their own order at the bottom of the home page using the order ID and
the last 4 digits of their phone.

## Security notes

- No secrets in the repo or in the browser: the admin token is a Pages secret and is compared
  server-side in constant time; it lives only in the admin tab's sessionStorage.
- Strict CSP, HSTS, no-frame headers on every response (`functions/_middleware.js`).
- All order fields are validated and length-capped on the server; prices and totals are
  recomputed server-side; 10 orders / 10 min per IP via KV.
- Order lookup requires order ID + phone last-4, so IDs alone leak nothing.
- Run `npx wrangler --version` monthly and redeploy; Pages Functions have no third-party
  dependencies, so there is nothing else to patch.

## Local test

```bash
wrangler pages dev public --d1 DB=our-little-bakery --kv RATE --binding ADMIN_TOKEN=test
# then: wrangler d1 execute our-little-bakery --local --file=migrations/0001_init.sql
```

