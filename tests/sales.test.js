// Selling and launching (salesflow.js, gbp.js, routes/sales.js): approve and pay, one-click launch, Netlify messages into
// Leads, the CRM webhook, Google basics, visit counts for Netlify copies, and the questionnaire's package choice.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const sales = require('../salesflow');
const gbp = require('../gbp');
const pk = require('../packages');

// ---------------- unit tests ----------------
test('packages: the deposit is only what Leo typed, and never a made-up amount', () => {
  const d = pk.clean({});
  assert.ok(d.tiers.every(t => t.deposit === ''));
  const f = pk.fromForm({ tier0_deposit: '$300', tier1_deposit: 'abc', tier2_deposit: '0.20' });
  assert.equal(f.tiers[0].deposit, '300');
  assert.equal(f.tiers[1].deposit, '');
  assert.equal(f.tiers[2].deposit, '', 'under 50 cents is not a deposit');
  assert.equal(pk.depositCents('1,250.50'), 125050);
  assert.equal(pk.depositCents(''), 0);
});

test('salesflow: approval needs a name, an email and the tick; the package must be one of Leo\'s', () => {
  const pkgs = sales.clientPackages(pk.fromForm({ tier1_price: '$1,500', tier1_deposit: '400' }), pk.depositCents);
  assert.equal(pkgs[1].depositCents, 40000);
  let r = sales.cleanApproval({ name: '', email: 'bad', pkg: '1' }, pkgs);
  assert.equal(r.errors.length, 3);
  r = sales.cleanApproval({ name: 'Maria', email: 'maria@bakery.test', agree: '1', pkg: '7' }, pkgs);
  assert.deepEqual(r.errors, []);
  assert.equal(r.approval.pkg, null, 'an unknown package index is ignored');
  r = sales.cleanApproval({ name: 'Maria', email: 'maria@bakery.test', agree: true, pkg: 1 }, pkgs);
  assert.equal(r.approval.pkg.name, 'Premium');
  assert.ok(sales.canPay({ approved_at: 'x', deposit_cents: 40000, pay_status: 'none' }, true));
  assert.ok(!sales.canPay({ approved_at: 'x', deposit_cents: 40000, pay_status: 'paid' }, true));
  assert.ok(!sales.canPay({ approved_at: 'x', deposit_cents: 40000, pay_status: 'none' }, false), 'no Stripe key, no pay button');
  assert.ok(!sales.canPay({ approved_at: '', deposit_cents: 40000, pay_status: 'none' }, true));
});

test('salesflow: webhook addresses, Search Console tags and Netlify submissions are cleaned', () => {
  assert.equal(sales.cleanWebhookUrl('http://evil.test/x'), '', 'plain http only for this computer');
  assert.equal(sales.cleanWebhookUrl('http://localhost:4000/leads'), 'http://localhost:4000/leads');
  assert.equal(sales.cleanWebhookUrl('https://user:pw@hooks.test/x'), '');
  assert.equal(sales.cleanWebhookUrl('https://hooks.zapier.com/hooks/catch/1/abc'), 'https://hooks.zapier.com/hooks/catch/1/abc');
  assert.equal(sales.cleanVerify('<meta name="google-site-verification" content="abcDEF123_-abcDEF123_-xyz" />'), 'abcDEF123_-abcDEF123_-xyz');
  assert.equal(sales.cleanVerify('"><script>'), '');
  const l = sales.fromNetlify({ id: 'sub1', created_at: '2026-11-01T10:00:00Z', data: { name: 'Ann', email: 'ann@x.test', phone: '407', message: 'Leak!', service: 'Roof Repair', 'form-name': 'contact', 'bot-field': '', 'Roof age': '10 years' } });
  assert.equal(l.name, 'Ann'); assert.equal(l.service, 'Roof Repair'); assert.equal(l.created_at, '2026-11-01 10:00:00');
  assert.deepEqual(l.answers, [{ label: 'Roof age', value: '10 years' }]);
  assert.ok(!sales.isUsable(sales.fromNetlify({ id: 'e', data: { 'form-name': 'contact' } })), 'empty submissions are skipped');
  const sig = sales.sign('secret', '{"a":1}');
  assert.match(sig, /^sha256=[0-9a-f]{64}$/);
});

