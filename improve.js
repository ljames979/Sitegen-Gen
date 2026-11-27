// "✨ Improve with AI" (Leo, 2026-11-27): take a site that is already designed and let the AI suggest improvements
// to its wording, calls to action, search (SEO) text and a few look settings. Nothing is saved until Leo ticks the
// suggestions he wants; the site as it was is saved to history first (one click undoes it), or the changes can go
// onto a copy so the original is never touched.
//
// Honesty rules (the same as Generate a site and Modernize):
//   - The AI only rewrites wording that is already on the page. Reviews, numbers, contact details, hours, prices,
//     service names, photos and credentials are never sent to it as editable and never changed.
//   - Every new piece of wording is checked against what the site already says (grounding.checkText). One that
//     claims something new (a license, "24/7", a year count, a place, a number...) is held back and shown to Leo
//     with the reason, instead of being offered.
//   - Sentences still marked [Confirm with client] are left alone and do not count as facts.
const grounding = require('./grounding');
const aibuild = require('./aibuild');
const { STYLE_ENUMS } = require('./chatedit');

const flat = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const keepLines = (v, max) => String(v == null ? '' : v).replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const hasConfirm = (t) => String(t || '').includes(grounding.CONFIRM);

const AREAS = { words: 'Wording', action: 'Calls to action', seo: 'Google (SEO)', layout: 'Layout', look: 'Look' };
const HEADINGS = { about: 'About', services: 'Services', whyChoose: 'Why choose us', testimonials: 'Reviews', gallery: 'Gallery', faq: 'FAQ' };
const GENERIC_CTA = /^(submit|send|click here|click|learn more|read more|more|go|button|get in touch|contact|contact us|info|more info)$/i;
// sections that can be hidden in the layout, and how to tell they have something real to show
const SHOWABLE = {
  testimonials: ['Reviews', (s) => ((s.testimonials && s.testimonials.items) || []).some(x => x && x.quote)],
  faq: ['FAQ', (s) => ((s.faq && s.faq.items) || []).some(x => x && x.question && x.answer)],
  gallery: ['Gallery', (s) => ((s.gallery && s.gallery.images) || []).filter(Boolean).length >= 3],
  whyChoose: ['Why choose us', (s) => ((s.whyChoose && s.whyChoose.items) || []).some(x => x && (x.title || x.text))],
  services: ['Services', (s) => ((s.services && s.services.items) || []).some(x => x && x.title)],
  about: ['About', (s) => !!flat(s.about && s.about.body, 20)]
};
const LOOK_LABELS = { buttonShape: 'Button shape', corners: 'Corners', spacing: 'Spacing', headingScale: 'Heading size', headingCase: 'Heading case', bands: 'Alternating color bands' };

