const test = require('node:test');
const assert = require('node:assert');
const st = require('../splittext');

test('split text: choices are kept within range, unknown ones fall back to the defaults', () => {
  assert.deepEqual(st.parse({ theme_splitText: 'headings', theme_splitBy: 'chars', theme_splitFx: 'uncover', theme_splitPlay: 'scroll', theme_splitDur: '900', theme_splitGap: '25', theme_splitX: '-60', theme_splitY: '0' }),
    { splitText: 'headings', splitBy: 'chars', splitFx: 'uncover', splitPlay: 'scroll', splitDur: 900, splitGap: 25, splitX: -60, splitY: 0 });
  assert.deepEqual(st.parse({ theme_splitText: 'everything', theme_splitBy: 'pixels', theme_splitFx: 'explode', theme_splitPlay: 'loop', theme_splitDur: '99999', theme_splitGap: '-5', theme_splitX: 'far', theme_splitY: '' }),
    { splitText: '', splitBy: 'words', splitFx: 'slide', splitPlay: 'view', splitDur: 3000, splitGap: 0, splitX: 0, splitY: 40 });
});

test('split text: no script when off; the settings reach the script; motion-off visitors are left alone', () => {
  assert.equal(st.script({}), '');
  const s = st.script({ splitText: 'hero', splitBy: 'lines', splitFx: 'invert', splitPlay: 'view', splitDur: 500, splitGap: 80, splitX: 10, splitY: -20 });
  assert.match(s, /"on":"hero","by":"lines","fx":"invert","play":"view","dur":500,"gap":80,"x":10,"y":-20/);
  assert.match(s, /prefers-reduced-motion: reduce/); assert.match(s, /aria-label/);
  assert.doesNotThrow(() => new Function(s));
  assert.match(st.script({ splitText: 'headings' }), /"by":"words","fx":"slide","play":"view","dur":700,"gap":60,"x":0,"y":40/);
});
