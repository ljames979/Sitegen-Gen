// "Photo mosaic hero" content block (Leo's link to a pet-photo hero, 2026-11-01; our own version): a huge title, a
// short line in capitals under it, an optional button, then six photos in three columns: the outer columns start
// lower than the middle one and the middle column's photos are taller, so the grid steps. The whole block fits in
// one screen (title, line and every photo); with 8 or more photos it shows four columns of two.
// Photos swap like the other blocks: up to 12. The first six (or eight) fill the tiles; with more, one tile at a time fades to
// the next spare photo every few seconds (still for visitors who turn motion off). Empty = the site's own photos.
// An optional menu runs along the top of the block, with no bar of its own: the name or logo, the page links and the
// call button. When the block is first on a Blocks home page it takes the whole screen and the site's own menu bar
// stays hidden until the visitor scrolls past this menu, then slides in at the top (public-site.ejs, sg-fx.js).
// Nothing is made up: words are the owner's.
// Markup in views/_blocks.ejs, CSS in public/sg-site.css, the swaps in public/sg-fx.js.
// The editor writes the block's body as lines (the owner never types this):
//   sub: IN THE FOCUS!
//   photos: /uploads/a.jpg /uploads/b.jpg ...
// side: the menu bar: menu | none
const content = require('./library/content');
const collageBlock = require('./collageblock');

const PHOTO = /^(https:\/\/|\/uploads\/)[^\s"'<>()]+$/;
const MAX_PHOTOS = 12, TILES = 6, WIDE = 8;   // 8 or more photos: four columns of two
const MENUS = [['none', 'No menu bar on this block'], ['menu', 'Menu along the top, blended in (a menu bar slides in when visitors scroll)']];
const flat = (v, n) => String(v || '').replace(/[|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

function parse(v) {
  const out = { sub: '', photos: [] };
  String(v || '').split('\n').forEach(l => {
    const m = /^(sub|photos):\s?(.*)$/.exec(l.trim());
    if (!m) return;
    if (m[1] === 'sub') out.sub = flat(m[2], 160);
    else out.photos = m[2].split(/\s+/).filter(u => PHOTO.test(u) && u.length <= 500).slice(0, MAX_PHOTOS);
  });
  return out;
}
function cleanBody(v) {
  const p = parse(v);
  return [].concat(p.sub ? [`sub: ${p.sub}`] : [], p.photos.length ? [`photos: ${p.photos.join(' ')}`] : []).join('\n');
}
const cleanSide = (v) => (MENUS.some(m => m[0] === v) ? v : 'none');

function view(site, blk, services, navPages) {
  const b = blk || {}, own = parse(b.body);
  const photos = own.photos.length ? own.photos : collageBlock.sitePhotos(site, (services || []).filter(x => x && x.title)).slice(0, MAX_PHOTOS);
  const c = ((site && site.sections) || {}).contact || {};
  const phone = String(c.phone || '').trim();
  return {
    headingHtml: content.hlHtml(b.heading || ''),
    sub: own.sub,
    tiles: photos.slice(0, photos.length >= WIDE ? WIDE : TILES),
    cols: photos.length >= WIDE ? 4 : 3,
    spare: photos.slice(photos.length >= WIDE ? WIDE : TILES),
    menu: cleanSide(b.side) === 'menu' ? {
      name: (site && site.name) || '', logo: ((site && site.theme) || {}).logoUrl || '',
      links: (navPages || []).map(p => ({ label: p.label, href: p.href })),
      call: phone ? { label: 'Call Now', href: 'tel:' + phone.replace(/[^0-9+]/g, '') } : null
    } : null,
    button: b.buttonText && b.buttonUrl ? { text: b.buttonText, url: b.buttonUrl } : null
  };
}

module.exports = { parse, cleanBody, cleanSide, view, MENUS, MAX_PHOTOS, TILES, WIDE };
