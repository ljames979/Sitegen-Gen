// Mix and match: a home page built from a list of blocks, each one any section design SiteGen has.
// A block is { k, f, v, own }:
//   k 'lib'  a section library layout (library/): f = family, v = variant. Always in the site's own look.
//   k 'sl'   a Style Library section (stylelib-page.js): f = its section (hero, features, ...), v = the style id.
//            own = true keeps the style's accent color; otherwise the client's brand color is used.
//   k 'at'   a Signature section (atelier.js): f = its section (hero, services, ...), v = the piece id.
//            Pieces are art-directed, so they always keep their own colors and fonts.
//   k 'blk'  one of the site's own content blocks (Content blocks in the editor): v = the block's id.
// Every block is filled from the site's real content only; a block with nothing to show is left out.
const lib = require('./library');
const content = require('./library/content');
const styleLib = require('./stylelib');
const slPage = require('./stylelib-page');
const atelier = require('./atelier');
const pinFx = require('./pinfx');
const filmFx = require('./filmfx');
const imgFx = require('./imgfx');
const heightFx = require('./heightfx');
const gradients = require('./gradients');
const glassFx = require('./glassfx');
const sceneDecor = require('./scenedecor');
const extraFx = require('./extrafx');
const wordStyle = require('./wordstyle');

const MAX = 30;

// Section types, in the order the Blocks page lists them
const TYPES = {
  hero: 'Hero', services: 'Services', about: 'About', why: 'Why choose us', stats: 'Numbers', testimonials: 'Reviews',
  gallery: 'Gallery', pricing: 'Pricing', faq: 'FAQ', areas: 'Areas served', cta: 'Call to action', contact: 'Contact',
  bento: 'Bento overview', banner: 'Scrolling banner', logos: 'Logos', own: 'Your content blocks',
};
// content block kinds, as the editor names them
const BLOCK_KINDS = { photoText: 'Photo + text', steps: 'Numbered steps', features: 'Feature cards', cta: 'Call-to-action band', chips: 'Area chips', strip: 'Photo strip', split: 'Heading + text', pricing: 'Pricing', team: 'Team', stats: 'Numbers', video: 'Video', tabs: 'Tabs', accordion: 'Accordion', wall: 'Brand wall', cascade: 'Card cascade', photoBanner: 'Photo banner', beforeAfter: 'Before / after', collage: 'Word carousel collage', trail: 'Photo trail', wave: 'Photo wave', bigwords: 'Big words with a photo', story: 'Scroll story', path: 'Path travel', zoomword: 'Zoom through the word', morph: 'Shape morph', nodes: 'Connected photo cards', shapes: 'Rolling words with photo shapes', stack: 'Stacked cards', herocard: 'Hero card', aboutphone: 'About with phone', thirds: 'Photo, words and a big letter', mosaic: 'Photo mosaic hero', crossband: 'Card over a color band', advice: 'Photo with round-photo points', photoblend: 'Photo that blends in', patterns: 'Gradient pattern', overlapcard: 'Photo over a text card', phototabs: 'Photo picks the words', reviewcard: 'Reviews on a card', twinphotos: 'Two photos and links', ringcard: 'Words and photo with rings', shapeform: 'Contact form with shapes', framedphoto: 'Photo in frames with a card', roundphoto: 'Round photo with a color card', photopairs: 'Photo and words pairs', offsetphoto: 'Photo on two color blocks', aboutstory: 'Our story circle', aboutme: 'Who am I', aboutbig: 'Big words over a photo', aboutfacts: 'Facts in a soft shape', aboutcollage: 'Photo collage', aboutnote: "Owner's note", aboutpanel: 'Words on a full photo', socialshapes: 'Follow card on shapes', socialphoto: 'Photo and follow', socialcounts: 'Follower counts', socialonphoto: 'Follow card on a photo', socialfeed: 'Photo feed grid', socialprofile: 'Profile card', socialstrip: 'Follow strip', numcards: 'Numbered cards beside a photo', tipcards: 'Big photo with cards over its edge', decocard: 'Decorative card' };
const BLK_ID = /^b[a-z0-9]{7}$/;
const homeBlocks = (site) => (((site && site.sections && site.sections.blocks) || {}).items || []).filter(b => (b.page || 'home') === 'home' && BLK_ID.test(b.id || ''));
const blockLabel = (b) => (BLOCK_KINDS[b.type] || 'Content block') + (b.heading ? ': ' + wordStyle.plain(b.heading).replace(/[\[\]]/g, '').slice(0, 40) : '');
const SL_TYPE = { hero: 'hero', features: 'services', story: 'about', stats: 'stats', quote: 'testimonials', gallery: 'gallery', pricing: 'pricing', faq: 'faq', area: 'areas', cta: 'cta' };
const SL_LABEL = { hero: 'Hero', features: 'Services', story: 'Story', stats: 'Numbers', quote: 'Review', gallery: 'Gallery', pricing: 'Pricing', faq: 'FAQ', area: 'Areas', cta: 'Closing band' };
const AT_TYPE = { hero: 'hero', services: 'services', about: 'about', stats: 'stats', reviews: 'testimonials', gallery: 'gallery', faq: 'faq', areas: 'areas', cta: 'cta' };
const AT_LABEL = { hero: 'Artwork hero', services: 'Services', about: 'About', stats: 'Numbers', reviews: 'Reviews', gallery: 'Gallery', faq: 'FAQ', areas: 'Areas', cta: 'Closing band' };

