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
    // hue and saturation are the target's (Leo's spec, 2026-11-12); the lightness is the pixel's own, moved as above
    const s2 = St;
    hslToRgb(Ht, s2, l2, rgb);
    px[j] += (rgb[0] - px[j]) * a; px[j + 1] += (rgb[1] - px[j + 1]) * a; px[j + 2] += (rgb[2] - px[j + 2]) * a;
  }
}

// Adjust (part 3): brightness, contrast, color strength and warmth, each -100..100, inside the mask
function adjust(px, mask, L) {
  const br = (L.bright || 0) / 100, ct = (L.contrast || 0) / 100, sa = (L.sat || 0) / 100, wm = (L.warm || 0) / 100;
  const k = clamp01(L.strength == null ? 1 : L.strength);
  const cf = ct >= 0 ? 1 + ct * 1.4 : 1 + ct * 0.9;   // contrast round the middle grey
  const n = mask.length;
  for (let i = 0; i < n; i++) {
    const a = mask[i] / 255 * k; if (!a) continue;
    const j = i * 4;
    let r = px[j], g = px[j + 1], b = px[j + 2];
    // brightness: lifts toward white or sinks toward black, so nothing clips hard
    if (br > 0) { r += (255 - r) * br * 0.7; g += (255 - g) * br * 0.7; b += (255 - b) * br * 0.7; }
    else if (br < 0) { const f = 1 + br * 0.7; r *= f; g *= f; b *= f; }
    r = (r - 128) * cf + 128; g = (g - 128) * cf + 128; b = (b - 128) * cf + 128;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b, sf = 1 + sa;
    r = lum + (r - lum) * sf; g = lum + (g - lum) * sf; b = lum + (b - lum) * sf;
    r += wm * 28; g += wm * 6; b -= wm * 28;
    px[j] += (Math.max(0, Math.min(255, r)) - px[j]) * a;
    px[j + 1] += (Math.max(0, Math.min(255, g)) - px[j + 1]) * a;
    px[j + 2] += (Math.max(0, Math.min(255, b)) - px[j + 2]) * a;
  }
}

// ✨ Auto enhance (2026-11-12): levels (the darkest and lightest parts reach black and white), a white-balance gain per
// channel, a midtone lift (gamma) and color strength, all worked out from the photo by autoFix() below
function enhance(px, mask, L) {
  const lo = L.lo || 0, hi = L.hi == null ? 255 : L.hi, span = Math.max(1, hi - lo), g = L.gain || [1, 1, 1], gm = L.gamma || 1, sa = (L.sat || 0) / 100;
  const k = clamp01(L.strength == null ? 1 : L.strength);
  const lut = [0, 1, 2].map(c => { const t = new Float32Array(256); for (let v = 0; v < 256; v++) t[v] = 255 * Math.pow(clamp01((v - lo) / span * g[c]), gm); return t; });
  const n = mask.length;
  for (let i = 0; i < n; i++) {
    const a = mask[i] / 255 * k; if (!a) continue;
    const j = i * 4;
    let r = lut[0][px[j]], gg = lut[1][px[j + 1]], b = lut[2][px[j + 2]];
    if (sa) { const lum = 0.299 * r + 0.587 * gg + 0.114 * b, sf = 1 + sa; r = lum + (r - lum) * sf; gg = lum + (gg - lum) * sf; b = lum + (b - lum) * sf; }
    px[j] += (Math.max(0, Math.min(255, r)) - px[j]) * a;
    px[j + 1] += (Math.max(0, Math.min(255, gg)) - px[j + 1]) * a;
    px[j + 2] += (Math.max(0, Math.min(255, b)) - px[j + 2]) * a;
  }
}

