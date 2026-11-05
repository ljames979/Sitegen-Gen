const test = require('node:test');
const assert = require('node:assert');
const catalog = require('../blockcatalog');
const mixPage = require('../mixpage');

test('block catalog: every block design is in exactly one group, with a name, a line and a drawn picture', () => {
  const kinds = Object.keys(mixPage.BLOCK_KINDS);
  const listed = catalog.LIST.map(x => x[0]);
  assert.deepEqual([...listed].sort(), [...kinds].sort());
  assert.equal(new Set(listed).size, listed.length);
  const groups = catalog.groups();
  assert.equal(groups.reduce((n, g) => n + g.items.length, 0), kinds.length);
  groups.forEach(g => g.items.forEach(it => {
    assert.ok(it.name && it.desc, it.type);
    assert.match(it.pic, /^<svg class="blk-pic" viewBox="0 0 60 40"/);
    assert.ok(it.pic.length > 200, it.type + ' has a picture');
  }));
  const i = catalog.info('steps');
  assert.equal(i.name, 'Numbered steps'); assert.equal(i.group, 'words'); assert.match(i.color, /^#[0-9a-f]{6}$/);
  // an unknown type falls back to Photo + text
  assert.equal(catalog.info('nope').name, 'Photo + text');
  assert.equal(Object.keys(catalog.infoAll()).length, kinds.length);
});
