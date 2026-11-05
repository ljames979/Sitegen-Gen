// Split text animation: headings break into letters, words or lines, and each piece moves in on its own (slide,
// fade, scale, flip over or rise out from behind a mask), one after another. It plays when the heading comes into
// view, or follows the scroll (the pieces arrive as the visitor scrolls the heading up the screen and go back on the
// way up). The owner picks which headings, how they split, the effect, the time per piece, the delay between pieces
// and where the pieces start from (X and Y). The words stay the same (screen readers read the whole heading), and a
// visitor whose device asks for less motion sees the headings still.
const TARGETS = [
  { id: '', label: 'Off' },
  { id: 'hero', label: 'The main headline (top of each page)' },
  { id: 'headings', label: 'The main headline and every section heading' },
];
const SPLITS = [['chars', 'Letter by letter'], ['words', 'Word by word'], ['lines', 'Line by line']];
const EFFECTS = [['slide', 'Slide in'], ['fade', 'Fade in'], ['scale', 'Grow in (scale)'], ['invert', 'Flip over (invert)'], ['uncover', 'Uncover (rise from behind a line)']];
const PLAYS = [['view', 'Once, when it comes into view'], ['scroll', 'Follows the scroll']];
const DEFAULTS = { splitBy: 'words', splitFx: 'slide', splitPlay: 'view', splitDur: 700, splitGap: 60, splitX: 0, splitY: 40 };
const ids = list => list.map(x => x[0]);
const num = (v, lo, hi, d) => { const n = Math.round(Number(v)); return v === '' || v == null || !Number.isFinite(n) ? d : Math.min(hi, Math.max(lo, n)); };

function parse(b) {
  return {
    splitText: TARGETS.some(t => t.id === b.theme_splitText) ? b.theme_splitText : '',
    splitBy: ids(SPLITS).includes(b.theme_splitBy) ? b.theme_splitBy : DEFAULTS.splitBy,
    splitFx: ids(EFFECTS).includes(b.theme_splitFx) ? b.theme_splitFx : DEFAULTS.splitFx,
    splitPlay: ids(PLAYS).includes(b.theme_splitPlay) ? b.theme_splitPlay : DEFAULTS.splitPlay,
    splitDur: num(b.theme_splitDur, 150, 3000, DEFAULTS.splitDur),     // ms each piece takes
    splitGap: num(b.theme_splitGap, 0, 400, DEFAULTS.splitGap),        // ms between one piece and the next
    splitX: num(b.theme_splitX, -400, 400, DEFAULTS.splitX),            // px the pieces start from, sideways
    splitY: num(b.theme_splitY, -400, 400, DEFAULTS.splitY),            // px the pieces start from, up and down
  };
}

// the settings with defaults filled in; null when off
function config(theme) {
  const t = theme || {};
  if (!TARGETS.some(x => x.id && x.id === t.splitText)) return null;
  const p = parse({ theme_splitText: t.splitText, theme_splitBy: t.splitBy, theme_splitFx: t.splitFx, theme_splitPlay: t.splitPlay,
    theme_splitDur: t.splitDur, theme_splitGap: t.splitGap, theme_splitX: t.splitX, theme_splitY: t.splitY });
  return { on: p.splitText, by: p.splitBy, fx: p.splitFx, play: p.splitPlay, dur: p.splitDur, gap: p.splitGap, x: p.splitX, y: p.splitY };
}

const CSS = `.st-split{font-kerning:normal}.st-w{display:inline-block;white-space:nowrap}.st-p{display:inline-block;will-change:transform,opacity;backface-visibility:hidden}` +
  `.st-m{display:inline-block;overflow:hidden;vertical-align:bottom;padding:0 .04em .12em;margin:0 -.04em -.12em}.st-fx-invert{perspective:600px}.st-fx-invert .st-p{transform-origin:50% 100%}`;