// what ✨ Auto enhance should do to this photo (only its solid pixels count: a cut-out's see-through backdrop is skipped).
// Gentle on purpose: levels are linked (the same for red, green and blue, so colors don't shift), the white balance
// comes only from the photo's nearly-grey parts and moves each channel by at most 15%, and the lift is capped.
function autoFix(px, w, h) {
  const n = w * h, hist = new Uint32Array(256);
  let cnt = 0;
  for (let i = 0; i < n; i++) {
    const j = i * 4; if (px[j + 3] < 200) continue;
    hist[px[j]]++; hist[px[j + 1]]++; hist[px[j + 2]]++; cnt++;
  }
  if (cnt < 500) return null;
  const at = (q) => { let s = 0; const goal = cnt * 3 * q; for (let v = 0; v < 256; v++) { s += hist[v]; if (s >= goal) return v; } return 255; };
  let lo = Math.min(at(0.004), 60), hi = Math.max(at(0.996), 190);
  if (lo <= 3) lo = 0; if (hi >= 252) hi = 255;
  const span = Math.max(1, hi - lo), lv = (v) => clamp01((v - lo) / span);
  // white balance from the nearly-grey pixels (after levels)
  let gr = 0, gg = 0, gb = 0, gn = 0;
  for (let i = 0; i < n; i++) {
    const j = i * 4; if (px[j + 3] < 200) continue;
    const r = lv(px[j]), g = lv(px[j + 1]), b = lv(px[j + 2]), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (l < 0.18 || l > 0.94 || mx - mn > 0.16) continue;
    gr += r; gg += g; gb += b; gn++;
  }
  let gain = [1, 1, 1];
  if (gn > cnt * 0.03) {
    const mr = gr / gn, mg = gg / gn, mb = gb / gn, grey = (mr + mg + mb) / 3;
    gain = [mr, mg, mb].map(m => { const k = 1 + (grey / Math.max(0.02, m) - 1) * 0.8; return Math.max(0.85, Math.min(1.15, k)); });
    if (gain.every(k => Math.abs(k - 1) < 0.015)) gain = [1, 1, 1];
  }
  // midtone lift toward a middle brightness, and color strength for a dull photo
  let sl = 0, ss = 0;
  for (let i = 0; i < n; i++) {
    const j = i * 4; if (px[j + 3] < 200) continue;
    const r = clamp01(lv(px[j]) * gain[0]), g = clamp01(lv(px[j + 1]) * gain[1]), b = clamp01(lv(px[j + 2]) * gain[2]);
    sl += 0.299 * r + 0.587 * g + 0.114 * b;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    ss += d ? d / (1 - Math.abs(2 * l - 1) || 1) : 0;
  }
  const meanL = sl / cnt, meanS = ss / cnt;
  let gamma = 1;
  // a dark photo is lifted toward the middle; a very bright one (white foam, snow) is only toned down a little
  if (meanL < 0.42) gamma = Math.max(0.72, Math.log(0.46) / Math.log(Math.max(0.02, meanL)));
  else if (meanL > 0.66) gamma = Math.min(1.12, Math.log(0.62) / Math.log(Math.min(0.98, meanL)));
  gamma = Math.round(gamma * 100) / 100;
  const sat = meanS < 0.04 ? 0 : (meanS < 0.16 ? 16 : (meanS < 0.26 ? 8 : 0));   // a black-and-white photo stays one
  const fix = { lo, hi, gain: gain.map(k => Math.round(k * 1000) / 1000), gamma, sat };
  const same = lo === 0 && hi === 255 && gain.every(k => k === 1) && gamma === 1 && !sat;
  return { fix: same ? null : fix, meanL, meanS };
}

