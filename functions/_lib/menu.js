// Single source of truth for prices — the browser never sets a price.
// Prices from the Oct-2026 feasibility plan (PKR).
export const MENU = [
  { sku: 'pizza-bites-6',  name: 'Pizza Bites (pack of 6)',       price: 550,  min: 1,  unit: 'pack' },
  { sku: 'pizza-large',    name: 'Large Chicken Pizza 12"',       price: 1200, min: 1,  unit: 'pizza' },
  { sku: 'muffin-choc',    name: 'Chocolate Muffin',              price: 120,  min: 6,  unit: 'pc' },
  { sku: 'patty-chicken',  name: 'Chicken Patty',                 price: 220,  min: 6,  unit: 'pc' },
  { sku: 'naan-khatai-kg', name: 'Naan Khatai (1 kg box)',        price: 1200, min: 1,  unit: 'kg' },
  { sku: 'cookies-6',      name: 'Choc-Chip Cookies (pack of 6)', price: 250,  min: 1,  unit: 'pack' },
  { sku: 'cake-choc',      name: 'Chocolate Cake 1.2 kg',         price: 3000, min: 1,  unit: 'cake' },
];

export const LEAD_HOURS = 8;          // minimum notice
export const MIN_ORDER = 1500;        // PKR — free delivery above this
export const DELIVERY_FEE = 200;      // PKR below MIN_ORDER
export const SERVICE_HOURS = { open: 8, close: 20 }; // delivery window, Asia/Karachi

export function menuBySku() {
  return Object.fromEntries(MENU.map(m => [m.sku, m]));
}
