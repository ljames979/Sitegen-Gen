// More effects (Motion extras, "More effects"): twelve switches Leo picked from a menu of effects SiteGen did not have.
// Ideas from Codrops, Awwwards and CodePen demos and from what GSAP and Motion One are used for; the code is our own,
// so no library is bundled (GSAP's free license does not allow site-builder tools, Animate.css's license is not
// MIT). Each switch adds a body class (xfxon-<id>; the xfx-* names are the pieces the script adds); the CSS and the small script below are put in the page only when
// at least one is on, so they also go out with the download. The script only rearranges what the page already shows:
// the words, photos and names are always the client's own. Visitors who ask for less motion (or a site with Motion
// style "None") get the page as it was, still and complete.
const EFFECTS = [
  ['scramble', 'Text scramble', 'The hero headline\'s letters shuffle like code, then settle into the real words'],
  ['sideways', 'Sideways scroll', 'Services and gallery hold still while their cards slide across as visitors scroll (wider screens)'],
  ['cursor', 'Custom cursor', 'A small ring follows the mouse and grows over buttons, with a "View" label over photos that open (computers only)'],
  ['draw', 'Self-drawing icons', 'Line icons draw their own outlines as they scroll into view'],
  ['reveal', 'Hover photo reveal', 'Pointing at a service name that has no photo beside it floats that service\'s photo next to the mouse (computers only)'],
  ['glow', 'Glowing border', 'A light runs around the main buttons and the featured price card'],
  ['flip', 'Flip cards', 'Service cards with a photo flip over to show their description when pointed at or tapped'],
  ['nudge', 'Nudging call button', 'After a few idle seconds the main call button gives a gentle wiggle (three times at most)'],
  ['roll', 'Rolling digits', 'Numbers roll into place like an odometer instead of counting up'],
  ['speed', 'Speed-reactive banner', 'Scrolling banners follow the scroll direction, speed up and lean while the visitor scrolls'],
  ['zoom', 'Photo-through-letters opener', 'The home page opens with the business name in huge letters filled with the hero photo; scrolling zooms through the letters into the photo'],
  ['drag', 'Draggable photo strip', 'The gallery becomes one row visitors can grab and fling sideways'],
  // the second menu (2026-10-28): what GSAP is known for, written here from scratch
  ['glide', 'Gallery filter that glides', 'Buttons above the gallery, one for each service named in your photo descriptions, plus All; the photos glide to their new places'],
  ['flick', 'Flick cards', 'Visitors can grab a service card and throw it; it springs back into place with a wobble'],
  ['fall', 'Falling letters', 'Section headings\' letters drop in and bounce as they come into view'],
  ['skew', 'Speed skew', 'Photos and headings lean with how fast the page is scrolled, then straighten'],
  ['ripple', 'Ripple grid', 'Service and gallery cards pop outward in a ripple when they come into view and when one is pointed at or tapped'],
  ['snap', 'Snap to sections', 'Scrolling settles each section neatly at the top of the screen (not with "Whole page" smooth scrolling)'],
  ['spring', 'Springy feel', 'Everything that slides or grows in overshoots a little and settles with a spring'],
];
const IDS = EFFECTS.map(e => e[0]);
// The ones that can also be switched on for one block of a Blocks page (the Blocks screen's Effects menu); the cursor and
// the call-button nudge belong to the whole site. The opener only goes on a hero block.
const SECTION_IDS = IDS.filter(id => id !== 'cursor' && id !== 'nudge');
// what each one does to a single block, for the Blocks screen's Effects menu
const BLOCK_TEXT = {
  scramble: 'Its headline\'s letters shuffle like code, then settle into the real words',
  sideways: 'Its cards slide across while the block holds still as visitors scroll (wider screens; needs 4 cards or more and a block that fits on one screen)',
  draw: 'Its line icons (if it has any) draw their own outlines as they come into view',
  reveal: 'Pointing at a service name in it floats that service\'s photo next to the mouse (computers only)',
  glow: 'A light runs around its main button and featured price card',
  flip: 'Its cards that have a photo and a description flip over to show the description',
  roll: 'Its numbers roll into place like an odometer',
  speed: 'Its scrolling banner follows the scroll direction, speeds up and leans while the visitor scrolls',
  zoom: 'The page opens with the business name in huge letters filled with the hero photo (hero blocks only)',
  drag: 'Its photos become one row visitors can grab and fling sideways',
  glide: 'Buttons for each service named in its photo descriptions, plus All; the photos glide to their new places (needs descriptions that name 2 services)',
  flick: 'Its cards can be grabbed and thrown; they spring back into place',
  fall: 'Its heading\'s letters drop in and bounce',
  skew: 'Its photos and headings lean with the scrolling speed',
  ripple: 'Its cards pop outward in a ripple when it comes into view and when one is pointed at or tapped',
  snap: 'Scrolling settles this block neatly at the top of the screen',
  spring: 'What slides or grows in here overshoots a little and settles with a spring',
};
const blockMenu = () => EFFECTS.filter(e => SECTION_IDS.includes(e[0])).map(e => [e[0], e[1], BLOCK_TEXT[e[0]]]);
const forBlock = (v, fam) => (Array.isArray(v) ? v : []).filter((id, i, a) => SECTION_IDS.includes(id) && a.indexOf(id) === i && (id !== 'zoom' || fam === 'hero'));
const on = v => v === '1' || v === 'on' || v === true;

function parse(b) {
  return { xfx: IDS.filter(id => on(b['theme_xfx_' + id])) };
}
const list = theme => ((theme && theme.xfx) || []).filter(id => IDS.includes(id));
// "Whole page" smooth scrolling glides the wheel itself, which snapping would fight
const bodyClasses = theme => list(theme).map(id => ' xfxon-' + id).join('') + (theme && theme.smoothScroll === 'page' ? ' xfx-nosnap' : '');

