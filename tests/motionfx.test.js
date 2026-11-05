const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const mf = require('../motionfx'); const fonts = require('../fonts'); const content = require('../library/content');

test('motionfx: personality comes from the style unless the owner picks one; speed and bounce tune it', () => {
  assert.equal(mf.feelOf({ style: 'luxury' }), 'glide'); assert.equal(mf.feelOf({ style: 'popstudio' }), 'bounce'); assert.equal(mf.feelOf({ style: 'workbench' }), 'snap');
  assert.equal(mf.feelOf({ style: 'modern' }), ''); assert.equal(mf.feelOf({ style: 'luxury', motionFeel: 'standard' }), '');
  assert.deepEqual(mf.tune({ style: 'modern' }), { k: 1, ease: null, dist: 1 });
  const slow = mf.tune({ style: 'luxury', motionSpeed: 50 }); assert.equal(slow.k, 2.8); assert.deepEqual(slow.ease, [0.16, 1, 0.3, 1]);
  assert.deepEqual(mf.tune({ style: 'modern', motionBounce: 100 }).ease, [0.34, 1.9, 0.64, 1]);
  assert.deepEqual(mf.tune({ style: 'modern', motionBounce: 0 }).ease, [0.34, 1, 0.64, 1]);
});
test('motionfx: parse keeps known values only; success moments default on', () => {
  const t = mf.parse({ theme_motionFeel: 'wobble', theme_motionSpeed: '400', theme_btnFx_shine: '1', theme_btnFx_rocket: '1', theme_headlineFx: 'settle', theme_photoFx: 'spin' });
  assert.equal(t.motionFeel, ''); assert.equal(t.motionSpeed, 150); assert.deepEqual(t.buttonFx, ['shine']); assert.equal(t.headlineFx, 'settle'); assert.equal(t.photoFx, '');
  assert.equal(t.motionBounce, ''); assert.equal(t.successFx, true);
  assert.equal(mf.parse({ theme_successFx: '0' }).successFx, false); assert.equal(mf.parse({ theme_successFx: ['0', '1'] }).successFx, true);
  assert.equal(mf.bodyClasses({ buttonFx: ['nudge'], headlineFx: 'weight', style: 'cafe', successFx: false }), ' bfx-nudge kx-weight mfeel-bounce');
  assert.equal(mf.bodyClasses({ inkFx: true, floatTags: true, successFx: false }), ' fx-ink fx-tags');
  assert.deepEqual([mf.parse({ theme_inkFx: '1' }).inkFx, mf.parse({}).inkFx, mf.parse({ theme_floatTags: 'on' }).floatTags], [true, false, true]);
});
test('motionfx: the rotating word only uses the client\'s own service names', () => {
  assert.deepEqual(mf.rotateWords([{ title: 'Roof repair' }, { title: '' }, { title: 'Roof repair' }, { title: 'Gutters' }]), ['Roof repair', 'Gutters']);
  assert.deepEqual(mf.rotateWords(undefined), []);
});
test('fonts: the Variable group loads weight and width ranges', () => {
  assert.equal(fonts.familyParam('Anybody'), 'family=Anybody:wdth,wght@50..150,100..900');
  assert.ok(fonts.isVariable('Roboto Flex')); assert.ok(!fonts.isVariable('Inter')); assert.ok(!fonts.isSingleWeight('Fraunces'));
});
test('motion scripts: every effect respects reduced motion and the lite tier stays small', () => {
  const fx = fs.readFileSync(path.join(__dirname, '../public/sg-fx.js'), 'utf8');
  assert.match(fx, /prefers-reduced-motion: reduce/); assert.match(fx, /data-motion'\) === 'none'/);
  const css = fs.readFileSync(path.join(__dirname, '../views/_motionfx-head.ejs'), 'utf8');
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)/);
  assert.ok(Buffer.byteLength(fs.readFileSync(path.join(__dirname, '../public/sg-motion-lite.js'))) < 8000);
});
test('services binder passes a hover photo only with a main photo', () => {
  const ctx = { site: { sections: { services: {} } }, basePath: '', navPages: [], services: [{ title: 'A', slug: 'a', imageUrl: '/a.jpg', image2: '/b.jpg' }, { title: 'B', slug: 'b', image2: '/c.jpg' }] };
  const d = content.bind('services', ctx); assert.equal(d.items[0].image2, '/b.jpg'); assert.equal(d.items[1].image2, '');
});
