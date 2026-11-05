// Scroll elements: as the visitor scrolls, the page's sections (or each heading, line of words, photo and card inside
// them, one after another) fade, slide, zoom, blur or flip into place. The owner picks the effect, what moves, the
// speed, and whether it plays once or every time something comes back into view. The top section (the hero) is left
// as it is. When it's on it takes over from the motion style's own reveals, so nothing moves twice. Everything shows
// without the script, and visitors who turn motion off see the page still.
const EFFECTS = [
  ['', 'Off (the motion style\'s own reveals)'],
  ['fade', 'Fade in'],
  ['up', 'Slide up into place'],
  ['sides', 'Slide in from the sides (left, right, left...)'],
  ['zoom', 'Zoom in'],
  ['blur', 'Blur into focus'],
  ['flip', 'Flip up (3D)'],
];
const WHAT = [['sections', 'Whole sections'], ['parts', 'Each heading, text, photo and card, one after another']];
const SPEEDS = { quick: 450, normal: 800, slow: 1300 };
const SPEED_LABELS = [['quick', 'Quick'], ['normal', 'Normal'], ['slow', 'Slow and soft']];
const PLAYS = [['once', 'Once'], ['always', 'Every time it comes into view']];
const ids = (l) => l.map(x => x[0]);

function parse(b) {
  return {
    scrollEl: ids(EFFECTS).includes(b.theme_scrollEl) ? b.theme_scrollEl : '',
    scrollElWhat: ids(WHAT).includes(b.theme_scrollElWhat) ? b.theme_scrollElWhat : 'sections',
    scrollElSpeed: Object.prototype.hasOwnProperty.call(SPEEDS, b.theme_scrollElSpeed) ? b.theme_scrollElSpeed : 'normal',
    scrollElPlay: ids(PLAYS).includes(b.theme_scrollElPlay) ? b.theme_scrollElPlay : 'once',
  };
}
function config(theme) {
  const t = theme || {};
  if (!t.scrollEl || !ids(EFFECTS).includes(t.scrollEl)) return null;
  const p = parse({ theme_scrollEl: t.scrollEl, theme_scrollElWhat: t.scrollElWhat, theme_scrollElSpeed: t.scrollElSpeed, theme_scrollElPlay: t.scrollElPlay });
  return { fx: p.scrollEl, parts: p.scrollElWhat === 'parts', ms: SPEEDS[p.scrollElSpeed], again: p.scrollElPlay === 'always' };
}

// where each piece starts (it ends in place)
const FROM = {
  fade: '',
  up: 'transform:translateY(60px)',
  sides: 'transform:translateX(-80px)',
  zoom: 'transform:scale(.88)',
  blur: 'filter:blur(14px);transform:scale(1.03)',
  flip: 'transform:perspective(900px) rotateX(28deg) translateY(40px);transform-origin:50% 100%',
};
function css(theme) {
  const c = config(theme); if (!c) return '';
  const ease = c.fx === 'flip' || c.fx === 'zoom' ? 'cubic-bezier(.2,.9,.25,1.05)' : 'cubic-bezier(.2,.8,.2,1)';
  return [
    // the motion style's own reveals stand down, so nothing moves twice
    '.sg-sfx [data-animate],.sg-sfx [data-reveal],.sg-sfx .reveal{opacity:1 !important;transform:none !important;filter:none !important}',
    `.sg-sfx .sg-sfx-el{opacity:0;${FROM[c.fx]};transition:opacity ${c.ms}ms ease,transform ${c.ms}ms ${ease},filter ${c.ms}ms ease;transition-delay:var(--sfx-d,0s)}`,
    c.fx === 'sides' ? '.sg-sfx .sg-sfx-el.sg-sfx-r{transform:translateX(80px)}' : '',
    '.sg-sfx .sg-sfx-el.sg-sfx-in{opacity:1;transform:none;filter:none}',
    '@media (prefers-reduced-motion:reduce){.sg-sfx .sg-sfx-el{opacity:1;transform:none;filter:none;transition:none}}',
  ].filter(Boolean).join('\n');
}

function script(theme) {
  const c = config(theme); if (!c) return '';
  return `(function () {
  var C = ${JSON.stringify(c)};
  if (!window.IntersectionObserver || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  var main = document.querySelector('main'); if (!main) return;
  // the sections: main's own parts (a Blocks page's blocks), skipping the first one (the hero) and empty ones
  var secs = Array.prototype.filter.call(main.children, function (s) { return !/^(SCRIPT|STYLE|TEMPLATE)$/.test(s.tagName) && s.offsetHeight > 40; });
  if (secs.length === 1 && secs[0].children.length > 2) secs = Array.prototype.slice.call(secs[0].children);
  secs = secs.slice(1).filter(function (s) { return !s.closest('.sg-pin-deck,.sg-pin-fan') && !s.matches('.sg-pin-cover'); });
  var els = [];
  secs.forEach(function (s) {
    if (!C.parts) { els.push({ el: s, i: 0 }); return; }
    // each piece: headings, words, photos and cards, not one inside another; small things (a line, an icon) go with their box
    var picks = Array.prototype.filter.call(s.querySelectorAll('h1,h2,h3,h4,p,img,video,blockquote,li,[data-sg-cards] > *,.card,a.btn,.blk-img'), function (el) { return el.offsetHeight > 12 && !el.closest('.sg-ix-text,.sg-deck,.sg-fan,.sg-stack,[aria-hidden="true"]'); });
    picks = picks.filter(function (el) { return !picks.some(function (o) { return o !== el && o.contains(el); }); });
    picks.forEach(function (el, i) { els.push({ el: el, i: i }); });
  });
  if (!els.length) return;
  document.documentElement.classList.add('sg-sfx');
  els.forEach(function (x, n) {
    x.el.classList.add('sg-sfx-el');
    if (C.fx === 'sides' && (C.parts ? x.i : n) % 2) x.el.classList.add('sg-sfx-r');
    if (C.parts) x.el.style.setProperty('--sfx-d', Math.min(x.i, 8) * (C.ms / 9) + 'ms');
  });
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('sg-sfx-in'); if (!C.again) io.unobserve(e.target); }
      else if (C.again && e.boundingClientRect.top > 0) e.target.classList.remove('sg-sfx-in');   // gone below the screen: ready to play again
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  els.forEach(function (x) { io.observe(x.el); });
})();`;
}

module.exports = { EFFECTS, WHAT, SPEEDS, SPEED_LABELS, PLAYS, parse, config, css, script };
