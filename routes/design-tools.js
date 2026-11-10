// Design tools: compare, Design lab, Style Library, Signature, Blocks screen, Brand kit, devices and share links
// server.js calls this where these routes belong in its route order and hands it the shared helpers they use.
module.exports = function (app, deps) {
  const {
    BLK_ID, BLK_KEY, ITEM_ROUTES, LIB_HERO_DESIGNS, UPLOADS_DIR, areasWithSlugs, atelier, brandKit,
    buildNavPages, clientLimiter, crypto, db, designLab, ensureBlockIds, extraThemes, filmFx, findTemplate, fonts,
    fs, getSite, heightFx, icons, imgFx, industryDesign, invalidateSiteCache, isSafeUrl, isValidHexColor,
    loadOwnedSite, mixHeroAt, mixPage, multer, nanoid, path, pinFx, renderSitePage, requireAuth, safeFetch,
    saveVersion, scrollFx, servicesWithSlugs, slPageLib, smoothScroll, splitText, str, styleLib, styleSwap,
    syncMixBlocks, pdfExport, rateLimit, mailer, isTestEnv
  } = deps;
  const inlineEdit = require('../inlineedit');
  const decorKit = require('../decorkit');
  const textBoxes = require('../textboxes'), textStyles = require('../textstyles'), elStyles = require('../elstyles'), picBoxes = require('../picboxes');

  // ---- show the client: pitch mode, three designs side by side, a private preview link ----
  function adviceTemplateFor(site) {
    // the saved business type; failing that, a guess from the name, headline and services
    const bt = (site.sections.meta && site.sections.meta.businessType) || '';
    let tpl = findTemplate(bt);
    if (tpl.id === 'generic' && !bt.trim()) {
      const sc = site.sections || {};
      const guess = [site.name, sc.hero && sc.hero.headline, sc.about && sc.about.heading, ...((sc.services && sc.services.items) || []).map(x => x && x.title)].filter(Boolean).join(' ');
      const g = findTemplate(guess);
      if (g && g.id !== 'generic') tpl = g;
    }
    return tpl;
  }
  function compareStyles(site, asked) {
    const ok = (id) => extraThemes.ALL_STYLES.includes(id);
    const out = String(asked || '').split(',').filter(ok).slice(0, 3);
    if (out.length === 3) return out;
    const tpl = adviceTemplateFor(site);
    const rec = tpl && tpl.id !== 'generic' ? industryDesign.industryDesign(tpl.id).recommendedStyles : [];
    for (const id of [...rec, site.theme.style, 'flatcorp', 'japandi', 'energetic', 'organic']) if (ok(id) && !out.includes(id) && out.length < 3) out.push(id);
    return out;
  }
  const PITCH_MOTION = [
    { id: 'premium', label: 'Premium, lively', q: 'tier=premium&mstyle=lively' },
    { id: 'showcase', label: 'Showcase (moving color background)', q: 'tier=showcase&mstyle=lively' },
    { id: 'saved', label: 'As the site is set now', q: '' }
  ];
  const shareRow = (siteId) => db.prepare('SELECT token, created_at, views, last_viewed_at FROM share_links WHERE site_id = ?').get(siteId) || null;
  const shareUrl = (req, token) => `${req.protocol}://${req.get('host')}/look/${token}`;

  const salesLib = require('../packages');
  const kindOf = (r) => { try { return String((JSON.parse(r.sections || '{}').meta || {}).businessType || '').slice(0, 60); } catch { return ''; } };
  app.get('/sites/:id/pitch', requireAuth, loadOwnedSite, (req, res) => {
    const share = shareRow(req.site.id);
    const sales = salesLib.read(db, req.session.userId);
    const demos = sales.demos.length ? db.prepare(`SELECT id, name FROM sites WHERE user_id = ? AND id IN (${sales.demos.map(() => '?').join(',')})`).all(req.session.userId, ...sales.demos).filter(d => d.id !== req.site.id) : [];
    const notes = db.prepare('SELECT COUNT(*) AS n, SUM(CASE WHEN done = 0 THEN 1 ELSE 0 END) AS open FROM share_feedback WHERE site_id = ?').get(req.site.id);
    res.render('pitch', { site: req.site, motions: PITCH_MOTION, share, shareLink: share ? shareUrl(req, share.token) : '', sales, demos, placeholder: salesLib.PLACEHOLDER, notes: { n: notes.n || 0, open: notes.open || 0 } });
  });

  // ---- what Leo sells: three packages for the Pitch screen, and a demo gallery of his best sites (packages.js) ----
  const safeBack = (v) => (/^\/(?:sites\/\d+\/(?:pitch|edit)|dashboard|demos)$/.test(String(v || '')) ? String(v) : '/dashboard');
  app.get('/packages', requireAuth, (req, res) => {
    const mySites = db.prepare('SELECT id, name, sections FROM sites WHERE user_id = ? ORDER BY updated_at DESC LIMIT 200').all(req.session.userId).map(r => ({ id: r.id, name: r.name, kind: kindOf(r) }));
    res.render('packages', { sales: salesLib.read(db, req.session.userId), mySites, saved: req.query.saved === '1', back: safeBack(req.query.back), placeholder: salesLib.PLACEHOLDER });
  });
  app.post('/packages', requireAuth, (req, res) => {
    const sales = salesLib.fromForm(req.body);
    const mine = new Set(db.prepare('SELECT id FROM sites WHERE user_id = ?').all(req.session.userId).map(r => r.id));
    sales.demos = sales.demos.filter(id => mine.has(id));
    salesLib.write(db, req.session.userId, sales);
    res.redirect(`/packages?saved=1&back=${encodeURIComponent(safeBack(req.body.back))}`);
  });
  app.get('/demos', requireAuth, (req, res) => {
    const sales = salesLib.read(db, req.session.userId);
    const rows = sales.demos.length ? db.prepare(`SELECT id, name, sections FROM sites WHERE user_id = ? AND id IN (${sales.demos.map(() => '?').join(',')})`).all(req.session.userId, ...sales.demos) : [];
    const demos = sales.demos.map(id => rows.find(r => r.id === id)).filter(Boolean).map(r => { const sh = shareRow(r.id); return { id: r.id, name: r.name, kind: kindOf(r), share: sh ? shareUrl(req, sh.token) : '' }; });
    res.render('demos', { demos });
  });

  app.get('/sites/:id/compare', requireAuth, loadOwnedSite, (req, res) => {
    const styles = compareStyles(req.site, req.query.s);
    res.render('compare', {
      site: req.site, styles, ownColors: req.query.pal !== '0',
      options: extraThemes.ALL_STYLES.map(id => { const t = extraThemes.byId[id]; return { id, label: t ? (t.no ? t.no + '. ' : '') + t.label.split(' (')[0] : id.charAt(0).toUpperCase() + id.slice(1), approved: !!(t && t.no) }; })
    });
  });

  app.post('/sites/:id/compare/use', requireAuth, loadOwnedSite, (req, res) => {
    const style = req.body.style;
    if (!extraThemes.ALL_STYLES.includes(style)) return res.redirect(`/sites/${req.site.id}/compare`);
    saveVersion(req.site.id, req.site.theme, req.site.sections, req.site.layout, 'Before design change');
    const theme = { ...req.site.theme, ...styleSwap(style, req.body.pal === '1') };
    db.prepare("UPDATE sites SET theme = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(theme), req.site.id);
    invalidateSiteCache(req.site);
    res.redirect(`/sites/${req.site.id}/edit?saved=1#design`);
  });

  // Scroll Smoother and Split text from a form, or the saved ones when the form doesn't carry them
  const MOTION_KEYS = { theme_smoothScroll: ['smoothScroll', 'smoothFeel'], theme_splitText: ['splitText', ...Object.keys(splitText.DEFAULTS)], theme_scrollEl: ['scrollEl', 'scrollElWhat', 'scrollElSpeed', 'scrollElPlay'] };
  function keptMotion(saved, b) {
    const out = {};
    for (const [field, keys] of Object.entries(MOTION_KEYS)) {
      if (b && b[field] !== undefined) Object.assign(out, field === 'theme_smoothScroll' ? smoothScroll.parse(b) : field === 'theme_scrollEl' ? scrollFx.parse(b) : splitText.parse(b));
      else for (const k of keys) if (saved && saved[k] !== undefined) out[k] = saved[k];
    }
    return out;
  }

  // ---- Design lab: shuffle style, fonts, colors, shapes and section layouts, with locks; nothing saves until "Keep" ----
  function labCtx(site) {
    const tpl = adviceTemplateFor(site);
    return { theme: site.theme, templateId: tpl.id, businessType: (site.sections.meta && site.sections.meta.businessType) || tpl.id,
      advice: tpl && tpl.id !== 'generic' ? industryDesign.industryDesign(tpl.id) : null };
  }
  app.get('/sites/:id/lab', requireAuth, loadOwnedSite, (req, res) => {
    const ctx = labCtx(req.site), now = designLab.current(req.site.theme);
    res.render('lab', { site: req.site, combo: now, text: designLab.describe(now, ctx), motionSaved: req.query.saved === 'motion' });
  });
  app.post('/sites/:id/lab/roll', requireAuth, loadOwnedSite, (req, res) => {
    const b = req.body || {}, ctx = labCtx(req.site);
    const locks = {}; for (const d of designLab.DIMS) locks[d] = !!(b.locks && b.locks[d]);
    const combo = designLab.roll(ctx, b.from, { locks, colors: b.colors === 'any' ? 'any' : 'brand', styles: b.styles === 'all' ? 'all' : 'rec' });
    res.json({ ok: true, combo, text: designLab.describe(combo, ctx) });
  });
  app.post('/sites/:id/lab/use', requireAuth, loadOwnedSite, (req, res) => {
    const combo = designLab.parse(req.body.combo);
    if (!combo) return res.redirect(`/sites/${req.site.id}/lab`);
    saveVersion(req.site.id, req.site.theme, req.site.sections, req.site.layout, 'Before Design lab');
    const theme = { ...designLab.apply(req.site.theme, combo), ...keptMotion(req.site.theme, req.body) };
    db.prepare("UPDATE sites SET theme = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(theme), req.site.id);
    invalidateSiteCache(req.site);
    res.redirect(`/sites/${req.site.id}/edit?saved=1#design`);
  });
  // the Scroll Smoother and Split text card: saves only those, and stays in the lab
  app.post('/sites/:id/lab/motion', requireAuth, loadOwnedSite, (req, res) => {
    saveVersion(req.site.id, req.site.theme, req.site.sections, req.site.layout, 'Before scroll and text motion');
    const theme = { ...req.site.theme, ...keptMotion(req.site.theme, req.body) };
    db.prepare("UPDATE sites SET theme = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(theme), req.site.id);
    invalidateSiteCache(req.site);
    res.redirect(`/sites/${req.site.id}/lab?saved=motion`);
  });

  // ---- Style Library: browse the 44 styles with the client's own hero, preview any page blueprint, switch ----
  app.get('/sites/:id/styles', requireAuth, loadOwnedSite, (req, res) => {
    const site = req.site, trust = site.sections.trust || {};
    const basePath = `/sites/${site.id}/preview`;
    const ctx = { basePath, services: servicesWithSlugs(site.sections.services.items), areas: areasWithSlugs(trust.serviceAreas, trust.areaText), navPages: buildNavPages(site, basePath), preview: true, still: true };
    const clientColors = req.query.colors === 'client';
    const fits = styleLib.forBusiness((site.sections.meta || {}).businessType);
    const cards = styleLib.STYLES.map(st => {
      const theme = { ...site.theme, style: styleLib.PREFIX + st.id, slBlueprint: '', ...(clientColors ? {} : { primaryColor: st.c.accent, bgColor: '' }) };
      return { st, id: styleLib.PREFIX + st.id, fits: fits.includes(styleLib.PREFIX + st.id), hero: slPageLib.render({ ...ctx, site: { ...site, theme } }, true).html };
    });
    // one Google Fonts request for every style's display and body fonts
    const fams = [...new Set(styleLib.STYLES.flatMap(st => st.gf.split('&family=')))];
    res.render('stylelib', { site, cards, blueprints: styleLib.BLUEPRINTS, clientColors, current: site.theme.style, fontsHref: 'https://fonts.googleapis.com/css2?family=' + fams.join('&family=') + '&display=swap' });
  });
  app.post('/sites/:id/styles/use', requireAuth, loadOwnedSite, (req, res) => {
    const style = String(req.body.style || '');
    if (!styleLib.isLib(style)) return res.redirect(`/sites/${req.site.id}/styles`);
    saveVersion(req.site.id, req.site.theme, req.site.sections, req.site.layout, 'Before Style Library');
    const theme = { ...req.site.theme, ...styleSwap(style, req.body.colors !== 'client'), slBlueprint: styleLib.BLUEPRINT_IDS.includes(req.body.blueprint) ? req.body.blueprint : '' };
    db.prepare("UPDATE sites SET theme = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(theme), req.site.id);
    invalidateSiteCache(req.site);
    res.redirect(`/sites/${req.site.id}/edit?saved=1#design`);
  });

  // ---- Atelier: the 22 Signature pieces, each a live artwork over the client's own content ----
  app.get('/sites/:id/signature', requireAuth, loadOwnedSite, (req, res) => {
    const site = req.site, fit = atelier.forBusiness((site.sections.meta || {}).businessType);
    const cards = atelier.PIECES.map(p => ({ p, id: atelier.PREFIX + p.id, grad: atelier.GRAD[p.id], fits: fit === atelier.PREFIX + p.id }));
    // made-for-this-business first
    cards.sort((a, b) => b.fits - a.fits);
    const fams = [...new Set(atelier.PIECES.map(p => atelier.GF[p.id].split('&family=')[0]))];
    res.render('signature', { site, cards, current: site.theme.style, fontsHref: 'https://fonts.googleapis.com/css2?family=' + fams.join('&family=') + '&display=swap' });
  });
  app.post('/sites/:id/signature/use', requireAuth, loadOwnedSite, (req, res) => {
    const style = String(req.body.style || '');
    if (!atelier.isAtelier(style)) return res.redirect(`/sites/${req.site.id}/signature`);
    saveVersion(req.site.id, req.site.theme, req.site.sections, req.site.layout, 'Before Signature piece');
    // the piece keeps its own colors (styleSwap also puts the home layout back to automatic, which shows the artwork)
    const theme = { ...req.site.theme, ...styleSwap(style, true) };
    db.prepare("UPDATE sites SET theme = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(theme), req.site.id);
    invalidateSiteCache(req.site);
    res.redirect(`/sites/${req.site.id}/edit?saved=1#design`);
  });

  // ---- Blocks (mix and match): the home page built from any section of any style, in any order ----
  const mixSavedRows = (userId) => db.prepare('SELECT id, name, spec FROM mix_saved WHERE user_id = ? ORDER BY id DESC').all(userId)
    .map(r => ({ id: r.id, name: r.name, blocks: mixPage.clean((() => { try { return JSON.parse(r.spec); } catch (e) { return []; } })()) }));
  function mixCtx(site) {
    const basePath = `/sites/${site.id}/preview`, t = site.sections.trust || {};
    return { site, basePath, services: servicesWithSlugs(site.sections.services.items), areas: areasWithSlugs(t.serviceAreas, t.areaText), navPages: buildNavPages(site, basePath), preview: true };
  }
  app.get('/sites/:id/blocks', requireAuth, loadOwnedSite, (req, res) => {
    ensureBlockIds(req.site);
    const site = req.site, theme = site.theme || {};
    const layoutNow = extraThemes.homeLayoutOf(theme);
    const hiddenBlk = new Set(((site.layout && site.layout.hidden) || []).filter(k => BLK_KEY.test(k)).map(k => k.slice(4)));
    // the home page's content blocks are on the page too (a block hidden in Page sections is left off)
    const blocks = syncMixBlocks((layoutNow === 'mix' && (theme.mix || []).length) ? mixPage.clean(theme.mix) : mixPage.seed(site, app.locals.libTemplateId(site), layoutNow), site.sections, site.layout.hidden)
      .filter(b => b.k !== 'blk' || !hiddenBlk.has(b.v));
    // which designs have something real to show for this site (a block with no content is drawn as nothing)
    const ctx = mixCtx(site);
    const catalog = mixPage.catalog().map(c => ({ ...c, empty: !mixPage.render(ctx, [c]).items.length }));
    const label = (b) => ({ ...b, label: mixPage.labelOf(b, site), source: mixPage.sourceOf(b), type: mixPage.typeOf(b) });
    const own = mixPage.ownBlocks(site).map(c => ({ ...c, empty: false }));
    res.render('blocks', { site, blocks: blocks.map(label), catalog: catalog.concat(own), types: mixPage.TYPES, saved: mixSavedRows(req.session.userId).map(r => ({ ...r, blocks: r.blocks.map(label) })), live: layoutNow === 'mix', max: mixPage.MAX, pinOptions: pinFx.OPTIONS, filmStrengths: filmFx.STRENGTHS, imgOptions: imgFx.OPTIONS, heightOptions: heightFx.OPTIONS, photos: inlineEdit.photos(site.sections) });
  });
  app.post('/sites/:id/blocks/save', requireAuth, loadOwnedSite, (req, res) => {
    const blocks = mixPage.clean(req.body && req.body.blocks);
    if (!blocks.length) return res.status(400).json({ ok: false, error: 'Add at least one block first.' });
    saveVersion(req.site.id, req.site.theme, req.site.sections, req.site.layout, 'Before blocks change');
    const theme = { ...req.site.theme, homeLayout: 'mix', homeFull: false, mix: blocks };
    const sections = req.site.sections, at = mixHeroAt(blocks), v = at >= 0 ? blocks[at].v : '';
    // a content block taken off the page here is hidden (it stays in the editor under Page sections); one put back is shown
    const onPage = new Set(blocks.filter(m => m.k === 'blk').map(m => m.v));
    const layout = req.site.layout;
    const home = ((sections.blocks && sections.blocks.items) || []).filter(x => (x.page || 'home') === 'home' && BLK_ID.test(x.id || ''));
    layout.hidden = layout.hidden.filter(k => !(BLK_KEY.test(k) && onPage.has(k.slice(4)))).concat(home.filter(x => !onPage.has(x.id) && !layout.hidden.includes('blk:' + x.id)).map(x => 'blk:' + x.id));
    if (LIB_HERO_DESIGNS.includes(v)) sections.hero.design = v;
    else if (at >= 0 && LIB_HERO_DESIGNS.includes(sections.hero.design)) sections.hero.design = 'auto';
    theme.mix = syncMixBlocks(blocks, sections, layout.hidden);
    db.prepare("UPDATE sites SET theme = ?, sections = ?, layout = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(theme), JSON.stringify(sections), JSON.stringify(layout), req.site.id);
    invalidateSiteCache(req.site);
    res.json({ ok: true, count: blocks.length });
  });
  // Edit mode on the Blocks screen: words typed or a photo swapped on the preview, saved straight to the box that holds it
  app.post('/sites/:id/blocks/edit', requireAuth, loadOwnedSite, (req, res) => {
    const sections = req.site.sections, before = JSON.stringify(sections);
    const r = inlineEdit.apply(sections, req.body || {}, isSafeUrl);
    if (!r.ok) return res.status(400).json(r);
    saveVersion(req.site.id, req.site.theme, JSON.parse(before), req.site.layout, 'Before editing on the page');
    db.prepare("UPDATE sites SET sections = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(sections), req.site.id);
    invalidateSiteCache(req.site);
    res.json({ ok: true, where: r.where, photos: inlineEdit.photos(sections) });
  });
  // the page tools on the Blocks screen's Edit mode (+ Add text, pictures, shapes, stamps, Style text, Move & size):
  // the same four lists the editor saves, each one only when it is sent
  app.post('/sites/:id/blocks/tools', requireAuth, loadOwnedSite, (req, res) => {
    const b = req.body || {}, sections = req.site.sections || {};
    const texts = sections.texts = sections.texts || {};
    const kinds = [['texts_json', 'items', textBoxes], ['tstyles_json', 'styles', textStyles], ['estyles_json', 'elems', elStyles], ['pics_json', 'pics', picBoxes], ['wmarks_json', 'wmarks', require('../watermark')]];
    let n = 0;
    for (const [field, key, lib] of kinds) if (typeof b[field] === 'string') { texts[key] = lib.fromBody(b[field]); n++; }
    if (!n) return res.status(400).json({ ok: false, error: 'Nothing to save.' });
    db.prepare("UPDATE sites SET sections = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(sections), req.site.id);
    invalidateSiteCache(req.site);
    res.json({ ok: true });
  });
  app.post('/sites/:id/blocks/recipes', requireAuth, loadOwnedSite, (req, res) => {
    const blocks = mixPage.clean(req.body && req.body.blocks);
    if (!blocks.length) return res.status(400).json({ ok: false, error: 'Nothing to save.' });
    if (db.prepare('SELECT COUNT(*) AS n FROM mix_saved WHERE user_id = ?').get(req.session.userId).n >= 100) return res.status(400).json({ ok: false, error: 'You have 100 saved blocks and recipes. Delete one first.' });
    const name = str(req.body.name, 60) || (blocks.length === 1 ? mixPage.labelOf(blocks[0]) : `Page recipe (${blocks.length} blocks)`);
    const r = db.prepare('INSERT INTO mix_saved (user_id, name, spec) VALUES (?, ?, ?)').run(req.session.userId, name, JSON.stringify(blocks));
    res.json({ ok: true, id: Number(r.lastInsertRowid), name });
  });
  app.post('/sites/:id/blocks/recipes/:rid/delete', requireAuth, loadOwnedSite, (req, res) => {
    db.prepare('DELETE FROM mix_saved WHERE id = ? AND user_id = ?').run(Number(req.params.rid) || 0, req.session.userId);
    res.json({ ok: true });
  });

  // ---- Brand kit: palette, fonts, button shape, browser icon and share image from the logo; reusable kits ----
  const logoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => cb(null, /^image\/(png|jpe?g|gif|webp|svg\+xml)$/.test(file.mimetype)) });
  const kitRows = (userId) => db.prepare('SELECT id, name, data, created_at FROM brand_kits WHERE user_id = ? ORDER BY id DESC').all(userId)
    .map(r => ({ id: r.id, name: r.name, created_at: r.created_at, kit: brandKit.cleanKit(JSON.parse(r.data || '{}'), isSafeUrl) }));
  function renderBrand(req, res, extra) {
    // the owner's other sites that have decorations to copy (Decorations kit, decorkit.js)
    const others = db.prepare('SELECT id, name, theme, sections FROM sites WHERE user_id = ? AND id != ? ORDER BY updated_at DESC LIMIT 200').all(req.session.userId, req.site.id)
      .map(r => { let kit = null; try { kit = decorKit.capture({ theme: JSON.parse(r.theme || '{}'), sections: JSON.parse(r.sections || '{}') }); } catch { /* a broken row has nothing to copy */ } return { id: r.id, name: r.name, kit }; })
      .filter(r => r.kit).map(r => ({ id: r.id, name: r.name, summary: decorKit.summary(r.kit) }));
    const own = decorKit.capture(req.site);
    res.render('brand', { site: req.site, kits: kitRows(req.session.userId), draft: null, error: '', done: str(req.query.done, 20), shapes: designLab.SHAPES, now: designLab.current(req.site.theme),
      decorOthers: others, decorOwn: own ? decorKit.summary(own) : '', decorSummary: decorKit.summary, report: str(req.query.r, 40), ...extra });
  }
  function saveKit(userId, name, kit) {
    db.prepare('INSERT INTO brand_kits (user_id, name, data) VALUES (?, ?, ?)').run(userId, str(name, 60) || 'Brand kit', JSON.stringify(brandKit.cleanKit(kit, isSafeUrl)));
  }
  app.get('/sites/:id/brand', requireAuth, loadOwnedSite, (req, res) => renderBrand(req, res));
  app.post('/sites/:id/brand/build', requireAuth, loadOwnedSite, (req, res) => logoUpload.single('logo')(req, res, async (err) => {
    const site = req.site;
    if (err) return renderBrand(req, res, { error: 'That file is too large (5 MB at most) or is not an image.' });
    let sharpLib; try { sharpLib = require('sharp'); } catch { return renderBrand(req, res, { error: 'The picture tools (the "sharp" package) are not installed, so the brand kit cannot be made here. Run npm install in the SiteGen folder.' }); }
    let buf = req.file ? req.file.buffer : null, logoUrl = site.theme.logoUrl || '', newLogo = false;
    if (!buf) buf = await brandKit.readLogo(logoUrl, { uploadsDir: UPLOADS_DIR, safeFetch });
    if (!buf) return renderBrand(req, res, { error: logoUrl ? 'The logo could not be opened. Choose the logo file from your computer instead.' : 'This site has no logo yet. Choose the logo file below.' });
    try {
      const tpl = adviceTemplateFor(site), advice = tpl && tpl.id !== 'generic' ? industryDesign.industryDesign(tpl.id) : null;
      const a = await brandKit.analyse(buf, sharpLib, advice);
      if (req.file) {
        const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' }[req.file.mimetype] || 'png';
        const name = `bk-${site.id}-${crypto.randomBytes(6).toString('hex')}-logo.${ext}`;
        // an SVG is stored as a PNG so no script inside it can ever run from the site
        if (ext === 'svg') { await sharpLib(buf, { density: 288 }).resize(1200, 1200, { fit: 'inside', withoutEnlargement: false }).png().toFile(path.join(UPLOADS_DIR, name.replace(/svg$/, 'png'))); logoUrl = '/uploads/' + name.replace(/svg$/, 'png'); }
        else { fs.writeFileSync(path.join(UPLOADS_DIR, name), buf); logoUrl = '/uploads/' + name; }
        newLogo = true;
      }
      const icons = await brandKit.makeIcons(buf, sharpLib, UPLOADS_DIR, site.id);
      const pair = a.pair || { primary: site.theme.primaryColor, accent: site.theme.accentColor };
      const share = await brandKit.makeShare(buf, sharpLib, { uploadsDir: UPLOADS_DIR, siteId: site.id, heroUrl: site.sections.hero && site.sections.hero.imageUrl, primary: pair.primary, accent: pair.accent });
      renderBrand(req, res, { draft: { ...a, logoUrl, newLogo, icons, share, hasShare: !!(site.sections.seo && site.sections.seo.shareImage) } });
    } catch (e) {
      renderBrand(req, res, { error: 'That image could not be read as a logo (' + String(e.message || 'unknown error').slice(0, 80) + ').' });
    }
  }));
  app.post('/sites/:id/brand/apply', requireAuth, loadOwnedSite, (req, res) => {
    const site = req.site, b = req.body, kit = {};
    if (b.colors && b.colors !== 'keep') { const [p, a] = String(b.colors).split('|'); if (isValidHexColor(p) && isValidHexColor(a)) { kit.primaryColor = p; kit.accentColor = a; } }
    if (b.font && b.font !== 'keep') { const [h, bd] = String(b.font).split('|'); kit.headingFont = fonts.cleanFontName(h) || ''; kit.bodyFont = fonts.cleanFontName(bd) || ''; }
    if (b.shape && b.shape !== 'keep' && designLab.SHAPES.some(x => x.id === b.shape)) kit.shape = b.shape;
    if (b.icons === '1' && brandKit.isOwnFile(site.id, b.faviconUrl, 'png') && brandKit.isOwnFile(site.id, b.touchIconUrl, 'png')) { kit.faviconUrl = b.faviconUrl; kit.touchIconUrl = b.touchIconUrl; }
    if (b.logo === '1' && brandKit.isOwnFile(site.id, b.logoUrl, 'png|jpg|gif|webp')) kit.logoUrl = b.logoUrl;
    const share = b.share === '1' && brandKit.isOwnFile(site.id, b.shareUrl, 'jpg') ? b.shareUrl : '';
    saveVersion(site.id, site.theme, site.sections, site.layout, 'Before brand kit');
    const theme = brandKit.applyKit(site.theme, kit);
    const sections = share ? { ...site.sections, seo: { ...(site.sections.seo || {}), shareImage: share } } : site.sections;
    db.prepare("UPDATE sites SET theme = ?, sections = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(theme), JSON.stringify(sections), site.id);
    invalidateSiteCache(site);
    if (b.save_kit === '1') saveKit(req.session.userId, b.kit_name || site.name, brandKit.fromTheme(theme, sections));
    res.redirect(`/sites/${site.id}/brand?done=${b.save_kit === '1' ? 'applied-saved' : 'applied'}`);
  });
  app.post('/sites/:id/brand/save', requireAuth, loadOwnedSite, (req, res) => {
    saveKit(req.session.userId, req.body.kit_name || req.site.name, brandKit.fromTheme(req.site.theme, req.site.sections));
    res.redirect(`/sites/${req.site.id}/brand?done=saved`);
  });
  app.post('/sites/:id/brand/kits/:kitId/apply', requireAuth, loadOwnedSite, (req, res) => {
    const row = db.prepare('SELECT data FROM brand_kits WHERE id = ? AND user_id = ?').get(req.params.kitId, req.session.userId);
    if (!row) return res.redirect(`/sites/${req.site.id}/brand`);
    saveVersion(req.site.id, req.site.theme, req.site.sections, req.site.layout, 'Before brand kit');
    const kit = brandKit.cleanKit(JSON.parse(row.data || '{}'), isSafeUrl);
    let theme = brandKit.applyKit(req.site.theme, kit), sections = req.site.sections, r = '';
    // the kit's decorations too, unless the owner unticked them
    if (kit.decor && req.body.decor !== '0') { const d = decorKit.apply({ theme, sections }, kit.decor); theme = d.theme; sections = d.sections; r = `&r=${d.report.added}-${d.report.skipped}`; }
    db.prepare("UPDATE sites SET theme = ?, sections = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(theme), JSON.stringify(sections), req.site.id);
    invalidateSiteCache(req.site);
    res.redirect(`/sites/${req.site.id}/brand?done=kit${r}`);
  });
  // Copy another site's decorations (scene decor, pet patterns, watermarks, card looks) onto this one
  app.post('/sites/:id/brand/copy-decor', requireAuth, loadOwnedSite, (req, res) => {
    const row = db.prepare('SELECT theme, sections FROM sites WHERE id = ? AND user_id = ?').get(Number(req.body.from_site) || 0, req.session.userId);
    const kit = row ? decorKit.capture({ theme: JSON.parse(row.theme || '{}'), sections: JSON.parse(row.sections || '{}') }) : null;
    if (!kit) return res.redirect(`/sites/${req.site.id}/brand?done=decor-none`);
    saveVersion(req.site.id, req.site.theme, req.site.sections, req.site.layout, 'Before copying decorations');
    const d = decorKit.apply(req.site, kit);
    db.prepare("UPDATE sites SET theme = ?, sections = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(d.theme), JSON.stringify(d.sections), req.site.id);
    invalidateSiteCache(req.site);
    res.redirect(`/sites/${req.site.id}/brand?done=decor&r=${d.report.added}-${d.report.skipped}`);
  });
  app.post('/sites/:id/brand/kits/:kitId/delete', requireAuth, loadOwnedSite, (req, res) => {
    db.prepare('DELETE FROM brand_kits WHERE id = ? AND user_id = ?').run(req.params.kitId, req.session.userId);
    res.redirect(`/sites/${req.site.id}/brand?done=deleted`);
  });

  // ---- Device wall: phone, tablet, laptop and wide screen side by side ----
  app.get('/sites/:id/devices', requireAuth, loadOwnedSite, (req, res) => {
    res.render('devices', { site: req.site });
  });

  app.post('/sites/:id/share', requireAuth, loadOwnedSite, (req, res) => {
    const token = nanoid(24);
    db.prepare('DELETE FROM share_links WHERE site_id = ?').run(req.site.id);
    db.prepare('INSERT INTO share_links (site_id, token) VALUES (?, ?)').run(req.site.id, token);
    res.json({ ok: true, url: shareUrl(req, token) });
  });

  app.post('/sites/:id/share/revoke', requireAuth, loadOwnedSite, (req, res) => {
    db.prepare('DELETE FROM share_links WHERE site_id = ?').run(req.site.id);
    res.json({ ok: true });
  });

  // the client's private preview: view only, not indexed, works until it is replaced or turned off
  function loadShare(req, res, next) {
    res.set('Referrer-Policy', 'no-referrer');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    const token = String(req.params.token || '');
    const row = /^[A-Za-z0-9_-]{20,64}$/.test(token) ? db.prepare('SELECT * FROM share_links WHERE token = ?').get(token) : null;
    const site = row ? getSite(row.site_id) : null;
    if (!site) return res.status(404).render('not-found');
    req.site = site;
    req.share = row;
    next();
  }
  const shareOpts = (req, extra) => ({
    site: req.site, basePath: `/look/${req.params.token}/site`, preview: true, hideMotionBar: true,
    contactSent: false, contactError: false, cacheKey: null, ...extra
  });
  app.get('/look/:token', clientLimiter, loadShare, (req, res) => {
    db.prepare("UPDATE share_links SET views = views + 1, last_viewed_at = datetime('now') WHERE id = ?").run(req.share.id);
    res.render('share-view', { site: req.site, token: req.params.token });
  });
  app.get('/look/:token/site', clientLimiter, loadShare, (req, res) => {
    renderSitePage(req, res, null, shareOpts(req, { page: 'home' }));
  });
  app.get('/look/:token/site/:page', clientLimiter, loadShare, (req, res) => {
    renderSitePage(req, res, null, shareOpts(req, { page: req.params.page }));
  });
  app.get('/look/:token/site/:prefix/:item', clientLimiter, loadShare, (req, res) => {
    if (!Object.prototype.hasOwnProperty.call(ITEM_ROUTES, req.params.prefix)) return res.status(404).render('not-found');
    renderSitePage(req, res, null, shareOpts(req, { page: ITEM_ROUTES[req.params.prefix], itemSlug: req.params.item }));
  });

  // ---- Export PDF: every page of the site in one PDF to email to the client (pdfexport.js) ----
  // the pages a PDF can hold: home, then the menu pages (not the members login)
  const pdfPages = (site) => [{ key: 'home', label: 'Home', path: '' }].concat(
    buildNavPages(site, '').filter(n => n.key !== 'members').map(n => ({ key: n.key, label: String(n.label || n.key).slice(0, 60), path: n.href }))
  );
  app.get('/sites/:id/pdf', requireAuth, loadOwnedSite, (req, res) => {
    res.render('pdf-export', { site: req.site, pages: pdfPages(req.site), sizes: pdfExport.SIZES, browser: !!pdfExport.findBrowser() });
  });
  app.post('/sites/:id/pdf', requireAuth, loadOwnedSite, async (req, res) => {
    const all = pdfPages(req.site);
    const want = [].concat(req.body.pages || []).map(String);
    const pages = want.length ? all.filter(p => want.includes(p.key)) : all;
    const size = pdfExport.sizeOf(req.body.size);
    const key = pdfExport.issueKey(req.site.id);
    const base = `http://127.0.0.1:${req.socket.localPort}/pdfprint/${key}/site`;
    try {
      const out = await pdfExport.makePdf({
        pages: pages.map(p => ({ label: p.label, url: `${base}${p.path}?size=${size}` })),
        size, title: `${req.site.name}: website preview`
      });
      const name = `${pdfExport.safeName(req.site.name)} - website preview${size === 'phone' ? ' (phone)' : ''}.pdf`;
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', `attachment; filename="${name}"`);
      if (out.failed.length) res.set('X-SG-Skipped', encodeURIComponent(out.failed.join(', ')));
      res.send(out.pdf);
    } catch (e) {
      console.error('PDF export failed:', e.message);
      res.status(e.code === 'NO_BROWSER' ? 501 : 500).json({ ok: false, noBrowser: e.code === 'NO_BROWSER', error: e.code === 'NO_BROWSER' ? 'No Chrome or Edge was found on this computer.' : 'The PDF could not be made: ' + e.message });
    } finally {
      pdfExport.dropKey(key);
    }
  });
  // what the headless browser opens: the owner's preview, motion at rest, behind a 10-minute key
  function loadPrint(req, res, next) {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    const siteId = pdfExport.checkKey(req.params.key);
    const site = siteId ? getSite(siteId) : null;
    if (!site) return res.status(404).render('not-found');
    req.site = site;
    next();
  }
  const printOpts = (req, extra) => ({
    site: req.site, basePath: `/pdfprint/${req.params.key}/site`, preview: true, hideMotionBar: true,
    print: pdfExport.SIZES[pdfExport.sizeOf(req.query.size)], contactSent: false, contactError: false, cacheKey: null, ...extra
  });
  app.get('/pdfprint/:key/site', loadPrint, (req, res) => renderSitePage(req, res, null, printOpts(req, { page: 'home' })));
  app.get('/pdfprint/:key/site/:page', loadPrint, (req, res) => renderSitePage(req, res, null, printOpts(req, { page: req.params.page })));
  app.get('/pdfprint/:key/site/:prefix/:item', loadPrint, (req, res) => {
    if (!Object.prototype.hasOwnProperty.call(ITEM_ROUTES, req.params.prefix)) return res.status(404).render('not-found');
    renderSitePage(req, res, null, printOpts(req, { page: ITEM_ROUTES[req.params.prefix], itemSlug: req.params.item }));
  });

  // ---- client feedback on the share link: the client types what to change (and can point at the spot) ----
  const feedbackLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false,
    skip: () => isTestEnv, message: { ok: false, error: 'Too many notes at once. Please wait a few minutes.' }
  });
  const FEEDBACK_MAX = 500;   // per site
  const fbRow = (r) => ({ id: r.id, page: r.page, spot: r.spot, x: r.x, y: r.y, name: r.name, message: r.message, done: !!r.done, at: r.created_at });
  const pagePath = (v) => {
    const p = String(v || '').slice(0, 200);
    return /^\/[A-Za-z0-9/_\-.]*$/.test(p) ? p : '/';
  };
  app.get('/look/:token/feedback', clientLimiter, loadShare, (req, res) => {
    const rows = db.prepare('SELECT * FROM share_feedback WHERE site_id = ? ORDER BY id DESC LIMIT 200').all(req.site.id);
    res.json({ ok: true, notes: rows.map(fbRow) });
  });
  app.post('/look/:token/feedback', feedbackLimiter, loadShare, (req, res) => {
    const b = req.body || {};
    if (b.website) return res.json({ ok: true });   // honeypot
    const message = str(b.message, 2000).trim();
    if (message.length < 2) return res.status(400).json({ ok: false, error: 'Please type what you would like changed.' });
    const n = db.prepare('SELECT COUNT(*) AS n FROM share_feedback WHERE site_id = ?').get(req.site.id).n;
    if (n >= FEEDBACK_MAX) return res.status(429).json({ ok: false, error: 'This preview has all the notes it can take. Please send the rest by email.' });
    const frac = (v) => { const n = v === '' || v === null || v === undefined ? NaN : Number(v); return Number.isFinite(n) && n >= 0 && n <= 1 ? Math.round(n * 1000) / 1000 : null; };
    const row = {
      page: pagePath(b.page), spot: str(b.spot, 160).replace(/\s+/g, ' ').trim(), name: str(b.name, 80).trim(), message,
      x: frac(b.x), y: frac(b.y)
    };
    const info = db.prepare('INSERT INTO share_feedback (site_id, page, spot, x, y, name, message) VALUES (?, ?, ?, ?, ?, ?, ?)').run(req.site.id, row.page, row.spot, row.x, row.y, row.name, row.message);
    // tell the SiteGen account owner by email when mail is set up; never blocks the client
    try {
      const owner = db.prepare('SELECT email FROM users WHERE id = ?').get(req.site.user_id);
      if (owner && owner.email && mailer.isConfigured()) {
        const where = (row.page === '/' ? 'Home' : row.page) + (row.spot ? ` · ${row.spot}` : '');
        mailer.sendFeedbackAlert({
          to: owner.email, siteName: req.site.name, name: row.name, where, message: row.message,
          listUrl: `${req.protocol}://${req.get('host')}/sites/${req.site.id}/feedback`
        }).catch(err => console.error('Feedback email failed:', err.message));
      }
    } catch (e) { console.error('Feedback email failed:', e.message); }
    res.json({ ok: true, note: fbRow({ ...row, id: info.lastInsertRowid, done: 0, created_at: new Date().toISOString().slice(0, 19).replace('T', ' ') }) });
  });

  // Leo's list of the client's notes
  app.get('/sites/:id/feedback', requireAuth, loadOwnedSite, (req, res) => {
    const rows = db.prepare('SELECT * FROM share_feedback WHERE site_id = ? ORDER BY done ASC, id DESC').all(req.site.id);
    const fresh = new Set(rows.filter(r => !r.seen).map(r => r.id));
    db.prepare('UPDATE share_feedback SET seen = 1 WHERE site_id = ? AND seen = 0').run(req.site.id);
    const share = shareRow(req.site.id);
    res.render('feedback', { site: req.site, mailOn: mailer.isConfigured(), notes: rows.map(r => ({ ...fbRow(r), fresh: fresh.has(r.id) })), shareLink: share ? shareUrl(req, share.token) : '' });
  });
  app.post('/sites/:id/feedback/:fid/done', requireAuth, loadOwnedSite, (req, res) => {
    const done = req.body.done === '0' ? 0 : 1;
    db.prepare('UPDATE share_feedback SET done = ? WHERE id = ? AND site_id = ?').run(done, req.params.fid, req.site.id);
    if (String(req.get('accept') || '').includes('json')) return res.json({ ok: true, done: !!done });
    res.redirect(`/sites/${req.site.id}/feedback`);
  });
  app.post('/sites/:id/feedback/:fid/delete', requireAuth, loadOwnedSite, (req, res) => {
    db.prepare('DELETE FROM share_feedback WHERE id = ? AND site_id = ?').run(req.params.fid, req.site.id);
    res.redirect(`/sites/${req.site.id}/feedback`);
  });

  return { adviceTemplateFor, keptMotion };
};
