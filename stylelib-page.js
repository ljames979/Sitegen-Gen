// Style Library home page: the hero and sections of one of the 8 page blueprints, drawn in a Style Library
// style and filled only with the client's own content (the section-library binders in library/content.js).
// A section with nothing real to show is left out. Panels, numbers and photos come from what the owner entered:
// prices, contact details, hours, trust stats, review ratings, uploaded or Pexels photos. Where a layout needs a
// picture and the site has none, a plain gradient tile in the style's colors stands in, with no caption.
const lib = require('./stylelib');
const content = require('./library/content');
const { iconPath } = require('./icons');
const { countAttrs } = require('./motion-presets');
const formsLib = require('./forms');

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const svgIcon = (path) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const PIN = '<path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>';
const telOf = (p) => String(p || '').replace(/[^0-9+]/g, '');

// Headline emphasis: words the owner wraps in [brackets] get the style's emphasis (italic, highlighter, sticker...).
// Without brackets the last phrase after a comma (up to 3 words) or the last two words are emphasized.
function emphasize(text) {
  const t = String(text || '').trim();
  const m = /\[(.+?)\]/.exec(t);
  if (m) return esc(t.slice(0, m.index)) + `<span class="t-em">${esc(m[1])}</span>` + esc(t.slice(m.index + m[0].length).replace(/[\[\]]/g, ''));
  const tail = /^(.*?)([.!?…]*)$/.exec(t);
  const body = tail[1], punct = tail[2];
  const comma = body.lastIndexOf(',');
  let cut;
  if (comma > 0 && body.slice(comma + 1).trim().split(/\s+/).length <= 3) cut = comma + 1;
  else { const words = body.split(/\s+/); if (words.length < 3) return esc(t); cut = body.length - words.slice(-2).join(' ').length; }
  const lead = body.slice(0, cut), em = body.slice(cut).trim();
  return esc(lead) + (lead.endsWith(' ') ? '' : ' ') + `<span class="t-em">${esc(em)}</span>` + esc(punct);
}
const plain = (text) => String(text || '').replace(/[\[\]]/g, '');

// "Mon–Fri 9:00 AM – 5:00 PM": the first run of days that share the same hours
function hoursLine(site) {
  const rows = ((site.sections.hours || {}).items || []).filter(r => r.day && r.time);
  if (!rows.length) return '';
  const first = rows[0]; let n = 1;
  while (n < rows.length && rows[n].time === first.time) n++;
  const short = (d) => String(d).slice(0, 3);
  return (n > 1 ? `${short(first.day)}–${short(rows[n - 1].day)}` : first.day) + ' ' + first.time;
}

// Average star rating, only when at least 3 reviews carry one
function ratingOf(reviews) {
  const rated = ((reviews && reviews.items) || []).filter(r => r.rating > 0);
  if (rated.length < 3) return null;
  const avg = rated.reduce((a, r) => a + Math.min(5, r.rating), 0) / rated.length;
  return { value: avg.toFixed(1) + '★', label: `average from ${rated.length} reviews` };
}

