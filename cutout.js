// Cut out the subject of a photo (Leo, 2026-11-02): finds the pet, person or thing in a photo and makes the rest
// see-through, so the "Photo that blends in" block (and anything else) can stand it on any color with no seam.
// It runs here, on this computer: no photo is sent to another service. It uses:
//   - IS-Net (DIS, "isnet-general-use"), Apache-2.0, by Xuebin Qin et al. (github.com/xuebinqin/DIS), the ONNX copy
//     published with rembg (github.com/danielgatis/rembg releases); downloaded once (~170 MB) into models/
//   - onnxruntime-node (MIT) to run it, and sharp (Apache-2.0) to read and write the pictures
// Both packages are optional: without them, cutting out says what to install instead of failing the app.
const fs = require('fs');
const path = require('path');

const MODEL_URL = 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx';
const MODEL_DIR = process.env.SG_MODEL_DIR || path.join(__dirname, 'models');
const MODEL = path.join(MODEL_DIR, 'isnet-general-use.onnx');
const SIZE = 1024;
const UPLOADS = path.join(__dirname, 'public', 'uploads');
// stock photo hosts a photo may be fetched from (the owner's own uploads are read from disk)
const HOSTS = ['images.pexels.com', 'images.unsplash.com', 'plus.unsplash.com', 'cdn.pixabay.com'];

let ort = null, sharp = null;
try { ort = require('onnxruntime-node'); } catch (e) { /* optional */ }
try { sharp = require('sharp'); } catch (e) { /* optional */ }

const ready = () => !!(ort && sharp);
const missing = () => [!ort && 'onnxruntime-node', !sharp && 'sharp'].filter(Boolean);

let session = null, loading = null;
async function download() {
  fs.mkdirSync(MODEL_DIR, { recursive: true });
  const tmp = MODEL + '.part';
  const r = await fetch(MODEL_URL);
  if (!r.ok) throw new Error('Could not download the cut-out model (' + r.status + ')');
  fs.writeFileSync(tmp, Buffer.from(await r.arrayBuffer()));
  if (fs.statSync(tmp).size < 50 * 1024 * 1024) { fs.unlinkSync(tmp); throw new Error('The cut-out model download was incomplete'); }
  fs.renameSync(tmp, MODEL);
}
async function getSession() {
  if (session) return session;
  if (!loading) loading = (async () => {
    if (!fs.existsSync(MODEL)) await download();
    session = await ort.InferenceSession.create(MODEL);
    return session;
  })().finally(() => { loading = null; });
  return loading;
}

// the photo's bytes: an upload of this app (from disk) or a stock photo (fetched)
async function photoBytes(src) {
  const s = String(src || '');
  const local = /^\/uploads\/([A-Za-z0-9._-]+)$/.exec(s);
  if (local) {
    const file = path.join(UPLOADS, local[1]);
    if (!file.startsWith(UPLOADS) || !fs.existsSync(file)) throw new Error('That photo is not in this app\'s uploads');
    return fs.readFileSync(file);
  }
  let u; try { u = new URL(s); } catch (e) { throw new Error('Not a photo address'); }
  if (u.protocol !== 'https:' || !HOSTS.includes(u.hostname)) throw new Error('Only your uploads and stock photos can be cut out');
  const r = await fetch(u.href, { redirect: 'error' });
  const type = String(r.headers.get('content-type') || '');
  if (!r.ok || !/^image\//.test(type)) throw new Error('Could not fetch that photo');
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 20 * 1024 * 1024) throw new Error('That photo is too big');
  return buf;
}

// Cut out one photo: returns { url } of a new see-through WebP in the uploads, the same size and framing as the photo
// (so it sits exactly where the photo did), up to 1920 px wide.
async function cutout(src) {
  if (!ready()) throw new Error('Cutting out needs ' + missing().join(' and ') + ': run "npm install" in the SiteGen folder, then restart SiteGen');
  const input = await photoBytes(src);
  const base = sharp(input, { failOn: 'none' }).rotate();
  const meta = await base.clone().resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true }).toBuffer({ resolveWithObject: true });
  const W = meta.info.width, H = meta.info.height;
  // the model looks at a 1024 x 1024 copy; colors scaled to 0..1 and centered (mean .5, spread 1)
  const px = await sharp(meta.data).removeAlpha().resize(SIZE, SIZE, { fit: 'fill' }).raw().toBuffer();
  const t = new Float32Array(3 * SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) for (let c = 0; c < 3; c++) t[c * SIZE * SIZE + i] = px[i * 3 + c] / 255 - 0.5;
  const s = await getSession();
  const out = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', t, [1, 3, SIZE, SIZE]) });
  const m = out[s.outputNames[0]].data;
  let lo = Infinity, hi = -Infinity; for (let i = 0; i < SIZE * SIZE; i++) { if (m[i] < lo) lo = m[i]; if (m[i] > hi) hi = m[i]; }
  const a = Buffer.alloc(SIZE * SIZE);
  // scaled to 0..1, with the faintest edge haze (the old backdrop showing through) dropped
  for (let i = 0; i < SIZE * SIZE; i++) a[i] = Math.round(Math.max(0, Math.min(1, ((m[i] - lo) / ((hi - lo) || 1) - .06) / .9)) * 255);
  const alpha = await sharp(a, { raw: { width: SIZE, height: SIZE, channels: 1 } }).resize(W, H, { fit: 'fill' }).toColourspace('b-w').raw().toBuffer();
  const rgb = await sharp(meta.data).removeAlpha().raw().toBuffer();
  const name = 'cut-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + '.webp';
  await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).joinChannel(alpha, { raw: { width: W, height: H, channels: 1 } }).webp({ quality: 88, alphaQuality: 100 }).toFile(path.join(UPLOADS, name));
  return { url: '/uploads/' + name, width: W, height: H };
}

module.exports = { cutout, ready, missing, MODEL, MODEL_URL, HOSTS };
