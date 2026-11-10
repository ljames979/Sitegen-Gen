// Shrinks and tidies uploaded photos so phone-camera originals (often 5-10 MB,
// 4000+ px wide, sometimes sideways) don't make published sites slow or
// misrotated. Best-effort: if the optional `sharp` package isn't available, or
// anything goes wrong, the original upload is simply kept.
//
// Speed pass: next to every raster upload we also write smaller WebP copies
// ("<name>-480.webp", "-960", "-1440", "-1920"). optimizeHtml() then adds
// srcset/sizes so phones download a small copy, makes hero photos WebP and
// preloaded, and lazy-loads everything below the fold. Photos uploaded before
// this existed get their copies made the first time a page that uses them is
// shown (see ensureVariants), so nothing needs migrating by hand.
const fs = require('fs');
const path = require('path');

let sharp = null;
try { sharp = require('sharp'); } catch { /* optional */ }

const UPLOADS = path.join(__dirname, 'public', 'uploads');
const SUPPORTED = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const WIDTHS = [480, 960, 1440, 1920];
const VARIANT_RE = /^(.+)-(\d{3,4})\.webp$/;

async function optimizeUpload(file, maxSize = 1920) {
  if (!sharp || !file || !file.path) return;
  const ext = path.extname(file.path).toLowerCase();
  if (!SUPPORTED.has(ext)) return; // gif/svg are left untouched
  const tmp = `${file.path}.tmp`;
  try {
    let img = sharp(file.path, { failOn: 'none' })
      .rotate() // apply the camera's EXIF orientation, then drop it
      .resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true });
    if (ext === '.png') img = img.png({ compressionLevel: 9 });
    else if (ext === '.webp') img = img.webp({ quality: 82 });
    else img = img.jpeg({ quality: 82, mozjpeg: true });
    await img.toFile(tmp);
    if (fs.statSync(tmp).size < fs.statSync(file.path).size) {
      fs.renameSync(tmp, file.path);
    } else {
      fs.rmSync(tmp, { force: true });
    }
  } catch {
    fs.rmSync(tmp, { force: true });
  }
  await makeVariants(file.path);
}

// Writes the WebP copies for one uploaded file. Returns the widths written.
async function makeVariants(filePath) {
  if (!sharp) return [];
  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED.has(ext)) return [];
  const base = filePath.slice(0, -ext.length);
  try {
    const meta = await sharp(filePath, { failOn: 'none' }).rotate().metadata();
    // metadata() reports the stored size; sideways photos swap width/height
    const w = (meta.orientation && meta.orientation >= 5) ? meta.height : meta.width;
    if (!w || w < 400) return [];
    const top = Math.min(w, 1920);
    const widths = WIDTHS.filter(x => x < top).concat(top);
    const done = [];
    for (const x of widths) {
      const out = `${base}-${x}.webp`;
      await sharp(filePath, { failOn: 'none' }).rotate().resize({ width: x, withoutEnlargement: true })
        .webp({ quality: x <= 960 ? 76 : 80 }).toFile(`${out}.tmp`);
      fs.renameSync(`${out}.tmp`, out);
      done.push(x);
    }
    invalidateIndex();
    return done;
  } catch {
    try { for (const x of WIDTHS) fs.rmSync(`${base}-${x}.webp.tmp`, { force: true }); } catch { /* ignore */ }
    return [];
  }
}

// ---- index of which uploads have WebP copies ----
let index = null, indexStamp = 0, indexDir = null;
function invalidateIndex() { index = null; }
function loadIndex(dir) {
  let stamp = 0;
  try { stamp = fs.statSync(dir).mtimeMs; } catch { return new Map(); }
  if (index && indexDir === dir && stamp === indexStamp) return index;
  const map = new Map();
  let names = [];
  try { names = fs.readdirSync(dir); } catch { /* none */ }
  for (const n of names) {
    const m = VARIANT_RE.exec(n);
    if (!m) continue;
    if (!map.has(m[1])) map.set(m[1], []);
    map.get(m[1]).push(+m[2]);
  }
  for (const list of map.values()) list.sort((a, b) => a - b);
  index = map; indexStamp = stamp; indexDir = dir;
  return map;
}

function variantsFor(filename, dir = UPLOADS) {
  const ext = path.extname(filename);
  const base = filename.slice(0, filename.length - ext.length);
  return (loadIndex(dir).get(base) || []).map(w => ({ width: w, file: `${base}-${w}.webp` }));
}

// Photos uploaded before the speed pass: make their copies in the background,
// once, and tell the caller when done so cached pages can be refreshed.
const attempted = new Set();
let queue = Promise.resolve();
function ensureVariants(filename, dir, onDone) {
  if (!sharp || attempted.has(filename) || VARIANT_RE.test(filename)) return; // never make copies of copies
  const ext = path.extname(filename).toLowerCase();
  if (!SUPPORTED.has(ext)) return;
  attempted.add(filename);
  queue = queue.then(async () => {
    const p = path.join(dir, filename);
    if (!fs.existsSync(p)) return;
    const done = await makeVariants(p);
    if (done.length && onDone) onDone(filename);
  }).catch(() => {});
}

function attr(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }

const SIZES = '(max-width: 600px) 100vw, 1200px';

