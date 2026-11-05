// Per-industry section blueprints: which sections a home page gets, in what order, and which layout of each.
// The order follows the landing-page patterns in UI UX Pro Max: lead with the offer and a clear action, put
// proof (numbers, reviews) before the ask, keep the call to action near the end. A section is only drawn when
// the site has real content for it (see content.js), so a blueprint never produces empty or made-up sections.
const contrast = require('../contrast');
const lib = require('./index');
const content = require('./content');

const S = (family, variant) => ({ family, variant });
const BLUEPRINTS = {
  trades: {
    label: 'Local service (trades & home services)',
    note: 'Lead with the offer, then numbers, services, reasons to choose you, reviews, towns served, FAQ, call to action.',
    sections: [S('hero', 'stat'), S('services', 'bento'), S('why', 'split'), S('testimonials', 'wall'), S('areas', 'chips'), S('faq', 'side')],
  },
  professional: {
    label: 'Professional practice (law, accounting, insurance, real estate)',
    note: 'Calm and credible: who you are first, services as a price-list style, reasons, reviews, FAQ.',
    sections: [S('hero', 'spotlight'), S('stats', 'cards'), S('about', 'split'), S('services', 'rows'), S('why', 'grid'), S('testimonials', 'quote'), S('faq', 'numbered')],
  },
  food: {
    label: 'Food & drink',
    note: 'Photo-first: a full-width hero, the story, the menu as services, photos, one big review.',
    sections: [S('hero', 'mosaic'), S('about', 'photo-left'), S('services', 'reveal'), S('gallery', 'grid'), S('testimonials', 'marquee'), S('contact', 'cards')],
  },
  beauty: {
    label: 'Beauty, wellness & body art',
    note: 'Show the work: a card hero, services with prices, photos, swipeable reviews.',
    sections: [S('hero', 'mosaic'), S('services', 'reveal'), S('gallery', 'grid'), S('testimonials', 'marquee'), S('faq', 'side')],
  },
  health: {
    label: 'Health & care',
    note: 'Reassure first: reasons to trust you, services, the people, reviews, answers to common worries.',
    sections: [S('hero', 'spotlight'), S('why', 'grid'), S('services', 'bento'), S('about', 'photo-left'), S('testimonials', 'wall'), S('faq', 'side'), S('contact', 'cards')],
  },
  pets: {
    label: 'Pet services',
    note: 'Friendly and visual: services with prices, reasons, photos, reviews.',
    sections: [S('hero', 'mosaic'), S('services', 'reveal'), S('why', 'grid'), S('gallery', 'grid'), S('testimonials', 'marquee'), S('faq', 'numbered')],
  },
  events: {
    label: 'Events, photography & creative',
    note: 'Portfolio first: big photo hero, gallery, what is offered, one featured review.',
    sections: [S('hero', 'overlay'), S('gallery', 'grid'), S('services', 'tabs'), S('testimonials', 'quote'), S('faq', 'numbered'), S('contact', 'cards')],
  },
  fitness: {
    label: 'Fitness & coaching',
    note: 'Energy and proof: a bold hero, numbers, programs, reviews.',
    sections: [S('hero', 'overlay'), S('stats', 'band'), S('services', 'bento'), S('testimonials', 'wall'), S('faq', 'side')],
  },
  bento: {
    label: 'Bento (modern tiles)',
    note: 'A modern, tile-based page for any business: a split hero, a bento overview of the best bits, icon services, reviews, FAQ.',
    sections: [S('hero', 'split'), S('bento', 'tiles'), S('services', 'icons'), S('why', 'photocards'), S('testimonials', 'grid'), S('faq', 'accordion')],
  },
  generic: {
    label: 'General business',
    note: 'A safe order for any business: hero, about, services, reasons, reviews, FAQ, call to action.',
    sections: [S('hero', 'split'), S('about', 'split'), S('services', 'cards'), S('why', 'grid'), S('testimonials', 'grid'), S('faq', 'accordion')],
  },
};

