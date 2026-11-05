// Your own pictures, anywhere (Leo, 2026-11-02): like the text boxes (textboxes.js), the owner adds a picture on top
// of any part of a page (a content block, a section) from the preview, drags it into place and pulls its corner to set
// its width and height. A picture is our drawn row of peeking pets (petart.js: cats, dogs, both, or cats and dogs
// taking turns) or the owner's own pictures (1 to 4; more than one take turns). Each one is pinned to its part of the
// page at a spot measured in % of that part, so it stays over the same thing as the page grows.
// Saved with the editor (hidden box pics_json) as sections.texts.pics:
//   { id, page, at, x, y, w, h, art, photos, fit }
// The page draws them in the text boxes' hidden holder; public/sg-fx.js moves each into its part.
const petArt = require('./petart');

const MAX = 20;
const MAX_PEEK = 9;   // pets in a peeking row
const ID = /^p[a-z0-9]{7}$/;
const PAGE = /^[a-z0-9][a-z0-9:/_-]{0,79}$/i;
const AT = /^[^<>"'`\\]{1,120}$/;
const PHOTO = /^(https:\/\/|\/uploads\/)[^\s"'<>()|\\]+$/;
const ARTS = [['peek', 'Pets peeking up and down (moving)'], ['paw', 'A paw print'], ['pawline', 'A paw print (outline)'], ['catpaw', 'A cat paw print'], ['catpawline', 'A cat paw print (outline)'], ['cattrail', 'A trail of cat paw prints'], ['cattrailline', 'A trail of cat paw prints (outline)'], ['pawtrail', 'A trail of paw prints'], ['pawtrailline', 'A trail of paw prints (outline)'], ['turns', 'Cats and dogs taking turns'], ['cats', 'Cats peeking up'], ['dogs', 'Dogs peeking up'], ['mix', 'Cats and dogs together'], ['', 'My own picture']];
const FITS = [['fit', 'Show all of it'], ['fill', 'Fill the box (trim the edges)'], ['stretch', 'Stretch to the box']];
const HEX = /^#[0-9a-f]{6}$/i;
// a paw print's color: the brand (logo) color by default, the accent color, or one the owner picks
const COLORS = { brand: 'var(--primary)', accent: 'var(--accent)', white: '#ffffff', dark: '#111827' };
const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.round(Math.min(hi, Math.max(lo, n)) * 10) / 10 : d; };

function cleanOne(p) {
  if (!p || typeof p !== 'object') return null;
  if (!ID.test(String(p.id || '')) || !PAGE.test(String(p.page || '')) || !AT.test(String(p.at || ''))) return null;
  let art = ARTS.some(a => a[0] === p.art) ? p.art : '';
  const photos = ([]).concat(Array.isArray(p.photos) ? p.photos : []).map(String).filter(u => u.length <= 500 && PHOTO.test(u)).slice(0, art === 'peek' ? MAX_PEEK : 4);
  if (!art && !photos.length) art = 'turns';   // nothing of their own yet: the pets stand in
  return {
    id: p.id, page: String(p.page), at: String(p.at),
    x: num(p.x, -20, 98, 10), y: num(p.y, -20, 98, 10),
    w: num(p.w, 3, 100, 40), h: num(p.h, 2, 100, 25),
    art, photos: art && art !== 'peek' ? [] : photos,
    fit: FITS.some(f => f[0] === p.fit) ? p.fit : 'fit',
    color: HEX.test(String(p.color || '')) ? String(p.color).toLowerCase() : COLORS[p.color] ? p.color : 'brand',
    turn: Math.round(num(p.turn, -180, 180, 0))
  };
}
function clean(list) {
  const seen = new Set();
  return ([]).concat(Array.isArray(list) ? list : []).map(cleanOne).filter(p => p && !seen.has(p.id) && seen.add(p.id)).slice(0, MAX);
}
function fromBody(v) {
  try { return clean(JSON.parse(String(v || '[]'))); } catch (e) { return []; }
}
function forPage(site, page) {
  return clean((((site || {}).sections || {}).texts || {}).pics).filter(p => p.page === page);
}
// the numbers come from clean, so they are safe to write into the page
const style = (p) => `--x:${p.x}%;--y:${p.y}%;--w:${p.w}%;--h:${p.h}%` + (p.turn ? `;--r:${p.turn}deg` : '') + (isPaw(p) ? `;color:${COLORS[p.color] || p.color}` : '');
const PAW_ARTS = ['paw', 'pawline', 'catpaw', 'catpawline', 'cattrail', 'cattrailline', 'pawtrail', 'pawtrailline'];
const isPaw = (p) => PAW_ARTS.includes(p.art);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// what goes inside the box: the pets drawing(s) or the owner's pictures, the first one showing
// Pets peeking over a hidden bar (Leo, 2026-11-02): a row of the owner's pet photos (or our drawn cats and dogs until
// there are some) behind the box's bottom edge. Most rise, look around and duck back down, each at its own pace; every
// third one stays up posing. With fit 'fit' a see-through cut-out photo stands as it is; otherwise each photo sits in a
// window with a rounded top. Still (all up) for visitors who turn motion off. The same numbers are used in the editor.
function peekPets(p) {
  const list = p.photos.length ? p.photos : Array.from({ length: 7 }, (_, i) => i);
  return list.map((u, i) => {
    const pose = i % 3 === 1, t = 7 + ((i * 37) % 5), d = -((i * 2.3) % t).toFixed(1), h = 84 + ((i * 29) % 17);
    const pic = typeof u === 'number' ? petArt.single(u) : `<img src="${esc(u)}" alt="" loading="lazy">`;
    return `<span class="sg-peek-pet${pose ? ' sg-peek-pose' : ''}" style="--t:${t}s;--d:${d}s;--ph:${h}%">${pic}</span>`;
  }).join('');
}
function inner(p) {
  if (p.art === 'peek') return `<div class="sg-peek on${p.photos.length ? '' : ' sg-peek-drawn'}">${peekPets(p)}</div>`;
  const on = (i) => (i === 0 ? ' class="on"' : '');
  if (isPaw(p)) return petArt[/trail/.test(p.art) ? 'trail' : 'paw'](/line$/.test(p.art), p.fit, /^cat/.test(p.art) ? 'cat' : 'dog').replace('<svg class="sg-pets', '<svg class="on sg-pets');
  if (p.art === 'turns') return [petArt.svg('cats', p.fit), petArt.svg('dogs', p.fit)].map((s, i) => s.replace('<svg class="sg-pets"', `<svg class="sg-pets${i === 0 ? ' on' : ''}"`)).join('');
  if (p.art) return petArt.svg(p.art, p.fit).replace('<svg class="sg-pets"', '<svg class="sg-pets on"');
  return p.photos.map((u, i) => `<img src="${esc(u)}" alt=""${on(i)} loading="lazy">`).join('');
}
const turns = (p) => p.art === 'turns' || (!p.art && p.photos.length > 1);
function html(p) {
  return `<div class="sg-pic sg-pic-${p.fit}" data-sg-pic="${p.id}" data-at="${esc(p.at)}" style="${style(p)}"${turns(p) ? ' data-sg-tb-turns' : ''}><div class="sg-pic-in sg-tb-pic">${inner(p)}</div></div>`;
}

module.exports = { PAW_ARTS, clean, fromBody, forPage, style, inner, html, turns, isPaw, peekPets, ARTS, FITS, COLORS, MAX, MAX_PEEK };
