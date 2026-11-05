const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const quality = require('../quality');
const themes = require('../themes');
const contrast = require('../contrast');
const { defaultTheme, defaultSections } = require('../defaults');

let sharp = null; try { sharp = require('sharp'); } catch { /* optional */ }
const site = (theme = {}, sections = {}) => ({ name: 'T', theme: { ...defaultTheme(), ...theme }, sections: { ...defaultSections('T'), ...sections } });
const ids = (r) => r.items.map(i => i.id);

test('a normal site passes', async () => {
  const r = await quality.audit(site({ primaryColor: '#1d4ed8' }));
  assert.equal(r.errors, 0, JSON.stringify(r.items));
  assert.ok(r.passed.includes('Main text contrast'));
});

test('a pale brand colour is caught and the offered fix passes AA', async () => {
  const r = await quality.audit(site({ primaryColor: '#7dd3fc' }));
  const f = r.items.find(i => i.id === 'contrast-brand' || i.id === 'contrast-button');
  assert.ok(f, 'flagged: ' + ids(r));
  const fixed = quality.fixedPrimary('#7dd3fc');
  assert.ok(contrast.ratio(fixed, quality.onPrimary(fixed)) >= 4.5);
  const theme = { primaryColor: '#7dd3fc', accentColor: '#000' };
  assert.equal(quality.applyColorFix(theme, f.fix), true);
  const after = await quality.audit(site({ primaryColor: theme.primaryColor }));
  assert.ok(!after.items.some(i => i.id === 'contrast-button'), 'button text now fine');
  assert.equal(quality.applyColorFix({}, { primaryColor: 'javascript:1' }), false, 'bad fix values are ignored');
});

test('mid-tone brand colours get button labels that reach 4.5:1 after the fix', () => {
  for (const hex of ['#888888', '#2f9e44', '#e8590c', '#7048e8', '#f59f00', '#0ca678']) {
    const f = quality.fixedPrimary(hex);
    assert.ok(contrast.ratio(f, quality.onPrimary(f)) >= 4.5, hex + ' -> ' + f);
  }
});

test('every built-in style has readable text (guards new themes)', () => {
  for (const style of themes.ALL_STYLES) {
    const p = quality.stylePalette({ style });
    assert.ok(contrast.ratio(p.ink, p.bg) >= 4.5, `${style}: main text ${contrast.ratio(p.ink, p.bg).toFixed(2)}`);
    assert.ok(contrast.ratio(p.ink, p.surface) >= 4.5, `${style}: text on surface`);
  }
});

test('secondary text on every style (reported, not hidden)', async () => {
  const weak = [];
  for (const style of themes.ALL_STYLES) {
    const r = await quality.audit(site({ style }));
    if (r.items.some(i => i.id === 'contrast-muted')) weak.push(style);
  }
  // styles may be added to this list only on purpose; the audit shows the warning to owners
  assert.deepEqual(weak, [], 'styles with faint secondary text: ' + weak.join(', '));
});

test('every extra theme defines the colour variables the audit reads', () => {
  for (const t of themes.THEMES) {
    for (const k of ['--ink', '--muted', '--page-bg']) assert.match(t.vars[k] || '', /^#[0-9a-f]{6}$/i, `${t.id} ${k}`);
  }
});

test('images: insecure, wrong format, missing, and heavy are caught', { skip: !sharp }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'q-'));
  const big = await sharp({ create: { width: 3200, height: 2400, channels: 3, background: '#336699' } }).png().toBuffer();
  fs.writeFileSync(path.join(dir, 'big.png'), big);
  const noise = Buffer.alloc(3200 * 2400 * 3); for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) >>> 24;
  fs.writeFileSync(path.join(dir, 'noisy.jpg'), await sharp(noise, { raw: { width: 3200, height: 2400, channels: 3 } }).jpeg({ quality: 95 }).toBuffer());
  const s = site({}, {});
  s.sections.hero.imageUrl = '/uploads/noisy.jpg';
  s.sections.about.imageUrl = 'http://example.com/pic.jpg';
  s.sections.gallery.images = ['/uploads/gone.jpg', 'https://x.test/a.bmp', '/uploads/big.png'];
  const r = await quality.audit(s, { uploadsDir: dir, sharp });
  const t = ids(r).join(' ');
  assert.match(t, /img-heavy-noisy\.jpg/); assert.match(t, /img-http-pic\.jpg/); assert.match(t, /img-missing-gone\.jpg/); assert.match(t, /img-fmt-a\.bmp/);
  assert.match(t, /alt-hero/, 'hero photo without alt text');
  assert.ok(r.errors >= 3);

  // optimise: new webp files, sections updated, originals kept
  const res = await quality.optimiseImages(s, { uploadsDir: dir, sharp });
  assert.ok(res.count >= 1);
  assert.match(res.sections.hero.imageUrl, /^\/uploads\/[A-Za-z0-9]+\.webp$/);
  assert.ok(fs.existsSync(path.join(dir, 'noisy.jpg')), 'original kept');
  const newFile = path.join(dir, path.basename(res.sections.hero.imageUrl));
  const meta = await sharp(newFile).metadata();
  assert.ok(meta.width <= 1920);
  assert.ok(fs.statSync(newFile).size < fs.statSync(path.join(dir, 'noisy.jpg')).size);
  assert.equal(res.sections.about.imageUrl, 'http://example.com/pic.jpg', 'outside images untouched');
});

test('rendered page checks: zoom blocked, missing alt, no lazy loading, font loading', async () => {
  const good = '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="preconnect" href="https://fonts.gstatic.com"><link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet"><style>.btn{min-height: 44px}</style></head><body><img src="/a.jpg" alt="a" loading="lazy"></body></html>';
  assert.equal((await quality.audit(site(), { html: good })).errors, 0);
  const bad = '<html><head><meta name="viewport" content="width=device-width, user-scalable=no"><link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet"></head><body><img src="/a.jpg"><img src="/b.jpg" alt="b"><img src="/c.jpg" alt="c"></body></html>';
  const t = ids(await quality.audit(site(), { html: bad })).join(' ');
  for (const k of ['tap-zoom', 'tap-size', 'img-alt', 'img-lazy', 'font-swap', 'font-preconnect']) assert.match(t, new RegExp(k));
});

test('a font name that cannot be requested from Google is flagged', async () => {
  assert.ok(!ids(await quality.audit(site({ headingFont: 'Anton', bodyFont: 'Lora' }))).some(x => x.startsWith('font-name')));
  assert.ok(ids(await quality.audit(site({ headingFont: 'Bad;Font{}' }))).some(x => x.startsWith('font-name')));
});