test('gbp: name, phone and address are compared the way Google listings differ', () => {
  assert.ok(gbp.samePhone('(407) 555-0100', '+1 407.555.0100'));
  assert.ok(!gbp.samePhone('407-555-0100', '407-555-0199'));
  assert.ok(gbp.sameAddress('12 Main Street, Suite 4', '12 main st ste 4'));
  const site = { name: 'Sunny Roofing LLC', sections: { contact: { phone: '407-555-0100', address: '' } } };
  const rows = gbp.napCheck(site, { name: 'Sunny Roofing', phone: '4075550100', address: '1 Oak Ave' });
  assert.deepEqual(rows.map(r => r.state), ['ok', 'ok', 'missing']);
  assert.deepEqual(gbp.napCheck(site, { name: '', phone: '', address: '' }).map(r => r.state), ['unknown', 'unknown', 'unknown']);
  assert.equal(gbp.liveUrl({ netlify_domain: 'www.sunny.test', netlify_ssl: 1 }), 'https://www.sunny.test/');
  assert.equal(gbp.liveUrl({ netlify_url: 'https://sunny-ab1.netlify.app' }), 'https://sunny-ab1.netlify.app/');
});

// ---------------- the app, with fake Stripe, Netlify and CRM ----------------
const PORT = 3979, BASE = `http://localhost:${PORT}`;
const STRIPE_PORT = 3978, NETLIFY_PORT = 3977, HOOK_PORT = 3976;
const TEST_DB = path.join(__dirname, '.sales-test.db');
const MAIL_FILE = path.join(__dirname, '.sales-test-mail.log');
let serverProc, fakeStripe, fakeNetlify, fakeHook;
const stripeSessions = {}; let stripeN = 0;
const netlify = { calls: [], sslFail: true, submissions: [] };
const hookHits = [];

function listen(server, port) { return new Promise(r => server.listen(port, r)); }
function body(req) { return new Promise(r => { const c = []; req.on('data', x => c.push(x)); req.on('end', () => r(Buffer.concat(c))); }); }

