// Customer payments through the business owner's OWN Stripe account (deposits, payment requests, service
// purchases). Each site keeps its own Stripe secret key, stored encrypted in the database and never shown
// again after saving. No SDK and no webhook: payments are confirmed by asking Stripe about the Checkout
// Session (when the customer comes back, and again in a background sweep), so it works even when SiteGen
// runs on a laptop that Stripe cannot reach.
const crypto = require('crypto');

const apiBase = () => (process.env.STRIPE_API_BASE || 'https://api.stripe.com').replace(/\/$/, '');
const CURRENCIES = { usd: '$', cad: 'CA$', eur: '€', gbp: '£', aud: 'A$' };
const KEY_RE = /^(sk|rk)_(live|test)_[A-Za-z0-9]{16,}$/;
const MAX_CENTS = 99999999; // $999,999.99

// ---- key storage: AES-256-GCM with a key derived from SESSION_SECRET ----
function secretKey() {
  return crypto.createHash('sha256').update('sitegen-stripe-key|' + (process.env.SESSION_SECRET || 'dev-only-secret')).digest();
}
function encryptKey(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
  const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map(b => b.toString('base64')).join('.');
}
function decryptKey(stored) {
  try {
    const [iv, tag, enc] = String(stored || '').split('.').map(x => Buffer.from(x, 'base64'));
    const d = crypto.createDecipheriv('aes-256-gcm', secretKey(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
  } catch { return ''; }
}
const validKey = (k) => KEY_RE.test(String(k || '').trim());
const keyHint = (k) => `${String(k).startsWith('rk_') ? 'restricted' : 'secret'} key ${String(k).includes('_test_') ? '(test mode) ' : ''}ending ${String(k).slice(-4)}`;

// ---- money ----
// "89", "89.5", "$1,200.00" -> cents; 0 when not a usable positive amount
function toCents(v) {
  const s = String(v == null ? '' : v).replace(/[$,\s]/g, '');
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return 0;
  const c = Math.round(parseFloat(s) * 100);
  return c > 0 && c <= MAX_CENTS ? c : 0;
}
function money(cents, currency = 'usd') {
  const sym = CURRENCIES[currency] || '$';
  return sym + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
// deposit for a booking: fixed amount or percent of the service price (when a price is known)
function depositCents(cfg, priceCents) {
  if (!cfg || !cfg.enabled) return 0;
  if (cfg.depositMode === 'fixed') return toCents(cfg.depositAmount);
  if (cfg.depositMode === 'percent') {
    const pct = Math.min(100, Math.max(0, Number(cfg.depositAmount) || 0));
    return priceCents && pct ? Math.max(50, Math.round(priceCents * pct / 100)) : 0;
  }
  return 0;
}
const normalize = (p) => {
  p = p && typeof p === 'object' ? p : {};
  return {
    enabled: !!p.enabled,
    currency: CURRENCIES[p.currency] ? p.currency : 'usd',
    depositMode: ['fixed', 'percent'].includes(p.depositMode) ? p.depositMode : '',
    depositAmount: String(p.depositAmount == null ? '' : p.depositAmount).replace(/[^0-9.]/g, '').slice(0, 10),
    buyLabel: String(p.buyLabel || '').slice(0, 30)
  };
};

// ---- Stripe calls (form-encoded, bracket notation) ----
function encode(params, prefix = '', out = []) {
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null || v === '') continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === 'object' ? encode(item, `${key}[${i}]`, out) : out.push([`${key}[${i}]`, item])));
    else if (typeof v === 'object') encode(v, key, out);
    else out.push([key, v]);
  }
  return out;
}
async function stripe(key, method, pathname, params) {
  const qs = new URLSearchParams(encode(params)).toString();
  const res = await fetch(apiBase() + pathname + (method === 'GET' && qs ? '?' + qs : ''), {
    method,
    headers: { Authorization: `Bearer ${key}`, ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: method === 'POST' ? qs : undefined
  });
  let data = {};
  try { data = await res.json(); } catch { /* not json */ }
  if (!res.ok) {
    const msg = (data.error && data.error.message) || `Stripe error ${res.status}`;
    throw new Error(res.status === 401 ? 'Stripe did not accept this site\'s key. Paste a fresh key in the site\'s payment settings.' : msg);
  }
  return data;
}

function createCheckout(key, { amountCents, currency, description, customerEmail, successUrl, cancelUrl, paymentId, siteName }) {
  return stripe(key, 'POST', '/v1/checkout/sessions', {
    mode: 'payment',
    line_items: [{ quantity: 1, price_data: { currency, unit_amount: amountCents, product_data: { name: String(description || 'Payment').slice(0, 120) } } }],
    customer_email: customerEmail || undefined,
    success_url: successUrl, cancel_url: cancelUrl,
    client_reference_id: String(paymentId),
    metadata: { payment_id: String(paymentId), site: String(siteName || '').slice(0, 80) },
    payment_intent_data: { description: `${siteName || 'Order'}: ${String(description || '').slice(0, 100)}` }
  });
}
const getSession = (key, id) => stripe(key, 'GET', `/v1/checkout/sessions/${encodeURIComponent(id)}`);
const isPaid = (s) => !!s && s.payment_status === 'paid';
const isExpired = (s) => !!s && s.status === 'expired';

module.exports = { CURRENCIES, validKey, encryptKey, decryptKey, keyHint, toCents, money, depositCents, normalize, createCheckout, getSession, isPaid, isExpired, MAX_CENTS };
