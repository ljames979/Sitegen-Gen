// Color labels for the "own color" pickers in the editor.
// Every <input type="color"> on an editor page gets:
//  - a code label next to it (#880D1E) that you can also type or paste a code into,
//  - a strip of five shades of the picked color (darkest to lightest) to click,
//  - a dark bubble above any color you point at, showing its code and a plain name
//    ("880D1E · Dark red"), like the palette tools designers use.
// The brand color text boxes (Primary, Accent, Background, Name color) get a picker,
// the strip and the name too. Palette swatches (.pal-dots) show the bubble on hover.
// A picker can opt out with data-sg-cl="off".
// Pure helpers (hex, name, shades) are exported for the tests; the page part runs
// only in a browser.
(function (root) {
  'use strict';
  var clamp = function (n, lo, hi) { return Math.max(lo, Math.min(hi, n)); };

  function parseHex(s) {
    s = String(s || '').trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map(function (c) { return c + c; }).join('');
    return /^[0-9a-f]{6}$/i.test(s) ? '#' + s.toLowerCase() : null;
  }
  function rgb(hex) { var n = parseInt((parseHex(hex) || '#000000').slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function toHex(r, g, b) { return '#' + [r, g, b].map(function (v) { return clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0'); }).join(''); }
  // "rgb(1, 2, 3)" / "rgba(...)" (from getComputedStyle) -> hex; null when see-through or not a color
  function cssToHex(s) {
    var m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?/i.exec(String(s || ''));
    if (m) { if (m[4] != null && parseFloat(m[4]) === 0) return null; return toHex(+m[1], +m[2], +m[3]); }
    return parseHex(s);
  }
  function hsl(hex) {
    var c = rgb(hex).map(function (v) { return v / 255; }), mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]);
    var l = (mx + mn) / 2, d = mx - mn, h = 0, s = 0;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (mx === c[0]) h = ((c[1] - c[2]) / d) % 6; else if (mx === c[1]) h = (c[2] - c[0]) / d + 2; else h = (c[0] - c[1]) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return { h: h, s: s, l: l };
  }
  function fromHsl(h, s, l) {
    h = ((h % 360) + 360) % 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1);
    var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return toHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
  }

  // Plain color names (the standard web color names, written as words). The nearest one names a code.
  var NAMES = [
    ['Black', '000000'], ['Charcoal', '36454f'], ['Dim grey', '696969'], ['Grey', '808080'], ['Dark grey', 'a9a9a9'], ['Silver', 'c0c0c0'],
    ['Light grey', 'd3d3d3'], ['Gainsboro', 'dcdcdc'], ['White smoke', 'f5f5f5'], ['White', 'ffffff'], ['Slate grey', '708090'],
    ['Light slate grey', '778899'], ['Dark slate grey', '2f4f4f'], ['Snow', 'fffafa'], ['Ivory', 'fffff0'], ['Cream', 'fffdd0'],
    ['Linen', 'faf0e6'], ['Beige', 'f5f5dc'], ['Old lace', 'fdf5e6'], ['Seashell', 'fff5ee'], ['Antique white', 'faebd7'],
    ['Maroon', '800000'], ['Dark red', '8b0000'], ['Burgundy', '800020'], ['Wine', '722f37'], ['Brown', 'a52a2a'], ['Firebrick', 'b22222'],
    ['Crimson', 'dc143c'], ['Red', 'ff0000'], ['Tomato', 'ff6347'], ['Coral', 'ff7f50'], ['Indian red', 'cd5c5c'], ['Light coral', 'f08080'],
    ['Salmon', 'fa8072'], ['Dark salmon', 'e9967a'], ['Light salmon', 'ffa07a'], ['Rose', 'e8607a'], ['Raspberry', 'd21f5a'],
    ['Deep pink', 'ff1493'], ['Hot pink', 'ff69b4'], ['Pink', 'ffc0cb'], ['Light pink', 'ffb6c1'], ['Pale violet red', 'db7093'],
    ['Blush', 'f2a3b3'], ['Lavender blush', 'fff0f5'], ['Misty rose', 'ffe4e1'],
    ['Orange red', 'ff4500'], ['Dark orange', 'ff8c00'], ['Orange', 'ffa500'], ['Burnt orange', 'cc5500'], ['Rust', 'b7410e'], ['Peach', 'ffcba4'],
    ['Peach puff', 'ffdab9'], ['Apricot', 'fbceb1'], ['Gold', 'ffd700'], ['Mustard', 'e1ad01'], ['Goldenrod', 'daa520'],
    ['Dark goldenrod', 'b8860b'], ['Yellow', 'ffff00'], ['Lemon', 'fff44f'], ['Light yellow', 'ffffe0'], ['Lemon chiffon', 'fffacd'],
    ['Khaki', 'f0e68c'], ['Dark khaki', 'bdb76b'], ['Pale goldenrod', 'eee8aa'], ['Wheat', 'f5deb3'], ['Sand', 'c2b280'], ['Tan', 'd2b48c'],
    ['Burlywood', 'deb887'], ['Camel', 'c19a6b'], ['Sienna', 'a0522d'], ['Saddle brown', '8b4513'], ['Chocolate', 'd2691e'],
    ['Coffee', '6f4e37'], ['Espresso', '3c2218'], ['Peru', 'cd853f'], ['Sandy brown', 'f4a460'], ['Rosy brown', 'bc8f8f'], ['Taupe', '483c32'],
    ['Olive', '808000'], ['Dark olive green', '556b2f'], ['Olive drab', '6b8e23'], ['Yellow green', '9acd32'], ['Chartreuse', '7fff00'],
    ['Lime', '00ff00'], ['Lime green', '32cd32'], ['Light green', '90ee90'], ['Pale green', '98fb98'], ['Mint', '98ff98'], ['Honeydew', 'f0fff0'],
    ['Green', '008000'], ['Dark green', '006400'], ['Forest green', '228b22'], ['Sea green', '2e8b57'], ['Medium sea green', '3cb371'],
    ['Emerald', '50c878'], ['Jade', '00a86b'], ['Sage', 'b2ac88'], ['Dark sea green', '8fbc8f'], ['Spring green', '00ff7f'], ['Hunter green', '355e3b'],
    ['Teal', '008080'], ['Pine green', '01796f'], ['Bottle green', '006a4e'], ['Deep forest', '173d33'], ['Deep teal', '0f4c4c'], ['Dark cyan', '008b8b'], ['Light sea green', '20b2aa'], ['Turquoise', '40e0d0'], ['Medium turquoise', '48d1cc'],
    ['Aquamarine', '7fffd4'], ['Cyan', '00ffff'], ['Light cyan', 'e0ffff'], ['Pale turquoise', 'afeeee'], ['Powder blue', 'b0e0e6'],
    ['Cadet blue', '5f9ea0'], ['Steel blue', '4682b4'], ['Light steel blue', 'b0c4de'], ['Sky blue', '87ceeb'], ['Light sky blue', '87cefa'],
    ['Deep sky blue', '00bfff'], ['Light blue', 'add8e6'], ['Alice blue', 'f0f8ff'], ['Baby blue', 'a1caf1'], ['Dodger blue', '1e90ff'],
    ['Cornflower blue', '6495ed'], ['Royal blue', '4169e1'], ['Blue', '0000ff'], ['Medium blue', '0000cd'], ['Dark blue', '00008b'],
    ['Navy', '000080'], ['Midnight blue', '191970'], ['Cobalt', '0047ab'], ['Denim', '1560bd'], ['Petrol', '005f6a'], ['Ink', '1b2a4a'],
    ['Lavender', 'e6e6fa'], ['Thistle', 'd8bfd8'], ['Plum', 'dda0dd'], ['Violet', 'ee82ee'], ['Orchid', 'da70d6'], ['Magenta', 'ff00ff'],
    ['Medium orchid', 'ba55d3'], ['Medium purple', '9370db'], ['Blue violet', '8a2be2'], ['Dark violet', '9400d3'], ['Dark orchid', '9932cc'],
    ['Dark magenta', '8b008b'], ['Purple', '800080'], ['Indigo', '4b0082'], ['Slate blue', '6a5acd'], ['Dark slate blue', '483d8b'],
    ['Medium slate blue', '7b68ee'], ['Lilac', 'c8a2c8'], ['Mauve', 'e0b0ff'], ['Eggplant', '614051'], ['Aubergine', '3b0910']
  ].map(function (x) { return [x[0], '#' + x[1], rgb('#' + x[1])]; });

  // nearest name by the "redmean" distance (close to how people see color differences)
  function name(hex) {
    var h = parseHex(hex); if (!h) return '';
    var c = rgb(h), best = null, bd = Infinity;
    for (var i = 0; i < NAMES.length; i++) {
      var n = NAMES[i][2], rm = (c[0] + n[0]) / 2, dr = c[0] - n[0], dg = c[1] - n[1], db = c[2] - n[2];
      var d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
      if (d < bd) { bd = d; best = NAMES[i][0]; }
    }
    return best;
  }
  function label(hex) { var h = parseHex(hex); return h ? h.slice(1).toUpperCase() : ''; }

  // five shades of one color, darkest to lightest, keeping its hue; greys stay grey
  var STEPS = [0.2, 0.36, 0.52, 0.7, 0.87];
  function shades(hex) {
    var h = parseHex(hex) || '#808080', c = hsl(h), s = c.s < 0.04 ? 0 : Math.max(c.s, 0.35);
    return STEPS.map(function (l) { return fromHsl(c.h, l > 0.8 ? Math.min(s, 0.75) : s, l); });
  }
  // which of the five shades is nearest the color (by lightness)
  function nearestStep(hex) {
    var l = hsl(parseHex(hex) || '#808080').l, best = 0;
    STEPS.forEach(function (v, i) { if (Math.abs(v - l) < Math.abs(STEPS[best] - l)) best = i; });
    return best;
  }
  // black or white, whichever reads better on the color (for the dot on a shade)
  function inkOn(hex) {
    var c = rgb(hex).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] > 0.4 ? '#1f2937' : '#ffffff';
  }

  var API = { parseHex: parseHex, cssToHex: cssToHex, name: name, label: label, shades: shades, nearestStep: nearestStep, inkOn: inkOn, NAMES: NAMES };
  if (typeof module === 'object' && module.exports) module.exports = API;
  root.ColorLabel = API;
  if (typeof document === 'undefined') return;

  // ---------------------------------------------------------------- the page part
  var bound = typeof WeakSet === 'function' ? new WeakSet() : null;
  var TEXT_COLOR = /^theme_(primary|accent|bg|name)Color$/;

  function fire(el) { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }

  // the floating bubble ("880D1E" over "Dark red"), one per page
  var tip = null, tipFor = null;
  function bubble() {
    if (tip) return tip;
    tip = document.createElement('div'); tip.className = 'sg-cl-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
    tip.innerHTML = '<b></b><span></span>';
    document.body.appendChild(tip);
    return tip;
  }
  function showTip(el, hex, extra) {
    var h = parseHex(hex); if (!h) return hideTip();
    var t = bubble(); tipFor = el;
    t.firstChild.textContent = label(h);
    t.lastChild.textContent = (extra ? extra + ' · ' : '') + name(h);
    t.hidden = false;
    var r = el.getBoundingClientRect(), w = t.offsetWidth, ht = t.offsetHeight;
    var x = clamp(r.left + r.width / 2 - w / 2, 4, window.innerWidth - w - 4), y = r.top - ht - 10, below = y < 4;
    if (below) y = r.bottom + 10;
    t.classList.toggle('below', below);
    t.style.left = (x + window.scrollX) + 'px'; t.style.top = (y + window.scrollY) + 'px';
    t.style.setProperty('--ax', (r.left + r.width / 2 - x) + 'px');
  }
  function hideTip() { if (tip) tip.hidden = true; tipFor = null; }

  // the color a pointed-at element stands for, or null
  function hexOf(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el.matches('input[type=color]')) return { el: el, hex: el.value };
    var s = el.closest('[data-sg-hex]');
    if (s) return { el: s, hex: s.getAttribute('data-sg-hex'), extra: s.getAttribute('data-sg-hex-note') || '' };
    var d = el.closest('.pal-dots i');
    if (d) return { el: d, hex: cssToHex(getComputedStyle(d).backgroundColor) };
    return null;
  }
  document.addEventListener('mouseover', function (e) {
    var hit = hexOf(e.target);
    if (hit && hit.hex) showTip(hit.el, hit.hex, hit.extra); else if (tipFor) hideTip();
  });
  document.addEventListener('focusin', function (e) { var hit = hexOf(e.target); if (hit && hit.hex) showTip(hit.el, hit.hex, hit.extra); });
  document.addEventListener('focusout', hideTip);
  window.addEventListener('scroll', hideTip, true);

  function brandColors() {
    var out = [];
    [['theme_primaryColor', 'Brand primary'], ['theme_accentColor', 'Brand accent']].forEach(function (x) {
      var i = document.querySelector('[name=' + x[0] + ']'), h = i && parseHex(i.value);
      if (h) out.push([h, x[1]]);
    });
    return out;
  }

  // picker = the <input type=color>; text = a text box that holds the code instead (brand colors)
  function build(picker, text) {
    var wrap = document.createElement('span'); wrap.className = 'sg-cl'; wrap.setAttribute('data-sg-cl-for', '');
    var chip = null;
    if (!text) {
      chip = document.createElement('span'); chip.className = 'sg-cl-code'; chip.contentEditable = 'true'; chip.spellcheck = false;
      chip.setAttribute('role', 'textbox'); chip.setAttribute('aria-label', 'Color code'); chip.title = 'The color code. Type or paste a code like #880D1E and press Enter.';
      wrap.appendChild(chip);
    }
    var strip = document.createElement('span'); strip.className = 'sg-cl-strip'; strip.setAttribute('role', 'group'); strip.setAttribute('aria-label', 'Shades of this color');
    wrap.appendChild(strip);
    var nm = document.createElement('span'); nm.className = 'sg-cl-name'; wrap.appendChild(nm);

    function cur() { return parseHex(text ? text.value : picker.value); }
    function set(h) {
      if (text) { text.value = h; fire(text); }
      if (picker.value !== h) { picker.value = h; if (!text) fire(picker); }
      paint();
    }
    function paint() {
      var h = cur();
      if (chip && document.activeElement !== chip) chip.textContent = h ? h.toUpperCase() : '';
      nm.textContent = h ? name(h) : '';
      if (text && h && picker.value !== h) picker.value = h;
      strip.innerHTML = '';
      var list = shades(h || '#808080'), at = h ? nearestStep(h) : -1;
      list.forEach(function (c, i) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'sg-cl-sw'; b.style.background = c;
        b.setAttribute('data-sg-hex', c); b.setAttribute('aria-label', 'Use ' + label(c) + ' ' + name(c));
        if (i === at) { b.classList.add('on'); b.style.setProperty('--dot', inkOn(c)); }
        b.addEventListener('click', function (e) { e.preventDefault(); set(c); showTip(b, c); });
        strip.appendChild(b);
      });
      brandColors().forEach(function (x, i) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'sg-cl-sw sg-cl-brand' + (i ? '' : ' first'); b.style.background = x[0];
        b.setAttribute('data-sg-hex', x[0]); b.setAttribute('data-sg-hex-note', x[1]); b.setAttribute('aria-label', 'Use ' + x[1] + ' ' + label(x[0]));
        b.addEventListener('click', function (e) { e.preventDefault(); set(x[0]); showTip(b, x[0], x[1]); });
        strip.appendChild(b);
      });
    }
    if (chip) {
      var commit = function () { var h = parseHex(chip.textContent); if (h) set(h); else chip.textContent = (cur() || '').toUpperCase(); };
      chip.addEventListener('click', function (e) { e.preventDefault(); }); // inside a <label>: don't open the picker
      chip.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); chip.blur(); } else if (e.key === 'Escape') { chip.textContent = ''; chip.blur(); } });
      chip.addEventListener('input', function (e) { e.stopPropagation(); var h = parseHex(chip.textContent); if (h && h.length === 7 && /^#?[0-9a-f]{6}$/i.test(chip.textContent.trim())) set(h); });
      chip.addEventListener('blur', commit);
      chip.addEventListener('paste', function (e) { e.preventDefault(); var t = (e.clipboardData || window.clipboardData).getData('text'); var h = parseHex(t); chip.textContent = h ? h.toUpperCase() : t.trim().slice(0, 7); if (h) set(h); });
    }
    picker.addEventListener('input', function () { if (text) { text.value = picker.value; fire(text); } paint(); });
    if (text) text.addEventListener('input', paint);
    wrap.addEventListener('mouseenter', paint); // catch values set by other scripts
    paint();
    return wrap;
  }

  function enhance(picker) {
    if (picker.getAttribute('data-sg-cl') === 'off' || picker.closest('template,[data-sg-cl=off]')) return;
    if (bound && bound.has(picker)) return;
    // a copied row carries a copy of the labels with no clicks wired up: replace it
    var nx = picker.nextElementSibling;
    if (nx && nx.hasAttribute('data-sg-cl-for')) nx.remove();
    if (bound) bound.add(picker);
    picker.parentNode.insertBefore(build(picker, null), picker.nextSibling);
  }
  function enhanceText(input) {
    if (bound && bound.has(input)) return;
    var nx = input.nextElementSibling;
    if (nx && nx.hasAttribute('data-sg-cl-for')) nx.remove();
    if (bound) bound.add(input);
    var row = document.createElement('span'); row.className = 'sg-cl-row'; row.setAttribute('data-sg-cl-for', '');
    var p = document.createElement('input'); p.type = 'color'; p.className = 'sg-cl-pick'; p.setAttribute('data-sg-cl', 'off'); p.setAttribute('aria-label', 'Pick the color');
    p.value = parseHex(input.value) || '#808080';
    if (bound) bound.add(p);
    row.appendChild(p); row.appendChild(build(p, input));
    input.parentNode.insertBefore(row, input.nextSibling);
  }
  function scan(rootEl) {
    if (!rootEl.querySelectorAll) return;
    if (rootEl.matches && rootEl.matches('input[type=color]')) enhance(rootEl);
    rootEl.querySelectorAll('input[type=color]').forEach(enhance);
    rootEl.querySelectorAll('input[type=text][name]').forEach(function (i) { if (TEXT_COLOR.test(i.name)) enhanceText(i); });
  }
  var CSS = [
    '.sg-cl { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; vertical-align: middle; margin: 0 0 0 6px; font-weight: 400; }',
    '.sg-cl-row { display: flex; align-items: center; gap: 6px; margin: -4px 0 10px; }',
    '.sg-cl-row .sg-cl { margin: 0; }',
    '.sg-cl-pick { width: 40px !important; height: 30px !important; padding: 2px !important; margin: 0 !important; border: 1px solid var(--border, #e2e8f0); border-radius: 8px; background: #fff; cursor: pointer; }',
    '.sg-cl-code { min-width: 74px; padding: 4px 8px; border: 1px solid var(--border, #e2e8f0); border-radius: 8px; background: #fff; font: 600 12.5px/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; letter-spacing: .02em; color: var(--text, #0f172a); cursor: text; outline: none; white-space: nowrap; }',
    '.sg-cl-code:focus { border-color: var(--primary, #2563eb); box-shadow: 0 0 0 3px rgba(37, 99, 235, .15); }',
    '.sg-cl-strip { display: inline-flex; border-radius: 8px; overflow: hidden; border: 1px solid rgba(15, 23, 42, .12); }',
    '.sg-cl-sw { all: unset; box-sizing: border-box; position: relative; width: 22px; height: 26px; cursor: pointer; }',
    '.sg-cl-sw:hover, .sg-cl-sw:focus-visible { outline: 2px solid var(--primary, #2563eb); outline-offset: -2px; z-index: 1; }',
    '.sg-cl-sw.on::after { content: ""; position: absolute; left: 50%; top: 50%; width: 6px; height: 6px; margin: -3px 0 0 -3px; border-radius: 50%; background: var(--dot, #fff); }',
    '.sg-cl-sw.sg-cl-brand.first { margin-left: 4px; border-left: 2px solid #fff; }',
    '.sg-cl-name { font-size: 12px; color: var(--muted, #64748b); white-space: nowrap; }',
    '.sg-cl-tip { position: absolute; z-index: 2147483000; pointer-events: none; background: #111; color: #fff; border-radius: 8px; padding: 6px 10px 5px; text-align: center; box-shadow: 0 4px 14px rgba(0, 0, 0, .25); }',
    '.sg-cl-tip[hidden] { display: none !important; }',
    // a picker that is hidden (like the unused color boxes of a texture-colors picker) hides its labels too
    'input[type=color][hidden] + .sg-cl, input[type=color][style*="display:none"] + .sg-cl, input[type=color][style*="display: none"] + .sg-cl { display: none !important; }',
    '.sg-cl-tip b { display: block; font: 600 14px/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; letter-spacing: .03em; }',
    '.sg-cl-tip span { display: block; font-size: 11.5px; opacity: .8; margin-top: 1px; white-space: nowrap; }',
    '.sg-cl-tip::after { content: ""; position: absolute; left: var(--ax, 50%); top: 100%; margin-left: -6px; border: 6px solid transparent; border-top-color: #111; }',
    '.sg-cl-tip.below::after { top: auto; bottom: 100%; border-top-color: transparent; border-bottom-color: #111; }'
  ].join('\n');
  function start() {
    if (!document.getElementById('sg-cl-css')) { var st = document.createElement('style'); st.id = 'sg-cl-css'; st.textContent = CSS; document.head.appendChild(st); }
    scan(document);
    new MutationObserver(function (list) {
      list.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1 && !n.classList.contains('sg-cl') && !n.classList.contains('sg-cl-sw')) scan(n); }); });
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : globalThis);
