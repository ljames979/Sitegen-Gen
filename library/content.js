// Content binders: turn a site's real content into the plain data object a library template renders.
// Every binder returns null when there is nothing real to show, so a blueprint skips that section instead of
// rendering an empty or invented one. Nothing here makes up text: headings come from the site's own section
// headings, and the only fallbacks are plain labels ("Why choose us").
const { countAttrs } = require('../motion-presets');
const { iconPath } = require('../icons');
const scrimHero = require('../scrimhero');
const contrast = require('../contrast');

const clip = (s, n) => {
  s = String(s || '').trim();
  return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s;
};
const telOf = p => String(p || '').replace(/[^0-9+]/g, '');
// The line icon the owner picked for each Why choose us reason (the same drawings the classic section uses)
const WHY_ICONS = {
  check: '<polyline points="20 6 9 17 4 12"/>',
  dollar: '<path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  shield: '<path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  people: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  tools: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  truck: '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 11 13 11 10"/>',
  home: '<path d="M3 9l9-7 9 7"/><path d="M9 22V12h6v10"/>'
};
// Prices live in two places: a service's own price (from the questionnaire) or the matching booking service.
const priceOf = (ctx, svc) => {
  if (svc.price) return String(svc.price);
  const bk = ((ctx.site.sections.booking || {}).services || []).find(b => b.name && b.name.trim().toLowerCase() === String(svc.title || '').trim().toLowerCase());
  return bk && bk.price ? (/^\d/.test(bk.price) ? '$' + bk.price : String(bk.price)) : '';
};
// A headline with [square brackets] around the words to highlight, as safe HTML: the words in an <em class="sg-hl">,
// the brackets never shown
const escHtml = (t) => String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hlHtml = (t) => escHtml(t).replace(/\[([^\]]+)\]/g, '<em class="sg-hl">$1</em>').replace(/[\[\]]/g, '');
const pageHref = (ctx, ...keys) => { const p = (ctx.navPages || []).find(x => keys.includes(x.key)); return p ? p.href : ''; };

// The little moving object beside a number on the "Moving objects" stats cards, picked from the number's own label
function statKind(label) {
  const l = String(label || '').toLowerCase();
  if (/year|yrs|since|experience|decade/.test(l)) return 'clock';
  if (/review|rating|rated|star/.test(l)) return 'stars';
  if (/town|cit(y|ies)|area|mile|count(y|ies)|location|state|neighbo/.test(l)) return 'pin';
  if (/home|house|customer|client|famil|household|owner/.test(l)) return 'house';
  if (/job|project|roof|install|repair|done|complete|built|fix|service|clean/.test(l)) return 'gear';
  return 'pulse';
}
// The Showcase hero's gliding cards: the hero photo, service photos (with the service's name), the About photo and the
// gallery, each photo once. Fewer than 3 photos don't make a strip.
function glidePhotos(ctx) {
  const s = ctx.site.sections, g = s.gallery || {}, seen = new Set(), out = [];
  const add = (src, label, alt) => { if (!src || seen.has(src) || out.length >= 10) return; seen.add(src); out.push({ src, label: label || '', alt: alt || label || `${ctx.site.name} photo` }); };
  add((s.hero || {}).imageUrl, '', (s.hero || {}).imageAlt);
  (ctx.services || []).forEach(x => add(x.imageUrl, x.title, x.title));
  add((s.about || {}).imageUrl, '', (s.about || {}).imageAlt);
  (g.images || []).forEach((src, i) => add(src, '', (g.alts || [])[i]));
  return out.length >= 3 ? out : [];
}
// The Word carousel collage hero (Leo's video, 2026-10-28): the service names in one sliding row, each with its own
// photo for the center card (else the next of the site's photos), and the site's photos scattered around it. Needs
// 3 service names and 3 photos; without them the hero is the headline and buttons alone.
function collageOf(ctx) {
  const photos = glidePhotos(ctx).map(p => p.src);
  const words = (ctx.services || []).filter(x => x.title).slice(0, 8)
    .map((x, i) => ({ t: x.title, href: `${ctx.basePath}/services/${x.slug}`, src: x.imageUrl || photos[i % (photos.length || 1)] || '' }));
  if (words.length < 3 || photos.length < 3) return null;
  const tiles = [];
  for (let i = 0; i < 6; i++) tiles.push(photos[(i + 1) % photos.length]);
  return { words, photos, tiles, moreHref: pageHref(ctx, 'services') };
}
// The Scroll-through hero's photos: the hero photo and the extra hero photos the owner added, each once (up to 8)
function scrubPhotos(ctx) {
  const h = ctx.site.sections.hero || {}, seen = new Set(), out = [];
  [h.imageUrl].concat(h.slides || []).forEach(src => { if (src && !seen.has(src) && out.length < 8) { seen.add(src); out.push({ src }); } });
  return out;
}
// The proof bar under the Showcase hero. Each part only appears when the site has it:
// stat: the first number from the trust stats, or the average star rating when at least 3 reviews have one;
// marks: certification logos, else the badges (Licensed, Insured...), shown one after another;
// reviews: up to 5 real reviews, shown one after another.
function proofBar(ctx) {
  const s = ctx.site.sections, t = s.trust || {};
  const st = (t.stats || []).find(x => x.value && x.label);
  const rated = ((s.testimonials || {}).items || []).filter(r => r.quote && +r.rating >= 1 && +r.rating <= 5);
  let stat = st ? { value: st.value, label: st.label, countAttrs: countAttrs(st.value) } : null;
  if (!stat && rated.length >= 3) {
    const avg = rated.reduce((a, r) => a + +r.rating, 0) / rated.length;
    stat = { value: avg.toFixed(1) + '\u2605', label: `from ${rated.length} reviews`, countAttrs: '' };
  }
  const logos = (t.logos || []).filter(l => l.imageUrl).slice(0, 8).map(l => ({ src: l.imageUrl, alt: l.label || 'Logo', label: l.label || '' }));
  const marks = logos.length ? logos : (t.badges || []).map(b => String(b || '').trim()).filter(Boolean).slice(0, 8).map(label => ({ src: '', alt: '', label }));
  const reviews = ((s.testimonials || {}).items || []).filter(r => r.quote).slice(0, 5)
    .map(r => ({ quote: clip(r.quote, 130), name: r.author || r.name || '', photo: r.photo || '', rating: +r.rating || 0 }));
  if (!stat && !marks.length && !reviews.length) return null;
  return { stat, marks, reviews };
}

