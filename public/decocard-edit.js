// Decorative card block: the editor panel (views/sections/_blocks.ejs, decocard.js on the server).
// Keeps the block's hidden body in step with the panel's boxes, so the editor's save sends it as it is:
// style buttons, the slot switches, the words, the colors (with the quick border colors), the sliders and fonts.
// Also: the Add block picker's style cards start the new card in that style, and colors the owner picks that
// read badly on the card get a warning with a darker shade to use instead (4.5:1, the usual rule for text).
(function () {
  'use strict';
  var HEX = /^#[0-9a-f]{6}$/i;
  var flat = function (v) { return String(v || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim(); };
  var q = function (row, sel) { return row.querySelector(sel); };
  var qa = function (row, sel) { return Array.prototype.slice.call(row.querySelectorAll(sel)); };

  // ---- contrast (the same sums as contrast.js on the server) ----
  function rgb(h) { var n = parseInt(String(h).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function toHex(c) { return '#' + c.map(function (v) { return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); }).join(''); }
  function lum(h) { var c = rgb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function ratio(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function ensure(h, against, min) {
    if (ratio(h, against) >= min) return h;
    var c = rgb(h), to = lum(against) > 0.5 ? [0, 0, 0] : [255, 255, 255];
    for (var t = 0.04; t <= 1.0001; t += 0.04) { var m = toHex(c.map(function (v, i) { return v + (to[i] - v) * t; })); if (ratio(m, against) >= min) return m; }
    return toHex(to);
  }
  function mix(a, b, t) { var x = rgb(a), y = rgb(b); return toHex(x.map(function (v, i) { return v * t + y[i] * (1 - t); })); }

  function isDeco(row) { return row && q(row, 'textarea.dc-body'); }
  function styleBtn(row, id) { return q(row, '[data-dcpick="' + id + '"]'); }

  // the panel's boxes -> the body lines (decocard.js parse() reads them back)
  function build(row) {
    var ta = q(row, 'textarea.dc-body'); if (!ta) return;
    var l = ['style: ' + q(row, '.dc-style').value, 'icon: ' + q(row, '.dc-icon').value];
    var put = function (k, v) { v = flat(v); if (v) l.push(k + ': ' + v); };
    put('eyebrow', q(row, '.dc-eyebrow').value);
    put('tagline', q(row, '.dc-tagline').value);
    String(q(row, '.dc-text').value || '').split('\n').map(flat).filter(Boolean).slice(0, 4).forEach(function (t) { l.push('text: ' + t); });
    put('quote', q(row, '.dc-quote').value);
    qa(row, '.dc-detail').forEach(function (i) { put('detail', i.value); });
    var hide = qa(row, '.dc-show').filter(function (c) { return !c.checked; }).map(function (c) { return c.dataset.slot; });
    if (hide.length) l.push('hide: ' + hide.join(', '));
    var sec = q(row, '.dc-sec').value;
    qa(row, '.dc-col').forEach(function (c) {
      var k = c.dataset.key, own = q(row, '.dc-own[data-key="' + k + '"]');
      if (!HEX.test(c.value)) return;
      if (own && !own.checked) return;                              // unticked: the site's palette / the border color
      if ((k === 'sec1' && !sec) || (k === 'sec2' && sec !== 'gradient' && sec !== 'glow')) return;
      l.push(k + ': ' + c.value.toLowerCase());
    });
    if (sec) l.push('sec: ' + sec);
    qa(row, '.dc-num').forEach(function (r) { var own = q(row, '.dc-ownnum[data-key="' + r.dataset.key + '"]'); if (own && own.checked) l.push(r.dataset.key + ': ' + r.value); });
    if (q(row, '.dc-pad').value !== 'm') l.push('pad: ' + q(row, '.dc-pad').value);
    if (q(row, '.dc-width').value !== 'm') l.push('width: ' + q(row, '.dc-width').value);
    if (q(row, '.dc-shadow').value !== 'soft') l.push('shadow: ' + q(row, '.dc-shadow').value);
    qa(row, '.dc-font').forEach(function (s) { if (s.value) l.push(s.dataset.key + ': ' + s.value); });
    var body = l.join('\n');
    if (ta.value !== body) { ta.value = body; ta.textContent = body; }
    warn(row);
  }

  // the body -> the panel's boxes (a block put back from the library)
  function fill(row) {
    if (!isDeco(row)) return;
    var o = { text: [], detail: [], hide: [] };
    String(q(row, 'textarea.dc-body').value || '').split('\n').forEach(function (line) {
      var m = /^([a-z0-9]+):\s?(.*)$/.exec(line.trim()); if (!m) return;
      if (m[1] === 'text' || m[1] === 'detail') o[m[1]].push(m[2]);
      else if (m[1] === 'hide') o.hide = m[2].split(/[\s,]+/);
      else o[m[1]] = m[2].trim();
    });
    pickStyle(row, o.style || 'royal', true);
    if (o.icon) q(row, '.dc-icon').value = o.icon;
    q(row, '.dc-eyebrow').value = o.eyebrow || ''; q(row, '.dc-tagline').value = o.tagline || ''; q(row, '.dc-quote').value = o.quote || '';
    q(row, '.dc-text').value = o.text.join('\n');
    qa(row, '.dc-detail').forEach(function (i, n) { i.value = o.detail[n] || ''; });
    qa(row, '.dc-show').forEach(function (c) { c.checked = o.hide.indexOf(c.dataset.slot) < 0; });
    qa(row, '.dc-col').forEach(function (c) { var k = c.dataset.key, own = q(row, '.dc-own[data-key="' + k + '"]'); if (o[k]) c.value = o[k]; if (own) own.checked = !!o[k]; });
    q(row, '.dc-sec').value = o.sec || '';
    qa(row, '.dc-num').forEach(function (r) { var k = r.dataset.key, own = q(row, '.dc-ownnum[data-key="' + k + '"]'); if (o[k] != null) r.value = o[k]; if (own) own.checked = o[k] != null; });
    if (o.pad) q(row, '.dc-pad').value = o.pad;
    if (o.width) q(row, '.dc-width').value = o.width;
    if (o.shadow) q(row, '.dc-shadow').value = o.shadow;
    qa(row, '.dc-font').forEach(function (s) { s.value = o[s.dataset.key] || ''; });
    refresh(row); build(row);
  }

  function pickStyle(row, id, quiet) {
    var btn = styleBtn(row, id); if (!btn) return;
    q(row, '.dc-style').value = id;
    qa(row, '.dc-style-btn').forEach(function (b) { var on = b === btn; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
    // sliders the owner hasn't set follow the style's own values
    [['thick', 'thick'], ['radius', 'radius'], ['cardop', 'op']].forEach(function (x) {
      var own = q(row, '.dc-ownnum[data-key="' + x[0] + '"]'), r = q(row, '.dc-num[data-key="' + x[0] + '"]');
      if (own && r && !own.checked) r.value = btn.dataset[x[1]];
    });
    refresh(row);
    if (!quiet) build(row);
  }
  // what follows from the boxes: slider read-outs, the section's color boxes
  function refresh(row) {
    qa(row, '.dc-num').forEach(function (r) { var o = r.parentNode.querySelector('.dc-out'); if (o) o.textContent = r.value + (r.dataset.key === 'cardop' ? '%' : 'px'); });
    var sec = q(row, '.dc-sec').value;
    q(row, '.dc-col[data-key="sec1"]').hidden = !sec;
    q(row, '.dc-col[data-key="sec2"]').hidden = !(sec === 'gradient' || sec === 'glow');
    qa(row, '.dc-col[data-key^="sec"]').forEach(function (c) { var nx = c.nextElementSibling; if (nx && nx.hasAttribute('data-sg-cl-for')) nx.hidden = c.hidden; });
  }

  // own colors that are hard to read on the card: say so, and offer a darker (or lighter) shade that passes
  function warn(row) {
    var box = q(row, '.dc-warn'); if (!box) return;
    var card = q(row, '.dc-col[data-key="card"]').value, sec = q(row, '.dc-sec').value;
    var r = q(row, '.dc-num[data-key="cardop"]'), op = +(r ? r.value : 100);
    var pageBg = (document.querySelector('[name=theme_bgColor]') || {}).value;
    var under = sec ? q(row, '.dc-col[data-key="sec1"]').value : (HEX.test(pageBg || '') ? pageBg : '#ffffff');
    var behind = mix(card, under, op / 100);
    var out = [];
    [['headc', 'Heading'], ['bodyc', 'Body text'], ['accc', 'Small line and tagline']].forEach(function (x) {
      var own = q(row, '.dc-own[data-key="' + x[0] + '"]'), c = q(row, '.dc-col[data-key="' + x[0] + '"]');
      if (!own || !own.checked || !HEX.test(c.value)) return;
      var rt = ratio(c.value, behind);
      if (rt < 4.5) out.push({ key: x[0], what: x[1], ratio: rt, better: ensure(c.value, behind, 4.5) });
    });
    box.hidden = !out.length;
    box.innerHTML = '';
    out.forEach(function (w) {
      var p = document.createElement('p');
      p.appendChild(document.createTextNode('⚠ ' + w.what + ' is hard to read on the card (' + w.ratio.toFixed(1) + ':1; aim for 4.5:1). '));
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn-secondary dc-fix'; b.dataset.key = w.key; b.dataset.hex = w.better;
      b.innerHTML = '<i style="background:' + w.better + '"></i>Use ' + w.better.toUpperCase();
      p.appendChild(b); box.appendChild(p);
    });
  }

  function setColor(row, key, hex) {
    var c = q(row, '.dc-col[data-key="' + key + '"]'); if (!c) return;
    c.value = hex; var own = q(row, '.dc-own[data-key="' + key + '"]'); if (own) own.checked = true;
    c.dispatchEvent(new Event('input', { bubbles: true })); c.dispatchEvent(new Event('change', { bubbles: true }));
  }

  document.addEventListener('input', function (e) {
    var row = e.target.closest && e.target.closest('.block-row'); if (!isDeco(row)) return;
    var t = e.target;
    if (t.classList.contains('dc-col')) { var own = q(row, '.dc-own[data-key="' + t.dataset.key + '"]'); if (own) own.checked = true; }
    if (t.classList.contains('dc-num')) { var on = q(row, '.dc-ownnum[data-key="' + t.dataset.key + '"]'); if (on) on.checked = true; }
    refresh(row); build(row);
  }, true);
  document.addEventListener('change', function (e) {
    var row = e.target.closest && e.target.closest('.block-row'); if (!isDeco(row)) return;
    if (e.target.classList.contains('dc-ownnum') && !e.target.checked) { var btn = styleBtn(row, q(row, '.dc-style').value); if (btn) pickStyle(row, btn.dataset.dcpick, true); }
    refresh(row); build(row);
  }, true);
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-dcpick], [data-dcpreset], .dc-fix'); if (!t) return;
    var row = t.closest('.block-row'); if (!isDeco(row)) return;
    e.preventDefault();
    if (t.dataset.dcpick) pickStyle(row, t.dataset.dcpick);
    else if (t.dataset.dcpreset) setColor(row, 'border', t.dataset.dcpreset);
    else setColor(row, t.dataset.key, t.dataset.hex);
    build(row);
    var form = document.getElementById('editorForm'); if (form) form.dispatchEvent(new Event('input', { bubbles: true }));   // autosave
  });
  // the Add block picker's style cards: the new card starts in that style (set on the block's template before the
  // editor copies it; the editor's own click handler then adds the row)
  document.addEventListener('click', function (e) {
    var card = e.target.closest && e.target.closest('[data-newblock="decocard"][data-dcstyle]'); if (!card) return;
    var tpl = document.getElementById('tpl-block-decocard'); if (!tpl) return;
    var row = tpl.content.querySelector('.block-row'); if (!row) return;
    pickStyle(row, card.dataset.dcstyle, true);
    qa(row, '.dc-style-btn').forEach(function (b) { if (b.classList.contains('on')) b.setAttribute('class', 'dc-style-btn on'); else b.setAttribute('class', 'dc-style-btn'); });
    qa(row, '.dc-num').forEach(function (r) { r.setAttribute('value', r.value); });
    q(row, '.dc-style').setAttribute('value', card.dataset.dcstyle);
    build(row);
  }, true);

  window.sgDecoFill = fill;
  window.sgDecoBuild = build;

  var css = '.dc-panel{margin:8px 0 4px}.dc-styles{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px;margin:4px 0 12px}' +
    '.dc-style-btn{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 6px;border:1.5px solid var(--border,#e2e8f0);border-radius:10px;background:#fff;cursor:pointer;font:600 12px system-ui,sans-serif;color:var(--text,#0f172a)}' +
    '.dc-style-btn svg{width:84px;height:56px}.dc-style-btn.on{border-color:var(--primary,#2563eb);box-shadow:0 0 0 3px rgba(37,99,235,.15)}' +
    '.dc-box{border:1px solid var(--border,#e2e8f0);border-radius:10px;padding:8px 12px 10px;margin:0 0 12px}.dc-box legend{font-weight:700;padding:0 4px}' +
    '.dc-slot{padding:6px 0;border-bottom:1px dashed var(--border,#e2e8f0)}.dc-slot:last-child{border-bottom:0}.dc-slot>label{font-weight:600;margin:0 0 4px;display:inline-block}' +
    '.dc-slot input[type=text],.dc-slot textarea,.dc-slot select{margin-top:4px}.dc-row3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}' +
    '@media (max-width:640px){.dc-row3{grid-template-columns:1fr}}' +
    '.dc-c{align-items:center;flex-wrap:wrap}.dc-c>label{font-weight:400;margin:0}.dc-c input[type=color]{width:56px;height:34px;padding:2px}.dc-c input[type=range]{flex:1;min-width:120px}' +
    '.dc-out{min-width:44px;font:600 12.5px ui-monospace,monospace}' +
    '.dc-presets{display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 6px}.dc-preset{display:inline-flex;align-items:center;gap:6px;padding:4px 10px 4px 6px;border:1px solid var(--border,#e2e8f0);border-radius:999px;background:#fff;cursor:pointer;font:500 12.5px system-ui,sans-serif}' +
    '.dc-preset i,.dc-fix i{width:16px;height:16px;border-radius:50%;display:inline-block;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)}' +
    '.dc-warn{background:#fff7ed;border:1px solid #fdba74;color:#7c2d12;border-radius:10px;padding:8px 10px;margin-top:8px;font-size:13px}.dc-warn p{margin:4px 0}' +
    '.dc-fix{display:inline-flex;align-items:center;gap:6px;margin-left:4px;padding:3px 10px !important;font-size:12.5px !important}';
  function start() {
    if (!document.getElementById('dc-edit-css')) { var st = document.createElement('style'); st.id = 'dc-edit-css'; st.textContent = css; document.head.appendChild(st); }
    qa(document, '.block-row').forEach(function (row) { if (isDeco(row) && !row.closest('template')) { refresh(row); warn(row); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
