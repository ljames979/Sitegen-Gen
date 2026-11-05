// "Photo with round-photo points" content block (Leo's link to a pet-advice template, 2026-11-01; our own version): a
// soft band runs across the top and bottom of the block; a big photo with a shadow sits on one side and reaches up
// into the top band; on the other side the heading, a thin line and up to 4 short points, each with a small round
// photo. The big photo takes 1 to 4 photos; with 2 or more they take turns (fade, shared fx [data-sg-tb-turns] in
// public/sg-fx.js; still for visitors who turn motion off). Nothing is made up: the words and photos are the owner's.
// Markup in views/_blocks.ejs, CSS in public/sg-site.css.
// The editor writes the block's body as lines (the owner never types this):
//   photos: /uploads/a.jpg /uploads/b.jpg     (the big photo, up to 4)
//   item: /uploads/c.jpg | A short point      (up to 4; the round photo may be empty)
// side: the big photo's side: left | right
const content = require('./library/content');
const contrast = require('./contrast');
const collageBlock = require('./collageblock');

const PHOTO = /^(https:\/\/|\/uploads\/)[^\s"'<>()|]+$/;
const HEX = /^#[0-9a-f]{6}$/i;
const MAX_PHOTOS = 4, MAX_ITEMS = 4;
const SIDES = [['left', 'Big photo on the left'], ['right', 'Big photo on the right']];
const flat = (v, n) => String(v || '').replace(/[|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const mix = (a, b, w) => { const x = contrast.parseHex(a), y = contrast.parseHex(b); return contrast.toHex(x.map((v, i) => v + (y[i] - v) * w)); };

function parse(v) {
  const out = { photos: [], items: [] };
  String(v || '').split('\n').forEach(l => {
    const m = /^(photos|item):\s?(.*)$/.exec(l.trim());
    if (!m) return;
    if (m[1] === 'photos') out.photos = m[2].split(/\s+/).filter(u => PHOTO.test(u) && u.length <= 500).slice(0, MAX_PHOTOS);
    else if (out.items.length < MAX_ITEMS) {
      const i = m[2].indexOf('|'), u = (i < 0 ? '' : m[2].slice(0, i)).trim(), t = flat(i < 0 ? m[2] : m[2].slice(i + 1), 400);
      const photo = PHOTO.test(u) && u.length <= 500 ? u : '';
      if (t || photo) out.items.push({ photo, text: t });
    }
  });
  return out;
}
function cleanBody(v) {
  const p = parse(v);
  return [].concat(p.photos.length ? [`photos: ${p.photos.join(' ')}`] : [], p.items.map(it => `item: ${it.photo} | ${it.text}`)).join('\n');
}
const cleanSide = (v) => (SIDES.some(s => s[0] === v) ? v : 'left');

function view(site, blk, services) {
  const b = blk || {}, own = parse(b.body), t = (site && site.theme) || {};
  const photos = own.photos.length ? own.photos : collageBlock.sitePhotos(site, (services || []).filter(x => x && x.title)).slice(0, 1);
  const brand = HEX.test(String(t.primaryColor || '')) ? t.primaryColor : '#2563eb';
  return {
    headingHtml: content.hlHtml(b.heading || ''),
    photos, turns: photos.length > 1,
    items: own.items,
    side: cleanSide(b.side),
    band: mix(mix(brand, '#cbd5e1', 0.82), '#ffffff', 0.1),
    button: b.buttonText && b.buttonUrl ? { text: b.buttonText, url: b.buttonUrl } : null
  };
}

module.exports = { parse, cleanBody, cleanSide, view, SIDES, MAX_PHOTOS, MAX_ITEMS };
