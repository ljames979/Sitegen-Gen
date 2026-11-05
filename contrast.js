// WCAG 2.x colour contrast helpers (also used by the pre-publish quality check).
const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function parseHex(h) {
  h = String(h || '').trim();
  if (!HEX.test(h)) return null;
  h = h.slice(1); if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (rgb) => '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

function luminance(hex) {
  const c = parseHex(hex); if (!c) return null;
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}
function ratio(a, b) {
  const la = luminance(a), lb = luminance(b); if (la == null || lb == null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// Move a colour toward black (or white) in small steps, keeping its hue, until it reaches `min` against `against`.
function ensureContrast(hex, against, min = 4.5) {
  const c = parseHex(hex); if (!c || !parseHex(against)) return hex;
  if (ratio(hex, against) >= min) return toHex(c);
  const darker = luminance(against) > 0.5;           // text on a light surface must get darker
  const target = darker ? [0, 0, 0] : [255, 255, 255];
  for (let t = 0.04; t <= 1.0001; t += 0.04) {
    const m = toHex(c.map((v, i) => v + (target[i] - v) * t));
    if (ratio(m, against) >= min) return m;
  }
  return toHex(target);
}
const textOn = (bg) => (ratio(bg, '#ffffff') >= ratio(bg, '#111111') ? '#ffffff' : '#111111');

module.exports = { parseHex, toHex, luminance, ratio, ensureContrast, textOn, AA_TEXT: 4.5, AA_LARGE: 3 };