// a tilted photo: the angle (degrees, clockwise to turn it level) that lines its long straight edges up with the
// sides, or 0 when no clear tilt is found. Edges are scored for every angle from -10° to 10° (projection profile:
// at the right angle the edge pixels pile up on a few rows or columns).
function findTilt(px, w, h) {
  const sc = Math.min(1, 420 / Math.max(w, h)), W = Math.max(8, Math.round(w * sc)), H = Math.max(8, Math.round(h * sc));
  const gray = new Float32Array(W * H), solid = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const j = (Math.min(h - 1, Math.floor(y / sc)) * w + Math.min(w - 1, Math.floor(x / sc))) * 4;
    gray[y * W + x] = 0.299 * px[j] + 0.587 * px[j + 1] + 0.114 * px[j + 2]; solid[y * W + x] = px[j + 3] >= 200 ? 1 : 0;
  }
  const pts = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    // a cut-out's own outline is not a line in the scene: only edges with solid pixels all round count
    if (!solid[i - W - 1] || !solid[i - W + 1] || !solid[i + W - 1] || !solid[i + W + 1]) continue;
    const gx = gray[i - W + 1] + 2 * gray[i + 1] + gray[i + W + 1] - gray[i - W - 1] - 2 * gray[i - 1] - gray[i + W - 1];
    const gy = gray[i + W - 1] + 2 * gray[i + W] + gray[i + W + 1] - gray[i - W - 1] - 2 * gray[i - W] - gray[i - W + 1];
    const m = Math.hypot(gx, gy); if (m < 90) continue;
    pts.push(x, y, Math.abs(gy) >= Math.abs(gx) ? 1 : 0, Math.min(m, 600));
  }
  if (pts.length / 4 < 150) return { tilt: 0, sure: 0 };
  const D = Math.ceil(Math.hypot(W, H)) + 2;
  const score = (deg) => {
    const a = deg * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a), rows = new Float32Array(D * 2), cols = new Float32Array(D * 2);
    for (let k = 0; k < pts.length; k += 4) {
      const x = pts[k], y = pts[k + 1];
      if (pts[k + 2]) rows[Math.round(-x * sn + y * c) + D]++; else cols[Math.round(x * c + y * sn) + D]++;
    }
    let s = 0; for (let i = 0; i < rows.length; i++) s += rows[i] * rows[i] + cols[i] * cols[i];
    return s;
  };
  let best = 0, bestS = -1;
  for (let d = -10; d <= 10.001; d += 0.25) { const s = score(d); if (s > bestS) { bestS = s; best = d; } }
  for (let d = best - 0.2; d <= best + 0.2001; d += 0.05) { const s = score(d); if (s > bestS) { bestS = s; best = d; } }
  const s0 = score(0), sure = s0 > 0 ? bestS / s0 : 0;
  best = Math.round(best * 10) / 10;
  // the lines run at +best°; turning the photo by -best° (counter-clockwise) puts them level
  if (Math.abs(best) < 0.4 || sure < 1.12) return { tilt: 0, sure };
  return { tilt: -best, sure };
}

