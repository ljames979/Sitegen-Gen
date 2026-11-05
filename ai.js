// AI-written website copy (optional). Uses the Anthropic Messages API over
// plain fetch, so there is no extra dependency. Everything fails soft: with no
// ANTHROPIC_API_KEY, or if the call errors, times out or returns something
// unusable, callers get null and fall back to the built-in templates.
//
// The prompt forbids inventing facts. The business owner's real details are
// the only source for claims about the business.

const DEFAULT_URL = 'https://api.anthropic.com/v1/messages';

function hasAiProvider() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SYSTEM = `You write website copy for small local businesses.

Hard rules:
- Use ONLY the facts you are given. Never invent or imply: licenses, insurance, certifications, awards, warranties or guarantees, years in business, number of customers or projects, prices, discounts, response times, 24/7 or same-day availability, free estimates, reviews or ratings, owner or staff names, or company history. If a fact was not given, leave it out and write about the service itself instead.
- Plain, warm, confident language. No hype, no exclamation marks, no filler like "look no further", "second to none", "world-class", "one-stop shop".
- Headlines describe the result the customer gets (for example "A clean, happy pup starts with a full groom"), in everyday words, never just the business name or a service label.
- Mention the city or service area naturally once or twice if one is given. Do not stuff keywords.
- FAQ answers must only state things that are true of the service in general or were provided. Where the honest answer depends on the business (pricing, scheduling, coverage), say to get in touch.
- Output a single JSON object and nothing else. No markdown fences, no commentary.`;

function buildPrompt(d, instruction) {
  const facts = [
    `Business name: ${d.name}`,
    `Type of business: ${d.type}`,
    d.city && `Main city / area (use it in the SEO title and naturally in the copy): ${d.city}`,
    d.address && `Address / location: ${d.address}`,
    d.serviceAreas && d.serviceAreas.length && `Areas served: ${d.serviceAreas.join(', ')}`,
    d.years && `Years in business (stated by the owner): ${d.years}`,
    d.badges && d.badges.length && `Credentials the owner states they hold: ${d.badges.join(', ')}`,
    d.specialties && `Owner's notes on specialties / what makes them different: ${d.specialties}`,
    d.services && d.services.length && `Services currently listed: ${d.services.join('; ')}`
  ].filter(Boolean).join('\n');

  return `${facts}
${d.design ? `\n${d.design}\n` : ''}${instruction ? `\nExtra direction from the owner: ${instruction}\n` : ''}
Return JSON with exactly this shape:
{
  "hero": { "headline": "<=60 chars, a clear benefit-led line, not just the business name", "subheadline": "<=150 chars", "ctaText": "<=28 chars, e.g. Request a Quote" },
  "about": "two short paragraphs separated by a blank line, <=900 characters total",
  "services": [ { "title": "<=45 chars", "description": "<=190 chars", "detail": "<=700 chars, 2-3 plain sentences on what this service generally involves and when someone needs it; no claims about this particular business" } ],
  "faq": [ { "question": "<=120 chars", "answer": "<=330 chars" } ],
  "seoTitle": "<=60 chars, include the city when one is given",
  "seoDescription": "<=155 chars"
}
Write 4 to 6 services typical for this kind of business (or keep to the listed ones if services were provided) and 4 to 5 FAQ items.`;
}

// ---- Facts-only copy (client questionnaires) ----
// The client's answers are the ONLY source. If a section has no facts behind it, it comes back empty and the
// caller leaves it out or uses the client's own words. grounding.js double-checks the result afterwards.
const SYSTEM_FACTS = `You write website copy for ONE small business, using only the facts below.

Hard rules (these override everything else):
- Use ONLY the facts provided. Never invent or imply a service, price, discount, license, insurance, certification, award, guarantee, warranty, years in business, number of customers or projects, response time, hours, team size, location, or testimonial.
- Do not write any number, price or amount that is not in the facts. Do not name any town or place that is not in the facts.
- Services: write about exactly the services provided, in the same order, using the same titles. Never add a service. If a service has no description, keep its description short and generic to what the name says, with no claims.
- Reasons to choose them: only the "What sets them apart" points provided, in plain words. If none are provided, say nothing about why to choose them.
- FAQ: only rephrase the questions and answers provided, keeping every fact in the answer. If none are provided, return an empty list. Never add questions.
- If the facts are too thin for a field, return an empty string for it rather than padding it.
- Plain, concrete language in the requested tone. No hype, no exclamation marks, no filler such as "look no further", "world-class", "second to none", "one-stop shop", "dedicated team", "passion for", "exceed your expectations".
- Output a single JSON object and nothing else. No markdown fences, no commentary.`;

