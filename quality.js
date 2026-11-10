// Pre-publish quality gate. Looks at a site the way a careful reviewer would and returns a fix list:
//   contrast (WCAG AA), tap targets, images (format, weight, alt text, lazy loading) and font loading.
// Pure checks on the saved theme/sections plus the rendered home page; nothing here changes the site.
// The few automatic fixes (colours, image optimising) are separate functions the owner triggers.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cheerio = require('cheerio');
const contrast = require('./contrast');
const themes = require('./themes');
const fonts = require('./fonts');
const motion = require('./motion-presets');
const zlib = require('zlib');
const decoCard = require('./decocard');
const themeTokens = require('./themetokens');
const fmt = (n) => (Math.floor(n * 10) / 10).toFixed(1);

const KB = 1024;
const IMG_RE = /\.(png|jpe?g|webp|gif|avif|svg|bmp|tiff?)(\?.*)?$/i;

// The colours a style puts text on. Mirrors the :root block in views/public-site.ejs, and the data in themes.js.
function stylePalette(theme) {
  const st = theme.style || 'modern';
  const extra = themes.THEMES.find(t => t.id === st);
  const HEX = /^#[0-9a-f]{6}$/i;
  if (extra) {
    const v = extra.vars || {};
    const pick = (k, d) => (HEX.test(v[k] || '') ? v[k] : d);
    const bg = extra.dark && HEX.test(theme.bgColor || '') ? theme.bgColor : pick('--page-bg', '#ffffff');
    return { ink: pick('--ink', '#0f172a'), muted: pick('--muted', '#64748b'), bg, surface: pick('--surface', bg), dark: !!extra.dark };
  }
  const pal = {
    agency: ['#1f2a37', '#5b6573', '#ffffff', '#f2f5fa'], midnight: ['#e8ecf3', '#9aa6b8', '#0e1320', '#151c2c'],
    poster: ['#111111', '#4a4a4a', '#fffdf5', '#fff3c4'], editorial: ['#1c2a3a', '#5b6a73', '#fdfbf5', '#f2ede1'],
    warm: ['#3a2c22', '#746556', '#fff8f0', '#fbeee0'], minimal: ['#171717', '#6b7280', '#ffffff', '#fafafa']
  }[st] || ['#0f172a', '#64748b', '#ffffff', '#f8fafc'];
  return { ink: pal[0], muted: pal[1], bg: pal[2], surface: pal[3], dark: st === 'midnight' };
}

// text colour the site puts on top of the brand colour (same rule as public-site.ejs)
const onPrimary = (hex) => contrast.textOn(hex); // white or near-black, whichever reads better

function fixedPrimary(hex) {
  // move the brand colour just far enough that its button label reaches AA
  return contrast.ensureContrast(hex, onPrimary(hex), contrast.AA_TEXT);
}

function darken(hex, amount = 0.45) {
  const p = contrast.parseHex(hex); if (!p) return hex;
  return '#' + p.map(v => Math.round(v * (1 - amount)).toString(16).padStart(2, '0')).join('');
}