// ✨ Match to brand: the photo's colorful things (not the main subject), as color groups by hue, biggest first.
// Each group is a mask (one byte per pixel) ready for a Change color layer.
function brandAreas(px, w, h, subj, maxN) {
  const n = w * h, hue = new Float32Array(n).fill(-1), bins = new Float32Array(36);
  let solid = 0;
  const hs = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const j = i * 4; if (px[j + 3] < 200) continue;
    solid++;
    if (subj && subj[i] >= 128) continue;
    const mx = Math.max(px[j], px[j + 1], px[j + 2]), mn = Math.min(px[j], px[j + 1], px[j + 2]);
    if (mx - mn < 20) continue;   // grey: no hue to match
    const [H, S, L] = rgbToHsl(px[j], px[j + 1], px[j + 2]);
    if (S < 0.28 || L < 0.12 || L > 0.9) continue;
    hue[i] = H; bins[Math.floor(H / 10) % 36] += S;
  }
  if (!solid) return [];
  // a cut-out photo's "subject" can be everything in it (pet, towel and brush): then it can't be used to keep the pet out
  if (subj) { let inS = 0; for (let i = 0; i < n; i++) if (subj[i] >= 128 && px[i * 4 + 3] >= 200) inS++; if (inS > solid * 0.7) return brandAreas(px, w, h, null, maxN); }
  const sm = bins.map((v, b) => v * 0.5 + (bins[(b + 35) % 36] + bins[(b + 1) % 36]) * 0.25);
  const used = new Uint8Array(36), groups = [];
  for (let k = 0; k < 6 && groups.length < (maxN || 2); k++) {
    let b = -1; for (let i = 0; i < 36; i++) if (!used[i] && (b < 0 || sm[i] > sm[b])) b = i;
    if (b < 0 || sm[b] <= 0) break;
    for (let d = -3; d <= 3; d++) used[(b + d + 36) % 36] = 1;
    // the group's middle hue: the weighted average round the peak
    let sx = 0, sy = 0;
    for (let d = -2; d <= 2; d++) { const bb = (b + d + 36) % 36, a = (bb * 10 + 5) * Math.PI / 180; sx += Math.cos(a) * bins[bb]; sy += Math.sin(a) * bins[bb]; }
    const mid = (Math.atan2(sy, sx) * 180 / Math.PI + 360) % 360;
    let m = new Uint8Array(n);
    for (let i = 0; i < n; i++) { if (hue[i] < 0) continue; const dh = Math.abs(((hue[i] - mid + 540) % 360) - 180); if (dh <= 20) { m[i] = 255; hue[i] = -1; } }
    // close small gaps (texture, highlights), then drop specks: only pieces of at least 0.3% of the photo stay
    m = morph(morph(m, w, h, 2, true), w, h, 2, false);
    m = keepBig(m, w, h, Math.max(40, solid * 0.003));
    const a = area(m);
    if (a < solid * 0.012) continue;
    let r = 0, g = 0, bl = 0, c = 0;
    for (let i = 0; i < n; i++) if (m[i] >= 128) { const j = i * 4; r += px[j]; g += px[j + 1]; bl += px[j + 2]; c++; }
    // fur, skin and wood (orange-brown, not loud) are never brand colors: leave the pet, the people and the brush alone
    const [gh, gs] = rgbToHsl(r / c, g / c, bl / c);
    if (gh >= 10 && gh <= 50 && gs < 0.55) continue;
    const hex = '#' + [r / c, g / c, bl / c].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
    groups.push({ mask: m, area: a / n, hue: Math.round(mid), color: hex });
  }
  return groups.sort((x, y) => y.area - x.area);
}
// grow (max) or shrink (min) by r px; the photo's border doesn't count as either
function morph(m, w, h, r, grow) {
  const tmp = new Uint8Array(m.length), out = new Uint8Array(m.length);
  const pass = (src, dst, len, step, lines, stride) => {
    for (let L = 0; L < lines; L++) {
      const o = L * stride;
      for (let a = 0; a < len; a++) {
        const k0 = a - r < 0 ? 0 : a - r, k1 = a + r >= len ? len - 1 : a + r;
        let v = src[o + a * step];
        if (grow) { for (let k = k0; k <= k1 && v < 255; k++) { const u = src[o + k * step]; if (u > v) v = u; } }
        else { for (let k = k0; k <= k1 && v > 0; k++) { const u = src[o + k * step]; if (u < v) v = u; } }
        dst[o + a * step] = v;
      }
    }
  };
  pass(m, tmp, w, 1, h, w);
  pass(tmp, out, h, w, w, 1);
  return out;
}
// pieces (4-way joined) of at least min pixels
function keepBig(m, w, h, min) {
  const seen = new Uint8Array(m.length), out = new Uint8Array(m.length), stack = new Int32Array(m.length), list = new Int32Array(m.length);
  let got = 0;
  for (let s = 0; s < m.length; s++) {
    if (seen[s] || m[s] < 128) continue;
    let top = 0, k = 0; stack[top++] = s; seen[s] = 1; const from = got;
    while (top) {
      const i = stack[--top]; list[got++] = i; k++;
      const x = i % w;
      if (x > 0 && !seen[i - 1] && m[i - 1] >= 128) { seen[i - 1] = 1; stack[top++] = i - 1; }
      if (x < w - 1 && !seen[i + 1] && m[i + 1] >= 128) { seen[i + 1] = 1; stack[top++] = i + 1; }
      if (i >= w && !seen[i - w] && m[i - w] >= 128) { seen[i - w] = 1; stack[top++] = i - w; }
      if (i < m.length - w && !seen[i + w] && m[i + w] >= 128) { seen[i + w] = 1; stack[top++] = i + w; }
    }
    if (k >= min) for (let q = from; q < got; q++) out[list[q]] = 255;
  }
  return out;
}

