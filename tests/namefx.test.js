const test = require('node:test'); const assert = require('node:assert/strict');
const nf = require('../namefx'); const contrast = require('../contrast'); const themes = require('../themes');

test('namefx: the owner picks a mode and an optional color; anything else is ignored', () => {
  assert.deepEqual(nf.parse({ theme_nameFx: 'shimmer', theme_nameColor: ' #E11D48 ' }), { nameFx: 'shimmer', nameColor: '#e11d48' });
  assert.deepEqual(nf.parse({ theme_nameFx: 'blink', theme_nameColor: 'red' }), { nameFx: '', nameColor: '' });
  assert.equal(nf.css({ nameFx: '', primaryColor: '#e11d48' }, { nav: '#ffffff' }), '', 'off by default');
});

test('namefx: every color stays readable on the background it sits on, and the moving modes always have two colors', () => {
  const pale = { nameFx: 'cycle', primaryColor: '#fde047', accentColor: '#a5f3fc', nameColor: '#ffffff' };
  for (const bg of ['#ffffff', '#fff8f0', '#0f172a', '#161616']) {
    const p = nf.palette(pale, bg);
    assert.ok(p.length >= 2 && p.length <= 3);
    p.forEach(c => assert.ok(contrast.ratio(c, bg) >= 4.5, `${c} on ${bg}`));
  }
  const one = nf.palette({ nameFx: 'shimmer', primaryColor: '#e11d48', accentColor: '#e11d48' }, '#ffffff');
  assert.equal(one.length, 2); assert.notEqual(one[0], one[1]);
  const reds = nf.palette({ nameFx: 'shimmer', primaryColor: '#FF2B2B', accentColor: '#e02626' }, '#ffffff');
  const d = (a, b) => { const x = contrast.parseHex(a), y = contrast.parseHex(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
  assert.ok(d(reds[0], reds[1]) >= 70, 'two near-identical reds still give a visible change');
  assert.deepEqual(nf.palette({ nameFx: 'color', primaryColor: '#1d4ed8', nameColor: '#b91c1c' }, '#ffffff'), ['#b91c1c']);
  assert.deepEqual(nf.palette({ nameFx: 'color', primaryColor: '#1d4ed8' }, '#ffffff'), ['#1d4ed8'], 'no color typed: the Primary color');
});

test('namefx: backgrounds follow the style (header color, footer band, dark mode page)', () => {
  assert.deepEqual(nf.backgrounds({}, null, { pageBg: '#ffffff', ink: '#0f172a' }), { nav: '#ffffff', footer: '#0f172a', dark: '' });
  assert.equal(nf.backgrounds({ accentColor: '#d97706' }, null, { pageBg: '#ffffff', ink: '#1f2a37', agency: true }).footer, '#d97706');
  assert.equal(nf.backgrounds({}, themes.byId.gallery, { pageBg: '#ffffff', ink: '#0f172a' }).nav, '#161616', 'a style with its own dark header');
  const noir = nf.backgrounds({ bgColor: '#101010' }, themes.byId.noir, {});
  assert.equal(noir.nav, '#101010'); assert.ok(contrast.luminance(noir.footer) < contrast.luminance(noir.nav));
});

test('namefx: the shine and the color change only move for visitors who allow motion, and stay readable over a hero photo', () => {
  const t = { nameFx: 'shimmer', primaryColor: '#e11d48', accentColor: '#fbbf24' };
  const css = nf.css(t, { nav: '#ffffff', footer: '#0f172a', dark: '#0c0e15' });
  assert.match(css, /nav\.site-nav \.brand \{ --nm1: #e11d48; --nm2: #[0-9a-f]{6};/);
  assert.match(css, /\.footer-grid \.brand \{ --nm1:/); assert.match(css, /html\[data-theme="dark"\] body :is\(nav\.site-nav, \.footer-grid\) \.brand \{/);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{[^}]*animation: sg-nm-shine/);
  assert.doesNotMatch(css.replace(/@media \(prefers-reduced-motion: no-preference\) \{[^\n]*\n/g, ''), /animation:/, 'no animation outside the motion-allowed block');
  const over = /body\.hdr-transparent nav\.site-nav:not\(\.scrolled\) \.brand \{ --nm1: (#[0-9a-f]{6}); --nm2: (#[0-9a-f]{6})/.exec(css);
  assert.ok(over, 'over a hero photo the name gets light tints'); assert.ok(contrast.ratio(over[1], '#2a2a2a') >= 4.5 && contrast.ratio(over[2], '#2a2a2a') >= 4.5);
  assert.match(css, /hdr-transparent nav\.site-nav:not\(\.scrolled\) \.brand \.sg-name \{ text-shadow: none; filter: drop-shadow/);
  assert.doesNotMatch(nf.css(t, { nav: '#ffffff', footer: '' }), /footer-grid \.brand \{/, 'an unknown footer is left as it is');
  assert.match(nf.css({ ...t, nameFx: 'cycle' }), /@keyframes sg-nm-cycle/);
});
