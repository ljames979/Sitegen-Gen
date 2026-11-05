// "Card over a color band" content block (Leo's link to a pet template, 2026-11-01; our own version): a wide color band
// runs in from the left edge behind a tall photo and on behind a colored card that overlaps it. The card holds the
// heading in capitals, a paragraph and a button. Under the photo: a colored line and a short checklist. Low on the
// right a second photo sits on a soft backdrop and runs to the page edge.
// Photos swap like the other blocks: each spot takes up to 4 and they fade in turn (fx in public/sg-fx.js, shared with
// the "Photo, words and a big letter" block). The card and band colors are the owner's picks, or worked out from
// the brand colors; the card's words turn light or dark to stay readable. Nothing is made up.
// Markup in views/_blocks.ejs, CSS in public/sg-site.css.
// The editor writes the block's body as lines (the owner never types this):
//   text: The card's paragraph
//   list: Dogs improve your mood:      (the colored line over the checklist)
//   item: A point                      (up to 6)
//   left: /uploads/a.jpg ...           (the tall photo, up to 4)
//   right: /uploads/b.jpg ...          (the corner photo, up to 4)
//   card: #e58593                      (empty = the brand color)
//   band: #a9c9e8                      (empty = a light take on the accent color)
const content = require('./library/content');
const contrast = require('./contrast');
const collageBlock = require('./collageblock');

const PHOTO = /^(https:\/\/|\/uploads\/)[^\s"'<>()]+$/;
const HEX = /^#[0-9a-f]{6}$/i;
const MAX_PHOTOS = 4, MAX_ITEMS = 6;
const flat = (v, n) => String(v || '').replace(/[|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const photos = (v) => String(v || '').split(/\s+/).filter(u => PHOTO.test(u) && u.length <= 500).slice(0, MAX_PHOTOS);
const mix = (a, b, w) => { const x = contrast.parseHex(a), y = contrast.parseHex(b); return contrast.toHex(x.map((v, i) => v + (y[i] - v) * w)); };

function parse(v) {
  const out = { text: '', list: '', items: [], left: [], right: [], card: '', band: '' };
  String(v || '').split('\n').forEach(l => {
    const m = /^(text|list|item|left|right|card|band):\s?(.*)$/.exec(l.trim());
    if (!m) return;
    const k = m[1], val = m[2];
    if (k === 'text') out.text = flat(val, 900);
    else if (k === 'list') out.list = flat(val, 120);
    else if (k === 'item') { const t = flat(val, 140); if (t && out.items.length < MAX_ITEMS) out.items.push(t); }
    else if (k === 'left' || k === 'right') out[k] = photos(val);
    else if (HEX.test(val.trim())) out[k] = val.trim().toLowerCase();
  });
  return out;
}
function cleanBody(v) {
  const p = parse(v);
  return [].concat(p.text ? [`text: ${p.text}`] : [], p.list ? [`list: ${p.list}`] : [], p.items.map(t => `item: ${t}`),
    p.left.length ? [`left: ${p.left.join(' ')}`] : [], p.right.length ? [`right: ${p.right.join(' ')}`] : [],
    p.card ? [`card: ${p.card}`] : [], p.band ? [`band: ${p.band}`] : []).join('\n');
}

// The colors: card = owner's pick or the brand color; band = owner's pick or a light take on the accent color;
// the card's words light or dark; the checklist line in the card color, darkened until it reads on the page
function colors(own, theme) {
  const t = theme || {};
  const brand = HEX.test(String(t.primaryColor || '')) ? t.primaryColor.toLowerCase() : '#2563eb';
  const accent = HEX.test(String(t.accentColor || '')) ? t.accentColor.toLowerCase() : brand;
  const card = own.card || brand, band = own.band || mix(accent, '#ffffff', 0.62);
  return { card, band, ink: contrast.textOn(card), soft: mix(band, '#ffffff', 0.45), line: contrast.ensureContrast(card, '#ffffff', 3) };
}

function view(site, blk, services) {
  const b = blk || {}, own = parse(b.body);
  const pics = collageBlock.sitePhotos(site, (services || []).filter(x => x && x.title));
  const left = own.left.length ? own.left : pics.slice(0, 1), right = own.right.length ? own.right : pics.slice(1, 2);
  const c = colors(own, (site || {}).theme);
  return {
    headingHtml: content.hlHtml(b.heading || ''),
    text: own.text, list: own.list, items: own.items,
    left, right, turns: left.length > 1 || right.length > 1,
    style: `--cb-card: ${c.card}; --cb-ink: ${c.ink}; --cb-band: ${c.band}; --cb-soft: ${c.soft}; --cb-line: ${c.line}`,
    button: b.buttonText && b.buttonUrl ? { text: b.buttonText, url: b.buttonUrl } : null
  };
}

module.exports = { parse, cleanBody, colors, view, MAX_PHOTOS, MAX_ITEMS };