// Everything the page can show, from the site's own content
function model(ctx) {
  const site = ctx.site, s = site.sections, meta = s.meta || {}, c = s.contact || {}, h = s.hero || {};
  const b = (fam) => content.bind(fam, ctx);
  const hero = b('hero'), services = b('services'), why = b('why'), stats = b('stats'), reviews = b('testimonials');
  const about = b('about'), gallery = b('gallery'), areas = b('areas'), pricing = b('pricing'), faq = b('faq'), banner = b('banner'), logos = b('logos');
  const statItems = (stats && stats.items) || [];
  const rating = ratingOf(reviews);
  // photos: hero, about, gallery, then service photos, each once
  const photos = [h.imageUrl, (s.about || {}).imageUrl].concat((s.gallery || {}).images || [], (ctx.services || []).map(x => x.imageUrl))
    .filter(Boolean).filter((u, i, a) => a.indexOf(u) === i);
  const feats = services ? services.items.map(x => ({ icon: x.icon, title: x.title, text: x.description, price: x.price, href: x.href }))
    : why ? why.items.map(x => ({ icon: iconPath(x.title), title: x.title, text: x.text, price: '', href: '' })) : [];
  const svcSec = s.services || {}, whySec = s.whyChoose || {};
  const contactLink = h.ctaLink && h.ctaLink !== '#contact' ? h.ctaLink : ctx.basePath + '/contact';
  const contactRows = [];
  if (c.phone) contactRows.push(['Phone', c.phone]);
  const hl = hoursLine(site); if (hl) contactRows.push(['Hours', hl]);
  if (c.email && contactRows.length < 3) contactRows.push(['Email', c.email]);
  if (c.address) contactRows.push(['Address', c.address]);
  else if (meta.city) contactRows.push(['Area', meta.city]);
  const cform = formsLib.normalize(c.form);
  const formOn = !!c.acceptSubmissions && (!ctx.staticExport || !!ctx.netlifyForms) && cform.mode !== 'custom';
  return {
    name: site.name, city: meta.city || '', place: [meta.businessType, meta.city].filter(Boolean).join(' · '),
    h1: (hero && hero.headline) || site.name, sub: (hero && hero.sub) || '',
    cta1: { text: (hero && hero.ctaText) || 'Contact us', href: contactLink },
    cta2: c.phone ? { text: 'Call ' + c.phone, href: 'tel:' + telOf(c.phone) } : (services && services.moreHref ? { text: 'See all services', href: services.moreHref } : null),
    phone: c.phone || '', address: c.address || '', hours: hl, email: c.email || '', contactRows,
    badges: ((s.trust || {}).badges || []).filter(Boolean),
    trust: statItems.slice(0, 3), stats: statItems, rating,
    float: statItems[3] || rating || null,
    featStat: statItems[3] || rating || null,
    feats, featHead: {
      eyebrow: services ? (svcSec.eyebrow || 'What we do') : (whySec.eyebrow || 'Why choose us'),
      h2: services ? services.heading : (why ? why.heading : ''), lead: services ? (svcSec.intro || '') : (whySec.intro || ''), more: services ? services.moreHref : ''
    },
    services: (services && services.items) || [], pricing, reviews, faq, gallery, areas, banner, logos, about, photos,
    form: formOn ? { action: ctx.netlifyForms ? 'thank-you.html' : ctx.basePath + '/contact', netlify: !!ctx.netlifyForms, preview: !!ctx.preview } : null,
    contactHref: ctx.basePath + '/contact'
  };
}

// a photo tile: the client's photo, or a plain gradient in the style's colors (decorative, no caption)
function ph(m, i, iconFrom) {
  const src = m.photos[i];
  const icon = !src && iconFrom ? `<span class="t-ph-ico">${svgIcon(iconFrom)}</span>` : '';
  return `<figure class="t-ph" data-i="${i % 4}">${src ? `<img src="${esc(src)}" alt="${esc(m.name)}" loading="${i ? 'lazy' : 'eager'}" decoding="async">` : icon}</figure>`;
}
const featIcon = (m, i) => (m.feats[i % Math.max(1, m.feats.length)] || {}).icon || '';

function parts(m) {
  return {
    eyebrow: m.place ? `<span class="t-eyebrow">${esc(m.place)}</span>` : '',
    h1: `<h1 class="t-h1 t-disp" data-animate="hero">${emphasize(m.h1)}</h1>`,
    lead: m.sub ? `<p class="t-lead">${esc(m.sub)}</p>` : '',
    actions: `<div class="t-actions"><a class="t-btn" href="${esc(m.cta1.href)}">${esc(m.cta1.text)}</a>${m.cta2 ? `<a class="t-btn t-btn-ghost" href="${esc(m.cta2.href)}">${esc(m.cta2.text)}</a>` : ''}</div>`,
    trust: m.trust.length >= 2 ? `<ul class="t-trust">${m.trust.map(t => `<li><b class="t-disp"${t.countAttrs || ''}>${esc(t.value)}</b><span>${esc(t.label)}</span></li>`).join('')}</ul>` : '',
    float: m.float ? `<div class="t-float"><b class="t-disp">${esc(m.float.value)}</b><span>${esc(m.float.label)}</span></div>` : ''
  };
}