before(async () => {
  for (const f of [TEST_DB, TEST_DB + '-wal', TEST_DB + '-shm', MAIL_FILE]) fs.rmSync(f, { force: true });
  fakeStripe = http.createServer(async (req, res) => {
    const params = new URLSearchParams((await body(req)).toString());
    res.setHeader('content-type', 'application/json');
    if (req.method === 'POST' && req.url === '/v1/checkout/sessions') {
      const id = 'cs_dep_' + (++stripeN);
      stripeSessions[id] = { id, status: 'open', payment_status: 'unpaid', url: 'https://checkout.stripe.test/' + id, params };
      return res.end(JSON.stringify(stripeSessions[id]));
    }
    const m = /^\/v1\/checkout\/sessions\/(cs_dep_\d+)$/.exec(req.url);
    if (m && stripeSessions[m[1]]) return res.end(JSON.stringify(stripeSessions[m[1]]));
    res.statusCode = 404; res.end('{"error":{"message":"unknown"}}');
  });
  fakeNetlify = http.createServer(async (req, res) => {
    const raw = await body(req);
    const u = req.url.replace(/^\/api\/v1/, '');
    netlify.calls.push({ method: req.method, url: u, raw });
    res.setHeader('content-type', 'application/json');
    if (req.method === 'POST' && u === '/sites') { const name = JSON.parse(raw.toString()).name; return res.end(JSON.stringify({ id: 'nl-1', name, ssl_url: `https://${name}.netlify.app` })); }
    if (req.method === 'POST' && /^\/sites\/[^/]+\/deploys$/.test(u)) return res.end(JSON.stringify({ id: 'dep-' + netlify.calls.length, state: 'uploaded' }));
    if (req.method === 'GET' && /^\/deploys\//.test(u)) return res.end(JSON.stringify({ id: 'd', state: 'ready' }));
    if (req.method === 'PATCH' && /^\/sites\/[^/]+$/.test(u)) return res.end('{}');
    if (req.method === 'POST' && /^\/sites\/[^/]+\/ssl$/.test(u)) { if (netlify.sslFail) { res.statusCode = 422; return res.end('{"message":"DNS not ready"}'); } return res.end('{}'); }
    if (req.method === 'POST' && u === '/hooks') return res.end('{"id":"h1"}');
    if (req.method === 'GET' && /^\/sites\/[^/]+\/submissions/.test(u)) return res.end(JSON.stringify(netlify.submissions));
    res.statusCode = 404; res.end('{"message":"unknown"}');
  });
  fakeHook = http.createServer(async (req, res) => {
    hookHits.push({ headers: req.headers, body: (await body(req)).toString() });
    res.end('ok');
  });
  await Promise.all([listen(fakeStripe, STRIPE_PORT), listen(fakeNetlify, NETLIFY_PORT), listen(fakeHook, HOOK_PORT)]);
  serverProc = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env, PORT: String(PORT), DB_PATH: TEST_DB, MAIL_CAPTURE_FILE: MAIL_FILE, NODE_ENV: 'test',
      SESSION_SECRET: 'sales-suite-secret', STRIPE_SECRET_KEY: 'sk_test_salessuite', STRIPE_API_BASE: `http://localhost:${STRIPE_PORT}`,
      NETLIFY_AUTH_TOKEN: 'nfp_test', NETLIFY_API_URL: `http://localhost:${NETLIFY_PORT}/api/v1`, PUBLIC_URL: `http://localhost:${PORT}`,
      ANTHROPIC_API_KEY: '', PEXELS_API_KEY: '', UNSPLASH_ACCESS_KEY: '', STRIPE_PRICE_ID: '', STRIPE_WEBHOOK_SECRET: ''
    },
    stdio: 'pipe'
  });
  serverProc.stderr.on('data', d => { if (process.env.SALES_TEST_LOG) process.stderr.write(d); });
  for (let i = 0; i < 60; i++) {
    try { await fetch(BASE + '/'); break; } catch { await new Promise(r => setTimeout(r, 200)); }
  }
});
after(() => {
  serverProc && serverProc.kill();
  for (const s of [fakeStripe, fakeNetlify, fakeHook]) s && s.close();
  for (const f of [TEST_DB, TEST_DB + '-wal', TEST_DB + '-shm', MAIL_FILE]) fs.rmSync(f, { force: true });
});

