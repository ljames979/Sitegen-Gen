const test = require('node:test');
const assert = require('node:assert');
const hc = require('../headercolor');
const contrast = require('../contrast');

test('header color: only known choices and real hex colors are kept', () => {
  assert.deepEqual(hc.parse({ theme_headerBg: 'clear', theme_headerColor: '#ABCDEF' }), { headerBg: 'clear', headerColor: '#abcdef' });
  assert.deepEqual(hc.parse({ theme_headerBg: 'pink', theme_headerColor: 'red' }), { headerBg: '', headerColor: '' });
});

test('header color: each solid bar gets readable menu text, and a button that would vanish takes the text color', () => {
  const theme = { primaryColor: '#e11d48', accentColor: '#0f172a' };
  for (const headerBg of ['white', 'dark', 'brand', 'accent', 'custom']) {
    const t = { ...theme, headerBg, headerColor: '#fde047' };
    const bg = hc.barColor(t);
    const css = hc.css(t);
    assert.match(css, new RegExp(`background: ${bg}`));
    const ink = contrast.textOn(bg);
    assert.ok(contrast.ratio(ink, bg) >= 4.5, headerBg);
    assert.match(css, new RegExp(`a:not\\(\\.nav-cta\\) \\{ color: ${ink}`));
  }
  assert.match(hc.css({ ...theme, headerBg: 'brand' }), /\.nav-cta[^{]*\{ background: #ffffff; color: #e11d48; \}/);
  assert.doesNotMatch(hc.css({ ...theme, headerBg: 'dark' }), /\.nav-cta[^{]*\{ background/);
  assert.equal(hc.barColor({ ...theme, headerBg: 'custom' }), '#e11d48', 'no color of their own: the brand color');
});

test('header color: clear drops the bar and turns solid on scroll; the see-through header keeps its clear top', () => {
  const css = hc.css({ headerBg: 'clear' });
  assert.match(css, /hdrc-clear:not\(\.hdr-transparent\) nav#siteNav:not\(\.scrolled\) \{ background: transparent/);
  assert.match(css, /nav#siteNav\.scrolled \{ background: var\(--page-bg\)/);
  assert.match(hc.css({ headerBg: 'dark' }), /body\.hdrc\.hdr-transparent nav#siteNav\.scrolled \{/);
  assert.doesNotMatch(hc.css({ headerBg: 'dark' }), /hdr-transparent nav#siteNav:not/);
  assert.equal(hc.css({ headerBg: '' }), '');
  assert.equal(hc.bodyClasses({ headerBg: 'brand' }), ' hdrc hdrc-brand');
});