// The hero's info panel, from real data: prices first, then contact details
function panelData(m) {
  const priced = m.services.filter(x => x.price).slice(0, 4);
  if (priced.length >= 2) return { title: m.featHead.h2 || 'Prices', chip: m.city, rows: priced.map(x => [x.title, x.price]), foot: m.phone ? 'Call ' + m.phone : '' };
  if (m.contactRows.length >= 2) return { title: m.name, chip: m.city, rows: m.contactRows, foot: m.badges.slice(0, 3).join(' · ') };
  return null;
}
function panelHTML(p) {
  return `<div class="t-panel"><div class="t-panel-head"><span>${esc(p.title)}</span>${p.chip ? `<span class="t-chip">${esc(p.chip)}</span>` : ''}</div>`
    + `<ul class="t-panel-rows">${p.rows.map(r => `<li><i class="d"></i><span>${esc(r[0])}</span><b>${esc(r[1])}</b></li>`).join('')}</ul>`
    + (p.foot ? `<div class="t-panel-foot">${esc(p.foot)}</div>` : '') + '</div>';
}

function logosHTML(m) {
  if (!m.logos) return '';
  return `<div class="t-logos">${m.logos.heading ? `<small>${esc(m.logos.heading)}</small>` : ''}${m.logos.items.map(l => `<img src="${esc(l.src)}" alt="${esc(l.alt)}" loading="lazy">`).join('')}</div>`;
}
const marquee = (st, m) => (st.marquee && m.banner) ? `<div class="t-marquee"${st.mqTilt ? ' data-tilt' : ''} aria-hidden="true"><div class="t-marquee-track">${[0, 1, 2, 3].map(() => m.banner.items.map(x => `<span>${esc(x)}</span>`).join('')).join('')}</div></div>` : '';
const bgDiv = (st) => `<div class="t-bg" data-bg="${st.bg}"></div>`;

// The style's own hero (split, centered, poster, framed or magazine), used by the Classic, Product and Magazine blueprints
function classicHero(st, m, kind) {
  const p = parts(m);
  const pd = panelData(m);
  // styles with a signature panel shape show the panel; the others show the client's hero photo when there is one
  const usePanel = pd && (st.panel || !m.photos.length);
  const vis = usePanel ? panelHTML(pd) : m.photos.length ? ph(m, 0) : (pd ? panelHTML(pd) : '');
  const visual = vis ? `<div class="t-hero-visual"${usePanel && st.panel ? ` data-panel="${st.panel}"` : ''}>${vis}${p.float}</div>` : '';
  const copy = `${p.lead}${p.actions}${p.trust}`;
  let body;
  if (kind === 'poster') body = `<div class="t-poster">${p.eyebrow}${p.h1}<div class="t-poster-row"><div class="t-poster-copy">${copy}</div>${visual}</div></div>`;
  else if (kind === 'magazine') {
    const mastSize = Math.min(st.fonts.h1 * 2.8, Math.floor(1088 / (Math.max(4, m.name.length) * 0.6)));
    body = `<div class="t-mast"><div class="t-mast-name t-disp" style="--mast:${mastSize}px">${esc(m.name)}</div><div class="t-mast-line"><span>${esc(m.place || m.name)}</span>${m.hours ? `<span>${esc(m.hours)}</span>` : ''}</div></div><div class="t-hero-body"><div class="t-hero-copy">${p.h1}${copy}</div>${visual}</div>`;
  } else body = `<div class="t-hero-body"${visual ? '' : ' style="grid-template-columns:1fr"'}><div class="t-hero-copy">${p.eyebrow}${p.h1}${copy}</div>${visual}</div>`;
  const layout = kind === 'magazine' ? 'magazine' : (kind === 'split' || !kind) ? 'split' : kind;
  return `<section class="t-hero" data-layout="${layout}"${st.marquee && m.banner ? ' data-mq' : ''}>${bgDiv(st)}<div class="t-wrap">${body}${logosHTML(m)}</div>${marquee(st, m)}</section>`;
}