// What the script needs from the site: the name and hero photo (opener, home page only) and each service's photo
// (hover reveal). JSON with "<" escaped, so it can sit in a <script type="application/json">.
// blockFx: the effects switched on for single blocks of the page (they need the same data).
function data(site, page, blockFx) {
  const fx = list(site.theme).concat(blockFx || []), s = site.sections || {}, out = {};
  if (fx.includes('zoom') && page === 'home') {
    const img = String((s.hero || {}).imageUrl || '');
    const name = String(site.name || '').trim();
    if (/^(https:\/\/|\/uploads\/)[^\s"'<>()]+$/.test(img) && name) out.zoom = { name: name.slice(0, 40), img };
  }
  if (fx.includes('glide')) out.cats = ((s.services || {}).items || []).map(x => String((x && x.title) || '').trim()).filter(Boolean).slice(0, 12).map(t => t.slice(0, 80));
  if (fx.includes('reveal')) {
    out.svc = ((s.services || {}).items || []).filter(x => x && x.title && /^(https:\/\/|\/uploads\/)[^\s"'<>()]+$/.test(x.imageUrl || ''))
      .slice(0, 12).map(x => ({ t: String(x.title).slice(0, 120), img: x.imageUrl }));
  }
  return JSON.stringify(out).replace(/</g, '\\u003c');
}

// A spring as a CSS linear() curve: overshoots, swings back a little and settles (damping 0.45)
const SPRING = (() => {
  const z = 0.45, w = 11, wd = w * Math.sqrt(1 - z * z), pts = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push(+(1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t))).toFixed(3)); }
  pts[40] = 1;
  return `linear(${pts.join(', ')})`;
})();
// Everything that moves is inside the no-preference query; the script also checks before changing anything.
const CSS = `
.xfx-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@media (prefers-reduced-motion: no-preference) {
  /* rolling digits */
  .xfx-od { display: inline-block; height: 1.1em; line-height: 1.1em; overflow: hidden; vertical-align: bottom; }
  .xfx-od-s { display: block; transition: transform calc(1.6s * var(--mp-k, 1)) cubic-bezier(.2,.8,.2,1); }
  .xfx-od-s > span { display: block; height: 1.1em; }
  /* self-drawing icons */
  svg.xfx-draw * { transition: stroke-dashoffset calc(1.3s * var(--mp-k, 1)) ease; }
  /* custom cursor */
  .xfx-cur { position: fixed; left: 0; top: 0; z-index: 2147483000; width: 34px; height: 34px; margin: -17px 0 0 -17px; border: 2px solid var(--primary); border-radius: 50%; pointer-events: none; opacity: 0; display: grid; place-items: center; transition: width .25s ease, height .25s ease, margin .25s ease, background-color .25s ease, opacity .2s ease, border-color .25s ease; mix-blend-mode: normal; }
  .xfx-cur.on { opacity: 1; }
  .xfx-cur.big { width: 58px; height: 58px; margin: -29px 0 0 -29px; background: color-mix(in srgb, var(--primary) 16%, transparent); }
  .xfx-cur.view { width: 78px; height: 78px; margin: -39px 0 0 -39px; background: var(--primary); border-color: var(--primary); }
  .xfx-cur span { font: 600 13px/1 var(--body-font, system-ui); color: var(--on-primary, #fff); opacity: 0; transition: opacity .2s ease; }
  .xfx-cur.view span { opacity: 1; }
  /* hover photo reveal */
  .xfx-float { position: fixed; left: 0; top: 0; z-index: 2147482999; width: 220px; aspect-ratio: 4 / 3; border-radius: var(--radius, 10px); overflow: hidden; pointer-events: none; opacity: 0; transform: scale(.85) rotate(-4deg); transition: opacity .25s ease, transform .35s cubic-bezier(.2,.8,.2,1); box-shadow: 0 18px 40px rgba(0,0,0,.25); }
  .xfx-float.on { opacity: 1; transform: none; }
  .xfx-float img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .xfx-rv { cursor: default; }
  /* glowing border */
  @property --xfx-a { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
  .xfx-glow { position: relative; isolation: isolate; box-shadow: 0 0 22px color-mix(in srgb, var(--primary) 45%, transparent); }
  .xfx-glow::before { content: ""; position: absolute; inset: -3px; padding: 3px; border-radius: inherit; pointer-events: none; z-index: 2;
    background: conic-gradient(from var(--xfx-a), transparent 0 62%, color-mix(in srgb, var(--primary) 55%, #fff) 78%, #fff 84%, var(--primary) 92%, transparent 100%);
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; animation: xfx-spin 3.2s linear infinite; }
  @keyframes xfx-spin { to { --xfx-a: 360deg; } }
  /* flip cards: the words and photo turn over to the description on the brand color; the card itself stays still */
  .xfx-flip { position: relative; perspective: 1100px; }
  .xfx-front, .xfx-back { backface-visibility: hidden; -webkit-backface-visibility: hidden; transition: transform calc(.7s * var(--mp-k, 1)) cubic-bezier(.3,.7,.2,1); }
  .xfx-back { position: absolute; inset: 0; z-index: 3; transform: rotateY(180deg); background: var(--primary); color: var(--on-primary, #fff); border-radius: inherit; padding: clamp(18px, 3vw, 28px); overflow: auto; display: flex; flex-direction: column; justify-content: center; gap: .6em; text-align: left; }
  .xfx-back :is(h2, h3, h4, p, a) { color: inherit !important; margin: 0; }
  .xfx-back a { text-decoration: underline; font-weight: 600; }
  .xfx-flip:is(:hover, :focus-within, .xfx-on) > .xfx-front { transform: rotateY(-180deg); }
  .xfx-flip:is(:hover, :focus-within, .xfx-on) > .xfx-back { transform: rotateY(0deg); }
  /* nudging call button */
  .xfx-wig { animation: xfx-wig .9s ease both; }
  @keyframes xfx-wig { 0%, 100% { transform: none; } 15% { transform: scale(1.06) rotate(-4deg); } 30% { transform: scale(1.06) rotate(4deg); } 45% { transform: scale(1.06) rotate(-3deg); } 60% { transform: scale(1.04) rotate(2deg); } 75% { transform: scale(1.02); } }
  /* photo-through-letters opener */
  .xfx-zoom { position: relative; height: 230vh; background: #0b0b0d; }
  .xfx-zoom-in { position: sticky; top: 0; height: 100vh; overflow: hidden; display: grid; place-items: center; }
  .xfx-zoom-photo { position: absolute; inset: 0; background: center / cover no-repeat; opacity: var(--o, 0); }
  .xfx-zoom-word { position: relative; margin: 0; padding: 0 4vw; font: 900 min(24vw, calc(165vw / var(--len, 8)), 17rem)/.9 var(--heading-font, system-ui); text-transform: uppercase; letter-spacing: -.02em; text-align: center; color: transparent; background: center / cover no-repeat; -webkit-background-clip: text; background-clip: text; transform: scale(var(--s, 1)); will-change: transform; }
  .xfx-zoom-hint { position: absolute; bottom: 28px; left: 50%; transform: translateX(-50%); font: 600 12px/1 var(--body-font, system-ui); letter-spacing: .2em; text-transform: uppercase; color: rgba(255,255,255,.7); opacity: calc(1 - var(--o, 0) * 3); }
  /* sideways scroll */
  .xfx-side > :first-child { position: sticky; top: 0; height: 100vh; overflow: hidden; display: flex; flex-direction: column; justify-content: center; }
  .xfx-track { display: flex !important; flex-wrap: nowrap !important; grid-template-columns: none !important; columns: auto !important; width: max-content !important; max-width: none !important; gap: clamp(16px, 2vw, 28px) !important; will-change: transform; }
  .xfx-track > * { flex: 0 0 clamp(260px, 28vw, 380px) !important; width: clamp(260px, 28vw, 380px) !important; margin: 0 !important; grid-column: auto !important; grid-row: auto !important; }
}
@media (prefers-reduced-motion: no-preference) {
  /* springy feel: the motion scripts' own easing becomes a spring */
  body.xfxon-spring, .sg-mix[data-xfx~="spring"] { --mp-ease: ${SPRING}; }
  /* snap to sections */
  html:has(> body:is(.xfxon-snap, :has(.sg-mix[data-xfx~="snap"])):not(.xfx-nosnap)) { scroll-snap-type: y proximity; }
  body.xfxon-snap:not(.xfx-nosnap) main > :is(section, .sg-sec, .sg-mix, div[id]), body:not(.xfx-nosnap) .sg-mix[data-xfx~="snap"] { scroll-snap-align: start; }
  /* gallery filter */
  .xfx-filt { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin: 0 0 1.25rem; }
  .xfx-filt button { font: 600 14px/1 var(--body-font, inherit); padding: .6em 1.1em; border-radius: 999px; border: 1.5px solid color-mix(in srgb, currentColor 25%, transparent); background: transparent; color: inherit; cursor: pointer; transition: background-color .2s ease, color .2s ease, border-color .2s ease; }
  .xfx-filt button[aria-pressed="true"] { background: var(--primary); border-color: var(--primary); color: var(--on-primary, #fff); }
  .xfx-gone { display: none !important; }
  /* flick cards */
  .xfx-flick { touch-action: pan-y; cursor: grab; user-select: none; -webkit-user-select: none; }
  .xfx-flick.xfx-held { cursor: grabbing; z-index: 5; position: relative; }
  .xfx-flick img { -webkit-user-drag: none; }
  /* falling letters */
  .xfx-fw { display: inline-block; white-space: nowrap; }
  .xfx-fl { display: inline-block; }
  .xfx-fall .xfx-fl { opacity: 0; transform: translateY(-1.4em) rotate(var(--r, 0deg)); }
  .xfx-fall.xfx-in .xfx-fl { animation: xfx-drop calc(.9s * var(--mp-k, 1)) both; animation-delay: calc(var(--i) * 32ms * var(--mp-k, 1)); }
  @keyframes xfx-drop { 0% { opacity: 0; transform: translateY(-1.4em) rotate(var(--r, 0deg)); animation-timing-function: cubic-bezier(.55, 0, 1, .45); } 45% { opacity: 1; transform: translateY(0) rotate(0deg); animation-timing-function: cubic-bezier(0, .55, .45, 1); } 62% { transform: translateY(-.28em); animation-timing-function: cubic-bezier(.55, 0, 1, .45); } 78% { transform: translateY(0); animation-timing-function: cubic-bezier(0, .55, .45, 1); } 88% { transform: translateY(-.07em); } 100% { opacity: 1; transform: none; } }
}
/* the owner's note on a block whose effect has nothing to work on */
.xfx-note { position: relative; z-index: 50; margin: 0; padding: 6px 12px; font: 600 13px/1.4 system-ui, sans-serif; color: #5a3b00; background: #fff4cf; border-bottom: 1px solid #f0d58a; }
/* draggable photo strip (also for visitors with motion off: it only stops gliding) */
.xfx-strip { display: flex !important; flex-wrap: nowrap !important; grid-template-columns: none !important; columns: auto !important; gap: 16px !important; overflow-x: auto !important; overscroll-behavior-x: contain; scrollbar-width: none; cursor: grab; user-select: none; -webkit-user-select: none; padding-bottom: 4px; }
.xfx-strip::-webkit-scrollbar { display: none; }
.xfx-strip.xfx-grab { cursor: grabbing; }
.xfx-strip > * { flex: 0 0 auto !important; width: clamp(220px, 32vw, 420px) !important; margin: 0 !important; grid-column: auto !important; grid-row: auto !important; break-inside: auto; }
.xfx-strip img { height: clamp(220px, 34vw, 380px) !important; aspect-ratio: auto !important; object-fit: cover; -webkit-user-drag: none; pointer-events: none; }
.xfx-strip > :not(img) img { width: 100% !important; }
.xfx-strip:focus-visible { outline: 3px solid var(--primary); outline-offset: 4px; }
`;

const SCRIPT = `(function () {
  'use strict';
  var d = document, b = d.body;
  if (!b || !d.querySelector) return;
  var mm = function (q) { return !!(window.matchMedia && matchMedia(q).matches); };
  var still = mm('(prefers-reduced-motion: reduce)') || b.getAttribute('data-motion') === 'none';
  var fine = mm('(hover: hover) and (pointer: fine)');
  var has = function (id) { return b.classList.contains('xfxon-' + id); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  var cfg = {}; try { cfg = JSON.parse((d.getElementById('sg-xfx') || {}).textContent || '{}') || {}; } catch (e) {}
  var onScroll = window.sgOnScroll || function (f) { addEventListener('scroll', f, { passive: true }); addEventListener('resize', f); };
  var k = parseFloat(getComputedStyle(b).getPropertyValue('--mp-k')) || 1;
  var clamp = function (v, a, z) { return Math.max(a, Math.min(z, v)); };
  var seen = function (els, fn, th) {
    if (!els.length) return;
    if (!window.IntersectionObserver) { els.forEach(fn); return; }
    var io = new IntersectionObserver(function (en) { en.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); fn(e.target); } }); }, { threshold: th || 0.35 });
    els.forEach(function (el) { io.observe(el); });
  };
  var norm = function (s) { return String(s || '').replace(/\\s+/g, ' ').trim().toLowerCase(); };
  // layouts that already move on their own are left alone
  var BUSY = /ticker|story|stack|fan|zoom|reel|film|marquee|carousel|slider/;
  var busy = function (sec) { var s = sec.querySelector('[data-sg-section]'); return (s && BUSY.test(s.getAttribute('data-sg-section'))) || sec.querySelector('[data-sg-progress], .sg-marquee') || (sec.closest && sec.closest('.sg-pin-stack, .sg-pin-deck, .sg-pin-fan')); };   // a pin that only holds the section still leaves its cards free
  // the repeated cards in a section: the element with the most children that all share one tag (3 or more)
  var cardsIn = function (root) {
    var marked = root.querySelector('[data-sg-cards]'); if (marked && marked.children.length >= 3) return marked;
    var best = null, n = 0;
    [root].concat($$('*', root)).forEach(function (el) {
      var c = el.children; if (c.length < 3 || c.length <= n) return;
      for (var i = 1; i < c.length; i++) if (c[i].tagName !== c[0].tagName) return;
      best = el; n = c.length;
    });
    return best;
  };
  var secs = function (fam, classic) {
    var out = $$('.sg-sec[data-sg-fam="' + fam + '"]');
    $$(classic).forEach(function (g) { var s = g.closest('section'); if (s && out.indexOf(s) < 0 && !s.closest('.sg-sec')) out.push(s); });
    return out.filter(function (s) { return !busy(s); });
  };
  var heroOf = function () { return d.querySelector('.sg-sec[data-sg-fam="hero"], #hero, .hero'); };
  // an effect switched on for single blocks (Blocks screen): those blocks' wrappers; null when it is on for the whole site
  var only = function (id) { return has(id) ? null : $$('.sg-mix[data-xfx~="' + id + '"]'); };
  var on = function (id) { return has(id) || only(id).length > 0; };
  var within = function (id, s) { var r = only(id); if (!r) return $$(s); var out = []; r.forEach(function (w) { out = out.concat($$(s, w)); }); return out; };
  var blocks = function (id, all) { var r = only(id); return r ? r.filter(function (w) { return !busy(w); }) : all(); };

  // ---- rolling digits: runs before the motion scripts, which then find no counters to count ----
  if (on('roll') && !still) within('roll', '[data-count]').forEach(function (el) {
    var v = +el.getAttribute('data-count'); if (!isFinite(v)) return;
    var dec = +(el.getAttribute('data-decimals') || 0), s = v.toFixed(dec);
    if (el.getAttribute('data-comma')) { var p = s.split('.'); p[0] = p[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, ','); s = p.join('.'); }
    var txt = (el.getAttribute('data-prefix') || '') + s + (el.getAttribute('data-suffix') || '');
    el.removeAttribute('data-count'); el.setAttribute('data-xfx-count', v); el.textContent = '';
    var sr = d.createElement('span'); sr.className = 'xfx-sr'; sr.textContent = txt; el.appendChild(sr);
    var cols = [];
    txt.split('').forEach(function (ch) {
      var box = d.createElement('span'); box.setAttribute('aria-hidden', 'true');
      if (/\\d/.test(ch)) {
        box.className = 'xfx-od'; var strip = d.createElement('span'); strip.className = 'xfx-od-s';
        for (var r = 0; r < 20; r++) { var dg = d.createElement('span'); dg.textContent = r % 10; strip.appendChild(dg); }
        box.appendChild(strip); cols.push([strip, 10 + +ch]);
      } else box.textContent = ch;
      el.appendChild(box);
    });
    seen([el], function () { cols.forEach(function (c, i) { c[0].style.transitionDelay = (i * 90) + 'ms'; c[0].style.transform = 'translateY(-' + (c[1] * 1.1) + 'em)'; }); }, 0.5);
  });

  if (still) return;

  // In the owner's preview, a block whose own effect found nothing to work on says so (and what it needs)
  if (b.hasAttribute('data-sg-pv')) setTimeout(function () {
    var DID = { scramble: '[data-xfx-sc]', sideways: '.xfx-side', draw: '.xfx-draw', reveal: '.xfx-rv', glow: '.xfx-glow', flip: '.xfx-flip', roll: '.xfx-od', speed: '.sg-marquee-track', drag: '.xfx-strip', glide: '.xfx-filt', flick: '.xfx-flick', fall: '.xfx-fall', skew: '[data-xfx-lean]', ripple: '.xfx-rip' };
    var NEED = { scramble: 'a heading', sideways: 'a row of 4 or more cards that runs past the screen (wide screens only)', draw: 'line icons', reveal: 'service names shown without their photo', glow: 'a filled button or a featured price card', flip: 'cards with a photo, a title and a sentence (not cards that stack or fan as you scroll)', roll: 'numbers that count up', speed: 'a scrolling banner of words or logos', drag: 'a gallery grid of 3 or more photos (not the fan)', glide: 'a gallery grid whose photo descriptions name 2 or more services', flick: 'a row or grid of service cards', fall: 'a section heading', skew: 'photos or headings', ripple: 'a row or grid of 3 or more cards' };
    var NAME = ${JSON.stringify(Object.fromEntries(EFFECTS.map(e => [e[0], e[1]])))};
    $$('.sg-mix[data-xfx]').forEach(function (w) {
      var miss = (w.getAttribute('data-xfx') || '').split(' ').filter(function (id) { return DID[id] && !w.querySelector(DID[id]) && !(id === 'sideways' && innerWidth < 768) && !(id === 'reveal' && !fine); });
      if (!miss.length) return;
      var n = d.createElement('p'); n.className = 'xfx-note'; n.setAttribute('aria-hidden', 'true');
      n.textContent = miss.map(function (id) { return (NAME[id] || id) + ' has nothing to work on here: it needs ' + NEED[id] + '.'; }).join(' ') + ' (Only you see this note.)';
      w.insertBefore(n, w.firstChild);
    });
  }, 1600);

  // ---- text scramble on the hero headline ----
  // (it plays once the heading is on screen and its own fade-in has finished, so visitors see it)
  var shown = function (el) { var o = 1; for (var e = el; e && e !== b; e = e.parentElement) o *= +getComputedStyle(e).opacity; return o > 0.92; };
  if (on('scramble')) (only('scramble') ? only('scramble').map(function (w) { return w.querySelector('h1, h2') || w.querySelector('h3, [data-sg-head]'); }) : [d.querySelector('.sg-sec[data-sg-fam="hero"] h1, #hero h1, .hero h1') || d.querySelector('main h1')]).forEach(function (h1) {
    if (h1 && h1.textContent.trim()) { h1.setAttribute('data-xfx-sc', ''); seen([h1], function () { var w0 = performance.now(), wait = function () { if (shown(h1) || performance.now() - w0 > 2500) scramble(h1); else requestAnimationFrame(wait); }; requestAnimationFrame(wait); }, 0.5); }
  });
  function scramble(h1) {
    {
      var full = h1.textContent, nodes = [], tw = d.createTreeWalker(h1, 4), nd;
      while ((nd = tw.nextNode())) if (nd.nodeValue.trim()) nodes.push({ n: nd, s: nd.nodeValue });
      var total = 0; nodes.forEach(function (o) { o.at = []; for (var i = 0; i < o.s.length; i++) o.at.push((total++) ); });
      var gate = []; for (var g = 0; g < total; g++) gate.push(g / total * 0.7 + Math.random() * 0.3);
      var SET = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+';
      var dur = 1500 * Math.max(0.8, k), t0 = 0;
      h1.setAttribute('aria-label', full.trim());
      var frame = function (now) {
        if (!t0) t0 = now; var t = (now - t0) / dur;
        nodes.forEach(function (o) {
          var out = '';
          for (var i = 0; i < o.s.length; i++) {
            var ch = o.s[i];
            if (t >= gate[o.at[i]] || !/\\S/.test(ch)) out += ch;
            else { var r = SET[(Math.random() * SET.length) | 0]; out += ch === ch.toLowerCase() ? r.toLowerCase() : r; }
          }
          o.n.nodeValue = out;
        });
        if (t < 1) requestAnimationFrame(frame); else { nodes.forEach(function (o) { o.n.nodeValue = o.s; }); h1.removeAttribute('aria-label'); }
      };
      requestAnimationFrame(frame);
    }
  }

  // ---- photo-through-letters opener (home page) ----
  if (on('zoom') && cfg.zoom) {
    var hero = only('zoom') ? only('zoom')[0] : heroOf();
    if (hero && hero.parentNode) {
      var z = d.createElement('div'); z.className = 'xfx-zoom'; z.setAttribute('aria-hidden', 'true');
      var url = 'url("' + cfg.zoom.img.replace(/"/g, '') + '")';
      z.innerHTML = '<div class="xfx-zoom-in"><div class="xfx-zoom-photo"></div><p class="xfx-zoom-word"></p><span class="xfx-zoom-hint">Scroll</span></div>';
      var word = z.querySelector('.xfx-zoom-word'); word.textContent = cfg.zoom.name; word.style.backgroundImage = url;
      z.querySelector('.xfx-zoom-photo').style.backgroundImage = url;
      z.style.setProperty('--len', Math.max(4, cfg.zoom.name.length));
      hero.parentNode.insertBefore(z, hero);
      var zin = z.firstChild;
      onScroll(function () {
        var r = z.getBoundingClientRect(), span = r.height - innerHeight; if (span <= 0) return;
        var p = clamp(-r.top / span, 0, 1);
        zin.style.setProperty('--s', (1 + Math.pow(p, 2.4) * 30).toFixed(3));
        zin.style.setProperty('--o', clamp((p - 0.5) / 0.35, 0, 1).toFixed(3));
      });
    }
  }

  // ---- self-drawing icons ----
  if (on('draw')) {
    var svgs = within('draw', 'main svg').filter(function (s) {
      var st = s.getAttribute('stroke'); return st && st !== 'none' && !s.closest(only('draw') ? 'nav, footer' : '.sg-sec[data-sg-fam="hero"], #hero, .hero, nav, footer') && s.getBoundingClientRect().width <= 120;
    }).filter(function (s) {
      var ok = false;
      $$('path, line, polyline, polygon, circle, rect, ellipse', s).forEach(function (p, i) {
        var L = 0; try { L = p.getTotalLength(); } catch (e) {}
        if (!L) return; ok = true;
        p.style.strokeDasharray = L; p.style.strokeDashoffset = L; p.style.transitionDelay = (i * 140) + 'ms';
      });
      if (ok) s.classList.add('xfx-draw');
      return ok;
    });
    seen(svgs, function (s) { requestAnimationFrame(function () { $$('*', s).forEach(function (p) { if (p.style.strokeDasharray) p.style.strokeDashoffset = '0'; }); }); }, 0.6);
  }

  // ---- glowing border: the hero's and call-to-action's first brand button, the featured price card ----
  if (on('glow')) {
    // a link drawn as a filled button: by its class, or else (a single block) the first link with a background color
    var filled = function (a) { var c = getComputedStyle(a).backgroundColor; return c && c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c); };
    var firstBtn = function (root) { return root && (root.querySelector('a[class~="tw:bg-primary"], .btn:not(.btn-outline), a.btn-primary, .t-btn:not(.t-btn-ghost)') || root.querySelector('a[href][class*="rounded"], a.btn') || (only('glow') && $$('a[href]', root).filter(filled)[0])); };
    var glow = only('glow') ? only('glow').map(firstBtn) : [firstBtn(heroOf())];
    if (!only('glow')) $$('.sg-sec[data-sg-fam="cta"], .cta-band').forEach(function (s) { glow.push(firstBtn(s)); });
    within('glow', '.sg-sec[data-sg-fam="pricing"] [class~="tw:bg-primary"]:not(a), .price-card.featured, .price-card.popular').forEach(function (c) { glow.push(c); });
    glow.forEach(function (el) { if (el && !el.closest('.xfx-glow')) el.classList.add('xfx-glow'); });
  }

  // ---- nudging call button ----
  if (has('nudge')) {
    var cands = $$('.mobile-bar a[href^="tel:"], nav.site-nav .nav-cta, .sg-sec[data-sg-fam="hero"] a[href^="tel:"], #hero a[href^="tel:"]');
    var pick = function () { for (var i = 0; i < cands.length; i++) { var r = cands[i].getBoundingClientRect(); if (r.width && r.bottom > 0 && r.top < innerHeight) return cands[i]; } return null; };
    var count = 0, idle = 0;
    var arm = function () { clearTimeout(idle); if (count < 3) idle = setTimeout(function () { var el = pick(); if (!el || d.hidden) return arm(); count++; el.classList.remove('xfx-wig'); void el.offsetWidth; el.classList.add('xfx-wig'); setTimeout(function () { el.classList.remove('xfx-wig'); }, 1000); arm(); }, 6000); };
    ['scroll', 'pointermove', 'keydown', 'touchstart'].forEach(function (ev) { addEventListener(ev, arm, { passive: true }); });
    arm();
  }

  // ---- speed-reactive banner ----
  if (on('speed')) {
    var tracks = within('speed', '.sg-marquee-track');
    if (tracks.length && tracks[0].getAnimations) {
      var lastY = scrollY, lastT = performance.now(), boost = 0, lean = 0, run = 0, dir = 1;
      var tick = function () {
        boost *= 0.92; lean *= 0.88;
        tracks.forEach(function (t) { t.getAnimations().forEach(function (a) { a.playbackRate = dir * (1 + boost); }); t.parentNode.style.transform = Math.abs(lean) > 0.05 ? 'skewX(' + lean.toFixed(2) + 'deg)' : ''; });
        if (boost > 0.02 || Math.abs(lean) > 0.05) run = requestAnimationFrame(tick); else run = 0;
      };
      onScroll(function () {
        var now = performance.now(), dy = scrollY - lastY, dt = Math.max(16, now - lastT); lastY = scrollY; lastT = now;
        var v = dy / dt;
        if (Math.abs(dy) > 2) dir = dy > 0 ? 1 : -1;   // scrolling back up runs the banner backwards
        boost = clamp(Math.max(boost, Math.abs(v) * 2.2), 0, 5); lean = clamp(-v * 5, -9, 9);
        if (!run) run = requestAnimationFrame(tick);
      });
    }
  }

  // ---- draggable photo strip (gallery) ----
  var strips = [];
  if (on('drag')) blocks('drag', function () { return secs('gallery', '.gallery-grid'); }).forEach(function (sec) {
    var tr = cardsIn(sec); if (!tr || tr.children.length < 3 || !tr.querySelector('img')) return;
    tr.classList.add('xfx-strip'); tr.setAttribute('tabindex', '0'); tr.setAttribute('role', 'region'); tr.setAttribute('aria-label', 'Photos: drag or scroll sideways');
    strips.push(sec);
    var down = false, x0 = 0, s0 = 0, lx = 0, lt = 0, v = 0, moved = 0, glide = 0;
    tr.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse' || e.button) return; down = true; moved = 0; x0 = lx = e.clientX; s0 = tr.scrollLeft; lt = performance.now(); v = 0; cancelAnimationFrame(glide); tr.classList.add('xfx-grab'); });
    addEventListener('pointermove', function (e) { if (!down) return; var now = performance.now(); tr.scrollLeft = s0 - (e.clientX - x0); v = (lx - e.clientX) / Math.max(8, now - lt) * 16; lx = e.clientX; lt = now; moved = Math.max(moved, Math.abs(e.clientX - x0)); });
    addEventListener('pointerup', function () {
      if (!down) return; down = false; tr.classList.remove('xfx-grab');
      var go = function () { if (Math.abs(v) < 0.4) return; tr.scrollLeft += v; v *= 0.94; glide = requestAnimationFrame(go); };
      glide = requestAnimationFrame(go);
    });
    tr.addEventListener('click', function (e) { if (moved > 6) { e.preventDefault(); e.stopPropagation(); moved = 0; } }, true);
  });

  // ---- sideways scroll (services, and the gallery when it is not a strip) ----
  if (on('sideways')) {
    var sides = [];
    blocks('sideways', function () { return secs('services', '.svc-tiles').concat(secs('gallery', '.gallery-grid')); }).forEach(function (sec) {
      if (strips.indexOf(sec) >= 0) return;
      var tr = cardsIn(sec); if (!tr || tr.children.length < 4) return;
      sides.push({ sec: sec, tr: tr, travel: 0, on: false });
    });
    var layout = function () {
      sides.forEach(function (o) {
        var want = innerWidth >= 768;
        o.sec.classList.toggle('xfx-side', want); o.tr.classList.toggle('xfx-track', want);
        o.sec.style.height = ''; o.tr.style.transform = ''; o.travel = 0; o.on = false;
        if (!want) return;
        var inner = o.sec.firstElementChild, vis = o.tr.parentNode.getBoundingClientRect();
        var travel = o.tr.scrollWidth - (innerWidth - vis.left) + 24;
        // only when the cards run past the screen and the section fits on one screen
        if (travel <= 40 || (inner.firstElementChild || inner).offsetHeight > innerHeight * 0.98) { o.sec.classList.remove('xfx-side'); o.tr.classList.remove('xfx-track'); return; }
        o.travel = travel; o.on = true; o.sec.style.height = (innerHeight + travel) + 'px';
      });
    };
    if (sides.length) {
      layout();
      var lw = innerWidth; addEventListener('resize', function () { if (innerWidth !== lw) { lw = innerWidth; layout(); } });
      onScroll(function () { sides.forEach(function (o) { if (!o.on) return; var r = o.sec.getBoundingClientRect(), span = r.height - innerHeight; var p = span > 0 ? clamp(-r.top / span, 0, 1) : 0; o.tr.style.transform = 'translate3d(' + (-p * o.travel).toFixed(1) + 'px,0,0)'; }); });
    }
  }

  // ---- flip cards (services with a photo and words) ----
  if (on('flip')) blocks('flip', function () { return secs('services', '.svc-tiles'); }).forEach(function (sec) {
    if (sec.classList.contains('xfx-side')) return;
    var tr = cardsIn(sec); if (!tr) return;
    Array.prototype.slice.call(tr.children).forEach(function (card) {
      var h = card.querySelector('h2, h3, h4'), ps = $$('p', card).filter(function (p) { return p.textContent.trim().length > 12; });
      if (!h || !ps.length || !card.querySelector('img') || card.querySelector('.xfx-front')) return;
      var front = d.createElement('div'); front.className = 'xfx-front';
      while (card.firstChild) front.appendChild(card.firstChild);
      var back = d.createElement('div'); back.className = 'xfx-back'; back.setAttribute('aria-hidden', 'true');
      back.appendChild(h.cloneNode(true)); ps.forEach(function (p) { back.appendChild(p.cloneNode(true)); });
      var a = card.tagName === 'A' ? null : front.querySelector('a[href]');
      if (a) { var c = a.cloneNode(true); c.setAttribute('tabindex', '-1'); back.appendChild(c); }
      $$('a, button', back).forEach(function (x) { x.setAttribute('tabindex', '-1'); });
      card.appendChild(front); card.appendChild(back); card.classList.add('xfx-flip');
      if (!fine) card.addEventListener('click', function (e) { if (card.tagName !== 'A' && !e.target.closest('.xfx-back a')) card.classList.toggle('xfx-on'); });
    });
  });

  // ---- gallery filter that glides: buttons for the services named in the photos' own descriptions ----
  if (on('glide') && cfg.cats && cfg.cats.length) blocks('glide', function () { return secs('gallery', '.gallery-grid'); }).forEach(function (sec) {
    var tr = cardsIn(sec); if (!tr || tr.children.length < 4 || tr.classList.contains('xfx-track')) return;
    var items = Array.prototype.slice.call(tr.children);
    var textOf = function (el) { var t = ''; $$('img', el).forEach(function (i) { t += ' ' + (i.alt || ''); }); if (el.tagName === 'IMG') t += ' ' + (el.alt || ''); return norm(t + ' ' + (el.textContent || '')); };
    var STOP = /^(and|the|for|with|your|our|from|repair|repairs|service|services|install|installation|new)$/;
    var cats = [];
    cfg.cats.forEach(function (c) {
      var words = norm(c).split(' ').filter(function (w) { return w.length >= 4 && !STOP.test(w); });
      var key = norm(c), hit = items.filter(function (it) { var t = textOf(it); return t.indexOf(key) >= 0 || (words.length && words.every(function (w) { return t.indexOf(w) >= 0; })); });
      if (hit.length && hit.length < items.length) cats.push({ name: c, hit: hit });
    });
    if (cats.length < 2) return;
    var bar = d.createElement('div'); bar.className = 'xfx-filt'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Show photos of');
    [{ name: 'All', hit: items }].concat(cats).forEach(function (c, i) {
      var bt = d.createElement('button'); bt.type = 'button'; bt.textContent = c.name; bt.setAttribute('aria-pressed', String(i === 0));
      bt.addEventListener('click', function () {
        $$('button', bar).forEach(function (x) { x.setAttribute('aria-pressed', String(x === bt)); });
        var before = items.map(function (it) { return it.getBoundingClientRect(); }), was = items.map(function (it) { return !it.classList.contains('xfx-gone'); });
        items.forEach(function (it) { it.classList.toggle('xfx-gone', c.hit.indexOf(it) < 0); });
        items.forEach(function (it, j) {
          if (it.classList.contains('xfx-gone') || !it.animate) return;
          var a = it.getBoundingClientRect(), dur = 520 * k;
          if (!was[j]) { it.animate([{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: dur, easing: 'cubic-bezier(.2,.8,.2,1)' }); return; }
          var dx = before[j].left - a.left, dy = before[j].top - a.top, sx = before[j].width / (a.width || 1), sy = before[j].height / (a.height || 1);
          if (Math.abs(dx) + Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.01) return;
          it.animate([{ transformOrigin: '0 0', transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')' }, { transformOrigin: '0 0', transform: 'none' }], { duration: dur, easing: getComputedStyle(b).getPropertyValue('--mp-ease').trim() || 'cubic-bezier(.2,.8,.2,1)' });
        });
      });
      bar.appendChild(bt);
    });
    tr.parentNode.insertBefore(bar, tr);
  });

  // ---- flick cards: grab a card, throw it, it springs back into place ----
  if (on('flick')) blocks('flick', function () { return secs('services', '.svc-tiles'); }).forEach(function (sec) {
    var tr = cardsIn(sec); if (!tr || tr.classList.contains('xfx-track') || tr.classList.contains('xfx-strip')) return;
    Array.prototype.slice.call(tr.children).forEach(function (card) {
      if (card.classList.contains('xfx-flip')) return;
      card.classList.add('xfx-flick');
      // links and photos start the browser's own drag, which would steal the pointer
      card.addEventListener('dragstart', function (e) { e.preventDefault(); });
      var x = 0, y = 0, vx = 0, vy = 0, held = false, sx = 0, sy = 0, lx = 0, ly = 0, lt = 0, moved = 0, loop = 0;
      var paint = function () { card.style.transform = Math.abs(x) + Math.abs(y) < 0.3 && !held ? '' : 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + clamp(x / 14, -14, 14).toFixed(2) + 'deg)'; };
      var settle = function () {   // a spring pulls it home, the air slows it down
        vx += -x * 0.06; vy += -y * 0.06; vx *= 0.86; vy *= 0.86; x += vx; y += vy; paint();
        loop = Math.abs(x) + Math.abs(y) + Math.abs(vx) + Math.abs(vy) > 0.4 ? requestAnimationFrame(settle) : (x = y = 0, paint(), 0);
      };
      card.addEventListener('pointerdown', function (e) { if (e.button) return; held = true; moved = 0; sx = e.clientX - x; sy = e.clientY - y; lx = e.clientX; ly = e.clientY; lt = performance.now(); cancelAnimationFrame(loop); card.classList.add('xfx-held'); try { card.setPointerCapture(e.pointerId); } catch (er) {} });
      card.addEventListener('pointermove', function (e) {
        if (!held) return; var now = performance.now(), dt = Math.max(8, now - lt);
        vx = (e.clientX - lx) / dt * 16; vy = (e.clientY - ly) / dt * 16; lx = e.clientX; ly = e.clientY; lt = now;
        x = e.clientX - sx; y = e.clientY - sy; moved = Math.max(moved, Math.abs(x) + Math.abs(y)); paint();
      });
      var up = function () { if (!held) return; held = false; card.classList.remove('xfx-held'); loop = requestAnimationFrame(settle); };
      card.addEventListener('pointerup', up); card.addEventListener('pointercancel', up);
      card.addEventListener('click', function (e) { if (moved > 8) { e.preventDefault(); e.stopPropagation(); moved = 0; } }, true);
    });
  });

  // ---- falling letters: section headings (or a block's own), each letter drops and bounces ----
  if (on('fall')) {
    var heads = only('fall') ? within('fall', 'h2') : $$('main h2').filter(function (h) { return !h.closest('.sg-sec[data-sg-fam="hero"], #hero, .hero, nav, footer'); });
    heads = heads.filter(function (h) { return !h.closest('.sg-wave, .sg-zw, .sg-ps, .sg-bigw, .sg-cl, .xfx-zoom, .wall, .cascade, .sg-trail, .sg-path') && !h.querySelector('.kx-l, .xfx-fl, [data-sg-roll]') && h.textContent.trim().length <= 90; });
    heads.forEach(function (h) {
      var n = 0, label = h.textContent.replace(/\\s+/g, ' ').trim(), tw = d.createTreeWalker(h, 4), nodes = [], nd;
      while ((nd = tw.nextNode())) nodes.push(nd);
      nodes.forEach(function (t) {
        var frag = d.createDocumentFragment();
        t.nodeValue.split(/(\\s+)/).forEach(function (w) {
          if (!w) return;
          if (/^\\s+$/.test(w)) { frag.appendChild(d.createTextNode(' ')); return; }
          var ws = d.createElement('span'); ws.className = 'xfx-fw'; ws.setAttribute('aria-hidden', 'true');
          w.split('').forEach(function (ch) { var l = d.createElement('span'); l.className = 'xfx-fl'; l.textContent = ch; l.style.setProperty('--i', n++); l.style.setProperty('--r', ((Math.random() - 0.5) * 50).toFixed(0) + 'deg'); ws.appendChild(l); });
          frag.appendChild(ws);
        });
        t.parentNode.replaceChild(frag, t);
      });
      h.setAttribute('aria-label', label); h.classList.add('xfx-fall');
    });
    seen(heads, function (h) { h.classList.add('xfx-in'); }, 0.6);
  }

  // ---- speed skew: photos and headings lean with the scrolling speed ----
  if (on('skew')) {
    var SKIP = '.sg-wave, .sg-trail, .sg-cl, .sg-zw, .sg-path, .sg-story, .wall, .cascade, .sg-pin, .xfx-strip, .xfx-track, .xfx-zoom, [data-sg-tilt], nav, header, footer';
    var leaners = within('skew', 'main img, main h2').filter(function (el) {
      if (el.closest(SKIP) || getComputedStyle(el).transform !== 'none' || /absolute|fixed/.test(getComputedStyle(el).position)) return false;
      return el.tagName !== 'IMG' || el.getBoundingClientRect().width >= 120;
    });
    leaners.forEach(function (el) { el.setAttribute('data-xfx-lean', ''); });
    if (leaners.length) {
      var sy0 = scrollY, st0 = performance.now(), sk = 0, srun = 0;
      var lean2 = function () {
        sk *= 0.86;
        leaners.forEach(function (el) { var r = el.getBoundingClientRect(); if (r.bottom > -50 && r.top < innerHeight + 50) el.style.transform = Math.abs(sk) > 0.04 ? 'skewY(' + sk.toFixed(2) + 'deg)' : ''; });
        srun = Math.abs(sk) > 0.04 ? requestAnimationFrame(lean2) : 0;
      };
      onScroll(function () {
        var now = performance.now(), v = (scrollY - sy0) / Math.max(16, now - st0); sy0 = scrollY; st0 = now;
        sk = clamp(sk * 0.5 + v * 2.2, -7, 7);
        if (!srun) srun = requestAnimationFrame(lean2);
      });
    }
  }

  // ---- ripple grid: the cards pop outward from one card, nearest first ----
  if (on('ripple')) blocks('ripple', function () { return secs('services', '.svc-tiles').concat(secs('gallery', '.gallery-grid')); }).forEach(function (sec) {
    var tr = cardsIn(sec); if (!tr || tr.children.length < 3 || tr.classList.contains('xfx-track') || !tr.animate) return;
    var cards = Array.prototype.slice.call(tr.children), busy2 = false; tr.classList.add('xfx-rip');
    var ripple = function (ox, oy) {
      if (busy2) return; busy2 = true; var far = 0;
      cards.forEach(function (c) {
        var r = c.getBoundingClientRect(), dd = Math.hypot(r.left + r.width / 2 - ox, r.top + r.height / 2 - oy); far = Math.max(far, dd);
        c.animate([{ transform: 'scale(1)' }, { transform: 'scale(.9)', offset: 0.35 }, { transform: 'scale(1.04)', offset: 0.7 }, { transform: 'scale(1)' }], { duration: 620 * k, delay: dd * 0.55, easing: 'ease-in-out', composite: 'add' });
      });
      setTimeout(function () { busy2 = false; }, far * 0.55 + 650 * k);
    };
    seen([tr], function () { var r = tr.getBoundingClientRect(); ripple(r.left + r.width / 2, r.top + r.height / 2); }, 0.4);
    cards.forEach(function (c) {
      c.addEventListener(fine ? 'pointerenter' : 'pointerdown', function () { var r = c.getBoundingClientRect(); ripple(r.left + r.width / 2, r.top + r.height / 2); });
    });
  });

  // ---- snap to sections: stop just under a sticky header ----
  if (on('snap') && !b.classList.contains('xfx-nosnap')) {
    var nav = d.getElementById('siteNav');
    var pad = function () { var r = nav && nav.getBoundingClientRect(), p = nav && getComputedStyle(nav).position; d.documentElement.style.scrollPaddingTop = r && (p === 'fixed' || p === 'sticky') && r.bottom < innerHeight / 3 ? Math.round(r.bottom) + 'px' : ''; };
    pad(); addEventListener('resize', pad);
  }

  // ---- custom cursor and hover photo reveal (mouse only) ----
  if (!fine) return;
  if (has('cursor')) {
    var ring = d.createElement('div'); ring.className = 'xfx-cur'; ring.setAttribute('aria-hidden', 'true'); ring.innerHTML = '<span>View</span>'; b.appendChild(ring);
    var x = -200, y = -200, cx = x, cy = y, loop = 0;
    var step = function () { cx += (x - cx) * 0.22; cy += (y - cy) * 0.22; ring.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)'; loop = Math.abs(x - cx) + Math.abs(y - cy) > 0.3 ? requestAnimationFrame(step) : 0; };
    addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX; y = e.clientY; ring.classList.add('on');
      var t = e.target.closest ? e.target : e.target.parentElement;
      var link = t && t.closest('a[href], button, summary, label, [role="button"], input, select, textarea');
      var pic = t && (t.tagName === 'IMG' ? t : (link && link.querySelector('img')));
      var view = !!(pic && (link || pic.closest('.sg-sec[data-sg-fam="gallery"], .gallery-grid')) && !pic.closest('.xfx-strip'));
      ring.classList.toggle('view', view); ring.classList.toggle('big', !view && !!link);
      if (!loop) loop = requestAnimationFrame(step);
    }, { passive: true });
    d.addEventListener('pointerleave', function () { ring.classList.remove('on'); });
    addEventListener('blur', function () { ring.classList.remove('on'); });
  }
  if (on('reveal') && cfg.svc && cfg.svc.length) {
    var by = {}; cfg.svc.forEach(function (s) { by[norm(s.t)] = s.img; });
    var fl = d.createElement('div'); fl.className = 'xfx-float'; fl.setAttribute('aria-hidden', 'true');
    var im = d.createElement('img'); im.alt = ''; fl.appendChild(im); b.appendChild(fl);
    var place = function (e) { var w = fl.offsetWidth, h = fl.offsetHeight, px = e.clientX + 28, py = e.clientY - h / 2; if (px + w > innerWidth - 8) px = e.clientX - w - 28; fl.style.left = px + 'px'; fl.style.top = clamp(py, 8, innerHeight - h - 8) + 'px'; };
    within('reveal', 'main :is(h3, h4, li, dt, a, span, strong, p)').forEach(function (el) {
      var src = by[norm(el.textContent)]; if (!src || el.closest('.xfx-rv, .xfx-flip, .sg-marquee, [aria-hidden="true"], nav, footer, header') || el.querySelector('.xfx-rv')) return;
      var host = el.parentElement && el.parentElement.parentElement; if (host && host.querySelector('img')) return;
      el.classList.add('xfx-rv');
      el.addEventListener('pointerenter', function (e) { if (im.getAttribute('src') !== src) im.src = src; place(e); fl.classList.add('on'); });
      el.addEventListener('pointermove', place);
      el.addEventListener('pointerleave', function () { fl.classList.remove('on'); });
    });
  }
})();`;

module.exports = { EFFECTS, IDS, SECTION_IDS, forBlock, blockMenu, parse, list, bodyClasses, data, CSS, SCRIPT };
