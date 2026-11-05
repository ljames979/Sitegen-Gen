const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const m = require('../motion-presets');
const { TEMPLATES } = require('../templates');
const themes = require('../themes');
const { defaultTheme } = require('../defaults');

test('three presets, Subtle is the default for new sites', () => {
  assert.deepEqual(m.IDS, ['subtle', 'lively', 'none']);
  assert.equal(defaultTheme().motionStyle, 'subtle');
  assert.ok(m.isValid('lively')); assert.ok(!m.isValid('wild')); assert.ok(!m.isValid(undefined));
});

test('sites saved before this setting keep the motion they had', () => {
  assert.equal(m.resolve({}, {}), 'none');
  assert.equal(m.resolve({ motion: 'rise' }, {}), 'subtle');
  assert.equal(m.resolve({ motion: 'zoom' }, {}), 'lively');
  assert.equal(m.resolve({}, { motion: 'cinematic' }), 'lively');
  assert.equal(m.resolve({ motionStyle: 'none', motion: 'rise' }, {}), 'none', 'the new setting wins');
  assert.equal(m.resolve({ motionStyle: 'junk' }, {}), 'none');
});

test('industries and styles suggest a preset; calm advice caps Lively', () => {
  assert.equal(m.suggest({ templateId: 'home-care' }), 'subtle');
  assert.equal(m.suggest({ templateId: 'insurance' }), 'subtle');
  assert.equal(m.suggest({ templateId: 'restaurant' }), 'lively');
  assert.equal(m.suggest({ templateId: 'party-rental' }), 'lively');
  assert.equal(m.suggest({ templateId: 'plumbing', style: 'playful' }), 'lively', 'style decides when the industry has no opinion');
  assert.equal(m.suggest({ templateId: 'plumbing', style: 'modern' }), 'subtle');
  assert.equal(m.suggest({ templateId: 'restaurant', advice: { motion: 'calm' } }), 'subtle');
  assert.equal(m.suggest({}), 'subtle');
  for (const id of Object.keys(m.BY_TEMPLATE)) assert.ok(TEMPLATES.some(t => t.id === id), `unknown template ${id}`);
  for (const s of Object.keys(m.BY_STYLE)) assert.ok(themes.ALL_STYLES.includes(s), `unknown style ${s}`);
});

test('stat numbers become safe data-count attributes', () => {
  assert.equal(m.countAttrs('1,500+'), ' data-count="1500" data-suffix="+" data-comma="1"');
  assert.equal(m.countAttrs('4.9'), ' data-count="4.9" data-decimals="1"');
  assert.equal(m.countAttrs('$20k'), ' data-count="20" data-prefix="$" data-suffix="k"');
  for (const t of ['24/7', '9-5', '10:30', '2005', 'Free', '', null, undefined]) assert.equal(m.countAttrs(t), '', String(t));
  assert.doesNotMatch(m.countAttrs('5" onmouseover="x'), /onmouseover="x"/, 'quotes are escaped');
  assert.ok(m.countAttrs('<b>5</b>') === '' || !/<b>/.test(m.countAttrs('<b>5</b>')));
});

