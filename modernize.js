// "Modernize an existing website", the smarter version (Leo, 2026-11-25: "it overall creates a generic site").
//
// The old importer read only the home page, guessed services from any heading, made up 9-to-5 hours and gave every
// site the same look. This module reads what makes the business itself, so the new site keeps it:
//   crawl()          the home page plus up to 6 inner pages it links to (About, Services, Reviews, Gallery, Contact, FAQ)
//   extractPage()    one page's real details: schema.org business data, services (menu dropdown, services page), the
//                    owner's story, reviews, FAQ, opening hours, social links, the phrases that set them apart
//                    ("family owned since 1998"), every photo with a score, and the page's own colors and fonts
//   brandFromCss()   the colors the old site really uses (weighted by where they are used) and its fonts
//   rankPhotos()     large real photos first; logos, icons, badges and spinners left out; size variants merged
//   personality()    which of our looks is closest to the old site (dark or light, serif or bold, calm or bright...)
//                    with the reasons, and 3 others to try
//   report()         what was found and what is still a placeholder, shown in the editor (sections.meta.import)
// Nothing is made up: reviews, hours, FAQ and badges come only from the old site's own words; anything not found is
// left empty and listed in the report.
const cheerio = require('cheerio');
const scraper = require('./scraper');

const MAX_HTML = 2_500_000;
const MAX_CSS = 400_000;

// ---------- small helpers ----------
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const uniq = (arr) => [...new Set(arr.filter(Boolean))];
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./i, '').toLowerCase(); } catch { return ''; } };
const abs = (base, u) => scraper.absolutize(base, u);
const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function hexOf(c) {
  c = String(c || '').trim().toLowerCase();
  let m = c.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map(x => x + x).join('');
    else if (h.length === 8) { if (parseInt(h.slice(6), 16) < 128) return null; h = h.slice(0, 6); }
    else if (h.length !== 6) return null;
    return '#' + h;
  }
  m = c.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:[\s,/]+([\d.]+%?))?\s*\)$/);
  if (m) {
    if (m[4] != null) { const a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]); if (a < 0.5) return null; }
    return '#' + [m[1], m[2], m[3]].map(v => Math.min(255, +v).toString(16).padStart(2, '0')).join('');
  }
  return null;
}
function hsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}
const isNeutral = (hex) => { const { s, l } = hsl(hex); return s < 0.18 || l > 0.93 || l < 0.08; };
function colorDist(a, b) {
  const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16);
  return Math.hypot(((p >> 16) & 255) - ((q >> 16) & 255), ((p >> 8) & 255) - ((q >> 8) & 255), (p & 255) - (q & 255));
}

// ---------- fetching ----------
async function fetchHtml(url, { render = false } = {}) {
  const { response, finalUrl } = await scraper.safeFetch(url);
  if (!response.ok) throw new Error(`That URL responded with status ${response.status}.`);
  if (!(response.headers.get('content-type') || '').includes('text/html')) throw new Error('That URL does not appear to be a webpage (not HTML).');
  let html = (await response.text()).slice(0, MAX_HTML);
  if (render) {   // a JavaScript-built page (an app shell): use the rendered page when Playwright is installed
    const plain = scraper.parseFromHtml(html, finalUrl);
    if (plain.signalStrength < 200) {
      try { const r = await scraper.renderWithPlaywright(finalUrl); if (r && r.length > html.length) html = r.slice(0, MAX_HTML); } catch { /* keep the plain page */ }
    }
  }
  return { html, finalUrl };
}
async function fetchCss(url) {
  try {
    const { response } = await scraper.safeFetch(url, { timeoutMs: 8000 });
    if (!response.ok) return '';
    const type = response.headers.get('content-type') || '';
    if (type && !/css|text\/plain/.test(type)) return '';
    return (await response.text()).slice(0, MAX_CSS);
  } catch { return ''; }
}