const slId = (v) => String(v || '').replace(/^sl-/, '');
const atId = (v) => String(v || '').replace(/^at-/, '');

// Keep only blocks that name a real design
function clean(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const b of list) {
    if (!b || typeof b !== 'object') continue;
    const k = b.k, f = String(b.f || ''), v = String(b.v || '');
    let c = null;
    if (k === 'lib' && f !== 'custom' && lib.isVariant(f, v) && TYPES[f]) c = { k, f, v };
    else if (k === 'blk' && BLK_ID.test(v)) c = { k, f: 'own', v };
    else if (k === 'sl' && SL_TYPE[f] && styleLib.get(styleLib.PREFIX + slId(v))) c = { k, f, v: slId(v), own: !!b.own };
    else if (k === 'at' && AT_TYPE[f] && atelier.get(atelier.PREFIX + atId(v))) c = { k, f, v: atId(v) };
    if (!c) continue;
    const lay = cleanLay(b.lay);
    if (lay) c.lay = lay;
    if (pinFx.clean(b.pin)) c.pin = b.pin;   // kept in place while the page scrolls (pinfx.js)
    if (filmFx.clean(b.film)) c.film = filmFx.clean(b.film);   // a see-through color layer over it (filmfx.js)
    if (imgFx.clean(b.imgfx)) c.imgfx = b.imgfx;   // its words over its photos, animated (imgfx.js)
    if (heightFx.clean(b.height)) c.height = b.height;   // drawn shorter or taller (heightfx.js)
    if (glassFx.clean(b.glass)) c.glass = b.glass;   // its content on a pane of glass (glassfx.js)
    if (sceneDecor.clean(b.scene)) c.scene = sceneDecor.clean(b.scene);   // a fence, hedge, grass or hills along its bottom (scenedecor.js)
    if (k === 'lib' && gradients.cleanMixBg(b.bg)) c.bg = gradients.cleanMixBg(b.bg);   // a gradient background (gradients.js)
    const xfx = extraFx.forBlock(b.xfx, f);   // More effects switched on for this block alone (extrafx.js)
    if (xfx.length) c.xfx = xfx;
    if (/^[a-z][a-z0-9-]{0,30}$/.test(String(b.a || ''))) c.a = b.a;   // its own page anchor, e.g. "book" so #book links land on it (Leo, 2026-11-10)
    out.push(c);
    if (out.length >= MAX) break;
  }
  return out;
}

