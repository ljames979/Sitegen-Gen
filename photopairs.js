// "Photo and words pairs" content block (Leo's link to a Python for kids template, 2026-11-03: "block"; our own
// drawing of the layout, no code, photos or wording from it). A small label with a short line and a heading sit in the
// middle; under them a row of tiles goes photo, words, photo, words: each photo is paired with the tile beside it, and
// the last words tile takes the block's color. Behind them the block's color shows in two slanted corners of the band.
// Photos sit on a soft square of the color, so a cut-out photo (✂ Cut out) stands on color. Nothing is made up.
// Markup in views/_blocks.ejs, CSS in public/sg-site.css.
// The editor writes the block's body as lines (the owner never types this):
//   label: Coding adventure                        (optional small line above the heading)
//   pair: /uploads/a.jpg | Math practice | Words    (up to 4; the photo may be empty)
//   color: #12b5c4                                  (empty = brand color)
//   shapes: off                                     (leave out for the slanted corners)
const content = require('./library/content');
const contrast = require('./contrast');
const collageBlock = require('./collageblock');

const PHOTO = /^(https:\/\/|\/uploads\/)[^\s"'<>()|]+$/;
const HEX = /^#[0-9a-f]{6}$/i;
const MAX_PAIRS = 4;
const flat = (v, n) => String(v || '').replace(/[|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const hex = (v) => (HEX.test(String(v || '').trim()) ? String(v).trim().toLowerCase() : '');

function parse(v) {
  const out = { label: '', pairs: [], color: '', shapes: true };
  String(v || '').split('\n').forEach(l => {
    const m = /^(label|pair|color|shapes):\s?(.*)$/.exec(l.trim());
    if (!m) return;
    if (m[1] === 'label') out.label = flat(m[2], 60);
    else if (m[1] === 'color') out.color = hex(m[2]);
    else if (m[1] === 'shapes') out.shapes = m[2].trim() !== 'off';
    else if (out.pairs.length < MAX_PAIRS) {
      const p = m[2].split('|'), photo = (p[0] || '').trim();
      const r = { photo: PHOTO.test(photo) && photo.length <= 500 ? photo : '', title: flat(p[1], 80), text: flat(p.slice(2).join(' '), 500) };
      if (r.photo || r.title || r.text) out.pairs.push(r);
    }
  });
  return out;
}
function cleanBody(v) {
  const p = parse(v), l = [];
  if (p.label) l.push(`label: ${p.label}`);
  p.pairs.forEach(r => l.push(`pair: ${r.photo} | ${r.title} | ${r.text}`));
  if (p.color) l.push(`color: ${p.color}`);
  if (!p.shapes) l.push('shapes: off');
  return l.join('\n');
}
const cleanSide = () => 'center';

function view(site, blk, services) {
  const b = blk || {}, own = parse(b.body), t = (site && site.theme) || {};
  const pics = collageBlock.sitePhotos(site, (services || []).filter(x => x && x.title));
  let pairs = own.pairs.length ? own.pairs : [{ photo: '', title: '', text: '' }];
  pairs = pairs.map((r, i) => { const photo = r.photo || pics[i] || pics[0] || ''; return { ...r, photo, cut: /\/cut-[^/]*$/.test(photo) }; });
  const color = own.color || hex(t.primaryColor) || '#12b5c4';
  return {
    headingHtml: content.hlHtml(b.heading || ''),
    label: own.label, pairs, shapes: own.shapes,
    color, on: contrast.textOn(color), lineColor: contrast.ensureContrast(color, '#ffffff', 3),
    button: b.buttonText && b.buttonUrl ? { text: b.buttonText, url: b.buttonUrl } : null
  };
}

module.exports = { parse, cleanBody, cleanSide, view, MAX_PAIRS };
