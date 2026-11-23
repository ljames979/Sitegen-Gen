const test = require('node:test');
const assert = require('node:assert');
const pf = require('../photofocus');

test('photoUrls: every photo of the site, not the logo, cut-outs or resized copies', () => {
  const site = {
    theme: { logoUrl: '/uploads/abc.png' },
    sections: {
      hero: { imageUrl: '/uploads/dog1.jpg' },
      gallery: { images: ['/uploads/dog1.jpg', '/uploads/cut-x1.webp', '/uploads/pe-mask.png', '/uploads/cat-480.webp', 'https://images.pexels.com/photos/1/a.jpeg?w=800'] },
      about: { imageUrl: '/uploads/abc.png' }
    }
  };
  assert.deepStrictEqual(pf.photoUrls(site), ['/uploads/dog1.jpg', 'https://images.pexels.com/photos/1/a.jpeg?w=800']);
});

test('focusFromAlpha: a point a little above the middle of the subject', () => {
  const W = 100, H = 100, a = new Uint8Array(W * H);
  for (let y = 10; y < 60; y++) for (let x = 60; x < 90; x++) a[y * W + x] = 255;   // subject on the upper right
  const [x, y] = pf.focusFromAlpha(a, W, H);
  assert.ok(x >= 74 && x <= 76, 'x ' + x);
  assert.ok(y >= 29 && y <= 31, 'y ' + y);   // 40% down the subject, not its middle (35)
  assert.strictEqual(pf.focusFromAlpha(new Uint8Array(W * H), W, H), null);              // nothing found
  assert.strictEqual(pf.focusFromAlpha(new Uint8Array(W * H).fill(255), W, H), null);    // fills the photo
});

test('apply: centres known photos, keeps positions set by hand, does nothing when off', () => {
  const site = { sections: { photoFocus: { on: true, map: { '/uploads/a.jpg': [70, 20], '/uploads/b.jpg': [50, 50], 'https://images.pexels.com/p.jpeg?w=1&h=2': [10, 90] } } } };
  const html = '<img src="/uploads/a.jpg" alt="">' +
    '<img class="x" style="width:1px" src="/uploads/a.jpg">' +
    '<img src="/uploads/a.jpg" style="object-position:0 0">' +
    '<img src="/uploads/b.jpg">' +
    '<div style="background-image:url(&#39;https://images.pexels.com/p.jpeg?w=1&amp;h=2&#39;)"></div>' +
    '<img src="/uploads/a.jpgx">';
  const out = pf.apply(html, site);
  assert.ok(out.includes('<img style="object-position:70% 20%" src="/uploads/a.jpg" alt="">'));
  assert.ok(out.includes('style="object-position:70% 20%;width:1px"'));
  assert.ok(out.includes('style="object-position:0 0"') && !out.includes('object-position:70% 20%;object-position'));
  assert.ok(out.includes('<img src="/uploads/b.jpg">'));
  assert.ok(out.includes(';background-position:10% 90%"'));
  assert.ok(out.includes('<img src="/uploads/a.jpgx">'));
  assert.strictEqual(pf.apply(html, { sections: { photoFocus: { ...site.sections.photoFocus, on: false } } }), html);
});

test('clean: drops bad points', () => {
  const f = pf.clean({ on: 1, map: { a: [10, 20], b: [200, 1], c: 'x', d: [1] } });
  assert.deepStrictEqual(f, { on: true, map: { a: [10, 20] }, at: '' });
});

test('waitingCutouts and addCutouts: only "Pets cut out" blocks with photos left', () => {
  const sections = { blocks: { items: [
    { type: 'photoblend', side: 'left:cut', body: 'photos: /uploads/d1.jpg /uploads/d2.jpg\ncutouts: /uploads/d1.jpg|/uploads/cut-aa.webp' },
    { type: 'photoblend', side: 'left:both', body: 'photos: /uploads/d3.jpg' },
    { type: 'text', body: 'photos: /uploads/d4.jpg' }
  ] } };
  const w = pf.waitingCutouts({ sections });
  assert.deepStrictEqual(w, [{ index: 0, photos: ['/uploads/d2.jpg'] }]);
  const next = pf.addCutouts(sections, { '/uploads/d2.jpg': '/uploads/cut-bb.webp' });
  assert.match(next.blocks.items[0].body, /cutouts: \/uploads\/d1\.jpg\|\/uploads\/cut-aa\.webp \/uploads\/d2\.jpg\|\/uploads\/cut-bb\.webp/);
  assert.strictEqual(next.blocks.items[1], sections.blocks.items[1]);
  assert.deepStrictEqual(pf.waitingCutouts({ sections: next }), []);
});
