const { test } = require('node:test');
const assert = require('node:assert/strict');
const lab = require('../designlab');
const brandKit = require('../brandkit');
const score = require('../score');

const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const ctx = { theme: { style: 'modern', primaryColor: '#0f766e', accentColor: '#12354e', homeLayout: '' }, templateId: 'plumbing', businessType: 'plumber', advice: null };

test('design lab: a roll changes every unlocked part and keeps the locked ones', () => {
  const from = lab.current(ctx.theme);
  const r = lab.roll(ctx, from, { locks: { style: true, colors: true } }, seq([0.1, 0.5, 0.9, 0.3, 0.7]));
  assert.equal(r.style, 'modern'); assert.equal(r.primaryColor, '#0f766e'); assert.equal(r.accentColor, '#12354e');
  assert.ok(r.headingFont || r.bodyFont, 'fonts rolled away from the style fonts');
  assert.notEqual(r.shape, from.shape);
  assert.ok(r.bpVariants && Object.keys(r.bpVariants).length > 3, 'section layouts picked');
  assert.ok(Object.values(r.bpVariants).every(v => !/^scene-/.test(v)), 'parallax scenes left out');
});

test('design lab: brand colors stay in the client color family and always read well', () => {
  const pool = lab.colorPool(ctx, 'brand');
  assert.ok(pool.length >= 3);
  assert.ok(lab.colorPool(ctx, 'any').length > pool.length);
  const r = lab.roll(ctx, null, { locks: { style: true, fonts: true, shape: true, layouts: true } }, Math.random);
  assert.ok(pool.some(p => p.primary === r.primaryColor && p.accent === r.accentColor));
});

test('design lab: combos from the browser are checked, and apply switches to the blueprint layout', () => {
  const c = lab.parse(JSON.stringify({ style: 'nope', headingFont: '<script>', primaryColor: 'red', shape: 'round', bpVariants: { services: 'stack', hero: 'bogus', zzz: 'x' } }));
  assert.equal(c.style, 'modern'); assert.equal(c.headingFont, ''); assert.equal(c.primaryColor, '#2563eb');
  assert.equal(c.buttonShape, 'pill'); assert.deepEqual(c.bpVariants, { services: 'stack' });
  assert.equal(lab.parse('{bad json'), null);
  const t = lab.apply({ style: 'warm', bgColor: '#000000', pageStyles: { about: 'noir' }, bpVariants: { faq: 'numbered' } }, { ...c, style: 'luxury' });
  assert.equal(t.style, 'luxury'); assert.equal(t.bgColor, ''); assert.deepEqual(t.pageStyles, {});
  assert.equal(t.homeLayout, 'blueprint'); assert.deepEqual(t.bpVariants, { faq: 'numbered', services: 'stack' });
  assert.equal(t.corners, 'round');
});

test('brand kit: logo outline picks a button shape', () => {
  const w = 40, h = 40, m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y * w + x] = 1;
  assert.equal(brandKit.shapeOf(m, w, h).id, 'sharp');
  const c = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) c[y * w + x] = (x - 19.5) ** 2 + (y - 19.5) ** 2 <= 400 ? 1 : 0;
  assert.equal(brandKit.shapeOf(c, w, h).id, 'round');
  assert.equal(brandKit.shapeOf(new Uint8Array(w * h), w, h).id, 'soft');
});

test('brand kit: fonts lead with the logo pick and only use known font names', () => {
  const f = brandKit.fontsFor(['#111111'], { fonts: [{ name: 'Data', heading: 'Lora', body: 'Inter', mood: ['calm'] }, { name: 'Bad', heading: 'x<y', body: 'Inter' }] });
  assert.equal(f[0].heading, 'Playfair Display');
  assert.ok(f.some(p => p.heading === 'Lora')); assert.ok(!f.some(p => p.heading === 'x<y'));
});

