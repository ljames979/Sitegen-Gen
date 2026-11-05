// "Photo that blends in" hero block (Leo's link to a sale-banner template, 2026-11-02; our own version): the words sit
// on one side (a small line in spaced capitals, the big heading, a highlighted box, a short line and a button) and a
// photo fills the other side, edge to edge. The photo melts into the block two ways, alone or together:
//   match: the block takes the color along the photo's edge (worked out in the visitor's browser from the photo,
//          public/sg-fx.js), so a photo shot on a plain backdrop looks like it stands in the block; or the owner's color
//   fade:  the photo's edge facing the words fades softly into the block's color
// Photos swap like the other blocks: 1 to 4 fade in turn (shared [data-sg-tb-turns] fx; still for visitors who turn
// motion off), and with "match" the block's color follows each photo. Nothing is made up: words and photos are the
// owner's (empty photos = the site's own). Markup in views/_blocks.ejs, CSS in public/sg-site.css.
// The editor writes the block's body as lines (the owner never types this):
//   top: SUPER OFFER                (small line over the heading)
//   badge: USE CODE: HAPPY50        (the highlighted box)
//   note: ONLY TODAY                (the line under the box)
//   photos: /uploads/a.jpg ...      (1 to 4)
//   color: #ececec                  (the block's color; empty = matched from the photo)
// side: "<photo side>:<blend>", e.g. right:both
const content = require('./library/content');
const contrast = require('./contrast');
const collageBlock = require('./collageblock');

const PHOTO = /^(https:\/\/|\/uploads\/)[^\s"'<>()|]+$/;
const HEX = /^#[0-9a-f]{6}$/i;
const MAX_PHOTOS = 4;
const SIDES = [['right', 'Photo on the right'], ['left', 'Photo on the left']];
const BLENDS = [['both', 'Match the photo\'s color and fade its edge'], ['match', 'Match the photo\'s color only'], ['fade', 'Fade the photo\'s edge only'], ['cut', 'Pets cut out, standing on any color']];
const flat = (v, n) => String(v || '').replace(/[|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

function parse(v) {
  const out = { top: '', badge: '', note: '', photos: [], color: '', cutouts: {} };
  String(v || '').split('\n').forEach(l => {
    const m = /^(top|badge|note|photos|color|cutouts):\s?(.*)$/.exec(l.trim());
    if (!m) return;
    // cut-out copies of the photos (cutout.js): photo|cut-out pairs; only cut-outs made here (/uploads/cut-...)
    if (m[1] === 'cutouts') m[2].split(/\s+/).forEach(pr => { const [a, c] = pr.split('|'); if (a && PHOTO.test(a) && a.length <= 500 && /^\/uploads\/cut-[a-z0-9]+\.(webp|png)$/.test(c || '')) out.cutouts[a] = c; });
    else if (m[1] === 'photos') out.photos = m[2].split(/\s+/).filter(u => PHOTO.test(u) && u.length <= 500).slice(0, MAX_PHOTOS);
    else if (m[1] === 'color') out.color = HEX.test(m[2].trim()) ? m[2].trim().toLowerCase() : '';
    else out[m[1]] = flat(m[2], m[1] === 'badge' ? 60 : 120);
  });
  return out;
}
function cleanBody(v) {
  const p = parse(v);
  return [].concat(p.top ? [`top: ${p.top}`] : [], p.badge ? [`badge: ${p.badge}`] : [], p.note ? [`note: ${p.note}`] : [],
    p.photos.length ? [`photos: ${p.photos.join(' ')}`] : [], p.color ? [`color: ${p.color}`] : [], cutLine(p)).join('\n');
}
// the cut-outs of the photos still in the list
function cutLine(p) { const prs = p.photos.filter(u => p.cutouts[u]).map(u => u + '|' + p.cutouts[u]); return prs.length ? [`cutouts: ${prs.join(' ')}`] : []; }
function cleanSide(v) {
  const [s, b] = String(v || '').split(':');
  return (SIDES.some(x => x[0] === s) ? s : 'right') + ':' + (BLENDS.some(x => x[0] === b) ? b : 'both');
}

function view(site, blk, services) {
  const b = blk || {}, own = parse(b.body);
  let photos = own.photos.length ? own.photos : collageBlock.sitePhotos(site, (services || []).filter(x => x && x.title)).slice(0, 1);
  const [side, blend] = cleanSide(b.side).split(':');
  // cut out: the pets stand on the block's own color (the owner's, else a light shade of the brand color)
  const cut = blend === 'cut';
  if (cut) photos = photos.map(u => own.cutouts[u] || u);
  const cutColor = own.color || mixHex('#ffffff', /^#[0-9a-f]{6}$/i.test(String(((site || {}).theme || {}).primaryColor || '')) ? site.theme.primaryColor : '#2563eb', 0.18);
  return {
    cut, uncut: cut ? photos.filter(u => !/^\/uploads\/cut-/.test(u)).length : 0,
    headingHtml: content.hlHtml(b.heading || ''),
    top: own.top, badge: own.badge, note: own.note,
    photos, turns: photos.length > 1, side, blend,
    match: blend !== 'fade' && !cut,
    // the owner's own color is set here; otherwise the browser matches it from the photo (only when matching)
    style: cut ? `--pb-bg: ${cutColor}; --pb-ink: ${contrast.textOn(cutColor)}` : own.color && blend !== 'fade' ? `--pb-bg: ${own.color}; --pb-ink: ${contrast.textOn(own.color)}` : '',
    ownColor: !!own.color,
    button: b.buttonText && b.buttonUrl ? { text: b.buttonText, url: b.buttonUrl } : null
  };
}

const mixHex = (a, b, w) => { const x = contrast.parseHex(a), y = contrast.parseHex(b); return contrast.toHex(x.map((v, i) => v + (y[i] - v) * w)); };

module.exports = { parse, cleanBody, cleanSide, view, SIDES, BLENDS, MAX_PHOTOS };
