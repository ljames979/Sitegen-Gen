// Odd shapes and stamps (Leo, 2026-11-06): our own drawings of the little extras lettering artists put around words
// (sparkles, drops, swirls, a cloud badge, an arrow banner, squiggles, action lines, a swoosh) and rubber stamps with
// the owner's own words. All plain SVG drawn here (no outside artwork), in one color (currentColor), so they take the
// logo color or any color picked, stay sharp at any size and have no background.
// Used by the "+ Shape" and "+ Stamp" buttons in the editor (picboxes.js stores them as art "shape-<id>" or
// "stamp-<id>"); the same file draws them on the page (require) and in the editor (window.ShapeArt).
//
// TO ADD A SHAPE: add one entry to SHAPES: { id (lowercase letters only), group, label, vb: 'viewBox', ratio
// (height / width, for its first size), body: the SVG inside, using currentColor }. A new group name makes a new
// section in the shape picker. Stamps work the same way in STAMPS, with body(text, sub, uid) returning the SVG inside.
(function (root) {
  'use strict';
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var F = 'fill="currentColor"', S = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';

  // a four-point star with curved sides
  function star4(cx, cy, r) {
    var k = r * 0.16;
    return '<path ' + F + ' d="M' + cx + ' ' + (cy - r) + ' C' + (cx + k) + ' ' + (cy - k) + ' ' + (cx + k) + ' ' + (cy - k) + ' ' + (cx + r) + ' ' + cy +
      ' C' + (cx + k) + ' ' + (cy + k) + ' ' + (cx + k) + ' ' + (cy + k) + ' ' + cx + ' ' + (cy + r) +
      ' C' + (cx - k) + ' ' + (cy + k) + ' ' + (cx - k) + ' ' + (cy + k) + ' ' + (cx - r) + ' ' + cy +
      ' C' + (cx - k) + ' ' + (cy - k) + ' ' + (cx - k) + ' ' + (cy - k) + ' ' + cx + ' ' + (cy - r) + 'Z"/>';
  }
  // a wavy line across the box
  function wave(w, y, amp, n, sw) {
    var step = w / n, d = 'M' + (sw / 2) + ' ' + y;
    for (var i = 0; i < n; i++) { var x0 = sw / 2 + i * (w - sw) / n, x1 = x0 + (w - sw) / n; d += ' Q' + ((x0 + x1) / 2).toFixed(1) + ' ' + (y + (i % 2 ? amp : -amp)) + ' ' + x1.toFixed(1) + ' ' + y; }
    return '<path ' + S + ' stroke-width="' + sw + '" d="' + d + '"/>';
  }
  // a zig-zag ring (for the burst and the seal)
  function burstPath(cx, cy, ro, ri, n) {
    var d = '';
    for (var i = 0; i < n * 2; i++) { var a = Math.PI * i / n - Math.PI / 2, r = i % 2 ? ri : ro; d += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1) + ' '; }
    return d + 'Z';
  }

  var SHAPES = [
    { id: 'sparkle', group: 'Odd shapes', label: 'Sparkle', vb: '0 0 100 100', ratio: 1, body: function () { return star4(50, 50, 48); } },
    { id: 'sparkles', group: 'Odd shapes', label: 'Sparkles (three)', vb: '0 0 120 100', ratio: 0.84, body: function () { return star4(42, 56, 40) + star4(96, 24, 20) + star4(100, 80, 12); } },
    { id: 'drop', group: 'Odd shapes', label: 'Drop', vb: '0 0 100 130', ratio: 1.3, body: function () { return '<path ' + F + ' d="M50 4 C58 30 92 58 92 86 A42 42 0 0 1 8 86 C8 58 42 30 50 4Z"/>'; } },
    { id: 'swirl', group: 'Odd shapes', label: 'Swirl drop', vb: '0 0 100 120', ratio: 1.2, body: function () { return '<path ' + F + ' d="M32 116 C10 116 2 92 16 76 C30 60 56 56 66 34 C72 20 68 10 58 4 C86 6 100 34 94 62 C88 92 62 116 32 116Z"/>'; } },
    { id: 'splash', group: 'Odd shapes', label: 'Splash', vb: '0 0 140 100', ratio: 0.72, body: function () { return '<path ' + F + ' d="M20 62 C10 40 34 22 56 30 C70 10 104 12 110 36 C132 38 136 66 116 76 C108 96 76 96 64 84 C44 96 18 88 20 62Z"/><circle ' + F + ' cx="10" cy="26" r="7"/><circle ' + F + ' cx="128" cy="16" r="5"/><circle ' + F + ' cx="134" cy="92" r="4"/>'; } },
    { id: 'cloud', group: 'Odd shapes', label: 'Cloud badge', vb: '0 0 200 130', ratio: 0.65, body: function () { return '<g ' + F + '><circle cx="56" cy="40" r="34"/><circle cx="104" cy="30" r="30"/><circle cx="150" cy="44" r="32"/><circle cx="168" cy="82" r="28"/><circle cx="128" cy="100" r="28"/><circle cx="78" cy="100" r="28"/><circle cx="34" cy="84" r="30"/><rect x="40" y="40" width="124" height="64" rx="10"/></g>'; } },
    { id: 'arrow', group: 'Odd shapes', label: 'Arrow banner', vb: '0 0 220 100', ratio: 0.45, body: function () { return '<path ' + F + ' d="M4 26 L156 20 L152 2 L216 50 L152 98 L156 80 L4 76 L18 51 Z"/>'; } },
    { id: 'squiggle', group: 'Odd shapes', label: 'Squiggle line', vb: '0 0 300 40', ratio: 0.13, body: function () { return wave(300, 20, 14, 12, 9); } },
    { id: 'squiggles', group: 'Odd shapes', label: 'Two squiggles', vb: '0 0 300 90', ratio: 0.3, body: function () { return wave(300, 20, 14, 12, 9) + wave(300, 70, 14, 12, 9); } },
    { id: 'lines', group: 'Odd shapes', label: 'Action lines', vb: '0 0 100 100', ratio: 1, body: function () { return '<g ' + S + ' stroke-width="8"><path d="M20 78 L6 30"/><path d="M42 72 L34 10"/><path d="M64 72 L66 18"/><path d="M84 80 L96 40"/></g>'; } },
    { id: 'swoosh', group: 'Odd shapes', label: 'Swoosh underline', vb: '0 0 300 50', ratio: 0.17, body: function () { return '<path ' + F + ' d="M6 34 C80 10 200 8 294 22 C298 24 298 32 292 32 C200 22 90 26 14 44 C4 46 0 38 6 34Z"/>'; } },
    { id: 'burst', group: 'Odd shapes', label: 'Burst', vb: '0 0 100 100', ratio: 1, body: function () { return '<path ' + F + ' d="' + burstPath(50, 50, 49, 36, 16) + '"/>'; } },
    { id: 'dot', group: 'Odd shapes', label: 'Dot', vb: '0 0 100 100', ratio: 1, body: function () { return '<circle ' + F + ' cx="50" cy="50" r="48"/>'; } }
  ];

  // the worn rubber look: a speckle of see-through spots over the ink (unique id per drawing)
  function inkFilter(uid) {
    return '<filter id="sgink' + uid + '" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="7" result="n"/>' +
      '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -5 3.6" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>';
  }
  var FONT = 'font-family="\'Arial Black\', Impact, \'Helvetica Neue\', Arial, sans-serif" font-weight="900"';
  // a font size that keeps the words inside the given width
  var fitSize = function (t, width, max) { return Math.max(9, Math.min(max, Math.floor(width / Math.max(1, String(t).length) / 0.78))); };

  var STAMPS = [
    { id: 'round', label: 'Round stamp', vb: '0 0 200 200', ratio: 1, hint: 'Your words go round the ring; the small words sit in the middle',
      body: function (t, s, uid) {
        var ring = esc(String(t).toUpperCase()), mid = esc(String(s || '★').toUpperCase());
        return '<defs><path id="sgrt' + uid + '" d="M30 100 A70 70 0 0 1 170 100"/><path id="sgrb' + uid + '" d="M22 100 A78 78 0 0 0 178 100"/></defs>' +
          '<g ' + S + ' stroke-width="6"><circle cx="100" cy="100" r="94"/></g><g ' + S + ' stroke-width="2.5"><circle cx="100" cy="100" r="84"/><circle cx="100" cy="100" r="52"/></g>' +
          '<g ' + F + ' ' + FONT + ' font-size="19" letter-spacing="2"><text><textPath href="#sgrt' + uid + '" startOffset="50%" text-anchor="middle">' + ring + '</textPath></text>' +
          '<text><textPath href="#sgrb' + uid + '" startOffset="50%" text-anchor="middle">★ ★ ★</textPath></text>' +
          '<text x="100" y="100" text-anchor="middle" dominant-baseline="central" font-size="' + fitSize(s || '★', 92, 34) + '">' + mid + '</text></g>';
      } },
    { id: 'rect', label: 'Rubber stamp', vb: '0 0 260 120', ratio: 0.46, hint: 'Big words in a double frame, small words underneath',
      body: function (t, s) {
        var big = String(t).toUpperCase(), small = String(s || '').toUpperCase();
        return '<g ' + S + '><rect x="5" y="5" width="250" height="110" rx="10" stroke-width="7"/><rect x="17" y="17" width="226" height="86" rx="5" stroke-width="2.5"/></g>' +
          '<g ' + F + ' ' + FONT + ' text-anchor="middle"><text x="130" y="' + (small ? 64 : 62) + '" dominant-baseline="central" font-size="' + fitSize(big, 206, small ? 40 : 46) + '" letter-spacing="2">' + esc(big) + '</text>' +
          (small ? '<text x="130" y="91" dominant-baseline="central" font-size="' + fitSize(small, 200, 14) + '" letter-spacing="3">' + esc(small) + '</text>' : '') + '</g>';
      } },
    { id: 'seal', label: 'Seal', vb: '0 0 200 200', ratio: 1, hint: 'A zig-zag seal with your words in the middle',
      body: function (t, s) {
        var big = String(t).toUpperCase(), small = String(s || '').toUpperCase();
        return '<path ' + S + ' stroke-width="5" d="' + burstPath(100, 100, 95, 82, 24) + '"/><circle ' + S + ' stroke-width="2.5" cx="100" cy="100" r="66"/>' +
          '<g ' + F + ' ' + FONT + ' text-anchor="middle"><text x="100" y="' + (small ? 94 : 100) + '" dominant-baseline="central" font-size="' + fitSize(big, 112, 32) + '">' + esc(big) + '</text>' +
          (small ? '<text x="100" y="126" dominant-baseline="central" font-size="' + fitSize(small, 100, 13) + '" letter-spacing="2">' + esc(small) + '</text>' : '') + '</g>';
      } },
    { id: 'postage', label: 'Postage stamp', vb: '0 0 180 220', ratio: 1.22, hint: 'A stamp with a wavy edge: big words and small words',
      body: function (t, s) {
        var big = String(t).toUpperCase(), small = String(s || '').toUpperCase(), d = 'M10 10', i;
        for (i = 0; i < 8; i++) d += ' L' + (10 + i * 20 + 6) + ' 10 A4 4 0 0 0 ' + (10 + i * 20 + 14) + ' 10';
        d += ' L170 10';
        for (i = 0; i < 10; i++) d += ' L170 ' + (10 + i * 20 + 6) + ' A4 4 0 0 0 170 ' + (10 + i * 20 + 14);
        d += ' L170 210';
        for (i = 7; i >= 0; i--) d += ' L' + (10 + i * 20 + 14) + ' 210 A4 4 0 0 0 ' + (10 + i * 20 + 6) + ' 210';
        d += ' L10 210';
        for (i = 9; i >= 0; i--) d += ' L10 ' + (10 + i * 20 + 14) + ' A4 4 0 0 0 10 ' + (10 + i * 20 + 6);
        d += ' Z';
        return '<path ' + S + ' stroke-width="4" d="' + d + '"/><rect ' + S + ' stroke-width="2.5" x="24" y="24" width="132" height="172" rx="3"/>' +
          '<g ' + F + ' ' + FONT + ' text-anchor="middle">' + star4(90, 74, 26) +
          '<text x="90" y="134" dominant-baseline="central" font-size="' + fitSize(big, 116, 30) + '">' + esc(big) + '</text>' +
          (small ? '<text x="90" y="168" dominant-baseline="central" font-size="' + fitSize(small, 112, 13) + '" letter-spacing="2">' + esc(small) + '</text>' : '') + '</g>';
      } }
  ];

  var byShape = {}, byStamp = {};
  SHAPES.forEach(function (x) { byShape[x.id] = x; });
  STAMPS.forEach(function (x) { byStamp[x.id] = x; });
  var MAX_TEXT = 28, MAX_SUB = 40;
  var cleanText = function (t, n) { return String(t == null ? '' : t).replace(/[<>\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, n); };

  // 'shape-sparkle' -> the shape, 'stamp-round' -> the stamp, else null
  function find(art) {
    var m = /^(shape|stamp)-([a-z]{1,20})$/.exec(String(art || ''));
    if (!m) return null;
    var it = (m[1] === 'shape' ? byShape : byStamp)[m[2]];
    return it ? { kind: m[1], it: it } : null;
  }
  var isArt = function (art) { return !!find(art); };
  // the whole <svg> for a box: fit 'stretch' fills the box, otherwise it keeps its shape; uid keeps ids apart
  function svg(art, opts) {
    var f = find(art); if (!f) return '';
    opts = opts || {};
    var uid = String(opts.uid || 'x').replace(/[^a-z0-9]/gi, '').slice(0, 12) || 'x';
    var par = opts.fit === 'stretch' ? 'none' : 'xMidYMid meet', cls = 'sg-' + f.kind + (opts.on ? ' on' : '');
    if (f.kind === 'shape') return '<svg class="' + cls + '" viewBox="' + f.it.vb + '" preserveAspectRatio="' + par + '" aria-hidden="true" overflow="visible">' + f.it.body() + '</svg>';
    var text = cleanText(opts.text, MAX_TEXT) || 'Your words', sub = cleanText(opts.sub, MAX_SUB);
    return '<svg class="' + cls + '" viewBox="' + f.it.vb + '" preserveAspectRatio="' + par + '" role="img" aria-label="' + esc(text + (sub ? ' ' + sub : '')) + '" overflow="visible">' +
      '<defs>' + inkFilter(uid) + '</defs><g filter="url(#sgink' + uid + ')">' + f.it.body(text, sub, uid) + '</g></svg>';
  }
  // the picker lists: [[group, [[art, label, ratio], ...]], ...]
  function shapeMenu() {
    var groups = [], at = {};
    SHAPES.forEach(function (x) { if (!at[x.group]) { at[x.group] = []; groups.push([x.group, at[x.group]]); } at[x.group].push(['shape-' + x.id, x.label, x.ratio]); });
    return groups;
  }
  var stampMenu = function () { return STAMPS.map(function (x) { return ['stamp-' + x.id, x.label, x.ratio, x.hint]; }); };
  var ratio = function (art) { var f = find(art); return f ? f.it.ratio : 1; };

  var API = { SHAPES: SHAPES, STAMPS: STAMPS, find: find, isArt: isArt, svg: svg, shapeMenu: shapeMenu, stampMenu: stampMenu, ratio: ratio, cleanText: cleanText, MAX_TEXT: MAX_TEXT, MAX_SUB: MAX_SUB };
  if (typeof module === 'object' && module.exports) module.exports = API;
  root.ShapeArt = API;
})(typeof window !== 'undefined' ? window : globalThis);
