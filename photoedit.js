// Photo editor, part 1: Smart Select (Leo, 2026-11-09). Click anything in a photo (the dog, the towel, the brush, a
// bubble, the foam) and the editor outlines it.
// It uses Segment Anything (SAM, ViT-B, Apache-2.0, Meta AI, github.com/facebookresearch/segment-anything), in the
// quantized ONNX copy published with rembg (github.com/danielgatis/rembg releases, the same place as the cut-out model).
// It runs here, on this computer, with onnxruntime-node and sharp (the cut-out tool's two optional packages): no photo
// is sent to another service and nothing is paid for.
//   - prepare(src): the encoder looks at the photo once (a few seconds) and the result (the "embedding") is kept, in
//     memory and in data/photoedit/, so every click after that answers in well under a tenth of a second
//   - mask(key, x, y): one click -> the outline of the thing under it, as a black and white PNG the size of the photo
//   - subject(key): the main subject (the pet), from the cut-out model (IS-Net)
// The editor works on a copy of the photo at most WORK px on its long side; the full-size photo is untouched (the
// later parts render edits at full size when they are applied).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cutout = require('./cutout');

const BASE = 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/';
const MODELS = {
  encoder: { file: 'vit_b-encoder-quant.onnx', min: 80 * 1024 * 1024, mb: 100 },
  decoder: { file: 'vit_b-decoder-quant.onnx', min: 5 * 1024 * 1024, mb: 9 },
};
const MODEL_DIR = process.env.SG_MODEL_DIR || path.join(__dirname, 'models');
const CACHE_DIR = process.env.SG_PHOTOEDIT_DIR || path.join(__dirname, 'data', 'photoedit');
const WORK = 1600;          // the editor's working copy: long side in px
const FULL = 1920;          // the finished photo (the same size limit as uploads)
const SAM = 1024;           // what the encoder looks at
const KEEP = 30;            // photos kept ready on disk
const MEAN = [123.675, 116.28, 103.53], STD = [58.395, 57.12, 57.375];
const BACKDROP = { r: 127, g: 127, b: 127 };   // see-through parts are shown to the model on mid grey

let ort = null, sharp = null;
try { ort = require('onnxruntime-node'); } catch (e) { /* optional */ }
try { sharp = require('sharp'); } catch (e) { /* optional */ }
const ready = () => !!(ort && sharp);
const missing = () => [!ort && 'onnxruntime-node', !sharp && 'sharp'].filter(Boolean);
function need() { if (!ready()) throw new Error('The photo editor needs ' + missing().join(' and ') + ': run "npm install" in the SiteGen folder, then restart SiteGen'); }

// what the server is busy with, for the editor's progress line
const status = { phase: 'idle', got: 0, total: 0, note: '' };
function setStatus(phase, note, got, total) { status.phase = phase; status.note = note || ''; status.got = got || 0; status.total = total || 0; }

async function download(m) {
  fs.mkdirSync(MODEL_DIR, { recursive: true });
  const dest = path.join(MODEL_DIR, m.file), tmp = dest + '.part';
  const r = await fetch(BASE + m.file);
  if (!r.ok || !r.body) throw new Error('Could not download the selection model (' + r.status + ')');
  const total = +r.headers.get('content-length') || m.mb * 1024 * 1024;
  const out = fs.createWriteStream(tmp);
  let got = 0;
  try {
    for await (const chunk of r.body) {
      got += chunk.length;
      setStatus('download', 'Downloading the selection model (' + m.mb + ' MB, only the first time)', got, total);
      if (!out.write(chunk)) await new Promise(res => out.once('drain', res));
    }
  } finally { await new Promise(res => out.end(res)); }
  if (fs.statSync(tmp).size < m.min) { fs.unlinkSync(tmp); throw new Error('The selection model download was incomplete. Try again.'); }
  fs.renameSync(tmp, dest);
}
const sessions = {}, loading = {};
async function session(which) {
  if (sessions[which]) return sessions[which];
  if (!loading[which]) loading[which] = (async () => {
    const m = MODELS[which], file = path.join(MODEL_DIR, m.file);
    if (!fs.existsSync(file)) await download(m);
    setStatus('load', 'Starting the selection model');
    sessions[which] = await ort.InferenceSession.create(file);
    return sessions[which];
  })().finally(() => { loading[which] = null; });
  return loading[which];
}

