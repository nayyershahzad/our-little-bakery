-- Our Little Bakery — D1 schema
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'new',         -- new | confirmed | preparing | delivered | cancelled
  org_name TEXT NOT NULL,                      -- school / showroom / office
  org_type TEXT NOT NULL,                      -- school | showroom | office | other
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  delivery_at TEXT NOT NULL,                   -- ISO datetime, Asia/Karachi
  notes TEXT,
  subtotal INTEGER NOT NULL,                   -- PKR
  delivery_fee INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  unit_price INTEGER NOT NULL,
  qty INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_delivery ON orders(delivery_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
