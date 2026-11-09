// Photo editor helper (runs off the page, so the editor never freezes): turns click outlines, brush strokes and lasso
// shapes into the selection, softens its edge and finds the outline the marching ants walk along.
// A selection is one byte per pixel of the editor's working copy (0 = not selected, 255 = selected).
'use strict';

// fetch a black and white PNG and read it into one byte per pixel (w x h)
async function readMask(url, body, w, h) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'image/png' }, body: JSON.stringify(body), credentials: 'same-origin' });
  if (!r.ok) {
    let msg = 'Could not select that (error ' + r.status + ')';
    try { const j = await r.json(); if (j && j.error) msg = j.error; } catch (e) { /* not json */ }
    throw new Error(msg);
  }
  const bmp = await createImageBitmap(await r.blob());
  const c = new OffscreenCanvas(w, h), x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(bmp, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data, out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4];
  return { mask: out, score: +r.headers.get('X-Sg-Score') || 0 };
}

// set / add / sub / and of two masks (b may be soft: 0..255)
function combine(op, a, b) {
  const out = new Uint8Array(b.length);
  if (op === 'set' || !a) { out.set(b); return out; }
  for (let i = 0; i < out.length; i++) {
    if (op === 'add') out[i] = a[i] > b[i] ? a[i] : b[i];
    else if (op === 'sub') out[i] = Math.max(0, a[i] - b[i]);
    else out[i] = a[i] < b[i] ? a[i] : b[i];
  }
  return out;
}

// separable min filter: the selection shrunk by r px (a square neighbourhood, which is plenty for an outline)
function erode(m, w, h, r) {
  const tmp = new Uint8Array(m.length), out = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let v = 255;
      for (let k = -r; k <= r && v; k++) { const xx = x + k; v = (xx < 0 || xx >= w) ? 0 : Math.min(v, m[row + xx]); }
      tmp[row + x] = v;
    }
  }
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
    let v = 255;
    for (let k = -r; k <= r && v; k++) { const yy = y + k; v = (yy < 0 || yy >= h) ? 0 : Math.min(v, tmp[yy * w + x]); }
    out[y * w + x] = v;
  }
  return out;
}

// the pixels on the selection's edge (selected, with an unselected pixel within t px), as a list of pixel numbers
function edges(m, w, h, t) {
  const hard = new Uint8Array(m.length);
  let any = false;
  for (let i = 0; i < m.length; i++) if (m[i] >= 128) { hard[i] = 255; any = true; }
  if (!any) return new Int32Array(0);
  const inner = erode(hard, w, h, Math.max(1, t | 0));
  let n = 0;
  for (let i = 0; i < m.length; i++) if (hard[i] && !inner[i]) n++;
  const out = new Int32Array(n);
  n = 0;
  for (let i = 0; i < m.length; i++) if (hard[i] && !inner[i]) out[n++] = i;
  return out;
}

// soft edge: three box blurs (close to a gaussian) of radius r px
function blurPass(src, w, h, r, horiz) {
  const out = new Uint8Array(src.length), n = horiz ? w : h, lines = horiz ? h : w, span = 2 * r + 1;
  for (let l = 0; l < lines; l++) {
    const at = (k) => { const kk = k < 0 ? 0 : (k >= n ? n - 1 : k); return horiz ? src[l * w + kk] : src[kk * w + l]; };
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += at(k);
    for (let k = 0; k < n; k++) {
      const v = Math.round(sum / span);
      if (horiz) out[l * w + k] = v; else out[k * w + l] = v;
      sum += at(k + r + 1) - at(k - r);
    }
  }
  return out;
}
function feather(m, w, h, radius) {
  const r = Math.round(radius / 2);
  if (r < 1) return m.slice();
  let x = m;
  for (let p = 0; p < 3; p++) { x = blurPass(x, w, h, r, true); x = blurPass(x, w, h, r, false); }
  return x;
}

function area(m) { let n = 0; for (let i = 0; i < m.length; i++) if (m[i] >= 128) n++; return n; }
function bounds(m, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x] >= 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

// everything the page needs to draw a new selection
function describe(sel, w, h, t, soft) {
  const shown = soft > 0 ? feather(sel, w, h, soft) : sel;
  return { sel, shown, edges: edges(sel, w, h, t), area: area(sel) / (w * h), box: bounds(sel, w, h) };
}

self.onmessage = async (e) => {
  const q = e.data || {}, id = q.id;
  const send = (res, transfer) => self.postMessage({ id, ok: true, ...res }, transfer || []);
  try {
    const { w, h } = q;
    let sel = q.sel ? new Uint8Array(q.sel) : null;
    if (q.cmd === 'part' || q.cmd === 'subject') {
      const r = await readMask(q.url, q.body, w, h);
      let part = r.mask;
      if (q.invert) for (let i = 0; i < part.length; i++) part[i] = 255 - part[i];
      sel = combine(q.op || 'set', sel, part);
      const d = describe(sel, w, h, q.t, q.soft);
      return send({ ...d, score: r.score }, [d.sel.buffer, d.edges.buffer].concat(d.shown !== d.sel ? [d.shown.buffer] : []));
    }
    if (q.cmd === 'paint') {   // a brush stroke or lasso shape, one byte per pixel
      sel = combine(q.op, sel || new Uint8Array(w * h), new Uint8Array(q.part));
    } else if (q.cmd === 'invert') {
      if (!sel) sel = new Uint8Array(w * h);
      for (let i = 0; i < sel.length; i++) sel[i] = 255 - sel[i];
    } else if (q.cmd === 'all') {
      sel = new Uint8Array(w * h).fill(255);
    } else if (q.cmd === 'restyle') {
      if (!sel) return send({ sel: null, shown: null, edges: new Int32Array(0), area: 0, box: null });
    }
    const d = describe(sel, w, h, q.t, q.soft);
    send(d, [d.sel.buffer, d.edges.buffer].concat(d.shown !== d.sel ? [d.shown.buffer] : []));
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
