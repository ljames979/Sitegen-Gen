// Site kit (Leo, 2026-11-17, built for the LocalBite site): the site-wide pieces a marketing site needs that SiteGen
// did not have yet, all editable in the editor (Design > Pages, languages and header button) and none of them made up:
//   langs       a second language with an EN / ES switch in the menu bar. The owner keeps a list of word pairs
//               (English words as they show on the page | the same words in the second language); the visitor's
//               browser swaps every matching piece of text, button, placeholder and the page title when they pick the
//               second language, and remembers the choice. Text without a pair stays as it is, so nothing breaks
//               when the owner changes the English words: the editor's "Find words" button lists what still needs one.
//   button      the menu bar's own button (e.g. "Order now" to an app), in place of the automatic Call Now / Contact
//   blockPages  pages built only from the content blocks placed on them: the built-in section of that page (e.g. the
//               Services list) and the generic "Ready to get started?" band are left out, and the page shows in the
//               menu even when that built-in section is empty. The page's menu name is still its section heading.
//   apps        App Store / Google Play badges in the footer (a link each; without a link they say "Coming soon")
//   tiktok      a TikTok link beside the footer's Facebook / Instagram / X icons
//   phoneMenu   on phones the page links fold into a menu button that slides them in from the side (the classic menu
//               bar hides them on phones); computers keep the links in the bar
// Saved with the editor in one hidden box (kit_json) as sections.kit; a save without the box keeps what was there.
// Public markup in views/public-site.ejs, the switch in public/sg-lang.js, the editor panel in views/_site-kit.ejs
// with public/sitekit-edit.js.

const PAGES = ['about', 'services', 'testimonials', 'whyChoose', 'gallery', 'faq', 'blog', 'hours', 'contact'];
const LANGS = [['es', 'Spanish', 'ES'], ['pt', 'Portuguese', 'PT'], ['fr', 'French', 'FR'], ['ht', 'Haitian Creole', 'HT'], ['vi', 'Vietnamese', 'VI']];
const MAX_WORDS = 900;
const MAX_TEXT = 1500;

const flat = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
// words as the visitor's browser compares them: spaces folded, the same quote marks
const norm = (v) => flat(v, MAX_TEXT).replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
const LINK = /^(https?:\/\/[^\s"'<>]+|\/[^\s"'<>]*|#[\w-]*|tel:\+?[0-9][0-9 ()-]{2,30}|mailto:[^\s"'<>@]+@[^\s"'<>]+)$/i;
const link = (v) => { const u = flat(v, 400); return LINK.test(u) ? u : ''; };
const https = (v) => { const u = flat(v, 400); return /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : ''; };

function defaults() {
  return {
    langs: { on: false, code: 'es', first: 'EN', second: 'ES', words: [] },
    button: { text: '', url: '', newTab: false },
    blockPages: [],
    apps: { on: false, ios: '', android: '' },
    tiktok: '',
    phoneMenu: false
  };
}

function cleanWords(list) {
  const seen = new Set(), out = [];
  for (const p of Array.isArray(list) ? list : []) {
    const a = norm(Array.isArray(p) ? p[0] : p && p.en), b = flat(Array.isArray(p) ? p[1] : p && p.tr, MAX_TEXT);
    if (!a || seen.has(a.toLowerCase())) continue;
    seen.add(a.toLowerCase());
    out.push([a, b]);
    if (out.length >= MAX_WORDS) break;
  }
  return out;
}

function clean(k) {
  const d = defaults(), o = k && typeof k === 'object' ? k : {};
  const l = o.langs || {}, bt = o.button || {}, ap = o.apps || {};
  const code = LANGS.some(x => x[0] === l.code) ? l.code : 'es';
  return {
    langs: {
      on: !!l.on,
      code,
      first: flat(l.first, 6) || d.langs.first,
      second: flat(l.second, 6) || LANGS.find(x => x[0] === code)[2],
      words: cleanWords(l.words)
    },
    button: { text: flat(bt.text, 40), url: link(bt.url), newTab: !!bt.newTab },
    blockPages: [...new Set((Array.isArray(o.blockPages) ? o.blockPages : []).filter(p => PAGES.includes(p)))],
    apps: { on: !!ap.on, ios: https(ap.ios), android: https(ap.android) },
    tiktok: https(o.tiktok),
    phoneMenu: !!o.phoneMenu
  };
}

const of = (site) => clean(site && site.sections && site.sections.kit);

// the editor's save: kept as it was when the save does not carry the box
function parse(b, currentSections) {
  if (!b || b.kit_json === undefined) return clean(currentSections && currentSections.kit);
  try { return clean(JSON.parse(String(b.kit_json || '{}'))); } catch (e) { return clean(currentSections && currentSections.kit); }
}

const isBlockPage = (site, key) => of(site).blockPages.includes(key);

// the menu bar's own button, or null for the automatic one
function navButton(site) {
  const b = of(site).button;
  return b.text && b.url ? b : null;
}

// what the visitor's browser needs for the language switch, or null when it is off
function langData(site) {
  const l = of(site).langs;
  if (!l.on) return null;
  const words = {};
  l.words.forEach(([a, b]) => { if (b) words[a] = b; });
  return { code: l.code, first: l.first, second: l.second, words };
}
// as a script tag's JSON, safe inside HTML
const langJson = (site) => JSON.stringify(langData(site) || {}).replace(/</g, '\\u003c').replace(/ /g, '\\u2028').replace(/ /g, '\\u2029');

module.exports = { PAGES, LANGS, MAX_WORDS, defaults, clean, of, parse, isBlockPage, navButton, langData, langJson, norm };
