// Decorations kit (Leo, 2026-11-10: "make the new looks reusable"): the decorations one site has, picked up so another
// site can have them in one click, instead of a one-off script per client (tools/add-imperial-*.js).
//
// A kit holds only looks, never words or photos:
//   scenes:   [{ at, scene }]          Scene decor (scenedecor.js) on Blocks home sections
//   bgs:      [{ at, bg }]             pet pattern backgrounds (txp-*) on Blocks home sections (gradients.cleanMixBg)
//   wmarks:   [{ at, el, ...look }]    Watermarks (watermark.js), without their place ids
//   cards:    [{ ...look }]            the Decorative cards' look (decocard.js body lines), without their words
// "at" names the section the way the other site can find it again: its kind and which one of that kind it is, counted
// from the top ("lib:hero#1", "blk:decocard#1", "part:f:services"). If the other site has no such section, that
// decoration is left out and the report says so.
//
// capture(site) -> kit or null (nothing to copy); apply(site, kit) -> { theme, sections, report: { added, skipped } }
'use strict';
const sceneDecor = require('./scenedecor');
const gradients = require('./gradients');
const textures = require('./textures');
const watermark = require('./watermark');
const decoCard = require('./decocard');
const mixPage = require('./mixpage');

// the look lines of a Decorative card (everything but the words)
const CARD_LOOK = /^(style|icon|hide|border|orn|card|headc|bodyc|accc|btnc|sec|sec1|sec2|cardop|thick|radius|pad|width|shadow|hfont|bfont|pat|patc|patop|ledge|reveal|env|flap|seal|liner|sealicon|len|hint|once)\s*:/i;
const CARD_WORDS = /^(eyebrow|tagline|text|quote|detail)\s*:/i;
const AT = /^(lib:[a-z]+|sl:[a-z]+|at:[a-z]+|blk:[a-zA-Z]+)#\d{1,2}$|^part:[^<>"'`\\|]{1,160}$/;
const MAX = { scenes: 30, bgs: 30, wmarks: 60, cards: 10 };

const blocksOf = (s) => ((s && s.blocks && s.blocks.items) || []);
const mixOf = (theme) => mixPage.clean(theme && theme.mix);   // only real sections, so places count the same way everywhere

// Each mix item's place name ("lib:hero#1"), counted per kind from the top
function places(theme, sections) {
  const byId = {}; blocksOf(sections).forEach(b => { if (b && b.id) byId[b.id] = b; });
  const seen = {};
  return mixOf(theme).map(it => {
    if (!it) return '';
    const kind = it.k === 'blk' ? 'blk:' + ((byId[it.v] && byId[it.v].type) || 'block') : it.k + ':' + (it.f || '');
    seen[kind] = (seen[kind] || 0) + 1;
    return kind + '#' + seen[kind];
  });
}
// The Blocks home section a watermark's part names, as a place name; parts that aren't content blocks keep their name
function partPlace(part, theme, sections) {
  const m = /^b:(b[a-z0-9]{7})$/.exec(String(part || '').split('~')[0]);
  if (!m) return 'part:' + part;
  const idx = mixOf(theme).findIndex(it => it && it.k === 'blk' && it.v === m[1]);
  if (idx >= 0) return places(theme, sections)[idx];
  // a content block on its own page, not in the mix: name it by its kind
  const blocks = blocksOf(sections), b = blocks.find(x => x && x.id === m[1]);
  if (!b) return '';
  const nth = blocks.filter(x => x && x.type === b.type).indexOf(b) + 1;
  return 'blk:' + b.type + '#' + nth;
}
// ...and back: the part key on this site for a place name ('' = it has no such section)
function placePart(at, theme, sections) {
  if (at.startsWith('part:')) return at.slice(5);
  const i = places(theme, sections).indexOf(at);
  if (i >= 0) { const it = mixOf(theme)[i]; return it.k === 'blk' ? 'b:' + it.v : ''; }
  const m = /^blk:([a-zA-Z]+)#(\d+)$/.exec(at);
  if (!m) return '';
  const b = blocksOf(sections).filter(x => x && x.type === m[1])[Number(m[2]) - 1];
  return b ? 'b:' + b.id : '';
}

function cardLook(body) {
  return String(decoCard.cleanBody(body || '')).split('\n').filter(l => CARD_LOOK.test(l)).join('\n');
}

function capture(site) {
  const theme = (site && site.theme) || {}, sections = (site && site.sections) || {};
  const at = places(theme, sections), kit = { v: 1, scenes: [], bgs: [], wmarks: [], cards: [] };
  mixOf(theme).forEach((it, i) => {
    if (!it || !at[i]) return;
    const sc = sceneDecor.clean(it.scene);
    if (sc) kit.scenes.push({ at: at[i], scene: sc });
    const bg = gradients.cleanMixBg(it.bg);
    if (bg && textures.isPet(bg.g)) kit.bgs.push({ at: at[i], bg });
  });
  watermark.clean((sections.texts || {}).wmarks).filter(w => w.page === 'home').forEach(w => {
    const place = partPlace(w.part, theme, sections);
    if (!place) return;
    const look = { ...w }; delete look.id; delete look.part; delete look.page;
    look.at = place; look.el = w.el ? String(w.el).split('|').slice(1).join('|') : '';
    kit.wmarks.push(look);
  });
  blocksOf(sections).filter(b => b && b.type === 'decocard').forEach(b => kit.cards.push({ look: cardLook(b.body) }));
  return clean(kit);
}

