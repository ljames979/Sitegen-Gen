// "Brand wall" block: a tilted wall of cards that slowly drifts, columns moving in turn up and down. Every card comes
// from the site's own content (name or logo, headline, services, photos, short reviews, trust numbers and badges,
// the brand colors, a type sample in the heading font) plus the photos and short lines the owner adds to the block,
// or only the owner's own photos and lines. Nothing is made up. The owner picks the height, the tilt and the speed;
// the block can go on any page, top or bottom.
const contrast = require('./contrast');

const SIZES = { short: 340, medium: 500, tall: 680, screen: 0 };   // px; 0 = the height of the screen
const TILTS = { none: 0, gentle: -5, strong: -11 };                // degrees
const SPEEDS = { slow: 90, normal: 60, fast: 36 };                 // seconds for one full loop
const CONTENT = ['all', 'mine'];                                    // all = site content + the owner's; mine = only the owner's
const DEFAULT = 'medium:gentle:normal:all';
const SIDE = new RegExp(`^(${Object.keys(SIZES).join('|')}):(${Object.keys(TILTS).join('|')}):(${Object.keys(SPEEDS).join('|')})(?::(${CONTENT.join('|')}))?$`);

// The block's "side" field holds the four choices as size:tilt:speed:content (walls saved before the content choice
// have three parts and use everything)
function cleanSide(v) {
  const m = SIDE.exec(String(v || ''));
  return m ? `${m[1]}:${m[2]}:${m[3]}:${m[4] || 'all'}` : DEFAULT;
}
function settings(side) {
  const [size, tilt, speed, content] = cleanSide(side).split(':');
  return { size, tilt, speed, content, height: SIZES[size], deg: TILTS[tilt], secs: SPEEDS[speed] };
}

// The block's body: photo links (one per line) and short lines of text, in any order
const isPhoto = l => /^(https?:\/\/|\/)\S+$/i.test(l);
function ownContent(body) {
  const ls = String(body || '').split('\n').map(x => x.trim()).filter(Boolean);
  return { photos: ls.filter(isPhoto).slice(0, 12), lines: ls.filter(l => !isPhoto(l)).map(x => x.replace(/\s+/g, ' ').slice(0, 90)).slice(0, 8) };
}

const plain = s => String(s || '').replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim();
const HEX = /^#[0-9a-fA-F]{6}$/;

// The cards, in a mixed order so neighbouring cards differ
function tiles(site, blk) {
  const t = (site && site.theme) || {};
  const mine = settings(blk && blk.side).content === 'mine';
  const s = mine ? {} : (site && site.sections) || {};               // "only mine" leaves the site's content out
  const hero = s.hero || {}, trust = s.trust || {};
  const services = ((s.services && s.services.items) || []).filter(x => x && plain(x.title)).slice(0, 6);
  const own = ownContent(blk && blk.body);
  const photos = [];
  const addPhoto = u => { if (u && !photos.includes(u) && photos.length < 12) photos.push(u); };
  own.photos.forEach(addPhoto);                                      // the owner's photos come first
  ((s.gallery && s.gallery.images) || []).forEach(u => photos.length < 8 && addPhoto(u));
  services.forEach(x => photos.length < 8 && addPhoto(x.imageUrl));
  if (photos.length < 8) addPhoto(hero.imageUrl);
  const quotes = ((s.testimonials && s.testimonials.items) || []).filter(q => q && plain(q.quote) && plain(q.quote).length <= 120).slice(0, 2);
  const stats = (trust.stats || []).filter(x => x && plain(x.value) && plain(x.label)).slice(0, 2);
  const badges = (trust.badges || []).map(plain).filter(Boolean).slice(0, 3);
  const lines = own.lines.map(plain).concat([plain(hero.headline), plain(hero.subheadline).length <= 110 ? plain(hero.subheadline) : '']).filter(Boolean);

  const groups = [
    [{ kind: 'name', text: plain(site && site.name), logo: t.logoUrl || '' }],
    lines.map(text => ({ kind: 'line', text })),
    photos.map(src => ({ kind: 'photo', src })),
    services.map(x => ({ kind: 'service', text: plain(x.title) })),
    quotes.map(q => ({ kind: 'quote', text: plain(q.quote), by: plain(q.author) })),
    stats.map(x => ({ kind: 'stat', value: plain(x.value), text: plain(x.label) })),
    badges.map(text => ({ kind: 'badge', text })),
    [HEX.test(t.primaryColor || '') ? { kind: 'swatch', color: t.primaryColor, ink: contrast.textOn(t.primaryColor) } : null, { kind: 'type' }, HEX.test(t.accentColor || '') && t.accentColor !== t.primaryColor ? { kind: 'swatch', color: t.accentColor, ink: contrast.textOn(t.accentColor) } : null].filter(Boolean),
  ].filter(g => g.length);
  // take one from each group in turn
  const out = [];
  for (let i = 0; groups.some(g => g[i]); i++) groups.forEach(g => { if (g[i]) out.push(g[i]); });
  return out.filter(x => x.kind !== 'name' || x.text || x.logo).slice(0, 30);
}

// Deal the cards into columns, giving each a tone (brand, accent, light or dark card) that varies down a column
// and across a row. Columns are filled to at least 10 cards (taller than the wall, so the loop never shows a gap) by repeating the wall's own cards.
const TONES = ['brand', 'surface', 'ink', 'accent', 'tint'];
function columns(list, n) {
  const cols = Array.from({ length: n }, () => []);
  if (!list.length) return cols;
  const need = Math.max(list.length, n * 10);
  for (let i = 0; i < need; i++) cols[i % n].push(list[i % list.length]);
  return cols.map((col, c) => col.map((x, r) => {
    const tone = x.kind === 'photo' || x.kind === 'swatch' ? '' : x.kind === 'name' ? 'brand' : TONES[(c * 2 + r * 3) % TONES.length];
    return { ...x, tone };
  }));
}

// Colors the cards need: readable text on the accent card
function styleVars(theme) {
  const t = theme || {};
  const accent = HEX.test(t.accentColor || '') ? t.accentColor : '#1e293b';
  return `--wall-accent: ${accent}; --wall-on-accent: ${contrast.textOn(accent)}`;
}

module.exports = { SIZES, TILTS, SPEEDS, CONTENT, DEFAULT, cleanSide, settings, ownContent, tiles, columns, styleVars };
