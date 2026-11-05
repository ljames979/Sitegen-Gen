const { test } = require('node:test');
const assert = require('node:assert/strict');
const mb = require('../motionblocks');
const fs = require('fs');
const path = require('path');

const site = { name: 'Acme', sections: { hero: { imageUrl: '/uploads/h.jpg', subheadline: 'Fresh bread daily' }, gallery: { images: ['/uploads/a.jpg', '/uploads/b.jpg', 'javascript:x'] }, services: { items: [] } } };

test('photo trail: the block\'s own photos first, then the site\'s; needs 3 photos', () => {
  const t = mb.trail(site, { heading: 'Made by [hand]', body: 'Every morning\nhttps://x.test/own.jpg\nhttp://plain.test/p.jpg' });
  assert.equal(t.photos[0], 'https://x.test/own.jpg'); assert.ok(!t.photos.includes('javascript:x') && !t.photos.includes('http://plain.test/p.jpg'));
  assert.deepEqual(t.lines, ['Every morning']); assert.match(t.headingHtml, /<em class="sg-hl">hand<\/em>/);
  assert.equal(mb.trail({ sections: { hero: { imageUrl: '/uploads/h.jpg' } } }, {}), null);
});

test('photo wave: an own word for the cards to spell first (cleaned; "auto" is the old empty), more cards for it', () => {
  assert.equal(mb.cleanShape(' Colr <b>x</b> WaVe!! '), 'Colr bxb WaV');
  assert.equal(mb.cleanShape('auto'), ''); assert.equal(mb.cleanShape(undefined), '');
  const w = mb.wave(site, { heading: 'Tracing ~ Art', side: 'Art', body: '/uploads/own.jpg' });
  assert.equal(w.shape, 'Art'); assert.equal(w.pics.length, 72);
  assert.equal(mb.wave(site, { heading: 'Tracing ~ Art', side: 'auto', body: '/uploads/own.jpg' }).pics.length, 24);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'views', '_blocks.ejs'), 'utf8'), /data-sg-shape="<%= wv\.shape %>"/);
});

test('photo wave: two words around the ~, the block\'s words or the hero sub-headline, 24 photos', () => {
  const w = mb.wave(site, { heading: 'Tracing ~ Art', body: '/uploads/own.jpg' });
  assert.equal(w.left, 'Tracing'); assert.equal(w.right, 'Art'); assert.equal(w.text, 'Fresh bread daily');
  assert.equal(w.pics.length, 24); assert.equal(w.pics[0], '/uploads/own.jpg');
  assert.equal(mb.wave(site, { heading: 'Only', body: 'Our words\n/uploads/c.jpg' }).text, 'Our words');
  assert.equal(mb.wave({ sections: { gallery: { images: ['/uploads/a.jpg'] } } }, {}), null);
});

test('big words: rows from the lines with [photo] where asked, else from the heading with the photo before the last word', () => {
  const a = mb.bigwords(site, { heading: 'Since 2006', body: 'Building\ntomorrow\r\nfor [photo] today' });
  assert.deepEqual(a.rows.map(r => r.map(p => p.t || 'PHOTO').join(' ')), ['Building', 'tomorrow', 'for PHOTO today']);
  assert.equal(a.rows[2][1].photo, '/uploads/h.jpg', 'no photo of its own: the hero photo'); assert.equal(a.caption, 'Since 2006'); assert.equal(a.label, 'Building tomorrow for today');
  const b = mb.bigwords(site, { heading: 'Building tomorrow for today', imageUrl: '/uploads/mine.jpg' });
  assert.deepEqual(b.rows.map(r => r.map(p => p.t || 'PHOTO').join(' ')), ['Building tomorrow', 'for PHOTO today']); assert.equal(b.caption, '');
  assert.equal(b.rows[1][1].photo, '/uploads/mine.jpg');
  assert.deepEqual(b.rows.flat().map(p => p.i), [0, 1, 2, 3, 4], 'one stagger step per word');
  assert.equal(mb.bigwords(site, {}), null);
});

test('the three blocks have their script and styles, and stay still for motion-off visitors', () => {
  const fs = require('fs'), path = require('path');
  const js = fs.readFileSync(path.join(__dirname, '../public/sg-fx.js'), 'utf8'), css = fs.readFileSync(path.join(__dirname, '../public/sg-site.css'), 'utf8');
  for (const a of ['[data-sg-trail]', '[data-sg-wave]', '[data-sg-bigw]']) assert.ok(js.includes(a), a);
  assert.match(js, /Photo trail, Photo wave and Big words[\s\S]*if \(still\) return;/);
  assert.match(css, /\.sg-bigw\.sg-live \.sg-bigw-w \{ opacity: 0/); assert.match(css, /prefers-reduced-motion: no-preference\) \{\s*\.sg-bigw\.sg-live/);
});

test('scroll story: 2 to 6 "Title | words" steps, each with a photo; fewer than 2 shows nothing', () => {
  const s = mb.story(site, { heading: 'How we [work]', body: 'Plan | We listen first\nBuild | Our crew\n/uploads/own.jpg\nDone', buttonText: 'Book', buttonUrl: '/contact' });
  assert.deepEqual(s.steps.map(x => [x.t, x.d]), [['Plan', 'We listen first'], ['Build', 'Our crew'], ['Done', '']]);
  assert.equal(s.steps[0].photo, '/uploads/own.jpg'); assert.match(s.headingHtml, /<em class="sg-hl">work<\/em>/);
  assert.deepEqual(s.button, { text: 'Book', url: '/contact' });
  assert.equal(mb.story(site, { body: 'Only one' }), null);
});

test('path travel: 3 to 10 photos and up to 5 short lines; zoom word: the heading over a photo; shape morph: a photo and words', () => {
  const p = mb.path(site, { body: 'Clear stories\n/uploads/1.jpg\n/uploads/2.jpg\n' + 'x'.repeat(80) });
  assert.ok(p.photos.length >= 3 && p.photos.length <= 10); assert.equal(p.lines[1].length, 60);
  assert.equal(mb.path({ sections: { gallery: { images: ['/uploads/a.jpg'] } } }, {}), null);
  const z = mb.zoomword(site, { heading: 'Create [now]', body: 'Big ideas' });
  assert.equal(z.word, 'Create now'); assert.equal(z.photo, '/uploads/h.jpg', 'no photo of its own: the hero photo'); assert.equal(z.text, 'Big ideas');
  assert.equal(mb.zoomword(site, {}), null);
  const m = mb.morph({ sections: { about: { imageUrl: '/uploads/about.jpg' } } }, { heading: 'Our story', body: 'One\nTwo' });
  assert.equal(m.photo, '/uploads/about.jpg'); assert.deepEqual(m.paras, ['One', 'Two']);
  assert.equal(mb.morph({ sections: {} }, { heading: 'No photo' }), null);
});

test('the four new blocks have their script and styles; the scroll story never touches the services story', () => {
  const js = fs.readFileSync(path.join(__dirname, '../public/sg-fx.js'), 'utf8'), css = fs.readFileSync(path.join(__dirname, '../public/sg-site.css'), 'utf8');
  for (const a of ['[data-sg-scrollstory]', '[data-sg-path]', '[data-sg-zoomword]', '[data-sg-morph]']) assert.ok(js.includes(a), a);
  assert.doesNotMatch(css, /^\.sg-story-step\b(?!s)/m);
  for (const t of ['story', 'path', 'zoomword', 'morph']) assert.ok(mb.TYPES.includes(t), t);
});
