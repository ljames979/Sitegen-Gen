// The smarter parts of "Generate a site" on the dashboard (Leo, 2026-11-27):
//   readPaste()   the "paste anything" box: a Google listing, a Facebook About, a text from the client, Leo's own notes.
//                 AI (or, without AI, a few plain patterns) picks out the details the form asks for. Every detail must be
//                 found in the pasted text itself: a phone number, email, year count, price, review or link that is not
//                 there word for word is dropped, so nothing the client never said gets onto the form.
//   blockSlots() + applyBlockWords()
//                 the words in the extra blocks the generator adds (About us, photo, contact blocks, the industry
//                 template's own blocks) and the section headings, rewritten by AI for this business in one call, so the
//                 page reads as one piece instead of stock headings and the About text repeated block after block.
// Photo links, colors and the owner's facts in a block are never sent or changed. grounding.markSections() runs after
// all of this and marks anything that is not backed up.
const grounding = require('./grounding');

const flat = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const words = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const digits = (s) => String(s || '').replace(/\D/g, '');

// ---- 1. the paste-anything box ----

const SYSTEM_READ = `You read pasted notes about ONE small local business (a Google listing, a social media About section, a message from the owner, or someone's notes) and copy out its details for a website form.

Hard rules:
- Copy only what the text actually says. Never guess, complete or improve a detail. If something is not in the text, leave it empty.
- Phone numbers, emails, prices, years, links and reviews must be copied exactly as written in the text.
- Reviews: only real customer reviews that appear in the text, copied word for word, with the reviewer's name only if it is shown. Never write or shorten a review.
- "apart" is a short summary (at most 3 sentences) of what the text itself says makes them different or their story. No claims the text does not make.
- Output a single JSON object and nothing else.`;

function buildReadPrompt(text) {
  return `Pasted text:
"""
${String(text || '').slice(0, 12000)}
"""

Return JSON with exactly this shape (empty string or empty list when the text does not say):
{
  "name": "", "type": "what kind of business, in a few words", "phone": "", "email": "",
  "address": "street address as written", "city": "main city and state",
  "weekdayHours": "", "saturdayHours": "", "sundayHours": "",
  "years": "years in business as a number, only if the text states it",
  "badges": ["licenses, insurance, certifications or memberships the text says they hold"],
  "areas": ["towns or areas the text says they serve"],
  "services": [ { "name": "", "price": "only if the text gives one", "desc": "a few words from the text, or empty" } ],
  "apart": "",
  "reviews": [ { "quote": "word for word", "author": "" } ],
  "facebook": "full link if in the text", "instagram": "full link if in the text"
}`;
}

const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const FB_RE = /https?:\/\/(?:www\.|m\.)?facebook\.com\/[^\s"'<>)]+/i;
const IG_RE = /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>)]+/i;

// the details that need no AI: phone, email and social links
function localRead(source) {
  const t = String(source || '');
  const phone = (t.match(PHONE_RE) || [])[0] || '';
  const email = (t.match(EMAIL_RE) || [])[0] || '';
  return { phone: flat(phone, 40), email: flat(email, 254), facebook: flat((t.match(FB_RE) || [])[0], 300), instagram: flat((t.match(IG_RE) || [])[0], 300) };
}

