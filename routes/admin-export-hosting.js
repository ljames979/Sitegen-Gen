// Billing, admin and backups, block library, export, hosting and payment requests
// server.js calls this where these routes belong in its route order and hands it the shared helpers they use.
const ROOT = require('path').join(__dirname, '..');

module.exports = function (app, deps) {
  const {
    PAGE_KEYS, ZipArchive, areasWithSlugs, backups, billing, buildChecklist, buildNavPages, cache, calc, db,
    defaultTheme, extraPageList, extraThemes, fs, googleReviews, hostingNotifyEmail, images, isAdmin, isTestEnv,
    isValidEmail, isValidHostname, legal, loadOwnedSite, mailer, markPaid, mergeSectionsWithDefaults, multer, nanoid,
    netlify, newPayment, os, ownerEmailFor, pageIsAvailable, parseBlocksFromBody, path, payBase, payReady, payments,
    qualityGate, rateLimit, recordPublish, refreshPayment, renderDashboard, requireAuth, safeParseLayout,
    saveVersion, servicesWithSlugs, session, str, uniqueSlug, wordStyle
  } = deps;

  // ---- hosting billing (Stripe) ----
  function billingRow(id) { return db.prepare('SELECT * FROM sites WHERE id = ?').get(id); }
  const billingLabels = { none: 'Not started', active: 'Active', trialing: 'Trial', past_due: 'Payment failed', unpaid: 'Unpaid', canceled: 'Canceled', incomplete: 'Waiting for payment', incomplete_expired: 'Expired', paused: 'Paused' };
  const billingMessages = {
    saved: 'Billing settings saved.', link: 'Payment link created.', sent: 'Payment link emailed.',
    sendfailed: 'Could not send the email. Check that email sending is set up (README, "Email alerts"), or copy the link and send it yourself.',
    notconfigured: 'Stripe is not set up yet. See the README, "Charging for hosting".', stripefail: 'Stripe returned an error. Check your keys and price ID.',
    bademail: 'That email address does not look right.', paid: 'Thank you! Payment received. The status below updates as soon as Stripe confirms it.',
    noportal: 'There is no Stripe customer for this site yet.'
  };
  app.get('/sites/:id/billing', requireAuth, loadOwnedSite, (req, res) => {
    const row = billingRow(req.site.id);
    res.render('billing', {
      site: req.site, row, label: billingLabels[row.billing_status] || row.billing_status,
      suspended: billing.isSuspended(row), graceDays: billing.GRACE_DAYS,
      configured: billing.isConfigured(), webhookReady: billing.webhookReady(), mailConfigured: mailer.isConfigured(),
      webhookUrl: `${req.protocol}://${req.get('host')}/stripe/webhook`,
      link: '', msgs: billingMessages,
      flash: billingMessages[req.query.m] ? req.query.m : ''
    });
  });

  app.post('/sites/:id/billing/settings', requireAuth, loadOwnedSite, (req, res) => {
    const email = String(req.body.billing_email || '').trim().slice(0, 200);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.redirect(`/sites/${req.site.id}/billing?m=bademail`);
    db.prepare('UPDATE sites SET billing_required = ?, billing_email = ? WHERE id = ?').run(req.body.billing_required === '1' ? 1 : 0, email, req.site.id);
    res.redirect(`/sites/${req.site.id}/billing?m=saved`);
  });

  app.post('/sites/:id/billing/checkout', requireAuth, loadOwnedSite, async (req, res) => {
    if (!billing.isConfigured()) return res.redirect(`/sites/${req.site.id}/billing?m=notconfigured`);
    const row = billingRow(req.site.id);
    const to = String(req.body.billing_email || row.billing_email || '').trim();
    if (to && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return res.redirect(`/sites/${req.site.id}/billing?m=bademail`);
    if (to !== row.billing_email) db.prepare('UPDATE sites SET billing_email = ? WHERE id = ?').run(to, row.id);
    try {
      const origin = `${req.protocol}://${req.get('host')}`;
      const session = await billing.createCheckout({
        siteId: row.id, siteName: row.name, email: to,
        successUrl: `${origin}/billing/thanks`, cancelUrl: `${origin}/billing/thanks?canceled=1`
      });
      if (req.body.send === '1') {
        const ok = await mailer.sendPaymentLink({ to, siteName: row.name, link: session.url, replyTo: (db.prepare('SELECT email FROM users WHERE id = ?').get(req.session.userId) || {}).email });
        return res.redirect(`/sites/${row.id}/billing?m=${ok ? 'sent' : 'sendfailed'}`);
      }
      res.render('billing', {
        site: req.site, row: billingRow(row.id), label: billingLabels[row.billing_status] || row.billing_status,
        suspended: billing.isSuspended(row), graceDays: billing.GRACE_DAYS,
        configured: true, webhookReady: billing.webhookReady(), mailConfigured: mailer.isConfigured(),
        webhookUrl: `${origin}/stripe/webhook`, link: session.url, msgs: billingMessages, flash: 'link'
      });
    } catch (err) {
      console.error('stripe checkout failed:', err.message);
      res.redirect(`/sites/${row.id}/billing?m=stripefail`);
    }
  });

  app.post('/sites/:id/billing/portal', requireAuth, loadOwnedSite, async (req, res) => {
    const row = billingRow(req.site.id);
    if (!billing.isConfigured()) return res.redirect(`/sites/${row.id}/billing?m=notconfigured`);
    if (!row.stripe_customer_id) return res.redirect(`/sites/${row.id}/billing?m=noportal`);
    try {
      const portal = await billing.createPortal({ customer: row.stripe_customer_id, returnUrl: `${req.protocol}://${req.get('host')}/sites/${row.id}/billing` });
      res.redirect(portal.url);
    } catch (err) {
      console.error('stripe portal failed:', err.message);
      res.redirect(`/sites/${row.id}/billing?m=stripefail`);
    }
  });

  app.get('/billing/thanks', (req, res) => res.render('billing-thanks', { canceled: req.query.canceled === '1' }));

  // ---- admin backup ----
  // The admin is the account named in ADMIN_EMAIL, or (if unset) the first
  // account ever created. The backup holds every user's data, so nobody else
  // may download it.

  app.get('/admin/backup', requireAuth, async (req, res) => {
    if (!isAdmin(req.session.userId)) return res.status(404).render('not-found');
    const tmp = path.join(os.tmpdir(), `sitegen-backup-${nanoid(10)}.db`);
    try {
      await db.backup(tmp); // a consistent snapshot, even while the app is in use
      res.attachment(`sitegen-backup-${new Date().toISOString().slice(0, 10)}.zip`);
      const zip = new ZipArchive({ zlib: { level: 9 } });
      const cleanup = () => fs.rm(tmp, { force: true }, () => {});
      res.on('close', cleanup);
      zip.on('error', (err) => { console.error('Backup failed:', err.message); res.end(); });
      zip.pipe(res);
      zip.file(tmp, { name: 'sitegen.db' });
      const uploadsDir = path.join(ROOT, 'public', 'uploads');
      for (const name of fs.readdirSync(uploadsDir)) {
        if (name.startsWith('.')) continue;
        const p = path.join(uploadsDir, name);
        if (fs.statSync(p).isFile()) zip.file(p, { name: `uploads/${name}` });
      }
      zip.append(
        'SiteGen backup\n\nTo restore: stop SiteGen, copy sitegen.db into the data folder (replacing data/sitegen.db),\n' +
        'copy the files in uploads/ into public/uploads/, then start SiteGen again.\n',
        { name: 'RESTORE.txt' }
      );
      await zip.finalize();
    } catch (err) {
      console.error('Backup failed:', err.message);
      fs.rm(tmp, { force: true }, () => {});
      if (!res.headersSent) res.status(500).send('Could not create the backup.');
    }
  });

  // ---- automatic HTTPS support (used by Caddy; see deploy/Caddyfile) ----
  // Caddy asks this before getting a certificate for a domain, so strangers
  // can't make the server request certificates for domains it doesn't host.
  // Only answers the local Caddy itself: anything proxied from the internet
  // carries an X-Forwarded-For header and is refused.
  app.get('/internal/domain-check', (req, res) => {
    const addr = req.socket.remoteAddress || '';
    const isLocal = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(addr);
    if (!isLocal || req.headers['x-forwarded-for'] || req.headers['forwarded']) return res.status(404).end();
    const domain = String(req.query.domain || '').trim().toLowerCase();
    if (!isValidHostname(domain)) return res.status(404).end();
    const appDomain = (process.env.APP_DOMAIN || '').trim().toLowerCase();
    if (appDomain && domain === appDomain) return res.status(200).send('ok');
    const row = db.prepare('SELECT 1 FROM sites WHERE custom_domain = ? AND published = 1').get(domain);
    return row ? res.status(200).send('ok') : res.status(404).end();
  });

  app.post('/sites/:id/duplicate', requireAuth, loadOwnedSite, (req, res) => {
    const src = req.site;
    const asTpl = (req.body || {}).mode === 'template' || req.query.mode === 'template';
    const name = (asTpl ? `${src.name} (template copy)` : `${src.name} (copy)`).slice(0, 80);
    // a copy never inherits the live address, domain, client links or published state
    const sections = asTpl ? backups.asTemplate(src.sections) : src.sections;
    const info = db.prepare(
      'INSERT INTO sites (user_id, slug, name, theme, sections, layout, seo_title, seo_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      req.session.userId, uniqueSlug(name), name,
      JSON.stringify(src.theme), JSON.stringify(sections), JSON.stringify(src.layout),
      src.seo_title || '', src.seo_description || ''
    );
    saveVersion(info.lastInsertRowid, src.theme, sections, src.layout, asTpl ? 'Copied as a template' : 'Duplicated');
    res.redirect(`/sites/${info.lastInsertRowid}/edit`);
  });

  // one site as a portable file, and bringing one back in (photos stay where they are: they are not inside the file)
  app.get('/sites/:id/export.json', requireAuth, loadOwnedSite, (req, res) => {
    res.attachment(`${req.site.slug}.sitegen.json`);
    res.type('application/json').send(JSON.stringify(backups.exportSite(req.site), null, 2));
  });
  const siteFileUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } });
  app.post('/sites/import-file', requireAuth, (req, res, next) => siteFileUpload.single('sitefile')(req, res, (err) => {
    if (err) return renderDashboard(req, res, { importError: 'That file is too large or could not be read.' });
    next();
  }), (req, res) => {
    if (!req.file) return renderDashboard(req, res, { importError: 'Choose a site file (.json) first.' });
    const r = backups.parseSiteFile(req.file.buffer.toString('utf8'));
    if (r.error) return renderDashboard(req, res, { importError: r.error });
    const name = str(r.name, 80) || 'Imported site';
    const theme = { ...defaultTheme(), ...r.theme };
    theme.motionStyle = app.locals.motionLib.resolve(r.theme, r.sections && r.sections.hero);   // an older backup keeps the motion it had
    const sections = mergeSectionsWithDefaults(r.sections);
    const layout = JSON.stringify(safeParseLayout(JSON.stringify(r.layout)));
    const info = db.prepare(
      'INSERT INTO sites (user_id, slug, name, theme, sections, layout, seo_title, seo_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(req.session.userId, uniqueSlug(name), name, JSON.stringify(theme), JSON.stringify(sections), layout, r.seo_title, r.seo_description);
    saveVersion(info.lastInsertRowid, theme, sections, JSON.parse(layout), 'Imported from file');
    res.redirect(`/sites/${info.lastInsertRowid}/edit`);
  });

  // ---- automatic backups (admin only) ----
  const BACKUP_DIR = process.env.BACKUP_DIR || path.join(ROOT, 'data', 'backups');
  const BACKUP_KEEP = Math.max(1, parseInt(process.env.BACKUP_KEEP, 10) || 14);
  function requireAdmin(req, res, next) {
    if (!isAdmin(req.session.userId)) return res.status(404).render('not-found');
    next();
  }
  app.get('/admin/backups', requireAuth, requireAdmin, (req, res) => {
    res.render('admin-backups', { files: backups.list(BACKUP_DIR), keep: BACKUP_KEEP, done: req.query.done === '1', failed: req.query.failed === '1' });
  });
  app.post('/admin/backups/run', requireAuth, requireAdmin, async (req, res) => {
    try { await backups.run(db, BACKUP_DIR, BACKUP_KEEP); res.redirect('/admin/backups?done=1'); }
    catch (err) { console.error('Backup failed:', err.message); res.redirect('/admin/backups?failed=1'); }
  });
  app.get('/admin/backups/:name', requireAuth, requireAdmin, (req, res) => {
    const p = backups.pathFor(BACKUP_DIR, req.params.name);
    if (!p || !fs.existsSync(p)) return res.status(404).render('not-found');
    res.download(p, req.params.name);
  });
  async function autoBackup() {
    try { if (!backups.hasToday(BACKUP_DIR)) await backups.run(db, BACKUP_DIR, BACKUP_KEEP); }
    catch (err) { console.error('Automatic backup failed:', err.message); }
  }
  if (!isTestEnv && process.env.BACKUP_AUTO !== 'off') {
    setTimeout(autoBackup, 2 * 60 * 1000).unref();
    setInterval(autoBackup, 6 * 60 * 60 * 1000).unref();
  }

  // extra context the pre-launch audit needs (does this link's page exist, how big are the photos)
  function checklistOpts(site) {
    return {
      uploadsDir: path.join(ROOT, 'public', 'uploads'),
      pageExists: (u) => {
        const parts = u.split('/').filter(Boolean);
        if (!parts.length) return true;
        const first = parts[0];
        if (first === 'book') return !!site.sections.booking.enabled;
        if (first === 'thank-you' || first === 'review') return true;
        if (legal.PAGES.includes(first)) return legal.enabled(site);
        if (first === 'estimate') return calc.isUsable(site.sections.calculator);
        if (parts.length === 1) return pageIsAvailable(site, first);
        return true; // service / area / post pages: not worth checking each one
      }
    };
  }

  // ---- block library: blocks saved once, reusable on any of the user's sites ----
  const LIBRARY_MAX = 200;
  function libraryRows(userId) {
    return db.prepare('SELECT id, name, block FROM block_library WHERE user_id = ? ORDER BY name COLLATE NOCASE, id').all(userId)
      .map(r => { try { return { id: r.id, name: r.name, block: JSON.parse(r.block) }; } catch { return null; } }).filter(Boolean);
  }
  // one block's fields as the editor sends them (block_type, block_heading, ...) -> a cleaned block, or null
  function cleanSingleBlock(b) {
    const one = {};
    for (const k of ['type', 'heading', 'body', 'image', 'side', 'buttonText', 'buttonUrl', 'edge', 'bg', 'bgmix', 'bgink', 'gx', 'cardbg', 'cardgx', 'place', 'page', 'pin', 'film', 'imgfx', 'height']) one['block_' + k] = [Array.isArray(b['block_' + k]) ? b['block_' + k][0] : (b['block_' + k] || '')];
    return parseBlocksFromBody(one)[0] || null;
  }
  app.post('/library/blocks', requireAuth, (req, res) => {
    const blk = cleanSingleBlock(req.body || {});
    const name = str((req.body || {}).name, 60) || (blk && blk.heading) || '';
    if (!blk || !name) return res.status(400).json({ ok: false, error: 'Fill in the block before saving it.' });
    const n = db.prepare('SELECT COUNT(*) AS n FROM block_library WHERE user_id = ?').get(req.session.userId).n;
    if (n >= LIBRARY_MAX) return res.status(400).json({ ok: false, error: 'Your library is full. Delete a few saved blocks first.' });
    const info = db.prepare('INSERT INTO block_library (user_id, name, block) VALUES (?, ?, ?)').run(req.session.userId, name, JSON.stringify(blk));
    res.json({ ok: true, id: info.lastInsertRowid, name, block: blk });
  });
  app.post('/library/blocks/:id/delete', requireAuth, (req, res) => {
    const info = db.prepare('DELETE FROM block_library WHERE id = ? AND user_id = ?').run(req.params.id, req.session.userId);
    res.json({ ok: !!info.changes });
  });

  app.get('/sites/:id/checklist', requireAuth, loadOwnedSite, (req, res) => {
    res.json({ items: buildChecklist(req.site, checklistOpts(req.site)) });
  });

  // ---- static export ----
  // Renders every available page to plain HTML (links rewritten to about.html
  // etc., uploaded photos bundled in an uploads/ folder) and zips it, so a
  // finished site can be hosted anywhere or handed to the client. The contact
  // form is omitted because it needs this server to receive messages.
  function renderToString(view, locals) {
    return new Promise((resolve, reject) => {
      app.render(view, locals, (err, html) => (err ? reject(err) : resolve(html)));
    });
  }

  // Builds the static copy of a site and writes it as a zip to `out`.
  // hosted: true is used when publishing to a static host (Netlify): the contact form is kept and handled by the
  // host's own form service, the thank-you page and a 404 page are added.
  async function writeExportZip(site, out, { hosted = false } = {}) {
      const keys = PAGE_KEYS.filter(k => pageIsAvailable(site, k));
      const trustData = site.sections.trust || {};
      const services = servicesWithSlugs(site.sections.services.items);
      const areas = areasWithSlugs(trustData.serviceAreas, trustData.areaText);
      const posts = servicesWithSlugs(site.sections.blog.items);
      const extras = extraPageList(site);
      // every extra page type gets its own file, but only once it has real text
      const itemPages = [];
      if (keys.includes('services')) for (const sv of services) if (sv.detail) itemPages.push({ page: 'service', item: sv, href: `/services/${sv.slug}`, file: `service-${sv.slug}.html` });
      for (const ar of areas) if (ar.text) itemPages.push({ page: 'area', item: ar, href: `/areas/${ar.slug}`, file: `area-${ar.slug}.html` });
      if (keys.includes('blog')) for (const po of posts) itemPages.push({ page: 'post', item: po, href: `/blog/${po.slug}`, file: `blog-${po.slug}.html` });
      for (const ex of extras) itemPages.push({ page: 'extra', item: ex, href: `/p/${ex.slug}`, file: `p-${ex.slug}.html` });
      const legalPages = legal.enabled(site) ? legal.PAGES.map(k => ({ page: k, file: `${k}.html` })) : [];
      const pages = [{ page: 'home', file: 'index.html' }, ...keys.map(k => ({ page: k, file: `${k}.html` })), ...legalPages, ...itemPages];
      const formsOn = hosted && !!site.sections.contact.acceptSubmissions;
      if (formsOn) pages.push({ page: 'thank-you', file: 'thank-you.html' });
      if (hosted) pages.push({ page: 'notfound', file: '404.html' });
      const uploads = new Set();
      const assets = new Set();
      const files = [];
      for (const entry of pages) {
        const locals = {
          site: extraThemes.withPageStyle(site, entry.page), preview: false, page: entry.page, basePath: '', origin: '', staticExport: true, netlifyForms: formsOn, services, areas, posts, extras,
          service: entry.page === 'service' ? entry.item : null, area: entry.page === 'area' ? entry.item : null,
          post: entry.page === 'post' ? entry.item : null, extra: entry.page === 'extra' ? entry.item : null,
          navPages: buildNavPages(site, '', false), contactSent: false, contactError: false, reviewThanks: false, reviewError: false
        };
        let html = wordStyle.apply(images.optimizeHtml(await renderToString('public-site', locals)));
        // page links: "/about" -> "about.html", "/" -> "index.html"
        for (const k of [...keys, ...legalPages.map(x => x.page)]) html = html.split(`href="/${k}"`).join(`href="${k}.html"`);
        // item pages that were not exported (no text yet) fall back to their list page
        const fallback = { '/services/': 'services.html', '/areas/': 'index.html', '/blog/': keys.includes('blog') ? 'blog.html' : 'index.html', '/p/': 'index.html' };
        html = html.replace(/href="(\/(?:services|areas|blog|p)\/)([a-z0-9-]+)"/g, (m, prefix, slug) => {
          const hit = itemPages.find(ip => ip.href === prefix + slug);
          return `href="${hit ? hit.file : fallback[prefix]}"`;
        });
        html = html.split('href="/"').join('href="index.html"');
        // no real canonical URL is known until it is hosted
        html = html.replace(/\s*<link rel="canonical"[^>]*>/, '').replace(/\s*<meta property="og:url"[^>]*>/, '')
          .replace(/,"url":"[^"]*"/, '');
        // the animation script and the Motion library are bundled too, so the site never loads code from elsewhere
        if (html.includes('vendor/motion.js')) assets.add('vendor/motion.js').add('sitegen-motion.js');
        if (html.includes('sg-motion-lite.js')) assets.add('sg-motion-lite.js');
        if (html.includes('sg-premium.js')) {
          assets.add('sg-premium.js');
          if (html.includes('data-lottie=')) assets.add('vendor/lottie_light.min.js').add('lottie/icons.js');
        }
        if (html.includes('sg-shader.js')) assets.add('sg-shader.js');
        if (html.includes('sg-fx.js')) assets.add('sg-fx.js');
        if (html.includes('sg-site.css')) assets.add('sg-site.css');
        if (html.includes('sg-library.css')) assets.add('sg-library.css').add('sg-lib.js');
        if (html.includes('sg-stylelib.css')) assets.add('sg-stylelib.css');
        if (html.includes('sg-atelier.css')) assets.add('sg-atelier.css');
        // uploaded photos become relative paths and get bundled
        html = html.replace(/(["'(]|, )\/uploads\/([A-Za-z0-9._-]+)/g, (m, q, name) => {
          uploads.add(name);
          return `${q}uploads/${name}`;
        });
        files.push({ name: entry.file, html });
      }

      const zip = new ZipArchive({ zlib: { level: 9 } });
      const done = new Promise((resolve, reject) => { zip.on('error', reject); out.on('finish', resolve); out.on('close', resolve); out.on('error', reject); });
      zip.pipe(out);
      for (const f of files) zip.append(f.html, { name: f.name });
      for (const rel of assets) zip.file(path.join(ROOT, 'public', rel), { name: rel });
      for (const name of uploads) {
        const p = path.join(ROOT, 'public', 'uploads', name);
        if (fs.existsSync(p)) zip.file(p, { name: `uploads/${name}` });
      }
      if (!hosted) zip.append(
        `${site.name}\n\nThis folder is a complete, static copy of the website.\n` +
        `To publish it, upload everything in this folder to any web host (keep the uploads folder next to the .html files) and open index.html.\n\n` +
        `Note: the contact form is not included in this copy because it needs a server to receive messages. ` +
        `The phone number, email address and map are still shown.\n`,
        { name: 'README.txt' }
      );
      await zip.finalize();
      await done;
  }

  app.get('/sites/:id/export', requireAuth, loadOwnedSite, async (req, res) => {
    const site = req.site;
    try {
      res.attachment(`${site.slug}-website.zip`);
      await writeExportZip(site, res);
    } catch (err) {
      console.error('Export failed:', err.message);
      if (!res.headersSent) res.status(500).send('Could not export this site.'); else res.end();
    }
  });

  // ---- publish to Netlify (one click), custom domain and HTTPS ----
  const publishLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false, skip: () => isTestEnv,
    message: 'Too many publishes in a short time. Please wait a few minutes.'
  });
  async function exportToBuffer(site, opts) {
    const { PassThrough } = require('node:stream');
    const sink = new PassThrough(); const chunks = [];
    sink.on('data', c => chunks.push(c));
    await writeExportZip(site, sink, opts);
    return Buffer.concat(chunks);
  }
  const hostingMsg = { published: 'Published. Your site is live.', pending: 'Sent to Netlify. It is still processing; refresh in a minute.', domain: 'Domain saved. Now add the DNS records below at your domain provider.', ssl: 'HTTPS requested. If the DNS records are in place, Netlify issues the certificate within a few minutes.', sslwait: 'Netlify cannot issue HTTPS yet. The DNS records usually need a little time (sometimes a few hours) to spread. Try again later.', unlinked: 'Disconnected. The Netlify site itself is untouched.', nodomain: 'That does not look like a domain name. Use something like www.yourbusiness.com.', nosite: 'Publish the site first.' };

  app.get('/sites/:id/hosting', requireAuth, loadOwnedSite, async (req, res) => {
    const site = req.site; let live = null;
    if (site.netlify_site_id && netlify.isConfigured() && req.query.refresh !== '0') { try { live = await netlify.getSite(site.netlify_site_id); } catch { /* shown from saved values */ } }
    const sub = site.netlify_name || '';
    res.render('hosting', {
      site, configured: netlify.isConfigured(), live,
      dns: site.netlify_domain && sub ? netlify.dnsInstructions(site.netlify_domain, sub) : [],
      flash: req.query.f || '', err: req.query.err ? String(req.query.err).slice(0, 300) : '',
      msgs: hostingMsg, formsOn: !!site.sections.contact.acceptSubmissions, notify: hostingNotifyEmail(site),
      hasBooking: !!site.sections.booking.enabled, hasChat: !!(site.sections.chat && site.sections.chat.enabled), hasCalc: !!(site.sections.calculator && site.sections.calculator.enabled)
    });
  });

  app.post('/sites/:id/hosting/publish', requireAuth, loadOwnedSite, publishLimiter, async (req, res) => {
    const site = req.site; const back = (q) => res.redirect(`/sites/${site.id}/hosting?${q}`);
    if (netlify.isConfigured() && await qualityGate(req, res, 'hosting')) return;
    if (!netlify.isConfigured()) return back('err=' + encodeURIComponent('Netlify is not connected yet. Add NETLIFY_AUTH_TOKEN to the .env file.'));
    try {
      const zipBuf = await exportToBuffer(site, { hosted: true });
      let siteId = site.netlify_site_id, created = false;
      if (!siteId) {
        const ns = await netlify.createSite(site.slug);
        siteId = ns.id; created = true;
        db.prepare('UPDATE sites SET netlify_site_id = ?, netlify_name = ?, netlify_url = ? WHERE id = ?').run(ns.id, ns.name, ns.url, site.id);
      }
      const dep = await netlify.deployZip(siteId, zipBuf);
      const waited = dep.id ? await netlify.waitForDeploy(dep.id) : { ok: true };
      if (!waited.ok && !waited.pending) return back('err=' + encodeURIComponent(waited.error || 'Netlify could not process the files.'));
      db.prepare("UPDATE sites SET netlify_deployed_at = datetime('now') WHERE id = ?").run(site.id);
      recordPublish(site, 'netlify', dep.id);
      if (created && site.sections.contact.acceptSubmissions) { // contact form messages are emailed to the owner by Netlify
        const to = hostingNotifyEmail(site);
        if (to) { try { await netlify.createFormEmailHook(siteId, 'contact', to); } catch (e) { console.error('Netlify form email hook failed:', e.message); } }
      }
      back('f=' + (waited.pending ? 'pending' : 'published'));
    } catch (err) {
      console.error('Netlify publish failed:', err.message);
      back('err=' + encodeURIComponent(err.message));
    }
  });

  app.post('/sites/:id/hosting/domain', requireAuth, loadOwnedSite, async (req, res) => {
    const site = req.site; const back = (q) => res.redirect(`/sites/${site.id}/hosting?${q}`);
    if (!site.netlify_site_id) return back('f=nosite');
    const domain = netlify.cleanDomain(req.body.domain);
    if (!domain) return back('f=nodomain');
    try {
      await netlify.setCustomDomain(site.netlify_site_id, domain);
      db.prepare('UPDATE sites SET netlify_domain = ?, netlify_ssl = 0 WHERE id = ?').run(domain, site.id);
      back('f=domain');
    } catch (err) { back('err=' + encodeURIComponent(err.message)); }
  });

  app.post('/sites/:id/hosting/ssl', requireAuth, loadOwnedSite, async (req, res) => {
    const site = req.site; const back = (q) => res.redirect(`/sites/${site.id}/hosting?${q}`);
    if (!site.netlify_site_id || !site.netlify_domain) return back('f=nosite');
    try {
      await netlify.provisionSsl(site.netlify_site_id);
      db.prepare('UPDATE sites SET netlify_ssl = 1 WHERE id = ?').run(site.id);
      back('f=ssl');
    } catch (err) {
      if (err instanceof netlify.NetlifyError && err.status >= 400 && err.status < 500 && err.status !== 401 && err.status !== 429) return back('f=sslwait');
      back('err=' + encodeURIComponent(err.message));
    }
  });

  app.post('/sites/:id/hosting/remove-domain', requireAuth, loadOwnedSite, async (req, res) => {
    const site = req.site; const back = (q) => res.redirect(`/sites/${site.id}/hosting?${q}`);
    if (!site.netlify_site_id) return back('f=nosite');
    try {
      await netlify.clearCustomDomain(site.netlify_site_id);
      db.prepare("UPDATE sites SET netlify_domain = '', netlify_ssl = 0 WHERE id = ?").run(site.id);
      back('f=unlinked');
    } catch (err) { back('err=' + encodeURIComponent(err.message)); }
  });

  app.post('/sites/:id/hosting/unlink', requireAuth, loadOwnedSite, (req, res) => {
    db.prepare("UPDATE sites SET netlify_site_id = '', netlify_name = '', netlify_url = '', netlify_domain = '', netlify_deployed_at = '', netlify_ssl = 0 WHERE id = ?").run(req.site.id);
    res.redirect(`/sites/${req.site.id}/hosting?f=unlinked`);
  });

  // ---- payments hub: payment requests (quotes, invoices), history, manual "paid" ----
  const PAY_FLASH = { created: 'Payment request created. Send the link to your customer.', sent: 'Emailed the payment link.', paid: 'Marked as paid.', canceled: 'Payment request canceled.', nokey: 'Add your Stripe key and switch on card payments first (Card payments block in the editor).', bad: 'Please enter an amount (for example 250 or 250.00) and what it is for.', nomail: 'Email sending is not set up, or this customer has no email. Copy the link and send it yourself.' };
  app.get('/sites/:id/payments', requireAuth, loadOwnedSite, async (req, res) => {
    const site = req.site;
    const pending = db.prepare("SELECT * FROM payments WHERE site_id = ? AND status = 'pending' AND stripe_session_id != '' ORDER BY id DESC LIMIT 20").all(site.id);
    for (const p of pending) await refreshPayment(site, p);
    const rows = db.prepare('SELECT * FROM payments WHERE site_id = ? ORDER BY id DESC LIMIT 200').all(site.id).map(p => ({ ...p, amount: payments.money(p.amount_cents, p.currency), link: `${payBase(req, site)}/pay/${p.token}` }));
    const cur = site.sections.payments.currency;
    const sum = (st) => payments.money(rows.filter(p => p.status === st && p.currency === cur).reduce((n, p) => n + p.amount_cents, 0), cur);
    let lead = null;
    if (req.query.lead) { const l = db.prepare('SELECT id, name, email, service FROM contact_submissions WHERE id = ? AND site_id = ?').get(req.query.lead, site.id); if (l) lead = l; }
    res.render('payments', { site, rows, ready: payReady(site, site), cfg: site.sections.payments, flash: req.query.f || '', msgs: PAY_FLASH, collected: sum('paid'), outstanding: sum('pending'), lead, mailOn: mailer.isConfigured() });
  });
  app.post('/sites/:id/payments/new', requireAuth, loadOwnedSite, async (req, res) => {
    const site = req.site; const back = (f) => res.redirect(`/sites/${site.id}/payments?f=${f}`);
    if (!payReady(site, site)) return back('nokey');
    const cents = payments.toCents(req.body.amount); const desc = str(req.body.description, 200);
    if (!cents || !desc) return back('bad');
    const email = isValidEmail(req.body.email || '') ? str(req.body.email, 254) : '';
    const lead = req.body.lead_id ? db.prepare('SELECT id FROM contact_submissions WHERE id = ? AND site_id = ?').get(req.body.lead_id, site.id) : null;
    const p = newPayment(site, { kind: 'invoice', refId: lead ? lead.id : null, description: desc, amountCents: cents, name: str(req.body.name, 100), email, currency: site.sections.payments.currency });
    if (req.body.send === '1' && email && mailer.isConfigured()) {
      mailer.sendReport({ to: email, replyTo: ownerEmailFor(site) || undefined, subject: `${site.name}: payment request for ${payments.money(cents, p.currency)}`,
        text: `Hello${p.customer_name ? ' ' + p.customer_name : ''},\n\n${site.name} has sent you a payment request:\n\n${desc}\nAmount: ${payments.money(cents, p.currency)}\n\nPay securely online here:\n${payBase(req, site)}/pay/${p.token}\n\nThank you!` }).catch(e => console.error('Payment request email failed:', e.message));
      return back('sent');
    }
    back('created');
  });
  app.post('/sites/:id/payments/:pid/:action', requireAuth, loadOwnedSite, async (req, res) => {
    const site = req.site; const back = (f) => res.redirect(`/sites/${site.id}/payments?f=${f}`);
    const p = db.prepare('SELECT * FROM payments WHERE id = ? AND site_id = ?').get(req.params.pid, site.id);
    if (!p) return back('bad');
    if (req.params.action === 'cancel' && p.status === 'pending' && p.kind !== 'deposit') {
      db.prepare("UPDATE payments SET status = 'canceled' WHERE id = ?").run(p.id); return back('canceled');
    }
    if (req.params.action === 'paid' && p.status === 'pending' && p.kind !== 'deposit') { markPaid(site, p, null, 'manual', req); return back('paid'); }
    if (req.params.action === 'resend' && p.status === 'pending' && p.customer_email && mailer.isConfigured()) {
      mailer.sendReport({ to: p.customer_email, replyTo: ownerEmailFor(site) || undefined, subject: `${site.name}: payment request for ${payments.money(p.amount_cents, p.currency)}`,
        text: `Hello,\n\nReminder of your payment request from ${site.name}:\n\n${p.description}\nAmount: ${payments.money(p.amount_cents, p.currency)}\n\nPay securely online here:\n${payBase(req, site)}/pay/${p.token}\n\nThank you!` }).catch(e => console.error('Payment reminder failed:', e.message));
      return back('sent');
    }
    back(req.params.action === 'resend' ? 'nomail' : 'bad');
  });

  // pull the Google rating and reviews now (also happens by itself once a day)
  app.post('/sites/:id/google-reviews/refresh', requireAuth, loadOwnedSite, async (req, res) => {
    const placeId = googleReviews.cleanPlaceId((req.site.sections.testimonials || {}).googlePlaceId);
    if (!placeId) return res.redirect(`/sites/${req.site.id}/edit?google=noid`);
    const r = await googleReviews.refresh(db, req.site.id, placeId);
    cache.clear();
    res.redirect(`/sites/${req.site.id}/edit?google=${r.data ? 'ok' : 'fail'}`);
  });

  return { checklistOpts, libraryRows };
};
