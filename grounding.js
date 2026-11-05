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
    f.diffs.join(' '), f.services.map(s => `${s.name} ${s.desc} ${s.price}`).join(' '), f.faq.map(x => `${x.q} ${x.a}`).join(' ')];
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
function checkCopy(copy, f) {
  const corpus = corpusOf(f), probs = [];
  const add = (field, text) => checkText(text, f, corpus).forEach(r => probs.push({ field, reason: r }));
  if (!copy) return probs;
  if (copy.hero) { add('hero headline', copy.hero.headline); add('hero subheadline', copy.hero.subheadline); add('button text', copy.hero.ctaText); }
  add('about', copy.about); add('seo title', copy.seoTitle); add('seo description', copy.seoDescription);
  (copy.services || []).forEach((s, i) => {
    if (f.services.length && !matchesService(s.title, f)) probs.push({ field: `service ${i + 1}`, reason: `a service the client did not list ("${s.title}")` });
    add(`service ${i + 1}`, `${s.title}. ${s.description}`); add(`service ${i + 1} detail`, s.detail);
  });
  if (!f.services.length && (copy.services || []).length) probs.push({ field: 'services', reason: 'services were written but the client listed none' });
  const fq = copy.faq || [];
  if (fq.length > f.faq.length) probs.push({ field: 'faq', reason: 'questions the client did not provide' });
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

module.exports = { TONES, TONE_IDS, toneText, buildFacts, corpusOf, checkText, checkCopy, scrubSections, neutralAbout, matchesService };