// keeps only what the pasted text backs up; returns the form fields (only the ones found)
function checkRead(raw, source) {
  const src = String(source || ''), w = ' ' + words(src) + ' ', srcLow = src.toLowerCase();
  const nums = new Set((src.match(/\d+(?:[.,]\d+)?/g) || []).map(n => n.replace(/,/g, '')));
  const inText = (s) => { const x = words(s); return !!x && w.includes(' ' + x + ' '); };
  const someWord = (s) => words(s).split(' ').filter(x => x.length > 3).some(x => w.includes(' ' + x));
  const numsOk = (s) => (String(s || '').match(/\d+(?:[.,]\d+)?/g) || []).every(n => nums.has(n.replace(/,/g, '')));
  const r = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  const name = flat(r.name, 80); if (name && someWord(name)) out.business_name = name;
  const type = flat(r.type, 100); if (type) out.business_type = type;
  const phone = flat(r.phone, 40);
  if (phone && digits(phone).length >= 7 && (src.match(PHONE_RE) || []).concat(src.match(/\+?\d[\d\s().-]{6,}\d/g) || []).some(p => digits(p).endsWith(digits(phone).slice(-10)))) out.phone = phone;
  const email = flat(r.email, 254); if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && srcLow.includes(email.toLowerCase())) out.email = email;
  const address = flat(r.address, 200); if (address && someWord(address) && numsOk(address)) out.address = address;
  const city = flat(r.city, 80); if (city && inText(city.split(',')[0])) out.city = city;
  for (const [k, f] of [['weekdayHours', 'weekday_hours'], ['saturdayHours', 'saturday_hours'], ['sundayHours', 'sunday_hours']]) {
    const v = flat(r[k], 40); if (v && (/closed/i.test(v) ? /closed/i.test(src) : numsOk(v.replace(/:00\b/g, '')))) out[f] = v;
  }
  const yrs = parseInt(r.years, 10);
  if (Number.isInteger(yrs) && yrs > 0 && yrs < 200) {
    const since = (src.match(/\b(?:since|est\.?|established|founded(?: in)?)\s*(19\d\d|20\d\d)\b/i) || [])[1];
    if (nums.has(String(yrs)) || (since && Math.abs(new Date().getFullYear() - Number(since) - yrs) <= 1)) out.years_in_business = String(yrs);
  }
  const list = (v) => (Array.isArray(v) ? v : []).map(x => flat(x, 50)).filter(Boolean);
  const badges = list(r.badges).filter(someWord).slice(0, 8); if (badges.length) out.badges = badges.join(', ');
  const areas = list(r.areas).filter(a => inText(a.split(',')[0])).slice(0, 30); if (areas.length) out.service_areas = areas.join(', ');
  const services = (Array.isArray(r.services) ? r.services : []).map(s => ({ name: flat(s && s.name, 60), price: flat(s && s.price, 30), desc: flat(s && s.desc, 160) }))
    .filter(s => s.name && someWord(s.name)).map(s => ({ ...s, price: s.price && numsOk(s.price) && /\d/.test(s.price) ? s.price : '' })).slice(0, 12);
  if (services.length) out.services_list = services.map(s => (s.price || s.desc ? [s.name, s.price, s.desc].join(' | ').replace(/(?:\s\|\s*)+$/, '') : s.name)).join('\n');
  // the summary is AI wording: any sentence with a claim, number or place the pasted text does not back is dropped
  const apart = flat(r.apart, 900);
  if (apart) {
    const f = grounding.quickFacts({ extra: src }), corpus = grounding.corpusOf(f);
    const ok = apart.split(/(?<=[.!?])\s+/).filter(sen => !grounding.checkText(sen, f, corpus).length).join(' ');
    if (ok) out.specialties = ok;
  }
  const reviews = (Array.isArray(r.reviews) ? r.reviews : []).map(x => ({ quote: flat(x && x.quote, 600).replace(/^["“]|["”]$/g, ''), author: flat(x && x.author, 60) }))
    .filter(x => x.quote.length >= 15 && inText(x.quote)).map(x => ({ ...x, author: x.author && inText(x.author) ? x.author : '' })).slice(0, 8);
  if (reviews.length) out.reviews_list = reviews.map(x => x.author ? `${x.quote} — ${x.author}` : x.quote).join('\n');
  for (const k of ['facebook', 'instagram']) { const v = flat(r[k], 300); if (v && /^https?:\/\//i.test(v) && srcLow.includes(v.toLowerCase().replace(/\/$/, ''))) out[k] = v; }
  return out;
}

function parseJson(text) {
  if (typeof text !== 'string') return null;
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { const o = JSON.parse(text.slice(a, b + 1)); return o && typeof o === 'object' ? o : null; } catch { return null; }
}

// { fields, how: 'ai' | 'basic' } — the AI's reading when it works, always topped up with the plain patterns
async function readPaste(source, { complete } = {}) {
  const text = String(source || '').slice(0, 12000);
  if (!text.trim()) return { fields: {}, how: 'none' };
  let fields = {}, how = 'basic';
  if (typeof complete === 'function') {
    const reply = await complete({ system: SYSTEM_READ, prompt: buildReadPrompt(text), maxTokens: 2500 });
    const raw = parseJson(reply);
    if (raw) { fields = checkRead(raw, text); how = 'ai'; }
  }
  const basic = localRead(text);
  for (const k of Object.keys(basic)) if (basic[k] && !fields[k]) fields[k] = basic[k];
  return { fields, how };
}

// fills only the blanks of a generate form body from a readPaste() result (what Leo typed always wins)
function fillBlanks(body, fields) {
  const filled = [];
  for (const [k, v] of Object.entries(fields || {})) {
    if (!v || String(body[k] || '').trim()) continue;
    body[k] = v; filled.push(k);
  }
  return filled;
}

// "Dog wash | $40 | short words" or "Dog wash - $40" per line -> [{ name, price, desc }]
function parseServices(text) {
  return String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, 12).map(l => {
    let [name, price = '', desc = ''] = l.split(/\s*\|\s*/);
    if (!price) { const m = name.match(/^(.*?)\s+[-–—:]\s*(\$?\d[\d.,]*\+?(?:\s*(?:\/|per)\s*\w+)?|from \$?\d[\d.,]*)\s*$/i); if (m) { name = m[1]; price = m[2]; } }
    return { name: flat(name, 60), price: flat(price, 30), desc: flat(desc, 160) };
  }).filter(s => s.name);
}
// "Great job — Maria" per line -> [{ quote, author }]
function parseReviews(text) {
  return String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, 8).map(l => {
    const m = l.match(/^(.*\S)\s+[—–-]\s+([^—–-]{1,40})$/);
    return { quote: flat(m ? m[1] : l, 600).replace(/^["“]|["”]$/g, ''), author: flat(m ? m[2] : '', 60) };
  }).filter(r => r.quote.length >= 5);
}

