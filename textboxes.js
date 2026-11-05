// Your own text, anywhere (Leo, 2026-10-31): the owner adds words on top of any part of any page from the preview,
// then drags them into place and sets their size, font, color, bold, italic and alignment. Each text box is pinned to
// one part of the page (a section or content block, named by public/sg-fx.js textKey) at a spot measured in % of
// that part, so it stays over the same thing as the page grows; its size shrinks with narrow screens.
// Saved with the editor (one hidden box, texts_json) as sections.texts.items:
//   { id, page, at, x, y, w, text, size, font, color, bold, italic, align }
// The page draws them in a hidden holder; sg-fx.js moves each into its part (none show without the script).
const fonts = require('./fonts');

const MAX = 40;
const ID = /^t[a-z0-9]{7}$/;
const PAGE = /^[a-z0-9][a-z0-9:/_-]{0,79}$/i;
const AT = /^[^<>"'`\\]{1,120}$/;
const HEX = /^#[0-9a-f]{6}$/i;
const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.round(Math.min(hi, Math.max(lo, n)) * 10) / 10 : d; };
const fontOk = (n) => typeof n === 'string' && (fonts.FONTS.some(f => f.name === n) || (/^[A-Z][A-Za-z0-9]*( [A-Z0-9][A-Za-z0-9]*)*$/.test(n) && !!fonts.cleanFontName(n)));

function cleanOne(t) {
  if (!t || typeof t !== 'object') return null;
  const text = String(t.text == null ? '' : t.text).replace(/\r/g, '').replace(/[<>]/g, '').slice(0, 600);
  if (!text.trim() || !ID.test(String(t.id || '')) || !PAGE.test(String(t.page || '')) || !AT.test(String(t.at || ''))) return null;
  const color = String(t.color || '');
  return {
    id: t.id,
    page: String(t.page),
    at: String(t.at),
    x: num(t.x, 0, 98, 10),
    y: num(t.y, 0, 98, 10),
    w: num(t.w, 4, 100, 40),
    text,
    size: Math.round(num(t.size, 10, 200, 32)),
    font: fontOk(t.font) ? fonts.cleanFontName(t.font) : '',
    color: HEX.test(color) ? color.toLowerCase() : ['brand', 'accent', 'white', 'dark'].includes(color) ? color : '',
    bold: !!t.bold,
    italic: !!t.italic,
    align: ['left', 'center', 'right'].includes(t.align) ? t.align : 'left'
  };
}

// The list as saved: only well-formed boxes, each id once, 40 at most
function clean(list) {
  const seen = new Set();
  return ([]).concat(Array.isArray(list) ? list : []).map(cleanOne).filter(t => t && !seen.has(t.id) && seen.add(t.id)).slice(0, MAX);
}
// From the editor's hidden box (a JSON list); anything unreadable keeps nothing
function fromBody(v) {
  try { return clean(JSON.parse(String(v || '[]'))); } catch (e) { return []; }
}

// Which page this is, as text boxes name it: home, about, services/roof-repair, p/our-story ...
function pageId(pageKey, item) {
  const it = item || {};
  if (pageKey === 'service' && it.service) return 'services/' + it.service.slug;
  if (pageKey === 'area' && it.area) return 'areas/' + it.area.slug;
  if (pageKey === 'post' && it.post) return 'blog/' + it.post.slug;
  if (pageKey === 'extra' && it.extra) return 'p/' + it.extra.slug;
  return pageKey || 'home';
}

const COLORS = { brand: 'var(--primary)', accent: 'var(--accent)', white: '#ffffff', dark: '#111827' };
// The style for one box (the numbers come from clean, so they are safe to write into the page)
function style(t) {
  return [`--x:${t.x}%`, `--y:${t.y}%`, `--w:${t.w}%`, `--fs:${t.size}`,
    t.font ? `font-family:'${t.font}',var(--heading-font,inherit)` : '',
    t.color ? `color:${COLORS[t.color] || t.color}` : '', `font-weight:${t.bold ? 700 : 400}`, `font-style:${t.italic ? 'italic' : 'normal'}`, `text-align:${t.align}`].filter(Boolean).join(';');
}
function forPage(site, page) {
  return clean((((site || {}).sections || {}).texts || {}).items).filter(t => t.page === page);
}
// One stylesheet link for the fonts the page's boxes use
function fontLink(list) {
  const used = [...new Set(list.map(t => t.font).filter(Boolean))];
  return used.length ? 'https://fonts.googleapis.com/css2?' + used.map(n => fonts.familyParam(n)).join('&') + '&display=swap' : '';
}

module.exports = { clean, fromBody, pageId, style, forPage, fontLink, MAX };
