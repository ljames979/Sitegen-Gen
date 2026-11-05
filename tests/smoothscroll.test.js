const test = require('node:test');
const assert = require('node:assert');
const ss = require('../smoothscroll');

test('scroll smoother: only known choices are kept, the feel defaults to normal', () => {
  assert.deepEqual(ss.parse({ theme_smoothScroll: 'page', theme_smoothFeel: 'soft' }), { smoothScroll: 'page', smoothFeel: 'soft' });
  assert.deepEqual(ss.parse({ theme_smoothScroll: 'wild', theme_smoothFeel: 'turbo' }), { smoothScroll: '', smoothFeel: 'normal' });
});

test('scroll smoother: no script when off; section links only, or the wheel too; reduced motion keeps plain scrolling', () => {
  assert.equal(ss.script({}), '');
  assert.equal(ss.script({ smoothScroll: 'nope' }), '');
  const links = ss.script({ smoothScroll: 'links', smoothFeel: 'quick' });
  assert.match(links, /"wheel":false,"ms":550/);
  assert.match(links, /prefers-reduced-motion: reduce/);
  const page = ss.script({ smoothScroll: 'page' });
  assert.match(page, /"wheel":true,"ms":800,"ease":0.11/);
  assert.match(page, /passive: false/);
  assert.doesNotThrow(() => new Function(page));
});
