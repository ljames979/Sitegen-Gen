// "Round photo with a color card" content block (Leo's link to a quick reading courses template, 2026-11-03: "block";
// our own drawing of the layout, no code, photos or wording from it). A big round photo on a soft circle of color, with
// rings and dots around it, and a card in that color overlapping its lower corner with the heading, the owner's
// words, a small note and a light button. A photo with its background cut out (✂ Cut out) stands in the circle.
// Nothing is made up. Markup in views/_blocks.ejs, CSS in public/sg-site.css.
// The editor writes the block's body as lines (the owner never types this):
//   text: A sentence or two          (up to 3 paragraphs)
//   note: Photo by our team          (optional small line)
//   color: #2ec4b6                   (card, circle, rings and dots; empty = brand color)
//   bg: #ffffff                      (the band; empty = the page color)
//   shapes: off                      (leave out for the rings and dots)
// side: the card's side: right | left
const content = require('./library/content');
const contrast = require('./contrast');
const collageBlock = require('./collageblock');

const HEX = /^#[0-9a-f]{6}$/i;
const MAX_TEXT = 3;
const SIDES = [['right', 'Card at the lower right of the round photo'], ['left', 'Card at the lower left of the round photo']];
const flat = (v, n) => String(v || '').replace(/[|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const hex = (v) => (HEX.test(String(v || '').trim()) ? String(v).trim().toLowerCase() : '');

function parse(v) {
  const out = { text: [], note: '', color: '', bg: '', shapes: true };
  String(v || '').split('\n').forEach(l => {
    const m = /^(text|note|color|bg|shapes):\s?(.*)$/.exec(l.trim());
    if (!m) return;
    if (m[1] === 'text') { const t = flat(m[2], 700); if (t && out.text.length < MAX_TEXT) out.text.push(t); }
    else if (m[1] === 'note') out.note = flat(m[2], 140);
    else if (m[1] === 'shapes') out.shapes = m[2].trim() !== 'off';
    else out[m[1]] = hex(m[2]);
  });
  return out;
}
function cleanBody(v) {
  const p = parse(v), l = p.text.map(t => `text: ${t}`);
  if (p.note) l.push(`note: ${p.note}`);
  ['color', 'bg'].forEach(k => { if (p[k]) l.push(`${k}: ${p[k]}`); });
  if (!p.shapes) l.push('shapes: off');
  return l.join('\n');
}
const cleanSide = (v) => (SIDES.some(s => s[0] === v) ? v : 'right');

function view(site, blk, services) {
  const b = blk || {}, own = parse(b.body), s = (site && site.sections) || {}, t = (site && site.theme) || {};
  let photo = b.imageUrl || '';
  if (!photo) { const a = (s.about || {}).imageUrl; const pics = collageBlock.sitePhotos(site, (services || []).filter(x => x && x.title)); photo = a && pics.includes(a) ? a : pics[0] || ''; }
  const color = own.color || hex(t.primaryColor) || '#2ec4b6';
  return {
    headingHtml: content.hlHtml(b.heading || ''),
    text: own.text, note: own.note, shapes: own.shapes,
    photo, cut: /\/cut-[^/]*$/.test(photo),
    color, on: contrast.textOn(color), bg: own.bg,
    side: cleanSide(b.side),
    button: b.buttonText && b.buttonUrl ? { text: b.buttonText, url: b.buttonUrl } : null
  };
}

module.exports = { parse, cleanBody, cleanSide, view, SIDES, MAX_TEXT };
