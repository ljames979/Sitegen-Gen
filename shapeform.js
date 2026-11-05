// "Contact form with shapes" content block (Leo's link to a contact form template, 2026-11-03: "block"; our own drawing
// of the layout, no code, photos or wording from it). A rounded white card holds the heading, an optional line and the
// site's own contact form (the same form as the Contact page: messages land in Leads); it overlaps a big photo that
// stands on a colored panel. A round dot, a block of color under the card and a striped circle by the photo play
// around them. A photo with its background cut out (✂ Cut out) stands on the panel. When the site does not take
// messages the card shows the owner's phone and email instead. Nothing is made up: words, photo and details are the
// owner's. Markup in views/_blocks.ejs, CSS in public/sg-site.css.
// The editor writes the block's body as lines (the owner never types this):
//   text: We answer within a day          (optional line under the heading)
//   color: #2f3fd0                        (heading, button, the block under the card, stripes; empty = brand color)
//   accent: #f08a00                       (the round dot; empty = an orange)
//   panel: #f5c518                        (the panel behind the photo; empty = a warm yellow)
//   bg: #e6e6e6                           (the band behind; empty = light grey)
//   shapes: off                           (leave out for the dot, the block and the stripes)
// side: the card's side: left | right
const content = require('./library/content');
const contrast = require('./contrast');
const collageBlock = require('./collageblock');

const HEX = /^#[0-9a-f]{6}$/i;
const SIDES = [['left', 'Form card on the left, photo on the right'], ['right', 'Form card on the right, photo on the left']];
const flat = (v, n) => String(v || '').replace(/[|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const hex = (v) => (HEX.test(String(v || '').trim()) ? String(v).trim().toLowerCase() : '');

function parse(v) {
  const out = { text: '', color: '', accent: '', panel: '', bg: '', shapes: true };
  String(v || '').split('\n').forEach(l => {
    const m = /^(text|color|accent|panel|bg|shapes):\s?(.*)$/.exec(l.trim());
    if (!m) return;
    if (m[1] === 'text') out.text = flat(m[2], 300);
    else if (m[1] === 'shapes') out.shapes = m[2].trim() !== 'off';
    else out[m[1]] = hex(m[2]);
  });
  return out;
}
function cleanBody(v) {
  const p = parse(v), l = [];
  if (p.text) l.push(`text: ${p.text}`);
  ['color', 'accent', 'panel', 'bg'].forEach(k => { if (p[k]) l.push(`${k}: ${p[k]}`); });
  if (!p.shapes) l.push('shapes: off');
  return l.join('\n');
}
const cleanSide = (v) => (SIDES.some(s => s[0] === v) ? v : 'left');

function view(site, blk, services) {
  const b = blk || {}, own = parse(b.body), s = (site && site.sections) || {}, t = (site && site.theme) || {}, c = s.contact || {};
  let photo = b.imageUrl || '';
  if (!photo) { const a = (s.about || {}).imageUrl; const pics = collageBlock.sitePhotos(site, (services || []).filter(x => x && x.title)); photo = a && pics.includes(a) ? a : pics[0] || ''; }
  const color = own.color || hex(t.primaryColor) || '#2f3fd0';
  return {
    headingHtml: content.hlHtml(b.heading || ''),
    text: own.text, shapes: own.shapes,
    photo, cut: /\/cut-[^/]*$/.test(photo),
    color, headColor: contrast.ensureContrast(color, '#ffffff', 3), colorOn: contrast.textOn(color),
    accent: own.accent, panel: own.panel, bg: own.bg,
    side: cleanSide(b.side),
    phone: c.phone || '', tel: String(c.phone || '').replace(/[^0-9+]/g, ''), email: c.email || ''
  };
}

module.exports = { parse, cleanBody, cleanSide, view, SIDES };
