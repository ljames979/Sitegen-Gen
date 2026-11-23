// Accept a client's wording change (Leo, 2026-11-23): when a note on the preview link asks for a simple text swap,
// e.g. Change "Family owned since 2010" to "Family owned since 2008", Leo presses Accept on the Client feedback page and
// SiteGen swaps those words wherever they are on the site (the earlier version is saved first, the note is ticked).
// Leo can also type the words to find and the new words himself when the note is not written that way.
// Only words change: links, picture addresses, colors and settings are never touched.
'use strict';

const Q = `["“”'‘’]`;   // quote marks clients type
const PATTERNS = [
  // change / replace / swap / update "A" to / with / into / for "B"
  new RegExp(`(?:change|replace|swap|update|switch|edit)\\s+(?:the\\s+\\w+\\s+)?${Q}([^"“”]{1,300}?)${Q}\\s+(?:to|with|into|for|by)\\s+${Q}([^"“”]{0,300}?)${Q}`, 'i'),
  // "A" should be / should say / to "B"
  new RegExp(`${Q}([^"“”]{1,300}?)${Q}\\s*(?:should\\s+(?:be|say|read)|->|→|=>|instead\\s+of\\s+that\\s*:?|to)\\s*${Q}([^"“”]{0,300}?)${Q}`, 'i'),
  // instead of "A" say / write / use "B"
  new RegExp(`instead\\s+of\\s+${Q}([^"“”]{1,300}?)${Q},?\\s*(?:please\\s+)?(?:say|write|use|put)\\s+${Q}([^"“”]{0,300}?)${Q}`, 'i'),
  // remove / delete "A"
  new RegExp(`(?:remove|delete|take\\s+out)\\s+(?:the\\s+(?:words?|text|line)\\s+)?${Q}([^"“”]{1,300}?)${Q}`, 'i')
];

function parse(message) {
  const m0 = String(message || '');
  for (let i = 0; i < PATTERNS.length; i++) {
    const m = PATTERNS[i].exec(m0);
    if (!m) continue;
    const from = m[1].trim(), to = i === 3 ? '' : String(m[2] || '').trim();
    if (from.length < 2 || from === to) continue;
    return { from, to };
  }
  return null;
}

// keys whose values are never words on the page, and values that are addresses or colors
const SKIP_KEY = /(url|href|src|image|img|icon|color|colour|font|style|slug|token|email|phone|embed|video|preset|pattern|class)$/i;
const SKIP_EXACT = new Set(['id', 'key', 'type', 'kind', 'w', 'h', 'x', 'y', 'bg', 'fx', 'map', 'lat', 'lng', 'lay', 'pat', 'ink', 'shape', 'size', 'motion', 'layout', 'anim']);
const NOT_WORDS = /^(https?:|mailto:|tel:|\/|~\/|#[0-9a-f]{3,8}$|rgba?\(|data:)/i;

// walks every word field of the sections: cb(value, path) returns the new value
function walk(node, path, cb) {
  if (typeof node === 'string') return cb(node, path);
  if (Array.isArray(node)) return node.map((v, i) => walk(v, path.concat(i), cb));
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === 'string' && (SKIP_EXACT.has(k) || SKIP_KEY.test(k) || NOT_WORDS.test(v.trim()))) { out[k] = v; continue; }
      if (k === 'kit' && path.length === 0) { out[k] = v; continue; }   // language word pairs stay as they are
      out[k] = walk(v, path.concat(k), cb);
    }
    return out;
  }
  return node;
}

const NAMES = { hero: 'Top banner', about: 'About', services: 'Services', testimonials: 'Reviews', whyChoose: 'Why choose us', faq: 'FAQ', gallery: 'Gallery', contact: 'Contact', hours: 'Hours', blocks: 'Content blocks', texts: 'Words typed on the page', seo: 'Google title and description', trust: 'Trust and service areas', blog: 'News', extraPages: 'Extra pages', cta: 'Call to action', footer: 'Footer', meta: 'Business details' };
const placeName = (path) => NAMES[path[0]] || String(path[0]);

// where the words are: [{ place, path }]
function locate(sections, from) {
  const hits = [];
  if (!from) return hits;
  walk(sections, [], (v, path) => { if (v.includes(from)) hits.push({ place: placeName(path), path: path.join('.') }); return v; });
  return hits;
}

// swaps every match; removing words also tidies the double space they leave
function apply(sections, from, to) {
  let count = 0;
  const next = walk(sections, [], (v) => {
    if (!from || !v.includes(from)) return v;
    count += v.split(from).length - 1;
    let out = v.split(from).join(to);
    if (!to) out = out.replace(/ {2,}/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim();
    return out;
  });
  return { sections: next, count };
}

module.exports = { parse, locate, apply };
