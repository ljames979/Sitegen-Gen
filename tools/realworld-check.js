#!/usr/bin/env node
// Checks your REAL keys against the REAL services, without touching your sites.
//   node tools/realworld-check.js        (or double-click realworld-check.bat)
// Reads .env. Nothing is saved or changed except: one tiny AI request, and a $1.00 TEST-mode Stripe checkout link.
const fs = require('fs'), path = require('path');
try { for (const l of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } } catch (e) { /* no .env */ }

const out = []; let bad = 0;
const ok = (n, m) => out.push(`  PASS  ${n}: ${m}`);
const no = (n, m, fix) => { bad++; out.push(`  FAIL  ${n}: ${m}${fix ? '\n        Fix: ' + fix : ''}`); };
const skip = (n, m) => out.push(`  SKIP  ${n}: ${m}`);
const j = async (url, opts) => { const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(20000) }); let b = null; try { b = await r.json(); } catch (e) {} return { r, b }; };

async function stripe() {
  const key = process.env.STRIPE_TEST_KEY || process.env.STRIPE_SECRET_KEY || '';
  if (!key) return skip('Stripe', 'no key. Put a TEST key (sk_test_...) in .env as STRIPE_TEST_KEY to check card payments.');
  if (!/^(sk|rk)_test_/.test(key)) return no('Stripe', 'that is not a test-mode key.', 'Use a key starting sk_test_ from dashboard.stripe.com/test/apikeys. This check refuses live keys on purpose.');
  const bal = await j('https://api.stripe.com/v1/balance', { headers: { Authorization: 'Bearer ' + key } });
  if (!bal.r.ok) return no('Stripe key', `${bal.r.status} ${bal.b && bal.b.error && bal.b.error.message || ''}`, 'Copy the key again from the Stripe dashboard (test mode).');
  ok('Stripe key', 'accepted, test mode');
  try {
    const payments = require('../payments');
    const s = await payments.createCheckout(key, { amountCents: 100, currency: 'usd', description: 'SiteGen real-world check', customerEmail: 'check@example.com', successUrl: 'http://localhost:3000/', cancelUrl: 'http://localhost:3000/', paymentId: 'check', siteName: 'SiteGen check' });
    ok('Stripe checkout', 'created a $1.00 test checkout. Open it and pay with card 4242 4242 4242 4242, any future date, any CVC:\n        ' + s.url);
    const back = await payments.getSession(key, s.id);
    ok('Stripe lookup', `session status "${back.status}", payment "${back.payment_status}" (should be unpaid until you pay it)`);
  } catch (e) { no('Stripe checkout', e.message); }
}
async function netlify() {
  const t = process.env.NETLIFY_AUTH_TOKEN;
  if (!t) return skip('Netlify', 'no token. Add NETLIFY_AUTH_TOKEN to .env (Netlify > User settings > Applications > New access token).');
  const u = await j('https://api.netlify.com/api/v1/user', { headers: { Authorization: 'Bearer ' + t } });
  if (u.r.status === 401) return no('Netlify token', 'rejected (401).', 'Create a new personal access token and update NETLIFY_AUTH_TOKEN.');
  if (!u.r.ok) return no('Netlify token', 'HTTP ' + u.r.status);
  ok('Netlify token', `accepted for ${u.b.email || u.b.full_name || 'your account'}`);
  const s = await j('https://api.netlify.com/api/v1/sites?per_page=1', { headers: { Authorization: 'Bearer ' + t } });
  s.r.ok ? ok('Netlify sites', 'can list sites. Publishing creates a new site there, so delete test sites in Netlify afterwards.') : no('Netlify sites', 'HTTP ' + s.r.status);
}
async function ai() {
  const k = process.env.ANTHROPIC_API_KEY;
  if (!k) return skip('Anthropic AI', 'no key. Add ANTHROPIC_API_KEY to .env (console.anthropic.com).');
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
  const r = await j(process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': k, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, max_tokens: 20, messages: [{ role: 'user', content: 'Reply with the single word: ready' }] }) });
  if (r.r.ok) return ok('Anthropic AI', `model ${model} answered: "${(r.b.content && r.b.content[0] && r.b.content[0].text || '').trim()}"`);
  const msg = r.b && r.b.error && r.b.error.message || '';
  if (r.r.status === 401) return no('Anthropic AI', 'key rejected.', 'Check ANTHROPIC_API_KEY.');
  if (r.r.status === 404 || /model/i.test(msg)) return no('Anthropic AI', `model "${model}" not accepted: ${msg}`, 'Set ANTHROPIC_MODEL in .env to a model your account can use.');
  no('Anthropic AI', `HTTP ${r.r.status} ${msg}`, r.r.status === 429 || /credit|billing/i.test(msg) ? 'Check your balance/limits at console.anthropic.com.' : '');
}
async function extras() {
  if (process.env.PEXELS_API_KEY) { const r = await j('https://api.pexels.com/v1/search?query=roof&per_page=1', { headers: { Authorization: process.env.PEXELS_API_KEY } }); r.r.ok ? ok('Pexels photos', 'key works') : no('Pexels photos', 'HTTP ' + r.r.status, 'Check PEXELS_API_KEY.'); } else skip('Pexels photos', 'no key (generated sites just have no stock photos).');
  if (process.env.SMTP_HOST) { try { const n = require('nodemailer'); await n.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }).verify(); ok('Email (SMTP)', 'log-in accepted'); } catch (e) { no('Email (SMTP)', e.message, 'Gmail needs an App Password, not your normal password.'); } } else skip('Email (SMTP)', 'not set (contact emails, receipts and password-reset emails will not send).');
}
(async () => {
  console.log('SiteGen real-world check\n');
  for (const f of [stripe, netlify, ai, extras]) { try { await f(); } catch (e) { no(f.name, 'could not reach the service: ' + e.message, 'Check your internet connection / firewall.'); } }
  console.log(out.join('\n'));
  console.log(bad ? `\n${bad} problem(s). Fix those, run again, then send me the output.` : '\nAll configured services work. Now do the walkthrough in REALWORLD-TEST.md.');
  process.exit(bad ? 1 : 0);
})();