test('the animation script is self-contained, honours reduced motion and fails safe', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'sitegen-motion.js'), 'utf8');
  assert.match(js, /prefers-reduced-motion: reduce/);
  assert.match(js, /if \(!M \|\| !M\.animate/, 'does nothing if the library is missing');
  assert.match(js, /catch \(e\) \{ try \{ teardown\(\)/, 'any error leaves a static page');
  assert.match(js, /beforeprint/);
  assert.doesNotMatch(js, /https?:\/\//, 'no outside addresses');
  const lib = fs.readFileSync(path.join(__dirname, '..', 'public', 'vendor', 'motion.js'), 'utf8');
  assert.match(lib, /Motion/);
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', 'vendor', 'LICENSE-motion.txt')), 'licence travels with the library');
});

test('the script runs: counters, fade-ups and presets work in a real browser, and a missing library leaves the page complete', { timeout: 120000 }, async (t) => {
  let chromium = null;
  for (const p of ['playwright', '/opt/node-tools/node_modules/playwright']) { try { ({ chromium } = require(p)); break; } catch { /* next */ } }
  if (!chromium) return t.skip('playwright not installed');
  let browser; try { browser = await chromium.launch(); } catch { return t.skip('Chromium not available'); }
  try {
    const root = path.join(__dirname, '..', 'public');
    const html = (extra) => `<!doctype html><html><head><meta charset=utf8><style>.sg-anim [data-animate=fade-up]{opacity:0}</style><script>document.documentElement.classList.add('sg-anim');setTimeout(function(){document.documentElement.classList.remove('sg-anim')},3000)</script></head><body data-motion="subtle"><div style="height:1500px"></div><h1 data-animate="hero">Hello <em>big</em> world</h1><p data-animate="fade-up" id="p">Text</p><b id="n" data-count="1500" data-suffix="+" data-comma="1">1,500+</b>${extra}</body></html>`;
    const page = await browser.newPage();
    await page.route('**/*', (r) => {
      const u = new URL(r.request().url());
      if (u.pathname === '/page') return r.fulfill({ contentType: 'text/html', body: html('<script src="/vendor/motion.js"></script><script src="/sitegen-motion.js"></script>') });
      if (u.pathname === '/broken') return r.fulfill({ contentType: 'text/html', body: html('<script src="/vendor/motion.js"></script><script src="/sitegen-motion.js"></script>').replace('/vendor/motion.js', '/missing.js') });
      const f = path.join(root, u.pathname);
      if (f.startsWith(root) && fs.existsSync(f)) return r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(f) });
      return r.fulfill({ status: 404, body: '' });
    });
    await page.goto('http://t.test/page');
    assert.equal(await page.evaluate(() => typeof window.SiteGenMotion), 'object');
    assert.equal(await page.evaluate(() => document.getElementById('n').textContent), '0+', 'counter starts at zero until seen');
    await page.evaluate(() => window.scrollTo(0, 1400));
    await page.waitForFunction(() => document.getElementById('n').textContent === '1,500+', null, { timeout: 20000 });
    await page.waitForFunction(() => getComputedStyle(document.getElementById('p')).opacity === '1', null, { timeout: 20000 });
    assert.equal(await page.evaluate(() => document.getElementById('p').style.opacity), '', 'inline styles are cleaned up so hover effects work');
    // None shows everything immediately; Lively splits the headline into words
    await page.evaluate(() => window.SiteGenMotion.init('none'));
    assert.equal(await page.evaluate(() => document.querySelectorAll('.sg-word').length), 0);
    await page.evaluate(() => window.SiteGenMotion.init('lively'));
    assert.equal(await page.evaluate(() => document.querySelectorAll('.sg-word').length), 3, 'Hello, big, world');
    await page.evaluate(() => window.SiteGenMotion.init('none'));
    assert.equal(await page.evaluate(() => document.querySelector('h1').innerHTML), 'Hello <em>big</em> world', 'headline restored exactly');
    // the library failing to load: the page is complete after the safety timer, with the real number
    const broken = await browser.newPage(); await broken.route('**/*', (r) => { const u = new URL(r.request().url()); return u.pathname === '/broken' ? r.fulfill({ contentType: 'text/html', body: html('<script src="/missing.js"></script><script src="/sitegen-motion.js"></script>') }) : (u.pathname === '/sitegen-motion.js' ? r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(root, 'sitegen-motion.js')) }) : r.fulfill({ status: 404, body: '' })); });
    await broken.goto('http://t.test/broken');
    await broken.waitForTimeout(200);
    assert.equal(await broken.evaluate(() => document.getElementById('n').textContent), '1,500+');
    assert.equal(await broken.evaluate(() => getComputedStyle(document.getElementById('p')).opacity), '1', 'content is shown at once when the library is missing');
    // reduced motion: nothing is hidden or animated
    const rm = await browser.newContext({ reducedMotion: 'reduce' }); const rp = await rm.newPage();
    await rp.route('**/*', (r) => { const u = new URL(r.request().url()); if (u.pathname === '/page') return r.fulfill({ contentType: 'text/html', body: html('<script src="/vendor/motion.js"></script><script src="/sitegen-motion.js"></script>') }); const f = path.join(root, u.pathname); return fs.existsSync(f) && f.startsWith(root) ? r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(f) }) : r.fulfill({ status: 404, body: '' }); });
    await rp.goto('http://t.test/page'); await rp.waitForTimeout(150);
    assert.equal(await rp.evaluate(() => getComputedStyle(document.getElementById('p')).opacity), '1');
    assert.equal(await rp.evaluate(() => document.getElementById('n').textContent), '1,500+');
  } finally { await browser.close(); }
});
