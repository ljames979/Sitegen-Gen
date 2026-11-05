const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const images = require('../images');

let sharp = null;
try { sharp = require('sharp'); } catch { /* optional */ }

async function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'sg-img-')); }
async function photo(dir, name, w, h) {
  const p = path.join(dir, name);
  await sharp({ create: { width: w, height: h, channels: 3, background: { r: 30, g: 120, b: 200 } } }).jpeg({ quality: 95 }).toFile(p);
  return p;
}

test('upload makes smaller WebP copies; small photos get none', async (t) => {
  if (!sharp) return t.skip('sharp not installed');
  const dir = await tmpDir();
  const big = await photo(dir, 'bigone.jpg', 3000, 2000);
  await images.optimizeUpload({ path: big });
  assert.deepEqual(images.variantsFor('bigone.jpg', dir).map(v => v.width), [480, 960, 1440, 1920]);
  const meta = await sharp(path.join(dir, 'bigone-960.webp')).metadata();
  assert.equal(meta.format, 'webp');
  assert.equal(meta.width, 960);
  const mid = await photo(dir, 'midone.jpg', 700, 500);
  await images.optimizeUpload({ path: mid });
  assert.deepEqual(images.variantsFor('midone.jpg', dir).map(v => v.width), [480, 700]);
  const tiny = await photo(dir, 'tinyone.jpg', 300, 200);
  await images.optimizeUpload({ path: tiny });
  assert.deepEqual(images.variantsFor('tinyone.jpg', dir), []);
  // the variant files are not mistaken for originals of their own
  assert.deepEqual(images.variantsFor('bigone-960.webp', dir), []);
});

test('optimizeHtml: srcset on page photos, lazy below the fold, logo untouched, hero WebP + preload', async (t) => {
  if (!sharp) return t.skip('sharp not installed');
  const dir = await tmpDir();
  await images.optimizeUpload({ path: await photo(dir, 'pic1.jpg', 2400, 1600) });
  const html = '<html><head></head><body><nav><img src="/uploads/pic1.jpg" alt="logo"></nav><main>' +
    '<div id="heroBg" style="--hero-photo: url(\'/uploads/pic1.jpg\')" data-hero-photo="/uploads/pic1.jpg"></div>' +
    '<img src="/uploads/pic1.jpg" alt="x"><img src="/uploads/pic1.jpg" alt="y" loading="eager">' +
    '<img src="https://other.example/a.jpg" alt="z"><img src="/uploads/anim.gif" alt="g"></main></body></html>';
  const out = images.optimizeHtml(html, { dir });
  const imgs = out.match(/<img\b[^>]*>/g);
  assert.doesNotMatch(imgs[0], /srcset|loading/, 'header logo is left alone');
  assert.match(imgs[1], /srcset="[^"]*pic1-480\.webp 480w[^"]*pic1-1920\.webp 1920w"/);
  assert.match(imgs[1], /sizes="/);
  assert.match(imgs[1], /loading="lazy"/);
  assert.match(imgs[2], /loading="eager"/, 'an explicit loading attribute is respected');
  assert.doesNotMatch(imgs[3], /srcset/, 'external photos are untouched');
  assert.doesNotMatch(imgs[4], /srcset/, 'gifs are untouched');
  assert.match(out, /data-hero-photo="\/uploads\/pic1-1920\.webp"/);
  assert.match(out, /--hero-photo: url\('\/uploads\/pic1-1920\.webp'\)/);
  assert.match(out, /<link rel="preload" as="image" href="\/uploads\/pic1-1920\.webp" fetchpriority="high">\s*<\/head>/);
  // running it twice does not double up
  assert.equal((images.optimizeHtml(out, { dir }).match(/srcset=/g) || []).length, (out.match(/srcset=/g) || []).length);
  assert.ok(!fs.readdirSync(dir).some(n => /-\d+-\d+\.webp$/.test(n)), 'no copies of copies');
});

test('older photos get their copies made in the background on first use', async (t) => {
  if (!sharp) return t.skip('sharp not installed');
  const dir = await tmpDir();
  await photo(dir, 'legacy1.jpg', 2000, 1000); // uploaded before the speed pass: no copies yet
  let done = null;
  const html = '<main><img src="/uploads/legacy1.jpg" alt="a"></main>';
  assert.doesNotMatch(images.optimizeHtml(html, { dir, onVariants: (n) => { done = n; } }), /srcset/);
  for (let i = 0; i < 50 && !done; i++) await new Promise(r => setTimeout(r, 100));
  assert.equal(done, 'legacy1.jpg');
  assert.match(images.optimizeHtml(html, { dir }), /srcset=/);
});

test('uploadsUsed finds uploaded file names anywhere in a site', () => {
  assert.deepEqual(images.uploadsUsed({ a: '/uploads/a1.jpg', b: ['x', { c: 'url(/uploads/b2.png)' }], d: 'https://x/uploads/zz.jpg' }).sort(), ['a1.jpg', 'b2.png', 'zz.jpg']);
});
