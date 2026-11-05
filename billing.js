// Stripe billing for hosting subscriptions. No SDK: the few calls we need are
// plain HTTPS requests, and webhooks are verified with an HMAC.
const crypto = require('crypto');

const GRACE_DAYS = 7; // a failed payment keeps the site live this long

const apiBase = () => (process.env.STRIPE_API_BASE || 'https://api.stripe.com').replace(/\/$/, '');
const isConfigured = () => !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
const webhookReady = () => !!process.env.STRIPE_WEBHOOK_SECRET;

// Stripe wants form-encoded bodies with bracket notation for nesting.
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

async function stripe(pathname, params) {
  const body = new URLSearchParams(encode(params)).toString();
  const res = await fetch(apiBase() + pathname, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* non-JSON error */ }
  if (!res.ok) throw new Error((data.error && data.error.message) || `Stripe error ${res.status}`);
  return data;
}

function createCheckout({ siteId, siteName, email, successUrl, cancelUrl }) {
  return stripe('/v1/checkout/sessions', {
    mode: 'subscription',
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    client_reference_id: String(siteId),
    customer_email: email || undefined,
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: { metadata: { site_id: String(siteId), site_name: siteName } },
    metadata: { site_id: String(siteId) }
  });
}

function createPortal({ customer, returnUrl }) {
  return stripe('/v1/billing_portal/sessions', { customer, return_url: returnUrl });
}

// Stripe-Signature: t=<unix>,v1=<hex hmac of "t.rawBody">[,v1=...]
function verifyWebhook(rawBody, header, secret, now = Date.now()) {
  if (!secret || !header) return false;
  const parts = String(header).split(',').map(p => p.trim().split('='));
  const t = (parts.find(p => p[0] === 't') || [])[1];
  const sigs = parts.filter(p => p[0] === 'v1').map(p => p[1]);
  if (!t || !sigs.length) return false;
  if (Math.abs(now / 1000 - Number(t)) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return sigs.some(s => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

function signForTest(rawBody, secret, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=${crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex')}`;
}

// Is this site blocked because its subscription lapsed? Only applies to sites
// the owner has marked as requiring a subscription.
function isSuspended(row, now = Date.now()) {
  if (!row || !row.billing_required) return false;
  const s = row.billing_status || 'none';
  if (s === 'active' || s === 'trialing') return false;
  if (s === 'past_due' && row.past_due_since) {
    const since = Date.parse(row.past_due_since.replace(' ', 'T') + 'Z');
    if (!Number.isNaN(since) && now - since < GRACE_DAYS * 86400000) return false;
  }
  return true;
}

// Applies one Stripe event to the database. Returns true if it touched a site.
function applyEvent(db, event) {
  const obj = event && event.data && event.data.object;
  if (!obj) return false;
  const setStatus = (siteId, status, extra = {}) => {
    const cur = db.prepare('SELECT billing_status, past_due_since FROM sites WHERE id = ?').get(siteId);
    if (!cur) return false;
    let pastDue = cur.past_due_since || null;
    if (status === 'past_due') pastDue = pastDue || new Date().toISOString().slice(0, 19).replace('T', ' ');
    else pastDue = null;
    db.prepare('UPDATE sites SET billing_status = ?, past_due_since = ?, stripe_customer_id = COALESCE(?, stripe_customer_id), stripe_subscription_id = COALESCE(?, stripe_subscription_id) WHERE id = ?')
      .run(status, pastDue, extra.customer || null, extra.subscription || null, siteId);
    return true;
  };
  const bySub = (sub) => sub ? db.prepare('SELECT id FROM sites WHERE stripe_subscription_id = ?').get(sub) : null;
  const byCustomer = (c) => c ? db.prepare('SELECT id FROM sites WHERE stripe_customer_id = ?').get(c) : null;

  switch (event.type) {
    case 'checkout.session.completed': {
      if (obj.mode !== 'subscription') return false;
      const id = parseInt(obj.client_reference_id || (obj.metadata && obj.metadata.site_id), 10);
      if (!id) return false;
      const paid = obj.payment_status === 'paid' || obj.payment_status === 'no_payment_required';
      return setStatus(id, paid ? 'active' : 'incomplete', { customer: obj.customer, subscription: obj.subscription });
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const row = bySub(obj.id) || (obj.metadata && obj.metadata.site_id ? { id: parseInt(obj.metadata.site_id, 10) } : null) || byCustomer(obj.customer);
      if (!row) return false;
      const status = ['active', 'trialing', 'past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused'].includes(obj.status) ? obj.status : 'incomplete';
      return setStatus(row.id, status, { customer: obj.customer, subscription: obj.id });
    }
    case 'customer.subscription.deleted': {
      const row = bySub(obj.id);
      return row ? setStatus(row.id, 'canceled') : false;
    }
    case 'invoice.payment_failed': {
      const row = bySub(obj.subscription) || byCustomer(obj.customer);
      return row ? setStatus(row.id, 'past_due') : false;
    }
    case 'invoice.paid': {
      const row = bySub(obj.subscription) || byCustomer(obj.customer);
      return row ? setStatus(row.id, 'active') : false;
    }
    default: return false;
  }
}

module.exports = { GRACE_DAYS, isConfigured, webhookReady, createCheckout, createPortal, verifyWebhook, signForTest, isSuspended, applyEvent };