function contrastChecks(site, add, pass) {
  const th = site.theme || {};
  const pal = stylePalette(th);
  const primary = contrast.parseHex(th.primaryColor) ? th.primaryColor : '#2563eb';
  const r = (a, b) => contrast.ratio(a, b);
  const fmt = (n) => (Math.floor(n * 10) / 10).toFixed(1);

  const inkR = r(pal.ink, pal.bg);
  if (inkR < contrast.AA_TEXT) add({ id: 'contrast-ink', area: 'contrast', severity: 'error', title: 'Main text is hard to read', detail: `Body text on the page background has a contrast of ${fmt(inkR)}:1; it should be at least 4.5:1. This comes from the "${th.style}" style, so try another style.` });
  else pass('Main text contrast');

  const mutR = Math.min(r(pal.muted, pal.bg), r(pal.muted, pal.surface));
  if (mutR < contrast.AA_TEXT) add({ id: 'contrast-muted', area: 'contrast', severity: 'warn', title: 'Light grey text is faint', detail: `Secondary text (captions, small print) has a contrast of ${fmt(mutR)}:1 on this style; the target is 4.5:1.` });
  else pass('Secondary text contrast');

  const label = onPrimary(primary);
  const btnR = r(primary, label);
  if (btnR < contrast.AA_TEXT) {
    const fix = fixedPrimary(primary);
    add({ id: 'contrast-button', area: 'contrast', severity: btnR < contrast.AA_LARGE ? 'error' : 'warn', title: 'Button text is hard to read', detail: `Button labels are ${fmt(btnR)}:1 against the brand color ${primary}; the target is 4.5:1.`, fix: { type: 'colors', label: `Adjust the brand color to ${fix}`, primaryColor: fix, accentColor: darken(fix) } });
  } else pass('Button text contrast');

  const linkR = r(primary, pal.bg);
  const extra = themes.byId[th.style];
  if (extra && extra.brandFillOnly) pass('Brand color against the page (this style uses it for buttons and highlights only)');
  else if (linkR < contrast.AA_LARGE) {
    const fix = contrast.ensureContrast(primary, pal.bg, contrast.AA_TEXT);
    add({ id: 'contrast-brand', area: 'contrast', severity: 'warn', title: 'Brand color blends into the page', detail: `The brand color ${primary} has only ${fmt(linkR)}:1 against the page background, so links, icons and headings in that color are easy to miss.`, fix: { type: 'colors', label: `Use ${fix}`, primaryColor: fix, accentColor: darken(fix) } });
  } else pass('Brand color against the page');
  return pal;
}

// every image-looking string in the saved sections/theme, with where it was found
function collectImages(site) {
  const out = [];
  const seen = new Set();
  const walk = (v, key) => {
    if (typeof v === 'string') {
      const t = v.trim();
      if (!t || seen.has(t)) return;
      if (/^\/uploads\//.test(t) || (/^https?:\/\//i.test(t) && IMG_RE.test(t)) || (/^http:\/\//i.test(t) && /image|photo|img|logo/i.test(key || ''))) { seen.add(t); out.push({ url: t, where: key }); }
    } else if (Array.isArray(v)) v.forEach(x => walk(x, key));
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, k));
  };
  walk(site.theme && site.theme.logoUrl, 'logo');
  walk(site.sections, 'sections');
  return out;
}

