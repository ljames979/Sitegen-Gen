// Photo editor (Leo, 2026-11-09), part 1: Smart Select.
// SGPhotoEdit.open({ siteId, src }) opens a full-screen editor over the page for one photo:
//   Select  click anything (the dog, the towel, the brush, a bubble, the foam) and it is outlined. Shift+click adds
//           another thing, Alt/Option+click takes one away
//   Brush   paint to add to the selection, or (Remove) to take away. [ and ] change its size
//   Lasso   draw round an area to add it (or take it away)
//   Select subject (the main pet) / Select background (everything else), Invert, Select all, Clear
//   Edge softness: how soft the selection's edge is
// The selection shows as a tint with marching ants. Undo/redo: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z (or Ctrl+Y).
// The heavy work happens off the page: the outline model runs in SiteGen on this computer (photoedit.js) and the
// mask work in a Web Worker (photoedit-worker.js), so the editor never freezes. The photo itself is never changed.
(function () {
  'use strict';
  if (window.SGPhotoEdit) return;

  const CSS = `
.sgpe{position:fixed;inset:0;z-index:2147483000;display:grid;grid-template-rows:auto 1fr;grid-template-columns:56px 1fr 280px;background:#0b1220;color:#e2e8f0;font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif}
.sgpe [hidden]{display:none!important}
.sgpe button{font:inherit;color:inherit;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:7px 11px;cursor:pointer;line-height:1.1}
.sgpe button:hover{background:#273449}.sgpe button:focus-visible{outline:2px solid #60a5fa;outline-offset:1px}
.sgpe button[aria-pressed=true]{background:#2563eb;border-color:#3b82f6;color:#fff}
.sgpe button:disabled{opacity:.45;cursor:default}
.sgpe-top{grid-column:1/-1;display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid #1e293b;background:#0f172a}
.sgpe-top h2{font-size:15px;margin:0 12px 0 4px;font-weight:650}
.sgpe-top .sp{flex:1}
.sgpe-msg{color:#94a3b8;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:46vw}
.sgpe-msg.err{color:#fca5a5}
.sgpe-rail{display:flex;flex-direction:column;gap:6px;padding:10px 7px;border-right:1px solid #1e293b;background:#0f172a}
.sgpe-rail button{width:42px;height:42px;padding:0;font-size:18px;display:grid;place-items:center}
.sgpe-view{position:relative;overflow:hidden;background:#111827;touch-action:none}
.sgpe-stage{position:absolute;left:0;top:0;transform-origin:0 0;box-shadow:0 10px 40px rgba(0,0,0,.5)}
.sgpe-stage canvas{position:absolute;left:0;top:0;width:100%;height:100%;display:block}
.sgpe-stage canvas.sgpe-photo{background:repeating-conic-gradient(#cbd5e1 0 25%,#f8fafc 0 50%) 0 0/20px 20px}
.sgpe-view.t-select{cursor:crosshair}.sgpe-view.t-brush,.sgpe-view.t-lasso{cursor:crosshair}.sgpe-view.pan{cursor:grab}
.sgpe-busy{position:absolute;inset:0;display:grid;place-items:center;background:rgba(11,18,32,.55);font-weight:600;text-align:center;padding:20px}
.sgpe-busy .bar{width:240px;height:6px;border-radius:9px;background:#1e293b;margin:10px auto 0;overflow:hidden}
.sgpe-busy .bar i{display:block;height:100%;width:0;background:#3b82f6;transition:width .3s}
.sgpe-side{border-left:1px solid #1e293b;background:#0f172a;overflow:auto;padding:12px}
.sgpe-side h3{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8;margin:14px 0 8px}
.sgpe-side h3:first-child{margin-top:2px}
.sgpe-side .row{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
.sgpe-side label{display:block;margin:8px 0 4px;color:#cbd5e1;font-size:13px}
.sgpe-side input[type=range]{width:100%}
.sgpe-side .val{float:right;color:#94a3b8}
.sgpe-side .hint{color:#94a3b8;font-size:12.5px;margin:6px 0}
.sgpe-side kbd{font:11px ui-monospace,monospace;background:#1e293b;border:1px solid #334155;border-radius:4px;padding:0 4px}
.sgpe-float{position:absolute;z-index:3;display:flex;gap:4px;align-items:center;padding:5px;background:#0f172a;border:1px solid #334155;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.45);font-size:12.5px;white-space:nowrap}
.sgpe-float span{color:#94a3b8;padding:0 6px}
.sgpe-float button{padding:5px 9px}
@media (max-width:820px){.sgpe{grid-template-columns:52px 1fr;grid-template-rows:auto 1fr auto}.sgpe-top{flex-wrap:wrap;gap:6px}.sgpe-top h2,.sgpe-top [data-a=fit],.sgpe-top [data-a=zin],.sgpe-top [data-a=zout]{display:none}.sgpe-top .sgpe-msg{order:9;flex-basis:100%;max-width:none}.sgpe-side{grid-column:1/-1;max-height:38vh;border-left:0;border-top:1px solid #1e293b}.sgpe-msg{max-width:30vw}}
`;

  const $ = (root, s) => root.querySelector(s);
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || '');

  function open(opts) {
    if (document.querySelector('.sgpe')) return null;
    const siteId = opts.siteId, src = String(opts.src || '').trim();
    if (!siteId || !src) throw new Error('No photo to edit');
    const api = (p) => '/sites/' + siteId + '/photo-edit/' + p;
    if (!document.getElementById('sgpe-css')) { const st = document.createElement('style'); st.id = 'sgpe-css'; st.textContent = CSS; document.head.appendChild(st); }

    const root = document.createElement('div');
    root.className = 'sgpe'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Edit photo'); root.tabIndex = -1;
    root.innerHTML = `
<div class="sgpe-top">
  <h2>Edit photo</h2>
  <button type="button" data-a="undo" title="Undo (${isMac ? '⌘' : 'Ctrl'}+Z)" disabled>↶ Undo</button>
  <button type="button" data-a="redo" title="Redo (${isMac ? '⌘' : 'Ctrl'}+Shift+Z)" disabled>↷ Redo</button>
  <button type="button" data-a="zout" title="Zoom out">−</button><button type="button" data-a="fit" title="Fit the photo on screen">Fit</button><button type="button" data-a="zin" title="Zoom in">+</button>
  <span class="sgpe-msg" role="status" aria-live="polite"></span>
  <span class="sp"></span>
  <button type="button" data-a="close">Close</button>
</div>
<div class="sgpe-rail" role="toolbar" aria-label="Tools" aria-orientation="vertical">
  <button type="button" data-tool="select" aria-pressed="true" title="Select: click anything in the photo (S)">⌖</button>
  <button type="button" data-tool="brush" aria-pressed="false" title="Brush: paint the selection (B)">🖌</button>
  <button type="button" data-tool="lasso" aria-pressed="false" title="Lasso: draw round an area (L)">➰</button>
</div>
<div class="sgpe-view t-select">
  <div class="sgpe-stage"><canvas class="sgpe-photo"></canvas><canvas class="sgpe-ov"></canvas><canvas class="sgpe-ui"></canvas></div>
  <div class="sgpe-float" hidden><span class="sgpe-fl-info"></span><button type="button" data-a="invert" title="Select everything else">Invert</button><button type="button" data-a="clear" title="Clear the selection (Esc)">Clear</button></div>
  <div class="sgpe-busy"><div><div class="sgpe-busy-t">Opening the photo…</div><div class="bar"><i></i></div></div></div>
</div>
<div class="sgpe-side">
  <h3>Select</h3>
  <div class="row"><button type="button" data-a="subject" title="Select the main subject (the pet)">Select subject</button><button type="button" data-a="background" title="Select everything except the main subject">Select background</button></div>
  <div class="row"><button type="button" data-a="invert">Invert</button><button type="button" data-a="all">Select all</button><button type="button" data-a="clear">Clear</button></div>
  <p class="hint sgpe-tip"></p>
  <div class="row" role="group" aria-label="What a click, stroke or lasso does"><button type="button" data-mode="set" aria-pressed="true" title="A click starts a new selection">New</button><button type="button" data-mode="add" aria-pressed="false" title="Add to the selection (or hold Shift)">＋ Add</button><button type="button" data-mode="sub" aria-pressed="false" title="Take away from the selection (or hold ${isMac ? 'Option' : 'Alt'})">− Remove</button></div>
  <div class="sgpe-brush" hidden>
    <label class="sgpe-size-l">Brush size <span class="val sgpe-size-v"></span><input type="range" class="sgpe-size" min="2" max="200" value="40" aria-label="Brush size"></label>
  </div>
  <label>Edge softness <span class="val sgpe-soft-v">0 px</span><input type="range" class="sgpe-soft" min="0" max="40" value="0" aria-label="Edge softness"></label>
  <p class="hint">The softness blends the selection's edge, so changes made to it (coming next) fade into the photo instead of ending in a hard line.</p>
  <h3>Keys</h3>
  <p class="hint"><kbd>S</kbd> select · <kbd>B</kbd> brush · <kbd>L</kbd> lasso · <kbd>[</kbd> <kbd>]</kbd> brush size · <kbd>Esc</kbd> clear · hold <kbd>Space</kbd> and drag to move around · scroll to zoom</p>
</div>`;
    document.body.appendChild(root);
    const prevFocus = document.activeElement;
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';

    const view = $(root, '.sgpe-view'), stage = $(root, '.sgpe-stage');
    const cPhoto = $(root, '.sgpe-photo'), cOv = $(root, '.sgpe-ov'), cUi = $(root, '.sgpe-ui');
    const msgEl = $(root, '.sgpe-msg'), busyEl = $(root, '.sgpe-busy'), busyT = $(root, '.sgpe-busy-t'), busyBar = $(root, '.sgpe-busy .bar i');
    const floatEl = $(root, '.sgpe-float'), floatInfo = $(root, '.sgpe-fl-info');
    const softIn = $(root, '.sgpe-soft'), softV = $(root, '.sgpe-soft-v'), sizeIn = $(root, '.sgpe-size'), sizeV = $(root, '.sgpe-size-v');
    const say = (t, err) => { msgEl.textContent = t || ''; msgEl.classList.toggle('err', !!err); };

    const S = {
      key: '', w: 0, h: 0, img: null,
      tool: 'select', mode: 'set', brush: 40, soft: 0,
      sel: null, shown: null, edges: null, area: 0, box: null,
      zoom: 1, tx: 0, ty: 0, space: false,
      busy: 0, closed: false,
    };
    const hist = { list: [], at: -1 };

    // ---- the worker ----
    const worker = new Worker('/photoedit-worker.js');
    let seq = 0; const waiting = new Map();
    worker.onmessage = (e) => { const r = e.data, p = waiting.get(r.id); if (!p) return; waiting.delete(r.id); r.ok ? p.res(r) : p.rej(new Error(r.error)); };
    worker.onerror = () => { waiting.forEach(p => p.rej(new Error('The selection helper stopped. Close and open the editor again.'))); waiting.clear(); };
    function work(cmd, extra, keepSel) {
      const id = ++seq;
      const msg = { id, cmd, w: S.w, h: S.h, t: antWidth(), soft: S.soft, sel: S.sel ? S.sel.slice().buffer : null, ...extra };
      const transfer = [msg.sel].concat(extra && extra.part ? [extra.part] : []).filter(Boolean);
      return new Promise((res, rej) => { waiting.set(id, { res, rej }); worker.postMessage(msg, transfer); });
    }
    async function busy(label, fn) {
      S.busy++; root.setAttribute('aria-busy', 'true'); say(label);
      try { return await fn(); }
      catch (err) { say(err.message || 'Something went wrong', true); return null; }
      finally { if (--S.busy <= 0) { S.busy = 0; root.removeAttribute('aria-busy'); } }
    }

    // ---- view: fit, zoom, pan ----
    function place() { stage.style.transform = `translate(${S.tx}px,${S.ty}px) scale(${S.zoom})`; placeFloat(); }
    function fit() {
      if (!S.w) return;
      const r = view.getBoundingClientRect(), pad = 28;
      S.zoom = Math.min((r.width - pad * 2) / S.w, (r.height - pad * 2) / S.h, 4);
      S.tx = (r.width - S.w * S.zoom) / 2; S.ty = (r.height - S.h * S.zoom) / 2; place();
      if (S.sel) restyle();   // the ants' width depends on the zoom
    }
    function zoomAt(f, cx, cy) {
      const r = view.getBoundingClientRect(); cx = cx == null ? r.width / 2 : cx; cy = cy == null ? r.height / 2 : cy;
      const z = Math.max(0.05, Math.min(16, S.zoom * f)); f = z / S.zoom;
      S.tx = cx - (cx - S.tx) * f; S.ty = cy - (cy - S.ty) * f; S.zoom = z; place();
      clearTimeout(zoomAt.t); zoomAt.t = setTimeout(() => { if (S.sel) restyle(); }, 180);
    }
    // a pointer's spot in the photo's own pixels
    function toImg(e) { const r = cPhoto.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * S.w, y: (e.clientY - r.top) / r.height * S.h }; }
    const antWidth = () => Math.max(1, Math.round(1.6 / (S.zoom || 1)));

    // ---- drawing the selection: a tint over it, and marching ants on its edge ----
    let ovData = null, antPhase = 0, antTimer = 0;
    function drawSel() {
      const x = cOv.getContext('2d');
      x.clearRect(0, 0, S.w, S.h);
      ovData = null;
      if (!S.sel || !S.area) { floatEl.hidden = true; stopAnts(); return; }
      ovData = x.createImageData(S.w, S.h);
      const d = ovData.data, m = S.shown || S.sel;
      for (let i = 0, j = 0; i < m.length; i++, j += 4) if (m[i]) { d[j] = 37; d[j + 1] = 99; d[j + 2] = 235; d[j + 3] = Math.round(m[i] * 0.34); }
      tintCopy = new Uint8ClampedArray(d);
      startAnts();
      floatInfo.textContent = 'Selected ' + (S.area < 0.001 ? '<0.1' : (S.area * 100).toFixed(S.area < 0.1 ? 1 : 0)) + '% of the photo';
      floatEl.hidden = false; placeFloat();
    }
    let tintCopy = null;
    function ants() {
      if (!ovData || !S.edges) return;
      const d = ovData.data, e = S.edges, w = S.w;
      antPhase = (antPhase + 1) % 8;
      for (let k = 0; k < e.length; k++) {
        const i = e[k], x = i % w, y = (i - x) / w, j = i * 4;
        const on = ((x + y + antPhase) >> 2) & 1;
        d[j] = d[j + 1] = d[j + 2] = on ? 255 : 0; d[j + 3] = 255;
      }
      cOv.getContext('2d').putImageData(ovData, 0, 0);
    }
    function startAnts() { stopAnts(); ants(); antTimer = setInterval(ants, matchMedia('(prefers-reduced-motion: reduce)').matches ? 100000 : 140); }
    function stopAnts() { clearInterval(antTimer); antTimer = 0; }
    function placeFloat() {
      if (floatEl.hidden || !S.box) return;
      const vr = view.getBoundingClientRect(), fw = floatEl.offsetWidth, fh = floatEl.offsetHeight;
      let left = S.tx + ((S.box.x0 + S.box.x1) / 2) * S.zoom - fw / 2;
      let top = S.ty + S.box.y1 * S.zoom + 12;
      if (top + fh > vr.height - 8) top = S.ty + S.box.y0 * S.zoom - fh - 12;
      left = Math.max(8, Math.min(vr.width - fw - 8, left)); top = Math.max(8, Math.min(vr.height - fh - 8, top));
      floatEl.style.left = left + 'px'; floatEl.style.top = top + 'px';
    }

    function take(r, record) {
      S.sel = r.sel ? new Uint8Array(r.sel) : null;
      S.shown = r.shown ? new Uint8Array(r.shown) : S.sel;
      S.edges = r.edges ? new Int32Array(r.edges) : null;
      S.area = r.area || 0; S.box = r.box || null;
      if (S.sel && !S.area) { S.sel = null; S.shown = null; }
      drawSel();
      if (record !== false) remember();
    }
    // re-draw the same selection (new softness or zoom), without an undo step
    async function restyle() { if (!S.sel) return drawSel(); const r = await work('restyle', {}).catch(() => null); if (r) take(r, false); }

    // ---- undo / redo: each step keeps the selection and its softness ----
    function remember() {
      hist.list = hist.list.slice(0, hist.at + 1);
      hist.list.push({ sel: S.sel ? S.sel.slice() : null, soft: S.soft });
      if (hist.list.length > 25) hist.list.shift();
      hist.at = hist.list.length - 1; histButtons();
    }
    function histButtons() { $(root, '[data-a=undo]').disabled = hist.at <= 0; $(root, '[data-a=redo]').disabled = hist.at >= hist.list.length - 1; }
    async function stepTo(i) {
      if (i < 0 || i >= hist.list.length) return;
      const from = hist.at; hist.at = i; const h = hist.list[i]; histButtons();
      S.soft = h.soft; softIn.value = h.soft; softV.textContent = h.soft + ' px';
      S.sel = h.sel ? h.sel.slice() : null;
      const word = i < from ? 'Undone' : 'Redone';
      if (!S.sel) { take({ sel: null }, false); return say(word); }
      const r = await work('restyle', {}).catch(() => null); if (r) { take(r, false); say(word); }
    }

    // ---- selecting ----
    const opFrom = (e, plain) => (e.shiftKey ? 'add' : (e.altKey ? 'sub' : plain));
    async function clickSelect(p, op) {
      if (!S.key) return;
      if (op !== 'set' && !S.sel) op = op === 'sub' ? null : 'set';
      if (!op) return say('Nothing is selected to take away from');
      const r = await busy(op === 'add' ? 'Adding…' : (op === 'sub' ? 'Taking away…' : 'Selecting…'), () =>
        work('part', { url: api('mask'), body: { key: S.key, points: [{ x: p.x, y: p.y, on: true }] }, op }));
      if (!r) return;
      take(r);
      say(S.sel ? (op === 'set' ? 'Selected. Shift+click adds more, ' + (isMac ? 'Option' : 'Alt') + '+click takes a part away' : (op === 'add' ? 'Added' : 'Taken away')) : 'Nothing is selected');
    }
    async function subject(invert) {
      if (!S.key) return;
      const r = await busy(invert ? 'Finding the background…' : 'Finding the main subject… (the first time takes a minute)', () =>
        work('part', { url: api('subject'), body: { key: S.key }, op: 'set', invert: !!invert }));
      if (r) { take(r); say(S.sel ? (invert ? 'Background selected' : 'Subject selected') : 'Could not find a subject in this photo', !S.sel); }
    }
    async function simple(cmd, label) { const r = await busy(label, () => work(cmd, {})); if (r) { take(r); say(S.sel ? label.replace('…', '') + ': done' : 'Nothing is selected'); } }
    function clearSel() { if (!S.sel) return; take({ sel: null }); say('Selection cleared'); }

    // brush strokes and lasso shapes are drawn on a scratch canvas the size of the photo, then joined to the selection
    const scratch = document.createElement('canvas');
    let stroke = null;
    function uiCtx() { return cUi.getContext('2d'); }
    function brushDot(x, p, r) { x.beginPath(); x.arc(p.x, p.y, r, 0, Math.PI * 2); x.fill(); }
    function strokeStart(e, p) {
      const op = e.shiftKey ? 'add' : (e.altKey ? 'sub' : (S.mode === 'sub' ? 'sub' : 'add'));
      scratch.width = S.w; scratch.height = S.h;
      const sx = scratch.getContext('2d'); sx.fillStyle = '#fff'; sx.strokeStyle = '#fff'; sx.lineCap = 'round'; sx.lineJoin = 'round';
      stroke = { op, pts: [p], sx };
      const u = uiCtx(); u.clearRect(0, 0, S.w, S.h);
      u.fillStyle = op === 'sub' ? 'rgba(239,68,68,.45)' : 'rgba(37,99,235,.45)'; u.strokeStyle = u.fillStyle;
      u.lineCap = 'round'; u.lineJoin = 'round';
      if (S.tool === 'brush') { const r = S.brush / 2; brushDot(sx, p, r); brushDot(u, p, r); }
    }
    function strokeMove(p) {
      const last = stroke.pts[stroke.pts.length - 1]; stroke.pts.push(p);
      const u = uiCtx();
      if (S.tool === 'brush') {
        [stroke.sx, u].forEach(x => { x.lineWidth = S.brush; x.beginPath(); x.moveTo(last.x, last.y); x.lineTo(p.x, p.y); x.stroke(); });
      } else {
        u.clearRect(0, 0, S.w, S.h); u.lineWidth = Math.max(1.5, 2 / S.zoom); u.setLineDash([6 / S.zoom, 4 / S.zoom]); u.strokeStyle = '#fff';
        u.beginPath(); stroke.pts.forEach((q, i) => (i ? u.lineTo(q.x, q.y) : u.moveTo(q.x, q.y))); u.stroke(); u.setLineDash([]);
      }
    }
    async function strokeEnd() {
      const s = stroke; stroke = null; uiCtx().clearRect(0, 0, S.w, S.h);
      if (!s) return;
      if (S.tool === 'lasso') {
        if (s.pts.length < 3) return;
        s.sx.beginPath(); s.pts.forEach((q, i) => (i ? s.sx.lineTo(q.x, q.y) : s.sx.moveTo(q.x, q.y))); s.sx.closePath(); s.sx.fill();
      }
      const d = s.sx.getImageData(0, 0, S.w, S.h).data, part = new Uint8Array(S.w * S.h);
      for (let i = 0; i < part.length; i++) part[i] = d[i * 4 + 3];
      if (s.op === 'sub' && !S.sel) return say('Nothing is selected to take away from');
      const r = await busy(s.op === 'sub' ? 'Taking away…' : 'Adding…', () => work('paint', { part: part.buffer, op: s.op }));
      if (r) { take(r); say(s.op === 'sub' ? 'Taken away' : 'Added'); }
    }
    function brushCursor(p) {
      if (S.tool !== 'brush' || stroke) return;
      const u = uiCtx(); u.clearRect(0, 0, S.w, S.h);
      if (!p) return;
      u.lineWidth = Math.max(1, 1.5 / S.zoom); u.strokeStyle = '#fff'; u.beginPath(); u.arc(p.x, p.y, S.brush / 2, 0, Math.PI * 2); u.stroke();
      u.strokeStyle = '#000'; u.setLineDash([3 / S.zoom, 3 / S.zoom]); u.stroke(); u.setLineDash([]);
    }

    // ---- pointer ----
    let pan = null;
    view.addEventListener('pointerdown', (e) => {
      if (!S.w || S.busy && S.tool === 'select') return;
      if (e.button === 1 || S.space || e.button === 0 && e.ctrlKey && false) { pan = { x: e.clientX, y: e.clientY, tx: S.tx, ty: S.ty }; view.setPointerCapture(e.pointerId); return; }
      if (e.button !== 0 || e.target.closest('.sgpe-float')) return;
      e.preventDefault();
      const p = toImg(e);
      if (S.tool === 'select') { if (p.x >= 0 && p.y >= 0 && p.x < S.w && p.y < S.h) clickSelect(p, opFrom(e, S.mode)); return; }
      view.setPointerCapture(e.pointerId); strokeStart(e, p);
    });
    view.addEventListener('pointermove', (e) => {
      if (pan) { S.tx = pan.tx + e.clientX - pan.x; S.ty = pan.ty + e.clientY - pan.y; return place(); }
      if (!S.w) return;
      const p = toImg(e);
      if (stroke) strokeMove(p); else brushCursor(p);
    });
    const up = () => { if (pan) { pan = null; return; } if (stroke) strokeEnd(); };
    view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up);
    view.addEventListener('pointerleave', () => brushCursor(null));
    view.addEventListener('wheel', (e) => { e.preventDefault(); const r = view.getBoundingClientRect(); zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); }, { passive: false });

    // ---- buttons ----
    function setTool(t) {
      S.tool = t; view.className = 'sgpe-view t-' + t;
      root.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
      $(root, '.sgpe-brush').hidden = t === 'select';
      $(root, '.sgpe-size-l').hidden = t !== 'brush';
      $(root, '.sgpe-tip').textContent = t === 'select'
        ? 'Click anything in the photo to select it. Shift+click adds another thing, ' + (isMac ? 'Option' : 'Alt') + '+click takes a part away.'
        : (t === 'brush' ? 'Paint over the photo to add to the selection, or switch to Remove. Shift adds, ' + (isMac ? 'Option' : 'Alt') + ' removes while you hold it.'
          : 'Draw round an area. When you let go it is added to the selection (or taken away with Remove).');
      brushCursor(null);
    }
    function setMode(m) { S.mode = m; root.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m))); }
    function setBrush(v) { S.brush = Math.max(2, Math.min(200, Math.round(v))); sizeIn.value = S.brush; sizeV.textContent = S.brush + ' px'; }
    root.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.tool) return setTool(b.dataset.tool);
      if (b.dataset.mode) return setMode(b.dataset.mode);
      const a = b.dataset.a;
      if (a === 'close') return close();
      if (a === 'undo') return stepTo(hist.at - 1);
      if (a === 'redo') return stepTo(hist.at + 1);
      if (a === 'fit') return fit();
      if (a === 'zin') return zoomAt(1.25);
      if (a === 'zout') return zoomAt(0.8);
      if (!S.key) return;
      if (a === 'subject') return subject(false);
      if (a === 'background') return subject(true);
      if (a === 'invert') return simple('invert', 'Inverted…');
      if (a === 'all') return simple('all', 'Selected all…');
      if (a === 'clear') return clearSel();
    });
    softIn.addEventListener('input', () => { S.soft = +softIn.value; softV.textContent = S.soft + ' px'; clearTimeout(softIn.t); softIn.t = setTimeout(restyle, 120); });
    softIn.addEventListener('change', () => { if (hist.list[hist.at] && hist.list[hist.at].soft !== S.soft) remember(); });
    sizeIn.addEventListener('input', () => setBrush(+sizeIn.value));
    setBrush(40); setTool('select');

    // ---- keys ----
    // keys go to the editor only, while it is open (the page under it has its own Ctrl+Z, Esc ...)
    function onKey(e) {
      if (S.closed) return;
      e.stopPropagation();
      const mod = e.ctrlKey || e.metaKey, k = (e.key || '').toLowerCase();
      if (e.target && /^(input|textarea|select)$/i.test(e.target.tagName) && e.target.type !== 'range') return;
      if (mod && k === 'z') { e.preventDefault(); return stepTo(hist.at + (e.shiftKey ? 1 : -1)); }
      if (mod && k === 'y') { e.preventDefault(); return stepTo(hist.at + 1); }
      if (mod && k === 'a') { e.preventDefault(); return S.key && simple('all', 'Selected all…'); }
      if (mod && k === 'd') { e.preventDefault(); return clearSel(); }
      if (mod && e.shiftKey && k === 'i') { e.preventDefault(); return S.key && simple('invert', 'Inverted…'); }
      if (mod) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return clearSel(); }
      if (e.key === ' ') { e.preventDefault(); if (!S.space) { S.space = true; view.classList.add('pan'); } return; }
      if (e.key === 'Alt') e.preventDefault();   // Windows would otherwise move focus to the browser menu
      if (k === 's') return setTool('select');
      if (k === 'b') return setTool('brush');
      if (k === 'l') return setTool('lasso');
      if (e.key === '[') return setBrush(S.brush * 0.8);
      if (e.key === ']') return setBrush(S.brush * 1.25 + 1);
    }
    function onKeyUp(e) { if (S.closed) return; e.stopPropagation(); if (e.key === ' ') { S.space = false; view.classList.remove('pan'); } }
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKeyUp, true);
    const onResize = () => fit();
    window.addEventListener('resize', onResize);

    function close() {
      if (S.closed) return; S.closed = true;
      stopAnts(); worker.terminate();
      window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('resize', onResize);
      root.remove(); document.documentElement.style.overflow = prevOverflow;
      if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) { /* gone */ }
      if (opts.onClose) opts.onClose();
    }

    // ---- open: the model looks at the photo once, then every click is quick ----
    (async () => {
      root.focus();
      let poll = 0;
      const t0 = Date.now();
      const tick = async () => {
        try {
          const s = await (await fetch(api('status'), { credentials: 'same-origin' })).json();
          const secs = Math.round((Date.now() - t0) / 1000);
          if (s.phase === 'download' && s.total) { busyT.textContent = s.note + ' ' + Math.round(s.got / s.total * 100) + '%'; busyBar.style.width = (s.got / s.total * 100) + '%'; }
          else { busyT.textContent = (s.note || 'Opening the photo') + '… ' + secs + ' s'; busyBar.style.width = Math.min(95, secs * 12) + '%'; }
        } catch (e) { /* keep waiting */ }
      };
      poll = setInterval(tick, 700);
      try {
        const r = await fetch(api('prepare'), { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ url: src }) });
        const j = await r.json().catch(() => ({ ok: false, error: 'SiteGen refused (error ' + r.status + ')' }));
        if (!j.ok) throw new Error(j.error || 'Could not open that photo');
        if (S.closed) return;
        const img = new Image();
        img.src = api('image/' + j.key);
        await img.decode();
        Object.assign(S, { key: j.key, w: j.w, h: j.h, img });
        [cPhoto, cOv, cUi].forEach(c => { c.width = j.w; c.height = j.h; });
        stage.style.width = j.w + 'px'; stage.style.height = j.h + 'px';
        cPhoto.getContext('2d').drawImage(img, 0, 0);
        busyEl.hidden = true; fit(); remember();
        say('Ready. Click anything in the photo to select it' + (j.cached ? '' : ' (' + ((j.ms || 0) / 1000).toFixed(1) + ' s to get ready)'));
      } catch (err) {
        busyT.textContent = err.message || 'Could not open that photo'; busyBar.parentNode.hidden = true;
        say(err.message || 'Could not open that photo', true);
      } finally { clearInterval(poll); }
    })();

    const handle = { close, root, state: S };
    if (opts.test) window.__sgpe = handle;
    return handle;
  }

  window.SGPhotoEdit = { open };
})();
