// "Rolling words with photo shapes" content block (Leo's screenshot and video, 2026-10-31): a big bold heading on the
// left whose last line rolls from one word to the next (each new word slides up into place), smaller words on the
// right, and three soft rounded shapes along the bottom with glowing rims. Up to 5 photos in all (Leo: "five total")
// go round the shapes like a carousel while the block is on screen: each shape shows a different one, and every few
// seconds each moves on to the next. Behavior in public/sg-fx.js, CSS in public/sg-site.css.
// The editor writes the block's body as lines (the owner never types this):
//   roll: a word or two for the last line of the heading
//   sub: Small words on the right
//   photos: photo link photo link ...     (up to 5)
const content = require('./library/content');
const collageBlock = require('./collageblock');

const PHOTO = /^(https:\/\/|\/uploads\/)[^\s"'<>()]+$/;
const SHAPES = 3, MAX_PICS = 5, MAX_ROLL = 6;
const RIMS = [['glow', 'Glowing rims (yellow, pink and green)'], ['brand', 'Rims in your brand colors'], ['none', 'No rims, just the photos']];
const flat = (v, n) => String(v || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

function parse(v) {
  const roll = [], sub = [], photos = [];
  String(v || '').split('\n').forEach(l => {
    const m = /^(roll|sub|photos):\s?(.*)$/.exec(l.trim());
    if (!m) return;
    if (m[1] === 'roll') { const t = flat(m[2], 30); if (t && roll.length < MAX_ROLL) roll.push(t); return; }
    if (m[1] === 'sub') { const t = flat(m[2], 300); if (t && sub.length < 3) sub.push(t); return; }
    m[2].split(/\s+/).forEach(u => { if (PHOTO.test(u) && photos.length < MAX_PICS && !photos.includes(u.slice(0, 500))) photos.push(u.slice(0, 500)); });
  });
  return { roll, sub, photos };
}

function cleanBody(v) {
  const p = parse(v);
  return p.roll.map(t => `roll: ${t}`).concat(p.sub.map(t => `sub: ${t}`), p.photos.length ? [`photos: ${p.photos.join(' ')}`] : []).join('\n');
}
const cleanSide = (v) => (RIMS.some(r => r[0] === v) ? v : 'glow');

// What the block shows; null without a heading or a single photo (the editor preview shows a note)
function view(site, blk, services) {
  const b = blk || {}, own = parse(b.body);
  const site_ = collageBlock.sitePhotos(site, (services || []).filter(x => x && x.title));
  // the owner's photos, else the site's (5 at most); each shape holds all of them, starting one further along, so the
  // shapes show different photos and all move on together
  const photos = own.photos.length ? own.photos : site_.slice(0, MAX_PICS);
  if (!String(b.heading || '').trim() || !photos.length) return null;
  const shapes = [];
  for (let i = 0; i < SHAPES; i++) shapes.push(photos.map((u, n) => photos[(n + i) % photos.length]));
  return {
    headingHtml: content.hlHtml(b.heading),
    roll: own.roll,
    sub: own.sub,
    photos,
    shapes,
    rim: cleanSide(b.side),
    button: b.buttonText && b.buttonUrl ? { text: b.buttonText, url: b.buttonUrl } : null
  };
}

module.exports = { parse, cleanBody, cleanSide, view, RIMS, SHAPES, MAX_PICS };
