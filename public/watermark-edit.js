// The editor's Watermark panel (Leo, 2026-11-09): "🐾 Watermark" on the page tools bar, then click any block or card on
// the page. A panel opens with "Add watermark", Leo's four presets and every setting (icon, color, opacity, size, turn,
// 9-point position with X/Y offsets, phone size, hide on phones, slow drift). Changes show on the page at once and save
// with the page (hidden box wmarks_json, see watermark.js, which also draws them on the live site).
// Works on the editor and on the Blocks screen's Edit mode: both give it `preview` (the page frame), scheduleAutosave(),
// onPreviewLoad() and statusEl, and a hidden #wmarksJson box.
(function () {
  'use strict';
  var input = document.getElementById('wmarksJson'), btn = document.getElementById('watermarkBtn'), cfgEl = document.getElementById('sg-wm-cfg');
  if (!input || !btn || !cfgEl) return;
  var CFG = JSON.parse(cfgEl.textContent);
  var list = []; try { list = JSON.parse(input.value) || []; } catch (e) { list = []; }
  var on = false, sel = null, hov = null, slot = 1;
  var ICON = {}; CFG.icons.forEach(function (i) { ICON[i.key] = i; });

  var frame = function () { try { return typeof preview !== 'undefined' ? preview : null; } catch (e) { return null; } };
  var pdoc = function () { var f = frame(); try { var d = f && f.contentDocument; return d && d.body ? d : null; } catch (e) { return null; } };
  var pageOf = function (d) { var h = d.querySelector('[data-sg-txpage]'); return h ? h.dataset.sgTxpage : 'home'; };
  var newId = function () { var s = 'w'; for (var i = 0; i < 7; i++) s += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]; return s; };
  var clamp = function (n, lo, hi) { n = Math.round(Number(n)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo; };
  var say = function (t) { try { if (typeof statusEl !== 'undefined' && statusEl) statusEl.textContent = t; } catch (e) { /* no status line */ } };
  var changed = function () { input.value = JSON.stringify(list); try { scheduleAutosave(); } catch (e) { /* not on this screen */ } };

  // ---- the same picture and CSS the page writes (watermark.js svgOf and css) ----
  function svgOf(t) {
    var ic = t.icon === 'own' ? { vb: t.vb, g: t.svg } : (ICON[t.icon] || ICON.dog);
    return '<svg viewBox="' + ic.vb + '" fill="currentColor" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet"><g>' + ic.g + '</g></svg>';
  }
  function cssOf(t) {
    var h = t.pos.length === 1 ? 'c' : t.pos[1], v = t.pos === 'c' ? 'm' : t.pos[0], out = [];
    if (h === 'l') out.push('left:' + t.dx + 'px'); else if (h === 'r') out.push('right:' + t.dx + 'px'); else out.push('left:calc(50% + ' + t.dx + 'px)');
    if (v === 't') out.push('top:' + t.dy + 'px'); else if (v === 'b') out.push('bottom:' + t.dy + 'px'); else out.push('top:calc(50% + ' + t.dy + 'px)');
    out.push('translate:' + (h === 'c' ? '-50%' : '0') + ' ' + (v === 'm' ? '-50%' : '0'));
    var ms = t.msize || Math.round(t.size * 0.6);
    return out.join(';') + ';--sg-wm-s:' + t.size + 'px;--sg-wm-ms:' + ms + 'px;--sg-wm-r:' + t.turn + 'deg;color:' + t.color + ';opacity:' + (t.op / 100);
  }
  function redraw(d) {
    d = d || pdoc(); if (!d || !d.defaultView || !d.defaultView.sgWm) return;
    var pg = pageOf(d);
    d.defaultView.sgWm.apply(list.filter(function (t) { return t.page === pg; }).map(function (t) {
      return { id: t.id, part: t.part, el: t.el, svg: svgOf(t), css: cssOf(t), mhide: t.mhide, drift: t.drift };
    }));
    mark(d);
  }

  // ---- uploaded SVGs: only plain shapes and their geometry are kept (the server cleans them the same way) ----
  var TAGS = /^(g|path|circle|ellipse|rect|polygon|polyline|line)$/, ATTRS = /^(d|cx|cy|r|rx|ry|x|y|width|height|points|x1|y1|x2|y2|transform|fill-rule|clip-rule)$/;
  function cleanSvg(text) {
    var doc; try { doc = new DOMParser().parseFromString(String(text || ''), 'image/svg+xml'); } catch (e) { return null; }
    var root = doc && doc.documentElement; if (!root || root.nodeName.toLowerCase() !== 'svg') return null;
    var vb = (root.getAttribute('viewBox') || '').trim().replace(/[\s,]+/g, ' ');
    if (!/^-?[\d.]+( -?[\d.]+){3}$/.test(vb)) { var w = parseFloat(root.getAttribute('width')), h = parseFloat(root.getAttribute('height')); vb = w && h ? '0 0 ' + w + ' ' + h : ''; }
    var colors = {};
    function walk(n) {
      var out = '';
      Array.prototype.forEach.call(n.children, function (c) {
        var tag = c.nodeName.toLowerCase();
        if (!TAGS.test(tag)) return;
        var f = c.getAttribute('fill'); if (f && f !== 'none') colors[f.toLowerCase()] = 1;
        var at = '';
        Array.prototype.forEach.call(c.attributes, function (a) {
          var k = a.name.toLowerCase(), v = a.value.trim();
          if (ATTRS.test(k) && v.length <= 8000 && !/url|script|expression|[<>"'`]/i.test(v)) at += ' ' + k + '="' + v + '"';
        });
        if (tag !== 'g' && !at) return;
        out += '<' + tag + at + '>' + (tag === 'g' ? walk(c) : '') + '</' + tag + '>';
      });
      return out;
    }
    var g = walk(root);
    if (!vb || !/<(path|circle|ellipse|rect|polygon|polyline|line)\b/.test(g) || g.length > 20000) return null;
    return { vb: vb, g: g, colors: Object.keys(colors).length };
  }

  // ---- finding the block or card that was clicked ----
  var SKIP_TAG = /^(IMG|VIDEO|CANVAS|IFRAME|PICTURE|SVG|INPUT|TEXTAREA|SELECT|BUTTON|A|BR|HR|SOURCE|SCRIPT|STYLE)$/i;
  function partOf(d, n) {
    var m = d.querySelector('main'), f = d.querySelector('body > footer');
    while (n && n.parentElement) { if (n.parentElement === m || n === f) return n; n = n.parentElement; }
    return null;
  }
  function partKey(d, p) {
    var map = d.defaultView.sgWm.parts(), k; for (k in map) if (map[k] === p) return k;
    return null;
  }
  function paints(el) {
    var cs = el.ownerDocument.defaultView.getComputedStyle(el), m = /rgba?\(([^)]+)\)/.exec(cs.backgroundColor || '');
    var a = m ? (m[1].split(/[,\s/]+/).filter(Boolean)[3]) : '0';
    var solid = m && (a == null || parseFloat(a) > 0.05);
    return !!(solid || /url\(|gradient\(/.test(cs.backgroundImage || ''));
  }
  function boxy(el) {
    var cs = el.ownerDocument.defaultView.getComputedStyle(el);
    return paints(el) || (cs.boxShadow && cs.boxShadow !== 'none') || parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none' && parseFloat(cs.borderLeftWidth) > 0;
  }
  // the box that paints the block's background: down from the part while there is just one child about as big
  function blockHost(p) {
    var cur = p, best = paints(p) ? p : null;
    for (var i = 0; i < 6; i++) {
      var kids = Array.prototype.filter.call(cur.children, function (c) {
        if (/^(SCRIPT|STYLE|TEMPLATE|LINK)$/.test(c.tagName) || c.classList.contains('sg-wm')) return false;
        var cs = c.ownerDocument.defaultView.getComputedStyle(c);
        return cs.display !== 'none' && cs.position !== 'absolute' && cs.position !== 'fixed' && c.offsetHeight > 0;
      });
      if (kids.length !== 1) break;
      var c = kids[0];
      if (c.offsetWidth < cur.offsetWidth * 0.95 || c.offsetHeight < cur.offsetHeight * 0.85 || SKIP_TAG.test(c.tagName)) break;
      cur = c; if (paints(c)) best = c;
    }
    return best || p;
  }
  // the card around the click: the outermost box (with its own fill, shadow or border) inside the block that is
  // clearly smaller than the block
  function cardOf(target, host) {
    var hw = host.offsetWidth, hh = host.offsetHeight, pick = null, n = target;
    while (n && n !== host && host.contains(n)) {
      if (n.nodeType === 1 && !SKIP_TAG.test(n.tagName) && n.hasAttribute('data-sg-ee') && !n.closest('svg')) {
        var w = n.offsetWidth, h = n.offsetHeight;
        if (w >= 120 && h >= 80 && (w < hw * 0.92 || h < hh * 0.9) && boxy(n)) pick = n;
      }
      n = n.parentElement;
    }
    return pick;
  }
  function whereOf(d, target) {
    var p = partOf(d, target); if (!p) return null;
    var key = partKey(d, p); if (!key) return null;
    var host = blockHost(p), card = cardOf(target, host);
    var keyOf = function (el) { return el === p ? '' : (el.getAttribute('data-sg-ee') || null); };
    var blk = { kind: 'block', part: key, el: keyOf(host), node: host };
    if (blk.el === null) { blk.el = ''; blk.node = p; }
    var crd = card && keyOf(card) ? { kind: 'card', part: key, el: keyOf(card), node: card } : null;
    return { block: blk, card: crd, page: pageOf(d) };
  }
  var itemsAt = function (w) { return list.filter(function (t) { return t.page === w.page && t.part === w.part && t.el === w.el; }); };

  // ---- the look of the mode on the page ----
  function css(d) {
    if (d.getElementById('sg-wm-ed')) return;
    var st = d.createElement('style'); st.id = 'sg-wm-ed';
    st.textContent = 'html.sg-wm-mode main *, html.sg-wm-mode body>footer *{cursor:crosshair !important}' +
      'html.sg-wm-mode .sg-wm-hov{outline:2px dashed #db2777 !important;outline-offset:-2px}' +
      'html.sg-wm-mode .sg-wm-cur{outline:3px solid #db2777 !important;outline-offset:-3px}';
    d.head.appendChild(st);
  }
  function mark(d) {
    d = d || pdoc(); if (!d) return;
    Array.prototype.forEach.call(d.querySelectorAll('.sg-wm-cur'), function (n) { n.classList.remove('sg-wm-cur'); });
    if (on && sel && sel.cur) {
      var map = d.defaultView.sgWm && d.defaultView.sgWm.parts(), p = map && map[sel.cur.part];
      var n = p && (sel.cur.el ? p.querySelector('[data-sg-ee="' + sel.cur.el.replace(/["\\]/g, '\\$&') + '"]') : p);
      if (n) { n.classList.add('sg-wm-cur'); sel.cur.node = n; }
    }
  }
  function hover(n) { if (hov) hov.classList.remove('sg-wm-hov'); hov = n; if (hov) hov.classList.add('sg-wm-hov'); }

  // ---- the panel ----
  var panel = document.createElement('aside');
  panel.className = 'sg-wmp'; panel.hidden = true; panel.setAttribute('aria-label', 'Watermark');
  document.body.appendChild(panel);
  var pst = document.createElement('style');
  pst.textContent = '.sg-wmp{position:fixed;z-index:2147483004;left:16px;top:84px;width:340px;max-width:calc(100vw - 32px);max-height:calc(100vh - 100px);overflow:auto;background:#fff;color:#0f172a;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 18px 50px rgba(15,23,42,.22);font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;padding:0 0 14px}' +
    '.sg-wmp[hidden]{display:none !important}.sg-wmp *{box-sizing:border-box}' +
    '.sg-wmp header{position:sticky;top:0;z-index:2;background:#fff;display:flex;align-items:center;gap:8px;padding:12px 14px 10px;border-bottom:1px solid #f1f5f9}' +
    '.sg-wmp header b{flex:1;font-size:15px}.sg-wmp .x{all:unset;cursor:pointer;width:28px;height:28px;display:grid;place-items:center;border-radius:8px;font-size:18px;color:#64748b}.sg-wmp .x:hover{background:#f1f5f9}' +
    '.sg-wmp section{padding:10px 14px 4px}.sg-wmp h4{margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#64748b}' +
    '.sg-wmp .seg{display:flex;gap:4px;background:#f1f5f9;border-radius:10px;padding:3px}.sg-wmp .seg button{all:unset;flex:1;text-align:center;cursor:pointer;padding:6px 8px;border-radius:8px;font-weight:600;font-size:13px;color:#475569}.sg-wmp .seg button[aria-pressed=true]{background:#fff;color:#0f172a;box-shadow:0 1px 3px rgba(0,0,0,.12)}' +
    '.sg-wmp .add{all:unset;display:block;text-align:center;cursor:pointer;background:#b8326a;color:#fff;border-radius:999px;padding:10px 14px;font-weight:700;margin:4px 0 8px}.sg-wmp .add:hover{background:#a8285e}' +
    '.sg-wmp .presets{display:grid;grid-template-columns:1fr 1fr;gap:6px}.sg-wmp .presets button{all:unset;cursor:pointer;display:flex;gap:8px;align-items:center;border:1px solid #e2e8f0;border-radius:10px;padding:7px 8px;font-size:12.5px;line-height:1.25;font-weight:600}.sg-wmp .presets button:hover{border-color:#db2777;background:#fdf2f8}.sg-wmp .presets svg{flex:0 0 26px;width:26px;height:26px;color:#b8326a}' +
    '.sg-wmp .icons{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.sg-wmp .icons button{all:unset;cursor:pointer;display:grid;justify-items:center;gap:2px;border:1px solid #e2e8f0;border-radius:10px;padding:7px 4px 5px;font-size:11px;color:#475569}.sg-wmp .icons button svg{width:30px;height:30px;color:#334155}.sg-wmp .icons button[aria-pressed=true]{border-color:#b8326a;background:#fdf2f8;color:#9d174d}.sg-wmp .icons button:hover{border-color:#db2777}' +
    '.sg-wmp .row{display:grid;grid-template-columns:92px 1fr 54px;align-items:center;gap:8px;margin:6px 0}.sg-wmp .row label{font-weight:600;font-size:13px}.sg-wmp .row input[type=range]{width:100%;accent-color:#b8326a}.sg-wmp .row output{font:600 12px ui-monospace,Consolas,monospace;text-align:right;color:#475569}' +
    '.sg-wmp .hint{margin:0 0 4px;font-size:12px;color:#9d174d;background:#fdf2f8;border-radius:8px;padding:5px 8px}' +
    '.sg-wmp .grid9{display:grid;grid-template-columns:repeat(3,30px);gap:4px;padding:6px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;width:max-content}.sg-wmp .grid9 button{all:unset;cursor:pointer;width:30px;height:24px;border-radius:6px;display:grid;place-items:center}.sg-wmp .grid9 button::after{content:"";width:8px;height:8px;border-radius:50%;background:#cbd5e1}.sg-wmp .grid9 button[aria-pressed=true]::after{background:#b8326a;width:12px;height:12px}.sg-wmp .grid9 button:hover::after{background:#db2777}' +
    '.sg-wmp .posrow{display:flex;gap:12px;align-items:center}.sg-wmp .posrow small{color:#64748b;font-size:12px}' +
    '.sg-wmp .tog{display:flex;align-items:center;gap:8px;margin:6px 0;font-weight:600;font-size:13px;cursor:pointer}.sg-wmp .tog input{width:16px;height:16px;accent-color:#b8326a}' +
    '.sg-wmp .colorrow{display:flex;align-items:center;flex-wrap:wrap;gap:4px}.sg-wmp .colorrow input[type=color]{width:40px;height:30px;padding:2px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer}' +
    '.sg-wmp .foot{display:flex;flex-wrap:wrap;gap:8px;padding:10px 14px 0}.sg-wmp .foot button{all:unset;cursor:pointer;font-weight:600;font-size:13px;padding:7px 10px;border-radius:8px;border:1px solid #e2e8f0}.sg-wmp .foot .del{color:#b91c1c;border-color:#fecaca}.sg-wmp .foot button:hover{background:#f8fafc}' +
    '.sg-wmp .muted{color:#64748b;font-size:12.5px;margin:2px 0 6px}.sg-wmp .err{color:#b91c1c;font-size:12.5px}';
  document.head.appendChild(pst);
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var iconSvg = function (k) { var i = ICON[k]; return '<svg viewBox="' + i.vb + '" fill="currentColor" aria-hidden="true"><g>' + i.g + '</g></svg>'; };

  function current() { if (!sel || !sel.cur) return null; var a = itemsAt(Object.assign({ page: sel.page }, sel.cur)); return a.find(function (t) { return t.slot === slot; }) || a[0] || null; }
  function addAt(presetKey, s) {
    var where = sel.cur, p = CFG.presets.find(function (x) { return x.key === presetKey; });
    var t = p ? { icon: p.icon, size: p.size, color: p.color, op: p.op, turn: p.turn, pos: p.pos, dx: p.dx, dy: p.dy }
      : { icon: 'dog', size: where.kind === 'card' ? 300 : 500, color: CFG.color, op: 6, turn: ICON.dog.turn, pos: 'br', dx: 0, dy: 0 };
    t = Object.assign({ id: newId(), page: sel.page, part: where.part, el: where.el, kind: where.kind, slot: s || 1, msize: 0, mhide: false, drift: false }, t);
    list.push(t); slot = t.slot;
    return t;
  }
  function render() {
    if (!sel) { panel.hidden = true; return; }
    panel.hidden = false;
    var t = current(), all = itemsAt(Object.assign({ page: sel.page }, sel.cur)), h = [];
    h.push('<header><b>🐾 Watermark</b><button type="button" class="x" data-a="close" aria-label="Close">×</button></header>');
    h.push('<section><h4>Put it behind</h4>' + (sel.card
      ? '<div class="seg" role="group"><button type="button" data-a="tgt" data-v="card" aria-pressed="' + (sel.cur.kind === 'card') + '">This card</button><button type="button" data-a="tgt" data-v="block" aria-pressed="' + (sel.cur.kind === 'block') + '">The whole block</button></div>'
      : '<p class="muted">The whole block. (Click a card on the page to put it behind just that card.)</p>') + '</section>');
    if (all.length > 1) h.push('<section><div class="seg" role="group">' + all.map(function (x) { return '<button type="button" data-a="slot" data-v="' + x.slot + '" aria-pressed="' + (x.slot === (t && t.slot)) + '">Watermark ' + x.slot + '</button>'; }).join('') + '</div></section>');
    var presets = '<div class="presets">' + CFG.presets.map(function (p) { return '<button type="button" data-a="preset" data-v="' + p.key + '" title="' + esc(p.icon === 'dog' ? 'Dog' : 'Cat') + ' paw, ' + p.size + 'px, ' + p.op + '% opacity, turned ' + p.turn + '°">' + iconSvg(p.icon) + '<span>' + esc(p.name) + '</span></button>'; }).join('') + '</div>';
    if (!t) {
      h.push('<section><button type="button" class="add" data-a="add">+ Add watermark</button><h4>Or start from a preset</h4>' + presets + '</section>');
      panel.innerHTML = h.join(''); return;
    }
    var hz = t.pos.length === 1 ? 'c' : t.pos[1], vt = t.pos === 'c' ? 'm' : t.pos[0];
    var xLabel = hz === 'l' ? 'From left' : hz === 'r' ? 'From right' : 'Left / right', yLabel = vt === 't' ? 'From top' : vt === 'b' ? 'From bottom' : 'Up / down';
    var range = function (k, label, lo, hi, val, unit) { return '<div class="row"><label for="sg-wm-' + k + '">' + label + '</label><input type="range" id="sg-wm-' + k + '" data-k="' + k + '" min="' + lo + '" max="' + hi + '" value="' + val + '"><output>' + val + unit + '</output></div>'; };
    h.push('<section><h4>Presets</h4>' + presets + '</section>');
    h.push('<section><h4>Icon</h4><div class="icons">' + CFG.icons.map(function (i) { return '<button type="button" data-a="icon" data-v="' + i.key + '" aria-pressed="' + (t.icon === i.key) + '">' + iconSvg(i.key) + esc(i.name) + '</button>'; }).join('') +
      '<button type="button" data-a="upload" aria-pressed="' + (t.icon === 'own') + '">' + (t.icon === 'own' ? '<svg viewBox="' + t.vb + '" fill="currentColor" aria-hidden="true"><g>' + t.svg + '</g></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 16V4m0 0l-5 5m5-5l5 5M4 20h16"/></svg>') + 'Upload SVG</button></div>' +
      '<p class="muted" id="sg-wm-uperr"></p><input type="file" accept=".svg,image/svg+xml" id="sg-wm-file" hidden></section>');
    h.push('<section><h4>Color</h4><div class="colorrow"><input type="color" id="sg-wm-color" value="' + t.color + '" aria-label="Watermark color"></div></section>');
    h.push('<section><h4>Look</h4><p class="hint">Watermarks look best at 4–10%.</p>' + range('op', 'Opacity', 0, 30, t.op, '%') + range('size', 'Size', 80, 700, t.size, 'px') + range('turn', 'Rotation', -45, 45, t.turn, '°') + '</section>');
    h.push('<section><h4>Position</h4><div class="posrow"><div class="grid9" role="group" aria-label="Position">' + CFG.pos.map(function (p) { return '<button type="button" data-a="pos" data-v="' + p.key + '" aria-pressed="' + (t.pos === p.key) + '" title="' + esc(p.name) + '" aria-label="' + esc(p.name) + '"></button>'; }).join('') + '</div><small>' + esc((CFG.pos.find(function (p) { return p.key === t.pos; }) || {}).name || '') + '.<br>Below zero runs it off the edge (the edge crops it).</small></div>' +
      range('dx', xLabel, -600, 600, t.dx, 'px') + range('dy', yLabel, -600, 600, t.dy, 'px') + '</section>');
    var ms = t.msize || Math.round(t.size * 0.6);
    h.push('<section><h4>On phones</h4><label class="tog"><input type="checkbox" data-k="mhide"' + (t.mhide ? ' checked' : '') + '> Hide on mobile</label>' +
      '<label class="tog"><input type="checkbox" data-k="mauto"' + (t.msize ? '' : ' checked') + '> Size: 60% of the desktop size</label>' + (t.msize ? range('msize', 'Phone size', 40, 700, ms, 'px') : '') + '</section>');
    h.push('<section><h4>Motion</h4><label class="tog"><input type="checkbox" data-k="drift"' + (t.drift ? ' checked' : '') + '> Slow drift (a gentle sway; off for visitors who turn motion off)</label></section>');
    h.push('<div class="foot">' + (all.length < 2 ? '<button type="button" data-a="second">+ Add a second watermark</button>' : '') + '<button type="button" class="del" data-a="remove">Remove watermark</button></div>');
    panel.innerHTML = h.join('');
  }
  function update(t, k, v) {
    var L = CFG.limits;
    if (k === 'op' || k === 'size' || k === 'turn' || k === 'dx' || k === 'dy' || k === 'msize') t[k] = clamp(v, L[k][0], L[k][1]);
    else t[k] = v;
    redraw(); changed();
  }
  panel.addEventListener('input', function (e) {
    var t = current(), k = e.target.getAttribute('data-k'); if (!t) return;
    if (e.target.id === 'sg-wm-color') { if (/^#[0-9a-f]{6}$/i.test(e.target.value)) update(t, 'color', e.target.value.toLowerCase()); return; }
    if (e.target.type === 'range' && k) {
      update(t, k, e.target.value);
      var o = e.target.nextElementSibling; if (o) o.textContent = t[k] + (k === 'op' ? '%' : k === 'turn' ? '°' : 'px');
      if (k === 'size' && !t.msize) { /* the phone size follows */ }
    }
  });
  panel.addEventListener('change', function (e) {
    var t = current(), k = e.target.getAttribute('data-k');
    if (e.target.id === 'sg-wm-file') { readSvg(e.target.files && e.target.files[0]); return; }
    if (!t || e.target.type !== 'checkbox') return;
    if (k === 'mhide' || k === 'drift') update(t, k, e.target.checked);
    else if (k === 'mauto') { update(t, 'msize', e.target.checked ? 0 : Math.round(t.size * 0.6)); if (e.target.checked) t.msize = 0; render(); }
  });
  panel.addEventListener('click', function (e) {
    var b = e.target.closest('[data-a]'); if (!b) return;
    var a = b.getAttribute('data-a'), v = b.getAttribute('data-v'), t = current();
    if (a === 'close') return setOn(false);
    if (a === 'tgt') { sel.cur = v === 'card' ? sel.card : sel.block; slot = 1; mark(); render(); return; }
    if (a === 'slot') { slot = +v; render(); return; }
    if (a === 'add') { addAt(null, 1); redraw(); changed(); render(); return; }
    if (a === 'preset') {
      if (!t) addAt(v, 1);
      else { var p = CFG.presets.find(function (x) { return x.key === v; }); ['icon', 'size', 'color', 'op', 'turn', 'pos', 'dx', 'dy'].forEach(function (k) { t[k] = p[k]; }); delete t.svg; delete t.vb; t.msize = 0; }
      redraw(); changed(); render(); return;
    }
    if (!t) return;
    if (a === 'icon') { t.icon = v; delete t.svg; delete t.vb; if (ICON[v]) t.turn = ICON[v].turn; redraw(); changed(); render(); }
    else if (a === 'upload') { var f = panel.querySelector('#sg-wm-file'); if (f) f.click(); }
    else if (a === 'pos') { t.pos = v; redraw(); changed(); render(); }
    else if (a === 'second') { var s = addAt(null, 2); s.icon = t.icon === 'dog' ? 'cat' : 'dog'; s.turn = ICON[s.icon].turn; s.pos = t.pos === 'tl' ? 'br' : 'tl'; redraw(); changed(); render(); }
    else if (a === 'remove') { list = list.filter(function (x) { return x !== t; }); slot = 1; redraw(); changed(); render(); }
  });
  function readSvg(file) {
    var errEl = panel.querySelector('#sg-wm-uperr'), t = current();
    if (!file || !t) return;
    if (file.size > 300000) { if (errEl) errEl.textContent = 'That file is too big for a watermark (keep it under 300 KB).'; return; }
    file.text().then(function (txt) {
      var c = cleanSvg(txt);
      if (!c) { if (errEl) { errEl.className = 'err'; errEl.textContent = 'That SVG has no shapes we can use. Pick a simple one-color icon.'; } return; }
      t.icon = 'own'; t.svg = c.g; t.vb = c.vb;
      redraw(); changed(); render();
      var m = panel.querySelector('#sg-wm-uperr');
      if (m && c.colors > 1) m.textContent = 'Your SVG had ' + c.colors + ' colors; the watermark uses one color for all of it.';
    });
  }

  // ---- the mode itself ----
  function onDoc(d) {
    if (!d || d.__sgWmHooked) return; d.__sgWmHooked = true;
    var w = d.defaultView;
    css(d);
    // window capture runs before the editor's own click-to-edit (a capture listener on the document)
    w.addEventListener('click', function (e) {
      if (!on) return;
      var H = d.documentElement.classList;
      if (H.contains('sg-es-mode') || H.contains('sg-ts-mode')) { setOn(false); return; }
      e.preventDefault(); e.stopPropagation();
      var where = whereOf(d, e.target);
      if (!where) { say('Watermark: click inside a block on the page.'); return; }
      sel = { page: where.page, block: where.block, card: where.card, cur: where.card || where.block };
      var has = itemsAt(Object.assign({ page: sel.page }, where.block)).length, hasCard = where.card && itemsAt(Object.assign({ page: sel.page }, where.card)).length;
      if (where.card && !hasCard && has) sel.cur = where.block;   // the block already has one: show that
      slot = 1; mark(d); render();
    }, true);
    w.addEventListener('mousemove', function (e) {
      if (!on) return;
      var wh = whereOf(d, e.target); hover(wh ? (wh.card || wh.block).node : null);
    }, true);
    redraw(d);
  }
  function setOn(v) {
    if (v) { try { if (window.sgEsOff) window.sgEsOff(); if (window.sgTsBox && window.sgTsBox.off) window.sgTsBox.off(); } catch (e) { /* not here */ } }
    on = v; btn.setAttribute('aria-pressed', String(v)); btn.classList.toggle('on', v);
    var d = pdoc(); if (d) { onDoc(d); d.documentElement.classList.toggle('sg-wm-mode', v); }
    if (!v) { hover(null); sel = null; render(); if (d) mark(d); }
    try { inlineEditing = v; } catch (e) { /* not here */ }
    say(v ? 'Watermark: click a block or a card on the page, then "Add watermark". (Esc or the button again to stop)' : '');
    if (!v) { try { if (pvStale) { pvStale = false; flushSave().then(function () { freshPreview(); }); } } catch (e) { /* not here */ } }
  }
  btn.addEventListener('click', function () { setOn(!on); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && on) setOn(false); });
  window.sgWmOff = function () { if (on) setOn(false); };
  try {
    onPreviewLoad(function () { var d = pdoc(); if (!d) return; onDoc(d); d.documentElement.classList.toggle('sg-wm-mode', on); redraw(d); });
  } catch (e) { /* no frame hooks here */ }
  var d0 = pdoc(); if (d0) onDoc(d0);
  window.sgWmEdit = { list: function () { return list; }, cleanSvg: cleanSvg, whereOf: whereOf, cssOf: cssOf };
})();
