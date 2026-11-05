const { test } = require('node:test');
const assert = require('node:assert/strict');
const sb = require('../shapeblock');
const fs = require('fs');
const path = require('path');

const site = { name: 'Acme', sections: { hero: { imageUrl: '/uploads/h.jpg' }, gallery: { images: ['/uploads/a.jpg', '/uploads/b.jpg', '/uploads/c.jpg', 'javascript:x'] }, services: { items: [] } } };

test('rolling words with photo shapes: the body keeps rolling words, small words and up to 5 photos in all', () => {
  const body = 'roll: move.\nroll: stand out.\nsub: We plan\nphotos: /uploads/1.jpg javascript:alert(1) http://plain.test/p.jpg /uploads/2.jpg /uploads/3.jpg /uploads/1.jpg\nphotos: /uploads/4.jpg /uploads/5.jpg /uploads/6.jpg\nshape: /uploads/old.jpg\nnonsense';
  const p = sb.parse(body);
  assert.deepEqual(p.roll, ['move.', 'stand out.']); assert.deepEqual(p.sub, ['We plan']);
  assert.deepEqual(p.photos, ['/uploads/1.jpg', '/uploads/2.jpg', '/uploads/3.jpg', '/uploads/4.jpg', '/uploads/5.jpg']);
  assert.equal(sb.cleanBody(body), 'roll: move.\nroll: stand out.\nsub: We plan\nphotos: /uploads/1.jpg /uploads/2.jpg /uploads/3.jpg /uploads/4.jpg /uploads/5.jpg');
  assert.equal(sb.cleanBody('roll: x'), 'roll: x');
  assert.equal(sb.cleanSide('brand'), 'brand'); assert.equal(sb.cleanSide('x'), 'glow');
});

test('rolling words with photo shapes: the photos go round the shapes, each shape one further along; site photos when none; needs a heading and a photo', () => {
  const v = sb.view(site, { heading: 'We make [brands]', body: 'roll: move.\nsub: Small\nphotos: /uploads/1.jpg /uploads/2.jpg /uploads/3.jpg /uploads/4.jpg', side: 'none' }, []);
  assert.match(v.headingHtml, /<em class="sg-hl">brands<\/em>/); assert.deepEqual(v.roll, ['move.']); assert.equal(v.rim, 'none');
  assert.deepEqual(v.shapes.map(x => x[0]), ['/uploads/1.jpg', '/uploads/2.jpg', '/uploads/3.jpg']);
  assert.deepEqual(v.shapes[2], ['/uploads/3.jpg', '/uploads/4.jpg', '/uploads/1.jpg', '/uploads/2.jpg']);
  const fromSite = sb.view(site, { heading: 'Hi' }, []);
  assert.deepEqual(fromSite.photos, ['/uploads/h.jpg', '/uploads/a.jpg', '/uploads/b.jpg', '/uploads/c.jpg']);
  assert.equal(sb.view(site, { body: 'roll: x' }, []), null);
  assert.equal(sb.view({ sections: {} }, { heading: 'Hi' }, []), null);
});

test('rolling words with photo shapes: the roll and photo turns are in the page script, still with motion off, and letter effects leave it alone', () => {
  const js = fs.readFileSync(path.join(__dirname, '../public/sg-fx.js'), 'utf8');
  assert.match(js, /\[data-sg-shapes-blk\]/); assert.match(js, /if \(still\) \{ if \(pause\) pause\.remove\(\); return; \}/);
  const css = fs.readFileSync(path.join(__dirname, '../public/sg-site.css'), 'utf8');
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{\n  \.sg-ps-rail\.sg-go \{ transition/);
  assert.match(fs.readFileSync(path.join(__dirname, '../extrafx.js'), 'utf8'), /\.sg-zw, \.sg-ps, /);
  assert.match(fs.readFileSync(path.join(__dirname, '../splittext.js'), 'utf8'), /\.blk-shapes'\)/);
  // its class names stay clear of the library's own shapes styles (sg-sh-*)
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '../views/_blocks.ejs'), 'utf8'), /sg-sh-/);
  assert.doesNotMatch(js + css, /twelvelabs/i);
});