// ---- 2. the words in the added blocks and the section headings ----

const SYSTEM_BLOCKS = `You finish the wording of a small business website. The main text is already written; you rewrite the short pieces in its extra blocks and section headings so the whole page reads as one piece written for this business.

Hard rules:
- Use ONLY the facts given. Never invent or imply licenses, insurance, awards, guarantees, years, numbers, prices, response times, 24/7 or same-day service, reviews, staff names or places that were not given.
- Keep each piece's job: a heading stays a short heading (at most 60 characters), a label stays a few words, a sentence stays about the same length.
- Make headings specific to this business, not stock phrases like "About Us" or "What We Offer".
- Never repeat the About text word for word; say it a different way or say something else that is true.
- Plain, warm, confident language. No hype, no exclamation marks, no filler.
- Output a single JSON object with exactly the same ids you were given, and nothing else.`;

const WORD_KEYS = /^(label|text|caption|item|card|pair|title|sub|line|quote)$/i;
const isWordPart = (p) => { const t = String(p || '').trim(); return t.length >= 2 && !/^(?:https?:|\/)/i.test(t) && !/^(?:#[0-9a-f]{3,8}|rgba?\(.*\))$/i.test(t) && /[a-z]/i.test(t); };

// every piece of wording that may be rewritten: [{ id, text, max }]
function blockSlots(sections) {
  const s = sections || {}, slots = [];
  const add = (id, text, max) => { const t = flat(text, 500); if (t && !t.includes(grounding.CONFIRM)) slots.push({ id, text: t, max }); };
  for (const k of ['about', 'services', 'faq', 'testimonials', 'whyChoose', 'gallery']) {
    const sec = s[k]; if (!sec) continue;
    if (k === 'testimonials' && !((sec.items || []).length)) continue;
    if (k === 'whyChoose' && !((sec.items || []).length)) continue;
    add(`s.${k}.heading`, sec.heading, 60);
    if (sec.eyebrow) add(`s.${k}.eyebrow`, sec.eyebrow, 40);
  }
  ((s.blocks && s.blocks.items) || []).forEach((b, i) => {
    if (!b || (b.page && b.page !== 'home')) return;
    if (b.heading) add(`b${i}.h`, b.heading, 70);
    if (b.buttonText) add(`b${i}.btn`, b.buttonText, 30);
    const body = String(b.body || '');
    if (!body) return;
    const lines = body.split('\n');
    if (!lines.some(l => /^[a-z]+:\s?/i.test(l))) { add(`b${i}.body`, body, Math.max(120, Math.round(body.length * 1.5))); return; }
    lines.forEach((line, li) => {
      const m = line.match(/^([a-z]+):\s?(.*)$/i);
      if (!m || !WORD_KEYS.test(m[1])) return;
      const parts = m[2].split(' | ');
      const multi = /^(item|card|pair)$/i.test(m[1]);   // "title | words": the service's name stays as it is
      let seen = 0;
      parts.forEach((p, pi) => {
        if (!isWordPart(p)) return;
        seen++;
        if (multi && seen === 1) return;
        add(`b${i}.l${li}.p${pi}`, p, Math.max(40, Math.round(p.length * 1.6)));
      });
    });
  });
  return slots.slice(0, 70);
}

function buildBlocksPrompt(facts, sections, slots) {
  const s = sections || {};
  const ctx = [
    `Business name: ${facts.name}`, `Type of business: ${facts.type}`,
    facts.city && `Main city: ${facts.city}`,
    facts.areas && facts.areas.length && `Areas served: ${facts.areas.join(', ')}`,
    facts.years && `Years in business (stated by the owner): ${facts.years}`,
    facts.badges && facts.badges.length && `Credentials the owner states they hold: ${facts.badges.join(', ')}`,
    facts.specialties && `Owner's notes: ${facts.specialties}`,
    facts.tone && `Tone of voice: ${facts.tone}`,
    facts.notes && `Notes pasted by the owner (facts you may use):\n${String(facts.notes).slice(0, 6000)}`,
    `Headline on the page: ${flat(s.hero && s.hero.headline, 120)}`,
    `About text on the page: ${flat(s.about && s.about.body, 900)}`,
    `Services: ${((s.services && s.services.items) || []).map(x => x && x.title).filter(Boolean).join('; ')}`
  ].filter(Boolean).join('\n');
  const obj = {}; slots.forEach(x => { obj[x.id] = x.text; });
  return `${ctx}
${facts.design ? `\n${facts.design}\n` : ''}
Rewrite each of these pieces (ids starting "s." are section headings, "b" ids are pieces of the extra blocks; pieces with the same block number belong together):
${JSON.stringify(obj, null, 1)}

Return one JSON object with the same ids and the new words.`;
}

// puts the AI's words back; returns how many pieces changed
// facts (grounding.quickFacts): a new piece that claims something they don't back up is not used (the old words stay)
function applyBlockWords(sections, slots, reply, facts) {
  const got = parseJson(reply);
  if (!got) return 0;
  const corpus = facts ? grounding.corpusOf(facts) : '';
  const s = sections, items = (s.blocks && s.blocks.items) || [];
  let n = 0;
  const bodies = new Map();   // block index -> lines (edited together)
  for (const slot of slots) {
    let v = got[slot.id];
    if (typeof v !== 'string') continue;
    v = v.replace(/\s+/g, ' ').replace(/\s\|\s/g, ' - ').trim().slice(0, slot.max);
    if (!v || v === slot.text) continue;
    if (facts && grounding.factProblems(v, facts, corpus).length) continue;
    if (/[[\]]/.test(v)) v = v.replace(/[[\]]/g, '');   // square brackets would turn into a highlight
    let m;
    if ((m = slot.id.match(/^s\.(\w+)\.(heading|eyebrow)$/))) { if (s[m[1]]) { s[m[1]][m[2]] = v; n++; } continue; }
    if ((m = slot.id.match(/^b(\d+)\.h$/))) { if (items[m[1]]) { items[m[1]].heading = v; n++; } continue; }
    if ((m = slot.id.match(/^b(\d+)\.btn$/))) { if (items[m[1]]) { items[m[1]].buttonText = v; n++; } continue; }
    if ((m = slot.id.match(/^b(\d+)\.body$/))) { if (items[m[1]]) { items[m[1]].body = v; n++; } continue; }
    if ((m = slot.id.match(/^b(\d+)\.l(\d+)\.p(\d+)$/))) {
      const b = items[m[1]]; if (!b) continue;
      if (!bodies.has(m[1])) bodies.set(m[1], String(b.body || '').split('\n'));
      const lines = bodies.get(m[1]), lm = (lines[m[2]] || '').match(/^([a-z]+):\s?(.*)$/i);
      if (!lm) continue;
      const parts = lm[2].split(' | ');
      if (parts[m[3]] === undefined) continue;
      parts[m[3]] = v; lines[m[2]] = `${lm[1]}: ${parts.join(' | ')}`; n++;
    }
  }
  for (const [i, lines] of bodies) items[i].body = lines.join('\n');
  return n;
}

// info: what the prompt tells the AI; facts: grounding.quickFacts() for the check
async function rewriteBlocks(sections, info, { complete, facts = null } = {}) {
  if (typeof complete !== 'function') return 0;
  const slots = blockSlots(sections);
  if (!slots.length) return 0;
  const reply = await complete({ system: SYSTEM_BLOCKS, prompt: buildBlocksPrompt(info, sections, slots), maxTokens: 3000 });
  return applyBlockWords(sections, slots, reply, facts);
}

// "Make 3 versions to compare" (Generate a site): the same business, facts and honesty check, three ways of saying it
// and three looks. style is one of the look ids (intake.MOODS); tone goes to the AI with the details.
const VARIANTS = [
  { id: 'warm', label: 'Warm', blurb: 'Friendly, caring words and a soft, rounded look.', style: 'warm',
    tone: 'Warm, friendly and reassuring, like a helpful neighbor. Speak to the customer\'s worry first, then the help. Short sentences.' },
  { id: 'professional', label: 'Professional', blurb: 'Clear, polished words and a classic, trustworthy look.', style: 'classic',
    tone: 'Professional, clear and confident. Measured and precise, no slang.' },
  { id: 'bold', label: 'Bold', blurb: 'Short, punchy words and a big, high-contrast look.', style: 'bold',
    tone: 'Bold, direct and confident. Short, punchy headlines that lead with the result. Still plain and honest: no hype and no exclamation marks.' }
];
const variantById = (id) => VARIANTS.find(v => v.id === id) || null;

module.exports = { VARIANTS, variantById, SYSTEM_READ, SYSTEM_BLOCKS, buildReadPrompt, localRead, checkRead, readPaste, fillBlanks, parseServices, parseReviews, blockSlots, buildBlocksPrompt, applyBlockWords, rewriteBlocks };
