// "Photo on two color blocks" content block (Leo's link to a psychology services template, 2026-11-03: "block ...
// should be fully editable"; our own drawing of the layout, no code, photos or wording from it). A photo sits on two
// offset blocks of soft color, one peeking out at the top on the outer side and one at the bottom on the inner side;
// beside it a small spaced label, a big heading, the owner's words, a small note and a flat button. A photo with its
// background cut out (✂ Cut out) stands on a soft square of the first color. Nothing is made up.
// Markup in views/_blocks.ejs, CSS in public/sg-site.css.
// The editor writes the block's body as lines (the owner never types this):
//   label: About us                  (optional small spaced line over the heading)
//   text: A sentence or two          (up to 3 paragraphs)
//   note: Photo by our team          (optional small line)
//   color: #a9c4e2                   (the block at the top; empty = soft blue)
//   accent: #f2b0b5                  (the block at the bottom; empty = soft pink)
//   button: #6f98c6                  (the button; empty = a deeper shade of the first color)
//   bg: #ffffff                      (the band; empty = the page color)
//   shapes: off                      (leave out for the two color blocks)
// side: the photo's side: left | right
const content = require('./library/content');
const contrast = require('./contrast');
const collageBlock = require('./collageblock');

const HEX = /^#[0-9a-f]{6}$/i;
const MAX_TEXT = 3;
const COLORS = ['color', 'accent', 'button', 'bg'];
const SIDES = [['left', 'Photo on the left, words on the right'], ['right', 'Photo on the right, words on the left']];
const flat = (v, n) => String(v || '').replace(/[|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const hex = (v) => (HEX.test(String(v || '').trim()) ? String(v).trim().toLowerCase() : '');

function parse(v) {
  const out = { label: '', text: [], note: '', color: '', accent: '', button: '', bg: '', shapes: true };
  String(v || '').split('\n').forEach(l => {
    const m = /^(label|text|note|color|accent|button|bg|shapes):\s?(.*)$/.exec(l.trim());
    if (!m) return;
    if (m[1] === 'text') { const t = flat(m[2], 700); if (t && out.text.length < MAX_TEXT) out.text.push(t); }
    else if (m[1] === 'label') out.label = flat(m[2], 60);
    else if (m[1] === 'note') out.note = flat(m[2], 140);
    else if (m[1] === 'shapes') out.shapes = m[2].trim() !== 'off';
    else out[m[1]] = hex(m[2]);
  });
  return out;
}
function cleanBody(v) {
  const p = parse(v), l = [];
  if (p.label) l.push(`label: ${p.label}`);
  p.text.forEach(t => l.push(`text: ${t}`));
  if (p.note) l.push(`note: ${p.note}`);
  COLORS.forEach(k => { if (p[k]) l.push(`${k}: ${p[k]}`); });
  if (!p.shapes) l.push('shapes: off');
  return l.join('\n');
}
const cleanSide = (v) => (SIDES.some(s => s[0] === v) ? v : 'left');

function view(site, blk, services) {
  const b = blk || {}, own = parse(b.body), s = (site && site.sections) || {};
  let photo = b.imageUrl || '';
  if (!photo) { const a = (s.about || {}).imageUrl; const pics = collageBlock.sitePhotos(site, (services || []).filter(x => x && x.title)); photo = a && pics.includes(a) ? a : pics[0] || ''; }
  const color = own.color || '#a9c4e2', accent = own.accent || '#f2b0b5';
  const button = own.button || contrast.ensureContrast(color, '#ffffff', 3);
  return {
    headingHtml: content.hlHtml(b.heading || ''),
    label: own.label, text: own.text, note: own.note, shapes: own.shapes,
    photo, cut: /\/cut-[^/]*$/.test(photo),
    color, accent, button, buttonOn: contrast.textOn(button), bg: own.bg,
    side: cleanSide(b.side),
    cta: b.buttonText && b.buttonUrl ? { text: b.buttonText, url: b.buttonUrl } : null
  };
}

module.exports = { parse, cleanBody, cleanSide, view, SIDES, MAX_TEXT, COLORS };
