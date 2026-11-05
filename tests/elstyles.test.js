const { test } = require('node:test');
const assert = require('node:assert/strict');
const es = require('../elstyles');

test('move & size: only well-formed changes are kept, one per element', () => {
  const list = es.clean([
    { id: 'eabc1234', page: 'home', el: 'b:b4dx38uv|img-2', dx: 40, dy: -9999, w: 320.4, h: 5000, zoom: 150, turn: 400, front: true, hide: 'yes' },
    { id: 'eabc1235', page: 'home', el: 'b:b4dx38uv|img-2', w: 20 },                // the same element again: left out
    { id: 'eabc1236', page: 'home', el: 'f:hero|div-7', zoom: 100 },                  // 100% is as designed: nothing to do
    { id: 'eabc1237', page: 'home', el: 'f:hero|svg-1', hide: true },
    { id: 'bad', page: 'home', el: 'f:hero|div-1', w: 20 },
    { id: 'eabc1238', page: 'home', el: '"><script>|div-1', w: 20 },
    { id: 'eabc1239', page: 'home', el: 'f:hero|div1', w: 20 }                         // a text style name, not a piece name
  ]);
  assert.deepEqual(list.map(t => t.id), ['eabc1234', 'eabc1237']);
  assert.deepEqual(list[0], { id: 'eabc1234', page: 'home', el: 'b:b4dx38uv|img-2', dx: 40, dy: -3000, w: 320, h: 2400, zoom: 150, turn: 180, front: true, hide: false });
  assert.equal(es.clean(Array(500).fill(0).map((x, i) => ({ id: 'e' + String(i).padStart(7, '0'), page: 'home', el: 'f:x|div-' + (i + 1), w: 20 }))).length, es.MAX);
  assert.deepEqual(es.fromBody('not json'), []);
});

test('move & size: the CSS for a change, the exact or "at least" height, and the page data', () => {
  const [p, c] = es.clean([
    { id: 'eabc1234', page: 'home', el: 'b:x|img-3', dx: 10, dy: 5, w: 380, zoom: 120, turn: -15, front: true },
    { id: 'eabc1235', page: 'home', el: 'b:x|div-4', w: 300, h: 228 }
  ]);
  const a = es.css(p);
  assert.match(a, /translate:calc\(10 \* min\(1px,\.1316vw\)\) calc\(5 \* min\(1px,\.1316vw\)\)!important/);
  assert.match(a, /scale:1\.2!important/); assert.match(a, /rotate:-15deg!important/); assert.match(a, /z-index:60!important/);
  assert.match(a, /width:min\(380px,50vw,calc\(100vw - 24px\)\)!important/);
  assert.match(a, /height:auto!important/);                                // a picture with only a width keeps its shape
  assert.doesNotMatch(es.css(c), /height/);
  assert.match(es.hcss(c, true), /^height:min\(228px,30vw\)!important/); assert.match(es.hcss(c, false), /^min-height:min\(228px,30vw\)!important/);
  const d = es.data([{ ...c, el: '</script>|div-1' }]);
  assert.doesNotMatch(d, /<\//); assert.match(d, /"css":/); assert.match(d, /"hx":/); assert.match(d, /"hm":/);
  assert.doesNotThrow(() => new Function(es.SCRIPT));
  const site = { sections: { texts: { elems: [p, { ...p, id: 'eabc1299', page: 'about' }] } } };
  assert.deepEqual(es.forPage(site, 'about').map(x => x.id), ['eabc1299']);
});
