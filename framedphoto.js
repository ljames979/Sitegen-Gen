// "Photo in frames with a card" content block (Leo's link to a vegan restaurant template, 2026-11-03: "block"; our
// own drawing of the layout, no code, photos or wording from it). On a dark band a wide photo sits between two blocks
// of color that peek out at opposite corners like a loose frame; a white card overlaps the photo's lower corner with
// the heading in the frame color, the owner's words, a small note and an outlined round button. The photo sits on a
// soft square of the frame color, so a cut-out photo (✂ Cut out) stands on color. Nothing is made up.
// Markup in views/_blocks.ejs, CSS in public/sg-site.css.
// The editor writes the block's body as lines (the owner never types this):
//   text: A sentence or two          (up to 3 paragraphs)
//   note: Photo by our team          (optional small line)
//   color: #b9a383                   (the frame blocks, heading, button; empty = a warm tan)
//   bg: #2b2b2b                      (the band; empty = charcoal)
//   card: #ffffff                    (the card; empty = white)
// side: the card's side: right | left
const content = require('./library/content');
const contrast = require('./contrast');
const collageBlock = require('./collageblock');

const HEX = /^#[0-9a-f]{6}$/i;
const MAX_TEXT = 3;
const SIDES = [['right', 'Card at the lower right of the photo'], ['left', 'Card at the lower left of the photo']];
const flat = (v, n) => String(v || '').replace(/[|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const hex = (v) => (HEX.test(String(v || '').trim()) ? String(v).trim().toLowerCase() : '');

function parse(v) {
  const out = { text: [], note: '', color: '', bg: '', card: '' };
  String(v || '').split('\n').forEach(l => {
    const m = /^(text|note|color|bg|card):\s?(.*)$/.exec(l.trim());
    if (!m) return;
    if (m[1] === 'text') { const t = flat(m[2], 700); if (t && out.text.length < MAX_TEXT) out.text.push(t); }
    else if (m[1] === 'note') out.note = flat(m[2], 140);
    else out[m[1]] = hex(m[2]);
  });
  return out;
}
function cleanBody(v) {
  const p = parse(v), l = p.text.map(t => `text: ${t}`);
  if (p.note) l.push(`note: ${p.note}`);
  ['color', 'bg', 'card'].forEach(k => { if (p[k]) l.push(`${k}: ${p[k]}`); });
  return l.join('\n');
}
const cleanSide = (v) => (SIDES.some(s => s[0] === v) ? v : 'right');

function view(site, blk, services) {
  const b = blk || {}, own = parse(b.body), s = (site && site.sections) || {};
  let photo = b.imageUrl || '';
  if (!photo) { const a = (s.about || {}).imageUrl; const pics = collageBlock.sitePhotos(site, (services || []).filter(x => x && x.title)); photo = a && pics.includes(a) ? a : pics[0] || ''; }
  const color = own.color || '#b9a383', card = own.card || '#ffffff', ink = contrast.textOn(card);
  return {
    headingHtml: content.hlHtml(b.heading || ''),
    text: own.text, note: own.note,
    photo, cut: /\/cut-[^/]*$/.test(photo),
    color, bg: own.bg || '#2b2b2b', card, ink, headColor: contrast.ensureContrast(color, card, 3),
    side: cleanSide(b.side),
    button: b.buttonText && b.buttonUrl ? { text: b.buttonText, url: b.buttonUrl } : null
  };
}

module.exports = { parse, cleanBody, cleanSide, view, SIDES, MAX_TEXT };
