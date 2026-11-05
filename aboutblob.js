// "About with phone" content block (Leo's link to an About-us block, 2026-10-31; our own drawing of the idea): a photo
// in a soft rounded frame with a few organic color shapes around it on one side; on the other the heading, a thin
// colored line, a paragraph or two, a bold line and the phone number as a tap-to-call link.
// Nothing is made up: the words are the owner's; the phone is the one typed here, else the site's own (Contact).
// Markup in views/_blocks.ejs, CSS in public/sg-site.css.
// The editor writes the block's body as lines (the owner never types this):
//   text: A paragraph            (up to 3)
//   bold: A line in bold
//   phone: +1 (234) 567-8910     ("none" hides the phone)
// side: "<colors>:<photo side>", colors soft | brand | grey, photo side left | right
const collageBlock = require('./collageblock');
const content = require('./library/content');

const COLORS = [['brand', 'Shapes in your brand colors'], ['soft', 'Soft pink and grey shapes'], ['grey', 'Grey shapes']];
const SIDES = [['left', 'Photo on the left'], ['right', 'Photo on the right']];
const MAX_TEXT = 3;
const flat = (v, n) => String(v || '').replace(/[|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

function parse(v) {
  const out = { text: [], bold: '', phone: '' };
  String(v || '').split('\n').forEach(l => {
    const m = /^(text|bold|phone):\s?(.*)$/.exec(l.trim());
    if (!m) return;
    if (m[1] === 'text') { const t = flat(m[2], 800); if (t && out.text.length < MAX_TEXT) out.text.push(t); }
    else if (m[1] === 'bold') out.bold = flat(m[2], 300);
    else out.phone = /^none$/i.test(m[2].trim()) ? 'none' : flat(m[2], 30).replace(/[^0-9+()\-. ]/g, '').trim();
  });
  return out;
}
function cleanBody(v) {
  const p = parse(v);
  return [].concat(p.text.map(t => `text: ${t}`), p.bold ? [`bold: ${p.bold}`] : [], p.phone ? [`phone: ${p.phone}`] : []).join('\n');
}
function settings(v) {
  const [c, s] = String(v || '').split(':');
  return { colors: COLORS.some(x => x[0] === c) ? c : 'brand', side: SIDES.some(x => x[0] === s) ? s : 'left' };
}
const cleanSide = (v) => { const o = settings(v); return `${o.colors}:${o.side}`; };
const telOf = (p) => String(p || '').replace(/[^0-9+]/g, '');

function view(site, blk, services) {
  const b = blk || {}, own = parse(b.body), set = settings(b.side), s = (site && site.sections) || {};
  let photo = b.imageUrl || '';
  if (!photo) { const a = (s.about || {}).imageUrl; const pics = collageBlock.sitePhotos(site, (services || []).filter(x => x && x.title)); photo = a && pics.includes(a) ? a : pics[0] || ''; }
  const phone = own.phone === 'none' ? '' : own.phone || String(((s.contact || {}).phone) || '').trim();
  return {
    headingHtml: content.hlHtml(b.heading || ''),
    photo, text: own.text, bold: own.bold,
    phone: phone && telOf(phone).replace(/\D/g, '').length >= 3 ? { label: phone, tel: telOf(phone) } : null,
    colors: set.colors, side: set.side,
    button: b.buttonText && b.buttonUrl ? { text: b.buttonText, url: b.buttonUrl } : null
  };
}

module.exports = { parse, cleanBody, settings, cleanSide, view, COLORS, SIDES, MAX_TEXT };