async function imageChecks(site, add, pass, uploadsDir, sharp) {
  const imgs = collectImages(site);
  let problems = 0;
  for (const { url, where } of imgs) {
    const name = url.split('?')[0].split('/').pop();
    const ext = (path.extname(name) || '').toLowerCase();
    const label = `${name.length > 28 ? name.slice(0, 25) + '…' : name}`;
    if (/^http:\/\//i.test(url)) { problems++; add({ id: 'img-http-' + name, area: 'images', severity: 'error', title: 'Image will not load on a secure site', detail: `${label} uses an insecure http:// address, which browsers block on https sites. Upload it again or use an https:// link.` }); continue; }
    if (ext === '.bmp' || ext === '.tif' || ext === '.tiff') { problems++; add({ id: 'img-fmt-' + name, area: 'images', severity: 'error', title: 'Image format browsers cannot show', detail: `${label} is a ${ext.slice(1).toUpperCase()} file. Re-save it as JPG, PNG or WebP.` }); continue; }
    if (!url.startsWith('/uploads/') || !uploadsDir) continue;           // outside images can't be measured here
    const file = path.join(uploadsDir, path.basename(name));
    let st; try { st = fs.statSync(file); } catch { problems++; add({ id: 'img-missing-' + name, area: 'images', severity: 'error', title: 'Image file is missing', detail: `${label} is used on the site (${where}) but the file is not on the server. Upload it again.` }); continue; }
    let meta = null;
    if (sharp && ext !== '.svg') { try { meta = await sharp(file).metadata(); } catch { /* unreadable: ignore */ } }
    const big = st.size > 2000 * KB, heavy = st.size > 700 * KB;
    const wide = meta && meta.width > 2600;
    if (big || heavy || wide) {
      problems++;
      add({ id: 'img-heavy-' + name, area: 'images', severity: big ? 'error' : 'warn', title: 'Image is heavier than it needs to be', detail: `${label} is ${(st.size / 1048576).toFixed(1)} MB${meta ? ` and ${meta.width}px wide` : ''}. Photos over about 700 KB slow the page on phones.`, fix: ext === '.gif' ? undefined : { type: 'images', label: 'Optimize all photos' }, optimisable: true });
    } else if (ext === '.png' && st.size > 400 * KB && meta && !meta.hasAlpha) {
      problems++;
      add({ id: 'img-png-' + name, area: 'images', severity: 'warn', title: 'Photo saved as PNG', detail: `${label} is a ${Math.round(st.size / KB)} KB PNG without transparency. JPG or WebP is several times smaller for photos.`, fix: { type: 'images', label: 'Optimize all photos' }, optimisable: true });
    } else if (ext === '.gif' && st.size > 400 * KB) {
      problems++;
      add({ id: 'img-gif-' + name, area: 'images', severity: 'warn', title: 'Large GIF', detail: `${label} is ${Math.round(st.size / KB)} KB. Short videos or WebP animations are much lighter.` });
    }
  }
  const s = site.sections || {};
  [['hero', 'main (top) photo'], ['about', 'About photo']].forEach(([k, nice]) => {
    if (s[k] && s[k].imageUrl && !String(s[k].imageAlt || '').trim()) add({ id: 'alt-' + k, area: 'images', severity: 'warn', title: `Describe the ${nice}`, detail: 'It has no alt text, so screen readers (and Google) get only the business name. Add a short description in the editor.' });
  });
  if (!problems && imgs.length) pass('Photo size and format'); else if (!imgs.length) pass('Photos (none to check)');
}

// uses the page as it will really be served
function renderChecks(site, html, add, pass) {
  if (!html) return;
  const $ = cheerio.load(html);
  const vp = ($('meta[name=viewport]').attr('content') || '').toLowerCase();
  if (!vp) add({ id: 'tap-viewport', area: 'tap', severity: 'error', title: 'Page is not mobile-ready', detail: 'The viewport tag is missing, so phones show a shrunken desktop page.' });
  else if (/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/.test(vp)) add({ id: 'tap-zoom', area: 'tap', severity: 'error', title: 'Pinch-zoom is blocked', detail: 'Visitors with low vision cannot zoom in. Remove user-scalable=no / maximum-scale=1.' });
  else pass('Mobile viewport and zoom');
  const css = $('style').map((_, e) => $(e).html()).get().join('\n');
  if (!/min-height:\s*44px/.test(css)) add({ id: 'tap-size', area: 'tap', severity: 'error', title: 'Tap targets are not guaranteed to be 44px', detail: 'The page styles no longer enforce a 44px minimum height for buttons and links on phones.' });
  else pass('Tap targets (44px minimum on phones)');

  const tags = $('img').toArray();
  const noAlt = tags.filter(i => $(i).attr('alt') === undefined);
  if (noAlt.length) add({ id: 'img-alt', area: 'images', severity: 'error', title: 'Images with no alt attribute', detail: `${noAlt.length} image${noAlt.length > 1 ? 's' : ''} on the home page have no alt attribute at all.` });
  else pass('Every image has an alt attribute');
  const eager = tags.filter(i => $(i).attr('loading') !== 'lazy' && !$(i).closest('nav, header, .lb, .logo').length && !/logo/i.test($(i).attr('alt') || ''));
  if (eager.length > 1) add({ id: 'img-lazy', area: 'images', severity: 'warn', title: 'Photos not set to load lazily', detail: `${eager.length} photos load immediately even when they are far down the page.` });
  else pass('Lazy loading for photos below the fold');

  const links = $('link[href*="fonts.googleapis.com"]').toArray().map(l => $(l).attr('href') || '');
  const css2 = links.find(h => h.includes('/css2'));
  if (css2) {
    if (!/display=swap/.test(css2)) add({ id: 'font-swap', area: 'fonts', severity: 'warn', title: 'Text is invisible while fonts load', detail: 'The font request does not use display=swap, so visitors can see blank text on slow connections.' });
    else pass('Fonts show text immediately (display=swap)');
    if (!$('link[rel=preconnect][href*="fonts.gstatic.com"]').length) add({ id: 'font-preconnect', area: 'fonts', severity: 'warn', title: 'Fonts connect late', detail: 'No preconnect to the font server, so fonts start downloading later than they could.' });
    else pass('Fonts preconnect');
  }
}

// Page weight when the Showcase motion level is on: its scripts load after the page, but the hero photo still downloads
// (the animated background covers it), so a big photo plus the animation libraries can make the first visit heavy.
const SHOWCASE_BUDGET = 1100 * KB;       // photos on the page + animation scripts, as sent over the network
const SHOWCASE_HERO_PHOTO = 350 * KB;    // a hero photo this big is wasted if the animated background hides it
function scriptWeight(html) {
  const pub = path.join(__dirname, 'public');
  const names = new Set();
  const re = /<script[^>]+src="\/?((?:vendor\/|lottie\/)?[A-Za-z0-9._-]+\.js)"/g;
  let m; while ((m = re.exec(html || ''))) names.add(m[1]);
  if (/data-lottie=/.test(html || '')) { names.add('vendor/lottie_light.min.js'); names.add('lottie/icons.js'); }
  let gz = 0; const used = [];
  for (const n of names) {
    try { const buf = fs.readFileSync(path.join(pub, n)); gz += zlib.gzipSync(buf).length; used.push(n); } catch { /* not a bundled file */ }
  }
  return { gz, files: used };
}
function weightChecks(site, html, add, pass, uploadsDir) {
  const tier = motion.resolveLevel(site.theme, site.sections && site.sections.hero);
  const style = motion.resolve(site.theme, site.sections && site.sections.hero);
  if (tier !== 'showcase' || style === 'none') { pass('Page weight'); return; }
  const scripts = scriptWeight(html);
  let photos = 0, heroPhoto = 0;
  const heroUrl = ((site.sections && site.sections.hero && site.sections.hero.imageUrl) || '').split('?')[0];
  for (const { url } of collectImages(site)) {
    if (!url.startsWith('/uploads/') || !uploadsDir) continue;
    try {
      const sz = fs.statSync(path.join(uploadsDir, path.basename(url.split('?')[0]))).size;
      photos += sz; if (url.split('?')[0] === heroUrl) heroPhoto = Math.max(heroPhoto, sz);
    } catch { /* missing files are reported by the image checks */ }
  }
  const total = photos + scripts.gz;
  const mb = (n) => (n / 1048576).toFixed(1) + ' MB', kb = (n) => Math.round(n / KB) + ' KB';
  let flagged = false;
  if (total > SHOWCASE_BUDGET) {
    flagged = true;
    add({ id: 'weight-showcase', area: 'performance', severity: 'warn', title: 'Showcase makes this page heavy',
      detail: `Photos (${mb(photos)}) plus animation scripts (${kb(scripts.gz)}) come to about ${mb(total)} on the home page, over the ${mb(SHOWCASE_BUDGET)} this tool aims for. Visitors on mobile data will wait. Switch Motion level to Premium, or use fewer and smaller photos (Optimise images can shrink them).` });
  }
  if (heroPhoto > SHOWCASE_HERO_PHOTO) {
    flagged = true;
    add({ id: 'weight-showcase-hero', area: 'performance', severity: 'warn', title: 'The hero photo is hidden by the animated background',
      detail: `Showcase replaces the hero photo with a moving gradient, but the ${kb(heroPhoto)} photo still downloads. Remove it from the hero, use a much smaller one, or pick Premium to keep the photo visible.` });
  }
  if (!flagged) pass('Page weight with Showcase');
}

function fontChecks(site, add, pass) {
  const th = site.theme || {};
  let flagged = false;
  for (const f of [th.headingFont, th.bodyFont].filter(Boolean)) {
    if (fonts.cleanFontName(f) === f) continue;
    flagged = true;
    add({ id: 'font-name-' + f, area: 'fonts', severity: 'warn', title: 'Font name looks wrong', detail: `"${f}" is not a name that can be requested from Google Fonts, so the browser falls back to a default font.` });
  }
  if (!flagged) pass('Font names');
}

// site = hydrated site row ({ theme, sections, name }), opts = { html, uploadsDir, sharp }
// The newer decorations (Leo, 2026-11-10): Decorative card colors, watermarks strong enough to get in the way of the
// words, an envelope reveal that takes a long scroll on a phone, and the Theme tokens' own color warnings.
const WM_STRONG = 15;   // % opacity; the presets use 5-8
function decorChecks(site, add, pass) {
  const s = (site && site.sections) || {}, theme = (site && site.theme) || {};
  const blocks = ((s.blocks && s.blocks.items) || []).filter(b => b && b.type === 'decocard');
  let cardIssues = 0;
  blocks.forEach(b => {
    const p = decoCard.parse(b.body), name = b.heading ? `"${String(b.heading).replace(/[\[\]]/g, '').slice(0, 40)}"` : 'A Decorative card';
    // the card's color when it's solid (glass and see-through cards show what's behind them, so they aren't measured)
    const solid = p.style !== 'glass' && (p.cardop == null || p.cardop >= 85);
    const card = p.card || '#ffffff';
    if (solid) {
      [['headc', 'heading'], ['bodyc', 'words']].forEach(([k, what]) => {
        if (!p[k]) return;
        const r = contrast.ratio(p[k], card);
        if (r < contrast.AA_TEXT) { cardIssues++; add({ id: `deco-${k}-${b.id}`, area: 'decorations', severity: r < contrast.AA_LARGE ? 'error' : 'warn', title: `${name}: the ${what} are hard to read`, detail: `The ${what} color ${p[k]} has ${fmt(r)}:1 against the card color ${card}; the target is 4.5:1.`, fix: { type: 'decor', label: 'Make card words and watermarks readable' } }); }
      });
    } else if (p.pat && (p.cardop != null && p.cardop < 70)) {
      cardIssues++;
      add({ id: `deco-pat-${b.id}`, area: 'decorations', severity: 'warn', title: `${name}: wallpaper shows through the words`, detail: `The card is ${p.cardop}% solid over a ${p.pat} wallpaper, so the pattern runs behind the words. Make the card at least 85% solid, or turn the wallpaper down.`, fix: { type: 'decor', label: 'Make card words and watermarks readable' } });
    }
    if (p.reveal && p.len === 'l') add({ id: `deco-len-${b.id}`, area: 'decorations', severity: 'warn', title: `${name}: the envelope takes a long scroll`, detail: 'The envelope is set to Slow. On phones it now plays at the Quick length, but on computers visitors still scroll a long way before the card is out. Normal suits most sites.', fix: { type: 'decor', label: 'Make card words and watermarks readable' } });
  });
  const marks = ((s.texts && s.texts.wmarks) || []).filter(w => w && Number(w.op) > WM_STRONG);
  if (marks.length) add({ id: 'wm-strong', area: 'decorations', severity: 'warn', title: `${marks.length === 1 ? 'A watermark is' : marks.length + ' watermarks are'} strong enough to get in the way`, detail: `Watermarks over ${WM_STRONG}% show through the words on top of them. 5-10% reads as a texture rather than a picture.`, fix: { type: 'decor', label: 'Make card words and watermarks readable' } });
  themeTokens.warnings(theme.tokens).forEach((w, i) => add({ id: 'tokens-' + i, area: 'decorations', severity: 'warn', title: 'Theme tokens: a color is too light', detail: w + ' Change it in Design > Theme tokens.' }));
  if (blocks.length && !cardIssues) pass('Decorative card words are readable');
  if (((s.texts && s.texts.wmarks) || []).length && !marks.length) pass('Watermarks stay in the background');
}
// fix for the above: card words darkened (or lightened) just enough, watermarks turned down to 8%, Slow reveals to Normal
function applyDecorFix(sections) {
  let n = 0;
  const items = ((sections.blocks && sections.blocks.items) || []).map(b => {
    if (!b || b.type !== 'decocard') return b;
    const p = decoCard.parse(b.body), card = p.card || '#ffffff';
    let body = String(b.body || '');
    const set = (k, v) => { const re = new RegExp('^' + k + '\\s*:.*$', 'm'); body = re.test(body) ? body.replace(re, k + ': ' + v) : body + '\n' + k + ': ' + v; n++; };
    const solid = p.style !== 'glass' && (p.cardop == null || p.cardop >= 85);
    if (solid) ['headc', 'bodyc'].forEach(k => { if (p[k] && contrast.ratio(p[k], card) < contrast.AA_TEXT) set(k, contrast.ensureContrast(p[k], card, contrast.AA_TEXT)); });
    else if (p.pat && p.cardop != null && p.cardop < 70) set('cardop', 85);
    if (p.reveal && p.len === 'l') set('len', 'm');
    return body === b.body ? b : { ...b, body: decoCard.cleanBody(body) };
  });
  const texts = sections.texts || {};
  const wmarks = (texts.wmarks || []).map(w => (w && Number(w.op) > WM_STRONG ? (n++, { ...w, op: 8 }) : w));
  if (!n) return 0;
  sections.blocks = { ...(sections.blocks || {}), items };
  sections.texts = { ...texts, wmarks };
  return n;
}

async function audit(site, opts = {}) {
  const items = [], passed = [];
  const add = (i) => { if (!items.some(x => x.id === i.id)) items.push(i); };
  const pass = (t) => { if (!passed.includes(t)) passed.push(t); };
  contrastChecks(site, add, pass);
  await imageChecks(site, add, pass, opts.uploadsDir, opts.sharp);
  fontChecks(site, add, pass);
  weightChecks(site, opts.html, add, pass, opts.uploadsDir);
  renderChecks(site, opts.html, add, pass);
  decorChecks(site, add, pass);
  const rank = { error: 0, warn: 1 };
  items.sort((a, b) => rank[a.severity] - rank[b.severity]);
  const errors = items.filter(i => i.severity === 'error').length;
  return { items, passed, errors, warnings: items.length - errors, ok: errors === 0 };
}

// fix 1: apply the contrast-safe brand colour to a theme object
function applyColorFix(theme, fix) {
  if (!fix || !contrast.parseHex(fix.primaryColor)) return false;
  theme.primaryColor = fix.primaryColor; theme.accentColor = contrast.parseHex(fix.accentColor) ? fix.accentColor : darken(fix.primaryColor);
  return true;
}

// fix 2: re-encode heavy /uploads photos as WebP (max 1920px) and point the site at the new files.
// Originals stay on disk (older versions and other pages may still use them). Returns the number replaced.
async function optimiseImages(site, { uploadsDir, sharp }) {
  const map = {};
  for (const { url } of collectImages(site)) {
    if (!url.startsWith('/uploads/')) continue;
    const name = path.basename(url.split('?')[0]); const ext = path.extname(name).toLowerCase();
    if (['.svg', '.gif', '.webp'].includes(ext) && fs.existsSync(path.join(uploadsDir, name)) && fs.statSync(path.join(uploadsDir, name)).size < 700 * KB) continue;
    if (['.svg', '.gif'].includes(ext)) continue;
    const file = path.join(uploadsDir, name);
    let st; try { st = fs.statSync(file); } catch { continue; }
    let meta; try { meta = await sharp(file).metadata(); } catch { continue; }
    const needs = st.size > 700 * KB || meta.width > 2600 || (ext === '.png' && st.size > 400 * KB && !meta.hasAlpha);
    if (!needs) continue;
    const outName = crypto.randomBytes(9).toString('base64url').replace(/[^A-Za-z0-9]/g, 'x') + '.webp';
    try {
      await sharp(file).rotate().resize({ width: 1920, withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(uploadsDir, outName));
      if (fs.statSync(path.join(uploadsDir, outName)).size < st.size) map['/uploads/' + name] = '/uploads/' + outName;
      else fs.unlinkSync(path.join(uploadsDir, outName));
    } catch { /* leave the original */ }
  }
  const replace = (v) => {
    if (typeof v === 'string') return map[v.trim()] || v;
    if (Array.isArray(v)) return v.map(replace);
    if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = replace(v[k]); return o; }
    return v;
  };
  return { count: Object.keys(map).length, sections: replace(site.sections), theme: { ...site.theme, logoUrl: map[site.theme && site.theme.logoUrl] || (site.theme && site.theme.logoUrl) || '' } };
}

module.exports = { decorChecks, applyDecorFix, audit, weightChecks, scriptWeight, stylePalette, onPrimary, collectImages, applyColorFix, optimiseImages, fixedPrimary };