// Stock photos (Pexels, Unsplash) are resized by those services from the URL. Photos in <img> tags get a srcset so
// each screen downloads a sharp copy of the right size; every other use (full-width hero and section backgrounds,
// the hero photo data attributes) gets a big 2400px copy so it stays sharp across a wide screen.
const { sizedStock } = require('./photos');
const STOCK_WIDTHS = [640, 1080, 1600, 2400];
const STOCK_ANY = /https:\/\/(?:images\.pexels\.com\/photos|images\.unsplash\.com|plus\.unsplash\.com)\/[^\s"'()<>\\]+/g;
const ampOf = u => (u.includes('&amp;') || !u.includes('&') ? '&amp;' : '&');
function sharpenStock(html, mainAt) {
  // everything outside <img src>: the biggest copy. Inside a <style> element '&amp;' would not be decoded, so
  // the separator found in the URL is kept.
  html = html.replace(STOCK_ANY, (u) => sizedStock(u, 2400, u.includes('&amp;') ? '&amp;' : (u.includes('&') ? '&' : '&amp;')));
  return html.replace(/<img\b[^>]*>/g, (tag) => {
    const m = /\bsrc="(https:\/\/(?:images\.pexels\.com\/photos|images\.unsplash\.com|plus\.unsplash\.com)\/[^"]+)"/.exec(tag);
    if (!m || /\bsrcset=/.test(tag)) return tag;
    const amp = ampOf(m[1]);
    const srcset = STOCK_WIDTHS.map(w => `${sizedStock(m[1], w, amp)} ${w}w`).join(', ');
    return tag.replace(m[0], `src="${sizedStock(m[1], 1600, amp)}"`).replace(/^<img\b/, `<img srcset="${srcset}" sizes="${SIZES}"`);
  });
}

// Post-processes a rendered page: srcset + lazy-loading on photos, a WebP
// preloaded hero. `opts.dir` is the uploads folder, `opts.onVariants` is called
// when background conversion of an older photo finishes.
function optimizeHtml(html, opts = {}) {
  const dir = opts.dir || UPLOADS;
  const mainAt = html.indexOf('<main');
  const missing = new Set();
  const note = (name) => { if (!variantsFor(name, dir).length) missing.add(name); };
  html = sharpenStock(html, mainAt);

  html = html.replace(/<img\b[^>]*>/g, (tag, offset) => {
    const m = /\bsrc="\/uploads\/([A-Za-z0-9._-]+)"/.exec(tag);
    if (!m) return tag;
    const name = m[1];
    let out = tag;
    const vs = variantsFor(name, dir);
    if (!vs.length) note(name);
    else if (!/\bsrcset=/.test(tag) && (mainAt < 0 || offset > mainAt)) { // not the header logo
      const srcset = vs.map(v => `/uploads/${v.file} ${v.width}w`).join(', ');
      out = out.replace(/^<img\b/, `<img srcset="${attr(srcset)}" sizes="${SIZES}"`);
    }
    // below the fold (after <main) and not already marked: lazy
    if (mainAt >= 0 && offset > mainAt && !/\bloading=/.test(out)) out = out.replace(/^<img\b/, '<img loading="lazy"');
    if (!/\bdecoding=/.test(out)) out = out.replace(/^<img\b/, '<img decoding="async"');
    return out;
  });

  // hero photo: use the biggest WebP copy and preload it
  const hm = /data-hero-photo="\/uploads\/([A-Za-z0-9._-]+)"/.exec(html);
  if (hm) {
    const vs = variantsFor(hm[1], dir);
    if (!vs.length) note(hm[1]);
    else {
      const best = `/uploads/${vs[vs.length - 1].file}`;
      html = html.split(`url('/uploads/${hm[1]}')`).join(`url('${best}')`).split(`data-hero-photo="/uploads/${hm[1]}"`).join(`data-hero-photo="${best}"`);
      html = html.replace('</head>', `<link rel="preload" as="image" href="${best}" fetchpriority="high">\n</head>`);
    }
  }

  // every other photo drawn as a CSS background (block backgrounds, cut-outs, cards, the photo editor's results):
  // the same picture as a WebP copy, which is several times lighter than a JPG or PNG of the same size (Leo, 2026-11-10)
  html = html.replace(/url\((['"]?)\/uploads\/([A-Za-z0-9._-]+)\1\)/g, (all, q, name) => {
    if (VARIANT_RE.test(name) || !SUPPORTED.has(path.extname(name).toLowerCase()) || /\.webp$/i.test(name)) return all;
    const vs = variantsFor(name, dir);
    if (!vs.length) { note(name); return all; }
    return `url(${q}/uploads/${vs[vs.length - 1].file}${q})`;
  });

  if (missing.size && opts.onVariants) for (const n of missing) ensureVariants(n, dir, opts.onVariants);
  return html;
}

// Names of /uploads/ files a site uses, for the pre-launch audit
function uploadsUsed(value) {
  const found = new Set();
  const re = /\/uploads\/([A-Za-z0-9._-]+)/g;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  let m;
  while ((m = re.exec(text))) found.add(m[1]);
  return [...found];
}

module.exports = { optimizeUpload, makeVariants, variantsFor, ensureVariants, optimizeHtml, uploadsUsed, available: !!sharp, UPLOADS, WIDTHS };
