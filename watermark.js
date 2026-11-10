// Watermarks (Leo, 2026-11-09): one large, faint decorative icon (a dog paw, a cat paw, a crown ...) behind the words of
// any block or card. It never covers text and never blocks a click: it sits at z-index -1 inside its block or card
// (which gets position: relative, overflow: hidden and isolation: isolate, so it can't slip behind the page), has
// pointer-events: none and aria-hidden="true", and is cropped by the block's edge when it runs off it.
//
// Picked in the editor's "🐾 Watermark" mode (public/watermark-edit.js): click a block or a card on the page, then
// "Add watermark". Saved with the editor (hidden box wmarks_json) as sections.texts.wmarks, one entry per watermark:
//   { id, page, part, el, kind, icon, svg, vb, color, op, size, msize, mhide, turn, pos, dx, dy, drift }
//   page/part/el: where it goes. part is the piece of the page (named like elstyles.js names it, e.g. "b:bcsyi97v");
//     el is the data-sg-ee name of the block's or card's own box inside it ('' = the part itself).
//   kind: 'block' or 'card' (only changes the starting size); icon: one of ICONS or 'own' (svg + vb: an uploaded
//     one-color SVG, cleaned below); color: #rrggbb; op: opacity 0-30 (%); size: 80-700 px; msize: phone size in px
//     (0 = 60% of size); mhide: hidden on phones; turn: -45..45 degrees; pos: one of POS (9 points);
//     dx/dy: offset in px from the edge it is pinned to (negative runs it off that edge), or a nudge from the middle;
//     drift: a slow 2-4 degree sway over 20 s (never with reduced motion).
// One watermark per block or card; a second one only when the owner adds it on purpose (slot 2).
'use strict';

// All icons share the same idea: a viewBox and plain shapes filled with the watermark color (fill="currentColor").
const ICONS = {
  dog: { name: 'Dog paw', vb: '0 0 64 64', turn: -18,
    g: '<ellipse cx="14" cy="26" rx="6" ry="8"/><ellipse cx="25" cy="13" rx="6" ry="8"/><ellipse cx="39" cy="13" rx="6" ry="8"/><ellipse cx="50" cy="26" rx="6" ry="8"/><path d="M32 33c9 0 17 8 17 16 0 6-5 9-10 9-3 0-5-2-7-2s-4 2-7 2c-5 0-10-3-10-9 0-8 8-16 17-16z"/>' },
  cat: { name: 'Cat paw', vb: '0 0 31 31', turn: 16,
    g: '<circle cx="5" cy="10" r="3.6"/><circle cx="11.5" cy="4" r="3.6"/><circle cx="19.5" cy="4" r="3.6"/><circle cx="26" cy="10" r="3.6"/><path d="M15.5 13c6 0 10.5 4.6 10.5 9 0 3.4-2.6 5-5.4 5-2 0-3.4-1.2-5.1-1.2S12.4 27 10.4 27C7.6 27 5 25.4 5 22c0-4.4 4.5-9 10.5-9z"/>' },
  crown: { name: 'Crown', vb: '0 0 64 64', turn: -12,
    g: '<path d="M8 22l12 11 12-19 12 19 12-11-5 28H13z"/><rect x="13" y="52" width="38" height="6" rx="2"/><circle cx="8" cy="20" r="4"/><circle cx="32" cy="11" r="4.5"/><circle cx="56" cy="20" r="4"/>' },
  bone: { name: 'Bone', vb: '0 0 64 64', turn: -30,
    g: '<rect x="13" y="27" width="38" height="10" rx="3"/><circle cx="13" cy="25" r="7"/><circle cx="13" cy="39" r="7"/><circle cx="51" cy="25" r="7"/><circle cx="51" cy="39" r="7"/>' },
  heart: { name: 'Heart', vb: '0 0 64 64', turn: -10,
    g: '<path d="M32 56S6 40 6 22C6 13 13 7 21 7c5 0 9 3 11 7 2-4 6-7 11-7 8 0 15 6 15 15 0 18-26 34-26 34z"/>' },
  sparkle: { name: 'Sparkle', vb: '0 0 64 64', turn: 0,
    g: '<path d="M32 4c2 15 6 24 28 28-22 4-26 13-28 28-2-15-6-24-28-28 22-4 26-13 28-28z"/><path d="M52 4c.8 5 2 7.5 8 8.5-6 1-7.2 3.5-8 8.5-.8-5-2-7.5-8-8.5 6-1 7.2-3.5 8-8.5z"/>' }
};
const POS = ['tl', 'tc', 'tr', 'ml', 'c', 'mr', 'bl', 'bc', 'br'];
const POS_NAMES = { tl: 'Top left', tc: 'Top center', tr: 'Top right', ml: 'Middle left', c: 'Center', mr: 'Middle right', bl: 'Bottom left', bc: 'Bottom center', br: 'Bottom right' };
const DEFAULT_COLOR = '#b8326a';
const LIMITS = { op: [0, 30], size: [80, 700], msize: [40, 700], turn: [-45, 45], dx: [-600, 600], dy: [-600, 600] };

