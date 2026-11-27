// Sign up, log in, dashboard, new sites (import, generate, drafts), AI copy and photo search
// server.js calls this where these routes belong in its route order and hands it the shared helpers they use.
const ROOT = require('path').join(__dirname, '..');
const fs = require('fs');
const autosite = require('../autosite');
const brandKit = require('../brandkit');
const { safeFetch } = require('../scraper');
const UPLOADS_DIR = require('path').join(ROOT, 'public', 'uploads');

const prospectsLib = require('../prospects');
const modernize = require('../modernize');
const grounding = require('../grounding');
const fontsLib = require('../fonts');
const { generateGroundedCopy } = require('../ai');
const aibuild = require('../aibuild');
const improve = require('../improve');

module.exports = function (app, deps) {
  const {
    aiComplete, applySocialInspiration, atelier, authLimiter, bcrypt, booking, chatedit, colorForCategory,
    crypto, darkenHex, db, defaultLayout, defaultSections, defaultTheme, designBrief, extraThemes, fetchPhotoSet,
    fillTemplate, findTemplate, generateCopy, generateLimiter, hasAiProvider, hasPhotoProvider, hydrateSite,
    importLimiter, industryDesign, intake, invalidateSiteCache, isAdmin, isSafeUrl, isTestEnv, isValidEmail,
    isValidHexColor, isValidPassword, loadOwnedSite, mergeSectionsWithDefaults, nanoid, path, photoCredits,
    pickerSources, rateLimit, recentUnsplash, renderSitePage, requireAuth, saveVersion, scrapeSocialInspiration,
    scrapeUrl, searchPhotosPage, searchUnsplashPage, sectionLibraryRegistry, splitList, str, styleSwap,
    templateLooks, trackUnsplashDownload, uniqueSlug, upload
  } = deps;

  // ---- auth routes ----
  app.get('/', (req, res) => {
    if (req.session.userId) return res.redirect('/dashboard');
    res.render('home');
  });

  app.get('/signup', (req, res) => res.render('signup', { error: null }));

  app.post('/signup', authLimiter, (req, res) => {
    const email = str(req.body.email, 254).toLowerCase();
    const password = req.body.password || '';
    if (!isValidEmail(email) || !isValidPassword(password)) {
      return res.render('signup', { error: 'Please provide a valid email and a password of at least 6 characters.' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.render('signup', { error: 'An account with that email already exists.' });
    }
    const hash = bcrypt.hashSync(password, 10);
    const info = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, hash);
    req.session.userId = info.lastInsertRowid;
    res.redirect('/dashboard');
  });

  app.get('/login', (req, res) => res.render('login', { error: null }));

  app.post('/login', authLimiter, (req, res) => {
    const email = str(req.body.email, 254).toLowerCase();
    const password = req.body.password || '';
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.render('login', { error: 'Invalid email or password.' });
    }
    req.session.userId = user.id;
    res.redirect('/dashboard');
  });

  app.post('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
  });

  // ---- dashboard ----
  function listSites(userId) {
    return db.prepare('SELECT * FROM sites WHERE user_id = ? ORDER BY updated_at DESC').all(userId);
  }

  function renderDashboard(req, res, extra = {}) {
    res.render('dashboard', {
      sites: listSites(req.session.userId),
      importError: null,
      generateError: null,
      hasAiProvider: hasAiProvider(),
      isAdmin: isAdmin(req.session.userId),
      hasPhotoProvider: hasPhotoProvider(),
      ...extra
    });
  }

  // The section library as GrapesJS blocks (sample content, theme-aware), for the visual editor
  app.get('/library/blocks.json', requireAuth, async (req, res) => {
    try { res.json(await require('../library/grapes').toGrapesBlocks(require('ejs'), path.join(ROOT, 'views'))); }
    catch (e) { res.status(500).json({ error: 'Could not build the block list' }); }
  });

  app.get('/dashboard', requireAuth, (req, res) => {
    renderDashboard(req, res);
  });

  app.post('/sites', requireAuth, (req, res) => {
    const name = str(req.body.name, 80) || 'My Site';
    const slug = uniqueSlug(name);
    const info = db.prepare(
      'INSERT INTO sites (user_id, slug, name, theme, sections, layout) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(req.session.userId, slug, name, JSON.stringify(defaultTheme()), JSON.stringify(defaultSections()), JSON.stringify(defaultLayout()));
    res.redirect(`/sites/${info.lastInsertRowid}/edit`);
  });

  // a demo made from the Prospect finder (prospects.js) is linked back to that business
  function linkProspect(req, siteId) {
    const pid = parseInt((req.body || {}).prospect_id, 10);
    if (!pid) return;
    try {
      prospectsLib.ensureTable(db);
      const p = prospectsLib.get(db, req.session.userId, pid);
      if (p) prospectsLib.update(db, req.session.userId, pid, { site_id: siteId, status: p.status === 'new' ? 'demo' : p.status });
    } catch (e) { console.error('Linking the demo to the prospect failed:', e.message); }
  }
  // ---- Modernize an existing website (modernize.js reads the old site; see there for what it finds) ----
  // The old site's own words, as "facts" for the facts-only AI wording (grounding.js), so nothing new is claimed.
  function importFacts(m, typeLabel) {
    return {
      name: m.name, type: typeLabel || '', city: '', years: '', areas: [], badges: m.badges,
      services: m.services.map(x => ({ name: x.title, desc: x.description, price: '' })),
      diffs: m.phrases, faq: m.faq.map(x => ({ q: x.question, a: x.answer })),
      about: [m.story, m.h1, m.metaDescription].filter(Boolean).join('\n\n'), tagline: m.tagline, tone: '',
      address: m.address, phone: m.phone, email: m.email, hours: m.hours.map(h => `${h.day} ${h.time}`).join(' ')
    };
  }
  const usableHeadline = (h, name) => !!h && h.length >= 6 && h.toLowerCase() !== String(name || '').toLowerCase() && !/^(welcome|home|hello|hi there|welcome to our (web)?site)\b/i.test(h);
  const KEEP_VOICE = 'This business already has a website. Keep its own voice: reuse its tagline, the names of people and places, years, and its own distinctive phrases word for word where they fit. Tidy the wording; do not make it more generic.';

  // The words of an imported site, from the old site (and AI tidying that may only use those words). Used by the
  // import and by "Refresh from source". Returns what to put in the sections; nothing here touches the design.
  async function importedContent(m, industry, style) {
    const label = industry && industry.id !== 'generic' ? industry.label : '';
    const facts = importFacts(m, label);
    let ai = null;
    if (hasAiProvider()) {
      ai = await generateGroundedCopy({ ...facts, design: [KEEP_VOICE, designBrief.copyBrief(label, style)].filter(Boolean).join('\n') });
      if (ai) {
        const probs = grounding.checkCopy(ai, facts);
        if (probs.length) {
          const retry = await generateGroundedCopy({ ...facts, design: KEEP_VOICE }, { feedback: [...new Set(probs.map(p => p.reason))].slice(0, 6).join('; ') });
          if (retry) ai = retry;
        }
      }
    }
    const aiSvc = (title) => ai && (ai.services || []).find(x => x.title.toLowerCase() === title.toLowerCase());
    const c = {
      ai: !!ai, facts,
      hero: {
        headline: (ai && ai.hero.headline) || (usableHeadline(m.h1, m.name) ? m.h1 : '') || m.name,
        subheadline: m.tagline || (ai && ai.hero.subheadline) || m.metaDescription.slice(0, 160),
        ctaText: (ai && ai.hero.ctaText) || (m.phone ? 'Call us today' : 'Get in touch')
      },
      about: (ai && ai.about) || m.story,
      services: m.services.map(x => { const a = aiSvc(x.title); return { title: x.title, description: x.description || (a && a.description) || '', detail: (a && a.detail) || '' }; }),
      reviews: m.reviews.map(r => ({ quote: r.quote, author: r.author })),
      faq: m.faq,
      hours: m.hours,
      whyChoose: m.phrases.slice(0, 6).map(x => (x.length <= 80 ? { icon: 'check', title: x, text: '' } : { icon: 'check', title: x.split(/[.,;:]/)[0].slice(0, 80), text: x.slice(0, 160) })),
      badges: m.badges,
      seo: {
        title: (ai && ai.seoTitle) || `${m.name}${label ? ' | ' + label : ''}`.slice(0, 70),
        description: ((ai && ai.seoDescription) || m.tagline || m.metaDescription || m.story).slice(0, 160)
      }
    };
    return c;
  }
  // puts the words into a sections object; keepMissing (refresh) leaves a part alone when the old site no longer has it
  function applyImportedContent(sections, m, c, { keepMissing = false } = {}) {
    const set = (has, fn) => { if (has || !keepMissing) fn(); };
    sections.hero = { ...sections.hero, headline: c.hero.headline.slice(0, 100), subheadline: c.hero.subheadline.slice(0, 160), ctaText: sections.hero.ctaText && keepMissing ? sections.hero.ctaText : c.hero.ctaText };
    set(!!c.about, () => { sections.about = { ...sections.about, body: (c.about || m.metaDescription || '').slice(0, 2000) }; });
    set(c.services.length, () => { if (c.services.length) sections.services = { ...sections.services, items: c.services }; });
    set(c.reviews.length, () => { sections.testimonials = { ...sections.testimonials, items: c.reviews }; });
    set(c.faq.length, () => { sections.faq = { ...sections.faq, items: c.faq }; });
    set(c.hours.length, () => { sections.hours = { ...sections.hours, items: c.hours }; });
    set(c.whyChoose.length, () => { sections.whyChoose = { ...sections.whyChoose, items: c.whyChoose }; });
    sections.trust = sections.trust || { badges: [], stats: [] };
    set(c.badges.length, () => { sections.trust = { ...sections.trust, badges: c.badges }; });
    sections.contact = { ...sections.contact };
    if (m.phone || !keepMissing) sections.contact.phone = m.phone || '';
    if (m.email || !keepMissing) sections.contact.email = m.email || '';
    if (m.address || !keepMissing) sections.contact.address = m.address || '';
    const social = { ...(sections.contact.social || {}) };
    for (const [k, v] of Object.entries(m.social || {})) if (isSafeUrl(v) && (!social[k] || !keepMissing)) social[k] = v;
    sections.contact.social = social;
    sections.seo = { ...sections.seo, title: c.seo.title, description: c.seo.description };
  }

  // The design of an imported site: their colors, fonts and logo, the closest look, their own photos, and the
  // content blocks and Blocks home page that suit the industry (the same smarts as Generate).
  async function buildModernized(sourceUrl, socialUrl) {
    const m = await modernize.crawl(sourceUrl);
    const typeText = [m.title, m.metaDescription, m.h1, m.tagline].filter(Boolean).join(' ').slice(0, 300);
    const more = [m.services.map(x => x.title).join(', '), m.story.slice(0, 400)].join(' ');
    const industry = await detectIndustry(typeText, m.name, more);
    const base = await baseSiteFromTemplate(industry.id !== 'generic' ? industry.label : typeText.slice(0, 100), m.name, more, industry);
    const { theme, sections } = base;
    sections.meta.businessType = industry.id !== 'generic' ? industry.label : '';

    // the closest look to the old site
    const tplLook = industry.tpl && (industry.tpl.look || templateLooks[industry.tpl.id]);
    const style = modernize.personality({ brand: m.brand, photos: m.photos.length, text: m.allText, industryStyle: tplLook && tplLook.style });
    Object.assign(theme, styleSwap(style.id, false));
    theme.homeLayout = 'full';   // the full home page (services, reviews and so on); the Blocks home page below replaces it when there are blocks

    // their words
    const c = await importedContent(m, industry, style.id);
    sections.blocks = { ...(sections.blocks || {}), items: [] };   // the template's starter blocks are generic: the industry blocks below use their words
    applyImportedContent(sections, m, c);   // with no services found, the template's typical ones stay (the report says so)
    grounding.scrubSections(sections, c.facts);   // anything (template or AI) the old site does not back up is replaced

    // their brand
    if (m.logo && isSafeUrl(m.logo)) theme.logoUrl = m.logo;
    const own = m.brand.colors.map(x => x.hex);
    if (m.themeColor && isValidHexColor(m.themeColor) && !own.includes(m.themeColor)) own.unshift(m.themeColor);
    let colorFrom = 'none';
    if (own.length) {
      theme.primaryColor = own[0];
      const second = own.slice(1).find(h => modernize.hsl(h) && Math.abs(modernize.hsl(h).h - modernize.hsl(own[0]).h) > 25);
      theme.accentColor = second || darkenHex(own[0]);
      colorFrom = m.brand.colors.length ? 'site' : 'meta';
    }
    const known = (n) => n && (fontsLib.FONTS.some(f => f.name.toLowerCase() === n.toLowerCase()));
    const bf = m.brand.fonts;
    const headingFont = bf.heading && (bf.headingGoogle || known(bf.heading)) ? fontsLib.cleanFontName(bf.heading) : '';
    const bodyFont = bf.body && (bf.bodyGoogle || known(bf.body)) ? fontsLib.cleanFontName(bf.body) : '';
    if (headingFont) theme.headingFont = headingFont;
    if (bodyFont && bodyFont !== headingFont) theme.bodyFont = bodyFont;

    // their photos first; stock pictures only fill the gaps when the old site had fewer than 3
    const real = m.photos.map(p => p.url).filter(isSafeUrl);
    let stock = 0;
    if (real.length >= 3) {
      sections.hero.imageUrl = real[0];
      sections.about.imageUrl = real[1];
      sections.gallery = { ...sections.gallery, images: real.slice(1, 15), alts: m.photos.slice(1, 15).map(p => p.alt || '') };
    } else {
      const stockImgs = (sections.gallery.images || []).filter(u => !real.includes(u));
      if (real[0]) sections.hero.imageUrl = real[0]; else if (sections.hero.imageUrl) stock++;
      if (real[1]) sections.about.imageUrl = real[1]; else if (sections.about.imageUrl) stock++;
      sections.gallery = { ...sections.gallery, images: real.concat(stockImgs).slice(0, 8), alts: [] };
      stock = Math.min(8, stock + Math.max(0, sections.gallery.images.length - real.length));
    }

    if (socialUrl) {
      try { applySocialInspiration(theme, sections, await scrapeSocialInspiration(socialUrl)); } catch { /* optional */ }
    }

    // the same smart extras as Generate: industry blocks, a Blocks home page, and (with no colors of their own) the logo's palette
    const g = { name: m.name, theme, sections };
    const logoBuf = theme.logoUrl ? await readGenLogo(null, theme.logoUrl) : null;
    if (!own.length && logoBuf) colorFrom = 'logo';
    try { await autoDesign(g, { industry, logoBuf, blocks: true, keepColors: own.length > 0 }); } catch (e) { console.error('Import blocks failed:', e.message); }
    theme.motionStyle = app.locals.motionLib.suggest({ templateId: industry.id, style: theme.style, advice: industry.id !== 'generic' ? industryDesign.industryDesign(industry.id) : null });

    sections.meta.import = modernize.report(m, {
      industry, style, stock, ai: c.ai, colorFrom,
      colors: [theme.primaryColor, theme.accentColor],
      fontsUsed: headingFont || bodyFont ? { heading: headingFont, body: bodyFont } : null
    });
    const layout = defaultLayout();
    if (!sections.faq.items.length && !layout.hidden.includes('faq')) layout.hidden.push('faq');
    return { name: m.name, theme, sections, layout, sourceUrl: m.sourceUrl };
  }

  app.post('/sites/import', requireAuth, importLimiter, async (req, res) => {
    const sourceUrl = str(req.body.url, 2000);
    const socialUrl = str(req.body.social_url, 2000);
    if (!sourceUrl) {
      return renderDashboard(req, res, { importError: 'Please paste a URL.' });
    }

    try {
      const g = await buildModernized(sourceUrl, socialUrl);
      const slug = uniqueSlug(g.name);
      const info = db.prepare(
        'INSERT INTO sites (user_id, slug, name, theme, sections, layout, source_url, seo_title, seo_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        req.session.userId, slug, g.name, JSON.stringify(g.theme), JSON.stringify(g.sections), JSON.stringify(g.layout),
        g.sourceUrl, g.sections.seo.title, g.sections.seo.description
      );
      saveVersion(info.lastInsertRowid, g.theme, g.sections, g.layout, 'Imported');
      linkProspect(req, info.lastInsertRowid);
      res.redirect(`/sites/${info.lastInsertRowid}/edit?imported=1`);
    } catch (err) {
      if (!/URL|address|webpage|status|redirect|reach|resolve/i.test(err.message || '')) console.error('Import failed:', err);
      renderDashboard(req, res, { importError: err.message || 'Could not import that site.' });
    }
  });

  // "Refresh from source": new words, hours, contact details and photos from the old site. The design (look, colors,
  // fonts, blocks, home page, layout) and anything the old site no longer has stay as they are.
  app.post('/sites/:id/refresh', requireAuth, loadOwnedSite, importLimiter, async (req, res) => {
    const site = req.site;
    if (!site.source_url) return res.redirect(`/sites/${site.id}/edit`);
    try {
      const m = await modernize.crawl(site.source_url);
      const prev = (site.sections.meta && site.sections.meta.import) || {};
      const industry = prev.industry && prev.industry.id ? (autosite.detect({ type: prev.industry.label }) || null) : await detectIndustry([m.title, m.metaDescription, m.h1].join(' '), m.name, '');
      const c = await importedContent(m, industry, site.theme.style);
      saveVersion(site.id, site.theme, site.sections, site.layout, 'Before refresh');
      const sections = JSON.parse(JSON.stringify(site.sections));
      applyImportedContent(sections, m, c, { keepMissing: true });
      grounding.scrubSections(sections, c.facts);
      // new photos join the gallery; the hero and About photos the owner picked stay
      const real = m.photos.map(p => p.url).filter(isSafeUrl);
      const have = new Set((sections.gallery.images || []).map(modernize.photoKey));
      sections.gallery = { ...sections.gallery, images: (sections.gallery.images || []).concat(real.filter(u => !have.has(modernize.photoKey(u)))).slice(0, 24) };
      if (!sections.hero.imageUrl && real[0]) sections.hero.imageUrl = real[0];
      sections.meta = { ...(sections.meta || {}), import: { ...modernize.report(m, { industry, style: prev.style, stock: 0, ai: c.ai, colorFrom: prev.brand && prev.brand.from, colors: [site.theme.primaryColor, site.theme.accentColor], fontsUsed: prev.brand && prev.brand.fonts }), refreshed: true } };
      db.prepare(`UPDATE sites SET sections = ?, seo_title = ?, seo_description = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(JSON.stringify(sections), sections.seo.title, sections.seo.description, site.id);
      invalidateSiteCache(site);
      res.redirect(`/sites/${site.id}/edit?refreshed=1`);
    } catch (err) {
      console.error('Refresh from source failed:', err.message);
      res.redirect(`/sites/${site.id}/edit?refreshed=failed`);
    }
  });

  // One of the looks the import suggested (sections.meta.import.style), applied from the import report
  app.post('/sites/:id/import-style', requireAuth, loadOwnedSite, (req, res) => {
    const site = req.site;
    const rep = site.sections.meta && site.sections.meta.import;
    const st = rep && rep.style;
    const want = str(req.body.style, 30);
    const ok = st && (st.id === want || (st.alternatives || []).some(a => a.id === want)) && extraThemes.ALL_STYLES.includes(want);
    if (!ok) return res.redirect(`/sites/${site.id}/edit`);
    saveVersion(site.id, site.theme, site.sections, site.layout, 'Before changing the look');
    const theme = { ...site.theme, style: want };
    delete theme.homeFull;
    if (!(theme.homeLayout === 'mix' && (theme.mix || []).length)) theme.homeLayout = '';
    const sections = JSON.parse(JSON.stringify(site.sections));
    sections.meta.import.style = { ...st, chosen: want };
    db.prepare(`UPDATE sites SET theme = ?, sections = ?, updated_at = datetime('now') WHERE id = ?`).run(JSON.stringify(theme), JSON.stringify(sections), site.id);
    invalidateSiteCache(site);
    res.redirect(`/sites/${site.id}/edit?saved=1`);
  });

  // Drops AI-written copy into a sections object (hero text, about, services,
  // FAQ, SEO) without touching photos, contact info, hours or credentials.
  function applyCopy(sections, copy) {
    sections.hero.headline = copy.hero.headline;
    sections.hero.subheadline = copy.hero.subheadline;
    if (copy.hero.ctaText) sections.hero.ctaText = copy.hero.ctaText;
    sections.about.body = copy.about;
    sections.services.items = copy.services;
    if (copy.faq.length) sections.faq.items = copy.faq;
    if (copy.seoTitle) sections.seo.title = copy.seoTitle;
    if (copy.seoDescription) sections.seo.description = copy.seoDescription;
  }

  // Optional "client details" from the dashboard's generate form: contact info,
  // real hours and a brand color, so the generated site is filled in from the
  // start. Anything left blank is simply not touched.
  function applyIntake(b, theme, sections) {
    const phone = str(b.phone, 40);
    const email = isValidEmail(b.email || '') ? str(b.email, 254) : '';
    const address = str(b.address, 200);
    if (phone) sections.contact.phone = phone;
    if (email) sections.contact.email = email;
    if (address) sections.contact.address = address;
    const city = str(b.city, 80);
    if (city) sections.meta.city = city;
    for (const k of ['facebook', 'instagram']) {
      if (isSafeUrl(b[k])) sections.contact.social[k] = str(b[k], 300);
    }

    const weekday = str(b.weekday_hours, 40);
    const saturday = str(b.saturday_hours, 40);
    const sunday = str(b.sunday_hours, 40);
    if (weekday) {
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      sections.hours.items = [
        ...days.map(day => ({ day, time: weekday })),
        { day: 'Saturday', time: saturday || 'Closed' },
        { day: 'Sunday', time: sunday || 'Closed' }
      ];
    }

    const years = parseInt(b.years_in_business, 10);
    if (Number.isInteger(years) && years > 0 && years < 200) {
      sections.trust.stats = [{ value: String(years), label: years === 1 ? 'Year in business' : 'Years in business' }];
    }
    const badges = splitList(b.badges, 40, 8);
    if (badges.length) sections.trust.badges = badges;
    const areas = splitList(b.service_areas, 50, 30);
    if (areas.length) sections.trust.serviceAreas = areas;

    if (b.use_brand_color === '1' && isValidHexColor(b.brand_color)) {
      theme.primaryColor = b.brand_color.trim();
      theme.accentColor = darkenHex(theme.primaryColor);
    }
  }

  // A tagline that is only "<Business name>: <type>" is a placeholder; use the first sentence of the about text instead.
  function tidyHero(sections, name, aboutText) {
    const sub = String((sections.hero && sections.hero.subheadline) || '').trim();
    const nm = String(name || '').trim().toLowerCase();
    const bare = !sub || (nm && sub.toLowerCase().startsWith(nm) && sub.length <= nm.length + 30 && /[:\-\u2013\u2014]/.test(sub.slice(nm.length, nm.length + 3)));
    if (bare && aboutText) {
      const first = String(aboutText).split(/(?<=[.!?])\s+/)[0].trim();
      if (first) sections.hero.subheadline = first.slice(0, 160);
    }
  }

  // Which of our industries this is (autosite.js): every industry scored on whole words of the type, the name and the
  // extra details; with no match and AI set up, the AI picks one of ours. Returns autosite's { tpl, id, label, sure, how }.
  async function detectIndustry(businessType, businessName, more) {
    const parts = { type: businessType, name: businessName, more };
    let found = autosite.detect(parts);
    if (found.id === 'generic' && hasAiProvider() && !isTestEnv) found = (await autosite.aiDetect(aiComplete, parts)) || found;
    return found;
  }

  // The smart extras on a freshly built site (autosite.js), recorded in sections.meta.auto for the preview page:
  //  logo: the client's logo file (a Buffer) -> its main colors -> the closest palette we have -> the site's colors;
  //  blocks: add the new content blocks that suit the industry and lay the home page out with them (Mix and match).
  // An explicit brand color typed into the form still wins over the logo.
  async function autoDesign(g, { industry, logoBuf, blocks, keepColors }) {
    const auto = { industry: industry ? { id: industry.id, label: industry.label, how: industry.how, sure: !!industry.sure } : null };
    if (logoBuf) {
      let sharp = null; try { sharp = require('sharp'); } catch { sharp = null; }
      const colors = await autosite.logoColors(logoBuf, sharp);
      const m = autosite.matchPalette(colors, industry && industry.id);
      if (m) {
        auto.logo = { colors: m.colors, palette: m.palette, why: m.why, applied: !keepColors };
        auto.choices = [m.palette, m.exact, ...m.others].filter(Boolean);
        if (!keepColors) { g.theme.primaryColor = m.palette.primary; g.theme.accentColor = m.palette.accent; }
      }
    }
    if (!auto.choices) { // no logo: the palettes made for this industry, so the preview can still swap colors
      auto.choices = autosite.PALETTES.filter(p => (p.for || []).length && autosite.industryFits(p, industry && industry.id)).slice(0, 4).map(p => ({ id: p.id, name: p.name, primary: p.primary, accent: p.accent }));
    }
    if (blocks) {
      const gallery = [...new Set([].concat((g.sections.gallery && g.sections.gallery.images) || []).filter(Boolean))];
      const p = autosite.plan(g, { industryId: industry ? industry.id : 'generic', label: industry && industry.id !== 'generic' ? industry.label : 'About us', gallery, colors: { primary: g.theme.primaryColor, accent: g.theme.accentColor } });
      auto.group = p.groupName; auto.blocks = p.blocks.map(b => b.name); auto.decor = p.decor || []; auto.blockIds = p.blocks.map(b => b.id);
      if (p.mix && p.mix.length) { g.theme.homeLayout = 'mix'; g.theme.mix = p.mix; delete g.theme.homeFull; auto.mix = true; }
    }
    auto.colors = { primary: g.theme.primaryColor, accent: g.theme.accentColor };
    g.sections.meta = { ...(g.sections.meta || {}), auto };
    return auto;
  }

  // The logo for the generator: a file uploaded with the form, or a logo link (an upload here or an https image)
  async function readGenLogo(file, url) {
    if (file && file.path) { try { return fs.readFileSync(file.path); } catch { return null; } }
    if (!url) return null;
    return brandKit.readLogo(url, { uploadsDir: UPLOADS_DIR, safeFetch });
  }

  async function baseSiteFromTemplate(businessType, businessName, more, known) {
      const industry = known || await detectIndustry(businessType, businessName, more);
      const tpl = industry.tpl;
      const filled = fillTemplate(tpl, businessName, businessType);
      const { hero, gallery } = await fetchPhotoSet(tpl.photoQueries, { galleryCount: 6 });
      const colors = colorForCategory(tpl.id);

      const theme = {
        primaryColor: colors.primaryColor,
        accentColor: colors.accentColor,
        font: 'Inter, system-ui, sans-serif',
        style: 'modern',
        headingFont: '', bodyFont: '', headingCase: '',
        logoUrl: ''
      };
      const tplLook = tpl.look || templateLooks[tpl.id];
      if (tplLook) { // a template can bring its own style, colors and fonts
        const L = tplLook;
        if (L.style) theme.style = L.style;
        if (L.primaryColor) theme.primaryColor = L.primaryColor;
        if (L.accentColor) theme.accentColor = L.accentColor;
        if (L.headingFont) theme.headingFont = L.headingFont;
        if (L.bodyFont) theme.bodyFont = L.bodyFont;
        if (L.headingCase) theme.headingCase = L.headingCase;
        if (L.homeLayout) theme.homeLayout = L.homeLayout;
        if (L.homeFull) theme.homeLayout = 'full';
      }

      // a new site starts with the full home page (services, reviews and so on), not just a hero and photos
      if (!theme.homeLayout || theme.homeLayout === 'basic') theme.homeLayout = 'full';
      // a business that has its own Signature piece (Atelier) starts on it: the artwork home page in the piece's colors and fonts
      const signature = atelier.forBusiness(businessType);
      if (signature) Object.assign(theme, styleSwap(signature, true), { headingFont: '', bodyFont: '', headingCase: '' });
      const sections = defaultSections();
      sections.hero = {
        headline: filled.hero.headline,
        subheadline: filled.hero.subheadline,
        imageUrl: hero ? hero.url : '',
        ctaText: filled.hero.ctaText,
        ctaLink: '#contact',
        design: 'auto'
      };
      tidyHero(sections, filled.name, filled.about);
      sections.about = { heading: 'About Us', body: filled.about, imageUrl: gallery[0] ? gallery[0].url : '' };
      sections.services = { heading: 'What We Offer', items: filled.services };
      sections.faq = { heading: 'Frequently Asked Questions', items: filled.faq };
      Object.assign(sections.about, { eyebrow: 'Who we are' }); Object.assign(sections.services, { eyebrow: 'What we do' }); Object.assign(sections.faq, { eyebrow: 'Good to know' });
      { // template blocks: fill empty photo spots from the fetched photos (the first is used by About)
        let g = 1;
        sections.blocks = { items: (filled.blocks || []).map(b => {
          const wantsPhoto = b.type === 'photoText' || b.type === 'cta';
          return { side: 'auto', bg: 'none', place: 'bottom', buttonText: '', buttonUrl: '', imageUrl: '', ...b,
            imageUrl: wantsPhoto ? (b.imageUrl || (gallery[g++] ? gallery[g - 1].url : '')) : '' };
        }) };
      }
      sections.gallery = { heading: 'Gallery', images: gallery.map(g => g.url) };
      // the booking page starts switched off, set up for this kind of business
      sections.booking = booking.applyPreset(sections.booking, booking.TEMPLATE_KIND[tpl.id] || 'generic', filled.services);
      sections.seo = {
        title: `${filled.name} | ${tpl.label}`.slice(0, 70),
        description: filled.hero.subheadline.slice(0, 160)
      };

      sections.meta.businessType = businessType;
      theme.motionLevel = app.locals.motionLib.LEVEL_DEFAULT;   // every new site starts on Standard; the editor suggests a tier
      theme.motionStyle = app.locals.motionLib.suggest({ templateId: tpl.id, style: theme.style, advice: tpl.id !== 'generic' ? industryDesign.industryDesign(tpl.id) : null });
      return { tpl, filled, theme, sections, hero, gallery, industry };
  }

  // The honest-wording check for the quick generator (grounding.js): the facts are the form fields and anything pasted.
  function quickFactsOf(name, type, sections, extra) {
    const t = sections.trust || {}, c = sections.contact || {};
    const yrs = (t.stats || []).find(x => x && /year/i.test(x.label || ''));
    return grounding.quickFacts({
      name, type, city: (sections.meta && sections.meta.city) || '', address: c.address || '', phone: c.phone || '', email: c.email || '',
      areas: t.serviceAreas || [], badges: t.badges || [], years: yrs ? yrs.value : '',
      services: (extra && extra.services) || [], specialties: (extra && extra.specialties) || '',
      hours: ((sections.hours && sections.hours.items) || []).map(h => h && h.time).join(' '), extra: (extra && extra.notes) || ''
    });
  }
  // marks only the words just replaced (headline, About, services, FAQ, search text), never the owner's own edits elsewhere
  function markMain(sections, name, type, withFaq) {
    const part = { hero: sections.hero, about: sections.about, services: sections.services, seo: sections.seo };
    if (withFaq) part.faq = sections.faq;
    return grounding.markSections(part, quickFactsOf(name, type, sections));
  }
  // AI copy for the quick generator: written, checked for claims the details don't back up, and written once more
  // with the problems named if it had any. Whatever still slips through is marked by grounding.markSections later.
  async function checkedCopy(details, facts, instruction = '') {
    let copy = await generateCopy(details, instruction);
    if (!copy) return null;
    const probs = grounding.checkCopy(copy, facts, { guessed: true });
    if (probs.length) {
      const retry = await generateCopy({ ...details, feedback: [...new Set(probs.map(p => p.reason))].slice(0, 6).join('; ') }, instruction);
      if (retry && grounding.checkCopy(retry, facts, { guessed: true }).length < probs.length) copy = retry;
    }
    return copy;
  }
  // services the owner listed (with prices): AI wording keeps their names and order; the price leads the description
  function applyListedServices(sections, listed) {
    if (!listed.length) return;
    const had = (sections.services && sections.services.items) || [];
    const norm = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    sections.services.items = listed.map(l => {
      const old = had.find(x => x && norm(x.title) === norm(l.name)) || had.find(x => x && (norm(x.title).includes(norm(l.name)) || norm(l.name).includes(norm(x.title)))) || {};
      let desc = old.description || l.desc || '';
      if (l.price && !desc.includes(l.price)) desc = desc ? `${l.price} · ${desc}` : l.price;
      return { ...old, title: l.name, description: desc.slice(0, 300), detail: old.detail || '' };
    });
  }

  // Builds a generated site in memory (nothing saved). Used by both "generate" and "preview first".
  // variant (optional, aibuild.VARIANTS): one of the "3 versions to compare": its tone goes to the AI and its look is used
  async function buildGeneratedSite(body, logoFile, variant = null) {
    // the paste-anything box: fill the blanks of the form from it, unless the page already did ("Fill in the form")
    const notes = str(body.paste, 12000);
    if (notes && body.paste_read !== '1') {
      try { aibuild.fillBlanks(body, (await aibuild.readPaste(notes, { complete: hasAiProvider() ? aiComplete : null })).fields); } catch { /* the typed details still work */ }
    }
    const businessType = str(body.business_type, 100);
    const businessName = str(body.business_name, 80);
    const socialUrl = str(body.social_url, 2000);
    const specialties = str(body.specialties, 1500);
    const listed = aibuild.parseServices(body.services_list);
    const reviews = aibuild.parseReviews(body.reviews_list);
    const { tpl, filled, theme, sections, industry } = await baseSiteFromTemplate(businessType, businessName, specialties.slice(0, 600));
    if (body.home_blueprint === '1') { // the owner chose section designs while setting up: use the industry blueprint
      theme.homeLayout = 'blueprint';
      for (const f of Object.keys(sectionLibraryRegistry.FAMILIES)) { const v = body['bpv_' + f]; if (v && sectionLibraryRegistry.isVariant(f, v)) (theme.bpVariants = theme.bpVariants || {})[f] = v; }
    }
    applyIntake(body, theme, sections);
    if (reviews.length) sections.testimonials = { ...sections.testimonials, items: reviews };   // real reviews only: typed or found word for word in the paste
    if (sections.meta.city) {
      sections.seo.title = `${filled.name} | ${tpl.label} in ${sections.meta.city}`.slice(0, 70);
    }
    const facts = quickFactsOf(filled.name, businessType, sections, { services: listed, specialties, notes });
    // Optional AI-written copy; falls back to the built-in template text.
    let copySource = 'template';
    const details = {
      name: filled.name,
      type: businessType,
      address: sections.contact.address,
      city: sections.meta.city,
      serviceAreas: sections.trust.serviceAreas,
      years: sections.trust.stats[0] ? sections.trust.stats[0].value : '',
      badges: sections.trust.badges,
      specialties,
      services: listed.map(l => l.name + (l.price ? ` (price given by owner: ${l.price})` : '') + (l.desc ? ` — ${l.desc}` : '')),
      notes,
      design: designBrief.copyBrief(businessType, variant ? variant.style : theme.style) + (variant ? `\nTone of voice for this version: ${variant.tone}` : ''),
      tone: variant ? variant.tone : ''
    };
    const aiCopy = await checkedCopy(details, facts);
    if (aiCopy) {
      copySource = 'ai';
      applyCopy(sections, aiCopy);
    }
    applyListedServices(sections, listed);
    tidyHero(sections, filled.name, sections.about && sections.about.body);
    if (socialUrl) {
      // Same best-effort contract as the importer: never let a bad/blocked social link stop generation.
      try {
        const social = await scrapeSocialInspiration(socialUrl);
        applySocialInspiration(theme, sections, social, { preferOverHero: true });
      } catch { /* ignore: social inspiration is optional */ }
    }
    const g = { name: filled.name, theme, sections, copySource };
    const logoBuf = await readGenLogo(logoFile, '');
    if (logoFile && logoBuf) theme.logoUrl = '/uploads/' + path.basename(logoFile.path);
    if (logoBuf || body.auto_blocks === '1') await autoDesign(g, { industry, logoBuf, blocks: body.auto_blocks === '1', keepColors: body.use_brand_color === '1' && isValidHexColor(body.brand_color) });
    if (variant) { // the version's own look, switched the same way as the look buttons on the preview page
      theme.style = variant.style; delete theme.homeFull;
      if (!(theme.homeLayout === 'mix' && (theme.mix || []).length)) theme.homeLayout = '';
      sections.meta = { ...(sections.meta || {}), variant: variant.id };
    }
    // the added blocks and section headings get words written for this business too (one more AI call)
    if (aiCopy) {
      try {
        const n = await aibuild.rewriteBlocks(sections, { ...details, areas: facts.areas, badges: facts.badges, years: facts.years }, { complete: aiComplete, facts });
        if (n) sections.meta = { ...(sections.meta || {}), blockWords: n };
      } catch { /* the blocks keep the page's own words */ }
    }
    // anything still claiming what the details don't back up is marked [Confirm with client] (launch is blocked until it's gone)
    const confirm = grounding.markSections(sections, facts);
    sections.meta = { ...(sections.meta || {}), confirm };
    return g;
  }

  function insertGeneratedSite(userId, g, label) {
    const slug = uniqueSlug(g.name);
    const layout = defaultLayout();
    const info = db.prepare(
      'INSERT INTO sites (user_id, slug, name, theme, sections, layout, seo_title, seo_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(userId, slug, g.name, JSON.stringify(g.theme), JSON.stringify(g.sections), JSON.stringify(layout), g.sections.seo.title, g.sections.seo.description);
    saveVersion(info.lastInsertRowid, g.theme, g.sections, layout, label);
    return info.lastInsertRowid;
  }

  // the form may carry the client's logo (multipart); a plain form still works
  const genLogo = (req, res, next) => upload.single('logo')(req, res, (err) => {
    if (err) { if (req.file) fs.rm(req.file.path, { force: true }, () => {}); req.file = null; }
    req.body = req.body || {};
    next();
  });
  app.post('/sites/generate', requireAuth, generateLimiter, genLogo, async (req, res) => {
    const pasted = str(req.body.paste, 12000);
    if (pasted && req.body.paste_read !== '1') { // the paste can supply the type of business too
      try { aibuild.fillBlanks(req.body, (await aibuild.readPaste(pasted, { complete: hasAiProvider() ? aiComplete : null })).fields); } catch { /* typed details only */ }
      req.body.paste_read = '1';
    }
    const businessType = str(req.body.business_type, 100);
    if (!businessType) {
      return renderDashboard(req, res, { generateError: pasted ? 'We couldn\'t tell the type of business from the pasted text. Please type it in (e.g. "plumbing company").' : 'Please describe the type of business (e.g. "plumbing company").' });
    }
    try {
      if (req.body.three === '1') { // three versions side by side (warm, professional, bold); nothing is saved until one is picked
        const built = await Promise.all(aibuild.VARIANTS.map(v => buildGeneratedSite({ ...req.body }, req.file, v).then(g => ({ g, v }), () => null)));
        const got = built.filter(Boolean);
        if (!got.length) throw new Error('no version could be built');
        db.prepare("DELETE FROM site_drafts WHERE created_at < datetime('now', '-7 days')").run();
        const n = db.prepare('SELECT COUNT(*) AS n FROM site_drafts WHERE user_id = ?').get(req.session.userId).n;
        if (n + got.length > 20) db.prepare('DELETE FROM site_drafts WHERE id IN (SELECT id FROM site_drafts WHERE user_id = ? ORDER BY id LIMIT ?)').run(req.session.userId, n + got.length - 20);
        const grp = nanoid(16);
        for (const { g, v } of got) {
          db.prepare('INSERT INTO site_drafts (user_id, token, name, theme, sections, copy_source, grp, variant) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .run(req.session.userId, nanoid(20), g.name, JSON.stringify(g.theme), JSON.stringify(g.sections), g.copySource, grp, v.id);
        }
        return res.redirect(`/sites/drafts/${grp}`);
      }
      const g = await buildGeneratedSite(req.body, req.file);
      if (req.body.preview === '1') { // look first, save only if the owner likes it
        db.prepare("DELETE FROM site_drafts WHERE created_at < datetime('now', '-7 days')").run();
        const n = db.prepare('SELECT COUNT(*) AS n FROM site_drafts WHERE user_id = ?').get(req.session.userId).n;
        if (n >= 20) db.prepare('DELETE FROM site_drafts WHERE id IN (SELECT id FROM site_drafts WHERE user_id = ? ORDER BY id LIMIT ?)').run(req.session.userId, n - 19);
        const token = nanoid(20);
        db.prepare('INSERT INTO site_drafts (user_id, token, name, theme, sections, copy_source) VALUES (?, ?, ?, ?, ?, ?)')
          .run(req.session.userId, token, g.name, JSON.stringify(g.theme), JSON.stringify(g.sections), g.copySource);
        return res.redirect(`/sites/draft/${token}`);
      }
      const id = insertGeneratedSite(req.session.userId, g, 'Generated');
      linkProspect(req, id);
      res.redirect(`/sites/${id}/edit?generated=${g.copySource === 'ai' ? 'ai' : '1'}`);
    } catch (err) {
      renderDashboard(req, res, { generateError: 'Could not generate a site. Please try again.' });
    }
  });

  // "Fill in the form from this": reads the paste-anything box and returns only the details found in it (aibuild.js)
  app.post('/sites/generate/read-paste', requireAuth, generateLimiter, async (req, res) => {
    const text = str((req.body || {}).paste, 12000);
    if (!text) return res.status(400).json({ ok: false, error: 'Paste something about the business first.' });
    try {
      const got = await aibuild.readPaste(text, { complete: hasAiProvider() ? aiComplete : null });
      res.json({ ok: true, fields: got.fields, how: got.how });
    } catch { res.json({ ok: false, error: 'Could not read that. You can still fill in the form by hand.' }); }
  });

  // ---- preview before creating ----
  function loadDraft(req, res, next) {
    const row = /^[A-Za-z0-9_-]{10,64}$/.test(req.params.token) ? db.prepare('SELECT * FROM site_drafts WHERE token = ? AND user_id = ?').get(req.params.token, req.session.userId) : null;
    if (!row) return res.status(404).render('not-found');
    req.draft = row;
    req.draftSite = hydrateSite({ id: 0, user_id: row.user_id, slug: 'preview', name: row.name, theme: row.theme, sections: row.sections, layout: JSON.stringify(defaultLayout()), published: 0, custom_domain: null });
    next();
  }
  const DRAFT_LOOKS = intake.MOODS.filter(m => m[0]);
  app.get('/sites/draft/:token', requireAuth, loadDraft, (req, res) => {
    res.render('draft-preview', { d: req.draft, token: req.params.token, looks: DRAFT_LOOKS, current: req.draftSite.theme.style, ai: req.draft.copy_source === 'ai', auto: (req.draftSite.sections.meta || {}).auto || null, confirm: (req.draftSite.sections.meta || {}).confirm || [], colorsNow: { primary: req.draftSite.theme.primaryColor, accent: req.draftSite.theme.accentColor } });
  });
  app.post('/sites/draft/:token/look', requireAuth, loadDraft, (req, res) => {
    const look = DRAFT_LOOKS.find(m => m[0] === req.body.look);
    if (look) {
      const theme = req.draftSite.theme;
      theme.style = look[0]; delete theme.homeFull;
      if (!(theme.homeLayout === 'mix' && (theme.mix || []).length)) theme.homeLayout = '';   // a Blocks home page with the new blocks stays
      db.prepare('UPDATE site_drafts SET theme = ? WHERE id = ?').run(JSON.stringify(theme), req.draft.id);
    }
    res.redirect(`/sites/draft/${req.params.token}`);
  });
  // the preview's picks (autosite.js): swap to another of the offered palettes, or take the new blocks out again
  const draftAuto = (req) => { const sec = JSON.parse(req.draft.sections || '{}'); return { sec, auto: (sec.meta && sec.meta.auto) || null }; };
  app.post('/sites/draft/:token/colors', requireAuth, loadDraft, (req, res) => {
    const { sec, auto } = draftAuto(req);
    const pick = auto && (auto.choices || []).find(c => c && c.id === str(req.body.pal, 40));
    if (pick && isValidHexColor(pick.primary) && isValidHexColor(pick.accent)) {
      const theme = JSON.parse(req.draft.theme || '{}');
      const from = auto.colors || { primary: theme.primaryColor, accent: theme.accentColor };
      autosite.recolor((sec.blocks && sec.blocks.items) || [], auto.blockIds || [], from, pick);
      autosite.recolorDecor(sec, from, pick);   // the paw watermark the generator added takes the new color too
      theme.primaryColor = pick.primary; theme.accentColor = pick.accent;
      auto.colors = { primary: pick.primary, accent: pick.accent }; auto.picked = pick.id;
      db.prepare('UPDATE site_drafts SET theme = ?, sections = ? WHERE id = ?').run(JSON.stringify(theme), JSON.stringify(sec), req.draft.id);
    }
    res.redirect(`/sites/draft/${req.params.token}`);
  });
  app.post('/sites/draft/:token/noblocks', requireAuth, loadDraft, (req, res) => {
    const { sec, auto } = draftAuto(req);
    if (auto && (auto.blockIds || []).length) {
      const ids = new Set(auto.blockIds);
      if (sec.blocks && Array.isArray(sec.blocks.items)) sec.blocks.items = sec.blocks.items.filter(b => !ids.has(b.id));
      const theme = JSON.parse(req.draft.theme || '{}');
      if (theme.homeLayout === 'mix') { theme.homeLayout = 'full'; delete theme.mix; }
      if (sec.texts && Array.isArray(sec.texts.wmarks)) sec.texts.wmarks = sec.texts.wmarks.filter(w => !(w && ids.has(String(w.part || '').slice(2))));   // their watermarks go with them
      auto.blockIds = []; auto.blocks = []; auto.decor = []; auto.mix = false;
      db.prepare('UPDATE site_drafts SET theme = ?, sections = ? WHERE id = ?').run(JSON.stringify(theme), JSON.stringify(sec), req.draft.id);
    }
    res.redirect(`/sites/draft/${req.params.token}`);
  });
  // the three versions side by side: pick one, look closer at one, or throw them all away
  const loadDraftGroup = (req) => (/^[A-Za-z0-9_-]{10,64}$/.test(req.params.grp) ? db.prepare('SELECT * FROM site_drafts WHERE grp = ? AND user_id = ? ORDER BY id').all(req.params.grp, req.session.userId) : []);
  app.get('/sites/drafts/:grp', requireAuth, (req, res) => {
    const rows = loadDraftGroup(req);
    if (!rows.length) return res.status(404).render('not-found');
    const versions = rows.map(r => {
      const sec = JSON.parse(r.sections || '{}'), v = aibuild.variantById(r.variant) || { id: r.variant, label: 'Version', blurb: '' };
      return { token: r.token, v, ai: r.copy_source === 'ai', headline: (sec.hero && sec.hero.headline) || '', confirm: ((sec.meta && sec.meta.confirm) || []).length };
    });
    res.render('draft-pick', { name: rows[0].name, grp: req.params.grp, versions });
  });
  app.post('/sites/drafts/:grp/discard', requireAuth, (req, res) => {
    if (/^[A-Za-z0-9_-]{10,64}$/.test(req.params.grp)) db.prepare("DELETE FROM site_drafts WHERE grp = ? AND user_id = ? AND grp != ''").run(req.params.grp, req.session.userId);
    res.redirect('/');
  });
  app.post('/sites/draft/:token/create', requireAuth, loadDraft, (req, res) => {
    const d = req.draft;
    const g = { name: d.name, theme: JSON.parse(d.theme), sections: mergeSectionsWithDefaults(JSON.parse(d.sections)), copySource: d.copy_source };
    const id = insertGeneratedSite(req.session.userId, g, 'Generated');
    db.prepare('DELETE FROM site_drafts WHERE id = ?').run(d.id);
    if (d.grp) db.prepare("DELETE FROM site_drafts WHERE grp = ? AND user_id = ? AND grp != ''").run(d.grp, req.session.userId);   // the versions not picked go too
    res.redirect(`/sites/${id}/edit?generated=${d.copy_source === 'ai' ? 'ai' : '1'}`);
  });
  app.post('/sites/draft/:token/discard', requireAuth, loadDraft, (req, res) => {
    db.prepare('DELETE FROM site_drafts WHERE id = ?').run(req.draft.id);
    res.redirect('/');
  });
  const renderDraft = (req, res, page) => renderSitePage(req, res, null, {
    site: req.draftSite, page, basePath: `/sites/draft/${req.params.token}/frame`,
    preview: true, contactSent: false, contactError: false, cacheKey: null
  });
  app.get('/sites/draft/:token/frame', requireAuth, loadDraft, (req, res) => renderDraft(req, res, 'home'));
  app.get('/sites/draft/:token/frame/:page', requireAuth, loadDraft, (req, res) => renderDraft(req, res, req.params.page));

  app.post('/sites/:id/rewrite-copy', requireAuth, loadOwnedSite, generateLimiter, async (req, res) => {
    const site = req.site;
    const back = (q) => res.redirect(`/sites/${site.id}/edit?${q}`);
    if (!hasAiProvider()) return back('rewrite=off');
    const t = site.sections.trust;
    const copy = await generateCopy({
      name: site.name,
      type: (site.sections.meta && site.sections.meta.businessType) || site.name,
      address: site.sections.contact.address,
      city: site.sections.meta && site.sections.meta.city,
      serviceAreas: t.serviceAreas,
      years: t.stats[0] && /year/i.test(t.stats[0].label) ? t.stats[0].value : '',
      badges: t.badges,
      services: site.sections.services.items.map(i => i.title),
      design: designBrief.copyBrief((site.sections.meta && site.sections.meta.businessType) || '', site.theme.style)
    }, str(req.body.instruction, 500));
    if (!copy) return back('rewrite=failed');

    saveVersion(site.id, site.theme, site.sections, site.layout, 'Before AI rewrite');
    const sections = JSON.parse(JSON.stringify(site.sections));
    applyCopy(sections, copy);
    markMain(sections, site.name, (site.sections.meta && site.sections.meta.businessType) || '', copy.faq.length > 0);
    db.prepare(
      `UPDATE sites SET sections = ?, seo_title = ?, seo_description = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(JSON.stringify(sections), sections.seo.title, sections.seo.description, site.id);
    invalidateSiteCache(site);
    back('rewrite=done');
  });


  // ---- chat-to-edit: describe a change, review it, then apply ----
  // Proposals live in memory for 15 minutes; applying re-validates every operation against the current site.
  const editProposals = new Map();
  function editProposeHandler(scope) {
    return async (req, res) => {
      const site = req.site;
      const instruction = str((req.body || {}).instruction, 600);
      if (!instruction) return res.status(400).json({ ok: false, error: 'Tell me what you would like to change.' });
      if (!hasAiProvider()) return res.json({ ok: false, error: 'AI editing isn\'t set up yet — add ANTHROPIC_API_KEY to the .env file.' });
      const text = await aiComplete({ system: chatedit.SYSTEM, prompt: chatedit.buildPrompt(site, instruction, scope, scope === 'client' ? '' : designBrief.editBrief(site)), maxTokens: 2000 });
      const parsed = chatedit.parseReply(text);
      if (!parsed) return res.json({ ok: false, error: 'The AI didn\'t give a usable answer. Nothing was changed — try again or word it differently.' });
      const result = chatedit.applyOps(site, parsed.ops, { scope, styles: extraThemes.ALL_STYLES });
      // the honesty check: wording that states something the site and the request don't is held back, with the reason
      const { ok: offered, held } = chatedit.honesty(site, result.changes, instruction);
      const heldOut = held.map(h => ({ label: h.label, after: h.after, reasons: h.reasons }));
      if (!offered.length) return res.json({ ok: true, reply: parsed.reply || 'I couldn\'t find anything to change for that request.', changes: [], held: heldOut, token: '' });
      for (const [k, v] of editProposals) if (v.exp < Date.now()) editProposals.delete(k);
      const token = crypto.randomBytes(16).toString('hex');
      editProposals.set(token, { siteId: site.id, scope, ops: parsed.ops, allowed: offered.map(c => c.i), instruction, exp: Date.now() + 15 * 60 * 1000 });
      const heads = scope === 'client' ? [] : designBrief.warnings(site, parsed.ops);
      res.json({ ok: true, reply: [parsed.reply, ...heads.map(h => 'Heads up: ' + h)].filter(Boolean).join(' '), notes: heads, changes: offered, held: heldOut, token, skipped: result.rejected });
    };
  }
  function editApplyHandler(scope) {
    return (req, res) => {
      const site = req.site;
      const p = editProposals.get(str((req.body || {}).token, 64));
      if (!p || p.exp < Date.now() || p.siteId !== site.id || p.scope !== scope) return res.status(400).json({ ok: false, error: 'That suggestion expired. Ask again.' });
      // only the changes that passed the honesty check, and of those only the ones ticked (all when none are sent)
      const allowed = new Set(p.allowed || []);
      const picks = req.body.pick == null ? null : new Set([].concat(req.body.pick).slice(0, 50).map(Number).filter(Number.isInteger));
      if (picks && !picks.size) return res.json({ ok: false, error: 'Tick at least one change first.' });
      const ops = (p.ops || []).slice(0, chatedit.MAX_OPS).filter((o, i) => allowed.has(i) && (!picks || picks.has(i)));
      editProposals.delete(str(req.body.token, 64));
      const result = chatedit.applyOps(site, ops, { scope, styles: extraThemes.ALL_STYLES });
      if (!result.changes.length) return res.json({ ok: false, error: 'Nothing to apply.' });
      saveVersion(site.id, site.theme, site.sections, site.layout, ('Before AI edit: ' + p.instruction).slice(0, 60));
      const v = db.prepare('SELECT id FROM site_versions WHERE site_id = ? ORDER BY id DESC LIMIT 1').get(site.id);
      db.prepare(`UPDATE sites SET theme = ?, sections = ?, seo_title = ?, seo_description = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(JSON.stringify(result.theme), JSON.stringify(result.sections), result.sections.seo.title, result.sections.seo.description, site.id);
      invalidateSiteCache(site);
      res.json({ ok: true, applied: result.changes.length, versionId: scope === 'client' ? null : (v ? v.id : null) });
    };
  }
  app.post('/sites/:id/ai-edit', requireAuth, loadOwnedSite, generateLimiter, editProposeHandler('owner'));
  app.post('/sites/:id/ai-edit/apply', requireAuth, loadOwnedSite, editApplyHandler('owner'));

  // ---- ✨ Improve with AI: review a finished site, tick the suggestions you want, apply (or apply to a copy) ----
  // Suggestions live in memory for 30 minutes. The site as it was is saved to history first, so one click undoes it.
  const improveProposals = new Map();
  app.post('/sites/:id/improve', requireAuth, loadOwnedSite, generateLimiter, async (req, res) => {
    const site = req.site, b = req.body || {};
    const focus = (Array.isArray(b.focus) ? b.focus : [b.focus]).map(x => str(x, 10)).filter(x => improve.AREAS[x]);
    const aiOn = hasAiProvider();
    const meta = site.sections.meta || {};
    const r = await improve.review(site, {
      complete: aiOn ? aiComplete : null, focus, note: str(b.note, 400),
      brief: designBrief.copyBrief(meta.businessType || '', site.theme.style) || ''
    });
    for (const [k, v] of improveProposals) if (v.exp < Date.now()) improveProposals.delete(k);
    const token = r.suggestions.length ? crypto.randomBytes(16).toString('hex') : '';
    if (token) improveProposals.set(token, { siteId: site.id, suggestions: r.suggestions, exp: Date.now() + 30 * 60 * 1000 });
    const message = !aiOn ? 'AI isn\'t set up (no ANTHROPIC_API_KEY in .env), so these are only the quick checks.'
      : r.how === 'failed' ? 'The AI didn\'t answer properly this time, so these are only the quick checks. Try again in a minute.' : '';
    res.json({ ok: true, how: r.how, message, summary: r.summary, suggestions: r.suggestions.map(({ op, ...x }) => x), held: r.held, tips: r.tips, areas: improve.AREAS, token });
  });
  app.post('/sites/:id/improve/apply', requireAuth, loadOwnedSite, (req, res) => {
    const site = req.site, b = req.body || {};
    const tok = str(b.token, 64), p = improveProposals.get(tok);
    if (!p || p.exp < Date.now() || p.siteId !== site.id) return res.status(400).json({ ok: false, error: 'Those suggestions expired. Run Improve with AI again.' });
    const ids = (Array.isArray(b.ids) ? b.ids : []).map(x => str(x, 8)).slice(0, 200);
    if (!ids.length) return res.json({ ok: false, error: 'Tick at least one suggestion first.' });
    const r = improve.applySuggestions(site, p.suggestions, ids);
    if (!r.applied) return res.json({ ok: false, error: r.stale ? 'Those parts of the site changed since the suggestions were made. Run Improve with AI again.' : 'Nothing to apply.' });
    improveProposals.delete(tok);
    const seo = r.sections.seo || {};
    if (b.copy === true || b.copy === '1' || b.copy === 'true') { // the original stays exactly as it was
      const name = `${site.name} (improved)`.slice(0, 80);
      const info = db.prepare('INSERT INTO sites (user_id, slug, name, theme, sections, layout, seo_title, seo_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(req.session.userId, uniqueSlug(name), name, JSON.stringify(site.theme), JSON.stringify(site.sections), JSON.stringify(site.layout), site.seo_title || '', site.seo_description || '');
      const id = info.lastInsertRowid;
      saveVersion(id, site.theme, site.sections, site.layout, 'Before Improve with AI');
      db.prepare(`UPDATE sites SET theme = ?, sections = ?, layout = ?, seo_title = ?, seo_description = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(JSON.stringify(r.theme), JSON.stringify(r.sections), JSON.stringify(r.layout), seo.title || '', seo.description || '', id);
      return res.json({ ok: true, applied: r.applied, stale: r.stale, copy: true, siteId: Number(id) });
    }
    saveVersion(site.id, site.theme, site.sections, site.layout, 'Before Improve with AI');
    const v = db.prepare('SELECT id FROM site_versions WHERE site_id = ? ORDER BY id DESC LIMIT 1').get(site.id);
    db.prepare(`UPDATE sites SET theme = ?, sections = ?, layout = ?, seo_title = ?, seo_description = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(JSON.stringify(r.theme), JSON.stringify(r.sections), JSON.stringify(r.layout), seo.title || '', seo.description || '', site.id);
    invalidateSiteCache(site);
    res.json({ ok: true, applied: r.applied, stale: r.stale, copy: false, siteId: site.id, versionId: v ? v.id : null });
  });

  // "Fill in for this business": swap the wording and/or photos for ones that suit the business type.
  // Colors, style, contact details, hours, reviews and everything else are left alone. The old version is kept in history.
  app.post('/sites/:id/apply-industry', requireAuth, loadOwnedSite, generateLimiter, async (req, res) => {
    const site = req.site, back = (k) => res.redirect(`/sites/${site.id}/edit?ind=${k}#designAdvice`);
    const what = ['photos', 'wording', 'both'].includes(req.body.what) ? req.body.what : 'both';
    const meta = site.sections.meta || {};
    const typed = str(req.body.business_type, 100) || meta.businessType || '';
    let tpl = findTemplate(typed);
    if (tpl.id === 'generic') { // no type saved: guess from the name and services
      const guess = [site.name, ...((site.sections.services && site.sections.services.items) || []).map(x => x && x.title)].filter(Boolean).join(' ');
      tpl = findTemplate(guess);
    }
    if (tpl.id === 'generic') return back('notype');
    const sections = JSON.parse(JSON.stringify(site.sections));
    const done = [];
    if (what !== 'wording') {
      let set = null;
      try { set = hasPhotoProvider() ? await fetchPhotoSet(tpl.photoQueries, { galleryCount: 6 }) : null; } catch { set = null; }
      if (set && (set.hero || (set.gallery && set.gallery.length))) {
        const gallery = set.gallery || [];
        if (set.hero) sections.hero.imageUrl = set.hero.url;
        if (gallery[0]) sections.about.imageUrl = gallery[0].url;
        if (gallery.length) sections.gallery = Object.assign({ heading: 'Gallery' }, sections.gallery, { images: gallery.map(g => g.url), alts: [] });
        let g = 1;
        if (sections.blocks && Array.isArray(sections.blocks.items)) sections.blocks.items.forEach(b => {
          if ((b.type === 'photoText' || b.type === 'cta') && gallery[g]) b.imageUrl = gallery[g++].url;
        });
        done.push('photos');
      }
    }
    let ai = false;
    if (what !== 'photos') {
      const filled = fillTemplate(tpl, site.name, typed || tpl.label.toLowerCase());
      sections.hero.headline = filled.hero.headline;
      sections.hero.subheadline = filled.hero.subheadline;
      if (filled.hero.ctaText) sections.hero.ctaText = filled.hero.ctaText;
      sections.about.body = filled.about;
      sections.services.items = filled.services;
      if (filled.faq && filled.faq.length) sections.faq.items = filled.faq;
      if (hasAiProvider()) {
        try {
          const copy = await generateCopy({
            name: site.name, type: typed || tpl.label, address: (sections.contact || {}).address, city: meta.city,
            serviceAreas: (sections.trust || {}).serviceAreas, years: ((sections.trust || {}).stats || [])[0] ? sections.trust.stats[0].value : '',
            badges: (sections.trust || {}).badges, specialties: '', design: designBrief.copyBrief(typed || tpl.label, site.theme.style)
          });
          if (copy) { applyCopy(sections, copy); ai = true; }
        } catch { /* keep the template wording */ }
      }
      done.push(ai ? 'wording (AI)' : 'wording');
    }
    if (what !== 'photos') { tidyHero(sections, site.name, sections.about && sections.about.body); markMain(sections, site.name, typed || tpl.label, true); }
    if (!done.length) return back('nophotos');
    sections.meta = Object.assign({}, sections.meta, { businessType: typed || sections.meta.businessType || tpl.label.toLowerCase() });
    saveVersion(site.id, site.theme, site.sections, site.layout, 'Before industry fill-in');
    const theme = Object.assign({}, site.theme);
    if (theme.homeLayout === 'basic') theme.homeLayout = 'full'; // the bare hero-and-photos layout hides the content just filled in
    db.prepare(`UPDATE sites SET theme = ?, sections = ?, seo_title = ?, seo_description = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(JSON.stringify(theme), JSON.stringify(sections), (sections.seo || {}).title || site.seo_title, (sections.seo || {}).description || site.seo_description, site.id);
    invalidateSiteCache(site);
    return back(what === 'both' && done.length === 1 ? 'partial' : 'ok');
  });

  const photoSearchLimiter = rateLimit({
    windowMs: 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false,
    skip: () => isTestEnv, message: { ok: false, error: 'Too many searches — wait a moment.' }
  });

  // Photo picker: search free stock photos for the editor's "Choose photo" button.
  // Pexels and/or Unsplash, whichever have a key in .env (?source= picks one).
  app.get('/sites/:id/photos', requireAuth, loadOwnedSite, photoSearchLimiter, async (req, res) => {
    const sources = pickerSources();
    if (!sources.length) return res.json({ ok: true, configured: false, sources, photos: [], hasMore: false });
    const source = sources.includes(req.query.source) ? req.query.source : sources[0];
    const q = str(req.query.q, 100) || (req.site.sections.meta && req.site.sections.meta.businessType) || req.site.name;
    const page = Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), 20);
    const { photos, hasMore } = source === 'unsplash' ? await searchUnsplashPage(q, 15, page) : await searchPhotosPage(q, 15, page);
    res.json({
      ok: true, configured: true, sources, source, query: q, page, hasMore,
      photos: photos.map(p => ({ id: p.id || '', source, url: p.url, thumb: p.thumb, alt: p.alt || '', photographer: p.photographer, photographerUrl: p.photographerUrl || '', pageUrl: p.pageUrl }))
    });
  });

  // An Unsplash photo was picked: tell Unsplash it is being used (their rule) and keep the photographer's credit for
  // the footer. The photo is looked up from our own recent search results, never taken from the browser.
  app.post('/sites/:id/photos/use', requireAuth, loadOwnedSite, photoSearchLimiter, async (req, res) => {
    const photo = recentUnsplash(req.body && req.body.id);
    if (!photo) return res.status(404).json({ ok: false, error: 'Search again, then pick the photo.' });
    photoCredits.record(db, req.site.id, photo);
    invalidateSiteCache(req.site);
    trackUnsplashDownload(photo).catch(() => {});
    res.json({ ok: true, url: photo.url });
  });

  return { applyIntake, autoDesign, baseSiteFromTemplate, readGenLogo, editApplyHandler, editProposeHandler, renderDashboard };
};
