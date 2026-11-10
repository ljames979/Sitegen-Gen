// Theme tokens panel in the editor (themetokens.js has the rules and draws them on the page). Keeps the hidden box
// theme_tokens_json in step with the panel and asks the editor to save (its autosave listens for input on the form).
(function () {
  'use strict';
  var box = document.getElementById('tkJson'), panel = document.getElementById('themeTokens');
  if (!box || !panel) return;
  var HEX = /^#[0-9a-f]{6}$/i;
  var FONT_ROLES = [['display', 'Display font', 'logo, hero headline and section headings only'], ['accent', 'Accent serif', 'quotes and taglines'], ['body', 'Body / UI font', 'menu, paragraphs, buttons, labels']];
  var TEXT_ROLES = [['heading', 'Headings'], ['body', 'Body text'], ['eyebrow', 'Eyebrow labels'], ['eyebrowOnBlue', 'Eyebrow labels on blue (tinted) sections'], ['surface', 'Tinted section background']];
  var BUTTONS = [['primary', 'Primary button'], ['secondary', 'Secondary button'], ['onDark', 'Button on dark or pink backgrounds']];
  var blankBtn = function (bg, text) { return { bg: bg, text: text, border: '', borderW: 0, hover: '', padY: 15, padX: 28, lift: 2, weight: 700, shape: 'pill' }; };
  var state;
  try { state = JSON.parse(box.value || 'null'); } catch (e) { state = null; }
  if (!state) state = { on: false, name: '', colors: [], fonts: {}, text: { eyebrowSize: 14, eyebrowSpacing: 0.16 }, buttons: { primary: blankBtn('#2563eb', '#ffffff'), secondary: blankBtn('#ffffff', '#2563eb'), onDark: blankBtn('#ffffff', '#2563eb') } };
  state.fonts = state.fonts || {}; state.text = state.text || {}; state.buttons = state.buttons || {};
  BUTTONS.forEach(function (b) { if (!state.buttons[b[0]]) state.buttons[b[0]] = blankBtn('#ffffff', '#111111'); });

  var lum = function (h) { var n = parseInt(String(h).slice(1), 16), f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); };
  var ratio = function (a, b) { if (!HEX.test(a || '') || !HEX.test(b || '')) return 21; var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  var el = function (tag, attrs, kids) { var e = document.createElement(tag); Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); }); (kids || []).forEach(function (k) { if (k) e.appendChild(k); }); return e; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  function save() {
    box.value = JSON.stringify(state);
    if (state.on) panel.removeAttribute('data-off'); else panel.setAttribute('data-off', '');
    warn();
    box.dispatchEvent(new Event('change', { bubbles: true }));
    var form = document.getElementById('editorForm'); if (form) form.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function warn() {
    var out = [];
    TEXT_ROLES.forEach(function (r) {
      if (r[0] === 'surface') return;
      var c = state.text[r[0]], on = r[0] === 'eyebrowOnBlue' && HEX.test(state.text.surface || '') ? state.text.surface : '#ffffff';
      if (HEX.test(c || '') && ratio(c, on) < 4.5) out.push(r[1] + ': ' + c.toUpperCase() + ' is too light to read there; the page darkens it just enough.');
    });
    BUTTONS.forEach(function (b) { var x = state.buttons[b[0]]; if (ratio(x.text, x.bg) < 4.5) out.push(b[1] + ': the text color is hard to read on its background.'); });
    document.getElementById('tkWarn').innerHTML = out.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('');
  }
  // a color field: <input type=color> (the shared color picker adds the code box, shades and theme swatches) + clear
  function colorField(label, get, set, optional) {
    var id = 'tk' + Math.random().toString(36).slice(2, 8);
    var inp = el('input', { type: 'color', id: id, value: HEX.test(get() || '') ? get() : '#ffffff' });
    inp.addEventListener('input', function () { set(inp.value.toLowerCase()); save(); });
    var wrap = el('div', {}, [el('label', { for: id, text: label }), inp]);
    if (optional) {
      var clr = el('button', { type: 'button', class: 'btn-secondary', style: 'padding:2px 8px;margin-left:4px;font-size:12px', text: get() ? 'None' : 'Add' });
      clr.addEventListener('click', function () { if (get()) { set(''); clr.textContent = 'Add'; } else { set(inp.value.toLowerCase()); clr.textContent = 'None'; } save(); });
      wrap.appendChild(clr);
    }
    return wrap;
  }
  function numField(label, val, min, max, step, set) {
    var id = 'tk' + Math.random().toString(36).slice(2, 8), inp = el('input', { type: 'number', id: id, min: min, max: max, step: step, value: val });
    inp.addEventListener('input', function () { var n = parseFloat(inp.value); if (isFinite(n)) { set(n); save(); } });
    return el('div', {}, [el('label', { for: id, text: label }), inp]);
  }

  function drawColors() {
    var host = document.getElementById('tkColors'); host.innerHTML = '';
    state.colors.forEach(function (c, i) {
      var name = el('input', { type: 'text', value: c.key, maxlength: '24', 'aria-label': 'Color name', placeholder: 'name, e.g. blush' });
      name.addEventListener('input', function () { c.key = name.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'); save(); });
      var pick = el('input', { type: 'color', value: HEX.test(c.hex) ? c.hex : '#ffffff', 'aria-label': 'Color for ' + c.key });
      pick.addEventListener('input', function () { c.hex = pick.value.toLowerCase(); save(); });
      var x = el('button', { type: 'button', class: 'btn-secondary tk-x', title: 'Remove this color', 'aria-label': 'Remove ' + c.key, text: '×' });
      x.addEventListener('click', function () { state.colors.splice(i, 1); drawColors(); save(); });
      host.appendChild(el('div', { class: 'tk-c' }, [name, pick, x]));
    });
  }
  function drawFonts() {
    var host = document.getElementById('tkFonts'); host.innerHTML = '';
    FONT_ROLES.forEach(function (r) {
      var f = state.fonts[r[0]] || { family: '', weights: '400;700', italic: false };
      var fam = el('input', { type: 'text', value: f.family, placeholder: 'Google Font name', 'aria-label': r[1] + ' family' });
      var w = el('input', { type: 'text', value: f.weights, placeholder: '400;700', 'aria-label': r[1] + ' weights' });
      var it = el('input', { type: 'checkbox', 'aria-label': r[1] + ' italic' }); it.checked = !!f.italic;
      var upd = function () { state.fonts[r[0]] = fam.value.trim() ? { family: fam.value.trim(), weights: w.value.replace(/\s+/g, '') || '400;700', italic: it.checked } : null; save(); };
      [fam, w].forEach(function (x) { x.addEventListener('change', upd); }); it.addEventListener('change', upd);
      host.appendChild(el('fieldset', {}, [el('legend', { text: r[1] + ' (' + r[2] + ')' }), el('div', { class: 'tk-grid' }, [
        el('div', {}, [el('label', { text: 'Font' }), fam]), el('div', {}, [el('label', { text: 'Weights (e.g. 400;600;700)' }), w]),
        el('label', {}, [it, document.createTextNode(' Load italic too')])])]));
    });
  }
  function drawText() {
    var host = document.getElementById('tkText'); host.innerHTML = '';
    var grid = el('div', { class: 'tk-grid' });
    TEXT_ROLES.forEach(function (r) { grid.appendChild(colorField(r[1], function () { return state.text[r[0]]; }, function (v) { state.text[r[0]] = v; }, true)); });
    grid.appendChild(numField('Eyebrow size (px)', state.text.eyebrowSize || 14, 10, 22, 1, function (n) { state.text.eyebrowSize = n; }));
    grid.appendChild(numField('Eyebrow letter spacing (em)', state.text.eyebrowSpacing != null ? state.text.eyebrowSpacing : 0.16, 0, 0.4, 0.01, function (n) { state.text.eyebrowSpacing = n; }));
    var sel = el('select', { id: 'tkBrand' }); sel.appendChild(el('option', { value: '', text: 'Heading color' }));
    state.colors.forEach(function (c) { var o = el('option', { value: c.key, text: c.key }); if (state.text.brandColor === c.key) o.selected = true; sel.appendChild(o); });
    sel.addEventListener('change', function () { state.text.brandColor = sel.value; save(); });
    grid.appendChild(el('div', {}, [el('label', { for: 'tkBrand', text: 'Accent color (footer, dark bands)' }), sel]));
    host.appendChild(grid);
  }
  function drawButtons() {
    var host = document.getElementById('tkButtons'); host.innerHTML = '';
    BUTTONS.forEach(function (b) {
      var x = state.buttons[b[0]], grid = el('div', { class: 'tk-grid' });
      grid.appendChild(colorField('Background', function () { return x.bg; }, function (v) { x.bg = v || '#ffffff'; }));
      grid.appendChild(colorField('Text', function () { return x.text; }, function (v) { x.text = v || '#111111'; }));
      grid.appendChild(colorField('Border', function () { return x.border; }, function (v) { x.border = v; }, true));
      grid.appendChild(numField('Border width (px)', x.borderW, 0, 6, 0.5, function (n) { x.borderW = n; }));
      grid.appendChild(colorField('Hover background', function () { return x.hover; }, function (v) { x.hover = v; }, true));
      grid.appendChild(numField('Hover lift (px)', x.lift, 0, 10, 1, function (n) { x.lift = n; }));
      grid.appendChild(numField('Padding top/bottom (px)', x.padY, 4, 40, 1, function (n) { x.padY = n; }));
      grid.appendChild(numField('Padding left/right (px)', x.padX, 8, 80, 1, function (n) { x.padX = n; }));
      var shape = el('select', {}); [['pill', 'Pill'], ['rounded', 'Rounded'], ['square', 'Square']].forEach(function (o) { var op = el('option', { value: o[0], text: o[1] }); if (x.shape === o[0]) op.selected = true; shape.appendChild(op); });
      shape.addEventListener('change', function () { x.shape = shape.value; save(); preview(); });
      grid.appendChild(el('div', {}, [el('label', { text: 'Shape' }), shape]));
      var prev = el('span', { class: 'tk-prev', 'data-btn': b[0], text: b[1] });
      host.appendChild(el('fieldset', {}, [el('legend', { text: b[1] }), grid, prev]));
    });
    preview();
  }
  function preview() {
    panel.querySelectorAll('.tk-prev').forEach(function (p) {
      var x = state.buttons[p.getAttribute('data-btn')], f = state.fonts.body;
      p.style.cssText = 'background:' + x.bg + ';color:' + x.text + ';border:' + (x.border && x.borderW ? x.borderW + 'px solid ' + x.border : '0') + ';padding:' + x.padY + 'px ' + x.padX + 'px;border-radius:' + (x.shape === 'square' ? '0' : x.shape === 'rounded' ? '10px' : '999px') + ';font-weight:' + x.weight + ';' + (f ? "font-family:'" + f.family + "',sans-serif;" : '') + (p.getAttribute('data-btn') === 'onDark' ? 'box-shadow:0 0 0 6px ' + (state.buttons.primary.bg || '#333') + ';margin:6px;' : '');
    });
  }
  function drawAll() {
    document.getElementById('tkOn').checked = !!state.on;
    document.getElementById('tkName').value = state.name || '';
    drawColors(); drawFonts(); drawText(); drawButtons(); warn();
    if (state.on) panel.removeAttribute('data-off'); else panel.setAttribute('data-off', '');
  }

  document.getElementById('tkOn').addEventListener('change', function () { state.on = this.checked; save(); });
  document.getElementById('tkName').addEventListener('input', function () { state.name = this.value; save(); });
  document.getElementById('tkAddColor').addEventListener('click', function () { state.colors.push({ key: 'color-' + (state.colors.length + 1), hex: '#cccccc' }); drawColors(); drawText(); save(); });
  panel.addEventListener('input', function (e) { if (e.target.closest('#tkButtons')) preview(); });
  document.getElementById('tkPreset').addEventListener('change', function () {
    var key = this.value; this.value = ''; if (!key) return;
    var list = []; try { list = JSON.parse(document.getElementById('tkPresets').textContent); } catch (e) { list = []; }
    var p = list.filter(function (x) { return x.key === key; })[0]; if (!p) return;
    if (state.colors.length && !window.confirm('Replace the theme tokens here with "' + p.name + '"?')) return;
    state = JSON.parse(JSON.stringify(p.tokens)); state.on = true; drawAll(); save();
  });
  drawAll();
})();