// our template ids -> blueprint
const BY_TEMPLATE = {};
const add = (bp, ids) => ids.split(' ').forEach(id => { BY_TEMPLATE[id] = bp; });
add('trades', 'plumbing electrician hvac landscaping cleaning roofing contractor pool-service tree-service pressure-washing junk-removal locksmith pest-control painting moving auto-repair it-repair car-detailing home-care');
add('professional', 'law accounting insurance real-estate tutoring');
add('food', 'restaurant bakery coffee-shop catering');
add('beauty', 'salon spa barber tattoo');
add('health', 'dentist chiropractor veterinary daycare');
add('pets', 'mobile-grooming pet-grooming pet-care dog-training');
add('events', 'photography wedding party-rental florist');
add('fitness', 'fitness');

const IDS = Object.keys(BLUEPRINTS);
const forTemplate = id => BY_TEMPLATE[id] || 'generic';

// Which site section hides a family (the editor's per-section "hidden" switch)
const SECTION_KEY = { hero: 'hero', about: 'about', services: 'services', why: 'whyChoose', testimonials: 'testimonials', faq: 'faq', gallery: 'gallery', contact: 'contact' };

const cleanId = v => (v === 'auto' || IDS.includes(v)) ? v : '';

// Where an added section lands when the blueprint does not already include it: right after this family if present
const ADD_AFTER = { bento: 'hero', banner: 'hero', logos: 'hero', stats: 'hero', about: 'hero', services: 'hero', why: 'services', pricing: 'services', gallery: 'services', testimonials: 'services', areas: 'testimonials', faq: 'testimonials', contact: 'faq', cta: 'faq' };
// The blueprint's sections plus any the owner added, in order: [{ family, variant, added }]
function sectionList(theme, templateId) {
  const t = theme || {};
  const id = t.blueprint && BLUEPRINTS[t.blueprint] ? t.blueprint : forTemplate(templateId || 'generic');
  const list = BLUEPRINTS[id].sections.map(x => ({ family: x.family, variant: x.variant, added: false }));
  for (const family of (t.bpAdd || [])) {
    if (list.some(x => x.family === family) || !lib.FAMILIES[family] || family === 'hero') continue;
    const first = lib.variantsOf(family)[0]; if (!first) continue;
    const at = list.findIndex(x => x.family === ADD_AFTER[family]);
    list.splice(at >= 0 ? at + 1 : list.length, 0, { family, variant: first.variant, added: true });
  }
  return { blueprint: id, sections: list };
}

// Build the list of sections to draw. ctx: { site, basePath, services, areas, navPages, visible, findTemplate }
function plan(ctx) {
  const t = ctx.site.theme || {};
  const { blueprint: id, sections: secs } = sectionList(t, ctx.templateId);
  const variants = t.bpVariants || {}, skip = new Set(t.bpSkip || []);
  const items = [], skipped = [];
  for (const sec of secs) {
    const { family } = sec;
    if (skip.has(family)) { skipped.push({ family, reason: 'turned off' }); continue; }
    if (family === 'hero' && (ctx.nativeHero || t.bpHero === 'native')) { skipped.push({ family, reason: 'using the site hero' }); continue; }
    const key = SECTION_KEY[family];
    if (key && ctx.visible && !ctx.visible(key)) { skipped.push({ family, reason: 'section is hidden' }); continue; }
    const variant = lib.isVariant(family, variants[family]) ? variants[family] : sec.variant;
    const d = content.bind(family, ctx);
    if (!d) { skipped.push({ family, reason: 'no content yet' }); continue; }
    const o = (t.bpSec || {})[family] || {};
    if (o.title) { if (family === 'hero') { d.headline = o.title; d.headlineHtml = content.hlHtml(o.title); } else if ('heading' in d) d.heading = o.title; }
    items.push({ family, variant, id: `${family}/${variant}`, file: `${family}-${variant}`, d, opts: { ...o, emoji: o.emoji || '', doodle: o.doodle || '', bg: o.bg || '' } });
  }
  insertCustom(items, ctx, t);
  if (t.bpAlt !== 'off') autoAlternate(items);
  return { blueprint: id, items, skipped };
}

