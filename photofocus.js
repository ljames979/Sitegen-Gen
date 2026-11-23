// Batch photo tools (Leo, 2026-11-23), run from the Photos page of a site (/sites/:id/photos/batch):
//   Smart crop all   the cut-out model (cutout.js, on this computer) finds the pet, person or thing in every photo of
//                    the site; each photo then keeps its subject in view wherever a block crops it (phones and
//                    computers alike), by setting where the crop is centred (object-position / background-position).
//                    Kept as sections.photoFocus { on, map: { photo address: [x %, y %] } }; it can be switched off.
//   Cut out all      every "Pets cut out" photo block whose photos are not cut out yet gets its cut-outs in one go.
// Photos are never changed or replaced by the smart crop: only where they are centred.
'use strict';

const cutout = require('./cutout');
const photoBlend = require('./photoblend');

const PHOTO_RE = /(\/uploads\/[A-Za-z0-9._-]+\.(?:jpe?g|png|webp))|(https:\/\/(?:images\.pexels\.com|images\.unsplash\.com|plus\.unsplash\.com|cdn\.pixabay\.com)\/[^\s"'|)<>\\]+)/gi;
const VARIANT_RE = /-\d{2,4}\.webp$/i;
const MAX_PHOTOS = 80;

// every photo of the site (not the logo, cut-outs, photo-editor masks or resized copies)
function photoUrls(site) {
  const logo = ((site && site.theme) || {}).logoUrl || '';
  const src = JSON.stringify((site && site.sections) || {});
  const out = new Set();
  for (const m of src.matchAll(PHOTO_RE)) {
    const u = m[0];
    if (u === logo || /\/uploads\/(cut-|pe-)/.test(u) || VARIANT_RE.test(u) || /logo/i.test(u)) continue;
    out.add(u);
    if (out.size >= MAX_PHOTOS) break;
  }
  return [...out];
}

// where the subject is, from its see-through mask (0..255 per pixel, W x H): a point a little above its middle, so heads
// stay in when the crop is tight. null when there is no clear subject (nothing found, or it fills the whole photo).
function focusFromAlpha(alpha, W, H) {
  let n = 0, sx = 0, sy = 0, top = H, bottom = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (alpha[y * W + x] < 128) continue;
    n++; sx += x; sy += y;
    if (y < top) top = y;
    if (y > bottom) bottom = y;
  }
  const share = n / (W * H);
  if (share < 0.02 || share > 0.92) return null;
  const cx = sx / n, cy = sy / n;
  const y = Math.min(cy, top + (bottom - top) * 0.4);
  const pct = (v, size) => Math.max(0, Math.min(100, Math.round((v + 0.5) / size * 100)));
  return [pct(cx, W), pct(y, H)];
}

async function focusFor(url) {
  const buf = await cutout.photoBytes(url);
  const sharp = require('sharp');
  const meta = await sharp(buf, { failOn: 'none' }).rotate().metadata();
  const ratio = (meta.width || 1) / (meta.height || 1);
  const W = ratio >= 1 ? 128 : Math.max(16, Math.round(128 * ratio)), H = ratio >= 1 ? Math.max(16, Math.round(128 / ratio)) : 128;
  const small = await sharp(buf, { failOn: 'none' }).rotate().resize(W, H, { fit: 'fill' }).toBuffer();
  return focusFromAlpha(await cutout.alphaFor(small, W, H), W, H);
}

function clean(f) {
  const o = f && typeof f === 'object' ? f : {};
  const map = {};
  for (const [k, v] of Object.entries(o.map || {}).slice(0, 200)) {
    if (k.length > 500 || !(Array.isArray(v) && v.length === 2)) continue;
    const x = Math.round(+v[0]), y = Math.round(+v[1]);
    if (x >= 0 && x <= 100 && y >= 0 && y <= 100) map[k] = [x, y];
  }
  return { on: !!o.on, map, at: String(o.at || '').slice(0, 30) };
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// the page with every known photo centred on its subject (run before images.optimizeHtml, which renames photos)
function apply(html, site) {
  const f = clean(((site && site.sections) || {}).photoFocus);
  if (!f.on) return html;
  const entries = Object.entries(f.map).filter(([u, p]) => !(p[0] === 50 && p[1] === 50));
  if (!entries.length) return html;
  let out = html;
  for (const [u, [x, y]] of entries) {
    const ue = esc(u).replace(/&/g, '(?:&|&amp;)');
    // <img src="u" ...>: object-position, unless the tag already sets one
    out = out.replace(new RegExp(`<img\\b[^>]*\\bsrc="${ue}"[^>]*>`, 'g'), (tag) => {
      if (/object-position/.test(tag)) return tag;
      if (/\bstyle="/.test(tag)) return tag.replace(/\bstyle="/, `style="object-position:${x}% ${y}%;`);
      return tag.replace(/^<img\b/, `<img style="object-position:${x}% ${y}%"`);
    });
    // style="...url('u')...": background-position after it, unless that style already sets one
    out = out.replace(new RegExp(`style="([^"]*url\\((?:'|&#39;|"|&quot;)?${ue}(?:'|&#39;|"|&quot;)?\\)[^"]*)"`, 'g'), (all, st) => (/background-position/.test(st) ? all : `style="${st};background-position:${x}% ${y}%"`));
  }
  return out;
}

// "Pets cut out" photo blocks with photos still to cut out: [{ where, index, photos: [url] }]
function waitingCutouts(site) {
  const items = (((site || {}).sections || {}).blocks || {}).items || [];
  const out = [];
  items.forEach((b, i) => {
    if (!b || b.type !== 'photoblend') return;
    const [, blend] = photoBlend.cleanSide(b.side).split(':');
    if (blend !== 'cut') return;
    const p = photoBlend.parse(b.body);
    const todo = p.photos.filter(u => !p.cutouts[u] && !/\/uploads\/cut-/.test(u) && (/\.(jpe?g|png|webp)$/i.test(u) || /^https:\/\//.test(u)));
    if (todo.length) out.push({ index: i, photos: todo });
  });
  return out;
}
// adds made cut-outs ({ photo: cut-out }) to those blocks
function addCutouts(sections, made) {
  const items = ((sections.blocks || {}).items || []).map(b => {
    if (!b || b.type !== 'photoblend') return b;
    const p = photoBlend.parse(b.body);
    let changed = false;
    for (const u of p.photos) if (!p.cutouts[u] && made[u]) { p.cutouts[u] = made[u]; changed = true; }
    if (!changed) return b;
    const lines = String(b.body || '').split('\n').filter(l => !/^cutouts:/.test(l.trim()));
    const prs = p.photos.filter(u => p.cutouts[u]).map(u => u + '|' + p.cutouts[u]);
    return { ...b, body: photoBlend.cleanBody(lines.concat(prs.length ? [`cutouts: ${prs.join(' ')}`] : []).join('\n')) };
  });
  return { ...sections, blocks: { ...(sections.blocks || {}), items } };
}

module.exports = { photoUrls, focusFromAlpha, focusFor, clean, apply, waitingCutouts, addCutouts, MAX_PHOTOS };
