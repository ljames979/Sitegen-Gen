// Background picker with pictures (Leo, 2026-11-07: "make the interface more user friendly"). Every gallery
// background menu in the editor (a section's "Gradient from the gallery" and a block's background) gets a
// "Browse" button that opens a grid of real previews: gradients, textures and pet patterns as they really look,
// in groups. Picking one sets the menu, as if it was picked there. The previews come from /sites/:id/bg-previews,
// fetched once.
(function () {
  'use strict';
  var SEL = 'select.grad-pick, select[name="block_bg"]';
  var m = /^\/sites\/(\d+)\//.exec(location.pathname); if (!m) return;
  var url = '/sites/' + m[1] + '/bg-previews', data = null, dlg, grid, tabs, target = null, group = '';
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };

  function addButtons(root) {
    (root.querySelectorAll ? root.querySelectorAll(SEL) : []).forEach(function (sel) {
      if (sel.dataset.sgBgpick) return; sel.dataset.sgBgpick = '1';
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-secondary btn-sm sg-bgpick-btn'; b.textContent = '🖼 Browse';
      b.title = 'See every background as it really looks (gradients, textures, pet patterns) and pick one';
      sel.insertAdjacentElement('afterend', b);
    });
  }
  function build() {
    dlg = document.createElement('dialog'); dlg.className = 'sg-bgpick';
    dlg.innerHTML = '<div class="sg-bgpick-head"><strong>Pick a background</strong><span class="muted">Pet patterns go over the color already there; pick their colors next to the menu.</span><button type="button" class="btn-secondary" data-close>Close</button></div><div class="sg-bgpick-tabs"></div><div class="sg-bgpick-grid"><p class="muted">Loading the previews…</p></div>';
    document.body.appendChild(dlg);
    grid = dlg.querySelector('.sg-bgpick-grid'); tabs = dlg.querySelector('.sg-bgpick-tabs');
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg || e.target.closest('[data-close]')) return dlg.close();
      var t = e.target.closest('[data-grp]'); if (t) { group = t.dataset.grp; draw(); return; }
      var p = e.target.closest('[data-val]'); if (p && target) pick(p.dataset.val);
    });
    var st = document.createElement('style');
    st.textContent = [
      '.sg-bgpick { width: min(980px, 94vw); max-height: 86vh; border: 0; border-radius: 16px; padding: 0; box-shadow: 0 20px 60px rgba(15,23,42,.3); }',
      '.sg-bgpick::backdrop { background: rgba(15,23,42,.45); }',
      '.sg-bgpick-head { display: flex; gap: 12px; align-items: center; padding: 14px 18px; border-bottom: 1px solid var(--border,#e2e8f0); } .sg-bgpick-head .muted { flex: 1; font-size: 13px; }',
      '.sg-bgpick-tabs { display: flex; gap: 6px; flex-wrap: wrap; padding: 10px 18px; }',
      '.sg-bgpick-tabs button { all: unset; cursor: pointer; padding: 5px 12px; border-radius: 99px; border: 1px solid var(--border,#e2e8f0); font-size: 13px; } .sg-bgpick-tabs button.on { background: var(--primary,#2563eb); color: #fff; border-color: transparent; }',
      '.sg-bgpick-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; padding: 6px 18px 18px; overflow: auto; max-height: calc(86vh - 120px); }',
      '.sg-bgpick-grid button { all: unset; cursor: pointer; display: grid; gap: 5px; font-size: 12.5px; text-align: center; }',
      '.sg-bgpick-sw { display: block; height: 92px; border-radius: 10px; overflow: hidden; position: relative; border: 2px solid transparent; box-shadow: 0 1px 3px rgba(0,0,0,.18); }',
      '.sg-bgpick-sw > i { position: absolute; left: 0; top: 0; width: 400%; height: 400%; transform: scale(.25); transform-origin: 0 0; }',
      // pet patterns are shown nearer their real size (a few dogs and cats, not a whole wall of them)
      '.sg-bgpick-sw.pet > i { width: 200%; height: 200%; transform: scale(.5); }',
      '.sg-bgpick-grid button:hover .sg-bgpick-sw, .sg-bgpick-grid button:focus-visible .sg-bgpick-sw { border-color: var(--primary,#2563eb); }',
      '.sg-bgpick-grid button.on .sg-bgpick-sw { border-color: #111; }'
    ].join('\n');
    document.head.appendChild(st);
  }
  // [label, [[value, name, css]]] for this menu: the plain choices it has, then the gallery
  function groupsFor(sel) {
    var pre = sel.name === 'block_bg' ? 'g-' : '', out = [];
    var plain = Array.prototype.filter.call(sel.querySelectorAll(':scope > option'), function (o) { return o.value && o.value.indexOf('g-') !== 0; });
    if (plain.length) out.push(['Plain', plain.map(function (o) { return [o.value, o.textContent, PLAIN[o.value] || 'var(--page-bg,#fff)']; })]);
    (data ? data.groups : []).forEach(function (g) { out.push([g[0], g[1].map(function (x) { return [pre + x[0], x[1], x[2]]; })]); });
    return out;
  }
  var PLAIN = { none: 'var(--page-bg, #ffffff)', white: '#ffffff', tint: 'color-mix(in srgb, var(--primary, #2563eb) 10%, #fff)', brand: 'var(--primary, #2563eb)', dark: '#111827' };
  function draw() {
    if (!data) return;
    var gs = groupsFor(target);
    if (!gs.some(function (g) { return g[0] === group; })) group = (gs.find(function (g) { return g[1].some(function (x) { return x[0] === target.value; }); }) || gs[0] || [''])[0];
    tabs.innerHTML = gs.map(function (g) { return '<button type="button" data-grp="' + esc(g[0]) + '" class="' + (g[0] === group ? 'on' : '') + '">' + esc(g[0]) + '</button>'; }).join('');
    var g = gs.find(function (x) { return x[0] === group; }) || ['', []];
    grid.innerHTML = g[1].map(function (x) {
      return '<button type="button" data-val="' + esc(x[0]) + '" class="' + (x[0] === target.value ? 'on' : '') + '" title="' + esc(x[1]) + '"><span class="sg-bgpick-sw' + (/txp-/.test(x[0]) ? ' pet' : '') + '"><i style="background:' + esc(x[2]) + '"></i></span>' + esc(x[1]) + '</button>';
    }).join('');
  }
  function pick(val) {
    if (window.sgLazyFill) window.sgLazyFill(target);
    if (!Array.prototype.some.call(target.options, function (o) { return o.value === val; })) { var o = document.createElement('option'); o.value = val; o.textContent = val; target.appendChild(o); }
    target.value = val;
    target.dispatchEvent(new Event('input', { bubbles: true })); target.dispatchEvent(new Event('change', { bubbles: true }));
    dlg.close();
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.sg-bgpick-btn'); if (!b) return;
    e.preventDefault();
    target = b.previousElementSibling; if (!target || !target.matches(SEL)) return;
    if (!dlg) build();
    group = ''; dlg.showModal();
    if (data) return draw();
    fetch(url, { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) { data = j; draw(); })
      .catch(function () { grid.innerHTML = '<p class="muted">Could not load the previews. Check your connection and try again.</p>'; });
  });
  // A section's Background menu follows what was picked under it, so nobody has to know to set it first: a gallery
  // pick sets it to "Gradient from the gallery" (pet patterns keep the color there and go on top), your own colors
  // set it to "Your color" or "Your gradient".
  function bgMenuFor(el, pre) {
    for (var p = el.parentElement; p; p = p.parentElement) { var b = p.querySelector('select[name="' + pre + 'bg"]'); if (b) return b; }
    return null;
  }
  function setBg(b, v) { if (!b || b.value === v || !Array.prototype.some.call(b.options, function (o) { return o.value === v; })) return; b.value = v; b.dispatchEvent(new Event('change', { bubbles: true })); }
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.matches && t.matches('select.grad-pick')) {
      var b = bgMenuFor(t, t.name.replace(/grad$/, ''));
      if (!b) return;
      if (t.value && !/^txp-/.test(t.value)) setBg(b, 'preset');
      else if (!t.value && b.value === 'preset') setBg(b, '');
    } else if (t.matches && t.matches('input[type=color][name$="bgColor"], input[type=color][name$="bgColor2"]')) {
      var pre = t.name.replace(/bgColor2?$/, ''), bb = bgMenuFor(t, pre);
      if (bb && bb.value !== 'color' && bb.value !== 'gradient') setBg(bb, /2$/.test(t.name) ? 'gradient' : 'color');
    }
  });
  function start() {
    addButtons(document);
    new MutationObserver(function (list) { list.forEach(function (mu) { mu.addedNodes.forEach(function (n) { if (n.nodeType === 1) addButtons(n); }); }); }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
