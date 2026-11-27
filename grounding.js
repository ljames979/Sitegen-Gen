// Keeps client-built sites honest. Everything a visitor reads about a business must come from what the client
// told us (the questionnaire). This module (1) turns the questionnaire into a "facts" object, (2) checks any
// text against those facts for claims, numbers, services and places the client never gave, and (3) scrubs a
// built site so template wording and AI wording that make unsupported claims are replaced or removed.
// It is deliberately strict: a plain true sentence is better than a nice-sounding invented one.

const TONES = [
  ['', 'No preference', ''],
  ['friendly', 'Friendly and relaxed', 'Friendly, relaxed and conversational, like a helpful neighbor. Short sentences.'],
  ['professional', 'Professional and polished', 'Professional, clear and confident. Measured, no slang.'],
  ['warm', 'Warm and caring', 'Warm, reassuring and personal. Speak to the customer\'s worry first, then the help.'],
  ['direct', 'Direct and no-nonsense', 'Direct and plain. Say what you do and how to reach you. No flourish.'],
  ['upscale', 'Upscale and refined', 'Refined, calm and understated. Elegant but never stuffy.']
];
const TONE_IDS = TONES.map(t => t[0]);
const toneText = (id) => (TONES.find(t => t[0] === id) || [])[2] || '';

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9$%+#/ ]+/g, ' ').replace(/\s+/g, ' ').trim();
const firstSentence = (s) => (String(s || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/)[0] || '').trim();

// intake.clean() output -> facts
function buildFacts(d) {
  d = d || {};
  return {
    name: d.bizName || '', type: d.bizType || '', city: d.city || '', years: d.years || '',
    areas: String(d.areas || '').split(/[,\n;]/).map(x => x.trim()).filter(Boolean),
    badges: String(d.badges || '').split(/[,\n;]/).map(x => x.trim()).filter(Boolean),
    services: (d.services || []).map(s => ({ name: s.name, desc: s.desc || '', price: s.price || '' })),
    diffs: (d.diffs && d.diffs.length ? d.diffs : (d.diff ? [d.diff] : [])),
    faq: (d.faq || []).map(f => ({ q: f.q, a: f.a })),
    about: d.about || '', tagline: d.tagline || '', tone: d.tone || '',
    address: d.address || '', phone: d.phone || '', email: d.email || '',
    hours: [d.hrsWeekday, d.hrsSat, d.hrsSun].filter(Boolean).join(' ')
  };
}

function corpusOf(f) {
  const parts = [f.name, f.type, f.city, f.areas.join(' '), f.badges.join(' '), f.about, f.tagline, f.address, f.hours,
    f.diffs.join(' '), f.services.map(s => `${s.name} ${s.desc} ${s.price}`).join(' '), f.faq.map(x => `${x.q} ${x.a}`).join(' '), f.extra || ''];
  if (f.years) parts.push(`${f.years} years`);
  return norm(parts.join(' \n '));
}

