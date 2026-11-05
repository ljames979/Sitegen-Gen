// "Two photos and a link list" content block (Leo's link to a dog trainer template, 2026-11-03: "lets create a block
// using this layout"; our own drawing of the layout, no code, photos or wording from it). A big heading in a bold
// color and a short paragraph sit top left; two square photos sit side by side under them, each on a colored square
// (so a cut-out photo stands on color); a tall pale panel rises behind the right side of the block and holds a short
// list of links at its foot. Nothing is made up: the words, photos and links are the owner's.
// Markup in views/_blocks.ejs, CSS in public/sg-site.css.
// The editor writes the block's body as lines (the owner never types this):
//   text: A sentence or two                    (up to 3 paragraphs)
//   photo: /uploads/a.jpg                      (2; empty = the site's photos)
//   link: Training tips | /services            (up to 6; the address may be empty, then it is plain words)
//   color: #e8b100                             (heading and photo squares; empty = brand color)
//   panel: #efefef                             (the tall panel; empty = light grey)
// side: the panel's side: right | left
const content = require('./library/content');
const collageBlock = require('./collageblock');
const contrast = require('./contrast');

const PHOTO = /^(https:\/\/|\/uploads\/)[^\s"'<>()|]+$/;
const LINK = /^(https:\/\/|\/|#|mailto:|tel:)[^\s"'<>]*$/;
const HEX = /^#[0-9a-f]{6}$/i;
const MAX_TEXT = 3, MAX_LINKS = 6;
const SIDES = [['right', 'Panel and links on the right'], ['left', 'Panel and links on the left (photos on the right)']];
const flat = (v, n) => String(v || '').replace(/[|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const hex = (v) => (HEX.test(String(v || '').trim()) ? String(v).trim().toLowerCase() : '');

function parse(v) {
  const out = { text: [], photos: [], links: [], color: '', panel: '' };
  String(v || '').split('\n').forEach(l => {
    const m = /^(text|photo|link|color|panel):\s?(.*)$/.exec(l.trim());
    if (!m) return;
    const k = m[1], val = m[2];
    if (k === 'color' || k === 'panel') out[k] = hex(val);
    else if (k === 'text') { const t = flat(val, 700); if (t && out.text.length < MAX_TEXT) out.text.push(t); }
    else if (k === 'photo') { if (out.photos.length < 2) { const u = val.trim(); out.photos.push(PHOTO.test(u) && u.length <= 500 ? u : ''); } }
    else if (out.links.length < MAX_LINKS) {
      const p = val.split('|'), label = flat(p[0], 60), url = (p[1] || '').trim();
      if (label) out.links.push({ label, url: LINK.test(url) && url.length <= 500 && !/^javascript:/i.test(url) ? url : '' });
    }
  });
  return out;
}
function cleanBody(v) {
  const p = parse(v), l = [];
  p.text.forEach(t => l.push(`text: ${t}`));
  p.photos.forEach(u => l.push(`photo: ${u}`));
  p.links.forEach(k => l.push(`link: ${k.label} | ${k.url}`));
  if (p.color) l.push(`color: ${p.color}`);
  if (p.panel) l.push(`panel: ${p.panel}`);
  return l.join('\n');
}
const cleanSide = (v) => (SIDES.some(s => s[0] === v) ? v : 'right');

function view(site, blk, services) {
  const b = blk || {}, own = parse(b.body), t = (site && site.theme) || {};
  const pics = collageBlock.sitePhotos(site, (services || []).filter(x => x && x.title));
  const p0 = own.photos[0] || '', p1 = own.photos[1] || '';
  const photos = [p0 || pics.find(u => u !== p1) || '', p1 || pics.find(u => u !== p0 && u !== (p0 || pics.find(x => x !== p1))) || ''];
  return {
    headingHtml: content.hlHtml(b.heading || ''),
    text: own.text, links: own.links,
    photos: photos.map(u => ({ url: u, cut: /\/cut-[^/]*$/.test(u) })),
    color: own.color || hex(t.primaryColor) || '', panel: own.panel,
    headColor: (own.color || hex(t.primaryColor)) ? contrast.ensureContrast(own.color || hex(t.primaryColor), '#ffffff', 3) : '',   // big words stay readable on white
    colorOn: contrast.textOn(own.color || hex(t.primaryColor) || '#1d6fa5'),
    side: cleanSide(b.side),
    button: b.buttonText && b.buttonUrl ? { text: b.buttonText, url: b.buttonUrl } : null
  };
}

module.exports = { parse, cleanBody, cleanSide, view, SIDES, MAX_TEXT, MAX_LINKS };