function clean(k) {
  if (!k || typeof k !== 'object') return null;
  const ok = (a) => (Array.isArray(a) ? a : []);
  const out = { v: 1,
    scenes: ok(k.scenes).filter(s => s && AT.test(String(s.at)) && sceneDecor.clean(s.scene)).slice(0, MAX.scenes).map(s => ({ at: String(s.at), scene: sceneDecor.clean(s.scene) })),
    bgs: ok(k.bgs).filter(s => s && AT.test(String(s.at)) && gradients.cleanMixBg(s.bg)).slice(0, MAX.bgs).map(s => ({ at: String(s.at), bg: gradients.cleanMixBg(s.bg) })),
    wmarks: ok(k.wmarks).filter(w => w && AT.test(String(w.at))).slice(0, MAX.wmarks).map(w => {
      const t = watermark.cleanOne({ ...w, id: 'wkit0000', page: 'home', part: 'part', el: w.el ? 'part|' + String(w.el) : '' });
      if (!t) return null;
      const o = { ...t, at: String(w.at), el: w.el && t.el ? String(w.el) : '' }; delete o.id; delete o.page; delete o.part;
      return o;
    }).filter(Boolean),
    cards: ok(k.cards).slice(0, MAX.cards).map(c => ({ look: cardLook(c && c.look) })).filter(c => c.look) };
  return out.scenes.length || out.bgs.length || out.wmarks.length || out.cards.length ? out : null;
}

const count = (k) => (k ? k.scenes.length + k.bgs.length + k.wmarks.length + k.cards.length : 0);
// one line for a kit: "2 scene decor, 1 pet pattern, 3 watermarks, 1 card look"
function summary(k) {
  if (!k) return 'no decorations';
  const p = (n, one, many) => n ? `${n} ${n === 1 ? one : many}` : '';
  return [p(k.scenes.length, 'scene decor', 'scene decors'), p(k.bgs.length, 'pet pattern', 'pet patterns'), p(k.wmarks.length, 'watermark', 'watermarks'), p(k.cards.length, 'card look', 'card looks')].filter(Boolean).join(', ');
}

const rid = () => 'w' + Math.random().toString(36).slice(2, 9).padEnd(7, '0');

// Put a kit's decorations on a site. Words and photos are never touched; decorations already there are replaced only
// where the kit has one for the same place.
function apply(site, kitIn) {
  const kit = clean(kitIn);
  const theme = { ...(site.theme || {}) }, sections = { ...(site.sections || {}) };
  const report = { added: 0, skipped: 0 };
  if (!kit) return { theme, sections, report };
  const mix = mixOf(theme).map(it => ({ ...it }));
  theme.mix = mix;
  const at = places(theme, sections);
  kit.scenes.forEach(s => { const i = at.indexOf(s.at); if (i < 0) { report.skipped++; return; } mix[i].scene = s.scene; report.added++; });
  kit.bgs.forEach(s => { const i = at.indexOf(s.at); if (i < 0 || mix[i].k !== 'lib') { report.skipped++; return; } mix[i].bg = s.bg; report.added++; });
  theme.mix = mixPage.clean(mix);
  if (kit.wmarks.length) {
    const texts = sections.texts = { ...(sections.texts || {}) };
    let list = watermark.clean(texts.wmarks);
    kit.wmarks.forEach(w => {
      const part = placePart(w.at, theme, sections);
      if (!part) { report.skipped++; return; }
      const el = w.el ? part + '|' + w.el : '';
      list = list.filter(x => !(x.page === 'home' && x.part === part && x.el === el && (x.slot || 1) === (w.slot || 1)));
      const t = watermark.cleanOne({ ...w, id: rid(), page: 'home', part, el });
      if (t) { list.push(t); report.added++; } else report.skipped++;
    });
    texts.wmarks = watermark.clean(list);
  }
  if (kit.cards.length) {
    const cards = blocksOf(sections).filter(b => b && b.type === 'decocard');
    if (!cards.length) report.skipped += kit.cards.length;
    else {
      sections.blocks = { ...(sections.blocks || {}), items: blocksOf(sections).map(b => {
        const n = cards.indexOf(b);
        if (n < 0) return b;
        const look = kit.cards[Math.min(n, kit.cards.length - 1)].look;
        const words = String(b.body || '').split('\n').filter(l => CARD_WORDS.test(l));
        report.added++;
        return { ...b, body: decoCard.cleanBody(look + '\n' + words.join('\n')) };
      }) };
    }
  }
  return { theme, sections, report };
}

module.exports = { capture, clean, apply, summary, count, places };
