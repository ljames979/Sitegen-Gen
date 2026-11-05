// "Reviews on a card" content block (Leo's link to a pet website template, 2026-11-03: "3 pet reviews, the option to
// change the color of the background and the card, place a photo or a cut out photo"; our own drawing of the idea,
// no code, photos or wording from it). A big photo stands on a brand-colored panel and reaches above a wide card that
// lies across the block; the card holds the heading, a short line under it and up to 3 reviews, each with a small round
// photo (or the reviewer's first letter), their words and their name. The block's background and the card each take
// the owner's color. A photo with its background cut out (✂ Cut out) stands on the panel. Nothing is made up: the
// reviews are the owner's, typed here or taken from their Reviews section when this block has none.
// Markup in views/_blocks.ejs, CSS in public/sg-site.css.
// The editor writes the block's body as lines (the owner never types this):
//   bg: #eef2f7                                      (the block's background; empty = a soft tint of the brand color)
//   card: #ffffff                                    (the card; empty = white)
//   review: /uploads/max.jpg | Max loves it here | Sam, Max's owner   (up to 3; the photo may be empty)
// side: the big photo's side: left | right, then (Leo 2026-11-04, "when i cut the photo it comes out real big ... an
// option to adjust its size and position") ":<size>:<x>:<y>:<fit>": size 40-150 (% of the panel, 100 = as before),
// x and y nudge it (-40..40 and -30..30, % of its box), fit all (show the whole cut-out, the default) | fill (fill
// the panel and trim, the old look). Left at the defaults the value stays just left | right.
const content = require('./library/content');
const contrast = require('./contrast');
const collageBlock = require('./collageblock');

const PHOTO = /^(https:\/\/|\/uploads\/)[^\s"'<>()|]+$/;
const HEX = /^#[0-9a-f]{6}$/i;
const MAX_REVIEWS = 3;
const SIDES = [['left', 'Big photo on the left, reviews on the right'], ['right', 'Big photo on the right, reviews on the left']];
const flat = (v, n) => String(v || '').replace(/[|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const hex = (v) => (HEX.test(String(v || '').trim()) ? String(v).trim().toLowerCase() : '');

function parse(v) {
  const out = { bg: '', card: '', reviews: [] };
  String(v || '').split('\n').forEach(l => {
    const m = /^(bg|card|review):\s?(.*)$/.exec(l.trim());
    if (!m) return;
    if (m[1] !== 'review') { out[m[1]] = hex(m[2]); return; }
    if (out.reviews.length >= MAX_REVIEWS) return;
    const p = m[2].split('|'), photo = (p[0] || '').trim();
    const r = { photo: PHOTO.test(photo) && photo.length <= 500 ? photo : '', quote: flat(p[1], 400), name: flat(p.slice(2).join(' '), 80) };
    if (r.quote) out.reviews.push(r);
  });
  return out;
}
function cleanBody(v) {
  const p = parse(v), l = [];
  if (p.bg) l.push(`bg: ${p.bg}`);
  if (p.card) l.push(`card: ${p.card}`);
  p.reviews.forEach(r => l.push(`review: ${r.photo} | ${r.quote} | ${r.name}`));
  return l.join('\n');
}
const FITS = [['all', 'Show the whole cut-out'], ['fill', 'Fill the panel (trims the edges)']];
const num = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) && String(v).trim() !== '' ? Math.min(hi, Math.max(lo, n)) : d; };
function settings(v) {
  const [side, size, x, y, fit] = String(v || '').split(':');
  return { side: SIDES.some(s => s[0] === side) ? side : 'left', size: num(size, 40, 150, 100), x: num(x, -40, 40, 0), y: num(y, -30, 30, 0), fit: FITS.some(f => f[0] === fit) ? fit : 'all' };
}
const cleanSide = (v) => { const o = settings(v); return o.size === 100 && !o.x && !o.y && o.fit === 'all' ? o.side : `${o.side}:${o.size}:${o.x}:${o.y}:${o.fit}`; };
const initial = (name) => (String(name || '').match(/[\p{L}\p{N}]/u) || [''])[0].toUpperCase();

function view(site, blk, services) {
  const b = blk || {}, own = parse(b.body), s = (site && site.sections) || {}, t = (site && site.theme) || {};
  const brand = hex(t.primaryColor) || '#1d6fa5';
  let reviews = own.reviews;
  if (!reviews.length) {   // the owner's own Reviews section, so the block is never empty of real words
    reviews = (((s.testimonials || {}).items) || []).filter(x => x && x.quote).slice(0, MAX_REVIEWS)
      .map(x => ({ photo: x.photo || '', quote: flat(x.quote, 400), name: flat(x.author, 80) }));
  }
  let photo = b.imageUrl || '';
  if (!photo) { const a = (s.about || {}).imageUrl; const pics = collageBlock.sitePhotos(site, (services || []).filter(x => x && x.title)); photo = a && pics.includes(a) ? a : pics[0] || ''; }
  const card = own.card || '', set = settings(b.side), cut = /\/cut-[^/]*$/.test(photo);
  return {
    headingHtml: content.hlHtml(b.heading || ''),
    photo, side: set.side, cut, size: set.size, x: set.x, y: set.y, fit: cut ? set.fit : 'fill',
    // the photo's size and nudge as CSS variables ('' at the defaults, so the old blocks don't change)
    photoStyle: set.size !== 100 || set.x || set.y ? ` --rc-scale: ${set.size / 100}; --rc-x: ${set.x}%; --rc-y: ${set.y}%;` : '',
    bg: own.bg, card, cardOn: card ? contrast.textOn(card) : '', brand, brandOn: contrast.textOn(brand),
    reviews: reviews.map(r => ({ ...r, initial: initial(r.name || r.quote) })),
    button: b.buttonText && b.buttonUrl ? { text: b.buttonText, url: b.buttonUrl } : null
  };
}

module.exports = { parse, cleanBody, settings, cleanSide, view, SIDES, FITS, MAX_REVIEWS };