function buildFactsPrompt(f, feedback = '') {
  const L = (label, v) => (v && String(v).length ? `${label}: ${v}` : '');
  const tone = require('./grounding').toneText(f.tone);
  const facts = [
    L('Business name', f.name), L('Type of business', f.type), L('Main city', f.city), L('Address', f.address),
    L('Areas served', f.areas && f.areas.join(', ')), L('Years in business (stated by the owner)', f.years),
    L('Credentials the owner states they hold', f.badges && f.badges.join(', ')),
    L('Owner\'s own tagline', f.tagline), L('Owner\'s own story', f.about),
    f.services && f.services.length ? 'Services (use exactly these):\n' + f.services.map((s, i) => `${i + 1}. ${s.name}${s.price ? ` [price given by owner: ${s.price}]` : ''}${s.desc ? ` — ${s.desc}` : ''}`).join('\n') : 'Services: none were provided.',
    f.diffs && f.diffs.length ? 'What sets them apart (owner\'s words):\n' + f.diffs.map(x => `- ${x}`).join('\n') : 'What sets them apart: none were provided.',
    f.faq && f.faq.length ? 'Customer questions with the owner\'s answers:\n' + f.faq.map(x => `Q: ${x.q}\nA: ${x.a}`).join('\n') : 'Customer questions: none were provided.'
  ].filter(Boolean).join('\n');
  return `${facts}
${tone ? `\nTone of voice: ${tone}\n` : ''}${f.design ? `\n${f.design}\n` : ''}${feedback ? `\nYour previous draft was rejected because it contained: ${feedback}. Rewrite without any of that.\n` : ''}
Return JSON with exactly this shape:
{
  "hero": { "headline": "<=60 chars, a clear benefit-led line using only the facts", "subheadline": "<=150 chars, or empty", "ctaText": "<=28 chars, e.g. Request a Quote or Contact Us" },
  "about": "one or two short paragraphs, <=700 chars, built only from the owner's story and facts, or empty",
  "services": [ { "title": "exact title provided", "description": "<=190 chars, or empty", "detail": "" } ],
  "faq": [ { "question": "<=120 chars", "answer": "<=330 chars" } ],
  "seoTitle": "<=60 chars, include the city when one is given",
  "seoDescription": "<=155 chars"
}`;
}

function clean(v, max) {
  return typeof v === 'string' ? v.replace(/\s+\n/g, '\n').trim().slice(0, max) : '';
}

// Pulls the first {...} block out of the model's reply and validates/caps every
// field to the same limits the editor enforces. Returns null if unusable.
function parseCopy(text, opts = {}) {
  if (typeof text !== 'string') return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let raw;
  try { raw = JSON.parse(text.slice(start, end + 1)); } catch { return null; }
  if (!raw || typeof raw !== 'object') return null;

  const hero = {
    headline: clean(raw.hero && raw.hero.headline, 100),
    subheadline: clean(raw.hero && raw.hero.subheadline, 160),
    ctaText: clean(raw.hero && raw.hero.ctaText, 40)
  };
  const about = clean(raw.about, 2000);
  const services = (Array.isArray(raw.services) ? raw.services : [])
    .map(s => ({ title: clean(s && s.title, 60), description: clean(s && s.description, 300), detail: clean(s && s.detail, 1500) }))
    .filter(s => s.title).slice(0, 8);
  const faq = (Array.isArray(raw.faq) ? raw.faq : [])
    .map(f => ({ question: clean(f && f.question, 150), answer: clean(f && f.answer, 500) }))
    .filter(f => f.question && f.answer).slice(0, 8);

  // not enough to build a site from? let the caller fall back to templates
  if (opts.lenient) { if (!hero.headline && !about && !services.length) return null; } // facts-only copy may leave fields empty
  else if (!hero.headline || !hero.subheadline || !about || services.length < 2) return null;
  return {
    hero, about, services, faq,
    seoTitle: clean(raw.seoTitle, 70),
    seoDescription: clean(raw.seoDescription, 160)
  };
}

async function generateCopy(details, instruction = '') {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(process.env.ANTHROPIC_API_URL || DEFAULT_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: 2000,
        system: SYSTEM,
        messages: [{ role: 'user', content: buildPrompt(details, instruction) }]
      }),
      signal: controller.signal
    });
    if (!res.ok) {
      console.error(`AI copy request failed (HTTP ${res.status}); using built-in templates.`);
      return null;
    }
    const data = await res.json();
    const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
    const copy = parseCopy(text);
    if (!copy) console.error('AI copy reply was unusable; using built-in templates.');
    return copy;
  } catch (err) {
    console.error('AI copy request failed:', err.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Facts-only copy for a client questionnaire. Returns null on any failure (callers keep the client's own words).
async function generateGroundedCopy(facts, { feedback = '' } = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(process.env.ANTHROPIC_API_URL || DEFAULT_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: 2000, system: SYSTEM_FACTS, messages: [{ role: 'user', content: buildFactsPrompt(facts, feedback) }] }),
      signal: controller.signal
    });
    if (!res.ok) { console.error(`AI copy request failed (HTTP ${res.status}); using the client's own words.`); return null; }
    const data = await res.json();
    const copy = parseCopy((data.content || []).filter(c => c.type === 'text').map(c => c.text).join(''), { lenient: true });
    if (!copy) console.error('AI copy reply was unusable; using the client\'s own words.');
    return copy;
  } catch (err) {
    console.error('AI copy request failed:', err.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Generic one-shot call used by chat-to-edit. Returns the reply text, or null on any failure.
// content: a list of content blocks (a PDF document plus text, say) in place of a plain prompt
async function complete({ system, prompt, content, maxTokens = 1500 }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(process.env.ANTHROPIC_API_URL || DEFAULT_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: maxTokens, system, messages: [{ role: 'user', content: content || prompt }] }),
      signal: controller.signal
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  } catch (err) {
    console.error('AI request failed:', err.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { hasAiProvider, generateCopy, generateGroundedCopy, parseCopy, buildPrompt, buildFactsPrompt, SYSTEM_FACTS, complete };
