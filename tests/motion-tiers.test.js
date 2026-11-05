const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os'); const vm = require('node:vm');
const m = require('../motion-presets'); const quality = require('../quality'); const { TEMPLATES } = require('../templates');
const PUB = path.join(__dirname, '../public');
const read = (f) => fs.readFileSync(path.join(PUB, f), 'utf8');

test('motion levels: three tiers, Standard by default, junk refused', () => {
  assert.deepEqual(m.LEVEL_IDS, ['standard', 'premium', 'showcase']);
  assert.equal(m.LEVEL_DEFAULT, 'standard');
  assert.ok(m.isLevel('premium')); assert.ok(!m.isLevel('ultra')); assert.ok(!m.isLevel(undefined));
  assert.deepEqual(m.SHADER_IDS, ['aurora', 'mesh', 'silk']);
  assert.equal(m.resolveLevel({ motionLevel: 'showcase' }), 'showcase');
  assert.equal(m.resolveLevel({ motionLevel: 'warp', motionStyle: 'subtle' }), 'standard');
});

test('motion levels: sites saved before levels existed keep their look (Lively becomes Premium)', () => {
  assert.equal(m.resolveLevel({ motionStyle: 'lively' }), 'premium');
  assert.equal(m.resolveLevel({ motionStyle: 'subtle' }), 'standard');
  assert.equal(m.resolveLevel({}), 'standard');
  assert.equal(m.resolveLevel({}, { motion: 'cinematic' }), 'premium');
  assert.equal(m.resolveLevel({ motionLevel: 'standard', motionStyle: 'lively' }), 'standard', 'an explicit choice always wins');
});

test('motion levels: every industry gets a recommended tier with a reason, and showcase is never a default', () => {
  for (const t of TEMPLATES) {
    const s = m.suggestLevel({ templateId: t.id });
    assert.ok(m.isLevel(s.level), t.id); assert.ok(s.why.length > 20, t.id);
  }
  assert.equal(m.suggestLevel({ templateId: 'law' }).level, 'standard');
  assert.equal(m.suggestLevel({ templateId: 'salon' }).level, 'showcase');
  assert.equal(m.suggestLevel({ templateId: 'restaurant' }).level, 'showcase');
  assert.equal(m.suggestLevel({ templateId: 'real-estate' }).level, 'premium');
  assert.equal(m.suggestLevel({ templateId: 'nope' }).level, 'standard');
  assert.equal(m.LEVEL_DEFAULT, 'standard');
});

test('lottie icons: ten original, valid animations; every industry mapping points at a real icon', () => {
  const sandbox = { window: {} }; vm.runInNewContext(read('lottie/icons.js'), sandbox);
  const icons = sandbox.window.SG_LOTTIE;
  assert.deepEqual(Object.keys(icons).sort(), [...m.ICON_NAMES].sort());
  for (const [name, d] of Object.entries(icons)) {
    assert.equal(d.w, 100); assert.equal(d.h, 100); assert.ok(d.fr > 0 && d.op > d.ip, name);
    assert.ok(d.layers.length >= 1, name);
    const walk = (n) => {
      if (Array.isArray(n)) return n.forEach(walk);
      if (!n || typeof n !== 'object') return;
      if (n.a === 1) { let prev = -1; for (const k of n.k) { assert.ok(k.t >= prev && k.t <= d.op, name + ' keyframe order'); prev = k.t; assert.ok(Array.isArray(k.s), name); } }
      Object.values(n).forEach(walk);
    };
    walk(d.layers);
    assert.match(JSON.stringify(d), /0\.011,0\.022,0\.033|0\.044,0\.055,0\.066/, name + ' uses the theme colour placeholders');
    for (const l of d.layers) assert.equal(l.ty, 4);
  }
  for (const t of TEMPLATES) for (const n of m.iconsFor(t.id)) assert.ok(icons[n], `${t.id} -> ${n}`);
  for (const id of ['restaurant', 'home-care', 'real-estate', 'contractor', 'salon', 'law']) assert.equal(m.iconsFor(id).length, 2, id);
});

