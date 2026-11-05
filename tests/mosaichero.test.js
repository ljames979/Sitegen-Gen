const test = require('node:test');
const assert = require('node:assert');
const mh = require('../mosaichero');

test('photo mosaic hero: line and photos as typed and cleaned; six tiles, the rest take turns; menu bar from the pages', () => {
  const urls = Array.from({ length: 14 }, (_, i) => `/uploads/p${i}.jpg`);
  const p = mh.parse('sub: In the | focus!\nphotos: ' + urls.join(' ') + ' javascript:x\nnoise: y');
  assert.equal(p.sub, 'In the focus!'); assert.equal(p.photos.length, 12);
  assert.equal(mh.cleanBody('photos: /uploads/a.jpg bad\nsub: Hi'), 'sub: Hi\nphotos: /uploads/a.jpg');
  assert.equal(mh.cleanSide('menu'), 'menu'); assert.equal(mh.cleanSide('x'), 'none');
  const site = { name: 'Good Dogs', theme: {}, sections: { contact: { phone: '(555) 010-2030' } } };
  const v = mh.view(site, { heading: 'Your [Dog]', body: 'sub: In the focus!\nphotos: ' + urls.slice(0, 8).join(' '), side: 'menu' }, [], [{ label: 'About', href: '/about' }]);
  assert.equal(v.tiles.length, 8); assert.equal(v.cols, 4); assert.deepEqual(v.spare, []);
  const v6 = mh.view(site, { body: 'photos: ' + urls.slice(0, 7).join(' ') }, [], []);
  assert.equal(v6.cols, 3); assert.equal(v6.tiles.length, 6); assert.deepEqual(v6.spare, ['/uploads/p6.jpg']);
  assert.deepEqual(v.menu.links, [{ label: 'About', href: '/about' }]);
  assert.deepEqual(v.menu.call, { label: 'Call Now', href: 'tel:5550102030' });
  assert.equal(mh.view(site, { side: 'none' }, [], []).menu, null);
});