// ---- prepared photos: key -> { w, h, emb (Float32Array 256x64x64), scale } ----
const mem = new Map();
const keyOk = (k) => /^[a-f0-9]{24}$/.test(String(k || ''));
const fileFor = (key, ext) => path.join(CACHE_DIR, key + ext);
function remember(key, v) { mem.delete(key); mem.set(key, v); while (mem.size > 4) mem.delete(mem.keys().next().value); return v; }
function prune() {
  try {
    const files = fs.readdirSync(CACHE_DIR).filter(f => /\.emb$/.test(f)).map(f => ({ f, t: fs.statSync(path.join(CACHE_DIR, f)).mtimeMs })).sort((a, b) => b.t - a.t);
    files.slice(KEEP).forEach(({ f }) => { const k = f.slice(0, -4); ['.emb', '.json', '.png', '.full.png'].forEach(x => { try { fs.unlinkSync(fileFor(k, x)); } catch (e) { /* gone */ } }); });
  } catch (e) { /* no cache yet */ }
}
function load(key) {
  if (!keyOk(key)) throw new Error('That photo is not open in the editor');
  if (mem.has(key)) return remember(key, mem.get(key));
  try {
    const info = JSON.parse(fs.readFileSync(fileFor(key, '.json'), 'utf8'));
    const b = fs.readFileSync(fileFor(key, '.emb'));
    const emb = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
    if (emb.length !== 256 * 64 * 64) throw new Error('bad');
    const now = new Date(); try { fs.utimesSync(fileFor(key, '.emb'), now, now); } catch (e) { /* fine */ }
    return remember(key, { ...info, emb });
  } catch (e) { throw new Error('Open the photo in the editor again (it was put away)'); }
}

