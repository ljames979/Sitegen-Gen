// "Decorative card" content block (Leo, 2026-11-09): words framed in a styled card, like a business card or an
// invitation. Six card styles (Royal, Classic minimal, Art deco, Vintage stamp, Ribbon banner, Frosted glass) the owner
// can switch between at any time without losing the words. Every border, corner curl, divider and icon is drawn here
// as SVG or CSS (no images), in colors the owner picks, so they stay sharp at any size. Our own drawings throughout.
// Markup comes from html() below (views/_blocks.ejs calls it), CSS is in public/sg-site.css (.sg-dc-*), the editor
// panel is in views/sections/_blocks.ejs with public/decocard-edit.js.
//
// The editor writes the block's body as lines (the owner never types this):
//   style: royal | minimal | deco | stamp | ribbon | glass
//   icon: crown | tiara | paw | heart | star | diamond | none
//   eyebrow: By Royal Appointment     tagline: Purveyors of ...     quote: Because to you ...
//   text: a paragraph (up to 4)       detail: [ADDRESS] (up to 3)
//   hide: eyebrow, div2               (slots turned off; the heading and button come from the block's own boxes)
//   border / orn / card / headc / bodyc / accc / btnc: #rrggbb   (orn = own ornament color; empty = border color)
//   cardop: 0-100   sec: solid | gradient | glow   sec1 / sec2: #rrggbb
//   thick: 1-6   radius: 0-32   (empty = the style's own)   pad: s|m|l   width: s|m|l   shadow: none|soft|strong
//   hfont / bfont: a Google font name (empty = the site's fonts)
//   pat: crowns | paws | hearts | dots   patc: #rrggbb   patop: 5-100   (a faint wallpaper behind the card)
//   ledge: #rrggbb                       (a soft band along the bottom, for peeking pets to peek over)
// Invitation Reveal (Leo, 2026-11-10): the same card, sealed in an envelope that opens as the visitor scrolls
//   reveal: envelope   env / flap / seal / liner: #rrggbb   sealicon: crown | paw | heart | star | none
//   len: s | m | l (how much scrolling it takes)   hint: Scroll to open   once: yes (stays open once opened)
const contrast = require('./contrast');
const fonts = require('./fonts');

