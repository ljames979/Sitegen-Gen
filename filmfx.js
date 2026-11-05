// Color film: a see-through layer of color laid over a section or block, so it takes on the brand's color (the main
// color, which the Brand kit takes from the logo) or a color the owner picks. Saved as "<color>:<strength>": color is
// "brand" or a hex like #1b2a4a, strength the share of color in %, e.g. "brand:30". '' is no film.
const STRENGTHS = [10, 20, 30, 40, 50, 60, 70, 80];
const HEX = /^#[0-9a-f]{6}$/i;

function clean(v) {
  const m = /^(brand|#[0-9a-fA-F]{6}):(\d{1,2})$/.exec(String(v || '').trim());
  if (!m || !STRENGTHS.includes(Number(m[2]))) return '';
  return `${m[1].toLowerCase()}:${m[2]}`;
}
// from the two form fields (strength '' = off, color '' = the brand's)
function fromFields(strength, color) {
  const c = String(color || '').trim();
  return clean(`${HEX.test(c) ? c : 'brand'}:${String(strength || '').trim()}`);
}
function parts(v) {
  const p = clean(v);
  if (!p) return { on: false, color: '', strength: '' };
  const [c, s] = p.split(':');
  return { on: true, color: c === 'brand' ? '' : c, strength: s };
}
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
// the class and style for the wrapper; the brand color comes from the site's theme
function attrs(v, theme) {
  const p = parts(v);
  if (!p.on) return { cls: '', style: '' };
  const brand = theme && HEX.test(theme.primaryColor || '') ? theme.primaryColor : '#2563eb';
  return { cls: ' sg-film', style: `--film-c: ${rgba(p.color || brand, Number(p.strength) / 100)};` };
}
// above the section's photos and words, but clicks still reach the buttons and links under it
const CSS = '.sg-film{position:relative;isolation:isolate}.sg-film::after{content:"";position:absolute;inset:0;background:var(--film-c);pointer-events:none;z-index:50}';

module.exports = { STRENGTHS, clean, fromFields, parts, attrs, CSS };