// the working copy of a photo (PNG, keeps see-through parts) and its encoder result
async function prepare(src) {
  need();
  const input = await cutout.photoBytes(src);
  const key = crypto.createHash('sha1').update(input).digest('hex').slice(0, 24);
  if (mem.has(key) || fs.existsSync(fileFor(key, '.emb'))) {
    const v = load(key);
    if (fs.existsSync(fileFor(key, '.png')) && fs.existsSync(fileFor(key, '.full.png'))) return { key, w: v.w, h: v.h, cached: true };
  }
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const work = await sharp(input, { failOn: 'none' }).rotate().resize({ width: WORK, height: WORK, fit: 'inside', withoutEnlargement: true }).ensureAlpha().png().toBuffer({ resolveWithObject: true });
  const w = work.info.width, h = work.info.height;
  const scale = SAM / Math.max(w, h), nw = Math.round(w * scale), nh = Math.round(h * scale);
  const px = await sharp(work.data).flatten({ background: BACKDROP }).resize(nw, nh, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  const x = new Float32Array(3 * SAM * SAM);   // the rest of the 1024 square stays 0 (the model's padding)
  for (let yy = 0; yy < nh; yy++) for (let xx = 0; xx < nw; xx++) {
    const i = (yy * nw + xx) * 3, o = yy * SAM + xx;
    for (let c = 0; c < 3; c++) x[c * SAM * SAM + o] = (px[i + c] - MEAN[c]) / STD[c];
  }
  const enc = await session('encoder');
  setStatus('encode', 'Looking at the photo');
  const t = Date.now();
  const out = await enc.run({ [enc.inputNames[0]]: new ort.Tensor('float32', x, [1, 3, SAM, SAM]) });
  const emb = new Float32Array(out[enc.outputNames[0]].data);
  setStatus('idle');
  fs.writeFileSync(fileFor(key, '.png'), work.data);
  // the full-size copy (up to FULL px) that Save renders the finished photo from
  await sharp(input, { failOn: 'none' }).rotate().resize({ width: FULL, height: FULL, fit: 'inside', withoutEnlargement: true }).ensureAlpha().png({ compressionLevel: 4 }).toFile(fileFor(key, '.full.png'));
  fs.writeFileSync(fileFor(key, '.emb'), Buffer.from(emb.buffer));
  fs.writeFileSync(fileFor(key, '.json'), JSON.stringify({ w, h, scale, src: String(src).slice(0, 500) }));
  remember(key, { w, h, scale, emb });
  prune();
  return { key, w, h, cached: false, ms: Date.now() - t };
}

const imagePath = (key, full) => { if (!keyOk(key)) return ''; const f = fileFor(key, full ? '.full.png' : '.png'); return fs.existsSync(f) ? f : ''; };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// points: [{x, y, on}] in working-copy px (on=false marks "not this"); box: optional {x0, y0, x1, y1}
async function mask(key, points, box) {
  need();
  const v = load(key);
  const pts = (Array.isArray(points) ? points : []).slice(0, 12).map(p => ({ x: clamp(+p.x || 0, 0, v.w), y: clamp(+p.y || 0, 0, v.h), on: p.on !== false }));
  if (!pts.length && !box) throw new Error('Click on something in the photo');
  const coords = [], labels = [];
  pts.forEach(p => { coords.push(p.x * v.scale, p.y * v.scale); labels.push(p.on ? 1 : 0); });
  if (box) { coords.push(clamp(+box.x0, 0, v.w) * v.scale, clamp(+box.y0, 0, v.h) * v.scale, clamp(+box.x1, 0, v.w) * v.scale, clamp(+box.y1, 0, v.h) * v.scale); labels.push(2, 3); }
  else { coords.push(0, 0); labels.push(-1); }   // the model's "no box" point
  const n = labels.length;
  const dec = await session('decoder');
  const r = await dec.run({
    image_embeddings: new ort.Tensor('float32', v.emb, [1, 256, 64, 64]),
    point_coords: new ort.Tensor('float32', new Float32Array(coords), [1, n, 2]),
    point_labels: new ort.Tensor('float32', new Float32Array(labels), [1, n]),
    mask_input: new ort.Tensor('float32', new Float32Array(256 * 256), [1, 1, 256, 256]),
    has_mask_input: new ort.Tensor('float32', new Float32Array([0]), [1]),
    orig_im_size: new ort.Tensor('float32', new Float32Array([v.h, v.w]), [2]),
  });
  const m = r.masks.data, size = v.w * v.h, a = Buffer.alloc(size);
  let on = 0;
  for (let i = 0; i < size; i++) if (m[i] > 0) { a[i] = 255; on++; }
  const png = await sharp(a, { raw: { width: v.w, height: v.h, channels: 1 } }).png({ compressionLevel: 3 }).toBuffer();
  return { png, score: +(r.iou_predictions.data[0] || 0).toFixed(3), area: on / size };
}

// the main subject (the pet), from the cut-out model, limited to the photo's own visible parts
async function subject(key) {
  need();
  const f = imagePath(key);
  if (!f) throw new Error('Open the photo in the editor again (it was put away)');
  const v = load(key);
  setStatus('subject', 'Finding the main subject');
  try {
    const a = await cutout.alphaFor(fs.readFileSync(f), v.w, v.h);
    const own = await sharp(f).extractChannel(3).raw().toBuffer();
    for (let i = 0; i < a.length; i++) a[i] = Math.min(a[i], own[i]);
    return await sharp(a, { raw: { width: v.w, height: v.h, channels: 1 } }).png({ compressionLevel: 3 }).toBuffer();
  } finally { setStatus('idle'); }
}


// ---- saved edits (part 2): one "edit" per finished photo, kept in the site's data as sections.photoEdits[id] ----
//   { src: the original photo (never changed), out: the finished photo, w, h: the editor's working size,
//     layers: [{ id, type, name, mask, hidden, ...settings }], masks: { maskId: '/uploads/pe-....png' }, at }
// A mask is a black and white PNG the working size, kept with the uploads. Opening the finished photo in the editor
// opens the original with every change still there to change, hide or remove.
const MAX_EDITS = 120, MAX_LAYERS = 60;
const LAYER_TYPES = ['recolor'];
const isUp = (u) => /^\/uploads\/[A-Za-z0-9._-]+$/.test(String(u || ''));
const hex = (v) => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v).toLowerCase() : '');
const num = (v, lo, hi, d) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
const idOk = (v) => /^[a-z0-9]{4,20}$/.test(String(v || ''));
function cleanLayer(L) {
  if (!L || !LAYER_TYPES.includes(L.type) || !idOk(L.id) || !idOk(L.mask)) return null;
  const out = { id: L.id, type: L.type, name: String(L.name || '').replace(/[<>]/g, '').slice(0, 60), mask: L.mask, hidden: !!L.hidden };
  if (L.type === 'recolor') Object.assign(out, { color: hex(L.color) || '#ff69b4', strength: num(L.strength, 0, 1, 1), shading: num(L.shading, 0, 1, 1) });
  return out;
}
function cleanEdit(e) {
  if (!e || typeof e !== 'object') return null;
  const src = String(e.src || '').trim(), out = String(e.out || '').trim();
  if (!src || src.length > 500 || !isUp(out)) return null;
  const masks = {};
  Object.entries(e.masks || {}).slice(0, MAX_LAYERS).forEach(([k, u]) => { if (idOk(k) && isUp(u)) masks[k] = u; });
  const layers = (Array.isArray(e.layers) ? e.layers : []).slice(0, MAX_LAYERS).map(cleanLayer).filter(L => L && masks[L.mask]);
  return { src, out, w: num(e.w, 1, 10000, 0) | 0, h: num(e.h, 1, 10000, 0) | 0, layers, masks, at: String(e.at || '').slice(0, 30) };
}
function cleanEdits(all) {
  const out = {};
  Object.entries(all && typeof all === 'object' ? all : {}).filter(([k]) => idOk(k)).sort((a, b) => String(b[1] && b[1].at).localeCompare(String(a[1] && a[1].at)))
    .slice(0, MAX_EDITS).forEach(([k, v]) => { const c = cleanEdit(v); if (c) out[k] = c; });
  return out;
}
// the saved edit whose finished photo is this address (to reopen it)
function editFor(all, url) {
  url = String(url || '').trim();
  for (const [id, e] of Object.entries(all || {})) if (e && e.out === url) return { id, ...e };
  return null;
}
// a mask sent by the editor (PNG bytes) -> saved with the uploads, returns its address
async function saveMask(buf) {
  need();
  if (!Buffer.isBuffer(buf) || !buf.length) throw new Error('A selection could not be saved');
  const meta = await sharp(buf).metadata();
  if (meta.format !== 'png' || !meta.width || meta.width > WORK || meta.height > WORK) throw new Error('A selection could not be saved');
  const name = 'pe-' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex') + '.png';
  await sharp(buf).extractChannel(0).png({ compressionLevel: 9 }).toFile(path.join(cutout.UPLOADS, name));
  return '/uploads/' + name;
}

module.exports = { ready, missing, prepare, mask, subject, imagePath, status, keyOk, MODELS, BASE, WORK, FULL, cleanEdit, cleanEdits, editFor, saveMask, idOk, LAYER_TYPES };
