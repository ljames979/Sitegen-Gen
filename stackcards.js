// "Stacked cards" content block (Leo's screenshot, 2026-10-31): on the left a small label, a big heading, the owner's
// own rating line, and arrows with "1 of N"; on the right a pile of tilted, layered cards. As the visitor scrolls
// through the block the top card flies off and goes to the back, one card at a time (the arrows do the same). The owner
// picks how many cards (2 to 8); each card can carry words (a quote or a note), a name with a small line under it,
// stars and a photo, or be left plain (a plain card shows one of the site's photos, else just its color).
// Nothing is made up: no rating, stars or words show unless the owner types them.
// Behavior in public/sg-fx.js, CSS in public/sg-site.css.
// The editor writes the block's body as lines (the owner never types this):
//   label: Customer love
//   rating: 4.9 | from 120 Google reviews      (number 0-5, then the words after the stars; both optional)
//   colors: soft | brand | white
//   card: Name | Small line | stars 0-5 | photo link | words
const content = require('./library/content');
const collageBlock = require('./collageblock');

const PHOTO = /^(https:\/\/|\/uploads\/)[^\s"'<>()]+$/;
const MIN = 2, MAX = 8;
const COLORS = [['soft', 'Soft colors (yellow, lilac, mint, pink ...)'], ['brand', 'Your brand colors'], ['white', 'White cards']];
const flat = (v, n) => String(v || '').replace(/[|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const stars = (v) => { const n = Math.round(Number(String(v || '').trim()) * 2) / 2; return Number.isFinite(n) && n > 0 ? Math.min(5, n) : 0; };

function parse(v) {
  const out = { label: '', rating: 0, ratingText: '', colors: 'soft', cards: [] };
  String(v || '').split('\n').forEach(l => {
    const m = /^(label|rating|colors|card):\s?(.*)$/.exec(l.trim());
    if (!m) return;
    if (m[1] === 'label') out.label = flat(m[2], 60);
    else if (m[1] === 'rating') { const [a, ...b] = m[2].split('|'); out.rating = stars(a); out.ratingText = flat(b.join(' '), 80); }
    else if (m[1] === 'colors') out.colors = COLORS.some(c => c[0] === m[2].trim()) ? m[2].trim() : 'soft';
    else if (out.cards.length < MAX) {
      const [name, line, st, photo, ...words] = m[2].split('|');
      const p = String(photo || '').trim();
      out.cards.push({ name: flat(name, 60), line: flat(line, 90), stars: Math.round(stars(st)), photo: PHOTO.test(p) ? p.slice(0, 500) : '', words: flat(words.join(' '), 500) });
    }
  });
  return out;
}
function cleanBody(v) {
  const p = parse(v);
  return [].concat(p.label ? [`label: ${p.label}`] : [], p.rating || p.ratingText ? [`rating: ${p.rating || ''} | ${p.ratingText}`] : [], p.colors !== 'soft' ? [`colors: ${p.colors}`] : [],
    p.cards.map(c => `card: ${c.name} | ${c.line} | ${c.stars || ''} | ${c.photo} | ${c.words}`)).join('\n');
}
// side: how many cards
const cleanSide = (v) => { const n = parseInt(v, 10); return String(Number.isFinite(n) ? Math.min(MAX, Math.max(MIN, n)) : 4); };

// What the block shows (always something: plain cards when nothing is filled in)
function view(site, blk, services) {
  const b = blk || {}, own = parse(b.body), count = +cleanSide(b.side);
  const pics = collageBlock.sitePhotos(site, (services || []).filter(x => x && x.title));
  const cards = [];
  for (let i = 0; i < count; i++) {
    const c = own.cards[i] || { name: '', line: '', stars: 0, photo: '', words: '' };
    const plain = !c.words && !c.name && !c.line && !c.stars;
    cards.push(Object.assign({}, c, { photo: c.photo || (plain && pics.length ? pics[i % pics.length] : ''), plain }));
  }
  const full = Math.floor(own.rating), half = own.rating - full >= 0.5;
  return {
    headingHtml: content.hlHtml(b.heading || ''),
    label: own.label,
    rating: own.rating ? { full, half, empty: 5 - full - (half ? 1 : 0), value: own.rating } : null,
    ratingText: own.ratingText,
    colors: own.colors,
    cards,
    button: b.buttonText && b.buttonUrl ? { text: b.buttonText, url: b.buttonUrl } : null
  };
}

module.exports = { parse, cleanBody, cleanSide, view, COLORS, MIN, MAX };