// Auto-alternate: when two sections with a photo on one side follow each other, the second is mirrored so the page
// zig-zags. A side photo the owner added (left or right of the section) counts too. The owner's own Flip still
// applies on top, and a section without a side photo breaks the run.
const other = side => (side === 'left' ? 'right' : 'left');
function autoAlternate(items) {
  let prev = '';
  for (const it of items) {
    const o = it.opts || (it.opts = {});
    let side = (lib.BY_ID[it.id] || {}).side || (o.photo && (o.photoPos === 'left' || o.photoPos === 'right') ? o.photoPos : '');
    if (!side) { prev = ''; continue; }
    if (prev && side === prev) { o.autoFlip = true; side = other(side); }
    if (o.flip) side = other(side);
    prev = side;
  }
}

// The owner's own sections (sections.custom.items), placed right after the section they chose.
// after: 'top' (under the hero), a family name, or 'end'. If that section is not on the page, it goes at the end.
function customItems(ctx) {
  const list = (((ctx.site.sections || {}).custom || {}).items || []);
  const out = [];
  list.forEach((it, i) => {
    const b = content.bindCustom(it, ctx, out.length);
    if (!b) return;
    out.push({ family: 'custom', ci: i, variant: b.layout, id: `custom/${b.layout}`, file: `custom-${b.layout}`, d: b.d, after: it.after || 'end', opts: { ...sizePhotoOf(it, 'custom', ctx.isSafeUrl), emoji: it.emoji || '', doodle: '', bg: it.bg || '' } });
  });
  return out;
}
function insertCustom(items, ctx, theme) {
  for (const c of customItems(ctx)) {
    let at = items.length;
    const anchor = c.after === 'top' ? 'hero' : c.after;
    if (c.after !== 'end') {
      let last = -1; items.forEach((x, i) => { if (x.family === anchor || (x.family === 'custom' && x.after === c.after)) last = i; });
      if (last >= 0) at = last + 1; else if (c.after === 'top') at = 0;
    }
    items.splice(at, 0, c);
  }
}

// Sections the owner ticked under "Add a section", for home layouts other than the blueprint (which places them
// itself): each one with real content, in its chosen layout, followed by the owner's own sections. Drawn near the
// end of the home page, so ticking a section shows it whatever the home layout.
function addedItems(ctx) {
  const t = ctx.site.theme || {};
  const variants = t.bpVariants || {}, skip = new Set(t.bpSkip || []);
  const items = [];
  for (const family of (t.bpAdd || [])) {
    if (family === 'hero' || family === 'custom' || skip.has(family) || !lib.FAMILIES[family] || items.some(x => x.family === family)) continue;
    const key = SECTION_KEY[family];
    if (key && ctx.visible && !ctx.visible(key)) continue;
    const first = lib.variantsOf(family)[0]; if (!first) continue;
    const variant = lib.isVariant(family, variants[family]) ? variants[family] : first.variant;
    const d = content.bind(family, ctx);
    if (!d) continue;
    const o = (t.bpSec || {})[family] || {};
    if (o.title && 'heading' in d) d.heading = o.title;
    items.push({ family, variant, id: `${family}/${variant}`, file: `${family}-${variant}`, d, opts: { ...o, emoji: o.emoji || '', doodle: o.doodle || '', bg: o.bg || '' } });
  }
  return items;
}
function tailItems(ctx) {
  const items = addedItems(ctx);
  insertCustom(items, ctx, ctx.site.theme || {});
  return items;
}