function heroHTML(st, m, bp) {
  const kind = lib.BLUEPRINTS[bp].hero, p = parts(m), mq = st.marquee && m.banner ? ' data-mq' : '';
  if (kind === 'classic') return classicHero(st, m, st.hero);
  if (kind === 'magazine') return classicHero(st, m, 'magazine');
  if (kind === 'cover') return `<section class="t-hero t-cover" data-layout="cover">${ph(m, 0, featIcon(m, 0))}<div class="t-cover-shade"></div><div class="t-wrap"><div class="t-cover-body">${p.eyebrow}${p.h1}${p.lead}${p.actions}</div></div>${marquee(st, m)}</section>`;
  if (kind === 'form') {
    const f = m.form;
    const side = f
      ? `<form class="t-form" method="POST" action="${esc(f.action)}" enctype="multipart/form-data"${f.netlify ? ' name="contact" data-netlify="true" netlify-honeypot="website"' : ''}${f.preview ? ' onsubmit="return false;"' : ''}>`
        + (f.netlify ? '<input type="hidden" name="form-name" value="contact">' : '') + '<input type="text" name="website" class="hp-field" tabindex="-1" autocomplete="off" aria-hidden="true">'
        + `<div class="t-form-head"><b class="t-disp">${esc(m.cta1.text)}</b><span>Tell us what you need and we’ll get back to you.</span></div>`
        + '<div class="t-field-row"><label class="t-field">Name<input type="text" name="name" maxlength="100" autocomplete="name"></label><label class="t-field">Phone<input type="tel" name="phone" maxlength="40" autocomplete="tel"></label></div>'
        + (m.services.length ? `<label class="t-field">What do you need?<select name="service"><option value="">Choose one</option>${m.services.map(x => `<option>${esc(x.title)}</option>`).join('')}</select></label>` : '')
        + '<label class="t-field">Email<input type="email" name="email" maxlength="254" autocomplete="email"></label>'
        + '<label class="t-field">Message<textarea name="message" maxlength="2000" rows="3"></textarea></label>'
        + `<button class="t-btn" type="submit">${esc(m.cta1.text)}</button>${m.phone ? `<p class="t-form-note">Prefer to talk? Call <a href="tel:${telOf(m.phone)}">${esc(m.phone)}</a></p>` : ''}</form>`
      : (panelData(m) ? panelHTML(panelData(m)) : (m.photos.length ? ph(m, 0) : ''));
    return `<section class="t-hero" data-layout="form"${mq}>${bgDiv(st)}<div class="t-wrap"><div class="t-hero-body"><div class="t-hero-copy">${p.eyebrow}${p.h1}${p.lead}${f ? (m.cta2 ? `<a class="t-link" href="${esc(m.cta2.href)}">${esc(m.cta2.text)} →</a>` : '') : p.actions}</div>${side}</div></div>${marquee(st, m)}</section>`;
  }
  if (kind === 'strip') return `<section class="t-hero" data-layout="strip"${mq}>${bgDiv(st)}<div class="t-wrap"><div class="t-strip">${p.eyebrow}${p.h1}<div class="t-strip-row">${p.lead}${p.actions}</div><div class="t-strip-imgs">${[0, 1, 2].map(i => ph(m, i, featIcon(m, i))).join('')}</div></div></div>${marquee(st, m)}</section>`;
  if (kind === 'mosaic') return `<section class="t-hero" data-layout="mosaic"${mq}>${bgDiv(st)}<div class="t-wrap"><div class="t-hero-body"><div class="t-hero-copy">${p.eyebrow}${p.h1}${p.lead}${p.actions}${p.trust}</div><div class="t-mosaic">${[0, 1, 2].map(i => ph(m, i, featIcon(m, i))).join('')}${p.float}</div></div></div>${marquee(st, m)}</section>`;
  // half: text on one side, a full-height photo on the other with the info panel over it
  const pd = panelData(m);
  return `<section class="t-hero t-half" data-layout="half">${bgDiv(st)}<div class="t-half-grid"><div class="t-half-copy">${p.eyebrow}${p.h1}${p.lead}${p.actions}${p.trust}</div><div class="t-half-media">${ph(m, 0, featIcon(m, 0))}${pd ? panelHTML(pd) : ''}</div></div>${marquee(st, m)}</section>`;
}