const HEX = /^#[0-9a-f]{6}$/i;
const hex = (v) => { const s = String(v || '').trim(); return HEX.test(s) ? s.toLowerCase() : ''; };
const flat = (v, n) => String(v || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// [id, name, one line, the style's own border thickness, corner radius, card opacity]
const STYLES = [
  ['royal', 'Royal', 'A thick and a thin border, curls in the corners, star dividers', 4, 2, 100],
  ['minimal', 'Classic minimal', 'One thin border, small rounded corners, lots of space', 1, 8, 100],
  ['deco', 'Art deco', 'Stepped corners, a second thin border, a fan at the top, diamond dividers', 2, 0, 100],
  ['stamp', 'Vintage stamp', 'A perforated edge like a postage stamp, a dashed inner border, dotted dividers', 2, 0, 100],
  ['ribbon', 'Ribbon banner', 'A plain card with a ribbon behind the heading', 2, 6, 100],
  ['glass', 'Frosted glass', 'See-through frosted card, a light border, big round corners, soft shadow', 1, 28, 62]
];
const STYLE_IDS = STYLES.map(s => s[0]);
const ICONS = [['crown', 'Crown'], ['tiara', 'Tiara'], ['paw', 'Paw'], ['heart', 'Heart'], ['star', 'Star'], ['diamond', 'Diamond'], ['none', 'No icon']];
// the slots, top to bottom, with what the owner calls them
const SLOTS = [['icon', 'Top icon'], ['eyebrow', 'Small line on top'], ['heading', 'Heading'], ['tagline', 'Tagline'], ['div1', 'First divider'],
  ['body', 'Paragraphs'], ['quote', 'Closing line'], ['div2', 'Second divider'], ['details', 'Details row'], ['button', 'Button']];
const SLOT_IDS = SLOTS.map(s => s[0]);
const PRESETS = [['Gold', '#b8923a'], ['Rose gold', '#b76e79'], ['Silver', '#a8a9ad'], ['Blush', '#d4a5b5'], ['Glass blue', '#9fc7e3'], ['Black', '#2a2230']];
const PADS = [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']];
const WIDTHS = [['s', 'Small (600px)', 600], ['m', 'Medium (880px)', 880], ['l', 'Large (1100px)', 1100]];
const SHADOWS = [['none', 'No shadow'], ['soft', 'Soft shadow'], ['strong', 'Strong shadow']];
const SECS = [['', 'The block\'s own background (below)'], ['solid', 'One color'], ['gradient', 'Two-color gradient'], ['glow', 'A soft glow behind the card']];
const MAX_TEXT = 4, MAX_DETAIL = 3;
const COLOR_KEYS = ['border', 'orn', 'card', 'headc', 'bodyc', 'accc', 'btnc', 'sec1', 'sec2', 'patc', 'ledge', 'env', 'flap', 'seal', 'liner'];
const REVEALS = [['', 'No, the card just shows'], ['envelope', 'Yes: the card comes out of an envelope as visitors scroll']];
const SEAL_ICONS = [['crown', 'Crown'], ['paw', 'Paw'], ['heart', 'Heart'], ['star', 'Star'], ['none', 'Plain seal']];
const LENS = [['s', 'Quick (a little scrolling)', 180], ['m', 'Normal', 250], ['l', 'Slow (more scrolling)', 320]];
const PATS = [['', 'No wallpaper'], ['crowns', 'Crowns'], ['paws', 'Paw prints'], ['hearts', 'Hearts'], ['dots', 'Dots']];
// the envelope's own colors when the owner hasn't picked any (Leo's Imperial pinks)
const RV_KEYS = ['env', 'flap', 'seal', 'liner'];
const RV_DEFAULTS = { env: '#f2a9c6', flap: '#e57faa', seal: '#d9578f', liner: '#fdeef4' };

const styleOf = (id) => STYLES.find(s => s[0] === id) || STYLES[0];
const int = (v, lo, hi) => { const n = parseInt(String(v == null ? '' : v).trim(), 10); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : null; };

function parse(v) {
  const out = { style: 'royal', icon: 'crown', eyebrow: '', tagline: '', text: [], quote: '', details: [], hide: [],
    border: '', orn: '', card: '', headc: '', bodyc: '', accc: '', btnc: '', sec: '', sec1: '', sec2: '',
    cardop: null, thick: null, radius: null, pad: 'm', width: 'm', shadow: 'soft', hfont: '', bfont: '',
    pat: '', patc: '', patop: null, ledge: '', reveal: '', env: '', flap: '', seal: '', liner: '', sealicon: 'crown', len: 'm', hint: '', once: false };
  String(v || '').split('\n').forEach(l => {
    const m = /^([a-z0-9]+):\s?(.*)$/.exec(l.trim());
    if (!m) return;
    const k = m[1], val = m[2];
    if (k === 'style') { if (STYLE_IDS.includes(val.trim())) out.style = val.trim(); }
    else if (k === 'icon') { if (ICONS.some(i => i[0] === val.trim())) out.icon = val.trim(); }
    else if (k === 'eyebrow') out.eyebrow = flat(val, 80);
    else if (k === 'tagline') out.tagline = flat(val, 160);
    else if (k === 'quote') out.quote = flat(val, 300);
    else if (k === 'text') { const t = flat(val, 900); if (t && out.text.length < MAX_TEXT) out.text.push(t); }
    else if (k === 'detail') { const t = flat(val, 80); if (t && out.details.length < MAX_DETAIL) out.details.push(t); }
    else if (k === 'hide') out.hide = val.split(/[\s,]+/).filter(s => SLOT_IDS.includes(s)).filter((s, i, a) => a.indexOf(s) === i);
    else if (COLOR_KEYS.includes(k)) out[k] = hex(val);
    else if (k === 'sec') out.sec = SECS.some(s => s[0] === val.trim()) ? val.trim() : '';
    else if (k === 'cardop') out.cardop = int(val, 0, 100);
    else if (k === 'thick') out.thick = int(val, 1, 6);
    else if (k === 'radius') out.radius = int(val, 0, 32);
    else if (k === 'pad') { if (PADS.some(p => p[0] === val.trim())) out.pad = val.trim(); }
    else if (k === 'width') { if (WIDTHS.some(p => p[0] === val.trim())) out.width = val.trim(); }
    else if (k === 'shadow') { if (SHADOWS.some(p => p[0] === val.trim())) out.shadow = val.trim(); }
    else if (k === 'hfont' || k === 'bfont') out[k] = fonts.cleanFontName(val) || '';
    else if (k === 'pat') out.pat = PATS.some(x => x[0] === val.trim()) ? val.trim() : '';
    else if (k === 'patop') out.patop = int(val, 5, 100);
    else if (k === 'reveal') out.reveal = REVEALS.some(x => x[0] === val.trim()) ? val.trim() : '';
    else if (k === 'sealicon') { if (SEAL_ICONS.some(x => x[0] === val.trim())) out.sealicon = val.trim(); }
    else if (k === 'len') { if (LENS.some(x => x[0] === val.trim())) out.len = val.trim(); }
    else if (k === 'hint') out.hint = flat(val, 60);
    else if (k === 'once') out.once = /^(yes|on|true|1)$/i.test(val.trim());
  });
  return out;
}

function cleanBody(v) {
  const p = parse(v), l = [`style: ${p.style}`, `icon: ${p.icon}`];
  if (p.eyebrow) l.push(`eyebrow: ${p.eyebrow}`);
  if (p.tagline) l.push(`tagline: ${p.tagline}`);
  p.text.forEach(t => l.push(`text: ${t}`));
  if (p.quote) l.push(`quote: ${p.quote}`);
  p.details.forEach(t => l.push(`detail: ${t}`));
  if (p.hide.length) l.push(`hide: ${p.hide.join(', ')}`);
  COLOR_KEYS.forEach(k => {
    if (!p[k] || (k === 'patc' && !p.pat) || (RV_KEYS.includes(k) && !p.reveal)) return;
    l.push(`${k}: ${p[k]}`);
  });
  if (p.sec) l.push(`sec: ${p.sec}`);
  ['cardop', 'thick', 'radius'].forEach(k => { if (p[k] != null) l.push(`${k}: ${p[k]}`); });
  if (p.pad !== 'm') l.push(`pad: ${p.pad}`);
  if (p.width !== 'm') l.push(`width: ${p.width}`);
  if (p.shadow !== 'soft') l.push(`shadow: ${p.shadow}`);
  if (p.hfont) l.push(`hfont: ${p.hfont}`);
  if (p.bfont) l.push(`bfont: ${p.bfont}`);
  if (p.pat) l.push(`pat: ${p.pat}`);
  if (p.pat && p.patop != null) l.push(`patop: ${p.patop}`);
  if (p.reveal) {
    l.push(`reveal: ${p.reveal}`);
    if (p.sealicon !== 'crown') l.push(`sealicon: ${p.sealicon}`);
    if (p.len !== 'm') l.push(`len: ${p.len}`);
    if (p.hint) l.push(`hint: ${p.hint}`);
    if (p.once) l.push('once: yes');
  }
  return l.join('\n');
}

// ---- drawings (all in currentColor, so CSS gives them the border or ornament color) ----
const ICON_SVG = {
  crown: '<svg viewBox="0 0 40 30"><path d="M5 23 L7 9 L14 15.5 L20 5 L26 15.5 L33 9 L35 23 Z" fill="currentColor" fill-opacity=".14" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M5 26.5 H35" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="7" cy="7.5" r="1.9" fill="currentColor"/><circle cx="20" cy="3.6" r="2.1" fill="currentColor"/><circle cx="33" cy="7.5" r="1.9" fill="currentColor"/><circle cx="20" cy="18" r="1.6" fill="currentColor"/></svg>',
  tiara: '<svg viewBox="0 0 40 30"><path d="M4 25 C9 13 31 13 36 25" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M10 18.5 L12.5 10.5 L15 16.2 M20 15 V5.5 M25 16.2 L27.5 10.5 L30 18.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/><circle cx="12.5" cy="9" r="1.7" fill="currentColor"/><circle cx="27.5" cy="9" r="1.7" fill="currentColor"/><path d="M20 2 L22 5 L20 8 L18 5 Z" fill="currentColor"/><circle cx="20" cy="20" r="1.5" fill="currentColor"/></svg>',
  paw: '<svg viewBox="0 0 40 34"><ellipse cx="8.5" cy="15" rx="3.6" ry="4.6" transform="rotate(-18 8.5 15)" fill="currentColor"/><ellipse cx="15.5" cy="7.5" rx="3.8" ry="5" transform="rotate(-6 15.5 7.5)" fill="currentColor"/><ellipse cx="24.5" cy="7.5" rx="3.8" ry="5" transform="rotate(6 24.5 7.5)" fill="currentColor"/><ellipse cx="31.5" cy="15" rx="3.6" ry="4.6" transform="rotate(18 31.5 15)" fill="currentColor"/><path d="M20 15.5 C25 15.5 30.5 22 30 26.5 C29.6 30 26.5 31 23.5 30 C21.6 29.4 18.4 29.4 16.5 30 C13.5 31 10.4 30 10 26.5 C9.5 22 15 15.5 20 15.5 Z" fill="currentColor"/></svg>',
  heart: '<svg viewBox="0 0 40 34"><path d="M20 31 C9 23 4 17.5 4 11.5 C4 7 7.5 3.5 12 3.5 C15.5 3.5 18.2 5.5 20 8.6 C21.8 5.5 24.5 3.5 28 3.5 C32.5 3.5 36 7 36 11.5 C36 17.5 31 23 20 31 Z" fill="currentColor" fill-opacity=".14" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  star: '<svg viewBox="0 0 40 36"><path d="M20 3 L24.6 13.2 L35.7 14.4 L27.4 21.9 L29.7 32.8 L20 27.2 L10.3 32.8 L12.6 21.9 L4.3 14.4 L15.4 13.2 Z" fill="currentColor" fill-opacity=".14" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  diamond: '<svg viewBox="0 0 40 34"><path d="M11 4 H29 L36 12 L20 31 L4 12 Z" fill="currentColor" fill-opacity=".14" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 12 H36 M15 4 L13 12 L20 31 L27 12 L25 4 M13 12 L20 4 L27 12" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>'
};
// one corner curl (drawn for the top left corner; CSS mirrors it for the other three)
const CURL = '<svg viewBox="0 0 64 64"><path d="M5 59 C5 29 29 5 59 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M59 5 C51 3.5 46.5 9 49.5 13 C52 16.2 57 14.5 55.6 11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M5 59 C3.5 51 9 46.5 13 49.5 C16.2 52 14.5 57 11 55.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M14 44 C14 28 28 14 44 14" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/><path d="M19.5 19.5 C24 16.5 29 17 32 21 M19.5 19.5 C16.5 24 17 29 21 32" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M19.5 19.5 L13 13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="10.5" cy="10.5" r="2.3" fill="currentColor"/><circle cx="34" cy="23" r="1.3" fill="currentColor"/><circle cx="23" cy="34" r="1.3" fill="currentColor"/></svg>';
const STAR4 = '<svg viewBox="0 0 20 20"><path d="M10 0 C10.8 6.5 13.5 9.2 20 10 C13.5 10.8 10.8 13.5 10 20 C9.2 13.5 6.5 10.8 0 10 C6.5 9.2 9.2 6.5 10 0 Z" fill="currentColor"/></svg>';
const DIAMONDS = '<svg viewBox="0 0 44 12"><path d="M6 1 L11 6 L6 11 L1 6 Z M22 0 L28 6 L22 12 L16 6 Z M38 1 L43 6 L38 11 L33 6 Z" fill="currentColor"/></svg>';
const FAN = '<svg viewBox="0 0 120 60"><path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M26 60 A34 34 0 0 1 94 60" fill="none" stroke="currentColor" stroke-width="1.2"/>'
  + [-80, -60, -40, -20, 0, 20, 40, 60, 80].map(a => { const r = (a - 90) * Math.PI / 180; return `<path d="M60 60 L${(60 + 48 * Math.cos(r)).toFixed(1)} ${(60 + 48 * Math.sin(r)).toFixed(1)}" stroke="currentColor" stroke-width="${a % 40 === 0 ? 1.6 : 1}"/>`; }).join('')
  + '<circle cx="60" cy="60" r="7" fill="currentColor"/></svg>';

// ---- wallpaper tiles (72 x 72, repeated behind the card) ----
function patTile(id, color) {
  const c = hex(color) || '#f2a9c6';
  let art = '';
  if (id === 'crowns') art = [[6, 10], [42, 46]].map(([x, y]) => `<g transform="translate(${x} ${y}) scale(.6)"><path d="M5 23 L7 9 L14 15.5 L20 5 L26 15.5 L33 9 L35 23 Z" fill="${c}"/><path d="M5 26.5 H35" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/></g>`).join('');
  else if (id === 'paws') art = [[8, 10, -16], [44, 44, 18]].map(([x, y, r]) => `<g transform="translate(${x} ${y}) rotate(${r} 10 9) scale(.5)">${ICON_SVG.paw.replace(/^<svg[^>]*>|<\/svg>$/g, '').replace(/currentColor/g, c)}</g>`).join('');
  else if (id === 'hearts') art = [[9, 11], [45, 47]].map(([x, y]) => `<path transform="translate(${x} ${y}) scale(.48)" d="M20 31 C9 23 4 17.5 4 11.5 C4 7 7.5 3.5 12 3.5 C15.5 3.5 18.2 5.5 20 8.6 C21.8 5.5 24.5 3.5 28 3.5 C32.5 3.5 36 7 36 11.5 C36 17.5 31 23 20 31 Z" fill="${c}"/>`).join('');
  else if (id === 'dots') art = `<circle cx="18" cy="18" r="3.2" fill="${c}"/><circle cx="54" cy="54" r="3.2" fill="${c}"/>`;
  else return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72">${art}</svg>`;
}
const svgUrl = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

// ---- the envelope (Invitation Reveal): drawn 100 x 62, stretched to the envelope's box ----
function envBack(c) {
  return `<svg viewBox="0 0 100 62" preserveAspectRatio="none" focusable="false"><rect width="100" height="62" rx="2.2" fill="${c.back}"/><path d="M3.5 2.5 H96.5 L50 31 Z" fill="${c.liner}"/></svg>`;
}
function envPocket(c) {
  return `<svg viewBox="0 0 100 62" preserveAspectRatio="none" focusable="false"><path d="M0 0 L50 34 L0 62 Z" fill="${c.side}"/><path d="M100 0 L50 34 L100 62 Z" fill="${c.side}"/>`
    + `<path d="M0 62 L50 29 L100 62 Z" fill="${c.env}"/><path d="M1 61 L50 29.6 L99 61" fill="none" stroke="${c.edge}" stroke-width=".35" stroke-opacity=".55" vector-effect="non-scaling-stroke"/></svg>`;
}
function envFlap(fill, edge) {
  return `<svg viewBox="0 0 100 62" preserveAspectRatio="none" focusable="false"><path d="M0 0 H100 L55.5 33.2 Q50 37.4 44.5 33.2 Z" fill="${fill}"/><path d="M0 .4 L44.5 33.2 Q50 37.4 55.5 33.2 L100 .4" fill="none" stroke="${edge}" stroke-width="1" stroke-opacity=".5" vector-effect="non-scaling-stroke"/></svg>`;
}
// a wax seal with a wavy edge, a ring pressed into it and the icon in the middle
function sealSvg(c, icon, gid) {
  const pts = [];
  for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, r = 46 + 2.6 * Math.sin(a * 9) + 1.4 * Math.sin(a * 5 + 1); pts.push(`${(50 + r * Math.cos(a)).toFixed(1)} ${(50 + r * Math.sin(a)).toFixed(1)}`); }
  const ic = icon !== 'none' && ICON_SVG[icon] ? ICON_SVG[icon].replace('<svg ', `<svg x="27" y="29" width="46" height="40" style="color:${c.sealInk}" `) : '';
  return `<svg viewBox="0 0 100 100" focusable="false"><defs><radialGradient id="${gid}" cx="38%" cy="34%" r="70%"><stop offset="0" stop-color="${c.seal}"/><stop offset="1" stop-color="${c.seal2}"/></radialGradient></defs>`
    + `<path d="M${pts.join(' L')} Z" fill="url(#${gid})"/><circle cx="50" cy="50" r="33" fill="none" stroke="${c.seal2}" stroke-width="2.4" stroke-opacity=".7"/><circle cx="50" cy="50" r="30.5" fill="none" stroke="${c.sealInk}" stroke-width=".8" stroke-opacity=".45"/>${ic}</svg>`;
}

function divider(style) {
  if (style === 'royal') return `<span class="sg-dc-ln"></span><span class="sg-dc-mk">${STAR4}</span><span class="sg-dc-ln"></span>`;
  if (style === 'deco') return `<span class="sg-dc-ln"></span><span class="sg-dc-mk sg-dc-mk-wide">${DIAMONDS}</span><span class="sg-dc-ln"></span>`;
  if (style === 'ribbon') return '<span class="sg-dc-ln"></span><span class="sg-dc-dot"></span><span class="sg-dc-ln"></span>';
  return '<span class="sg-dc-ln"></span>';   // minimal: a short line; stamp: a dotted line; glass: a faded line (CSS)
}
function frame(style) {
  if (style === 'royal') return '<span class="sg-dc-inner"></span>' + ['tl', 'tr', 'bl', 'br'].map(c => `<span class="sg-dc-curl sg-dc-${c}">${CURL}</span>`).join('');
  if (style === 'deco') {
    const corner = (c) => `<span class="sg-dc-step sg-dc-${c}"><i></i><i></i><i></i><i></i></span>`;
    return '<span class="sg-dc-edges"><i class="t"></i><i class="r"></i><i class="b"></i><i class="l"></i></span>' + ['tl', 'tr', 'bl', 'br'].map(corner).join('')
      + '<span class="sg-dc-inner"><i class="t"></i><i class="r"></i><i class="b"></i><i class="l"></i>' + ['tl', 'tr', 'bl', 'br'].map(corner).join('') + '</span>'
      + `<span class="sg-dc-fan">${FAN}</span>`;
  }
  if (style === 'stamp') return '<span class="sg-dc-inner"></span>';
  return '';
}

// the color of a card over the section: the card color with its opacity laid over the section's own color
function mix(a, b, t) { const x = contrast.parseHex(a), y = contrast.parseHex(b); return x && y ? contrast.toHex(x.map((v, i) => v * t + y[i] * (1 - t))) : a; }
const rgba = (h, op) => { const c = contrast.parseHex(h) || [255, 255, 255]; return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${Math.round(op) / 100})`; };

// everything the markup needs, worked out once (also used by the tests and the editor's contrast warning)
function view(site, blk) {
  const b = blk || {}, o = parse(b.body), t = (site && site.theme) || {};
  const st = styleOf(o.style);
  const brand = hex(t.primaryColor) || '#b8923a';
  const border = o.border || '#b8923a';
  const orn = o.orn || border;
  const card = o.card || '#ffffff';
  const cardop = o.cardop != null ? o.cardop : st[5];
  const secBase = o.sec ? (o.sec1 || '#fdeef4') : (hex(t.bgColor) || '#ffffff');
  const behind = mix(card, secBase, cardop / 100);   // what the words actually sit on
  const head = o.headc || contrast.ensureContrast(brand, behind, 4.5);
  const body = o.bodyc || contrast.ensureContrast('#3a3340', behind, 4.5);
  const accent = o.accc || contrast.ensureContrast(border, behind, 4.5);
  const btn = o.btnc || '';
  const shown = (k) => !o.hide.includes(k);
  const warn = [['headc', 'Heading', head], ['bodyc', 'Body text', body], ['accc', 'Small line and tagline', accent]]
    .map(([k, what, c]) => { const r = contrast.ratio(c, behind); return r != null && r < 4.5 ? { key: k, what, color: c, ratio: Math.round(r * 100) / 100, better: contrast.ensureContrast(c, behind, 4.5) } : null; })
    .filter(Boolean);
  let secCss = '';
  if (o.sec === 'solid') secCss = `background: ${secBase};`;
  else if (o.sec === 'gradient') secCss = `background: linear-gradient(135deg, ${secBase}, ${o.sec2 || '#c9e4f5'});`;
  else if (o.sec === 'glow') secCss = `background: radial-gradient(ellipse 72% 80% at 50% 50%, ${o.sec2 || '#c9e4f5'} 0%, ${rgba(o.sec2 || '#c9e4f5', 70)} 45%, ${rgba(secBase, 0)} 78%), ${secBase};`;
  let rv = null;
  if (o.reveal === 'envelope') {
    const env = o.env || RV_DEFAULTS.env, seal = o.seal || RV_DEFAULTS.seal;
    rv = { env, flap: o.flap || RV_DEFAULTS.flap, liner: o.liner || RV_DEFAULTS.liner, seal, seal2: mix(seal, '#2a0716', 0.6),
      sealInk: mix('#ffffff', seal, 0.82), back: mix(env, '#000000', 0.86), side: mix(env, '#000000', 0.94), edge: mix(env, '#000000', 0.55),
      icon: o.sealicon, len: (LENS.find(x => x[0] === o.len) || LENS[1])[2], hint: o.hint || 'Scroll to open', once: o.once,
      // in the envelope the glow sits behind the card on the screen, not spread over the whole tall section
      glow: o.sec === 'glow' ? `radial-gradient(ellipse 62% 58% at 50% 54%, ${o.sec2 || '#c9e4f5'} 0%, ${rgba(o.sec2 || '#c9e4f5', 70)} 40%, ${rgba(o.sec2 || '#c9e4f5', 0)} 74%)` : '' };
    rv.flapEdge = mix(rv.flap, '#000000', 0.6);
  }
  return {
    rv, pat: o.pat ? { id: o.pat, color: o.patc || '#f2a9c6', op: o.patop != null ? o.patop : 55 } : null, ledge: o.ledge,
    style: o.style, styleName: st[1], icon: o.icon,
    eyebrow: shown('eyebrow') ? o.eyebrow : '', tagline: shown('tagline') ? o.tagline : '', text: shown('body') ? o.text : [],
    quote: shown('quote') ? o.quote : '', details: shown('details') ? o.details : [],
    heading: shown('heading') ? String(b.heading || '') : '',
    showIcon: shown('icon') && o.icon !== 'none', div1: shown('div1'), div2: shown('div2'),
    button: shown('button') && b.buttonText && b.buttonUrl ? { text: b.buttonText, url: b.buttonUrl } : null,
    colors: { border, orn, card, head, body, accent, btn, btnOn: btn ? contrast.textOn(btn) : '', ribbonOn: contrast.textOn(orn), behind },
    cardop, thick: o.thick != null ? o.thick : st[3], radius: o.radius != null ? o.radius : st[4],
    pad: o.pad, width: (WIDTHS.find(w => w[0] === o.width) || WIDTHS[1])[2], shadow: o.shadow,
    hfont: o.hfont, bfont: o.bfont, sec: o.sec, secCss, secEdge: secBase, warn
  };
}

// the block's markup. opts: { pv (owner's preview: rows are clickable), bg / ec (the block's shared classes) }
function html(site, blk, opts) {
  const v = view(site, blk), b = blk || {}, op = opts || {};
  const c = v.colors;
  const vars = [`--dc-b: ${c.border}`, `--dc-o: ${c.orn}`, `--dc-card: ${rgba(c.card, v.cardop)}`, `--dc-h: ${c.head}`, `--dc-t: ${c.body}`,
    `--dc-a: ${c.accent}`, `--dc-ro: ${c.ribbonOn}`, `--dc-w: ${v.thick}px`, `--dc-r: ${v.radius}px`, `--dc-max: ${v.width}px`]
    .concat(c.btn ? [`--dc-btn: ${c.btn}`, `--dc-btn-on: ${c.btnOn}`] : [])
    .concat(v.hfont ? [`--dc-hf: ${fonts.cssFamily(v.hfont, 'serif').replace(/'/g, '&#39;')}`] : [])
    .concat(v.bfont ? [`--dc-bf: ${fonts.cssFamily(v.bfont, 'sans-serif').replace(/'/g, '&#39;')}`] : []).join('; ');
  const cls = ['sg-dc', `sg-dc-${v.style}`, `sg-dc-pad-${v.pad}`, `sg-dc-sh-${v.shadow}`, v.cardop < 100 ? 'sg-dc-see' : ''].filter(Boolean).join(' ');
  const div = (n) => `<div class="sg-dc-div sg-dc-div${n}" aria-hidden="true">${divider(v.style)}</div>`;
  const head = v.heading ? `<h2 class="sg-dc-h">${v.style === 'ribbon' ? `<span class="sg-dc-rib">${esc(plainHeading(v.heading))}</span>` : esc(plainHeading(v.heading))}</h2>` : '';
  const parts = [
    v.showIcon ? `<div class="sg-dc-icon" aria-hidden="true">${ICON_SVG[v.icon] || ''}</div>` : '',
    v.eyebrow ? `<p class="sg-dc-eyebrow">${esc(v.eyebrow)}</p>` : '',
    head,
    v.tagline ? `<p class="sg-dc-tag">${esc(v.tagline)}</p>` : '',
    v.div1 ? div(1) : '',
    v.text.length ? `<div class="sg-dc-body">${v.text.map(t => `<p>${esc(t)}</p>`).join('')}</div>` : '',
    v.quote ? `<p class="sg-dc-quote">${esc(v.quote)}</p>` : '',
    v.div2 ? div(2) : '',
    v.details.length ? `<ul class="sg-dc-details">${v.details.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '',
    v.button ? `<p class="sg-dc-cta"><a class="btn sg-dc-btn" href="${esc(v.button.url)}">${esc(v.button.text)}</a></p>` : ''
  ].join('');
  const secCls = (v.sec ? ` sg-dc-sec sg-dc-sec-${v.sec}` : '') + (v.rv ? ' sg-rv' : '') + (v.pat ? ' sg-dc-haspat' : '');
  const sty = [v.secCss ? `${v.secCss} --edge: ${v.secEdge};` : '', v.rv ? `--rv-len: ${v.rv.len}vh;` : ''].join(' ').trim();
  const pat = v.pat && patTile(v.pat.id, v.pat.color) ? `<span class="sg-dc-pat" aria-hidden="true" style="background-image: ${esc(svgUrl(patTile(v.pat.id, v.pat.color)))}; opacity: ${v.pat.op / 100};"></span>` : '';
  const ledge = v.ledge ? `<span class="sg-dc-ledge" aria-hidden="true" style="--ledge: ${v.ledge};"></span>` : '';
  const card = `<div class="blk-inner sg-dc-stage"><div class="${cls}" style="${vars}">`
    + `<span class="sg-dc-bgl" aria-hidden="true"></span><span class="sg-dc-fr" aria-hidden="true">${frame(v.style)}</span>`
    + `<div class="sg-dc-in"${v.rv ? '' : ' data-reveal'}>${parts}</div></div></div>`;
  const open = `<section${b.id ? ` data-sg-bid="${esc(b.id)}"` : ''}${op.pv && b._i != null ? ` data-sg-blk="${esc(b._i)}"` : ''} class="blk blk-decocard blk-bg-${esc(op.bg || 'none')}${esc(op.ec || '')}${secCls}"${sty ? ` style="${sty}"` : ''}>`;
  if (!v.rv) return open + pat + card + ledge + '</section>';
  // Invitation Reveal: the card (with the ledge) is the "sheet"; the envelope's back and its front lie behind and in
  // front of it. Without the script (or for visitors who turn motion off, and in the owner's preview) the sheet
  // simply shows, open; the little script below turns the envelope on before the section is drawn.
  const r = v.rv, gid = 'sgrv' + String(b.id || 'x').replace(/[^a-z0-9]/gi, '');
  const live = op.pv ? '' : `<script>(function(s){try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)s.classList.add('sg-rv-live')}catch(e){}})(document.currentScript.parentNode)</script>`;
  return open + live + pat
    + `<div class="sg-rv-track"${r.once ? ' data-once' : ''}><div class="sg-rv-stage"${r.glow ? ` style="--rv-glow: ${r.glow};"` : ''}>`
    + `<div class="sg-rv-envb" aria-hidden="true"><span class="sg-rv-back">${envBack(r)}</span><span class="sg-rv-flap sg-rv-flapb">${envFlap(r.liner, r.flapEdge)}</span></div>`
    + `<div class="sg-rv-sheet">${card}${ledge}</div>`
    + `<div class="sg-rv-envf" role="button" tabindex="0" aria-label="Open the invitation"><span class="sg-rv-pocket" aria-hidden="true">${envPocket(r)}</span>`
    + `<span class="sg-rv-flap sg-rv-flapf" aria-hidden="true">${envFlap(r.flap, r.flapEdge)}</span>`
    + `<span class="sg-rv-seal" aria-hidden="true"><i class="sg-rv-sl">${sealSvg(r, r.icon, gid + 'a')}</i><i class="sg-rv-sr">${sealSvg(r, r.icon, gid + 'b')}</i></span></div>`
    + `<p class="sg-rv-hint" aria-hidden="true"><span>${esc(r.hint)}</span><b>&darr;</b></p>`
    + `</div></div><div class="sg-rv-more" aria-hidden="true"></div></section>`;
}
// the card shows the heading as plain words ([highlight] marks and {{style|..}} marks dropped)
const plainHeading = (h) => String(h || '').replace(/\{\{([^{}|<>]{1,300}?)(?:\|[^{}|<>]{0,40}){1,6}\}\}/g, '$1').replace(/[\[\]]/g, '');

// fonts the site must load for its cards (public-site.ejs adds them to the Google Fonts link)
function fontsOf(site) {
  const items = ((site && site.sections && site.sections.blocks) || {}).items || [];
  const out = [];
  items.filter(b => b && b.type === 'decocard').forEach(b => { const p = parse(b.body); [p.hfont, p.bfont].forEach(f => { if (f && !out.includes(f)) out.push(f); }); });
  return out;
}

// a small drawn picture of each style for the Add block picker and the style buttons (60 x 40, like blockcatalog's)
function thumb(style, color) {
  const c = color || '#b8923a';
  const lines = '<rect x="22" y="15" width="16" height="2.6" rx="1.2" fill="#334155"/><rect x="19" y="20" width="22" height="1.6" rx=".8" fill="#94a3b8"/><rect x="21" y="23.5" width="18" height="1.6" rx=".8" fill="#94a3b8"/>';
  const top = `<path d="M27 11 L28 8 L30 9.6 L32 8 L33 11 Z" fill="${c}"/>`;
  let art = '';
  if (style === 'royal') art = `<rect x="9" y="4" width="42" height="32" fill="#fff" stroke="${c}" stroke-width="2"/><rect x="12" y="7" width="36" height="26" fill="none" stroke="${c}" stroke-width=".6"/>`
    + [[14, 9, 1, 1], [46, 9, -1, 1], [14, 31, 1, -1], [46, 31, -1, -1]].map(([x, y, sx, sy]) => `<path d="M${x} ${y + 5 * sy} q0 ${-5 * sy} ${5 * sx} ${-5 * sy}" fill="none" stroke="${c}" stroke-width=".8"/>`).join('')
    + `<path d="M22 28 h6 M32 28 h6" stroke="${c}" stroke-width=".6"/><path d="M30 26.4 l.6 1.6 1.6 .6 -1.6 .6 -.6 1.6 -.6 -1.6 -1.6 -.6 1.6 -.6z" fill="${c}"/>`;
  else if (style === 'minimal') art = `<rect x="9" y="4" width="42" height="32" rx="2.5" fill="#fff" stroke="${c}" stroke-width=".7"/><path d="M27 28.5 h6" stroke="${c}" stroke-width=".7"/>`;
  else if (style === 'deco') art = `<path d="M15 4 H45 V6 H49 V10 H51 V30 H49 V34 H45 V36 H15 V34 H11 V30 H9 V10 H11 V6 H15 Z" fill="#fff" stroke="${c}" stroke-width="1.2"/><rect x="13" y="8" width="34" height="24" fill="none" stroke="${c}" stroke-width=".5"/><path d="M24 8 A6 6 0 0 1 36 8" fill="${c}" fill-opacity=".35"/><path d="M27 28.5 l1 -1 1 1 -1 1z M30 28.5 l1 -1 1 1 -1 1z M33 28.5 l1 -1 1 1 -1 1z" fill="${c}"/>`;
  else if (style === 'stamp') { art = `<rect x="9" y="4" width="42" height="32" fill="#fff"/>`; for (let x = 10; x <= 50; x += 3) art += `<circle cx="${x}" cy="4" r="1" fill="#f8fafc"/><circle cx="${x}" cy="36" r="1" fill="#f8fafc"/>`; for (let y = 6; y <= 34; y += 3) art += `<circle cx="9" cy="${y}" r="1" fill="#f8fafc"/><circle cx="51" cy="${y}" r="1" fill="#f8fafc"/>`; art += `<rect x="12.5" y="7.5" width="35" height="25" fill="none" stroke="${c}" stroke-width=".7" stroke-dasharray="1.6 1.2"/><path d="M22 28.5 h16" stroke="${c}" stroke-width=".9" stroke-dasharray=".3 1.4" stroke-linecap="round"/>`; }
  else if (style === 'ribbon') art = `<rect x="9" y="4" width="42" height="32" rx="1.5" fill="#fff" stroke="${c}" stroke-width="1"/><path d="M4 13 h6 v6 h-6 l2 -3z M56 13 h-6 v6 h6 l-2 -3z" fill="${c}" fill-opacity=".6"/><rect x="8" y="12.5" width="44" height="7" fill="${c}"/><rect x="22" y="15" width="16" height="2.4" rx="1.2" fill="#fff"/>`;
  else if (style === 'envelope') return `<svg class="blk-pic" viewBox="0 0 60 40" width="60" height="40" aria-hidden="true" focusable="false"><rect width="60" height="40" rx="4" fill="#f8fafc"/>`
    + `<rect x="19" y="3" width="22" height="20" fill="#fff" stroke="${c}" stroke-width=".8"/><path d="M27 8 L28 5.5 L30 7 L32 5.5 L33 8 Z" fill="${c}"/><rect x="23" y="11" width="14" height="1.8" rx=".9" fill="#334155"/><rect x="24" y="15" width="12" height="1.2" rx=".6" fill="#94a3b8"/>`
    + `<path d="M12 14 L30 26 L48 14 V37 H12 Z" fill="#f2a9c6"/><path d="M12 37 L30 24 L48 37 Z" fill="#f6bfd5"/><path d="M12 14 L30 4 L48 14" fill="none" stroke="#e57faa" stroke-width="1.2" stroke-linejoin="round"/><circle cx="30" cy="26" r="3.6" fill="#d9578f"/></svg>`;
  else art = `<rect x="0" y="0" width="60" height="40" fill="#dbeafe"/><circle cx="16" cy="12" r="10" fill="#f9a8d4" fill-opacity=".7"/><circle cx="46" cy="30" r="11" fill="#93c5fd"/><rect x="9" y="4" width="42" height="32" rx="7" fill="#fff" fill-opacity=".6" stroke="#fff" stroke-width=".8"/><path d="M20 28.5 h20" stroke="${c}" stroke-width=".6" stroke-opacity=".7"/>`;
  return `<svg class="blk-pic" viewBox="0 0 60 40" width="60" height="40" aria-hidden="true" focusable="false"><rect width="60" height="40" rx="4" fill="#f8fafc"/>${art}${style === 'ribbon' ? '' : top + lines}</svg>`;
}


// Invitation Reveal: works out where the envelope sits on the screen and plays it from how far the visitor has
// scrolled through the section (the envelope lies still, the seal breaks, the flap opens, the card slides out and
// grows while the envelope drops away). Clicking the envelope (or Enter / Space on it) scrolls straight to the open
// card. public-site.ejs adds it when a page has an envelope card.
const REVEAL_SCRIPT = `(function () {
  var cl = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var seg = function (p, a, b) { return cl((p - a) / (b - a)); };
  var ease = function (t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var top = function () { var n = document.querySelector('nav.site-nav'); if (!n) return 0; var c = getComputedStyle(n).position; return c === 'sticky' || c === 'fixed' ? Math.max(0, Math.min(160, n.getBoundingClientRect().bottom)) : 0; };
  var all = [];
  function make(sec) {
    var o = { sec: sec, track: sec.querySelector('.sg-rv-track'), stage: sec.querySelector('.sg-rv-stage'), sheet: sec.querySelector('.sg-rv-sheet'),
      card: sec.querySelector('.sg-dc'), envb: sec.querySelector('.sg-rv-envb'), envf: sec.querySelector('.sg-rv-envf'), more: sec.querySelector('.sg-rv-more'),
      fb: sec.querySelector('.sg-rv-flapb'), ff: sec.querySelector('.sg-rv-flapf'), sl: sec.querySelector('.sg-rv-sl'), sr: sec.querySelector('.sg-rv-sr'),
      hint: sec.querySelector('.sg-rv-hint'), once: sec.querySelector('[data-once]'), done: false, g: null, demo: null, moved: [] };
    if (!o.track || !o.sheet || !o.card || !o.envf) return null;
    // a sticky box stops working inside a box that hides its overflow; "clip" still hides it but lets sticky work
    for (var el = sec.parentElement; el && el !== document.body; el = el.parentElement) { var cs = getComputedStyle(el); if (cs.overflow !== 'visible' || cs.overflowY !== 'visible') el.style.overflow = 'clip'; }
    var go = function (e) { if (o.demo != null) return; if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); var r = o.track.getBoundingClientRect(); window.scrollTo({ top: window.pageYOffset + r.top + o.track.offsetHeight - o.stage.offsetHeight + 2, behavior: 'smooth' }); };
    o.envf.addEventListener('click', go); o.envf.addEventListener('keydown', go);
    if (window.ResizeObserver) new ResizeObserver(function () { if (all.indexOf(o) >= 0) { o.g = measure(o); frame(o); } }).observe(o.card);
    all.push(o);
    return o;
  }
  function measure(o) {
    var W = o.stage.clientWidth, vh = o.stage.clientHeight, hd = top(), av = vh - hd;
    var cw = o.card.offsetWidth, ch = o.card.offsetHeight, ct = o.card.offsetTop, sh = o.sheet.offsetHeight;
    if (!cw || !ch || !vh) return null;
    var ew = Math.min(560, W - 40, av * 0.5 / 0.62), eh = ew * 0.62;
    var ex = (W - ew) / 2, ey = hd + (av - eh) / 2 + av * 0.1;
    var k0 = ew * 0.86 / cw, k1 = k0 * 1.05;
    var ty0 = ey + eh * 0.3 - ct * k0;
    var ty1 = Math.max(ey + eh * 0.5 - (ct + ch) * k1, hd + 12 - ct * k1);
    var fits = sh <= av, tyF = fits ? hd + (av - sh) / 2 : hd + 14 - ct;
    o.more.style.height = Math.max(0, Math.ceil(tyF + sh - vh)) + 'px';
    [o.envb, o.envf].forEach(function (e) { e.style.left = ex + 'px'; e.style.top = ey + 'px'; e.style.width = ew + 'px'; e.style.height = eh + 'px'; });
    o.hint.style.top = (ey + eh + 58) + 'px';
    return { vh: vh, ey: ey, eh: eh, sh: sh, k0: k0, k1: k1, ty0: ty0, ty1: ty1, tyF: tyF };
  }
  function frame(o) {
    var g = o.g; if (!g) return;
    var p;
    if (o.demo != null) p = cl(o.demo);   // the editor is playing it
    else {
      var r = o.track.getBoundingClientRect(), dist = o.track.offsetHeight - g.vh;
      if (r.bottom < -g.vh || r.top > g.vh * 2) return;
      p = dist > 0 ? cl(-r.top / dist) : 1;
      if (o.once) { if (p >= 1) o.done = true; if (o.done) p = 1; }
    }
    var s1 = ease(seg(p, 0, .08)), s2 = seg(p, .08, .22), s3 = ease(seg(p, .22, .42)), s4 = ease(seg(p, .42, .7)), s5 = ease(seg(p, .7, .94));
    var envY = (1 - s1) * 24 + s5 * (g.vh - g.ey + 60), envS = .94 + .06 * s1, envO = cl(1 - (s5 - .35) * 2.2);
    [o.envb, o.envf].forEach(function (e) { e.style.transform = 'translateY(' + envY.toFixed(1) + 'px) scale(' + envS.toFixed(3) + ')'; e.style.opacity = envO.toFixed(3); });
    o.envf.style.visibility = envO <= 0 ? 'hidden' : '';
    o.envf.tabIndex = p > .6 ? -1 : 0;
    // the seal swells a little, cracks in two and the halves fall away
    var b = ease(seg(s2, .3, 1)), sw = 1 + .07 * Math.sin(Math.PI * seg(s2, 0, .3));
    o.sl.style.transform = 'translate(' + (-b * 26).toFixed(1) + '%, ' + (b * b * 70).toFixed(1) + '%) rotate(' + (-b * 34).toFixed(1) + 'deg) scale(' + sw.toFixed(3) + ')';
    o.sr.style.transform = 'translate(' + (b * 26).toFixed(1) + '%, ' + (b * b * 80).toFixed(1) + '%) rotate(' + (b * 30).toFixed(1) + 'deg) scale(' + sw.toFixed(3) + ')';
    o.sl.style.opacity = o.sr.style.opacity = (1 - b).toFixed(3);
    // the flap folds back from its top edge; past half way it is behind the card (the inside of the flap shows)
    var a = s3 * 178;
    o.ff.style.transform = o.fb.style.transform = 'perspective(900px) rotateX(' + a.toFixed(1) + 'deg)';
    o.ff.style.visibility = a < 90 ? '' : 'hidden'; o.fb.style.visibility = a < 90 ? 'hidden' : '';
    // the card: inside, sliding out, then growing into place
    var k = s5 > 0 ? lerp(g.k1, 1, s5) : lerp(g.k0, g.k1, s4), ty = s5 > 0 ? lerp(g.ty1, g.tyF, s5) : lerp(g.ty0 + (1 - s1) * 24 + g.eh * (1 - envS), g.ty1, s4);
    o.sheet.style.transform = 'translateY(' + ty.toFixed(1) + 'px) scale(' + k.toFixed(4) + ')';
    var under = (g.ey + g.eh * envS + envY - 3 - ty) / k;   // the envelope's bottom edge, in the card's own size
    o.sheet.style.clipPath = envO <= 0 || under >= g.sh ? '' : 'inset(-100vh -50vw ' + Math.max(0, g.sh - under).toFixed(1) + 'px -50vw)';
    o.sheet.style.setProperty('--rv-x', s5.toFixed(3));
    o.hint.style.opacity = (1 - seg(p, .01, .07)).toFixed(3);
    o.sec.classList.toggle('sg-rv-open', p >= .94);
  }
  // pictures and text boxes pinned to this section go on the card's sheet, so they stay where the owner put them
  function adopt(o) {
    var part = o.sec.parentElement; if (!part) return;
    Array.prototype.forEach.call(part.querySelectorAll(':scope > [data-sg-pic], :scope > [data-sg-tx]'), function (n) { o.moved.push(n); o.sheet.appendChild(n); });
  }
  var run = function () { all.forEach(frame); };
  var size = function () { all.forEach(function (o) { o.g = measure(o); }); run(); };
  Array.prototype.forEach.call(document.querySelectorAll('.sg-rv.sg-rv-live'), make);
  if (window.sgOnScroll) window.sgOnScroll(run); else { addEventListener('scroll', run, { passive: true }); addEventListener('resize', run); }
  addEventListener('resize', size);
  var ready = function () { all.forEach(adopt); size(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
  addEventListener('load', size);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(size);
  // the editor's "Play it in the preview" and its slider (public/decocard-edit.js): show the envelope at a given
  // point (0 = sealed, 1 = open) without scrolling, then put the card back the way the preview shows it
  var find = function (sec) { for (var i = 0; i < all.length; i++) if (all[i].sec === sec) return all[i]; return null; };
  window.sgReveal = {
    demo: function (sec, p) {
      if (!sec || !sec.classList.contains('sg-rv')) return false;
      var o = find(sec);
      if (!o) { sec.classList.add('sg-rv-live', 'sg-rv-demo'); o = make(sec); if (!o) { sec.classList.remove('sg-rv-live', 'sg-rv-demo'); return false; } adopt(o); }
      o.demo = p; if (!o.g) o.g = measure(o); frame(o); return true;
    },
    stop: function (sec) {
      var o = find(sec); if (!o || !sec.classList.contains('sg-rv-demo')) return;
      all.splice(all.indexOf(o), 1);
      o.moved.forEach(function (n) { sec.parentElement.appendChild(n); });
      sec.classList.remove('sg-rv-live', 'sg-rv-demo', 'sg-rv-open');
      [o.sheet, o.more].forEach(function (e) { e.removeAttribute('style'); });
    }
  };
})();`;

module.exports = { REVEAL_SCRIPT, REVEALS, SEAL_ICONS, LENS, PATS, RV_DEFAULTS, patTile,  STYLES, STYLE_IDS, ICONS, ICON_SVG, SLOTS, SLOT_IDS, PRESETS, PADS, WIDTHS, SHADOWS, SECS, MAX_TEXT, MAX_DETAIL, parse, cleanBody, view, html, fontsOf, thumb, styleOf };
