const test = require('node:test');
const assert = require('node:assert');
const xf = require('../extrafx');

test('more effects: only known switches are kept, each becomes a body class', () => {
  assert.deepEqual(xf.parse({ theme_xfx_scramble: '1', theme_xfx_zoom: 'on', theme_xfx_nonsense: '1', theme_xfx_glow: '0' }), { xfx: ['scramble', 'zoom'] });
  assert.deepEqual(xf.parse({}), { xfx: [] });
  assert.equal(xf.EFFECTS.length, 19);
  assert.equal(xf.bodyClasses({ xfx: ['flip', 'bogus', 'roll'] }), ' xfxon-flip xfxon-roll');
  assert.equal(xf.bodyClasses({}), '');
  // body classes never reuse a name the script gives to the pieces it adds
  // (the CSS may key off a whole switch class, as snap and spring do, but never a longer name built on one)
  xf.IDS.forEach(id => assert.doesNotMatch(xf.CSS, new RegExp('\\.xfxon-' + id + '[\\w-]')));
});

test('more effects: the page data holds only the client\'s own name and photos, safely escaped', () => {
  const site = { name: 'Bob </script> Co', theme: { xfx: ['zoom', 'reveal'] }, sections: { hero: { imageUrl: '/uploads/a.jpg' }, services: { items: [{ title: 'Roofs', imageUrl: 'https://x.test/r.jpg' }, { title: 'Gutters', imageUrl: 'javascript:alert(1)' }, { title: 'Siding', imageUrl: '' }] } } };
  const d = xf.data(site, 'home');
  assert.doesNotMatch(d, /<\/script>/); assert.match(d, /\\u003c\/script>/);
  const o = JSON.parse(d);
  assert.deepEqual(o.zoom, { name: 'Bob </script> Co', img: '/uploads/a.jpg' });
  assert.deepEqual(o.svc, [{ t: 'Roofs', img: 'https://x.test/r.jpg' }]);
  assert.equal(JSON.parse(xf.data(site, 'about')).zoom, undefined);
  assert.equal(JSON.parse(xf.data({ ...site, theme: { xfx: ['zoom'] }, sections: { hero: { imageUrl: 'http://plain.test/a.jpg' } } }, 'home')).zoom, undefined);
});

test('more effects: the script parses and leaves motion-off visitors alone', () => {
  assert.doesNotThrow(() => new Function(xf.SCRIPT));
  assert.match(xf.SCRIPT, /prefers-reduced-motion: reduce/); assert.match(xf.SCRIPT, /data-motion'\) === 'none'/);
  assert.match(xf.CSS, /@media \(prefers-reduced-motion: no-preference\)/);
});

test('more effects: blocks can have their own, never the cursor or nudge, and the opener only on a hero', () => {
  assert.deepEqual(xf.forBlock(['scramble', 'cursor', 'nudge', 'zoom', 'scramble', 'nope'], 'services'), ['scramble']);
  assert.deepEqual(xf.forBlock(['zoom'], 'hero'), ['zoom']);
  assert.deepEqual(xf.forBlock('glow', 'cta'), []);
  const menu = xf.blockMenu();
  assert.equal(menu.length, 17); menu.forEach(m => assert.ok(m[2] && m[2].length > 10, m[0]));
  // the page data is made for effects on single blocks too
  const site = { name: 'Bob', theme: {}, sections: { hero: { imageUrl: '/uploads/a.jpg' }, services: { items: [] } } };
  assert.deepEqual(JSON.parse(xf.data(site, 'home')), {});
  assert.deepEqual(JSON.parse(xf.data(site, 'home', ['zoom'])).zoom, { name: 'Bob', img: '/uploads/a.jpg' });
  assert.match(xf.SCRIPT, /\.sg-mix\[data-xfx~="/);
});

test('more effects: the GSAP-style set (glide, flick, fall, skew, ripple, snap, spring), hand-written', () => {
  for (const id of ['glide', 'flick', 'fall', 'skew', 'ripple', 'snap', 'spring']) { assert.ok(xf.IDS.includes(id), id); assert.ok(xf.SECTION_IDS.includes(id), id); }
  assert.doesNotMatch(xf.SCRIPT + xf.CSS, /gsap|ScrollTrigger|animate\.css/i);
  // "whole page" smooth scrolling and snapping would fight, so snapping steps aside
  assert.equal(xf.bodyClasses({ xfx: ['snap'], smoothScroll: 'page' }), ' xfxon-snap xfx-nosnap');
  assert.match(xf.CSS, /:not\(\.xfx-nosnap\)\)\{scroll-snap-type:y proximity\}|:not\(\.xfx-nosnap\)\) \{ scroll-snap-type: y proximity/);
  // the springy feel is a CSS spring curve that the site's own motion picks up
  assert.match(xf.CSS, /--mp-ease: ?linear\(0, /);
  // gallery filter buttons come only from the client's own service names
  const site = { name: 'Bob', theme: { xfx: ['glide'] }, sections: { services: { items: [{ title: 'Roof repair' }, { title: '' }, { title: 'Gutters' }] } } };
  assert.deepEqual(JSON.parse(xf.data(site, 'home')).cats, ['Roof repair', 'Gutters']);
  assert.equal(JSON.parse(xf.data({ ...site, theme: {} }, 'home')).cats, undefined);
});

test('effect checkup: scramble waits until it can be seen, pinned cards stay free, preview notes are owner-only', () => {
  assert.doesNotThrow(() => new Function(xf.SCRIPT));
  // the scramble plays once the heading is on screen and visible, not while it is still faded in or off screen
  assert.match(xf.SCRIPT, /data-xfx-sc/);
  // a pin that only holds the section (stack, deck, fan) still lets card effects like flip run
  assert.match(xf.SCRIPT, /\.sg-pin-stack, \.sg-pin-deck, \.sg-pin-fan/);
  // the "nothing to work on here" note only shows in the owner's preview
  assert.match(xf.SCRIPT, /hasAttribute\('data-sg-pv'\)/);
  assert.match(xf.SCRIPT, /Only you see this note/);
  assert.match(xf.CSS + xf.SCRIPT, /\.xfx-note/);
  const ejs = require('fs').readFileSync(require('path').join(__dirname, '..', 'views', 'public-site.ejs'), 'utf8');
  assert.match(ejs, /startsWith\('\/sites\/'\)\) \{ %> data-sg-pv="1"/);
});