// ---- per-section size and photo options ----
// space (height above and below), width (content width) and text (size) take a preset or an exact number
// (padY px, maxW px, fs percent). A photo can sit left/right/above/below the section or be its background.
const SPACE = { compact: 24, roomy: 112, tall: 176 };
const WIDTH = { narrow: 720, wide: 1360, full: 0 };
const TEXT = { small: 88, large: 120 };
const PHOTO_POS = ['left', 'right', 'above', 'below', 'bg'];
const PHOTO_SIZE = ['small', 'medium', 'large'];
const OVERLAY = { light: 0.28, medium: 0.5, dark: 0.7 };
const BG_MODES = ['alt', 'brand', 'themegrad', 'color', 'gradient', 'preset'];   // brand gradient = brand colour to accent colour; preset = one from the gradient gallery (gradients.js)
const GRAD_BGS = ['themegrad', 'gradient', 'preset'];
const GRAD_DIRS = { down: 'to bottom', up: 'to top', right: 'to right', diag: '135deg', radial: 'radial' };
const HEX = /^#[0-9a-f]{6}$/i;
const gradients = require('../gradients');
const NO_PHOTO = ['hero', 'banner'];          // these have their own pictures or no room for one
const NO_SIZE = ['hero', 'banner'];
const SHAPES = ['arch', 'circle', 'blob'];
const intIn = (v, min, max) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : ''; };

// Clean the per-section options an owner typed in:
// { family: { emoji, doodle: '' | 'on' | 'off', bg: '' | 'alt' | 'brand', title, space, width, text, padY, maxW, fs, photo, photoPos, photoSize, photoOverlay } }
// isSafeUrl is the server's link check; without it no photo is kept.
function cleanSizePhoto(r, family, isSafeUrl) {
  const o = {};
  // Flip mirrors the layout (photo left <-> right); shape frames the section's photos as an arch, circle or soft blob
  if (r.flip === '1' || r.flip === 'on' || r.flip === true) o.flip = true;
  if (SHAPES.includes(r.shape)) o.shape = r.shape;
  if (!NO_SIZE.includes(family)) {
    o.space = Object.prototype.hasOwnProperty.call(SPACE, r.space) ? r.space : '';
    o.width = Object.prototype.hasOwnProperty.call(WIDTH, r.width) ? r.width : '';
    o.text = Object.prototype.hasOwnProperty.call(TEXT, r.text) ? r.text : '';
    o.padY = intIn(r.padY, 0, 400); o.maxW = intIn(r.maxW, 320, 1920); o.fs = intIn(r.fs, 70, 160);
  }
  // colours for the "your colour" and "your gradient" backgrounds
  if (HEX.test(String(r.bgColor || '').trim())) o.bgColor = String(r.bgColor).trim().toLowerCase();
  if (HEX.test(String(r.bgColor2 || '').trim())) o.bgColor2 = String(r.bgColor2).trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(GRAD_DIRS, r.gradDir)) o.gradDir = r.gradDir;
  // gradient gallery pick, drawing style, angle, slow movement and grain
  if (gradients.cleanId(r.grad)) o.grad = r.grad;
  if (gradients.cleanStyle(r.gradStyle)) o.gradStyle = r.gradStyle;
  if (gradients.cleanAngle(r.gradAngle) !== '') o.gradAngle = gradients.cleanAngle(r.gradAngle);
  if (r.gradMove === '1' || r.gradMove === 'on' || r.gradMove === true) o.gradMove = true;
  if (r.grain === '1' || r.grain === 'on' || r.grain === true) o.grain = true;
  if (r.gradBlend === '1' || r.gradBlend === 'on' || r.gradBlend === true) o.gradBlend = true;
  if (gradients.textures.cleanInk(r.gradInk)) o.gradInk = gradients.textures.cleanInk(r.gradInk);
  const url = String(r.photo || '').trim();
  if (!NO_PHOTO.includes(family) && url && url.length <= 500 && isSafeUrl && isSafeUrl(url) && PHOTO_POS.includes(r.photoPos)) {
    o.photo = url; o.photoPos = r.photoPos;
    o.photoSize = PHOTO_SIZE.includes(r.photoSize) ? r.photoSize : 'medium';
    o.photoOverlay = Object.prototype.hasOwnProperty.call(OVERLAY, r.photoOverlay) ? r.photoOverlay : 'medium';
  }
  return o;
}
const hasSizePhoto = (o) => !!(o.flip || o.shape || o.bgColor || o.bgColor2 || o.grad || o.gradStyle || o.gradAngle !== '' && o.gradAngle != null || o.gradMove || o.grain || o.gradBlend || o.gradInk || o.space || o.width || o.text || o.padY !== '' && o.padY != null || o.maxW !== '' && o.maxW != null || o.fs !== '' && o.fs != null || o.photo);