// The small letter-spaced label over the blended photo hero: the owner's own words, else "Roofer · Orlando, FL"
function heroEyebrow(s) {
  const h = s.hero || {}, m = s.meta || {};
  if (String(h.eyebrow || '').trim()) return String(h.eyebrow).trim();
  return [String(m.businessType || '').trim(), String(m.city || '').trim()].filter(Boolean).join(' \u00b7 ');
}
// The pill button's color: the brand color, the accent color or a bright lime, each with readable words on it
function pillVars(theme, pick) {
  const t = theme || {}, c = pick === 'accent' ? t.accentColor : pick === 'lime' ? '#d4f57a' : t.primaryColor;
  const bg = /^#[0-9a-f]{6}$/i.test(c || '') ? c : '#2563eb';
  return `--blend-pill: ${bg}; --blend-pill-ink: ${contrast.textOn(bg)}`;
}

const BINDERS = {
  hero(ctx) {
    const s = ctx.site.sections, h = s.hero || {};
    if (!String(h.headline || '').trim()) return null;
    const link = h.ctaLink && h.ctaLink !== '#contact' ? h.ctaLink : ctx.basePath + '/contact';
    const c = s.contact || {};
    const t = ctx.site.sections.trust || {};
    const stats = (t.stats || []).filter(x => x.value && x.label).slice(0, 3).map(x => ({ value: x.value, label: x.label, countAttrs: countAttrs(x.value) }));
    const trust = String(h.trustText || '').split('•').map(x => x.trim()).filter(Boolean).slice(0, 4);
    const extra = [(s.about || {}).imageUrl].concat(((s.gallery || {}).images || []).slice(0, 3)).filter(u => u && u !== h.imageUrl);
    return {
      stats: stats.length >= 2 ? stats : [], trust, images: [h.imageUrl].concat(extra).filter(Boolean).slice(0, 3),
      headline: h.headline, headlineHtml: hlHtml(h.headline), sub: h.subheadline || '', image: h.imageUrl || '',
      ctaText: h.ctaText || 'Contact us', ctaHref: link, phone: c.phone || '', phoneHref: telOf(c.phone),
      // Image + Scrim hero: the owner's own feature cards, text side, scrim strength and layout
      cards: (h.cards || []).filter(x => x && x.title).slice(0, 4), align: ['left', 'center', 'right'].includes(h.align) ? h.align : 'left',
      focal: `${+h.focalX >= 0 ? +h.focalX : 50}% ${+h.focalY >= 0 ? +h.focalY : 50}%`,
      scrimLayout: scrimHero.clean(h).scrimLayout, scrimVars: scrimHero.styleVars(scrimHero.colors(ctx.site.theme, scrimHero.clean(h).scrim)),
      // Showcase hero: the site's own photos as gliding cards, and a proof bar of real numbers, badges and reviews
      glide: glidePhotos(ctx), proof: proofBar(ctx),
      // Scroll-through hero: the owner's hero photos, stepped through as the page scrolls
      scrub: scrubPhotos(ctx),
      // Word carousel collage hero: service names sliding through a center photo card, photos scattered around
      collage: collageOf(ctx),
      // Floating 3D shapes hero: the owner's own background video file, opened from the spinning ring
      video: /^(https:\/\/|\/uploads\/)[^\s"'<>]+\.(mp4|webm)(\?[^\s"'<>]*)?$/i.test(h.videoUrl || '') ? h.videoUrl : '',
      // Photo with the header blended in: a small label (the owner's, or the kind of business and the city) and the pill color
      eyebrow: heroEyebrow(s), pillVars: pillVars(ctx.site.theme, h.pill),
      // check-mark list beside the headline: the owner's trust line, then their badges (Licensed, Insured...)
      checks: trust.concat((t.badges || []).map(b => String(b || '').trim())).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).slice(0, 6),
    };
  },
  about(ctx) {
    const a = ctx.site.sections.about || {};
    const body = String(a.body || '').trim();
    if (!body) return null;
    // extra photos for the collage, offset and strip layouts come from the client's own gallery
    const images = [a.imageUrl].concat(((ctx.site.sections.gallery || {}).images || []).filter(u => u && u !== a.imageUrl)).filter(Boolean).slice(0, 4);
    const st = ((ctx.site.sections.trust || {}).stats || []).find(x => x.value && x.label);
    const rv = ((ctx.site.sections.testimonials || {}).items || []).find(r => r.quote);
    return {
      heading: a.heading || 'About us', body: clip(body, 480), bodyFull: clip(body, 1600), image: a.imageUrl || '', images,
      imageAlt: a.imageAlt || ctx.site.name, moreHref: pageHref(ctx, 'about'),
      stat: st ? { value: st.value, label: st.label, countAttrs: countAttrs(st.value) } : null,
      quote: rv ? { text: clip(rv.quote, 220), name: rv.author || rv.name || '' } : null,
    };
  },
  services(ctx) {
    const items = (ctx.services || []).filter(x => x.title).slice(0, 6).map(x => ({
      title: x.title, description: clip(x.description, 140), price: priceOf(ctx, x),
      imageUrl: x.imageUrl || '', image2: x.imageUrl ? (x.image2 || '') : '', href: `${ctx.basePath}/services/${x.slug}`, icon: iconPath(x.title, x.icon),
    }));
    if (!items.length) return null;
    return { heading: (ctx.site.sections.services || {}).heading || 'What we offer', items, moreHref: pageHref(ctx, 'services') };
  },
  why(ctx) {
    const w = ctx.site.sections.whyChoose || {};
    const items = (w.items || []).filter(i => i.title || i.text).slice(0, 4).map(i => ({ title: i.title || '', text: i.text || '', imageUrl: i.imageUrl || '', icon: WHY_ICONS[i.icon] || WHY_ICONS.check }));
    if (items.length < 2) return null;
    // one photo beside the reasons: a reason's own photo, else the About photo
    const image = (items.find(i => i.imageUrl) || {}).imageUrl || ((ctx.site.sections.about || {}).imageUrl || '');
    return { heading: w.heading || 'Why choose us', items, image };
  },
  stats(ctx) {
    const t = ctx.site.sections.trust || {};
    const items = (t.stats || []).filter(s => s.value && s.label).slice(0, 4).map(s => ({ value: s.value, label: s.label, countAttrs: countAttrs(s.value), kind: statKind(s.label) }));
    return items.length >= 2 ? { items } : null;
  },
  testimonials(ctx) {
    const t = ctx.site.sections.testimonials || {};
    const items = (t.items || []).filter(r => r.quote).slice(0, 6).map(r => ({
      quote: clip(r.quote, 280), name: r.author || r.name || '', role: r.date || '', rating: +r.rating || 0, photo: r.photo || '',
    }));
    if (!items.length) return null;
    return { heading: t.heading || 'What customers say', items, moreHref: pageHref(ctx, 'testimonials', 'reviews'), moreText: 'Read more reviews' };
  },
  pricing(ctx) {
    const items = (ctx.services || []).filter(x => x.title && priceOf(ctx, x)).slice(0, 3).map(x => ({
      title: x.title, price: priceOf(ctx, x), description: clip(x.description, 120), href: `${ctx.basePath}/services/${x.slug}`,
    }));
    if (items.length < 2) return null;
    return { heading: 'Pricing', items, ctaHref: ctx.basePath + '/contact' };
  },
  faq(ctx) {
    const f = ctx.site.sections.faq || {};
    const items = (f.items || []).filter(q => q.question && q.answer).slice(0, 6);
    if (!items.length) return null;
    const c = ctx.site.sections.contact || {};
    return { heading: f.heading || 'Frequently asked questions', items, ctaHref: ctx.basePath + '/contact', phone: c.phone || '', phoneHref: telOf(c.phone), moreHref: (f.items || []).length > items.length ? pageHref(ctx, 'faq') : '' };
  },
  gallery(ctx) {
    const g = ctx.site.sections.gallery || {};
    const all = (g.images || []).filter(Boolean);
    const imgs = all.slice(0, all.length >= 6 ? 6 : 3); // whole rows only
    if (imgs.length < 3) return null;
    return {
      heading: g.heading || 'Gallery',
      // caption: the owner's own words for the photo (its alt text), shown by the portfolio and edge-to-edge layouts
      images: imgs.map((src, i) => ({ src, alt: (g.alts || [])[i] || `${ctx.site.name} photo`, caption: String((g.alts || [])[i] || '').trim() })),
      // masonry, filmstrip and carousel layouts show more than whole rows
      all: all.slice(0, 12).map((src, i) => ({ src, alt: (g.alts || [])[i] || `${ctx.site.name} photo`, caption: String((g.alts || [])[i] || '').trim() })),
      moreHref: all.length > imgs.length ? pageHref(ctx, 'gallery') : '',
      // the floating tags beside the Card fan and Grid zoom photos: the client's own service names only
      tags: (ctx.services || []).map(x => String(x.title || '').trim()).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).slice(0, 4),
    };
  },
  areas(ctx) {
    const list = (ctx.areas || []).filter(a => a.name).slice(0, 24);
    if (!list.length) return null;
    return { heading: 'Areas we serve', items: list.map(a => ({ name: a.name, href: a.text ? `${ctx.basePath}/areas/${a.slug}` : '' })) };
  },
  cta(ctx) {
    const s = ctx.site.sections, c = s.contact || {}, h = s.hero || {};
    if (!c.phone && !c.email && !c.acceptSubmissions) return null;
    return {
      heading: `Talk to ${ctx.site.name}`, text: '', ctaText: h.ctaText || 'Contact us',
      // a photo for the card and circle layouts: the About photo, else the hero photo
      image: (s.about || {}).imageUrl || h.imageUrl || '',
      ctaHref: h.ctaLink && h.ctaLink !== '#contact' ? h.ctaLink : ctx.basePath + '/contact',
      phone: c.phone || '', phoneHref: telOf(c.phone),
    };
  },
  contact(ctx) {
    const c = ctx.site.sections.contact || {};
    const items = [];
    if (c.phone) items.push({ kind: 'call', label: 'Call', value: c.phone, href: 'tel:' + telOf(c.phone) });
    if (c.phone) items.push({ kind: 'text', label: 'Text', value: c.phone, href: 'sms:' + telOf(c.phone) });
    if (c.email) items.push({ kind: 'email', label: 'Email', value: c.email, href: 'mailto:' + c.email });
    if (c.address) items.push({ kind: 'visit', label: 'Visit', value: c.address, href: 'https://maps.google.com/?q=' + encodeURIComponent(c.address) });
    if (!items.length) return null;
    return { heading: 'Get in touch', items, ctaText: 'Send a message', ctaHref: ctx.basePath + '/contact',
      address: c.address || '', mapSrc: c.address ? 'https://maps.google.com/maps?q=' + encodeURIComponent(c.address) + '&output=embed' : '' };
  },
  banner(ctx) {
    // phrases come from what the client gave us: trust badges, then service names, then towns
    const t = ctx.site.sections.trust || {};
    const items = [].concat(t.badges || [], (ctx.services || []).map(x => x.title), (ctx.areas || []).map(a => a.name))
      .map(x => String(x || '').trim()).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).slice(0, 8);
    return items.length >= 3 ? { items } : null;
  },
  bento(ctx) {
    // an overview made only of what the client gave us; needs a photo and at least two other kinds of tile
    const s = ctx.site.sections, c = s.contact || {};
    const photos = [(s.hero || {}).imageUrl, (s.about || {}).imageUrl].concat((s.gallery || {}).images || []).filter(Boolean)
      .filter((u, i, a) => a.indexOf(u) === i).slice(0, 2).map(src => ({ src, alt: ctx.site.name }));
    const stats = ((s.trust || {}).stats || []).filter(x => x.value && x.label).slice(0, 2).map(x => ({ value: x.value, label: x.label, countAttrs: countAttrs(x.value) }));
    const services = (ctx.services || []).filter(x => x.title).slice(0, 5).map(x => ({ title: x.title, href: `${ctx.basePath}/services/${x.slug}` }));
    const rv = ((s.testimonials || {}).items || []).find(r => r.quote);
    const review = rv ? { text: clip(rv.quote, 200), name: rv.author || rv.name || '', rating: +rv.rating || 0 } : null;
    const kinds = (stats.length ? 1 : 0) + (services.length ? 1 : 0) + (review ? 1 : 0) + (c.phone ? 1 : 0);
    if (!photos.length || kinds < 2) return null;
    return {
      heading: 'At a glance', photos, stats, services, servicesHeading: (s.services || {}).heading || 'What we offer', servicesHref: pageHref(ctx, 'services'),
      review, place: ((s.meta || {}).city || '').trim(), phone: c.phone || '', phoneHref: telOf(c.phone), ctaText: 'Get in touch', ctaHref: ctx.basePath + '/contact',
    };
  },
  logos(ctx) {
    const t = ctx.site.sections.trust || {};
    const items = (t.logos || []).filter(l => l.imageUrl).slice(0, 8).map(l => ({ src: l.imageUrl, alt: l.label || 'Logo' }));
    return items.length ? { heading: t.logosHeading || '', items } : null;
  },
};