// ---------- schema.org business data (JSON-LD) ----------
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_CODES = { mo: 0, tu: 1, we: 2, th: 3, fr: 4, sa: 5, su: 6 };
function jsonLd($) {
  const nodes = [];
  const walk = (o, depth) => {
    if (!o || typeof o !== 'object' || depth > 6) return;
    if (Array.isArray(o)) { o.forEach(x => walk(x, depth + 1)); return; }
    nodes.push(o);
    if (o['@graph']) walk(o['@graph'], depth + 1);
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    try { walk(JSON.parse($(el).contents().text()), 0); } catch { /* broken JSON-LD is common: skip it */ }
  });
  const typeOf = (n) => [].concat(n['@type'] || []).join(' ').toLowerCase();
  const biz = nodes.find(n => /business|store|restaurant|service|contractor|salon|clinic|dentist|attorney|plumber|electrician|roofing|cafe|bakery|spa|gym|agent|shop|practice|center|hotel|organization|corporation|professional/.test(typeOf(n)) && (n.name || n.telephone || n.address));
  const out = { name: '', telephone: '', email: '', address: '', hours: [], sameAs: [], logo: '', images: [], description: '', slogan: '', reviews: [], faq: [], services: [] };
  if (biz) {
    out.name = clean(biz.name).slice(0, 80);
    out.telephone = clean(biz.telephone).slice(0, 40);
    out.email = clean(String(biz.email || '').replace(/^mailto:/i, '')).slice(0, 120);
    const a = biz.address;
    if (typeof a === 'string') out.address = clean(a).slice(0, 160);
    else if (a && typeof a === 'object') {
      const one = Array.isArray(a) ? a[0] : a;
      out.address = clean([one.streetAddress, one.addressLocality, [one.addressRegion, one.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ')).slice(0, 160);
    }
    out.sameAs = [].concat(biz.sameAs || []).filter(x => typeof x === 'string');
    const lg = biz.logo; out.logo = typeof lg === 'string' ? lg : (lg && (lg.url || lg.contentUrl)) || '';
    out.images = [].concat(biz.image || []).map(x => (typeof x === 'string' ? x : x && (x.url || x.contentUrl))).filter(Boolean);
    out.description = clean(biz.description).slice(0, 600);
    out.slogan = clean(biz.slogan).slice(0, 160);
    out.hours = hoursFromSchema(biz);
    [].concat(biz.review || []).forEach(r => {
      const quote = clean(r && (r.reviewBody || r.description));
      const author = clean(r && r.author && (typeof r.author === 'string' ? r.author : r.author.name));
      if (quote.length >= 15 && quote.length <= 600) out.reviews.push({ quote, author: author.slice(0, 60) });
    });
    const cat = biz.hasOfferCatalog;
    const items = cat ? [].concat(cat.itemListElement || []) : [];
    items.forEach(it => {
      const o = it && (it.itemOffered || it);
      const name = clean(o && o.name);
      if (name && name.length <= 60) out.services.push({ title: name, description: clean(o.description).slice(0, 200) });
    });
  }
  nodes.filter(n => /faqpage/.test(typeOf(n))).forEach(f => {
    [].concat(f.mainEntity || []).forEach(q => {
      const question = clean(q && q.name), answer = clean(q && q.acceptedAnswer && q.acceptedAnswer.text && cheerio.load(String(q.acceptedAnswer.text)).text());
      if (question && answer) out.faq.push({ question: question.slice(0, 150), answer: answer.slice(0, 400) });
    });
  });
  return out;
}
function to12(t) {
  const m = String(t || '').match(/^(\d{1,2}):?(\d{2})?/);
  if (!m) return '';
  let h = +m[1]; const min = m[2] || '00';
  if (h > 24) return '';
  const ap = h >= 12 && h < 24 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${min} ${ap}`;
}
function hoursFromSchema(biz) {
  const week = new Array(7).fill(null);
  [].concat(biz.openingHoursSpecification || []).forEach(sp => {
    if (!sp) return;
    const open = to12(sp.opens), close = to12(sp.closes);
    [].concat(sp.dayOfWeek || []).forEach(d => {
      const i = DAY_NAMES.findIndex(n => String(d).toLowerCase().endsWith(n.toLowerCase()));
      if (i >= 0 && open && close && !week[i]) week[i] = open === close ? 'Closed' : `${open} – ${close}`;
    });
  });
  [].concat(biz.openingHours || []).forEach(line => {   // "Mo-Fr 08:00-17:00", "Sa 09:00-12:00"
    const m = String(line).match(/^([A-Za-z,\- ]+)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if (!m) return;
    const time = `${to12(m[2])} – ${to12(m[3])}`;
    m[1].split(',').forEach(part => {
      const [a, b] = part.trim().toLowerCase().split('-').map(x => DAY_CODES[x.trim().slice(0, 2)]);
      if (a == null) return;
      for (let i = a; i <= (b == null ? a : b); i++) if (!week[i]) week[i] = time;
    });
  });
  if (!week.some(Boolean)) return [];
  return DAY_NAMES.map((day, i) => ({ day, time: week[i] || 'Closed' }));
}

// ---------- opening hours written as text ----------
const DAY_RE = '(mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)';
const TIME_RE = '(\\d{1,2}(?::\\d{2})?\\s*(?:[ap]\\.?m\\.?)?|noon|midnight)';
function dayIndex(word) { return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].indexOf(String(word).toLowerCase().slice(0, 3)); }
function niceTime(t, other) {
  t = String(t).toLowerCase().replace(/\./g, '').replace(/\s+/g, '');
  if (t === 'noon') return '12:00 PM';
  if (t === 'midnight') return '12:00 AM';
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
  if (!m) return '';
  let h = +m[1]; const min = m[2] || '00';
  let ap = m[3] ? m[3].toUpperCase() : '';
  if (!ap && h > 12 && h <= 24) { ap = h >= 12 && h < 24 ? 'PM' : 'AM'; h = h % 12 || 12; }
  if (!ap) ap = other === 'open' ? (h >= 6 && h <= 11 ? 'AM' : 'PM') : (h >= 1 && h <= 11 ? 'PM' : 'AM');   // "8-5": 8 AM to 5 PM
  if (h > 12) return '';
  return `${h}:${min} ${ap}`;
}
function hoursFromText(text) {
  const week = new Array(7).fill(null);
  const re = new RegExp(`\\b${DAY_RE}\\b\\.?(?:\\s*(?:-|–|—|to|through|thru)\\s*\\b${DAY_RE}\\b\\.?)?\\s*:?\\s*(?:${TIME_RE}\\s*(?:-|–|—|to)\\s*${TIME_RE}|(closed|by appointment(?: only)?))`, 'gi');
  let m, found = 0;
  const s = String(text || '').slice(0, 200000);
  while ((m = re.exec(s))) {
    const a = dayIndex(m[1]), b = m[2] ? dayIndex(m[2]) : a;
    if (a < 0 || b < 0) continue;
    let time;
    if (m[5]) time = /closed/i.test(m[5]) ? 'Closed' : 'By appointment';
    else {
      const o = niceTime(m[3], 'open'), c = niceTime(m[4], 'close');
      if (!o || !c) continue;
      time = `${o} – ${c}`;
    }
    const days = b >= a ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a];
    days.forEach(i => { if (!week[i]) { week[i] = time; found++; } });
  }
  if (found < 2) return [];   // one stray "Monday" is not a timetable
  return DAY_NAMES.map((day, i) => ({ day, time: week[i] || 'Closed' }));
}

// ---------- the phrases that set the business apart (their own words) ----------
const APART_RE = /\b(family[- ](?:owned|run|operated)|locally[- ](?:owned|operated)|(?:veteran|woman|women|minority|black)[- ]owned|since (?:19|20)\d\d|established (?:in )?(?:19|20)\d\d|est\.? (?:19|20)\d\d|\d{1,3}\+? years|over (?:\d{1,3}|a decade|\w+ decades)|generations?|hand[- ]?(?:made|crafted)|from scratch|award[- ]winning|licensed|insured|bonded|certified|guarantee[ds]?|warrant(?:y|ies)|free (?:estimates?|quotes?|consultations?)|24\/7|emergency service|organic|locally sourced|our (?:own|secret|signature|famous)|specializ(?:e|es|ing) in|the only)\b/i;
const JUNK_RE = /cookie|privacy|copyright|all rights reserved|javascript|subscribe|newsletter|sign up|log ?in|cart|wordpress|powered by|click here|loading/i;
function apartPhrases(texts) {
  const out = [];
  for (const t of texts) {
    for (const sentence of String(t).split(/(?<=[.!?])\s+/)) {
      const s = clean(sentence);
      if (s.length < 15 || s.length > 180 || JUNK_RE.test(s) || !APART_RE.test(s)) continue;
      if (!out.some(x => x.toLowerCase() === s.toLowerCase())) out.push(s);
      if (out.length >= 8) return out;
    }
  }
  return out;
}
// short badges from those phrases: "Family owned", "Since 1998", "Licensed & insured"
function badgesFrom(phrases) {
  const text = phrases.join(' ');
  const out = [];
  let m;
  if ((m = text.match(/\b(family|locally|veteran|woman|women|minority|black)[- ](owned|run|operated)\b/i))) out.push(capFirst(`${m[1].toLowerCase()} ${m[2].toLowerCase()}`));
  if ((m = text.match(/\b(?:since|established(?: in)?|est\.?)\s+((?:19|20)\d\d)\b/i))) out.push(`Since ${m[1]}`);
  const cred = ['licensed', 'insured', 'bonded'].filter(w => new RegExp(`\\b${w}\\b`, 'i').test(text));
  if (cred.length) out.push(capFirst(cred.length > 1 ? cred.slice(0, -1).join(', ') + ' & ' + cred.slice(-1) : cred[0]));
  if (/\baward[- ]winning\b/i.test(text)) out.push('Award winning');
  if (/\bhand[- ]?(?:made|crafted)\b/i.test(text)) out.push('Handmade');
  if (/\borganic\b/i.test(text)) out.push('Organic');
  return uniq(out).slice(0, 5);
}

// ---------- page parts ----------
const SKIP_HEADINGS = /^(welcome|home|about|about us|our story|contact|contact us|get in touch|call us|menu|hours|opening hours|location|locations|find us|testimonials?|reviews?|what (?:our|people) (?:customers|clients) say|gallery|photos|portfolio|faqs?|frequently asked questions|follow us|quick links|links|our services|services|what we do|why choose us|why us|our team|meet the team|blog|news|latest news|recent posts|categories|archives|search|newsletter|subscribe|privacy policy|terms|social|connect with us|useful links|navigation|book now|request a quote|get a quote|learn more|read more|our work|specials|careers)$/i;
function serviceItems($, scope) {
  const items = [];
  const add = (title, description) => {
    title = clean(title).replace(/[:–—-]+$/, '').trim();
    if (!title || title.length < 3 || title.length > 60 || /[?!]$/.test(title) || SKIP_HEADINGS.test(title) || JUNK_RE.test(title)) return;
    if (/^\(?\d|@|https?:/.test(title)) return;
    if (items.some(i => i.title.toLowerCase() === title.toLowerCase())) return;
    items.push({ title, description: clean(description).slice(0, 200) });
  };
  // 1. the menu's Services dropdown is the owner's own list
  $('nav li, header li, .menu li').each((_, li) => {
    const $li = $(li);
    const label = clean($li.children('a').first().text());
    if (!/^(our )?(services|what we do|treatments|solutions|offerings|products)\b/i.test(label)) return;
    $li.find('ul a, .sub-menu a, .dropdown-menu a').each((__, a) => add($(a).text(), ''));
  });
  // 2. headings on the page with the text that follows them
  $(scope || 'body').find('h2, h3, h4').each((_, el) => {
    const $el = $(el);
    if ($el.parents('nav, header, footer, aside, form').length) return;
    let desc = '';
    const $next = $el.nextAll('p').first();
    if ($next.length) desc = $next.text();
    else desc = $el.parent().find('p').first().text();
    add($el.text(), desc);
  });
  return items.slice(0, 10);
}
function storyParagraphs($) {
  const out = [];
  $('main p, article p, section p, .content p, #content p, body p').each((_, el) => {
    const $el = $(el);
    if ($el.parents('nav, header, footer, aside, form, blockquote, [class*="testimonial"], [class*="review"]').length) return;
    const t = clean($el.text());
    if (t.length < 60 || t.length > 1200 || JUNK_RE.test(t)) return;
    if (!out.includes(t)) out.push(t);
  });
  return out;
}
function reviewsOf($) {
  const out = [];
  const push = (quote, author) => {
    quote = clean(quote).replace(/^["“”']+|["“”']+$/g, '').trim();
    author = clean(author).replace(/^[-–—~]\s*/, '').slice(0, 60);
    if (quote.length < 25 || quote.length > 600 || /write a review|leave a review|reviews? on (google|yelp|facebook)|based on \d+ reviews|out of 5|rated \d/i.test(quote)) return;
    if (out.some(r => r.quote === quote)) return;
    out.push({ quote, author: author.length > 1 && author.length < 60 && !/review|testimonial|\d{4}/i.test(author) ? author : '' });
  };
  $('blockquote').each((_, el) => {
    const $el = $(el);
    const cite = clean($el.find('cite, footer, .author, .name').first().text());
    let q = clean($el.clone().find('cite, footer, .author, .name').remove().end().text());
    if (!cite) { const next = clean($el.next().text()); push(q, next.length < 60 ? next : ''); } else push(q, cite);
  });
  $('[class*="testimonial"], [class*="review"], [id*="testimonial"]').each((_, el) => {
    const $el = $(el);
    if ($el.find('[class*="testimonial"], [class*="review"]').length || $el.parents('blockquote').length || $el.is('blockquote')) return;   // leaves only
    const author = clean($el.find('cite, .author, .name, [class*="author"], [class*="name"], strong, h4, h5, h6').first().text());
    const quote = clean($el.find('p').map((__, p) => $(p).text()).get().join(' ')) || clean($el.text());
    push(author && quote.endsWith(author) ? quote.slice(0, -author.length) : quote, author);
  });
  return out.slice(0, 8);
}
function faqOf($) {
  const out = [];
  const push = (q, a) => { q = clean(q); a = clean(a); if (q.endsWith('?') && q.length <= 150 && a.length >= 3 && !out.some(x => x.question === q)) out.push({ question: q, answer: a.slice(0, 400) }); };
  $('details').each((_, el) => { const $el = $(el); const q = $el.children('summary').text(); push(q, $el.clone().children('summary').remove().end().text()); });
  $('dt').each((_, el) => push($(el).text(), $(el).next('dd').text()));
  $('h2, h3, h4, h5, button, strong').each((_, el) => {
    const $el = $(el);
    const q = clean($el.text());
    if (!q.endsWith('?')) return;
    let a = $el.nextAll('p, div').first().text();
    if (!clean(a)) a = $el.parent().nextAll('div, p').first().text();
    push(q, a);
  });
  return out.slice(0, 10);
}
const SOCIAL = [['facebook', /facebook\.com\//i], ['instagram', /instagram\.com\//i], ['twitter', /(?:twitter|x)\.com\//i], ['tiktok', /tiktok\.com\//i], ['youtube', /youtube\.com\/|youtu\.be\//i], ['linkedin', /linkedin\.com\//i], ['yelp', /yelp\.com\/biz\//i]];
function socialsOf($, extra) {
  const out = {};
  const hrefs = $('a[href]').map((_, a) => $(a).attr('href')).get().concat(extra || []);
  for (const h of hrefs) {
    if (!/^https?:\/\//i.test(h) || /sharer|share\?|intent\/tweet|\/plugins\/|dialog\//i.test(h)) continue;
    for (const [k, re] of SOCIAL) if (!out[k] && re.test(h)) out[k] = h.slice(0, 300);
  }
  return out;
}

// ---------- photos ----------
const NOT_PHOTO = /icon|logo|sprite|spacer|pixel|favicon|badge|button|arrow|avatar|loader|loading|spinner|placeholder|blank\.|social|facebook|instagram|twitter|yelp|google-?review|tripadvisor|bbb|angi|homeadvisor|visa|mastercard|amex|paypal|payment|stars?[-_.]|rating|emoji|flag|captcha|gravatar|wp-includes|map-?marker|pin\.|1x1|transparent/i;
const STOCK_COMP = /shutterstock|istockphoto|gettyimages|depositphotos|dreamstime|123rf|alamy|bigstock/i;
function photoKey(u) {
  return String(u).toLowerCase().replace(/[?#].*$/, '').replace(/\/v1\/.*$/, '').replace(/-\d{2,4}x\d{2,4}(?=\.\w+$)/, '').replace(/(@2x|-scaled|-e\d{10,})(?=\.\w+$)/, '').replace(/\/(?:w|h)_\d+[^/]*\//, '/');
}
// Wix and Squarespace serve resized copies: ask for the original
function fullSize(u) {
  let x = String(u);
  x = x.replace(/^(https?:\/\/static\.wixstatic\.com\/media\/[^/]+)\/v1\/.*$/i, '$1');
  if (/squarespace-cdn\.com/i.test(x)) x = x.replace(/\?format=\w+$/i, '?format=1500w');
  return x;
}
function biggestFromSrcset(srcset) {
  let best = null, bw = 0;
  String(srcset || '').split(',').forEach(part => {
    const [u, d] = part.trim().split(/\s+/);
    const w = d && /w$/.test(d) ? parseInt(d, 10) : d && /x$/.test(d) ? parseFloat(d) * 1000 : 1;
    if (u && w >= bw) { best = u; bw = w; }
  });
  return { url: best, width: bw > 10 ? bw : 0 };
}
function photoCandidates($, baseUrl, cssText) {
  const out = [];
  const push = (raw, score, alt, why) => {
    if (!raw || /^data:/i.test(raw)) return;
    const url = abs(baseUrl, raw);
    if (!url || !/^https?:/i.test(url)) return;
    const path = url.toLowerCase().replace(/[?#].*$/, '');
    if (/\.(svg|gif|ico)$/.test(path) || NOT_PHOTO.test(path.split('/').slice(-2).join('/'))) return;
    let s = score;
    if (/\.png$/.test(path)) s -= 0.5;
    if (STOCK_COMP.test(url)) s -= 2;
    if (alt) s += 0.5;
    out.push({ url: fullSize(url), score: s, alt: clean(alt).slice(0, 120), why });
  };
  $('img, source').each((_, el) => {
    const $el = $(el);
    if ($el.parents('nav, footer, [class*="logo"], [class*="icon"], [class*="partner"], [class*="sponsor"], [class*="badge"]').length) return;
    const set = biggestFromSrcset($el.attr('srcset') || $el.attr('data-srcset'));
    const src = $el.attr('data-src') || $el.attr('data-lazy-src') || $el.attr('data-original') || set.url || $el.attr('src');
    const w = parseInt($el.attr('width') || '0', 10) || set.width, h = parseInt($el.attr('height') || '0', 10);
    if ((w && w < 150) || (h && h < 120)) return;
    let s = 1;
    if (w >= 900) s += 3; else if (w >= 500) s += 2; else if (w >= 300) s += 1;
    if ($el.closest('[class*="hero"], [class*="banner"], [class*="slide"], [class*="carousel"], [class*="masthead"], [class*="jumbotron"]').length) s += 2;
    if ($el.closest('[class*="gallery"], [class*="portfolio"], [class*="project"], [class*="work"]').length) s += 1;
    push(src, s, $el.attr('alt'), 'img');
  });
  $('[style*="background"]').each((_, el) => {
    const m = String($(el).attr('style')).match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/i);
    if (m) push(m[1], 3, '', 'background');
  });
  // CSS rules that put a photo behind a hero or banner
  const re = /([^{}]{1,300})\{[^{}]*background(?:-image)?\s*:[^;{}]*url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
  let m;
  const css = String(cssText || '').slice(0, 600000);
  while ((m = re.exec(css))) {
    const sel = m[1].toLowerCase();
    if (/hero|banner|header|slide|masthead|cover|intro|parallax|jumbotron|top-section/.test(sel)) push(m[2], 3.5, '', 'css');
  }
  const og = $('meta[property="og:image"]').attr('content');
  if (og) push(og, 2.5, '', 'og');
  return out;
}
function rankPhotos(cands, exclude = []) {
  const ex = new Set(exclude.filter(Boolean).map(photoKey));
  const byKey = new Map();
  for (const c of cands) {
    const k = photoKey(c.url);
    if (ex.has(k)) continue;
    const old = byKey.get(k);
    if (!old) byKey.set(k, { ...c, seen: 1 });
    else {
      old.seen++;
      const plainer = c.url.length < old.url.length && c.score >= old.score - 1;   // the original over a resized copy
      if (c.score > old.score || plainer) Object.assign(old, { url: c.url, score: Math.max(c.score, old.score), alt: c.alt || old.alt });
    }
  }
  return [...byKey.values()].map(c => ({ ...c, score: c.score + Math.min(c.seen - 1, 2) * 0.5 }))
    .sort((a, b) => b.score - a.score).slice(0, 24);
}

// ---------- colors and fonts from the old site's CSS ----------
// framework defaults that say nothing about the brand
const FRAMEWORK_COLORS = new Set(['#007bff', '#0d6efd', '#0073aa', '#21759b', '#6ec1e4', '#61ce70', '#54595f', '#7a7a7a', '#337ab7', '#428bca', '#5cb85c', '#d9534f', '#f0ad4e', '#5bc0de', '#17a2b8', '#28a745', '#dc3545', '#ffc107', '#6c757d', '#198754', '#0dcaf0', '#2271b1', '#3858e9', '#cf2e2e', '#ff6900', '#fcb900', '#7bdcb5', '#00d084', '#8ed1fc', '#0693e3', '#abb8c3', '#eb144c', '#f78da7', '#9b51e0', '#32373c', '#1e73be', '#dd3333', '#dd9933', '#eeee22', '#81d742', '#8224e3', '#3a3a3a', '#4054b2', '#23a455']);
const GENERIC_FONTS = /^(inherit|initial|unset|sans-serif|serif|monospace|cursive|fantasy|system-ui|-apple-system|blinkmacsystemfont|segoe ui|roboto|helvetica neue|helvetica|arial|verdana|tahoma|times new roman|times|georgia|courier new|courier|ui-sans-serif|ui-serif|apple color emoji|segoe ui emoji|segoe ui symbol|noto color emoji|var\(.*)$/i;
const ICON_FONTS = /awesome|icon|glyph|dashicons|material|eicons|fontello|ionicons|themify|linearicons|elegant|et-|wpzoom|socicon|genericons|star|slick|revicons|swiper/i;
const SERIF_FONTS = /serif|playfair|merriweather|lora|garamond|baskerville|cormorant|crimson|libre caslon|caslon|bodoni|didot|prata|cinzel|dm serif|frank ruhl|spectral|abril|bitter|noto serif|pt serif|source serif|eb garamond|cardo|old standard|vollkorn|marcellus|gilda|forum|italiana|times|georgia|bellefair|yeseva/i;
const SCRIPT_FONTS = /script|pacifico|dancing|great vibes|lobster|satisfy|allura|parisienne|sacramento|cookie|kaushan|amatic|caveat|shadows into light|indie flower|homemade apple|tangerine|alex brush|pinyon|yellowtail|courgette|handlee|marck/i;
const DISPLAY_FONTS = /oswald|anton|bebas|archivo black|league gothic|teko|fjalla|passion one|alfa slab|bangers|black ops|russo|staatliches|big shoulders|barlow condensed|saira condensed|righteous|bungee/i;
function fontKind(name) {
  if (!name) return 'sans';
  if (SCRIPT_FONTS.test(name)) return 'script';
  if (/sans/i.test(name)) return DISPLAY_FONTS.test(name) ? 'display' : 'sans';
  if (SERIF_FONTS.test(name)) return 'serif';
  if (DISPLAY_FONTS.test(name)) return 'display';
  return 'sans';
}
function googleFamilies($) {
  const out = [];
  $('link[href*="fonts.googleapis.com"]').each((_, el) => {
    let u; try { u = new URL(abs('https://x.invalid/', $(el).attr('href'))); } catch { return; }
    u.searchParams.getAll('family').forEach(f => f.split('|').forEach(one => out.push(clean(one.split(':')[0].replace(/\+/g, ' ')))));
  });
  return uniq(out).filter(f => !ICON_FONTS.test(f));
}
function brandFromCss(cssText, { googleFonts = [] } = {}) {
  const css = String(cssText || '').replace(/\/\*[\s\S]*?\*\//g, '').slice(0, 1_500_000);
  const colors = new Map();
  const fonts = new Map();   // name -> { n, heading, body }
  let darkBg = 0, lightBg = 0;
  const addColor = (hex, w) => {
    if (!hex || FRAMEWORK_COLORS.has(hex)) return;
    if (isNeutral(hex)) return;
    for (const [k, v] of colors) if (colorDist(k, hex) < 28) { v.w += w; v.n++; return; }
    colors.set(hex, { w, n: 1 });
  };
  const rule = /([^{}@]{1,400})\{([^{}]*)\}/g;
  let m;
  while ((m = rule.exec(css))) {
    const sel = m[1].trim().toLowerCase();
    if (/:root|^\s*\*|::selection|:hover|:focus|:active|:visited|wp-block|has-[a-z-]+-color|has-[a-z-]+-background/.test(sel)) continue;   // theme presets and hover states are not the look
    const body = m[2];
    const decl = /(^|;)\s*([a-z-]+)\s*:\s*([^;]+)/gi;
    let d;
    while ((d = decl.exec(body))) {
      const prop = d[2].toLowerCase(), val = d[3];
      if (prop === 'font-family') {
        const first = clean(val.split(',')[0].replace(/['"]/g, '').replace(/!important/i, ''));
        if (!first || GENERIC_FONTS.test(first) || ICON_FONTS.test(first) || first.length > 40) continue;
        const f = fonts.get(first) || { n: 0, heading: 0, body: 0 };
        f.n++;
        if (/\bh[1-3]\b|title|heading|headline|hero|display|logo|brand/.test(sel)) f.heading++;
        if (/(^|[\s,])(body|html|p)([\s,.:#[]|$)/.test(sel)) f.body++;
        fonts.set(first, f);
        continue;
      }
      if (!/color|background|border|fill|stroke/.test(prop)) continue;
      const found = val.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi) || [];
      for (const c of found) {
        const hex = hexOf(c);
        if (!hex) continue;
        if ((prop === 'background' || prop === 'background-color') && /(^|[\s,])(body|html)([\s,.:#[]|$)|#page|#wrapper|\.site\b|main\b/.test(sel)) {
          if (hsl(hex).l < 0.22) darkBg += 3; else if (hsl(hex).l > 0.85) lightBg += 3;
        }
        let w = 1;
        if (/background/.test(prop)) w = 3;
        if (/\b(btn|button|cta|primary|accent|brand|header|nav|menu|hero|banner|footer)\b|\.button|button/.test(sel)) w += 2;
        if (/\bh[1-3]\b|title|heading/.test(sel)) w += 1;
        addColor(hex, w);
      }
    }
  }
  const ranked = [...colors.entries()].sort((a, b) => b[1].w - a[1].w).map(([hex, v]) => ({ hex, weight: v.w }));
  const fontList = [...fonts.entries()].sort((a, b) => b[1].n - a[1].n);
  const inGoogle = (n) => googleFonts.some(g => g.toLowerCase() === n.toLowerCase());
  let heading = (fontList.filter(([, v]) => v.heading).sort((a, b) => b[1].heading - a[1].heading)[0] || [])[0] || '';
  let body = (fontList.filter(([, v]) => v.body).sort((a, b) => b[1].body - a[1].body)[0] || fontList[0] || [])[0] || '';
  if (!heading && googleFonts.length) heading = googleFonts[0];
  if (!body && googleFonts.length) body = googleFonts[googleFonts.length > 1 ? 1 : 0];
  if (!heading) heading = body;
  return {
    colors: ranked.slice(0, 6),
    dark: darkBg > lightBg && darkBg > 0,
    fonts: { heading, body, headingGoogle: heading ? inGoogle(heading) : false, bodyGoogle: body ? inGoogle(body) : false, all: uniq([...googleFonts, ...fontList.map(f => f[0])]).slice(0, 6) }
  };
}

// ---------- one page ----------
function extractPage(html, url) {
  const $ = cheerio.load(html);
  const basic = scraper.parseFromHtml(html, url);
  const ld = jsonLd($);
  const inlineCss = $('style').map((_, el) => $(el).html()).get().join('\n') + '\n' + $('[style]').map((_, el) => `x{${$(el).attr('style')}}`).get().join('\n');
  const stylesheets = $('link[rel~="stylesheet"][href]').map((_, el) => abs(url, $(el).attr('href'))).get()
    .filter(h => h && /^https?:/i.test(h) && !/fonts\.googleapis|font-?awesome|bootstrap(\.min)?\.css|jquery|wp-includes|block-library|elementor-icons|dashicons|animate(\.min)?\.css|slick|swiper|owl\.carousel|magnific|fancybox|lightbox|cookie|recaptcha|gstatic|cdnjs|jsdelivr|unpkg/i.test(h));
  const links = [];
  const home = host(url);
  $('a[href]').each((_, a) => {
    const href = abs(url, $(a).attr('href'));
    if (!href || host(href) !== home || /^(mailto|tel):/i.test(href) || /\.(pdf|jpe?g|png|gif|webp|zip|docx?)$/i.test(href.replace(/[?#].*$/, ''))) return;
    links.push({ href: href.replace(/#.*$/, ''), text: clean($(a).text()).slice(0, 60) });
  });
  const bodyText = clean($('body').text());
  const textBlocks = $('h1, h2, h3, p, li').map((_, el) => ($(el).parents('nav, footer, script, style').length ? '' : clean($(el).text()))).get().filter(t => t.length > 15);
  const hero = clean($('h1').first().text());
  const tagCands = [ld.slogan, clean($('h1').first().nextAll('p, h2, h3').first().text()), basic.sections.hero.subheadline].filter(t => t && t.length >= 10 && t.length <= 160 && !JUNK_RE.test(t));
  return {
    url, title: clean($('title').first().text()),
    name: ld.name || basic.name, ld,
    h1: hero && hero.length > 2 && hero.length < 120 ? hero : '',
    tagline: tagCands[0] || '',
    metaDescription: clean($('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content')),
    themeColor: scraper.pickThemeColor($),
    logo: abs(url, ld.logo) || basic.theme.logoUrl || abs(url, $('link[rel="apple-touch-icon"]').attr('href')) || '',
    phone: ld.telephone || basic.sections.contact.phone,
    email: ld.email || basic.sections.contact.email,
    address: ld.address || basic.sections.contact.address,
    services: ld.services.length ? ld.services : serviceItems($),
    story: storyParagraphs($),
    reviews: ld.reviews.concat(reviewsOf($)),
    faq: ld.faq.length ? ld.faq : faqOf($),
    hours: ld.hours.length ? ld.hours : hoursFromText(bodyText),
    social: socialsOf($, ld.sameAs),
    photos: photoCandidates($, url, inlineCss).concat(ld.images.map(u => ({ url: abs(url, u), score: 2.5, alt: '', why: 'schema' })).filter(p => p.url)),
    inlineCss, stylesheets, googleFonts: googleFamilies($),
    links, textBlocks, words: bodyText.length
  };
}

// ---------- which inner pages to read ----------
const PAGE_KINDS = [
  ['about', /about|our-?story|who-?we-?are|our-?team|history|meet/i],
  ['services', /services?|what-?we-?do|treatments|menu|pricing|prices|offerings|solutions/i],
  ['reviews', /reviews?|testimonials?/i],
  ['gallery', /gallery|portfolio|our-?work|projects|photos/i],
  ['contact', /contact|location|hours|find-?us|visit/i],
  ['faq', /faqs?|questions/i]
];
function innerPages(page, max = 6) {
  const out = [];
  const seen = new Set([page.url.replace(/\/$/, '')]);
  for (const [kind, re] of PAGE_KINDS) {
    const hit = page.links.find(l => {
      const path = (() => { try { return new URL(l.href).pathname; } catch { return ''; } })();
      return path.length > 1 && (re.test(path) || re.test(l.text.replace(/\s+/g, '-'))) && !seen.has(l.href.replace(/\/$/, ''));
    });
    if (hit) { seen.add(hit.href.replace(/\/$/, '')); out.push({ kind, url: hit.href }); }
    if (out.length >= max) break;
  }
  return out;
}

// ---------- the whole site ----------
// fetchPage(url, { render }) -> { html, finalUrl } (the real fetcher by default; tests pass their own)
async function crawl(rawUrl, { fetchPage = fetchHtml, fetchStyles = fetchCss, maxPages = 6 } = {}) {
  let url = String(rawUrl || '').trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try { new URL(url); } catch { throw new Error('That doesn\'t look like a valid URL.'); }
  const first = await fetchPage(url, { render: true });
  const home = extractPage(first.html, first.finalUrl);
  const targets = innerPages(home, maxPages);
  const settled = await Promise.allSettled(targets.map(t => fetchPage(t.url, {}).then(r => ({ kind: t.kind, page: extractPage(r.html, r.finalUrl) }))));
  const inner = settled.filter(s => s.status === 'fulfilled').map(s => s.value);
  const sheets = uniq([home, ...inner.map(i => i.page)].flatMap(p => p.stylesheets)).slice(0, 4);
  const cssTexts = await Promise.all(sheets.map(s => fetchStyles(s).catch(() => '')));
  return merge(home, inner, cssTexts.join('\n'));
}

function merge(home, inner, linkedCss) {
  const of = (kind) => (inner.find(i => i.kind === kind) || {}).page;
  const pages = [home, ...inner.map(i => i.page)];
  const about = of('about'), servicesPage = of('services'), reviewsPage = of('reviews'), contactPage = of('contact'), faqPage = of('faq');
  const firstOf = (key) => pages.map(p => p[key]).find(v => v && (!Array.isArray(v) || v.length)) || (Array.isArray(home[key]) ? [] : '');
  // services: the owner's own list (schema, menu, services page) before headings on the home page
  let services = [];
  for (const p of [servicesPage, home, ...pages].filter(Boolean)) {
    for (const s of p.services) if (!services.some(x => x.title.toLowerCase() === s.title.toLowerCase())) services.push(s);
    if (services.length >= 3 && p === servicesPage) break;
  }
  services = services.slice(0, 8);
  const storySrc = about ? about.story : home.story;
  const story = (storySrc.length ? storySrc : home.story).slice(0, 3).join('\n\n').slice(0, 1200);
  const reviews = [];
  for (const p of [reviewsPage, home, ...pages].filter(Boolean)) for (const r of p.reviews) if (!reviews.some(x => x.quote === r.quote)) reviews.push(r);
  const faq = [];
  for (const p of [faqPage, home, ...pages].filter(Boolean)) for (const f of p.faq) if (!faq.some(x => x.question === f.question)) faq.push(f);
  const social = Object.assign({}, ...pages.slice().reverse().map(p => p.social));
  const logo = home.logo || firstOf('logo');
  const css = [home.inlineCss, ...inner.map(i => i.page.inlineCss), linkedCss].join('\n');
  const googleFonts = uniq(pages.flatMap(p => p.googleFonts));
  const brand = brandFromCss(css, { googleFonts });
  const photos = rankPhotos(pages.flatMap((p, i) => p.photos.map(c => ({ ...c, score: c.score - (i ? 0.3 : 0) }))).concat(photoCandidates(cheerio.load('<p></p>'), home.url, linkedCss)), [logo]);
  const phrases = apartPhrases(pages.flatMap(p => p.textBlocks));
  return {
    sourceUrl: home.url,
    pages: [{ kind: 'home', url: home.url }].concat(inner.map(i => ({ kind: i.kind, url: i.page.url }))),
    name: clean(home.name).slice(0, 80) || 'My Site',
    title: home.title, h1: home.h1, tagline: home.tagline, metaDescription: home.metaDescription,
    themeColor: home.themeColor, logo,
    phone: (contactPage && contactPage.phone) || firstOf('phone'),
    email: (contactPage && contactPage.email) || firstOf('email'),
    address: (contactPage && contactPage.address) || firstOf('address'),
    hours: (contactPage && contactPage.hours.length ? contactPage.hours : firstOf('hours')) || [],
    services, story, reviews: reviews.slice(0, 8), faq: faq.slice(0, 8), social, phrases, badges: badgesFrom(phrases),
    photos, brand,
    allText: pages.flatMap(p => p.textBlocks).join(' ').slice(0, 20000)
  };
}

// ---------- the look closest to the old site ----------
const STYLE_NAMES = { modern: 'Clean and modern', classic: 'Classic and trustworthy', bold: 'Bold and confident', warm: 'Warm and welcoming', luxe: 'Elegant and upscale', coastal: 'Calm and airy', playful: 'Playful and bright', corporate: 'Professional and corporate', earthy: 'Natural and earthy', noir: 'Dark and luxurious', gallery: 'Photo-first' };
const WORD_CUES = [
  ['luxe', /\b(luxury|luxurious|elegant|boutique|bespoke|exclusive|refined|upscale|couture|bridal)\b/i, 'their words feel upscale'],
  ['playful', /\b(fun|kids|children|party|parties|pets?|puppy|puppies|play|colorful|birthday|smile)\b/i, 'their words are playful and family-friendly'],
  ['earthy', /\b(organic|natural|farm|garden|plants?|eco|sustainable|herbal|handmade|rustic)\b/i, 'they talk about natural, handmade things'],
  ['warm', /\b(family|home-?made|cozy|neighborhood|community|friendly|grandma|from scratch|welcome)\b/i, 'they sound warm and family-run'],
  ['corporate', /\b(professional|firm|consulting|insurance|financial|accounting|clients|solutions|compliance|enterprise)\b/i, 'they sound professional and businesslike'],
  ['classic', /\b(since (?:19|20)\d\d|established|tradition|traditional|heritage|generations?|trusted)\b/i, 'they lean on tradition and history'],
  ['bold', /\b(heavy[- ]duty|tough|power|strong|fast|performance|built to last|no[- ]nonsense)\b/i, 'their words are strong and direct'],
  ['coastal', /\b(clean|fresh|calm|relax|wellness|breathe|spa|healing|care)\b/i, 'they sound calm and fresh']
];
function personality({ brand, photos, text, industryStyle }) {
  const score = Object.fromEntries(Object.keys(STYLE_NAMES).map(k => [k, 0]));
  const why = Object.fromEntries(Object.keys(STYLE_NAMES).map(k => [k, []]));
  const add = (k, n, reason) => { score[k] += n; if (reason && !why[k].includes(reason)) why[k].push(reason); };
  add('modern', 1);
  if (industryStyle && score[industryStyle] != null) add(industryStyle, 1.5, 'it suits this kind of business');
  const top = brand.colors[0] && brand.colors[0].hex;
  if (brand.dark) { add('noir', 4, 'the old site is dark'); add('bold', 1); }
  const hk = fontKind(brand.fonts.heading);
  if (hk === 'serif') { add('classic', 2.5, `their headings use a serif font (${brand.fonts.heading})`); add('luxe', 2, `their headings use a serif font (${brand.fonts.heading})`); }
  if (hk === 'script') { add('luxe', 2, `they use a script font (${brand.fonts.heading})`); add('playful', 1.5, `they use a script font (${brand.fonts.heading})`); add('warm', 1); }
  if (hk === 'display') add('bold', 3, `their headings use a strong, tall font (${brand.fonts.heading})`);
  if (top) {
    const { h, s, l } = hsl(top);
    const name = `their main color (${top})`;
    if (s > 0.55 && l > 0.35 && l < 0.7 && ((h >= 280 || h < 15) || (h >= 40 && h < 70))) add('playful', 2, `${name} is bright`);
    if (s > 0.6 && (h < 12 || h >= 345) && l < 0.55) add('bold', 2, `${name} is a strong red`);
    if (h >= 15 && h < 45 && s > 0.35) add('warm', 2, `${name} is a warm orange or brown`);
    if (h >= 60 && h < 160 && s < 0.6 && l < 0.6) add('earthy', 2.5, `${name} is a natural green`);
    if (h >= 170 && h < 215 && l > 0.35) add('coastal', 2, `${name} is a soft sea blue`);
    if (h >= 200 && h < 250 && l < 0.4) add('corporate', 2, `${name} is a deep navy`);
    if (brand.dark && h >= 35 && h < 60 && s > 0.35) add('noir', 1.5, `${name} is a gold glow on dark`);
    if (s < 0.35 && l > 0.55 && h >= 15 && h < 60) add('luxe', 1.5, `${name} is a soft cream or blush`);
  }
  if (photos >= 12) add('gallery', 3, `the old site has lots of photos (${photos})`);
  else if (photos >= 8) add('gallery', 1.5, `the old site has many photos (${photos})`);
  for (const [k, re, reason] of WORD_CUES) {
    const hits = (String(text || '').match(new RegExp(re.source, 'gi')) || []).length;
    if (hits >= 2) add(k, Math.min(2, hits * 0.4), reason);
  }
  const order = Object.keys(score).sort((a, b) => score[b] - score[a]);
  const pick = (id) => ({ id, name: STYLE_NAMES[id], why: why[id].slice(0, 3) });
  return { ...pick(order[0]), alternatives: order.slice(1, 4).map(pick) };
}

// ---------- what was found and what still needs the client ----------
function report(m, extra = {}) {
  const missing = [];
  if (!m.hours.length) missing.push('Opening hours were not found on the old site, so the Hours section is hidden. Add them if the business has set hours.');
  if (!m.reviews.length) missing.push('No customer reviews were found. Add real ones (or turn on Google reviews) before publishing; none were made up.');
  if (!m.services.length) missing.push(`No list of services was found. The services shown are typical for ${extra.industry ? extra.industry.label.toLowerCase() : 'this kind of business'}: check them with the client.`);
  if (m.photos.length < 3) missing.push(`Only ${m.photos.length} usable photo${m.photos.length === 1 ? '' : 's'} came from the old site.${extra.stock ? ` ${extra.stock} stock photo${extra.stock === 1 ? ' fills' : 's fill'} the gaps for now.` : ''} Ask the client for photos of their own work.`);
  if (!m.phone) missing.push('No phone number was found.');
  if (!m.email) missing.push('No email address was found.');
  if (!m.address) missing.push('No street address was found.');
  if (!m.logo) missing.push('No logo was found. Upload one in Design.');
  if (!m.faq.length) missing.push('No FAQ was found, so the FAQ section is hidden.');
  if (!m.brand.colors.length && !m.themeColor) missing.push('The old site had no clear brand color, so colors were picked to suit the business.');
  if (m.brand.fonts.heading && !extra.fontsUsed) missing.push(`Their font "${m.brand.fonts.heading}" isn't a free Google font, so the closest look's font is used.`);
  return {
    at: new Date().toISOString(),
    source: m.sourceUrl,
    pages: m.pages,
    found: {
      services: m.services.length, photos: m.photos.length, reviews: m.reviews.length, faq: m.faq.length,
      hours: m.hours.length > 0, phone: !!m.phone, email: !!m.email, address: !!m.address, logo: !!m.logo,
      social: Object.keys(m.social).length, phrases: m.phrases.slice(0, 6), badges: m.badges
    },
    brand: { colors: (extra.colors || []).slice(0, 4), fonts: extra.fontsUsed || null, fontsSeen: m.brand.fonts.all, dark: m.brand.dark, from: extra.colorFrom || 'none' },
    style: extra.style || null,
    industry: extra.industry ? { id: extra.industry.id, label: extra.industry.label, how: extra.industry.how } : null,
    stock: extra.stock || 0,
    ai: !!extra.ai,
    missing
  };
}

module.exports = {
  crawl, merge, extractPage, innerPages, jsonLd, hoursFromSchema, hoursFromText, apartPhrases, badgesFrom, serviceItems,
  reviewsOf, faqOf, socialsOf, photoCandidates, rankPhotos, photoKey, fullSize, brandFromCss, fontKind, googleFamilies,
  personality, report, hexOf, hsl, isNeutral, STYLE_NAMES, fetchHtml
};