// ---- what may be rewritten: { id: { text, max, label, area, multiline } } ----
function fieldMap(site) {
  const s = site.sections || {}, out = {};
  const add = (id, text, max, label, area, multiline = false) => {
    const t = multiline ? keepLines(text, 4000) : flat(text, 4000);
    if (!t || hasConfirm(t)) return;
    out[id] = { text: t, max, label, area, multiline };
  };
  const h = s.hero || {};
  add('hero.headline', h.headline, 120, 'Top of the page: headline', 'words');
  add('hero.subheadline', h.subheadline, 240, 'Top of the page: line under the headline', 'words');
  add('hero.ctaText', h.ctaText, 40, 'Top of the page: main button', 'action');
  if (s.about) add('about.body', s.about.body, 2000, 'About text', 'words', true);
  for (const k of Object.keys(HEADINGS)) {
    const sec = s[k]; if (!sec) continue;
    const used = k === 'about' ? !!flat(sec.body, 5) : k === 'gallery' ? (sec.images || []).length > 0 : (sec.items || []).length > 0;
    if (used) add(`${k}.heading`, sec.heading, 120, `${HEADINGS[k]}: section heading`, 'words');
  }
  ((s.services && s.services.items) || []).forEach((x, i) => {
    if (x && x.title) add(`services.items.${i}.description`, x.description, 400, `Service "${flat(x.title, 40)}": short description`, 'words');
  });
  ((s.faq && s.faq.items) || []).forEach((x, i) => {
    if (x && x.question) add(`faq.items.${i}.answer`, x.answer, 600, `FAQ "${flat(x.question, 50)}": answer`, 'words');
  });
  if (s.seo) {
    add('seo.title', s.seo.title, 70, 'Google: page title', 'seo');
    add('seo.description', s.seo.description, 170, 'Google: search description', 'seo');
  }
  // the extra content blocks: headings, buttons and the short pieces of wording in them (aibuild knows their shapes)
  const items = (s.blocks && s.blocks.items) || [];
  for (const slot of aibuild.blockSlots(s)) {
    if (slot.id.startsWith('s.')) continue;   // section headings are handled above
    const m = slot.id.match(/^b(\d+)\.(h|btn|body|l\d+\.p\d+)$/);
    if (!m) continue;
    const b = items[m[1]] || {};
    const name = `Block "${flat(String(b.heading || b.type || 'content').replace(/[[\]]/g, ''), 40)}"`;
    const kind = m[2] === 'h' ? 'heading' : m[2] === 'btn' ? 'button' : 'words';
    out['blk:' + slot.id] = { text: slot.text, max: slot.max, label: `${name}: ${kind}`, area: m[2] === 'btn' ? 'action' : 'words', multiline: false };
  }
  return out;
}

