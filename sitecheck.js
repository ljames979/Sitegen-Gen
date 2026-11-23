// Whole-site check (Leo, 2026-11-23): the quality check used to read the home page only. This reads every page the
// site has, as visitors get them, and looks for the slips that are easy to miss before a client's site goes live:
//   placeholders   [Phone], [Client review here], Lorem ipsum, 555 numbers, example.com addresses left in the words
//   links          links to pages of this site that do not exist, and #jump links with nothing to jump to
//   contact        a phone number or email address on a page that is not the one in the site's contact details
//   headings       a page with no main heading, or more than one
//   pictures       pictures with no description (alt) on any page
//   language       with the EN / ES switch on: words on the pages that have no translation yet
// Pure: it gets the pages already drawn (html) and returns quality items in the same shape as quality.js.

const cheerio = require('cheerio');
const siteKit = require('./sitekit');

const PLACEHOLDER_RE = /\[(?:[A-Z][A-Za-z0-9'’ .,&/#:-]{1,48})\]/g;
const LOREM_RE = /\blorem ipsum\b/i;
const FAKE_PHONE_RE = /\(?\b555\)?[\s.-]?\d{3}[\s.-]?\d{4}\b|\b\d{3}[\s.-]555[\s.-]01\d\d\b/;
const FAKE_EMAIL_RE = /\b[\w.+-]+@(?:example\.(?:com|org|net)|yourdomain\.com|yourbusiness\.com|email\.com)\b/i;
const SKIP_TAGS = 'script, style, noscript, template, svg, textarea, code, pre';

const digits = (v) => String(v || '').replace(/\D+/g, '');
// a US number written with or without +1 is the same number
const phoneKey = (v) => { const d = digits(v); return d.length === 11 && d[0] === '1' ? d.slice(1) : d; };
const norm = (v) => siteKit.norm(v);

// visible words of a page, as the language switch compares them (public/sitekit-edit.js collect())
function pageWords($) {
  const out = [];
  const add = (t) => { t = norm(t); if (t && /\p{L}/u.test(t) && t.length <= 1500 && !/^(https?:|mailto:|tel:|\/)\S*$/.test(t) && !/^Preview mode/.test(t)) out.push(t); };
  add($('title').first().text());
  add($('meta[name="description"]').attr('content'));
  const walk = (node) => {
    if (node.type === 'text') { add(node.data); return; }
    if (node.type !== 'tag' && node.type !== 'root') return;
    if (node.type === 'tag') {
      const el = $(node);
      if (el.is(SKIP_TAGS) || el.is('[data-sg-lang-skip]')) return;
      for (const a of ['placeholder', 'aria-label', 'alt', 'title']) if (el.attr(a) !== undefined) add(el.attr(a));
      if (node.name === 'input' && /^(submit|button)$/i.test(el.attr('type') || '')) add(el.attr('value'));
    }
    for (const c of node.children || []) walk(c);
  };
  const body = $('body').get(0);
  if (body) walk(body);
  return out;
}

// text a visitor can read (no scripts, styles, editor bars)
function visibleText($) {
  const body = $('body').clone();
  body.find(SKIP_TAGS).remove();
  body.find('[data-sg-editor], .sg-preview-bar, #sgPreviewBar, .preview-bar').remove();
  return body.text().replace(/\s+/g, ' ');
}

const list = (arr, n = 4) => { const u = [...new Set(arr)]; return u.slice(0, n).join(', ') + (u.length > n ? ` and ${u.length - n} more` : ''); };

// pages: [{ label, path, html }]; path is the page's address under basePath ('' for home, '/about', '/services/x')
// opts: { basePath } — the address the pages were drawn under, so their links can be read
function check(site, pages, opts = {}) {
  const items = [], passed = [];
  const add = (i) => { if (!items.some(x => x.id === i.id)) items.push(i); };
  const pass = (t) => { if (!passed.includes(t)) passed.push(t); };
  const base = String(opts.basePath || '');
  const known = new Set(pages.map(p => p.path || '/'));
  const contact = (site.sections && site.sections.contact) || {};
  const ownPhone = phoneKey(contact.phone);
  const ownEmail = String(contact.email || '').trim().toLowerCase();

  const ph = [], lorem = [], fakePhone = [], fakeEmail = [], badLinks = [], badJumps = [], noH1 = [], manyH1 = [], noAlt = [], otherPhone = [], otherEmail = [];
  const words = [];
  for (const pg of pages) {
    if (!pg.html) continue;
    const $ = cheerio.load(pg.html);
    const text = visibleText($);
    const found = text.match(PLACEHOLDER_RE) || [];
    // also inside button text, alt and link titles the visitor sees or hears
    $('[alt], [placeholder], [aria-label], [title]').each((_, e) => { for (const a of ['alt', 'placeholder', 'aria-label', 'title']) { const m = String($(e).attr(a) || '').match(PLACEHOLDER_RE); if (m) found.push(...m); } });
    for (const f of found) ph.push({ page: pg.label, text: f });
    if (LOREM_RE.test(text)) lorem.push(pg.label);
    if (FAKE_PHONE_RE.test(text)) fakePhone.push(pg.label);
    if (FAKE_EMAIL_RE.test(text) || $('a[href^="mailto:"]').toArray().some(a => FAKE_EMAIL_RE.test($(a).attr('href')))) fakeEmail.push(pg.label);

    const h1 = $('h1').length;
    if (!h1) noH1.push(pg.label); else if (h1 > 1) manyH1.push(pg.label);
    const imgs = $('img').toArray().filter(i => $(i).attr('alt') === undefined);
    if (imgs.length) noAlt.push(`${pg.label} (${imgs.length})`);

    const ids = new Set($('[id]').toArray().map(e => $(e).attr('id')));
    $('a[name]').each((_, e) => ids.add($(e).attr('name')));
    $('a[href]').each((_, a) => {
      const href = String($(a).attr('href') || '').trim();
      if (/^tel:/i.test(href)) { const k = phoneKey(href.slice(4)); if (k && ownPhone && k !== ownPhone && k.length >= 7) otherPhone.push(`${href.slice(4)} on ${pg.label}`); return; }
      if (/^mailto:/i.test(href)) { const m = decodeURIComponent(href.slice(7).split('?')[0]).trim().toLowerCase(); if (m && ownEmail && m !== ownEmail && !FAKE_EMAIL_RE.test(m)) otherEmail.push(`${m} on ${pg.label}`); return; }
      if (href.startsWith('#')) {
        const id = href.slice(1);
        if (id && id !== 'top' && !ids.has(id)) badJumps.push(`${href} on ${pg.label}`);
        return;
      }
      if (!base || !href.startsWith(base)) return;
      let rest = href.slice(base.length).split('#')[0].split('?')[0];
      if (rest === '/') rest = '';
      if (rest && !rest.startsWith('/')) return;   // another site that only shares the start of the address
      // server pages that are not in the page list but do exist
      if (/^\/(book|members|review|estimate|thank-you|uploads|look|h)\b/.test(rest)) return;
      if (!known.has(rest || '/') && !known.has(rest)) badLinks.push(`${rest || '/'} on ${pg.label}`);
    });
    if (siteKit.of(site).langs.on) words.push(...pageWords($));
  }

  if (ph.length) add({ id: 'pages-placeholder', area: 'pages', severity: 'error', title: 'Placeholder text is still on the site', detail: `${list(ph.map(p => `${p.text} on ${p.page}`), 6)}. Swap each one for the client's real details, or take it out, before the site goes live.` });
  else pass('No [placeholders] left on any page');
  if (lorem.length) add({ id: 'pages-lorem', area: 'pages', severity: 'error', title: 'Sample "Lorem ipsum" words on the site', detail: `Found on ${list(lorem)}. Replace them with the client's own words.` });
  if (fakePhone.length || fakeEmail.length) add({ id: 'pages-sample-contact', area: 'pages', severity: 'error', title: 'A sample phone number or email address is on the site', detail: `${fakePhone.length ? `A 555 phone number on ${list(fakePhone)}. ` : ''}${fakeEmail.length ? `An example email address on ${list(fakeEmail)}. ` : ''}Use the client's real details.` });
  if (!lorem.length && !fakePhone.length && !fakeEmail.length) pass('No sample words, 555 numbers or example emails');

  if (badLinks.length) add({ id: 'pages-links', area: 'pages', severity: 'error', title: 'Links to pages that do not exist', detail: `${list(badLinks, 5)}. Visitors who click them get a "page not found". Point them at a page the site has, or turn that page on.` });
  else pass('Every link to the site\'s own pages works');
  if (badJumps.length) add({ id: 'pages-jumps', area: 'pages', severity: 'warn', title: 'Jump links with nothing to jump to', detail: `${list(badJumps, 5)}. The part of the page they point at is not there, so clicking them does nothing.` });
  else pass('Every jump link (#…) has somewhere to go');

  if (otherPhone.length) add({ id: 'pages-phone', area: 'pages', severity: 'error', title: 'A phone number that is not the business\'s number', detail: `${list(otherPhone, 4)}. The contact details say ${contact.phone}. Check which one is right.` });
  else if (ownPhone) pass('The same phone number everywhere');
  if (otherEmail.length) add({ id: 'pages-email', area: 'pages', severity: 'warn', title: 'An email address that is not the business\'s address', detail: `${list(otherEmail, 4)}. The contact details say ${contact.email}. Check which one is right.` });
  else if (ownEmail) pass('The same email address everywhere');

  if (noH1.length) add({ id: 'pages-h1-none', area: 'pages', severity: 'warn', title: 'Pages with no main heading', detail: `${list(noH1, 6)}. Google and screen readers use the main heading to know what a page is about.` });
  if (manyH1.length) add({ id: 'pages-h1-many', area: 'pages', severity: 'warn', title: 'Pages with more than one main heading', detail: `${list(manyH1, 6)}. One main heading per page reads best for Google and screen readers.` });
  if (!noH1.length && !manyH1.length) pass('One main heading on every page');
  if (noAlt.length) add({ id: 'pages-alt', area: 'pages', severity: 'warn', title: 'Pictures with no description on other pages', detail: `${list(noAlt, 6)}. Add a short description so screen readers and Google know what the picture shows.` });
  else pass('Every picture on every page has a description');

  const langs = siteKit.of(site).langs;
  if (langs.on) {
    const have = new Map(langs.words.map(([a, b]) => [norm(a).toLowerCase(), b]));
    // names that read the same in every language: the business, social networks, app stores, lone numbers or letters
    const same = new Set([norm(site.name || '').toLowerCase(), 'facebook', 'instagram', 'tiktok', 'x', 'twitter', 'youtube', 'linkedin', 'pinterest', 'yelp', 'google', 'whatsapp', 'app store', 'google play', langs.first.toLowerCase(), langs.second.toLowerCase()]);
    const firstCase = new Map(); for (const w of words) if (!firstCase.has(w.toLowerCase())) firstCase.set(w.toLowerCase(), w);
    const missing = [...firstCase.keys()].filter(w => !have.get(w) && !same.has(w) && /\p{L}{2}/u.test(w) && !/^[\w.+-]+@[\w.-]+$/.test(w)).map(w => firstCase.get(w));
    if (missing.length) add({ id: 'pages-lang', area: 'pages', severity: 'warn', title: `${missing.length} piece${missing.length === 1 ? '' : 's'} of text with no ${langs.second} translation`, detail: `Visitors who pick ${langs.second} still see these in English, for example: ${list(missing.map(w => `"${w.length > 40 ? w.slice(0, 40) + '…' : w}"`), 3)}. In the editor open Design > Pages, languages and header button, press Find words on my pages, then fill in the empty boxes.`, fix: { type: 'link', label: 'Open the word list', href: `/sites/${site.id}/edit#site-kit` } });
    else pass(`Every piece of text has a ${langs.second} translation`);
  }
  return { items, passed, pages: pages.filter(p => p.html).length };
}

module.exports = { check, pageWords, phoneKey, PLACEHOLDER_RE };
