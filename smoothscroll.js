// Scroll Smoother: instead of jumping, the page glides. "Section links" glides to a section when a menu link or
// button points at one on the same page (eased, stopping just below a sticky header). "Whole page" also smooths the
// mouse wheel on long pages: each turn of the wheel is eased into a short glide instead of a jump. Touch screens keep
// their own scrolling, boxes that scroll on their own (a photo strip, a map) are left alone, and visitors whose
// device asks for less motion get the plain browser scrolling.
const MODES = [
  { id: '', label: 'Off (the browser\'s own scrolling)' },
  { id: 'links', label: 'Section links glide to their section' },
  { id: 'page', label: 'Whole page: section links and the mouse wheel glide' },
];
const MODE_IDS = MODES.map(m => m.id);
// how long a glide takes and how soft the wheel feels: the glide time per 1000px (ms) and the share of the distance
// left that the wheel covers each frame
const FEELS = {
  quick: { label: 'Quick', ms: 550, ease: 0.16 },
  normal: { label: 'Normal', ms: 800, ease: 0.11 },
  soft: { label: 'Soft and slow', ms: 1150, ease: 0.075 },
};
const FEEL_DEFAULT = 'normal';

function parse(b) {
  return {
    smoothScroll: MODE_IDS.includes(b.theme_smoothScroll) ? b.theme_smoothScroll : '',
    smoothFeel: Object.prototype.hasOwnProperty.call(FEELS, b.theme_smoothFeel) ? b.theme_smoothFeel : FEEL_DEFAULT,
  };
}

function config(theme) {
  const t = theme || {};
  if (!MODE_IDS.includes(t.smoothScroll) || !t.smoothScroll) return null;
  const f = FEELS[t.smoothFeel] || FEELS[FEEL_DEFAULT];
  return { wheel: t.smoothScroll === 'page', ms: f.ms, ease: f.ease };
}

// The script for the page (inline, so it works in a download too); '' when the smoother is off
function script(theme) {
  const c = config(theme);
  if (!c) return '';
  return `(function () {
  var C = ${JSON.stringify(c)};
  if (!window.matchMedia || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var de = document.documentElement;
  de.style.scrollBehavior = 'auto';   // the glide is done here, so the browser's own smooth jump stays out of its way
  var maxY = function () { return Math.max(0, de.scrollHeight - innerHeight); };
  var clamp = function (y) { return Math.min(maxY(), Math.max(0, y)); };
  // the height of a header that stays at the top, so a section lands just below it
  function topGap() {
    var n = document.getElementById('siteNav'); if (!n) return 0;
    var cs = getComputedStyle(n), r = n.getBoundingClientRect();
    return (cs.position === 'fixed' || cs.position === 'sticky') && r.bottom < innerHeight / 3 ? r.bottom : 0;
  }
  var ease = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var glide = null, wheelRaf = 0, cur = 0, goal = 0;
  function stop() { if (glide) { cancelAnimationFrame(glide); glide = null; } if (wheelRaf) { cancelAnimationFrame(wheelRaf); wheelRaf = 0; } }
  // where() is asked again each frame: a header that only sticks once the page moves changes where the section lands
  function glideTo(where) {
    stop();
    var from = scrollY, t0 = performance.now();
    var ms = Math.min(1800, Math.max(350, C.ms * Math.sqrt(Math.abs(clamp(where()) - from) / 1000)));
    (function step(now) {
      var k = Math.min(1, (now - t0) / ms);
      scrollTo(0, from + (clamp(where()) - from) * ease(k));
      glide = k < 1 ? requestAnimationFrame(step) : null;
    })(t0);
  }
  // a link to a section of this page glides there
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href*="#"]'); if (!a) return;
    var u; try { u = new URL(a.href, location.href); } catch (x) { return; }
    if (u.origin !== location.origin || u.pathname !== location.pathname || u.search !== location.search || !u.hash) return;
    var id = decodeURIComponent(u.hash.slice(1));
    var el = id === 'top' || id === '' ? document.body : document.getElementById(id); if (!el) return;
    e.preventDefault();
    glideTo(function () { return el === document.body ? 0 : el.getBoundingClientRect().top + scrollY - topGap() - 8; });
    if (history.pushState) history.pushState(null, '', u.hash);
  });
  // a turn of the wheel, wherever the pointer is, unless a box under it scrolls that way itself
  function scrollsItself(el, dy) {
    for (; el && el !== document.body && el !== de; el = el.parentElement) {
      var cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) {
        if ((dy < 0 && el.scrollTop > 0) || (dy > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1)) return true;
      }
    }
    return false;
  }
  if (C.wheel) {
    addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY) || scrollsItself(e.target, e.deltaY)) return;
      var dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
      e.preventDefault();
      if (glide) { cancelAnimationFrame(glide); glide = null; }
      if (!wheelRaf) { cur = goal = scrollY; }
      goal = clamp(goal + dy);
      if (!wheelRaf) wheelRaf = requestAnimationFrame(function tick() {
        // the scrollbar or a key moved the page meanwhile: follow it
        if (Math.abs(scrollY - Math.round(cur)) > 2) { stop(); return; }
        cur += (goal - cur) * C.ease;
        if (Math.abs(goal - cur) < 0.5) { cur = goal; scrollTo(0, cur); wheelRaf = 0; return; }
        scrollTo(0, cur);
        wheelRaf = requestAnimationFrame(tick);
      });
    }, { passive: false });
  }
  addEventListener('keydown', stop);
})();`;
}

module.exports = { MODES, MODE_IDS, FEELS, FEEL_DEFAULT, parse, config, script };