const KINDS = { recolor, adjust, enhance };
// each change in order (later ones on top); a change's opacity (its Strength in the Changes list) scales its own strength
function render(px, w, h, layers, maskOf) {
  for (const L of layers || []) {
    if (!L || L.hidden || !KINDS[L.type]) continue;
    const m = maskOf(L.mask); if (!m) continue;
    const op = L.opacity == null ? 1 : clamp01(L.opacity);
    if (!op) continue;
    KINDS[L.type](px, m, op === 1 ? L : Object.assign({}, L, { strength: (L.strength == null ? 1 : L.strength) * op }), w, h);
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
  const out = frameCanvas(c, W, H, q.frame);
  const blob = await out.canvas.convertToBlob({ type: q.type || 'image/webp', quality: 0.9 });
  return { blob, w: out.w, h: out.h };
}
// Straighten (✨ Auto enhance or the slider in Crop & turn): f.tilt degrees, -15..15, clockwise
const tiltOf = (f) => { const t = +(f && f.tilt) || 0; return Math.abs(t) < 0.05 ? 0 : Math.max(-15, Math.min(15, t)); };
// how much bigger a photo of w x h turned by t degrees must be to still fill w x h
const tiltScale = (t, w, h) => { const a = Math.abs(t) * Math.PI / 180; return Math.cos(a) + Math.sin(a) * Math.max(w / h, h / w); };
// crop and turn (2026-11-12): keep the frame's part of the photo (fractions of it), then mirror and turn it.
// The same order as the editor's view: mirror first, then the quarter turn (clockwise).
function frameCanvas(c, W, H, f) {
  if (!f) return { canvas: c, w: W, h: H };
  const sx = Math.max(0, Math.round((f.x || 0) * W)), sy = Math.max(0, Math.round((f.y || 0) * H));
  const cw = Math.max(1, Math.min(W - sx, Math.round((f.w == null ? 1 : f.w) * W))), ch = Math.max(1, Math.min(H - sy, Math.round((f.h == null ? 1 : f.h) * H)));
  const rot = [90, 180, 270].includes(+f.rot) ? +f.rot : 0, side = rot === 90 || rot === 270;
  const ow = side ? ch : cw, oh = side ? cw : ch;
  if (!rot && !f.fh && !f.fv && !tiltOf(f) && sx === 0 && sy === 0 && cw === W && ch === H) return { canvas: c, w: W, h: H };
  const o = new OffscreenCanvas(ow, oh), ox = o.getContext('2d');
  const t = tiltOf(f), ts = tiltScale(t, ow, oh);   // Straighten: a small turn, made a little bigger so no corner is empty
  ox.imageSmoothingQuality = 'high';
  ox.translate(ow / 2, oh / 2); ox.rotate((rot + t) * Math.PI / 180); ox.scale((f.fh ? -1 : 1) * ts, (f.fv ? -1 : 1) * ts);
  ox.drawImage(c, sx, sy, cw, ch, -cw / 2, -ch / 2, cw, ch);
  return { canvas: o, w: ow, h: oh };
}

// the part of a mask joined to one spot (4-way), everything else dropped
function keepJoined(m, w, h, at) {
  const x0 = Math.max(0, Math.min(w - 1, Math.round(at.x))), y0 = Math.max(0, Math.min(h - 1, Math.round(at.y)));
  let start = y0 * w + x0;
  if (m[start] < 128) {   // the click landed on a gap in the outline: start from the nearest selected pixel close by
    let best = -1, bd = 1e9;
    for (let dy = -12; dy <= 12; dy++) for (let dx = -12; dx <= 12; dx++) {
      const x = x0 + dx, y = y0 + dy; if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const d = dx * dx + dy * dy, i = y * w + x; if (m[i] >= 128 && d < bd) { bd = d; best = i; }
    }
    if (best < 0) return m;
    start = best;
  }
  const out = new Uint8Array(m.length), stack = new Int32Array(m.length); let n = 0;
  stack[n++] = start; out[start] = 255;
  while (n) {
    const i = stack[--n], x = i % w;
    if (x > 0 && !out[i - 1] && m[i - 1] >= 128) { out[i - 1] = 255; stack[n++] = i - 1; }
    if (x < w - 1 && !out[i + 1] && m[i + 1] >= 128) { out[i + 1] = 255; stack[n++] = i + 1; }
    if (i >= w && !out[i - w] && m[i - w] >= 128) { out[i - w] = 255; stack[n++] = i - w; }
    if (i + w < m.length && !out[i + w] && m[i + w] >= 128) { out[i + w] = 255; stack[n++] = i + w; }
  }
  return out;
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
    if (q.cmd === 'autofix') {   // ✨ Auto enhance: what to change, worked out from the working copy
      const r = autoFix(base.px, base.w, base.h) || { fix: null };
      const t = q.tilt === false ? { tilt: 0, sure: 0 } : findTilt(base.px, base.w, base.h);
      return send({ fix: r.fix, tilt: t.tilt, sure: t.sure });
    }
    if (q.cmd === 'brandareas') {   // ✨ Match to brand: the colorful things that aren't the main subject
      const g = brandAreas(base.px, base.w, base.h, q.subj ? new Uint8Array(q.subj) : null, q.max || 2);
      return send({ groups: g.map(x => ({ mask: x.mask.buffer, area: x.area, hue: x.hue, color: x.color })) }, g.map(x => x.mask.buffer));
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
      if (q.keepAt) part = keepJoined(part, w, h, q.keepAt);   // ✨ Auto: only the piece under the click, no specks elsewhere
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

if (typeof module !== 'undefined') module.exports = { recolor, adjust, enhance, autoFix, findTilt, brandAreas, tiltScale, render };