function client() {
  let cookie = '';
  async function req(method, p, b, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    if (cookie) headers.Cookie = cookie;
    let payload;
    if (opts.json) { headers['Content-Type'] = 'application/json'; headers.Accept = 'application/json'; payload = JSON.stringify(b); }
    else if (b) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      const ps = new URLSearchParams();
      for (const [k, v] of Object.entries(b)) [].concat(v).forEach(x => ps.append(k, x));
      payload = ps.toString();
    }
    const res = await fetch(BASE + p, { method, headers, body: payload, redirect: 'manual' });
    const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    return res;
  }
  return { get: (p, o) => req('GET', p, null, o), post: (p, b, o) => req('POST', p, b, o) };
}
const mails = () => (fs.existsSync(MAIL_FILE) ? fs.readFileSync(MAIL_FILE, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : []);
const jobs = () => fetch(BASE + '/__test/sales-jobs', { method: 'POST', headers: { 'x-test-key': 'suite' } }).then(r => r.json());

async function makeSite(c, email, name) {
  await c.post('/signup', { email, password: 'password1' });
  const create = await c.post('/sites', { name });
  const editPath = create.headers.get('location');
  const siteId = editPath.match(/\/sites\/(\d+)\//)[1];
  await c.post(editPath, {
    name, hero_headline: 'Roofs done right', about_heading: 'About', about_body: 'We fix roofs in Orlando.',
    services_heading: 'Services', service_title: ['Roof Repair'], service_description: ['Fix leaks'], service_detail: [''],
    contact_heading: 'Contact', contact_email: 'owner@biz.test', contact_phone: '(407) 555-0100', contact_address: '12 Main Street',
    contact_acceptSubmissions: '1', meta_city: 'Orlando, FL', meta_businessType: 'roofer',
    layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,hours,contact'
  });
  return { siteId };
}

test('approve and pay: the client approves on the preview link, picks a package and pays Leo\'s deposit', async () => {
  const c = client();
  const { siteId } = await makeSite(c, 'seller@example.com', 'Sunny Roofing');
  await c.post('/packages', { tier0_name: 'Basic', tier0_price: '$900', tier1_name: 'Premium', tier1_price: '$1,500', tier1_deposit: '400', best: '1', tier0_items: 'A', tier1_items: 'B', tier2_items: 'C' });
  const { url } = await (await c.post(`/sites/${siteId}/share`, {}, { headers: { Accept: 'application/json' } })).json();
  const token = new URL(url).pathname.split('/').pop();
  const anon = client();

  const view = await (await anon.get(`/look/${token}`)).text();
  assert.match(view, /id="apBtn"/);
  let a = await (await anon.get(`/look/${token}/approval`)).json();
  assert.equal(a.approved, null);
  assert.equal(a.packages.length, 3);
  assert.equal(a.packages[1].deposit, '$400.00');
  assert.equal(a.packages[2].price, '', 'a package without a price shows no price, not a placeholder');

  // missing tick
  let r = await anon.post(`/look/${token}/approve`, { name: 'Maria', email: 'maria@sunny.test', pkg: '1' }, { json: true });
  assert.equal(r.status, 400);
  // deposit cannot be paid before approval
  r = await anon.post(`/look/${token}/deposit`, {}, { json: true });
  assert.equal(r.status, 400);

  const before = mails().length;
  a = await (await anon.post(`/look/${token}/approve`, { name: 'Maria', email: 'maria@sunny.test', pkg: '1', agree: '1', note: 'Love it' }, { json: true })).json();
  assert.equal(a.approved.name, 'Maria');
  assert.equal(a.approved.package, 'Premium');
  assert.ok(a.pay.can);
  for (let i = 0; i < 30 && mails().length === before; i++) await new Promise(r => setTimeout(r, 100)); // sent in the background
  const m = mails().slice(before);
  assert.ok(m.some(x => /Approved: Sunny Roofing · Premium/.test(x.subject) && x.to[0].address === "seller@example.com"), "Leo is told: " + JSON.stringify(m.map(x => [x.subject, x.to])));

  const dep = await (await anon.post(`/look/${token}/deposit`, {}, { json: true })).json();
  assert.ok(dep.ok);
  const sess = stripeSessions[dep.url.split('/').pop()];
  assert.equal(sess.params.get('line_items[0][price_data][unit_amount]'), '40000', 'the amount comes from Leo\'s package, not the browser');
  assert.match(sess.params.get('success_url'), new RegExp(`/look/${token}/paid\\?session_id=`));

  // client comes back before Stripe says paid: still checking
  let back = await anon.get(`/look/${token}/paid?session_id=x`);
  assert.match(back.headers.get('location'), /pay=checking/);
  sess.payment_status = 'paid';
  back = await anon.get(`/look/${token}/paid?session_id=x`);
  assert.match(back.headers.get('location'), /pay=paid/);
  a = await (await anon.get(`/look/${token}/approval`)).json();
  assert.equal(a.pay.status, 'paid');
  assert.ok(!a.pay.can);
  for (let i = 0; i < 30 && !mails().some(x => /Deposit paid: Sunny Roofing/.test(x.subject)); i++) await new Promise(r => setTimeout(r, 100));
  assert.ok(mails().some(x => /Deposit paid: Sunny Roofing/.test(x.subject)));

  // Leo's page shows it; clearing the approval keeps a paid deposit
  const page = await (await c.get(`/sites/${siteId}/launch`)).text();
  assert.match(page, /Approved<\/span> by <strong>Maria/);
  assert.match(page, /\$400\.00 on/);
  // another site's owner cannot touch it
  const other = client();
  await other.post('/signup', { email: 'other@example.com', password: 'password1' });
  assert.equal((await other.post(`/sites/${siteId}/sales/mark-paid`, { paid: '0' })).status, 404);
});

test('approve and pay: the sweep confirms a deposit when the client never comes back, and Leo can mark cash', async () => {
  const c = client();
  const { siteId } = await makeSite(c, 'sweeper@example.com', 'Sweep Cleaning');
  await c.post('/packages', { tier0_deposit: '150', tier0_items: 'A', tier1_items: 'B', tier2_items: 'C' });
  const { url } = await (await c.post(`/sites/${siteId}/share`, {}, { headers: { Accept: 'application/json' } })).json();
  const token = new URL(url).pathname.split('/').pop();
  await c.post(`/look/${token}/approve`, { name: 'Jo', email: 'jo@sweep.test', pkg: '0', agree: '1' }, { json: true });
  const dep = await (await c.post(`/look/${token}/deposit`, {}, { json: true })).json();
  stripeSessions[dep.url.split('/').pop()].payment_status = 'paid';
  const j = await jobs();
  assert.ok(j.deposits >= 1);
  assert.equal((await (await c.get(`/look/${token}/approval`)).json()).pay.status, 'paid');

  const c2 = client();
  const s2 = await makeSite(c2, 'cash@example.com', 'Cash Lawn');
  await c2.post(`/sites/${s2.siteId}/sales/mark-paid`, { amount: '250' });
  assert.match(await (await c2.get(`/sites/${s2.siteId}/launch`)).text(), /\$250\.00 on [^<]*\(marked by you\)/);
});

test('launch: publishes, adds the domain, waits for DNS, then turns on HTTPS and emails the client', async () => {
  const c = client();
  const { siteId } = await makeSite(c, 'launcher@example.com', 'Launch Pest Control');
  netlify.sslFail = true;
  const before = netlify.calls.length;
  let r = await c.post(`/sites/${siteId}/launch`, { domain: 'https://www.launchpest.test/', notify: 'owner@launchpest.test', report: '1', force: '1' });
  assert.match(r.headers.get('location'), /f=waiting/);
  const calls = netlify.calls.slice(before);
  assert.ok(calls.some(x => x.method === 'POST' && x.url === '/sites'));
  assert.ok(calls.some(x => x.method === 'PATCH' && /www\.launchpest\.test/.test(x.raw.toString())));
  // the first copy already has a sitemap and robots.txt for its netlify.app address, and the visit counter
  const zip = calls.find(x => /\/deploys$/.test(x.url)).raw.toString('latin1');
  assert.match(zip, /sitemap\.xml/); assert.match(zip, /robots\.txt/);
  let page = await (await c.get(`/sites/${siteId}/launch`)).text();
  assert.match(page, /Waiting for the domain&#39;s DNS|Waiting for the domain's DNS/);
  assert.match(page, /CNAME/);
  // the monthly report now goes to the client
  assert.match(await (await c.get(`/sites/${siteId}/edit`)).text(), /owner@launchpest\.test/);

  const sent = mails().length;
  await jobs(); // still failing: one more try, no email
  assert.equal(mails().slice(sent).filter(x => /is live/.test(x.subject)).length, 0);
  netlify.sslFail = false;
  const deploysBefore = netlify.calls.filter(x => /\/deploys$/.test(x.url)).length;
  const j = await jobs();
  assert.equal(j.launches, 1);
  assert.ok(netlify.calls.filter(x => /\/deploys$/.test(x.url)).length > deploysBefore, 'published again with its https address');
  const live = mails().slice(sent).find(x => /Your new website is live/.test(x.subject));
  assert.ok(live, 'client emailed');
  assert.equal(live.to[0].address, 'owner@launchpest.test');
  assert.match(live.text, /https:\/\/www\.launchpest\.test\//);
  page = await (await c.get(`/sites/${siteId}/launch`)).text();
  assert.match(page, /Emailed owner@launchpest\.test/);
  // the Google page now hands out the live sitemap
  assert.match(await (await c.get(`/sites/${siteId}/google`)).text(), /https:\/\/www\.launchpest\.test\/sitemap\.xml/);
});

test('launch: a red quality check pauses it and keeps what was typed; bad input is refused', async () => {
  const c = client();
  const { siteId } = await makeSite(c, 'gate@example.com', 'Gate Painting');
  let r = await c.post(`/sites/${siteId}/launch`, { domain: 'not a domain', force: '1' });
  assert.match(r.headers.get('location'), /f=baddomain/);
  r = await c.post(`/sites/${siteId}/launch`, { notify: 'nope', force: '1' });
  assert.match(r.headers.get('location'), /f=bademail/);
  // a missing photo is a red item in the quality check
  await c.post(`/sites/${siteId}/edit`, { name: 'Gate Painting', hero_headline: 'Hi', about_heading: 'About', about_body: 'x', services_heading: 'S', contact_heading: 'C', contact_email: 'g@x.test', theme_primaryColor: '#1d4ed8', hero_imageUrl: '/uploads/not-there.jpg', layout_order: 'hero,about,services,contact' });
  const calls = netlify.calls.length;
  r = await c.post(`/sites/${siteId}/launch`, { domain: 'gatepainting.test', notify: 'g@gate.test' });
  const loc = r.headers.get('location');
  assert.match(loc, /gate=\d/);
  assert.equal(netlify.calls.length, calls, 'nothing sent to Netlify');
  const page = await (await c.get(loc)).text();
  assert.match(page, /Launch paused/);
  assert.match(page, /value="gatepainting\.test"/);
  assert.match(page, /value="g@gate\.test"/);
  assert.match(page, /name="force" value="1"/);
  assert.match(page, /Launch anyway/);
});

test('leads: Netlify form messages come into Leads once, start follow-ups and go to the CRM webhook', async () => {
  const c = client();
  const { siteId } = await makeSite(c, 'leadsync@example.com', 'Sync Movers');
  netlify.sslFail = false;
  await c.post(`/sites/${siteId}/launch`, { force: '1' });
  // webhook: only https or this computer
  let r = await c.post(`/sites/${siteId}/sales/webhook`, { url: 'http://crm.example/leads' });
  assert.match(r.headers.get('location'), /err=/);
  await c.post(`/sites/${siteId}/sales/webhook`, { url: `http://localhost:${HOOK_PORT}/leads` });
  r = await c.post(`/sites/${siteId}/sales/webhook/test`, {});
  assert.match(r.headers.get('location'), /f=hooktest/);
  const test0 = hookHits.pop();
  assert.equal(JSON.parse(test0.body).event, 'lead.test');
  const page = await (await c.get(`/sites/${siteId}/launch`)).text();
  const secret = /Signing secret: <code>([^<]+)</.exec(page)[1];
  assert.equal(test0.headers['x-sitegen-signature'], sales.sign(secret, test0.body), 'signed with the site\'s secret');

  netlify.submissions = [
    { id: 'n-1', created_at: '2026-11-09T15:00:00Z', data: { name: 'Pat', email: 'pat@x.test', phone: '321', message: 'Moving on Friday', 'form-name': 'contact', 'Rooms': '3' } },
    { id: 'n-2', created_at: '2026-11-09T16:00:00Z', data: { 'form-name': 'contact' } }
  ];
  const leads = await (await c.get(`/sites/${siteId}/leads`)).text();
  assert.match(leads, /Moving on Friday/);
  assert.equal((leads.match(/Moving on Friday/g) || []).length >= 1, true);
  await c.get(`/sites/${siteId}/leads`); // a second look does not copy it again
  await jobs();
  const csv = await (await c.get(`/sites/${siteId}/leads.csv`)).text().catch(() => '');
  if (csv) assert.equal((csv.match(/Moving on Friday/g) || []).length, 1);
  const hit = hookHits.map(h => JSON.parse(h.body)).filter(b => b.event === 'lead.created');
  assert.equal(hit.length, 1);
  assert.equal(hit[0].lead.name, 'Pat');
  assert.equal(hit[0].lead.source, 'netlify');
  assert.deepEqual(hit[0].lead.answers, [{ label: 'Rooms', value: '3' }]);
});

test('leads: a contact form sent to SiteGen itself also goes to the webhook', async () => {
  const c = client();
  const { siteId } = await makeSite(c, 'direct@example.com', 'Direct Plumbing');
  await c.post(`/sites/${siteId}/publish`, { published: '1', force: '1' });
  await c.post(`/sites/${siteId}/sales/webhook`, { url: `http://localhost:${HOOK_PORT}/direct` });
  const n = hookHits.length;
  const fd = new FormData();
  fd.append('name', 'Lee'); fd.append('email', 'lee@x.test'); fd.append('message', 'Burst pipe');
  await fetch(`${BASE}/site/direct-plumbing/contact`, { method: 'POST', body: fd, redirect: 'manual' });
  for (let i = 0; i < 20 && hookHits.length === n; i++) await new Promise(r => setTimeout(r, 100));
  const b = JSON.parse(hookHits[hookHits.length - 1].body);
  assert.equal(b.lead.message, 'Burst pipe');
  assert.equal(b.site.name, 'Direct Plumbing');
});

test('google basics: checklist, name/address/phone match, and the Search Console tag on every page', async () => {
  const c = client();
  const { siteId } = await makeSite(c, 'google@example.com', 'Google Roofing');
  await c.post(`/sites/${siteId}/publish`, { published: '1', force: '1' });
  let page = await (await c.get(`/sites/${siteId}/google`)).text();
  assert.match(page, /Roofing contractor/, 'suggested category for a roofer');
  assert.match(page, /No opening hours on the site|The hours are still the default/);
  let r = await c.post(`/sites/${siteId}/google`, { gbp_name: 'Google Roofing', gbp_phone: '407.555.0100', gbp_address: '14 Main St', gsv: '<meta name="google-site-verification" content="tok_ABCdef1234567890abcdef" />', done: ['claim', 'bogus'] });
  assert.match(r.headers.get('location'), /saved=1$/);
  page = await (await c.get(`/sites/${siteId}/google`)).text();
  assert.match(page, /class="st ok">Match/);
  assert.match(page, /class="st differs">Different/, 'the street number differs');
  assert.match(page, /value="claim" checked/);
  const live = await (await fetch(`${BASE}/site/google-roofing/about`)).text();
  assert.match(live, /<meta name="google-site-verification" content="tok_ABCdef1234567890abcdef">/);
  r = await c.post(`/sites/${siteId}/google`, { gsv: '"><script>alert(1)</script>' });
  assert.match(r.headers.get('location'), /bad=1/);
  assert.doesNotMatch(await (await fetch(`${BASE}/site/google-roofing`)).text(), /google-site-verification/);
});

test('reports: a Netlify copy counts visits and taps back to SiteGen, without cookies, and bots are skipped', async () => {
  const c = client();
  const { siteId } = await makeSite(c, 'visits@example.com', 'Visit Bakery');
  netlify.sslFail = false;
  const before = netlify.calls.length;
  await c.post(`/sites/${siteId}/launch`, { force: '1' });
  const zip = netlify.calls.slice(before).find(x => /\/deploys$/.test(x.url)).raw;
  // the published pages call back to /h/<key>/v (zip entries are deflated, so read the key from the database instead)
  const Database = require('better-sqlite3');
  const db = new Database(TEST_DB, { readonly: true });
  const key = db.prepare('SELECT stats_key FROM site_sales WHERE site_id = ?').get(siteId).stats_key;
  db.close();
  assert.ok(key && zip.length > 1000);
  const ua = { 'user-agent': 'Mozilla/5.0 (iPhone)' };
  await fetch(`${BASE}/h/${key}/v`, { method: 'POST', headers: { ...ua, 'content-type': 'application/x-www-form-urlencoded' }, body: 'p=home' });
  await fetch(`${BASE}/h/${key}/v`, { method: 'POST', headers: { ...ua, 'content-type': 'application/x-www-form-urlencoded' }, body: 'p=about' });
  await fetch(`${BASE}/h/${key}/v`, { method: 'POST', headers: { 'user-agent': 'Googlebot', 'content-type': 'application/x-www-form-urlencoded' }, body: 'p=home' });
  await fetch(`${BASE}/h/${key}/e`, { method: 'POST', headers: { ...ua, 'content-type': 'application/x-www-form-urlencoded' }, body: 'e=call&p=home' });
  const bad = await fetch(`${BASE}/h/nope/v`, { method: 'POST', body: 'p=home' });
  assert.equal(bad.status, 204);
  const db2 = new Database(TEST_DB, { readonly: true });
  assert.equal(db2.prepare('SELECT SUM(views) AS n FROM page_views WHERE site_id = ?').get(siteId).n, 2, 'two real views, the bot skipped');
  assert.equal(db2.prepare("SELECT SUM(n) AS n FROM page_events WHERE site_id = ? AND event = 'call'").get(siteId).n, 1);
  db2.close();
  assert.equal((await c.get(`/sites/${siteId}/report?days=7`)).status, 200);
});

test('questionnaire: the client picks one of Leo\'s packages, and Leo can email the link', async () => {
  const c = client();
  await c.post('/signup', { email: 'intaker@example.com', password: 'password1' });
  await c.post('/packages', { tier0_name: 'Starter', tier0_price: '$700', tier0_items: 'A', tier1_items: 'B', tier2_items: 'C' });
  const before = mails().length;
  let r = await c.post('/intake/links', { label: 'Maria Bakery', email: 'maria@bakery.test' });
  assert.match(r.headers.get('location'), /f=emailed/);
  const m = mails().slice(before).find(x => x.to[0].address === 'maria@bakery.test');
  assert.ok(m);
  const link = /(http:\/\/\S+\/start\/[A-Za-z0-9_-]+)/.exec(m.text)[1];
  const token = link.split('/').pop();
  const form = await (await fetch(link)).text();
  assert.match(form, /name="pkg" value="Starter"/);
  assert.match(form, /Starter · \$700/);
  r = await fetch(`${BASE}/start/${token}`, {
    method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ biz_name: 'Maria Bakery', biz_type: 'bakery', contact_name: 'Maria', contact_email: 'maria@bakery.test', agree: '1', pkg: 'Starter' }).toString()
  });
  assert.equal(r.status, 302);
  const list = await (await c.get('/intake')).text();
  const subId = /\/intake\/submissions\/(\d+)/.exec(list)[1];
  assert.match(await (await c.get(`/intake/submissions/${subId}`)).text(), /Package they want[\s\S]{0,80}Starter/);
  // a package name Leo does not sell is dropped
  await fetch(`${BASE}/start/${token}`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ biz_name: 'X', biz_type: 'bakery', contact_name: 'X', contact_email: 'x@x.test', agree: '1', pkg: 'Free Website' }).toString() });
  const list2 = await (await c.get('/intake')).text();
  const ids = [...list2.matchAll(/\/intake\/submissions\/(\d+)/g)].map(x => +x[1]);
  assert.doesNotMatch(await (await c.get(`/intake/submissions/${Math.max(...ids)}`)).text(), /Free Website/);
});
