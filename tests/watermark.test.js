const test = require('node:test');
const assert = require('node:assert');
const wm = require('../watermark');

const where = { id: 'wabcd123', page: 'home', part: 'b:bcsyi97v', el: 'b:bcsyi97v|div-3' };

test('watermark: the four presets give Leo\'s exact settings', () => {
  const dogCard = wm.fromPreset('dog-card', where);
  assert.deepEqual([dogCard.icon, dogCard.size, dogCard.color, dogCard.op, dogCard.turn, dogCard.pos, dogCard.dx, dogCard.dy, dogCard.kind], ['dog', 300, '#b8326a', 7, -18, 'br', -50, -40, 'card']);
  const catCard = wm.fromPreset('cat-card', where);
  assert.deepEqual([catCard.icon, catCard.size, catCard.op, catCard.turn, catCard.pos, catCard.dx, catCard.dy], ['cat', 280, 8, 16, 'br', -40, -40]);
  const dogSec = wm.fromPreset('dog-section', Object.assign({}, where, { el: '' }));
  assert.deepEqual([dogSec.icon, dogSec.size, dogSec.op, dogSec.turn, dogSec.pos, dogSec.dx, dogSec.kind], ['dog', 520, 5, -18, 'mr', -90, 'block']);
  const catSec = wm.fromPreset('cat-section', Object.assign({}, where, { el: '' }));
  assert.deepEqual([catSec.icon, catSec.size, catSec.op, catSec.turn, catSec.pos, catSec.dx], ['cat', 480, 6, 16, 'ml', -80]);
  // the plain starting points: 300px on a card, 500px on a block, color #B8326A, 6%
  assert.equal(wm.fromPreset(null, Object.assign({ kind: 'card' }, where)).size, 300);
  assert.equal(wm.fromPreset(null, Object.assign({}, where, { kind: 'block', el: '' })).size, 500);
  assert.equal(wm.fromPreset(null, where).op, 6);
});

test('watermark: settings are kept inside their limits and bad entries dropped', () => {
  const t = wm.cleanOne(Object.assign({}, where, { icon: 'nope', color: 'red', op: 80, size: 5000, msize: 3, turn: 90, pos: 'zz', dx: -9999, dy: 9999, mhide: 'yes', drift: true }));
  assert.deepEqual([t.icon, t.color, t.op, t.size, t.msize, t.turn, t.pos, t.dx, t.dy, t.mhide, t.drift], ['dog', '#b8326a', 30, 700, 40, 45, 'br', -600, 600, false, true]);
  assert.equal(wm.cleanOne(Object.assign({}, where, { id: 'bad' })), null);
  assert.equal(wm.cleanOne(Object.assign({}, where, { el: '<script>' })), null);
  assert.equal(wm.cleanOne(Object.assign({}, where, { part: 'x"y' })), null);
  // one per block or card, a second only in slot 2
  const list = wm.clean([where, Object.assign({}, where, { id: 'wabcd124' }), Object.assign({}, where, { id: 'wabcd125', slot: 2 })]);
  assert.deepEqual(list.map(x => x.id), ['wabcd123', 'wabcd125']);
  assert.deepEqual(wm.fromBody('not json'), []);
});

test('watermark: CSS pins it to the chosen point and keeps it behind, faint and unclickable', () => {
  const t = wm.fromPreset('dog-card', where);
  assert.match(wm.css(t), /right:-50px;bottom:-40px;translate:0 0;--sg-wm-s:300px;--sg-wm-ms:180px;--sg-wm-r:-18deg;color:#b8326a;opacity:0.07/);
  assert.match(wm.placeCss(Object.assign({}, t, { pos: 'c', dx: 10, dy: -5 })), /left:calc\(50% \+ 10px\);top:calc\(50% \+ -5px\);translate:-50% -50%/);
  assert.match(wm.placeCss(Object.assign({}, t, { pos: 'ml', dx: -80, dy: 0 })), /left:-80px;top:calc\(50% \+ 0px\);translate:0 -50%/);
  assert.match(wm.placeCss(Object.assign({}, t, { pos: 'tc' })), /left:calc\(50% \+ -50px\);top:-40px;translate:-50% 0/);
  assert.match(wm.CSS, /z-index:-1!important;pointer-events:none!important/);
  assert.match(wm.CSS, /\.sg-wm-host\{overflow:hidden!important;isolation:isolate!important\}/);
  assert.match(wm.CSS, /prefers-reduced-motion:reduce\)\{svg\.sg-wm\.sg-wm-drift\{animation:none/);
  assert.match(wm.SCRIPT, /aria-hidden', 'true'/);
  const svg = wm.svgOf(t);
  assert.match(svg, /^<svg viewBox="0 0 64 64" fill="currentColor" aria-hidden="true"/);
  assert.match(wm.svgOf(wm.cleanOne(Object.assign({}, where, { icon: 'cat' }))), /viewBox="0 0 31 31"/);
  assert.doesNotMatch(wm.data([t]), /<\//);   // safe inside a <script> tag
});

test('watermark: an uploaded SVG keeps only its shapes, recolored', () => {
  const c = wm.cleanSvg('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><script>alert(1)</script><g fill="red" onload="x()"><path d="M0 0h10v10z" style="fill:url(#a)"/><rect x="1" y="1" width="2" height="2" fill="url(#b)"/></g><foreignObject><div>hi</div></foreignObject></svg>');
  assert.deepEqual(c, { vb: '0 0 20 10', g: '<g><path d="M0 0h10v10z"/><rect x="1" y="1" width="2" height="2"/></g>' });
  assert.equal(wm.cleanSvg('<svg viewBox="0 0 10 10"><text>no shapes</text></svg>'), null);
  const own = wm.cleanOne(Object.assign({}, where, { icon: 'own', vb: '0 0 20 10', svg: '<path d="M0 0h5v5z" onclick="x"/><image href="javascript:alert(1)"/>' }));
  assert.equal(own.svg, '<path d="M0 0h5v5z"/>');
  assert.equal(wm.cleanOne(Object.assign({}, where, { icon: 'own', vb: '0 0 20 10', svg: '<image href="x"/>' })), null);
});

test('watermark: the editor gets the icons (dog, cat, crown, bone, heart, sparkle) and the presets', () => {
  const d = JSON.parse(wm.editorData());
  assert.deepEqual(d.icons.map(i => i.key), ['dog', 'cat', 'crown', 'bone', 'heart', 'sparkle']);
  assert.equal(d.presets.length, 4);
  assert.equal(d.pos.length, 9);
  assert.equal(d.color, '#b8326a');
});
