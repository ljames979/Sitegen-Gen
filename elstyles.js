// Move and size anything (Leo, 2026-11-05: "i would like to be able to edit anything on each block ..this involves
// adjusting size...drag to move and also expand size"): in the editor's "Move & size" mode the owner clicks any piece of
// a block (a picture, a card, a button, an icon, a shape, a line of words, the box around a few of them ...) and then
// drags it to move it, pulls its handles to make it bigger or smaller, zooms or turns it, brings it to the front or
// hides it. It works the same on every block and every design, because nothing here knows which block it is in.
//
// How a piece is found again: as the page loads (before any effect touches it), SCRIPT gives every element in each part
// of the page a name, data-sg-ee="<part>|<tag>-<n>": the part of the page it is in (named the same way as textstyles.js
// names it) and its place among the elements with that tag in that part. The editor reads that name off the clicked
// element, so the editor and the page always agree. Words have their own move and box in textstyles.js: for a text
// element the editor keeps the move and the box there (so the two never pull against each other) and only the zoom,
// turn, front and hide here.
//
// Saved with the editor (hidden box estyles_json) as sections.texts.elems:
//   { id, page, el, dx, dy, w, h, zoom, turn, front, hide }
//   dx/dy: moved by that many px; w/h: width and height in px; all at full size (760px and wider) and shrinking with
//   the screen below that, like the text sizes. zoom: percent (0 = as designed), turn: degrees, front: drawn above the
//   pieces around it, hide: left off the page (the editor shows it faintly in Move & size mode so it can come back)
const MAX = 400;
const ID = /^e[a-z0-9]{7}$/;
const PAGE = /^[a-z0-9][a-z0-9:/_-]{0,79}$/i;
const EL = /^[^<>"'`\\]{1,160}\|[a-z][a-z0-9]{0,15}-\d{1,5}$/;
const int = (v, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : 0; };
// pictures, videos, drawings and frames take the exact height; anything with words in it grows past it if it has to
const EXACT = /^(img|video|svg|canvas|iframe|picture|object|embed)$/;
const tagOf = (el) => String(el).split('|').pop().replace(/-\d+$/, '');

function cleanOne(t) {
  if (!t || typeof t !== 'object' || !ID.test(String(t.id || '')) || !PAGE.test(String(t.page || '')) || !EL.test(String(t.el || ''))) return null;
  const o = { id: t.id, page: String(t.page), el: String(t.el) };
  o.dx = int(t.dx, -3000, 3000); o.dy = int(t.dy, -3000, 3000);
  o.w = t.w ? int(t.w, 8, 2400) : 0; o.h = t.h ? int(t.h, 8, 2400) : 0;
  o.zoom = t.zoom ? int(t.zoom, 10, 500) : 0; if (o.zoom === 100) o.zoom = 0;
  o.turn = int(t.turn, -180, 180);
  o.front = t.front === true; o.hide = t.hide === true;
  if (!o.dx && !o.dy && !o.w && !o.h && !o.zoom && !o.turn && !o.front && !o.hide) return null;   // nothing left to do
  return o;
}
// The list as saved: only well-formed changes, one per element, each id once, 400 at most
function clean(list) {
  const seen = new Set(), els = new Set();
  return ([]).concat(Array.isArray(list) ? list : []).map(cleanOne).filter(t => {
    if (!t || seen.has(t.id)) return false;
    const k = t.page + ' ' + t.el; if (els.has(k)) return false;
    seen.add(t.id); els.add(k); return true;
  }).slice(0, MAX);
}
function fromBody(v) {
  try { return clean(JSON.parse(String(v || '[]'))); } catch (e) { return []; }
}
function forPage(site, page) {
  return clean((((site || {}).sections || {}).texts || {}).elems).filter(t => t.page === page);
}
const vw = (n) => +(n / 7.6).toFixed(3);
// The CSS for one change (numbers come from clean, so they are safe to write into the page). The height is apart:
// exact for pictures and empty shapes, "at least" for anything with words in it (the page script picks, see SCRIPT)
function css(t) {
  const out = [];
  if (t.dx || t.dy) out.push(`translate:calc(${t.dx} * min(1px,.1316vw)) calc(${t.dy} * min(1px,.1316vw))!important`);
  if (t.zoom) out.push(`scale:${t.zoom / 100}!important`);
  if (t.turn) out.push(`rotate:${t.turn}deg!important`);
  if (t.front) out.push('z-index:60!important');
  // never wider than the screen, so a wide piece still fits on a phone
  if (t.w) out.push(`width:min(${t.w}px,${vw(t.w)}vw,calc(100vw - 24px))!important`, 'max-width:none!important', 'min-width:0!important', 'flex-shrink:0!important', 'box-sizing:border-box!important');
  if (t.w && !t.h && EXACT.test(tagOf(t.el))) out.push('height:auto!important');
  return out.join(';');
}
function hcss(t, exact) {
  if (!t.h) return '';
  const h = `min(${t.h}px,${vw(t.h)}vw)`;
  return exact
    ? `height:${h}!important;min-height:0!important;max-height:none!important;flex-shrink:0!important;object-fit:cover`
    : `min-height:${h}!important;height:auto!important;max-height:none!important`;
}
// What the page carries: each change with its CSS worked out
function data(list) {
  return JSON.stringify(list.map(t => Object.assign({}, t, { css: css(t), hx: hcss(t, true), hm: hcss(t, false) }))).replace(/</g, '\\u003c');
}

// Runs as the page loads, right after the text styles script (so before any effect splits or copies anything): names
// the elements, then applies the changes. window.sgEs lets the editor redraw the changes live.
const SCRIPT = `(function () {
  var d = document, SKIP = /^(SCRIPT|STYLE|TEMPLATE|LINK|META|BR|WBR|NOSCRIPT|SOURCE|TRACK|PARAM|INPUT|TEXTAREA|SELECT|OPTION)$/;
  var parts = function () {
    var m = d.querySelector('main'), out = m ? Array.prototype.slice.call(m.children) : [];
    var f = d.querySelector('body > footer'); if (f) out.push(f);
    return out.filter(function (n) { return !/^(SCRIPT|STYLE|TEMPLATE|LINK)$/.test(n.tagName) && !n.classList.contains('sg-tx-src'); });
  };
  var base = function (el) {
    var b = el.matches('[data-sg-bid]') ? el : el.querySelector('[data-sg-bid]'); if (b) return 'b:' + b.getAttribute('data-sg-bid');
    if (el.id) return '#' + el.id;
    var f = el.matches('[data-sg-fam]') ? el : el.querySelector('[data-sg-fam]'); if (f) return 'f:' + f.getAttribute('data-sg-fam');
    var c = (el.getAttribute('class') || '').split(/\\s+/)[0];
    return el.tagName.toLowerCase() + (c ? '.' + c : '');
  };
  var name = function () {
    var seen = {};
    parts().forEach(function (p) {
      var k = base(p), n = seen[k] = (seen[k] || 0) + 1, key = n > 1 ? k + '~' + (n - 1) : k, count = {};
      Array.prototype.forEach.call(p.querySelectorAll('*'), function (el) {
        var t = el.tagName.toLowerCase();
        if (SKIP.test(el.tagName) || !/^[a-z][a-z0-9]{0,15}$/.test(t) || el.hasAttribute('data-sg-ee')) return;
        // a drawing is one piece (not its lines); your own text boxes and pictures move with their own handles
        if ((el.parentNode.closest && el.parentNode.closest('svg')) || el.closest('.sg-tx, .sg-pic')) return;
        count[t] = (count[t] || 0) + 1;
        el.setAttribute('data-sg-ee', key + '|' + t + '-' + count[t]);
      });
    });
  };
  var esc = function (s) { return s.replace(/["\\\\]/g, '\\\\$&'); };
  var EXACT = /^(IMG|VIDEO|SVG|CANVAS|IFRAME|PICTURE|OBJECT|EMBED)$/i;
  var apply = function (list) {
    var rules = [], sel = function (t) { return '[data-sg-ee="' + esc(t.el) + '"]'; };
    // (what was drawn before comes off first, so the design's own display and position are read below)
    var st = d.getElementById('sg-es-css');
    if (!st) { st = d.createElement('style'); st.id = 'sg-es-css'; d.head.appendChild(st); }
    st.textContent = '';
    (list || []).forEach(function (t) {
      var els = d.querySelectorAll(sel(t)); if (!els.length) return;
      var el = els[0], s = sel(t), cs = window.getComputedStyle(el);
      if (t.hide) { rules.push('html:not(.sg-es-mode) ' + s + '{display:none!important}', 'html.sg-es-mode ' + s + '{opacity:.28!important;outline:1px dashed #94a3b8}'); }
      if (t.css) rules.push(s + '{' + t.css + '}');
      if (t.h) rules.push(s + '{' + (EXACT.test(el.tagName) || !/\\S/.test(el.textContent) ? t.hx : t.hm) + '}');
      // words in a line can only be moved, sized or turned as a block of their own; front needs a place of its own
      if ((t.dx || t.dy || t.w || t.h || t.zoom || t.turn) && cs.display === 'inline') rules.push(s + '{display:inline-block}');
      if (t.front && cs.position === 'static') rules.push(s + '{position:relative}');
    });
    st.textContent = rules.join('\\n');
  };
  name();
  var src = d.getElementById('sg-es-data'), list = [];
  try { list = JSON.parse(src ? src.textContent : '[]'); } catch (e) {}
  apply(list);
  window.sgEs = { name: name, apply: apply, parts: parts };
})();`;

module.exports = { clean, fromBody, forPage, css, hcss, data, SCRIPT, MAX, EXACT };
