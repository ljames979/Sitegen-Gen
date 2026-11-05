// "Words and photo with rings" content block (Leo's link to a dog behavior template, 2026-11-03: "create a block";
// our own drawing of the layout, no code, photos or wording from it). A white words panel and a big photo sit edge to
// edge on a softly tinted band; a striped circle peeks out behind the panel's top corner and a thick ring behind the
// photo's bottom corner. The heading, the shapes and the button share one color; the photo sits on a soft square of
// that color, so a cut-out photo (✂ Cut out) stands on color. Nothing is made up: the words and photo are the owner's.
// Markup in views/_blocks.ejs, CSS in public/sg-site.css.
// The editor writes the block's body as lines (the owner never types this):
//   text: A sentence or two          (up to 3 paragraphs)
//   note: Photo by our team          (optional small line under the words)
//   color: #d9505e                   (heading, shapes, button; empty = brand color)
//   bg: #fbecec                      (the band behind; empty = a soft tint of the color)
//   shapes: off                      (leave out for the striped circle and the ring)
// side: the photo's side: right | left
const content = require('./library/content');
const contrast = require('./contrast');
const collageBlock = require('./collageblock');

const HEX = /^#[0-9a-f]{6}$/i;
const MAX_TEXT = 3;
const SIDES = [['right', 'Photo on the right, words on the left'], ['left', 'Photo on the left, words on the right']];
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
  if (p.color) l.push(`color: ${p.color}`);
  if (p.bg) l.push(`bg: ${p.bg}`);
  if (!p.shapes) l.push('shapes: off');
  return l.join('\n');
}
const cleanSide = (v) => (SIDES.some(s => s[0] === v) ? v : 'right');

function view(site, blk, services) {
  const b = blk || {}, own = parse(b.body), s = (site && site.sections) || {}, t = (site && site.theme) || {};
  let photo = b.imageUrl || '';
  if (!photo) { const a = (s.about || {}).imageUrl; const pics = collageBlock.sitePhotos(site, (services || []).filter(x => x && x.title)); photo = a && pics.includes(a) ? a : pics[0] || ''; }
  const color = own.color || hex(t.primaryColor) || '#d9505e';
  return {
    headingHtml: content.hlHtml(b.heading || ''),
    text: own.text, note: own.note, shapes: own.shapes,
    photo, cut: /\/cut-[^/]*$/.test(photo),
    color, headColor: contrast.ensureContrast(color, '#ffffff', 3), colorOn: contrast.textOn(color), bg: own.bg,
    side: cleanSide(b.side),
    button: b.buttonText && b.buttonUrl ? { text: b.buttonText, url: b.buttonUrl } : null
  };
}

module.exports = { parse, cleanBody, cleanSide, view, SIDES, MAX_TEXT };