function featuresHTML(st, m) {
  if (m.feats.length < 2) return '';
  const fh = m.featHead;
  const head = `<div class="t-sec-head" data-animate="fade-up"><span class="t-eyebrow">${esc(fh.eyebrow)}</span><h2 class="t-h2 t-disp">${esc(fh.h2)}</h2>${fh.lead ? `<p class="t-lead">${esc(fh.lead)}</p>` : ''}</div>`;
  const kind = st.feat;
  const list = m.feats.slice(0, kind === 'menu' ? 6 : 4);
  const title = (x) => x.href ? `<a href="${esc(x.href)}">${esc(x.title)}</a>` : esc(x.title);
  const cards = list.map(x => `<article class="t-card"><span class="t-ico">${svgIcon(x.icon)}</span><div class="t-card-txt"><h3 class="t-disp">${title(x)}</h3>${x.text ? `<p>${esc(x.text)}</p>` : ''}</div></article>`).join('');
  const fs = m.featStat;
  const stat = fs ? `<div class="t-stat"><b class="t-disp">${esc(fs.value)}</b><span>${esc(fs.label)}</span></div>` : '';
  const inline = fs ? `<div class="t-stat-inline"><b class="t-disp">${esc(fs.value)}</b><span>${esc(fs.label)}</span></div>` : '';
  let inner;
  if (kind === 'bento') inner = head + `<div class="t-bento" data-animate="stagger">${cards}${stat}</div>`;
  else if (kind === 'rows') inner = `<div class="t-split"><div class="t-side">${head}${stat}</div><div class="t-list" data-animate="stagger">${cards}</div></div>`;
  else if (kind === 'steps') inner = `<div class="t-head-row">${head}${inline}</div><ol class="t-steps" data-animate="stagger">${list.map((x, i) => `<li class="t-card"><div class="t-step-top"><span class="t-step-n t-disp">0${i + 1}</span><span class="t-ico">${svgIcon(x.icon)}</span></div><div class="t-card-txt"><h3 class="t-disp">${title(x)}</h3>${x.text ? `<p>${esc(x.text)}</p>` : ''}</div></li>`).join('')}</ol>`;
  else if (kind === 'minimal') inner = `<div class="t-head-row">${head}${inline}</div><div class="t-minimal" data-animate="stagger">${cards}</div>`;
  else if (kind === 'collage') inner = head + `<div class="t-collage" data-animate="stagger">${cards}${stat}</div>`;
  else if (kind === 'menu') inner = `<div class="t-head-row">${head}${inline}</div><div class="t-menu" data-animate="stagger">${list.map(x => `<div class="t-menu-item"><span class="t-ico">${svgIcon(x.icon)}</span><div class="t-menu-body"><div class="t-menu-top"><h3 class="t-disp">${title(x)}</h3><span class="t-leader"></span>${x.price ? `<b>${esc(x.price)}</b>` : ''}</div>${x.text ? `<p>${esc(x.text)}</p>` : ''}</div></div>`).join('')}</div>`;
  else inner = `<div class="t-split"><div class="t-side">${head}${stat}</div><div class="t-grid2" data-animate="stagger">${cards}</div></div>`;
  const more = fh.more ? `<p style="margin-top:32px"><a class="t-link" href="${esc(fh.more)}">See all services →</a></p>` : '';
  return `<section class="t-sec t-feat">${st.featBg ? `<div class="t-bg" data-bg="${st.featBg}"></div>` : ''}<div class="t-wrap">${inner}${more}</div></section>`;
}