// ---- the facts: everything the site already says (minus sentences still waiting on the client) ----
function allText(v, out = [], depth = 0) {
  if (depth > 8 || v == null) return out;
  if (typeof v === 'string') { if (!/^(?:https?:|\/|#[0-9a-f]{3,8}$|data:)/i.test(v.trim())) out.push(v); return out; }
  if (Array.isArray(v)) { v.forEach(x => allText(x, out, depth + 1)); return out; }
  if (typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!/url|image|img|photo|video|logo|color|font|id$/i.test(k)) allText(x, out, depth + 1);
  return out;
}
function siteFacts(site) {
  const s = site.sections || {}, meta = s.meta || {}, t = s.trust || {}, c = s.contact || {};
  const said = allText(s).join('\n').split(/\n|(?<=[.!?])\s+/).filter(x => !hasConfirm(x)).join(' ');
  return grounding.quickFacts({
    name: site.name, type: meta.businessType || '', city: meta.city || '',
    areas: t.serviceAreas || [], badges: t.badges || [],
    services: ((s.services && s.services.items) || []).filter(x => x && x.title).map(x => ({ name: x.title, desc: hasConfirm(x.description) ? '' : (x.description || ''), price: x.price || '' })),
    address: c.address || '', phone: c.phone || '', email: c.email || '',
    hours: ((s.hours && s.hours.items) || []).map(x => `${x.day || ''} ${x.time || ''}`).join(' '),
    extra: said
  });
}

// ---- checks that need no AI ----
function localReview(site) {
  const s = site.sections || {}, meta = s.meta || {}, c = s.contact || {}, f = siteFacts(site);
  const name = flat(site.name, 80), type = flat(meta.businessType, 60), city = flat(meta.city, 60);
  const changes = [], show = [], tips = [];
  const seo = s.seo || {};
  if (!flat(seo.title, 5)) changes.push({ id: 'seo.title', value: `${name}${type ? ' | ' + type : ''}${city ? ' in ' + city : ''}`.slice(0, 70), why: 'The page has no Google title, so Google makes one up. This one says who you are, what you do and where.' });
  if (!flat(seo.description, 5)) {
    const about = flat(s.about && s.about.body, 600).split(/(?<=[.!?])\s+/).find(x => x.length > 30 && !hasConfirm(x) && !grounding.checkText(x, f).length);
    changes.push({ id: 'seo.description', value: (about || grounding.neutralAbout(f)).slice(0, 160), why: 'The page has no search description, the grey text under the title on Google.' });
  }
  const cta = flat(s.hero && s.hero.ctaText, 40);
  if (cta && GENERIC_CTA.test(cta)) changes.push({ id: 'hero.ctaText', value: c.phone && !c.acceptSubmissions ? 'Call Us Today' : 'Request a Quote', why: `"${cta}" doesn't tell visitors what happens next. A clear action gets more calls and messages.` });
  const hidden = (site.layout && site.layout.hidden) || [];
  for (const [key, [label, has]] of Object.entries(SHOWABLE)) {
    if (hidden.includes(key) && has(s)) show.push({ key, label, why: `Your ${label} section has real content but is hidden, so visitors never see it.` });
  }
  const reviews = ((s.testimonials && s.testimonials.items) || []).filter(x => x && x.quote).length;
  if (!reviews) tips.push('There are no customer reviews on the site. Ask the client for 2 or 3 real ones (AI never writes reviews).');
  if (!c.phone && !c.email) tips.push('There is no phone number or email in Contact, so visitors have no way to reach the business.');
  const confirm = JSON.stringify(s).split(grounding.CONFIRM).length - 1;
  if (confirm) tips.push(`${confirm} sentence${confirm === 1 ? ' is' : 's are'} still marked [Confirm with client]. Check ${confirm === 1 ? 'it' : 'them'} with the client before going live.`);
  const photos = [s.hero && s.hero.imageUrl, s.about && s.about.imageUrl, ...((s.gallery && s.gallery.images) || [])].filter(Boolean).length;
  if (photos < 3) tips.push('The site has fewer than 3 photos. Real photos of the work or the team make a big difference.');
  if (flat(seo.title, 200).length > 65) tips.push('The Google title is long, so Google will cut it off.');
  return { changes, show, tips };
}

// ---- the AI request ----
const SYSTEM_IMPROVE = `You are a website editor reviewing a finished small business website before it goes live. Suggest specific improvements to its wording so it is clearer, more persuasive and better for Google, and point out a few look settings that would help.

Hard rules (these override everything else):
- Use ONLY facts already on the site. Never invent or imply licenses, insurance, certifications, awards, guarantees, warranties, years in business, numbers, prices, discounts, response times, 24/7 or same-day service, reviews, ratings, staff names, history or places that the site does not already state.
- Only suggest changes to the ids you are given, and keep each piece's job: a heading stays a short heading, a button stays 2 to 4 words that say what happens next, a description stays about the same length.
- Only suggest a change when it is clearly better. Leave good wording alone. At most 25 changes.
- Calls to action: buttons should say what happens next ("Book a Grooming", "Get a Free Quote" only if free quotes are already stated). Headlines should say what the customer gets, not just the business name.
- Google (SEO): the page title is at most 60 characters with the main service and the city if one is given; the search description is at most 155 characters, plain and specific.
- Plain, warm, confident language. No hype, no exclamation marks, no filler such as "look no further", "world-class", "second to none", "one-stop shop", "dedicated team", "passion for", "exceed your expectations".
- Never use square brackets.
- Output a single JSON object and nothing else.`;

function buildPrompt(site, fields, local, { focus = [], note = '', brief = '' } = {}) {
  const s = site.sections || {}, meta = s.meta || {}, t = s.trust || {};
  const theme = site.theme || {};
  const ctx = [
    `Business name: ${site.name}`,
    meta.businessType && `Type of business: ${meta.businessType}`,
    meta.city && `Main city: ${meta.city}`,
    (t.serviceAreas || []).length && `Areas served (stated on the site): ${t.serviceAreas.join(', ')}`,
    (t.badges || []).length && `Credentials stated on the site: ${t.badges.join(', ')}`,
    (t.stats || []).length && `Numbers stated on the site: ${t.stats.map(x => `${x.value} ${x.label}`).join('; ')}`,
    `Services (names stay as they are): ${((s.services && s.services.items) || []).map(x => x && x.title).filter(Boolean).join('; ')}`,
    ((s.testimonials && s.testimonials.items) || []).length ? `The site shows ${(s.testimonials.items || []).length} real customer reviews (not editable).` : 'The site has no customer reviews.',
    brief
  ].filter(Boolean).join('\n');
  const obj = {}; for (const [id, x] of Object.entries(fields)) obj[id] = x.text;
  const look = {}; for (const k of Object.keys(LOOK_LABELS)) look[k] = k === 'bands' ? !!theme.bands : (theme[k] || '');
  const opts = {}; for (const k of Object.keys(STYLE_ENUMS)) opts[k] = STYLE_ENUMS[k].filter(Boolean);
  const focusText = focus.length ? `Leo wants you to focus on: ${focus.map(a => AREAS[a] || a).join(', ')}.` : '';
  return `${ctx}

The wording on the site now, by id:
${JSON.stringify(obj, null, 1)}

Current look settings: ${JSON.stringify(look)}
Allowed look values: ${JSON.stringify(opts)} (bands is true or false)
${local.length ? `Things a quick check already found: ${local.join(' ')}\n` : ''}${focusText ? focusText + '\n' : ''}${note ? `Leo's note: ${note}\n` : ''}
Return JSON with exactly this shape:
{
  "summary": "one or two plain sentences on the biggest things you would improve",
  "changes": [ { "id": "one of the ids above", "value": "the new wording", "why": "one short plain sentence a non-technical person understands" } ],
  "look": [ { "key": "one of the look settings", "value": "an allowed value", "why": "one short sentence" } ],
  "tips": [ "at most 4 short tips for things only the owner can add, like real photos or reviews" ]
}`;
}

function parseJson(text) {
  if (typeof text !== 'string') return null;
  const t = text.replace(/```json|```/g, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { const o = JSON.parse(t.slice(a, b + 1)); return o && typeof o === 'object' ? o : null; } catch { return null; }
}

// ---- turning the AI's reply (and the quick checks) into suggestions Leo can tick ----
// returns { summary, suggestions: [{ sid, area, label, before, after, why, op }], held: [{ label, after, reasons }], tips }
function buildSuggestions(site, fields, reply, local) {
  const f = siteFacts(site), corpus = grounding.corpusOf(f);
  const suggestions = [], held = [], seen = new Set();
  const theme = site.theme || {};
  const offer = (id, value, why, fromAi) => {
    const fd = fields[id] || (id === 'seo.title' || id === 'seo.description' ? { text: '', max: id === 'seo.title' ? 70 : 170, label: id === 'seo.title' ? 'Google: page title' : 'Google: search description', area: 'seo' } : null);
    if (!fd || seen.has(id) || typeof value !== 'string') return;
    let v = fd.multiline ? keepLines(value, fd.max) : flat(value, fd.max);
    if (!/[[\]]/.test(fd.text)) v = v.replace(/[[\]]/g, '');
    if (id.startsWith('blk:')) v = v.replace(/\s\|\s/g, ' - ');
    if (!v || v === fd.text || hasConfirm(v)) return;
    const reasons = grounding.checkText(v, f, corpus);
    if (reasons.length) { if (fromAi) held.push({ label: fd.label, after: v, reasons }); return; }
    seen.add(id);
    suggestions.push({ sid: 's' + suggestions.length, area: fd.area, label: fd.label, before: fd.text, after: v, why: flat(why, 220), op: { kind: 'text', id } });
  };
  const r = reply || {};
  (Array.isArray(r.changes) ? r.changes : []).slice(0, 40).forEach(x => x && offer(flat(x.id, 80), x.value, x.why, true));
  (local.changes || []).forEach(x => offer(x.id, x.value, x.why, false));
  (local.show || []).forEach(x => suggestions.push({ sid: 's' + suggestions.length, area: 'layout', label: `Show the ${x.label} section`, before: 'Hidden', after: 'Shown on the page', why: x.why, op: { kind: 'show', key: x.key } }));
  const lookSeen = new Set();
  (Array.isArray(r.look) ? r.look : []).slice(0, 4).forEach(x => {
    const key = flat(x && x.key, 30);
    if (!LOOK_LABELS[key] || lookSeen.has(key)) return;
    let v = x.value;
    if (key === 'bands') { v = v === true || v === 'true'; if (v === !!theme.bands) return; }
    else { v = flat(v, 20); if (!STYLE_ENUMS[key].includes(v) || !v || v === (theme[key] || '')) return; }
    lookSeen.add(key);
    const show = (val) => (val === true ? 'On' : val === false ? 'Off' : String(val || 'Style default'));
    suggestions.push({ sid: 's' + suggestions.length, area: 'look', label: LOOK_LABELS[key], before: show(key === 'bands' ? !!theme.bands : theme[key]), after: show(v), why: flat(x.why, 220), op: { kind: 'theme', key, value: v } });
  });
  const tips = [...(local.tips || []), ...(Array.isArray(r.tips) ? r.tips : []).map(x => flat(x, 200)).filter(x => x && !hasConfirm(x)).slice(0, 4)];
  const order = Object.keys(AREAS);
  suggestions.sort((a, b) => order.indexOf(a.area) - order.indexOf(b.area));
  return { summary: flat(r.summary, 400), suggestions, held: held.slice(0, 15), tips: [...new Set(tips)].slice(0, 8) };
}

// asks the AI (when there is one) and puts it all together. ai: { complete } or nothing
async function review(site, { complete, focus = [], note = '', brief = '' } = {}) {
  const fields = fieldMap(site);
  const local = localReview(site);
  const found = [...local.changes.map(x => x.why), ...local.show.map(x => x.why)];
  let reply = null, how = 'basic';
  if (typeof complete === 'function' && Object.keys(fields).length) {
    const text = await complete({ system: SYSTEM_IMPROVE, prompt: buildPrompt(site, fields, found, { focus, note: flat(note, 400), brief }), maxTokens: 4000 });
    reply = parseJson(text);
    how = reply ? 'ai' : 'failed';
  }
  return { ...buildSuggestions(site, fields, reply, local), how };
}

// ---- applying the ticked suggestions ----
function setAt(obj, parts, v) {
  let c = obj;
  for (const p of parts.slice(0, -1)) { if (p === '__proto__' || p === 'constructor' || p === 'prototype' || c == null || typeof c !== 'object') return false; c = c[p]; }
  const last = parts[parts.length - 1];
  if (c == null || typeof c !== 'object' || last === '__proto__') return false;
  c[last] = v; return true;
}
// returns { sections, theme, layout, applied, stale } — copies; the site passed in is not changed.
// A suggestion whose wording on the site changed since it was made (Leo edited it meanwhile) is skipped, not forced.
function applySuggestions(site, suggestions, pickedIds) {
  const sections = JSON.parse(JSON.stringify(site.sections));
  const theme = JSON.parse(JSON.stringify(site.theme || {}));
  const layout = JSON.parse(JSON.stringify(site.layout || {}));
  const picked = new Set((pickedIds || []).map(String));
  const now = fieldMap({ ...site, sections });
  let applied = 0, stale = 0;
  const blkSlots = [], blkReply = {};
  for (const sg of suggestions || []) {
    if (!picked.has(sg.sid)) continue;
    const op = sg.op || {};
    if (op.kind === 'text') {
      const cur = now[op.id];
      const curText = cur ? cur.text : '';
      if (curText !== (sg.before || '')) { stale++; continue; }
      if (op.id.startsWith('blk:')) { blkSlots.push({ id: op.id.slice(4), text: curText, max: 4000 }); blkReply[op.id.slice(4)] = sg.after; continue; }
      if (setAt(sections, op.id.split('.'), sg.after)) applied++;
    } else if (op.kind === 'show') {
      if (!Array.isArray(layout.hidden) || !layout.hidden.includes(op.key)) { stale++; continue; }
      layout.hidden = layout.hidden.filter(k => k !== op.key); applied++;
    } else if (op.kind === 'theme') {
      if (!LOOK_LABELS[op.key]) continue;
      theme[op.key] = op.value; applied++;
    }
  }
  if (blkSlots.length) applied += aibuild.applyBlockWords(sections, blkSlots, JSON.stringify(blkReply), null);
  return { sections, theme, layout, applied, stale };
}

module.exports = { AREAS, SYSTEM_IMPROVE, fieldMap, siteFacts, localReview, buildPrompt, parseJson, buildSuggestions, review, applySuggestions };
