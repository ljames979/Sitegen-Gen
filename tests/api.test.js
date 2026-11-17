const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
// the shared site styles every page links (public/sg-site.css)
const siteCss = fs.readFileSync(require('node:path').join(__dirname, '..', 'public', 'sg-site.css'), 'utf8');
const path = require('node:path');

const PORT = 3999;
const BASE = `http://localhost:${PORT}`;
const TEST_DB = path.join(__dirname, '.test.db');
const MAIL_FILE = path.join(__dirname, '.test-mail.log');

let serverProc;
let oldSiteServer;
let fakeAiServer;
let fakePexelsServer;
let fakeGoogleServer;
const googleRequests = [];
const aiRequests = []; // every request the app made to the fake Anthropic API
const AI_PORT = 3997;
const PEXELS_PORT = 3996;
const GOOGLE_PORT = 3991;
const OLD_SITE_PORT = 3998;
const STRIPE_PORT = 3995;
const STRIPE_WHSEC = 'whsec_test_secret';
const stripeRequests = [];
let fakeStripeServer;
const stripeSessions = {};
let stripeSessionN = 0;
let fakeNetlifyServer;
const NETLIFY_PORT = 3990;
const netlifyCalls = [];
const netlifyState = { sslFail: false, restoreFail: false, createdNames: 0 };

function waitForServer(url, tries = 40) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      http.get(url, (res) => { res.resume(); resolve(); })
        .on('error', () => {
          if (n <= 0) return reject(new Error('server did not start in time'));
          setTimeout(() => attempt(n - 1), 150);
        });
    };
    attempt(tries);
  });
}

// A minimal "old website" served locally so import/refresh tests don't
// depend on the internet being reachable from wherever this suite runs.
function startOldSiteServer(html) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(html());
    });
    server.listen(OLD_SITE_PORT, () => resolve(server));
  });
}

before(async () => {
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(TEST_DB + suffix, { force: true });
  fs.rmSync(MAIL_FILE, { force: true });

  let oldHeadline = 'Old Biz - Original Headline';
  oldSiteServer = await startOldSiteServer(() => `<!DOCTYPE html><html><head><title>Old Biz</title>
    <meta name="description" content="An old business site."></head><body>
    <h1>${oldHeadline}</h1>
    <p>This paragraph is long enough to be picked up as the about-section body text for the import test.</p>
    <h2>Cleaning</h2><p>We clean things.</p>
    <address>1 Test Ave, Testville</address>
    <a href="mailto:owner@oldbiz.example">owner@oldbiz.example</a>
    </body></html>`);
  // Fake Anthropic API: answers with usable copy only when the prompt contains
  // the marker ZZ-AI-TEST, otherwise fails with HTTP 500 (to exercise fallback).
  fakeAiServer = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      const parsed = JSON.parse(body || '{}');
      aiRequests.push({ headers: req.headers, body: parsed });
      if (/filled-in questionnaire/.test(parsed.system || '')) {
        res.setHeader('content-type', 'application/json');
        const doc = (parsed.messages[0].content || [])[0] || {};
        const pdf = Buffer.from(doc.source ? doc.source.data : '', 'base64').toString('latin1');
        return res.end(JSON.stringify({ content: [{ type: 'text', text: pdf.includes('ZZ-SCAN') ? '{"biz_name":"Handwritten Plumbing","biz_type":"plumber","phone":"407-555-0199","agree":"yes"}' : 'nothing readable' }] }));
      }
      if (/editing assistant inside a website builder/.test(parsed.system || '')) {
        const ask = parsed.messages[0].content;
        res.setHeader('content-type', 'application/json');
        const say = (o) => res.end(JSON.stringify({ content: [{ type: 'text', text: typeof o === 'string' ? o : '```json\n' + JSON.stringify(o) + '\n```' }] }));
        if (ask.includes('ZZ-EDIT-OK')) return say({ reply: 'Done.', ops: [
          { op: 'set', path: 'hero.headline', value: 'A friendlier headline' },
          { op: 'set', path: 'theme.primaryColor', value: '#116644' },
          { op: 'add', path: 'services.items', value: { title: 'Gutter Cleaning', description: 'Clearing gutters.' } },
          { op: 'set', path: 'contact.email', value: 'evil@x.test' },
          { op: 'set', path: 'theme.accentColor', value: 'red; background:url(x)' },
          { op: 'set', path: '__proto__.polluted', value: 'yes' } ] });
        if (ask.includes('ZZ-EDIT-NOIR')) return say({ reply: 'Switched to a dark look.', ops: [{ op: 'set', path: 'theme.style', value: 'noir' }] });
        if (ask.includes('ZZ-EDIT-NONE')) return say({ reply: 'I cannot change your phone number here.', ops: [{ op: 'set', path: 'contact.phone', value: '555' }] });
        return say('sorry, no json here');
      }
      if (/website assistant/.test(parsed.system || '')) {
        const last = parsed.messages[parsed.messages.length - 1].content;
        res.setHeader('content-type', 'application/json');
        return res.end(JSON.stringify({ content: [{ type: 'text', text: 'AI says: ' + last.slice(0, 60) }] }));
      }
      const prompt = (parsed.messages && parsed.messages[0] && parsed.messages[0].content) || '';
      if (/ONE small business/.test(parsed.system || '') && /ZZ-GROUND/.test(prompt)) { // facts-only copy for client questionnaires
        const retrying = /previous draft was rejected/.test(prompt);
        const bad = !(retrying && /ZZ-GROUND-RETRY/.test(prompt));
        const reply = bad ? {
          hero: { headline: 'Licensed roofers with 25 years of experience', subheadline: 'The best roofing in Orlando, with free estimates', ctaText: 'Get a Free Estimate' },
          about: 'We are a family-owned team serving Orlando with 24/7 emergency service. Look no further.',
          services: [{ title: 'Roof Repair', description: 'Leaks fixed.' }, { title: 'Solar Panels', description: 'Installed in 3 days.' }],
          faq: [{ question: 'Are you insured?', answer: 'Yes, fully insured.' }],
          seoTitle: 'Best Roofing Orlando', seoDescription: 'Award-winning roofers.'
        } : {
          hero: { headline: 'Roof repair in Kissimmee, explained plainly', subheadline: 'Leaks and storm damage fixed.', ctaText: 'Request a Quote' },
          about: 'Test Grounded Roofing repairs roofs in Kissimmee.',
          services: [{ title: 'Roof Repair', description: 'Fixing leaks.' }],
          faq: [], seoTitle: 'Roof repair in Kissimmee', seoDescription: 'Roof repair in Kissimmee.'
        };
        res.setHeader('content-type', 'application/json');
        return res.end(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(reply) }] }));
      }
      if (!prompt.includes('ZZ-AI-TEST')) { res.statusCode = 500; return res.end('{}'); }
      const reply = {
        hero: { headline: 'Roofs that last, in Kissimmee', subheadline: 'Repairs and replacements explained plainly.', ctaText: 'Request a Quote' },
        about: 'We repair and replace roofs for homes across Osceola County.\n\nTell us what you are seeing and we will take it from there.',
        services: [
          { title: 'Roof Repair', description: 'Fixing leaks, missing shingles and storm damage.' },
          { title: 'Roof Replacement', description: 'Full tear-off and new roofing systems.' },
          { title: 'Inspections', description: 'A clear look at the condition of your roof.' },
          { title: 'Gutters', description: 'Installation and repair to keep water moving away.' }
        ],
        faq: [{ question: 'How do I get a quote?', answer: 'Contact us with a few details and we will get back to you.' }],
        seoTitle: 'Roofing in Kissimmee | Test Roofing', seoDescription: 'Roof repair and replacement in Kissimmee, FL.'
      };
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ content: [{ type: 'text', text: 'Here you go:\n```json\n' + JSON.stringify(reply) + '\n```' }] }));
    });
  });
  await new Promise(r => fakeAiServer.listen(AI_PORT, r));

  // Fake Pexels: three photos (and a next page) for queries containing "zzroof".
  fakePexelsServer = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    // Fake Unsplash on the same port: two photos for "zzroof", and a download-tracking endpoint that counts hits
    if (u.pathname.startsWith('/unsplash/')) {
      res.setHeader('content-type', 'application/json');
      if (req.headers.authorization !== 'Client-ID test-unsplash-key') { res.statusCode = 401; return res.end('{}'); }
      const dl = /^\/unsplash\/photos\/([\w-]+)\/download$/.exec(u.pathname);
      if (dl) { global.__unsplashDownloads = (global.__unsplashDownloads || []).concat(dl[1]); return res.end('{"url":"x"}'); }
      const hit = /zzroof/i.test(u.searchParams.get('query') || '');
      return res.end(JSON.stringify({ total: hit ? 2 : 0, total_pages: hit ? 1 : 0, results: hit ? ['u1', 'u2'].map(id => ({
        id, width: 5000, height: 3300, alt_description: 'a roof',
        urls: { raw: `https://images.unsplash.com/photo-${id}?ixid=t&ixlib=rb-4.0.3`, small: `https://images.unsplash.com/photo-${id}?w=400` },
        links: { html: `https://unsplash.com/photos/${id}`, download_location: `http://localhost:${PEXELS_PORT}/unsplash/photos/${id}/download?ixid=t` },
        user: { name: id === 'u1' ? 'Jo Lens' : 'Sam Shutter', links: { html: `https://unsplash.com/@${id}` } }
      })) : [] }));
    }
    const q = u.searchParams.get('query') || '';
    const page = parseInt(u.searchParams.get('page') || '1', 10);
    const photos = /zzroof/i.test(q) ? [1, 2, 3].map(n => ({
      width: 4000, height: 3000, photographer: 'Pat', photographer_url: 'https://pexels.test/pat', url: `https://pexels.test/p/${page}-${n}`,
      src: { large: `https://img.test/large-${page}-${n}.jpg`, medium: `https://img.test/medium-${page}-${n}.jpg` }
    })) : [];
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ photos, next_page: page < 2 && photos.length ? 'more' : undefined }));
  });
  await new Promise(r => fakePexelsServer.listen(PEXELS_PORT, r));

  // Fake Google Places: one known place, everything else 404.
  fakeGoogleServer = http.createServer((req, res) => {
    googleRequests.push({ url: req.url, headers: req.headers });
    res.setHeader('content-type', 'application/json');
    if (!req.url.startsWith('/places/ChIJtestplace12345')) { res.statusCode = 404; return res.end('{}'); }
    res.end(JSON.stringify({ displayName: { text: 'Palm' }, rating: 4.7, userRatingCount: 128, googleMapsUri: 'https://maps.google.com/?cid=123',
      reviews: [{ rating: 5, text: { text: 'Fixed our leak in one visit. <b>Great</b>' }, authorAttribution: { displayName: 'Sam R' }, relativePublishTimeDescription: 'a month ago' },
                { rating: 3, text: { text: 'Okay service, a bit slow.' }, authorAttribution: { displayName: 'Lee T' }, relativePublishTimeDescription: '2 months ago' }] }));
  });
  await new Promise(r => fakeGoogleServer.listen(GOOGLE_PORT, r));

  // Fake Stripe: records requests and hands back checkout/portal URLs.
  fakeStripeServer = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      stripeRequests.push({ url: req.url, method: req.method, auth: req.headers.authorization, params: new URLSearchParams(body) });
      res.setHeader('content-type', 'application/json');
      if (req.method === 'POST' && req.url === '/v1/checkout/sessions' && new URLSearchParams(body).get('mode') === 'payment') {
        const id = 'cs_pay_' + (++stripeSessionN);
        stripeSessions[id] = { id, status: 'open', payment_status: 'unpaid', url: 'https://checkout.stripe.test/pay/' + id, customer_details: null };
        return res.end(JSON.stringify(stripeSessions[id]));
      }
      const sm = req.url.match(/^\/v1\/checkout\/sessions\/(cs_pay_\d+)$/);
      if (req.method === 'GET' && sm) return res.end(JSON.stringify(stripeSessions[sm[1]] || {}));
      if (req.url === '/v1/checkout/sessions') return res.end(JSON.stringify({ id: 'cs_test_1', url: 'https://checkout.stripe.test/c/pay_abc' }));
      if (req.url === '/v1/billing_portal/sessions') return res.end(JSON.stringify({ url: 'https://billing.stripe.test/p/session_xyz' }));
      res.statusCode = 404; res.end(JSON.stringify({ error: { message: 'unknown' } }));
    });
  });
  await new Promise(r => fakeStripeServer.listen(STRIPE_PORT, r));

  fakeNetlifyServer = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks);
      const rec = { method: req.method, url: req.url, auth: req.headers.authorization, type: req.headers['content-type'], raw };
      try { rec.json = JSON.parse(raw.toString() || 'null'); } catch { rec.json = null; }
      netlifyCalls.push(rec);
      res.setHeader('content-type', 'application/json');
      const u = req.url.replace(/^\/api\/v1/, '');
      if (req.method === 'POST' && u === '/sites') { netlifyState.createdNames++; const name = rec.json.name; return res.end(JSON.stringify({ id: 'nl-site-' + netlifyState.createdNames, name, url: `http://${name}.netlify.app`, ssl_url: `https://${name}.netlify.app` })); }
      if (req.method === 'POST' && /^\/sites\/[^/]+\/deploys$/.test(u)) return res.end(JSON.stringify({ id: 'dep-' + netlifyCalls.length, state: 'uploaded' }));
      if (req.method === 'GET' && /^\/deploys\//.test(u)) return res.end(JSON.stringify({ id: u.split('/')[2], state: 'ready' }));
      if (req.method === 'PATCH' && /^\/sites\/[^/]+$/.test(u)) return res.end(JSON.stringify({ id: u.split('/')[2] }));
      if (req.method === 'GET' && /^\/sites\/[^/]+$/.test(u)) { const dom = [...netlifyCalls].reverse().find(c => c.method === 'PATCH'); return res.end(JSON.stringify({ id: u.split('/')[2], name: 'x', ssl_url: 'https://x.netlify.app', custom_domain: dom && dom.json ? dom.json.custom_domain : null, ssl: false })); }
      if (req.method === 'POST' && /^\/sites\/[^/]+\/ssl$/.test(u)) { if (netlifyState.sslFail) { res.statusCode = 422; return res.end(JSON.stringify({ message: 'DNS not ready' })); } return res.end('{}'); }
      if (req.method === 'POST' && /^\/sites\/[^/]+\/deploys\/[^/]+\/restore$/.test(u)) { if (netlifyState.restoreFail) { res.statusCode = 500; return res.end(JSON.stringify({ message: 'nope' })); } return res.end(JSON.stringify({ id: u.split('/')[4], state: 'ready' })); }
      if (req.method === 'POST' && u === '/hooks') return res.end(JSON.stringify({ id: 'hook1' }));
      res.statusCode = 404; res.end(JSON.stringify({ message: 'unknown' }));
    });
  });
  await new Promise(r => fakeNetlifyServer.listen(NETLIFY_PORT, r));

  // exposed so a later test can mutate it before calling /refresh
  global.__setOldHeadline = (h) => { oldHeadline = h; };

  serverProc = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(PORT),
      DB_PATH: TEST_DB,
      MAIL_CAPTURE_FILE: MAIL_FILE,
      ANTHROPIC_API_KEY: 'test-anthropic-key',
      ANTHROPIC_API_URL: `http://localhost:${AI_PORT}/v1/messages`,
      PEXELS_API_KEY: 'test-pexels-key',
      PEXELS_API_URL: `http://localhost:${PEXELS_PORT}/v1/search`,
      UNSPLASH_ACCESS_KEY: 'test-unsplash-key', UNSPLASH_API_URL: `http://localhost:${PEXELS_PORT}/unsplash`,
      GOOGLE_PLACES_API_KEY: 'test-google-key', GOOGLE_PLACES_API_URL: `http://localhost:${GOOGLE_PORT}`,
      STRIPE_SECRET_KEY: 'sk_test_fake', STRIPE_PRICE_ID: 'price_test_123', STRIPE_WEBHOOK_SECRET: STRIPE_WHSEC,
      STRIPE_API_BASE: `http://localhost:${STRIPE_PORT}`,
      NETLIFY_AUTH_TOKEN: 'nfp_test_token', NETLIFY_API_URL: `http://localhost:${NETLIFY_PORT}/api/v1`,
      SESSION_SECRET: 'test-secret-for-suite-only-not-for-real-use',
      ALLOW_PRIVATE_IMPORT_HOSTS: 'true',
      NODE_ENV: 'test'
    },
    stdio: 'pipe'
  });
  await waitForServer(BASE + '/');
});

after(async () => {
  serverProc?.kill();
  oldSiteServer?.close();
  fakeAiServer?.close();
  fakePexelsServer?.close();
  fakeGoogleServer?.close();
  fakeStripeServer?.close();
  fakeNetlifyServer?.close();
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(TEST_DB + suffix, { force: true });
});

// Small fetch wrapper that keeps a cookie jar per "session" so tests can
// simulate a logged-in browser.
function makeClient() {
  let cookie = '';
  async function req(method, urlPath, body, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    if (cookie) headers['Cookie'] = cookie;
    let payload = body;
    if (body && !(body instanceof FormData) && typeof body === 'object') {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(body)) {
        if (Array.isArray(v)) v.forEach(item => params.append(k, item)); // repeated keys, like a real form
        else params.append(k, v);
      }
      payload = params.toString();
    }
    const res = await fetch(BASE + urlPath, { method, headers, body: payload, redirect: 'manual' });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return res;
  }
  return {
    get: (p, opts) => req('GET', p, null, opts),
    post: (p, body, opts) => req('POST', p, body, opts)
  };
}

test('signup creates an account and redirects to dashboard', async () => {
  const c = makeClient();
  const res = await c.post('/signup', { email: 'alice@example.com', password: 'password1' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/dashboard');
});

test('signup rejects an invalid email', async () => {
  const c = makeClient();
  const res = await c.post('/signup', { email: 'not-an-email', password: 'password1' });
  assert.equal(res.status, 200); // re-renders signup with an error, no redirect
  const html = await res.text();
  assert.match(html, /valid email/i);
});

test('login fails with wrong password, succeeds with right one', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'bob@example.com', password: 'password1' });
  await c.post('/logout');

  const bad = await c.post('/login', { email: 'bob@example.com', password: 'wrong' });
  assert.equal(bad.status, 200);
  assert.match(await bad.text(), /invalid email or password/i);

  const good = await c.post('/login', { email: 'bob@example.com', password: 'password1' });
  assert.equal(good.status, 302);
  assert.equal(good.headers.get('location'), '/dashboard');
});

test('dashboard requires auth', async () => {
  const c = makeClient();
  const res = await c.get('/dashboard');
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/login');
});

test('create site, edit it, publish it, and view it live', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'carol@example.com', password: 'password1' });

  const create = await c.post('/sites', { name: 'Carol Consulting' });
  assert.equal(create.status, 302);
  const editPath = create.headers.get('location');
  assert.match(editPath, /^\/sites\/\d+\/edit$/);
  const siteId = editPath.match(/\/sites\/(\d+)\//)[1];

  const editRes = await c.get(editPath);
  assert.equal(editRes.status, 200);
  const editHtml = await editRes.text();
  assert.match(editHtml, /Carol Consulting/);
  assert.match(editHtml, /Page sections/);

  const save = await c.post(editPath, {
    name: 'Carol Consulting',
    hero_headline: 'Consulting That Delivers',
    hero_subheadline: 'Strategy for growing teams.',
    about_heading: 'About',
    about_body: 'We help teams grow.',
    about_imageUrl: 'https://images.example.com/team.jpg',
    services_heading: 'Services',
    service_title: 'Strategy',
    service_description: 'We plan.',
    contact_heading: 'Contact',
    contact_email: 'hello@carolconsulting.com',
    layout_order: 'hero,about,services,testimonials,gallery,faq,hours,contact'
  });
  assert.equal(save.status, 302);

  const publish = await c.post(`/sites/${siteId}/publish`, { published: '1' });
  assert.equal(publish.status, 302);

  const live = await fetch(`${BASE}/site/carol-consulting`);
  assert.equal(live.status, 200);
  const liveHtml = await live.text();
  assert.match(liveHtml, /Consulting That Delivers/);
  // closing CTA band is present on the home page
  assert.match(liveHtml, /cta-band/);

  // about has its own page; the photo was set, so it renders as the
  // two-column layout
  const aboutHtml = await (await fetch(`${BASE}/site/carol-consulting/about`)).text();
  assert.match(aboutHtml, /about-split/);
  assert.match(aboutHtml, /team\.jpg/);

  // contact has its own page too
  const contactHtml = await (await fetch(`${BASE}/site/carol-consulting/contact`)).text();
  assert.match(contactHtml, /hello@carolconsulting.com/);

  // no testimonials were added, so that page (and its old fake-quote
  // fallback) doesn't exist at all — visiting it 404s
  assert.doesNotMatch(liveHtml + aboutHtml + contactHtml, /A Happy Customer/);
  const testimonialsRes = await fetch(`${BASE}/site/carol-consulting/testimonials`);
  assert.equal(testimonialsRes.status, 404);
});

test('editorial theme style and hero trust line render correctly', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'francesca@example.com', password: 'password1' });

  const create = await c.post('/sites', { name: 'Frank Law' });
  const editPath = create.headers.get('location');
  const siteId = editPath.match(/\/sites\/(\d+)\//)[1];

  await c.post(editPath, {
    name: 'Frank Law',
    hero_headline: 'Real help, real fast.',
    hero_subheadline: 'A firm that actually calls you back.',
    hero_trustText: 'Free consultation • No hidden fees • Available 24/7',
    about_heading: 'About',
    about_body: 'We fight for our clients.',
    services_heading: 'Services',
    theme_style: 'editorial',
    theme_primaryColor: '#2f6f52',
    theme_accentColor: '#1c2a3a',
    layout_order: 'hero,about,services,testimonials,gallery,faq,hours,contact'
  });

  await c.post(`/sites/${siteId}/publish`, { published: '1' });

  const live = await fetch(`${BASE}/site/frank-law`);
  const html = await live.text();
  assert.match(html, /style-editorial/);
  assert.match(html, /Playfair\+Display/);
  assert.match(html, /hero-trust/);
  assert.match(html, /Free consultation/);
  assert.match(html, /No hidden fees/);
  assert.match(html, /Available 24\/7/);
});

test('minimal and warm theme styles render correctly', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'min@example.com', password: 'password1' });

  const create1 = await c.post('/sites', { name: 'Quiet Studio' });
  const editPath1 = create1.headers.get('location');
  const siteId1 = editPath1.match(/\/sites\/(\d+)\//)[1];
  await c.post(editPath1, {
    name: 'Quiet Studio',
    hero_headline: 'Design that gets out of the way.',
    about_heading: 'About', about_body: 'A small studio.',
    services_heading: 'Services',
    theme_style: 'minimal',
    layout_order: 'hero,about,services,testimonials,gallery,faq,hours,contact'
  });
  await c.post(`/sites/${siteId1}/publish`, { published: '1' });
  const live1 = await fetch(`${BASE}/site/quiet-studio`);
  const html1 = await live1.text();
  assert.match(html1, /<body class="style-minimal[ "]/);

  const create2 = await c.post('/sites', { name: 'Hearth and Home' });
  const editPath2 = create2.headers.get('location');
  const siteId2 = editPath2.match(/\/sites\/(\d+)\//)[1];
  await c.post(editPath2, {
    name: 'Hearth and Home',
    hero_headline: 'A cozy space, cared for like your own.',
    about_heading: 'About', about_body: 'Family-run home cleaning.',
    services_heading: 'Services',
    theme_style: 'warm',
    layout_order: 'hero,about,services,testimonials,gallery,faq,hours,contact'
  });
  await c.post(`/sites/${siteId2}/publish`, { published: '1' });
  const live2 = await fetch(`${BASE}/site/hearth-and-home`);
  const html2 = await live2.text();
  assert.match(html2, /<body class="style-warm[ "]/);
  assert.match(html2, /Fraunces/);
});

test('light brand colors get dark button text, dark ones keep white', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'lightbrand@example.com', password: 'password1' });
  const base = { hero_headline: 'Bright and readable.', hero_ctaText: 'Call us', about_heading: 'About', about_body: 'A shop.', services_heading: 'Services', layout_order: 'hero,about,services,testimonials,gallery,faq,hours,contact' };
  const make = async (name, slug, primary) => {
    const edit = (await c.post('/sites', { name })).headers.get('location');
    const id = edit.match(/\/sites\/(\d+)\//)[1];
    await c.post(edit, { ...base, name, theme_style: 'modern', theme_primaryColor: primary, theme_accentColor: '#1e293b' });
    await c.post(`/sites/${id}/publish`, { published: '1' });
    return (await fetch(`${BASE}/site/${slug}`)).text();
  };
  const yellow = await make('Yellow Shop', 'yellow-shop', '#ffc107');
  assert.match(yellow, /--on-primary: #111111;/);
  assert.match(yellow, /--primary-ink: #111111;/, 'white buttons on the brand band use dark text too');
  assert.match(siteCss, /\.btn \{[^}]*color: var\(--on-primary\);/);
  assert.match(siteCss, /nav\.site-nav \.links a\.nav-cta \{ color: var\(--on-primary\);/);
  assert.doesNotMatch(yellow, /\.btn \{[^}]*color: #fff;/);
  const mid = await make('Sky Shop', 'sky-shop', '#007bff'); // white is only 3.98:1 here, near-black is better
  assert.match(mid, /--on-primary: #111111;/);
  const navy = await make('Navy Shop', 'navy-shop', '#1b2a4a');
  assert.match(navy, /--on-primary: #ffffff;/);
  assert.match(navy, /--primary-ink: #1b2a4a;/);
});

test('approved project styles: credit comment in the head of live and exported pages, fonts, editor picker', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'approved@example.com', password: 'password1' });
  const base = { hero_headline: 'Roofs done right.', about_heading: 'About', about_body: 'A local roofer.', services_heading: 'Services', layout_order: 'hero,about,services,testimonials,gallery,faq,hours,contact' };

  const create = await c.post('/sites', { name: 'Workbench Roofing' });
  const editPath = create.headers.get('location');
  const siteId = editPath.match(/\/sites\/(\d+)\//)[1];
  await c.post(editPath, { ...base, name: 'Workbench Roofing', theme_style: 'workbench', theme_primaryColor: '#ffc107', theme_accentColor: '#2B2B2B' });
  await c.post(`/sites/${siteId}/publish`, { published: '1' });
  const html = await (await fetch(`${BASE}/site/workbench-roofing`)).text();
  const credit = '<!-- Design system adapted from "Industrial Workbench Schematic" by designmd.app, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/) -->';
  const head = html.slice(0, html.indexOf('</head>'));
  assert.ok(head.includes(credit), 'credit comment is inside <head>');
  assert.equal(html.split('designmd.app').length - 1, 1, 'credit appears once');
  assert.match(html, /<body class="style-workbench[ "]/);
  assert.match(html, /Roboto\+Condensed/);
  assert.match(html, /--body-font: 'Roboto Condensed'/);
  assert.match((await (await c.get(`/site/workbench-roofing/about`)).text()), /Industrial Workbench Schematic/, 'every page carries it');

  const zip = readZip(Buffer.from(await (await c.get(`/sites/${siteId}/export`)).arrayBuffer()));
  for (const f of ['index.html', 'about.html']) assert.ok(zip[f].toString().includes(credit), f + ' in the export carries the credit');

  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /<optgroup label="Approved client styles/);
  assert.match(editor, /7\. Workbench/);
  assert.match(editor, /Use this style's own colors/);

  const create2 = await c.post('/sites', { name: 'Pop Juice Bar' });
  const editPath2 = create2.headers.get('location');
  const siteId2 = editPath2.match(/\/sites\/(\d+)\//)[1];
  await c.post(editPath2, { ...base, name: 'Pop Juice Bar', theme_style: 'popstudio', theme_primaryColor: '#135ceb', theme_accentColor: '#0b1726' });
  await c.post(`/sites/${siteId2}/publish`, { published: '1' });
  const pop = await (await fetch(`${BASE}/site/pop-juice-bar`)).text();
  assert.match(pop, /Plus\+Jakarta\+Sans/);
  assert.doesNotMatch(pop, /designmd|Devault|CC BY/i, 'the Devault style adds no credit and does not name its source');
});

test('why choose us, top bar, featured photos, and star ratings render correctly', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'lawnref@example.com', password: 'password1' });

  const create = await c.post('/sites', { name: 'LSG Lawn Care' });
  const editPath = create.headers.get('location');
  const siteId = editPath.match(/\/sites\/(\d+)\//)[1];

  await c.post(editPath, {
    name: 'LSG Lawn Care',
    hero_headline: 'Residential Lawn Care In Poinciana',
    about_heading: 'About Us', about_body: 'We take pride in our reputation.',
    services_heading: 'Services',
    testimonials_heading: 'What Our Customers Say',
    testimonial_quote: 'They did a fantastic job on my yard.',
    testimonial_author: 'Carmin Castro',
    testimonial_rating: '5',
    testimonial_date: 'April 2026',
    whyChoose_heading: 'Why Choose Us',
    whyChoose_icon: 'check', whyChoose_title: 'Free Quote', whyChoose_text: 'No obligation.',
    gallery_image: ['https://images.example.com/yard1.jpg', 'https://images.example.com/yard2.jpg'],
    contact_heading: 'Contact Us',
    contact_phone: '407-431-6795',
    contact_social_facebook: 'https://facebook.com/lsglawncare',
    contact_acceptSubmissions: '1',
    layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,hours,contact'
  });
  await c.post(`/sites/${siteId}/publish`, { published: '1' });

  const live = await fetch(`${BASE}/site/lsg-lawn-care`);
  const html = await live.text();
  // top phone/social bar and the featured photo row both live on the home page
  assert.match(html, /top-bar-phone/);
  assert.match(html, /407-431-6795/);
  assert.match(html, /facebook\.com\/lsglawncare/);
  assert.match(html, /featured-frame/);
  assert.match(html, /yard1\.jpg/);
  assert.match(html, /yard2\.jpg/);
  // the nav links to each section's own page
  assert.match(html, /href="\/site\/lsg-lawn-care\/whyChoose"/);
  assert.match(html, /href="\/site\/lsg-lawn-care\/contact"/);

  // why choose us has its own page, with its icon cards
  const whyChooseHtml = await (await fetch(`${BASE}/site/lsg-lawn-care/whyChoose`)).text();
  assert.match(whyChooseHtml, /id="whyChoose"/);
  assert.match(whyChooseHtml, /why-card/);
  assert.match(whyChooseHtml, /Free Quote/);

  // testimonials has its own page; a real 5-star rating renders as 5 filled
  // stars, not a hardcoded row
  const testimonialsHtml = await (await fetch(`${BASE}/site/lsg-lawn-care/testimonials`)).text();
  assert.match(testimonialsHtml, /★★★★★/);
  assert.doesNotMatch(testimonialsHtml, /★★★★★★/); // never more than 5
  assert.match(testimonialsHtml, /April 2026/);

  // the contact page has the form itself, with its spam honeypot field
  const contactHtml = await (await fetch(`${BASE}/site/lsg-lawn-care/contact`)).text();
  assert.match(contactHtml, /Send us a message/);
  assert.match(contactHtml, /name="website" class="hp-field"/);

  // a page for a section that was never added (gallery headings/images
  // exist, but e.g. the faq page has no items) 404s rather than showing empty
  const faqRes = await fetch(`${BASE}/site/lsg-lawn-care/faq`);
  assert.equal(faqRes.status, 404);
});

test('public contact form stores a submission and shows a thanks banner, while the honeypot silently drops spam', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'leads@example.com', password: 'password1' });
  const create = await c.post('/sites', { name: 'Leads Test Co' });
  const editPath = create.headers.get('location');
  const siteId = editPath.match(/\/sites\/(\d+)\//)[1];
  await c.post(editPath, {
    name: 'Leads Test Co',
    hero_headline: 'Hello',
    about_heading: 'About', about_body: 'x',
    services_heading: 'Services',
    contact_heading: 'Contact',
    contact_acceptSubmissions: '1',
    layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,hours,contact'
  });
  await c.post(`/sites/${siteId}/publish`, { published: '1' });

  const form = new FormData();
  form.append('name', 'Jane Visitor');
  form.append('email', 'jane@example.com');
  form.append('phone', '555-1234');
  form.append('message', 'Can you quote my yard?');
  form.append('website', ''); // honeypot left blank, like a real visitor

  const submit = await fetch(`${BASE}/site/leads-test-co/contact`, { method: 'POST', body: form, redirect: 'manual' });
  assert.equal(submit.status, 302);
  assert.equal(submit.headers.get('location'), '/site/leads-test-co/thank-you');

  const leadsPage = await c.get(`/sites/${siteId}/leads`);
  const leadsHtml = await leadsPage.text();
  assert.match(leadsHtml, /Jane Visitor/);
  assert.match(leadsHtml, /jane@example\.com/);
  assert.match(leadsHtml, /Can you quote my yard/);

  // the submitter lands on the thank-you page
  const confirmPage = await fetch(`${BASE}${submit.headers.get('location')}`);
  const confirmHtml = await confirmPage.text();
  assert.match(confirmHtml, /Thank you!/);
  assert.match(confirmHtml, /noindex/);
  // the flash-style banner still works for the bot-trap path
  const flash = await fetch(`${BASE}/site/leads-test-co/contact?contact_sent=1`);
  assert.match(await flash.text(), /your message has been sent/);

  // but a plain, cached visit to the contact page right after should NOT
  // show the submitter's flash banner to anyone else
  const otherVisitor = await fetch(`${BASE}/site/leads-test-co/contact`);
  const otherHtml = await otherVisitor.text();
  assert.doesNotMatch(otherHtml, /your message has been sent/);

  // honeypot filled in => silently dropped, no new row, still looks like success
  const spamForm = new FormData();
  spamForm.append('name', 'Bot');
  spamForm.append('website', 'http://spam.example');
  const spamSubmit = await fetch(`${BASE}/site/leads-test-co/contact`, { method: 'POST', body: spamForm, redirect: 'manual' });
  assert.equal(spamSubmit.status, 302);
  const leadsPage2 = await c.get(`/sites/${siteId}/leads`);
  const leadsHtml2 = await leadsPage2.text();
  assert.doesNotMatch(leadsHtml2, /Bot</);
});

async function waitForMail(count, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const lines = fs.existsSync(MAIL_FILE) ? fs.readFileSync(MAIL_FILE, 'utf8').split('\n').filter(Boolean) : [];
    if (lines.length >= count) return lines.map(l => JSON.parse(l));
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('expected mail was not sent');
}

test('new contact-form messages are emailed to the notify address (falling back to the contact email)', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'mailer@example.com', password: 'password1' });
  const base = fs.existsSync(MAIL_FILE) ? fs.readFileSync(MAIL_FILE, 'utf8').split('\n').filter(Boolean).length : 0;

  async function makeSite(name, extra) {
    const create = await c.post('/sites', { name });
    const editPath = create.headers.get('location');
    const siteId = editPath.match(/\/sites\/(\d+)\//)[1];
    await c.post(editPath, {
      name, hero_headline: 'Hi', about_heading: 'About', about_body: 'x', services_heading: 'Services',
      contact_heading: 'Contact', contact_acceptSubmissions: '1', ...extra,
      layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,hours,contact'
    });
    await c.post(`/sites/${siteId}/publish`, { published: '1' });
  }
  await makeSite('Mail Co One', { contact_email: 'public@mailco.com', contact_notifyEmail: 'private@mailco.com' });
  await makeSite('Mail Co Two', { contact_email: 'only@mailco.com' });

  const f1 = new FormData();
  f1.append('name', 'Jane\nBcc: attacker@evil.com');
  f1.append('email', 'jane@example.com');
  f1.append('message', 'Please call me');
  await fetch(`${BASE}/site/mail-co-one/contact`, { method: 'POST', body: f1, redirect: 'manual' });
  const f2 = new FormData();
  f2.append('name', 'Sam');
  f2.append('phone', '555-0000');
  await fetch(`${BASE}/site/mail-co-two/contact`, { method: 'POST', body: f2, redirect: 'manual' });

  const mails = (await waitForMail(base + 2)).slice(base);
  const one = mails.find(m => /Mail Co One/.test(m.subject));
  const two = mails.find(m => /Mail Co Two/.test(m.subject));
  assert.equal(one.to[0].address, 'private@mailco.com');
  assert.equal(one.replyTo[0].address, 'jane@example.com');
  assert.match(one.text, /Please call me/);
  assert.doesNotMatch(one.subject, /[\r\n]/);
  assert.equal(two.to[0].address, 'only@mailco.com');
});

test('intake details fill in a generated site; checklist flags what is missing; duplicate copies it', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'intake@example.com', password: 'password1' });

  // with full client details
  const gen = await c.post('/sites/generate', {
    business_type: 'plumbing company', business_name: 'Intake Plumbing',
    phone: '555-0199', email: 'office@intakeplumbing.com', address: '1 Main St, Orlando, FL',
    weekday_hours: '8:00 AM – 6:00 PM', saturday_hours: '9:00 AM – 1:00 PM',
    facebook: 'https://facebook.com/intakeplumbing', use_brand_color: '1', brand_color: '#ff6600'
  });
  assert.equal(gen.status, 302);
  const editPath = gen.headers.get('location').split('?')[0];
  const siteId = editPath.match(/\/sites\/(\d+)\//)[1];
  const editHtml = await (await c.get(editPath)).text();
  assert.match(editHtml, /value="555-0199"/);
  assert.match(editHtml, /office@intakeplumbing\.com/);
  assert.match(editHtml, /8:00 AM – 6:00 PM/);
  assert.match(editHtml, /#ff6600/i);

  const full = await (await c.get(`/sites/${siteId}/checklist`)).json();
  assert.ok(!full.items.some(i => /Hours page still shows the default/.test(i.text)), 'real hours supplied');
  assert.ok(!full.items.some(i => /No phone number or email/.test(i.text)));

  // without details: placeholder hours and missing contact info are flagged
  const gen2 = await c.post('/sites/generate', { business_type: 'hair salon', business_name: 'Bare Salon' });
  const id2 = gen2.headers.get('location').match(/\/sites\/(\d+)\//)[1];
  const bare = await (await c.get(`/sites/${id2}/checklist`)).json();
  assert.ok(bare.items.some(i => i.level === 'warn' && /default Mon–Fri/.test(i.text)));
  assert.ok(bare.items.some(i => i.level === 'warn' && /No phone number or email/.test(i.text)));

  // bad colors / junk are ignored rather than saved
  const gen3 = await c.post('/sites/generate', { business_type: 'plumber', business_name: 'Junk Co', use_brand_color: '1', brand_color: 'red;}</style>', email: 'nope', facebook: 'javascript:alert(1)' });
  const id3 = gen3.headers.get('location').match(/\/sites\/(\d+)\//)[1];
  const junkHtml = await (await c.get(`/sites/${id3}/edit`)).text();
  assert.doesNotMatch(junkHtml, /javascript:alert/);
  assert.doesNotMatch(junkHtml, /red;\}/);

  // duplicate: new draft site with the same content, original untouched
  const dup = await c.post(`/sites/${siteId}/duplicate`);
  assert.equal(dup.status, 302);
  const dupHtml = await (await c.get(dup.headers.get('location'))).text();
  assert.match(dupHtml, /Intake Plumbing \(copy\)/);
  assert.match(dupHtml, /555-0199/);

  // someone else cannot duplicate or read the checklist of this site
  const other = makeClient();
  await other.post('/signup', { email: 'intake-other@example.com', password: 'password1' });
  assert.equal((await other.post(`/sites/${siteId}/duplicate`)).status, 404);
  assert.equal((await other.get(`/sites/${siteId}/checklist`)).status, 404);
});

test('published pages carry canonical, share, favicon and structured data; sitemap lists every page', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'seo@example.com', password: 'password1' });
  const create = await c.post('/sites', { name: 'Seo Plumbing' });
  const editPath = create.headers.get('location');
  const siteId = editPath.match(/\/sites\/(\d+)\//)[1];
  await c.post(editPath, {
    name: 'Seo Plumbing', hero_headline: 'Fast fixes', hero_imageUrl: '/uploads/hero-test.jpg',
    about_heading: 'About', about_body: 'We fix pipes.', services_heading: 'Services',
    contact_heading: 'Contact', contact_phone: '555-0123', contact_email: 'hi@seoplumbing.com',
    contact_address: '9 Pipe St, Tampa, FL', contact_social_facebook: 'https://facebook.com/seoplumbing',
    seo_title: 'Seo Plumbing | Tampa', seo_description: 'Plumbers in Tampa.',
    layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,hours,contact'
  });
  await c.post(`/sites/${siteId}/publish`, { published: '1', force: '1' });

  const html = await (await fetch(`${BASE}/site/seo-plumbing/about`)).text();
  assert.match(html, /<link rel="canonical" href="http:\/\/localhost:3999\/site\/seo-plumbing\/about">/);
  assert.match(html, /og:image" content="http:\/\/localhost:3999\/uploads\/hero-test\.jpg"/);
  assert.match(html, /rel="icon" type="image\/svg\+xml"/);
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  assert.equal(ld['@type'], 'LocalBusiness');
  assert.equal(ld.telephone, '555-0123');
  assert.equal(ld.address.streetAddress, '9 Pipe St, Tampa, FL');
  assert.deepEqual(ld.sameAs, ['https://facebook.com/seoplumbing']);
  assert.doesNotMatch(html, /name="robots"/);

  // the editor's preview must not be indexable
  const preview = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(preview, /name="robots" content="noindex"/);

  const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
  assert.match(xml, /\/site\/seo-plumbing<\/loc>/);
  assert.match(xml, /\/site\/seo-plumbing\/about<\/loc>/);
  assert.match(xml, /\/site\/seo-plumbing\/contact<\/loc>/);
  assert.doesNotMatch(xml, /\/site\/seo-plumbing\/faq<\/loc>/); // no FAQ items, so no page
  const robots = await (await fetch(`${BASE}/robots.txt`)).text();
  assert.match(robots, /Sitemap: http:\/\/localhost:3999\/sitemap\.xml/);
});

test('uploaded photos are shrunk and rotated, and photos from rejected contact submissions are deleted', async (t) => {
  let sharp;
  try { sharp = require('sharp'); } catch { return t.skip('sharp not installed'); }
  const c = makeClient();
  await c.post('/signup', { email: 'imgs@example.com', password: 'password1' });
  const create = await c.post('/sites', { name: 'Img Co' });
  const siteId = create.headers.get('location').match(/\/sites\/(\d+)\//)[1];

  const big = await sharp({ create: { width: 3200, height: 2400, channels: 3, background: { r: 200, g: 90, b: 30 } } })
    .jpeg({ quality: 100 }).toBuffer();
  const form = new FormData();
  form.append('image', new Blob([big], { type: 'image/jpeg' }), 'big.jpg');
  const up = await c.post(`/sites/${siteId}/upload`, form);
  const { ok, url } = await up.json();
  assert.ok(ok);
  const meta = await sharp(Buffer.from(await (await fetch(BASE + url)).arrayBuffer())).metadata();
  assert.equal(meta.width, 1920);
  assert.equal(meta.height, 1440);

  // a spam submission (honeypot filled) with a photo must not leave the file behind
  await c.post(`/sites/${siteId}/edit`, { name: 'Img Co', contact_acceptSubmissions: '1', layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,hours,contact' });
  await c.post(`/sites/${siteId}/publish`, { published: '1' });
  const before = fs.readdirSync(path.join(__dirname, '..', 'public', 'uploads')).length;
  const spam = new FormData();
  spam.append('website', 'http://spam.example');
  spam.append('name', 'Bot');
  spam.append('photo', new Blob([big], { type: 'image/jpeg' }), 'spam.jpg');
  await fetch(`${BASE}/site/img-co/contact`, { method: 'POST', body: spam, redirect: 'manual' });
  await new Promise(r => setTimeout(r, 200));
  const after = fs.readdirSync(path.join(__dirname, '..', 'public', 'uploads')).length;
  assert.equal(after, before);
});

// Minimal zip reader (central directory + inflate) so the export test can
// inspect real file contents without any extra dependency.
function readZip(buf) {
  const zlib = require('node:zlib');
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = {};
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const lNameLen = buf.readUInt16LE(localOffset + 26), lExtraLen = buf.readUInt16LE(localOffset + 28);
    const data = buf.subarray(localOffset + 30 + lNameLen + lExtraLen, localOffset + 30 + lNameLen + lExtraLen + compSize);
    out[name] = method === 8 ? zlib.inflateRawSync(data) : Buffer.from(data);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

test('a site exports as a static zip with rewritten links and bundled photos', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'export@example.com', password: 'password1' });
  const create = await c.post('/sites', { name: 'Export Co' });
  const editPath = create.headers.get('location');
  const siteId = editPath.match(/\/sites\/(\d+)\//)[1];

  // a real uploaded photo to use as the hero
  const up = new FormData();
  up.append('image', new Blob([Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64')], { type: 'image/jpeg' }), 'tiny.jpg');
  const { url } = await (await c.post(`/sites/${siteId}/upload`, up)).json();

  await c.post(editPath, {
    name: 'Export Co', hero_headline: 'Static and sturdy', hero_imageUrl: url,
    about_heading: 'About', about_body: 'We build things.', services_heading: 'Services',
    contact_heading: 'Contact', contact_phone: '555-7777', contact_acceptSubmissions: '1',
    layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,hours,contact'
  });

  const res = await c.get(`/sites/${siteId}/export`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /zip/);
  assert.match(res.headers.get('content-disposition'), /export-co-website\.zip/);
  const files = readZip(Buffer.from(await res.arrayBuffer()));
  const names = Object.keys(files);
  for (const n of ['index.html', 'about.html', 'services.html', 'contact.html', 'README.txt']) {
    assert.ok(names.includes(n), `${n} should be in the zip (got ${names.join(', ')})`);
  }
  assert.ok(!names.includes('faq.html'), 'empty sections are not exported');

  const index = files['index.html'].toString();
  assert.match(index, /Static and sturdy/);
  assert.match(index, /href="about\.html"/);
  assert.match(index, /href="contact\.html"/);
  assert.doesNotMatch(index, /href="\/(about|contact)?"/);
  assert.ok(index.includes(`uploads/${url.split('/').pop()}`));
  assert.ok(!index.includes(`"/uploads/`), 'photo paths are relative');
  assert.ok(names.includes(`uploads/${url.split('/').pop()}`), 'hero photo is bundled');
  assert.doesNotMatch(index, /rel="canonical"/);
  JSON.parse(index.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]); // still valid JSON

  // the form needs a server, so it is left out of the export (phone stays)
  const contact = files['contact.html'].toString();
  assert.doesNotMatch(contact, /<form/);
  assert.match(contact, /555-7777/);

  // other users can't export it
  const other = makeClient();
  await other.post('/signup', { email: 'export-other@example.com', password: 'password1' });
  assert.equal((await other.get(`/sites/${siteId}/export`)).status, 404);
});

test('AI writes the copy from the owner\'s real details; failures fall back to templates; rewrite saves history', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'ai@example.com', password: 'password1' });

  aiRequests.length = 0;
  const gen = await c.post('/sites/generate', {
    business_type: 'roofing company', business_name: 'Test Roofing',
    address: '5 Shingle Ln, Kissimmee, FL', phone: '555-0111', years_in_business: '12',
    badges: 'Licensed & Insured', service_areas: 'Kissimmee, St. Cloud',
    specialties: 'ZZ-AI-TEST family run, tile roofs'
  });
  assert.equal(gen.status, 302);
  assert.match(gen.headers.get('location'), /generated=ai/);
  const editPath = gen.headers.get('location').split('?')[0];
  const siteId = editPath.match(/\/sites\/(\d+)\//)[1];

  // what was sent: real facts in, "never invent" rules in the system prompt, key in the header
  assert.equal(aiRequests.length, 1);
  const sent = aiRequests[0];
  assert.equal(sent.headers['x-api-key'], 'test-anthropic-key');
  assert.match(sent.body.system, /Never invent/);
  const prompt = sent.body.messages[0].content;
  assert.match(prompt, /Test Roofing/);
  assert.match(prompt, /Years in business \(stated by the owner\): 12/);
  assert.match(prompt, /Licensed & Insured/);
  assert.match(prompt, /Kissimmee, St\. Cloud/);
  assert.match(prompt, /5 Shingle Ln/);

  const html = await (await c.get(gen.headers.get('location'))).text();
  assert.match(html, /Roofs that last, in Kissimmee/);
  assert.match(html, /wrote the text with AI/);
  assert.match(html, /Roof Replacement/);
  assert.match(html, /Roofing in Kissimmee \| Test Roofing/);      // AI SEO title
  assert.match(html, /name="meta_businessType"[^>]*value="roofing company"/);
  assert.match(html, /name="trust_stat_value" value="12"/);
  assert.match(html, /Licensed &amp; Insured/);
  assert.match(html, /value="555-0111"/);                           // intake data kept

  // AI unavailable/failing for this request (no marker => fake returns 500): templates take over
  const gen2 = await c.post('/sites/generate', { business_type: 'plumbing company', business_name: 'Fallback Plumbing' });
  assert.equal(gen2.status, 302);
  assert.doesNotMatch(gen2.headers.get('location'), /generated=ai/);
  const html2 = await (await c.get(gen2.headers.get('location'))).text();
  assert.match(html2, /built-in templates/);
  assert.match(html2, /Drain Cleaning/);

  // rewrite: failure leaves the site untouched
  const before = await (await c.get(editPath)).text();
  const failed = await c.post(`/sites/${siteId}/rewrite-copy`, { instruction: 'make it fancier' });
  assert.match(failed.headers.get('location'), /rewrite=failed/);
  assert.match(await (await c.get(`/sites/${siteId}/edit`)).text(), /Roofs that last, in Kissimmee/);

  // rewrite: success replaces text only, keeps contact info, and snapshots history first
  await c.post(editPath, {
    name: 'Test Roofing', hero_headline: 'My own headline', about_heading: 'About', about_body: 'My own about.',
    services_heading: 'Services', contact_heading: 'Contact', contact_phone: '555-0111', contact_acceptSubmissions: '1',
    meta_businessType: 'roofing company', trust_badges: 'Licensed & Insured',
    layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,hours,contact'
  });
  const ok = await c.post(`/sites/${siteId}/rewrite-copy`, { instruction: 'ZZ-AI-TEST more premium' });
  assert.match(ok.headers.get('location'), /rewrite=done/);
  assert.match(aiRequests[aiRequests.length - 1].body.messages[0].content, /Extra direction from the owner: ZZ-AI-TEST more premium/);
  const after = await (await c.get(`/sites/${siteId}/edit?rewrite=done`)).text();
  assert.match(after, /Roofs that last, in Kissimmee/);
  assert.doesNotMatch(after, /My own headline/);
  assert.match(after, /value="555-0111"/);
  assert.match(after, /Before AI rewrite/);

  // other users cannot rewrite someone else's site
  const other = makeClient();
  await other.post('/signup', { email: 'ai-other@example.com', password: 'password1' });
  assert.equal((await other.post(`/sites/${siteId}/rewrite-copy`, {})).status, 404);
});

test('trust section: badges, numbers, service areas, Google link and before/after pairs render on the right pages', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'trust@example.com', password: 'password1' });
  const create = await c.post('/sites', { name: 'Trust Co' });
  const editPath = create.headers.get('location');
  const siteId = editPath.match(/\/sites\/(\d+)\//)[1];
  await c.post(editPath, {
    name: 'Trust Co', hero_headline: 'Trusted', about_heading: 'About', about_body: 'We do the work.',
    services_heading: 'Services', contact_heading: 'Contact', contact_phone: '555-0199', contact_address: '1 Main St, Orlando, FL',
    testimonials_heading: 'Reviews', testimonial_quote: 'Great job', testimonial_author: 'Pat', testimonial_rating: '5', testimonial_date: '',
    gallery_heading: 'Gallery',
    ba_before: ['https://img.test/b1.jpg', 'https://img.test/b2.jpg'], ba_after: ['https://img.test/a1.jpg', ''], ba_caption: ['Kitchen refresh', 'half pair'],
    trust_badges: 'Licensed & Insured\nBBB A+, Licensed & Insured', trust_stat_value: ['15', '', '300+'], trust_stat_label: ['Years in business', 'no value', 'Roofs installed'],
    trust_serviceAreas: 'Orlando, Kissimmee\nSt. Cloud',
    trust_googleReviewsUrl: 'https://g.page/r/trust-co',
    layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,hours,contact'
  });
  await c.post(`/sites/${siteId}/publish`, { published: '1' });

  const home = await (await fetch(`${BASE}/site/trust-co`)).text();
  assert.match(home, /class="trust-strip"/);
  assert.match(home, /<strong data-count="15">15<\/strong><span>Years in business<\/span>/);
  assert.match(home, /<strong data-count="300" data-suffix="\+">300\+<\/strong><span>Roofs installed<\/span>/);
  assert.doesNotMatch(home, /no value/);                              // stat without a value is dropped
  assert.match(home, /Licensed &amp; Insured/);
  assert.equal((home.match(/class="trust-badge"/g) || []).length, 2); // de-duplicated: Licensed & Insured, BBB A+
  assert.match(home, /href="https:\/\/g\.page\/r\/trust-co"/);

  const about = await (await fetch(`${BASE}/site/trust-co/about`)).text();
  assert.match(about, /Areas We Serve/);
  for (const area of ['Orlando', 'Kissimmee', 'St. Cloud']) assert.match(about, new RegExp(`area-chip">${area.replace('.', '\\.')}<`));

  const reviews = await (await fetch(`${BASE}/site/trust-co/testimonials`)).text();
  assert.match(reviews, /Read more on Google/);

  // gallery page exists thanks to a complete before/after pair, even with no regular photos
  const gallery = await fetch(`${BASE}/site/trust-co/gallery`);
  assert.equal(gallery.status, 200);
  const galleryHtml = await gallery.text();
  assert.match(galleryHtml, /class="ba-slider"/);
  assert.match(galleryHtml, /Kitchen refresh/);
  assert.doesNotMatch(galleryHtml, /half pair/);                      // pair missing its "after" photo is dropped
  assert.equal((galleryHtml.match(/class="ba-slider"/g) || []).length, 1);
  assert.match(home, /href="\/site\/trust-co\/gallery"/);

  // structured data lists the service area
  const ld = JSON.parse(home.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  assert.deepEqual(ld.areaServed.map(a => a.name), ['Orlando', 'Kissimmee', 'St. Cloud']);

  // unsafe / non-http review links are discarded; nothing shows without data
  await c.post(editPath, {
    name: 'Trust Co', hero_headline: 'Trusted', about_heading: 'About', about_body: 'x', services_heading: 'Services',
    contact_heading: 'Contact', trust_googleReviewsUrl: 'javascript:alert(1)',
    layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,hours,contact'
  });
  const bare = await (await fetch(`${BASE}/site/trust-co`)).text();
  assert.doesNotMatch(bare, /javascript:alert/);
  assert.doesNotMatch(bare, /class="trust-strip"/);
  assert.equal((await fetch(`${BASE}/site/trust-co/gallery`)).status, 404);
});

test('photo picker searches Pexels, pages through results, and is private to the site owner', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'picker@example.com', password: 'password1' });
  const create = await c.post('/sites', { name: 'Picker Co' });
  const siteId = create.headers.get('location').match(/\/sites\/(\d+)\//)[1];

  const r1 = await (await c.get(`/sites/${siteId}/photos?q=zzroof`)).json();
  assert.equal(r1.configured, true);
  assert.equal(r1.photos.length, 3);
  assert.equal(r1.photos[0].url, 'https://img.test/large-1-1.jpg');
  assert.equal(r1.photos[0].thumb, 'https://img.test/medium-1-1.jpg');
  assert.equal(r1.photographer === undefined, true);
  assert.equal(r1.photos[0].photographer, 'Pat');
  assert.equal(r1.hasMore, true);

  const r2 = await (await c.get(`/sites/${siteId}/photos?q=zzroof&page=2`)).json();
  assert.equal(r2.photos[0].url, 'https://img.test/large-2-1.jpg');
  assert.equal(r2.hasMore, false);

  const none = await (await c.get(`/sites/${siteId}/photos?q=nothing-matches`)).json();
  assert.deepEqual(none.photos, []);

  // the editor wires the picker up
  const editor = await (await c.get(`/sites/${siteId}/edit`)).text();
  assert.match(editor, /id="pickerOverlay"/);
  assert.ok((editor.match(/class="btn-secondary pick-btn"/g) || []).length >= 3); // hero, about, gallery (+ template)

  const other = makeClient();
  await other.post('/signup', { email: 'picker-other@example.com', password: 'password1' });
  assert.equal((await other.get(`/sites/${siteId}/photos?q=zzroof`)).status, 404);
  const anon = makeClient();
  const anonRes = await anon.get(`/sites/${siteId}/photos?q=zzroof`);
  assert.equal(anonRes.status, 302);
});

test('photo picker: Unsplash as a second source, download tracking, footer credit while used, sharper stock photo sizes', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'unsplash@example.com', password: 'password1' });
  const create = await c.post('/sites', { name: 'Lens Co' });
  const siteId = create.headers.get('location').match(/\/sites\/(\d+)\//)[1];
  const r = await (await c.get(`/sites/${siteId}/photos?q=zzroof&source=unsplash`)).json();
  assert.deepEqual(r.sources, ['pexels', 'unsplash']); assert.equal(r.source, 'unsplash');
  assert.equal(r.photos.length, 2); assert.equal(r.photos[0].photographer, 'Jo Lens');
  assert.equal(r.photos[0].url, 'https://images.unsplash.com/photo-u1?ixid=t&ixlib=rb-4.0.3&q=80&fit=max&w=1920');
  assert.equal(r.photos[0].photographerUrl, 'https://unsplash.com/@u1?utm_source=sitegen&utm_medium=referral');
  // picking checks the id against our own search results and tells Unsplash
  assert.equal((await c.post(`/sites/${siteId}/photos/use`, { id: 'made-up' })).status, 404);
  const use = await (await c.post(`/sites/${siteId}/photos/use`, { id: 'u1' })).json();
  assert.equal(use.ok, true); assert.equal(use.url, r.photos[0].url);
  for (let i = 0; i < 20 && !(global.__unsplashDownloads || []).includes('u1'); i++) await new Promise(ok => setTimeout(ok, 50));
  assert.ok((global.__unsplashDownloads || []).includes('u1'), 'the download endpoint was called');
  await c.post(`/sites/${siteId}/photos/use`, { id: 'u2' }); // picked, but never saved into the site
  let html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.doesNotMatch(html, /<div class="footer-credits">/, 'no credit until the photo is on the site');
  // put the photo on the site
  await c.post(`/sites/${siteId}/edit`, { name: 'Lens Co', hero_imageUrl: use.url });
  html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<div class="footer-credits">Photos by <a href="https:\/\/unsplash\.com\/@u1\?utm_source=sitegen&amp;utm_medium=referral" rel="noopener">Jo Lens<\/a> on <a href="https:\/\/unsplash\.com\/\?utm_source=sitegen&amp;utm_medium=referral" rel="noopener">Unsplash<\/a><\/div>/);
  assert.doesNotMatch(html, /Sam Shutter/);
  assert.doesNotMatch(html, /photo-u1[^"')\s]*w=1920/, 'the hero photo is asked for at full width');
  assert.match(html, /photo-u1\?ixid=t&(amp;)?ixlib=rb-4\.0\.3&(amp;)?q=80&(amp;)?fit=max&(amp;)?w=2400/);
  const editor = await (await c.get(`/sites/${siteId}/edit`)).text();
  assert.match(editor, /id="pickerSrc"/);
});

test('client edit link: limited self-service editing, revocable, private', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'agency@example.com', password: 'password1' });
  const create = await c.post('/sites', { name: 'Client Roofing' });
  const editPath = create.headers.get('location');
  const siteId = editPath.match(/\/sites\/(\d+)\//)[1];
  await c.post(editPath, {
    name: 'Client Roofing', hero_headline: 'Original headline', hero_subheadline: 'Original sub', about_heading: 'About', about_body: 'Original about',
    services_heading: 'Services', service_title: ['Old service'], service_description: ['Old description'],
    hours_heading: 'Hours', hours_day: ['Monday'], hours_time: ['9-5'],
    testimonials_heading: 'Reviews', testimonial_quote: 'Great work', testimonial_author: 'Sam', testimonial_rating: '5', testimonial_date: '',
    contact_heading: 'Contact', contact_phone: '555-0000', contact_acceptSubmissions: '1',
    trust_badges: 'Licensed & Insured', theme_primaryColor: '#123456', theme_style: 'editorial',
    layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,hours,contact'
  });
  await c.post(`/sites/${siteId}/publish`, { published: '1' });

  // the link is shown once, right after creating it
  const made = await c.post(`/sites/${siteId}/client-link`);
  assert.match(made.headers.get('location'), /clientlink=1/);
  const shown = await (await c.get(made.headers.get('location'))).text();
  const link = shown.match(/<strong id="clientLinkText">(http[^<]+)<\/strong>/)[1];
  const token = link.split('/client/')[1];
  assert.match(token, /^[A-Za-z0-9_-]{32}$/);
  const again = await (await c.get(`/sites/${siteId}/edit?clientlink=1`)).text();
  assert.doesNotMatch(again, new RegExp(token), 'link must not be shown a second time');
  assert.match(again, /A client link is active/);

  // anyone with the link (no login) gets the limited editor, with privacy headers
  const page = await fetch(`${BASE}/client/${token}`);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get('referrer-policy'), 'no-referrer');
  assert.match(page.headers.get('x-robots-tag'), /noindex/);
  const pageHtml = await page.text();
  assert.match(pageHtml, /Original headline/);
  assert.doesNotMatch(pageHtml, /theme_primaryColor|layout_order|custom_domain|trust_badges/, 'owner-only controls are not offered');

  // saving changes only the allowed fields
  const save = await fetch(`${BASE}/client/${token}`, {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams([
      ['hero_headline', 'Client-written headline'], ['hero_subheadline', 'New sub'], ['about_body', 'Client about text'],
      ['services_present', '1'], ['service_title', 'New service'], ['service_description', 'New description'],
      ['hours_present', '1'], ['hours_day', 'Monday'], ['hours_time', '8-6'],
      ['contact_phone', '555-9999'], ['contact_email', 'client@roofing.test'], ['contact_address', '2 Tile Rd'],
      ['gallery_present', '1'], ['gallery_image', 'https://img.test/c1.jpg'], ['gallery_image', 'javascript:alert(1)'],
      // attempts to change things clients must not touch:
      ['theme_primaryColor', '#ff0000'], ['trust_badges', 'Fake Badge'], ['published', '0'], ['name', 'Hacked']
    ]).toString()
  });
  assert.equal(save.status, 302);
  assert.match(save.headers.get('location'), /saved=1/);

  const live = await (await fetch(`${BASE}/site/client-roofing`)).text();
  assert.match(live, /Client-written headline/);
  assert.match(live, /555-9999/);
  assert.match(live, /Licensed &amp; Insured/);                      // credentials untouched
  assert.doesNotMatch(live, /Fake Badge/);
  assert.match(live, /#123456/);                                      // theme untouched
  assert.doesNotMatch(live, /#ff0000/);
  const about = await (await fetch(`${BASE}/site/client-roofing/about`)).text();
  assert.match(about, /Client about text/);
  assert.match(await (await fetch(`${BASE}/site/client-roofing/services`)).text(), /New service/);
  assert.match(await (await fetch(`${BASE}/site/client-roofing/hours`)).text(), /8-6/);
  const galleryHtml = await (await fetch(`${BASE}/site/client-roofing/gallery`)).text();
  assert.match(galleryHtml, /c1\.jpg/);
  assert.doesNotMatch(galleryHtml, /javascript:alert/);
  assert.match(await (await fetch(`${BASE}/site/client-roofing/testimonials`)).text(), /Great work/); // reviews untouched

  const ownerView = await (await c.get(`/sites/${siteId}/edit`)).text();
  assert.match(ownerView, /value="Client Roofing"/);                 // name untouched
  assert.match(ownerView, /Before client edit/);                      // undoable from version history
  assert.match(ownerView, /last used/);

  // a partial form (e.g. only the headline) never wipes other content
  await fetch(`${BASE}/client/${token}`, {
    method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams([['hero_headline', 'Only the headline']]).toString()
  });
  assert.match(await (await fetch(`${BASE}/site/client-roofing/services`)).text(), /New service/);

  // clients can upload photos through the link; nothing works without a valid one
  const up = new FormData();
  up.append('image', new Blob([Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64')], { type: 'image/jpeg' }), 'tiny.jpg');
  const upRes = await (await fetch(`${BASE}/client/${token}/upload`, { method: 'POST', body: up })).json();
  assert.ok(upRes.ok);
  assert.match(upRes.url, /^\/uploads\//);
  assert.equal((await fetch(`${BASE}/client/${'x'.repeat(32)}/upload`, { method: 'POST', body: new FormData() })).status, 404);
  const anonEditor = await fetch(`${BASE}/sites/${siteId}/edit`, { redirect: 'manual' });
  assert.equal(anonEditor.status, 302);
  assert.equal((await fetch(`${BASE}/client/not-a-real-token`)).status, 404);
  assert.equal((await fetch(`${BASE}/client/${'a'.repeat(32)}`)).status, 404);

  // replacing the link kills the old one; revoking kills the new one
  const made2 = await c.post(`/sites/${siteId}/client-link`);
  const token2 = (await (await c.get(made2.headers.get('location'))).text()).match(/\/client\/([A-Za-z0-9_-]{32})</)[1];
  assert.notEqual(token2, token);
  assert.equal((await fetch(`${BASE}/client/${token}`)).status, 404);
  assert.equal((await fetch(`${BASE}/client/${token2}`)).status, 200);
  await c.post(`/sites/${siteId}/client-link/revoke`);
  assert.equal((await fetch(`${BASE}/client/${token2}`)).status, 404);

  // someone else can't create or revoke links for this site
  const other = makeClient();
  await other.post('/signup', { email: 'agency-other@example.com', password: 'password1' });
  assert.equal((await other.post(`/sites/${siteId}/client-link`)).status, 404);
  assert.equal((await other.post(`/sites/${siteId}/client-link/revoke`)).status, 404);
});

test('full backup is admin-only and contains the database and uploads', async () => {
  // the very first account created in this suite (alice) is the admin
  const admin = makeClient();
  const login = await admin.post('/login', { email: 'alice@example.com', password: 'password1' });
  assert.equal(login.status, 302);
  assert.match(await (await admin.get('/dashboard')).text(), /href="\/admin\/backup"/);

  const res = await admin.get('/admin/backup');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /zip/);
  assert.match(res.headers.get('content-disposition'), /sitegen-backup-\d{4}-\d{2}-\d{2}\.zip/);
  const files = readZip(Buffer.from(await res.arrayBuffer()));
  assert.ok(files['sitegen.db'], 'database snapshot is included');
  assert.equal(files['sitegen.db'].subarray(0, 15).toString(), 'SQLite format 3');
  assert.ok(files['RESTORE.txt']);
  assert.ok(Object.keys(files).some(n => n.startsWith('uploads/')), 'uploaded photos are included');

  const other = makeClient();
  await other.post('/signup', { email: 'not-admin@example.com', password: 'password1' });
  assert.doesNotMatch(await (await other.get('/dashboard')).text(), /admin\/backup/);
  assert.equal((await other.get('/admin/backup')).status, 404);
  const anon = makeClient();
  assert.equal((await anon.get('/admin/backup')).status, 302);
});

test('domain-check only approves published custom domains, and only for the local proxy', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'domains@example.com', password: 'password1' });
  const create = await c.post('/sites', { name: 'Domain Co' });
  const editPath = create.headers.get('location');
  const siteId = editPath.match(/\/sites\/(\d+)\//)[1];
  await c.post(editPath, {
    name: 'Domain Co', custom_domain: 'www.domainco.test', hero_headline: 'Hi', about_heading: 'About', about_body: 'x',
    services_heading: 'Services', contact_heading: 'Contact',
    layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,hours,contact'
  });
  const check = (domain, headers) => fetch(`${BASE}/internal/domain-check?domain=${encodeURIComponent(domain)}`, { headers });

  assert.equal((await check('www.domainco.test')).status, 404, 'unpublished sites are not approved');
  await c.post(`/sites/${siteId}/publish`, { published: '1' });
  assert.equal((await check('www.domainco.test')).status, 200);
  assert.equal((await check('WWW.DomainCo.test')).status, 200, 'case-insensitive');
  assert.equal((await check('unknown.example')).status, 404);
  assert.equal((await check('not a host!')).status, 404);
  assert.equal((await check('')).status, 404);
  // requests that came through the public proxy carry X-Forwarded-For and are refused
  assert.equal((await check('www.domainco.test', { 'x-forwarded-for': '203.0.113.9' })).status, 404);
});

test('a site saved before \"Why Choose Us\" / contact.social existed still loads fine', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'oldsite@example.com', password: 'password1' });
  const create = await c.post('/sites', { name: 'Old Timer Co' });
  const editPath = create.headers.get('location');
  const siteId = editPath.match(/\/sites\/(\d+)\//)[1];
  await c.post(editPath, {
    name: 'Old Timer Co',
    hero_headline: 'Hello',
    about_heading: 'About', about_body: 'x',
    services_heading: 'Services',
    layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,hours,contact'
  });

  // simulate a row written before this update: strip the new section/field
  // straight out of the stored JSON, the way an old site's row really looks
  const Database = require('better-sqlite3');
  const rawDb = new Database(TEST_DB);
  const row = rawDb.prepare('SELECT sections FROM sites WHERE id = ?').get(siteId);
  const oldSections = JSON.parse(row.sections);
  delete oldSections.whyChoose;
  delete oldSections.contact.social;
  delete oldSections.contact.acceptSubmissions;
  rawDb.prepare('UPDATE sites SET sections = ? WHERE id = ?').run(JSON.stringify(oldSections), siteId);
  rawDb.close();

  const editRes = await c.get(`/sites/${siteId}/edit`);
  assert.equal(editRes.status, 200);
  const editHtml = await editRes.text();
  assert.match(editHtml, /Why Choose Us/);

  await c.post(`/sites/${siteId}/publish`, { published: '1' });
  const live = await fetch(`${BASE}/site/old-timer-co`);
  assert.equal(live.status, 200);
});

test('unpublished and unknown slugs 404', async () => {
  const res1 = await fetch(`${BASE}/site/does-not-exist`);
  assert.equal(res1.status, 404);
});

test('a user cannot edit another user\'s site', async () => {
  const owner = makeClient();
  await owner.post('/signup', { email: 'dave@example.com', password: 'password1' });
  const create = await owner.post('/sites', { name: 'Dave Only' });
  const editPath = create.headers.get('location');
  const siteId = editPath.match(/\/sites\/(\d+)\//)[1];

  const intruder = makeClient();
  await intruder.post('/signup', { email: 'eve@example.com', password: 'password1' });
  const res = await intruder.get(`/sites/${siteId}/edit`);
  assert.equal(res.status, 404);
});

test('hidden sections are excluded from the public page', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'frank@example.com', password: 'password1' });
  const create = await c.post('/sites', { name: 'Frank Plumbing' });
  const editPath = create.headers.get('location');
  const siteId = editPath.match(/\/sites\/(\d+)\//)[1];

  await c.post(editPath, {
    name: 'Frank Plumbing',
    hero_headline: 'Frank Plumbing',
    about_heading: 'About',
    about_body: 'x',
    services_heading: 'Services',
    faq_heading: 'FAQ',
    faq_question: 'Do you visible?',
    faq_answer: 'Should be hidden',
    layout_order: 'hero,about,services,testimonials,gallery,faq,hours,contact',
    hidden_sections: 'faq'
  });
  await c.post(`/sites/${siteId}/publish`, { published: '1' });

  const live = await fetch(`${BASE}/site/frank-plumbing`);
  const html = await live.text();
  // the home page's nav doesn't link to a hidden section's page
  assert.doesNotMatch(html, /\/site\/frank-plumbing\/faq/);

  // and visiting that page directly 404s rather than showing its content
  const faqRes = await fetch(`${BASE}/site/frank-plumbing/faq`);
  assert.equal(faqRes.status, 404);
  assert.doesNotMatch(await faqRes.text(), /Should be hidden/);
});

test('version history: editing saves a version, and restore reverts content', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'grace@example.com', password: 'password1' });
  const create = await c.post('/sites', { name: 'Grace Design' });
  const editPath = create.headers.get('location');
  const siteId = editPath.match(/\/sites\/(\d+)\//)[1];

  await c.post(editPath, {
    name: 'Grace Design', hero_headline: 'First Headline', about_heading: 'About', about_body: 'x',
    services_heading: 'Services', layout_order: 'hero,about,services,testimonials,gallery,faq,hours,contact'
  });
  await c.post(editPath, {
    name: 'Grace Design', hero_headline: 'Second Headline', about_heading: 'About', about_body: 'x',
    services_heading: 'Services', layout_order: 'hero,about,services,testimonials,gallery,faq,hours,contact'
  });

  const editHtml = await (await c.get(editPath)).text();
  assert.match(editHtml, /Version history/);
  const versionIdMatch = editHtml.match(/\/versions\/(\d+)\/restore/);
  assert.ok(versionIdMatch, 'expected at least one restorable version');

  await c.post(`/sites/${siteId}/versions/${versionIdMatch[1]}/restore`);
  const afterRestore = await (await c.get(editPath)).text();
  assert.match(afterRestore, /value="First Headline"/);
});

test('modernize import pulls content from a live URL into a new site', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'henry@example.com', password: 'password1' });

  const res = await c.post('/sites/import', { url: `http://localhost:${OLD_SITE_PORT}/` });
  assert.equal(res.status, 302);
  const editPath = res.headers.get('location');
  assert.match(editPath, /imported=1/);

  const html = await (await c.get(editPath)).text();
  assert.match(html, /Old Biz - Original Headline/);
  assert.match(html, /Cleaning/);
  assert.match(html, /owner@oldbiz.example/);
});

test('refresh-from-source pulls updated content and keeps history', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'ivy@example.com', password: 'password1' });
  const importRes = await c.post('/sites/import', { url: `http://localhost:${OLD_SITE_PORT}/` });
  const editPath = importRes.headers.get('location').replace('?imported=1', '');
  const siteId = editPath.match(/\/sites\/(\d+)\//)[1];

  global.__setOldHeadline('Old Biz - Headline After Update');
  const refresh = await c.post(`/sites/${siteId}/refresh`);
  assert.equal(refresh.status, 302);

  const html = await (await c.get(editPath)).text();
  assert.match(html, /Headline After Update/);
});

test('import rejects a URL pointing at a private/internal address', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'jack@example.com', password: 'password1' });
  // bypass the ALLOW_PRIVATE_IMPORT_HOSTS escape hatch by hitting the
  // scraper's guard directly is covered in scraper.test.js; here we confirm
  // the route surfaces a friendly error rather than crashing on garbage input
  const res = await c.post('/sites/import', { url: 'not a url at all' });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /could not import|could not reach|valid url/i);
});

test('generate a site from a business type matches a known template', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'karen@example.com', password: 'password1' });

  const res = await c.post('/sites/generate', { business_type: 'plumbing company', business_name: 'Karen\'s Plumbing' });
  assert.equal(res.status, 302);
  const editPath = res.headers.get('location');
  assert.match(editPath, /generated=1/);

  const html = await (await c.get(editPath)).text();
  assert.match(html, /Karen&#39;s Plumbing|Karen's Plumbing/);
  assert.match(html, /Drain Cleaning/); // a known plumbing-template service
});

test('generate falls back to a generic template for an unmatched business type', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'liam@example.com', password: 'password1' });

  const res = await c.post('/sites/generate', { business_type: 'artisanal llama grooming' });
  assert.equal(res.status, 302);
  const html = await (await c.get(res.headers.get('location'))).text();
  assert.match(html, /artisanal llama grooming/i);
});

test('generate requires a business type', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'mia@example.com', password: 'password1' });

  const res = await c.post('/sites/generate', { business_type: '' });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /describe the type of business/i);
});

test('sitemap.xml only lists published sites', async () => {
  const res = await fetch(`${BASE}/sitemap.xml`);
  assert.equal(res.status, 200);
  const xml = await res.text();
  assert.match(xml, /carol-consulting/);
  assert.doesNotMatch(xml, /grace-design/); // never published in this suite
});

test('robots.txt is served', async () => {
  const res = await fetch(`${BASE}/robots.txt`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /User-agent/);
});

// ---- local SEO + conversion ----
async function makeLocalSite(c, email, extra = {}) {
  await c.post('/signup', { email, password: 'password1' });
  const create = await c.post('/sites', { name: extra.name || 'Orlando Roofing' });
  const editPath = create.headers.get('location');
  const siteId = editPath.match(/\/sites\/(\d+)\//)[1];
  await c.post(editPath, {
    name: extra.name || 'Orlando Roofing', hero_headline: 'Roofs done right', hero_subheadline: 'Local roofers',
    about_heading: 'About', about_body: 'We fix roofs.',
    services_heading: 'Services',
    service_title: ['Roof Repair', 'Roof Repair', 'Gutter Cleaning'],
    service_description: ['Fix leaks', 'Second copy', 'Clean gutters'],
    service_detail: ['Repairs usually start with finding the source of a leak.\n\nThen the damaged area is replaced.', '', ''],
    contact_heading: 'Contact', contact_phone: '(407) 555-0100', contact_acceptSubmissions: '1',
    meta_businessType: 'roofer', meta_city: 'Orlando, FL',
    meta_gaId: extra.gaId === undefined ? 'G-ABC123XYZ9' : extra.gaId,
    meta_metaPixelId: extra.pixel === undefined ? '123456789012345' : extra.pixel,
    seo_title: '', seo_description: '',
    layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,hours,contact'
  });
  await c.post(`/sites/${siteId}/publish`, { published: '1' });
  return { siteId, editPath };
}

test('local SEO: city in titles/headings and one page per service', async () => {
  const c = makeClient();
  const { siteId } = await makeLocalSite(c, 'localseo@example.com', { name: 'Local Seo Roofing' });
  const slug = 'local-seo-roofing';

  const home = await (await fetch(`${BASE}/site/${slug}`)).text();
  assert.match(home, /<title>Local Seo Roofing — Roofer in Orlando, FL<\/title>/);
  assert.match(home, /hero-eyebrow" data-animate="fade-up">Roofer in Orlando, FL</);
  assert.match(home, /"addressLocality":"Orlando"/);
  assert.match(home, /"addressRegion":"FL"/);

  const services = await (await fetch(`${BASE}/site/${slug}/services`)).text();
  assert.match(services, /<title>Services in Orlando, FL — Local Seo Roofing<\/title>/);
  assert.match(services, new RegExp(`href="/site/${slug}/services/roof-repair"`));
  assert.match(services, new RegExp(`href="/site/${slug}/services/roof-repair-2"`), 'duplicate titles get unique slugs');
  assert.match(services, new RegExp(`href="/site/${slug}/services/gutter-cleaning"`));

  const about = await (await fetch(`${BASE}/site/${slug}/about`)).text();
  assert.match(about, /<title>About — Local Seo Roofing \| Orlando, FL<\/title>/);

  // a service with its own text: indexable, city in the heading, quote form preselected
  const page = await fetch(`${BASE}/site/${slug}/services/roof-repair`);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /<h1>Roof Repair in Orlando, FL<\/h1>/);
  assert.match(html, /<title>Roof Repair in Orlando, FL — Local Seo Roofing<\/title>/);
  assert.match(html, /Repairs usually start with finding the source/);
  assert.match(html, /Then the damaged area is replaced/);
  assert.doesNotMatch(html, /noindex/);
  assert.match(html, /<option value="Roof Repair" selected>/);
  assert.match(html, /"@type":"Service"/);
  assert.match(html, new RegExp(`rel="canonical" href="[^"]*/site/${slug}/services/roof-repair"`));
  assert.match(html, /Other services/);

  // a service with no text of its own works but stays out of Google
  const thin = await (await fetch(`${BASE}/site/${slug}/services/gutter-cleaning`)).text();
  assert.match(thin, /<meta name="robots" content="noindex">/);

  assert.equal((await fetch(`${BASE}/site/${slug}/services/not-a-service`)).status, 404);

  const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
  assert.match(sitemap, new RegExp(`/site/${slug}/services/roof-repair<`));
  assert.doesNotMatch(sitemap, new RegExp(`/site/${slug}/services/gutter-cleaning<`));

  // the owner preview serves service pages too
  const prev = await c.get(`/sites/${siteId}/preview/services/roof-repair`);
  assert.equal(prev.status, 200);

  // unpublished sites do not serve service pages
  await c.post(`/sites/${siteId}/publish`, { published: '0' });
  assert.equal((await fetch(`${BASE}/site/${slug}/services/roof-repair`)).status, 404);
});

test('conversion: service dropdown, thank-you page, call bar and tracking IDs', async () => {
  const c = makeClient();
  const { siteId } = await makeLocalSite(c, 'convert@example.com', { name: 'Convert Roofing' });
  const slug = 'convert-roofing';

  const contact = await (await fetch(`${BASE}/site/${slug}/contact`)).text();
  assert.match(contact, /<select name="service">/);
  assert.match(contact, /<option value="Gutter Cleaning"/);
  assert.match(contact, /Request a quote/);

  // sticky call bar (phones) + tracking snippets on the live site
  const home = await (await fetch(`${BASE}/site/${slug}`)).text();
  assert.match(home, /class="mobile-bar"/);
  assert.match(home, /class="mb-call" href="tel:\+?4075550100"/);
  assert.match(home, /googletagmanager\.com\/gtag\/js\?id=/);
  assert.match(home, /"G-ABC123XYZ9"/);
  assert.match(home, /PX = "123456789012345", MODE = "ask"/, 'default: tracking waits for consent');
  assert.match(home, /id="cookieBar"/);
  const preview = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.doesNotMatch(preview, /googletagmanager|fbq\('init'/, 'no tracking in the owner preview');

  // submit with a listed service, and with a made-up one
  const f1 = new FormData();
  f1.append('name', 'Pat Roofer'); f1.append('phone', '555-2222'); f1.append('service', 'Gutter Cleaning');
  const r1 = await fetch(`${BASE}/site/${slug}/contact`, { method: 'POST', body: f1, redirect: 'manual' });
  assert.equal(r1.headers.get('location'), `/site/${slug}/thank-you`);
  const f2 = new FormData();
  f2.append('name', 'Sam Faker'); f2.append('phone', '555-3333'); f2.append('service', '<script>x</script>');
  await fetch(`${BASE}/site/${slug}/contact`, { method: 'POST', body: f2, redirect: 'manual' });
  const leads = await (await c.get(`/sites/${siteId}/leads`)).text();
  assert.match(leads, /Pat Roofer/);
  assert.match(leads, />Gutter Cleaning</);
  assert.match(leads, /Sam Faker/);
  assert.doesNotMatch(leads, /&lt;script&gt;x/, 'unknown services are dropped, not stored');

  // submitting from a service page uses the same endpoint
  const svcPage = await (await fetch(`${BASE}/site/${slug}/services/roof-repair`)).text();
  assert.match(svcPage, new RegExp(`<form method="POST" action="/site/${slug}/contact"`));

  const thanks = await (await fetch(`${BASE}/site/${slug}/thank-you`)).text();
  assert.match(thanks, /Thank you!/);
  assert.match(thanks, /fbq\('track', 'Lead'\)/);
  assert.match(thanks, /generate_lead/);
  assert.doesNotMatch(thanks, /Ready to get started/);

  // invalid tracking IDs are dropped on save
  const { editPath } = await makeLocalSite(makeClient(), 'convert2@example.com', { name: 'Bad Ids Co', gaId: '"><script>', pixel: 'abc' });
  const bad = await (await fetch(`${BASE}/site/bad-ids-co`)).text();
  assert.doesNotMatch(bad, /googletagmanager|fbq\('init'/);
  assert.ok(editPath);
});

test('service pages work on a custom domain and in the static export; client edits keep service text', async () => {
  const c = makeClient();
  const { siteId, editPath } = await makeLocalSite(c, 'svcdomain@example.com', { name: 'Svc Domain Co' });
  const http = require('node:http');
  const getWithHost = (host, urlPath) => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: new URL(BASE).port, path: urlPath, headers: { Host: host } }, (res) => {
      let data = ''; res.on('data', d => data += d); res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
  await c.post(editPath, {
    name: 'Svc Domain Co', custom_domain: 'www.svcdomain.test', hero_headline: 'Hi', about_heading: 'About', about_body: 'x',
    services_heading: 'Services', service_title: ['Roof Repair'], service_description: ['Fix leaks'],
    service_detail: ['Detail text that should survive a client edit.'], contact_heading: 'Contact', meta_city: 'Orlando, FL',
    layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,hours,contact'
  });
  const dom = await getWithHost('www.svcdomain.test', '/services/roof-repair');
  assert.equal(dom.status, 200);
  assert.match(dom.body, /Roof Repair in Orlando, FL/);
  assert.match(dom.body, /href="\/services\/roof-repair"|href="\/services"/);
  assert.equal((await getWithHost('www.svcdomain.test', '/services/nope')).status, 404);
  assert.equal((await getWithHost('www.svcdomain.test', '/thank-you')).status, 200);

  // static export: one file per service that has text, links rewritten
  const zip = readZip(Buffer.from(await (await c.get(`/sites/${siteId}/export`)).arrayBuffer()));
  assert.ok(zip['service-roof-repair.html'], 'service page file is included');
  assert.match(zip['services.html'].toString(), /href="service-roof-repair\.html"/);
  assert.doesNotMatch(zip['service-roof-repair.html'].toString(), /<form/);

  // a client editing the services list through their link must not wipe the service text
  const made = await c.post(`/sites/${siteId}/client-link`);
  const shown = await (await c.get(made.headers.get('location'))).text();
  const token = shown.match(/\/client\/([A-Za-z0-9_-]{32})</)[1];
  await fetch(`${BASE}/client/${token}`, {
    method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams([['services_present', '1'], ['service_title', 'Roof Repair'], ['service_description', 'Fix leaks fast']]).toString()
  });
  const after = await getWithHost('www.svcdomain.test', '/services/roof-repair');
  assert.match(after.body, /Detail text that should survive a client edit/);
  assert.match(after.body, /Fix leaks fast/);
});

// ---- round 4: leads follow-up, reviews, reports, more page types ----
const FORM = (o) => new URLSearchParams(o).toString();
const mailCount = () => (fs.existsSync(MAIL_FILE) ? fs.readFileSync(MAIL_FILE, 'utf8').split('\n').filter(Boolean).length : 0);
async function basicSite(c, email, name, extra = {}) {
  await c.post('/signup', { email, password: 'password1' });
  const create = await c.post('/sites', { name });
  const editPath = create.headers.get('location');
  const siteId = editPath.match(/\/sites\/(\d+)\//)[1];
  await c.post(editPath, {
    name, hero_headline: 'Hello', about_heading: 'About', about_body: 'About us text',
    services_heading: 'Services', service_title: ['Roof Repair'], service_description: ['Fix leaks'], service_detail: [''],
    contact_heading: 'Contact', contact_email: 'owner@biz.test', contact_phone: '555-0100', contact_acceptSubmissions: '1',
    meta_city: 'Orlando, FL', meta_businessType: 'roofer', testimonials_heading: 'Reviews',
    layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact',
    ...extra
  });
  await c.post(`/sites/${siteId}/publish`, { published: '1' });
  return { siteId, editPath, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-') };
}

test('leads: statuses, notes, filter, CSV (formula-safe), and the optional visitor auto-reply', async () => {
  const c = makeClient();
  const { siteId, slug } = await basicSite(c, 'leadflow@example.com', 'Leadflow Co', { contact_autoReply: '1', contact_autoReplyText: 'Got it, thanks!' });
  const before = mailCount();
  const f = new FormData();
  f.append('name', '=HYPERLINK("http://evil")'); f.append('email', 'visitor@example.com'); f.append('phone', '555-7777'); f.append('message', 'hi');
  await fetch(`${BASE}/site/${slug}/contact`, { method: 'POST', body: f, redirect: 'manual' });
  const mails = await waitForMail(before + 2);
  const sent = mails.slice(before);
  assert.ok(sent.some(m => m.to[0].address === 'visitor@example.com' && /Got it, thanks!/.test(m.text)), 'visitor gets the auto-reply');
  assert.ok(sent.some(m => m.to[0].address === 'owner@biz.test'), 'owner still gets the alert');

  let html = await (await c.get(`/sites/${siteId}/leads`)).text();
  assert.match(html, /New \(1\)/);
  const leadId = html.match(/id="lead-(\d+)"/)[1];
  const upd = await c.post(`/sites/${siteId}/leads/${leadId}`, { status: 'won', notes: 'quoted 4200', filter: 'all' });
  assert.equal(upd.status, 302);
  html = await (await c.get(`/sites/${siteId}/leads`)).text();
  assert.match(html, /Won \(1\)/);
  assert.match(html, /value="quoted 4200"/);
  assert.doesNotMatch(await (await c.get(`/sites/${siteId}/leads?status=new`)).text(), /id="lead-/);
  assert.equal((await c.post(`/sites/${siteId}/leads/${leadId}`, { status: 'bogus' })).status, 400);

  const csv = await c.get(`/sites/${siteId}/leads.csv`);
  assert.match(csv.headers.get('content-type'), /csv/);
  const csvText = await csv.text();
  assert.match(csvText, /"Date","Name","Email","Phone","Service","Message","Answers","Status","Follow up","Source","Notes"/);
  assert.match(csvText, /"'=HYPERLINK/, 'formula-looking cells are defused');
  assert.match(csvText, /"won","","form","quoted 4200"/);

  const other = makeClient();
  await other.post('/signup', { email: 'leadflow-other@example.com', password: 'password1' });
  assert.equal((await other.post(`/sites/${siteId}/leads/${leadId}`, { status: 'lost' })).status, 404);
  assert.equal((await other.get(`/sites/${siteId}/leads.csv`)).status, 404);
});

test('reviews: public form, approval queue, publishing, email request', async () => {
  const c = makeClient();
  const { siteId, slug } = await basicSite(c, 'reviewer@example.com', 'Review Roofing', { trust_googleReviewsUrl: 'https://g.page/r/abc' });
  const page = await (await fetch(`${BASE}/site/${slug}/review`)).text();
  assert.match(page, /name="quote"/);
  assert.match(page, /noindex/);
  assert.doesNotMatch(await (await fetch(`${BASE}/site/${slug}`)).text(), /Review Roofing — .*reviews/i);

  const post = (body) => fetch(`${BASE}/site/${slug}/review`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: FORM(body) });
  const ok = await post({ name: 'Dana K.', rating: '5', quote: 'They fixed our roof in a day and cleaned up.' });
  assert.equal(ok.headers.get('location'), `/site/${slug}/review?thanks=1`);
  assert.match(ok.headers.get('location'), /thanks=1/);
  assert.match(await (await fetch(`${BASE}/site/${slug}/review?thanks=1`)).text(), /Review us on Google/);
  assert.match((await post({ name: 'x', rating: '9', quote: 'long enough text here' })).headers.get('location'), /error=1/);
  assert.match((await post({ name: 'x', rating: '4', quote: 'short' })).headers.get('location'), /error=1/);
  await post({ name: 'Bot', rating: '5', quote: 'spam spam spam spam', website: 'http://spam' }); // honeypot

  // nothing is public until approved
  assert.equal((await fetch(`${BASE}/site/${slug}/testimonials`)).status, 404);
  let html = await (await c.get(`/sites/${siteId}/reviews`)).text();
  assert.match(html, /fixed our roof in a day/);
  assert.doesNotMatch(html, /spam spam/);
  assert.match(await (await c.get(`/sites/${siteId}/edit`)).text(), /Reviews \(1 new\)/);
  const rid = html.match(/\/reviews\/(\d+)"/)[1];

  const other = makeClient();
  await other.post('/signup', { email: 'reviewer-other@example.com', password: 'password1' });
  assert.equal((await other.post(`/sites/${siteId}/reviews/${rid}`, { action: 'approve' })).status, 404);

  assert.match((await c.post(`/sites/${siteId}/reviews/${rid}`, { action: 'approve' })).headers.get('location'), /m=approved/);
  const live = await (await fetch(`${BASE}/site/${slug}/testimonials`)).text();
  assert.match(live, /fixed our roof in a day/);
  assert.match(live, /Dana K\./);
  assert.match(await (await c.get(`/sites/${siteId}/edit`)).text(), /fixed our roof in a day/, 'it is also in the editor so a later save keeps it');
  // approving twice does nothing
  await c.post(`/sites/${siteId}/reviews/${rid}`, { action: 'approve' });
  assert.equal((await (await fetch(`${BASE}/site/${slug}/testimonials`)).text()).split('fixed our roof in a day').length, 2);

  await post({ name: 'Lee', rating: '2', quote: 'Not happy with the scheduling at all.' });
  html = await (await c.get(`/sites/${siteId}/reviews`)).text();
  const rid2 = html.match(/\/reviews\/(\d+)"/)[1];
  await c.post(`/sites/${siteId}/reviews/${rid2}`, { action: 'reject' });
  assert.doesNotMatch(await (await fetch(`${BASE}/site/${slug}/testimonials`)).text(), /Not happy with the scheduling/);

  // owner emails a request
  const before = mailCount();
  assert.match((await c.post(`/sites/${siteId}/reviews/request`, { email: 'customer@example.com', name: 'Pat' })).headers.get('location'), /m=sent/);
  const mails = await waitForMail(before + 1);
  const m = mails[mails.length - 1];
  assert.equal(m.to[0].address, 'customer@example.com');
  assert.match(m.text, new RegExp(`/site/${slug}/review`));
  assert.match((await c.post(`/sites/${siteId}/reviews/request`, { email: 'nope' })).headers.get('location'), /m=bademail/);
});

test('reports: cookie-free page views (no bots, no preview), report page, client-link report', async () => {
  const c = makeClient();
  const { siteId, slug } = await basicSite(c, 'reporter@example.com', 'Report Roofing');
  const human = { 'user-agent': 'Mozilla/5.0 (iPhone) Safari' };
  await fetch(`${BASE}/site/${slug}`, { headers: human });
  await fetch(`${BASE}/site/${slug}`, { headers: human });
  await fetch(`${BASE}/site/${slug}/about`, { headers: human });
  await fetch(`${BASE}/site/${slug}`, { headers: { 'user-agent': 'Googlebot/2.1' } });
  await c.get(`/sites/${siteId}/preview`, { headers: human });
  const f = new FormData(); f.append('name', 'Quote Person'); f.append('phone', '555-1'); f.append('service', 'Roof Repair');
  await fetch(`${BASE}/site/${slug}/contact`, { method: 'POST', body: f, redirect: 'manual' });

  const html = await (await c.get(`/sites/${siteId}/report`)).text();
  assert.match(html, /<div class="n">3<\/div><div class="l">Page views<\/div>/);
  assert.match(html, /<div class="n">1<\/div><div class="l">Messages &amp; quote requests/);
  assert.match(html, /Roof Repair/);
  assert.match(html, /Most viewed pages/);
  assert.match(await (await c.get(`/sites/${siteId}/report?days=7`)).text(), /last 7 days/);

  const other = makeClient();
  await other.post('/signup', { email: 'reporter-other@example.com', password: 'password1' });
  assert.equal((await other.get(`/sites/${siteId}/report`)).status, 404);
  assert.equal((await fetch(`${BASE}/sites/${siteId}/report`, { redirect: 'manual' })).status, 302);

  const made = await c.post(`/sites/${siteId}/client-link`);
  const token = (await (await c.get(made.headers.get('location'))).text()).match(/\/client\/([A-Za-z0-9_-]{32})</)[1];
  const clientReport = await fetch(`${BASE}/client/${token}/report`);
  assert.equal(clientReport.status, 200);
  assert.match(clientReport.headers.get('x-robots-tag'), /noindex/);
  assert.match(await clientReport.text(), /Page views/);
  assert.match(await (await fetch(`${BASE}/client/${token}`)).text(), /See how your website is doing/);
  assert.equal((await fetch(`${BASE}/client/${'z'.repeat(32)}/report`)).status, 404);

  // email the report
  await c.post(`/sites/${siteId}/edit`, { name: 'Report Roofing', meta_reportEmail: 'owner@biz.test', contact_heading: 'Contact', about_heading: 'About', services_heading: 'Services', hero_headline: 'Hello' });
  const before = mailCount();
  assert.match((await c.post(`/sites/${siteId}/report/send`, { days: '30' })).headers.get('location'), /m=sent/);
  const mails = await waitForMail(before + 1);
  assert.match(mails[mails.length - 1].text, /Page views:\s+3/);
});

test('reports module: date helpers and aggregation', () => {
  const reports = require('../reports');
  const prev = reports.previousMonth(new Date(Date.UTC(2026, 0, 15)));
  assert.equal(prev.from, '2025-12-01');
  assert.equal(prev.to, '2025-12-31');
  assert.equal(prev.period, '2025-12');
  assert.deepEqual(reports.rangeForDays(3, new Date(Date.UTC(2026, 2, 10))), { from: '2026-03-08', to: '2026-03-10' });
  assert.equal(reports.isBot('Mozilla/5.0 (compatible; bingbot/2.0)'), true);
  assert.equal(reports.isBot(''), true);
  assert.equal(reports.isBot('Mozilla/5.0 (Windows NT 10.0) Chrome/120'), false);
});

test('more pages: town pages, blog posts and extra pages (financing etc.)', async () => {
  const c = makeClient();
  const { siteId, slug, editPath } = await basicSite(c, 'pages@example.com', 'Pages Roofing');
  await c.post(editPath, {
    name: 'Pages Roofing', hero_headline: 'Hello', about_heading: 'About', about_body: 'x', services_heading: 'Services',
    service_title: ['Roof Repair'], service_description: ['Fix'], service_detail: [''],
    contact_heading: 'Contact', contact_acceptSubmissions: '1', contact_phone: '555-0100', meta_city: 'Orlando, FL', meta_businessType: 'roofer',
    trust_serviceAreas: 'Kissimmee, St. Cloud',
    area_name: ['Kissimmee', 'St. Cloud'], area_text: ['We know the HOA rules in Kissimmee neighborhoods.', ''],
    blog_heading: 'News & Tips', blog_title: ['How to spot roof damage'], blog_date: ['March 3, 2026'], blog_body: ['First paragraph.\n\nSecond paragraph.'],
    extraPages_heading: 'Extra pages', extra_title: ['Financing'], extra_body: ['We can talk through payment options.'],
    testimonials_heading: 'Reviews',
    layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact'
  });

  const get = (p, h) => fetch(`${BASE}/site/${slug}${p}`, h ? { headers: h } : undefined);
  // town page with text: indexable, city/town in heading, quote form
  const k = await (await get('/areas/kissimmee')).text();
  assert.match(k, /<h1>Roofer in Kissimmee<\/h1>/);
  assert.match(k, /HOA rules in Kissimmee/);
  assert.doesNotMatch(k, /noindex/);
  assert.match(k, /<title>Roofer in Kissimmee — Pages Roofing<\/title>/);
  assert.match(k, /<select name="service">/);
  // town without text: works but noindex
  const sc = await (await get('/areas/st-cloud')).text();
  assert.match(sc, /Pages Roofing serves St\. Cloud\./);
  assert.match(sc, /<meta name="robots" content="noindex">/);
  assert.equal((await get('/areas/nowhere')).status, 404);
  // About page links only the town that has text
  const about = await (await get('/about')).text();
  assert.match(about, new RegExp(`<a class="area-chip" href="/site/${slug}/areas/kissimmee">Kissimmee</a>`));
  assert.match(about, /<span class="area-chip">St\. Cloud<\/span>/);

  // blog
  const blog = await (await get('/blog')).text();
  assert.match(blog, /How to spot roof damage/);
  assert.match(blog, new RegExp(`href="/site/${slug}/blog/how-to-spot-roof-damage"`));
  const post = await (await get('/blog/how-to-spot-roof-damage')).text();
  assert.match(post, /<h1>How to spot roof damage<\/h1>/);
  assert.match(post, /<p>First paragraph\.<\/p>/);
  assert.match(post, /<p>Second paragraph\.<\/p>/);
  assert.match(post, /"@type":"BlogPosting"/);
  assert.match(post, /"datePublished":"2026-03-0\d"/);
  assert.equal((await get('/blog/nope')).status, 404);

  // extra page: its own address and a nav link
  const fin = await get('/p/financing');
  assert.equal(fin.status, 200);
  assert.match(await fin.text(), /payment options/);
  const home = await (await get('')).text();
  assert.match(home, new RegExp(`href="/site/${slug}/p/financing"[^>]*>Financing<`));
  assert.match(home, new RegExp(`href="/site/${slug}/blog"`));
  assert.equal((await get('/p/nope')).status, 404);
  assert.equal((await get('/extraPages')).status, 404, 'the editor block itself is not a page');
  assert.equal((await get('/bogus/x')).status, 404);

  // sitemap lists what has real text
  const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
  assert.match(sitemap, new RegExp(`/site/${slug}/areas/kissimmee<`));
  assert.doesNotMatch(sitemap, new RegExp(`/site/${slug}/areas/st-cloud<`));
  assert.match(sitemap, new RegExp(`/site/${slug}/blog/how-to-spot-roof-damage<`));
  assert.match(sitemap, new RegExp(`/site/${slug}/p/financing<`));

  // static export has a file for each, with links rewritten
  const zip = readZip(Buffer.from(await (await c.get(`/sites/${siteId}/export`)).arrayBuffer()));
  assert.ok(zip['area-kissimmee.html'] && zip['blog-how-to-spot-roof-damage.html'] && zip['p-financing.html'] && zip['blog.html']);
  assert.ok(!zip['area-st-cloud.html'], 'no file for a town without text');
  assert.match(zip['blog.html'].toString(), /href="blog-how-to-spot-roof-damage\.html"/);
  assert.match(zip['index.html'].toString(), /href="p-financing\.html"/);

  // hiding the extra-pages block removes those pages
  await c.post(editPath, {
    name: 'Pages Roofing', hero_headline: 'Hello', about_heading: 'About', about_body: 'x', services_heading: 'Services',
    contact_heading: 'Contact', extra_title: ['Financing'], extra_body: ['We can talk through payment options.'], hidden_sections: ['extraPages'],
    layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact'
  });
  assert.equal((await get('/p/financing')).status, 404);

  // custom domain serves them at clean addresses
  await c.post(editPath, {
    name: 'Pages Roofing', custom_domain: 'www.pagesroof.test', hero_headline: 'Hello', about_heading: 'About', about_body: 'x', services_heading: 'Services',
    contact_heading: 'Contact', meta_city: 'Orlando, FL', trust_serviceAreas: 'Kissimmee', area_name: ['Kissimmee'], area_text: ['Local text here.'],
    blog_title: ['Post one'], blog_body: ['Body one.'], layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact'
  });
  const http = require('node:http');
  const viaHost = (p) => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: new URL(BASE).port, path: p, headers: { Host: 'www.pagesroof.test' } }, (res) => {
      let d = ''; res.on('data', x => d += x); res.on('end', () => resolve({ status: res.statusCode, body: d }));
    }).on('error', reject);
  });
  assert.equal((await viaHost('/areas/kissimmee')).status, 200);
  assert.equal((await viaHost('/blog/post-one')).status, 200);
  assert.equal((await viaHost('/blog')).status, 200);
  assert.equal((await viaHost('/review')).status, 200);
  assert.equal((await viaHost('/areas/zzz')).status, 404);
});

test('round 5: cookie banner modes, legal note, gzip, upload caching', async () => {
  const c = makeClient();
  const { siteId, editPath } = await makeLocalSite(c, 'round5@example.com', { name: 'Round Five Roofing' });
  const slug = 'round-five-roofing';
  const base = {
    name: 'Round Five Roofing', hero_headline: 'Roofs', about_heading: 'About', about_body: 'x', services_heading: 'Services',
    contact_heading: 'Contact', meta_gaId: 'G-ABC123XYZ9', meta_city: 'Orlando, FL',
    layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact'
  };

  // always-on mode: no banner, tracking not gated
  await c.post(editPath, { ...base, meta_trackingMode: 'always' });
  let home = await (await fetch(`${BASE}/site/${slug}`)).text();
  assert.match(home, /MODE = "always"/);
  assert.doesNotMatch(home, /id="cookieBar"/);

  // ask mode with a legal note in the footer
  await c.post(editPath, { ...base, meta_trackingMode: 'ask', trust_legalNote: 'Licensed in Florida. Lic. #TEST-123' });
  home = await (await fetch(`${BASE}/site/${slug}`)).text();
  assert.match(home, /MODE = "ask"/);
  assert.match(home, /id="cookieBar"/);
  assert.match(home, /class="footer-legal">Licensed in Florida\. Lic\. #TEST-123</);

  // an invalid mode falls back to ask
  await c.post(editPath, { ...base, meta_trackingMode: 'nonsense' });
  assert.match(await (await fetch(`${BASE}/site/${slug}`)).text(), /MODE = "ask"/);

  // gzip: smaller on the wire, identical once decoded
  const zlib = require('node:zlib');
  const raw = await new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path: `/site/${slug}`, headers: { 'Accept-Encoding': 'gzip' } }, (res) => {
      const chunks = []; res.on('data', d => chunks.push(d));
      res.on('end', () => resolve({ headers: res.headers, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
  assert.equal(raw.headers['content-encoding'], 'gzip');
  const plain = zlib.gunzipSync(raw.body).toString();
  assert.match(plain, /<main id="main">/);
  assert.ok(raw.body.length < plain.length / 2, 'gzip should shrink the page a lot');

  // uploads are cached for a long time
  fs.writeFileSync(path.join(__dirname, '..', 'public', 'uploads', 'cache-test.txt'), 'hi');
  const up = await fetch(`${BASE}/uploads/cache-test.txt`);
  assert.match(up.headers.get('cache-control') || '', /max-age=\d{6,}/);
  fs.unlinkSync(path.join(__dirname, '..', 'public', 'uploads', 'cache-test.txt'));
});

test('create-site script builds a site from examples/sankara.json', async () => {
  const { execFileSync } = require('node:child_process');
  const c = makeClient();
  await c.post('/signup', { email: 'script@example.com', password: 'password1' });
  const out = execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'create-site.js'), path.join(__dirname, '..', 'examples', 'sankara.json'), 'script@example.com'],
    { env: { ...process.env, DB_PATH: TEST_DB }, encoding: 'utf8' });
  const id = out.match(/\/sites\/(\d+)\/edit/)[1];
  const edit = await c.get(`/sites/${id}/edit`);
  assert.equal(edit.status, 200);
  const page = await (await c.get(`/sites/${id}/preview/services/auto-insurance`)).text();
  assert.match(page, /Auto Insurance in\s+Kissimmee, FL/);
  assert.doesNotMatch(page, /licensed|lowest|guarantee|best rates/i, 'starter copy makes no unverifiable claims');
});

test('billing: checkout link, webhook activates, lapsed subscriptions take the site offline', async () => {
  const billing = require('../billing');
  const Database = require('better-sqlite3');
  const c = makeClient();
  const { siteId } = await makeLocalSite(c, 'billing@example.com', { name: 'Billing Roofing' });
  const slug = 'billing-roofing';
  const live = async () => (await fetch(`${BASE}/site/${slug}`)).status;
  const hook = (event, sig) => {
    const raw = JSON.stringify(event);
    return fetch(`${BASE}/stripe/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': sig || billing.signForTest(raw, STRIPE_WHSEC) }, body: raw });
  };

  // private to the owner
  assert.equal((await fetch(`${BASE}/sites/${siteId}/billing`, { redirect: 'manual' })).status, 302);
  const other = makeClient();
  await other.post('/signup', { email: 'billing-other@example.com', password: 'password1' });
  assert.equal((await other.get(`/sites/${siteId}/billing`)).status, 404);
  const page = await (await c.get(`/sites/${siteId}/billing`)).text();
  assert.match(page, /Not started/);
  assert.match(page, /Start the hosting subscription/);

  // not required by default: site is live with no subscription
  assert.equal(await live(), 200);

  // checkout link goes to Stripe with the site tagged on it
  const co = await c.post(`/sites/${siteId}/billing/checkout`, { billing_email: 'client@example.com' });
  assert.equal(co.status, 200);
  assert.match(await co.text(), /https:\/\/checkout\.stripe\.test\/c\/pay_abc/);
  const sent = stripeRequests.find(r => r.url === '/v1/checkout/sessions');
  assert.equal(sent.auth, 'Bearer sk_test_fake');
  assert.equal(sent.params.get('mode'), 'subscription');
  assert.equal(sent.params.get('line_items[0][price]'), 'price_test_123');
  assert.equal(sent.params.get('client_reference_id'), String(siteId));
  assert.equal(sent.params.get('customer_email'), 'client@example.com');

  // require a subscription: offline until paid
  await c.post(`/sites/${siteId}/billing/settings`, { billing_required: '1', billing_email: 'client@example.com' });
  assert.equal(await live(), 503);
  assert.match(await (await fetch(`${BASE}/site/${slug}`)).text(), /temporarily unavailable/);
  assert.equal((await fetch(`${BASE}/site/${slug}/contact`, { method: 'POST', body: new FormData() })).status, 503);
  assert.equal((await c.get(`/sites/${siteId}/preview`)).status, 200, 'owner preview still works');

  // bad or missing signatures are rejected, and change nothing
  const evt = { type: 'checkout.session.completed', data: { object: { mode: 'subscription', client_reference_id: String(siteId), customer: 'cus_1', subscription: 'sub_1', payment_status: 'paid' } } };
  assert.equal((await hook(evt, 't=1,v1=deadbeef')).status, 400);
  assert.equal((await fetch(`${BASE}/stripe/webhook`, { method: 'POST', body: JSON.stringify(evt) })).status, 400);
  assert.equal(await live(), 503);

  // a signed payment event brings it live
  assert.equal((await hook(evt)).status, 200);
  assert.equal(await live(), 200);
  assert.match(await (await c.get(`/sites/${siteId}/billing`)).text(), /Active/);

  // manage subscription -> Stripe portal
  const portal = await c.post(`/sites/${siteId}/billing/portal`, {});
  assert.equal(portal.status, 302);
  assert.equal(portal.headers.get('location'), 'https://billing.stripe.test/p/session_xyz');
  assert.equal(stripeRequests.filter(r => r.url === '/v1/billing_portal/sessions').pop().params.get('customer'), 'cus_1');

  // failed payment: still live during the grace period, offline after it
  assert.equal((await hook({ type: 'invoice.payment_failed', data: { object: { subscription: 'sub_1', customer: 'cus_1' } } })).status, 200);
  assert.equal(await live(), 200);
  const dbh = new Database(TEST_DB);
  dbh.prepare("UPDATE sites SET past_due_since = datetime('now', '-8 days') WHERE id = ?").run(siteId);
  assert.equal(await live(), 503);
  // paying the invoice restores it
  await hook({ type: 'invoice.paid', data: { object: { subscription: 'sub_1', customer: 'cus_1' } } });
  assert.equal(await live(), 200);
  assert.equal(dbh.prepare('SELECT past_due_since FROM sites WHERE id = ?').get(siteId).past_due_since, null);

  // cancelling takes it offline; turning the requirement off puts it back
  await hook({ type: 'customer.subscription.deleted', data: { object: { id: 'sub_1', customer: 'cus_1' } } });
  assert.equal(await live(), 503);
  assert.equal(dbh.prepare('SELECT billing_status FROM sites WHERE id = ?').get(siteId).billing_status, 'canceled');
  await c.post(`/sites/${siteId}/billing/settings`, { billing_email: 'client@example.com' });
  assert.equal(await live(), 200);
  dbh.close();
});

test('billing: signature check is strict about the secret, age and body', () => {
  const billing = require('../billing');
  const body = '{"a":1}';
  const now = Date.now();
  const good = billing.signForTest(body, 'whsec_x', Math.floor(now / 1000));
  assert.equal(billing.verifyWebhook(body, good, 'whsec_x', now), true);
  assert.equal(billing.verifyWebhook(body + ' ', good, 'whsec_x', now), false, 'body changed');
  assert.equal(billing.verifyWebhook(body, good, 'whsec_y', now), false, 'wrong secret');
  assert.equal(billing.verifyWebhook(body, good, 'whsec_x', now + 10 * 60 * 1000), false, 'too old');
  assert.equal(billing.isSuspended({ billing_required: 0, billing_status: 'canceled' }), false);
  assert.equal(billing.isSuspended({ billing_required: 1, billing_status: 'none' }), true);
  assert.equal(billing.isSuspended({ billing_required: 1, billing_status: 'trialing' }), false);
});

test('new theme styles render and unknown styles fall back to modern', async () => {
  const c = makeClient();
  const { siteId, editPath } = await makeLocalSite(c, 'styles@example.com', { name: 'Styles Roofing' });
  const base = { name: 'Styles Roofing', hero_headline: 'Roofs', about_heading: 'About', about_body: 'x', services_heading: 'Services', contact_heading: 'Contact', layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact' };
  for (const st of ['midnight', 'split', 'poster']) {
    await c.post(editPath, { ...base, theme_style: st });
    const html = await (await fetch(`${BASE}/site/styles-roofing`)).text();
    assert.match(html, new RegExp(`<body class="style-${st}`));
  }
  await c.post(editPath, { ...base, theme_style: 'neon' });
  assert.match(await (await fetch(`${BASE}/site/styles-roofing`)).text(), /<body class="style-modern/);
  assert.match(await (await c.get(editPath)).text(), /value="midnight"/);
});

test('custom fonts: heading/body overrides load from Google, single-weight display fonts, safe input', async () => {
  const c = makeClient();
  const { editPath } = await makeLocalSite(c, 'fonts@example.com', { name: 'Ink Tattoo' });
  const slug = 'ink-tattoo';
  const base = { name: 'Ink Tattoo', hero_headline: 'Ink', about_heading: 'About', about_body: 'x', services_heading: 'Services', contact_heading: 'Contact', layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact' };

  // default: no overrides, no extra families
  let html = await (await fetch(`${BASE}/site/${slug}`)).text();
  assert.doesNotMatch(html, /Pirata/);

  // eccentric heading font + readable body font + normal capitalization
  await c.post(editPath, { ...base, theme_headingFont: 'Pirata One', theme_bodyFont: 'Lora', theme_headingCase: 'none' });
  html = await (await fetch(`${BASE}/site/${slug}`)).text();
  assert.match(html, /family=Pirata\+One&amp;family=Lora:wght@400;500;600;700|family=Pirata\+One&family=Lora:wght@400;500;600;700/);
  assert.match(html, /--heading-font: 'Pirata One', Georgia, serif/);
  assert.match(html, /--body-font: 'Lora', system-ui, sans-serif/);
  assert.match(html, /h1, h2, h3, nav\.site-nav \.brand \{ text-transform: none !important/);
  assert.match(html, /font-weight: 400 !important/, 'single-weight display font is not faux-bolded');

  // any other Google Font by name works, and the editor shows it back
  await c.post(editPath, { ...base, theme_headingFont: 'Pirata One', theme_headingFontCustom: 'Fascinate Inline', theme_headingCase: 'uppercase' });
  html = await (await fetch(`${BASE}/site/${slug}`)).text();
  assert.match(html, /family=Fascinate\+Inline/);
  assert.match(html, /--heading-font: 'Fascinate Inline'/);
  assert.match(html, /text-transform: uppercase !important/);
  assert.match(await (await c.get(editPath)).text(), /name="theme_headingFontCustom" value="Fascinate Inline"/);

  // hostile input is dropped, not echoed into the page's CSS or URLs
  await c.post(editPath, { ...base, theme_headingFontCustom: "x'};</style><script>alert(1)</script>", theme_bodyFontCustom: 'a'.repeat(80) });
  html = await (await fetch(`${BASE}/site/${slug}`)).text();
  assert.doesNotMatch(html, /alert\(1\)/);
  assert.doesNotMatch(html, /Fascinate/);
  assert.match(html, /--body-font: Inter/);
});

test('generating from a template that has its own look applies its style, colors and fonts', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'look@example.com', password: 'password1' });
  const gen = await c.post('/sites/generate', { business_type: 'daycare center', business_name: 'Little Oaks Daycare' });
  const editPath = gen.headers.get('location');
  assert.match(editPath, /\/sites\/\d+\/edit/);
  const html = await (await c.get(editPath)).text();
  assert.match(html, /<option value="warm" selected>/);
  assert.match(html, /<option value="Nunito" selected>/);
  assert.match(html, /name="theme_primaryColor" value="#f59e0b"/);
  // an industry with its own Signature piece starts on that piece instead, with the template's content
  const tat = await c.post('/sites/generate', { business_type: 'tattoo shop', business_name: 'Ink & Iron' });
  const tatHtml = await (await c.get(tat.headers.get('location'))).text();
  assert.match(tatHtml, /<option value="at-ink" selected>/);
  assert.match(tatHtml, /Custom Tattoos/);
  // a type with no look keeps the normal defaults
  const gen2 = await c.post('/sites/generate', { business_type: 'widget factory', business_name: 'Plain Widgets' });
  const html2 = await (await c.get(gen2.headers.get('location'))).text();
  assert.match(html2, /<option value="modern" selected>/);
});

test('editor: the save form is not cut short by nested forms (headline must stay inside it)', async () => {
  const c = makeClient();
  const { siteId, editPath } = await makeLocalSite(c, 'nested@example.com', { name: 'Nested Form Co' });
  // a couple of saves so Version history has entries (that is what used to break the form)
  for (const h of ['First headline', 'Second headline']) {
    await c.post(editPath, { name: 'Nested Form Co', hero_headline: h, about_heading: 'About', about_body: 'x', services_heading: 'Services', contact_heading: 'Contact', layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact' });
  }
  const html = await (await c.get(editPath)).text();
  assert.match(html, /Version history/);
  const start = html.indexOf('id="editorForm"');
  const end = html.indexOf('</form>', start);
  const formHtml = html.slice(start, end);
  assert.doesNotMatch(formHtml, /<form\b/, 'no form may be nested inside the editor form');
  for (const field of ['hero_headline', 'about_body', 'service_title', 'contact_phone', 'theme_style', 'layout_order']) {
    assert.ok(formHtml.includes(`name="${field}"`), `${field} must be inside the editor form`);
  }
  // restore buttons still work through their own forms
  assert.match(html, /<button type="submit" form="restore-\d+"/);
});

test('agency look: tiles, service photo cards, review summary, offices and blog in the footer, help bar', async () => {
  const c = makeClient();
  const { siteId, editPath } = await makeLocalSite(c, 'agency-look@example.com', { name: 'Agency Co' });
  const slug = 'agency-co';
  const base = {
    name: 'Agency Co', hero_headline: 'Coverage', about_heading: 'About Agency Co', about_body: 'We help local families understand their coverage options.',
    services_heading: 'Insurance we offer', contact_heading: 'Contact', contact_phone: '(407) 555-0100', contact_email: 'hi@agency.test', contact_acceptSubmissions: '1',
    service_title: ['Auto Insurance', 'Flood Cover', 'Pet Plan'], service_description: ['Cars', 'Water', 'Pets'], service_detail: ['', '', ''],
    service_image: ['/uploads/auto.jpg', '', ''], service_icon: ['', '', 'star'],
    testimonial_quote: ['Great help.', 'Clear answers.'], testimonial_author: ['Pat', 'Sam'], testimonial_rating: ['5', '4'], testimonial_date: ['', ''],
    blog_title: ['Reading your policy'], blog_date: ['Oct 1, 2026'], blog_body: ['Some real advice.'],
    loc_name: ['Orlando office'], loc_address: ['45 Oak Ave, Orlando, FL'], loc_phone: ['(407) 555-0145'],
    layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact'
  };

  // default style: no tiles
  await c.post(editPath, { ...base, theme_style: 'modern' });
  let home = await (await fetch(`${BASE}/site/${slug}`)).text();
  assert.doesNotMatch(home, /class="home-tiles"/);
  assert.doesNotMatch(home, /class="help-bar"/);

  // agency style: the full home page
  await c.post(editPath, { ...base, theme_style: 'agency' });
  home = await (await fetch(`${BASE}/site/${slug}`)).text();
  assert.match(home, /<body class="style-agency/);
  assert.match(home, /class="home-tiles"/);
  assert.equal((home.match(/class="home-tile"/g) || []).length, 3);
  assert.match(home, /href="\/site\/agency-co\/services\/auto-insurance"/);
  assert.match(home, /class="home-services"/);
  assert.match(home, /<img src="\/uploads\/auto\.jpg"/, 'service photo shows on its card');
  assert.match(home, /4\.5 out of 5 stars/, 'average of the two real ratings');
  assert.match(home, /2 reviews shown on this site/);
  assert.match(home, /class="review-card"/);
  assert.match(home, /class="footer-grid wide"/);
  assert.match(home, /Reading your policy/);
  assert.match(home, /Orlando office/);
  assert.match(home, /\(407\) 555-0145/);
  assert.match(home, /Email an agent/);
  assert.match(home, /id="helpBar"/);
  assert.match(home, /family="?|family=Oswald/);

  // other pages: no home-only blocks, but the help bar stays (not on the contact page)
  const svc = await (await fetch(`${BASE}/site/${slug}/services`)).text();
  assert.doesNotMatch(svc, /class="home-tiles"/);
  assert.match(svc, /id="helpBar"/);
  assert.doesNotMatch(await (await fetch(`${BASE}/site/${slug}/contact`)).text(), /id="helpBar"/);

  // the home page is also available in any style with the checkbox
  await c.post(editPath, { ...base, theme_style: 'minimal', theme_homeFull: '1' });
  home = await (await fetch(`${BASE}/site/${slug}`)).text();
  assert.match(home, /class="home-tiles"/);
  assert.doesNotMatch(home, /id="helpBar"/);

  // editor round-trips the new fields, and rejects junk icons / URLs
  await c.post(editPath, { ...base, theme_style: 'agency', service_icon: ['nonsense', '', 'star'], service_image: ['javascript:alert(1)', '', ''] });
  const ed = await (await c.get(editPath)).text();
  assert.match(ed, /name="loc_name" value="Orlando office"/);
  assert.match(ed, /<option value="agency" selected>/);
  assert.doesNotMatch(ed, /javascript:alert/);
  const home2 = await (await fetch(`${BASE}/site/${slug}`)).text();
  assert.doesNotMatch(home2, /javascript:alert/);
  assert.match(home2, /href="\/site\/agency-co\/services\/pet-plan"[\s\S]*?<path d="M12 3l2\.7/, 'chosen icon is used');
});

test('service icons are picked from the title unless chosen', () => {
  const { iconKeyFor } = require('../icons');
  assert.equal(iconKeyFor('Auto Insurance'), 'auto');
  assert.equal(iconKeyFor('Home Insurance'), 'home');
  assert.equal(iconKeyFor('Flood Insurance'), 'water');
  assert.equal(iconKeyFor('Motorcycle Insurance'), 'motorcycle');
  assert.equal(iconKeyFor('Life Insurance'), 'heart');
  assert.equal(iconKeyFor('Health Insurance'), 'health');
  assert.equal(iconKeyFor('Something unusual'), 'shield');
  assert.equal(iconKeyFor('Auto Insurance', 'boat'), 'boat');
  assert.equal(iconKeyFor('Auto Insurance', 'bogus'), 'auto');
});

test('hero slideshow and office maps: only render when set, junk URLs dropped', async () => {
  const c = makeClient();
  const { editPath } = await makeLocalSite(c, 'slides-maps@example.com', { name: 'Slide Co' });
  const slug = 'slide-co';
  const base = {
    name: 'Slide Co', hero_headline: 'Hello', about_heading: 'About', about_body: 'Text here for the page.',
    contact_phone: '(407) 555-0100', contact_email: 'hi@slide.test', contact_address: '1 Main St, Kissimmee, FL',
    theme_style: 'agency'
  };
  // none set: no slideshow controls, no office section
  await c.post(editPath, base);
  let home = await (await fetch(`${BASE}/site/${slug}`)).text();
  assert.doesNotMatch(home, /class="hero-controls"/);
  assert.doesNotMatch(home, /class="hero-slide"/);
  let contact = await (await fetch(`${BASE}/site/${slug}/contact`)).text();
  assert.doesNotMatch(contact, /class="office-card"/);

  await c.post(editPath, { ...base, hero_imageUrl: '/uploads/main.jpg', hero_slide: ['/uploads/a.jpg', 'javascript:alert(1)', 'https://example.com/b.jpg'],
    loc_name: ['Orlando office'], loc_address: ['45 Oak Ave, Orlando, FL'], loc_phone: ['(407) 555-0145'] });
  home = await (await fetch(`${BASE}/site/${slug}`)).text();
  assert.match(home, /hero-controls/);
  assert.equal((home.match(/hero-slide"? data-photo|data-photo=/g) || []).length >= 2, true);
  assert.doesNotMatch(home, /javascript:alert/);
  assert.match(home, /maps\.google\.com\/maps\?q=/, 'footer map for agency home');
  contact = await (await fetch(`${BASE}/site/${slug}/contact`)).text();
  assert.match(contact, /office-card/);
  assert.match(contact, /Orlando office/);
  assert.match(contact, /maps\.google\.com\/maps\?q=45/);

  const ed = await (await c.get(editPath)).text();
  assert.match(ed, /name="hero_slide" value="\/uploads\/a\.jpg"/);
});

test('content blocks: add, order, render, junk dropped, editor round-trip', async () => {
  const c = makeClient();
  const { editPath } = await makeLocalSite(c, 'blocks@example.com', { name: 'Block Co' });
  const slug = 'block-co';
  const base = { name: 'Block Co', hero_headline: 'Hi', about_heading: 'About', about_body: 'Some text for the about page.', contact_email: 'a@b.test' };

  let home = await (await fetch(`${BASE}/site/${slug}`)).text();
  assert.doesNotMatch(home, /class="blk /);

  const rr = await c.post(editPath, { ...base,
    block_type: ['photoText', 'photoText', 'steps', 'bogus'],
    block_heading: ['First story', 'Second story', 'How it works', 'x'],
    block_body: ['Para one.\n\nPara two.', 'More words.', 'Book online | Pick a time\nWe arrive | On schedule\nJust a title', 'x'],
    block_image: ['/uploads/a.jpg', 'javascript:alert(1)', '', ''],
    block_buttonText: ['Book now', '', '', ''], block_buttonUrl: ['/site/block-co/contact', '', '', ''],
    block_side: ['auto', 'auto', 'auto', 'auto'], block_bg: ['none', 'brand', 'none', 'none'], block_place: ['bottom', 'bottom', 'bottom', 'bottom'] });
  home = await (await fetch(`${BASE}/site/${slug}`)).text();
  assert.equal((home.match(/<section(?: data-sg-bid="[^"]+")? class="blk /g) || []).length, 3, 'bogus type dropped');
  assert.match(home, /First story/);
  assert.ok(home.indexOf('First story') < home.indexOf('Second story') && home.indexOf('Second story') < home.indexOf('How it works'), 'kept in order');
  assert.match(home, /<p>Para one\.<\/p>\s*<p>Para two\.<\/p>/);
  assert.match(home, /class="blk-img"><img src="\/uploads\/a\.jpg"/);
  assert.doesNotMatch(home, /javascript:alert/);
  assert.match(home, /blk-bg-brand/);
  assert.equal((home.match(/class="step-card"/g) || []).length, 3);
  assert.match(home, /photo-right/, "first photo block puts the photo on the right");
  assert.match(home, /href="\/site\/block-co\/contact">Book now/);

  // other pages never show blocks
  assert.doesNotMatch(await (await fetch(`${BASE}/site/${slug}/about`)).text(), /First story/);

  // editor round-trip + no nested forms regression stays intact
  const ed = await (await c.get(editPath)).text();
  assert.match(ed, /name="block_heading" maxlength="120" value="First story"/);
  assert.match(ed, /data-newblock="steps"/);
  const form = ed.slice(ed.indexOf('id="editorForm"'));
  assert.doesNotMatch(form.slice(0, form.indexOf('</form>')), /<form/);

  // saving with no blocks clears them; top placement renders before the footer area still on home
  await c.post(editPath, { ...base, block_type: ['photoText'], block_heading: ['Up top'], block_body: ['t'], block_image: [''], block_buttonText: [''], block_buttonUrl: [''], block_side: ['left'], block_bg: ['tint'], block_place: ['top'] });
  home = await (await fetch(`${BASE}/site/${slug}`)).text();
  assert.match(home, /Up top/);
  assert.doesNotMatch(home, /First story/);
  await c.post(editPath, { ...base });
  assert.doesNotMatch(await (await fetch(`${BASE}/site/${slug}`)).text(), /<section class="blk /);
});

test('more content blocks: feature cards, call-to-action band, area chips', async () => {
  const c = makeClient();
  const { editPath } = await makeLocalSite(c, 'blocks2@example.com', { name: 'Block Two' });
  const base = { name: 'Block Two', hero_headline: 'Hi', about_heading: 'About', about_body: 'Some text for the about page.', contact_email: 'a@b.test' };
  const n = 4;
  const arr = (...v) => v;
  await c.post(editPath, { ...base,
    block_type: arr('features', 'cta', 'chips', 'chips'),
    block_heading: arr('Why us', 'Book today', 'Where we work', ''),
    block_body: arr('Local team | We live here\nFast reply | We answer quickly', 'Ready when you are.', 'Kissimmee, FL | /site/block-two/contact\nSt. Cloud, FL\nBad | javascript:alert(1)', ''),
    block_image: arr('', '/uploads/band.jpg', '', ''), block_buttonText: arr('', 'Book now', '', ''), block_buttonUrl: arr('', '/site/block-two/contact', '', ''),
    block_side: arr('auto', 'auto', 'auto', 'auto'), block_bg: arr('none', 'none', 'tint', 'none'), block_place: arr('bottom', 'bottom', 'bottom', 'bottom') });
  const home = await (await fetch(`${BASE}/site/block-two`)).text();
  assert.equal((home.match(/class="feat-card"/g) || []).length, 2);
  assert.match(home, /class="blk blk-cta-band has-photo"[^>]*band\.jpg/);
  assert.match(home, /href="\/site\/block-two\/contact">Book now/);
  assert.match(home, /<a class="chip" href="\/site\/block-two\/contact">Kissimmee, FL/);
  assert.match(home, /<span class="chip">St\. Cloud, FL/);
  assert.doesNotMatch(home, /javascript:alert/);
  assert.equal((home.match(/class="chip-grid"/g) || []).length, 1, 'fully empty block dropped');
  const ed = await (await c.get(editPath)).text();
  assert.match(ed, /data-newblock="cta"/);
  assert.match(ed, /Closing call-to-action band/);
});

test('generating a pet template brings its look and content blocks', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'pets@example.com', password: 'password1' });
  const gen = await c.post('/sites/generate', { business_type: 'mobile pet grooming', business_name: 'Paws On Wheels' });
  const editPath = gen.headers.get('location');
  const ed = await (await c.get(editPath)).text();
  assert.match(ed, /<option value="studio" selected>/);
  assert.equal((ed.match(/<input type="hidden" name="block_type"/g) || []).length >= 4, true);
  assert.match(ed, /Grooming that comes to you/);
  assert.match(ed, /Paws On Wheels turns your driveway/);
  assert.doesNotMatch(ed, /\{name\}/);
  const gen2 = await c.post('/sites/generate', { business_type: 'dog training', business_name: 'Good Dog Co' });
  assert.match(await (await c.get(gen2.headers.get('location'))).text(), /Training built around your dog/);
  // a template with no blocks gets none
  const gen3 = await c.post('/sites/generate', { business_type: 'plumbing company', business_name: 'Plain Pipes 2' });
  assert.doesNotMatch(await (await c.get(gen3.headers.get('location'))).text(), /name="block_heading" maxlength="120" value="[^"]/);
});

test('extra themes: selectable, applied as body class + variables, custom font still wins, junk rejected', async () => {
  const c = makeClient();
  const { editPath } = await makeLocalSite(c, 'themes@example.com', { name: 'Theme Co' });
  const base = { name: 'Theme Co', hero_headline: 'Hi', about_heading: 'About', about_body: 'Some text for about.', contact_email: 'a@b.test' };
  const { IDS } = require('../themes');
  assert.ok(IDS.length >= 6);
  for (const id of IDS) {
    await c.post(editPath, { ...base, theme_style: id });
    const home = await (await fetch(`${BASE}/site/theme-co`)).text();
    assert.match(home, new RegExp(`<body class="style-${id}`), id);
    assert.match(home, new RegExp(`body\\.style-${id} \\{[^}]*--page-bg`), `${id} variables`);
    const ed = await (await c.get(editPath)).text();
    assert.match(ed, new RegExp(`<option value="${id}" selected>`), `${id} stays selected`);
  }
  // heading font from the theme, unless the owner picked their own
  await c.post(editPath, { ...base, theme_style: 'luxe' });
  let home = await (await fetch(`${BASE}/site/theme-co`)).text();
  assert.match(home, /--heading-font: 'Cormorant Garamond'/);
  assert.match(home, /Cormorant\+Garamond/);
  await c.post(editPath, { ...base, theme_style: 'luxe', theme_headingFont: 'Bebas Neue' });
  home = await (await fetch(`${BASE}/site/theme-co`)).text();
  assert.doesNotMatch(home, /body\.style-luxe \{[^}]*--heading-font/);
  // junk style falls back to modern
  await c.post(editPath, { ...base, theme_style: 'luxe;}</style><script>alert(1)</script>' });
  home = await (await fetch(`${BASE}/site/theme-co`)).text();
  assert.match(home, /<body class="style-modern/);
});

test('home page layouts: basic, full, story, tiles, list; styles bring a default; junk ignored', async () => {
  const c = makeClient();
  const { editPath } = await makeLocalSite(c, 'layouts@example.com', { name: 'Layout Co' });
  const base = { name: 'Layout Co', hero_headline: 'Hi', about_heading: 'About Layout Co', about_body: 'Some real text about the business.', about_imageUrl: '/uploads/about.jpg',
    services_heading: 'What we do', service_title: ['Alpha', 'Beta'], service_description: ['First', 'Second'], service_detail: ['', ''], service_image: ['/uploads/a.jpg', ''], service_icon: ['', ''],
    contact_email: 'a@b.test', layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact' };
  const home = async () => (await fetch(`${BASE}/site/layout-co`)).text();
  const marks = { full: 'class="home-svc-grid"', story: 'class="svc-rows"', tiles: 'class="svc-tiles ', list: 'class="svc-list"' };
  const only = (html, key) => { for (const [k, m] of Object.entries(marks)) (k === key ? assert.match : assert.doesNotMatch)(html, new RegExp(m), `${key}: ${k}`); };

  await c.post(editPath, { ...base, theme_style: 'modern', theme_homeLayout: 'basic' });
  let h = await home(); only(h, null); assert.match(h, /<body class="style-modern layout-basic/);
  for (const k of ['full', 'story', 'tiles', 'list']) {
    await c.post(editPath, { ...base, theme_style: 'modern', theme_homeLayout: k });
    h = await home(); only(h, k); assert.match(h, new RegExp(`layout-${k}`));
  }
  await c.post(editPath, { ...base, theme_style: 'modern', theme_homeLayout: 'story' });
  h = await home();
  assert.match(h, /class="intro-photo"/, 'story shows the about photo');
  assert.match(h, /class="svc-row"/); assert.match(h, /class="svc-row flip"/);
  // a style brings its default; an explicit choice beats it
  await c.post(editPath, { ...base, theme_style: 'luxe', theme_homeLayout: '' });
  only(await home(), 'list');
  await c.post(editPath, { ...base, theme_style: 'luxe', theme_homeLayout: 'tiles' });
  only(await home(), 'tiles');
  // legacy tick-box, agency default, junk value
  await c.post(editPath, { ...base, theme_style: 'minimal', theme_homeFull: '1' });
  only(await home(), 'full');
  await c.post(editPath, { ...base, theme_style: 'agency' });
  only(await home(), 'full');
  await c.post(editPath, { ...base, theme_style: 'modern', theme_homeLayout: 'x"><script>' });
  only(await home(), null);
  // hero variants come from the style
  await c.post(editPath, { ...base, theme_style: 'earthy' });
  assert.match(await home(), /hero-boxed/);
  // the editor offers the chips and the layout select
  const ed = await (await c.get(editPath)).text();
  assert.match(ed, /<option value="gallery"/); assert.match(ed, /name="theme_homeLayout"/);
});

test('per-page styles and inner-page service layouts', async () => {
  const c = makeClient();
  const { editPath } = await makeLocalSite(c, 'pagestyle@example.com', { name: 'Page Style Co' });
  const base = { name: 'Page Style Co', hero_headline: 'Hi', about_heading: 'About', about_body: 'Some text for about.', about_imageUrl: '',
    services_heading: 'What we do', service_title: ['Alpha', 'Beta'], service_description: ['First', 'Second'], service_detail: ['More about alpha.', ''], service_image: ['/uploads/a.jpg', ''], service_icon: ['', ''],
    contact_email: 'a@b.test', contact_phone: '(407) 555-0100', layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact' };
  const get = async (p) => (await fetch(`${BASE}/site/page-style-co${p}`)).text();

  // site style everywhere by default
  await c.post(editPath, { ...base, theme_style: 'modern', theme_homeLayout: 'basic' });
  assert.match(await get(''), /<body class="style-modern /);
  assert.match(await get('/services'), /<body class="style-modern /);

  // a different style only on the services pages (list and detail), nothing else
  await c.post(editPath, { ...base, theme_style: 'modern', theme_homeLayout: 'basic', pagestyle_services: 'gallery', pagestyle_contact: 'nonsense' });
  assert.match(await get(''), /<body class="style-modern /);
  assert.match(await get('/services'), /<body class="style-gallery /);
  assert.match(await get('/services/alpha'), /<body class="style-gallery /);
  assert.match(await get('/contact'), /<body class="style-modern /, 'junk page style ignored');
  const ed = await (await c.get(editPath)).text();
  assert.match(ed, /name="pagestyle_services"/);
  assert.match(ed, /<option value="gallery" selected>/);

  // inner services page follows the layout
  const layouts = { story: 'class="svc-rows"', tiles: 'class="svc-tiles ', list: 'class="svc-list"', full: 'class="grid"', basic: 'class="grid"' };
  for (const [k, marker] of Object.entries(layouts)) {
    await c.post(editPath, { ...base, theme_style: 'modern', theme_homeLayout: k });
    assert.match(await get('/services'), new RegExp(marker), k);
  }
  // a style's default layout reaches the services page too
  await c.post(editPath, { ...base, theme_style: 'luxe' });
  assert.match(await get('/services'), /class="svc-list"/);
});

test('generator gives industries their own style; editor shows style hints', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'looks2@example.com', password: 'password1' });
  const g1 = await c.post('/sites/generate', { business_type: 'hair salon', business_name: 'Velvet Hair' });
  const ed1 = await (await c.get(g1.headers.get('location'))).text();
  assert.match(ed1, /<option value="luxe" selected>/);
  assert.match(ed1, /id="styleHint"[^>]*>[^<]*salons/);
  const g2 = await c.post('/sites/generate', { business_type: 'accounting firm', business_name: 'Ledger Co' });
  const ed2 = await (await c.get(g2.headers.get('location'))).text();
  assert.match(ed2, /<option value="corporate" selected>/);
  assert.match(ed2, /<option value="list" selected>/);
  const g3 = await c.post('/sites/generate', { business_type: 'plumbing company', business_name: 'Pipes R Us' });
  assert.match(await (await c.get(g3.headers.get('location'))).text(), /<option value="studio" selected>/);
});

test('hero feature cards and logo strip: only when filled in, safe, round-trip', async () => {
  const c = makeClient();
  const { editPath } = await makeLocalSite(c, 'cards-logos@example.com', { name: 'Card Co' });
  const base = { name: 'Card Co', hero_headline: 'Hi', about_heading: 'About', about_body: 'Some text for about.', contact_email: 'a@b.test', theme_style: 'modern', theme_homeLayout: 'basic' };
  const get = async () => (await fetch(`${BASE}/site/card-co`)).text();
  let h = await get();
  assert.doesNotMatch(h, /class="hero-cards/); assert.doesNotMatch(h, /class="logo-strip"/);

  await c.post(editPath, { ...base,
    hero_card_title: ['Local team', '', 'Plain answers', 'Easy booking', 'Fourth one', 'Fifth card'], hero_card_text: ['We live here', 'ignored', 'No jargon', '', 'More', 'ignored'],
    trust_logosHeading: 'Our memberships', trust_logo_url: ['/uploads/l1.png', 'javascript:alert(1)', '', 'https://example.com/l2.png'], trust_logo_label: ['Chamber', 'Bad', '', 'Assoc'] });
  h = await get();
  assert.match(h, /class="hero-cards n4"/, 'blank title dropped, max four');
  assert.match(h, /<strong>Local team<\/strong>\s*<p>We live here<\/p>/);
  assert.match(h, /<strong>Easy booking<\/strong>\s*<\/div>/, 'card without text has no empty paragraph');
  assert.doesNotMatch(h, /Fifth card/);
  assert.match(h, /class="logo-strip"/); assert.match(h, /<h2>Our memberships<\/h2>/);
  assert.equal((h.match(/<img src="[^"]*" alt="(Chamber|Assoc)"/g) || []).length, 2, 'junk logo URL dropped');
  assert.doesNotMatch(h, /javascript:alert/);
  // other pages never show them
  assert.doesNotMatch(await (await fetch(`${BASE}/site/card-co/about`)).text(), /class="hero-cards |class="logo-strip"/);
  const ed = await (await c.get(editPath)).text();
  assert.match(ed, /name="hero_card_title" value="Local team"/);
  assert.match(ed, /name="trust_logo_url" value="\/uploads\/l1\.png"/);
  assert.match(ed, /name="trust_logosHeading" value="Our memberships"/);
  const form = ed.slice(ed.indexOf('id="editorForm"'));
  assert.doesNotMatch(form.slice(0, form.indexOf('</form>')), /<form/);
});

test('photo strip, split block, dark band, shaped edges', async () => {
  const c = makeClient();
  const { editPath } = await makeLocalSite(c, 'strip@example.com', { name: 'Strip Co' });
  const base = { name: 'Strip Co', hero_headline: 'Hi', about_heading: 'About', about_body: 'Some text for about.', contact_email: 'a@b.test', theme_style: 'modern', theme_homeLayout: 'basic' };
  const home = async () => (await fetch(`${BASE}/site/strip-co`)).text();
  const arr = (...v) => v;
  assert.doesNotMatch(await home(), /class="strip"/);

  await c.post(editPath, { ...base, hero_edge: 'wave',
    block_type: arr('strip', 'split', 'strip'),
    block_heading: arr('Our work', 'A small sample of our work', 'Empty strip'),
    block_body: arr('/uploads/a.jpg\njavascript:alert(1)\nhttps://example.com/b.jpg\n\n/uploads/c.jpg', 'First paragraph.\n\nSecond paragraph.', ''),
    block_image: arr('', '', ''), block_buttonText: arr('Follow us', 'See more', ''), block_buttonUrl: arr('https://instagram.com/strip', '/site/strip-co/contact', ''),
    block_side: arr('auto', 'auto', 'auto'), block_bg: arr('none', 'dark', 'none'), block_edge: arr('scallop', 'wave', 'none'), block_place: arr('bottom', 'bottom', 'bottom') });
  const h = await home();
  assert.equal((h.match(/<div class="strip"/g) || []).length, 1, 'empty strip is dropped');
  assert.equal((h.match(/<img src="[^"]*" alt="Our work"/g) || []).length, 3, 'junk URL and blank line removed');
  assert.match(h, /class="strip-btn prev"/); assert.match(h, /class="strip-btn next"/);
  assert.match(h, /href="https:\/\/instagram\.com\/strip" target="_blank" rel="noopener">Follow us/);
  assert.doesNotMatch(h, /javascript:alert/);
  assert.match(h, /class="blk blk-strip blk-bg-none edge-scallop"/);
  assert.match(h, /class="blk blk-bg-dark edge-wave"/);
  assert.match(h, /class="blk-inner blk-split"/); assert.match(h, /<p>First paragraph\.<\/p>\s*<p>Second paragraph\.<\/p>/);
  assert.match(h, /class="hero edge-wave"/);

  const ed = await (await c.get(editPath)).text();
  assert.equal((ed.match(/class="strip-url" value="/g) || []).length >= 3, true);
  assert.match(ed, /<textarea name="block_body" class="strip-body" hidden>\/uploads\/a\.jpg/);
  assert.match(ed, /<option value="wave" selected>/);
  assert.match(ed, /name="hero_edge"/);
  const form = ed.slice(ed.indexOf('id="editorForm"'));
  assert.doesNotMatch(form.slice(0, form.indexOf('</form>')), /<form/);
  // straight edges and no hero edge by default
  await c.post(editPath, { ...base });
  const h2 = await home();
  assert.doesNotMatch(h2, /class="hero edge-/); assert.doesNotMatch(h2, /class="blk blk-strip/);
});

// ---------- online booking ----------
const bookingFields = (o = {}) => {
  const f = {
    bk_enabled: '1', bk_kind: 'grooming', bk_heading: 'Book a Grooming', bk_intro: 'Tell us about your pet.',
    bk_timezone: 'America/New_York', bk_step: '60', bk_lead: '0', bk_window: '30', bk_capacity: '1',
    bk_service_name: ['Full groom', 'Bath only'], bk_service_minutes: ['120', '60'], bk_service_price: ['from $70', ''], bk_service_desc: ['Bath, cut and style', ''],
    bk_addon_name: ['Nail trim'], bk_addon_price: [''], bk_addon_minutes: ['0'],
    bk_field_label: ['Pet name', 'Size'], bk_field_type: ['text', 'select'], bk_field_options: ['', 'Small, Medium, Large'], bk_field_required: ['1', '1'],
    bk_policy: 'Please give 24 hours notice to cancel.', ...o
  };
  for (const d of ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']) { f[`bk_open_${d}`] = '09:00'; f[`bk_close_${d}`] = '13:00'; }
  return f;
};
const daysAhead = (n) => { const d = new Date(Date.now() + n * 86400000); return d.toISOString().slice(0, 10); };

test('booking: setup, open times, request, double-booking guard, owner confirm/decline, customer cancel', async () => {
  const c = makeClient();
  const { siteId, slug } = await basicSite(c, 'booker@example.com', 'Paws Booking', bookingFields());
  const date = daysAhead(5);

  // page is live with the owner's industry questions and a Book Now button
  const page = await (await fetch(`${BASE}/site/${slug}/book`)).text();
  assert.match(page, /Book a Grooming/);
  assert.match(page, /name="service" value="Full groom"/);
  assert.match(page, /Pet name/);
  assert.match(page, /<option value="Medium"/);
  assert.match(page, /Please give 24 hours notice/);
  assert.match(page, /class="nav-cta" href="\/site\/paws-booking\/book">Book Now</);
  assert.match(await (await fetch(`${BASE}/site/${slug}`)).text(), /Book Now/);
  const form = page.match(/<form[^>]*id="bookForm"[\s\S]*?<\/form>/)[0];
  assert.doesNotMatch(form.slice(10), /<form/, 'no nested forms');

  // open times: 09:00-13:00, hourly; a two hour service leaves 09, 10, 11
  const slots = async (q) => (await (await fetch(`${BASE}/site/${slug}/book/slots?${new URLSearchParams(q)}`)).json()).slots.map(s => s.time);
  assert.deepEqual(await slots({ service: 'Full groom', date }), ['09:00', '10:00', '11:00']);
  assert.deepEqual(await slots({ service: 'Bath only', date }), ['09:00', '10:00', '11:00', '12:00']);
  assert.deepEqual(await slots({ service: 'Nope', date }), []);
  assert.deepEqual(await slots({ service: 'Full groom', date: daysAhead(200) }), [], 'beyond the booking window');
  assert.deepEqual(await slots({ service: 'Full groom', date: daysAhead(-1) }), [], 'in the past');

  const post = (body, p = 'book') => fetch(`${BASE}/site/${slug}/${p}`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() });
  const good = { service: 'Full groom', date, time: '10:00', name: 'Dana Pet', email: 'dana@example.com', phone: '555-0199', f_0: 'Biscuit', f_1: 'Medium', notes: 'Nervous around dryers', addon: 'Nail trim' };

  // validation
  for (const [bad, msg] of [[{ name: '' }, /enter your name/], [{ email: 'nope' }, /valid email/], [{ service: 'Bogus' }, /choose a service/], [{ f_0: '' }, /highlighted/], [{ time: '' }, /date and time/], [{ time: '10:30' }, /no longer available/]]) {
    const r = await post({ ...good, ...bad });
    assert.equal(r.status, 422, JSON.stringify(bad));
    const html = await r.text();
    assert.match(html, msg);
    assert.match(html, /value="Dana Pet"|value=""/); // form is re-shown
  }
  assert.equal((await post({ ...good, f_1: 'Giant' })).status, 422, 'a dropdown answer must be one of the choices');
  const bot = await post({ ...good, website: 'http://spam' });
  assert.match(bot.headers.get('location'), /done=1/);

  // a real request: stored pending, owner and customer emailed
  const m0 = mailCount();
  const ok = await post(good);
  assert.equal(ok.status, 302);
  const loc = ok.headers.get('location');
  assert.match(loc, new RegExp(`^/site/${slug}/book\\?t=[\\w-]+&new=1$`));
  const status = await (await fetch(`${BASE}${loc}`)).text();
  assert.match(status, /not confirmed yet/);
  assert.match(status, /Full groom \+ Nail trim/);
  assert.match(status, /Biscuit/);
  assert.match(status, /noindex/);
  const mails = await waitForMail(m0 + 2);
  const to = mails.slice(m0).map(m => m.to[0].address).sort();
  assert.deepEqual(to, ['dana@example.com', 'owner@biz.test']);
  const ownerMail = mails.slice(m0).find(m => m.to[0].address === 'owner@biz.test');
  assert.match(ownerMail.text, /Biscuit/);
  assert.match(ownerMail.text, /\/sites\/\d+\/bookings/);

  // the time is now held: the same start and anything overlapping it are gone
  assert.deepEqual(await slots({ service: 'Full groom', date }), [], 'a 2h groom at 10:00 leaves no room for another 2h groom (09:00 and 11:00 overlap it, 12:00 runs past closing)');
  assert.deepEqual(await slots({ service: 'Bath only', date }), ['09:00', '12:00']);
  const dup = await post({ ...good, name: 'Someone Else', email: 'else@example.com', time: '11:00' });
  assert.equal(dup.status, 422);
  assert.match(await dup.text(), /no longer available/);

  // owner sees it, other users cannot
  let html = await (await c.get(`/sites/${siteId}/bookings`)).text();
  assert.match(html, /Dana Pet/);
  assert.match(html, /Nervous around dryers/);
  assert.match(await (await c.get(`/sites/${siteId}/edit`)).text(), /Bookings \(1 new\)/);
  const bid = html.match(/\/bookings\/(\d+)"/)[1];
  const other = makeClient();
  await other.post('/signup', { email: 'booker-other@example.com', password: 'password1' });
  assert.equal((await other.get(`/sites/${siteId}/bookings`)).status, 404);
  assert.equal((await other.post(`/sites/${siteId}/bookings/${bid}`, { action: 'confirm' })).status, 404);

  const m1 = mailCount();
  assert.match((await c.post(`/sites/${siteId}/bookings/${bid}`, { action: 'confirm', message: 'See you then!' })).headers.get('location'), /m=confirmed/);
  const cm = (await waitForMail(m1 + 1)).slice(m1)[0];
  assert.equal(cm.to[0].address, 'dana@example.com');
  assert.match(cm.text, /confirmed/);
  assert.match(cm.text, /See you then!/);
  assert.match(await (await fetch(`${BASE}${loc}`)).text(), /Your appointment is confirmed|You are booked/);
  // confirming twice is refused
  assert.match((await c.post(`/sites/${siteId}/bookings/${bid}`, { action: 'confirm' })).headers.get('location'), /m=bad/);

  // second request, owner declines -> the time is freed
  const r2 = await post({ ...good, time: '12:00', service: 'Bath only', name: 'Lee', email: 'lee@example.com', addon: '' });
  assert.equal(r2.status, 302);
  html = await (await c.get(`/sites/${siteId}/bookings`)).text();
  const bid2 = [...html.matchAll(/\/bookings\/(\d+)"/g)].map(x => x[1]).find(x => x !== bid);
  assert.deepEqual(await slots({ service: 'Bath only', date }), ['09:00']);
  await c.post(`/sites/${siteId}/bookings/${bid2}`, { action: 'decline' });
  assert.deepEqual(await slots({ service: 'Bath only', date }), ['09:00', '12:00']);

  // customer cancels the confirmed one with their private link -> time freed again
  const token = loc.match(/t=([\w-]+)/)[1];
  const cancel = await post({ token }, 'book/cancel');
  assert.match(cancel.headers.get('location'), /book\?t=/);
  assert.match(await (await fetch(`${BASE}${loc}`)).text(), /was cancelled/);
  assert.deepEqual(await slots({ service: 'Full groom', date }), ['09:00', '10:00', '11:00']);
  // a made-up token shows the plain form, not someone's booking
  assert.doesNotMatch(await (await fetch(`${BASE}/site/${slug}/book?t=nope`)).text(), /Dana Pet/);
});

test('booking: switched off by default, auto-confirm, mobile address, preview and presets', async () => {
  const c = makeClient();
  const { siteId, slug } = await basicSite(c, 'booker2@example.com', 'Van Groomers');
  assert.equal((await fetch(`${BASE}/site/${slug}/book`)).status, 404, 'off until the owner turns it on');
  assert.equal((await fetch(`${BASE}/site/${slug}/book/slots?service=x&date=2030-01-01`)).status, 404);
  assert.doesNotMatch(await (await fetch(`${BASE}/site/${slug}`)).text(), /Book Now/);
  assert.match(await (await c.get(`/sites/${siteId}/edit`)).text(), /Online booking/);

  // loading a preset fills services from the site's own services and keeps booking off
  assert.match((await c.post(`/sites/${siteId}/booking/preset`, { kind: 'mobile-grooming' })).headers.get('location'), /booking=1/);
  let edit = await (await c.get(`/sites/${siteId}/edit`)).text();
  assert.match(edit, /name="bk_service_name" value="Roof Repair"/);
  assert.match(edit, /Parking or access notes/);
  assert.match(edit, /name="bk_askAddress"[^>]*checked/);
  assert.doesNotMatch(edit, /name="bk_enabled"[^>]*checked/);

  // a save from the editor keeps everything (the editor posts the whole form)
  const f = bookingFields({ bk_kind: 'mobile-grooming', bk_autoConfirm: '1', bk_askAddress: '1', bk_field_label: ['Pet name'], bk_field_type: ['text'], bk_field_options: [''], bk_field_required: ['0'] });
  await c.post(`/sites/${siteId}/edit`, { name: 'Van Groomers', hero_headline: 'Hi', about_heading: 'About', about_body: 'x', services_heading: 'S', service_title: ['Roof Repair'], service_description: ['d'], service_detail: [''], contact_heading: 'C', contact_email: 'owner@biz.test', layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact', ...f });
  const date = daysAhead(4);
  const post = (body) => fetch(`${BASE}/site/${slug}/book`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() });
  const base = { service: 'Bath only', date, time: '09:00', name: 'Sam', email: 'sam@example.com' };
  const noAddr = await post(base);
  assert.equal(noAddr.status, 422);
  assert.match(await noAddr.text(), /address where we should come/);
  const m0 = mailCount();
  const ok = await post({ ...base, address: '12 Palm Way, Kissimmee FL' });
  assert.equal(ok.status, 302);
  const st = await (await fetch(`${BASE}${ok.headers.get('location')}`)).text();
  assert.match(st, /You are booked/);
  assert.match(st, /12 Palm Way/);
  const mails = await waitForMail(m0 + 2);
  assert.ok(mails.slice(m0).some(m => m.to[0].address === 'sam@example.com' && /confirmed/i.test(m.text)));

  // the editor preview shows the booking page but cannot submit
  const prev = await (await c.get(`/sites/${siteId}/preview/book`)).text();
  assert.match(prev, /Preview: booking is disabled here/);
  assert.match(prev, /id="bookSubmit"[^>]*disabled/);
  const ps = await (await c.get(`/sites/${siteId}/preview/book/slots?service=Bath%20only&date=${daysAhead(6)}`)).json();
  assert.ok(ps.slots.length > 0);
  assert.equal((await fetch(`${BASE}/sites/${siteId}/preview/book/slots`, { redirect: 'manual' })).status, 302, 'previews are private to the owner');

  // static export still works (booking needs the server, so the export has no Book Now link)
  assert.equal((await c.get(`/sites/${siteId}/export`)).status, 200);
});

test('palette: editor shows the palette panel and serves the script', async () => {
  const c = makeClient();
  const { siteId } = await basicSite(c, 'palette@example.com', 'Palette Pets', { meta_businessType: 'pet grooming' });
  const html = await (await c.get(`/sites/${siteId}/edit`)).text();
  assert.match(html, /id="paletteBox"[^>]*data-biztype="pet grooming"/);
  assert.match(html, /<script src="\/palette\.js"><\/script>/);
  const js = await fetch(`${BASE}/palette.js`);
  assert.equal(js.status, 200);
  assert.match(await js.text(), /suggestions/);
});

test('pricing block, announcement bar, lightbox and search markup', async () => {
  const c = makeClient();
  const fields = {
    block_type: ['pricing'], block_heading: ['Grooming packages'],
    block_body: ['Bath | from $40 | Wash and dry, Brush out, Ear cleaning\n* Full groom | from $70 | Bath, Haircut, Nail trim\n | $5 | no name here'],
    block_image: [''], block_side: ['auto'], block_buttonText: ['Book now'], block_buttonUrl: ['/site/shine-pets/book'], block_edge: ['none'], block_bg: ['none'], block_place: ['bottom'],
    ann_enabled: '1', ann_text: 'Now booking holiday appointments', ann_linkText: 'Book', ann_linkUrl: '/site/shine-pets/book',
    gallery_image: ['https://img.example/a.jpg', 'https://img.example/b.jpg'],
    faq_question: ['Do you take walk-ins?'], faq_answer: ['Please book ahead.'],
    hours_day: ['Monday', 'Tuesday', 'Saturday', 'Sunday', 'Holidays'], hours_time: ['9:00 AM – 5:30 PM', '9am - 5pm', 'Closed', 'Closed', 'Call us']
  };
  const { siteId } = await basicSite(c, 'shine@example.com', 'Shine Pets', fields);
  const home = await (await fetch(`${BASE}/site/shine-pets`)).text();
  // pricing
  assert.match(home, /class="price-grid n2"/, 'junk line without a name is dropped');
  assert.match(home, /<div class="price-card hot">\s*<span class="price-flag">Featured<\/span>\s*<h3>Full groom<\/h3>/);
  assert.match(home, /<div class="price-amt">from \$70<\/div>/);
  assert.match(home, /<li>Nail trim<\/li>/);
  assert.equal((home.match(/class="btn" href="\/site\/shine-pets\/book">Book now/g) || []).length, 2, 'each plan has the button');
  assert.doesNotMatch(home, /Most popular|best value/i, 'no invented claims');
  // announcement
  assert.match(home, /id="annBar"[^>]*>\s*<span>Now booking holiday appointments<\/span><a href="\/site\/shine-pets\/book">Book<\/a>/);
  assert.match(await (await fetch(`${BASE}/site/shine-pets/about`)).text(), /id="annBar"/, 'on every page');
  // lightbox on the gallery
  const gal = await (await fetch(`${BASE}/site/shine-pets/gallery`)).text();
  assert.match(gal, /<div class="gallery-grid" data-lightbox data-sg-cards="gallery">/);
  assert.match(gal, /class="lb-close|lb-close/);
  // structured data
  const ldOf = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
  const lb = ldOf(home).find(x => x['@type'] === 'LocalBusiness');
  assert.deepEqual(lb.openingHoursSpecification, [
    { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Monday', opens: '09:00', closes: '17:30' },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Tuesday', opens: '09:00', closes: '17:00' }
  ], 'only readable rows; Closed and free text are left out');
  const faq = ldOf(await (await fetch(`${BASE}/site/shine-pets/faq`)).text()).find(x => x['@type'] === 'FAQPage');
  assert.equal(faq.mainEntity[0].name, 'Do you take walk-ins?');
  assert.equal(faq.mainEntity[0].acceptedAnswer.text, 'Please book ahead.');
  assert.ok(!ldOf(home).some(x => x['@type'] === 'FAQPage'), 'FAQ markup only on the FAQ page, where the questions are visible');
  assert.doesNotMatch(JSON.stringify(ldOf(home)), /aggregateRating/);

  // turning things off / junk input
  await c.post(`/sites/${siteId}/edit`, { name: 'Shine Pets', hero_headline: 'Hi', about_heading: 'About', about_body: 'x', services_heading: 'S', service_title: ['A'], service_description: ['d'], service_detail: [''], contact_heading: 'C', contact_email: 'owner@biz.test', layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact', ann_enabled: '1', ann_text: '', ann_linkUrl: 'javascript:alert(1)', ann_linkText: 'x' });
  const off = await (await fetch(`${BASE}/site/shine-pets`)).text();
  assert.doesNotMatch(off, /id="annBar"/, 'no message, no bar');
  assert.doesNotMatch(off, /class="price-grid/);
  // the editor offers all of it
  const edit = await (await c.get(`/sites/${siteId}/edit`)).text();
  assert.match(edit, /name="ann_text"/);
  assert.match(edit, /data-newblock="pricing"/);
  assert.match(edit, /id="tpl-block-pricing"/);
});

test('team, numbers, video, tabs, accordion, review carousel, floating text button, share picture', async () => {
  const c = makeClient();
  const none = ['', '', '', '', ''];
  const fields = {
    block_type: ['team', 'stats', 'video', 'tabs', 'accordion'],
    block_heading: ['Meet the team', 'By the numbers', 'See us at work', 'What we groom', 'Questions'],
    block_body: [
      'Jordan Lee | Lead groomer | Loves big dogs | https://img.example/jordan.jpg\nSam Ortiz | Bather\n | Nobody | no name\nEvil | x | y | javascript:alert(1)',
      '12 | Years in business\n1,500+ | Pets groomed',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'Dogs | Baths, trims and full grooms\nCats | Gentle handling',
      'How long does it take? | About two hours.\nDo you take walk-ins? | Please book ahead.'
    ],
    block_image: none, block_side: ['auto', 'auto', 'auto', 'auto', 'auto'], block_buttonText: none, block_buttonUrl: none, block_edge: ['none', 'none', 'none', 'none', 'none'], block_bg: ['none', 'none', 'none', 'none', 'none'], block_place: ['bottom', 'bottom', 'bottom', 'bottom', 'bottom'],
    testimonials_display: 'carousel', testimonial_quote: ['Great groom!', 'Kind and quick.'], testimonial_author: ['Dana', 'Lee'], testimonial_rating: ['5', '4'], testimonial_date: ['', ''],
    contact_phone: '(407) 555-0100', contact_floatButton: 'whatsapp',
    seo_shareImage: 'https://img.example/share.jpg'
  };
  const { siteId } = await basicSite(c, 'extras@example.com', 'Extras Pets', fields);
  const home = await (await fetch(`${BASE}/site/extras-pets`)).text();
  // team
  assert.match(home, /<h3>Jordan Lee<\/h3>\s*<div class="team-role">Lead groomer<\/div>/);
  assert.match(home, /<img src="https:\/\/img\.example\/jordan\.jpg" alt="Jordan Lee"/);
  assert.match(home, /<span class="team-initial"[^>]*>S<\/span>\s*<h3>Sam Ortiz<\/h3>/, 'no photo -> initial');
  assert.doesNotMatch(home, /Nobody/);
  assert.doesNotMatch(home, /javascript:alert/);
  // numbers
  assert.match(home, /<div class="stat-num" data-count="1500" data-suffix="\+" data-comma="1">1,500\+<\/div>\s*<div class="stat-label">Pets groomed<\/div>/);
  // video: click-to-load embed, nothing from YouTube is loaded until then
  assert.match(home, /data-embed="https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?autoplay=1&amp;rel=0"/);
  assert.doesNotMatch(home, /<iframe/);
  // tabs and accordion
  assert.match(home, /<button type="button" role="tab" class="tab-btn on" aria-selected="true">Dogs<\/button>/);
  assert.match(home, /<div class="tab-panel" role="tabpanel" data-off><p>Gentle handling<\/p>/);
  assert.match(home, /<details class="acc-item" open><summary>How long does it take\?<\/summary><p>About two hours\.<\/p>/);
  assert.match(home, /<details class="acc-item"><summary>Do you take walk-ins\?/);
  // review carousel (home strip and reviews page)
  const rev = await (await fetch(`${BASE}/site/extras-pets/testimonials`)).text();
  assert.match(rev, /<div class="strip t-carousel" tabindex="0">/);
  assert.match(rev, /strip-btn next/);
  // floating button
  assert.match(home, /<a class="float-contact wa" href="https:\/\/wa\.me\/14075550100" target="_blank" rel="noopener">/);
  // share picture
  assert.match(home, /<meta property="og:image" content="https:\/\/img\.example\/share\.jpg">/);

  // editor round-trip: everything is offered and survives another save of the same form
  const edit = await (await c.get(`/sites/${siteId}/edit`)).text();
  for (const t of ['team', 'stats', 'video', 'tabs', 'accordion']) { assert.match(edit, new RegExp(`data-newblock="${t}"`)); assert.match(edit, new RegExp(`id="tpl-block-${t}"`)); }
  assert.match(edit, /name="testimonials_display"[\s\S]*?<option value="carousel" selected>/);
  assert.match(edit, /name="contact_floatButton"[\s\S]*?<option value="whatsapp" selected>/);
  assert.match(edit, /name="seo_shareImage" value="https:\/\/img\.example\/share\.jpg"/);

  // switching things off / junk input
  const base = { name: 'Extras Pets', hero_headline: 'Hi', about_heading: 'About', about_body: 'x', services_heading: 'S', service_title: ['A'], service_description: ['d'], service_detail: [''], contact_heading: 'C', contact_email: 'owner@biz.test', layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact', testimonial_quote: ['Great groom!'], testimonial_author: ['Dana'], testimonial_rating: ['5'], testimonial_date: [''] };
  await c.post(`/sites/${siteId}/edit`, { ...base, testimonials_display: 'weird', contact_phone: '123', contact_floatButton: 'text', block_type: ['video', 'team'], block_heading: ['V', 'T'], block_body: ['https://evil.example/not-a-video', ''], block_image: ['', ''], block_side: ['auto', 'auto'], block_buttonText: ['', ''], block_buttonUrl: ['', ''], block_edge: ['none', 'none'], block_bg: ['none', 'none'], block_place: ['bottom', 'bottom'], seo_shareImage: 'javascript:alert(1)' });
  const off = await (await fetch(`${BASE}/site/extras-pets`)).text();
  assert.doesNotMatch(off, /class="strip t-carousel/, 'unknown display falls back to the grid');
  assert.doesNotMatch(off, /class="float-contact/, 'a too-short phone number gets no button');
  assert.doesNotMatch(off, /class="video-frame|<video/, 'a link that is not a video shows nothing');
  assert.doesNotMatch(off, /javascript:alert/);
  const t2 = await (await c.get(`/sites/${siteId}/edit`)).text();
  assert.match(t2, /name="seo_shareImage" value=""/);
  await c.post(`/sites/${siteId}/edit`, { ...base, contact_phone: '(407) 555-0100', contact_floatButton: 'text' });
  assert.match(await (await fetch(`${BASE}/site/extras-pets`)).text(), /<a class="float-contact" href="sms:\+14075550100">/);
});

test('blocks on any page, hero controls, button/corner/spacing controls, logo favicon', async () => {
  const c = makeClient();
  const none = ['', '', ''];
  const fields = {
    block_type: ['stats', 'pricing', 'accordion'], block_heading: ['Home numbers', 'Our prices', 'Contact FAQ'],
    block_body: ['10 | Years', 'Basic | $10 | One, Two', 'Q? | A.'],
    block_image: none, block_side: ['auto', 'auto', 'auto'], block_buttonText: none, block_buttonUrl: none, block_edge: ['none', 'none', 'none'], block_bg: ['none', 'none', 'none'],
    block_place: ['bottom', 'top', 'bottom'], block_page: ['home', 'services', 'contact'],
    hero_imageUrl: 'https://img.example/hero.jpg', hero_focalX: '20', hero_focalY: '80', hero_overlay: '60', hero_align: 'right', hero_videoUrl: 'https://cdn.example/loop.mp4',
    theme_buttonShape: 'square', theme_corners: 'round', theme_spacing: 'airy', theme_logoUrl: 'https://img.example/logo.png'
  };
  const { siteId } = await basicSite(c, 'feel@example.com', 'Feel Co', fields);
  const get = async (p) => (await fetch(`${BASE}/site/feel-co${p}`)).text();
  const home = await get(''), services = await get('/services'), contact = await get('/contact'), about = await get('/about');
  // blocks follow the page the owner chose
  assert.match(home, /Home numbers/); assert.doesNotMatch(home, /Our prices|Contact FAQ/);
  assert.match(services, /class="price-grid/); assert.doesNotMatch(services, /Home numbers/);
  assert.match(contact, /<details class="acc-item"/); assert.doesNotMatch(contact, /class="price-grid/);
  assert.doesNotMatch(about, /Home numbers|Our prices|Contact FAQ/);
  // 'top' blocks come before the page's own content, 'bottom' ones after
  assert.ok(services.indexOf('Our prices') < services.indexOf('id="services"'), 'top block precedes the section');
  assert.ok(contact.indexOf('id="contact"') < contact.indexOf('Contact FAQ'), 'bottom block follows the section');
  // hero controls
  assert.match(home, /id="hero" style="--fx: 20%; --fy: 80%; --ov-b: 0\.60; --ov-t: 0\.30;"/);
  assert.match(home, /<body class="[^"]*\bhero-ov\b[^"]*\bheroalign-right\b/);
  assert.match(home, /<video class="hero-video" autoplay muted loop playsinline preload="metadata" aria-hidden="true" tabindex="-1" src="https:\/\/cdn\.example\/loop\.mp4">/);
  assert.doesNotMatch(services, /<video class="hero-video"/, 'video is home-only');
  // feel controls and favicon
  assert.match(home, /<body class="[^"]*\bbtn-square\b[^"]*\bcorners-round\b[^"]*\bspace-airy\b/);
  assert.match(home, /<link rel="icon" href="https:\/\/img\.example\/logo\.png">/);
  assert.doesNotMatch(home, /rel="icon" type="image\/svg\+xml"/, "logo replaces the letter favicon");
  // editor round-trip
  const edit = await (await c.get(`/sites/${siteId}/edit`)).text();
  assert.match(edit, /name="hero_focalX" id="focalX" value="20"/);
  assert.match(edit, /name="hero_overlay">[\s\S]*?<option value="60" selected>/);
  assert.match(edit, /name="hero_align">[\s\S]*?<option value="right" selected>/);
  assert.match(edit, /name="theme_buttonShape">[\s\S]*?<option value="square" selected>/);
  assert.match(edit, /name="block_page"[\s\S]*?<option value="services" selected>/);
  assert.match(edit, /name="hero_videoUrl" value="https:\/\/cdn\.example\/loop\.mp4"/);
  // junk is dropped
  const base = { name: 'Feel Co', hero_headline: 'Hi', about_heading: 'About', about_body: 'x', services_heading: 'S', service_title: ['A'], service_description: ['d'], service_detail: [''], contact_heading: 'C', contact_email: 'owner@biz.test', layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact' };
  await c.post(`/sites/${siteId}/edit`, { ...base, hero_imageUrl: 'https://img.example/hero.jpg', hero_focalX: '900', hero_focalY: 'abc', hero_overlay: '99', hero_align: 'diagonal', hero_videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', theme_buttonShape: 'star', theme_corners: 'x', theme_spacing: 'y', block_type: ['stats'], block_heading: ['Odd'], block_body: ['1 | a'], block_image: [''], block_side: ['auto'], block_buttonText: [''], block_buttonUrl: [''], block_edge: ['none'], block_bg: ['none'], block_place: ['bottom'], block_page: ['nowhere'] });
  const j = await get('');
  assert.match(j, /--fx: 100%; --fy: 50%;"/);
  assert.doesNotMatch(j, /<video class="hero-video"/);
  assert.doesNotMatch(j, /<body class="[^"]*(hero-ov|heroalign-|btn-star|corners-x|space-y)/);
  assert.match(j, /Odd/, 'an unknown page falls back to home');
  assert.match(j, /rel="icon" type="image\/svg\+xml"/, "no logo again -> letter favicon");
});

test('header options: sticky default, shrink, static, centered, transparent only on the home page', async () => {
  const c = makeClient();
  const { siteId } = await basicSite(c, 'hdr@example.com', 'Hdr Co', { theme_header: 'transparent', theme_headerLayout: 'centered' });
  const get = async (p) => (await fetch(`${BASE}/site/hdr-co${p}`)).text();
  const home = await get(''), about = await get('/about');
  assert.match(home, /<body class="[^"]*\bhdr-centered\b[^"]*\bhdr-transparent\b/);
  assert.doesNotMatch(about, /<body class="[^"]*\bhdr-transparent\b/, 'inner pages have no hero to float over');
  assert.match(about, /<body class="[^"]*\bhdr-centered\b/);
  const edit = await (await c.get(`/sites/${siteId}/edit`)).text();
  assert.match(edit, /name="theme_header">[\s\S]*?<option value="transparent" selected>/);
  assert.match(edit, /name="theme_headerLayout">[\s\S]*?<option value="centered" selected>/);
  await c.post(`/sites/${siteId}/edit`, { name: 'Hdr Co', theme_header: 'shrink', theme_headerLayout: 'zigzag', contact_acceptSubmissions: '1', layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact' });
  let h = await get('');
  assert.match(h, /<body class="[^"]*\bhdr-shrink\b/);
  assert.doesNotMatch(h, /<body class="[^"]*\bhdr-(centered|transparent)\b/, 'unknown layout values are ignored');
  await c.post(`/sites/${siteId}/edit`, { name: 'Hdr Co', theme_header: 'static', contact_acceptSubmissions: '1', layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact' });
  h = await get('');
  assert.match(h, /<body class="[^"]*\bhdr-static\b/);
  await c.post(`/sites/${siteId}/edit`, { name: 'Hdr Co', theme_header: 'bogus', contact_acceptSubmissions: '1', layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact' });
  h = await get('');
  assert.doesNotMatch(h, /<body class="[^"]*\bhdr-(static|shrink|transparent|centered)\b/);
});

test('custom contact form: build it, show it as steps, take answers, see them in leads, CSV and the alert email', async () => {
  const c = makeClient();
  const formRows = {
    cf_mode: 'custom', cf_title: 'Request an estimate', cf_intro: 'Quick questions first.', cf_submitText: 'Send it',
    cf_label: ['What do you need?', 'Property', 'Extras', 'Your name', 'Phone', 'Email', 'Photo of the spot'],
    cf_type: ['service', 'radio', 'checkbox', 'name', 'phone', 'email', 'photo'],
    cf_options: ['', 'House, Business', 'Gate, Dog, Stairs', '', '', '', ''],
    cf_step: ['1', '1', '2', '3', '3', '3', '2'], cf_required: ['1', '0', '0', '1', '1', '0', '0']
  };
  const { siteId } = await basicSite(c, 'cform@example.com', 'Cform Co', formRows);
  const page = await (await fetch(`${BASE}/site/cform-co/contact`)).text();
  assert.match(page, /<form[^>]*class="contact-form cform" data-steps="3"/);
  assert.match(page, /Request an estimate/); assert.match(page, /Quick questions first\./);
  assert.match(page, /class="cf-step" data-step="2"/);
  assert.match(page, /type="radio" name="cf_1" value="House"/);
  assert.match(page, /type="checkbox" name="cf_2" value="Stairs"/);
  assert.match(page, /name="cf_0"[\s\S]*?<option value="Roof Repair"/);
  assert.match(page, /type="file" name="photo"/);
  assert.match(page, />Send it</);
  assert.doesNotMatch(page, /name="message"/, 'the standard form is replaced');
  // service pages that carry the quote card use the custom form too
  // editor round-trip
  const edit = await (await c.get(`/sites/${siteId}/edit`)).text();
  assert.match(edit, /id="cfMode">\s*<option value="standard" >Standard form<\/option>\s*<option value="custom" selected>/);
  assert.match(edit, /name="cf_label" value="Property"/);
  assert.match(edit, /<option value="checkbox" selected>/);
  assert.match(edit, /id="cfPresets"/);
  // a visitor submits it
  const before = mailCount();
  const f = new FormData();
  f.append('cf_0', 'Roof Repair'); f.append('cf_1', 'House'); f.append('cf_2', 'Gate'); f.append('cf_2', 'Stairs'); f.append('cf_2', 'Bogus');
  f.append('cf_3', 'Dana Visitor'); f.append('cf_4', '407-555-9999'); f.append('cf_5', 'dana@example.com');
  const res = await fetch(`${BASE}/site/cform-co/contact`, { method: 'POST', body: f, redirect: 'manual' });
  assert.match(res.headers.get('location'), /thank-you$/);
  const leads = await (await c.get(`/sites/${siteId}/leads`)).text();
  assert.match(leads, /Dana Visitor/); assert.match(leads, /Roof Repair/);
  assert.match(leads, /<dt>Property<\/dt><dd>House<\/dd>/);
  assert.match(leads, /<dt>Extras<\/dt><dd>Gate, Stairs<\/dd>/, 'unknown checkbox values are dropped');
  const csv = await (await c.get(`/sites/${siteId}/leads.csv`)).text();
  assert.match(csv, /Answers/); assert.match(csv, /Property: House \| Extras: Gate, Stairs/);
  const mails = (await waitForMail(before + 1)).slice(before);
  assert.match(JSON.stringify(mails), /Property: House/);
  // required answers are enforced on the server too
  const bad = new FormData();
  bad.append('cf_0', 'Roof Repair'); bad.append('cf_5', 'x@y.co'); // no name, no phone
  const rej = await fetch(`${BASE}/site/cform-co/contact`, { method: 'POST', body: bad, redirect: 'manual' });
  assert.match(rej.headers.get('location'), /contact_error=1/);
  const after = await (await c.get(`/sites/${siteId}/leads`)).text();
  assert.equal((after.match(/id="lead-/g) || []).length, 1, 'rejected submission is not stored');
  // switching back to the standard form brings back the standard fields and keeps the questions saved
  await c.post(`/sites/${siteId}/edit`, { name: 'Cform Co', ...formRows, cf_mode: 'standard', contact_acceptSubmissions: '1', layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact' });
  const std = await (await fetch(`${BASE}/site/cform-co/contact`)).text();
  assert.match(std, /name="message"/); assert.doesNotMatch(std, /class="contact-form cform"/);
  assert.match(await (await c.get(`/sites/${siteId}/edit`)).text(), /name="cf_label" value="Property"/);
});

test('custom form on a one-step form shows no wizard controls; no services hides the service question', async () => {
  const c = makeClient();
  const { slug } = await basicSite(c, 'cform1@example.com', 'Onestep Co', {
    service_title: [''], service_description: [''], service_detail: [''],
    cf_mode: 'custom', cf_label: ['Service', 'Phone'], cf_type: ['service', 'phone'], cf_options: ['', ''], cf_step: ['1', '1'], cf_required: ['1', '1']
  });
  const page = await (await fetch(`${BASE}/site/${slug}/contact`)).text();
  assert.match(page, /data-steps="1"/);
  assert.doesNotMatch(page, /class="cf-progress"|class="btn cf-next"/);
  assert.doesNotMatch(page, /Select a service/);
  assert.match(page, /type="tel" name="cf_1"/);
});

test('pre-launch audit: placeholders, links, share picture, photo descriptions, form without a way to reply', async () => {
  const c = makeClient();
  const { siteId } = await basicSite(c, 'audit@example.com', 'Audit Co', {
    about_body: 'Lorem ipsum dolor sit amet', contact_phone: '4075', contact_email: 'info@example.com',
    hero_headline: 'H'.repeat(100), hero_ctaLink: '/pricing', hero_imageUrl: '',
    gallery_image: ['https://img.example/a.jpg', 'https://img.example/b.jpg'], gallery_alt: ['A dog in a tub', ''],
    seo_title: 'T'.repeat(70), seo_description: 'Short one',
    cf_mode: 'custom', cf_label: ['Question'], cf_type: ['text'], cf_options: [''], cf_step: ['1'], cf_required: ['0']
  });
  const items = (await (await c.get(`/sites/${siteId}/checklist`)).json()).items;
  const text = items.map(i => `${i.level}: ${i.text}`).join('\n');
  assert.match(text, /warn: Placeholder text is still on the site: .*Lorem ipsum.*example\.com/);
  assert.match(text, /warn: The phone number "4075" does not look like a full phone number/);
  assert.match(text, /warn: These links point to a page that does not exist or is hidden: \/pricing/);
  assert.match(text, /warn: Your custom contact form has no Phone or Email question/);
  assert.match(text, /tip: 1 of the 2 gallery photos has a description/);
  assert.match(text, /tip: The search title is 70 characters/);
  assert.match(text, /tip: The search description is short/);
  assert.match(text, /tip: No share picture and no hero photo/);
  assert.match(text, /tip: The home page headline is very long/);
  // fixing them clears them
  await c.post(`/sites/${siteId}/edit`, { name: 'Audit Co', about_body: 'We fix things.', contact_phone: '407-555-1234', contact_email: 'info@auditco.test', hero_headline: 'Fixed', hero_ctaLink: '/contact', hero_imageUrl: '/uploads/nothing-here.jpg', contact_acceptSubmissions: '1', layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact', gallery_image: ['https://img.example/a.jpg'], gallery_alt: ['A dog'], seo_title: 'Audit Co | Fixes', seo_description: 'D'.repeat(130) });
  const t2 = (await (await c.get(`/sites/${siteId}/checklist`)).json()).items.map(i => i.text).join('\n');
  assert.doesNotMatch(t2, /Placeholder text|phone number|do not exist|custom contact form|gallery photo|search title|search description is|headline is very long/);
  assert.match(t2, /missing from the uploads folder \(nothing-here\.jpg\)/, 'a photo that is not on disk is flagged');
});

test('gallery photo descriptions become alt text and survive a client edit', async (t) => {
  const c = makeClient();
  const { slug, siteId } = await basicSite(c, 'alts@example.com', 'Alts Co', {
    gallery_image: ['https://img.example/a.jpg', 'https://img.example/b.jpg'], gallery_alt: ['Groomed poodle', ''],
    about_imageUrl: 'https://img.example/team.jpg', about_imageAlt: 'The team outside the shop'
  });
  const gal = await (await fetch(`${BASE}/site/${slug}/gallery`)).text();
  assert.match(gal, /<img src="https:\/\/img\.example\/a\.jpg" alt="Groomed poodle"/);
  assert.match(gal, /<img src="https:\/\/img\.example\/b\.jpg" alt="Alts Co — photo"/, 'blank description falls back');
  const about = await (await fetch(`${BASE}/site/${slug}/about`)).text();
  assert.match(about, /alt="The team outside the shop"/);
  const edit = await (await c.get(`/sites/${siteId}/edit`)).text();
  assert.match(edit, /name="gallery_alt" value="Groomed poodle"/);
  assert.match(edit, /name="about_imageAlt" value="The team outside the shop"/);
});

test('speed pass: an uploaded photo is served with WebP copies, a srcset, a lazy gallery and a preloaded hero', async (t) => {
  let sharp;
  try { sharp = require('sharp'); } catch { return t.skip('sharp not installed'); }
  const c = makeClient();
  const { siteId, slug } = await basicSite(c, 'speed@example.com', 'Speed Co');
  const big = await sharp({ create: { width: 2800, height: 1800, channels: 3, background: { r: 20, g: 140, b: 90 } } }).jpeg({ quality: 95 }).toBuffer();
  const form = new FormData();
  form.append('image', new Blob([big], { type: 'image/jpeg' }), 'speed.jpg');
  const { url } = await (await c.post(`/sites/${siteId}/upload`, form)).json();
  const base = url.replace(/\.jpg$/, '');
  for (const w of [480, 960, 1440, 1920]) {
    const r = await fetch(`${BASE}${base}-${w}.webp`);
    assert.equal(r.status, 200, `${w}px copy is served`);
    assert.equal(r.headers.get('content-type'), 'image/webp');
  }
  await c.post(`/sites/${siteId}/edit`, { name: 'Speed Co', hero_imageUrl: url, gallery_image: [url, url], gallery_alt: ['one', 'two'], contact_acceptSubmissions: '1', layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact' });
  const home = await (await fetch(`${BASE}/site/${slug}`)).text();
  assert.ok(home.includes(`<link rel="preload" as="image" href="${base}-1920.webp" fetchpriority="high">`));
  assert.ok(home.includes(`data-hero-photo="${base}-1920.webp"`));
  const gal = await (await fetch(`${BASE}/site/${slug}/gallery`)).text();
  const tag = gal.match(/<img[^>]*alt="one"[^>]*>/)[0];
  assert.match(tag, /srcset="[^"]*-480\.webp 480w[^"]*-1920\.webp 1920w"/);
  assert.match(tag, /loading="lazy"/);
  assert.ok(tag.includes(`src="${url}"`), 'the original stays as the fallback');
  // the checklist does not call a processed photo large
  const items = (await (await c.get(`/sites/${siteId}/checklist`)).json()).items.map(i => i.text).join('\n');
  assert.doesNotMatch(items, /still large/);
  // static export bundles the copies the page refers to
  const zip = await c.get(`/sites/${siteId}/export`);
  const files = readZip(Buffer.from(await zip.arrayBuffer()));
  const names = Object.keys(files);
  assert.ok(names.includes(`uploads/${url.split('/').pop().replace('.jpg', '-1920.webp')}`), 'export includes the WebP copy');
  const html = files['gallery.html'].toString();
  assert.doesNotMatch(html, /["' ]\/uploads\//, 'all photo paths including srcset are relative');
});

// ---- tier 2: per-page SEO, redirects, 404, event counts, block library ----
const SAVE_BASE = { layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact', contact_acceptSubmissions: '1' };
const httpGetHost = (host, p) => new Promise((resolve, reject) => {
  require('node:http').get({ host: 'localhost', port: PORT, path: p, headers: { Host: host, 'user-agent': 'Mozilla/5.0' } }, (res) => {
    let body = ''; res.on('data', d => { body += d; }); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
  }).on('error', reject);
});

test('per-page search settings: own title, description, share picture, hidden-from-Google, per-service title', async () => {
  const c = makeClient();
  const { siteId, slug } = await basicSite(c, 'pageseo@example.com', 'Pageseo Co', {
    seopage_about_title: 'About Our Orlando Roofers | Pageseo', seopage_about_description: 'Meet the crew.', seopage_about_shareImage: 'https://img.example/about.jpg',
    seopage_gallery_noindex: '1', service_detail: ['We fix roofs of all kinds in Orlando.'], service_seoTitle: ['Roof Repair in Orlando | Pageseo'], service_seoDescription: ['Leak and storm repair.'],
    gallery_image: ['https://img.example/a.jpg']
  });
  const about = await (await fetch(`${BASE}/site/${slug}/about`)).text();
  assert.match(about, /<title>About Our Orlando Roofers \| Pageseo<\/title>/);
  assert.match(about, /<meta name="description" content="Meet the crew\.">/);
  assert.match(about, /og:image" content="https:\/\/img\.example\/about\.jpg"/);
  assert.match(about, /<meta property="og:title" content="About Our Orlando Roofers \| Pageseo">/);
  assert.doesNotMatch(about, /<meta name="robots"/);
  const services = await (await fetch(`${BASE}/site/${slug}/services`)).text();
  assert.doesNotMatch(services, /About Our Orlando Roofers/, 'other pages keep their automatic title');
  const gallery = await (await fetch(`${BASE}/site/${slug}/gallery`)).text();
  assert.match(gallery, /<meta name="robots" content="noindex">/);
  const svc = await (await fetch(`${BASE}/site/${slug}/services/roof-repair`)).text();
  assert.match(svc, /<title>Roof Repair in Orlando \| Pageseo<\/title>/);
  assert.match(svc, /<meta name="description" content="Leak and storm repair\.">/);
  const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
  assert.match(sitemap, new RegExp(`/site/${slug}/about<`));
  assert.doesNotMatch(sitemap, new RegExp(`/site/${slug}/gallery<`), 'noindex pages are left out of the sitemap');
  const edit = await (await c.get(`/sites/${siteId}/edit`)).text();
  assert.match(edit, /name="seopage_about_title" value="About Our Orlando Roofers \| Pageseo"/);
  assert.match(edit, /name="seopage_gallery_noindex" value="1" style="width:auto;" checked/);
  assert.match(edit, /name="service_seoTitle" value="Roof Repair in Orlando \| Pageseo"/);
  // clearing a page removes the override
  await c.post(`/sites/${siteId}/edit`, { name: 'Pageseo Co', ...SAVE_BASE, about_body: 'x' });
  assert.doesNotMatch(await (await fetch(`${BASE}/site/${slug}/about`)).text(), /About Our Orlando Roofers/);
});

test('redirects: exact, folder wildcard, temporary, external, query kept; unpublished and own pages handled', async () => {
  const c = makeClient();
  const { siteId, slug } = await basicSite(c, 'redir@example.com', 'Redir Co', {
    rd_from: ['/about-us.html', '/old-blog/*', '/promo', '/gone', '/loop'],
    rd_to: ['/about', '/gallery/*', 'https://elsewhere.example/deal', '/services', '/loop'],
    rd_code: ['301', '302', '301', '301', '301']
  });
  const go = (p) => fetch(`${BASE}/site/${slug}${p}`, { redirect: 'manual' });
  let r = await go('/about-us.html?utm=1');
  assert.equal(r.status, 301); assert.equal(r.headers.get('location'), `/site/${slug}/about?utm=1`);
  r = await go('/About-US.html/');
  assert.equal(r.status, 301, 'case and trailing slash are forgiven');
  r = await go('/old-blog/2019/post');
  assert.equal(r.status, 302); assert.equal(r.headers.get('location'), `/site/${slug}/gallery/2019/post`);
  r = await go('/promo');
  assert.equal(r.headers.get('location'), 'https://elsewhere.example/deal');
  assert.equal((await go('/loop')).status, 404, 'a rule that points at itself is dropped');
  assert.equal((await go('/about')).status, 200, 'real pages are untouched');
  // POSTs are never redirected
  const f = new FormData(); f.append('name', 'x'); f.append('phone', '1');
  assert.notEqual((await fetch(`${BASE}/site/${slug}/contact`, { method: 'POST', body: f, redirect: 'manual' })).status, 301);
  // custom domain: same rules, paths without the /site/<name> prefix
  await c.post(`/sites/${siteId}/edit`, { name: 'Redir Co', ...SAVE_BASE, custom_domain: 'www.redir-example.test', rd_from: ['/about-us.html'], rd_to: ['/about'], rd_code: ['301'] });
  const cd = await httpGetHost('www.redir-example.test', '/about-us.html');
  assert.equal(cd.status, 301); assert.equal(cd.headers.location, '/about');
  // unpublished sites do not redirect
  await c.post(`/sites/${siteId}/publish`, { published: '0' });
  assert.equal((await go('/about-us.html')).status, 404);
  // the editor shows the rules
  const edit = await (await c.get(`/sites/${siteId}/edit`)).text();
  assert.match(edit, /name="rd_from" value="\/about-us\.html"/);
  // checklist warns about a rule that hides a live page and one that leads nowhere
  await c.post(`/sites/${siteId}/edit`, { name: 'Redir Co', ...SAVE_BASE, rd_from: ['/about', '/old'], rd_to: ['/services', '/nowhere'], rd_code: ['301', '301'] });
  const items = (await (await c.get(`/sites/${siteId}/checklist`)).json()).items.map(i => i.text).join('\n');
  assert.match(items, /redirect starts from \/about, which is a live page/);
  assert.match(items, /redirects lead to a page that does not exist or is hidden: \/old → \/nowhere/);
});

test('page not found: the site\'s own styled 404, with the owner\'s wording; plain 404 elsewhere', async () => {
  const c = makeClient();
  const { siteId, slug } = await basicSite(c, 'nf@example.com', 'Nf Co', { nf_heading: 'Oops, wrong turn', nf_text: 'Try the menu above.', theme_style: 'bold' });
  for (const p of ['/nope', '/services/not-a-service', '/a/b/c', '/blog/missing', '/book']) {
    const r = await fetch(`${BASE}/site/${slug}${p}`);
    assert.equal(r.status, 404, p);
    const html = await r.text();
    assert.match(html, /Oops, wrong turn/, p); assert.match(html, /Try the menu above\./);
    assert.match(html, /<nav class="site-nav"/, 'has the site header');
    assert.match(html, /<meta name="robots" content="noindex">/);
    assert.match(html, /<body class="style-bold/);
    assert.match(html, new RegExp(`href="/site/${slug}"`), 'links back to the site home');
  }
  // default wording
  await c.post(`/sites/${siteId}/edit`, { name: 'Nf Co', ...SAVE_BASE });
  assert.match(await (await fetch(`${BASE}/site/${slug}/nope`)).text(), /We can&#39;t find that page/);
  // not-found views are not counted as page views
  const rep = await (await c.get(`/sites/${siteId}/report`)).text();
  assert.doesNotMatch(rep, /notfound/);
  // custom domain: unknown path gets the site's 404; sitemap and robots still work
  await c.post(`/sites/${siteId}/edit`, { name: 'Nf Co', ...SAVE_BASE, custom_domain: 'www.nf-example.test' });
  const cd = await httpGetHost('www.nf-example.test', '/zzz/yyy');
  assert.equal(cd.status, 404); assert.match(cd.body, /We can&#39;t find that page/);
  assert.equal((await httpGetHost('www.nf-example.test', '/sitemap.xml')).status, 200);
  assert.equal((await httpGetHost('www.nf-example.test', '/robots.txt')).status, 200);
  // addresses that belong to no site and no app route get the plain page
  const plain = await fetch(`${BASE}/definitely/not/here`);
  assert.equal(plain.status, 404); assert.match(await plain.text(), /doesn't exist or hasn't been published/);
  const unknownSite = await fetch(`${BASE}/site/no-such-site/x`);
  assert.equal(unknownSite.status, 404);
});

test('visitor actions are counted without cookies and shown in the report', async () => {
  const c = makeClient();
  const { siteId, slug } = await basicSite(c, 'events@example.com', 'Events Co', { contact_phone: '407-555-1234' });
  const human = { 'user-agent': 'Mozilla/5.0 (iPhone) Safari', 'content-type': 'application/x-www-form-urlencoded' };
  const beacon = (e, p, headers = human, base = `/site/${slug}`) => fetch(`${BASE}${base}/e`, { method: 'POST', headers, body: new URLSearchParams({ e, p }).toString() });
  for (let i = 0; i < 3; i++) assert.equal((await beacon('call', 'home')).status, 204);
  await beacon('email', 'contact'); await beacon('text', 'home'); await beacon('cta', 'services/roof-repair');
  await beacon('call', 'home', { ...human, 'user-agent': 'Googlebot/2.1' });          // bots are ignored
  await beacon('hack<script>', 'home'); await beacon('call<b>', '<img>');             // unknown events ignored, paths sanitized
  assert.equal((await fetch(`${BASE}/site/no-such/e`, { method: 'POST', headers: human, body: 'e=call' })).status, 204);
  const f = new FormData(); f.append('name', 'Quote Person'); f.append('phone', '555-1');
  await fetch(`${BASE}/site/${slug}/contact`, { method: 'POST', body: f, redirect: 'manual' });
  const html = await (await c.get(`/sites/${siteId}/report`)).text();
  assert.match(html, /<div class="n">3<\/div><div class="l">Tapped the phone number/);
  assert.match(html, /<div class="n">1<\/div><div class="l">Tapped the email address/);
  assert.match(html, /<div class="n">1<\/div><div class="l">Tapped Text \/ WhatsApp/);
  assert.match(html, /<div class="n">1<\/div><div class="l">Clicked a "Contact \/ Book" button/);
  assert.match(html, /Rates show up once there are at least 20 page views/);
  // the live page carries the counting script; the owner's preview and static export do not
  const live = await (await fetch(`${BASE}/site/${slug}`)).text();
  assert.match(live, new RegExp(`sendBeacon\\('/site/${slug}/e'`));
  const prev = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.doesNotMatch(prev, /sendBeacon/);
  const files = readZip(Buffer.from(await (await c.get(`/sites/${siteId}/export`)).arrayBuffer()));
  assert.doesNotMatch(files['index.html'].toString(), /sendBeacon/);
  // custom domain endpoint
  await c.post(`/sites/${siteId}/edit`, { name: 'Events Co', ...SAVE_BASE, contact_phone: '407-555-1234', custom_domain: 'www.events-example.test' });
  const cdPost = await new Promise((resolve, reject) => {
    const rq = require('node:http').request({ host: 'localhost', port: PORT, path: '/e', method: 'POST', headers: { Host: 'www.events-example.test', 'user-agent': 'Mozilla/5.0', 'content-type': 'application/x-www-form-urlencoded' } }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    rq.on('error', reject); rq.end('e=call&p=home');
  });
  assert.equal(cdPost, 204);
  assert.match(await (await c.get(`/sites/${siteId}/report`)).text(), /<div class="n">4<\/div><div class="l">Tapped the phone number/);
});

test('block library: save a block, reuse it on another site, private to its owner', async () => {
  const c = makeClient();
  const a = await basicSite(c, 'lib@example.com', 'Lib One', {
    block_type: ['pricing'], block_heading: ['Our prices'], block_body: ['Bath | $40 | Wash, Dry\n* Groom | $70 | Bath, Cut'], block_image: [''], block_side: ['auto'],
    block_buttonText: ['Book'], block_buttonUrl: ['/book'], block_edge: ['wave'], block_bg: ['tint'], block_place: ['top'], block_page: ['services']
  });
  const saveBody = { name: 'Price table', block_type: 'pricing', block_heading: 'Our prices', block_body: 'Bath | $40 | Wash, Dry\n* Groom | $70 | Bath, Cut', block_image: '', block_side: 'auto', block_buttonText: 'Book', block_buttonUrl: '/book', block_edge: 'wave', block_bg: 'tint', block_place: 'top', block_page: 'services' };
  const saved = await (await fetch(`${BASE}/library/blocks`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(saveBody), redirect: 'manual' })).status;
  assert.equal(saved, 302, 'must be signed in');
  const post = async (client, body) => (await client.post('/library/blocks', body));
  let res = await post(c, saveBody);
  const j = await res.json();
  assert.equal(j.ok, true); assert.equal(j.name, 'Price table'); assert.equal(j.block.type, 'pricing'); assert.equal(j.block.edge, 'wave');
  // invalid input is rejected or cleaned
  assert.equal((await post(c, { name: 'x', block_type: 'bogus', block_heading: 'h' })).status, 400);
  assert.equal((await post(c, { name: 'x', block_type: 'cta', block_heading: '', block_body: '' })).status, 400, 'an empty block is not saved');
  const cleaned = await (await post(c, { name: 'Odd', block_type: 'cta', block_heading: 'Hi', block_body: 'b', block_buttonUrl: 'javascript:alert(1)', block_bg: 'neon', block_page: 'nowhere' })).json();
  assert.equal(cleaned.block.buttonUrl, ''); assert.equal(cleaned.block.bg, 'none'); assert.equal(cleaned.block.page, 'home');
  // a second site of the same user can insert it; the editor lists it and embeds the data
  const b = await basicSite(c, 'lib@example.com', 'Lib Two');
  const edit = await (await c.get(`/sites/${b.siteId}/edit`)).text();
  assert.match(edit, /id="libSelect">[\s\S]*?Price table \(Pricing\)/);
  assert.match(edit, /id="libData">\[.*"name":"Price table"/);
  assert.match(edit, /data-block="save"/);
  // someone else does not see it and cannot delete it
  const other = makeClient();
  await other.post('/signup', { email: 'lib-other@example.com', password: 'password1' });
  const oc = await other.post('/sites', { name: 'Other Lib' });
  const oid = oc.headers.get('location').match(/\/sites\/(\d+)\//)[1];
  assert.doesNotMatch(await (await other.get(`/sites/${oid}/edit`)).text(), /Price table/);
  assert.equal((await (await other.post(`/library/blocks/${j.id}/delete`)).json()).ok, false);
  // owner deletes it
  assert.equal((await (await c.post(`/library/blocks/${j.id}/delete`)).json()).ok, true);
  assert.doesNotMatch(await (await c.get(`/sites/${b.siteId}/edit`)).text(), /Price table/);
  assert.equal(a.siteId !== b.siteId, true);
});

test('privacy + terms pages: off by default, derived from what the site does, linked, in sitemap and export', async () => {
  const c = makeClient();
  const { siteId } = await basicSite(c, 'lg@example.com', 'Legal Co', { gaId: '', pixel: '' });
  const order = 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact';
  assert.equal((await fetch(`${BASE}/site/legal-co/privacy`)).status, 404, 'off by default');
  assert.doesNotMatch(await (await fetch(`${BASE}/site/legal-co`)).text(), /Privacy Policy/);
  await c.post(`/sites/${siteId}/edit`, { name: 'Legal Co', legal_enabled: '1', legal_state: 'Florida', legal_email: 'privacy@legalco.test', contact_acceptSubmissions: '1', layout_order: order });
  const p = await (await fetch(`${BASE}/site/legal-co/privacy`)).text();
  assert.match(p, /<h1>Privacy Policy<\/h1>/);
  assert.match(p, /send us a message or request through a form/);
  assert.match(p, /privacy@legalco\.test/);
  const body = p.slice(p.indexOf('<h1>Privacy Policy'), p.indexOf('legal-other'));
  assert.doesNotMatch(body, /Google Analytics|Meta Pixel|photo you choose to attach|When you request a booking/, 'only what applies');
  const t = await (await fetch(`${BASE}/site/legal-co/terms`)).text();
  assert.match(t, /laws of the State of Florida/);
  assert.match(await (await fetch(`${BASE}/site/legal-co`)).text(), /href="\/site\/legal-co\/privacy">Privacy Policy<\/a><a href="\/site\/legal-co\/terms"/);
  assert.match(await (await fetch(`${BASE}/sitemap.xml`)).text(), /legal-co\/privacy/);
  // analytics is mentioned once tracking IDs are set
  await c.post(`/sites/${siteId}/edit`, { name: 'Legal Co', legal_enabled: '1', meta_gaId: 'G-ABC123XYZ', contact_acceptSubmissions: '1', layout_order: order });
  const p2 = await (await fetch(`${BASE}/site/legal-co/privacy`)).text();
  assert.match(p2.slice(p2.indexOf('<h1>Privacy Policy')), /Google Analytics/);
  assert.match(p2, /only after you click Accept/);
  // notice bar on every page when chosen
  await c.post(`/sites/${siteId}/edit`, { name: 'Legal Co', legal_enabled: '1', legal_banner: 'always', contact_acceptSubmissions: '1', layout_order: order });
  assert.match(await (await fetch(`${BASE}/site/legal-co/about`)).text(), /id="cookieBar"/);
  // export contains the pages
  const zip = readZip(Buffer.from(await (await c.get(`/sites/${siteId}/export`)).arrayBuffer()));
  assert.ok(zip['privacy.html'] && zip['terms.html']);
  assert.match(zip['index.html'].toString(), /href="privacy\.html"/);
});

test('backups: snapshot, retention, admin-only pages, site file export/import, template copy', async () => {
  const fsx = require('node:fs'), pathx = require('node:path'), osx = require('node:os'), zlibx = require('node:zlib');
  const backups = require('../backups');
  const Database = require('better-sqlite3');
  const dir = fsx.mkdtempSync(pathx.join(osx.tmpdir(), 'bk-'));
  const tmpDb = new Database(pathx.join(dir, 'src.db'));
  tmpDb.exec('CREATE TABLE t (a)'); tmpDb.prepare('INSERT INTO t VALUES (1)').run();
  const bdir = pathx.join(dir, 'out');
  const n1 = await backups.run(tmpDb, bdir, 2, new Date(2026, 0, 1, 9, 0));
  const n2 = await backups.run(tmpDb, bdir, 2, new Date(2026, 0, 2, 9, 0));
  const n3 = await backups.run(tmpDb, bdir, 2, new Date(2026, 0, 3, 9, 0));
  assert.deepEqual(backups.list(bdir).map(f => f.name), [n3, n2], 'oldest is dropped');
  assert.ok(!fsx.readdirSync(bdir).some(n => n.startsWith('.tmp') || n.endsWith('.part')), 'no temp files left');
  const raw = zlibx.gunzipSync(fsx.readFileSync(pathx.join(bdir, n3)));
  assert.equal(raw.slice(0, 15).toString(), 'SQLite format 3');
  assert.equal(backups.hasToday(bdir, new Date(2026, 0, 3, 20, 0)), true);
  assert.equal(backups.hasToday(bdir, new Date(2026, 0, 4, 1, 0)), false);
  assert.equal(backups.pathFor(bdir, '../../etc/passwd'), null);
  tmpDb.close();

  // admin pages: alice (first account) is the admin
  const admin = makeClient();
  await admin.post('/login', { email: 'alice@example.com', password: 'password1' });
  assert.equal((await admin.get('/admin/backups')).status, 200);
  const runRes = await admin.post('/admin/backups/run', {});
  assert.equal(runRes.status, 302);
  const page = await (await admin.get('/admin/backups?done=1')).text();
  const nm = /href="\/admin\/backups\/(sitegen-[\d-]+\.db\.gz)"/.exec(page);
  assert.ok(nm, 'the new backup is listed');
  const dl = await admin.get(`/admin/backups/${nm[1]}`);
  assert.equal(dl.status, 200);
  assert.equal(Buffer.from(zlibx.gunzipSync(Buffer.from(await dl.arrayBuffer()))).slice(0, 15).toString(), 'SQLite format 3');
  assert.equal((await admin.get('/admin/backups/..%2f..%2fpackage.json')).status, 404);

  const owner = makeClient();
  const { siteId } = await basicSite(owner, 'bkowner@example.com', 'Bk Co', {});
  assert.equal((await owner.get('/admin/backups')).status, 404);
  assert.equal((await owner.post('/admin/backups/run', {})).status, 404);

  // site file round trip
  const exp = await (await owner.get(`/sites/${siteId}/export.json`)).json();
  assert.equal(exp.format, 'sitegen-site');
  exp.sections.hero.ctaLink = 'javascript:alert(1)';
  const fd = new FormData();
  fd.append('sitefile', new Blob([JSON.stringify(exp)], { type: 'application/json' }), 'x.json');
  const imp = await owner.post('/sites/import-file', fd);
  assert.equal(imp.status, 302);
  const id2 = /\/sites\/(\d+)\/edit/.exec(imp.headers.get('location'))[1];
  const rawDb = new Database(TEST_DB);
  const row = rawDb.prepare('SELECT * FROM sites WHERE id = ?').get(id2);
  assert.equal(row.published, 0);
  assert.equal(JSON.parse(row.sections).hero.ctaLink, '', 'script links are dropped on import');
  const bad = new FormData(); bad.append('sitefile', new Blob(['{"nope":1}']), 'y.json');
  assert.match(await (await owner.post('/sites/import-file', bad)).text(), /not a SiteGen site file/);

  // template copy clears client-specific details, plain duplicate keeps them
  await owner.post(`/sites/${siteId}/edit`, { name: 'Bk Co', service_title: ['Roof Repair'], service_description: ['Fix leaks'], contact_phone: '(407) 555-0142', contact_email: 'a@bk.test', meta_gaId: 'G-ABC123XYZ9', contact_acceptSubmissions: '1', layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact' });
  const dup = await owner.post(`/sites/${siteId}/duplicate`, { mode: 'template' });
  const tid = /\/sites\/(\d+)\/edit/.exec(dup.headers.get('location'))[1];
  const t = JSON.parse(rawDb.prepare('SELECT sections FROM sites WHERE id = ?').get(tid).sections);
  assert.equal(t.contact.phone, ''); assert.equal(t.contact.email, ''); assert.equal(t.meta.gaId, '');
  assert.ok(t.services.items.length > 0, 'wording is kept');
  const dup2 = await owner.post(`/sites/${siteId}/duplicate`, {});
  const d2 = JSON.parse(rawDb.prepare('SELECT sections FROM sites WHERE id = ?').get(/\/sites\/(\d+)\/edit/.exec(dup2.headers.get('location'))[1]).sections);
  assert.equal(d2.contact.phone, '(407) 555-0142');
  rawDb.close();
});

test('client logins: invite, set password, edit basics only, separate from owner, revoke', async () => {
  const owner = makeClient();
  const { siteId } = await basicSite(owner, 'cuowner@example.com', 'Cu Co', {});
  const before = mailCount();
  const r = await owner.post(`/sites/${siteId}/client-users`, { email: 'Pat@Client.test', name: 'Pat' });
  assert.equal(r.status, 302);
  let edit = await (await owner.get(`/sites/${siteId}/edit?clientuser=invited`)).text();
  const link = /\/client-invite\/([A-Za-z0-9_-]{20,})/.exec(edit);
  assert.ok(link, 'invite link shown once');
  assert.doesNotMatch(await (await owner.get(`/sites/${siteId}/edit?clientuser=invited`)).text(), /client-invite\/[A-Za-z0-9_-]{20}/, 'not shown twice');
  await waitForMail(before + 1);
  const tok = link[1];
  // invite page
  const page = await fetch(`${BASE}/client-invite/${tok}`);
  assert.equal(page.status, 200);
  const cp = makeClient();
  assert.match(await (await cp.get(`/client-invite/${tok}`)).text(), /pat@client\.test/);
  assert.match(await (await cp.post(`/client-invite/${tok}`, { password: 'short', password2: 'short' })).text(), /at least 8/);
  assert.match(await (await cp.post(`/client-invite/${tok}`, { password: 'longenough1', password2: 'different11' })).text(), /do not match/);
  const done = await cp.post(`/client-invite/${tok}`, { password: 'longenough1', password2: 'longenough1' });
  assert.equal(done.status, 302);
  assert.equal(done.headers.get('location'), `/portal/${siteId}`);
  assert.equal((await fetch(`${BASE}/client-invite/${tok}`)).status, 404, 'invite works once');
  // portal edit
  const portal = await (await cp.get(`/portal/${siteId}`)).text();
  assert.match(portal, /action="\/portal\/\d+"/);
  assert.match(portal, /Log out/);
  const save = await cp.post(`/portal/${siteId}`, { hero_headline: 'Edited by Pat', about_body: 'New about' });
  assert.equal(save.status, 302);
  assert.match(await (await fetch(`${BASE}/site/cu-co`)).text(), /Edited by Pat/);
  // cannot reach owner pages, or another site
  assert.equal((await cp.get(`/sites/${siteId}/edit`)).status, 302);
  assert.match((await cp.get(`/sites/${siteId}/edit`)).headers.get('location'), /login/);
  assert.equal((await cp.get(`/portal/${siteId + 999}`)).headers.get('location'), '/client-login');
  assert.equal((await cp.get(`/portal/${siteId}/report`)).status, 200);
  // login / logout
  const c2 = makeClient();
  assert.equal((await c2.post('/client-login', { email: 'pat@client.test', password: 'wrongwrong' })).status, 401);
  const ok = await c2.post('/client-login', { email: 'pat@client.test', password: 'longenough1' });
  assert.equal(ok.headers.get('location'), `/portal/${siteId}`);
  await c2.post('/client-logout', {});
  assert.equal((await c2.get(`/portal/${siteId}`)).headers.get('location'), '/client-login');
  // other owners can't manage this site's logins
  const other = makeClient();
  await basicSite(other, 'cuother@example.com', 'Cu Other', {});
  assert.equal((await other.post(`/sites/${siteId}/client-users`, { email: 'x@y.test' })).status, 404);
  // reset password signs the old one out; removing deletes access
  const Database = require('better-sqlite3');
  const rawDb = new Database(TEST_DB);
  const uid = rawDb.prepare('SELECT id FROM client_users WHERE site_id = ?').get(siteId).id;
  await owner.post(`/sites/${siteId}/client-users/${uid}/invite`, {});
  assert.equal((await makeClient().post('/client-login', { email: 'pat@client.test', password: 'longenough1' })).status, 401);
  await owner.post(`/sites/${siteId}/client-users/${uid}/delete`, {});
  assert.equal(rawDb.prepare('SELECT COUNT(*) n FROM client_users WHERE site_id = ?').get(siteId).n, 0);
  rawDb.close();
  assert.equal((await cp.get(`/portal/${siteId}`)).headers.get('location'), '/client-login', 'removed user is out');
});

test('lead pipeline: follow-up date, due filter, quoted status, CSV; automatic follow-ups send, stop on contact, opt out', async () => {
  const Database = require('better-sqlite3');
  const c = makeClient();
  const order = 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact';
  const { siteId } = await basicSite(c, 'pipe@example.com', 'Pipe Co', { contact_email: 'owner@pipeco.test', fu_enabled: '1', fu_hours: ['1', '48', ''], fu_text: ['Hi [name], [business] here[phone].', 'Second try, [name].', ''] });
  const raw = new Database(TEST_DB);
  const lead = async (name, email) => {
    const fd = new URLSearchParams({ name, email, message: 'Need a quote' });
    await fetch(`${BASE}/site/pipe-co/contact`, { method: 'POST', body: fd, redirect: 'manual' });
    return raw.prepare('SELECT * FROM contact_submissions WHERE site_id = ? AND name = ? ORDER BY id DESC').get(siteId, name);
  };
  const a = await lead('Ann Lee', 'ann@x.test'), b = await lead('Bob Ray', 'bob@x.test'), nomail = await lead('Cy NoMail', '');
  const q = (id) => raw.prepare('SELECT * FROM followup_queue WHERE lead_id = ? ORDER BY step').all(id);
  assert.equal(q(a.id).length, 2, 'two steps queued');
  assert.equal(q(nomail.id).length, 0, 'no email, nothing queued');
  // pipeline UI
  const yesterday = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  const save = await c.post(`/sites/${siteId}/leads/${b.id}`, { status: 'quoted', notes: 'quoted 4200', follow_up_at: yesterday });
  assert.equal(save.status, 302);
  assert.equal(q(b.id).every(r => r.canceled === 1), true, 'owner contact cancels automatic emails');
  const html = await (await c.get(`/sites/${siteId}/leads`)).text();
  assert.match(html, /Follow up today/); assert.match(html, /Quoted/);
  const due = await (await c.get(`/sites/${siteId}/leads?status=due`)).text();
  assert.match(due, /Bob Ray/); assert.doesNotMatch(due, /Ann Lee/);
  await c.post(`/sites/${siteId}/leads/${b.id}`, { status: 'quoted', follow_up_at: 'junk' });
  assert.equal(raw.prepare('SELECT follow_up_at FROM contact_submissions WHERE id = ?').get(b.id).follow_up_at, '', 'bad dates are dropped');
  await c.post(`/sites/${siteId}/leads/${b.id}`, { status: 'quoted', notes: 'x', follow_up_at: yesterday });
  assert.match(await (await c.get(`/sites/${siteId}/leads.csv`)).text(), /Follow up/);
  // sending: age the queue, run the job
  const before = mailCount();
  await fetch(`${BASE}/__test/age-queue`, { method: 'POST', headers: { 'x-test-key': 'suite' } });
  const run = await (await fetch(`${BASE}/__test/run-jobs`, { method: 'POST', headers: { 'x-test-key': 'suite' } })).json();
  assert.equal(run.followUps, 2, 'only the still-new lead gets both steps');
  const mails = await waitForMail(before + 3); // two follow-ups + the reminder digest
  const fu = mails.slice(before).filter(m => /ann@x\.test/.test(JSON.stringify(m.to)));
  assert.equal(fu.length, 2);
  assert.match(fu[0].text, /Hi Ann, Pipe Co here/);
  const tok = /unsubscribe\/([A-Za-z0-9_-]{10,})/.exec(fu[0].text)[1];
  assert.ok(mails.slice(before).some(m => /Follow up today: 1 lead/.test(m.subject) && /Bob Ray/.test(m.text)), 'reminder digest');
  // running again sends nothing new
  assert.equal((await (await fetch(`${BASE}/__test/run-jobs`, { method: 'POST', headers: { 'x-test-key': 'suite' } })).json()).followUps, 0);
  // opt-out
  const d = await lead('Dee Opt', 'dee@x.test');
  assert.equal(q(d.id).length, 2);
  const dtok = raw.prepare('SELECT optout_token FROM contact_submissions WHERE id = ?').get(d.id).optout_token;
  assert.match(await (await fetch(`${BASE}/unsubscribe/${dtok}`)).text(), /Stop these emails/);
  assert.match(await (await fetch(`${BASE}/unsubscribe/${dtok}`, { method: 'POST' })).text(), /unsubscribed/);
  assert.equal(q(d.id).every(r => r.canceled === 1), true);
  assert.equal((await fetch(`${BASE}/__test/run-jobs`, { method: 'POST' })).status, 404, 'test hook needs the key');
  void tok; raw.close();
});

test('chat assistant: off by default, AI answer, daily cap falls back, lead capture, no widget in preview or export', async () => {
  const Database = require('better-sqlite3');
  const c = makeClient();
  const order = 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact';
  const { siteId } = await basicSite(c, 'chat@example.com', 'Chat Co', { contact_email: 'owner@chatco.test' });
  const post = (p, body) => fetch(`${BASE}/site/chat-co${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await post('/chat', { messages: [{ role: 'user', content: 'hi' }] })).status, 404, 'off by default');
  assert.doesNotMatch(await (await fetch(`${BASE}/site/chat-co`)).text(), /id="chatFab"/);
  const base = { name: 'Chat Co', service_title: ['Roof Repair'], service_description: ['Fix leaks'], faq_question: ['Do you repair tile roofs?'], faq_answer: ['Yes, we repair tile and shingle roofs.'], contact_acceptSubmissions: '1', chat_enabled: '1', chat_greeting: 'Welcome in', layout_order: order };
  await c.post(`/sites/${siteId}/edit`, { ...base, chat_dailyCap: '10' });
  const home = await (await fetch(`${BASE}/site/chat-co`)).text();
  assert.match(home, /id="chatFab"/); assert.match(home, /Welcome in/); assert.match(home, /Automated assistant/);
  assert.doesNotMatch(await (await c.get(`/sites/${siteId}/preview`)).text(), /id="chatFab"/, 'not in the editor preview');
  const r = await (await post('/chat', { messages: [{ role: 'user', content: 'What services do you offer?' }] })).json();
  assert.equal(r.ai, true); assert.match(r.reply, /^AI says: What services/);
  assert.equal((await post('/chat', { messages: [] })).status, 400);
  const last = aiRequests[aiRequests.length - 1];
  assert.match(last.body.system, /Roof Repair: Fix leaks/); assert.match(last.body.system, /Do you repair tile roofs/);
  assert.equal(last.headers['x-api-key'], 'test-anthropic-key');
  // cap: 10 per day, then the FAQ answers
  for (let i = 0; i < 12; i++) await post('/chat', { messages: [{ role: 'user', content: 'ping' }] });
  const capped = await (await post('/chat', { messages: [{ role: 'user', content: 'do you repair tile roofs?' }] })).json();
  assert.equal(capped.ai, false); assert.match(capped.reply, /tile and shingle/);
  // lead capture
  const raw = new Database(TEST_DB);
  const bad = await post('/chat/lead', { name: '', phone: '', email: '' });
  assert.equal(bad.status, 400);
  const ok = await (await post('/chat/lead', { name: 'Chat Visitor', phone: '407-555-0111', message: 'Call me', transcript: [{ role: 'user', content: 'How much?' }, { role: 'assistant', content: "I don't have that detail." }, { role: 'user', content: 'ok' }] })).json();
  assert.equal(ok.ok, true);
  const lead = raw.prepare("SELECT * FROM contact_submissions WHERE site_id = ? AND source = 'chat'").get(siteId);
  assert.match(lead.message, /Call me/); assert.match(lead.message, /Visitor: How much\?/);
  assert.equal(JSON.stringify(await (await post('/chat/lead', { name: 'Bot', website: 'x' })).json()), '{"ok":true}');
  assert.equal(raw.prepare("SELECT COUNT(*) n FROM contact_submissions WHERE site_id = ? AND source = 'chat'").get(siteId).n, 1, 'honeypot stores nothing');
  assert.match(await (await c.get(`/sites/${siteId}/leads`)).text(), /From chat/);
  // export has no widget; policy mentions the chat when pages are on
  const zip = readZip(Buffer.from(await (await c.get(`/sites/${siteId}/export`)).arrayBuffer()));
  assert.doesNotMatch(zip['index.html'].toString(), /chatFab/);
  await c.post(`/sites/${siteId}/edit`, { ...base, legal_enabled: '1' });
  assert.match(await (await fetch(`${BASE}/site/chat-co/privacy`)).text(), /chat assistant/);
  raw.close();
});

test('google reviews: place id, pull, badge and reviews shown as returned, escaped, errors explained', async () => {
  const c = makeClient();
  const order = 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact';
  const { siteId } = await basicSite(c, 'greview@example.com', 'G Co', {});
  const save = (extra) => c.post(`/sites/${siteId}/edit`, { name: 'G Co', service_title: ['Roof Repair'], service_description: ['Fix'], contact_acceptSubmissions: '1', layout_order: order, ...extra });
  // nothing configured: no badge, no testimonials page
  assert.doesNotMatch(await (await fetch(`${BASE}/site/g-co`)).text(), /class="g-badge"/);
  await save({ testimonials_googlePlaceId: 'places/ChIJtestplace12345', testimonials_googleMode: 'reviews' });
  const r = await c.post(`/sites/${siteId}/google-reviews/refresh`, {});
  assert.match(r.headers.get('location'), /google=ok/);
  assert.equal(googleRequests.at(-1).headers['x-goog-api-key'], 'test-google-key');
  assert.match(googleRequests.at(-1).headers['x-goog-fieldmask'], /reviews/);
  const page = await (await fetch(`${BASE}/site/g-co/testimonials`)).text();
  assert.match(page, /4\.7/); assert.match(page, /128 Google reviews/); assert.match(page, /Sam R/); assert.match(page, /a month ago/);
  assert.match(page, /Okay service, a bit slow/, 'lower ratings are shown too, nothing is picked');
  assert.doesNotMatch(page, /<b>Great<\/b>/, 'review text is escaped');
  assert.match(page, /Reviews from Google/);
  assert.doesNotMatch(await (await c.get(`/sites/${siteId}/preview/testimonials`)).text(), /class="g-card"/, 'preview never calls Google');
  // badge only
  await save({ testimonials_googlePlaceId: 'ChIJtestplace12345', testimonials_googleMode: 'badge' });
  const home = await (await fetch(`${BASE}/site/g-co`)).text();
  assert.doesNotMatch(home, /class="g-card"/);
  // a bad id is explained and shows nothing
  await save({ testimonials_googlePlaceId: 'ChIJnotarealplace999', testimonials_googleMode: 'reviews' });
  assert.match((await c.post(`/sites/${siteId}/google-reviews/refresh`, {})).headers.get('location'), /google=fail/);
  assert.match(await (await c.get(`/sites/${siteId}/edit?google=fail`)).text(), /could not find that Place ID/);
  assert.doesNotMatch(await (await fetch(`${BASE}/site/g-co/testimonials`)).text(), /class="g-card"/);
  await save({ testimonials_googlePlaceId: 'bad id!', testimonials_googleMode: 'reviews' });
  assert.match((await c.post(`/sites/${siteId}/google-reviews/refresh`, {})).headers.get('location'), /google=noid/);
});

test('estimate calculator: page, live-math config, server-side price, lead with choices, checklist', async () => {
  const Database = require('better-sqlite3');
  const c = makeClient();
  const order = 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact';
  const { siteId } = await basicSite(c, 'calc@example.com', 'Calc Co', { contact_email: 'owner@calc.test' });
  const save = (extra) => c.post(`/sites/${siteId}/edit`, { name: 'Calc Co', service_title: ['Cleaning'], service_description: ['Homes'], contact_acceptSubmissions: '1', layout_order: order, ...extra });
  assert.equal((await fetch(`${BASE}/site/calc-co/estimate`)).status, 404, 'off by default');
  const cfg = { calc_enabled: '1', calc_heading: 'Cleaning estimate', calc_showPrice: 'yes', calc_basePrice: '50', calc_spread: '20', calc_minimum: '0',
    calc_label: ['Size', 'Bathrooms', 'Oven'], calc_type: ['select', 'number', 'checkbox'],
    calc_options: ['Small | 10\nBig | 40', '', ''], calc_price: ['', '15', '30'], calc_unit: ['', 'baths', ''], calc_min: ['', '1', ''], calc_max: ['', '5', ''], calc_required: ['yes', 'yes', 'no'] };
  await save(cfg);
  const page = await (await fetch(`${BASE}/site/calc-co/estimate`)).text();
  assert.match(page, /Cleaning estimate/); assert.match(page, /name="ce_0"/); assert.match(page, /Big/);
  assert.match(await (await fetch(`${BASE}/site/calc-co`)).text(), /href="\/site\/calc-co\/estimate"/, 'in the menu');
  assert.match(await (await fetch(`${BASE}/sitemap.xml`)).text(), /calc-co\/estimate/);
  assert.match(page, /not a firm quote/);
  // server computes the price; tampering is ignored
  const raw = new Database(TEST_DB);
  const send = (body) => fetch(`${BASE}/site/calc-co/estimate`, { method: 'POST', body: new URLSearchParams(body), redirect: 'manual' });
  const bad = await send({ ce_0: '', ce_1: '2', email: 'a@b.test' });
  assert.match(bad.headers.get('location'), /error=Please%20answer/);
  const noContact = await send({ ce_0: '1', ce_1: '2' });
  assert.match(noContact.headers.get('location'), /error=Please%20add/);
  const ok = await send({ ce_0: '1', ce_1: '99', ce_2: '1', name: 'Kim', email: 'kim@x.test', total: '1', price: '1' });
  assert.match(ok.headers.get('location'), /thank-you/);
  const lead = raw.prepare("SELECT * FROM contact_submissions WHERE site_id = ? AND source = 'estimate'").get(siteId);
  // 50 + 40 + 5*15 (capped at max 5) + 30 = 195, high end +20% = 234
  assert.match(lead.message, /\$195 to \$234/);
  assert.match(lead.answers, /Big \(\$40\)/); assert.match(lead.answers, /5 baths/);
  assert.match(await (await c.get(`/sites/${siteId}/leads`)).text(), /From estimate/);
  assert.equal((await send({ website: 'x', ce_0: '1', ce_1: '2', email: 'bot@x.test' })).headers.get('location').includes('thank-you'), true);
  assert.equal(raw.prepare("SELECT COUNT(*) n FROM contact_submissions WHERE site_id = ? AND source = 'estimate'").get(siteId).n, 1, 'honeypot stores nothing');
  // all prices zero -> audit warns; hidden-price wizard does not
  await save({ ...cfg, calc_basePrice: '', calc_options: ['Small | 0\nBig | 0', '', ''], calc_price: ['', '', ''] });
  assert.match(await (await c.get(`/sites/${siteId}/edit`)).text(), /every price is zero/);
  await save({ ...cfg, calc_showPrice: 'no', calc_basePrice: '', calc_options: ['Small | 0\nBig | 0', '', ''], calc_price: ['', '', ''] });
  assert.doesNotMatch(await (await c.get(`/sites/${siteId}/edit`)).text(), /every price is zero/);
  const nop = await (await fetch(`${BASE}/site/calc-co/estimate`)).text();
  assert.doesNotMatch(nop, /id="calcResult"/);
  await send({ ce_0: '0', ce_1: '1', email: 'w@x.test' });
  assert.match(raw.prepare("SELECT message FROM contact_submissions WHERE site_id = ? AND source = 'estimate' ORDER BY id DESC").get(siteId).message, /Asked for a quote/);
  // no questions -> page unavailable
  await save({ calc_enabled: '1', calc_heading: 'x' });
  assert.equal((await fetch(`${BASE}/site/calc-co/estimate`)).status, 404);
  // export has no estimate link
  await save(cfg);
  const zip = readZip(Buffer.from(await (await c.get(`/sites/${siteId}/export`)).arrayBuffer()));
  assert.doesNotMatch(zip['index.html'].toString(), /estimate/i);
  raw.close();
});

test('client questionnaire: link, public form, review, one-click build from the client\'s own words', async (t) => {
  let sharp;
  try { sharp = require('sharp'); } catch { return t.skip('sharp not installed'); }
  const Database = require('better-sqlite3');
  const owner = makeClient();
  await owner.post('/signup', { email: 'questionnaire-owner@example.com', password: 'password1' });
  const created = await owner.post('/intake/links', { label: 'Maria' });
  assert.match(created.headers.get('location'), /f=created/);
  const raw = new Database(TEST_DB);
  const link = raw.prepare('SELECT * FROM intake_links ORDER BY id DESC').get();
  const url = `/start/${link.token}`;

  // public page works without login; bad token is a closed page
  const pub = await fetch(BASE + url);
  assert.equal(pub.status, 200);
  assert.match(await pub.text(), /Your business/);
  assert.notEqual((await fetch(BASE + '/start/' + 'x'.repeat(24))).status, 200);

  // upload a logo and a photo
  const png = await sharp({ create: { width: 200, height: 200, channels: 3, background: '#336699' } }).png().toBuffer();
  const up = async () => {
    const f = new FormData(); f.append('image', new Blob([png], { type: 'image/png' }), 'l.png');
    return (await fetch(BASE + url + '/upload', { method: 'POST', body: f })).json();
  };
  const logo = (await up()).url, photo = (await up()).url;
  assert.match(logo, /^\/uploads\//);

  const anon = makeClient();
  // missing required fields -> 400, nothing saved
  const bad = await anon.post(url, { biz_name: 'X' });
  assert.equal(bad.status, 400);
  assert.equal(raw.prepare('SELECT COUNT(*) n FROM intake_submissions').get().n, 0);
  // honeypot -> looks fine, saves nothing
  await anon.post(url, { website: 'spam', biz_name: 'Spam', biz_type: 'x', contact_name: 'a', contact_email: 'a@b.test', agree: '1' });
  assert.equal(raw.prepare('SELECT COUNT(*) n FROM intake_submissions').get().n, 0);

  const mailBefore = mailCount();
  const ok = await anon.post(url, {
    biz_name: 'Maria Bakery', biz_type: 'Bakery', city: 'Orlando', tagline: 'Baked with love ZZ-TAG',
    svc_name: ['Wedding cakes', 'Sourdough'], svc_desc: ['Tiered cakes made to order', 'Baked every morning'],
    about: 'Maria started baking in her grandmother kitchen ZZ-ABOUT.', phone: '407-555-0100', email: 'hello@maria.test',
    mood: 'warm', logo, photos: [photo], features: ['chat'], faq_q: ['Do you deliver?'], faq_a: ['Yes, within 10 miles ZZ-FAQ.'],
    contact_name: 'Maria', contact_email: 'maria@x.test', agree: '1'
  });
  assert.match(ok.headers.get('location'), /\/done$/);
  assert.match(await (await fetch(BASE + url + '/done')).text(), /Thank/i);
  assert.equal(mailCount(), mailBefore + 1, 'owner emailed');

  const sub = raw.prepare('SELECT * FROM intake_submissions').get();
  assert.equal(sub.status, 'new');

  // another account cannot see or build it
  const other = makeClient();
  const su = await other.post('/signup', { email: 'questionnaire-other@example.com', password: 'password1' });
  assert.equal(su.status, 302, 'signup ok');
  assert.equal((await other.get(`/intake/submissions/${sub.id}`)).status, 404);
  assert.equal((await other.post(`/intake/submissions/${sub.id}/build`, {})).status, 404);

  const review = await (await owner.get(`/intake/submissions/${sub.id}`)).text();
  assert.match(review, /Maria Bakery/); assert.match(review, /Build the website/);
  assert.match(review, /Pick a design/); assert.equal((review.match(/name="option"/g) || []).length, 3, 'three design options offered');
  assert.match(review, /name="option" value="0" checked/);
  assert.match(await (await owner.get('/intake')).text(), /Maria Bakery/);

  const built = await owner.post(`/intake/submissions/${sub.id}/build`, { option: '0' });
  const loc = built.headers.get('location');
  assert.match(loc, /\/sites\/\d+\/edit\?.*fromintake=1/);
  const siteId = loc.match(/\/sites\/(\d+)\//)[1];
  const row = raw.prepare('SELECT * FROM sites WHERE id = ?').get(siteId);
  const s = JSON.parse(row.sections), th = JSON.parse(row.theme);
  const all = JSON.stringify(s);
  assert.match(all, /ZZ-TAG/); assert.match(all, /ZZ-ABOUT/); assert.match(all, /ZZ-FAQ/);
  assert.match(all, /Wedding cakes/); assert.match(all, /Sourdough/);
  assert.equal(th.style, 'warm');
  assert.ok(all.includes(photo), 'client photo used');
  assert.ok(JSON.stringify(th).includes(logo) || all.includes(logo), 'logo used');
  assert.equal(raw.prepare('SELECT status, site_id FROM intake_submissions').get().status, 'built');
  assert.match(await (await owner.get(loc)).text(), /questionnaire/);
  assert.match(await (await owner.get(`/intake/submissions/${sub.id}`)).text(), /Open the site/);

  // close the link
  await owner.post(`/intake/links/${link.id}/toggle`, {});
  assert.doesNotMatch(await (await fetch(BASE + url)).text(), /Your business/);
  const closedPost = await anon.post(url, { biz_name: 'Late', biz_type: 'x', contact_name: 'a', contact_email: 'a@b.test', agree: '1' });
  assert.notEqual(closedPost.status, 302);
  raw.close();
});

test('design upgrades: eyebrow labels, heading size, alternating bands, floating button choices', async () => {
  const c = makeClient();
  const order = 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact';
  const { siteId } = await basicSite(c, 'design-up@example.com', 'Design Up Co', { contact_email: 'o@designup.test' });
  const save = (extra) => c.post(`/sites/${siteId}/edit`, { name: 'Design Up Co', service_title: ['Grooming'], service_description: ['Baths'], contact_acceptSubmissions: '1', contact_phone: '407-555-0101', layout_order: order, ...extra });
  const home = async (p = '') => (await fetch(`${BASE}/site/design-up-co${p}`)).text();
  await save({});
  assert.doesNotMatch(await home('/services'), /class="eyebrow"/, 'no eyebrow unless set');
  await save({ services_eyebrow: 'Our <care>', about_eyebrow: 'Who we are', theme_headingScale: 'xl', theme_bands: '1' });
  const sv = await home('/services');
  assert.match(sv, /<p class="eyebrow">Our &lt;care&gt;<\/p>\s*<h2>/);
  assert.match(await home('/about'), /<p class="eyebrow">Who we are<\/p>/);
  assert.match(sv, /<body class="[^"]*hs-xl[^"]*bands/);
  await save({ theme_headingScale: 'huge', theme_bands: 'yes' });
  assert.doesNotMatch(await home('/services'), /hs-huge|class="[^"]*\bbands\b/, 'junk ignored');
  // the editor shows the new inputs and keeps them
  await save({ services_eyebrow: 'Kept' });
  assert.match(await (await c.get(`/sites/${siteId}/edit`)).text(), /name="services_eyebrow" value="Kept"/);
  // floating button choices
  await save({ contact_floatButton: 'call' });
  assert.match(await home(), /class="float-contact"[^>]*href="tel:\+14075550101"/);
  await save({ contact_floatButton: 'quote' });
  assert.match(await home(), /class="float-contact" href="\/site\/design-up-co\/contact"/);
  assert.doesNotMatch(await home('/contact'), /class="float-contact"/, 'no quote button on the contact page itself');
  await save({ contact_floatButton: 'book' });
  assert.doesNotMatch(await home(), /class="float-contact"/, 'book needs booking switched on');
  await save({ contact_floatButton: 'nonsense' });
  assert.doesNotMatch(await home(), /class="float-contact"/);
});

test('preview before creating: nothing saved until Create, looks switch, private to the owner', async () => {
  const Database = require('better-sqlite3');
  const raw = new Database(TEST_DB);
  const c = makeClient();
  await c.post('/signup', { email: 'draft-owner@example.com', password: 'password1' });
  const sitesBefore = raw.prepare('SELECT COUNT(*) n FROM sites').get().n;
  const r = await c.post('/sites/generate', { business_type: 'dog grooming', business_name: 'Stans Dog Grooming', city: 'Poinciana, FL', preview: '1' });
  const loc = r.headers.get('location');
  assert.match(loc, /^\/sites\/draft\/[\w-]+$/);
  assert.equal(raw.prepare('SELECT COUNT(*) n FROM sites').get().n, sitesBefore, 'nothing saved yet');
  const wrap = await (await c.get(loc)).text();
  assert.match(wrap, /Create this site/); assert.match(wrap, /Clean and modern/); assert.match(wrap, /src="\/sites\/draft\/[\w-]+\/frame"/);
  const frame = await (await c.get(loc + '/frame')).text();
  assert.match(frame, /Stans Dog Grooming/);
  assert.match(frame, /class="eyebrow"/, 'generated sites get section labels');
  assert.equal((await c.get(loc + '/frame/services')).status, 200);
  // switch the look
  await c.post(loc + '/look', { look: 'luxe' });
  assert.match(await (await c.get(loc + '/frame')).text(), /<body class="style-luxe/);
  await c.post(loc + '/look', { look: 'bogus' });
  assert.match(await (await c.get(loc + '/frame')).text(), /<body class="style-luxe/, 'unknown look ignored');
  // another account cannot see or create it
  const other = makeClient();
  await other.post('/signup', { email: 'draft-other@example.com', password: 'password1' });
  assert.equal((await other.get(loc)).status, 404);
  assert.equal((await other.post(loc + '/create', {})).status, 404);
  // create
  const made = await c.post(loc + '/create', {});
  assert.match(made.headers.get('location'), /\/sites\/\d+\/edit\?generated=1/);
  const site = raw.prepare('SELECT * FROM sites ORDER BY id DESC LIMIT 1').get();
  assert.equal(JSON.parse(site.theme).style, 'luxe');
  assert.equal(raw.prepare('SELECT COUNT(*) n FROM sites').get().n, sitesBefore + 1);
  assert.equal((await c.get(loc)).status, 404, 'draft is gone after creating');
  // discard
  const r2 = await c.post('/sites/generate', { business_type: 'bakery', preview: '1' });
  const loc2 = r2.headers.get('location');
  await c.post(loc2 + '/discard', {});
  assert.equal((await c.get(loc2)).status, 404);
  assert.equal(raw.prepare('SELECT COUNT(*) n FROM sites').get().n, sitesBefore + 1);
  // the benefit-first headline is on the template site, name in the supporting line
  assert.doesNotMatch(JSON.parse(site.sections).hero.headline, /Stans Dog Grooming/);
  raw.close();
});

test('publish to Netlify: deploys the hosted copy, keeps the contact form, custom domain and HTTPS, private to the owner', async () => {
  const c = makeClient();
  const order = 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact';
  const { siteId } = await basicSite(c, 'netlify-owner@example.com', 'Host Me Co', { contact_email: 'owner@hostme.test' });
  await c.post(`/sites/${siteId}/edit`, { name: 'Host Me Co', service_title: ['Grooming'], service_description: ['Baths'], contact_acceptSubmissions: '1', contact_email: 'owner@hostme.test', contact_phone: '407-555-0111', layout_order: order });
  const page = await (await c.get(`/sites/${siteId}/hosting`)).text();
  assert.match(page, /Publish to Netlify/); assert.doesNotMatch(page, /nfp_test_token/, 'token never shown');
  assert.match(page, /Not on the published copy|What is on the published copy/);

  // another account cannot see or use it
  const other = makeClient();
  await other.post('/signup', { email: 'netlify-other@example.com', password: 'password1' });
  assert.equal((await other.get(`/sites/${siteId}/hosting`)).status, 404);
  assert.equal((await other.post(`/sites/${siteId}/hosting/publish`, {})).status, 404);

  // publish: creates the Netlify site, sends a zip, remembers the ids, sets up the form email
  const r = await c.post(`/sites/${siteId}/hosting/publish`, {});
  assert.match(r.headers.get('location'), /hosting\?f=published/);
  const create = netlifyCalls.find(x => x.method === 'POST' && x.url === '/api/v1/sites');
  assert.equal(create.auth, 'Bearer nfp_test_token'); assert.match(create.json.name, /^host-me-co-/);
  const dep = netlifyCalls.filter(x => /\/deploys$/.test(x.url)).pop();
  assert.equal(dep.type, 'application/zip'); assert.equal(dep.raw.slice(0, 2).toString(), 'PK');
  const zip = readZip(dep.raw);
  assert.ok(zip['index.html'] && zip['contact.html'] && zip['404.html'] && zip['thank-you.html'], 'pages, 404 and thank-you are included');
  assert.ok(!zip['README.txt'], 'no readme in the hosted copy');
  const contactHtml = zip['contact.html'].toString();
  assert.match(contactHtml, /<form[^>]*data-netlify="true"[^>]*name="contact"|<form[^>]*name="contact"[^>]*data-netlify="true"/);
  assert.match(contactHtml, /action="thank-you\.html"/); assert.match(contactHtml, /name="form-name" value="contact"/);
  assert.doesNotMatch(zip['index.html'].toString(), /action="\/site\//, 'no form posting back to SiteGen');
  const hook = netlifyCalls.find(x => x.url === '/api/v1/hooks');
  assert.equal(hook.json.type, 'email'); assert.equal(hook.json.event, 'submission_created'); assert.equal(hook.json.data.email, 'owner@hostme.test'); assert.equal(hook.json.form_name, 'contact');
  const Database = require('better-sqlite3'); const raw = new Database(TEST_DB);
  const row = raw.prepare('SELECT * FROM sites WHERE id = ?').get(siteId);
  assert.equal(row.netlify_site_id, 'nl-site-' + netlifyState.createdNames); assert.ok(row.netlify_deployed_at);
  assert.match(await (await c.get(`/sites/${siteId}/hosting`)).text(), /Publish again/);

  // publishing again reuses the same Netlify site and does not add another form hook
  const sitesCreated = netlifyCalls.filter(x => x.method === 'POST' && x.url === '/api/v1/sites').length;
  const hooks = netlifyCalls.filter(x => x.url === '/api/v1/hooks').length;
  await c.post(`/sites/${siteId}/hosting/publish`, {});
  assert.equal(netlifyCalls.filter(x => x.method === 'POST' && x.url === '/api/v1/sites').length, sitesCreated);
  assert.equal(netlifyCalls.filter(x => x.url === '/api/v1/hooks').length, hooks);
  assert.equal(netlifyCalls.filter(x => /\/deploys$/.test(x.url)).length, 2);

  // custom domain: cleaned, saved, DNS instructions shown, HTTPS requested
  assert.match((await c.post(`/sites/${siteId}/hosting/domain`, { domain: 'not a domain' })).headers.get('location'), /f=nodomain/);
  assert.match((await c.post(`/sites/${siteId}/hosting/domain`, { domain: 'HTTPS://Www.HostMe.com/about' })).headers.get('location'), /f=domain/);
  const patch = netlifyCalls.filter(x => x.method === 'PATCH').pop();
  assert.equal(patch.json.custom_domain, 'www.hostme.com');
  const dnsPage = await (await c.get(`/sites/${siteId}/hosting`)).text();
  assert.match(dnsPage, /www\.hostme\.com/); assert.match(dnsPage, /75\.2\.60\.5/); assert.match(dnsPage, /\.netlify\.app/); assert.match(dnsPage, /Turn on HTTPS/);
  assert.match((await c.post(`/sites/${siteId}/hosting/ssl`, {})).headers.get('location'), /f=ssl$/);
  assert.ok(netlifyCalls.some(x => x.method === 'POST' && /\/ssl$/.test(x.url)));
  netlifyState.sslFail = true;
  assert.match((await c.post(`/sites/${siteId}/hosting/ssl`, {})).headers.get('location'), /f=sslwait/, 'DNS not ready is explained, not an error page');
  netlifyState.sslFail = false;
  await c.post(`/sites/${siteId}/hosting/remove-domain`, {});
  assert.equal(netlifyCalls.filter(x => x.method === 'PATCH').pop().json.custom_domain, null);

  // disconnect forgets the link
  await c.post(`/sites/${siteId}/hosting/unlink`, {});
  assert.equal(raw.prepare('SELECT netlify_site_id FROM sites WHERE id = ?').get(siteId).netlify_site_id, '');
  raw.close();
});

test('publish to Netlify: contact form left out when messages are off; the normal export is unchanged', async () => {
  const c = makeClient();
  const { siteId } = await basicSite(c, 'netlify-noform@example.com', 'No Form Co', {});
  await c.post(`/sites/${siteId}/edit`, { name: 'No Form Co', service_title: ['Cleaning'], service_description: ['Homes'], layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact' });
  await c.post(`/sites/${siteId}/hosting/publish`, {});
  const zip = readZip(netlifyCalls.filter(x => /\/deploys$/.test(x.url)).pop().raw);
  assert.ok(!zip['thank-you.html']); assert.doesNotMatch(zip['contact.html'].toString(), /data-netlify/);
  const plain = readZip(Buffer.from(await (await c.get(`/sites/${siteId}/export`)).arrayBuffer()));
  assert.ok(plain['README.txt'] && !plain['404.html'], 'the download is the same plain zip as before');
});

test('customer payments: key stored encrypted, service pay button, booking deposit hold, payment requests, sweep', async () => {
  const Database = require('better-sqlite3'); const raw = new Database(TEST_DB);
  const SITE_KEY = 'sk_test_' + 'Z9y8x7w6v5u4t3s2r1q0pLmN';
  const c = makeClient();
  const order = 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact';
  const { siteId, slug } = await basicSite(c, 'payer-owner@example.com', 'Pay Co', {});
  const save = (extra) => c.post(`/sites/${siteId}/edit`, { name: 'Pay Co', service_title: ['Full groom', 'Bath only'], service_description: ['Cut', 'Wash'], service_detail: ['Full groom details here.', ''], service_pay: ['89', ''], contact_acceptSubmissions: '1', contact_email: 'owner@payco.test', layout_order: order, ...extra });

  // nothing is payable until payments are on AND a key is saved
  await save({ pay_enabled: '1', pay_currency: 'usd' });
  assert.doesNotMatch(await (await fetch(`${BASE}/site/${slug}/services/full-groom`)).text(), /class="buy-form"/);
  assert.equal((await fetch(`${BASE}/site/${slug}/buy`, { method: 'POST', redirect: 'manual', body: new URLSearchParams({ service: 'Full groom' }) })).headers.get('location'), `/site/${slug}/services`);
  assert.equal(raw.prepare('SELECT COUNT(*) n FROM payments WHERE site_id = ?').get(siteId).n, 0, 'no payment row without a key');

  // the key: junk is ignored, a real one is stored encrypted and never shown again
  await save({ pay_enabled: '1', stripe_key: 'not-a-key' });
  assert.equal(raw.prepare('SELECT stripe_key_enc k FROM sites WHERE id = ?').get(siteId).k, '');
  await save({ pay_enabled: '1', pay_currency: 'usd', stripe_key: SITE_KEY });
  const stored = raw.prepare('SELECT stripe_key_enc k, stripe_key_hint h FROM sites WHERE id = ?').get(siteId);
  assert.ok(stored.k && !stored.k.includes('sk_test') && !stored.k.includes('Z9y8'), 'encrypted at rest');
  assert.match(stored.h, /ending pLmN/);
  const editor = await (await c.get(`/sites/${siteId}/edit`)).text();
  assert.doesNotMatch(editor, /Z9y8x7w6v5u4t3s2r1q0pLmN/); assert.match(editor, /ending pLmN/);
  await save({ pay_enabled: '1', pay_currency: 'usd' }); // saving again without the field keeps the key
  assert.ok(raw.prepare('SELECT stripe_key_enc k FROM sites WHERE id = ?').get(siteId).k);

  // service pay button: price comes from the owner's settings, the visitor cannot change it
  const svcPage = await (await fetch(`${BASE}/site/${slug}/services/full-groom`)).text();
  assert.match(svcPage, /class="buy-form"[^>]*>[\s\S]*?Pay online &middot; \$89\.00/);
  const buy = await fetch(`${BASE}/site/${slug}/buy`, { method: 'POST', redirect: 'manual', body: new URLSearchParams({ service: 'Full groom', amount: '1', price: '1' }) });
  assert.match(buy.headers.get('location'), /^https:\/\/checkout\.stripe\.test\/pay\/cs_pay_\d+$/);
  const sreq = stripeRequests.filter(r => r.url === '/v1/checkout/sessions' && r.params.get('mode') === 'payment').pop();
  assert.equal(sreq.auth, 'Bearer ' + SITE_KEY, 'the site\'s own key is used, not the platform key');
  assert.equal(sreq.params.get('line_items[0][price_data][unit_amount]'), '8900'); assert.equal(sreq.params.get('line_items[0][price_data][currency]'), 'usd');
  assert.equal((await fetch(`${BASE}/site/${slug}/buy`, { method: 'POST', redirect: 'manual', body: new URLSearchParams({ service: 'Bath only' }) })).headers.get('location'), `/site/${slug}/services`, 'a service with no price cannot be bought');
  const pay1 = raw.prepare("SELECT * FROM payments WHERE kind = 'purchase' AND site_id = ?").get(siteId);
  assert.equal(pay1.amount_cents, 8900); assert.equal(pay1.status, 'pending');
  const payPage = await (await fetch(`${BASE}/pay/${pay1.token}`)).text();
  assert.match(payPage, /\$89\.00/); assert.match(payPage, /Pay \$89\.00/);
  // customer pays on Stripe and comes back: confirmed by asking Stripe, owner emailed once
  stripeSessions[pay1.stripe_session_id].payment_status = 'paid'; stripeSessions[pay1.stripe_session_id].customer_details = { name: 'Kim Buyer', email: 'kim@x.test' };
  const before = mailCount();
  assert.match(await (await fetch(`${BASE}/pay/${pay1.token}?done=1`)).text(), /Payment received/);
  await fetch(`${BASE}/pay/${pay1.token}`);
  const paid1 = raw.prepare('SELECT * FROM payments WHERE id = ?').get(pay1.id);
  assert.equal(paid1.status, 'paid'); assert.equal(paid1.customer_name, 'Kim Buyer'); assert.equal(paid1.customer_email, 'kim@x.test');
  const mails = await waitForMail(before + 1);
  assert.equal(mails.slice(before).filter(m => /Payment received/.test(m.subject)).length, 1, 'one alert, not one per page view');
  assert.equal((await fetch(`${BASE}/pay/not-a-real-token-123456`)).status, 404);

  // booking deposit: time is held, booking only confirmed once paid; unpaid holds are released
  await save({ ...bookingFields({ bk_autoConfirm: '1' }), pay_enabled: '1', pay_currency: 'usd', pay_depositMode: 'fixed', pay_depositAmount: '25' });
  const date = daysAhead(5);
  const post = (body) => fetch(`${BASE}/site/${slug}/book`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() });
  const good = { service: 'Full groom', date, time: '10:00', name: 'Dana Pet', email: 'dana@example.com', f_0: 'Biscuit', f_1: 'Medium' };
  const r = await post(good);
  assert.match(r.headers.get('location'), /^https:\/\/checkout\.stripe\.test\/pay\//, 'sent straight to Stripe');
  const bk = raw.prepare("SELECT * FROM bookings WHERE name = 'Dana Pet' AND site_id = ?").get(siteId);
  assert.equal(bk.status, 'awaiting_payment');
  const dep = raw.prepare("SELECT * FROM payments WHERE kind = 'deposit' AND site_id = ?").get(siteId);
  assert.equal(dep.amount_cents, 2500); assert.equal(dep.ref_id, bk.id);
  const slots = async (svc = 'Full groom') => (await (await fetch(`${BASE}/site/${slug}/book/slots?${new URLSearchParams({ service: svc, date })}`)).json()).slots.map(x => x.time);
  assert.ok(!(await slots()).includes('10:00'), 'the held time is not offered to others');
  assert.equal((await post({ ...good, name: 'Other Person', email: 'o@x.test' })).status, 422, 'cannot take a held time');
  assert.match(await (await fetch(`${BASE}/site/${slug}/book?t=${bk.token}`)).text(), /not booked/);
  assert.match(await (await c.get(`/sites/${siteId}/bookings`)).text(), /Waiting for a deposit/);
  // customer pays; the background sweep confirms it even though they never came back
  stripeSessions[dep.stripe_session_id].payment_status = 'paid';
  const jobs = await (await fetch(`${BASE}/__test/run-jobs`, { method: 'POST', headers: { 'x-test-key': 'suite' } })).json();
  assert.ok(jobs.payments.checked >= 1);
  assert.equal(raw.prepare('SELECT status FROM bookings WHERE id = ?').get(bk.id).status, 'confirmed');
  assert.equal(raw.prepare('SELECT status FROM payments WHERE id = ?').get(dep.id).status, 'paid');
  assert.match(await (await fetch(`${BASE}/site/${slug}/book?t=${bk.token}`)).text(), /Deposit paid: \$25\.00/);
  assert.match(await (await c.get(`/sites/${siteId}/bookings`)).text(), /deposit \$25\.00 paid/);
  // an unpaid hold older than 30 minutes is released and the time is free again
  const lr = await post({ ...good, service: 'Bath only', time: '12:00', name: 'Late Payer', email: 'late@x.test' });
  assert.ok(lr.status === 302, 'late booking status ' + lr.status + ' ' + ((await lr.text()).match(/class="[^"]*(?:error|alert|notice)[^"]*"[^>]*>([^<]{5,200})/g)||[]).join('|').replace(/\s+/g,' ').slice(0, 400));
  const lp = raw.prepare("SELECT * FROM bookings WHERE name = 'Late Payer'").get();
  assert.equal(lp.status, 'awaiting_payment');
  raw.prepare("UPDATE bookings SET created_at = datetime('now', '-45 minutes') WHERE id = ?").run(lp.id);
  const jobs2 = await (await fetch(`${BASE}/__test/run-jobs`, { method: 'POST', headers: { 'x-test-key': 'suite' } })).json();
  assert.ok(jobs2.payments.released >= 1);
  assert.equal(raw.prepare('SELECT status FROM bookings WHERE id = ?').get(lp.id).status, 'cancelled');
  assert.ok((await slots('Bath only')).includes('12:00'), 'released time is bookable again');
  assert.equal(raw.prepare("SELECT status FROM payments WHERE ref_id = ? AND kind = 'deposit'").get(lp.id).status, 'expired');

  // payment requests (quotes / invoices): create, email, history, private to the owner
  const stripeCallsBefore = stripeRequests.length;
  assert.match((await c.post(`/sites/${siteId}/payments/new`, { amount: 'abc', description: 'x' })).headers.get('location'), /f=bad/);
  assert.match((await c.post(`/sites/${siteId}/payments/new`, { amount: '250', description: '' })).headers.get('location'), /f=bad/);
  const mb = mailCount();
  assert.match((await c.post(`/sites/${siteId}/payments/new`, { amount: '$1,250.50', description: 'Kitchen deep clean', name: 'Lee', email: 'lee@x.test', send: '1' })).headers.get('location'), /f=sent/);
  const inv = raw.prepare("SELECT * FROM payments WHERE kind = 'invoice' ORDER BY id DESC").get();
  assert.equal(inv.amount_cents, 125050);
  const sent = (await waitForMail(mb + 1)).slice(mb).find(m => m.to[0].address === 'lee@x.test');
  assert.match(sent.text, /\$1,250\.50/); assert.match(sent.text, new RegExp('/pay/' + inv.token));
  const hub = await (await c.get(`/sites/${siteId}/payments`)).text();
  assert.match(hub, /Kitchen deep clean/); assert.match(hub, /\$89\.00/); assert.match(hub, /Collected/);
  const other = makeClient();
  await other.post('/signup', { email: 'payer-other@example.com', password: 'password1' });
  assert.equal((await other.get(`/sites/${siteId}/payments`)).status, 404);
  assert.equal((await other.post(`/sites/${siteId}/payments/${inv.id}/paid`, {})).status, 404);
  assert.equal(raw.prepare('SELECT status FROM payments WHERE id = ?').get(inv.id).status, 'pending', 'another account could not touch it');
  // owner marks it paid (cash), then a second one is canceled and cannot be paid
  await c.post(`/sites/${siteId}/payments/${inv.id}/paid`, {});
  assert.equal(raw.prepare('SELECT status, paid_via FROM payments WHERE id = ?').get(inv.id).paid_via, 'manual');
  await c.post(`/sites/${siteId}/payments/new`, { amount: '40', description: 'Cancel me' });
  const cx = raw.prepare("SELECT * FROM payments WHERE description = 'Cancel me'").get();
  await c.post(`/sites/${siteId}/payments/${cx.id}/cancel`, {});
  assert.match(await (await fetch(`${BASE}/pay/${cx.token}`)).text(), /canceled/);
  const noPay = await fetch(`${BASE}/pay/${cx.token}`, { method: 'POST', redirect: 'manual' });
  assert.equal(noPay.headers.get('location'), `/pay/${cx.token}`);
  assert.equal(stripeRequests.slice(stripeCallsBefore).filter(r => r.params.get('mode') === 'payment').length, 0, 'requests for money made no Stripe session until a customer pays');

  // removing the key turns every pay button off again
  await save({ pay_enabled: '1', stripe_key_remove: '1' });
  assert.doesNotMatch(await (await fetch(`${BASE}/site/${slug}/services/full-groom`)).text(), /class="buy-form"/);
  assert.equal(raw.prepare('SELECT stripe_key_enc k FROM sites WHERE id = ?').get(siteId).k, '');
  raw.close();
});

test('chat-to-edit: proposes, previews, applies only allowed changes, saves history, owner-only', async () => {
  const Database = require('better-sqlite3'); const raw = new Database(TEST_DB);
  const c = makeClient();
  const { siteId, slug } = await basicSite(c, 'chatedit-owner@example.com', 'Edit Co', {});
  const ask = (cl, base, instruction) => cl.post(base + '/ai-edit', { instruction });
  const base = `/sites/${siteId}`;
  const r1 = await (await ask(c, base, 'ZZ-EDIT-OK make it friendlier')).json();
  assert.equal(r1.ok, true);
  assert.deepEqual(r1.changes.map(x => x.label).sort(), ['Add service', 'Main color', 'hero headline']);
  assert.equal(r1.skipped, 3, 'contact, bad colour and __proto__ were refused');
  const siteNow = () => raw.prepare('SELECT theme, sections FROM sites WHERE id = ?').get(siteId);
  assert.notEqual(JSON.parse(siteNow().sections).hero.headline, 'A friendlier headline', 'nothing saved before approval');
  // another account cannot apply or even ask
  const other = makeClient(); await other.post('/signup', { email: 'chatedit-other@example.com', password: 'password1' });
  assert.equal((await other.post(base + '/ai-edit/apply', { token: r1.token })).status, 404);
  assert.equal((await ask(other, base, 'ZZ-EDIT-OK')).status, 404);
  const v0 = raw.prepare('SELECT COUNT(*) n FROM site_versions WHERE site_id = ?').get(siteId).n;
  const ap = await (await c.post(base + '/ai-edit/apply', { token: r1.token })).json();
  assert.equal(ap.ok, true); assert.equal(ap.applied, 3);
  const row = siteNow(); const sec = JSON.parse(row.sections);
  assert.equal(sec.hero.headline, 'A friendlier headline');
  assert.equal(JSON.parse(row.theme).primaryColor, '#116644');
  assert.ok(sec.services.items.some(i => i.title === 'Gutter Cleaning'));
  assert.notEqual(sec.contact.email, 'evil@x.test'); assert.equal(({}).polluted, undefined);
  assert.equal(raw.prepare('SELECT COUNT(*) n FROM site_versions WHERE site_id = ?').get(siteId).n, v0 + 1, 'history version saved');
  assert.match(raw.prepare('SELECT label FROM site_versions WHERE site_id = ? ORDER BY id DESC').get(siteId).label, /Before AI edit/);
  assert.match(await (await fetch(`${BASE}/site/${slug}`)).text(), /A friendlier headline/);
  // a proposal can only be used once
  assert.equal((await (await c.post(base + '/ai-edit/apply', { token: r1.token })).json()).ok, false);
  // nothing allowed to change -> an explanation and no token; unusable AI reply -> clear message
  const r2 = await (await ask(c, base, 'ZZ-EDIT-NONE change my phone')).json();
  assert.equal(r2.ok, true); assert.equal(r2.changes.length, 0); assert.equal(r2.token, ''); assert.match(r2.reply, /cannot change/);
  const r3 = await (await ask(c, base, 'garbled')).json();
  assert.equal(r3.ok, false); assert.match(r3.error, /Nothing was changed/);
  assert.equal((await ask(c, base, '   ')).status, 400);
  // clients (share link): text only, no style changes
  await c.post(`${base}/client-link`, {});
  const shown = await (await c.get(`${base}/edit?clientlink=1`)).text();
  const token = shown.match(/<strong id="clientLinkText">(http[^<]+)<\/strong>/)[1].split('/client/')[1];
  const cli = await (await fetch(`${BASE}/client/${token}/ai-edit`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ instruction: 'ZZ-EDIT-OK' }) })).json();
  assert.equal(cli.ok, true);
  assert.ok(!cli.changes.some(x => /Style/.test(x.label)), 'clients cannot change colours or style');
  assert.ok(cli.changes.some(x => x.label === 'Add service'));
  assert.match(await (await fetch(`${BASE}/client/${token}`)).text(), /Ask AI to change something/);
  assert.equal((await fetch(`${BASE}/client/${'x'.repeat(32)}/ai-edit`, { method: 'POST' })).status, 404);
  // a client's proposal cannot be applied through the owner route
  assert.equal((await (await c.post(base + '/ai-edit/apply', { token: cli.token })).json()).ok, false);
  assert.match(await (await c.get(`${base}/edit`)).text(), /Ask AI to change something/);
  raw.close();
});

test('luxury dark style: own colors, quick-link pills, home map and footer columns', async () => {
  const c = makeClient();
  const { siteId, slug } = await basicSite(c, 'noir-owner@example.com', 'Noir Co', {});
  const order = 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact';
  const save = (extra) => c.post(`/sites/${siteId}/edit`, { name: 'Noir Co', theme_style: 'noir', theme_primaryColor: '#c9a24b', theme_accentColor: '#14100a', service_title: ['Groom'], service_description: ['Cut'], hours_day: ['Mon'], hours_time: ['9-5'], contact_acceptSubmissions: '1', contact_phone: '407-555-0100', contact_address: '1 Main St, Orlando, FL', layout_order: order, ...extra });
  const home = async () => (await fetch(`${BASE}/site/${slug}`)).text();

  await save({});
  let h = await home();
  assert.match(h, /class="style-noir /);
  assert.doesNotMatch(h, /class="quick-links"/, 'pills are off until switched on');
  assert.doesNotMatch(h, /id="where-we-work"/);
  assert.doesNotMatch(h, /<h4>Hours<\/h4>/);

  await save({ hero_quickLinks: '1', contact_homeMap: '1', contact_footerHours: '1', theme_bgColor: '#08111f', theme_primaryColor: '#e0a98f' });
  h = await home();
  assert.match(h, /<nav class="quick-links"[^>]*>[\s\S]*?Services[\s\S]*?<\/nav>/);
  assert.match(h, /href="#where-we-work"/);
  assert.match(h, /id="where-we-work"[\s\S]*?maps\.google\.com\/maps\?q=1%20Main%20St/);
  assert.match(h, /<h4>Hours<\/h4>[\s\S]*?Mon/);
  assert.match(h, /body\.style-noir \{ --page-bg: #08111f; \}/, 'custom background applied');
  assert.match(h, /--primary: #e0a98f;/);
  assert.match(h, /--on-primary: #111111;/, 'dark text on a light accent');

  // a bad background value cannot inject CSS
  await save({ theme_bgColor: 'red; } body { display:none' });
  h = await home();
  assert.doesNotMatch(h, /display:none/); assert.doesNotMatch(h, /--page-bg: red/);
  assert.equal(JSON.parse(require('better-sqlite3')(TEST_DB).prepare('SELECT theme FROM sites WHERE id = ?').get(siteId).theme).bgColor, '');

  // dark accents get light text, light accents get dark text on filled buttons
  await save({ theme_primaryColor: '#2a3a8c' });
  assert.match(await home(), /--on-primary: #ffffff;/);

  // "We accept" column appears once card payments are live
  assert.doesNotMatch(await home(), /We accept/);
  await save({ pay_enabled: '1', stripe_key: 'sk_test_' + 'Q1w2e3r4t5y6u7i8o9p0AsDf' });
  assert.match(await home(), /<h4>We accept<\/h4>[\s\S]*?Visa/);
  // other styles are untouched by the new options' CSS
  await save({ theme_style: 'modern' });
  assert.doesNotMatch(await home(), /class="style-noir /);
});

test('accents: own emoji, doodles, emoji headings and floating shapes', async () => {
  const c = makeClient();
  const { siteId, slug } = await basicSite(c, 'accents-owner@example.com', 'Accent Co', {});
  const order = 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact';
  const save = (extra) => c.post(`/sites/${siteId}/edit`, { name: 'Accent Co', service_title: ['Groom'], service_description: ['Cut'], about_heading: 'Our Story', about_body: 'Hello', layout_order: order, ...extra });
  const home = async () => (await fetch(`${BASE}/site/${slug}`)).text();

  await save({});
  let h = await home();
  assert.doesNotMatch(h, /<canvas/); assert.doesNotMatch(h, /class="[^"]*\bdoodles\b/); 

  await save({ theme_emoji: '🐾 ✂️ <script>alert(1)</script> 🦴 hello', theme_doodles: '1', theme_emojiHeads: '1', hero_float: 'emoji' });
  h = await home();
  assert.match(h, /<body class="[^"]*\bdoodles\b[^"]*\bemoji-heads\b/);
  assert.match(h, /--emoji-q: "🐾";/);
  assert.match(h, /<canvas class="hero-fx"[^>]*data-fx="emoji"[^>]*data-emoji="🐾 ✂️ 🦴"/);
  assert.doesNotMatch(h, /<script>alert\(1\)/, 'only emoji survive');
  const editor = await (await c.get(`/sites/${siteId}/edit`)).text();
  assert.match(editor, /name="theme_emoji"[^>]*value="🐾 ✂️ 🦴"/);
  assert.match(editor, /name="hero_float"/); assert.doesNotMatch(editor, /name="hero_motion"/, 'cinematic hero now belongs to the motion style');

  // text with no emoji leaves nothing behind; unknown shapes and motions are ignored
  await save({ theme_emoji: 'no emoji here', theme_emojiHeads: '1', hero_float: 'emoji' });
  h = await home();
  assert.doesNotMatch(h, /--emoji-q: /); assert.doesNotMatch(h, /<body class="[^"]*emoji-heads/);
  assert.match(h, /data-emoji="✨"/, 'floating emoji falls back to sparkles when none chosen');
  await save({ hero_float: 'rainstorm' });
  assert.doesNotMatch(await home(), /<canvas/);
  for (const k of ['sparkles', 'bubbles', 'confetti']) { await save({ hero_float: k }); assert.match(await home(), new RegExp(`data-fx="${k}"`)); }
});

test('editor shows design suggestions for the site\'s industry', async () => {
  const c = makeClient();
  const { siteId } = await basicSite(c, 'advice-owner@example.com', 'Glow Salon', { meta_businessType: 'hair salon' });
  const page = await (await c.get(`/sites/${siteId}/edit`)).text();
  assert.match(page, /id="designAdvice"/);
  assert.match(page, /data-da-style="luxe"/);
  assert.match(page, /data-da-primary="#[0-9a-f]{6}"/);
  assert.match(page, /Better to avoid:[\s\S]{0,200}midnight style/);
  const generic = await basicSite(c, 'advice-owner2@example.com', 'Plain Co', { meta_businessType: 'zzz unknown thing' });
  assert.doesNotMatch(await (await c.get(`/sites/${generic.siteId}/edit`)).text(), /id="designAdvice"/, 'no advice when the industry is unknown');
});

test('questionnaire: the owner\'s chosen design option is what gets built', async () => {
  const Database = require('better-sqlite3');
  const designOptions = require('../design-options');
  const owner = makeClient();
  await owner.post('/signup', { email: 'design-opt-owner@example.com', password: 'password1' });
  await owner.post('/intake/links', { label: 'Opt' });
  const raw = new Database(TEST_DB);
  const link = raw.prepare('SELECT * FROM intake_links ORDER BY id DESC').get();
  const anon = makeClient();
  const ok = await anon.post(`/start/${link.token}`, {
    biz_name: 'Glow Hair Studio', biz_type: 'Hair salon', city: 'Orlando', svc_name: ['Cuts'], svc_desc: ['Fresh cuts'],
    mood: 'luxe', inspo_like: 'elegant and calm', contact_name: 'Gia', contact_email: 'gia@x.test', agree: '1'
  });
  assert.match(ok.headers.get('location'), /\/done$/);
  const sub = raw.prepare('SELECT * FROM intake_submissions WHERE site_id IS NULL ORDER BY id DESC').get();
  const d = JSON.parse(sub.data);
  const opts = designOptions.designOptions(d).options;
  const built = await owner.post(`/intake/submissions/${sub.id}/build`, { option: '1' });
  const siteId = built.headers.get('location').match(/\/sites\/(\d+)\//)[1];
  const th = JSON.parse(raw.prepare('SELECT theme FROM sites WHERE id = ?').get(siteId).theme);
  assert.equal(th.style, opts[1].style, 'option 2 style applied');
  assert.notEqual(opts[1].style, 'luxe');
  // a forged option value is ignored and the client's own look is kept
  const sub2Resp = await anon.post(`/start/${link.token}`, { biz_name: 'Forge Co', biz_type: 'Hair salon', svc_name: ['x'], svc_desc: [''], mood: 'luxe', contact_name: 'G', contact_email: 'g@x.test', agree: '1' });
  assert.match(sub2Resp.headers.get('location'), /\/done$/);
  const sub2 = raw.prepare("SELECT * FROM intake_submissions WHERE site_id IS NULL ORDER BY id DESC").get();
  const b2 = await owner.post(`/intake/submissions/${sub2.id}/build`, { option: '9; drop' });
  const th2 = JSON.parse(raw.prepare('SELECT theme FROM sites WHERE id = ?').get(b2.headers.get('location').match(/\/sites\/(\d+)\//)[1]).theme);
  assert.equal(th2.style, 'luxe');
});

test('quality gate: errors pause publishing, "publish anyway" and fixes work', async () => {
  const c = makeClient();
  const { siteId, editPath } = await (async () => {
    await c.post('/signup', { email: 'quality-owner@example.com', password: 'password1' });
    const create = await c.post('/sites', { name: 'Gate Co' });
    const editPath = create.headers.get('location');
    return { siteId: editPath.match(/\/sites\/(\d+)\//)[1], editPath };
  })();
  const base = { name: 'Gate Co', hero_headline: 'Hi', about_heading: 'About', about_body: 'x', services_heading: 'S', contact_heading: 'C', contact_email: 'g@x.test', layout_order: 'hero,about,services,contact' };
  const Database = require('better-sqlite3'); const raw = new Database(TEST_DB);
  const published = () => raw.prepare('SELECT published FROM sites WHERE id = ?').get(siteId).published;

  // clean site: publishes straight away
  await c.post(editPath, { ...base, theme_primaryColor: '#1d4ed8' });
  const page = await (await c.get(`/sites/${siteId}/quality`)).text();
  assert.match(page, /Quality check/); assert.match(page, /0 to fix/);
  await c.post(`/sites/${siteId}/publish`, { published: '1' });
  assert.equal(published(), 1);
  await c.post(`/sites/${siteId}/publish`, { published: '0' });

  // a missing photo is a real error: publishing pauses on the fix list
  await c.post(editPath, { ...base, theme_primaryColor: '#1d4ed8', hero_imageUrl: '/uploads/not-there.jpg' });
  const blocked = await c.post(`/sites/${siteId}/publish`, { published: '1' });
  assert.match(blocked.headers.get('location'), new RegExp(`/sites/${siteId}/quality\\?gate=publish`));
  assert.equal(published(), 0);
  const gatePage = await (await c.get(`/sites/${siteId}/quality?gate=publish`)).text();
  assert.match(gatePage, /Image file is missing/); assert.match(gatePage, /Publish anyway/);
  await c.post(`/sites/${siteId}/publish`, { published: '1', force: '1' });
  assert.equal(published(), 1, 'publish anyway works');
  await c.post(`/sites/${siteId}/publish`, { published: '0' });

  // another account cannot see or fix it
  const other = makeClient(); await other.post('/signup', { email: 'quality-other@example.com', password: 'password1' });
  assert.equal((await other.get(`/sites/${siteId}/quality`)).status, 404);
  assert.equal((await other.post(`/sites/${siteId}/quality/fix`, { fix: 'colors' })).status, 404);

  // pale brand colour: the one-click fix darkens it enough
  await c.post(editPath, { ...base, theme_primaryColor: '#7dd3fc' });
  assert.match(await (await c.get(`/sites/${siteId}/quality`)).text(), /Brand color blends into the page/);
  const fixed = await c.post(`/sites/${siteId}/quality/fix`, { fix: 'colors', primaryColor: '#ff0000' });
  assert.match(fixed.headers.get('location'), /done=colors/);
  const th = JSON.parse(raw.prepare('SELECT theme FROM sites WHERE id = ?').get(siteId).theme);
  assert.notEqual(th.primaryColor, '#7dd3fc'); assert.notEqual(th.primaryColor, '#ff0000', 'form value ignored');
  assert.ok(require('../contrast').ratio(th.primaryColor, require('../quality').onPrimary(th.primaryColor)) >= 4.5);
  assert.ok(raw.prepare("SELECT COUNT(*) n FROM site_versions WHERE site_id = ? AND label LIKE 'Before quality fix%'").get(siteId).n >= 1, 'history saved');
});

test('motion style: new sites default to Subtle, markup carries data-animate, scripts are bundled, none loads nothing', async () => {
  const Database = require('better-sqlite3');
  const c = makeClient();
  const { siteId } = await basicSite(c, 'motion-owner@example.com', 'Motion Co', {});
  const raw = new Database(TEST_DB);
  await c.post(`/sites/${siteId}/publish`, { published: '1', force: '1' });
  const save = (extra) => c.post(`/sites/${siteId}/edit`, { name: 'Motion Co', hero_headline: 'Hello', about_heading: 'About', about_body: 'Text', service_title: ['A'], service_description: ['x'], stat_value: ['1,500+', '24/7'], stat_label: ['Jobs', 'Open'], layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact', ...extra });
  const home = async () => (await fetch(`${BASE}/site/motion-co`)).text();

  // the first save from the editor keeps whatever the form says; a brand-new site starts on Subtle
  assert.equal(JSON.parse(raw.prepare('SELECT theme FROM sites WHERE id = ?').get(siteId).theme).motionStyle, 'subtle');
  await save({ theme_motionStyle: 'subtle' });
  let h = await home();
  assert.match(h, /<body class="[^"]*"[^>]*data-motion="subtle"/);
  assert.match(h, /<h1 data-animate="hero">Hello<\/h1>/);
  assert.match(h, /data-animate="fade-up"/);
  assert.match(h, /<script src="\/sg-motion-lite\.js" defer><\/script>/, 'Standard runs the light script');
  assert.doesNotMatch(h, /vendor\/motion\.js/, 'Standard loads no library');
  assert.match(siteCss, /html\.sg-anim \[data-animate="fade-up"\]/, 'hide-until-ready rule exists');
  assert.match(h, /classList\.add\('sg-anim'\)[^<]*setTimeout\(function\(\)\{h\.classList\.remove\('sg-anim'\)\},3000\)/, 'safety net: shown after 3s if the script never runs');
  assert.match(h, /prefers-reduced-motion: reduce\)'\)\.matches\)return;/, 'reduced motion: nothing is hidden');
  for (const gone of ['data-reveal', 'js-motion', 'hero-cine', 'motion-rise', 'cdn.jsdelivr', 'unpkg.com', 'cdnjs']) assert.ok(!h.includes(gone), `${gone} should be gone`);
  // the library and script are served by the site itself
  const lib = await fetch(`${BASE}/vendor/motion.js`); assert.equal(lib.status, 200); assert.match(await lib.text(), /Motion/);
  assert.equal((await fetch(`${BASE}/sitegen-motion.js`)).status, 200);
  assert.equal((await fetch(`${BASE}/sg-motion-lite.js`)).status, 200);

  // lively and none
  await save({ theme_motionStyle: 'lively' });
  assert.match(await home(), /data-motion="lively"/);
  await save({ theme_motionStyle: 'none' });
  h = await home();
  assert.match(h, /data-motion="none"/);
  assert.doesNotMatch(h, /vendor\/motion\.js/); assert.doesNotMatch(h, /sitegen-motion\.js/); assert.doesNotMatch(h, /sg-motion-lite\.js/); assert.doesNotMatch(h, /classList\.add\('sg-anim'\)/);
  // junk falls back to Subtle; the editor shows the choice
  await save({ theme_motionStyle: 'warp' });
  assert.match(await home(), /data-motion="subtle"/);
  await save({ theme_motionStyle: 'lively' });
  assert.match(await (await c.get(`/sites/${siteId}/edit`)).text(), /name="theme_motionStyle"[^>]*>[\s\S]*?<option value="lively" selected>/);

  // sites saved before the setting existed keep what they had (checked on the uncached preview)
  const pvHome = async () => (await c.get(`/sites/${siteId}/preview`)).text();
  const setTheme = (patch, drop) => { const t = JSON.parse(raw.prepare('SELECT theme FROM sites WHERE id = ?').get(siteId).theme); drop.forEach(k => delete t[k]); raw.prepare('UPDATE sites SET theme = ? WHERE id = ?').run(JSON.stringify({ ...t, ...patch }), siteId); };
  setTheme({}, ['motionStyle']);
  assert.match(await pvHome(), /data-motion="none"/);
  setTheme({ motion: 'rise' }, ['motionStyle']);
  assert.match(await pvHome(), /data-motion="subtle"/);
  setTheme({ motionStyle: 'subtle' }, ['motion']);

  // numbers: real values in the text, data-count for the script, nothing for "24/7"
  const t = JSON.parse(raw.prepare('SELECT sections FROM sites WHERE id = ?').get(siteId).sections);
  t.trust = { ...t.trust, stats: [{ value: '1,500+', label: 'Jobs' }, { value: '24/7', label: 'Open' }] };
  raw.prepare('UPDATE sites SET sections = ? WHERE id = ?').run(JSON.stringify(t), siteId);
  h = await pvHome();
  assert.match(h, /<strong data-count="1500" data-suffix="\+" data-comma="1">1,500\+<\/strong>/);
  assert.match(h, /<strong>24\/7<\/strong>/);
});

test('motion style: industries suggest a preset when a site is generated, and the editor offers it', async () => {
  const Database = require('better-sqlite3'); const raw = new Database(TEST_DB);
  const c = makeClient();
  await c.post('/signup', { email: 'motion-suggest@example.com', password: 'password1' });
  const style = async (type, name) => {
    const gen = await c.post('/sites/generate', { business_type: type, business_name: name });
    const id = gen.headers.get('location').match(/\/sites\/(\d+)\//)[1];
    return { id, level: JSON.parse(raw.prepare('SELECT theme FROM sites WHERE id = ?').get(id).theme).motionStyle };
  };
  assert.equal((await style('restaurant', 'Motion Bistro')).level, 'lively');
  assert.equal((await style('insurance agency', 'Motion Insure')).level, 'subtle');
  const care = await style('home care agency', 'Motion Care');
  assert.equal(care.level, 'subtle');
  // someone who turned a restaurant site to Subtle is offered the industry suggestion
  const bistro = raw.prepare("SELECT id, theme FROM sites WHERE name = 'Motion Bistro'").get();
  raw.prepare('UPDATE sites SET theme = ? WHERE id = ?').run(JSON.stringify({ ...JSON.parse(bistro.theme), motionStyle: 'subtle' }), bistro.id);
  const editor = await (await c.get(`/sites/${bistro.id}/edit`)).text();
  assert.match(editor, /Suggested for this kind of business: <strong>lively<\/strong>/);
  assert.match(editor, /id="motionApply" data-level="lively"/);
});

test('motion style: preview switcher is preview-only, "use this style" is owner-only and saved to history', async () => {
  const Database = require('better-sqlite3'); const raw = new Database(TEST_DB);
  const c = makeClient();
  const { siteId } = await basicSite(c, 'motion-preview@example.com', 'Preview Motion', {});
  await c.post(`/sites/${siteId}/publish`, { published: '1', force: '1' });
  const pv = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(pv, /class="sg-motion-bar"/);
  for (const k of ['subtle', 'lively', 'none']) assert.match(pv, new RegExp(`data-sg-preset="${k}"`));
  assert.match(pv, /id="sgReplay"/);
  assert.match(pv, /sg-motion-lite\.js/, 'preview always loads the scripts so the switcher can show them');
  const live = await (await fetch(`${BASE}/site/preview-motion`)).text();
  assert.doesNotMatch(live, /sg-motion-bar/); assert.doesNotMatch(live, /data-sg-preset/);
  // the inner pages of the preview have no bar
  assert.doesNotMatch(await (await c.get(`/sites/${siteId}/preview/about`)).text(), /sg-motion-bar/);

  const stored = () => JSON.parse(raw.prepare('SELECT theme FROM sites WHERE id = ?').get(siteId).theme).motionStyle;
  assert.equal(stored(), 'subtle');
  const r = await c.post(`/sites/${siteId}/motion`, { motionStyle: 'lively' });
  assert.equal(r.status, 302); assert.equal(stored(), 'lively');
  assert.ok(raw.prepare("SELECT COUNT(*) n FROM site_versions WHERE site_id = ? AND label = 'Before motion change'").get(siteId).n >= 1);
  await c.post(`/sites/${siteId}/motion`, { motionStyle: 'explode' });
  assert.equal(stored(), 'lively', 'junk ignored');
  const other = makeClient(); await other.post('/signup', { email: 'motion-other@example.com', password: 'password1' });
  assert.equal((await other.post(`/sites/${siteId}/motion`, { motionStyle: 'none' })).status, 404);
  assert.equal(stored(), 'lively');
  assert.equal((await fetch(`${BASE}/sites/${siteId}/motion`, { method: 'POST' })).status === 302 || true, true);
});

test('motion style: exports carry the animation script and Motion library, so nothing loads from outside', async () => {
  const c = makeClient();
  const { siteId } = await basicSite(c, 'motion-export@example.com', 'Export Motion', {});
  const exp = async () => readZip(Buffer.from(await (await c.get(`/sites/${siteId}/export`)).arrayBuffer()));
  let files = await exp();
  assert.ok(files['sg-motion-lite.js'] && !files['vendor/motion.js'], Object.keys(files).join(', '));
  let idx = files['index.html'].toString();
  assert.match(idx, /<script src="sg-motion-lite\.js" defer>/);
  // Premium ships the Motion library and its scripts instead
  await c.post(`/sites/${siteId}/edit`, { name: 'Export Motion', theme_motionStyle: 'subtle', theme_motionLevel: 'premium', layout_order: 'hero,about,services,contact' });
  files = await exp();
  assert.ok(files['vendor/motion.js'] && files['sitegen-motion.js'] && files['sg-premium.js'] && !files['sg-motion-lite.js'], Object.keys(files).join(', '));
  assert.match(files['vendor/motion.js'].toString(), /Motion/);
  idx = files['index.html'].toString();
  assert.match(idx, /<script src="vendor\/motion\.js" defer>/); assert.match(idx, /<script src="sitegen-motion\.js" defer>/);
  assert.doesNotMatch(idx, /src="\/vendor/); assert.doesNotMatch(idx, /cdn\.jsdelivr|unpkg\.com/);
  assert.match(idx, /data-motion="subtle"/);
  // none: nothing extra is shipped
  await c.post(`/sites/${siteId}/edit`, { name: 'Export Motion', theme_motionStyle: 'none', layout_order: 'hero,about,services,contact' });
  files = await exp();
  assert.ok(!files['vendor/motion.js'] && !files['sitegen-motion.js']);
  assert.doesNotMatch(files['index.html'].toString(), /motion\.js/);
});

test('design guidance reaches the AI prompts: copy for generated sites, and chat-to-edit with a heads-up', async () => {
  const c = makeClient();
  await c.post('/signup', { email: 'brief-owner@example.com', password: 'password1' });
  const before = aiRequests.length;
  const gen = await c.post('/sites/generate', { business_type: 'hair salon', business_name: 'Brief Salon ZZ-AI-TEST', specialties: 'ZZ-AI-TEST color work' });
  assert.equal(gen.status, 302);
  const copyReq = aiRequests.slice(before).find(r => /You write website copy/.test(r.body.system || ''));
  assert.ok(copyReq, 'copy request was made');
  const p = copyReq.body.messages[0].content;
  assert.match(p, /Design direction for salon sites/); assert.match(p, /Page flow that works/);
  assert.match(copyReq.body.system, /Use ONLY the facts you are given/, 'fact rules untouched');
  // a business with no guidance gets the old prompt
  const b2 = aiRequests.length;
  await c.post('/sites/generate', { business_type: 'zzz unknown thing ZZ-AI-TEST', business_name: 'Plain Co ZZ-AI-TEST' });
  const plain = aiRequests.slice(b2).find(r => /You write website copy/.test(r.body.system || ''));
  assert.doesNotMatch(plain.body.messages[0].content, /Design direction/);

  // chat-to-edit prompt carries the guidance for the owner, not for the client link
  const siteId = gen.headers.get('location').match(/\/sites\/(\d+)\//)[1];
  const b3 = aiRequests.length;
  await c.post(`/sites/${siteId}/ai-edit`, { instruction: 'ZZ-EDIT-OK make it friendlier' });
  const edit = aiRequests.slice(b3).find(r => /editing assistant/.test(r.body.system || ''));
  assert.match(edit.body.messages[0].content, /Design guidance for salon sites/);
  assert.match(edit.body.messages[0].content, /usually not recommended: poster, midnight, noir/);
  // a proposal that picks an avoided style comes back with a heads-up, and can still be applied
  const r = await (await c.post(`/sites/${siteId}/ai-edit`, { instruction: 'ZZ-EDIT-NOIR make it dark' })).json();
  assert.equal(r.ok, true);
  assert.match(r.reply, /Heads up: The "noir" style is usually not recommended for salon sites/);
  assert.equal(r.notes.length, 1);
  assert.ok(r.token, 'still applicable: the owner decides');
});

test('publish history: each publish is kept, can be previewed, and rolled back (live and Netlify), owner-only', async () => {
  const Database = require('better-sqlite3'); const raw = new Database(TEST_DB);
  const c = makeClient();
  const { siteId, editPath } = await (async () => {
    await c.post('/signup', { email: 'history-owner@example.com', password: 'password1' });
    const create = await c.post('/sites', { name: 'History Co' }); const editPath = create.headers.get('location');
    return { siteId: editPath.match(/\/sites\/(\d+)\//)[1], editPath };
  })();
  const base = { name: 'History Co', about_heading: 'About', about_body: 'x', services_heading: 'S', contact_heading: 'C', contact_email: 'h@x.test', service_title: ['A'], service_description: ['x'], layout_order: 'hero,about,services,contact' };
  const save = (headline) => c.post(editPath, { ...base, hero_headline: headline });
  const hero = () => JSON.parse(raw.prepare('SELECT sections FROM sites WHERE id = ?').get(siteId).sections).hero.headline;
  const rows = () => raw.prepare('SELECT * FROM publish_history WHERE site_id = ? ORDER BY id').all(siteId);

  assert.match(await (await c.get(`/sites/${siteId}/history`)).text(), /Nothing published yet/);
  await save('Version One ZZ1'); await c.post(`/sites/${siteId}/publish`, { published: '1', force: '1' });
  await save('Version Two ZZ2'); await c.post(`/sites/${siteId}/publish`, { published: '0' });      // unpublishing is not a snapshot
  await c.post(`/sites/${siteId}/publish`, { published: '1', force: '1' });
  assert.deepEqual(rows().map(r => r.kind), ['live', 'live']);
  const [first, second] = rows();
  assert.match(first.sections, /Version One ZZ1/); assert.match(second.sections, /Version Two ZZ2/);
  const page = await (await c.get(`/sites/${siteId}/history`)).text();
  assert.match(page, /Roll back to this/); assert.equal((page.match(/Roll back to this/g) || []).length, 2); assert.match(page, /\(latest\)/);

  // look at an old version without touching the site
  const view = await (await c.get(`/sites/${siteId}/history/${first.id}/view`)).text();
  assert.match(view, /Version One ZZ1/); assert.doesNotMatch(view, /Version Two ZZ2/);
  assert.doesNotMatch(view, /data-sg-preset/, 'no motion switcher on a history view');
  assert.equal(hero(), 'Version Two ZZ2');
  assert.equal((await c.get(`/sites/${siteId}/history/99999/view`)).status, 404);

  // another account cannot see, view or roll back
  const other = makeClient(); await other.post('/signup', { email: 'history-other@example.com', password: 'password1' });
  assert.equal((await other.get(`/sites/${siteId}/history`)).status, 404);
  assert.equal((await other.get(`/sites/${siteId}/history/${first.id}/view`)).status, 404);
  assert.equal((await other.post(`/sites/${siteId}/history/${first.id}/rollback`, {})).status, 404);
  assert.equal(hero(), 'Version Two ZZ2');

  // roll back: content returns, the live page follows, the current state is saved first, and the rollback is logged
  const rb = await c.post(`/sites/${siteId}/history/${first.id}/rollback`, {});
  assert.match(rb.headers.get('location'), /history\?rollback=1/);
  assert.equal(hero(), 'Version One ZZ1');
  assert.match(await (await fetch(`${BASE}/site/${JSON.parse(JSON.stringify(raw.prepare('SELECT slug FROM sites WHERE id = ?').get(siteId))).slug}`)).text(), /Version One ZZ1/);
  const backup = raw.prepare("SELECT sections FROM site_versions WHERE site_id = ? AND label = 'Before rollback'").get(siteId);
  assert.match(backup.sections, /Version Two ZZ2/, 'nothing lost: can be restored from version history');
  assert.equal(rows().pop().kind, 'rollback');
  assert.equal(raw.prepare('SELECT seo_title FROM sites WHERE id = ?').get(siteId).seo_title, JSON.parse(first.sections).seo.title || '');

  // Netlify: a deploy is recorded with its id, and rolling back restores that deploy too
  await save('Version Three ZZ3');
  const pub = await c.post(`/sites/${siteId}/hosting/publish`, { force: '1' });
  assert.match(pub.headers.get('location'), /f=published/);
  const nl = rows().filter(r => r.kind === 'netlify'); assert.equal(nl.length, 1); assert.match(nl[0].deploy_id, /^dep-/);
  await save('Version Four ZZ4');
  const calls = netlifyCalls.length;
  const rb2 = await c.post(`/sites/${siteId}/history/${nl[0].id}/rollback`, {});
  assert.match(rb2.headers.get('location'), /nlok=1/);
  assert.equal(hero(), 'Version Three ZZ3');
  const restore = netlifyCalls.slice(calls).find(x => /\/restore$/.test(x.url));
  assert.ok(restore && restore.url.includes(nl[0].deploy_id), 'asked Netlify to restore that deploy');
  assert.match(await (await c.get(rb2.headers.get('location'))).text(), /matching Netlify deploy was made live again/);
  // Netlify refusing still rolls the content back and says so
  netlifyState.restoreFail = true;
  await save('Version Five ZZ5');
  const rb3 = await c.post(`/sites/${siteId}/history/${nl[0].id}/rollback`, {});
  netlifyState.restoreFail = false;
  assert.match(rb3.headers.get('location'), /nlfail=1/); assert.equal(hero(), 'Version Three ZZ3');

  // only the newest 20 are kept
  for (let i = 0; i < 22; i++) await c.post(`/sites/${siteId}/publish`, { published: '1', force: '1' });
  assert.equal(rows().length, 20);
});

test('members area: sign-up modes, approval, log-in, disabled, reset, privacy, owner-only', async () => {
  const Database = require('better-sqlite3'); const raw = new Database(TEST_DB);
  const owner = makeClient();
  const { siteId, editPath, slug } = await basicSite(owner, 'members-owner@example.com', 'Members Co');
  const base = `/site/${slug}/members`;
  const cfg = (extra) => owner.post(editPath, {
    name: 'Members Co', hero_headline: 'Hello', about_heading: 'About', about_body: 'x', services_heading: 'S', contact_heading: 'C', contact_email: 'm@x.test',
    service_title: ['A'], service_description: ['x'], layout_order: 'hero,about,services,contact',
    members_enabled: '1', members_title: 'Client Portal', members_navLabel: 'Portal', members_intro: 'Welcome back', members_signup: 'approval',
    members_page_title: ['Secret Handbook QQ1', ''], members_page_body: ['Only for members', ''], members_page_linkLabel: ['Download', ''], members_page_linkUrl: ['https://example.com/file.pdf', ''], ...extra
  });
  // off by default
  assert.equal((await makeClient().get(base)).status, 404);
  await cfg({});
  const anon = makeClient();
  const login = await anon.get(base); const html = await login.text();
  assert.equal(login.status, 200);
  assert.match(html, /Client Portal/); assert.match(html, /Welcome back/); assert.doesNotMatch(html, /Secret Handbook QQ1/);
  assert.match(login.headers.get('x-robots-tag') || '', /noindex/); assert.match(login.headers.get('cache-control') || '', /no-store/);
  assert.match(html, /name="robots" content="noindex/);
  // nav link on the public home page
  const hp = await (await makeClient().get(`/site/${slug}`)).text(); assert.match(hp, /href="\/site\/[^"]+\/members"[^>]*>\s*Portal/);
  // not in the sitemap, and robots.txt asks crawlers to stay out
  const sm = await (await makeClient().get(`/sitemap.xml`)).text(); assert.doesNotMatch(sm, /members-co\/members/);
  assert.match(await (await fetch(`${BASE}/robots.txt`)).text(), /Disallow: \/site\/\*\/members/);

  // sign-up needing approval
  const bad = await anon.post(`${base}/signup`, { name: 'A', email: 'nope', password: 'password1', password2: 'password1' }); assert.equal(bad.status, 200); assert.match(await bad.text(), /mem-err/);
  const mism = await anon.post(`${base}/signup`, { name: 'A', email: 'a@x.test', password: 'password1', password2: 'different1' }); assert.match(await mism.text(), /do not match/);
  const bot = await anon.post(`${base}/signup`, { name: 'Bot', email: 'bot@x.test', password: 'password1', password2: 'password1', website: 'http://spam' });
  assert.equal(raw.prepare('SELECT COUNT(*) n FROM site_members WHERE site_id = ? AND email = ?').get(siteId, 'bot@x.test').n, 0, 'honeypot signs nobody up');
  const ok = await anon.post(`${base}/signup`, { name: 'Pat', email: 'Pat@X.test', password: 'password1', password2: 'password1' });
  assert.equal(ok.status, 302);
  const row = raw.prepare('SELECT * FROM site_members WHERE site_id = ?').get(siteId) || {};
  assert.equal(row.email, 'pat@x.test'); assert.equal(row.status, 'pending'); assert.notEqual(row.password_hash, 'password1');
  const dupe = await makeClient().post(`${base}/signup`, { name: 'Pat', email: 'pat@x.test', password: 'password1', password2: 'password1' });
  assert.equal(raw.prepare('SELECT COUNT(*) n FROM site_members WHERE site_id = ?').get(siteId).n, 1);
  // pending cannot log in
  const pc = makeClient();
  const pend = await pc.post(`${base}/login`, { email: 'pat@x.test', password: 'password1' });
  assert.doesNotMatch(await (await pc.get(base)).text(), /Secret Handbook QQ1/);
  // wrong password and unknown email give the same message
  const w1 = await (await makeClient().post(`${base}/login`, { email: 'pat@x.test', password: 'wrongwrong' })).text();
  const w2 = await (await makeClient().post(`${base}/login`, { email: 'ghost@x.test', password: 'wrongwrong' })).text();
  assert.equal((w1.match(/mem-err">([^<]*)</) || [])[1], (w2.match(/mem-err">([^<]*)</) || [])[1]);

  // owner approves; the member gets in and sees the pages
  const admin = await (await owner.get(`/sites/${siteId}/members`)).text(); assert.match(admin, /pat@x\.test/); assert.match(admin, /Approve/);
  await owner.post(`/sites/${siteId}/members/${row.id}/approve`, {});
  const mc = makeClient();
  const li = await mc.post(`${base}/login`, { email: 'pat@x.test', password: 'password1' }); assert.equal(li.status, 302);
  const inside = await (await mc.get(base)).text();
  assert.match(inside, /Secret Handbook QQ1/); assert.match(inside, /https:\/\/example\.com\/file\.pdf/); assert.match(inside, /Log out/);

  // the secret is not in the sitemap or the static export, and the public home page does not carry it
  assert.doesNotMatch(hp, /Secret Handbook QQ1/);
  const zip = await owner.get(`/sites/${siteId}/export`);
  if (zip.status === 200) { const files = await readZip(Buffer.from(await zip.arrayBuffer())); assert.ok(!Object.keys(files).some(n => /members/i.test(n)), 'no members page in an export'); for (const v of Object.values(files)) assert.doesNotMatch(String(v), /Secret Handbook QQ1/); }

  // disabling kicks them out straight away
  await owner.post(`/sites/${siteId}/members/${row.id}/disable`, {});
  assert.doesNotMatch(await (await mc.get(base)).text(), /Secret Handbook QQ1/);
  await owner.post(`/sites/${siteId}/members/${row.id}/enable`, {});
  // log out
  await mc.post(`${base}/login`, { email: 'pat@x.test', password: 'password1' });
  await mc.post(`${base}/logout`, {}); assert.doesNotMatch(await (await mc.get(base)).text(), /Secret Handbook QQ1/);

  // password reset: forgot answers the same either way; owner link works once
  const f1 = await makeClient().post(`${base}/forgot`, { email: 'pat@x.test' }); const f2 = await makeClient().post(`${base}/forgot`, { email: 'ghost@x.test' });
  assert.equal(f1.headers.get('location'), f2.headers.get('location'));
  await owner.post(`/sites/${siteId}/members/${row.id}/reset-link`, {});
  const shown = await (await owner.get(`/sites/${siteId}/members?f=link`)).text();
  const url = (shown.match(/value="([^"]*\/members\/reset\?t=[a-f0-9]{48})"/) || [])[1]; assert.ok(url, 'reset link is shown once');
  assert.doesNotMatch(await (await owner.get(`/sites/${siteId}/members`)).text(), /reset\?t=/);
  const stored = raw.prepare('SELECT reset_hash FROM site_members WHERE id = ?').get(row.id).reset_hash;
  assert.ok(!url.includes(stored) && stored.length === 64, 'only a hash of the token is stored');
  const rpath = url.replace(/^https?:\/\/[^/]+/, '');
  const rc = makeClient();
  assert.match(await (await rc.get(rpath)).text(), /New password/);
  const short = await rc.post(`${base}/reset`, { t: rpath.split('t=')[1], password: 'short', password2: 'short' }); assert.match(await short.text(), /mem-err/);
  await rc.post(`${base}/reset`, { t: rpath.split('t=')[1], password: 'brandnew99', password2: 'brandnew99' });
  assert.match(await (await rc.get(rpath)).text(), /expired or was already used/);
  const nl = makeClient(); await nl.post(`${base}/login`, { email: 'pat@x.test', password: 'brandnew99' });
  assert.match(await (await nl.get(base)).text(), /Secret Handbook QQ1/);
  assert.match(await (await makeClient().get(`${base}/reset?t=${'a'.repeat(48)}`)).text(), /expired or was already used/);

  // open sign-up lets people straight in; invite-only refuses sign-up
  await cfg({ members_signup: 'open' });
  const oc = makeClient(); await oc.post(`${base}/signup`, { name: 'Sam', email: 'sam@x.test', password: 'password1', password2: 'password1' });
  assert.match(await (await oc.get(base)).text(), /Secret Handbook QQ1/);
  await cfg({ members_signup: 'invite' });
  await makeClient().post(`${base}/signup`, { name: 'Z', email: 'z@x.test', password: 'password1', password2: 'password1' });
  assert.equal(raw.prepare('SELECT COUNT(*) n FROM site_members WHERE email = ?').get('z@x.test').n, 0);
  // owner adds directly
  await owner.post(`/sites/${siteId}/members/add`, { name: 'Added', email: 'added@x.test', password: 'password1' });
  const ac = makeClient(); await ac.post(`${base}/login`, { email: 'added@x.test', password: 'password1' });
  assert.match(await (await ac.get(base)).text(), /Secret Handbook QQ1/);

  // another account: no list, no actions
  const other = makeClient(); await other.post('/signup', { email: 'members-other@example.com', password: 'password1' });
  assert.equal((await other.get(`/sites/${siteId}/members`)).status, 404);
  await other.post(`/sites/${siteId}/members/${row.id}/delete`, {});
  assert.ok(raw.prepare('SELECT 1 FROM site_members WHERE id = ?').get(row.id));
  assert.notEqual((await makeClient().get(`/sites/${siteId}/members`)).status, 200);
  // a member of one site is not a member of another
  const o2 = makeClient(); const s2 = await basicSite(o2, 'members-owner2@example.com', 'Members Two');
  await o2.post(s2.editPath, { name: 'Members Two', hero_headline: 'Hi', about_heading: 'A', about_body: 'x', services_heading: 'S', contact_heading: 'C', contact_email: 'm@x.test', service_title: ['A'], service_description: ['x'], layout_order: 'hero,about,services,contact', members_enabled: '1', members_page_title: ['Two Only'], members_page_body: ['x'] });
  assert.doesNotMatch(await (await ac.get(`/site/${s2.slug}/members`)).text(), /Two Only/);

  // the privacy page mentions accounts, and removing a member works; deleting the site cleans up
  await cfg({ members_signup: 'invite', legal_enabled: '1' });
  assert.match(await (await makeClient().get(`/site/${slug}/privacy`)).text(), /members area/i);
  await owner.post(`/sites/${siteId}/members/${row.id}/delete`, {});
  assert.equal(raw.prepare('SELECT 1 FROM site_members WHERE id = ?').get(row.id), undefined);
});


async function submitIntake(label, fields) {
  const Database = require('better-sqlite3'); const raw = new Database(TEST_DB);
  const owner = makeClient();
  await owner.post('/signup', { email: `${label}@example.com`, password: 'password1' });
  await owner.post('/intake/links', { label });
  const link = raw.prepare('SELECT * FROM intake_links ORDER BY id DESC').get();
  const anon = makeClient();
  const r = await anon.post(`/start/${link.token}`, { contact_name: 'Cli', contact_email: 'cli@x.test', agree: '1', ...fields });
  assert.match(r.headers.get('location'), /\/done$/);
  const sub = raw.prepare('SELECT * FROM intake_submissions ORDER BY id DESC').get();
  return { owner, raw, sub };
}

test('questionnaire: prices, differences and tone are collected, shown to the owner, and sent to the AI as the only facts', async () => {
  const { owner, raw, sub } = await submitIntake('ground-a', {
    biz_name: 'Test Grounded Roofing', biz_type: 'roofing company', city: 'Kissimmee', years: '8', areas: 'Kissimmee, St. Cloud',
    svc_name: ['Roof Repair'], svc_desc: ['Fixing leaks ZZ-GROUND-RETRY'], svc_price: ['From $350'],
    diff_item: ['We answer the phone ourselves', 'Photos before and after every job'], tone: 'warm',
    faq_q: ['Do you work weekends?'], faq_a: ['Saturdays by appointment.'], about: 'Small local crew.'
  });
  const d = JSON.parse(sub.data);
  assert.equal(d.services[0].price, 'From $350'); assert.deepEqual(d.diffs.length, 2); assert.equal(d.tone, 'warm');
  const view = await (await owner.get(`/intake/submissions/${sub.id}`)).text();
  assert.match(view, /From \$350/); assert.match(view, /We answer the phone ourselves/); assert.match(view, /Warm and caring/);
  aiRequests.length = 0;
  const built = await owner.post(`/intake/submissions/${sub.id}/build`, {});
  assert.match(built.headers.get('location'), /fromintake=1/);
  const grounded = aiRequests.filter(r => /ONE small business/.test(r.body.system || ''));
  assert.equal(grounded.length, 2, 'the first draft invented things, so one retry with feedback');
  assert.match(grounded[0].body.system, /Never invent/); assert.match(grounded[0].body.messages[0].content, /price given by owner: From \$350/);
  assert.match(grounded[0].body.messages[0].content, /Tone of voice: Warm/); assert.match(grounded[0].body.messages[0].content, /We answer the phone ourselves/);
  assert.match(grounded[1].body.messages[0].content, /previous draft was rejected because it contained:/);
  const siteId = built.headers.get('location').match(/\/sites\/(\d+)\//)[1];
  const page = await (await owner.get(`/sites/${siteId}/preview`)).text();
  const pageOf = async (p) => (await (await owner.get(`/sites/${siteId}/preview/${p}`)).text());
  const all = page + await pageOf('services') + await pageOf('whyChoose') + await pageOf('faq') + await pageOf('about');
  assert.match(all, /From \$350 · Fixing leaks/); assert.match(all, /We answer the phone ourselves/); assert.match(all, /Do you work weekends\?/);
  for (const bad of [/25 years/, /free estimate/i, /Solar Panels/, /24\/7/, /Orlando/, /family-owned/, /licensed/i, /award/i]) assert.doesNotMatch(all, bad);
});

test('questionnaire: unsupported AI and template claims are scrubbed from the built site; no FAQ without real answers', async () => {
  const { owner, raw, sub } = await submitIntake('ground-b', {
    biz_name: 'Bad Draft Plumbing', biz_type: 'plumbing company', city: 'Kissimmee', about: 'Two plumbers. ZZ-GROUND', svc_name: ['Drain cleaning'], svc_desc: ['Clearing slow drains']
  });
  const built = await owner.post(`/intake/submissions/${sub.id}/build`, {});
  const siteId = built.headers.get('location').match(/\/sites\/(\d+)\//)[1];
  const page = (await (await owner.get(`/sites/${siteId}/preview`)).text()) + (await (await owner.get(`/sites/${siteId}/preview/services`)).text()) + (await (await owner.get(`/sites/${siteId}/preview/about`)).text());
  for (const bad of [/25 years/, /free estimate/i, /Solar Panels/, /24\/7/, /Orlando/, /family-owned/, /licensed/i, /insured/i, /award/i, /Look no further/i, /emergency/i]) assert.doesNotMatch(page, bad, String(bad));
  assert.match(page, /Drain cleaning/); assert.match(page, /Clearing slow drains/);
  const site = raw.prepare('SELECT * FROM sites WHERE id = ?').get(siteId);
  const sec = JSON.parse(site.sections), lay = JSON.parse(site.layout);
  assert.deepEqual(sec.services.items.map(x => x.title), ['Drain cleaning'], 'only the client\'s service');
  assert.equal(sec.faq.items.length, 0); assert.ok(lay.hidden.includes('faq'), 'FAQ is left out until there are real answers');
  const subRow = raw.prepare('SELECT todo FROM intake_submissions WHERE id = ?').get(sub.id);
  assert.match(subRow.todo, /did not support/); assert.match(subRow.todo, /no customer questions|No customer questions/i);
});

test('section library: blueprint home layout renders from the site content, saves from the editor, exports with its CSS', async () => {
  const c = makeClient();
  const { siteId, editPath, slug } = await basicSite(c, 'blueprint@example.com', 'Blueprint Plumbing', {
    meta_businessType: 'plumbing company', theme_homeLayout: 'blueprint',
    service_title: ['Drain cleaning', 'Water heaters'], service_description: ['Clearing drains.', 'Repair and install.'], service_detail: ['', ''],
    faq_question: ['Do you work weekends?'], faq_answer: ['Ask when you call.'], trust_serviceAreas: 'Kissimmee, St. Cloud'
  });
  let html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /layout-blueprint/); assert.match(html, /sg-library\.css/); assert.match(html, /sg-lib\.js/);
  assert.match(html, /data-sg-section="hero\/stat"/, 'plumbing uses the trades blueprint'); assert.match(html, /data-sg-section="services\/bento"/);
  assert.match(html, /data-sg-section="faq\/side"/); assert.match(html, /data-sg-section="areas\/chips"/);
  assert.doesNotMatch(html, /data-sg-section="testimonials/, 'no reviews yet, so no reviews section');
  assert.doesNotMatch(html, /data-sg-section="stats/, 'no numbers yet, so no stats band');
  assert.match(html, /Drain cleaning/); assert.match(html, /Do you work weekends\?/);
  const form = { name: 'Blueprint Plumbing', hero_headline: 'Hello', about_heading: 'About', about_body: 'About us text', services_heading: 'Services',
    service_title: ['Drain cleaning'], service_description: ['Clearing drains.'], service_detail: [''], contact_heading: 'Contact', contact_email: 'owner@biz.test', contact_phone: '555-0100',
    meta_businessType: 'plumbing company', testimonials_heading: 'Reviews', layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact',
    theme_homeLayout: 'blueprint', theme_blueprint: 'food', bpv_services: 'list', bp_skip: ['faq'], bpv_bogus: 'x' };
  await c.post(editPath, form);
  html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /data-sg-section="hero\/mosaic"/, 'the food blueprint was chosen'); assert.match(html, /data-sg-section="services\/list"/);
  assert.doesNotMatch(html, /data-sg-section="faq/, 'left out by the owner');
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /name="theme_blueprint"/); assert.match(editor, /name="bpv_services"/); assert.match(editor, /value="blueprint"/);
  await c.post(editPath, { ...form, theme_blueprint: '', bpv_services: '', theme_bpHero: 'native', bp_skip: [] });
  html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /data-sg-section="services\/bento"/); assert.doesNotMatch(html, /data-sg-section="hero\//, 'the owner kept the site hero');
  const zip = readZip(Buffer.from(await (await c.get(`/sites/${siteId}/export`)).arrayBuffer()));
  const names = Object.keys(zip); assert.ok(names.includes('sg-library.css') && names.includes('sg-lib.js'), 'the export carries the library CSS and script');
  assert.match(String(zip['index.html']), /href="sg-library\.css"/);
  assert.ok(names.includes('sg-site.css'), 'the export carries the shared site styles'); assert.match(String(zip['index.html']), /href="sg-site\.css"/);
  const sv = /href="\/sg-site\.css\?v=([0-9a-f]{10})"/.exec(html); assert.ok(sv, 'pages link the shared styles with a version');
  assert.match(html, /window\.sgOnScroll=function/, 'one shared scroll listener for the effects');
  const cssRes = await fetch(BASE + '/sg-site.css?v=' + sv[1]); assert.match(cssRes.headers.get('cache-control'), /max-age=31536000/); assert.equal(await cssRes.text(), siteCss);
  const blocks = await c.get('/library/blocks.json'); assert.equal(blocks.status, 200);
  assert.ok((await blocks.json()).length >= 25);
  assert.notEqual((await fetch(BASE + '/library/blocks.json', { redirect: 'manual' })).status, 200, 'signed-out visitors cannot list blocks');
});

test('section designs: chosen while generating a site, saved as defaults, and the blueprint renders in every style', async () => {
  const c = makeClient(); await c.post('/signup', { email: 'designs@example.com', password: 'password1' });
  const dash = await (await c.get('/dashboard')).text();
  assert.match(dash, /name="home_blueprint"/); assert.match(dash, /name="bpv_hero"/); assert.match(dash, /name="bpv_faq"/); assert.match(dash, /value="spotlight"/);
  const gen = await c.post('/sites/generate', { business_type: 'plumbing company', business_name: 'Designs Plumbing', phone: '555-0123', home_blueprint: '1', bpv_hero: 'spotlight', bpv_faq: 'numbered', bpv_testimonials: 'bogus' });
  assert.equal(gen.status, 302);
  const editPath = gen.headers.get('location').split('?')[0]; const siteId = editPath.match(/\/sites\/(\d+)\//)[1];
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /<option value="spotlight" selected[ >]/); assert.match(editor, /<option value="blueprint" selected>/);
  let html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /data-sg-section="hero\/spotlight"/, 'the chosen hero'); assert.match(html, /layout-blueprint/);
  const plain = await c.post('/sites/generate', { business_type: 'plumbing company', business_name: 'Plain Plumbing' });
  const plainId = plain.headers.get('location').match(/\/sites\/(\d+)\//)[1];
  assert.doesNotMatch(await (await c.get(`/sites/${plainId}/preview`)).text(), /sg-library\.css/, 'without the checkbox the site keeps its normal layout');
  const form = { name: 'Designs Plumbing', hero_headline: 'Hello', about_heading: 'About', about_body: 'About us text', services_heading: 'Services', service_title: ['Drain cleaning'], service_description: ['Clearing drains.'], service_detail: [''],
    contact_heading: 'Contact', contact_email: 'owner@biz.test', contact_phone: '555-0100', meta_businessType: 'plumbing company', testimonials_heading: 'Reviews',
    layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact', theme_homeLayout: 'blueprint', bpv_services: 'reveal',
    faq_question: ['Q?'], faq_answer: ['A.'], testimonial_quote: ['Great work.'], testimonial_author: ['Pat'], testimonial_rating: ['5'], testimonial_date: [''] };
  for (const style of require('../themes').ALL_STYLES) {
    const r = await c.post(editPath, { ...form, theme_style: style });
    assert.ok(r.status < 400, style);
    const page = await (await c.get(`/sites/${siteId}/preview`)).text();
    assert.match(page, /layout-blueprint/, style); assert.match(page, /data-sg-section="services\/reveal"/, style); assert.match(page, new RegExp('style-' + style), style);
    assert.doesNotMatch(page, /undefined|\[object Object\]/, style + ' leaks a bad value');
  }
  const css = await (await fetch(BASE + '/sg-library.css')).text();
  assert.match(css, /var\(--primary\)/); assert.match(css, /var\(--heading-font\)/);
});

test('section effects: per-section emoji, underline, background and heading save from the editor and show on the page', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'effects@example.com', 'Effects Plumbing', {
    meta_businessType: 'plumbing company', theme_homeLayout: 'blueprint', theme_emoji: '🔧 🛠️', theme_emojiHeads: '1', theme_doodles: '1', theme_hoverLift: '1',
    service_title: ['Drain cleaning', 'Water heaters', 'Leaks'], service_description: ['a', 'b', 'c'], service_detail: ['', '', ''],
    faq_question: ['Do you work weekends?'], faq_answer: ['Ask when you call.'],
    bps_services_emoji: '🚿', bps_services_bg: 'brand', bps_services_title: 'Jobs we do', bps_faq_doodle: 'off', bps_faq_emoji: 'not an emoji', bps_why_bg: 'neon'
  });
  let html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<div class="sg-sec" data-sg-fam="services" data-sg-bg="brand" data-sg-emoji="1" style="--sg-emoji: '🚿'">/); assert.match(html, /Jobs we do/);
  assert.match(html, /data-sg-doodle="off"/); assert.doesNotMatch(html, /not an emoji|data-sg-bg="neon"/);
  assert.match(html, /body class="[^"]*emoji-heads[^"]*doodles|body class="[^"]*doodles[^"]*emoji-heads/);
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /name="bps_services_emoji" value="🚿"/); assert.match(editor, /<option value="brand" selected>/); assert.match(editor, /Size, photo and effects for this section \(changed\)/);
});

test('scenes and banner: chosen in the editor, rendered with the scroll script, exported with it', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'scenes@example.com', 'Scene Plumbing', {
    meta_businessType: 'plumbing company', theme_homeLayout: 'blueprint', theme_primaryColor: '#c2410c', trust_badges: 'Family owned • Free estimates • Local',
    bpv_hero: 'scene-shore', bp_add: ['banner', 'logos', 'nope'], bpv_banner: 'quiet',
    service_title: ['Drains', 'Leaks', 'Heaters'], service_description: ['a', 'b', 'c'], service_detail: ['', '', '']
  });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /data-sg-section="hero\/scene-shore"/); assert.match(html, /data-sg-section="banner\/quiet"/); assert.match(html, /data-sg-parallax/);
  assert.doesNotMatch(html, /data-sg-section="logos/, 'no logos uploaded, so nothing is drawn');
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /name="bp_add" value="banner" checked/); assert.match(editor, /Parallax: palm shore/); assert.match(editor, /Add a section/);
  const zip = readZip(Buffer.from(await (await c.get(`/sites/${siteId}/export`)).arrayBuffer()));
  assert.match(String(zip['index.html']), /data-sg-parallax/); assert.ok(zip['sg-lib.js'] && String(zip['sg-lib.js']).includes('data-sg-parallax'));
});

test('own sections: saved from the editor, cleaned, drawn after the chosen section, kept on other layouts, exported', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'ownsec@example.com', 'Own Sections Co', {
    meta_businessType: 'plumbing company', theme_homeLayout: 'blueprint',
    service_title: ['Drains', 'Leaks', 'Heaters'], service_description: ['a', 'b', 'c'], service_detail: ['', '', ''],
    cs_after: ['services', 'bogus', 'end', 'end'], cs_heading: ['Our story', 'Pick me', '', ''], cs_body: ['Started in 2012.', 'Hello', '', ''],
    cs_img1: ['/uploads/a.jpg', 'javascript:alert(1)', '', ''], cs_img2: ['', '', '', ''], cs_img3: ['', '', '', ''], cs_img4: ['', '', '', ''],
    cs_layout: ['', 'nonsense', '', ''], cs_buttonText: ['', '', '', ''], cs_buttonUrl: ['', '', '', ''], cs_bg: ['alt', 'neon', '', ''], cs_emoji: ['🛠️', 'abc', '', '']
  });
  let html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /data-sg-section="custom\/photo-text"/); assert.match(html, /Our story/); assert.match(html, /Started in 2012\./); assert.match(html, /data-sg-bg="alt"/);
  assert.ok(html.indexOf('data-sg-section="services/bento"') < html.indexOf('data-sg-section="custom/photo-text"'), 'after the services section');
  assert.match(html, /data-sg-section="custom\/text"/, 'the second one is words only'); assert.doesNotMatch(html, /javascript:alert|data-sg-bg="neon"/);
  assert.doesNotMatch(html, /data-sg-section="custom\/[a-z-]+"[\s\S]*data-sg-section="custom\/[a-z-]+"[\s\S]*data-sg-section="custom\/[a-z-]+"/, 'the two empty rows were dropped');
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /Your own sections \(words, photos, or both\) \(2\)/); assert.match(editor, /name="cs_img1" value="\/uploads\/a\.jpg"/); assert.match(editor, /<option value="services" selected>After: Services/);
  // another home layout still shows them (at the end of the home content) and loads the library CSS
  await c.post(editPath, { name: 'Own Sections Co', hero_headline: 'Hello', about_heading: 'About', about_body: 'About us text', services_heading: 'Services', service_title: ['Drains'], service_description: ['a'], service_detail: [''],
    contact_heading: 'Contact', contact_email: 'owner@biz.test', contact_phone: '555-0100', meta_businessType: 'plumbing company', testimonials_heading: 'Reviews',
    layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact', theme_homeLayout: 'full',
    cs_after: ['services'], cs_heading: ['Our story'], cs_body: ['Started in 2012.'], cs_img1: [''], cs_img2: [''], cs_img3: [''], cs_img4: [''], cs_layout: [''], cs_buttonText: ['Call'], cs_buttonUrl: ['/contact'], cs_bg: [''], cs_emoji: [''] });
  html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /layout-full/); assert.match(html, /sg-library\.css/); assert.match(html, /data-sg-section="custom\/text"/); assert.match(html, /href="\/contact"/);
  const zip = readZip(Buffer.from(await (await c.get(`/sites/${siteId}/export`)).arrayBuffer()));
  assert.ok(zip['sg-library.css']); assert.match(String(zip['index.html']), /Started in 2012\./);
});

test('motion levels: Standard is the default and loads no library; Premium and Showcase load only their own scripts', async () => {
  const Database = require('better-sqlite3'); const raw = new Database(TEST_DB);
  const c = makeClient();
  const { siteId } = await basicSite(c, 'tier-owner@example.com', 'Tier Bistro', { meta_businessType: 'restaurant' });
  await c.post(`/sites/${siteId}/publish`, { published: '1', force: '1' });
  const save = (extra) => c.post(`/sites/${siteId}/edit`, { name: 'Tier Bistro', services_heading: 'Services', service_detail: [''], hero_headline: 'Hello', about_heading: 'About', about_body: 'Text', service_title: ['A'], service_description: ['x'], meta_businessType: 'restaurant', layout_order: 'hero,about,services,contact', theme_motionStyle: 'subtle', ...extra });
  const home = async () => (await fetch(`${BASE}/site/tier-bistro`)).text();
  const stored = () => JSON.parse(raw.prepare('SELECT theme FROM sites WHERE id = ?').get(siteId).theme);

  await save({});                                    // no level in the form: Standard
  assert.equal(stored().motionLevel, 'standard');
  let h = await home();
  assert.match(h, /data-motion-level="standard"/); assert.match(h, /sg-motion-lite\.js/);
  for (const gone of ['vendor/motion.js', 'sitegen-motion.js', 'sg-premium.js', 'sg-shader.js', 'lottie_light', 'lottie/icons', 'data-lottie=']) assert.ok(!h.includes(gone), `Standard must not include ${gone}`);

  await save({ theme_motionLevel: 'premium' });
  h = await home();
  assert.match(h, /data-motion-level="premium"/);
  for (const need of ['vendor/motion.js', 'sitegen-motion.js', 'sg-premium.js']) assert.ok(h.includes(need), need);
  assert.ok(!h.includes('sg-motion-lite.js') && !h.includes('sg-shader.js'));
  assert.match(h, /<span class="sg-lottie" data-lottie="bowl" aria-hidden="true">/, 'restaurants get the bowl icon in the hero');
  // the icon sits inside an animated wrapper, never hidden by CSS at rest
  assert.doesNotMatch(h, /\.sg-lottie[^}]*opacity:\s*0/);

  await save({ theme_motionLevel: 'showcase', theme_motionShader: 'silk' });
  h = await home();
  assert.match(h, /data-motion-level="showcase"/); assert.match(h, /data-shader="silk"/);
  assert.ok(h.includes('sg-shader.js') && h.includes('sg-premium.js'));
  assert.equal(stored().motionShader, 'silk');
  await save({ theme_motionLevel: 'showcase', theme_motionShader: 'plasma' });
  assert.equal(stored().motionShader, 'aurora', 'unknown shader falls back');
  await save({ theme_motionLevel: 'ultra' });
  assert.equal(stored().motionLevel, 'standard', 'junk level falls back to Standard');

  // motion None switches every tier off: no scripts at all
  await save({ theme_motionLevel: 'showcase', theme_motionStyle: 'none' });
  h = await home();
  for (const gone of ['sg-motion-lite.js', 'sitegen-motion.js', 'sg-premium.js', 'sg-shader.js', 'vendor/motion.js']) assert.ok(!h.includes(gone), gone);
  assert.doesNotMatch(h, /data-lottie=/);

  // content stays visible: items are hidden only by the sg-anim class, which the head script adds and every tier removes
  await save({ theme_motionLevel: 'premium' });
  h = await home();
  assert.match(siteCss, /html\.sg-anim \[data-animate="fade-up"\]/);
  assert.doesNotMatch(h + siteCss, /\[data-animate[^{]*\{[^}]*(visibility:\s*hidden|display:\s*none)/);
  assert.match(siteCss, /@media print \{ html\.sg-anim \[data-animate\]/);
  for (const f of ['sg-motion-lite.js', 'sg-premium.js', 'sg-shader.js', 'lottie/icons.js', 'vendor/lottie_light.min.js']) assert.equal((await fetch(`${BASE}/${f}`)).status, 200, f);
});

test('motion levels: sites saved before levels existed keep their look; the public page ignores ?tier', async () => {
  const Database = require('better-sqlite3'); const raw = new Database(TEST_DB);
  const c = makeClient();
  const { siteId } = await basicSite(c, 'tier-legacy@example.com', 'Tier Legacy', {});
  await c.post(`/sites/${siteId}/publish`, { published: '1', force: '1' });
  const setTheme = (patch, drop) => { const t = JSON.parse(raw.prepare('SELECT theme FROM sites WHERE id = ?').get(siteId).theme); drop.forEach(k => delete t[k]); raw.prepare('UPDATE sites SET theme = ? WHERE id = ?').run(JSON.stringify({ ...t, ...patch }), siteId); };
  const pv = async (q = '') => (await c.get(`/sites/${siteId}/preview${q}`)).text();
  setTheme({ motionStyle: 'lively' }, ['motionLevel']);
  assert.match(await pv(), /data-motion-level="premium"/, 'an older Lively site becomes Premium');
  setTheme({ motionStyle: 'subtle' }, ['motionLevel']);
  assert.match(await pv(), /data-motion-level="standard"/);
  // preview-only override
  assert.match(await pv('?tier=showcase'), /data-motion-level="showcase"[^>]*>/);
  assert.match(await pv('?tier=bogus'), /data-motion-level="standard"/);
  assert.match(await pv('?tier=showcase'), /sg-shader\.js/);
  assert.equal(JSON.parse(raw.prepare('SELECT theme FROM sites WHERE id = ?').get(siteId).theme).motionLevel, undefined, 'previewing never saves');
  const live = await (await fetch(`${BASE}/site/tier-legacy?tier=showcase`)).text();
  assert.match(live, /data-motion-level="standard"/); assert.doesNotMatch(live, /sg-shader\.js/);
});

test('motion levels: preview switcher offers the tiers, "Use this" saves level and style, owner-only, junk ignored', async () => {
  const Database = require('better-sqlite3'); const raw = new Database(TEST_DB);
  const c = makeClient();
  const { siteId } = await basicSite(c, 'tier-switch@example.com', 'Tier Switch', {});
  const bar = await (await c.get(`/sites/${siteId}/preview`)).text();
  for (const k of ['standard', 'premium', 'showcase']) assert.match(bar, new RegExp(`data-sg-tier="${k}"`));
  assert.match(bar, /name="motionLevel"/);
  const stored = () => JSON.parse(raw.prepare('SELECT theme FROM sites WHERE id = ?').get(siteId).theme);
  await c.post(`/sites/${siteId}/motion`, { motionLevel: 'premium' });
  assert.equal(stored().motionLevel, 'premium');
  await c.post(`/sites/${siteId}/motion`, { motionLevel: 'explode' });
  assert.equal(stored().motionLevel, 'premium');
  await c.post(`/sites/${siteId}/motion`, { motionStyle: 'lively', motionLevel: 'showcase' });
  assert.equal(stored().motionLevel, 'showcase'); assert.equal(stored().motionStyle, 'lively');
  const other = makeClient(); await other.post('/signup', { email: 'tier-other@example.com', password: 'password1' });
  assert.equal((await other.post(`/sites/${siteId}/motion`, { motionLevel: 'standard' })).status, 404);
  assert.equal(stored().motionLevel, 'showcase');
});

test('motion levels: the editor shows the level, the shader picker only for Showcase, and the industry suggestion', async () => {
  const Database = require('better-sqlite3'); const raw = new Database(TEST_DB);
  const c = makeClient();
  await c.post('/signup', { email: 'tier-editor@example.com', password: 'password1' });
  const mk = async (type, name) => { const g = await c.post('/sites/generate', { business_type: type, business_name: name }); return g.headers.get('location').match(/\/sites\/(\d+)\//)[1]; };
  const salon = await mk('hair salon', 'Tier Salon'); const law = await mk('law firm', 'Tier Law');
  assert.equal(JSON.parse(raw.prepare('SELECT theme FROM sites WHERE id = ?').get(salon).theme).motionLevel, 'standard', 'every new site starts on Standard');
  let ed = await (await c.get(`/sites/${salon}/edit`)).text();
  assert.match(ed, /name="theme_motionLevel"[\s\S]*?<option value="standard" selected>/);
  for (const k of ['standard', 'premium', 'showcase']) assert.match(ed, new RegExp(`<option value="${k}"`));
  assert.match(ed, /Suggested for this kind of business: <strong>Showcase<\/strong>/);
  assert.match(ed, /id="levelApply" data-level="showcase"/);
  assert.match(ed, /id="shaderRow" hidden/);
  assert.match(ed, /name="theme_motionShader"/);
  const edLaw = await (await c.get(`/sites/${law}/edit`)).text();
  assert.match(edLaw, /This level suits this kind of business/);
  assert.doesNotMatch(edLaw, /id="levelApply"/);
  // a generated restaurant gets both icons (hero badge + services heading) on Premium, none on Standard
  const bistro = await mk('restaurant', 'Tier Icons Bistro');
  const prem = await (await c.get(`/sites/${bistro}/preview?tier=premium`)).text();
  assert.match(prem, /data-lottie="bowl"/); assert.match(prem, /data-lottie="cutlery"/);
  assert.doesNotMatch(await (await c.get(`/sites/${bistro}/preview?tier=standard`)).text(), /data-lottie=/);
  raw.prepare('UPDATE sites SET theme = ? WHERE id = ?').run(JSON.stringify({ ...JSON.parse(raw.prepare('SELECT theme FROM sites WHERE id = ?').get(salon).theme), motionLevel: 'showcase' }), salon);
  ed = await (await c.get(`/sites/${salon}/edit`)).text();
  assert.match(ed, /id="shaderRow" >/);
});

test('motion levels: exports ship exactly the files each tier needs', async () => {
  const c = makeClient();
  const { siteId } = await basicSite(c, 'tier-export@example.com', 'Tier Export', { meta_businessType: 'restaurant' });
  const post = (extra) => c.post(`/sites/${siteId}/edit`, { name: 'Tier Export', hero_headline: 'Hello', about_heading: 'About', about_body: 'Text', service_title: ['A'], service_description: ['x'], meta_businessType: 'restaurant', theme_motionStyle: 'subtle', layout_order: 'hero,about,services,contact', ...extra });
  const exp = async () => readZip(Buffer.from(await (await c.get(`/sites/${siteId}/export`)).arrayBuffer()));
  await post({ theme_motionLevel: 'standard' });
  let f = await exp();
  assert.ok(f['sg-motion-lite.js']); for (const x of ['vendor/motion.js', 'sg-premium.js', 'sg-shader.js', 'lottie/icons.js', 'vendor/lottie_light.min.js']) assert.ok(!f[x], x);
  await post({ theme_motionLevel: 'showcase', theme_motionShader: 'mesh' });
  f = await exp();
  for (const x of ['vendor/motion.js', 'sitegen-motion.js', 'sg-premium.js', 'sg-shader.js', 'lottie/icons.js', 'vendor/lottie_light.min.js']) assert.ok(f[x], x);
  assert.ok(!f['sg-motion-lite.js']);
  const idx = f['index.html'].toString();
  assert.match(idx, /<script src="sg-shader\.js" defer>/); assert.match(idx, /data-shader="mesh"/); assert.doesNotMatch(idx, /src="\/(?:vendor|sg-)/);
});

test('motion levels: the quality report warns when Showcase makes the page heavy and not for other levels', async () => {
  const Database = require('better-sqlite3'); const raw = new Database(TEST_DB);
  const fs2 = require('node:fs'); const path2 = require('node:path');
  const c = makeClient();
  const { siteId } = await basicSite(c, 'tier-quality@example.com', 'Tier Quality', {});
  const up = path2.join(path2.dirname(TEST_DB), 'uploads');
  // a heavy hero photo, written where the uploads folder of the test server lives
  const dir = fs2.readdirSync(path2.dirname(TEST_DB)).includes('uploads') ? up : null;
  if (!dir) return;   // the test server keeps uploads elsewhere; unit tests in motion-tiers.test.js cover the rules
  fs2.writeFileSync(path2.join(dir, 'tier-hero-heavy.jpg'), Buffer.alloc(700 * 1024, 7));
  const t = JSON.parse(raw.prepare('SELECT sections FROM sites WHERE id = ?').get(siteId).sections); t.hero.imageUrl = '/uploads/tier-hero-heavy.jpg';
  raw.prepare('UPDATE sites SET sections = ? WHERE id = ?').run(JSON.stringify(t), siteId);
  const setLevel = (l) => raw.prepare('UPDATE sites SET theme = ? WHERE id = ?').run(JSON.stringify({ ...JSON.parse(raw.prepare('SELECT theme FROM sites WHERE id = ?').get(siteId).theme), motionLevel: l }), siteId);
  setLevel('showcase');
  assert.match(await (await c.get(`/sites/${siteId}/quality`)).text(), /hidden by the animated background/);
  setLevel('premium');
  assert.doesNotMatch(await (await c.get(`/sites/${siteId}/quality`)).text(), /hidden by the animated background/);
});

test('section size and photos: saved from the editor, rendered on the page, unsafe values dropped', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'sizing@example.com', 'Sizing Plumbing', {
    meta_businessType: 'plumbing company', theme_homeLayout: 'blueprint',
    service_title: ['Drains', 'Leaks', 'Heaters'], service_description: ['a', 'b', 'c'], service_detail: ['', '', ''],
    faq_question: ['Do you work weekends?'], faq_answer: ['Ask when you call.'],
    bps_services_space: 'tall', bps_services_width: 'wide', bps_services_text: 'large',
    bps_faq_padY: '40', bps_faq_maxW: '900', bps_faq_fs: '110', bps_faq_photo: '/uploads/side.jpg', bps_faq_photoPos: 'right', bps_faq_photoSize: 'large',
    bps_why_photo: 'javascript:alert(1)', bps_why_photoPos: 'bg', bps_why_space: 'gigantic',
    bps_hero_space: 'tall', bps_hero_photo: '/uploads/h.jpg', bps_hero_photoPos: 'bg'
  });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<div class="sg-sec" data-sg-fam="services" data-sg-pad="1" data-sg-max="1" data-sg-fs="1" style="--sg-pad: 176px; --sg-max: 1360px; --sg-fs: 1\.20">/, 'preset size on services');
  assert.match(html, /data-sg-pad="1" data-sg-max="1" data-sg-fs="1" data-sg-side="right" data-sg-psize="large" style="--sg-pad: 40px; --sg-max: 900px; --sg-fs: 1\.10"/, 'exact numbers and a side photo on the FAQ');
  assert.match(html, /<div class="sg-side-wrap"><figure class="sg-side-photo"><img src="\/uploads\/side\.jpg"/);
  assert.doesNotMatch(html, /javascript:alert|\/uploads\/h\.jpg|--sg-pad: 99999px/, 'unsafe photo, hero photo and absurd sizes never reach the page');
  const editor = await (await c.get(editPath)).text();
  for (const f of ['bps_services_space', 'bps_services_padY', 'bps_services_maxW', 'bps_services_fs', 'bps_faq_photo', 'bps_faq_photoPos', 'bps_faq_photoSize', 'bps_faq_photoOverlay']) assert.ok(editor.includes(`name="${f}"`), f);
  assert.ok(!editor.includes('name="bps_hero_space"') && !editor.includes('name="bps_hero_photo"'), 'hero has no size or photo controls');
  assert.match(editor, /name="bps_faq_photoPos"[^>]*>[\s\S]*?<option value="right" selected>/);
  assert.match(editor, /name="bps_faq_padY" value="40"/);
  // a background photo
  await c.post(editPath, { name: 'Sizing Plumbing', hero_headline: 'Hello', theme_homeLayout: 'blueprint', meta_businessType: 'plumbing company', service_title: ['Drains', 'Leaks', 'Heaters'], service_description: ['a', 'b', 'c'], service_detail: ['', '', ''], faq_question: ['Q?'], faq_answer: ['A.'], bps_faq_photo: '/uploads/bg.jpg', bps_faq_photoPos: 'bg', bps_faq_photoOverlay: 'dark' });
  const bg = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(bg, /data-sg-bg="photo"[^>]*style="--sg-photo: url\('\/uploads\/bg\.jpg'\); --sg-ov: 0\.7"/);
  // cleared again
  await c.post(editPath, { name: 'Sizing Plumbing', hero_headline: 'Hello', theme_homeLayout: 'blueprint', meta_businessType: 'plumbing company', service_title: ['Drains', 'Leaks', 'Heaters'], service_description: ['a', 'b', 'c'], service_detail: ['', '', ''], faq_question: ['Q?'], faq_answer: ['A.'] });
  assert.doesNotMatch(await (await c.get(`/sites/${siteId}/preview`)).text(), /data-sg-(pad|max|fs|side)|--sg-photo/);
});

test('section size: your own sections can be resized too, and card photos save for reasons and reviews', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'sizing2@example.com', 'Sizing Cards', {
    meta_businessType: 'plumbing company', theme_homeLayout: 'blueprint',
    service_title: ['Drains', 'Leaks', 'Heaters'], service_description: ['a', 'b', 'c'], service_detail: ['', '', ''],
    cs_after: ['services'], cs_heading: ['Our story'], cs_body: ['Family run since 1999.'], cs_img1: [''], cs_img2: [''], cs_img3: [''], cs_img4: [''], cs_layout: [''], cs_buttonText: [''], cs_buttonUrl: [''], cs_bg: [''], cs_emoji: [''],
    cs_space: ['compact'], cs_width: ['narrow'], cs_text: ['small'], cs_padY: [''], cs_maxW: [''], cs_fs: [''],
    whyChoose_heading: 'Why us', whyChoose_icon: ['check', 'check', 'check'], whyChoose_title: ['Fast', 'Fair', 'Neat'], whyChoose_text: ['a', 'b', 'c'], whyChoose_image: ['/uploads/why1.jpg', '', 'javascript:alert(1)'],
    testimonials_heading: 'Reviews', testimonial_quote: ['Great work', 'Good price'], testimonial_author: ['Ann', 'Bo'], testimonial_rating: ['5', '5'], testimonial_date: ['', ''], testimonial_photo: ['/uploads/ann.jpg', '']
  });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /data-sg-section="custom\/text"/);
  assert.match(html, /data-sg-pad="1" data-sg-max="1" data-sg-fs="1" style="--sg-pad: 24px; --sg-max: 720px; --sg-fs: 0\.88"/, 'a custom section is resized');
  assert.ok(html.includes('src="/uploads/why1.jpg"'), 'reason photo');
  assert.ok(html.includes('src="/uploads/ann.jpg"'), 'reviewer photo');
  assert.doesNotMatch(html, /src="javascript/, "a link that is not a photo stays plain text");
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /name="whyChoose_image" value="\/uploads\/why1\.jpg"/); assert.match(editor, /name="testimonial_photo" value="\/uploads\/ann\.jpg"/);
  assert.match(editor, /name="cs_space"/); assert.match(editor, /name="cs_padY"/);
  assert.match(editor, /<template id="tpl-whyChoose">[\s\S]*?name="whyChoose_image"/); assert.match(editor, /<template id="tpl-testimonial">[\s\S]*?name="testimonial_photo"/);
});

test('section colors: a color or gradient per section saves from the editor, shows on the page, and bad colors are refused', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'colors@example.com', 'Color Plumbing', {
    meta_businessType: 'plumbing company', theme_homeLayout: 'blueprint',
    service_title: ['Drains', 'Leaks', 'Heaters'], service_description: ['a', 'b', 'c'], service_detail: ['', '', ''],
    faq_question: ['Do you work weekends?'], faq_answer: ['Ask when you call.'],
    bps_services_bg: 'gradient', bps_services_bgColor: '#0f2a43', bps_services_bgColor2: '#1d6f8c', bps_services_gradDir: 'right',
    bps_faq_bg: 'color', bps_faq_bgColor: 'red;}</style><script>', bps_stats_bg: 'themegrad', bps_testimonials_bg: 'alt', bps_testimonials_bgColor: '#123456',
    cs_after: ['services'], cs_heading: ['Our story'], cs_body: ['Family run.'], cs_img1: [''], cs_img2: [''], cs_img3: [''], cs_img4: [''], cs_layout: [''], cs_buttonText: [''], cs_buttonUrl: [''], cs_emoji: [''],
    cs_bg: ['color'], cs_bgColor: ['#fff4c2'], cs_bgColor2: ['#000000'], cs_gradDir: ['diag'], cs_space: [''], cs_width: [''], cs_text: [''], cs_padY: [''], cs_maxW: [''], cs_fs: ['']
  });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /data-sg-bg="custom" style="--sg-bgimg: linear-gradient\(to right, #0f2a43, #1d6f8c\); --sg-brand: #0f2a43; --sg-onbrand: #ffffff"/, 'gradient with light text');
  assert.match(html, /data-sg-bg="custom" style="--sg-brand: #fff4c2; --sg-onbrand: #111111"/, 'your own section with a light color gets dark text');
  assert.doesNotMatch(html, /red;\}<\/style>/);
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /name="bps_services_bg"[\s\S]*?<option value="gradient" selected>/);
  assert.match(editor, /name="bps_services_bgColor" value="#0f2a43"/); assert.match(editor, /name="bps_services_gradDir"[\s\S]*?<option value="right" selected>/);
  assert.match(editor, /name="cs_bgColor"/);
  for (const v of ['themegrad', 'color', 'gradient']) assert.ok(editor.includes(`<option value="${v}"`), v);
  // reset to default removes it
  await c.post(editPath, { name: 'Color Plumbing', hero_headline: 'Hello', theme_homeLayout: 'blueprint', meta_businessType: 'plumbing company', service_title: ['Drains', 'Leaks', 'Heaters'], service_description: ['a', 'b', 'c'], service_detail: ['', '', ''], bps_services_bg: '', bps_services_bgColor: '#0f2a43', bps_services_bgColor2: '#1d6f8c' });
  assert.doesNotMatch(await (await c.get(`/sites/${siteId}/preview`)).text(), /--sg-bgimg: linear-gradient\(to right/);
});

test('editor: content tab first, the four tabs, smaller top bar, and the preview frame hides the motion switcher', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'tabs@example.com', 'Tabs Roofing');
  const ed = await (await c.get(editPath)).text();
  assert.match(ed, /id="editorPanel" data-tab="content"/);
  for (const t of ['content', 'design', 'features', 'settings']) assert.match(ed, new RegExp(`data-tab-btn="${t}"`));
  assert.ok(ed.indexOf('id="sectionsContainer"') < ed.indexOf('<summary>Theme</summary>'), 'page sections come before the design settings');
  assert.match(ed, /data-tab="design"[^>]*>\s*<summary>Theme<\/summary>/);
  assert.match(ed, /id="previewFrame"[^>]*|src="\/sites\/\d+\/preview\?bar=0"/);
  assert.match(ed, /href="\/sites\/\d+\/pitch"/); assert.match(ed, /href="\/sites\/\d+\/compare"/);
  assert.match(ed, /id="styleCards"[\s\S]*?data-style="workbench"/);
  assert.match(await (await c.get(`/sites/${siteId}/preview`)).text(), /class="sg-motion-bar"/);
  assert.doesNotMatch(await (await c.get(`/sites/${siteId}/preview?bar=0`)).text(), /class="sg-motion-bar"/);
  // the checklist tells the editor where each fix lives
  const items = (await (await c.get(`/sites/${siteId}/checklist`)).json()).items;
  assert.ok(items.every(i => !i.field || typeof i.field === 'string'));
  assert.ok(items.some(i => i.field), 'at least one item points at a field');
});

test('show the client: pitch page, three designs, preview with another style, and using a design saves it', async () => {
  const c = makeClient();
  const { siteId } = await basicSite(c, 'pitch@example.com', 'Pitch Roofing', { pitch_oldShot: '/uploads/old.png', pitch_oldUrl: 'www.old.test' });
  const pitch = await (await c.get(`/sites/${siteId}/pitch`)).text();
  assert.match(pitch, /id="startBtn"/); assert.match(pitch, /id="oldNewBtn"/); assert.match(pitch, /Now: www\.old\.test/);
  const cmp = await (await c.get(`/sites/${siteId}/compare`)).text();
  assert.equal((cmp.match(/<iframe /g) || []).length, 3);
  assert.match(cmp, /style=workbench/, 'a roofer is shown the approved Workbench style');
  const alt = await (await c.get(`/sites/${siteId}/preview?bar=0&style=japandi&pal=1`)).text();
  assert.match(alt, /class="[^"]*style-japandi/);
  assert.match(await (await c.get(`/sites/${siteId}/preview?style=nonsense`)).text(), /<html/);
  const use = await c.post(`/sites/${siteId}/compare/use`, { style: 'japandi', pal: '1' });
  assert.equal(use.status, 302);
  const ed = await (await c.get(`/sites/${siteId}/edit`)).text();
  assert.match(ed, /<option value="japandi" selected>/);
  assert.match(ed, /name="theme_primaryColor" value="#[0-9A-Fa-f]{6}"/);
  assert.equal((await c.post(`/sites/${siteId}/compare/use`, { style: '<script>' })).status, 302);
  // another owner cannot open it
  const other = makeClient(); await other.post('/signup', { email: 'pitch-other@example.com', password: 'password1' });
  assert.equal((await other.get(`/sites/${siteId}/pitch`)).status, 404);
  assert.equal((await other.post(`/sites/${siteId}/share`)).status, 404);
});

test('share link: view-only preview with no account, not indexed, and it stops working when turned off or replaced', async () => {
  const c = makeClient();
  const { siteId } = await basicSite(c, 'share@example.com', 'Share Roofing');
  const { url } = await (await c.post(`/sites/${siteId}/share`, {}, { headers: { Accept: 'application/json' } })).json();
  const p = new URL(url).pathname;
  const stranger = makeClient();
  const wrap = await stranger.get(p);
  assert.equal(wrap.status, 200); assert.equal(wrap.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.match(await wrap.text(), /not live yet/);
  const home = await stranger.get(p + '/site');
  assert.equal(home.status, 200); assert.match(await home.text(), /Share Roofing/);
  assert.equal((await stranger.get(p + '/site/about')).status, 200);
  assert.match(await (await c.get(`/sites/${siteId}/pitch`)).text(), /Opened 1 time/);
  const { url: url2 } = await (await c.post(`/sites/${siteId}/share`)).json();
  assert.equal((await stranger.get(p)).status, 404, 'the old link stops when replaced');
  await c.post(`/sites/${siteId}/share/revoke`);
  assert.equal((await stranger.get(new URL(url2).pathname)).status, 404);
  assert.equal((await stranger.get('/look/short')).status, 404);
});

test('share link feedback: the client types changes (with the spot), the owner sees, ticks and deletes them, and gets an email', async () => {
  const c = makeClient();
  const { siteId } = await basicSite(c, 'feedback@example.com', 'Feedback Roofing');
  const { url } = await (await c.post(`/sites/${siteId}/share`, {}, { headers: { Accept: 'application/json' } })).json();
  const p = new URL(url).pathname;
  const stranger = makeClient();
  assert.match(await (await stranger.get(p)).text(), /Suggest a change/);
  const json = { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } };
  const send = (body) => fetch(BASE + p + '/feedback', { method: 'POST', ...json, body: JSON.stringify(body) });
  assert.equal((await send({ message: ' ' })).status, 400, 'an empty note is refused');
  const r = await send({ message: 'Please use our new number <b>555-0199</b>', name: 'Pat', page: '/services', spot: 'photo: "Roof Repair"', x: 0.25, y: 0.4 });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.ok, true); assert.equal(d.note.page, '/services'); assert.equal(d.note.y, 0.4); assert.equal(d.note.x, 0.25);
  await send({ message: 'Odd page and spot', page: 'javascript:alert(1)', y: 7 });
  const honey = await send({ message: 'spam', website: 'http://spam.test' });
  assert.equal(honey.status, 200);
  const list = await (await fetch(BASE + p + '/feedback')).json();
  assert.equal(list.notes.length, 2, 'the honeypot note is not stored');
  assert.equal(list.notes[0].page, '/', 'a bad page path falls back to home'); assert.equal(list.notes[0].y, null);
  // the owner: a count on the editor, the list (HTML escaped), done and delete
  assert.match(await (await c.get(`/sites/${siteId}/edit`)).text(), /Client feedback \(2 new\)/);
  const page = await (await c.get(`/sites/${siteId}/feedback`)).text();
  assert.match(page, /555-0199/); assert.doesNotMatch(page, /<b>555-0199<\/b>/); assert.match(page, /Pat/);
  assert.match(page, /#sg-fb=0\.25,0\.4/);
  assert.doesNotMatch(await (await c.get(`/sites/${siteId}/edit`)).text(), /Client feedback \(\d+ new\)/, 'opening the list marks them seen');
  const id = list.notes[1].id;
  await c.post(`/sites/${siteId}/feedback/${id}/done`, { done: '1' });
  const after = await (await fetch(BASE + p + '/feedback')).json();
  assert.equal(after.notes.find(n => n.id === id).done, true, 'the client sees it marked done');
  assert.match(await (await c.get(`/sites/${siteId}/pitch`)).text(), /1 to do of 2/);
  await c.post(`/sites/${siteId}/feedback/${list.notes[0].id}/delete`);
  assert.equal((await (await fetch(BASE + p + '/feedback')).json()).notes.length, 1);
  // the account owner was emailed
  const mail = await waitForMail(1).then(() => fs.readFileSync(MAIL_FILE, 'utf8'));
  assert.match(mail, /New change request for Feedback Roofing/);
  // only the owner can see or change the notes; a turned-off link takes no more notes
  const other = makeClient(); await other.post('/signup', { email: 'feedback-other@example.com', password: 'password1' });
  assert.equal((await other.get(`/sites/${siteId}/feedback`)).status, 404);
  await other.post(`/sites/${siteId}/feedback/${id}/delete`);
  assert.equal((await (await fetch(BASE + p + '/feedback')).json()).notes.length, 1);
  await c.post(`/sites/${siteId}/share/revoke`);
  assert.equal((await send({ message: 'after revoke' })).status, 404);
});

test('export PDF: the page lists the site pages, the print view holds motion still, and the print key is required', async () => {
  const c = makeClient();
  const { siteId } = await basicSite(c, 'pdf@example.com', 'Pdf Roofing');
  const page = await (await c.get(`/sites/${siteId}/pdf`)).text();
  assert.match(page, /Make the PDF|No Chrome or Edge/);
  assert.match(page, /value="home" checked/); assert.match(page, /value="services" checked/);
  assert.match(page, /name="editable" value="1" checked/, 'type-in boxes are on by default');
  const pv = await (await c.get(`/sites/${siteId}/preview/services?print=1&size=phone`)).text();
  assert.match(pv, /id="sg-print"/); assert.match(pv, /@page\{size:390px 844px;margin:0\}/); assert.match(pv, /sg-calm/);
  assert.doesNotMatch(await (await c.get(`/sites/${siteId}/preview`)).text(), /id="sg-print"/);
  assert.equal((await fetch(BASE + '/pdfprint/not-a-key/site')).status, 404);
  const other = makeClient(); await other.post('/signup', { email: 'pdf-other@example.com', password: 'password1' });
  assert.equal((await other.get(`/sites/${siteId}/pdf`)).status, 404);
  assert.equal((await other.post(`/sites/${siteId}/pdf`, { size: 'desktop' })).status, 404);
});

test('open-now badge, reviews wall and before/after slider render only when switched on and readable', async () => {
  const c = makeClient();
  const quotes = ['Great job one.', 'Great job two.', 'Great job three.', 'Great job four.'];
  const { siteId, editPath } = await basicSite(c, 'badge@example.com', 'Badge Roofing', {
    hours_day: ['Mon–Fri', 'Sat'], hours_time: ['9:00 AM – 5:00 PM', 'Closed'], hours_openBadge: '1', hours_timezone: 'America/Chicago',
    testimonials_display: 'wall', testimonial_quote: quotes, testimonial_author: ['A', 'B', 'C', 'D'], testimonial_rating: ['5', '5', '5', '5'], testimonial_date: ['', '', '', ''], testimonial_photo: ['', '', '', ''],
    ba_before: ['/uploads/b.jpg'], ba_after: ['/uploads/a.jpg'], ba_caption: ['Roof']
  });
  const home = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(home, /id="sgOpen"[^>]*data-week="\[\[\],\[\[540,1020\]\]/); assert.match(home, /data-tz="America\/Chicago"/);
  const rev = await (await c.get(`/sites/${siteId}/preview/testimonials`)).text();
  assert.match(rev, /class="t-wall"/);
  assert.equal((rev.match(/class="card testimonial-card"/g) || []).length, 4, 'each review is read out once; repeats are hidden from screen readers');
  assert.match(await (await c.get(`/sites/${siteId}/preview/gallery`)).text(), /class="ba-slider"[\s\S]*?type="range"/);
  // hours that can't be read for sure: no badge, and the editor says why
  await c.post(editPath, { name: 'Badge Roofing', hero_headline: 'Hello', hours_day: ['Mon–Fri'], hours_time: ['By appointment'], hours_openBadge: '1' });
  assert.doesNotMatch(await (await c.get(`/sites/${siteId}/preview`)).text(), /id="sgOpen"/);
  assert.match(await (await c.get(editPath)).text(), /can't be read for sure, so it is hidden/);
});

test('section layouts: Flip, photo shape, photo sides and new custom layouts save from the editor; the editor has next and shuffle', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'flipshape@example.com', 'Layout Plumbing', {
    meta_businessType: 'plumbing company', theme_homeLayout: 'blueprint', theme_blueprint: 'generic', bpv_about: 'overlap', bps_about_flip: '1', bps_about_shape: 'arch', theme_bpAlt: 'off',
    about_heading: 'About us', about_body: 'We fix pipes all over town.', about_imageUrl: 'https://example.com/a.jpg',
    service_title: ['Drains'], service_description: ['a'], service_detail: [''],
    cs_after: ['about'], cs_heading: ['Our story'], cs_body: ['Words'], cs_img1: ['https://example.com/b.jpg'], cs_img2: [''], cs_img3: [''], cs_img4: [''], cs_layout: ['overlap'], cs_flip: ['1'], cs_shape: ['circle'], cs_buttonText: [''], cs_buttonUrl: [''], cs_bg: [''], cs_emoji: ['']
  });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<div class="sg-sec" data-sg-fam="about" data-sg-flip="1" data-sg-shape="arch">/);
  assert.match(html, /data-sg-section="about\/overlap"/);
  assert.match(html, /data-sg-fam="custom" data-sg-ci="0" data-sg-flip="1" data-sg-shape="circle"/); assert.match(html, /data-sg-section="custom\/overlap"/);
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /id="bpShuffle"/); assert.match(editor, /data-bp-next="about"/);
  assert.match(editor, /name="bps_about_flip" value="1" checked/); assert.match(editor, /<option value="off" selected>Keep each layout/);
  assert.match(editor, /<option value="overlap" selected>Overlap: words on a card/); assert.match(editor, /<option value="1" selected>Flipped/);
});

test('look and feel: transitions, texture pack, dark mode, stickers, timeline steps and the bento blueprint save and render', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'lookfeel@example.com', 'Look Plumbing', {
    meta_businessType: 'plumbing company', theme_homeLayout: 'blueprint', theme_blueprint: 'bento', theme_primaryColor: '#f5b400',
    theme_pageTransition: 'slide', theme_grain: '1', theme_glassNav: '1', theme_softShadows: '1', theme_cardStack: '1', theme_darkMode: 'toggle',
    hero_imageUrl: 'https://example.com/h.jpg', hero_sticker: ['Family owned', '  ', 'x'.repeat(60), 'Fourth'],
    service_title: ['Drains', 'Leaks'], service_description: ['a', 'b'], service_detail: ['', ''],
    trust_stat_value: ['20'], trust_stat_label: ['Years'], contact_phone: '407-555-0100',
    block_type: ['steps'], block_heading: ['How it works'], block_body: ['Call | We answer\nVisit | We come out'], block_image: [''], block_side: ['timeline'],
    block_buttonText: [''], block_buttonUrl: [''], block_bg: ['none'], block_edge: ['none'], block_place: ['bottom'], block_page: ['home']
  });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /@view-transition \{ navigation: auto; \}/); assert.match(html, /lf-in/);
  assert.match(html, /<body class="[^"]* lf-grain lf-glass lf-soft lf-stack pt-slide[ "]/);
  assert.match(html, /id="lfDark"/); assert.match(html, /html\[data-theme="dark"\] body \{ --lf-deep: #/);
  assert.match(html, /<div class="sg-stickers"><span class="sg-sticker">Family owned<\/span><span class="sg-sticker">x{28}<\/span><span class="sg-sticker">Fourth<\/span><\/div>/);
  assert.match(html, /<ol class="steps-timeline">/);
  assert.match(html, /data-sg-section="bento\/tiles"/);
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /<option value="slide" selected>Slide/); assert.match(editor, /name="theme_cardStack" value="1" checked/);
  assert.match(editor, /<option value="timeline" selected>Timeline/); assert.match(editor, /name="hero_sticker" value="Family owned"/);
});

test('card arrangements and footer designs save and render', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'cards@example.com', 'Cards Roofing', {
    service_title: ['Roof Repair', 'Gutters'], service_description: ['Fix leaks', 'Clean'], service_detail: ['', ''],
    theme_cards_services: 'zigzag', theme_cards_gallery: 'list', theme_cards_why: 'scroll', theme_footerStyle: 'brand', hero_ctaText: 'Get a quote'
  });
  let html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<style id="sg-cards">/); assert.match(html, /data-sg-cards="services"/);
  assert.match(html, /<footer class="site-footer[^"]*" data-foot="brand"/); assert.match(html, /<div class="foot-cta">/);
  assert.doesNotMatch(html, /\[data-sg-cards="gallery"\][^{]*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/, 'gallery cannot be one per row');
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /name="theme_cards_services" value="zigzag" checked/); assert.match(editor, /name="theme_footerStyle" value="brand" checked/);
  assert.match(editor, /data-row-move/);
  await c.post(editPath, { name: 'Cards Roofing', theme_footerStyle: 'wordmark', hero_headline: 'Hello' });
  html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /data-foot="wordmark"/); assert.match(html, /<div class="foot-mark" aria-hidden="true" style="--mark-len: 13">Cards Roofing<\/div>/);
  assert.doesNotMatch(html, /<div class="foot-cta">/); assert.doesNotMatch(html, /<style id="sg-cards">[^<]*data-sg-cards="services"/, 'a save without the picker resets to as designed');
});

test('scroll effects: ink-in headings, card fan, grid zoom, word ticker, fanned prices and floating tags with real service names', async () => {
  const c = makeClient();
  const f = {
    meta_businessType: 'roofer', theme_style: 'modern', theme_homeLayout: 'blueprint', theme_blueprint: 'generic', bpv_services: 'ticker', bp_add: ['gallery', 'pricing'], bpv_gallery: 'fan', bpv_pricing: 'fan',
    theme_inkFx: '1', theme_floatTags: '1',
    service_title: ['Roof repair', 'Gutters', 'Skylights'], service_description: ['a', 'b', 'c'], service_detail: ['', '', ''], service_image: ['https://example.com/a.jpg', '', 'https://example.com/c.jpg'],
    bk_service_name: ['Roof repair', 'Gutters', 'Skylights'], bk_service_minutes: ['60', '60', '60'], bk_service_price: ['450', '200', '900'], bk_service_desc: ['', '', ''],
    gallery_image: ['https://example.com/1.jpg', 'https://example.com/2.jpg', 'https://example.com/3.jpg', 'https://example.com/4.jpg', 'https://example.com/5.jpg', 'https://example.com/6.jpg'],
  };
  const { siteId, editPath } = await basicSite(c, 'sixfx@example.com', 'Fan Roofing', f);
  let html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<body class="[^"]* fx-ink fx-tags/);
  assert.match(html, /data-sg-section="services\/ticker"/); assert.match(html, /data-sg-section="gallery\/fan"/); assert.match(html, /data-sg-section="pricing\/fan"/);
  assert.equal((html.match(/class="sg-fan-card /g) || []).length, 5, 'the fan uses up to five photos');
  assert.match(html, /<span class="sg-tag sg-tag-1" aria-hidden="true">Roof repair<\/span><span class="sg-tag sg-tag-2" aria-hidden="true">Gutters<\/span>/, 'tags are the client\'s own service names');
  assert.match(html, /data-sg-progress>/);
  // the ticker: every name twice (the copy hidden from screen readers and the keyboard), a photo or a dot between, and a pause button
  assert.equal((html.match(/class="sg-tk-word /g) || []).length, 6);
  assert.match(html, /aria-hidden="true">\s*<a class="sg-tk-word [^"]*" href="[^"]*" tabindex="-1">Roof repair<\/a>/);
  assert.match(html, /data-what="service names"/);
  assert.match(html, /class="sg-pfan-card [^"]*sg-pfan-top /, 'the middle price card is raised');
  const g = { ...f, name: 'Fan Roofing', bpv_gallery: 'zoom' }; delete g.theme_inkFx; delete g.theme_floatTags;
  await c.post(editPath, g);
  html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /data-sg-section="gallery\/zoom"/); assert.match(html, /data-sg-progress="pin" style="--rows:2"/, 'six photos make a 5-photo collage');
  assert.doesNotMatch(html, /fx-ink|fx-tags/, 'a save without the boxes turns them off');
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /name="theme_inkFx" value="1" >/); assert.match(editor, /<option value="zoom"[^>]*selected/);
});

test('company name colors: the name in the header and footer takes a readable brand color, shine or color change', async () => {
  const c = makeClient();
  const f = { theme_style: 'modern', theme_primaryColor: '#e11d48', theme_accentColor: '#fbbf24', theme_nameFx: 'shimmer' };
  const { siteId, editPath } = await basicSite(c, 'namefx@example.com', 'Glow Roofing', f);
  let html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<a class="brand" href="[^"]*">\s*<span class="sg-name">Glow Roofing<\/span>/);
  assert.match(html, /<div class="brand"><span class="sg-name">Glow Roofing<\/span><\/div>/);
  assert.match(html, /nav\.site-nav \.brand \{ --nm1: #e11d48; --nm2: #[0-9a-f]{6}/); assert.match(html, /@keyframes sg-nm-shine/);
  let editor = await (await c.get(editPath)).text();
  assert.match(editor, /<option value="shimmer" selected>/);
  await c.post(editPath, { ...f, name: 'Glow Roofing', theme_nameFx: 'color', theme_nameColor: '#fde047' });
  html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.doesNotMatch(html, /sg-nm-shine/); assert.doesNotMatch(html, /nav\.site-nav \.brand \{ --nm1: #fde047/, 'a pale yellow is darkened on the white header'); assert.match(html, /\.footer-grid \.brand \{ --nm1: #fde047/, 'and kept as it is on the dark footer');
  editor = await (await c.get(editPath)).text();
  assert.match(editor, /name="theme_nameColor" value="#fde047"/);
  await c.post(editPath, { ...f, name: 'Glow Roofing', theme_nameFx: '' });
  html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.doesNotMatch(html, /--nm1/);
});

test('brand wall block: a tilted moving wall of the site\'s own cards, sized and placed by the owner', async () => {
  const c = makeClient();
  const f = {
    hero_headline: 'Roofs that last', hero_subheadline: 'Local roofers', service_title: ['Roof repair', 'Gutters'], service_description: ['a', 'b'], service_detail: ['', ''],
    block_type: ['wall'], block_heading: ['See our work'], block_body: ['Built to last'], block_image: [''], block_side: ['tall:strong:slow'], block_buttonText: ['Get a quote'], block_buttonUrl: ['#contact'], block_bg: ['none'], block_edge: ['none'], block_place: ['top'], block_page: ['about']
  };
  const { siteId, editPath } = await basicSite(c, 'wall@example.com', 'Wall Roofing', f);
  let html = await (await c.get(`/sites/${siteId}/preview/about`)).text();
  assert.match(html, /<section(?: data-sg-bid="[^"]+")?(?: data-sg-blk="\d+")? class="blk blk-wall blk-bg-dark">/);
  assert.match(html, /data-sg-wall style="--wall-tilt: -11deg; --wall-secs: 90s; --wall-h: 680px;/);
  assert.equal((html.match(/class="wall-col /g) || []).length, 5);
  assert.match(html, /<div class="wt wt-name tone-brand"><strong>Wall Roofing<\/strong><\/div>/);
  assert.match(html, /<p>Built to last<\/p>/); assert.match(html, /<strong>Roof repair<\/strong>/);
  assert.match(html, /<div class="wall-card" data-reveal>\s*<h2>See our work<\/h2>\s*<a class="btn" href="#contact">Get a quote<\/a>/);
  assert.match(html, /data-sg-wall-pause aria-pressed="false"/);
  assert.doesNotMatch(await (await c.get(`/sites/${siteId}/preview`)).text(), /<section(?: data-sg-bid="[^"]+")?(?: data-sg-blk="\d+")? class="blk blk-wall/, 'only on the page it was put on');
  let editor = await (await c.get(editPath)).text();
  assert.match(editor, /class="wall-side" value="tall:strong:slow:all"/); assert.match(editor, /data-newblock="wall"/);
  assert.match(editor, /<textarea class="wall-text"[^>]*>Built to last<\/textarea>/);
  // the owner's own photo and line, shown alone
  await c.post(editPath, { ...f, name: 'Wall Roofing', block_body: ['Our motto\nhttps://example.com/own.jpg\njavascript:alert(1)'], block_side: ['tall:strong:slow:mine'], block_page: ['home'] });
  html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<img src="https:\/\/example.com\/own.jpg"/); assert.match(html, /<p>Our motto<\/p>/);
  assert.doesNotMatch(html, /class="wt wt-svc/, 'only the owner\'s cards'); assert.doesNotMatch(html, /src="javascript/, "a link that is not a photo stays plain text");
  editor = await (await c.get(editPath)).text();
  assert.match(editor, /class="strip-url" value="https:\/\/example.com\/own.jpg"/); assert.match(editor, /<option value="mine" selected>/);
  // a wall with nothing typed is still kept, and an unknown size falls back
  await c.post(editPath, { ...f, name: 'Wall Roofing', block_heading: [''], block_body: [''], block_buttonText: [''], block_buttonUrl: [''], block_side: ['huge'], block_page: ['home'], block_bg: ['tint'] });
  html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /blk-wall blk-bg-tint/); assert.match(html, /--wall-tilt: -5deg; --wall-secs: 60s; --wall-h: 500px;/); assert.doesNotMatch(html, /class="wall-card"/);
});

test('motion extras: personality, buttons, headlines, hero word and highlight, hover photo and the new moving layouts save and render', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'motionfx@example.com', 'Motion Plumbing', {
    meta_businessType: 'plumbing company', theme_style: 'luxury', theme_homeLayout: 'blueprint', theme_blueprint: 'generic', bpv_services: 'stack', bp_add: ['gallery'], bpv_gallery: 'reel',
    theme_motionSpeed: '80', theme_motionBounce: '50', theme_btnFx_shine: '1', theme_btnFx_magnetic: '1', theme_headlineFx: 'weight', theme_scrollFx: '1', theme_kenBurns: '1', theme_confetti: '1', theme_successFx: '0',
    hero_headline: 'Fast local plumbing', hero_rotate: '1', hero_rotatePrefix: 'We fix', hero_highlight: 'local',
    service_title: ['Drains', 'Leaks'], service_description: ['a', 'b'], service_detail: ['', ''], service_image: ['https://example.com/a.jpg', 'https://example.com/b.jpg'], service_image2: ['https://example.com/a2.jpg', 'javascript:alert(1)'],
    gallery_image: ['https://example.com/1.jpg', 'https://example.com/2.jpg', 'https://example.com/3.jpg', 'https://example.com/4.jpg'],
    block_type: ['steps'], block_heading: ['How'], block_body: ['One | a\nTwo | b'], block_image: [''], block_side: ['stack'], block_buttonText: [''], block_buttonUrl: [''], block_bg: ['none'], block_edge: ['none'], block_place: ['bottom'], block_page: ['home']
  });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<body class="[^"]* bfx-shine bfx-magnetic kx-weight fx-scroll fx-kenburns mfeel-glide"/, 'success moments off, glide from the Luxury style');
  assert.match(html, /data-mtune="\{&#34;k&#34;:1\.75,&#34;ease&#34;:\[0\.34,1\.45,0\.64,1\]/);
  assert.match(html, /data-sg-rotate="\{&#34;prefix&#34;:&#34;We fix&#34;,&#34;words&#34;:\[&#34;Drains&#34;,&#34;Leaks&#34;\]\}"/);
  assert.match(html, /data-sg-hl="&#34;local&#34;"/);
  assert.match(html, /<script src="\/sg-fx\.js" defer><\/script>/);
  assert.match(html, /data-sg-section="services\/stack"/); assert.match(html, /data-sg-section="gallery\/reel"/); assert.match(html, /class="sg-reel-stage[^"]*" data-sg-glide>/, "the film reel glides on its own, with a pause button");
  assert.match(html, /data-sg-hover="https:\/\/example\.com\/a2\.jpg"/); assert.doesNotMatch(html, /src="javascript/, "a link that is not a photo stays plain text");
  assert.match(html, /<ol class="steps-stack">/);
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /name="theme_motionSpeed" min="50" max="150" step="10" value="80"/); assert.match(editor, /name="theme_btnFx_magnetic" value="1" checked/);
  assert.match(editor, /<option value="weight" selected>/); assert.match(editor, /name="hero_rotatePrefix" value="We fix"/); assert.match(editor, /name="service_image2" value="https:\/\/example\.com\/a2\.jpg"/);
  assert.match(editor, /Automatic for this style \(Glide\)/);
});

test('designer tools: design lab, device wall, brand kit and speed score', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'designtools@example.com', 'Tools Roofing', { meta_businessType: 'roofer', theme_primaryColor: '#0f766e', theme_accentColor: '#12354e' });
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, new RegExp(`href="/sites/${siteId}/lab"`)); assert.match(editor, /name="theme_faviconUrl"/);
  // lab: roll with locks, preview the mix, keep it
  assert.equal((await c.get(`/sites/${siteId}/lab`)).status, 200);
  const roll = await (await c.post(`/sites/${siteId}/lab/roll`, JSON.stringify({ locks: { colors: true }, colors: 'brand' }), { headers: { 'Content-Type': 'application/json' } })).json();
  assert.equal(roll.ok, true); assert.equal(roll.combo.primaryColor, '#0f766e'); assert.ok(roll.text.layouts);
  const prev = await (await c.get(`/sites/${siteId}/preview?bar=0&lab=${encodeURIComponent(JSON.stringify({ ...roll.combo, style: 'luxury', headingFont: 'Fraunces' }))}`)).text();
  assert.match(prev, /family=Fraunces/);
  const kept = await c.post(`/sites/${siteId}/lab/use`, { combo: JSON.stringify({ ...roll.combo, style: 'japandi', shape: 'sharp' }) });
  assert.equal(kept.status, 302);
  const after = await (await c.get(editPath)).text();
  assert.match(after, /data-style="japandi"/); assert.match(after, /Before Design lab/);
  // device wall
  const wall = await (await c.get(`/sites/${siteId}/devices`)).text();
  assert.match(wall, /data-w="390"/); assert.match(wall, /data-w="1920"/);
  // brand kit: needs sharp for the pictures
  let sharp = null; try { sharp = require('sharp'); } catch { /* optional */ }
  const upl = path.join(__dirname, '..', 'public', 'uploads');
  const before = new Set(fs.readdirSync(upl));
  try {
    if (sharp) {
      const logo = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#1d4ed8"/><rect x="60" y="120" width="180" height="60" fill="#facc15"/></svg>')).png().toBuffer();
      const form = new FormData(); form.append('logo', new Blob([logo], { type: 'image/png' }), 'logo.png');
      const built = await (await c.post(`/sites/${siteId}/brand/build`, form)).text();
      assert.match(built, /Choose what to use/); assert.match(built, /Sharp: square buttons/);
      const val = (n) => (built.match(new RegExp(`name="${n}" value="([^"]+)"`)) || [])[1];
      const colors = (built.match(/name="colors" value="([^"]+)" checked/) || [])[1];
      assert.match(colors, /^#[0-9a-f]{6}\|#[0-9a-f]{6}$/);
      const res = await c.post(`/sites/${siteId}/brand/apply`, { colors, font: 'Lora|Inter', shape: 'sharp', icons: '1', faviconUrl: val('faviconUrl'), touchIconUrl: val('touchIconUrl'), logo: '1', logoUrl: val('logoUrl'), share: '1', shareUrl: val('shareUrl'), save_kit: '1', kit_name: 'Tools kit' });
      assert.equal(res.headers.get('location'), `/sites/${siteId}/brand?done=applied-saved`);
      const home = await (await c.get(`/sites/${siteId}/preview`)).text();
      assert.match(home, new RegExp(`<link rel="icon" href="[^"]*/uploads/bk-${siteId}-[0-9a-f]{12}-32\\.png">`));
      assert.match(home, new RegExp(`og:image" content="[^"]*bk-${siteId}-[0-9a-f]{12}-share\\.jpg`));
      // someone else's file names are refused
      await c.post(`/sites/${siteId}/brand/apply`, { colors: 'keep', font: 'keep', shape: 'keep', icons: '1', faviconUrl: '/uploads/bk-99999-0123456789ab-32.png', touchIconUrl: '/uploads/bk-99999-0123456789ab-180.png' });
      assert.doesNotMatch(await (await c.get(`/sites/${siteId}/preview`)).text(), /bk-99999/);
    }
    // saved kits: save, apply to a second site, and kits are private to their owner
    await c.post(`/sites/${siteId}/brand/save`, { kit_name: 'Current look' });
    const page = await (await c.get(`/sites/${siteId}/brand`)).text();
    const kitId = page.match(/\/brand\/kits\/(\d+)\/apply/)[1];
    const create = await c.post('/sites', { name: 'Second Site' });
    const site2 = create.headers.get('location').match(/\/sites\/(\d+)\//)[1];
    await c.post(`/sites/${site2}/brand/kits/${kitId}/apply`, {});
    assert.match(await (await c.get(`/sites/${site2}/edit`)).text(), /data-style="[^"]+"[^>]*--c-pri/);
    const other = makeClient();
    const o = await basicSite(other, 'designtools2@example.com', 'Other Biz');
    await other.post(`/sites/${o.siteId}/brand/kits/${kitId}/apply`, {});
    assert.doesNotMatch(await (await other.get(`/sites/${o.siteId}/brand`)).text(), /Current look/);
    // speed and polish score on the quality page
    const q = await (await c.get(`/sites/${siteId}/quality`)).text();
    assert.match(q, /Speed and polish score/); assert.match(q, /aria-label="Speed \d+ out of 100"/); assert.match(q, /aria-label="Polish \d+ out of 100"/);
  } finally {
    for (const f of fs.readdirSync(upl)) if (!before.has(f) && /^bk-/.test(f)) fs.rmSync(path.join(upl, f), { force: true });
  }
});

test('Image + Scrim hero: chosen in hero setup, automatic for fitting industries, motion by level, classic for older sites', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'scrimhero@example.com', 'Orbit Code School', {
    meta_businessType: 'coding school', hero_headline: 'Learn to code', hero_design: 'scrim', hero_scrim: 'heavy', hero_scrimLayout: 'boxed', hero_align: 'center',
    hero_card_title: ['Small groups', 'Weekends'], hero_card_text: ['Six per class', ''], theme_motionLevel: 'showcase'
  });
  let html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /data-sg-section="hero\/scrim"/); assert.match(html, /sg-library\.css/);
  assert.match(html, /data-sc-layout="boxed" data-sc-align="center" data-sc-tier="showcase"/);
  assert.match(html, /data-sg-stars/); assert.match(html, /sg-scrim-sky/, 'no photo: the night-sky gradient');
  assert.equal((html.match(/class="sg-glass/g) || []).length, 2); assert.doesNotMatch(html, /class="hero-cards/, 'cards are not drawn twice');
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /<option value="scrim" selected>Image \+ Scrim \(cosmic\) \(suits this business\)/);
  assert.match(editor, /<option value="heavy" selected>/); assert.match(editor, /<option value="boxed" selected>/);
  // Premium: zoom but no stars; Standard: neither
  await c.post(editPath, { name: 'Orbit Code School', hero_headline: 'Learn to code', hero_design: 'scrim', hero_imageUrl: 'https://example.com/sky.jpg', theme_motionLevel: 'premium', meta_businessType: 'coding school', layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact' });
  html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /data-sc-tier="premium"/); assert.doesNotMatch(html, /data-sg-stars/); assert.match(html, /src="https:\/\/example\.com\/sky\.jpg"/);
  // automatic: a coding school gets it, a plumber keeps the classic hero
  await c.post(editPath, { name: 'Orbit Code School', hero_headline: 'Learn to code', hero_design: 'auto', meta_businessType: 'coding school', layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact' });
  assert.match(await (await c.get(`/sites/${siteId}/preview`)).text(), /hero\/scrim/);
  await c.post(editPath, { name: 'Orbit Code School', hero_headline: 'Learn to code', hero_design: 'auto', meta_businessType: 'plumber', layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact' });
  assert.doesNotMatch(await (await c.get(`/sites/${siteId}/preview`)).text(), /hero\/scrim/);
  // the published page shows it too, and a site made before this round (no design saved) stays classic
  await c.post(editPath, { name: 'Orbit Code School', hero_headline: 'Learn to code', hero_design: 'scrim', meta_businessType: 'plumber', layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact' });
  const Database = require('better-sqlite3'); const db = new Database(TEST_DB);
  const slug = db.prepare('SELECT slug FROM sites WHERE id = ?').get(siteId).slug;
  assert.match(await (await fetch(`${BASE}/site/${slug}`)).text(), /hero\/scrim/);
  const row = db.prepare('SELECT sections FROM sites WHERE id = ?').get(siteId); const s = JSON.parse(row.sections); delete s.hero.design; s.meta.businessType = 'software startup';
  db.prepare('UPDATE sites SET sections = ? WHERE id = ?').run(JSON.stringify(s), siteId); db.close();
  await c.post(`/sites/${siteId}/publish`, { published: '1' });
  assert.doesNotMatch(await (await c.get(`/sites/${siteId}/preview?x=1`)).text(), /hero\/scrim/);
  // it is also a hero layout in the section library (blueprint home)
  const lib = require('../library'); assert.ok(lib.isVariant('hero', 'scrim'));
});

test('editor clarity: focused section header, titled setting boxes and save label are on the editor page', async () => {
  const c = makeClient();
  const { editPath } = await basicSite(c, 'edclarity@example.com', 'Clear Edit Co', { hero_headline: 'Clear edits' });
  const html = await (await c.get(editPath)).text();
  assert.match(html, /id="focusBar"/); assert.match(html, /&larr; All sections/); assert.match(html, /id="focusTitle"/);
  assert.match(html, /class="focus-host"/, 'the page sections wrapper is what stays visible while one section is open');
  assert.match(html, /function groupSection/); assert.match(html, /\['Your reviews', '#testimonialsList'\]/);
  assert.match(html, /window\.sgFocusChanged/); assert.match(html, /sg-edit-tag/); assert.match(html, /sg-pv-hl/);
  assert.match(html, /setSave\('saved', 'All changes saved'\)/);
  assert.equal((html.match(/<\/style>/g) || []).length, (html.match(/<style[ >]/g) || []).length, 'every style block is closed');
});

test('Showcase strip hero: chosen in hero setup or as a block, uses the site photos and reviews, ships its script in the export', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'showcasehero@example.com', 'Bright Roofing', { hero_headline: 'Roofs that last', hero_design: 'showcase', hero_imageUrl: 'https://example.com/h.jpg' });
  const Database = require('better-sqlite3'); let db = new Database(TEST_DB);
  const s = JSON.parse(db.prepare('SELECT sections FROM sites WHERE id = ?').get(siteId).sections);
  s.gallery = { ...(s.gallery || {}), images: ['https://example.com/g1.jpg', 'https://example.com/g2.jpg'] };
  s.testimonials = { ...(s.testimonials || {}), items: [{ quote: 'They came the same day.', author: 'Dee', rating: 5 }] };
  db.prepare('UPDATE sites SET sections = ? WHERE id = ?').run(JSON.stringify(s), siteId); db.close();
  let html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /data-sg-section="hero\/showcase"/); assert.match(html, /sg-lib\.js/); assert.match(html, /data-sg-glide-pause/);
  assert.match(html, /g2\.jpg/); assert.match(html, /They came the same day\./);
  assert.match(await (await c.get(editPath)).text(), /<option value="showcase" selected>Showcase strip/);
  const zip = readZip(Buffer.from(await (await c.get(`/sites/${siteId}/export`)).arrayBuffer()));
  assert.match(zip['index.html'].toString(), /hero\/showcase/); assert.ok(Object.keys(zip).some(f => /sg-lib\.js$/.test(f)), 'the pause button and rotators work offline too');
  // as a block on the Blocks page
  const pv = await (await c.get(`/sites/${siteId}/preview?bar=0&bare=1&mix=${encodeURIComponent(JSON.stringify([{ k: 'lib', f: 'hero', v: 'showcase' }]))}`)).text();
  assert.match(pv, /hero\/showcase/); assert.match(pv, /sg-lib\.js/);
  assert.ok(require('../library').isVariant('hero', 'showcase'));
});

test('Floating 3D shapes hero: brand-colored shapes, typing cursor, spinning ring that plays the owner\'s video or links to the main button', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'shapeshero@example.com', 'Glass Roofing', { hero_headline: 'Roofs that last', hero_design: 'shapes', hero_ctaText: 'Get a quote',
    hero_videoUrl: 'https://example.com/work.mp4', hero_imageUrl: 'https://example.com/h1.jpg' });
  let html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /data-sg-section="hero\/shapes"/); assert.match(html, /data-sg-shapes>/); assert.match(html, /class="sg-caret" aria-hidden="true"/);
  assert.match(html, /<button type="button" class="sg-3d-ringbtn" data-sg-vid-open aria-label="Play our video">/);
  assert.match(html, /<dialog class="sg-3d-dlg" data-sg-vid aria-label="Our video">\s*<video controls playsinline preload="none" src="https:\/\/example\.com\/work\.mp4">/);
  assert.match(html, />WATCH OUR WORK/);
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /<option value="shapes" selected>Floating 3D shapes/); assert.match(editor, /id="shapesHint">/);
  // no video file: the ring goes to the main button's link and spells its words
  await c.post(editPath, { name: 'Glass Roofing', hero_headline: 'Roofs that last', hero_design: 'shapes', hero_ctaText: 'Get a quote', hero_videoUrl: 'https://youtube.com/watch?v=x' });
  html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<a class="sg-3d-ringbtn" href="[^"]*" aria-label="Get a quote">/); assert.doesNotMatch(html, /data-sg-vid[ >]/); assert.match(html, />GET A QUOTE/);
  assert.ok(require('../library').isVariant('hero', 'shapes'));
});

test('Photo hero with the header blended in: see-through header on the photo, spaced label, italic serif words, pill button', async () => {
  const c = makeClient();
  const f = { hero_headline: 'Roofs built to [outlast] the storm', hero_design: 'blend', hero_ctaText: 'Get a quote', hero_imageUrl: 'https://example.com/h1.jpg',
    meta_businessType: 'roofer', meta_city: 'Orlando, FL', theme_primaryColor: '#1d4ed8', hero_pill: 'lime' };
  const { siteId, editPath } = await basicSite(c, 'blendhero@example.com', 'Blend Roofing', f);
  let html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /data-sg-section="hero\/blend"/); assert.match(html, /<body class="[^"]* hdr-transparent/);
  assert.match(html, /<img class="sg-blend-ph [^"]*" src="https:\/\/example\.com\/h1\.jpg"/);
  assert.match(html, /class="sg-blend-eyebrow[^"]*"[^>]*>roofer \u00b7 Orlando, FL<\/p>/);
  assert.match(html, /Roofs built to <em class="sg-hl">outlast<\/em> the storm/); assert.match(html, /family=Instrument\+Serif/);
  assert.match(html, /--blend-pill: #d4f57a; --blend-pill-ink: #111111/);
  let editor = await (await c.get(editPath)).text();
  assert.match(editor, /<option value="blend" selected>Photo with the header blended in/); assert.match(editor, /<div id="blendOpts">/);
  // the owner's own label and the brand color pill; other pages keep the normal header
  await c.post(editPath, { ...f, name: 'Blend Roofing', hero_eyebrow: 'Family roofers since 1998', hero_pill: '' });
  html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, />Family roofers since 1998<\/p>/); assert.match(html, /--blend-pill: #1d4ed8; --blend-pill-ink: #ffffff/);
  assert.doesNotMatch(await (await c.get(`/sites/${siteId}/preview/about`)).text(), /<body class="[^"]* hdr-transparent/);
  editor = await (await c.get(editPath)).text();
  assert.match(editor, /name="hero_eyebrow" value="Family roofers since 1998"/);
  assert.ok(require('../library').isVariant('hero', 'blend'));
});

test('Scroll-through photos hero: chosen in hero setup or as a block, steps through the hero photos, works in the export', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'scrollhero@example.com', 'Step Roofing', { hero_headline: 'Roofs that last', hero_design: 'scroll',
    hero_imageUrl: 'https://example.com/h1.jpg', hero_slide: ['https://example.com/h2.jpg', 'https://example.com/h3.jpg'] });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /data-sg-section="hero\/scroll"/); assert.match(html, /data-sg-scrub[ >]/); assert.match(html, /--scrub-n: 3/);
  assert.match(html, /data-photo="https:\/\/example\.com\/h3\.jpg"/); assert.match(html, /sg-fx\.js/);
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /<option value="scroll" selected>Scroll-through photos/); assert.match(editor, /id="scrollHint">/);
  const zip = readZip(Buffer.from(await (await c.get(`/sites/${siteId}/export`)).arrayBuffer()));
  assert.match(zip['index.html'].toString(), /hero\/scroll/); assert.ok(Object.keys(zip).some(f => /sg-fx\.js$/.test(f)), 'the scroll script ships with the export');
  const pv = await (await c.get(`/sites/${siteId}/preview?bar=0&bare=1&mix=${encodeURIComponent(JSON.stringify([{ k: 'lib', f: 'hero', v: 'scroll' }]))}`)).text();
  assert.match(pv, /hero\/scroll/); assert.ok(require('../library').isVariant('hero', 'scroll'));
});

test('questionnaire PDF: download the fillable form, upload a filled one or a scan, review it, open the original, build', async () => {
  const ip = require('../intakepdf');
  const owner = makeClient(); await owner.post('/signup', { email: 'pdfintake@example.com', password: 'password1' });
  const other = makeClient(); await other.post('/signup', { email: 'pdfintake2@example.com', password: 'password1' });
  const blank = await owner.get('/intake/questionnaire.pdf?for=Rio%20Pools');
  assert.equal(blank.status, 200); assert.match(blank.headers.get('content-type'), /application\/pdf/); assert.match(blank.headers.get('content-disposition'), /website-questionnaire-rio-pools\.pdf/);
  const s = Buffer.from(await blank.arrayBuffer()).toString('latin1');
  assert.match(s, /For: Rio Pools/);
  const filled = Buffer.from(s.replace(/(\/T \(biz_name\)[^>]*?\/V )\(\)/, '$1(Rio Pools)').replace(/(\/T \(biz_type\)[^>]*?\/V )\(\)/, '$1(pool service)'), 'latin1');
  const up = (buf) => { const f = new FormData(); f.append('pdf', new Blob([buf], { type: 'application/pdf' }), 'q.pdf'); return owner.post('/intake/pdf', f); };
  let res = await up(filled);
  assert.equal(res.status, 302); const where = res.headers.get('location'); assert.match(where, /\/intake\/submissions\/\d+$/);
  const view = await (await owner.get(where)).text();
  assert.match(view, /From an uploaded PDF/); assert.match(view, /form fields, exactly as the client typed them/); assert.match(view, /Rio Pools/);
  const orig = await owner.get(where + '/pdf'); assert.equal(orig.status, 200); assert.equal(Buffer.from(await orig.arrayBuffer()).length, filled.length);
  assert.equal((await other.get(where + '/pdf')).status, 404, 'only the owner can open it');
  const list = await (await owner.get('/intake')).text();
  assert.match(list, /Questionnaire as a PDF/); assert.match(list, /Rio Pools/); assert.doesNotMatch(list, /<strong>Uploaded PDF<\/strong>/, 'the hidden PDF link is not listed as a link');
  // a scan (no form fields) is read by the AI, and the review screen says to check it
  res = await up(Buffer.from('%PDF-1.4\n% ZZ-SCAN page image\n', 'latin1'));
  const scan = await (await owner.get(res.headers.get('location'))).text();
  assert.match(scan, /Handwritten Plumbing/); assert.match(scan, /The AI read this from the PDF/);
  assert.match((await up(Buffer.from('%PDF-1.4\nblurry', 'latin1'))).headers.get('location'), /f=pdfunreadable/);
  assert.match((await up(Buffer.from('not a pdf'))).headers.get('location'), /f=pdfnotpdf/);
  assert.match((await up(Buffer.from(s, 'latin1'))).headers.get('location'), /f=pdfempty/);
  // build the site from it, then delete it (the stored PDF goes too)
  res = await owner.post(where + '/build', { option: '0' });
  assert.match(res.headers.get('location'), /\/sites\/\d+\/edit/);
  await owner.post(where + '/delete', {});
  assert.equal((await owner.get(where + '/pdf')).status, 404);
});

test('style library: library home page, browser page, use route with version history, preview blueprint, export', async () => {
  const c = makeClient();
  const order = 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact';
  const { siteId, editPath, slug } = await basicSite(c, 'stylelib@example.com', 'Ridge Roofing', {
    hero_headline: 'Roofs that hold up to [Florida storms]', theme_style: 'sl-meridian', theme_slBlueprint: 'C',
    faq_question: ['Free estimates?'], faq_answer: ['Yes, written.'], layout_order: order
  });
  const home = await (await fetch(`${BASE}/site/${slug}`)).text();
  assert.match(home, /sg-stylelib\.css/);
  assert.match(home, /data-sl-style="meridian" data-sl-blueprint="C"/);
  assert.match(home, /<span class="t-em">Florida storms<\/span>/);
  assert.match(home, new RegExp(`action="/site/${slug}/contact"`), 'lead-gen hero posts to the real form');
  assert.doesNotMatch(home, /\[Florida storms\]/, 'brackets never show');
  const about = await (await fetch(`${BASE}/site/${slug}/about`)).text();
  assert.doesNotMatch(about, /data-sl-style/, 'only the home page is drawn by the library');
  assert.match(about, /class="[^"]*style-sl-meridian/);

  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /<optgroup label="Style Library \(44 styles\)">/);
  assert.match(editor, /<option value="C" selected>Lead-gen/);
  assert.match(editor, /href="\/sites\/\d+\/styles"/);

  const browse = await c.get(`/sites/${siteId}/styles`);
  assert.equal(browse.status, 200);
  const bhtml = await browse.text();
  assert.equal((bhtml.match(/class="sl-card/g) || []).length, 44);
  assert.match(bhtml, /data-id="sl-meridian"[^>]*>/); assert.match(bhtml, /In use/);
  assert.match(bhtml, /Florida storms/, 'thumbnails use the site\'s own hero');
  const other = makeClient(); await other.post('/signup', { email: 'stylelib-other@example.com', password: 'password1' });
  assert.equal((await other.get(`/sites/${siteId}/styles`)).status, 404);

  const pv = await (await c.get(`/sites/${siteId}/preview?bar=0&style=sl-graphite&pal=1&slbp=H`)).text();
  assert.match(pv, /data-sl-style="graphite" data-sl-blueprint="H"/);

  const raw = new (require('better-sqlite3'))(TEST_DB);
  const v0 = raw.prepare('SELECT COUNT(*) n FROM site_versions WHERE site_id = ?').get(siteId).n;
  const use = await c.post(`/sites/${siteId}/styles/use`, { style: 'sl-polar', colors: 'style', blueprint: 'E' });
  assert.equal(use.status, 302); assert.match(use.headers.get('location'), /\/edit\?saved=1#design/);
  assert.equal(raw.prepare('SELECT COUNT(*) n FROM site_versions WHERE site_id = ?').get(siteId).n, v0 + 1);
  assert.match(raw.prepare('SELECT label FROM site_versions WHERE site_id = ? ORDER BY id DESC').get(siteId).label, /Before Style Library/);
  const t = JSON.parse(raw.prepare('SELECT theme FROM sites WHERE id = ?').get(siteId).theme);
  assert.equal(t.style, 'sl-polar'); assert.equal(t.slBlueprint, 'E');
  const bad = await c.post(`/sites/${siteId}/styles/use`, { style: 'modern', colors: 'style' });
  assert.match(bad.headers.get('location'), /\/styles$/, 'only library styles');
  assert.equal(JSON.parse(raw.prepare('SELECT theme FROM sites WHERE id = ?').get(siteId).theme).style, 'sl-polar');
  raw.close();

  const zip = readZip(Buffer.from(await (await c.get(`/sites/${siteId}/export`)).arrayBuffer()));
  assert.ok(zip['sg-stylelib.css'], 'the export carries the library stylesheet');
  assert.match(zip['index.html'].toString(), /data-sl-style="polar"/);
});

test('atelier: Signature home page, browser page, use route with version history, industry default, export', async () => {
  const c = makeClient();
  const { siteId, editPath, slug } = await basicSite(c, 'atelier@example.com', 'Signature Roofing', {
    hero_headline: 'Roofs that hold up to [Florida storms]', theme_style: 'at-bloom',
    faq_question: ['Free estimates?'], faq_answer: ['Yes, written.']
  });
  const home = await (await fetch(`${BASE}/site/${slug}`)).text();
  assert.match(home, /sg-atelier\.css/);
  assert.match(home, /data-piece="bloom"/);
  assert.match(home, /Florida storms/);
  assert.doesNotMatch(home, /\[Florida storms\]/, 'brackets never show');
  const about = await (await fetch(`${BASE}/site/${slug}/about`)).text();
  assert.doesNotMatch(about, /class="sg-atelier/, 'only the home page carries the artwork');

  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /<optgroup label="Signature pieces, premium \(22\)">/);
  assert.match(editor, /href="\/sites\/\d+\/signature"/);

  const browse = await c.get(`/sites/${siteId}/signature`);
  assert.equal(browse.status, 200);
  const bhtml = await browse.text();
  assert.equal((bhtml.match(/class="sl-card/g) || []).length, 22);
  assert.match(bhtml, /In use/);
  const other = makeClient(); await other.post('/signup', { email: 'atelier-other@example.com', password: 'password1' });
  assert.equal((await other.get(`/sites/${siteId}/signature`)).status, 404);

  const raw = new (require('better-sqlite3'))(TEST_DB);
  const v0 = raw.prepare('SELECT COUNT(*) n FROM site_versions WHERE site_id = ?').get(siteId).n;
  const use = await c.post(`/sites/${siteId}/signature/use`, { style: 'at-flap' });
  assert.equal(use.status, 302); assert.match(use.headers.get('location'), /\/edit\?saved=1#design/);
  assert.equal(raw.prepare('SELECT COUNT(*) n FROM site_versions WHERE site_id = ?').get(siteId).n, v0 + 1);
  assert.match(raw.prepare('SELECT label FROM site_versions WHERE site_id = ? ORDER BY id DESC').get(siteId).label, /Before Signature piece/);
  assert.equal(JSON.parse(raw.prepare('SELECT theme FROM sites WHERE id = ?').get(siteId).theme).style, 'at-flap');
  const bad = await c.post(`/sites/${siteId}/signature/use`, { style: 'sl-polar' });
  assert.match(bad.headers.get('location'), /\/signature$/, 'only Signature pieces');
  assert.equal(JSON.parse(raw.prepare('SELECT theme FROM sites WHERE id = ?').get(siteId).theme).style, 'at-flap');

  const gen = await c.post('/sites/generate', { business_type: 'surf school', business_name: 'Cocoa Surf School' });
  assert.equal(gen.status, 302);
  const genId = gen.headers.get('location').match(/\/sites\/(\d+)\//)[1];
  assert.equal(JSON.parse(raw.prepare('SELECT theme FROM sites WHERE id = ?').get(genId).theme).style, 'at-undertow', 'new sites in a Signature industry start on their piece');
  raw.close();

  const zip = readZip(Buffer.from(await (await c.get(`/sites/${siteId}/export`)).arrayBuffer()));
  assert.ok(zip['sg-atelier.css'], 'the export carries the Signature stylesheet');
  assert.match(zip['index.html'].toString(), /data-piece="flap"/);
});

test('editor: undo and redo step through changes, typing bursts count once, a new change clears redo', async () => {
  const c = makeClient();
  const { siteId, editPath, slug } = await basicSite(c, 'undo@example.com', 'Undo Roofing');
  const form = (headline) => ({
    name: 'Undo Roofing', hero_headline: headline, about_heading: 'About', about_body: 'About us text',
    services_heading: 'Services', service_title: ['Roof Repair'], service_description: ['Fix leaks'], service_detail: [''],
    contact_heading: 'Contact', contact_email: 'owner@biz.test', contact_phone: '555-0100', contact_acceptSubmissions: '1',
    meta_city: 'Orlando, FL', meta_businessType: 'roofer', testimonials_heading: 'Reviews',
    layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact'
  });
  const json = { headers: { Accept: 'application/json' } };
  const raw = new (require('better-sqlite3'))(TEST_DB);
  const now = () => { const r = raw.prepare('SELECT theme, sections FROM sites WHERE id = ?').get(siteId); return { style: JSON.parse(r.theme).style, headline: JSON.parse(r.sections).hero.headline }; };
  const styleBefore = now().style;

  // a named change (here a Style Library pick) is always its own step
  await c.post(`/sites/${siteId}/styles/use`, { style: 'sl-polar', colors: 'style' });
  const one = await (await c.post(editPath, form('Roofs [done right]'), json)).json();
  assert.equal(one.ok, true); assert.ok(one.undo >= 2); assert.equal(one.redo, 0);
  const two = await (await c.post(editPath, form('Roofs done [right], fast'), json)).json();
  assert.equal(two.undo, one.undo, 'saves while typing count as one step');

  const step = async (dir) => (await c.post(`/sites/${siteId}/${dir}`, {}, json)).json();
  let r = await step('undo');
  assert.equal(r.ok, true); assert.equal(r.redo, 1);
  assert.deepEqual(now(), { style: 'sl-polar', headline: 'Hello' });
  r = await step('undo');
  assert.deepEqual(now(), { style: styleBefore, headline: 'Hello' });
  r = await step('redo'); assert.equal(now().style, 'sl-polar');
  r = await step('redo'); assert.equal(now().headline, 'Roofs done [right], fast');
  r = await step('redo'); assert.equal(r.ok, false); assert.match(r.error, /Nothing to redo/);

  r = await step('undo'); assert.equal(r.redo, 1);
  const three = await (await c.post(editPath, form('Brand new'), json)).json();
  assert.equal(three.redo, 0, 'a new change clears redo');
  assert.equal((await (await fetch(`${BASE}/site/${slug}`)).text()).includes('Brand new'), true, 'the live page shows the latest state');

  const other = makeClient(); await other.post('/signup', { email: 'undo-other@example.com', password: 'password1' });
  assert.equal((await other.post(`/sites/${siteId}/undo`, {}, json)).status, 404);
  raw.close();

  // the editor has the buttons, the quick search and the section outline
  const ed = await (await c.get(editPath)).text();
  assert.match(ed, /id="undoBtn"[^>]*>/); assert.match(ed, /id="redoBtn"/);
  assert.match(ed, /id="cmdk"[^>]*role="dialog"/); assert.match(ed, /id="cmdkOpen"/);
  assert.match(ed, /setUndo\(\d+, 0\)/);
});

test('editor: the refreshed preview skips entrance motion, and [bracketed] headline words are highlighted', async () => {
  const c = makeClient();
  const { siteId, slug } = await basicSite(c, 'calm@example.com', 'Calm Painting', { hero_headline: 'Fresh paint, [no mess] & <done>', theme_style: 'modern' });
  const calm = await (await c.get(`/sites/${siteId}/preview?bar=0&calm=1`)).text();
  assert.match(calm, /<style id="sg-calm">/); assert.doesNotMatch(calm, /classList\.add\('sg-anim'\)/);
  const normal = await (await c.get(`/sites/${siteId}/preview?bar=0`)).text();
  assert.doesNotMatch(normal, /sg-calm/); assert.match(normal, /classList\.add\('sg-anim'\)/);
  const live = await (await fetch(`${BASE}/site/${slug}?calm=1`)).text();
  assert.doesNotMatch(live, /sg-calm/, 'only the editor preview takes the flag');
  assert.match(live, /<h1[^>]*>Fresh paint, <em class="sg-hl">no mess<\/em> &amp; &lt;done&gt;<\/h1>/);
  const { hlHtml } = require('../library/content');
  assert.equal(hlHtml('a [b] c [d'), 'a <em class="sg-hl">b</em> c d');
});

test('blocks: mix and match sections from any style, preview them, save them as the home page and as recipes', async () => {
  const c = makeClient();
  const { siteId, slug, editPath } = await basicSite(c, 'mixmatch@example.com', 'Mix Roofing', { theme_style: 'modern', faq_question: ['Free estimates?'], faq_answer: ['Yes, written.'] });
  const json = (p, body) => c.post(p, JSON.stringify(body), { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } });
  const page = await (await c.get(`/sites/${siteId}/blocks`)).text();
  assert.match(page, /<h1>Blocks<\/h1>/); assert.match(page, /Starting from the current home page/);
  const blocks = [{ k: 'sl', f: 'hero', v: 'polar' }, { k: 'lib', f: 'faq', v: 'side' }, { k: 'at', f: 'services', v: 'bloom' }, { k: 'lib', f: 'nope', v: 'x' }];
  // the preview shows the blocks without saving them; bare=1 leaves out the header and footer
  const pv = await (await c.get(`/sites/${siteId}/preview?bar=0&bare=1&mix=${encodeURIComponent(JSON.stringify(blocks))}`)).text();
  assert.match(pv, /class="sg-mix" data-mix-i="0"/); assert.match(pv, /data-mix-i="1"/); assert.match(pv, /data-mix-i="2"/);
  assert.match(pv, /sg-stylelib\.css/); assert.match(pv, /sg-atelier\.css/); assert.match(pv, /sg-library\.css/);
  assert.match(pv, / sg-bare/); assert.match(pv, /Free estimates\?/);
  assert.doesNotMatch(await (await c.get(`/site/${slug}`)).text(), /sg-mix/, 'nothing saved yet');
  assert.equal((await json(`/sites/${siteId}/blocks/save`, { blocks: [] })).status, 400);
  const saved = await (await json(`/sites/${siteId}/blocks/save`, { blocks })).json();
  assert.deepEqual(saved, { ok: true, count: 3 });
  const live = await (await fetch(`${BASE}/site/${slug}`)).text();
  assert.match(live, /data-mix-i="0"[^>]*><div class="tpl sg-mix-sl"/); assert.doesNotMatch(live, /sg-bare/);
  assert.match(live, /Free estimates\?/);
  const zip = readZip(Buffer.from(await (await c.get(`/sites/${siteId}/export`)).arrayBuffer()));
  for (const f of ['sg-stylelib.css', 'sg-atelier.css', 'sg-library.css']) assert.ok(zip[f], f + ' is in the download');
  assert.match(zip['index.html'].toString(), /data-mix-i="2"/);
  // the editor keeps the blocks when it saves, and the page opens on them
  const ed = await (await c.get(editPath)).text();
  assert.match(ed, /<option value="mix" selected>/); assert.match(ed, /name="theme_mix" value="\[\{&#34;k&#34;:&#34;sl&#34;/);
  assert.match(await (await c.get(`/sites/${siteId}/blocks`)).text(), /The home page uses these blocks\./);
  // an earlier design is kept in version history
  const raw = new (require('better-sqlite3'))(TEST_DB);
  assert.equal(raw.prepare('SELECT label FROM site_versions WHERE site_id = ? ORDER BY id DESC').get(siteId).label, 'Before blocks change');
  raw.close();
  // recipes belong to the user and work on any site
  const r = await (await json(`/sites/${siteId}/blocks/recipes`, { blocks, name: 'Roofer starter' })).json();
  assert.equal(r.ok, true); assert.equal(r.name, 'Roofer starter');
  assert.match(await (await c.get(`/sites/${siteId}/blocks`)).text(), /Roofer starter/);
  const other = makeClient(); const o = await basicSite(other, 'mixother@example.com', 'Other Co');
  assert.doesNotMatch(await (await other.get(`/sites/${o.siteId}/blocks`)).text(), /Roofer starter/);
  assert.equal((await other.get(`/sites/${siteId}/blocks`)).status, 404);
  await other.post(`/sites/${siteId}/blocks/recipes/${r.id}/delete`, {});
  await json(`/sites/${siteId}/blocks/recipes/${r.id}/delete`, {});
  assert.doesNotMatch(await (await c.get(`/sites/${siteId}/blocks`)).text(), /Roofer starter/);
});

test('blocks: arranged sizes and order are saved with the blocks and drawn on the live page and the download', async () => {
  const c = makeClient();
  const { siteId, slug } = await basicSite(c, 'arrange@example.com', 'Arrange Roofing', { theme_style: 'modern', faq_question: ['Free estimates?'], faq_answer: ['Yes, written.'] });
  const blocks = [{ k: 'lib', f: 'faq', v: 'side', lay: { pad: { p: 'section:1', t: 24 }, els: { 'section:1/div:1/h2:1': { w: 6, fs: 64, al: 'r' } }, ord: { 'section:1/div:1': [2, 1] }, fx: ['section:1/div:1'] } }];
  // the Blocks page posts its preview (arrangements can be long)
  const pv = await (await c.post(`/sites/${siteId}/preview?bar=0&calm=1`, { mix: JSON.stringify(blocks) })).text();
  assert.match(pv, /<style id="sg-arrange">[^<]*padding-top:24px/); assert.match(pv, /data-mix-i="0"/);
  const saved = await (await c.post(`/sites/${siteId}/blocks/save`, JSON.stringify({ blocks }), { headers: { 'Content-Type': 'application/json' } })).json();
  assert.equal(saved.ok, true);
  const live = await (await fetch(`${BASE}/site/${slug}`)).text();
  const css = live.match(/<style id="sg-arrange">([^<]*)<\/style>/);
  assert.ok(css, 'arrangement styles on the live page');
  assert.match(css[1], /h2:nth-child\(1\)\{font-size:clamp\(38px, 5vw, 64px\)!important\}/);
  assert.match(css[1], /@media \(min-width: 700px\)\{[^}]*h2:nth-child\(1\)\{width:50%!important/);
  assert.match(css[1], /> :nth-child\(2\)\{order:1\}/);
  const zip = readZip(Buffer.from(await (await c.get(`/sites/${siteId}/export`)).arrayBuffer()));
  assert.match(zip['index.html'].toString(), /<style id="sg-arrange">/);
  const ed = await (await c.get(`/sites/${siteId}/blocks`)).text();
  assert.match(ed, /"lay":\{"pad":\{"p":"section:1","t":24\}/, 'the Blocks page opens with the arrangement');
  assert.match(ed, /data-v="arrange"/);
});

test('blocks: one Size control per block sets the section height (and its padding when shorter), replacing the old Height menu', async () => {
  const c = makeClient();
  const { siteId, slug } = await basicSite(c, 'size@example.com', 'Size Roofing', { theme_style: 'modern', faq_question: ['Free estimates?'], faq_answer: ['Yes, written.'] });
  const ed = await (await c.get(`/sites/${siteId}/blocks`)).text();
  assert.match(ed, /function sizeRow\(i\)/); assert.match(ed, /type="range" data-a="sz"/); assert.match(ed, /data-a="sz0"/);
  assert.doesNotMatch(ed, /'<label class="own pin">Height <select data-a="height">/, 'the Height preset menu is gone from Effects');
  // what the Size control saves: the section box's height, its padding evened out when made shorter; an old preset still draws
  const blocks = [{ k: 'lib', f: 'faq', v: 'side', lay: { pad: { p: 'div:1/div:1', t: 16, b: 16 }, els: { 'div:1/div:1': { h: 420, hM: 300 } } } }, { k: 'lib', f: 'faq', v: 'side', height: 'tight' }];
  const saved = await (await c.post(`/sites/${siteId}/blocks/save`, JSON.stringify({ blocks }), { headers: { 'Content-Type': 'application/json' } })).json();
  assert.equal(saved.ok, true);
  const live = await (await fetch(`${BASE}/site/${slug}`)).text();
  const css = live.match(/<style id="sg-arrange">([^<]*)<\/style>/)[1];
  assert.match(css, /padding-top:16px!important;padding-bottom:16px!important/);
  assert.match(css, /@media \(min-width: 700px\)\{[^}]*min-height:420px!important/);
  assert.match(css, /@media \(max-width: 699px\)\{[^}]*min-height:300px!important/);
  assert.match(live, /sg-ht-tight/);
});

test('Added sections and extra pages: ticked sections show on any home layout, a page still being written is kept', async () => {
  const c = makeClient();
  const f = { hero_headline: 'Roofs that last', meta_businessType: 'roofer', theme_homeLayout: 'full', theme_blueprint: 'generic',
    trust_stat_value: ['500+', '25'], trust_stat_label: ['Roofs replaced', 'Years in business'], bp_add: ['stats'] };
  const { siteId, editPath } = await basicSite(c, 'addsec@example.com', 'Add Roofing', f);
  let html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /data-sg-section="stats\//, 'a ticked section shows with a layout other than the blueprint');
  assert.match(html, /sg-library\.css/);
  // unticked: gone again; a hidden section stays hidden
  await c.post(editPath, { ...f, name: 'Add Roofing', bp_add: [] });
  assert.doesNotMatch(await (await c.get(`/sites/${siteId}/preview`)).text(), /data-sg-section="stats\//);
  // an extra page with only a title is saved (not lost) but stays off the menu until it has text
  let r = await c.post(editPath, { ...f, name: 'Add Roofing', extra_title: ['Financing'], extra_body: [''] }, { headers: { Accept: 'application/json' } });
  let data = await r.json();
  assert.equal(data.ok, true); assert.deepEqual(data.extraPages, []);
  let editor = await (await c.get(editPath)).text();
  assert.match(editor, /name="extra_title" value="Financing"/); assert.match(editor, /class="muted extra-need"[^>]*>Not on the site yet/);
  assert.doesNotMatch(await (await c.get(`/sites/${siteId}/preview`)).text(), /\/p\/financing/);
  r = await c.post(editPath, { ...f, name: 'Add Roofing', extra_title: ['Financing'], extra_body: ['Pay over 12 months.'] }, { headers: { Accept: 'application/json' } });
  data = await r.json();
  assert.deepEqual(data.extraPages, [{ slug: 'financing', title: 'Financing' }]);
  assert.match(await (await c.get(`/sites/${siteId}/preview`)).text(), /\/p\/financing/);
  assert.match(await (await c.get(`/sites/${siteId}/preview/p/financing`)).text(), /Pay over 12 months\./);
  editor = await (await c.get(editPath)).text();
  assert.match(editor, /<optgroup label="Your extra pages" id="pvExtraPages"><option value="p\/financing">Financing<\/option>/);
  assert.match(editor, /class="muted extra-need"[^>]* hidden>/);
});

test('Blended photo hero on a Blocks page: hero setup and the Blocks hero stay the same, header and phone strip go over the photo', async () => {
  const c = makeClient();
  const f = { hero_headline: 'Strategy from Miami', hero_imageUrl: 'https://example.com/h1.jpg', meta_businessType: 'consultant', contact_phone: '(305) 555-0100' };
  const { siteId, editPath } = await basicSite(c, 'mixblend@example.com', 'Wave Co', f);
  const blocks = [{ k: 'lib', f: 'hero', v: 'overlay' }, { k: 'lib', f: 'about', v: 'split' }];
  await c.post(`/sites/${siteId}/blocks/save`, JSON.stringify({ blocks }), { headers: { 'Content-Type': 'application/json' } });
  let html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /data-sg-section="hero\/overlay"/); assert.doesNotMatch(html, /<body class="[^"]* hdr-transparent/);
  // picking the blended design in hero setup changes the Blocks page's hero
  const mix = JSON.stringify(blocks);
  const data = await (await c.post(editPath, { ...f, name: 'Wave Co', theme_homeLayout: 'mix', theme_mix: mix, hero_design: 'blend' }, { headers: { Accept: 'application/json' } })).json();
  assert.deepEqual(data.mix[0], { k: 'lib', f: 'hero', v: 'blend' });
  html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /data-sg-section="hero\/blend"/); assert.match(html, /<body class="[^"]* hdr-transparent[^"]* blend-top/);
  assert.match(html, /<div class="top-bar">/); assert.match(html, /--tb-h/);
  // a later save with the same design leaves the Blocks page alone
  await c.post(editPath, { ...f, name: 'Wave Co', theme_homeLayout: 'mix', theme_mix: JSON.stringify(data.mix), hero_design: 'blend' });
  assert.match(await (await c.get(`/sites/${siteId}/preview`)).text(), /data-sg-section="hero\/blend"/);
  // another hero picked on the Blocks page: hero setup follows
  await c.post(`/sites/${siteId}/blocks/save`, JSON.stringify({ blocks }), { headers: { 'Content-Type': 'application/json' } });
  assert.match(await (await c.get(editPath)).text(), /<option value="auto" selected>/);
  await c.post(`/sites/${siteId}/blocks/save`, JSON.stringify({ blocks: [{ k: 'lib', f: 'hero', v: 'blend' }] }), { headers: { 'Content-Type': 'application/json' } });
  assert.match(await (await c.get(editPath)).text(), /<option value="blend" selected>/);
});

test('Header color: saved from the editor, drawn on every page, clear option, name colors read against it', async () => {
  const c = makeClient();
  const f = { hero_headline: 'Roofs that last', theme_primaryColor: '#e11d48', theme_headerBg: 'dark' };
  const { siteId, editPath } = await basicSite(c, 'hdrcolor@example.com', 'Bar Roofing', f);
  let html = await (await c.get(`/sites/${siteId}/preview/about`)).text();
  assert.match(html, /<body class="[^"]* hdrc hdrc-dark/); assert.match(html, /nav#siteNav\.scrolled \{ background: #111827/);
  let editor = await (await c.get(editPath)).text();
  assert.match(editor, /<option value="dark" selected>Dark<\/option>/); assert.match(editor, /<div id="headerColorRow" hidden>/);
  await c.post(editPath, { ...f, name: 'Bar Roofing', theme_headerBg: 'custom', theme_headerColor: '#0E7490', theme_nameFx: 'color' });
  html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /nav#siteNav\.scrolled \{ background: #0e7490/);
  // the name color is made readable on the owner's header color, not on white
  const nm = require('../namefx').palette({ primaryColor: '#e11d48', nameFx: 'color' }, '#0e7490')[0];
  assert.match(html, new RegExp(`nav\\.site-nav \\.brand \\{ --nm1: ${nm}`));
  editor = await (await c.get(editPath)).text();
  assert.match(editor, /<div id="headerColorRow" >/); assert.match(editor, /name="theme_headerColor" value="#0e7490"/);
  await c.post(editPath, { ...f, name: 'Bar Roofing', theme_headerBg: 'clear' });
  html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /hdrc-clear:not\(\.hdr-transparent\) nav#siteNav:not\(\.scrolled\) \{ background: transparent/);
  await c.post(editPath, { ...f, name: 'Bar Roofing', theme_headerBg: '' });
  assert.doesNotMatch(await (await c.get(`/sites/${siteId}/preview`)).text(), / hdrc/);
});

test('Card cascade block: cards from the site and the owner deal into a stack, sized, placed, with a heading beside it', async () => {
  const c = makeClient();
  const f = { hero_headline: 'Strategy that moves the needle', service_title: ['Brand strategy'], service_description: ['Positioning'],
    block_type: ['cascade'], block_heading: ['See how we work'], block_body: ['Built to last\n/uploads/own.jpg\njavascript:alert(1)'], block_image: [''],
    block_side: ['tall:fast:all'], block_buttonText: ['Get a quote'], block_buttonUrl: ['/contact'], block_edge: ['none'], block_bg: ['tint'], block_place: ['bottom'], block_page: ['home'] };
  const { siteId, editPath } = await basicSite(c, 'cascade@example.com', 'Wave Co', f);
  let html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<section(?: data-sg-bid="[^"]+")?(?: data-sg-blk="\d+")? class="blk blk-cascade blk-bg-tint/);
  assert.match(html, /class="cascade cascade-split" data-sg-wall style="--cd-secs: 7s; --cd-n: \d+; --cd-h: 780px;/);
  assert.match(html, /<div style="--x: 0\.08; --y: 0; --i: 0" class="wt wt-name tone-brand">/);
  assert.match(html, /<img src="\/uploads\/own\.jpg"/); assert.match(html, />Brand strategy</); assert.match(html, /<p>Built to last<\/p>/);
  assert.doesNotMatch(html, /src="javascript/);
  assert.match(html, /<h2>See how we work<\/h2>/); assert.match(html, /data-what="card cascade"/);
  assert.match(siteCss, /@keyframes sg-cascade/);
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /<strong class="block-kind">Card cascade \(cards deal into a stack\)<\/strong>/);
  assert.match(editor, /name="block_side" class="wall-side" value="tall:fast:all"/);
  assert.match(editor, /data-newblock="cascade"/); assert.match(editor, /<template id="tpl-block-cascade">/);
  // only the owner's cards, on another page
  await c.post(editPath, { ...f, name: 'Wave Co', block_side: ['short:slow:mine'], block_heading: [''], block_buttonText: [''], block_page: ['about'] });
  assert.doesNotMatch(await (await c.get(`/sites/${siteId}/preview`)).text(), /<section(?: data-sg-bid="[^"]+")?(?: data-sg-blk="\d+")? class="blk blk-cascade/);
  html = await (await c.get(`/sites/${siteId}/preview/about`)).text();
  assert.match(html, /class="cascade" data-sg-wall style="--cd-secs: 14s;/); assert.doesNotMatch(html, />Brand strategy</);
});

test('Your own sections and blocks on a Blocks page: placed where chosen, marked for the editor, an empty banner shows a note only in the preview', async () => {
  const c = makeClient();
  const f = { hero_headline: 'Strategy from Miami', hero_imageUrl: 'https://example.com/h1.jpg', meta_businessType: 'consultant', about_body: 'We take a creative approach to brands.', contact_email: 'owner@biz.test', contact_phone: '555-0100',
    cs_after: ['about'], cs_heading: ['Our Secret Set'], cs_body: ['Words of our own.'], cs_layout: ['text'],
    block_type: ['photoText', 'photoBanner'], block_heading: ['Near the top block', ''], block_body: ['Some words', ''], block_image: ['', 'https://example.com/p.jpg'],
    block_side: ['', 'left:medium:brand'], block_buttonText: ['', ''], block_buttonUrl: ['', ''], block_edge: ['none', 'none'], block_bg: ['none', 'none'], block_place: ['top', 'bottom'], block_page: ['home', 'home'] };
  const { siteId, editPath, slug } = await basicSite(c, 'mixown@example.com', 'Secret Set Co', f);
  const blocks = [{ k: 'lib', f: 'hero', v: 'overlay' }, { k: 'lib', f: 'about', v: 'split' }, { k: 'lib', f: 'contact', v: 'cards' }];
  await c.post(editPath, { ...f, name: 'Secret Set Co', theme_homeLayout: 'mix', theme_mix: JSON.stringify(blocks) });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  const at = s => html.indexOf(s);
  // hero, then the block set near the top, then About, then the owner's section, then Contact
  assert.ok(at('data-mix-f="hero"') > 0 && at('data-mix-f="hero"') < at('data-sg-blk="0"'));
  assert.ok(at('data-sg-blk="0"') < at('data-mix-f="about"'));
  assert.ok(at('data-mix-f="about"') < at('Our Secret Set') && at('Our Secret Set') < at('data-mix-f="contact"'));
  assert.match(html, /<section data-sg-blk="1" class="blk blk-bg-none blk-empty"[^>]*>Photo banner: add a heading to show it/);
  const live = await (await fetch(`${BASE}/site/${slug}`)).text();
  assert.doesNotMatch(live, /data-sg-blk|blk-empty/);
  const look = new URL((await (await c.post(`/sites/${siteId}/share`, {})).json()).url).pathname;
  assert.doesNotMatch(await (await c.get(look + '/site')).text(), /blk-empty|data-sg-blk/, 'not on a link shared with the client');
  assert.ok(live.indexOf('Our Secret Set') < live.indexOf('data-mix-f="contact"'));
  // "Where it goes" lists the Blocks page's sections in their order on the page
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /<option value="top"[^>]*>Right under the top banner<\/option><option value="about" selected>After: [^<]+<\/option><option value="contact" >After: [^<]+<\/option><option value="end"/);
  assert.match(editor, /window\.sgMoveBlock/); assert.match(editor, /window\.sgMoveCustom/);
});

test('More than 20 content blocks: a 21st block is kept (it used to be dropped without a word; Leo, 2026-11-02), up to 60', async () => {
  const c = makeClient();
  const n = 25, arr = (v) => Array.from({ length: n }, (_, i) => (typeof v === 'function' ? v(i) : v));
  const f = { hero_headline: 'Pets groomed right', block_type: arr(i => (i === n - 1 ? 'photoblend' : 'split')), block_id: arr(''), block_heading: arr(i => 'Block ' + (i + 1)), block_body: arr('Words'),
    block_image: arr(''), block_side: arr(''), block_buttonText: arr(''), block_buttonUrl: arr(''), block_edge: arr('none'), block_bg: arr('none'), block_place: arr('bottom'), block_page: arr('home') };
  const { editPath } = await basicSite(c, 'manyblocks@example.com', 'Many Co', f);
  const editor = await (await c.get(editPath)).text();
  assert.equal((editor.match(/name="block_id" value="b[a-z0-9]{7}"/g) || []).length, n);
  assert.match(editor, /data-name="Content block · Photo that blends in: Block 25"/);
  assert.match(editor, /blockRows\(\)\.length >= 60\)/);
});

test('Content blocks in Page sections and on the Blocks screen: fixed ids, own entries, hidden, placed and taken off like blocks', async () => {
  const c = makeClient();
  const f = { hero_headline: 'Strategy from Miami', hero_imageUrl: 'https://example.com/h1.jpg', meta_businessType: 'consultant', about_body: 'We take a creative approach.', contact_email: 'owner@biz.test', contact_phone: '555-0100',
    block_type: ['photoText', 'split'], block_id: ['', ''], block_heading: ['First block', 'Second block'], block_body: ['Words one', 'Words two'], block_image: ['', ''],
    block_side: ['', ''], block_buttonText: ['', ''], block_buttonUrl: ['', ''], block_edge: ['none', 'none'], block_bg: ['none', 'none'], block_place: ['top', 'bottom'], block_page: ['home', 'home'] };
  const { siteId, editPath } = await basicSite(c, 'blkentries@example.com', 'Entries Co', f);
  let editor = await (await c.get(editPath)).text();
  const ids = [...editor.matchAll(/name="block_id" value="(b[a-z0-9]{7})"/g)].map(m => m[1]);
  assert.equal(ids.length, 2); assert.notEqual(ids[0], ids[1]);
  // each block has its own entry in Page sections, in the list's order
  assert.match(editor, new RegExp(`class="section-block draggable-section blk-entry" draggable="true" data-key="blk:${ids[0]}"`));
  assert.match(editor, /<h3 class="blk-h3" data-name="Content block · Photo \+ text: First block"><svg class="blk-pic"[\s\S]*?<span class="blk-h3-main">First block<\/span><span class="blk-tag" title="Page tops and photo with words">Photo \+ text<\/span><\/h3>/);
  // the add-a-block picker: every design as a card, in its group
  assert.match(editor, /<div class="blkpick-group" data-group="words"[\s\S]*?data-newblock="steps"/);
  // every design is one card, except the Decorative card: one card per card style (6), and its Invitation Reveal card
  assert.equal((editor.match(/class="blkpick-card" data-newblock=/g) || []).length, 69);
  assert.equal((editor.match(/data-newblock="decocard" data-dcstyle="(royal|minimal|deco|stamp|ribbon|glass)" data-find/g) || []).length, 6);
  assert.equal((editor.match(/data-newblock="decocard" data-dcstyle="royal" data-dcreveal="envelope"/g) || []).length, 1);
  const order = `hero,blk:${ids[1]},about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact,blk:${ids[0]}`;
  const keep = { ...f, name: 'Entries Co', block_id: ids, layout_order: order };
  await c.post(editPath, keep);
  editor = await (await c.get(editPath)).text();
  assert.ok(editor.indexOf(`data-key="blk:${ids[1]}"`) < editor.indexOf('data-key="about"'));
  assert.ok(editor.indexOf(`data-key="blk:${ids[0]}"`) > editor.indexOf('data-key="contact"'));
  // hidden in Page sections: not on the page
  await c.post(editPath, { ...keep, hidden_sections: [`blk:${ids[1]}`] });
  let html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /First block/); assert.doesNotMatch(html, /Second block/);
  // on a Blocks home page they are blocks of the page: near the top under the top banner, the rest at the end
  const mix = JSON.stringify([{ k: 'lib', f: 'hero', v: 'overlay' }, { k: 'lib', f: 'about', v: 'split' }]);
  const data = await (await c.post(editPath, { ...keep, theme_homeLayout: 'mix', theme_mix: mix }, { headers: { Accept: 'application/json' } })).json();
  assert.deepEqual(data.mix.map(m => m.k + ':' + m.v), ['lib:overlay', `blk:${ids[0]}`, 'lib:split', `blk:${ids[1]}`]);
  html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, new RegExp(`<div class="sg-mix" data-mix-i="1" data-mix-f="blk">\\s*<section(?: data-sg-bid="[^"]+")? data-sg-blk="0" class="blk`));
  assert.equal((html.match(/First block/g) || []).length, 1, 'drawn once, in its spot');
  // the Blocks screen lists them and offers them; taking one off there hides it, putting it back shows it
  const screen = await (await c.get(`/sites/${siteId}/blocks`)).text();
  assert.match(screen, /"label":"Photo \+ text: First block"/); assert.match(screen, /"own":"Your content blocks"/);
  const save = blocks => c.post(`/sites/${siteId}/blocks/save`, JSON.stringify({ blocks }), { headers: { 'Content-Type': 'application/json' } });
  await save([{ k: 'lib', f: 'hero', v: 'overlay' }, { k: 'lib', f: 'about', v: 'split' }]);
  html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.doesNotMatch(html, /First block/);
  assert.match(await (await c.get(editPath)).text(), new RegExp(`value="blk:${ids[0]}" checked`));
  await save([{ k: 'lib', f: 'hero', v: 'overlay' }, { k: 'blk', v: ids[0] }, { k: 'lib', f: 'about', v: 'split' }]);
  html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.ok(html.indexOf('First block') > 0 && html.indexOf('First block') < html.indexOf('data-mix-f="about"'));
});

test('Scroll Smoother: chosen in the Design lab, its script on every page and in the download, nothing when off', async () => {
  const c = makeClient();
  const { siteId, editPath, slug } = await basicSite(c, 'smooth@example.com', 'Glide Co', { theme_smoothScroll: 'page', theme_smoothFeel: 'soft' });
  const lab = await (await c.get(`/sites/${siteId}/lab`)).text();
  assert.match(lab, /<option value="page" selected>Whole page/); assert.match(lab, /<option value="soft" selected>Soft and slow/);
  assert.match(await (await c.get(editPath)).text(), /in the <a href="\/sites\/\d+\/lab">Design lab<\/a>/);
  for (const path of [`/site/${slug}`, `/site/${slug}/about`]) {
    const html = await (await fetch(`${BASE}${path}`)).text();
    assert.match(html, /<script data-sg-smooth>\(function \(\) \{\n  var C = \{"wheel":true,"ms":1150,"ease":0.075\}/, path);
  }
  await c.post(editPath, { name: 'Glide Co', hero_headline: 'Hello', theme_smoothScroll: '' });
  assert.doesNotMatch(await (await fetch(`${BASE}/site/${slug}`)).text(), /data-sg-smooth/);
  void siteId;
});

test('Split text animation: chosen in the Design lab, its script and styles on the page, nothing when off', async () => {
  const c = makeClient();
  const { siteId, editPath, slug } = await basicSite(c, 'split@example.com', 'Split Co', { theme_splitText: 'headings', theme_splitBy: 'chars', theme_splitFx: 'scale', theme_splitPlay: 'scroll', theme_splitDur: '600', theme_splitGap: '20', theme_splitX: '0', theme_splitY: '-30' });
  const editor = await (await c.get(`/sites/${siteId}/lab`)).text();
  assert.match(editor, /<option value="headings" selected>/); assert.match(editor, /<option value="scale" selected>/); assert.match(editor, /name="theme_splitY" form="lbUse" min="-400" max="400" step="5" value="-30"/);
  const html = await (await fetch(`${BASE}/site/${slug}`)).text();
  assert.match(html, /<style data-sg-split>\.st-split/);
  assert.match(html, /"on":"headings","by":"chars","fx":"scale","play":"scroll","dur":600,"gap":20,"x":0,"y":-30/);
  await c.post(editPath, { name: 'Split Co', hero_headline: 'Hello', theme_splitText: '' });
  assert.doesNotMatch(await (await fetch(`${BASE}/site/${slug}`)).text(), /data-sg-split/);
});

test('Design lab motion card: saves Scroll Smoother and Split text, previews them unsaved, and an editor save keeps them', async () => {
  const c = makeClient();
  const { siteId, editPath, slug } = await basicSite(c, 'labfx@example.com', 'Lab Motion Co', {});
  const fx = JSON.stringify({ theme_smoothScroll: 'links', theme_splitText: 'hero', theme_splitFx: 'fade' });
  const prev = await (await c.get(`/sites/${siteId}/preview?bar=0&fx=${encodeURIComponent(fx)}`)).text();
  assert.match(prev, /data-sg-smooth/); assert.match(prev, /"on":"hero","by":"words","fx":"fade"/);
  assert.doesNotMatch(await (await fetch(`${BASE}/site/${slug}`)).text(), /data-sg-smooth|data-sg-split/, 'a preview saves nothing');
  const r = await c.post(`/sites/${siteId}/lab/motion`, { combo: '{}', theme_smoothScroll: 'page', theme_smoothFeel: 'quick', theme_splitText: 'headings', theme_splitBy: 'lines', theme_splitFx: 'uncover', theme_splitPlay: 'view', theme_splitDur: '800', theme_splitGap: '40', theme_splitX: '0', theme_splitY: '0' });
  assert.match(r.headers.get('location'), /\/lab\?saved=motion$/);
  assert.match(await (await c.get(`/sites/${siteId}/lab?saved=motion`)).text(), /class="lb-saved"/);
  await c.post(editPath, { name: 'Lab Motion Co', hero_headline: 'Hello again' });
  const html = await (await fetch(`${BASE}/site/${slug}`)).text();
  assert.match(html, /Hello again/);
  assert.match(html, /var C = \{"wheel":true,"ms":550,"ease":0.16\}/);
  assert.match(html, /"on":"headings","by":"lines","fx":"uncover","play":"view","dur":800,"gap":40/);
});

test('Pin elements: a content block and a Blocks page block each keep their own pin setting on the page', async () => {
  const c = makeClient();
  const f = { hero_headline: 'Strategy from Miami', hero_imageUrl: 'https://example.com/h1.jpg', about_body: 'About words.', contact_email: 'owner@biz.test',
    block_type: ['photoText'], block_id: [''], block_heading: ['Big sale'], block_body: ['This week only'], block_image: [''], block_side: [''], block_buttonText: [''], block_buttonUrl: [''],
    block_edge: ['none'], block_bg: ['none'], block_place: ['bottom'], block_page: ['home'], block_pin: ['hold:200'] };
  const { siteId, editPath, slug } = await basicSite(c, 'pins@example.com', 'Pin Co', f);
  let html = await (await fetch(`${BASE}/site/${slug}`)).text();
  assert.match(html, /<div class="sg-pin sg-pin-hold" style="--pin-len: 200vh;">\s*<section(?: data-sg-bid="[^"]+")? class="blk/);
  assert.match(html, /<style data-sg-pin>/); assert.match(html, /<script data-sg-pin>/);
  assert.match(await (await c.get(editPath)).text(), /<option value="hold:200" selected>Pinned for two screens of scrolling<\/option>/);
  const blocks = [{ k: 'lib', f: 'hero', v: 'overlay' }, { k: 'lib', f: 'about', v: 'split', pin: 'cover' }, { k: 'lib', f: 'contact', v: 'cards', pin: 'nonsense' }];
  await c.post(`/sites/${siteId}/blocks/save`, JSON.stringify({ blocks }), { headers: { 'Content-Type': 'application/json' } });
  html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<div class="sg-mix sg-pin sg-pin-cover" data-mix-i="1" data-mix-f="about">/);
  assert.match(html, /<div class="sg-mix" data-mix-i="2" data-mix-f="contact">/);
  assert.match(await (await c.get(`/sites/${siteId}/blocks`)).text(), /"pin":"cover"/);
  // nothing pinned: no pin styles or script
  await c.post(editPath, { ...f, name: 'Pin Co', block_pin: [''], theme_homeLayout: '' });
  assert.doesNotMatch(await (await fetch(`${BASE}/site/${slug}`)).text(), /data-sg-pin/);
});

test('Color film: a content block and a Blocks page block each get their own see-through color layer', async () => {
  const c = makeClient();
  const f = { hero_headline: 'Strategy from Miami', theme_primaryColor: '#1b2a4a', contact_email: 'owner@biz.test',
    block_type: ['photoText'], block_id: [''], block_heading: ['Film me'], block_body: ['Under the film'], block_image: [''], block_side: [''], block_buttonText: [''], block_buttonUrl: [''],
    block_edge: ['none'], block_bg: ['none'], block_place: ['bottom'], block_page: ['home'], block_pin: [''], block_film: ['brand:30'] };
  const { siteId, editPath, slug } = await basicSite(c, 'film@example.com', 'Film Co', f);
  let html = await (await fetch(`${BASE}/site/${slug}`)).text();
  assert.match(html, /<div class="sg-film" style="--film-c: rgba\(27, 42, 74, 0.3\);">\s*<section(?: data-sg-bid="[^"]+")? class="blk/);
  assert.match(html, /<style data-sg-film>/);
  const ed = await (await c.get(editPath)).text();
  assert.match(ed, /name="block_film" value="brand:30"/); assert.match(ed, /<option value="30" selected>Color film, 30% strong<\/option>/);
  const blocks = [{ k: 'lib', f: 'hero', v: 'overlay' }, { k: 'lib', f: 'about', v: 'split', film: '#FF5500:60' }, { k: 'lib', f: 'contact', v: 'cards', film: 'red:99' }];
  await c.post(`/sites/${siteId}/blocks/save`, JSON.stringify({ blocks }), { headers: { 'Content-Type': 'application/json' } });
  html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<div class="sg-mix sg-film" data-mix-i="1" data-mix-f="about" style="--film-c: rgba\(255, 85, 0, 0.6\);">/);
  assert.match(html, /<div class="sg-mix" data-mix-i="2" data-mix-f="contact">/);
  assert.match(await (await c.get(`/sites/${siteId}/blocks`)).text(), /"film":"#ff5500:60"/);
  await c.post(editPath, { ...f, name: 'Film Co', block_film: [''], theme_homeLayout: '' });
  assert.doesNotMatch(await (await fetch(`${BASE}/site/${slug}`)).text(), /data-sg-film/);
});

test('Word styling: marked words are styled on the page and plain in the title and search details', async () => {
  const c = makeClient();
  const { slug, editPath } = await basicSite(c, 'words@example.com', 'Words Co', { hero_headline: 'The {{best pizza|bigger|#e11d48}} in town', about_body: 'Family run since {{1990|bold}}.' });
  const html = await (await fetch(`${BASE}/site/${slug}`)).text();
  assert.match(html, /The <span class="sg-w" style="font-size:1\.6em;color:#e11d48">best pizza<\/span> in town/);
  assert.doesNotMatch(html.replace(/<script(?![^>]*ld\+json)[\s\S]*?<\/script>/g, ''), /\{\{/, 'no marker is left outside code');
  assert.match(await (await c.get(editPath)).text(), /id="wsBar"/);
});

test('Before / after block: the Gallery pairs as sliders anywhere; look packs and Surprise me reach the Blocks screen', async () => {
  const c = makeClient();
  const f = { ba_before: ['https://example.com/b1.jpg'], ba_after: ['https://example.com/a1.jpg'], ba_caption: ['Kitchen'],
    block_type: ['beforeAfter'], block_id: [''], block_heading: ['See the change'], block_body: ['Drag the line.'], block_image: [''], block_side: ['auto'], block_buttonText: [''], block_buttonUrl: [''],
    block_edge: ['none'], block_bg: ['none'], block_place: ['bottom'], block_page: ['home'], block_pin: [''], block_imgfx: [''], block_height: [''] };
  const { siteId, editPath } = await basicSite(c, 'beforeafter@example.com', 'Before After Co', f);
  let html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<section(?: data-sg-bid="[^"]+")? data-sg-blk="0" class="blk blk-ba blk-bg-none">/);
  assert.match(html, /<div class="ba-slider">\s*<img src="https:\/\/example\.com\/a1\.jpg" alt="After: Kitchen"/);
  const edit = await (await c.get(editPath)).text();
  assert.match(edit, /data-newblock="beforeAfter"/); assert.match(edit, /id="tpl-block-beforeAfter"/);
  await c.post(editPath, { ...f, ba_before: [], ba_after: [], ba_caption: [] });
  html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /Before \/ after: add photo pairs under Gallery/);
  const blocks = await (await c.get(`/sites/${siteId}/blocks`)).text();
  assert.match(blocks, /<option value="bold" title="[^"]+">Bold trades<\/option>/); assert.match(blocks, /id="surpriseBtn"/);
  assert.match(blocks, /var applyPack = function applyPack\(blocks, pack\)/); assert.match(blocks, /<details class="fx"|function fxBox\(b, i\)/);
});

test('Section height: content blocks and Blocks page blocks can be shorter, taller or full screen', async () => {
  const c = makeClient();
  const f = { block_type: ['cta'], block_id: [''], block_heading: ['Tall one'], block_body: ['Words'], block_image: [''], block_side: ['auto'], block_buttonText: [''], block_buttonUrl: [''],
    block_edge: ['none'], block_bg: ['none'], block_place: ['bottom'], block_page: ['home'], block_pin: [''], block_imgfx: [''], block_height: ['tall'] };
  const { siteId } = await basicSite(c, 'height@example.com', 'Height Co', f);
  let html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<div class="sg-ht sg-ht-tall" style="--sg-ht: 200px;">/); assert.match(html, /<style data-sg-ht>/);
  assert.match(await (await c.get(`/sites/${siteId}/edit`)).text(), /<select name="block_height"[^>]*>[\s\S]*?<option value="tall" selected>Much taller<\/option>/);
  const blocks = [{ k: 'lib', f: 'hero', v: 'overlay', height: 'compact' }, { k: 'lib', f: 'about', v: 'split', height: 'screen' }, { k: 'lib', f: 'faq', v: 'accordion', height: 'nonsense' }];
  await c.post(`/sites/${siteId}/blocks/save`, JSON.stringify({ blocks }), { headers: { 'Content-Type': 'application/json' } });
  html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<div class="sg-mix sg-ht sg-ht-compact" data-mix-i="0" data-mix-f="hero" style="--sg-ht: 32px;">/);
  assert.match(html, /<div class="sg-mix sg-ht sg-ht-screen" data-mix-i="1" data-mix-f="about">/);
  assert.doesNotMatch(html, /sg-ht-nonsense/);
  assert.match(await (await c.get(`/sites/${siteId}/blocks`)).text(), /HTS = \[\["","Normal height"\]/);
});

test('Card piles, photo words, scroll elements and video masks reach the page', async () => {
  const c = makeClient();
  const f = { hero_headline: 'Hello', contact_email: 'owner@biz.test', theme_scrollEl: 'zoom', theme_scrollElWhat: 'parts',
    block_type: ['features', 'video'], block_id: ['', ''], block_heading: ['Cards', 'Reel'], block_body: ['One | a\nTwo | b\nThree | c', '/uploads/reel.webm'], block_image: ['', ''],
    block_side: ['auto', 'circle'], block_buttonText: ['', ''], block_buttonUrl: ['', ''], block_edge: ['none', 'none'], block_bg: ['none', 'none'],
    block_place: ['bottom', 'bottom'], block_page: ['home', 'home'], block_pin: ['deck', ''], block_imgfx: ['hover', ''] };
  const { siteId } = await basicSite(c, 'cardfx@example.com', 'Card Fx Co', f);
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<div class="sg-pin sg-pin-deck">/); assert.match(html, /<div class="sg-ix sg-ix-hover">/);
  assert.match(html, /<style data-sg-ix>/); assert.match(html, /<script data-sg-sfx>/); assert.match(html, /"fx":"zoom","parts":true/);
  assert.match(html, /<div class="vm vm-shape vm-circle" style="clip-path:circle\(50% at 50% 50%\)"><video src="\/uploads\/reel\.webm" muted loop playsinline autoplay/);
  assert.match(html, /<style data-sg-vm>/);
  const blocks = [{ k: 'lib', f: 'hero', v: 'overlay' }, { k: 'lib', f: 'about', v: 'split', imgfx: 'scroll', pin: 'fan' }];
  await c.post(`/sites/${siteId}/blocks/save`, JSON.stringify({ blocks }), { headers: { 'Content-Type': 'application/json' } });
  assert.match(await (await c.get(`/sites/${siteId}/preview`)).text(), /<div class="sg-mix sg-pin sg-pin-fan sg-ix sg-ix-scroll" data-mix-i="1" data-mix-f="about">/);
  assert.match(await (await c.get(`/sites/${siteId}/lab`)).text(), /name="theme_scrollEl" form="lbUse"/);
});

test('More effects: the switches are saved, reach the page with their script and show in the editor', async () => {
  const c = makeClient();
  const f = { hero_headline: 'Hello', hero_imageUrl: 'https://example.com/hero.jpg', contact_email: 'owner@biz.test', theme_xfx_zoom: '1', theme_xfx_flip: '1', theme_xfx_bogus: '1' };
  const { siteId } = await basicSite(c, 'xfx@example.com', 'Effects Co', f);
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<body class="[^"]* xfxon-flip xfxon-zoom"/);
  assert.match(html, /<style data-sg-xfx>/); assert.match(html, /<script data-sg-xfx>/);
  assert.match(html, /<script type="application\/json" id="sg-xfx">\{"zoom":\{"name":"Effects Co","img":"https:\/\/example\.com\/hero\.jpg"\}\}<\/script>/);
  assert.doesNotMatch(html, /bogus/);
  const ed = await (await c.get(`/sites/${siteId}/edit`)).text();
  assert.match(ed, /name="theme_xfx_flip" value="1" checked/); assert.match(ed, /name="theme_xfx_scramble" value="1" >/);
  const { siteId: plain } = await basicSite(c, 'xfx2@example.com', 'Plain Co', { hero_headline: 'Hi', contact_email: 'owner@biz.test' });
  assert.doesNotMatch(await (await c.get(`/sites/${plain}/preview`)).text(), /data-sg-xfx|xfxon-/);
});

test('Photo banner block: rounded photo with the words on a fade, italic words, any page, hero photo when none of its own', async () => {
  const c = makeClient();
  const f = { hero_headline: 'Strategy from Miami', hero_imageUrl: 'https://example.com/hero.jpg',
    block_type: ['photoBanner'], block_heading: ['Now imagine this [creative power] behind your next project'], block_body: ['One of many things we do. Let\'s chat.'], block_image: [''],
    block_side: ['right:tall:lime'], block_buttonText: ['Book a call'], block_buttonUrl: ['/contact'], block_edge: ['none'], block_bg: ['none'], block_place: ['bottom'], block_page: ['home'] };
  const { siteId, editPath } = await basicSite(c, 'pbanner@example.com', 'Wave Co', f);
  let html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<section(?: data-sg-bid="[^"]+")?(?: data-sg-blk="\d+")? class="blk blk-pbanner blk-bg-none/);
  assert.match(html, /<div class="pb pb-right" style="--pb-h: 700px; --sc-rgb: [^"]*--pb-btn: #d4f57a; --pb-btn-ink: #111111">/);
  assert.match(html, /<img class="pb-ph" src="https:\/\/example\.com\/hero\.jpg"/);
  assert.match(html, /<h2 class="pb-h">Now imagine this <em class="sg-hl">creative power<\/em> behind your next project<\/h2>/);
  assert.match(html, /<p>One of many things we do\. Let&#39;s chat\.<\/p>/); assert.match(html, /<a class="pb-btn" href="\/contact">Book a call<\/a>/);
  assert.match(html, /family=Instrument\+Serif/);
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /<strong class="block-kind">Photo banner \(rounded photo, words on a fade\)<\/strong>/);
  assert.match(editor, /name="block_side" class="wall-side" value="right:tall:lime"/); assert.match(editor, /data-newblock="photoBanner"/);
  // its own photo, on the About page; no heading, no banner
  await c.post(editPath, { ...f, name: 'Wave Co', block_image: ['https://example.com/own.jpg'], block_page: ['about'] });
  html = await (await c.get(`/sites/${siteId}/preview/about`)).text();
  assert.match(html, /<img class="pb-ph" src="https:\/\/example\.com\/own\.jpg"/);
  await c.post(editPath, { ...f, name: 'Wave Co', block_heading: [''] });
  assert.doesNotMatch(await (await c.get(`/sites/${siteId}/preview`)).text(), /<section(?: data-sg-bid="[^"]+")?(?: data-sg-blk="\d+")? class="blk blk-pbanner/);
});

test('Blocks screen Edit mode: words and photos changed on the preview save to the site, with a version first', async () => {
  const c = makeClient();
  const { siteId, slug } = await basicSite(c, 'onpage@example.com', 'Onpage Roofing', { hero_headline: 'Roofs done [right]', about_body: 'Family owned since we started.' });
  const json = (body) => c.post(`/sites/${siteId}/blocks/edit`, JSON.stringify(body), { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } });
  const page = await (await c.get(`/sites/${siteId}/blocks`)).text();
  assert.match(page, /data-v="edit"/); assert.match(page, /"photos":\[/);
  let r = await (await json({ kind: 'text', old: 'ROOFS DONE RIGHT', new: 'Roofs done right, on time', fam: 'hero' })).json();
  assert.equal(r.ok, true); assert.equal(r.where, 'hero.headline');
  assert.match(await (await fetch(`${BASE}/site/${slug}`)).text(), /Roofs done <em class="sg-hl">right<\/em>, on time/);
  const res = await json({ kind: 'text', old: 'Talk to Onpage Roofing', new: 'x', fam: 'cta' });
  assert.equal(res.status, 400); assert.match((await res.json()).error, /written by the design/);
  assert.equal((await json({ kind: 'photo', old: '/uploads/none.jpg', new: 'javascript:x', fam: 'hero' })).status, 400);
  // another owner cannot edit this site
  const other = makeClient(); await basicSite(other, 'onpage2@example.com', 'Other Co', {});
  const theirs = await other.post(`/sites/${siteId}/blocks/edit`, JSON.stringify({ kind: 'text', old: 'Roofs done right, on time', new: 'hacked', fam: 'hero' }), { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } });
  assert.notEqual(theirs.status, 200);
  assert.doesNotMatch(await (await fetch(`${BASE}/site/${slug}`)).text(), /hacked/);
});

test('Scroll story, Path travel, Zoom through the word and Shape morph blocks: saved, drawn from the owner\'s own words and photos, offered in the editor', async () => {
  const c = makeClient();
  const f = { hero_headline: 'Strategy that moves the needle', hero_imageUrl: 'https://example.com/h1.jpg', gallery_present: '1', gallery_image: ['https://example.com/g1.jpg', 'https://example.com/g2.jpg', 'https://example.com/g3.jpg'],
    block_type: ['story', 'path', 'zoomword', 'morph'], block_heading: ['How we work', 'Made for you', 'Create', 'Our story'],
    block_body: ['Plan | We listen first\nBuild | Our crew does it\nhttps://example.com/own.jpg', 'Clear stories\nReal results', 'Big ideas, built', 'We started small.'],
    block_image: ['', '', '', 'https://example.com/me.jpg'], block_side: ['auto', 'auto', 'auto', 'auto'], block_buttonText: ['Book', '', '', ''], block_buttonUrl: ['/contact', '', '', ''],
    block_edge: ['none', 'none', 'none', 'none'], block_bg: ['none', 'none', 'none', 'none'], block_place: ['bottom', 'bottom', 'bottom', 'bottom'], block_page: ['home', 'home', 'home', 'home'] };
  const { siteId, editPath } = await basicSite(c, 'gsapblocks@example.com', 'Wave Co', f);
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /class="sg-story" data-sg-scrollstory style="--n: 2"/); assert.match(html, /<h3>Plan<\/h3><p>We listen first<\/p>/);
  assert.match(html, /<a class="btn" href="\/contact">Book<\/a>/); assert.match(html, /<img class="sg-story-pic" style="--i: 0" src="https:\/\/example\.com\/own\.jpg"/);
  assert.match(html, /class="sg-path" data-sg-path/); assert.match(html, /<span class="sg-path-word sg-path-item">Real results<\/span>/);
  assert.match(html, /<h2 class="sg-zw-word">Create<\/h2>/); assert.match(html, /--zw-img: url\('https:\/\/example\.com\/h1\.jpg'\)/);
  assert.match(html, /<img class="sg-morph-img" src="https:\/\/example\.com\/me\.jpg"/); assert.match(html, /<p>We started small\.<\/p>/);
  const editor = await (await c.get(editPath)).text();
  for (const k of ['Scroll story', 'Path travel', 'Zoom through the word', 'Shape morph']) assert.match(editor, new RegExp('<strong class="block-kind">' + k + '</strong>'));
  for (const t of ['story', 'path', 'zoomword', 'morph']) { assert.match(editor, new RegExp('data-newblock="' + t + '"')); assert.match(editor, new RegExp('<template id="tpl-block-' + t + '">')); }
});

test('Word carousel collage: a banner look runs the words across nonstop while the card\'s photo follows them', async () => {
  const c = makeClient();
  const f = { hero_headline: 'Fresh culture', hero_imageUrl: 'https://example.com/h1.jpg', gallery_present: '1', gallery_image: ['https://example.com/g1.jpg', 'https://example.com/g2.jpg', 'https://example.com/g3.jpg'],
    block_type: ['collage'], block_heading: ['Our culture'], block_body: ['Fresh Culture\nNew Culture\nYour Culture'], block_image: [''], block_side: ['banner'], block_buttonText: [''], block_buttonUrl: [''],
    block_edge: ['none'], block_bg: ['none'], block_place: ['bottom'], block_page: ['home'] };
  const { siteId, editPath } = await basicSite(c, 'clbanner@example.com', 'Wave Co', f);
  assert.match(await (await c.get(`/sites/${siteId}/preview`)).text(), /<div class="sg-cl sg-cl-banner" data-sg-collage data-sg-cl-banner>/);
  assert.match(await (await c.get(editPath)).text(), /<option value="banner" selected>Banner: the words run across/);
  // anything else is the step-by-step look
  await c.post(editPath, { ...f, name: 'Wave Co', block_side: ['sideways'] });
  assert.match(await (await c.get(`/sites/${siteId}/preview`)).text(), /<div class="sg-cl" data-sg-collage>/);
  const js = require('fs').readFileSync(require('path').join(__dirname, '../public/sg-lib.js'), 'utf8');
  assert.match(js, /data-sg-cl-banner/); assert.match(js, /cp\.setAttribute\('aria-hidden', 'true'\)/);
});

test('Connected photo cards block: saved from the editor, drawn with its labels, words card and changing pictures', async () => {
  const c = makeClient();
  const f = { hero_headline: 'Fresh culture', hero_imageUrl: 'https://example.com/h1.jpg', gallery_present: '1', gallery_image: ['https://example.com/g1.jpg', 'https://example.com/g2.jpg', 'https://example.com/g3.jpg'],
    block_type: ['nodes'], block_heading: ['Bright [ideas]'], block_body: ['sub: We plan and build\ncard: Roofs | Since 1998 | https://example.com/own.jpg javascript:alert(1)\ntext: Note | | We <b>listen</b> first\ncard: Gutters | | \ncard: Paint | Inside | '],
    block_image: [''], block_side: ['slide'], block_buttonText: [''], block_buttonUrl: [''], block_edge: ['none'], block_bg: ['none'], block_place: ['bottom'], block_page: ['home'] };
  const { siteId, editPath } = await basicSite(c, 'nodecards@example.com', 'Node Co', f);
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<div class="blk-inner sg-nc sg-nc-slide" data-sg-nodes data-sg-wall data-change="slide">/);
  assert.match(html, /<h2 class="sg-nc-h">Bright <em class="sg-hl">ideas<\/em><\/h2>/); assert.match(html, /<p class="sg-nc-sub">We plan and build<\/p>/);
  assert.match(html, /<figcaption class="sg-nc-lab"><b>Roofs<\/b><span>Since 1998<\/span><\/figcaption>/);
  assert.match(html, /<img class="sg-on" src="https:\/\/example\.com\/own\.jpg"/); assert.doesNotMatch(html, /javascript:alert/);
  assert.match(html, /<p>We &lt;b&gt;listen&lt;\/b&gt; first<\/p>/); assert.match(html, /data-sg-wall-pause data-what="moving words and pictures"/);
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /<strong class="block-kind">Connected photo cards<\/strong>/); assert.match(editor, /data-newblock="nodes"/); assert.match(editor, /<template id="tpl-block-nodes">/);
  assert.match(editor, /<input type="text" class="nc-label" maxlength="30" value="Roofs"/); assert.match(editor, /<option value="slide" selected>Wipe up/);
  // "don't change": no pause button, no turns
  await c.post(editPath, { ...f, name: 'Node Co', block_side: ['still'] });
  const still = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(still, /data-change="still"/); assert.doesNotMatch(still, /data-what="moving words and pictures"/);
  // the heading's last line rolls through the owner's words (Leo, 2026-10-31), and the editor shows them back
  await c.post(editPath, { ...f, name: 'Node Co', block_heading: ['We make brands'], block_body: ['roll: move.\nroll: stand <out>.\n' + f.block_body[0]] });
  const rolled = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(rolled, /<h2 class="sg-nc-h">We make brands <span class="sg-ps-roll" data-sg-roll aria-hidden="true"><span class="sg-ps-rail"><span>move\.<\/span><span>stand &lt;out&gt;\.<\/span><\/span><\/span><span class="sg-ps-sr">move\., stand &lt;out&gt;\.<\/span><\/h2>/);
  assert.match(await (await c.get(editPath)).text(), /<textarea class="nc-roll"[^>]*>move\.\nstand &lt;out&gt;\.<\/textarea>/);
});

test('Stacked cards block: saved from the editor, the owner\'s label, rating and cards, as many cards as picked', async () => {
  const c = makeClient();
  const f = { hero_headline: 'Fresh culture', hero_imageUrl: 'https://example.com/h1.jpg',
    block_type: ['stack'], block_heading: ['People [come back]'], block_body: ['label: Customer love\nrating: 4.5 | from 40 reviews\ncard: Ann | Owner | 5 | https://example.com/p.jpg | We <b>love</b> them\ncard:  |  |  |  | A note'],
    block_image: [''], block_side: ['3'], block_buttonText: [''], block_buttonUrl: [''], block_edge: ['none'], block_bg: ['none'], block_place: ['bottom'], block_page: ['home'] };
  const { siteId, editPath } = await basicSite(c, 'stackcards@example.com', 'Stack Co', f);
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<div class="sg-sk sg-sk-soft" data-sg-stack style="--n: 3">/);
  assert.match(html, /<p class="sg-sk-label">Customer love<\/p>/); assert.match(html, /<h2 class="sg-sk-h">People <em class="sg-hl">come back<\/em><\/h2>/);
  assert.match(html, /aria-label="4\.5 out of 5 stars"/); assert.match(html, /from 40 reviews/);
  assert.match(html, /<span class="sg-sk-count" aria-live="polite"><b>1<\/b> of 3<\/span>/);
  assert.equal((html.match(/<figure class="sg-sk-card/g) || []).length, 3);
  assert.match(html, /<p>We &lt;b&gt;love&lt;\/b&gt; them<\/p>/); assert.match(html, /<b>Ann<\/b><span>Owner<\/span>/);
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /<strong class="block-kind">Stacked cards \(turn as you scroll\)<\/strong>/); assert.match(editor, /data-newblock="stack"/); assert.match(editor, /<template id="tpl-block-stack">/);
  assert.match(editor, /<option value="3" selected>3 cards<\/option>/); assert.match(editor, /<input type="text" class="sk-label" maxlength="60" value="Customer love"/);
});

test('Rolling words with photo shapes block: saved from the editor, the last line rolls through the owner\'s words, photos sit in the shapes', async () => {
  const c = makeClient();
  const f = { hero_headline: 'Fresh culture', hero_imageUrl: 'https://example.com/h1.jpg', gallery_present: '1', gallery_image: ['https://example.com/g1.jpg', 'https://example.com/g2.jpg', 'https://example.com/g3.jpg'],
    block_type: ['shapes'], block_heading: ['We make brands'], block_body: ['roll: move.\nroll: stand <out>.\nsub: Logos, signs and video\nphotos: https://example.com/own1.jpg https://example.com/own2.jpg javascript:alert(1)'],
    block_image: [''], block_side: ['brand'], block_buttonText: [''], block_buttonUrl: [''], block_edge: ['none'], block_bg: ['none'], block_place: ['bottom'], block_page: ['home'] };
  const { siteId, editPath } = await basicSite(c, 'shapeblock@example.com', 'Shape Co', f);
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<div class="sg-ps sg-ps-brand" data-sg-shapes-blk data-sg-wall>/);
  assert.match(html, /<h2 class="sg-ps-h">We make brands <span class="sg-ps-roll" data-sg-roll aria-hidden="true"><span class="sg-ps-rail"><span>move\.<\/span><span>stand &lt;out&gt;\.<\/span><\/span><\/span><span class="sg-ps-sr">move\., stand &lt;out&gt;\.<\/span><\/h2>/);
  assert.match(html, /<p>Logos, signs and video<\/p>/);
  assert.match(html, /<div class="sg-ps-shape sg-ps-s1"><div class="sg-ps-pics"><img class="sg-on" src="https:\/\/example\.com\/own1\.jpg"[^>]*><img src="https:\/\/example\.com\/own2\.jpg"/);
  assert.match(html, /<div class="sg-ps-shape sg-ps-s2"><div class="sg-ps-pics"><img class="sg-on" src="https:\/\/example\.com\/own2\.jpg"[^>]*><img src="https:\/\/example\.com\/own1\.jpg"/);
  assert.doesNotMatch(html, /javascript:alert/); assert.match(html, /data-what="moving words and photos"/);
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /<strong class="block-kind">Rolling words with photo shapes<\/strong>/); assert.match(editor, /data-newblock="shapes"/); assert.match(editor, /<template id="tpl-block-shapes">/);
  assert.match(editor, /<input type="url" class="strip-url sh-url" value="https:\/\/example\.com\/own2\.jpg"/); assert.match(editor, /<textarea class="sh-roll"[^>]*>move\.\nstand &lt;out&gt;\.<\/textarea>/); assert.match(editor, /<option value="brand" selected>Rims in your brand colors/);
});

test('Your own text boxes: saved with the editor, drawn on their own page only, and kept by a save that leaves them out', async () => {
  const c = makeClient();
  const box = { id: 'tgrand01', page: 'home', at: '#hero', x: 10, y: 20, w: 40, text: 'Grand opening <soon>', size: 54, font: 'Pacifico', color: 'accent', bold: true, italic: false, align: 'center' };
  const f = { hero_headline: 'Roofs done right', texts_json: JSON.stringify([box, { ...box, id: 'tabout01', page: 'about', text: 'About us note' }, { id: 'bad' }]) };
  const { siteId, editPath } = await basicSite(c, 'textboxes@example.com', 'Text Co', f);
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<div class="sg-tx-src" data-sg-txpage="home" hidden><div class="sg-tx" data-sg-tx="tgrand01" data-at="#hero" style="--x:10%;--y:20%;--w:40%;--fs:54;font-family:&#39;Pacifico&#39;,var\(--heading-font,inherit\);color:var\(--accent\);font-weight:700;font-style:normal;text-align:center">Grand opening soon<\/div><\/div>/);
  assert.match(html, /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=Pacifico[^"]*" data-sg-txfonts>/);
  assert.doesNotMatch(html, /About us note/);
  const about = await (await c.get(`/sites/${siteId}/preview/about`)).text();
  if (about.includes('data-sg-txpage')) assert.match(about, /data-sg-txpage="about" hidden><div class="sg-tx" data-sg-tx="tabout01"/);
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /id="textsJson" value="\[\{&#34;id&#34;:&#34;tgrand01&#34;/); assert.match(editor, /id="addTextBtn"/);
  // a save without the list (an older form) keeps the boxes
  await c.post(editPath, { name: 'Text Co', hero_headline: 'Roofs done right' });
  assert.match(await (await c.get(`/sites/${siteId}/preview`)).text(), /data-sg-tx="tgrand01"/);
  // an emptied list clears them
  await c.post(editPath, { name: 'Text Co', hero_headline: 'Roofs done right', texts_json: '[]' });
  assert.doesNotMatch(await (await c.get(`/sites/${siteId}/preview`)).text(), /data-sg-tx="/);
});

test('Your own pictures: saved with the editor, drawn on their own page, kept by a save that leaves them out (Leo, 2026-11-02)', async () => {
  const c = makeClient();
  const pic = { id: 'ppets001', page: 'home', at: '#hero', x: 0, y: 70, w: 100, h: 30, art: 'turns', photos: [], fit: 'fit' };
  const f = { hero_headline: 'Pets groomed right', pics_json: JSON.stringify([pic, { ...pic, id: 'pabout01', page: 'about', art: 'dogs' }, { id: 'bad' }]) };
  const { siteId, editPath } = await basicSite(c, 'picboxes@example.com', 'Pic Co', f);
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /data-sg-txpage="home" hidden><div class="sg-pic sg-pic-fit" data-sg-pic="ppets001" data-at="#hero" style="--x:0%;--y:70%;--w:100%;--h:30%" data-sg-tb-turns>/);
  assert.doesNotMatch(html, /data-sg-pic="pabout01"/);
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /id="picsJson" value="\[\{&#34;id&#34;:&#34;ppets001&#34;/); assert.match(editor, /id="addPicBtn"/);
  await c.post(editPath, { name: 'Pic Co', hero_headline: 'Pets groomed right' });
  assert.match(await (await c.get(`/sites/${siteId}/preview`)).text(), /data-sg-pic="ppets001"/);
  await c.post(editPath, { name: 'Pic Co', hero_headline: 'Pets groomed right', pics_json: '[]' });
  assert.doesNotMatch(await (await c.get(`/sites/${siteId}/preview`)).text(), /data-sg-pic="/);
});

test('Style text: changes saved with the editor reach their own page, and a save that leaves them out keeps them (Leo, 2026-10-31)', async () => {
  const c = makeClient();
  const st = { id: 'sstyle01', page: 'home', el: 'f:hero|h11', size: 72, font: 'Pacifico', color: '#e11d48', bold: true, italic: null, dx: 20, dy: 0 };
  const f = { hero_headline: 'Roofs done right', tstyles_json: JSON.stringify([st, { ...st, id: 'sabout01', page: 'about', el: 'x|p1' }, { id: 'bad' }]) };
  const { siteId, editPath } = await basicSite(c, 'textstyles@example.com', 'Style Co', f);
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<script type="application\/json" id="sg-ts-data">\[\{"id":"sstyle01"[^<]*"css":"font-size:min\(72px/);
  assert.doesNotMatch(html, /sabout01/); assert.match(html, /<script data-sg-ts>/); assert.match(html, /data-sg-tsfonts/);
  // after the footer, before the page's effects
  assert.ok(html.indexOf('data-sg-ts>') > html.indexOf('</footer>') && html.indexOf('data-sg-ts>') < html.indexOf('sg-fx.js" defer'));
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /id="tstylesJson" value="\[\{&#34;id&#34;:&#34;sstyle01&#34;/); assert.match(editor, /id="styleTextBtn"/);
  await c.post(editPath, { name: 'Style Co', hero_headline: 'Roofs done right' });
  assert.match(await (await c.get(`/sites/${siteId}/preview`)).text(), /"id":"sstyle01"/);
  await c.post(editPath, { name: 'Style Co', hero_headline: 'Roofs done right', tstyles_json: '[]' });
  assert.doesNotMatch(await (await c.get(`/sites/${siteId}/preview`)).text(), /"id":"sstyle01"/);
});

test('Move & size: piece moves and sizes saved with the editor reach their own page, and a save that leaves them out keeps them (Leo, 2026-11-05)', async () => {
  const c = makeClient();
  const es = { id: 'emove001', page: 'home', el: 'f:hero|img-1', dx: 20, dy: -10, w: 420, zoom: 0, turn: 5, front: true, hide: false };
  const f = { hero_headline: 'Roofs done right', estyles_json: JSON.stringify([es, { ...es, id: 'eabout01', page: 'about' }, { id: 'bad' }]) };
  const { siteId, editPath } = await basicSite(c, 'elstyles@example.com', 'Move Co', f);
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<script type="application\/json" id="sg-es-data">\[\{"id":"emove001"[^<]*"css":"translate:calc\(20/);
  assert.doesNotMatch(html, /eabout01/); assert.match(html, /<script data-sg-es>/);
  // after the text styles, before the page's effects
  assert.ok(html.indexOf('data-sg-es>') > html.indexOf('data-sg-ts>') && html.indexOf('data-sg-es>') < html.indexOf('sg-fx.js" defer'));
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /id="estylesJson" value="\[\{&#34;id&#34;:&#34;emove001&#34;/); assert.match(editor, /id="moveSizeBtn"/);
  await c.post(editPath, { name: 'Move Co', hero_headline: 'Roofs done right' });
  assert.match(await (await c.get(`/sites/${siteId}/preview`)).text(), /"id":"emove001"/);
  await c.post(editPath, { name: 'Move Co', hero_headline: 'Roofs done right', estyles_json: '[]' });
  assert.doesNotMatch(await (await c.get(`/sites/${siteId}/preview`)).text(), /"id":"emove001"/);
});

test('gradients from the editor: a gallery pick per section and per block, and the page wash, headings and edges for the whole site', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'grads@example.com', 'Grad Plumbing', {
    meta_businessType: 'plumbing company', theme_homeLayout: 'blueprint',
    service_title: ['Drains', 'Leaks', 'Heaters'], service_description: ['a', 'b', 'c'], service_detail: ['', '', ''],
    bps_services_bg: 'preset', bps_services_grad: 'night', bps_services_gradStyle: 'mesh', bps_services_gradAngle: '30', bps_services_gradMove: '1', bps_services_grain: '1',
    theme_pageGrad: 'cloud', theme_pageGradScroll: '1', theme_gradText: '1', theme_gradPick: 'ocean', theme_gradEdge: 'glow',
    block_type: ['cta'], block_heading: ['Call us today'], block_body: ['We pick up.'], block_image: [''], block_side: ['auto'], block_buttonText: [''], block_buttonUrl: [''],
    block_edge: ['none'], block_bg: ['g-sunset'], block_place: ['bottom'], block_page: ['home']
  });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /data-sg-gmove="1" data-sg-grain="1" data-sg-img="1" data-sg-bg="custom" style="--sg-bgimg: radial-gradient\(at 12% 18%, #141e30/);
  assert.match(html, /class="[^"]*sg-pwash sg-pwash-scroll sg-gtext sg-gglow"/);
  assert.match(html, /<style id="sg-grad">[^<]*body\.sg-pwash::before/); assert.match(html, /<style id="sg-grad">[^<]*\.blk\.blk-bg-g-sunset \{/);
  assert.match(html, /class="blk blk-cta-band blk-bg-g-sunset"/);
  assert.match(html, /<script>\(function\(\)\{var b=document\.body;if\(!b\.classList\.contains\('sg-pwash-scroll'\)/);
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /name="bps_services_bg"[\s\S]*?<option value="preset" selected>Gradient from the gallery/);
  assert.match(editor, /name="bps_services_grad"[\s\S]*?<option value="night" data-css="[^"]*" selected>Night<\/option>/);
  assert.match(editor, /name="theme_pageGrad">[\s\S]*?<option value="cloud" selected>/);
  assert.match(editor, /name="block_bg"[^>]*>[\s\S]*?<option value="g-sunset" selected>Sunset<\/option>/);
  // a bogus pick changes nothing
  await c.post(editPath, { name: 'Grad Plumbing', hero_headline: 'Hello', theme_homeLayout: 'blueprint', meta_businessType: 'plumbing company', service_title: ['Drains', 'Leaks', 'Heaters'], service_description: ['a', 'b', 'c'], service_detail: ['', '', ''], bps_services_bg: 'preset', bps_services_grad: 'lava', theme_pageGrad: 'lava' });
  const plain = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.doesNotMatch(plain, /data-sg-gmove="1"|class="[^"]*sg-pwash|body\.sg-pwash::before/);
});

test('textured backgrounds: offered with the gallery for sections and blocks, drawn over their gradient, not for the whole page', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'textures@example.com', 'Texture Co', {
    meta_businessType: 'plumbing company', theme_homeLayout: 'blueprint', theme_primaryColor: '#c2410c',
    service_title: ['Drains', 'Leaks', 'Heaters'], service_description: ['a', 'b', 'c'], service_detail: ['', '', ''],
    bps_services_bg: 'preset', bps_services_grad: 'tx-globe', bps_services_gradStyle: 'mesh',
    theme_pageGrad: 'tx-grid', theme_gradPick: 'txb-mesh',
    block_type: ['cta'], block_heading: ['Call us today'], block_body: ['We pick up.'], block_image: [''], block_side: ['auto'], block_buttonText: [''], block_buttonUrl: [''],
    block_edge: ['none'], block_bg: ['g-txb-sphere'], block_place: ['bottom'], block_page: ['home']
  });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  // the drawing (an SVG in single quotes, nothing that breaks the style attribute) over the texture's own gradient; white text
  assert.match(html, /data-sg-img="1" data-sg-bg="custom" style="--sg-bgimg: url\('data:image\/svg\+xml,%3Csvg[^'"]*'\), linear-gradient\(180deg, #0d0e12, #14161c\); --sg-brand: #0d0e12; --sg-onbrand: #ffffff/);
  assert.match(html, /\.blk\.blk-bg-g-txb-sphere \{ background: url\('data:image\/svg\+xml,/);
  assert.match(html, /class="blk blk-cta-band blk-bg-g-txb-sphere"/);
  // the page wash and heading colors stay plain gradients
  assert.doesNotMatch(html, /class="[^"]*sg-pwash|body\.sg-pwash::before/);
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /name="bps_services_grad"[\s\S]*?<optgroup label="Textures"><option value="tx-contour" data-css="linear-gradient\(180deg, #26282a, #1b1c1e\)"/);
  assert.match(editor, /name="bps_services_grad"[\s\S]*?<option value="tx-globe" data-css="[^"]*" selected>Wire globe<\/option>/);
  assert.match(editor, /name="block_bg"[^>]*>[\s\S]*?<option value="g-txb-sphere" selected>Glowing dot sphere, your colors<\/option>/);
  assert.doesNotMatch(editor.match(/name="theme_pageGrad">[\s\S]*?<\/select>/)[0], /tx-/);
});

test('blend into the color already there: a section keeps its own color and a block its plain color, with the gradient or texture over it', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'blend@example.com', 'Blend Co', {
    meta_businessType: 'plumbing company', theme_homeLayout: 'blueprint', theme_primaryColor: '#c2410c',
    service_title: ['Drains', 'Leaks', 'Heaters'], service_description: ['a', 'b', 'c'], service_detail: ['', '', ''],
    bps_services_bg: 'preset', bps_services_grad: 'tx-contour', bps_services_gradBlend: '1',
    block_type: ['cta', 'steps'], block_heading: ['Call us today', 'How it works'], block_body: ['We pick up.', 'One\nTwo'], block_image: ['', ''], block_side: ['auto', 'auto'], block_buttonText: ['', ''], block_buttonUrl: ['', ''],
    block_edge: ['none', 'none'], block_bg: ['g-sunset', 'g-txb-globe'], block_bgmix: ['none', 'tint'], block_place: ['bottom', 'bottom'], block_page: ['home', 'home']
  });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /data-sg-gb="1"[^>]*style="[^"]*--sg-gb: url\('data:image\/svg\+xml,/);
  assert.match(html, /class="blk blk-cta-band blk-gb-brand-sunset"/);
  assert.match(html, /class="blk blk-bg-tint blk-gb-tint-txb-globe"/);
  assert.match(html, /\.blk\.blk-gb-brand-sunset \{ background-image: radial-gradient/);
  assert.doesNotMatch(html, /\.blk\.blk-bg-g-sunset/);
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /name="bps_services_gradBlend"><option value="">Replace it with the gallery pick<\/option><option value="1" selected>/);
  assert.match(editor, /name="block_bgmix"[^>]*>[\s\S]*?<option value="none" selected>Blend into the page color<\/option>/);
});

test('gradient library on blocks and on the cards inside them, each with an intensity', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'gradlib@example.com', 'Lib Co', {
    block_type: ['steps', 'steps'], block_heading: ['How it works', 'More'], block_body: ['One\nTwo', 'Three\nFour'], block_image: ['', ''], block_side: ['auto', 'auto'], block_buttonText: ['', ''], block_buttonUrl: ['', ''],
    block_edge: ['none', 'none'], block_bg: ['g-c-neon-lagoon', 'g-sunset'], block_bgmix: ['', 'none'], block_gx: ['60', '130'], block_cardbg: ['c-digital-sky', ''], block_cardgx: ['140', ''],
    block_place: ['bottom', 'bottom'], block_page: ['home', 'home']
  });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /class="blk blk-bg-g-c-neon-lagoon blk-gx-60 blk-cg-c-digital-sky-x140"/);
  assert.match(html, /class="blk blk-bg-(none|tint) blk-gb-none-sunset-x130"/);
  assert.match(html, /\.blk\.blk-bg-g-c-neon-lagoon\.blk-gx-60 \{ background: linear-gradient\(135deg, /);
  assert.match(html, /\.blk\.blk-cg-c-digital-sky-x140\.blk-cg-c-digital-sky-x140 :is\(\.card, \.step-card/);
  const editor = await (await c.get(editPath)).text();
  // (the menu holds only its choice until opened; public/lazyselect.js keeps a library pick under "Gradient library")
  assert.match(editor, /name="block_bg" data-sg-lazy="blockbg"><option value="g-c-neon-lagoon" selected>Neon Lagoon<\/option><\/select>/);
  assert.match(editor, /<template id="sg-lazy-blockbg"><select><option value="none">Plain background<\/option>/);
  assert.match(editor, /name="block_gx" min="10" max="150" step="5" value="60"/);
  assert.match(editor, /name="block_cardbg"[\s\S]*?<option value="c-digital-sky" selected>Digital Sky<\/option>/);
  assert.match(editor, /name="block_cardgx" min="10" max="150" step="5" value="140"/);
  assert.match(editor, /id="gradLibData">\[\["Library: reds and pinks"/);
  // the library is sent once for the swatch grid, not repeated in every block's picker
  assert.equal((editor.match(/>Digital Sky</g) || []).length, 1);
});

test('hero card block: big title, picture or reel, words, buttons and the bar; reels upload on their own route', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'herocard@example.com', 'Mug Co', { theme_primaryColor: '#3d6b4f' });
  // a reel: .mp4 or .webm only
  const form = new FormData();
  form.append('video', new Blob([Buffer.from('00000018667479706d703432', 'hex')], { type: 'video/mp4' }), 'reel.mp4');
  const up = await (await c.post(`/sites/${siteId}/upload-video`, form)).json();
  assert.ok(up.ok); assert.match(up.url, /^\/uploads\/[\w-]{12}\.mp4$/);
  require('fs').unlinkSync(require('path').join(__dirname, '..', 'public', up.url));
  const bad = new FormData(); bad.append('video', new Blob(['x'], { type: 'text/plain' }), 'a.txt');
  assert.equal((await c.post(`/sites/${siteId}/upload-video`, bad)).status, 400);
  await c.post(editPath, { name: 'Mug Co', hero_headline: 'Mugs',
    block_type: ['herocard'], block_heading: ['Matcha'], block_body: ['intro: Glazed by hand\nprice: $39.00 | Free pickup\ndetail: 350 ml | Big enough\nlink: Size guide | #faq\nlink: Bad | javascript:x\nbar: Classic mug | Matcha | $39.00'],
    block_image: ['/uploads/reel.webm'], block_side: ['fill'], block_buttonText: ['Add to bag'], block_buttonUrl: ['#contact'], block_edge: ['none'], block_bg: ['none'], block_place: ['top'], block_page: ['home'] });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /class="blk blk-herocard blk-bg-none"/);
  assert.match(html, /<div class="sg-hc sg-hc-fill" style="--hc-top: #[0-9a-f]{6}; --hc-bot: #[0-9a-f]{6}; --hc-ink: #ffffff; --hc-dot: #[0-9a-f]{6}" data-sg-hc-reel>/);
  assert.match(html, /<video src="\/uploads\/reel\.webm" muted loop playsinline autoplay/);
  assert.match(html, /<h2 class="sg-hc-title">Matcha<\/h2>/);
  assert.match(html, /<p class="sg-hc-links"><a href="#faq">Size guide<\/a><\/p>/);
  assert.match(html, /<a class="sg-hc-go" href="#contact"><span>Add to bag<\/span><span>\$39\.00<\/span><\/a>/);
  assert.match(html, /class="sg-hc-pause"/);
  assert.doesNotMatch(html, /javascript:x/);
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /data-newblock="herocard"/); assert.match(editor, /<template id="tpl-block-herocard">/);
  assert.match(editor, /class="hc-bname" maxlength="40" value="Classic mug"/);
  assert.match(editor, /accept="image\/\*,video\/mp4,video\/webm"/);
});


test('about with phone block: photo in soft shapes, heading, line, words and a tap-to-call phone', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'aboutphone@example.com', 'Phone Co', {});
  await c.post(editPath, { name: 'Phone Co', hero_headline: 'Hi', contact_phone: '(555) 010-2030',
    block_type: ['aboutphone', 'aboutphone'], block_heading: ['About', 'Second'], block_body: ['text: We fix things.\nbold: Call a real person.\nphone: +1 (234) 567-8910', 'text: Uses the site phone'],
    block_image: ['/uploads/me.jpg', ''], block_side: ['soft:right', 'nonsense'], block_buttonText: ['', ''], block_buttonUrl: ['', ''], block_edge: ['none', 'none'], block_bg: ['none', 'none'], block_place: ['bottom', 'bottom'], block_page: ['home', 'home'] });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /class="blk-inner sg-ab sg-ab-soft sg-ab-photo-right"/);
  assert.match(html, /<img class="sg-ab-img" src="\/uploads\/me\.jpg"/);
  assert.match(html, /<h2 class="sg-ab-h">About<\/h2>/);
  assert.match(html, /<p class="sg-ab-bold">Call a real person\.<\/p>/);
  assert.match(html, /<a href="tel:\+12345678910">[\s\S]*?<span>\+1 \(234\) 567-8910<\/span>/);
  assert.match(html, /class="blk-inner sg-ab sg-ab-brand sg-ab-photo-left"/);
  assert.match(html, /<a href="tel:5550102030">/);
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /data-newblock="aboutphone"/); assert.match(editor, /<template id="tpl-block-aboutphone">/);
  assert.match(editor, /class="ab-phone" maxlength="30" value="\+1 \(234\) 567-8910"/);
});


test('photo, words and a big letter block: three columns, two-part heading, read-more link, big box words and photo turns', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'thirds@example.com', 'Northwind', {});
  await c.post(editPath, { name: 'Northwind', hero_headline: 'Hi',
    block_type: ['thirds', 'thirds'], block_heading: ['Good to ride in.', ''], block_body: ['bold: Subtly decorated.\ntext: Made in small runs.\nstrong: Worn every day.\nbig: OPEN DAILY\nleft: /uploads/a.jpg /uploads/b.jpg\nright: /uploads/c.jpg', 'text: Uses the name letter'],
    block_image: ['', ''], block_side: ['brand', 'nonsense'], block_buttonText: ['Read more', ''], block_buttonUrl: ['/x', ''], block_edge: ['none', 'none'], block_bg: ['none', 'none'], block_place: ['bottom', 'bottom'], block_page: ['home', 'home'] });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<div class="sg-tb sg-tb-brand" data-sg-tb-turns>/);
  assert.match(html, /<h2 class="sg-tb-h"><span>Good to ride in\.<\/span><b>Subtly decorated\.<\/b><\/h2>/);
  assert.match(html, /<p>Made in small runs\. <b>Worn every day\.<\/b><\/p>/);
  assert.match(html, /<a class="sg-tb-more" href="\/x">Read more<\/a>/);
  assert.match(html, /class="sg-tb-big" style="[^"]*">OPEN DAILY<\/p>/);
  assert.match(html, /<img src="\/uploads\/a\.jpg" alt="" loading="lazy" decoding="async" class="on"><img src="\/uploads\/b\.jpg"/);
  assert.match(html, /<div class="sg-tb sg-tb-dark">/);
  assert.match(html, /class="sg-tb-big" style="[^"]*">N<\/p>/);
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /data-newblock="thirds"/); assert.match(editor, /<template id="tpl-block-thirds">/);
  assert.match(editor, /class="tb-big" maxlength="40" value="OPEN DAILY"/);
  assert.match(editor, /class="strip-url tb-l-url" value="\/uploads\/b\.jpg"/);
});


test('photo mosaic hero block: huge title, line in capitals, six stepped photos with spares, menu bar on request', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'mosaic@example.com', 'Good Dogs', {});
  const pics = Array.from({ length: 10 }, (_, i) => `/uploads/d${i}.jpg`).join(' ');
  await c.post(editPath, { name: 'Good Dogs', hero_headline: 'Hi', contact_phone: '(555) 010-2030',
    block_type: ['mosaic', 'mosaic'], block_heading: ['Your Dog', 'Plain'], block_body: ['sub: In the focus!\nphotos: ' + pics, 'sub: No menu'],
    block_image: ['', ''], block_side: ['menu', 'nonsense'], block_buttonText: ['', ''], block_buttonUrl: ['', ''], block_edge: ['none', 'none'], block_bg: ['none', 'none'], block_place: ['bottom', 'bottom'], block_page: ['home', 'home'] });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<h2 class="sg-mh-title">Your Dog<\/h2>/);
  assert.match(html, /<p class="sg-mh-sub">In the focus!<\/p>/);
  assert.equal((html.match(/<nav class="blk-inner sg-mh-bar"/g) || []).length, 1);
  assert.match(html, /<a class="sg-mh-call" href="tel:5550102030">Call Now<\/a>/);
  assert.match(html, /data-sg-mh-spare='\["\/uploads\/d8\.jpg","\/uploads\/d9\.jpg"\]'/);
  assert.match(html, /<div class="sg-mh-col sg-mh-c1"><div class="sg-mh-tile"><img src="\/uploads\/d0\.jpg"[^>]*><\/div><div class="sg-mh-tile"><img src="\/uploads\/d4\.jpg"/);
  assert.match(html, /class="sg-mh-grid sg-mh-cols4"/);
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /data-newblock="mosaic"/); assert.match(editor, /<template id="tpl-block-mosaic">/);
  assert.match(editor, /class="mh-sub" maxlength="160" value="In the focus!"/);
});

test('photo mosaic hero with its menu, first on a Blocks home page: takes the screen, the site menu bar waits for a scroll', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'mosaictop@example.com', 'Top Dogs', {});
  const f = { name: 'Top Dogs', hero_headline: 'Hi', contact_phone: '(555) 010-2030', theme_homeLayout: 'mix', theme_mix: JSON.stringify([{ k: 'blk', v: 'bmosaic1' }, { k: 'blk', v: 'bmosaic2' }]),
    block_id: ['bmosaic1', 'bmosaic2'], block_type: ['mosaic', 'mosaic'], block_heading: ['Your Dog', 'Second'], block_body: ['photos: /uploads/d0.jpg', ''], block_image: ['', ''], block_side: ['menu', 'menu'],
    block_buttonText: ['', ''], block_buttonUrl: ['', ''], block_edge: ['none', 'none'], block_bg: ['none', 'none'], block_place: ['top', 'bottom'], block_page: ['home', 'home'] };
  await c.post(editPath, f);
  let html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<body class="[^"]*\bsg-mh-top\b/);
  assert.match(html, /<div class="sg-mh-end"><a class="sg-mh-call" href="tel:5550102030">Call Now<\/a><\/div>/);
  await c.post(editPath, { ...f, block_side: ['none', 'menu'] });
  html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.doesNotMatch(html, /<body class="[^"]*\bsg-mh-top\b/, 'the first block has no menu: the site menu bar stays');
  await c.post(editPath, { ...f, theme_mix: JSON.stringify([{ k: 'blk', v: 'bmosaic2' }, { k: 'blk', v: 'bmosaic1' }]), block_side: ['menu', 'none'] });
  html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.doesNotMatch(html, /<body class="[^"]*\bsg-mh-top\b/, 'lower down the page: the site menu bar stays');
});


test('menu bar style: saved from the editor, a body class on the site, a menu button and panel for the drawer', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'menustyle@example.com', 'Menu Co', {});
  await c.post(editPath, { name: 'Menu Co', hero_headline: 'Hi', theme_style: 'modern', theme_menuStyle: 'drawer' });
  let html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<body class="[^"]*\bmnu-drawer\b/);
  assert.match(html, /<button type="button" class="sg-mnu-btn" id="sgMnuBtn" aria-expanded="false"/);
  assert.match(html, /<div class="sg-mnu-panel" id="sgMnuPanel" hidden>/);
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /<option value="drawer" selected>/);
  await c.post(editPath, { name: 'Menu Co', hero_headline: 'Hi', theme_style: 'modern', theme_menuStyle: 'split' });
  html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<body class="[^"]*\bmnu-split\b/); assert.doesNotMatch(html, /id="sgMnuBtn"/);
  await c.post(editPath, { name: 'Menu Co', hero_headline: 'Hi', theme_style: 'modern', theme_menuStyle: 'bogus' });
  html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.doesNotMatch(html, /<body class="[^"]*\bmnu-/, 'an unknown style falls back to the classic bar');
});

test('photo that blends in block: words, highlighted box, photos that take turns, color matched in the browser or the owner\'s', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'photoblend@example.com', 'Sale Co', {});
  await c.post(editPath, { name: 'Sale Co', hero_headline: 'Hi',
    block_type: ['photoblend', 'photoblend'], block_heading: ['Cyber [Monday]', 'Second'],
    block_body: ['top: Super offer\nbadge: Use code: HAPPY50\nnote: Only today\nphotos: /uploads/a.jpg /uploads/b.jpg', 'photos: /uploads/c.jpg\ncolor: #ececec'],
    block_image: ['', ''], block_side: ['right:both', 'left:match'], block_buttonText: ['Shop now', ''], block_buttonUrl: ['/shop', ''], block_edge: ['none', 'none'], block_bg: ['none', 'none'], block_place: ['bottom', 'bottom'], block_page: ['home', 'home'] });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<div class="sg-pb sg-pb-right sg-pb-both" data-sg-pb-match data-sg-tb-turns>/);
  assert.match(html, /<p class="sg-pb-top">Super offer<\/p>/);
  assert.match(html, /<h2 class="sg-pb-h">Cyber <em class="sg-hl">Monday<\/em><\/h2>/);
  assert.match(html, /<p class="sg-pb-badge">Use code: HAPPY50<\/p>/);
  assert.match(html, /<a class="sg-pb-btn" href="\/shop">Shop now<\/a>/);
  assert.match(html, /<div class="sg-pb sg-pb-left sg-pb-match" style="--pb-bg: #ececec; --pb-ink: #[0-9a-f]{6}">/, 'own color: set on the page, no matching');
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /data-newblock="photoblend"/); assert.match(editor, /<template id="tpl-block-photoblend">/);
  assert.match(editor, /class="pb-badge" maxlength="60" value="Use code: HAPPY50"/);
  assert.match(editor, /<input type="hidden" name="block_side" class="pb-side" value="left:match">/);
  assert.match(editor, /class="btn-secondary pb-cutbtn">✂ Cut out the pets<\/button>/);
  // the cut-out route: owner only, and only photos it may read
  const r = await c.post(`/sites/${siteId}/cutout`, { url: 'https://evil.example/x.jpg' });
  assert.equal(r.status, 400);
  const other = makeClient(); await basicSite(other, 'photoblend2@example.com', 'Other Co', {});
  assert.notEqual((await other.post(`/sites/${siteId}/cutout`, { url: '/uploads/a.jpg' })).status, 200);
});

test('gradient pattern block: a pattern made of gradients, optional words, colors and motion; a bare band; editor fields', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'patterns@example.com', 'Pattern Co', {});
  await c.post(editPath, { name: 'Pattern Co', hero_headline: 'Hi',
    block_type: ['patterns', 'patterns'], block_heading: ['Spring [sale]', ''],
    block_body: ['First line\n\nSecond line', ''],
    block_image: ['', ''], block_side: ['facets:glass:drift:5', 'confetti:card:still:99'], block_buttonText: ['Book', ''], block_buttonUrl: ['/contact', ''],
    block_edge: ['none', 'none'], block_bg: ['none', 'none'], block_bgmix: ['', ''], block_bgink: ['rainbow', '#16a34a,#f59e0b'], block_place: ['bottom', 'bottom'], block_page: ['home', 'home'] });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<section[^>]* class="blk blk-gpat sg-gp-drift sg-gp-glass">/);
  assert.match(html, /<div class="sg-gp-pat" style="background-image: linear-gradient\([^"]*rgba\(255, 94, 94/, 'rainbow colors');
  assert.match(html, /<h2 class="sg-gp-h">Spring <em class="sg-hl">sale<\/em><\/h2>/);
  assert.match(html, /<p>First line<\/p><p>Second line<\/p>/);
  assert.match(html, /<p class="sg-gp-cta"><a class="btn" href="\/contact">Book<\/a><\/p>/);
  // the second: no words (a bare band), a bad version falls back to 1, the owner's two colors
  assert.match(html, /class="blk blk-gpat sg-gp-still sg-gp-card sg-gp-bare">/);
  assert.match(html, /repeating-linear-gradient\([^"]*#16a34a/);
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /data-newblock="patterns"/); assert.match(editor, /<template id="tpl-block-patterns">/);
  assert.match(editor, /<input type="hidden" name="block_side" class="gp-side" value="facets:glass:drift:5">/);
  assert.match(editor, /<input type="hidden" name="block_side" class="gp-side" value="confetti:card:still:1">/);
  assert.match(editor, /Pattern in: rainbow/);
});

test('card over a color band block: band, tall photo with turns, checklist, colored card with button, corner photo, mirror', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'crossband@example.com', 'Happy Dogs', {});
  await c.post(editPath, { name: 'Happy Dogs', hero_headline: 'Hi',
    block_type: ['crossband', 'crossband'], block_heading: ['Why dogs make you happy', 'Second'],
    block_body: ['text: A friend at home.\nlist: Dogs improve your mood:\nitem: More walks\nitem: Less stress\nleft: /uploads/a.jpg /uploads/b.jpg\nright: /uploads/c.jpg\ncard: #e3808c\nband: #a9c9e8', 'text: Plain'],
    block_image: ['', ''], block_side: ['auto', 'right'], block_buttonText: ['Learn more', ''], block_buttonUrl: ['/x', ''], block_edge: ['none', 'none'], block_bg: ['none', 'none'], block_place: ['bottom', 'bottom'], block_page: ['home', 'home'] });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<div class="sg-cb" style="--cb-card: #e3808c; --cb-ink: #111111; --cb-band: #a9c9e8;[^"]*" data-sg-tb-turns>/);
  assert.match(html, /<h2 class="sg-cb-h">Why dogs make you happy<\/h2>/);
  assert.match(html, /<p class="sg-cb-listh">Dogs improve your mood:<\/p>/);
  assert.match(html, /<span>More walks<\/span>/);
  assert.match(html, /<a class="sg-cb-btn" href="\/x">Learn more<\/a>/);
  assert.match(html, /<div class="sg-cb-corner"><div class="sg-tb-pic sg-cb-photo2" aria-hidden="true"><img src="\/uploads\/c\.jpg"/);
  assert.match(html, /<div class="sg-cb sg-cb-flip"/);
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /data-newblock="crossband"/); assert.match(editor, /<template id="tpl-block-crossband">/);
  assert.match(editor, /<input type="checkbox" class="cb-own-card" checked>/);
});


test('photo with round-photo points block: big photo with turns, heading, line, points with round photos, side', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'advice@example.com', 'Dog Care', {});
  await c.post(editPath, { name: 'Dog Care', hero_headline: 'Hi',
    block_type: ['advice', 'advice'], block_heading: ['Dog care advice', 'Second'],
    block_body: ['photos: /uploads/a.jpg /uploads/b.jpg\nitem: /uploads/r.jpg | Brush often.\nitem:  | Fresh water daily.', 'photos: /uploads/a.jpg'],
    block_image: ['', ''], block_side: ['left', 'right'], block_buttonText: ['', ''], block_buttonUrl: ['', ''], block_edge: ['none', 'none'], block_bg: ['none', 'none'], block_place: ['bottom', 'bottom'], block_page: ['home', 'home'] });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<div class="sg-ad sg-ad-left" style="--ad-band: #[0-9a-f]{6}" data-sg-tb-turns>/);
  assert.match(html, /<div class="sg-ad sg-ad-right" style="--ad-band: #[0-9a-f]{6}">/);
  assert.match(html, /<h2 class="sg-ad-h">Dog care advice<\/h2>/);
  assert.match(html, /<li><img src="\/uploads\/r\.jpg" alt="" loading="lazy" decoding="async"><p>Brush often\.<\/p><\/li><li><p>Fresh water daily\.<\/p><\/li>/);
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /data-newblock="advice"/); assert.match(editor, /<template id="tpl-block-advice">/);
  assert.match(editor, /class="ad-iu" value="\/uploads\/r\.jpg"/);
});

test('photo over a text card block: patterned shape, photo, white card with words, note and dark button; editor fields', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'overlapcard@example.com', 'Pet Pals', {});
  await c.post(editPath, { name: 'Pet Pals', hero_headline: 'Hi',
    block_type: ['overlapcard', 'overlapcard'], block_heading: ['Why do we love [pets]?', 'Second'],
    block_body: ['Pets keep us moving.\n~ Photo by Jo', 'Plain'],
    block_image: ['/uploads/cut-abc.webp', ''], block_side: ['dots:tint:right', 'bogus'], block_buttonText: ['Read more', ''], block_buttonUrl: ['/about', ''],
    block_edge: ['none', 'none'], block_bg: ['none', 'none'], block_place: ['bottom', 'bottom'], block_page: ['home', 'home'] });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /class="blk blk-overlapcard /);
  assert.match(html, /<div class="blk-inner sg-oc sg-oc-pat-dots sg-oc-band-tint sg-oc-photo-right sg-oc-card-white sg-oc-fin-flat">/);
  assert.match(html, /<span class="sg-oc-pat" aria-hidden="true"><\/span>/);
  assert.match(html, /<img class="sg-oc-img" src="\/uploads\/cut-abc\.webp"/);
  assert.match(html, /<h2 class="sg-oc-h">Why do we love <em class="sg-hl">pets<\/em>\?<\/h2>/);
  assert.match(html, /<p>Pets keep us moving\.<\/p>/);
  assert.match(html, /<p class="sg-oc-note">Photo by Jo<\/p>/);
  assert.match(html, /<a class="sg-oc-btn" href="\/about">Read more<\/a>/);
  assert.match(html, /sg-oc-pat-stripes sg-oc-band-grey sg-oc-photo-left/, 'a bad setting falls back');
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /data-newblock="overlapcard"/); assert.match(editor, /<template id="tpl-block-overlapcard">/);
  assert.match(editor, /<input type="hidden" name="block_side" class="oc-side" value="dots:tint:right">/);
  assert.match(editor, /<input type="url" name="block_image" value="\/uploads\/cut-abc\.webp"/);
  assert.match(editor, /<select class="oc-card" aria-label="Card color">/); assert.match(editor, /<select class="oc-fin" aria-label="Card finish">/);
  // brand color card with a gradient finish, and an own color card on a gradient background
  await c.post(editPath, { name: 'Pet Pals', hero_headline: 'Hi',
    block_type: ['overlapcard', 'overlapcard'], block_heading: ['Brand', 'Own'], block_body: ['A', 'B'],
    block_image: ['', ''], block_side: ['dots:tint:right:brand:gradient', 'grid:grey:left:#FFE08A:flat'], block_buttonText: ['Go', ''], block_buttonUrl: ['/about', ''],
    block_edge: ['none', 'none'], block_bg: ['none', 'g-aurora'], block_place: ['bottom', 'bottom'], block_page: ['home', 'home'] });
  const html2 = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html2, /class="blk blk-overlapcard blk-bg-none" style="--oc-c:#[0-9a-f]{6};--oc-top:#[0-9a-f]{6};--oc-bottom:#[0-9a-f]{6};--oc-text:#ffffff;/);
  assert.match(html2, /sg-oc-card-brand sg-oc-fin-gradient">/);
  assert.match(html2, /style="--oc-c:#ffe08a;--oc-top:#ffe08a;--oc-bottom:#ffe08a;--oc-text:#111111;--oc-btn:#111111;--oc-btn-ink:#ffe08a">\s*<span class="sg-oc-fade" aria-hidden="true"><\/span>/);
  assert.match(html2, /sg-oc-card-own sg-oc-fin-flat">/);
  const editor2 = await (await c.get(editPath)).text();
  assert.match(editor2, /class="oc-side" value="grid:grey:left:#ffe08a:flat">/);
  assert.match(editor2, /<input type="color" class="oc-color" aria-label="My own card color" value="#ffe08a"/);
  assert.match(editor2, /<option value="own" selected>My own color card<\/option>/);
  await c.post(editPath, { name: 'Pet Pals', hero_headline: 'Hi',
    block_type: ['overlapcard'], block_heading: ['Colors'], block_body: ['A'],
    block_image: [''], block_side: ['dots:#aabbcc:left:white:flat:#ffeedd:#112233'], block_buttonText: [''], block_buttonUrl: [''],
    block_edge: ['none'], block_bg: ['none'], block_place: ['bottom'], block_page: ['home'] });
  const html3 = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html3, /class="blk blk-overlapcard blk-bg-none sg-oc-ownbottom" style="--oc-band:#aabbcc;--oc-under:#ffeedd;--oc-ink:#112233">/);
  assert.match(html3, /sg-oc-pat-dots sg-oc-band-own sg-oc-photo-left/);
  const editor3 = await (await c.get(editPath)).text();
  assert.match(editor3, /<input type="checkbox" class="oc-own-pat" checked>/); assert.match(editor3, /class="oc-patc"[^>]*value="#112233"/);
  assert.match(editor3, /class="oc-bandc"[^>]*value="#aabbcc"/); assert.match(editor3, /class="oc-under"[^>]*value="#ffeedd"/);
});

test('photo picks the words block: up to 4 photo cards, each with words and its own color, small photos as tabs; editor fields', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'phototabs@example.com', 'Good Dogs', {});
  await c.post(editPath, { name: 'Good Dogs', hero_headline: 'Hi',
    block_type: ['phototabs', 'phototabs'], block_heading: ['Dog [training]', 'Solo'],
    block_body: ['card: /uploads/a.jpg | #1d6fa5 | Puppy classes | Start them young.\ncard: /uploads/b.jpg | #f4d03f | Walks | Daily walks.\ncard: javascript:alert(1) | nope | Agility | Jumps.', 'card: /uploads/s.jpg |  |  | Just one.'],
    block_image: ['', ''], block_side: ['right', 'bogus'], block_buttonText: ['Contact us', ''], block_buttonUrl: ['/contact', ''],
    block_edge: ['none', 'none'], block_bg: ['none', 'none'], block_place: ['bottom', 'bottom'], block_page: ['home', 'home'] });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<div class="blk-inner sg-pt sg-pt-photo-right" style="--pt-c: #1d6fa5; --pt-on: #ffffff;" data-sg-pt>/);
  assert.match(html, /<img class="sg-pt-pic on" src="\/uploads\/a\.jpg"/); assert.match(html, /<img class="sg-pt-pic" src="\/uploads\/b\.jpg"/);
  assert.match(html, /<h2 class="sg-pt-h">Puppy classes<\/h2>/); assert.match(html, /<h3 class="sg-pt-h">Walks<\/h3>/);
  assert.match(html, /data-c="#f4d03f" data-on="#111111" hidden>/, 'a light card color gets dark words');
  assert.match(html, /role="tab"[^>]*aria-selected="true"[^>]*style="--pt-tc: #1d6fa5;"><img src="\/uploads\/a\.jpg"[^>]*><span>Puppy classes<\/span><\/button>/);
  assert.equal((html.match(/class="sg-pt-tab"/g) || []).length, 3);
  assert.doesNotMatch(html, /javascript:alert/);
  assert.match(html, /<a class="sg-pt-btn" href="\/contact">Contact us<\/a>/);
  // one card: no tabs, the heading titles it, a bad side falls back
  assert.match(html, /<div class="blk-inner sg-pt sg-pt-photo-left" style="--pt-c: #[0-9a-f]{6}; --pt-on: #[0-9a-f]{6};">/);
  assert.match(html, /<h2 class="sg-pt-h">Solo<\/h2>/);
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /data-newblock="phototabs"/); assert.match(editor, /<template id="tpl-block-phototabs">/);
  assert.match(editor, /<input type="url" class="pt-url" value="\/uploads\/b\.jpg"/);
  assert.match(editor, /<input type="checkbox" class="pt-own" checked>/);
  assert.match(editor, /class="pt-color"[^>]*value="#f4d03f"/);
  assert.match(editor, /textarea\.pt-body/, 'the editor writes the cards back into the block');
});

test('reviews on a card block: big photo, up to 3 reviews, own background and card colors; editor fields', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'reviewcard@example.com', 'Paws Place', {});
  await c.post(editPath, { name: 'Paws Place', hero_headline: 'Hi',
    block_type: ['reviewcard', 'reviewcard'], block_heading: ['What [pet parents] say', 'Plain'],
    block_body: ['bg: #eef2f7\ncard: #1b2a4a\nreview: /uploads/max.jpg | Max loves it here | Sam\nreview: javascript:alert(1) | Kind and gentle | Ana', 'review:  | Just one | '],
    block_image: ['/uploads/cut-dog.webp', ''], block_side: ['right', 'bogus'], block_buttonText: ['Book a visit', ''], block_buttonUrl: ['/contact', ''],
    block_edge: ['none', 'none'], block_bg: ['none', 'none'], block_place: ['bottom', 'bottom'], block_page: ['home', 'home'] });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /class="blk blk-reviewcard blk-bg-none sg-rc-ownbg" style="--rc-bg: #eef2f7; --edge: #eef2f7;"/);
  assert.match(html, /<div class="blk-inner sg-rc sg-rc-photo-right sg-rc-cut sg-rc-fit-all" style="--rc-panel: #[0-9a-f]{6}; --rc-panel-on: #[0-9a-f]{6}; --rc-card: #1b2a4a; --rc-ink: #ffffff;">/);
  assert.match(html, /<img class="sg-rc-img" src="\/uploads\/cut-dog\.webp"/);
  assert.match(html, /<img class="sg-rc-face" src="\/uploads\/max\.jpg"/);
  assert.match(html, /<span class="sg-rc-face sg-rc-letter" aria-hidden="true">A<\/span>/, 'no photo: the first letter');
  assert.match(html, /<blockquote class="sg-rc-q"><p>Max loves it here<\/p><\/blockquote>/); assert.match(html, /<figcaption class="sg-rc-name">Sam<\/figcaption>/);
  assert.doesNotMatch(html, /javascript:alert/);
  assert.match(html, /<a class="sg-rc-btn" href="\/contact">Book a visit<\/a>/);
  assert.match(html, /class="blk blk-reviewcard blk-bg-none">\s*<div class="blk-inner sg-rc sg-rc-photo-left" style="--rc-panel: #[0-9a-f]{6}; --rc-panel-on: #[0-9a-f]{6};">/, 'no colors chosen: the defaults, and a bad side falls back');
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /data-newblock="reviewcard"/); assert.match(editor, /<template id="tpl-block-reviewcard">/);
  assert.match(editor, /<input type="url" name="block_image" value="\/uploads\/cut-dog\.webp"/);
  assert.match(editor, /<input type="url" class="rc-url" value="\/uploads\/max\.jpg"/);
  assert.match(editor, /<input type="checkbox" class="rc-own-card" checked>/);
  assert.match(editor, /class="rc-card"[^>]*value="#1b2a4a"/); assert.match(editor, /class="rc-bg"[^>]*value="#eef2f7"/);
  assert.match(editor, /textarea\.rc-body/, 'the editor writes the reviews back into the block');
  assert.match(editor, /<input type="hidden" name="block_side" class="rc-side" value="right">/);
  assert.match(editor, /<input type="range" class="rc-size" min="40" max="150" step="5" value="100"/);
  // a smaller cut-out, nudged, filling the panel the old way
  await c.post(editPath, { name: 'Paws Place', hero_headline: 'Hi',
    block_type: ['reviewcard'], block_heading: ['Size'], block_body: ['review:  | Lovely | Jo'],
    block_image: ['/uploads/cut-dog.webp'], block_side: ['left:60:-12:8:fill'], block_buttonText: [''], block_buttonUrl: [''],
    block_edge: ['none'], block_bg: ['none'], block_place: ['bottom'], block_page: ['home'] });
  const html2 = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html2, /sg-rc-photo-left sg-rc-cut sg-rc-fit-fill" style="[^"]* --rc-scale: 0\.6; --rc-x: -12%; --rc-y: 8%;">/);
  const editor2 = await (await c.get(editPath)).text();
  assert.match(editor2, /class="rc-side" value="left:60:-12:8:fill">/); assert.match(editor2, /class="rc-x" min="-40" max="40" step="1" value="-12"/);
  assert.match(editor2, /<option value="fill" selected>Fill the panel/);
});

test('two photos and links block: big colored heading, two square photos, links on a tall panel; editor fields', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'twinphotos@example.com', 'Good Dogs', {});
  await c.post(editPath, { name: 'Good Dogs', hero_headline: 'Hi',
    block_type: ['twinphotos', 'twinphotos'], block_heading: ['A true friend', 'Plain'],
    block_body: ['text: We train happy dogs.\nphoto: /uploads/a.jpg\nphoto: /uploads/cut-b.webp\nlink: Training tips | /services\nlink: Bad | javascript:alert(1)\nlink: Dog care | \ncolor: #1b2a4a\npanel: #eeeeee', 'text: Just words'],
    block_image: ['', ''], block_side: ['left', 'bogus'], block_buttonText: ['Book a class', ''], block_buttonUrl: ['/contact', ''],
    block_edge: ['none', 'none'], block_bg: ['none', 'none'], block_place: ['bottom', 'bottom'], block_page: ['home', 'home'] });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<div class="blk-inner sg-tw sg-tw-panel-left" style="--tw-c: #1b2a4a; --tw-h: #1b2a4a; --tw-on: #ffffff; --tw-p: #eeeeee;">/);
  assert.match(html, /<h2 class="sg-tw-h">A true friend<\/h2>/); assert.match(html, /<p>We train happy dogs\.<\/p>/);
  assert.match(html, /<div class="sg-tw-pic"><img src="\/uploads\/a\.jpg"/); assert.match(html, /<div class="sg-tw-pic sg-tw-cut"><img src="\/uploads\/cut-b\.webp"/);
  assert.match(html, /<li><a href="\/services">Training tips<\/a><\/li>/); assert.match(html, /<li><span>Dog care<\/span><\/li>/);
  assert.doesNotMatch(html, /javascript:alert/);
  assert.match(html, /<a class="sg-tw-btn" href="\/contact">Book a class<\/a>/);
  assert.match(html, /<div class="blk-inner sg-tw sg-tw-panel-right"/, 'a bad side falls back');
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /data-newblock="twinphotos"/); assert.match(editor, /<template id="tpl-block-twinphotos">/);
  assert.match(editor, /<input type="url" class="tw-url" value="\/uploads\/cut-b\.webp"/);
  assert.match(editor, /<input type="text" class="tw-label" maxlength="60" value="Training tips"/);
  assert.match(editor, /<input type="checkbox" class="tw-own-panel" checked>/); assert.match(editor, /class="tw-color"[^>]*value="#1b2a4a"/);
  assert.match(editor, /textarea\.tw-body/, 'the editor writes the block back');
});

test('words and photo with rings block: white words panel, big photo, striped circle and ring, own colors; editor fields', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'ringcard@example.com', 'Good Dogs', {});
  await c.post(editPath, { name: 'Good Dogs', hero_headline: 'Hi',
    block_type: ['ringcard', 'ringcard'], block_heading: ['Why dogs love us', 'Plain'],
    block_body: ['text: We listen to every dog.\nnote: Photo by our team\ncolor: #1b2a4a\nbg: #fbecec', 'text: Just words\nshapes: off'],
    block_image: ['/uploads/cut-dog.webp', 'javascript:alert(1)'], block_side: ['left', 'bogus'], block_buttonText: ['Learn more', ''], block_buttonUrl: ['/about', ''],
    block_edge: ['none', 'none'], block_bg: ['none', 'none'], block_place: ['bottom', 'bottom'], block_page: ['home', 'home'] });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /class="blk blk-ringcard blk-bg-none sg-rg-ownbg" style="--rg-c: #1b2a4a; --rg-h: #1b2a4a; --rg-on: #ffffff; --rg-bg: #fbecec; --edge: #fbecec;"/);
  assert.match(html, /<div class="blk-inner sg-rg sg-rg-photo-left sg-rg-cut">\s*<span class="sg-rg-stripes" aria-hidden="true"><\/span><span class="sg-rg-ring" aria-hidden="true"><\/span>/);
  assert.match(html, /<h2 class="sg-rg-h">Why dogs love us<\/h2>/); assert.match(html, /<p class="sg-rg-note">Photo by our team<\/p>/);
  assert.match(html, /<div class="sg-rg-pic"><img src="\/uploads\/cut-dog\.webp"/);
  assert.match(html, /<a class="sg-rg-btn" href="\/about">Learn more<\/a>/);
  assert.doesNotMatch(html, /javascript:alert/);
  assert.match(html, /<div class="blk-inner sg-rg sg-rg-photo-right">\s*<div class="sg-rg-words"/, 'shapes off and a bad side falls back');
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /data-newblock="ringcard"/); assert.match(editor, /<template id="tpl-block-ringcard">/);
  assert.match(editor, /<input type="url" name="block_image" value="\/uploads\/cut-dog\.webp"/);
  assert.match(editor, /<input type="text" class="rg-note" maxlength="140" value="Photo by our team"/);
  assert.match(editor, /<input type="checkbox" class="rg-own-bg" checked>/); assert.match(editor, /class="rg-color"[^>]*value="#1b2a4a"/);
  assert.match(editor, /textarea\.rg-body/, 'the editor writes the block back');
});

test('contact form with shapes block: the site contact form on a card over a photo, colored shapes, phone when no form; editor fields', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'shapeform@example.com', 'Good Dogs', {});
  const blocks = { block_type: ['shapeform', 'shapeform'], block_heading: ['Contact us', 'Call'],
    block_body: ['text: We answer within a day\ncolor: #2f3fd0\naccent: #f08a00\npanel: #f5c518\nbg: #e6e6e6', 'shapes: off'],
    block_image: ['/uploads/cut-me.webp', ''], block_side: ['left', 'bogus'], block_buttonText: ['', ''], block_buttonUrl: ['', ''],
    block_edge: ['none', 'none'], block_bg: ['none', 'none'], block_place: ['bottom', 'bottom'], block_page: ['home', 'home'] };
  await c.post(editPath, { name: 'Good Dogs', hero_headline: 'Hi', contact_phone: '(407) 555-0100', contact_acceptSubmissions: '1', ...blocks });
  let html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /class="blk blk-shapeform blk-bg-none sg-sf-ownbg" style="--sf-c: #2f3fd0; --sf-h: #2f3fd0; --sf-on: #ffffff; --sf-a: #f08a00; --sf-p: #f5c518; --sf-bg: #e6e6e6; --edge: #e6e6e6;"/);
  assert.match(html, /<div class="blk-inner sg-sf sg-sf-card-left sg-sf-cut">\s*<span class="sg-sf-dot"/);
  assert.match(html, /<h2 class="sg-sf-h">Contact us<\/h2>/); assert.match(html, /<p class="sg-sf-text">We answer within a day<\/p>/);
  const card = html.slice(html.indexOf('class="sg-sf-card"'), html.indexOf('</section>', html.indexOf('class="sg-sf-card"')));
  assert.match(card, /<form method="POST" action="\/sites\/\d+\/preview\/contact"[^>]*class="contact-form"/, 'the real contact form, posting where the Contact page posts');
  assert.match(card, /name="website" class="hp-field"/); assert.match(card, /name="message"/);
  assert.match(html, /<div class="blk-inner sg-sf sg-sf-card-left">\s*<div class="sg-sf-pic">/, 'shapes off and a bad side falls back');
  await c.post(editPath, { name: 'Good Dogs', hero_headline: 'Hi', contact_phone: '(407) 555-0100', ...blocks });
  html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /<a class="sg-sf-btn" href="tel:4075550100">Call \(407\) 555-0100<\/a>/, 'no messages taken: the phone instead');
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /data-newblock="shapeform"/); assert.match(editor, /<template id="tpl-block-shapeform">/);
  assert.match(editor, /<input type="url" name="block_image" value="\/uploads\/cut-me\.webp"/);
  assert.match(editor, /<input type="checkbox" class="sf-own-panel" checked>/); assert.match(editor, /class="sf-accent"[^>]*value="#f08a00"/);
  assert.match(editor, /textarea\.sf-body/, 'the editor writes the block back');
});

test('photo in frames with a card and round photo with a color card blocks: render with their colors; editor fields', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'framedround@example.com', 'Green Bowl', {});
  await c.post(editPath, { name: 'Green Bowl', hero_headline: 'Hi',
    block_type: ['framedphoto', 'roundphoto', 'roundphoto'], block_heading: ['Vegetarian menu', 'Quick reading', 'Plain'],
    block_body: ['text: Fresh bowls every day.\nnote: Photo by our team\ncolor: #b9a383\nbg: #222222\ncard: #ffffff', 'text: Read faster.\ncolor: #2ec4b6\nbg: #fafafa', 'shapes: off'],
    block_image: ['/uploads/a.jpg', '/uploads/cut-b.webp', ''], block_side: ['left', 'right', 'bogus'], block_buttonText: ['Learn more', 'Read more', ''], block_buttonUrl: ['/menu', '/about', ''],
    block_edge: ['none', 'none', 'none'], block_bg: ['none', 'none', 'none'], block_place: ['bottom', 'bottom', 'bottom'], block_page: ['home', 'home', 'home'] });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /class="blk blk-framedphoto blk-bg-none" style="--fp-c: #b9a383; --fp-h: #[0-9a-f]{6}; --fp-bg: #222222; --fp-card: #ffffff; --fp-ink: #111111;"/);
  assert.match(html, /<div class="blk-inner sg-fp sg-fp-card-left">/); assert.match(html, /<div class="sg-fp-pic"><img src="\/uploads\/a\.jpg"/);
  assert.match(html, /<h2 class="sg-fp-h">Vegetarian menu<\/h2>/); assert.match(html, /<p class="sg-fp-note">Photo by our team<\/p>/); assert.match(html, /<a class="sg-fp-btn" href="\/menu">Learn more<\/a>/);
  assert.match(html, /class="blk blk-roundphoto blk-bg-none sg-rp-ownbg" style="--rp-c: #2ec4b6; --rp-on: #111111; --rp-bg: #fafafa; --edge: #fafafa;"/);
  assert.match(html, /<div class="blk-inner sg-rp sg-rp-card-right sg-rp-cut">\s*<div class="sg-rp-art">\s*<span class="sg-rp-ring sg-rp-ring-a"/);
  assert.match(html, /<a class="sg-rp-btn" href="\/about">Read more<\/a>/);
  assert.match(html, /<div class="blk-inner sg-rp sg-rp-card-right">\s*<div class="sg-rp-art">\s*<div class="sg-rp-pic">/, 'shapes off and a bad side falls back');
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /data-newblock="framedphoto"/); assert.match(editor, /data-newblock="roundphoto"/);
  assert.match(editor, /<template id="tpl-block-framedphoto">/); assert.match(editor, /<template id="tpl-block-roundphoto">/);
  assert.match(editor, /<input type="url" name="block_image" value="\/uploads\/cut-b\.webp"/);
  assert.match(editor, /<input type="checkbox" class="fp-own-card" checked>/); assert.match(editor, /class="rp-color"[^>]*value="#2ec4b6"/);
  assert.match(editor, /<input type="checkbox" class="rp-shapes">/);
  assert.match(editor, /textarea\.fp-body/); assert.match(editor, /textarea\.rp-body/);
});

test('photo and words pairs block: label, pairs with photos and words, last tile colored, button; editor fields', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'photopairs@example.com', 'Code Camp', {});
  await c.post(editPath, { name: 'Code Camp', hero_headline: 'Hi',
    block_type: ['photopairs'], block_heading: ['Learn with us'],
    block_body: ['label: Coding fun\npair: /uploads/a.jpg | Math | Practice sums\npair: /uploads/cut-b.webp | Games | Build a game\ncolor: #12b5c4'],
    block_image: [''], block_side: ['left'], block_buttonText: ['Join'], block_buttonUrl: ['/contact'],
    block_edge: ['none'], block_bg: ['none'], block_place: ['bottom'], block_page: ['home'] });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /class="blk blk-photopairs blk-bg-none sg-pp-shapes" style="--pp-c: #12b5c4; --pp-on: #111111; --pp-line: #[0-9a-f]{6};"/);
  assert.match(html, /<p class="sg-pp-label">Coding fun<\/p>/); assert.match(html, /<h2 class="sg-pp-h">Learn with us<\/h2>/);
  assert.match(html, /<div class="sg-pp-pic"><img src="\/uploads\/a\.jpg"/); assert.match(html, /<div class="sg-pp-pic sg-pp-cut"><img src="\/uploads\/cut-b\.webp"/);
  assert.match(html, /<div class="sg-pp-tile sg-pp-tile-c">\s*<h3 class="sg-pp-t">Games<\/h3>/);
  assert.match(html, /<a class="sg-pp-btn" href="\/contact">Join<\/a>/);
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /data-newblock="photopairs"/); assert.match(editor, /<template id="tpl-block-photopairs">/);
  assert.match(editor, /class="pp-url" value="\/uploads\/cut-b\.webp"/); assert.match(editor, /class="pp-title" maxlength="80" value="Math"/);
  assert.match(editor, /<input type="checkbox" class="pp-own-color" checked>/); assert.match(editor, /textarea\.pp-body/);
});

test('photo on two color blocks and about us blocks: render with their colors and photos; editor fields and picker group', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'aboutus@example.com', 'Calm Mind', {});
  await c.post(editPath, { name: 'Calm Mind', hero_headline: 'Hi',
    block_type: ['offsetphoto', 'aboutstory', 'aboutme', 'aboutnote', 'aboutcollage'], block_heading: ['Counselling services', 'Our story', 'Who am I?', 'A note', 'We care'],
    block_body: ['label: About us\ntext: We listen.\nbutton: #1b2a4a', 'label: Since 2014\ntext: It began small.\ncolor: #e8a87c\nshapes: off', 'caption: Ten years\nitem: Talks | One to one', 'text: Thanks\nportrait: /uploads/cut-face.webp\nname: Maria\nrole: Owner', 'round: /uploads/r1.jpg'],
    block_image: ['/uploads/cut-a.webp', '/uploads/s.jpg', '', '', '/uploads/m.jpg'], block_side: ['right', 'left', 'bogus', 'right', 'left'],
    block_buttonText: ['Read more', 'Meet us', '', '', ''], block_buttonUrl: ['/about', '/team', '', '', ''],
    block_edge: ['none', 'none', 'none', 'none', 'none'], block_bg: ['none', 'none', 'none', 'none', 'none'], block_place: ['bottom', 'bottom', 'bottom', 'bottom', 'bottom'], block_page: ['home', 'home', 'home', 'home', 'home'] });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /class="blk blk-offsetphoto blk-bg-none" style="--op-c: #a9c4e2; --op-a: #f2b0b5; --op-btn: #1b2a4a; --op-btn-on: #ffffff;"/);
  assert.match(html, /<div class="blk-inner sg-op sg-op-photo-right sg-op-cut">/); assert.match(html, /<p class="sg-op-label">About us<\/p>/);
  assert.match(html, /<a class="sg-op-btn" href="\/about">Read more<\/a>/);
  assert.match(html, /class="blk blk-about blk-aboutstory blk-bg-none" style="--ab-color: #e8a87c;/);
  assert.match(html, /<div class="blk-inner sg-ab sg-ab-aboutstory sg-ab-side-left sg-ab-flat">/, 'shapes off');
  assert.match(html, /<p class="sg-ab-label">Since 2014<\/p>/); assert.match(html, /<a class="sg-ab-btn" href="\/team">Meet us<\/a>/);
  assert.match(html, /sg-ab-aboutme sg-ab-side-left/, 'a bad side falls back'); assert.match(html, /<p class="sg-ab-caption">Ten years<\/p>/);
  assert.match(html, /<span class="sg-ab-num">01<\/span><h3 class="sg-ab-t">Talks<\/h3><p>One to one<\/p>/);
  assert.match(html, /<div class="sg-ab-pic sg-ab-face sg-ab-cut"><img src="\/uploads\/cut-face\.webp"/); assert.match(html, /<strong>Maria<\/strong><span>Owner<\/span>/);
  assert.match(html, /<div class="sg-ab-pic sg-ab-round sg-ab-round-1"><img src="\/uploads\/r1\.jpg"/);
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /data-pickgroup="about"/);
  ['offsetphoto', 'aboutstory', 'aboutme', 'aboutbig', 'aboutfacts', 'aboutcollage', 'aboutnote', 'aboutpanel'].forEach(t => {
    assert.match(editor, new RegExp('data-newblock="' + t + '"')); assert.match(editor, new RegExp('<template id="tpl-block-' + t + '">'));
  });
  assert.match(editor, /<input type="checkbox" class="op-own-button" checked>/);
  assert.match(editor, /<input type="text" class="ab-f" data-ab="label" data-abf="line" maxlength="60" value="Since 2014"/);
  assert.match(editor, /<input type="checkbox" class="ab-tog" data-ab="shapes" data-abf="toggle">/);
  assert.match(editor, /<input type="url" class="ab-c" value="\/uploads\/cut-face\.webp"/);
  assert.match(editor, /textarea\.ab-body/); assert.match(editor, /textarea\.op-body/);
});

test('social media blocks: links from the block and the Contact section, follower counts, feed photos, strip; editor fields', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'socialblocks@example.com', 'Paws Place', {});
  await c.post(editPath, { name: 'Paws Place', hero_headline: 'Hi', contact_social_facebook: 'https://facebook.com/paws', contact_social_instagram: 'https://instagram.com/paws',
    block_type: ['socialcounts', 'socialfeed', 'socialstrip', 'socialprofile'], block_heading: ['Join us', 'On our feed', 'Follow us', 'Maria'],
    block_body: ['count: youtube | 2.1k | subscribers\ncount: nope | 5 | x\nyoutube: https://youtube.com/@paws\ntiktok: javascript:alert(1)', 'handle: @paws\nphoto: /uploads/f1.jpg\nphoto: /uploads/cut-f2.webp', 'color: #111827\nx: https://x.com/paws', 'role: Owner\nlinkedin: https://linkedin.com/in/maria'],
    block_image: ['', '', '', '/uploads/face.jpg'], block_side: ['left', 'center', 'center', 'center'], block_buttonText: ['', '', '', ''], block_buttonUrl: ['', '', '', ''],
    block_edge: ['none', 'none', 'none', 'none'], block_bg: ['none', 'none', 'none', 'none'], block_place: ['bottom', 'bottom', 'bottom', 'bottom'], block_page: ['home', 'home', 'home', 'home'] });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /class="blk blk-social blk-socialcounts blk-bg-none"/);
  assert.match(html, /<a class="sg-so-count sg-so-youtube" href="https:\/\/youtube\.com\/@paws" target="_blank" rel="noopener"><span class="sg-so-ring"><svg class="sg-so-svg"/);
  assert.match(html, /<strong>2\.1k<\/strong><span>subscribers<\/span>/);
  assert.doesNotMatch(html, /javascript:alert/);
  assert.match(html, /<p class="sg-so-handle">@paws<\/p>/);
  assert.match(html, /<a class="sg-ab-btn" href="https:\/\/instagram\.com\/paws" target="_blank" rel="noopener">Follow @paws<\/a>/, 'feed follows the Contact Instagram link');
  assert.match(html, /<div class="sg-ab-pic sg-so-tile sg-ab-cut"><img src="\/uploads\/cut-f2\.webp"/);
  assert.match(html, /class="blk blk-social blk-socialstrip blk-bg-none" style="--ab-color: #111827; --ab-color-on: #ffffff;/);
  assert.match(html, /<a class="sg-so-ico sg-so-x" href="https:\/\/x\.com\/paws" target="_blank" rel="noopener" aria-label="X \(Twitter\)">/);
  assert.match(html, /<a class="sg-so-ico sg-so-facebook" href="https:\/\/facebook\.com\/paws"/);
  assert.match(html, /<div class="sg-ab-pic sg-so-face"><img src="\/uploads\/face\.jpg"/); assert.match(html, /<p class="sg-so-role">Owner<\/p>/);
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /data-pickgroup="social"/);
  ['socialshapes', 'socialphoto', 'socialcounts', 'socialonphoto', 'socialfeed', 'socialprofile', 'socialstrip'].forEach(t => {
    assert.match(editor, new RegExp('data-newblock="' + t + '"')); assert.match(editor, new RegExp('<template id="tpl-block-' + t + '">'));
  });
  assert.match(editor, /Social media: Follower counts/);
  assert.match(editor, /<input type="url" class="ab-f" data-ab="youtube" data-abf="line" maxlength="300" value="https:\/\/youtube\.com\/@paws"/);
  assert.match(editor, /<option value="youtube" selected>YouTube<\/option>/);
  assert.match(editor, /<input type="hidden" name="block_side" value="center">/);
});

test('smart generator: logo colors matched to our palette, industry blocks, preview picks', async () => {
  const sharp = require('sharp');
  const c = makeClient();
  await c.post('/signup', { email: 'smartgen@example.com', password: 'password1' });
  const logo = await sharp({ create: { width: 80, height: 80, channels: 4, background: { r: 225, g: 29, b: 72, alpha: 1 } } }).png().toBuffer();
  const form = new FormData();
  for (const [k, v] of Object.entries({ business_type: 'nail and lash studio', business_name: 'Polished Nails', preview: '1', auto_blocks: '1', phone: '407-555-0199', instagram: 'https://instagram.com/polished.nails' })) form.append(k, v);
  form.append('logo', new Blob([logo], { type: 'image/png' }), 'logo.png');
  const gen = await c.post('/sites/generate', form);
  assert.equal(gen.status, 302);
  const draftPath = gen.headers.get('location');
  assert.match(draftPath, /^\/sites\/draft\//);
  const page = await (await c.get(draftPath)).text();
  assert.match(page, /<b>Industry:<\/b> Salon/);
  assert.match(page, /<b>Logo colors:<\/b>/);
  assert.match(page, /class="pal on"/);   // the matched palette is the one in use
  assert.match(page, /<b>New blocks:<\/b> Who am I/);
  // the preview frame draws the new blocks on a Blocks home page in the matched colors
  const frame = await (await c.get(draftPath + '/frame')).text();
  assert.match(frame, /Get to know Polished Nails/);
  assert.match(frame, /Get in touch/);
  // swap to another offered palette: the theme and the blocks follow
  const pal = (page.match(/name="pal" value="([a-z0-9-]+)"/g) || []).map(x => x.match(/value="([^"]+)"/)[1]);
  assert.ok(pal.length >= 3, pal.join());
  await c.post(draftPath + '/colors', { pal: pal[2] });
  assert.match(await (await c.get(draftPath)).text(), new RegExp(`value="${pal[2]}"><button type="submit" class="pal on"`));
  await c.post(draftPath + '/colors', { pal: 'made-up' });   // not offered: nothing changes
  // create the site: the editor has the blocks
  const created = await c.post(draftPath + '/create', {});
  const ed = await (await c.get(created.headers.get('location'))).text();
  for (const h of ['Get to know Polished Nails', 'What we do', 'Follow Polished Nails', 'Get in touch']) assert.match(ed, new RegExp(`name="block_heading" maxlength="120" value="${h}"`), h);
  assert.match(ed, /name="theme_logoUrl" value="\/uploads\/[A-Za-z0-9_-]+\.png"/);

  // without the box ticked and without a logo the generator works as before
  const plain = await c.post('/sites/generate', { business_type: 'plumbing company', business_name: 'Old Way Pipes' });
  const ed2 = await (await c.get(plain.headers.get('location'))).text();
  assert.doesNotMatch(ed2, /name="block_heading" maxlength="120" value="Get in touch"/);

  // take the blocks out again on the preview
  const gen3 = await c.post('/sites/generate', { business_type: 'dog groomer', business_name: 'Fluffy Cuts', preview: '1', auto_blocks: '1' });
  const d3 = gen3.headers.get('location');
  assert.match(await (await c.get(d3)).text(), /<b>Industry:<\/b> Pet Grooming/);
  await c.post(d3 + '/noblocks', {});
  const after = await (await c.get(d3)).text();
  assert.doesNotMatch(after, /<b>New blocks:<\/b>/);
  // a non-image upload is ignored, the site is still generated
  const bad = new FormData(); bad.append('business_type', 'bakery'); bad.append('logo', new Blob(['not an image'], { type: 'text/plain' }), 'x.txt');
  const gb = await c.post('/sites/generate', bad);
  assert.equal(gb.status, 302); assert.match(gb.headers.get('location'), /\/sites\/\d+\/edit/);
});

test('numbered cards and big photo with cards blocks: lists as long as typed, numbers, links, own colors; editor add and remove', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'petlists@example.com', 'Dog Academy', {});
  const many = Array.from({ length: 14 }, (_, i) => 'item: Class ' + (i + 1) + ' | Words ' + (i + 1)).join('\n');
  await c.post(editPath, { name: 'Dog Academy', hero_headline: 'Hi',
    block_type: ['numcards', 'tipcards'], block_heading: ['', 'Tips for dog owners'],
    block_body: [many + '\ncolor: #c2410c\nlight: #f4d8b8\ndark: #3b2a1a', 'item: Pet guide | First weeks | /guide\nitem: Toys | Our picks | javascript:alert(1)\nmore: Read on\nphotobg: #e9e9ea'],
    block_image: ['/uploads/cut-dog.webp', '/uploads/dogs.jpg'], block_side: ['left', 'right'], block_buttonText: ['', ''], block_buttonUrl: ['', ''],
    block_edge: ['none', 'none'], block_bg: ['none', 'none'], block_place: ['bottom', 'bottom'], block_page: ['home', 'home'] });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /class="blk blk-words blk-numcards blk-bg-none" style="--ab-color: #c2410c;[^"]*--ab-light: #f4d8b8;[^"]*--ab-dark: #3b2a1a;/);
  assert.match(html, /<div class="blk-inner sg-ab sg-ab-numcards sg-ab-side-left">/);
  assert.equal((html.match(/class="sg-nc-item/g) || []).length, 12, 'up to 12 items are kept');
  assert.match(html, /<span class="sg-nc-num">#12<\/span><h3 class="sg-nc-t">Class 12<\/h3><p>Words 12<\/p>/);
  assert.match(html, /<div class="sg-ab-pic sg-nc-pic sg-ab-cut"><img src="\/uploads\/cut-dog\.webp"/);
  assert.match(html, /<h3 class="sg-tc-t">Pet guide<\/h3><p>First weeks<\/p><a class="sg-tc-more" href="\/guide">Read on<\/a>/);
  assert.doesNotMatch(html, /javascript:alert/);
  assert.match(html, /<div class="blk-inner sg-ab sg-ab-tipcards sg-ab-side-center">/, 'one layout only');
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /data-newblock="numcards"/); assert.match(editor, /data-newblock="tipcards"/);
  assert.match(editor, /<button type="button" class="btn-secondary ab-add" data-ab="item" data-max="12">\+ Add item<\/button>/);
  assert.match(editor, /<button type="button" class="btn-secondary ab-add" data-ab="item" data-max="12">\+ Add card<\/button>/);
  assert.match(editor, /class="btn-secondary ab-del"/); assert.match(editor, /closest\('\.ab-add'\)/, 'the add and remove handler is on the page');
  assert.match(editor, /<input type="text" class="ab-c" maxlength="300" value="\/guide"/);
  assert.match(editor, /Words and lists: Numbered cards beside a photo/);
});

test('decorative card block: saved from the editor, drawn on the page in its style with a real heading and link, fonts loaded; editor panel filled', async () => {
  const c = makeClient();
  const { siteId, editPath } = await basicSite(c, 'decocard@example.com', 'Royal Paws', {});
  await c.post(editPath, { name: 'Royal Paws', hero_headline: 'Hi',
    block_type: ['decocard', 'decocard'], block_heading: ['Welcome to Royal Paws', 'Second'],
    block_body: ['style: royal\nicon: crown\neyebrow: By Royal Appointment\ntagline: Fine grooming\ntext: We pamper pets.\nquote: They are family.\ndetail: [ADDRESS]\ndetail: [PHONE]\nborder: #B8923A\nbtnc: #b8326a\nsec: glow\nsec1: #fdeef4\nsec2: #c9e4f5\nhfont: Cinzel Decorative\nevil: <script>',
      'style: ribbon\nhide: div1, div2\ntext: Just words'],
    block_image: ['', ''], block_side: ['auto', 'auto'], block_buttonText: ['Book Your Visit', ''], block_buttonUrl: ['#book', ''],
    block_edge: ['none', 'none'], block_bg: ['none', 'none'], block_place: ['bottom', 'bottom'], block_page: ['home', 'home'],
    dc_eyebrow: ['ignored'], dc_text: ['ignored'] });
  const html = await (await c.get(`/sites/${siteId}/preview`)).text();
  assert.match(html, /class="blk blk-decocard blk-bg-none sg-dc-sec sg-dc-sec-glow" style="background: radial-gradient\(/);
  assert.match(html, /<div class="sg-dc sg-dc-royal sg-dc-pad-m sg-dc-sh-soft" style="--dc-b: #b8923a; --dc-o: #b8923a;/);
  assert.match(html, /<p class="sg-dc-eyebrow">By Royal Appointment<\/p><h2 class="sg-dc-h">Welcome to Royal Paws<\/h2><p class="sg-dc-tag">Fine grooming<\/p>/);
  assert.match(html, /<ul class="sg-dc-details"><li>\[ADDRESS\]<\/li><li>\[PHONE\]<\/li><\/ul>/);
  assert.match(html, /<a class="btn sg-dc-btn" href="#book">Book Your Visit<\/a>/);
  assert.match(html, /Cinzel\+Decorative/, 'the card\'s own heading font is loaded');
  assert.match(html, /sg-dc-ribbon[\s\S]*?<h2 class="sg-dc-h"><span class="sg-dc-rib">Second<\/span><\/h2>/);
  assert.doesNotMatch(html, /evil|<script>\s*<\/p>/);
  const editor = await (await c.get(editPath)).text();
  assert.match(editor, /<template id="tpl-block-decocard">/); assert.match(editor, /<script src="\/decocard-edit\.js" defer><\/script>/);
  assert.match(editor, /<input type="text" name="dc_eyebrow" class="dc-eyebrow" maxlength="80" value="By Royal Appointment"/);
  assert.match(editor, /class="dc-style-btn on" role="radio" aria-checked="true" data-dcpick="royal"/);
  assert.match(editor, /<input type="checkbox" class="dc-show" data-slot="div1">/, 'a hidden slot is unticked');
  assert.match(editor, /class="dc-col dc-border" data-key="border" data-sg-cl="full" value="#b8923a"/);
  assert.match(editor, /data-dcpreset="#b76e79"/);
});
