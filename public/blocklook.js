// Tidy look panel for content blocks (Leo, 2026-11-17: "the part where you edit gradients, vectors, card background
// and colors is wonky and cluttered"). Each block's look sits in two folds (views/sections/_blocks.ejs):
// "Colors and background" and "Placement and motion". This script:
//  - draws a swatch of the picked background and card gradient, and a summary line on each fold's title;
//  - shows the follow-up controls only when they do something (blend and strength for a gradient or texture,
//    texture colors for a texture or pet pattern, card strength for a card gradient);
//  - remembers which folds were last open, for every block;
//  - (2026-11-17, second batch) draws textures and pet patterns as they really look in the swatches (from the
//    picker's previews), opens the one picture picker from either swatch, hides nothing it can't put back, and
//    Copy look / Paste / Paste to all copy a block's background, cards and color film (kept in this browser, so
//    another site can paste them too).
// Apart from Paste, it changes no field: the form sends exactly what it sent before.
(function () {
  'use strict';
  if (window.sgBlockLook) return;
  var SW = { bg: {}, cards: {} };
  function load() {
    try { var d = JSON.parse((document.getElementById('blkLookData') || {}).textContent || '{}'); SW.bg = d.bg || {}; SW.cards = d.cards || {}; } catch (e) { /* keep empty */ }
    try {   // the 284 library gradients: block backgrounds use "g-<id>", cards the bare id
      JSON.parse((document.getElementById('gradLibData') || {}).textContent || '[]').forEach(function (g) {
        (g[1] || []).forEach(function (x) { if (!SW.bg['g-' + x[0]]) SW.bg['g-' + x[0]] = x[2]; if (!SW.cards[x[0]]) SW.cards[x[0]] = x[2]; });
      });
    } catch (e) { /* no library on this page */ }
    // the real drawings of textures and pet patterns, once the picker's previews are in
    if (window.sgBgPreviews) window.sgBgPreviews().then(function (d) {
      (d.groups || []).forEach(function (g) { g[1].forEach(function (x) { SW.bg['g-' + x[0]] = x[2]; }); });
      syncAll();
    }).catch(function () { /* keep the plain swatches */ });
  }
  var KEY = 'sg-blk-look-open';
  function openState() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function saveOpen(k, on) { try { var s = openState(); s[k] = on; localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private window */ } }

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  function val(row, name) { var el = row.querySelector('[name="' + name + '"]'); return el ? el.value : ''; }
  function text(row, name) {
    var el = row.querySelector('select[name="' + name + '"]'); if (!el) return '';
    var o = el.options[el.selectedIndex]; return o ? o.textContent.trim() : '';
  }
  function paint(el, css) {
    if (!el) return;
    var i = el.querySelector('i') || el;
    i.style.background = '';
    if (css) i.style.background = css;
  }
  function chip(css, label, title) {
    return '<span class="chip" title="' + esc(title || label) + '"><i>' + (css ? '<b style="background:' + esc(css) + '"></b>' : '') + '</i><span>' + esc(label) + '</span></span>';
  }
  function show(row, when, on) { row.querySelectorAll('[data-look-when="' + when + '"]').forEach(function (x) { x.hidden = !on; }); }

  function sync(row) {
    if (!row || !row.querySelector) return;
    var colors = row.querySelector('.blk-look[data-look="colors"]'), place = row.querySelector('.blk-look[data-look="place"]');
    if (!colors && !place) return;
    if (!row.dataset.sgLookInit) {   // first time: open the folds the way they were last left
      row.dataset.sgLookInit = '1';
      var st = openState();
      [colors, place].forEach(function (d) { if (d && st[d.dataset.look]) d.open = true; });
    }
    // Colors and background
    var bg = val(row, 'block_bg') || 'none', card = val(row, 'block_cardbg'), film = val(row, 'block_film');
    var isGrad = /^g-/.test(bg), isTex = /^g-tx/.test(bg);
    show(row, 'grad', isGrad); show(row, 'ink', isTex); show(row, 'cardgrad', !!card);
    var bgCss = SW.bg[bg] || '', cardCss = card ? (SW.cards[card] || '') : '';
    paint(row.querySelector('.blk-sw[data-sw="block_bg"]'), bgCss);
    paint(row.querySelector('.blk-sw[data-sw="block_cardbg"]'), cardCss);
    if (colors) {
      var parts = [], hasBg = !!row.querySelector('select[name="block_bg"]');
      if (hasBg) parts.push(chip(bgCss, bg === 'none' ? 'Plain' : text(row, 'block_bg').replace(/^Gradient: /, ''), 'Background: ' + text(row, 'block_bg')));
      if (card) parts.push(chip(cardCss, 'Cards: ' + text(row, 'block_cardbg'), 'Cards: ' + text(row, 'block_cardbg')));
      var fm = /^(brand|#[0-9a-f]{6}):(\d+)$/i.exec(film || '');
      if (fm) parts.push(chip(fm[1] === 'brand' ? (SW.bg.brand || '') : fm[1], 'Film ' + fm[2] + '%', 'Color film, ' + fm[2] + '% strong'));
      colors.querySelector('.blk-look-sum').innerHTML = parts.join('');
    }
    // Placement and motion
    if (place) {
      var bits = [text(row, 'block_page').replace(/^On the /, '').replace(/ page$/, ''), val(row, 'block_place') === 'top' ? 'near the top' : 'lower down'];
      var edge = val(row, 'block_edge'); if (edge && edge !== 'none') bits.push(edge === 'wave' ? 'wavy edge' : 'scalloped edge');
      if (val(row, 'block_height')) bits.push(text(row, 'block_height').toLowerCase());
      if (val(row, 'block_pin')) bits.push(text(row, 'block_pin').toLowerCase().replace(/ (for|while) .*$/, ''));
      if (val(row, 'block_imgfx')) bits.push('photo words');
      place.querySelector('.blk-look-sum').textContent = bits.filter(Boolean).join(' · ');
    }
  }
  // Copy look / Paste / Paste to all
  var LOOK = ['block_bg', 'block_bgmix', 'block_gx', 'block_bgink', 'block_cardbg', 'block_cardgx', 'block_film'], CLIP = 'sg-look-clip';
  function clip() { try { return JSON.parse(localStorage.getItem(CLIP) || 'null'); } catch (e) { return null; } }
  function give(row, c) {
    LOOK.forEach(function (n) {
      var el = row.querySelector('[name="' + n + '"]'); if (!el || !(n in c) || el.type === 'hidden' && n === 'block_bg') return;   // the Gradient pattern block keeps its own colors
      if (el.tagName === 'SELECT') {
        if (window.sgLazyFill) window.sgLazyFill(el);
        if (!Array.prototype.some.call(el.options, function (o) { return o.value === c[n]; })) { var o = document.createElement('option'); o.value = c[n]; o.textContent = c['t_' + n] || c[n]; el.appendChild(o); }
      }
      el.value = c[n];
      if (el.type === 'range' && el.nextElementSibling) el.nextElementSibling.textContent = (c[n] || 100) + '%';
    });
    var ink = row.querySelector('[name="block_bgink"]'); if (ink && window.sgInkSet) { var box = ink.closest('.sg-inkpick'); if (box) window.sgInkSet(box, ink.value); }
    if (window.sgFilmUi) window.sgFilmUi(row);
    var cg = row.querySelector('[data-look-nocards]'); if (cg && c.block_cardbg) cg.hidden = false;
    sync(row);
  }
  function say(row, t) { var m = row.querySelector('.blk-look-msg'); if (m) { m.textContent = t; clearTimeout(m._t); m._t = setTimeout(function () { m.textContent = ''; }, 4000); } }
  function pasteButtons() { var on = !!clip(); document.querySelectorAll('[data-look-paste],[data-look-all]').forEach(function (b) { b.hidden = !on; }); }
  function poke() { var f = document.getElementById('editorForm'); if (f) { f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); } }
  function onCopyPaste(e) {
    var b = e.target.closest && e.target.closest('[data-look-copy],[data-look-paste],[data-look-all]'); if (!b) return;
    e.preventDefault();
    var row = b.closest('.block-row'); if (!row) return;
    if (b.hasAttribute('data-look-copy')) {
      var c = {};
      LOOK.forEach(function (n) {
        var el = row.querySelector('[name="' + n + '"]'); if (!el) return;
        if (n === 'block_bg' && el.type === 'hidden') return;
        c[n] = el.value;
        if (el.tagName === 'SELECT') c['t_' + n] = text(row, n);
      });
      try { localStorage.setItem(CLIP, JSON.stringify(c)); } catch (x) { /* storage blocked */ }
      pasteButtons(); say(row, 'Look copied. Press Paste on another block.');
      return;
    }
    var cl = clip(); if (!cl) return;
    var rows = b.hasAttribute('data-look-all') ? Array.prototype.slice.call(document.querySelectorAll('#editorForm .block-row')) : [row];
    rows.forEach(function (r) { give(r, cl); });
    poke();
    say(row, rows.length > 1 ? 'Given to all ' + rows.length + ' blocks. Undo puts them back.' : 'Look pasted.');
  }
  // a home section's Background colors fold: its summary follows the gallery pick
  function syncSec(d) {
    var sel = d.querySelector('select.grad-pick'), sum = d.querySelector('.blk-look-sum'); if (!sel || !sum) return;
    var o = sel.options[sel.selectedIndex], css = (o && o.getAttribute('data-css')) || '';
    if (sel.value && window.sgBgPreviews && SW.bg['g-' + sel.value]) css = SW.bg['g-' + sel.value];
    d.querySelectorAll('[data-look-when="secink"]').forEach(function (x) { x.hidden = !/^tx[pb]?-/.test(sel.value); });
    sum.innerHTML = sel.value ? chip(css, o ? o.textContent.trim() : sel.value) : 'your colors or the gallery';
  }
  function syncAll(root) { (root || document).querySelectorAll('.block-row').forEach(sync); }
  window.sgBlockLook = { sync: sync, syncAll: syncAll };

  function start() {
    load(); syncAll(); pasteButtons();
    document.addEventListener('click', onCopyPaste);
    window.addEventListener('storage', function (e) { if (e.key === CLIP) pasteButtons(); });
    // after the other listeners (lazy menus, film, texture colors) have set their hidden fields
    ['change', 'input'].forEach(function (ev) {
      document.addEventListener(ev, function (e) {
        var r = e.target.closest && e.target.closest('.block-row'); if (r) setTimeout(function () { sync(r); }, 0);
        var d = e.target.closest && e.target.closest('.sec-look[data-look="secbg"]'); if (d) setTimeout(function () { syncSec(d); }, 0);
      });
    });
    document.addEventListener('toggle', function (e) { var d = e.target; if (d.classList && d.classList.contains('blk-look') && d.closest('.block-row') && d.closest('.block-row').dataset.sgLookInit) saveOpen(d.dataset.look, d.open); }, true);
    // the background swatch opens the picture picker (bgpick.js puts its Browse button after the menu)
    document.addEventListener('click', function (e) {
      var sw = e.target.closest && e.target.closest('.blk-sw'); if (!sw) return;
      var line = sw.parentNode, b = line.querySelector('.sg-bgpick-btn');
      if (b) b.click(); else { var s = line.querySelector('select'); if (s) s.focus(); }
    });
    // blocks added from the picker or the library, and blocks copied
    var root = document.getElementById('editorForm') || document.body, due = null;
    if (window.MutationObserver) new MutationObserver(function (ms) {
      var rows = [];
      ms.forEach(function (m) {
        if (m.target.closest && m.target.closest('.blk-look-sum')) return;   // our own summary line
        m.addedNodes.forEach(function (n) {
          if (n.nodeType !== 1) return;
          if (n.classList.contains('block-row')) rows.push(n); else if (n.querySelectorAll) n.querySelectorAll('.block-row').forEach(function (r) { rows.push(r); });
        });
      });
      if (!rows.length) return;
      rows.forEach(sync); pasteButtons();
      clearTimeout(due); due = setTimeout(function () { rows.forEach(sync); }, 0);   // values set right after the insert (library blocks)
    }).observe(root, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
