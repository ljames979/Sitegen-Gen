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


// ---- changes to the photo (part 2): each change is a layer with its own mask; the photo itself is never altered ----
const base = { w: 0, h: 0, px: null };   // the working copy's pixels (RGBA)
const masks = new Map();                 // mask id -> one byte per pixel of the working copy

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r ? ((g - b) / d) % 6 : (mx === g ? (b - r) / d + 2 : (r - g) / d + 4);
  h *= 60; if (h < 0) h += 360;
  return [h, Math.min(1, s), l];
}
function hslToRgb(h, s, l, out) {
  const c = (1 - Math.abs(2 * l - 1)) * s, hp = h / 60, x = c * (1 - Math.abs(hp % 2 - 1)), m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (hp < 1) { r = c; g = x; } else if (hp < 2) { r = x; g = c; } else if (hp < 3) { g = c; b = x; } else if (hp < 4) { g = x; b = c; } else if (hp < 5) { r = x; b = c; } else { r = c; b = x; }
  out[0] = (r + m) * 255; out[1] = (g + m) * 255; out[2] = (b + m) * 255;
}
const hexRgb = (hex) => { const n = parseInt(String(hex || '#000000').replace('#', '').padEnd(6, '0').slice(0, 6), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const clamp01 = (v) => (v < 0 ? 0 : (v > 1 ? 1 : v));

// Change color: the object takes the new color's hue and saturation, and keeps its own light and dark (shading and
// texture): its lightness is mapped so that its average lightness becomes the new color's, the shadows staying darker
// and the highlights lighter. strength 0..1 mixes with the original; shading 0..1 is how much of its own shading stays.
function recolor(px, mask, L) {
  const [Ht, St, Lt] = rgbToHsl(...hexRgb(L.color));
  const n = mask.length;
  let sl = 0, ss = 0, sw = 0;
  for (let i = 0; i < n; i++) {
    const a = mask[i]; if (a < 128 || px[i * 4 + 3] < 16) continue;
    const hs = rgbToHsl(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]); sl += hs[2]; ss += hs[1]; sw++;
  }
  if (!sw) return;
  const Lm = sl / sw, Sm = ss / sw, k = clamp01(L.strength == null ? 1 : L.strength), shade = clamp01(L.shading == null ? 1 : L.shading);
  const rgb = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const a = mask[i] / 255 * k; if (!a) continue;
    const j = i * 4, hs = rgbToHsl(px[j], px[j + 1], px[j + 2]), l = hs[2];
    // relative lightness: the shading moves with the average. Going lighter, the shadows keep their depth and the
    // highlights squeeze into the room left above; going darker, the other way round
    const rel = Lt >= Lm
      ? (l >= Lm ? Lt + (l - Lm) * (1 - Lt) / Math.max(0.02, 1 - Lm) : Lt - (Lm - l))
      : (l <= Lm ? Lt - (Lm - l) * Lt / Math.max(0.02, Lm) : Lt + (l - Lm));
    const l2 = clamp01(rel * shade + Lt * (1 - shade));
    const s2 = clamp01(St * (Sm > 0.06 ? Math.max(0.6, Math.min(1.4, hs[1] / Sm)) : 1));
    hslToRgb(Ht, s2, l2, rgb);
    px[j] += (rgb[0] - px[j]) * a; px[j + 1] += (rgb[1] - px[j + 1]) * a; px[j + 2] += (rgb[2] - px[j + 2]) * a;
  }
}

const KINDS = { recolor };
function render(px, w, h, layers, maskOf) {
  for (const L of layers || []) {
    if (!L || L.hidden || !KINDS[L.type]) continue;
    const m = maskOf(L.mask); if (!m) continue;
    KINDS[L.type](px, m, L, w, h);
  }
  return px;
}

// the full-size photo for Save: the original (from SiteGen) with every change, masks stretched to its size
async function renderFull(q) {
  const r = await fetch(q.url, { credentials: 'same-origin' });
  if (!r.ok) throw new Error('Could not load the full-size photo (error ' + r.status + ')');
  const bmp = await createImageBitmap(await r.blob());
  const W = bmp.width, H = bmp.height, c = new OffscreenCanvas(W, H), x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(bmp, 0, 0);
  const img = x.getImageData(0, 0, W, H);
  const big = new Map(), mc = new OffscreenCanvas(W, H), mx = mc.getContext('2d', { willReadFrequently: true });
  const maskOf = (id) => {
    if (big.has(id)) return big.get(id);
    const m = masks.get(id); if (!m) return null;
    const small = new OffscreenCanvas(base.w, base.h), sx = small.getContext('2d'), d = sx.createImageData(base.w, base.h);
    for (let i = 0; i < m.length; i++) d.data[i * 4 + 3] = m[i];
    sx.putImageData(d, 0, 0);
    mx.clearRect(0, 0, W, H); mx.imageSmoothingQuality = 'high'; mx.drawImage(small, 0, 0, W, H);
    const a = mx.getImageData(0, 0, W, H).data, out = new Uint8Array(W * H);
    for (let i = 0; i < out.length; i++) out[i] = a[i * 4 + 3];
    big.set(id, out); return out;
  };
  render(img.data, W, H, q.layers, maskOf);
  x.putImageData(img, 0, 0);
  const blob = await c.convertToBlob({ type: q.type || 'image/webp', quality: 0.9 });
  return { blob, w: W, h: H };
}

self.onmessage = async (e) => {
  const q = e.data || {}, id = q.id;
  const send = (res, transfer) => self.postMessage({ id, ok: true, ...res }, transfer || []);
  try {
    const { w, h } = q;
    if (q.cmd === 'base') { base.w = w; base.h = h; base.px = new Uint8ClampedArray(q.px); masks.clear(); return send({}); }
    if (q.cmd === 'mask') { masks.set(q.mid, new Uint8Array(q.mask)); return send({}); }
    if (q.cmd === 'drop') { (q.mids || []).forEach(m => masks.delete(m)); return send({}); }
    if (q.cmd === 'render') {   // the working copy with the changes (and one change being tried, not yet applied)
      const px = new Uint8ClampedArray(base.px);
      const extra = q.trial ? new Uint8Array(q.trial) : null;
      render(px, base.w, base.h, q.layers, (id) => (id === '__trial' ? extra : masks.get(id)));
      return send({ px: px.buffer }, [px.buffer]);
    }
    if (q.cmd === 'full') { const r = await renderFull(q); return send(r); }
    if (q.cmd === 'grow') {   // a change's mask reaches 1 px past a hard outline and fades there, so no old color shows on the rim
      const m = new Uint8Array(q.mask), inv = new Uint8Array(m.length);
      for (let i = 0; i < m.length; i++) inv[i] = 255 - m[i];
      const er = erode(inv, w, h, q.r || 1);
      for (let i = 0; i < m.length; i++) inv[i] = 255 - er[i];
      const out = feather(inv, w, h, 2);
      for (let i = 0; i < m.length; i++) if (m[i] > out[i]) out[i] = m[i];
      return send({ mask: out.buffer }, [out.buffer]);
    }
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
