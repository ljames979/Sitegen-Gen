const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('../textstyles');

test('text styles: only well-formed changes are kept, one whole-element change per element', () => {
  const list = ts.clean([
    { id: 'sabc1234', page: 'home', el: 'f:hero|h11', size: 72, font: 'Pacifico', color: '#E11D48', bold: true, italic: 'x', dx: 40, dy: -9999 },
    { id: 'sabc1235', page: 'home', el: 'f:hero|h11', size: 20 },                                   // the same element again: left out
    { id: 'sabc1236', page: 'home', el: 'b:b4dx38uv|h21', phrase: 'move <b>', n: 99, color: 'brand', dx: 50 },
    { id: 'sabc1237', page: 'home', el: 'f:hero|p1', text: 'New <words>', orig: 'Old words' },
    { id: 'sabc1238', page: 'home', el: 'f:hero|p2', size: 0 },                                     // nothing to do
    { id: 'bad', page: 'home', el: 'f:hero|p1', size: 20 },
    { id: 'sabc1239', page: 'home', el: '"><script>|p1', size: 20 },
    { id: 'sabc1240', page: 'home', el: 'f:hero|p3', font: 'Comic<Sans', color: 'red' }
  ]);
  assert.deepEqual(list.map(t => t.id), ['sabc1234', 'sabc1236', 'sabc1237']);
  assert.deepEqual(list[0], { id: 'sabc1234', page: 'home', el: 'f:hero|h11', size: 72, font: 'Pacifico', color: '#e11d48', bold: true, italic: null, dx: 40, dy: -2000, w: 0, h: 0 });
  assert.equal(list[1].phrase, 'move b'); assert.equal(list[1].n, 50); assert.equal(list[1].dx, 0);
  assert.equal(list[2].text, 'New words'); assert.equal(list[2].orig, 'Old words');
  assert.equal(ts.clean(Array(400).fill(0).map((x, i) => ({ id: 's' + String(i).padStart(7, '0'), page: 'home', el: 'f:x|p' + (i + 1), size: 20 }))).length, ts.MAX);
  assert.deepEqual(ts.fromBody('not json'), []);
});

test('text styles: the CSS for a change, the page data and the font link', () => {
  const t = ts.clean([{ id: 'sabc1234', page: 'home', el: 'f:hero|h11', size: 76, font: 'Pacifico', color: 'brand', bold: false, dx: 10, dy: 5 }])[0];
  const c = ts.css(t);
  assert.match(c, /font-size:min\(76px,max\(13px,10vw\)\)!important/); assert.match(c, /font-family:'Pacifico'/);
  assert.match(c, /color:var\(--primary\)!important/); assert.match(c, /font-weight:400!important/); assert.doesNotMatch(c, /font-style/);
  assert.match(c, /translate:calc\(10 \* min\(1px,\.1316vw\)\) calc\(5 \* min\(1px,\.1316vw\)\)/);
  assert.match(ts.fontLink([t]), /family=Pacifico/);
  const d = ts.data([{ ...t, phrase: '</script><b>' }]);
  assert.doesNotMatch(d, /<\//); assert.match(d, /"css":/);
  assert.doesNotThrow(() => new Function(ts.SCRIPT));
  const site = { sections: { texts: { styles: [t, { ...t, id: 'sabc1235', page: 'about' }] } } };
  assert.deepEqual(ts.forPage(site, 'about').map(x => x.id), ['sabc1235']);
});

test('text styles script: only its own spans are unwrapped, never the script tag that carries data-sg-ts', () => {
  assert.match(ts.SCRIPT, /querySelectorAll\('span\[data-sg-ts\]'\)/);
  assert.doesNotMatch(ts.SCRIPT, /querySelectorAll\('\[data-sg-ts\]'\)/);
});

test('text styles: a stretched box (width and least height), kept only for whole elements and shown in the CSS', () => {
  const list = ts.clean([
    { id: 'sbox0001', page: 'home', el: 'b:b4dx38uv|h21', w: 980.4, h: 5000 },
    { id: 'sbox0002', page: 'home', el: 'b:b4dx38uv|p1', w: 3 },
    { id: 'sbox0003', page: 'home', el: 'b:b4dx38uv|p2', phrase: 'some words', w: 600, h: 200 },
    { id: 'sbox0004', page: 'home', el: 'b:b4dx38uv|p3', w: 'wide' }
  ]);
  assert.deepEqual(list.map(t => [t.id, t.w, t.h]), [['sbox0001', 980, 1600], ['sbox0002', 40, 0]]);
  const c = ts.css(list[0]);
  assert.match(c, /width:min\(980px,128\.947vw,calc\(100vw - 24px\)\)!important/); assert.match(c, /max-width:none!important/);
  assert.match(c, /min-height:min\(1600px,210\.526vw\)!important/);
  assert.doesNotMatch(ts.css(list[1]), /min-height/);
  assert.match(ts.SCRIPT, /t\.dx \|\| t\.dy \|\| t\.w \|\| t\.h/);
});
