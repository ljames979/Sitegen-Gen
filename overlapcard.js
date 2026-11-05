// "Photo over a text card" content block (Leo's link to a pet template, 2026-11-03; our own drawing of the idea, no
// code, photos or wording from it): a light band runs across the top of the block; a patterned rectangle (thin
// stripes, dots or a fine grid) sits behind the photo, a little up and out; the photo overlaps a white card that
// sits lower on the other side, with the heading, a paragraph or two, an optional small italic note (e.g. a photo
// credit) and a dark rounded button. Nothing is made up: the words and photo are the owner's (empty photo = the
// About photo or another of the site's photos).
// Markup in views/_blocks.ejs, CSS in public/sg-site.css.
// body: plain lines, each one a paragraph (up to 4); a line that starts with ~ is the small italic note.
// side: "<pattern>:<band>:<photo side>", pattern stripes | dots | grid | none, band grey | tint | none,
// photo side left | right. Two more parts (Leo 2026-11-04, "use brand color or select my own color for the cards ...
// keep the option for the gradient and allow it to blend in with the color chosen"): "...:<card>:<finish>", card
// white | brand | #rrggbb, finish flat | gradient (the card shades through its own color). A colored card also tints
// the band, and when the block's background is a gradient a soft fade blends it into the card color. The words,
// note and button pick white or near-black, whichever reads on every shade of the card.
// Leo 2026-11-04 ("an option to select both the top and bottom section color, also the dotted background should allow
// for a color selection"): the band may be #rrggbb (a color of his own for the top), and two more parts follow,
// ":<bottom>:<pattern color>", each empty (as before: the block's background, the page's ink) or #rrggbb; then
// ":<pattern fill>:<fill finish>" (Leo 05:49Z, "the area a color of my choice with the gradient dots still showing"):
// the shape behind the photo filled with #rrggbb (empty = the page color), flat | gradient, the pattern drawn over it.
const contrast = require('./contrast');
const collageBlock = require('./collageblock');
const content = require('./library/content');