function quoteHTML(st, m, bp) {
  if (!m.reviews) return '';
  const q = m.reviews.items[0];
  const side = bp === 'D';
  const ini = String(q.name || '').replace(/[^A-Za-z ]/g, '').split(' ').filter(w => w && w !== 'The' && w !== 'family').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '★';
  const stars = q.rating > 0 ? `<div class="t-stars" aria-label="Rated ${Math.min(5, q.rating)} out of 5">${'★'.repeat(Math.min(5, Math.round(q.rating)))}</div>` : '';
  const who = q.name ? `<figcaption>${q.photo ? `<img class="t-avatar" src="${esc(q.photo)}" alt="" loading="lazy" style="object-fit:cover">` : `<span class="t-avatar" aria-hidden="true">${esc(ini)}</span>`}<div><b>${esc(q.name)}</b>${q.role ? `<span>${esc(q.role)}</span>` : ''}</div></figcaption>` : '';
  const more = m.reviews.moreHref && m.reviews.items.length > 1 ? `<a class="t-link t-quote-more" href="${esc(m.reviews.moreHref)}">${esc(m.reviews.moreText)} →</a>` : '';
  const fig = `<figure class="t-quote-fig" data-animate="fade-up">${stars}<blockquote class="t-disp">“${esc(q.quote)}”</blockquote>${who}${more}</figure>`;
  return `<section class="t-sec t-quote"${side ? ' data-side' : ''}><div class="t-wrap">${side ? `<div class="t-quote-grid">${ph(m, 3 % Math.max(1, m.photos.length || 4), featIcon(m, 3))}${fig}</div>` : fig}</div></section>`;
}

function statsHTML(st, m) {
  const items = m.stats.length >= 2 ? m.stats.slice(0, 4) : [];
  if (m.rating && items.length >= 2 && items.length < 4) items.push(m.rating);
  if (items.length < 2) return '';
  return `<section class="t-statband"><div class="t-wrap"><ul data-animate="stagger">${items.map(t => `<li><b class="t-disp"${t.countAttrs || ''}>${esc(t.value)}</b><span>${esc(t.label)}</span></li>`).join('')}</ul></div></section>`;
}

function galleryHTML(st, m) {
  if (!m.gallery && m.photos.length < 4) return '';
  if (m.photos.length < 4) return '';
  const g = (m.gallery && m.gallery.heading) || 'Gallery';
  const more = m.gallery && m.gallery.moreHref ? `<p style="margin-top:28px"><a class="t-link" href="${esc(m.gallery.moreHref)}">See all photos →</a></p>` : '';
  return `<section class="t-sec t-gallery"><div class="t-wrap"><div class="t-sec-head" data-animate="fade-up"><span class="t-eyebrow">In pictures</span><h2 class="t-h2 t-disp">${esc(g)}</h2></div><div class="t-gal">${[1, 2, 3, 0].map(i => ph(m, i)).join('')}</div>${more}</div></section>`;
}

