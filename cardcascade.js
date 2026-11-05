// "Card cascade" block: slide-shaped cards deal in one after another into an overlapping zig-zag stack, hold, then
// clear away and deal again, like a brand book being laid out on a table. The cards are the same ones the brand wall
// uses (brandwall.js tiles): the site's own name, lines, photos, services, short reviews, numbers, badges and colors,
// plus the photos and lines the owner adds to the block, or only the owner's own. Nothing is made up. The owner picks
// the height and the speed; the block can go on any page, top or bottom.
const brandWall = require('./brandwall');

const SIZES = { short: 420, medium: 600, tall: 780, screen: 0 };   // px; 0 = the height of the screen
const SPEEDS = { slow: 14, normal: 10, fast: 7 };                  // seconds for one deal-in, hold and clear
const CONTENT = brandWall.CONTENT;
const MAX = 10;
const DEFAULT = 'medium:normal:all';
const SIDE = new RegExp(`^(${Object.keys(SIZES).join('|')}):(${Object.keys(SPEEDS).join('|')}):(${CONTENT.join('|')})$`);

// The block's "side" field holds the three choices as size:speed:content
function cleanSide(v) {
  return SIDE.test(String(v || '')) ? String(v) : DEFAULT;
}
function settings(side) {
  const [size, speed, content] = cleanSide(side).split(':');
  return { size, speed, content, height: SIZES[size], secs: SPEEDS[speed] };
}

// Where each card lands: down the block from top to bottom, swinging right then back left in a zig-zag. x and y run
// from 0 to 1 (the card's left/top edge from the block's left/top, as a share of the room left beside the card).
function place(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const k = i % 8, tri = (k <= 4 ? k : 8 - k) / 4;   // 0, .25, .5, .75, 1, .75, .5, .25, 0 ...
    out.push({ x: +(0.08 + 0.84 * tri).toFixed(3), y: n > 1 ? +(i / (n - 1)).toFixed(3) : 0.5 });
  }
  return out;
}

const TONES = ['brand', 'surface', 'ink', 'tint', 'accent'];
function cards(site, blk) {
  const s = settings(blk && blk.side);
  const list = brandWall.tiles(site, { body: blk && blk.body, side: `medium:none:normal:${s.content}` }).slice(0, MAX);
  const at = place(list.length);
  return list.map((x, i) => ({ ...x, tone: x.kind === 'photo' || x.kind === 'swatch' ? '' : x.kind === 'name' ? 'brand' : TONES[i % TONES.length], x: at[i].x, y: at[i].y, i }));
}

module.exports = { SIZES, SPEEDS, CONTENT, MAX, DEFAULT, cleanSide, settings, place, cards, styleVars: brandWall.styleVars };
