// Brand kit from a logo: the logo's colors as a palette, a font pairing and a button shape to go with it,
// a browser icon (favicon) and a share image made from the logo. Saved kits can be applied to other sites.
// Needs the optional "sharp" package for the pictures; nothing here invents words, the images carry no text.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Palette = require('./public/palette');
const fonts = require('./fonts');
const lab = require('./designlab');
const themeTokens = require('./themetokens');

const HEX = /^#[0-9a-f]{6}$/i;
const MAX_LOGO = 5 * 1024 * 1024;

// The logo file: an upload on this server, or an image on another site (fetched safely, size-capped)
async function readLogo(url, { uploadsDir, safeFetch }) {
  const u = String(url || '').trim();
  if (!u) return null;
  if (u.startsWith('/uploads/')) {
    const file = path.join(uploadsDir, path.basename(u.split('?')[0]));
    try { const st = fs.statSync(file); if (st.size > MAX_LOGO) return null; return fs.readFileSync(file); } catch { return null; }
  }
  if (!/^https:\/\//i.test(u) || !safeFetch) return null;
  try {
    const { response } = await safeFetch(u, { timeoutMs: 10000 });
    if (!response.ok || !/^image\//.test(response.headers.get('content-type') || '')) return null;
    const buf = Buffer.from(await response.arrayBuffer());
    return buf.length <= MAX_LOGO ? buf : null;
  } catch { return null; }
}

// Which pixels are the logo: opaque ones, or (with no transparency) the ones that differ from the corner color
function mask(data, w, h) {
  const at = (x, y) => (y * w + x) * 4;
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 128) transparent++;
  const useAlpha = transparent > (w * h) * 0.04;
  const c = at(0, 0), bg = [data[c], data[c + 1], data[c + 2]];
  const m = new Uint8Array(w * h);
  // no transparency and a colored (not white) corner: the whole picture is a square badge
  if (!useAlpha && Math.min(bg[0], bg[1], bg[2]) < 225) { m.fill(1); return m; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = at(x, y);
    m[y * w + x] = useAlpha ? (data[i + 3] >= 128 ? 1 : 0) : (Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 60 ? 1 : 0);
  }
  return m;
}

// A rough read of the logo's outline, for the button shape: a solid square badge suits sharp corners,
// a round badge suits pill buttons, and anything else (wordmarks, icons) gets the gentle middle.
function shapeOf(m, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (!n) return { id: 'soft', why: 'The logo outline could not be read, so this is the safe middle.' };
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, fill = n / (bw * bh);
  const cs = Math.max(2, Math.round(Math.min(bw, bh) * 0.12));
  const corner = (cx, cy) => { let k = 0; for (let y = 0; y < cs; y++) for (let x = 0; x < cs; x++) k += m[(cy + y) * w + (cx + x)]; return k / (cs * cs); };
  const cf = (corner(x0, y0) + corner(x1 - cs + 1, y0) + corner(x0, y1 - cs + 1) + corner(x1 - cs + 1, y1 - cs + 1)) / 4;
  if (fill > 0.62 && cf > 0.85) return { id: 'sharp', why: 'The logo is a solid badge with square corners, so square buttons and corners echo it.' };
  if (fill > 0.55 && cf < 0.3) return { id: 'round', why: 'The logo sits in a round badge, so pill buttons and round cards echo it.' };
  if (fill > 0.55) return { id: 'soft', why: 'The logo is a badge with softened corners, so gently rounded buttons match.' };
  return { id: 'soft', why: 'The logo is a wordmark or an open shape, so gently rounded buttons are the safe middle. Try the others in the Design lab.' };
}

// Fonts: one picked for the logo's mood, then the industry data's pairings
function fontsFor(colors, advice) {
  const out = [];
  ((advice && advice.fonts) || []).forEach(p => { if (fonts.cleanFontName(p.heading) && fonts.cleanFontName(p.body)) out.push({ heading: p.heading, body: p.body, why: `${p.name || 'Pairing'}: suggested for this kind of business (${(p.mood || []).slice(0, 3).join(', ')})` }); });
  const hsl = colors && colors[0] ? Palette.hexToHsl(colors[0]) : { h: 220, s: 0.5, l: 0.4 };
  const by = (h) => lab.PAIRS.find(p => p.heading === h);
  let mood;
  if (hsl.s < 0.18) mood = [by('Playfair Display'), 'The logo is black, white or grey, so a classic serif with a clean sans keeps it refined.'];
  else if (hsl.l < 0.3) mood = [by('DM Serif Display'), 'The logo color is deep and rich, so a modern serif suits it.'];
  else if ((hsl.h < 60 || hsl.h > 330) && hsl.s > 0.55) mood = [by('Poppins'), 'The logo is bright and warm, so a rounded modern sans feels friendly.'];
  else if (hsl.s > 0.6) mood = [by('Bricolage Grotesque'), 'The logo is bold and saturated, so a characterful grotesque keeps the energy.'];
  else mood = [by('Montserrat'), 'The logo is calm and clean, so a clear geometric sans fits.'];
  // the logo's own pick leads; the industry pairings follow as alternatives
  const list = mood[0] ? [{ heading: mood[0].heading, body: mood[0].body, why: mood[1] }, ...out.filter(p => p.heading !== mood[0].heading)] : out;
  return list.slice(0, 3);
}

// colors, palette, shape and fonts for a logo image
async function analyse(buf, sharp, advice) {
  const { data, info } = await sharp(buf, { density: 144 }).ensureAlpha().resize(120, 120, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  const colors = Palette.extract(data, 5);
  const pair = Palette.fromLogo(colors);
  const sq = await sharp(buf, { density: 144 }).ensureAlpha().resize(64, 64, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const shape = shapeOf(mask(sq.data, sq.info.width, sq.info.height), sq.info.width, sq.info.height);
  return { colors, pair, shape, fonts: fontsFor(colors, advice), size: { w: info.width, h: info.height } };
}

const fileId = (siteId) => `bk-${siteId}-${crypto.randomBytes(6).toString('hex')}`;
// a generated file name for this site, so the apply form can only point at our own pictures
const isOwnFile = (siteId, url, ext) => new RegExp(`^/uploads/bk-${Number(siteId)}-[0-9a-f]{12}-[a-z0-9]+\\.(${ext})$`).test(String(url || ''));

async function trimmed(buf, sharp) {
  try { return await sharp(buf, { density: 288 }).trim({ threshold: 12 }).png().toBuffer(); } catch { return sharp(buf, { density: 288 }).png().toBuffer(); }
}

// browser icons: 32px and 512px with a transparent background, 180px on white for phones' home screens
async function makeIcons(buf, sharp, uploadsDir, siteId) {
  const logo = await trimmed(buf, sharp), id = fileId(siteId);
  const square = async (size, bg) => {
    const pad = Math.round(size * (bg ? 0.14 : 0.06)), inner = size - pad * 2;
    const img = await sharp(logo).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    return sharp({ create: { width: size, height: size, channels: 4, background: bg || { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: img, left: pad, top: pad }]).png();
  };
  await (await square(32)).toFile(path.join(uploadsDir, `${id}-32.png`));
  await (await square(180, { r: 255, g: 255, b: 255, alpha: 1 })).toFile(path.join(uploadsDir, `${id}-180.png`));
  await (await square(512)).toFile(path.join(uploadsDir, `${id}-512.png`));
  return { faviconUrl: `/uploads/${id}-32.png`, touchIconUrl: `/uploads/${id}-180.png`, bigIconUrl: `/uploads/${id}-512.png` };
}

// share image (1200 x 630): the hero photo darkened at the bottom with the logo on a white card,
// or, with no hero photo, the brand colors with the logo centered. No words, so nothing to get wrong.
async function makeShare(buf, sharp, { uploadsDir, siteId, heroUrl, primary, accent }) {
  const W = 1200, H = 630, logo = await trimmed(buf, sharp), id = fileId(siteId);
  const p = HEX.test(primary || '') ? primary : '#1e293b', a = HEX.test(accent || '') ? accent : '#0f172a';
  let heroFile = '';
  if (heroUrl && String(heroUrl).startsWith('/uploads/')) { const f = path.join(uploadsDir, path.basename(String(heroUrl).split('?')[0])); if (fs.existsSync(f)) heroFile = f; }
  let base, card;
  if (heroFile) {
    base = sharp(heroFile).rotate().resize(W, H, { fit: 'cover', position: 'attention' });
    card = { w: 380, h: 200, left: 56, top: H - 200 - 56 };
  } else {
    base = sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p}"/><stop offset="1" stop-color="${a}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/></svg>`));
    card = { w: 560, h: 300, left: (W - 560) / 2, top: (H - 300) / 2 };
  }
  const shade = heroFile ? [{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset=".35" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#s)"/><rect x="0" y="${H - 10}" width="${W}" height="10" fill="${p}"/></svg>`), left: 0, top: 0 }] : [];
  const cardSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${card.w}" height="${card.h}"><rect width="${card.w}" height="${card.h}" rx="22" fill="#fff"/></svg>`);
  const pad = Math.round(card.h * 0.16);
  const logoImg = await sharp(logo).resize(card.w - pad * 2, card.h - pad * 2, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
  const meta = await sharp(logoImg).metadata();
  await base.composite([...shade, { input: cardSvg, left: Math.round(card.left), top: Math.round(card.top) },
    { input: logoImg, left: Math.round(card.left + (card.w - meta.width) / 2), top: Math.round(card.top + (card.h - meta.height) / 2) }])
    .jpeg({ quality: 86, mozjpeg: true }).toFile(path.join(uploadsDir, `${id}-share.jpg`));
  return `/uploads/${id}-share.jpg`;
}

// ---- saved kits ----
function cleanKit(k, isSafeUrl) {
  const o = k && typeof k === 'object' ? k : {};
  const url = (u) => (typeof u === 'string' && u && (u.startsWith('/uploads/') ? /^\/uploads\/[A-Za-z0-9._-]+$/.test(u) : isSafeUrl(u)) ? u.slice(0, 500) : '');
  const shape = lab.SHAPES.find(s => s.id === o.shape);
  return {
    logoUrl: url(o.logoUrl), primaryColor: HEX.test(o.primaryColor || '') ? o.primaryColor : '', accentColor: HEX.test(o.accentColor || '') ? o.accentColor : '',
    headingFont: fonts.cleanFontName(o.headingFont) || '', bodyFont: fonts.cleanFontName(o.bodyFont) || '',
    shape: shape ? shape.id : '', faviconUrl: url(o.faviconUrl), touchIconUrl: url(o.touchIconUrl),
    ...(themeTokens.clean(o.tokens) ? { tokens: themeTokens.clean(o.tokens) } : {})   // the site's named colors, fonts and buttons, when it has them
  };
}
// a kit from a site's saved theme
function fromTheme(theme) {
  const c = lab.current(theme);
  return { logoUrl: theme.logoUrl || '', primaryColor: c.primaryColor, accentColor: c.accentColor, headingFont: c.headingFont, bodyFont: c.bodyFont, shape: c.shape, faviconUrl: theme.faviconUrl || '', touchIconUrl: theme.touchIconUrl || '', ...(themeTokens.clean(theme.tokens) ? { tokens: themeTokens.clean(theme.tokens) } : {}) };
}
// the theme with a kit applied (only the parts the kit has)
function applyKit(theme, kit) {
  const t = { ...theme };
  if (kit.logoUrl) t.logoUrl = kit.logoUrl;
  if (kit.primaryColor && kit.accentColor) { t.primaryColor = kit.primaryColor; t.accentColor = kit.accentColor; }
  if (kit.headingFont || kit.bodyFont) { t.headingFont = kit.headingFont; t.bodyFont = kit.bodyFont; }
  if (kit.shape !== undefined && kit.shape !== null && kit.shape !== '') { const s = lab.SHAPES.find(x => x.id === kit.shape); if (s) { t.buttonShape = s.buttonShape; t.corners = s.corners; } }
  if (kit.faviconUrl) { t.faviconUrl = kit.faviconUrl; t.touchIconUrl = kit.touchIconUrl || ''; }
  if (kit.tokens) { t.tokens = themeTokens.clean(kit.tokens); Object.assign(t, themeTokens.linked(t)); }
  return t;
}

module.exports = { readLogo, analyse, shapeOf, mask, fontsFor, makeIcons, makeShare, isOwnFile, cleanKit, fromTheme, applyKit };
