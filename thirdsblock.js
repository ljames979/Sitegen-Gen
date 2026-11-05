// "Photo, words and a big letter" content block (Leo's link to a three-column editorial block, 2026-10-31; our own
// version): three equal columns. Left: a tall photo. Middle: a light panel with a two-part heading (a plain line, then
// a bold one), a paragraph with an optional bold sentence at its end, and an underlined "read more" link. Right: a
// photo over a solid box holding one huge letter or a few big words, sized to fill it.
// The photos swap like the other blocks: each spot takes up to 4, and with more than one they take turns (fade).
// Nothing is made up: words are the owner's; the big box falls back to the first letter of the business name.
// Markup in views/_blocks.ejs, CSS in public/sg-site.css, the turns in public/sg-fx.js.
// The editor writes the block's body as lines (the owner never types this):
//   bold: Subtly decorated.          (the heading's second, bold line; the block heading is the first)
//   text: A paragraph
//   strong: A bold sentence after it
//   big: N
//   left: /uploads/a.jpg /uploads/b.jpg
//   right: /uploads/c.jpg
// side: the big box's colors: dark | brand | accent | light
const content = require('./library/content');
const collageBlock = require('./collageblock');

const PHOTO = /^(https:\/\/|\/uploads\/)[^\s"'<>()]+$/;
const MAX_PHOTOS = 4;
const BOXES = [['dark', 'Black box, white letters'], ['brand', 'Brand color box'], ['accent', 'Accent color box'], ['light', 'Light box, dark letters']];
const flat = (v, n) => String(v || '').replace(/[|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const photos = (v) => String(v || '').split(/\s+/).filter(u => PHOTO.test(u) && u.length <= 500).slice(0, MAX_PHOTOS);

function parse(v) {
  const out = { bold: '', text: '', strong: '', big: '', left: [], right: [] };
  String(v || '').split('\n').forEach(l => {
    const m = /^(bold|text|strong|big|left|right):\s?(.*)$/.exec(l.trim());
    if (!m) return;
    if (m[1] === 'left' || m[1] === 'right') out[m[1]] = photos(m[2]);
    else out[m[1]] = flat(m[2], { bold: 120, text: 900, strong: 300, big: 40 }[m[1]]);
  });
  return out;
}
function cleanBody(v) {
  const p = parse(v);
  return [].concat(['bold', 'text', 'strong', 'big'].filter(k => p[k]).map(k => `${k}: ${p[k]}`),
    p.left.length ? [`left: ${p.left.join(' ')}`] : [], p.right.length ? [`right: ${p.right.join(' ')}`] : []).join('\n');
}
const cleanSide = (v) => (BOXES.some(b => b[0] === v) ? v : 'dark');

// How big the box's words can be: one short word fills the box; more words share it, line by line
function fit(big) {
  const words = big.split(' ').filter(Boolean), longest = Math.max(1, ...words.map(w => w.length));
  const lines = Math.min(4, Math.max(1, words.length > 1 && big.length > 10 ? Math.ceil(big.length / Math.max(longest, 8)) : words.length));
  return `--tb-len: ${longest}; --tb-lines: ${lines}`;
}

function view(site, blk, services) {
  const b = blk || {}, own = parse(b.body);
  const pics = collageBlock.sitePhotos(site, (services || []).filter(x => x && x.title));
  const left = own.left.length ? own.left : pics.slice(0, 1), right = own.right.length ? own.right : pics.slice(1, 2).concat(pics.length === 1 ? pics : []);
  const name = String((site && site.name) || '').trim();
  const big = own.big || (name ? name[0].toUpperCase() : '');
  return {
    headingHtml: content.hlHtml(b.heading || ''),
    bold: own.bold, text: own.text, strong: own.strong,
    big, fitStyle: big ? fit(big) : '',
    left, right,
    box: cleanSide(b.side),
    turns: left.length > 1 || right.length > 1,
    link: b.buttonText && b.buttonUrl ? { text: b.buttonText, url: b.buttonUrl } : null
  };
}

module.exports = { parse, cleanBody, cleanSide, fit, view, BOXES, MAX_PHOTOS };
