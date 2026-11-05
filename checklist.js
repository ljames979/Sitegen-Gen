// "Before you publish" checks. Pure function of a hydrated site, so the editor
// can show it on load and the autosave can refetch it. level 'warn' = would
// look unfinished or wrong to a visitor; 'tip' = nice to have.
const { defaultSections } = require('./defaults');
const calc = require('./calc');

function sameHours(items, defaults) {
  if (!Array.isArray(items) || items.length !== defaults.length) return false;
  return items.every((it, i) => it.day === defaults[i].day && it.time === defaults[i].time);
}

// WCAG contrast ratio of white text on a #rrggbb color
function whiteContrast(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const n = parseInt(m[1], 16);
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return 1.05 / (L + 0.05);
}

function buildChecklist(site, opts = {}) {
  const s = site.sections;
  const hidden = (site.layout && site.layout.hidden) || [];
  const issues = [];
  // `to` tells the editor where to jump: field = a selector for the input, match = a pattern for the value to find
  const warn = (text, to) => issues.push({ level: 'warn', text, ...(to || {}) });
  const tip = (text, to) => issues.push({ level: 'tip', text, ...(to || {}) });
  const F = (field) => ({ field });

  const contrast = whiteContrast(site.theme && site.theme.primaryColor);
  if (contrast !== null && contrast < 4.5) {
    warn(`White text on your brand color (${site.theme.primaryColor}) is hard to read (contrast ${contrast.toFixed(1)}:1; at least 4.5:1 is recommended). Choose a darker shade in Theme.`, F('[name=theme_primaryColor]'));
  }
  if (!s.hero.headline.trim()) warn('The home page has no headline.', F('[name=hero_headline]'));
  const fullHome = require('./themes').homeLayoutOf(site.theme) !== 'basic';
  if (fullHome && s.services.items.length && s.services.items.some(i => i.title && !i.imageUrl)) {
    tip('Some services have no photo, so their home page cards show a plain icon. Add a photo to each service (Services box → Choose photo) for a finished look.', F('[name=service_image]'));
  }
  if (!s.hero.imageUrl) tip('No hero photo — the top of the home page will use a plain colored background.', F('[name=hero_imageUrl]'));

  if (!s.contact.phone && !s.contact.email) {
    warn('No phone number or email — visitors have no way to reach the business.', F('[name=contact_phone]'));
  } else {
    if (!s.contact.phone) tip('No phone number yet (the top bar and "Call Now" button need one).', F('[name=contact_phone]'));
    if (!s.contact.email) tip('No contact email yet.', F('[name=contact_email]'));
  }
  if (s.contact.acceptSubmissions && !s.contact.email && !s.contact.notifyEmail) {
    tip('The contact form is on but there is no email address to send alerts to.', F('[name=contact_notifyEmail]'));
  }
  if (!s.contact.address) tip('No address — the map on the Contact page only appears once one is added.', F('[name=contact_address]'));

  if (!hidden.includes('hours') && sameHours(s.hours.items, defaultSections().hours.items)) {
    warn('The Hours page still shows the default Mon–Fri 9–5 placeholder — confirm or change the real hours.', F('[name=hours_time]'));
  }

  if (!hidden.includes('about') && !(s.about.body || '').trim()) warn('The About page has no text.', F('[name=about_body]'));
  if (!hidden.includes('services') && !s.services.items.length) warn('The Services page has no services listed.', F('#servicesList'));

  const reviews = s.testimonials && s.testimonials.items.length;
  if (!hidden.includes('testimonials') && !reviews) tip('No reviews yet — paste in real ones when the client has them (the Reviews page stays hidden until then).', F('#testimonialsList'));
  if (!s.gallery.images.length) tip('No gallery photos.', F('#galleryList'));
  if (!(s.seo.title || '').trim() || !(s.seo.description || '').trim()) {
    tip('Add a search title and description (Site & SEO settings) so the site looks right on Google.', F((s.seo.title || '').trim() ? '[name=seo_description]' : '[name=seo_title]'));
  }

  // Claims a visitor would take literally (licensed, 24/7 …). The built-in
  // templates contain some, and AI copy can drift, so make the owner confirm.
  const trust = s.trust || { badges: [], serviceAreas: [] };
  const haystack = [
    s.hero.subheadline, s.about.body,
    ...s.services.items.map(i => `${i.title} ${i.description}`),
    ...s.faq.items.map(i => `${i.question} ${i.answer}`)
  ].join(' \n ').toLowerCase();
  const claims = new Set(), claimSrc = {};
  for (const [re, label] of [
    [/\blicensed\b/, 'licensed'], [/\binsured\b/, 'insured'], [/24\/7|24-hour|around the clock/, '24/7'],
    [/same-day|same day/, 'same-day service'], [/free (estimate|quote|inspection|consultation)/, 'free estimates'],
    [/guarantee|warranty/, 'guarantee/warranty'], [/\bcertified\b/, 'certified'], [/award[- ]winning/, 'award-winning']
  ]) if (re.test(haystack)) { claims.add(label); claimSrc[label] = re.source; }
  const badgeText = trust.badges.join(' ').toLowerCase();
  if (/licen/.test(badgeText)) claims.delete('licensed');
  if (/insur/.test(badgeText)) claims.delete('insured');
  if (/certif/.test(badgeText)) claims.delete('certified');
  if (claims.size) {
    warn(`The text says the business is or offers: ${[...claims].join(', ')}. Confirm each is true — edit the text, or add it under Trust & credentials if it is.`, { match: [...claims].map(c => claimSrc[c]).join('|'), field: '[name=trust_badges]' });
  }
  const meta = s.meta || {};
  if (!(meta.city || '').trim()) tip('No main city set (Local SEO & tracking) — add it so the city appears in page titles and headings for local searches.', F('[name=meta_city]'));
  if (!hidden.includes('services')) {
    const thin = s.services.items.filter(i => i.title && !(i.detail || '').trim());
    if (thin.length) tip(`${thin.length === s.services.items.length ? 'None of the services have' : thin.length + ' service(s) have no'} page text yet — each service page only gets listed on Google once you add a few sentences for it (or use "Rewrite text with AI").`, F('[name=service_detail]'));
  }
  if (!trust.serviceAreas.length) tip('No service area listed (Trust & credentials) — it helps local searches and tells visitors where you work.', F('[name=trust_serviceAreas]'));

  // ---- deeper checks (pro launch audit) ----
  const forms = require('./forms');
  const cform = forms.normalize(s.contact.form);
  if (s.contact.acceptSubmissions && cform.mode === 'custom') {
    const types = cform.fields.map(f => f.type);
    if (!types.some(t => ['phone', 'email'].includes(t))) {
      warn('Your custom contact form has no Phone or Email question, so you could not reply to anyone. Add one in the Contact box.', F('[name=cf_type]'));
    }
    if (types.includes('service') && !s.services.items.length) tip('Your contact form has a "Service list" question but no services are listed, so it is hidden from visitors.');
  }

  // estimate calculator
  if (s.calculator && s.calculator.enabled) {
    const cfgC = calc.normalize(s.calculator);
    if (!calc.isUsable(cfgC)) warn('The estimate page is switched on but has no usable questions, so it is not shown. Add a question with choices in Settings → Quote / estimate calculator.');
    else if (cfgC.showPrice && !calc.hasPrices(cfgC)) warn('The estimate calculator shows prices, but every price is zero, so visitors would see $0. Fill in your prices (or switch "Show prices" off).');
    if (calc.isUsable(cfgC) && !s.contact.acceptSubmissions) warn('The estimate page sends requests to your Leads, but the contact form is switched off, so they would not be saved.', F('#calcBlock'));
  }

  // chat assistant
  if (s.chat && s.chat.enabled) {
    const faqN = (s.faq.items || []).filter(q => q.question && q.answer).length, svcN = (s.services.items || []).filter(x => x.title).length;
    if (!faqN && !(s.hours.items || []).length) tip('The chat assistant is on but the site has no FAQ answers or hours for it to draw from. Add a few FAQ answers so it can help visitors.');
    if (!svcN) tip('The chat assistant is on but no services are listed.');
    if (!s.contact.acceptSubmissions) warn('The chat assistant offers to take contact details, but the contact form is switched off, so those requests would not be saved. Turn on "Accept messages" in Contact.');
  }

  // privacy / terms
  const collectsInfo = s.contact.acceptSubmissions || (s.booking && s.booking.enabled) || (s.meta && (s.meta.gaId || s.meta.metaPixelId));
  if (collectsInfo && !(s.legal && s.legal.enabled)) tip('This site collects visitor details (a form, bookings or analytics) but has no Privacy Policy. Turn on "Privacy & Terms pages" in Settings.', F('#legalBlock'));
  if (s.legal && s.legal.enabled && !(s.legal.email || s.contact.email)) tip('The Privacy Policy has no contact email. Add one in Privacy & Terms (or in Contact).');

  // placeholder text that slipped through
  const all = JSON.stringify(s);
  const leftovers = [], leftSrc = [];
  for (const [re, label] of [
    [/lorem ipsum/i, '"Lorem ipsum"'], [/example\.(com|org|net)/i, 'an example.com address'], [/\b555[-. ]?01\d\d\b/, 'a fictional 555-01xx phone number'],
    [/tell visitors who you are and what makes your business great/i, 'the default About text'], [/\b(your (business|company)( name)?|insert (text|name)|xxx+)\b/i, '"Your business name"-style filler']
  ]) if (re.test(all)) { leftovers.push(label); leftSrc.push(re.source); }
  if (leftovers.length) warn(`Placeholder text is still on the site: ${leftovers.join(', ')}. Replace it before launch.`, { match: leftSrc.join('|') });

  const digits = (s.contact.phone || '').replace(/\D/g, '');
  if (s.contact.phone && (digits.length < 7 || digits.length > 15)) warn(`The phone number "${s.contact.phone}" does not look like a full phone number.`, F('[name=contact_phone]'));

  // search appearance
  const seoTitle = (s.seo.title || '').trim(), seoDesc = (s.seo.description || '').trim();
  if (seoTitle.length > 60) tip(`The search title is ${seoTitle.length} characters; Google usually cuts it off after about 60.`, F('[name=seo_title]'));
  if (seoDesc && seoDesc.length < 70) tip(`The search description is short (${seoDesc.length} characters). 120 to 155 characters gives Google more to show.`, F('[name=seo_description]'));
  if (seoDesc.length > 160) tip(`The search description is ${seoDesc.length} characters; Google usually cuts it off after about 155.`, F('[name=seo_description]'));
  if (!s.seo.shareImage && !s.hero.imageUrl) tip('No share picture and no hero photo, so links to this site pasted into Facebook, texts or email show no picture. Add one under Site & SEO.', F('[name=seo_shareImage]'));
  if ((s.hero.headline || '').length > 90) tip('The home page headline is very long. Short headlines (under about 70 characters) read better on phones.', F('[name=hero_headline]'));

  // photos: descriptions, size, insecure links
  const gal = s.gallery.images || [];
  const noAlt = gal.filter((u, i) => !((s.gallery.alts || [])[i] || '').trim()).length;
  if (noAlt) tip(`${noAlt === gal.length ? 'None of the' : noAlt + ' of the'} ${gal.length} gallery photo${gal.length === 1 ? '' : 's'} ${noAlt === 1 ? 'has' : 'have'} a description. Descriptions help people using screen readers and help the photos show up in Google Images (Gallery box).`, F('[name=gallery_alt]'));
  if (s.about.imageUrl && !(s.about.imageAlt || '').trim()) tip('The About photo has no description (About box).', F('[name=about_imageAlt]'));
  const insecure = [...new Set((all.match(/"http:\/\/[^"\\]+\.(?:jpe?g|png|gif|webp|svg)[^"\\]*"/gi) || []))];
  if (insecure.length) warn(`${insecure.length} photo${insecure.length === 1 ? ' uses' : 's use'} an insecure http:// address, which browsers can block on a secure site. Upload the photo or use an https:// address.`);
  if (opts.uploadsDir) {
    const fs = require('fs'), path = require('path');
    const big = [];
    for (const name of require('./images').uploadsUsed(site.sections)) {
      try {
        const size = fs.statSync(path.join(opts.uploadsDir, name)).size;
        if (size > 900 * 1024) big.push(`${name} (${(size / 1048576).toFixed(1)} MB)`);
      } catch { /* file missing: reported below */ }
    }
    if (big.length) tip(`${big.length} photo${big.length === 1 ? ' is' : 's are'} still large: ${big.slice(0, 3).join(', ')}${big.length > 3 ? '…' : ''}. Smaller copies are made automatically for phones, but re-uploading a smaller original helps desktop visitors too.`);
    const gone = require('./images').uploadsUsed(site.sections).filter(n => !fs.existsSync(path.join(opts.uploadsDir, n)));
    if (gone.length) warn(`${gone.length} uploaded photo${gone.length === 1 ? ' is' : 's are'} missing from the uploads folder (${gone.slice(0, 3).join(', ')}), so visitors would see a broken picture. Upload ${gone.length === 1 ? 'it' : 'them'} again.`);
  }

  // links that go nowhere
  if (opts.pageExists) {
    const links = [];
    const add = (where, url) => { if (url && String(url).startsWith('/') && !String(url).startsWith('//')) links.push([where, String(url).split(/[?#]/)[0]]); };
    add('the home page button', s.hero.ctaLink);
    add('the announcement bar', s.announcement && s.announcement.linkUrl);
    ((s.blocks && s.blocks.items) || []).forEach(b => add(`the "${b.heading || b.type}" block button`, b.buttonUrl));
    const dead = [...new Set(links.filter(([, u]) => u !== '/' && u !== '' && !opts.pageExists(u)).map(([w, u]) => `${u} (${w})`))];
    if (dead.length) warn(`These links point to a page that does not exist or is hidden: ${dead.slice(0, 4).join('; ')}.`);
  }
  if (s.booking && s.booking.enabled) {
    if (!(s.booking.services || []).length) warn('Online booking is on but has no services to book.', F('#bookingBlock'));
    if (!s.contact.email && !s.contact.notifyEmail) tip('Online booking is on but there is no email address to send new booking alerts to.');
  }
  if (s.announcement && s.announcement.enabled && !(s.announcement.text || '').trim()) tip('The announcement bar is on but has no text, so it will not show.', F('[name=ann_text]'));

  // per-page search settings and redirects
  const seoPages = (s.seo && s.seo.pages) || {};
  const hiddenFromGoogle = Object.keys(seoPages).filter(k => seoPages[k].noindex);
  if (hiddenFromGoogle.length) tip(`These pages are set to stay out of Google: ${hiddenFromGoogle.join(', ')}. Make sure that is what you want (Search & sharing for each page).`);
  const longTitles = Object.keys(seoPages).filter(k => (seoPages[k].title || '').length > 60);
  if (longTitles.length) tip(`The search title for ${longTitles.join(', ')} is over 60 characters; Google usually cuts it off.`);
  const rules = (s.seo && s.seo.redirects) || [];
  if (rules.length && opts.pageExists) {
    const shadow = rules.filter(r => !r.from.includes('*') && r.from.split('/').filter(Boolean).length === 1 && opts.pageExists(r.from)).map(r => r.from);
    if (shadow.length) warn(`A redirect starts from ${shadow.slice(0, 3).join(', ')}, which is a live page on this site, so visitors can never see that page. Remove the redirect or change its "From".`);
    const dead = rules.filter(r => r.to.startsWith('/') && !r.to.includes('*') && !opts.pageExists(r.to.split(/[?#]/)[0] || '/')).map(r => `${r.from} → ${r.to}`);
    if (dead.length) warn(`These redirects lead to a page that does not exist or is hidden: ${dead.slice(0, 3).join('; ')}.`);
  }

  // warnings first, otherwise keep insertion order
  return [...issues.filter(i => i.level === 'warn'), ...issues.filter(i => i.level === 'tip')];
}

module.exports = { buildChecklist };