// The gradient settings only count with a gradient background (the pickers always send a value)
function dropUnusedGrad(bg, o) {
  if (bg !== 'preset') { delete o.grad; delete o.gradBlend; delete o.gradInk; }
  if (!GRAD_BGS.includes(bg)) { delete o.gradStyle; delete o.gradAngle; delete o.gradMove; delete o.grain; }
}

function cleanSectionOpts(raw, cleanEmoji, isSafeUrl) {
  const out = {};
  for (const family of Object.keys(lib.FAMILIES)) {
    const r = (raw && raw[family]) || {};
    const emoji = cleanEmoji(r.emoji || '', 1).trim().split(/\s+/)[0] || '';
    const o = { emoji, doodle: ['on', 'off'].includes(r.doodle) ? r.doodle : '', bg: BG_MODES.includes(r.bg) ? r.bg : '', title: String(r.title || '').replace(/[<>]/g, '').trim().slice(0, 80) };
    const extra = cleanSizePhoto(r, family, isSafeUrl);
    if (o.bg === 'color' && !extra.bgColor) o.bg = '';
    if (o.bg === 'gradient' && !(extra.bgColor && extra.bgColor2)) o.bg = '';
    if (o.bg === 'preset' && !extra.grad) o.bg = '';
    if (o.bg !== 'color' && o.bg !== 'gradient') { delete extra.bgColor; delete extra.bgColor2; delete extra.gradDir; }   // the colour pickers always send a value; keep it only when used
    dropUnusedGrad(o.bg, extra);
    if (o.emoji || o.doodle || o.bg || o.title || hasSizePhoto(extra)) out[family] = hasSizePhoto(extra) ? { ...o, ...extra } : o;
  }
  return out;
}

// The size and photo part of an item's options, as used by custom sections too (same field names).
function sizePhotoOf(it, family, isSafeUrl) { return cleanSizePhoto(it || {}, family || 'custom', isSafeUrl); }

