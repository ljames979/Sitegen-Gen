const test = require('node:test');
const assert = require('node:assert');
const m = require('../menustyles');

test('menu bar styles: known ids only, body class, which use a menu button, split order', () => {
  assert.equal(m.clean('drawer'), 'drawer'); assert.equal(m.clean('x"><script>'), ''); assert.equal(m.clean(undefined), '');
  assert.equal(m.bodyClass('pill'), ' mnu-pill'); assert.equal(m.bodyClass('nope'), '');
  assert.equal(m.usesPanel('overlay'), true); assert.equal(m.usesPanel('drawer'), true); assert.equal(m.usesPanel('band'), false);
  assert.deepEqual([0, 1, 2, 3, 4].map(i => m.splitOrder(i, 5)), [1, 1, 1, 3, 3]);
  assert.equal(m.STYLES[0][0], '', 'the first choice is the classic bar');
});