// ---- Arrange: sizes, spacing, order and photo shapes set by dragging on the Blocks page ----
// A block's lay (all optional):
//   pad  { p, t, b }   the element that carries the section's top and bottom padding, and the padding in px
//   hm   true          hidden on phones
//   els  { path: { w, al, fs, sh, fx, fy, hm, h, hM } }   per element: width in grid columns (1-12, wide screens only),
//                      alignment l|c|r, text size in px (shrinks on phones), photo shape sq|tall|wide|circle,
//                      photo focus point in %, hidden on phones, height in px (h; hM on phones). The section's own
//                      height is the height of the element that carries its padding (the same one as pad.p).
//                      hx (hxM on phones): a photo or photo box cropped to exactly that height, so a section can be
//                      made shorter than its photos. py (pyM on phones): a box inside given less spacing above and below
//   ord  { path: [n...] }  the order of a parent's children (1-based child numbers, as they were drawn);
//   ordM               the same for phones only. Parents listed in fx (fxM on phones) were plain blocks, so they
//                      become a column for their children's order to apply.
// A path names an element inside the block by tag and child number, step by step ("section:1/div:2/h2:1"),
// so if the design or content no longer has that element the setting just doesn't apply.
const PATH = /^[a-z][a-z0-9-]{0,15}:\d{1,3}(\/[a-z][a-z0-9-]{0,15}:\d{1,3}){0,29}$/;
const num = (x, lo, hi) => { const n = Math.round(Number(x)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null; };
const SHAPES = ['sq', 'tall', 'wide', 'circle'];
function cleanOrd(o) {
  if (!o || typeof o !== 'object') return null;
  const out = {};
  for (const [p, a] of Object.entries(o).slice(0, 20)) {
    if (!PATH.test(p) || !Array.isArray(a) || a.length < 2 || a.length > 60) continue;
    const ns = a.map(n => num(n, 1, 999));
    if (ns.some(n => n === null) || new Set(ns).size !== ns.length) continue;
    out[p] = ns;
  }
  return Object.keys(out).length ? out : null;
}
function cleanLay(l) {
  if (!l || typeof l !== 'object') return null;
  const out = {};
  if (l.pad && PATH.test(l.pad.p)) {
    const t = num(l.pad.t, 0, 320), b = num(l.pad.b, 0, 320);
    if (t !== null || b !== null) out.pad = { p: l.pad.p, ...(t !== null ? { t } : {}), ...(b !== null ? { b } : {}) };
  }
  if (l.hm === true) out.hm = true;
  if (l.els && typeof l.els === 'object') {
    const els = {};
    for (const [p, e] of Object.entries(l.els).slice(0, 80)) {
      if (!PATH.test(p) || !e || typeof e !== 'object') continue;
      const o = {};
      const w = e.w == null ? null : num(e.w, 2, 12); if (w !== null) o.w = w;
      if (['l', 'c', 'r'].includes(e.al)) o.al = e.al;
      const fs = e.fs == null ? null : num(e.fs, 12, 160); if (fs !== null) o.fs = fs;
      if (SHAPES.includes(e.sh)) o.sh = e.sh;
      if (e.fx != null && e.fy != null) { const fx = num(e.fx, 0, 100), fy = num(e.fy, 0, 100); if (fx !== null && fy !== null) { o.fx = fx; o.fy = fy; } }
      if (e.hm === true) o.hm = true;
      for (const k of ['h', 'hM', 'hx', 'hxM']) { const h = e[k] == null ? null : num(e[k], 40, 2400); if (h !== null) o[k] = h; }
      for (const k of ['py', 'pyM']) { const y = e[k] == null ? null : num(e[k], 0, 320); if (y !== null) o[k] = y; }
      if (Object.keys(o).length) els[p] = o;
    }
    if (Object.keys(els).length) out.els = els;
  }
  const ord = cleanOrd(l.ord), ordM = cleanOrd(l.ordM);
  if (ord) out.ord = ord;
  if (ordM) out.ordM = ordM;
  for (const k of ['fx', 'fxM']) if (Array.isArray(l[k])) { const fx = l[k].filter(p => typeof p === 'string' && PATH.test(p)).slice(0, 20); if (fx.length) out[k] = [...new Set(fx)]; }
  return Object.keys(out).length ? out : null;
}
// CSS selector for a path inside block i ('' is the block itself)
function sel(i, p) {
  return `.sg-mix[data-mix-i="${i}"]` + (p ? p.split('/').map(st => { const [t, n] = st.split(':'); return ` > ${t}:nth-child(${n})`; }).join('') : '');
}
const PHONE = '(max-width: 699px)', WIDE = '(min-width: 700px)';
// The stylesheet for every block's arrangement. Widths only apply on wider screens (phones stack everything full
// width), text sizes shrink with the screen down to about 60% (never under 14px), photos fill their new shape.
const heightCss = (s, h) => `${s}:not(img){min-height:${h}!important;box-sizing:border-box;align-content:center}` +
  `${s}:not(img):has(> img:only-child){height:${h}!important}${s} > img:only-child{height:100%!important;object-fit:cover!important}` +
  `${s}:is(img){height:${h}!important;object-fit:cover!important}`;
function arrangeCss(blocks) {
  const all = [], wide = [], phone = [];
  clean(blocks).forEach((b, i) => {
    const l = b.lay; if (!l) return;
    if (l.pad) all.push(`${sel(i, l.pad.p)}{${l.pad.t !== undefined ? `padding-top:${l.pad.t}px!important;` : ''}${l.pad.b !== undefined ? `padding-bottom:${l.pad.b}px!important;` : ''}}`);
    if (l.hm) phone.push(`${sel(i, '')}{display:none!important}`);
    for (const p of (l.fx || [])) all.push(`${sel(i, p)}{display:flex!important;flex-direction:column}`);
    for (const [p, ns] of Object.entries(l.ord || {})) ns.forEach((n, k) => all.push(`${sel(i, p)} > :nth-child(${n}){order:${k + 1}}`));
    for (const p of (l.fxM || [])) phone.push(`${sel(i, p)}{display:flex!important;flex-direction:column}`);
    for (const [p, ns] of Object.entries(l.ordM || {})) {
      ns.forEach((n, k) => phone.push(`${sel(i, p)} > :nth-child(${n}){order:${k + 1}}`));
    }
    for (const [p, e] of Object.entries(l.els || {})) {
      const s = sel(i, p);
      if (e.w) wide.push(`${s}{width:${+(e.w / 12 * 100).toFixed(3)}%!important;max-width:${+(e.w / 12 * 100).toFixed(3)}%!important;flex:0 0 auto!important;box-sizing:border-box}`);
      if (e.al) {
        const m = e.al === 'l' ? 'margin-left:0!important;margin-right:auto!important' : e.al === 'r' ? 'margin-left:auto!important;margin-right:0!important' : 'margin-left:auto!important;margin-right:auto!important';
        all.push(`${s}{${m};text-align:${e.al === 'l' ? 'left' : e.al === 'r' ? 'right' : 'center'}!important;align-self:${e.al === 'l' ? 'flex-start' : e.al === 'r' ? 'flex-end' : 'center'}!important}`);
      }
      if (e.fs) all.push(`${s}{font-size:clamp(${Math.max(14, Math.round(e.fs * 0.6))}px, ${+(e.fs / 12.8).toFixed(3)}vw, ${e.fs}px)!important}`);
      if (e.sh) {
        const ar = { sq: '1 / 1', tall: '3 / 4', wide: '16 / 9', circle: '1 / 1' }[e.sh];
        all.push(`${s}, ${s} img{aspect-ratio:${ar}!important;height:auto!important;${e.sh === 'circle' ? 'border-radius:50%!important;' : ''}}${s} img, img${s}{width:100%!important;object-fit:cover!important}`);
        if (e.sh === 'circle') all.push(`${s}{overflow:hidden}`);
      }
      if (e.fx !== undefined) all.push(`${s}:is(img), ${s} img{object-position:${e.fx}% ${e.fy}%!important}`);
      if (e.hm) phone.push(`${s}{display:none!important}`);
      // a height: at least that tall with the content centered up and down; a photo (or a box holding only a photo)
      // exactly that tall, cropped to fit. A section's hero background stops forcing its own height.
      if (e.h || e.hM) {
        if (p === (l.pad && l.pad.p) || (e.h && !p.includes('/'))) all.push(`${sel(i, '')} :is(.sg-lib > div, .sl-sec > section, .sg-mix-at > div > section){min-height:0!important}`);
        if (e.h) { wide.push(heightCss(s, `${e.h}px`)); if (!e.hM) phone.push(heightCss(s, `min(${e.h}px, 90svh)`)); }
        if (e.hM) phone.push(heightCss(s, `${e.hM}px`));
      }
      // overflow clip (not hidden) so a scroll scene's sticky part inside still sticks
      const crop = (h) => `${s}{height:${h}px!important;min-height:0!important;overflow:clip!important}${s}:is(img){object-fit:cover!important}`;
      if (e.hx) wide.push(crop(e.hx));
      if (e.hxM) phone.push(crop(e.hxM));
      const py = (y) => `${s}{padding-top:${y}px!important;padding-bottom:${y}px!important}`;
      if (e.py != null) wide.push(py(e.py));
      if (e.pyM != null) phone.push(py(e.pyM));
    }
  });
  return all.join('\n') + (wide.length ? `\n@media ${WIDE}{${wide.join('\n')}}` : '') + (phone.length ? `\n@media ${PHONE}{${phone.join('\n')}}` : '');
}

const typeOf = (b) => (b.k === 'lib' ? b.f : b.k === 'blk' ? 'own' : b.k === 'sl' ? SL_TYPE[b.f] : AT_TYPE[b.f]);
function labelOf(b, site) {
  if (b.k === 'blk') { const x = homeBlocks(site).find(y => y.id === b.v); return x ? blockLabel(x) : 'Content block'; }
  if (b.k === 'lib') { const t = lib.BY_ID[`${b.f}/${b.v}`]; return t ? t.label : b.v; }
  if (b.k === 'sl') { const st = styleLib.get(styleLib.PREFIX + b.v); return `${st ? st.name : b.v}: ${SL_LABEL[b.f]}`; }
  const p = atelier.get(atelier.PREFIX + b.v); return `${p ? p.name : b.v}: ${AT_LABEL[b.f]}`;
}
const sourceOf = (b) => (b.k === 'lib' ? 'Section library' : b.k === 'blk' ? 'Content block' : b.k === 'sl' ? 'Style Library' : 'Signature');
// The site's home page content blocks, as Blocks page choices
function ownBlocks(site) {
  return homeBlocks(site).map(b => ({ type: 'own', k: 'blk', f: 'own', v: b.id, label: blockLabel(b), hint: 'Edit its words and photos in the editor.', source: 'Content block' }));
}

// Every design there is, for the Blocks page: [{ type, k, f, v, label, source }]
function catalog() {
  const out = [];
  for (const t of lib.SECTIONS) if (t.family !== 'custom' && TYPES[t.family]) out.push({ type: t.family, k: 'lib', f: t.family, v: t.variant, label: t.label, hint: t.hint || '', source: 'Section library' });
  for (const st of styleLib.STYLES) for (const f of Object.keys(SL_TYPE)) out.push({ type: SL_TYPE[f], k: 'sl', f, v: st.id, label: `${st.name}: ${SL_LABEL[f]}`, hint: st.mood || '', source: 'Style Library' });
  for (const p of atelier.PIECES) for (const f of Object.keys(AT_TYPE)) out.push({ type: AT_TYPE[f], k: 'at', f, v: p.id, label: `${p.name}: ${AT_LABEL[f]}`, hint: f === 'hero' ? p.look || '' : `In the ${p.name} piece's own colors and fonts.`, source: 'Signature' });
  return out;
}

// A first list from the home page the site has now, so switching to Mix and match starts from something familiar
function seed(site, templateId, homeLayout) {
  const t = site.theme || {};
  if (homeLayout === 'stylelib' && styleLib.isLib(t.style)) {
    const st = styleLib.get(t.style), bp = styleLib.blueprintOf(st, t);
    return clean([{ k: 'sl', f: 'hero', v: st.id }].concat(styleLib.BLUEPRINTS[bp].secs.map(f => ({ k: 'sl', f, v: st.id }))));
  }
  if (homeLayout === 'atelier' && atelier.isAtelier(t.style)) {
    const id = atId(t.style);
    return clean([{ k: 'at', f: 'hero', v: id }].concat(atelier.ORDER.map(f => ({ k: 'at', f, v: id }))));
  }
  const bps = require('./library/blueprints');
  const variants = t.bpVariants || {}, skip = new Set(t.bpSkip || []);
  return clean(bps.sectionList(t, templateId).sections.filter(s => !skip.has(s.family))
    .map(s => ({ k: 'lib', f: s.family, v: lib.isVariant(s.family, variants[s.family]) ? variants[s.family] : s.variant })));
}

// Draw the blocks. ctx: { site, basePath, services, areas, navPages, preview, staticExport, netlifyForms, still }
// Returns { items, sections, needs: { lib, sl, at }, fonts } where each item is { i, lib: { family, file, d, opts } } (drawn by
// the _lib-section partial) or { i, html }; sections lists the section types drawn. fonts: Google Fonts families the Style Library and Signature blocks use.
function render(ctx, blocks) {
  const list = clean(blocks);
  const items = [], sections = [], needs = { lib: false, sl: false, at: false }, fonts = new Set();
  const atCss = new Set(), css = [];
  let model = null;
  const m = () => model || (model = slPage.model(ctx));
  list.forEach((b, i) => {
    const n = items.length;
    draw(b, i);
    if (items.length > n) { sections.push(typeOf(b)); if (b.pin) items[n].pin = b.pin; if (b.film) items[n].film = b.film; if (b.imgfx) items[n].imgfx = b.imgfx; if (b.height) items[n].height = b.height; if (b.glass) items[n].glass = b.glass; if (b.scene) items[n].scene = b.scene; if (b.xfx) items[n].xfx = b.xfx; if (b.a) items[n].a = b.a; }
  });
  // the reset keeps SiteGen's heading rule off the Signature pieces
  if (css.length) css.unshift(':where(.sg-atelier) h1,:where(.sg-atelier) h2,:where(.sg-atelier) h3,:where(.sg-atelier) h4{color:inherit;font-family:inherit;line-height:inherit}');
  return { items, sections, needs, fonts: [...fonts], css: css.join('\n'), arrange: arrangeCss(list) };

  function draw(b, i) {
    if (b.k === 'blk') {
      // drawn by the page itself (the _blocks partial); a block hidden in Page sections or gone shows nothing
      const hidden = ((ctx.site.layout && ctx.site.layout.hidden) || []).includes('blk:' + b.v);
      if (!hidden && homeBlocks(ctx.site).some(x => x.id === b.v)) items.push({ i, f: 'blk', blk: b.v });
      return;
    }
    if (b.k === 'lib') {
      const d = content.bind(b.f, ctx);
      if (!d) return;
      needs.lib = true;
      items.push({ i, f: b.f, lib: { family: b.f, variant: b.v, id: `${b.f}/${b.v}`, file: `${b.f}-${b.v}`, d, opts: gradients.mixOpts(b.bg) } });
    } else if (b.k === 'sl') {
      const st = styleLib.get(styleLib.PREFIX + b.v);
      const theme = { ...ctx.site.theme, style: styleLib.PREFIX + st.id, slBlueprint: '', ...(b.own ? { primaryColor: st.c.accent, bgColor: '' } : {}) };
      const bp = styleLib.blueprintOf(st, {});
      const inner = b.f === 'hero' ? slPage.heroHTML(st, m(), bp) : slPage.SECTIONS[b.f](st, m(), bp);
      if (!inner) return;
      needs.sl = true;
      st.gf.split('&family=').forEach(x => fonts.add(x));
      items.push({ i, f: b.f, html: `<div class="tpl sg-mix-sl" ${styleLib.wrapAttrs(st)}${ctx.still ? ' data-still' : ''} data-sl-style="${st.id}" style="${esc(styleLib.tokens(st, theme))}"><div class="sl-sec" data-sl-sec="${b.f}">${inner}</div></div>` });
    } else {
      const p = atelier.get(atelier.PREFIX + b.v);
      let inner, script = '';
      if (b.f === 'hero') {
        const h = atelier.hero(p, m(), ctx);
        inner = h.html;
        script = atelier.boot(p, h.SG, !!ctx.still, `[data-mix-i="${i}"] .p-${p.id}`);
      } else inner = atelier.SECTIONS[b.f](p, m(), ctx);
      if (!inner) return;
      needs.at = true;
      atelier.GF[p.id].split('&family=').forEach(x => fonts.add(x));
      // the piece's stylesheet once per page (in the head, so a block's insides are the same wherever it sits)
      if (!atCss.has(p.id)) { atCss.add(p.id); css.push(atelier.files(p).css.trim()); }
      items.push({ i, f: b.f, html: `<div class="sg-atelier sg-mix-at" data-piece="${p.id}"${ctx.still ? ' data-still' : ''} style="${atelier.vars(p)}"><div class="p-${p.id}">${inner}</div>${script}</div>` });
    }
  }
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

module.exports = { MAX, TYPES, BLOCK_KINDS, ownBlocks, clean, cleanLay, arrangeCss, catalog, seed, render, typeOf, labelOf, sourceOf };
