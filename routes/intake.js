// Intake questionnaires: start links, PDF intake and submissions
// server.js calls this where these routes belong in its route order and hands it the shared helpers they use.
const ROOT = require('path').join(__dirname, '..');
const salesLib = require('../packages');
const salesFlow = require('../salesflow');

module.exports = function (app, deps) {
  const {
    aiComplete, applyIntake, autoDesign, baseSiteFromTemplate, readGenLogo, db, defaultLayout, designBrief, designOptionsLib, fs,
    generateGroundedCopy, generateLimiter, getSite, grounding, hasAiProvider, intake, intakePdf, isTestEnv, isValidEmail, mailer,
    multer, nanoid, optimizeUpload, path, rateLimit, requireAuth, saveVersion, str, uniqueSlug, upload
  } = deps;

  // ---- client questionnaire ----
  // The owner makes a link per client. The client fills in a friendly form (no account). The owner reviews
  // the answers and builds the site from them with one button: only what the client wrote goes on the site.
  const intakeLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false, skip: () => isTestEnv,
    message: 'Too many submissions from this device. Please try again later.'
  });
  const intakeUploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false, skip: () => isTestEnv,
    handler: (req, res) => res.status(429).json({ ok: false, error: 'Too many uploads. Please try again later.' })
  });
  function loadIntakeLink(req, res, next) {
    res.set({ 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' });
    const token = String(req.params.token || '');
    const link = /^[A-Za-z0-9_-]{16,64}$/.test(token) ? db.prepare('SELECT * FROM intake_links WHERE token = ?').get(token) : null;
    if (!link || link.closed) return res.status(404).render('start', { mode: 'closed', link: null, token: '', errors: [], d: {}, owner: '' });
    req.intakeLink = link;
    req.intakeOwner = db.prepare('SELECT email FROM users WHERE id = ?').get(link.user_id);
    next();
  }
  // the owner's packages, for "Which package are you interested in?" (names and only the prices the owner typed)
  const pkgChoices = (userId) => salesLib.read(db, userId).tiers.map(t => ({ name: t.name, price: t.price }));
  const startView = (req, extra) => ({ mode: 'form', link: req.intakeLink, token: req.params.token, errors: [], d: {}, owner: '', pkgs: req.intakeLink ? pkgChoices(req.intakeLink.user_id) : [], ...extra });

  app.get('/start/:token', loadIntakeLink, (req, res) => res.render('start', startView(req, {})));

  app.post('/start/:token/upload', intakeUploadLimiter, loadIntakeLink, (req, res) => {
    upload.single('image')(req, res, async (err) => {
      if (err) return res.status(400).json({ ok: false, error: err.message });
      if (!req.file) return res.status(400).json({ ok: false, error: 'No file received.' });
      await optimizeUpload(req.file);
      res.json({ ok: true, url: `/uploads/${req.file.filename}` });
    });
  });

  app.post('/start/:token', intakeLimiter, loadIntakeLink, (req, res) => {
    const b = req.body || {};
    if (b.website) return res.redirect(`/start/${req.params.token}/done`); // honeypot
    const d = intake.clean(b);
    d.pkg = pkgChoices(req.intakeLink.user_id).some(p => p.name === d.pkg) ? d.pkg : '';
    const errors = intake.problems(d);
    if (errors.length) return res.status(400).render('start', startView(req, { errors, d: b }));
    const info = db.prepare('INSERT INTO intake_submissions (link_id, user_id, data, package) VALUES (?, ?, ?, ?)').run(req.intakeLink.id, req.intakeLink.user_id, JSON.stringify(d), d.pkg);
    if (mailer.isConfigured() && req.intakeOwner) {
      mailer.sendReport({
        to: req.intakeOwner.email, replyTo: d.contactEmail,
        subject: `New client questionnaire: ${d.bizName}`,
        text: `${d.contactName} filled in the questionnaire for ${d.bizName} (${d.bizType}).${d.pkg ? `\nPackage they're interested in: ${d.pkg}` : ''}\n\nReview it and build the site: ${req.protocol}://${req.get('host')}/intake/submissions/${info.lastInsertRowid}\n\nReply to this email to reach ${d.contactName} (${d.contactEmail}${d.contactPhone ? ', ' + d.contactPhone : ''}).\n`
      }).catch(e => console.error('Questionnaire email failed:', e.message));
    }
    res.redirect(`/start/${req.params.token}/done`);
  });
  app.get('/start/:token/done', loadIntakeLink, (req, res) => res.render('start', startView(req, { mode: 'done' })));

  // owner side
  const intakeBase = (req) => `${req.protocol}://${req.get('host')}/start/`;
  app.get('/intake', requireAuth, (req, res) => {
    const links = db.prepare(`SELECT l.*, (SELECT COUNT(*) FROM intake_submissions s WHERE s.link_id = l.id) AS n FROM intake_links l WHERE l.user_id = ? AND l.kind = '' ORDER BY l.id DESC`).all(req.session.userId);
    const subs = db.prepare('SELECT s.id, s.status, s.site_id, s.created_at, s.data, s.source, l.label FROM intake_submissions s JOIN intake_links l ON l.id = s.link_id WHERE s.user_id = ? ORDER BY s.id DESC LIMIT 100').all(req.session.userId)
      .map(r => { let d = {}; try { d = JSON.parse(r.data); } catch { /* */ } return { ...r, d }; });
    res.render('intake', { links, subs, base: intakeBase(req), flash: req.query.f || '' });
  });
  // The questionnaire as a fillable PDF, and filled-out PDFs uploaded by the owner (intakepdf.js)
  const INTAKE_PDF_DIR = path.join(path.dirname(process.env.DB_PATH || path.join(ROOT, 'data', 'sitegen.db')), 'intake-pdfs');
  const intakePdfUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 } });
  const intakePdfPath = (row) => (row && /^[A-Za-z0-9_-]+\.pdf$/.test(row.pdf_file || '') ? path.join(INTAKE_PDF_DIR, row.pdf_file) : '');
  app.get('/intake/questionnaire.pdf', requireAuth, (req, res) => {
    const forName = str(req.query.for, 80);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="website-questionnaire${forName ? '-' + forName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : ''}.pdf"`);
    res.send(intakePdf.makeBlank({ forName }));
  });
  app.post('/intake/pdf', requireAuth, generateLimiter, (req, res) => {
    intakePdfUpload.single('pdf')(req, res, async (err) => {
      if (err) return res.redirect('/intake?f=pdfbig');
      if (!req.file) return res.redirect('/intake?f=pdfnone');
      const got = await intakePdf.read(req.file.buffer, { hasAiProvider, complete: aiComplete });
      if (got.error) return res.redirect('/intake?f=pdf' + got.error);
      const uid = req.session.userId;
      let link = db.prepare("SELECT id FROM intake_links WHERE user_id = ? AND kind = 'pdf'").get(uid);
      if (!link) link = { id: db.prepare("INSERT INTO intake_links (user_id, token, label, closed, kind) VALUES (?, ?, 'Uploaded PDF', 1, 'pdf')").run(uid, nanoid(24)).lastInsertRowid };
      const id = db.prepare('INSERT INTO intake_submissions (link_id, user_id, data, source) VALUES (?, ?, ?, ?)').run(link.id, uid, JSON.stringify(got.d), 'pdf-' + got.source).lastInsertRowid;
      try {
        fs.mkdirSync(INTAKE_PDF_DIR, { recursive: true });
        const file = `${id}-${nanoid(12).replace(/[^A-Za-z0-9_-]/g, '')}.pdf`;
        fs.writeFileSync(path.join(INTAKE_PDF_DIR, file), req.file.buffer);
        db.prepare('UPDATE intake_submissions SET pdf_file = ? WHERE id = ?').run(file, id);
      } catch (e) { console.error('Could not keep the questionnaire PDF:', e.message); }
      res.redirect(`/intake/submissions/${id}`);
    });
  });
  // the email a client gets with their questionnaire link (sent from the owner's SMTP, replies go to the owner)
  async function emailLink(req, link, to, name) {
    const owner = db.prepare('SELECT email FROM users WHERE id = ?').get(req.session.userId) || {};
    return mailer.sendReport({
      to, replyTo: owner.email,
      subject: `A few questions for your new website${link.label ? ' (' + link.label + ')' : ''}`,
      text: `Hi${name ? ' ' + name : ''},\n\nTo build your new website I need a few details about your business: what you offer, your hours, your logo and some photos. It takes about 10 minutes and works on a phone, and your answers are saved as you go.\n\n${intakeBase(req)}${link.token}\n\nAny questions, just reply to this email.\n\nThank you!`
    }).catch(e => { console.error('Questionnaire link email failed:', e.message); return false; });
  }
  app.post('/intake/links', requireAuth, async (req, res) => {
    const n = db.prepare('SELECT COUNT(*) AS n FROM intake_links WHERE user_id = ?').get(req.session.userId).n;
    if (n >= 100) return res.redirect('/intake?f=toomany');
    const to = str(req.body.email, 254).trim();
    if (to && !isValidEmail(to)) return res.redirect('/intake?f=bademail');
    const token = nanoid(24), label = str(req.body.label, 80);
    db.prepare('INSERT INTO intake_links (user_id, token, label) VALUES (?, ?, ?)').run(req.session.userId, token, label);
    if (!to) return res.redirect('/intake?f=created');
    const ok = mailer.isConfigured() && await emailLink(req, { token, label }, to, str(req.body.first, 60).trim());
    res.redirect('/intake?f=' + (ok ? 'emailed' : 'nomail'));
  });
  app.post('/intake/links/:id/send', requireAuth, async (req, res) => {
    const l = db.prepare('SELECT * FROM intake_links WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
    const to = str(req.body.email, 254).trim();
    if (!l || l.closed) return res.redirect('/intake');
    if (!isValidEmail(to)) return res.redirect('/intake?f=bademail');
    const ok = mailer.isConfigured() && await emailLink(req, l, to, '');
    res.redirect('/intake?f=' + (ok ? 'emailed' : 'nomail'));
  });
  app.post('/intake/links/:id/toggle', requireAuth, (req, res) => {
    db.prepare('UPDATE intake_links SET closed = 1 - closed WHERE id = ? AND user_id = ?').run(req.params.id, req.session.userId);
    res.redirect('/intake');
  });
  app.post('/intake/links/:id/delete', requireAuth, (req, res) => {
    const l = db.prepare('SELECT id FROM intake_links WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
    if (l && !db.prepare('SELECT 1 FROM intake_submissions WHERE link_id = ?').get(l.id)) db.prepare('DELETE FROM intake_links WHERE id = ?').run(l.id);
    res.redirect('/intake');
  });
  function loadSubmission(req, res, next) {
    const row = db.prepare('SELECT * FROM intake_submissions WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
    if (!row) return res.status(404).render('not-found');
    try { row.d = JSON.parse(row.data); } catch { row.d = {}; }
    try { row.todoList = JSON.parse(row.todo); } catch { row.todoList = []; }
    req.submission = row;
    next();
  }
  app.get('/intake/submissions/:id', requireAuth, loadSubmission, (req, res) => {
    const s = req.submission;
    res.render('intake-view', { s, d: s.d, claims: intake.claimsToCheck(s.d), todo: s.status === 'built' ? s.todoList : intake.todoList(s.d), site: s.site_id ? getSite(s.site_id) : null, designChoices: s.site_id ? null : designOptionsLib.designOptions(s.d), error: req.query.error || '' });
  });
  app.get('/intake/submissions/:id/pdf', requireAuth, loadSubmission, (req, res) => {
    const file = intakePdfPath(req.submission);
    if (!file || !fs.existsSync(file)) return res.status(404).render('not-found');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="questionnaire-${req.submission.id}.pdf"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(file);
  });
  app.post('/intake/submissions/:id/delete', requireAuth, loadSubmission, (req, res) => {
    db.prepare('DELETE FROM intake_submissions WHERE id = ?').run(req.submission.id);
    const pdfFile = intakePdfPath(req.submission);
    if (pdfFile) fs.rmSync(pdfFile, { force: true });
    res.redirect('/intake');
  });
  app.post('/intake/submissions/:id/build', requireAuth, loadSubmission, generateLimiter, async (req, res) => {
    const s = req.submission;
    if (s.site_id && getSite(s.site_id)) return res.redirect(`/sites/${s.site_id}/edit`);
    try {
      const d = s.d;
      const { tpl, filled, theme, sections, industry } = await baseSiteFromTemplate(d.bizType, d.bizName, [d.diffs, d.about].flat().filter(Boolean).join(' ').slice(0, 600));
      const name = d.bizName;
      applyIntake(intake.toGenerateBody(d), theme, sections);
      if (d.mood) theme.style = d.mood;
      // the owner's pick from the suggested design options (recomputed here, never trusted from the browser)
      const pickIdx = /^[0-2]$/.test(String(req.body.option || '')) ? parseInt(req.body.option, 10) : -1;
      if (pickIdx >= 0) designOptionsLib.applyOption(theme, designOptionsLib.designOptions(d).options[pickIdx]);
      if (d.logo) theme.logoUrl = d.logo;
      sections.meta.businessType = d.bizType;
      // Facts-only wording: the AI may rephrase what the client told us and nothing else; anything it (or the
      // template) says that the client did not support is then replaced or removed (see grounding.js).
      const facts = grounding.buildFacts(d);
      facts.design = designBrief.copyBrief(d.bizType, theme.style);
      let aiCopy = await generateGroundedCopy(facts);
      if (aiCopy) {
        const probs = grounding.checkCopy(aiCopy, facts);
        if (probs.length) {
          const retry = await generateGroundedCopy(facts, { feedback: [...new Set(probs.map(p => p.reason))].slice(0, 6).join('; ') });
          if (retry) aiCopy = retry;
        }
        if (aiCopy.hero.headline) sections.hero.headline = aiCopy.hero.headline;
        if (aiCopy.hero.subheadline) sections.hero.subheadline = aiCopy.hero.subheadline;
        if (aiCopy.hero.ctaText) sections.hero.ctaText = aiCopy.hero.ctaText;
        if (aiCopy.about) sections.about.body = aiCopy.about;
        if (aiCopy.services.length) sections.services.items = aiCopy.services;
        if (aiCopy.seoTitle) sections.seo.title = aiCopy.seoTitle;
        if (aiCopy.seoDescription) sections.seo.description = aiCopy.seoDescription;
      }
      // the client's own words always win over the AI
      if (d.tagline) sections.hero.subheadline = d.tagline;
      if (d.about) sections.about.body = d.about;
      if (d.services.length) sections.services.items = d.services.map(x => ({ title: x.name, description: [x.price, x.desc].filter(Boolean).join(' · ') }));
      // what sets them apart becomes the "Why choose us" cards, in the client's words
      if (facts.diffs.length) sections.whyChoose = { ...sections.whyChoose, items: facts.diffs.slice(0, 6).map(x => (x.length <= 80 ? { icon: 'check', title: x, text: '' } : { icon: 'check', title: x.split(/[.,;:]/)[0].slice(0, 80), text: x.slice(0, 160) })) };
      else sections.whyChoose = { ...sections.whyChoose, items: [] };
      sections.faq.items = d.faq.map(x => ({ question: x.q, answer: x.a }));
      // photos: the client's own first; stock only if they agreed to it
      if (d.photos.length) {
        sections.hero.imageUrl = d.photos[0];
        sections.about.imageUrl = d.photos[1] || sections.about.imageUrl;
        sections.gallery.images = d.photos.slice(1);
      } else if (!d.stockOk) {
        sections.hero.imageUrl = ''; sections.about.imageUrl = ''; sections.gallery.images = [];
        sections.blocks.items = (sections.blocks.items || []).map(b => ({ ...b, imageUrl: '' }));
      }
      // safe extras: the contact form, privacy pages, and the chat assistant only if asked for
      sections.contact.acceptSubmissions = true;
      sections.legal = { ...sections.legal, enabled: true, ownerName: name, email: d.email || '' };
      if (d.features.includes('chat')) sections.chat = { ...sections.chat, enabled: true };
      sections.seo.title = `${name} | ${d.bizType}${sections.meta.city ? ' in ' + sections.meta.city : ''}`.slice(0, 70);
      if (!aiCopy || d.tagline) sections.seo.description = (d.tagline || sections.hero.subheadline || '').slice(0, 160);
      const scrub = grounding.scrubSections(sections, facts);
      // smart extras (autosite.js): the logo's colors matched to one of our palettes (the client's own brand color
      // still wins), and the new content blocks that suit the industry, filled from the client's own answers
      const wantBlocks = req.body.auto_blocks === '1';
      const logoBuf = d.logo ? await readGenLogo(null, d.logo) : null;
      if (logoBuf || wantBlocks) await autoDesign({ name, theme, sections }, { industry, logoBuf, blocks: wantBlocks, keepColors: !!d.brandColor });
      const slug = uniqueSlug(name);
      const layout = defaultLayout();
      if (scrub.hideFaq && !layout.hidden.includes('faq')) layout.hidden.push('faq');
      const info = db.prepare('INSERT INTO sites (user_id, slug, name, theme, sections, layout, seo_title, seo_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(req.session.userId, slug, name, JSON.stringify(theme), JSON.stringify(sections), JSON.stringify(layout), sections.seo.title, sections.seo.description);
      saveVersion(info.lastInsertRowid, theme, sections, layout, 'Built from client questionnaire');
      if (s.package || d.pkg) salesFlow.set(db, info.lastInsertRowid, { package: str(s.package || d.pkg, 40) }); // pre-picks it on the preview link's Approve
      db.prepare("UPDATE intake_submissions SET status = 'built', site_id = ?, todo = ? WHERE id = ?").run(info.lastInsertRowid, JSON.stringify(intake.todoList(d).concat(scrub.notes.length ? [`Wording the client did not support was replaced or removed (${scrub.notes.join(', ')}). Add real details if you want those parts back.`] : [])), s.id);
      void tpl; void filled;
      res.redirect(`/sites/${info.lastInsertRowid}/edit?generated=${aiCopy ? 'ai' : '1'}&fromintake=1`);
    } catch (err) {
      console.error('Build from questionnaire failed:', err.message);
      res.redirect(`/intake/submissions/${s.id}?error=1`);
    }
  });
};