// Everything the wrapper needs: its data attributes, inline style, and an optional side/band photo.
const cssUrl = (u) => String(u).replace(/['"()\\\s<>]/g, (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'));
// theme: the site's theme, for the gradients worked out from its own colors
function wrap(o, theme) {
  o = o || {};
  const attrs = []; const style = [];
  let bg = o.bg || '';
  const c1 = HEX.test(o.bgColor || '') ? o.bgColor : '', c2 = HEX.test(o.bgColor2 || '') ? o.bgColor2 : '';
  // custom colours: the section recolors itself like the brand background, with light or dark text chosen for contrast
  const onColor = (cols) => { const worst = (fg) => Math.min(...cols.map(c => contrast.ratio(fg, c))); return worst('#ffffff') >= worst('#111111') ? '#ffffff' : '#111111'; };
  const customStyle = [];
  if (bg === 'color' && c1) { bg = 'custom'; customStyle.push(`--sg-brand: ${c1}`, `--sg-onbrand: ${onColor([c1])}`); }
  const gs = gradients.cleanStyle(o.gradStyle), ga = gradients.cleanAngle(o.gradAngle), grain = !!o.grain;
  const gradAttrs = () => { if (o.gradMove) attrs.push('data-sg-gmove="1"'); if (grain) attrs.push('data-sg-grain="1"'); };
  if (bg === 'gradient' && c1 && c2) {
    bg = 'custom';
    const d = GRAD_DIRS[o.gradDir] || GRAD_DIRS.diag;
    const img = gs || ga !== '' ? gradients.image([c1, c2], gs || 'line', ga) : d === 'radial' ? `radial-gradient(circle at 50% 0%, ${c1}, ${c2})` : `linear-gradient(${d}, ${c1}, ${c2})`;
    customStyle.push(`--sg-bgimg: ${img}`, `--sg-brand: ${c1}`, `--sg-onbrand: ${onColor([c1, c2])}`); gradAttrs();
  } else if (bg === 'themegrad') {
    bg = 'custom';
    const img = gs || ga !== '' ? gradients.image(gradients.stopsOf('brand-bold', theme), gs || 'line', ga) : 'linear-gradient(135deg, var(--primary), var(--accent))';
    customStyle.push(`--sg-bgimg: ${img}`); gradAttrs();
  } else if (bg === 'preset' && gradients.cleanId(o.grad) && o.gradBlend) {
    // blended into the section's own color: that color stays (and its text color), the gradient fades into it
    const dark = !!(theme && (theme.darkMode || theme.style === 'midnight'));
    bg = ''; style.push(`--sg-gb: ${gradients.blendImage(o.grad, theme, dark ? 'dark' : 'light', o.gradInk)}`); attrs.push('data-sg-gb="1"'); gradAttrs();
  } else if (bg === 'preset' && gradients.cleanId(o.grad)) {
    const g = gradients.background(o.grad, theme, gs, ga, o.gradInk);
    bg = 'custom'; customStyle.push(`--sg-bgimg: ${g.img}`, `--sg-brand: ${g.brand}`, `--sg-onbrand: ${g.onbrand}`); gradAttrs();
  } else if (bg === 'preset') bg = '';
  else if (bg === 'color' || bg === 'gradient') bg = '';
  style.push(...customStyle);
  if (customStyle.some(x => x.startsWith('--sg-bgimg'))) attrs.push('data-sg-img="1"');   // a gradient: the section's own page color steps aside so it shows
  if (o.photo && o.photoPos === 'bg') { bg = 'photo'; style.push(`--sg-photo: url('${cssUrl(o.photo)}')`, `--sg-ov: ${OVERLAY[o.photoOverlay] != null ? OVERLAY[o.photoOverlay] : OVERLAY.medium}`); }
  if (bg) attrs.push(`data-sg-bg="${bg}"`);
  if (o.doodle) attrs.push(`data-sg-doodle="${o.doodle}"`);
  if (!!o.flip !== !!o.autoFlip) attrs.push('data-sg-flip="1"');
  if (SHAPES.includes(o.shape)) attrs.push(`data-sg-shape="${o.shape}"`);
  if (o.emoji) { attrs.push('data-sg-emoji="1"'); style.unshift(`--sg-emoji: '${o.emoji}'`); }
  const pad = (o.padY !== '' && o.padY != null) ? +o.padY : SPACE[o.space];
  if (pad != null) { attrs.push('data-sg-pad="1"'); style.push(`--sg-pad: ${pad}px`); }
  const mw = (o.maxW !== '' && o.maxW != null) ? +o.maxW : WIDTH[o.width];
  if (mw != null) { attrs.push('data-sg-max="1"'); style.push(`--sg-max: ${mw ? mw + 'px' : 'none'}`); }
  const fs = (o.fs !== '' && o.fs != null) ? +o.fs : TEXT[o.text];
  if (fs != null && fs !== 100) { attrs.push('data-sg-fs="1"'); style.push(`--sg-fs: ${(fs / 100).toFixed(2)}`); }
  const side = (o.photo && ['left', 'right', 'above', 'below'].includes(o.photoPos)) ? { pos: o.photoPos, url: o.photo, size: o.photoSize || 'medium' } : null;
  if (side) attrs.push(`data-sg-side="${side.pos}"`, `data-sg-psize="${side.size}"`);
  return { attrs: attrs.length ? ' ' + attrs.join(' ') : '', style: style.length ? ` style="${style.join('; ')}"` : '', side };
}
module.exports = { dropUnusedGrad, BG_MODES, autoAlternate, SHAPES, wrap, sizePhotoOf, SPACE, WIDTH, TEXT, PHOTO_POS, OVERLAY, customItems, addedItems, tailItems, sectionList, cleanSectionOpts, BLUEPRINTS, BY_TEMPLATE, IDS, forTemplate, plan, cleanId, SECTION_KEY };