// [pattern in the text, pattern that must appear in the client's own words for it to be allowed]
const CLAIMS = [
  [/\blicen[sc](?:ed|e|ing)\b/i, /licen[sc]/], [/\binsured\b/i, /insured/], [/\bbonded\b/i, /bonded/],
  [/\bcertif(?:ied|ication|ications)\b/i, /certif/], [/\baward[- ]?(?:winning|ed)?\b/i, /award/],
  [/\bguarantee[sd]?\b|\bwarrant(?:y|ies|ied)\b/i, /guarant|warrant/],
  [/\bfree\s+(?:estimates?|quotes?|consultations?|inspections?|assessments?|diagnostics?|shipping|delivery|appraisals?|evaluations?)\b/i, /\bfree\b/],
  [/\b24\s*[/-]\s*7\b|\b24[- ]hours?\b|\baround[- ]the[- ]clock\b/i, /24|around the clock/],
  [/\bsame[- ]day\b|\bnext[- ]day\b|\bwithin (?:the )?(?:hour|minutes)\b/i, /same[- ]day|next[- ]day|within/],
  [/\bemergenc(?:y|ies)\b/i, /emergenc/], [/\bfamily[- ](?:owned|run|operated)\b/i, /family/],
  [/\b(?:locally|veteran|woman|minority)[- ](?:owned|operated)\b/i, /owned|operated/], [/\bbackground[- ]check(?:ed|s)?\b/i, /background/],
  [/\bthe best\b|\bbest in\b|#\s?1\b|\bnumber one\b|\btop[- ]rated\b|\bleading\b|\bpremier\b|\bfinest\b/i, /best|#\s?1|number one|top|leading|premier|finest/],
  [/\bsatisfaction\b/i, /satisf/], [/\bmoney[- ]back\b/i, /money/], [/\b(?:five|5)[- ]star\b/i, /star/], [/\bbbb\b/i, /bbb/],
  [/\baffordable\b|\bupfront\b|\btransparent\b|\bcompetitive\b|\blowest\b|\bno hidden fees\b/i, /afford|upfront|transparent|competitive|lowest|hidden/],
  [/\bdecades?\b/i, /decade/], [/\btrusted by\b/i, /trusted/]
];
const SPELLED_BIG = /\b(eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundreds?|thousands?|millions?|dozens?)\b/gi;
const SPELLED_SMALL = /\b(two|three|four|five|six|seven|eight|nine|ten)\s+(?:years|customers|clients|projects|homes|jobs|locations|stars)\b/gi;
const FILLER = /\blook no further\b|\bsecond to none\b|\bworld[- ]class\b|\bone[- ]stop[- ]shop\b|\bstate[- ]of[- ]the[- ]art\b|\bcutting[- ]edge\b|\btop[- ]notch\b|\bunparalleled\b|\bunmatched\b|\bexceed(?:s|ing)? (?:your )?expectations\b|\bwe pride ourselves\b|\bdedicated team\b|\byour satisfaction is\b|\bno job (?:is )?too\b|\bpassion for\b|\babove and beyond\b|\bunbeatable\b|\bhassle[- ]free\b|\bstress[- ]free\b|\bonly the best\b|\bsecond-to-none\b|\bseamless\b|\bin today's fast[- ]paced\b|\bwe understand that\b/i;
const PLACE = /\b(?:in|near|around|throughout|serving|across)\s+((?:[A-Z][a-z]+)(?:\s+[A-Z][a-z]+){0,2})/g;

// reasons the text is not supported by the facts ([] when fine)
function checkText(text, f, corpus) {
  const t = String(text || '');
  if (!t.trim()) return [];
  corpus = corpus || corpusOf(f);
  const out = [];
  for (const [re, ok] of CLAIMS) { const m = t.match(re); if (m && !ok.test(corpus)) out.push(`claims "${m[0]}"`); }
  const nums = new Set(corpus.match(/\d[\d,]*(?:\.\d+)?/g) || []);
  const cn = new Set([...nums].map(n => n.replace(/,/g, '')));
  for (const m of t.match(/\$?\d[\d,]*(?:\.\d+)?%?/g) || []) {
    const digits = m.replace(/[$,%]/g, '');
    if (!cn.has(digits) && !corpus.includes(norm(m))) out.push(`a number the client did not give ("${m}")`);
  }
  for (const m of t.match(SPELLED_BIG) || []) if (!new RegExp('\\b' + m.toLowerCase() + '\\b').test(corpus)) out.push(`an amount the client did not give ("${m}")`);
  for (const m of t.match(SPELLED_SMALL) || []) if (!corpus.includes(m.toLowerCase())) out.push(`an amount the client did not give ("${m}")`);
  const fm = t.match(FILLER); if (fm) out.push(`filler phrase "${fm[0]}"`);
  let pm; PLACE.lastIndex = 0;
  while ((pm = PLACE.exec(t))) { const first = pm[1].split(' ')[0].toLowerCase(); if (!corpus.includes(first)) out.push(`a place the client did not mention ("${pm[1]}")`); }
  return [...new Set(out)];
}

const matchesService = (title, f) => {
  const a = norm(title); if (!a) return false;
  return f.services.some(s => { const b = norm(s.name); return a === b || a.includes(b) || b.includes(a) || b.split(' ').filter(w => w.length > 3).some(w => a.includes(w)); });
};

// check a whole AI draft; returns [{field, reason}]
// guessed: the quick "Generate a site" form, where the services and FAQ are meant to be the usual ones for the trade,
// so only claims, numbers and places are checked, not whether the client listed each service or question
function checkCopy(copy, f, { guessed = false } = {}) {
  const corpus = corpusOf(f), probs = [];
  const add = (field, text) => checkText(text, f, corpus).forEach(r => probs.push({ field, reason: r }));
  if (!copy) return probs;
  if (copy.hero) { add('hero headline', copy.hero.headline); add('hero subheadline', copy.hero.subheadline); add('button text', copy.hero.ctaText); }
  add('about', copy.about); add('seo title', copy.seoTitle); add('seo description', copy.seoDescription);
  (copy.services || []).forEach((s, i) => {
    if (!guessed && f.services.length && !matchesService(s.title, f)) probs.push({ field: `service ${i + 1}`, reason: `a service the client did not list ("${s.title}")` });
    add(`service ${i + 1}`, `${s.title}. ${s.description}`); add(`service ${i + 1} detail`, s.detail);
  });
  if (!guessed && !f.services.length && (copy.services || []).length) probs.push({ field: 'services', reason: 'services were written but the client listed none' });
  const fq = copy.faq || [];
  if (!guessed && fq.length > f.faq.length) probs.push({ field: 'faq', reason: 'questions the client did not provide' });
  fq.forEach((x, i) => { add(`faq ${i + 1}`, `${x.question} ${x.answer}`); });
  return probs;
}

const neutralAbout = (f) => `${f.name} is a ${String(f.type || 'local business').toLowerCase()}${f.city ? ' serving ' + f.city : ''}.`;
const SAFE_CTA = 'Request a Quote';

// Scrub a built site in place. Replaces or removes anything that makes an unsupported claim. Returns notes for the owner.
function scrubSections(sections, f) {
  const corpus = corpusOf(f), notes = [];
  const bad = (t) => checkText(t, f, corpus).length > 0;
  const s = sections;
  if (bad(s.hero.headline)) { s.hero.headline = f.name; notes.push('hero headline'); }
  if (bad(s.hero.subheadline)) { s.hero.subheadline = f.tagline || firstSentence(f.about) || ''; notes.push('hero subheadline'); }
  if (bad(s.hero.ctaText)) { s.hero.ctaText = SAFE_CTA; notes.push('hero button text'); }
  if (bad(s.about.body)) { s.about.body = f.about || neutralAbout(f); notes.push('about text'); }
  if (!s.about.body.trim()) s.about.body = f.about || neutralAbout(f);
  if (f.services.length) {
    const had = s.services.items || [];
    s.services.items = f.services.map((c, i) => {
      const old = had.find(x => x && norm(x.title) === norm(c.name)) || {};
      const price = c.price ? `${c.price}` : '';
      const base = [price, c.desc].filter(Boolean).join(' · ');
      const aiDesc = old.description && !bad(old.description) && old.description !== base ? old.description : '';
      const desc = aiDesc ? (price ? `${price} · ${aiDesc}` : aiDesc) : base;
      return { ...old, title: c.name, description: desc, detail: old.detail && !bad(old.detail) ? old.detail : '' };
    });
  } else {
    const keep = (s.services.items || []).filter(x => !bad(`${x.title}. ${x.description}`) && !bad(x.detail));
    if (keep.length !== (s.services.items || []).length) notes.push('services');
    s.services.items = keep;
  }
  let hideFaq = false;
  if (f.faq.length) s.faq.items = f.faq.map(x => ({ question: x.q, answer: x.a }));
  else {
    const keep = (s.faq.items || []).filter(x => !bad(`${x.question} ${x.answer}`));
    if (keep.length !== (s.faq.items || []).length) notes.push('FAQ answers');
    s.faq.items = keep; hideFaq = !keep.length;
  }
  if (s.blocks && Array.isArray(s.blocks.items)) {
    const keep = s.blocks.items.filter(b => !bad(`${b.heading || ''}. ${b.body || ''}`));
    if (keep.length !== s.blocks.items.length) notes.push('content blocks'); s.blocks.items = keep;
  }
  if (s.whyChoose && Array.isArray(s.whyChoose.items)) s.whyChoose.items = s.whyChoose.items.filter(i => !bad(`${i.title || ''}. ${i.text || ''}`));
  if (s.seo) {
    if (bad(s.seo.title)) { s.seo.title = `${f.name} | ${f.type}${f.city ? ' in ' + f.city : ''}`.slice(0, 70); notes.push('page title'); }
    if (bad(s.seo.description)) { s.seo.description = (f.tagline || firstSentence(f.about) || neutralAbout(f)).slice(0, 160); notes.push('search description'); }
  }
  return { notes, hideFaq };
}

// ---- Quick generator (dashboard "Generate a site") ----
// Its facts are the few form fields (and anything pasted into the "paste anything" box). Its wording is partly guessed
// (the usual services for the trade, built-in starter text when AI is off), so instead of deleting what is not backed
// up, each such sentence is marked "[Confirm with client]" in place. Leo sees it in the preview, and the whole-site
// check (sitecheck.js) blocks going live while a [placeholder] like that is still on the page.
const CONFIRM = '[Confirm with client]';
function quickFacts(d) {
  d = d || {};
  const list = (v) => (Array.isArray(v) ? v : String(v || '').split(/[,\n;]/)).map(x => String(x).trim()).filter(Boolean);
  return {
    name: d.name || '', type: d.type || '', city: d.city || '', years: d.years ? String(d.years) : '',
    areas: list(d.areas), badges: list(d.badges),
    services: (d.services || []).map(s => (typeof s === 'string' ? { name: s, desc: '', price: '' } : { name: s.name || '', desc: s.desc || '', price: s.price || '' })),
    diffs: [], faq: [], about: d.specialties || '', tagline: '', tone: d.tone || '',
    address: d.address || '', phone: d.phone || '', email: d.email || '', hours: d.hours || '',
    extra: String(d.extra || '').slice(0, 12000)
  };
}
// claims, numbers and places only: filler wording is a matter of taste, not truth
const factProblems = (t, f, corpus) => checkText(t, f, corpus).filter(r => !/^filler/.test(r));
// marks every unsupported sentence of one text; returns { text, marked: [sentences] }
function markText(text, f, corpus) {
  const t = String(text || '');
  if (!t.trim() || t.includes(CONFIRM)) return { text: t, marked: [] };
  const marked = [];
  const out = t.split(/\n/).map(line => line.split(/(?<=[.!?])\s+/).map(sen => {
    if (!sen.trim() || !factProblems(sen, f, corpus).length) return sen;
    marked.push(sen.trim()); return `${CONFIRM} ${sen}`;
  }).join(' ')).join('\n');
  return { text: out, marked };
}
// block bodies are "key: value" lines; only the words in them are checked (not photo links, colors or the owner's facts)
const BODY_SKIP = /^(color|bg|accent|panel|button|round|photo|handle|fact|ink|img|image|url|link|icon|size|style|pat|patc|patop|ledge|reveal)$/i;
const isWordPart = (p) => p.trim() && !/^(?:https?:|\/)/i.test(p.trim()) && !/^(?:#[0-9a-f]{3,8}|rgba?\(.*\))$/i.test(p.trim());
function markBody(body, f, corpus) {
  const marked = [];
  const lines = String(body || '').split('\n').map(line => {
    const m = line.match(/^([a-z]+):\s?(.*)$/i);
    if (!m) { const r = markText(line, f, corpus); marked.push(...r.marked); return r.text; }
    if (BODY_SKIP.test(m[1])) return line;
    const parts = m[2].split(' | ').map(p => { if (!isWordPart(p)) return p; const r = markText(p, f, corpus); marked.push(...r.marked); return r.text; });
    return `${m[1]}: ${parts.join(' | ')}`;
  });
  return { text: lines.join('\n'), marked };
}
// marks a whole freshly generated site in place; returns [{ where, text }] for the preview's "check with the client" list
function markSections(sections, f) {
  const corpus = corpusOf(f), list = [];
  const s = sections;
  const doText = (obj, key, where) => {
    if (!obj || typeof obj[key] !== 'string') return;
    const r = markText(obj[key], f, corpus); obj[key] = r.text; r.marked.forEach(t => list.push({ where, text: t }));
  };
  // headings can't carry the note: [square brackets] in a heading mean "highlight these words". A heading that claims
  // something is swapped for the business name instead, and listed.
  const doHeading = (obj, key, where) => {
    if (!obj || typeof obj[key] !== 'string' || !factProblems(obj[key], f, corpus).length) return;
    list.push({ where: `${where} (heading swapped for the business name)`, text: obj[key] }); obj[key] = f.name || '';
  };
  if (s.hero) {
    doHeading(s.hero, 'headline', 'Top of the page'); doText(s.hero, 'subheadline', 'Top of the page');
    if (factProblems(s.hero.ctaText, f, corpus).length) s.hero.ctaText = SAFE_CTA;   // a button can't carry a note
  }
  if (s.about) doText(s.about, 'body', 'About');
  ((s.services && s.services.items) || []).forEach((x, i) => { doText(x, 'description', `Service: ${x.title || i + 1}`); doText(x, 'detail', `Service: ${x.title || i + 1}`); });
  ((s.faq && s.faq.items) || []).forEach(x => doText(x, 'answer', `FAQ: ${x.question || ''}`.slice(0, 80)));
  ((s.whyChoose && s.whyChoose.items) || []).forEach(x => { doText(x, 'title', 'Why choose us'); doText(x, 'text', 'Why choose us'); });
  for (const k of ['about', 'services', 'faq', 'testimonials', 'whyChoose']) if (s[k]) doHeading(s[k], 'heading', k === 'whyChoose' ? 'Why choose us' : k[0].toUpperCase() + k.slice(1));
  ((s.blocks && s.blocks.items) || []).forEach(b => {
    if (!b) return;
    const where = `Block: ${b.heading || b.type || ''}`.slice(0, 80);
    doHeading(b, 'heading', 'Block');
    if (typeof b.body === 'string') { const r = markBody(b.body, f, corpus); b.body = r.text; r.marked.forEach(t => list.push({ where, text: t })); }
  });
  if (s.seo) { // never shown with a note: swapped for a plain one instead
    if (factProblems(s.seo.title, f, corpus).length) s.seo.title = `${f.name} | ${f.type}${f.city ? ' in ' + f.city : ''}`.slice(0, 70);
    if (factProblems(s.seo.description, f, corpus).length) s.seo.description = neutralAbout(f).slice(0, 160);
  }
  return list.slice(0, 40);
}

module.exports = { CONFIRM, quickFacts, factProblems, markText, markBody, markSections, TONES, TONE_IDS, toneText, buildFacts, corpusOf, checkText, checkCopy, scrubSections, neutralAbout, matchesService };
