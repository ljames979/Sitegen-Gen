const test = require('node:test');
const assert = require('node:assert');
const hc = require('../herocard');

test('hero card body: words, price, detail, two buttons, the bar and the color, each only when typed', () => {
  const body = ['intro: A seasonal mug | glazed by hand', 'price: $39.00 | Free pickup', 'detail: 350 ml | Big enough for a latte',
    'link: Size guide | /site/x/faq', 'link: Gallery | #gallery', 'link: Third | /x', 'link: Bad | javascript:alert(1)',
    'bar: Classic mug | Matcha | $39.00', 'color: #8FAE8B', 'nonsense line'].join('\n');
  const p = hc.parse(body);
  assert.equal(p.intro, 'A seasonal mug glazed by hand');
  assert.deepEqual([p.price, p.priceNote, p.detail, p.detailNote], ['$39.00', 'Free pickup', '350 ml', 'Big enough for a latte']);
  assert.deepEqual(p.links, [{ label: 'Size guide', url: '/site/x/faq' }, { label: 'Gallery', url: '#gallery' }]);
  assert.deepEqual(p.bar, { name: 'Classic mug', option: 'Matcha', price: '$39.00' });
  assert.equal(p.color, '#8fae8b');
  assert.equal(hc.cleanBody(body), 'intro: A seasonal mug glazed by hand\nprice: $39.00 | Free pickup\ndetail: 350 ml | Big enough for a latte\nlink: Size guide | /site/x/faq\nlink: Gallery | #gallery\nbar: Classic mug | Matcha | $39.00\ncolor: #8fae8b');
  assert.equal(hc.cleanBody(''), '');
  assert.equal(hc.parse('bar:  |  | ').bar, null);
  assert.equal(hc.cleanSide('fill'), 'fill'); assert.equal(hc.cleanSide('x'), 'center');
});

test('hero card picture or reel, colors and what the block shows', () => {
  assert.deepEqual(hc.media('/uploads/a.mp4'), { kind: 'video', src: '/uploads/a.mp4' });
  assert.deepEqual(hc.media('/uploads/a.webp'), { kind: 'img', src: '/uploads/a.webp' });
  assert.equal(hc.media('https://youtu.be/abcdefghijk'), null);
  assert.equal(hc.media(''), null);
  const light = hc.colors('#f4f1ea', {}), dark = hc.colors('#1d2b22', {});
  assert.equal(light.ink, '#161616'); assert.equal(dark.ink, '#ffffff');
  assert.match(hc.colors('', { primaryColor: '#3d6b4f' }).base, /^#[0-9a-f]{6}$/);
  const site = { theme: { primaryColor: '#3d6b4f' }, sections: { hero: {}, services: { items: [] }, about: {}, gallery: { items: [] } } };
  const v = hc.view(site, { heading: 'Matcha', body: 'bar: Mug | Green | $39', imageUrl: '/uploads/r.webm', side: 'fill', buttonText: 'Add to bag', buttonUrl: '#contact' }, []);
  assert.equal(v.look, 'fill'); assert.equal(v.media.kind, 'video'); assert.equal(v.button.text, 'Add to bag'); assert.match(v.style, /--hc-ink: #ffffff/);
  const plain = hc.view(site, { heading: 'Hi', side: 'fill' }, []);
  assert.equal(plain.media, null); assert.equal(plain.look, 'center'); assert.equal(plain.bar, null); assert.equal(plain.button, null);
});
