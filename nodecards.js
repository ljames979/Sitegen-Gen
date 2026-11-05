// "Connected photo cards" content block (Leo's screenshot, 2026-10-31): a big heading with smaller words under it, then
// photo cards set out in staggered columns and joined by thin lines, like a flow chart. Each card has two small labels
// above it (a bold one and a spaced-out one); a card can hold words instead of photos (a note between the photos).
// Each photo card's pictures take turns (its own photos first, then the site's), one card at a time.
// Behavior in public/sg-fx.js (the lines and the picture changes), CSS in public/sg-site.css.
// Leo, 2026-10-31: the whole block fits one screen on a computer (no scrolling through it), and the heading's last line
// can roll through the owner's words, like the rolling words block (same markup and behavior, public/sg-fx.js).
// The editor writes the block's body as lines (the owner never types this):
//   roll: a word or two that takes turns on the heading's last line (up to 6)
//   sub: Small words under the heading
//   card: Label | Second label | photo link photo link ...
//   text: Label | Second label | words on the card
const content = require('./library/content');
const collageBlock = require('./collageblock');

const PHOTO = /^(https:\/\/|\/uploads\/)[^\s"'<>()]+$/;
const MAX_CARDS = 6, MAX_PICS = 6, MAX_ROLL = 6;
const CHANGES = ['auto', 'slide', 'still'];
const flat = (v, n) => String(v || '').replace(/[|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

// The body, read into its parts (anything else in it is left out)
function parse(v) {
  const roll = [], sub = [], cards = [];
  String(v || '').split('\n').forEach(l => {
    const m = /^(roll|sub|card|text):\s?(.*)$/.exec(l.trim());
    if (!m) return;
    if (m[1] === 'roll') { const t = flat(m[2], 30); if (t && roll.length < MAX_ROLL) roll.push(t); return; }
    if (m[1] === 'sub') { const t = flat(m[2], 240); if (t && sub.length < 3) sub.push(t); return; }
    if (cards.length >= MAX_CARDS) return;
    const [a, b, ...rest] = m[2].split('|');
    const label = flat(a, 30), tag = flat(b, 40), last = rest.join(' ');
    if (m[1] === 'text') { const words = flat(last, 300); if (words) cards.push({ label, tag, words, pics: [] }); return; }
    const pics = last.split(/\s+/).filter(u => PHOTO.test(u)).map(u => u.slice(0, 500)).filter((u, i, x) => x.indexOf(u) === i).slice(0, MAX_PICS);
    if (label || tag || pics.length) cards.push({ label, tag, words: '', pics });
  });
  return { roll, sub, cards };
}

function cleanBody(v) {
  const p = parse(v);
  return p.roll.map(t => `roll: ${t}`).concat(p.sub.map(t => `sub: ${t}`), p.cards.map(c => c.words ? `text: ${c.label} | ${c.tag} | ${c.words}` : `card: ${c.label} | ${c.tag} | ${c.pics.join(' ')}`)).join('\n');
}
const cleanSide = (v) => (CHANGES.includes(v) ? v : 'auto');

// Which cards share a column, by how many cards there are: two small cards stacked, then a tall one, and so on
const COLUMNS = { 3: [[0], [1], [2]], 4: [[0, 1], [2], [3]], 5: [[0, 1], [2], [3, 4]], 6: [[0, 1], [2], [3, 4], [5]] };

// What the block shows; null without 3 cards and a photo for at least two of them (the editor preview shows a note)
function view(site, blk, services) {
  const b = blk || {}, svc = (services || []).filter(x => x && x.title);
  const own = parse(b.body), change = cleanSide(b.side);
  let cards = own.cards;
  if (!cards.length) cards = svc.slice(0, 5).map(x => ({ label: flat(x.title, 30), tag: '', words: '', pics: PHOTO.test(x.imageUrl || '') ? [x.imageUrl] : [] }));
  const site_ = collageBlock.sitePhotos(site, svc);
  let k = 0;
  cards = cards.map(c => {
    if (c.words) return { ...c };
    const pics = c.pics.slice();
    // a card with fewer than 3 photos borrows the site's, each card starting at a different one, so the pictures change
    for (let n = 0; pics.length < 3 && n < site_.length; n++) { const u = site_[(k + n) % site_.length]; if (!pics.includes(u)) pics.push(u); }
    k += 2;
    return { ...c, pics: change === 'still' ? pics.slice(0, 1) : pics };
  }).filter(c => c.words || c.pics.length);
  if (cards.length < 3 || cards.filter(c => c.pics.length).length < 2) return null;
  const cols = COLUMNS[cards.length].map(ix => ({ big: ix.length === 1, cards: ix.map(i => cards[i]) }));
  return {
    headingHtml: content.hlHtml(b.heading || ''),
    roll: own.roll,
    sub: own.sub,
    cols,
    grid: cols.map(c => (c.big ? '1.3fr' : '.85fr')).join(' '),
    change,
    changes: change !== 'still' && cards.some(c => c.pics.length > 1),
    rolls: own.roll.length > 1,
    button: b.buttonText && b.buttonUrl ? { text: b.buttonText, url: b.buttonUrl } : null
  };
}

module.exports = { parse, cleanBody, cleanSide, view, CHANGES, MAX_CARDS };