// One-click starting points (Leo's four presets).
const PRESETS = [
  { key: 'dog-card', name: 'Dog paw — card corner', kind: 'card', icon: 'dog', size: 300, color: DEFAULT_COLOR, op: 7, turn: -18, pos: 'br', dx: -50, dy: -40 },
  { key: 'cat-card', name: 'Cat paw — card corner', kind: 'card', icon: 'cat', size: 280, color: DEFAULT_COLOR, op: 8, turn: 16, pos: 'br', dx: -40, dy: -40 },
  { key: 'dog-section', name: 'Dog paw — section right', kind: 'block', icon: 'dog', size: 520, color: DEFAULT_COLOR, op: 5, turn: -18, pos: 'mr', dx: -90, dy: 0 },
  { key: 'cat-section', name: 'Cat paw — section left', kind: 'block', icon: 'cat', size: 480, color: DEFAULT_COLOR, op: 6, turn: 16, pos: 'ml', dx: -80, dy: 0 }
];

const MAX = 120;
const ID = /^w[a-z0-9]{7}$/;
const PAGE = /^[a-z0-9][a-z0-9:/_-]{0,79}$/i;
const PART = /^[^<>"'`\\|]{1,160}$/;
const EL = /^[^<>"'`\\]{1,160}\|[a-z][a-z0-9]{0,15}-\d{1,5}$/;
const HEX = /^#[0-9a-f]{6}$/i;
const int = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

// ---- uploaded SVGs: keep only plain shapes and their geometry; every fill becomes the watermark color ----
const SVG_TAGS = new Set(['g', 'path', 'circle', 'ellipse', 'rect', 'polygon', 'polyline', 'line']);
const SVG_ATTRS = new Set(['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'points', 'x1', 'y1', 'x2', 'y2', 'transform', 'fill-rule', 'clip-rule']);
const SAFE_VAL = /^[-+0-9.,\s eE]*$|^[-+0-9.,\s a-zA-Z()]*$/;   // numbers, path letters, transform() words
const VB = /^-?[\d.]+(?:[\s,]+-?[\d.]+){3}$/;
const SVG_MAX = 20000;
function cleanSvg(src) {
  const s = String(src || '').slice(0, 200000);
  const svgTag = /<svg\b([^>]*)>/i.exec(s);
  let vb = '';
  if (svgTag) {
    const m = /viewBox\s*=\s*["']([^"']+)["']/i.exec(svgTag[1]);
    if (m && VB.test(m[1].trim())) vb = m[1].trim().replace(/[\s,]+/g, ' ');
    else {
      const w = /\bwidth\s*=\s*["']([\d.]+)/i.exec(svgTag[1]), h = /\bheight\s*=\s*["']([\d.]+)/i.exec(svgTag[1]);
      if (w && h) vb = '0 0 ' + (+w[1]) + ' ' + (+h[1]);
    }
  }
  const body = svgTag ? s.slice(svgTag.index + svgTag[0].length) : s;
  const out = []; const open = [];
  const re = /<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g; let m;
  while ((m = re.exec(body))) {
    const close = m[1] === '/', tag = m[2].toLowerCase(), self = m[4] === '/' || /\/\s*$/.test(m[3]);
    if (tag === 'svg' && close) break;
    if (!SVG_TAGS.has(tag)) continue;
    if (close) { const i = open.lastIndexOf(tag); if (i >= 0) { while (open.length > i) out.push('</' + open.pop() + '>'); } continue; }
    const attrs = []; const ar = /([a-zA-Z][\w:-]*)\s*=\s*("([^"]*)"|'([^']*)')/g; let a;
    while ((a = ar.exec(m[3]))) {
      const k = a[1].toLowerCase(), v = (a[3] != null ? a[3] : a[4]).trim();
      if (!SVG_ATTRS.has(k) || v.length > 8000 || !SAFE_VAL.test(v) || /url|script|expression/i.test(v)) continue;
      attrs.push(k + '="' + v + '"');
    }
    if (tag !== 'g' && !attrs.length) continue;
    out.push('<' + tag + (attrs.length ? ' ' + attrs.join(' ') : '') + (self ? '/>' : '>'));
    if (!self) open.push(tag);
  }
  while (open.length) out.push('</' + open.pop() + '>');
  const g = out.join('');
  if (!vb || !/<(path|circle|ellipse|rect|polygon|polyline|line)\b/.test(g) || g.length > SVG_MAX) return null;
  return { vb, g };
}

function cleanOne(t) {
  if (!t || typeof t !== 'object' || !ID.test(String(t.id || '')) || !PAGE.test(String(t.page || '')) || !PART.test(String(t.part || ''))) return null;
  const el = String(t.el || '');
  if (el && !EL.test(el)) return null;
  const o = { id: t.id, page: String(t.page), part: String(t.part), el };
  o.kind = t.kind === 'card' ? 'card' : 'block';
  o.slot = t.slot === 2 ? 2 : 1;
  if (t.icon === 'own') {
    const own = cleanSvg('<svg viewBox="' + String(t.vb || '').replace(/"/g, '') + '">' + String(t.svg || ''));
    if (!own) return null;
    o.icon = 'own'; o.svg = own.g; o.vb = own.vb;
  } else o.icon = ICONS[t.icon] ? t.icon : 'dog';
  o.color = HEX.test(String(t.color || '')) ? String(t.color).toLowerCase() : DEFAULT_COLOR;
  o.op = int(t.op, 0, 30, 6);
  o.size = int(t.size, 80, 700, o.kind === 'card' ? 300 : 500);
  o.msize = t.msize ? int(t.msize, 40, 700, 0) : 0;
  o.mhide = t.mhide === true;
  o.turn = int(t.turn, -45, 45, 0);
  o.pos = POS.includes(t.pos) ? t.pos : 'br';
  o.dx = int(t.dx, -600, 600, 0); o.dy = int(t.dy, -600, 600, 0);
  o.drift = t.drift === true;
  return o;
}
// The list as saved: well-formed entries, each id once, one per block or card (two when the second is asked for)
function clean(list) {
  const seen = new Set(), spots = new Set();
  return ([]).concat(Array.isArray(list) ? list : []).map(cleanOne).filter(t => {
    if (!t || seen.has(t.id)) return false;
    const k = t.page + ' ' + t.part + ' ' + t.el + ' ' + t.slot; if (spots.has(k)) return false;
    seen.add(t.id); spots.add(k); return true;
  }).slice(0, MAX);
}
function fromBody(v) {
  try { return clean(JSON.parse(String(v || '[]'))); } catch (e) { return []; }
}
function forPage(site, page) {
  return clean((((site || {}).sections || {}).texts || {}).wmarks).filter(t => t.page === page);
}
// A new watermark from a preset (or the plain starting point for a block or a card)
function fromPreset(key, where) {
  const p = PRESETS.find(x => x.key === key);
  const base = p ? Object.assign({}, p) : { kind: where && where.kind === 'card' ? 'card' : 'block', icon: 'dog', color: DEFAULT_COLOR, op: 6, turn: -18, pos: 'br', dx: 0, dy: 0 };
  if (!base.size) base.size = base.kind === 'card' ? 300 : 500;
  delete base.key; delete base.name;
  return cleanOne(Object.assign(base, { msize: 0, mhide: false, drift: false, slot: 1 }, where || {}));
}

// The watermark's own picture (an inline SVG; the color comes from the page script's style)
function svgOf(t) {
  const ic = t.icon === 'own' ? { vb: t.vb, g: t.svg } : ICONS[t.icon] || ICONS.dog;
  return '<svg viewBox="' + ic.vb + '" fill="currentColor" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet"><g>' + ic.g + '</g></svg>';
}

// Where it sits: the anchor point's edges plus the offsets (numbers come from clean, so they are safe in the page)
function placeCss(t) {
  const h = t.pos.length === 1 ? 'c' : t.pos[1], v = t.pos === 'c' ? 'm' : t.pos[0];
  const out = [];
  if (h === 'l') out.push('left:' + t.dx + 'px'); else if (h === 'r') out.push('right:' + t.dx + 'px'); else out.push('left:calc(50% + ' + t.dx + 'px)');
  if (v === 't') out.push('top:' + t.dy + 'px'); else if (v === 'b') out.push('bottom:' + t.dy + 'px'); else out.push('top:calc(50% + ' + t.dy + 'px)');
  out.push('translate:' + (h === 'c' ? '-50%' : '0') + ' ' + (v === 'm' ? '-50%' : '0'));
  return out.join(';');
}
function css(t) {
  const ms = t.msize || Math.round(t.size * 0.6);
  return placeCss(t) + ';--sg-wm-s:' + t.size + 'px;--sg-wm-ms:' + ms + 'px;--sg-wm-r:' + t.turn + 'deg;color:' + t.color + ';opacity:' + (t.op / 100);
}
// What the page carries: each watermark with its picture and CSS worked out
function data(list) {
  return JSON.stringify(list.map(t => ({ id: t.id, part: t.part, el: t.el, svg: svgOf(t), css: css(t), mhide: t.mhide, drift: t.drift }))).replace(/</g, '\\u003c');
}

// The look every watermark shares. The block or card it is in gets .sg-wm-host.
const CSS = [
  '.sg-wm-host{overflow:hidden!important;isolation:isolate!important}',
  '.sg-wm-host.sg-wm-rel{position:relative!important}',
  'svg.sg-wm.sg-wm.sg-wm{position:absolute!important;z-index:-1!important;pointer-events:none!important;display:block;width:var(--sg-wm-s);height:var(--sg-wm-s);max-width:none!important;max-height:none!important;margin:0!important;rotate:var(--sg-wm-r);transform-origin:50% 50%;user-select:none}',
  '.sg-wm-host>svg.sg-wm *{pointer-events:none!important}',
  '@keyframes sg-wm-drift{0%,100%{rotate:calc(var(--sg-wm-r) - 3deg)}50%{rotate:calc(var(--sg-wm-r) + 3deg)}}',
  'svg.sg-wm.sg-wm-drift{animation:sg-wm-drift 20s ease-in-out infinite}',
  '@media (prefers-reduced-motion:reduce){svg.sg-wm.sg-wm-drift{animation:none!important}}',
  '@media (max-width:640px){svg.sg-wm.sg-wm.sg-wm{width:var(--sg-wm-ms);height:var(--sg-wm-ms)}svg.sg-wm.sg-wm-mhide{display:none!important}}'
].join('\n');

// Runs as the page loads, right after the Move & size script (elstyles.js) has named the pieces of the page: puts each
// watermark into its block or card. window.sgWm lets the editor redraw them live.
const SCRIPT = `(function () {
  var d = document;
  var css = d.createElement('style'); css.id = 'sg-wm-css'; css.textContent = ${JSON.stringify(CSS)}; d.head.appendChild(css);
  // the parts of the page, named like elstyles.js names them
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
  var partMap = function () {
    var seen = {}, map = {};
    parts().forEach(function (p) { var k = base(p), n = seen[k] = (seen[k] || 0) + 1; map[n > 1 ? k + '~' + (n - 1) : k] = p; });
    return map;
  };
  var esc = function (s) { return s.replace(/["\\\\]/g, '\\\\$&'); };
  var hostOf = function (t, map) {
    var p = map[t.part]; if (!p) return null;
    if (!t.el) return p;
    return p.querySelector('[data-sg-ee="' + esc(t.el) + '"]');
  };
  var clear = function () {
    Array.prototype.forEach.call(d.querySelectorAll('svg.sg-wm'), function (n) { n.remove(); });
    Array.prototype.forEach.call(d.querySelectorAll('.sg-wm-host'), function (n) { n.classList.remove('sg-wm-host', 'sg-wm-rel'); });
  };
  var apply = function (list) {
    clear();
    var map = partMap();
    (list || []).forEach(function (t) {
      var host = hostOf(t, map); if (!host || /^(IMG|VIDEO|CANVAS|IFRAME|INPUT|TEXTAREA|SELECT|BR|HR)$/.test(host.tagName) || host.closest('svg')) return;
      var tmp = d.createElement('div'); tmp.innerHTML = t.svg;
      var svg = tmp.firstElementChild; if (!svg) return;
      svg.setAttribute('class', 'sg-wm' + (t.drift ? ' sg-wm-drift' : '') + (t.mhide ? ' sg-wm-mhide' : ''));
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('data-sg-ee', 'wm');   // Move & size and Style text leave it alone
      svg.setAttribute('data-sg-wm', t.id);
      svg.setAttribute('style', t.css);
      if (!host.classList.contains('sg-wm-host')) {
        if (window.getComputedStyle(host).position === 'static') host.classList.add('sg-wm-rel');
        host.classList.add('sg-wm-host');
      }
      host.insertBefore(svg, host.firstChild);
    });
  };
  var src = d.getElementById('sg-wm-data'), list = [];
  try { list = JSON.parse(src ? src.textContent : '[]'); } catch (e) {}
  apply(list);
  window.sgWm = { apply: apply, parts: partMap, base: base };
})();`;

// What the editor's Watermark panel needs: the icons, presets and the 9 points
function editorData() {
  return JSON.stringify({
    icons: Object.keys(ICONS).map(k => ({ key: k, name: ICONS[k].name, vb: ICONS[k].vb, g: ICONS[k].g, turn: ICONS[k].turn })),
    presets: PRESETS, pos: POS.map(k => ({ key: k, name: POS_NAMES[k] })), color: DEFAULT_COLOR, limits: LIMITS
  }).replace(/</g, '\\u003c');
}

module.exports = { ICONS, POS, PRESETS, DEFAULT_COLOR, LIMITS, MAX, clean, cleanOne, cleanSvg, fromBody, forPage, fromPreset, svgOf, placeCss, css, data, CSS, SCRIPT, editorData };