// The page's script and styles (inline, so they work in a download too); '' when off
function script(theme) {
  const c = config(theme);
  if (!c) return '';
  return `(function () {
  var C = ${JSON.stringify(c)};
  if (!window.matchMedia || matchMedia('(prefers-reduced-motion: reduce)').matches || !window.IntersectionObserver) return;
  var SEL = C.on === 'hero' ? 'main h1' : 'main h1, main h2';
  // a piece's look at k (0 = where it starts, 1 = in place)
  function look(k) {
    var r = 1 - k, x = C.x * r, y = C.y * r;
    if (C.fx === 'fade') return { t: 'translate(' + x + 'px,' + y + 'px)', o: k };
    if (C.fx === 'scale') return { t: 'translate(' + x + 'px,' + y + 'px) scale(' + (0.3 + 0.7 * k) + ')', o: k };
    if (C.fx === 'invert') return { t: 'translate(' + x + 'px,' + y + 'px) rotateX(' + (-95 * r) + 'deg)', o: Math.min(1, k * 2) };
    if (C.fx === 'uncover') return { t: 'translate(' + x + 'px,calc(' + (115 * r) + '% + ' + y + 'px))', o: 1 };
    return { t: 'translate(' + x + 'px,' + y + 'px)', o: k };
  }
  function set(p, k) { var l = look(k); p.style.transform = k >= 1 ? '' : l.t; p.style.opacity = k >= 1 ? '' : String(l.o); }
  function piece(text, mask) {
    var p = document.createElement('span'); p.className = 'st-p'; p.textContent = text;
    if (!mask) return p;
    var m = document.createElement('span'); m.className = 'st-m'; m.appendChild(p); return m;
  }
  // every word (and letter) in the heading becomes a piece; tags inside it (highlighted words, line breaks) stay
  function split(h) {
    var mask = C.fx === 'uncover', walker = document.createTreeWalker(h, NodeFilter.SHOW_TEXT), nodes = [];
    while (walker.nextNode()) if (walker.currentNode.nodeValue.trim()) nodes.push(walker.currentNode);
    nodes.forEach(function (n) {
      var frag = document.createDocumentFragment();
      n.nodeValue.split(/(\\s+)/).forEach(function (w) {
        if (!w) return;
        if (/^\\s+$/.test(w)) { frag.appendChild(document.createTextNode(' ')); return; }
        if (C.by === 'chars') {
          var word = document.createElement('span'); word.className = 'st-w';
          Array.from(w).forEach(function (ch) { word.appendChild(piece(ch, mask)); });
          frag.appendChild(word);
        } else frag.appendChild(piece(w, mask));
      });
      n.parentNode.replaceChild(frag, n);
    });
    var ps = Array.prototype.slice.call(h.querySelectorAll('.st-p'));
    // line by line: the words on one line move together
    var order = ps.map(function (p, i) { return i; });
    if (C.by === 'lines') {
      var tops = [], line = -1, last = null;
      ps.forEach(function (p, i) { var t = Math.round(p.getBoundingClientRect().top); if (last === null || Math.abs(t - last) > 4) { line++; last = t; } order[i] = line; });
    }
    return { ps: ps, order: order, n: order.length ? order[order.length - 1] + 1 : 0 };
  }
  var heads = Array.prototype.slice.call(document.querySelectorAll(SEL)).filter(function (h) {
    return !h.closest('.sg-lt, [aria-hidden="true"], .sg-atelier, .sg-mix-sl, .blk-wall, .blk-cascade, .blk-shapes') && !h.querySelector('[data-sg-roll]') && h.textContent.trim() && h.textContent.length < 300;
  });
  var all = [];
  heads.forEach(function (h) {
    h.setAttribute('aria-label', h.textContent.replace(/\\s+/g, ' ').trim());
    var s = split(h);
    s.ps.forEach(function (p) { p.setAttribute('aria-hidden', 'true'); set(p, 0); });
    h.classList.add('st-split', 'st-fx-' + C.fx);
    s.h = h; all.push(s);
  });
  if (C.play === 'scroll') {
    // the heading's trip from near the bottom of the screen to a little above the middle plays the pieces in turn
    var raf = 0;
    function frame() {
      raf = 0;
      var vh = innerHeight;
      all.forEach(function (s) {
        var top = s.h.getBoundingClientRect().top, prog = Math.min(1, Math.max(0, (vh * 0.92 - top) / (vh * 0.5)));
        var spread = s.n > 1 ? Math.min(0.75, (C.gap / (C.dur + C.gap)) * (s.n - 1) / s.n * 3) : 0;
        s.ps.forEach(function (p, i) {
          var at = s.n > 1 ? s.order[i] / (s.n - 1) * spread : 0;
          set(p, Math.min(1, Math.max(0, (prog - at) / (1 - spread || 1))));
        });
      });
    }
    var ask = function () { if (!raf) raf = requestAnimationFrame(frame); };
    (window.sgOnScroll || function (f) { addEventListener('scroll', f, { passive: true }); addEventListener('resize', f); })(frame); ask();
    return;
  }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      var s = all.filter(function (x) { return x.h === e.target; })[0]; if (!s) return;
      s.ps.forEach(function (p, i) {
        var d = s.order[i] * C.gap;
        p.style.transition = 'transform ' + C.dur + 'ms cubic-bezier(.2,.75,.2,1) ' + d + 'ms, opacity ' + C.dur + 'ms ease ' + d + 'ms';
        set(p, 1);
        setTimeout(function () { p.style.transition = ''; p.style.willChange = 'auto'; }, C.dur + d + 50);
      });
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  requestAnimationFrame(function () { all.forEach(function (s) { io.observe(s.h); }); });
})();`;
}

module.exports = { TARGETS, SPLITS, EFFECTS, PLAYS, DEFAULTS, CSS, parse, config, script };