test('brand kit: generated file names are tied to the site, saved kits are cleaned', () => {
  assert.ok(brandKit.isOwnFile(7, '/uploads/bk-7-0123456789ab-32.png', 'png'));
  assert.ok(!brandKit.isOwnFile(7, '/uploads/bk-8-0123456789ab-32.png', 'png'));
  assert.ok(!brandKit.isOwnFile(7, '/uploads/../bk-7-0123456789ab-32.png', 'png'));
  const k = brandKit.cleanKit({ logoUrl: 'javascript:alert(1)', primaryColor: '#123456', accentColor: 'blue', headingFont: 'Lora', shape: 'huge', faviconUrl: '/uploads/a b.png' }, u => /^https:/.test(u));
  assert.deepEqual(k, { logoUrl: '', primaryColor: '#123456', accentColor: '', headingFont: 'Lora', bodyFont: '', shape: '', faviconUrl: '', touchIconUrl: '' });
  const t = brandKit.applyKit({ primaryColor: '#000000', accentColor: '#111111', buttonShape: '' }, { primaryColor: '#123456', accentColor: '', shape: 'sharp' });
  assert.equal(t.primaryColor, '#000000', 'half a palette is not applied'); assert.equal(t.buttonShape, 'square');
});

test('brand kit: colors, icons and a share picture from a real logo image', async (t) => {
  let sharp; try { sharp = require('sharp'); } catch { return t.skip('sharp not installed'); }
  const fs = require('fs'), os = require('os'), path = require('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-bk-'));
  try {
    const logo = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><circle cx="150" cy="150" r="140" fill="#0f766e"/><rect x="100" y="120" width="100" height="60" fill="#f59e0b"/></svg>')).png().toBuffer();
    const a = await brandKit.analyse(logo, sharp, null);
    assert.equal(a.colors[0], '#0f766e'); assert.equal(a.shape.id, 'round'); assert.ok(a.pair.primary);
    const ic = await brandKit.makeIcons(logo, sharp, dir, 3);
    assert.match(ic.faviconUrl, /^\/uploads\/bk-3-[0-9a-f]{12}-32\.png$/);
    assert.equal((await sharp(path.join(dir, path.basename(ic.touchIconUrl))).metadata()).width, 180);
    const share = await brandKit.makeShare(logo, sharp, { uploadsDir: dir, siteId: 3, heroUrl: '', primary: '#0f766e', accent: '#12354e' });
    const m = await sharp(path.join(dir, path.basename(share))).metadata();
    assert.equal(m.width, 1200); assert.equal(m.height, 630);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('speed and polish score: weight, placeholders, icon and share picture', () => {
  const html = '<html lang="en"><head><title>Acme Roofing in Orlando</title><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex"></head><body><h1>Hi</h1><p>Call [Phone number] today</p><a href="tel:555">555</a><p>© 2019</p></body></html>';
  const site = { id: 1, theme: { logoUrl: '/uploads/x.png' }, sections: { contact: { phone: '555' }, seo: {}, hero: {} } };
  const r = score.score(site, html, { items: [{ id: 'contrast-button', fix: { type: 'colors', label: 'Use #000' } }] }, { uploadsDir: '/nonexistent' });
  const cat = (id) => r.cats.find(c => c.id === id);
  assert.equal(cat('speed').score, 100);
  const pol = cat('polish').checks;
  assert.match(pol.find(c => /placeholders/.test(c.title)).detail, /\[Phone number\]/);
  assert.equal(pol.find(c => /browser icon/.test(c.title)).fix.type, 'icons');
  assert.equal(pol.find(c => /share picture/.test(c.title)).fix.type, 'share');
  assert.equal(pol.find(c => /Copyright/.test(c.title)).ok, false);
  assert.ok(cat('search').checks.find(c => /may list/.test(c.title)).ok, 'the preview noindex does not count');
  assert.ok(r.fixes.includes('colors') && r.fixes.includes('icons') && r.fixes.includes('share'));
  assert.ok(cat('access').score < 100);
  assert.equal(score.weightScore(600 * 1024), 100); assert.equal(score.weightScore(5 * 1024 * 1024), 0);
});
