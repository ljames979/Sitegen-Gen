// Tidy look panel for content blocks (Leo, 2026-11-17: "the part where you edit gradients, vectors, card background
// and colors is wonky and cluttered"). Each block's look sits in two folds (views/sections/_blocks.ejs):
// "Colors and background" and "Placement and motion". This script:
//  - draws a swatch of the picked background and card gradient, and a summary line on each fold's title;
//  - shows the follow-up controls only when they do something (blend and strength for a gradient or texture,
//    texture colors for a texture or pet pattern, card strength for a card gradient);
//  - remembers which folds were last open, for every block.
// It changes no field: the form sends exactly what it sent before.
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
    el.style.background = '';
    if (css) el.style.background = css;
  }
  function chip(css, label, title) {
    return '<span class="chip" title="' + esc(title || label) + '"><i' + (css ? ' style="background:' + esc(css) + '"' : '') + '></i><span>' + esc(label) + '</span></span>';
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
  function syncAll(root) { (root || document).querySelectorAll('.block-row').forEach(sync); }
  window.sgBlockLook = { sync: sync, syncAll: syncAll };

  function start() {
    load(); syncAll();
    // after the other listeners (lazy menus, film, texture colors) have set their hidden fields
    ['change', 'input'].forEach(function (ev) {
      document.addEventListener(ev, function (e) { var r = e.target.closest && e.target.closest('.block-row'); if (r) setTimeout(function () { sync(r); }, 0); });
    });
    document.addEventListener('toggle', function (e) { var d = e.target; if (d.classList && d.classList.contains('blk-look') && d.closest('.block-row') && d.closest('.block-row').dataset.sgLookInit) saveOpen(d.dataset.look, d.open); }, true);
    // the background swatch opens the picture picker (bgpick.js puts its Browse button after the menu)
    document.addEventListener('click', function (e) {
      var sw = e.target.closest && e.target.closest('.blk-sw[data-sw="block_bg"]'); if (!sw) return;
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
      rows.forEach(sync);
      clearTimeout(due); due = setTimeout(function () { rows.forEach(sync); }, 0);   // values set right after the insert (library blocks)
    }).observe(root, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