const PATTERNS = [['stripes', 'Thin stripes behind the photo'], ['dots', 'Dots behind the photo'], ['grid', 'Fine grid behind the photo'], ['none', 'No pattern']];
const BANDS = [['grey', 'Light grey band across the top'], ['tint', 'Light brand-color band across the top'], ['own', 'Top band in a color I pick'], ['none', 'No band']];
const SIDES = [['left', 'Photo on the left'], ['right', 'Photo on the right']];
const CARDS = [['white', 'White card'], ['brand', 'Brand color card'], ['own', 'My own color card']];
const FINISHES = [['flat', 'Flat card'], ['gradient', 'Gradient card (blends through the card color)']];
const HEX = /^#[0-9a-f]{6}$/;
const MAX_TEXT = 4;
const flat = (v, n) => String(v || '').replace(/[|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const has = (list, v) => list.some(x => x[0] === v);

function parse(v) {
  const out = { text: [], note: '' };
  String(v || '').split('\n').forEach(l => {
    const t = l.trim();
    if (!t) return;
    if (t[0] === '~') { const n = flat(t.slice(1), 200); if (n) out.note = n; return; }
    const p = flat(t, 800);
    if (p && out.text.length < MAX_TEXT) out.text.push(p);
  });
  return out;
}
function cleanBody(v) {
  const p = parse(v);
  return p.text.concat(p.note ? [`~ ${p.note}`] : []).join('\n');
}
function settings(v) {
  const [p, b, s, c, f, u, k, pf, pg] = String(v || '').split(':');
  const card = String(c || '').toLowerCase(), band = String(b || '').toLowerCase(), hx = (x) => (HEX.test(String(x || '').toLowerCase()) ? String(x).toLowerCase() : '');
  return {
    pattern: has(PATTERNS, p) ? p : 'stripes', band: has(BANDS, band) || HEX.test(band) ? band : 'grey', side: has(SIDES, s) ? s : 'left',
    card: card === 'brand' || HEX.test(card) ? card : 'white', finish: has(FINISHES, f) ? f : 'flat',
    bottom: hx(u), patColor: hx(k), patFill: hx(pf), patFinish: hx(pf) && pg === 'gradient' ? 'gradient' : 'flat'
  };
}
// the old three-part value stays three parts while nothing else is chosen
const cleanSide = (v) => {
  const o = settings(v), fill = o.patFill, extra = o.bottom || o.patColor || fill;
  return `${o.pattern}:${o.band}:${o.side}` + (extra || o.card !== 'white' || o.finish !== 'flat' ? `:${o.card}:${o.finish}` : '') + (extra ? `:${o.bottom}:${o.patColor}` : '') + (fill ? `:${fill}:${o.patFinish}` : '');
};

// a mix of two #rrggbb colors, w = share of b
const mixHex = (a, b, w) => { const x = contrast.parseHex(a), y = contrast.parseHex(b); return contrast.toHex(x.map((v, i) => v * (1 - w) + y[i] * w)); };
// the card's colors: { kind, color, top, bottom, ink, btnBg, btnInk, style } (style = CSS variables for the block)
function cardLook(set, brandHex) {
  const kind = set.card === 'white' ? 'white' : set.card === 'brand' ? 'brand' : 'own';
  const color = kind === 'white' ? '#ffffff' : kind === 'brand' ? brandHex : set.card;
  const grad = set.finish === 'gradient';
  // the words take white or near-black, whichever reads better on the chosen color; a gradient then shades away from
  // the words (deeper under white words, lighter under dark ones), so it never makes them harder to read. A white
  // card shades into a whisper of the brand color.
  const ink = kind === 'white' ? '#111111' : contrast.textOn(color);
  const away = ink === '#ffffff' ? '#000000' : '#ffffff';
  const top = !grad || kind === 'white' ? color : mixHex(color, away, 0.05);
  const bottom = !grad ? color : kind === 'white' ? mixHex('#ffffff', brandHex, 0.12) : mixHex(color, away, away === '#000000' ? 0.32 : 0.45);
  const btnBg = kind === 'white' ? '#111111' : ink, btnInk = kind === 'white' ? '#ffffff' : color;
  const style = `--oc-c:${color};--oc-top:${top};--oc-bottom:${bottom};--oc-text:${ink};--oc-btn:${btnBg};--oc-btn-ink:${btnInk}`;
  return { kind, color, top, bottom, ink, btnBg, btnInk, style };
}

function view(site, blk, services) {
  const b = blk || {}, own = parse(b.body), set = settings(b.side), s = (site && site.sections) || {}, t = (site && site.theme) || {};
  const brand = /^#[0-9a-fA-F]{6}$/.test(String(t.primaryColor || '')) ? t.primaryColor.toLowerCase() : '#1d6fa5';
  const look = cardLook(set, brand);
  let photo = b.imageUrl || '';
  if (!photo) { const a = (s.about || {}).imageUrl; const pics = collageBlock.sitePhotos(site, (services || []).filter(x => x && x.title)); photo = a && pics.includes(a) ? a : pics[0] || ''; }
  return {
    headingHtml: content.hlHtml(b.heading || ''),
    photo, text: own.text, note: own.note,
    pattern: set.pattern, band: HEX.test(set.band) ? 'own' : set.band, side: set.side,
    card: look.kind, finish: set.finish, look,
    // own colors for the top band, the bottom of the block and the pattern
    bandColor: HEX.test(set.band) ? set.band : '', bottom: set.bottom, patColor: set.patColor,
    // the block's CSS variables ('' when nothing is chosen, so older blocks don't change)
    style: [look.kind !== 'white' || set.finish !== 'flat' ? look.style : '', HEX.test(set.band) ? `--oc-band:${set.band}` : '', set.bottom ? `--oc-under:${set.bottom}` : '', set.patColor ? `--oc-ink:${set.patColor}` : '',
      set.patFill ? `--oc-pfill:${set.patFill};--oc-pfill2:${set.patFinish === 'gradient' ? mixHex(set.patFill, contrast.luminance(set.patFill) > 0.4 ? '#000000' : '#ffffff', 0.3) : set.patFill}` : ''].filter(Boolean).join(';'),
    patFill: set.patFill, patFinish: set.patFinish,
    // a gradient block background fades into the chosen card color (an own bottom color replaces the gradient)
    fade: look.kind !== 'white' && !set.bottom && /^g-/.test(String(b.bg || '')),
    button: b.buttonText && b.buttonUrl ? { text: b.buttonText, url: b.buttonUrl } : null
  };
}

module.exports = { parse, cleanBody, settings, cleanSide, cardLook, view, PATTERNS, BANDS, SIDES, CARDS, FINISHES, MAX_TEXT };