test('lottie: lottie-web is the MIT light player, vendored with its licence, and nothing is copied from LottieFiles', () => {
  assert.match(read('vendor/README.md'), /lottie-web 5\.13\.0/);
  assert.match(read('vendor/LICENSE-lottie-web.txt'), /MIT License/);
  assert.ok(fs.statSync(path.join(PUB, 'vendor/lottie_light.min.js')).size > 100000);
  assert.match(read('lottie/icons.js'), /original animated icons/i);
  assert.match(fs.readFileSync(path.join(__dirname, '../THIRD-PARTY-LICENSES.md'), 'utf8'), /lottie-web/i);
});

test('motion scripts: every tier honours reduced motion, animates only transform/opacity, and never hides content on failure', () => {
  for (const f of ['sg-motion-lite.js', 'sitegen-motion.js', 'sg-premium.js', 'sg-shader.js']) {
    const src = read(f);
    assert.match(src, /prefers-reduced-motion: reduce/, f);
    for (const bad of [/animate\([^)]*\b(width|height|top|left|margin|padding)\b/, /\.style\.(width|height|top|left)\s*=/]) assert.doesNotMatch(src, bad, f);
    assert.doesNotMatch(src, /https?:\/\/(?!www\.w3\.org)/, f + ' loads nothing from outside');
  }
  const lite = read('sg-motion-lite.js');
  assert.doesNotMatch(lite, /Motion\b.*require|window\.Motion/, 'Standard needs no library');
  assert.match(lite, /IntersectionObserver/); assert.match(lite, /\.animate\(/);
  assert.match(lite, /beforeprint/); assert.match(lite, /catch \(e\) \{ try \{ teardown/);   // any failure leaves a static page
  assert.match(read('sitegen-motion.js'), /premium:/);
  const sh = read('sg-shader.js');
  assert.match(sh, /IntersectionObserver/, 'pauses off screen'); assert.match(sh, /visibilitychange/, 'pauses in a hidden tab');
  assert.match(sh, /webglcontextlost/); assert.match(sh, /requestIdleCallback/, 'starts after the page is loaded');
  for (const p of m.SHADERS) assert.match(sh, new RegExp(p.id + ':'), p.id);
  assert.ok(Buffer.byteLength(read('sg-motion-lite.js')) < 8000, 'Standard stays tiny');
  assert.ok(Buffer.byteLength(sh) < 12000);
});

test('quality: Showcase weight warnings fire for heavy photos and stay quiet for light pages or other tiers', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgw-'));
  fs.writeFileSync(path.join(dir, 'hero.jpg'), Buffer.alloc(600 * 1024, 1));
  fs.writeFileSync(path.join(dir, 'small.jpg'), Buffer.alloc(40 * 1024, 1));
  fs.writeFileSync(path.join(dir, 'big2.jpg'), Buffer.alloc(900 * 1024, 1));
  const html = '<script src="/vendor/motion.js" defer></script><script src="/sg-premium.js" defer></script><script src="/sg-shader.js" defer></script><span data-lottie="home"></span>';
  const run = (theme, hero, gallery) => {
    const items = [], passed = [];
    quality.weightChecks({ theme, sections: { hero: { imageUrl: hero }, gallery: { images: gallery || [] }, about: {}, services: { items: [] } } }, html, i => items.push(i), p => passed.push(p), dir);
    return { items, passed };
  };
  const heavy = run({ motionLevel: 'showcase', motionStyle: 'subtle' }, '/uploads/hero.jpg', ['/uploads/big2.jpg']);
  const ids = heavy.items.map(i => i.id);
  assert.ok(ids.includes('weight-showcase-hero'), ids.join());
  assert.ok(heavy.items.every(i => i.severity === 'warn' && i.area === 'performance'));
  const light = run({ motionLevel: 'showcase', motionStyle: 'subtle' }, '/uploads/small.jpg');
  assert.equal(light.items.length, 0); assert.ok(light.passed.length);
  assert.equal(run({ motionLevel: 'premium', motionStyle: 'subtle' }, '/uploads/hero.jpg', ['/uploads/big2.jpg']).items.length, 0, 'only Showcase is checked');
  assert.equal(run({ motionLevel: 'showcase', motionStyle: 'none' }, '/uploads/hero.jpg').items.length, 0, 'motion off: nothing animates');
  const w = quality.scriptWeight(html);
  assert.ok(w.gz > 20000 && w.gz < 400000, String(w.gz));
  assert.ok(w.files.includes('vendor/lottie_light.min.js') && w.files.includes('sg-shader.js'));
});
