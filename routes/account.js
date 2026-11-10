// Sign up, log in, dashboard, new sites (import, generate, drafts), AI copy and photo search
// server.js calls this where these routes belong in its route order and hands it the shared helpers they use.
const ROOT = require('path').join(__dirname, '..');
const fs = require('fs');
const autosite = require('../autosite');
const brandKit = require('../brandkit');
const { safeFetch } = require('../scraper');
const UPLOADS_DIR = require('path').join(ROOT, 'public', 'uploads');

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

  app.post('/sites/import', requireAuth, importLimiter, async (req, res) => {
    const sourceUrl = str(req.body.url, 2000);
    const socialUrl = str(req.body.social_url, 2000);
    if (!sourceUrl) {
      return renderDashboard(req, res, { importError: 'Please paste a URL.' });
    }

    try {
      const scraped = await scrapeUrl(sourceUrl);

      if (socialUrl) {
        // Best-effort only — a bad/blocked social link should never stop the
        // import itself, so any failure here is silently swallowed.
        try {
          const social = await scrapeSocialInspiration(socialUrl);
          applySocialInspiration(scraped.theme, scraped.sections, social);
        } catch { /* ignore — social inspiration is optional */ }
      }

      const slug = uniqueSlug(scraped.name);
      const info = db.prepare(
        'INSERT INTO sites (user_id, slug, name, theme, sections, layout, source_url, seo_title, seo_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        req.session.userId,
        slug,
        scraped.name,
        JSON.stringify(scraped.theme),
        JSON.stringify(scraped.sections),
        JSON.stringify(defaultLayout()),
        scraped.sourceUrl,
        scraped.sections.seo.title,
        scraped.sections.seo.description
      );
      saveVersion(info.lastInsertRowid, scraped.theme, scraped.sections, defaultLayout(), 'Imported');
      res.redirect(`/sites/${info.lastInsertRowid}/edit?imported=1`);
    } catch (err) {
      renderDashboard(req, res, { importError: err.message || 'Could not import that site.' });
    }
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

  async function baseSiteFromTemplate(businessType, businessName, more) {
      const industry = await detectIndustry(businessType, businessName, more);
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

  // Builds a generated site in memory (nothing saved). Used by both "generate" and "preview first".
  async function buildGeneratedSite(body, logoFile) {
    const businessType = str(body.business_type, 100);
    const businessName = str(body.business_name, 80);
    const socialUrl = str(body.social_url, 2000);
    const { tpl, filled, theme, sections, industry } = await baseSiteFromTemplate(businessType, businessName, str(body.specialties, 600));
    if (body.home_blueprint === '1') { // the owner chose section designs while setting up: use the industry blueprint
      theme.homeLayout = 'blueprint';
      for (const f of Object.keys(sectionLibraryRegistry.FAMILIES)) { const v = body['bpv_' + f]; if (v && sectionLibraryRegistry.isVariant(f, v)) (theme.bpVariants = theme.bpVariants || {})[f] = v; }
    }
    applyIntake(body, theme, sections);
    if (sections.meta.city) {
      sections.seo.title = `${filled.name} | ${tpl.label} in ${sections.meta.city}`.slice(0, 70);
    }
    // Optional AI-written copy; falls back to the built-in template text.
    let copySource = 'template';
    const aiCopy = await generateCopy({
      name: filled.name,
      type: businessType,
      address: sections.contact.address,
      city: sections.meta.city,
      serviceAreas: sections.trust.serviceAreas,
      years: sections.trust.stats[0] ? sections.trust.stats[0].value : '',
      badges: sections.trust.badges,
      specialties: str(body.specialties, 600),
      design: designBrief.copyBrief(businessType, theme.style)
    });
    if (aiCopy) {
      copySource = 'ai';
      applyCopy(sections, aiCopy);
    }
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
    const businessType = str(req.body.business_type, 100);
    if (!businessType) {
      return renderDashboard(req, res, { generateError: 'Please describe the type of business (e.g. "plumbing company").' });
    }
    try {
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
      res.redirect(`/sites/${id}/edit?generated=${g.copySource === 'ai' ? 'ai' : '1'}`);
    } catch (err) {
      renderDashboard(req, res, { generateError: 'Could not generate a site. Please try again.' });
    }
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
    res.render('draft-preview', { d: req.draft, token: req.params.token, looks: DRAFT_LOOKS, current: req.draftSite.theme.style, ai: req.draft.copy_source === 'ai', auto: (req.draftSite.sections.meta || {}).auto || null, colorsNow: { primary: req.draftSite.theme.primaryColor, accent: req.draftSite.theme.accentColor } });
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
  app.post('/sites/draft/:token/create', requireAuth, loadDraft, (req, res) => {
    const d = req.draft;
    const g = { name: d.name, theme: JSON.parse(d.theme), sections: mergeSectionsWithDefaults(JSON.parse(d.sections)), copySource: d.copy_source };
    const id = insertGeneratedSite(req.session.userId, g, 'Generated');
    db.prepare('DELETE FROM site_drafts WHERE id = ?').run(d.id);
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
      if (!result.changes.length) return res.json({ ok: true, reply: parsed.reply || 'I couldn\'t find anything to change for that request.', changes: [], token: '' });
      for (const [k, v] of editProposals) if (v.exp < Date.now()) editProposals.delete(k);
      const token = crypto.randomBytes(16).toString('hex');
      editProposals.set(token, { siteId: site.id, scope, ops: parsed.ops, instruction, exp: Date.now() + 15 * 60 * 1000 });
      const heads = scope === 'client' ? [] : designBrief.warnings(site, parsed.ops);
      res.json({ ok: true, reply: [parsed.reply, ...heads.map(h => 'Heads up: ' + h)].filter(Boolean).join(' '), notes: heads, changes: result.changes, token, skipped: result.rejected });
    };
  }
  function editApplyHandler(scope) {
    return (req, res) => {
      const site = req.site;
      const p = editProposals.get(str((req.body || {}).token, 64));
      if (!p || p.exp < Date.now() || p.siteId !== site.id || p.scope !== scope) return res.status(400).json({ ok: false, error: 'That suggestion expired. Ask again.' });
      editProposals.delete(str(req.body.token, 64));
      const result = chatedit.applyOps(site, p.ops, { scope, styles: extraThemes.ALL_STYLES });
      if (!result.changes.length) return res.json({ ok: false, error: 'Nothing to apply.' });
      saveVersion(site.id, site.theme, site.sections, site.layout, ('Before AI edit: ' + p.instruction).slice(0, 60));
      db.prepare(`UPDATE sites SET theme = ?, sections = ?, seo_title = ?, seo_description = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(JSON.stringify(result.theme), JSON.stringify(result.sections), result.sections.seo.title, result.sections.seo.description, site.id);
      invalidateSiteCache(site);
      res.json({ ok: true, applied: result.changes.length });
    };
  }
  app.post('/sites/:id/ai-edit', requireAuth, loadOwnedSite, generateLimiter, editProposeHandler('owner'));
  app.post('/sites/:id/ai-edit/apply', requireAuth, loadOwnedSite, editApplyHandler('owner'));

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
    if (what !== 'photos') tidyHero(sections, site.name, sections.about && sections.about.body);
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