function storyHTML(st, m) {
  const items = m.services.slice(0, 2);
  if (items.length < 2) return '';
  return `<section class="t-sec t-story"><div class="t-wrap">${items.map((x, i) => {
    const img = x.imageUrl ? `<figure class="t-ph" data-i="${(i + 1) % 4}"><img src="${esc(x.imageUrl)}" alt="${esc(x.title)}" loading="lazy" decoding="async"></figure>` : ph(m, i + 1, x.icon);
    return `<div class="t-story-row"${i ? ' data-rev' : ''}>${img}<div class="t-story-copy" data-animate="fade-up"><span class="t-eyebrow">${esc(m.featHead.eyebrow)}</span><h3 class="t-h2 t-disp">${esc(x.title)}</h3>${x.description ? `<p class="t-lead">${esc(x.description)}</p>` : ''}<a class="t-link" href="${esc(x.href)}">Learn more →</a></div></div>`;
  }).join('')}</div></section>`;
}

function faqHTML(st, m) {
  if (!m.faq) return '';
  const lead = m.phone ? `Still unsure? Call <a href="tel:${telOf(m.phone)}">${esc(m.phone)}</a> and talk to a real person.` : `Still unsure? <a href="${esc(m.contactHref)}">Send us a message</a>.`;
  return `<section class="t-sec t-faq"><div class="t-wrap t-faq-grid"><div class="t-faq-side"><span class="t-eyebrow">FAQ</span><h2 class="t-h2 t-disp">${esc(m.faq.heading)}</h2><p class="t-lead">${lead}</p>${m.faq.moreHref ? `<a class="t-link" href="${esc(m.faq.moreHref)}">All questions →</a>` : ''}</div><div class="t-faq-list">${m.faq.items.map((x, i) => `<details${i === 0 ? ' open' : ''}><summary>${esc(x.question)}</summary><p>${esc(x.answer)}</p></details>`).join('')}</div></div></section>`;
}

function areaHTML(st, m) {
  if (!m.areas) return '';
  const lead = [m.address ? `Based at ${m.address}.` : '', m.sub].filter(Boolean).join(' ');
  return `<section class="t-sec t-area"><div class="t-wrap t-area-grid"><div class="t-area-copy" data-animate="fade-up"><span class="t-eyebrow">Service area</span><h2 class="t-h2 t-disp">${esc(m.areas.heading)}</h2>${lead ? `<p class="t-lead">${esc(lead)}</p>` : ''}<ul class="t-towns">${m.areas.items.slice(0, 12).map(a => `<li>${a.href ? `<a href="${esc(a.href)}">${esc(a.name)}</a>` : esc(a.name)}</li>`).join('')}</ul></div><div class="t-map" role="img" aria-label="${esc(m.name)} service area"><span class="t-pin">${svgIcon(PIN)}</span><span class="t-map-label">${esc(m.city || m.name)}</span></div></div></section>`;
}

function pricingHTML(st, m) {
  if (!m.pricing) return '';
  return `<section class="t-sec t-pricing"><div class="t-wrap"><div class="t-sec-head t-center" data-animate="fade-up"><span class="t-eyebrow">Pricing</span><h2 class="t-h2 t-disp">${esc(m.pricing.heading)}</h2></div><div class="t-plans" data-animate="stagger">${m.pricing.items.map(pl => `<div class="t-plan"><h3 class="t-disp">${esc(pl.title)}</h3><div class="t-price"><b>${esc(pl.price)}</b></div>${pl.description ? `<p>${esc(pl.description)}</p>` : ''}<a class="t-btn t-btn-ghost" href="${esc(pl.href)}">Details</a></div>`).join('')}</div></div></section>`;
}

