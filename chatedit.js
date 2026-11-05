// Chat-to-edit: the owner (or a client) describes a change in plain words, the AI proposes a
// small list of edits, and nothing is saved until the person approves it.
//
// The AI never writes the site directly. It can only return operations on an allow-list of text
// and style fields; every value is validated here, so a bad or hostile reply cannot touch contact
// details, prices, hours, payments, credentials or anything else.

const { isValidHexColor } = require('./validate');

const clip = (v, n) => String(v == null ? '' : v).replace(/\u0000/g, '').trim().slice(0, n);

// Text fields: path pattern -> max length. Index segments are numbers.
const SECTION_HEADINGS = ['about', 'services', 'whyChoose', 'testimonials', 'gallery', 'faq', 'hours', 'contact', 'blog'];
const TEXT_RULES = [
  [/^hero\.(headline)$/, 120], [/^hero\.(subheadline)$/, 240], [/^hero\.(ctaText)$/, 40], [/^hero\.(trustText)$/, 120],
  [new RegExp(`^(${SECTION_HEADINGS.join('|')})\\.(heading|eyebrow)$`), 120],
  [/^about\.body$/, 2000],
  [/^services\.items\.\d+\.title$/, 80], [/^services\.items\.\d+\.description$/, 400], [/^services\.items\.\d+\.detail$/, 1500],
  [/^faq\.items\.\d+\.question$/, 200], [/^faq\.items\.\d+\.answer$/, 600],
  [/^announcement\.text$/, 160], [/^announcement\.linkText$/, 40],
  [/^seo\.title$/, 70], [/^seo\.description$/, 170]
];
const STYLE_ENUMS = {
  buttonShape: ['square', 'rounded', 'pill'], corners: ['sharp', 'soft', 'round'], spacing: ['compact', 'airy', ''],
  headingScale: ['large', 'xl', ''], headingCase: ['none', 'uppercase', '']
};
const LISTS = { 'services.items': { max: 12, fields: ['title', 'description'] }, 'faq.items': { max: 15, fields: ['question', 'answer'] } };
const MAX_OPS = 20;

// What the AI is allowed to see and change, in one compact object.
function snapshot(site, scope) {
  const s = site.sections;
  const o = {
    hero: { headline: s.hero.headline, subheadline: s.hero.subheadline, ctaText: s.hero.ctaText },
    about: { heading: s.about.heading, body: s.about.body },
    services: { heading: s.services.heading, items: s.services.items.map(i => ({ title: i.title, description: i.description })) },
    faq: { heading: s.faq.heading, items: s.faq.items.map(i => ({ question: i.question, answer: i.answer })) },
    announcement: { text: s.announcement ? s.announcement.text : '' },
    seo: { title: s.seo.title, description: s.seo.description }
  };
  if (scope !== 'client') {
    o.theme = { primaryColor: site.theme.primaryColor, accentColor: site.theme.accentColor, buttonShape: site.theme.buttonShape || '', corners: site.theme.corners || '', spacing: site.theme.spacing || '', headingScale: site.theme.headingScale || '', headingCase: site.theme.headingCase || '', bands: !!site.theme.bands, style: site.theme.style };
  }
  return o;
}

const SYSTEM = `You are the editing assistant inside a website builder. The owner of a small business tells you a change to make to their site. You answer with edit operations; nothing is applied until they approve.

Hard rules:
- Use ONLY facts already on the site or stated in the request. Never invent licenses, awards, years in business, prices, discounts, guarantees, reviews, names or statistics.
- You can only edit the fields shown in the current-content JSON (and add or remove services and FAQ items). You cannot change contact details, hours, prices, photos, payments, or anything not listed. If asked for something else, say so briefly in "reply" and return no operations.
- Plain, warm, confident language. No exclamation marks, no hype.
- Keep edits small and exactly what was asked. Do not rewrite things that were not mentioned.
- Output a single JSON object and nothing else:
  {"reply": "one or two plain sentences telling the owner what you changed or why you could not",
   "ops": [ {"op":"set","path":"hero.headline","value":"..."},
            {"op":"add","path":"services.items","value":{"title":"...","description":"..."}},
            {"op":"remove","path":"faq.items","index":2} ]}
- Paths use dots and zero-based numbers, e.g. services.items.0.title, about.body, theme.primaryColor (a #rrggbb colour), theme.bands (true/false).`;

function buildPrompt(site, instruction, scope, brief = '') {
  return `Business: ${site.name}\n${brief ? brief + '\n' : ''}Current content (editable fields only):\n${JSON.stringify(snapshot(site, scope))}\n\nOwner's request: ${clip(instruction, 600)}`;
}