// "Your own sections": an owner-written section with words, photos, or both. layout 'auto' picks from what was filled in:
// words only -> text, one photo only -> photo, several photos -> photos, words and one photo -> photo/text (alternating sides).
function bindCustom(item, ctx, index = 0) {
  const heading = String(item.heading || '').trim(), body = String(item.body || '').trim();
  const imgs = (item.images || []).filter(Boolean).slice(0, 4);
  if (!heading && !body && !imgs.length) return null;
  let layout = item.layout;
  const words = !!(heading || body), n = imgs.length;
  const valid = { text: true, 'photo-text': n >= 1, 'text-photo': n >= 1, photo: n >= 1, photos: n >= 2,
    overlap: n >= 1 && words, offset: n >= 2 && words, collage: n >= 3 && words, sticky: n >= 1 && words, frosted: n >= 1 && words,
    editorial: !!(heading && body), magazine: !!body, strip: n >= 2 && words, bleed: n >= 1 && words };
  if (!valid[layout]) layout = null;
  if (!layout) layout = !imgs.length ? 'text' : (heading || body) ? (imgs.length >= 2 ? 'photos' : index % 2 ? 'text-photo' : 'photo-text') : imgs.length === 1 ? 'photo' : 'photos';
  const href = String(item.buttonUrl || '');
  const d = { heading, body, images: imgs.map(src => ({ src, alt: heading || ctx.site.name })), buttonText: item.buttonText && href ? item.buttonText : '', buttonHref: href };
  if (layout === 'text') d.images = [];
  return { layout, d };
}

const FAMILIES = Object.keys(BINDERS);
function bind(family, ctx) { const f = BINDERS[family]; return f ? f(ctx) : null; }
module.exports = { bind, bindCustom, FAMILIES, BINDERS, hlHtml, statKind };