function ctaHTML(st, m) {
  if (!m.phone && !m.email && !m.form) return '';
  const h = `Talk to ${m.name}`;
  const p = m.hours ? `Open ${m.hours}.` : '';
  const b1 = `<a class="t-btn" href="${esc(m.contactHref)}">${esc(m.cta1.text)}</a>`;
  const b2 = m.phone ? `<a class="t-btn t-btn-ghost" href="tel:${telOf(m.phone)}">${esc(m.phone)}</a>` : '';
  let cta;
  if (st.cta === 'band') cta = `<div class="t-band"><div class="t-band-copy"><h2 class="t-h2 t-disp">${esc(h)}</h2><p>${esc(p)}</p></div><div class="t-actions"><a class="t-btn t-btn-inv" href="${esc(m.contactHref)}">${esc(m.cta1.text)}</a>${m.phone ? `<a class="t-btn t-btn-line" href="tel:${telOf(m.phone)}">${esc(m.phone)}</a>` : ''}</div></div>`;
  else if (st.cta === 'giant') cta = `<div class="t-giant"><span class="t-eyebrow">Get started</span><h2 class="t-giant-h t-disp">${emphasize(h)}</h2><div class="t-giant-row">${p ? `<p class="t-lead">${esc(p)}</p>` : '<span></span>'}<div class="t-actions">${b1}${b2}</div></div></div>`;
  else if (st.cta === 'split' && m.contactRows.length >= 2) cta = `<div class="t-ctasplit"><div class="t-ctasplit-copy"><span class="t-eyebrow">Get started</span><h2 class="t-h2 t-disp">${esc(h)}</h2>${m.sub ? `<p class="t-lead">${esc(m.sub)}</p>` : ''}<div class="t-actions">${b1}${b2}</div></div>${panelHTML({ title: 'Contact us', chip: m.city, rows: m.contactRows, foot: m.badges.slice(0, 3).join(' · ') })}</div>`;
  else cta = `<div class="t-ctacard"><div class="t-bg" data-bg="glow"></div><span class="t-eyebrow">Get started</span><h2 class="t-h2 t-disp">${esc(h)}</h2>${p ? `<p class="t-lead">${esc(p)}</p>` : ''}<div class="t-actions">${b1}${b2}</div></div>`;
  return `<section class="t-cta"><div class="t-wrap" data-animate="fade-up">${cta}</div></section>`;
}

const SECTIONS = { features: featuresHTML, quote: quoteHTML, stats: statsHTML, gallery: galleryHTML, story: storyHTML, faq: faqHTML, area: areaHTML, pricing: pricingHTML, cta: ctaHTML };
// which editor box holds each section's content (for the section hover outline and tests)
const FAMILY = { hero: 'hero', features: 'services', quote: 'testimonials', stats: 'stats', gallery: 'gallery', story: 'services', faq: 'faq', area: 'areas', pricing: 'pricing', cta: 'contact' };

// The whole home page body. ctx: { site, basePath, services, areas, navPages, preview, staticExport, netlifyForms, still }
// heroOnly draws just the hero (the style browser's thumbnails).
function render(ctx, heroOnly) {
  const st = lib.get(ctx.site.theme && ctx.site.theme.style);
  if (!st) return { html: '', sections: [] };
  const bp = lib.blueprintOf(st, ctx.site.theme);
  const m = model(ctx);
  const out = [['hero', heroHTML(st, m, bp)]].concat(heroOnly ? [] : lib.BLUEPRINTS[bp].secs.map(k => [k, SECTIONS[k](st, m, bp)])).filter(x => x[1]);
  const html = `<div class="tpl" ${lib.wrapAttrs(st)}${ctx.still ? ' data-still' : ''} data-sl-style="${st.id}" data-sl-blueprint="${bp}" style="${esc(lib.tokens(st, ctx.site.theme))}">`
    + out.map(([k, h]) => `<div class="sl-sec" data-sl-sec="${k}" data-sl-fam="${FAMILY[k]}">${h}</div>`).join('') + '</div>';
  return { html, sections: out.map(x => x[0]), blueprint: bp };
}

module.exports = { render, model, emphasize, plain, hoursLine, ratingOf, SECTIONS, FAMILY, heroHTML };