function parseReply(text) {
  if (!text) return null;
  const t = String(text).replace(/```json|```/g, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try {
    const o = JSON.parse(t.slice(a, b + 1));
    return { reply: clip(o.reply, 400), ops: Array.isArray(o.ops) ? o.ops.slice(0, MAX_OPS) : [] };
  } catch (_) { return null; }
}

function getAt(obj, parts) { let c = obj; for (const p of parts) { if (c == null) return undefined; c = c[p]; } return c; }

// Apply operations to copies of sections/theme. Returns the new objects, a list of human-readable
// changes, and how many operations were refused.
function applyOps(site, ops, { scope = 'owner', styles = [] } = {}) {
  const sections = JSON.parse(JSON.stringify(site.sections));
  const theme = JSON.parse(JSON.stringify(site.theme));
  const changes = []; let rejected = 0;
  const label = (path) => path.replace(/\.items\.(\d+)\./, (_, n) => ` #${+n + 1} `).replace(/\./g, ' ');

  for (const op of (ops || []).slice(0, MAX_OPS)) {
    if (!op || typeof op !== 'object') { rejected++; continue; }
    const path = clip(op.path, 80);

    if (op.op === 'set' && path.startsWith('theme.')) {
      if (scope === 'client') { rejected++; continue; }
      const key = path.slice(6); let v = op.value, before = theme[key];
      if (key === 'primaryColor' || key === 'accentColor') { if (!isValidHexColor(String(v || '').trim())) { rejected++; continue; } v = String(v).trim(); }
      else if (key === 'bands') { v = v === true || v === 'true'; }
      else if (key === 'style') { if (!styles.includes(v)) { rejected++; continue; } }
      else if (STYLE_ENUMS[key]) { if (!STYLE_ENUMS[key].includes(v)) { rejected++; continue; } }
      else { rejected++; continue; }
      if (String(before == null ? '' : before) === String(v)) continue;
      theme[key] = v;
      changes.push({ label: ({ primaryColor: 'Main color', accentColor: 'Accent color', buttonShape: 'Button shape', corners: 'Corners', spacing: 'Spacing', headingScale: 'Heading size', headingCase: 'Heading case', bands: 'Alternating bands', style: 'Look' })[key] || key, before: String(before == null ? '' : before), after: String(v) });
      continue;
    }

    if (op.op === 'set') {
      const rule = TEXT_RULES.find(([re]) => re.test(path));
      const parts = path.split('.');
      if (!rule || parts.some(p => p === '__proto__' || p === 'constructor' || p === 'prototype')) { rejected++; continue; }
      if (typeof op.value !== 'string') { rejected++; continue; }
      const parent = getAt(sections, parts.slice(0, -1));
      if (!parent || typeof parent !== 'object') { rejected++; continue; }
      const v = clip(op.value, rule[1]);
      if (!v && !/\.(eyebrow|trustText|text|linkText)$/.test(path)) { rejected++; continue; }
      const before = String(parent[parts[parts.length - 1]] || '');
      if (before === v) continue;
      parent[parts[parts.length - 1]] = v;
      changes.push({ label: label(path), before, after: v });
      continue;
    }

    if ((op.op === 'add' || op.op === 'remove') && LISTS[path]) {
      const spec = LISTS[path]; const list = getAt(sections, path.split('.'));
      if (!Array.isArray(list)) { rejected++; continue; }
      if (op.op === 'add') {
        if (list.length >= spec.max || !op.value || typeof op.value !== 'object') { rejected++; continue; }
        const item = {};
        for (const f of spec.fields) item[f] = clip(op.value[f], f === 'title' || f === 'question' ? 120 : 600);
        if (!item[spec.fields[0]]) { rejected++; continue; }
        list.push(item);
        changes.push({ label: (path.startsWith('faq') ? 'Add question' : 'Add service'), before: '', after: spec.fields.map(f => item[f]).filter(Boolean).join(' — ') });
      } else {
        const i = Number(op.index);
        if (!Number.isInteger(i) || i < 0 || i >= list.length || list.length <= 1) { rejected++; continue; }
        const [gone] = list.splice(i, 1);
        changes.push({ label: (path.startsWith('faq') ? 'Remove question' : 'Remove service'), before: gone[spec.fields[0]] || '', after: '' });
      }
      continue;
    }
    rejected++;
  }
  return { sections, theme, changes, rejected };
}

module.exports = { SYSTEM, buildPrompt, parseReply, applyOps, snapshot, MAX_OPS };
