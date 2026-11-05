// Client edit links, client logins and the client portal
// server.js calls this where these routes belong in its route order and hands it the shared helpers they use.
module.exports = function (app, deps) {
  const {
    authLimiter, bcrypt, crypto, db, editApplyHandler, editProposeHandler, generateLimiter, getSite,
    invalidateSiteCache, isSafeUrl, isTestEnv, isValidEmail, loadOwnedSite, mailer, nanoid, optimizeUpload,
    rateLimit, reportContext, requireAuth, saveVersion, str, upload
  } = deps;

  // ---- client edit links ----
  // The owner can create one private link per site. Whoever has it can change
  // the day-to-day basics (headline, about text, services, hours, contact
  // details, gallery photos) without an account — but not the design, layout,
  // publishing, domain or credentials. Only a hash of the token is stored.
  const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

  const clientLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false,
    skip: () => isTestEnv, message: 'Too many requests. Please try again in a few minutes.'
  });

  function loadClientSite(req, res, next) {
    // the token is a secret: never let it leak through Referer headers or search engines
    res.set('Referrer-Policy', 'no-referrer');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    const token = String(req.params.token || '');
    const link = /^[A-Za-z0-9_-]{20,64}$/.test(token)
      ? db.prepare('SELECT * FROM client_links WHERE token_hash = ?').get(hashToken(token))
      : null;
    const site = link ? getSite(link.site_id) : null;
    if (!site) return res.status(404).render('not-found');
    req.site = site;
    req.clientLink = link;
    next();
  }

  // Applies only the fields a client may change onto a copy of the stored
  // sections. A field group is only touched if the form actually included it.
  function applyClientEdits(sections, b) {
    const cap = (v, n) => str(v, n);
    if (b.hero_headline !== undefined) sections.hero.headline = cap(b.hero_headline, 100);
    if (b.hero_subheadline !== undefined) sections.hero.subheadline = cap(b.hero_subheadline, 160);
    if (b.about_body !== undefined) sections.about.body = cap(b.about_body, 2000);
    if (b.services_present) {
      // clients don't see the longer service-page text; keep it for services that still exist
      const prevByTitle = new Map((sections.services.items || []).map(it => [it.title, it]));
      sections.services.items = ([]).concat(b.service_title || []).map((title, i) => ({
        ...(prevByTitle.get(cap(title, 60)) || {}),
        title: cap(title, 60),
        description: cap(([]).concat(b.service_description || [])[i], 300),
        detail: (prevByTitle.get(cap(title, 60)) || {}).detail || ''
      })).filter(item => item.title || item.description).slice(0, 12);
    }
    if (b.hours_present) {
      sections.hours.items = ([]).concat(b.hours_day || []).map((day, i) => ({
        day: cap(day, 20),
        time: cap(([]).concat(b.hours_time || [])[i], 60)
      })).filter(item => item.day).slice(0, 7);
    }
    if (b.contact_phone !== undefined) sections.contact.phone = cap(b.contact_phone, 40);
    if (b.contact_email !== undefined) sections.contact.email = isValidEmail(b.contact_email || '') ? str(b.contact_email, 254) : '';
    if (b.contact_address !== undefined) sections.contact.address = cap(b.contact_address, 200);
    if (b.gallery_present) {
      // keep each photo's description when the client re-orders or removes photos
      const oldAlt = {};
      (sections.gallery.images || []).forEach((u, i) => { oldAlt[u] = ((sections.gallery.alts || [])[i]) || ''; });
      sections.gallery.images = ([]).concat(b.gallery_image || []).map(s => str(s, 500)).filter(s => s && isSafeUrl(s)).slice(0, 20);
      sections.gallery.alts = sections.gallery.images.map(u => oldAlt[u] || '');
    }
  }

  app.post('/sites/:id/client-link', requireAuth, loadOwnedSite, (req, res) => {
    const token = nanoid(32);
    db.prepare('DELETE FROM client_links WHERE site_id = ?').run(req.site.id);
    db.prepare('INSERT INTO client_links (site_id, token_hash) VALUES (?, ?)').run(req.site.id, hashToken(token));
    // shown once on the next editor page load; it can't be recovered afterwards
    req.session.newClientLink = `${req.protocol}://${req.get('host')}/client/${token}`;
    res.redirect(`/sites/${req.site.id}/edit?clientlink=1`);
  });

  app.post('/sites/:id/client-link/revoke', requireAuth, loadOwnedSite, (req, res) => {
    db.prepare('DELETE FROM client_links WHERE site_id = ?').run(req.site.id);
    res.redirect(`/sites/${req.site.id}/edit?clientlink=revoked`);
  });

  app.get('/client/:token', clientLimiter, loadClientSite, (req, res) => {
    res.render('client-edit', { site: req.site, base: `/client/${req.params.token}`, saved: req.query.saved === '1' });
  });

  function saveClientEdits(site, body) {
    saveVersion(site.id, site.theme, site.sections, site.layout, 'Before client edit');
    const sections = JSON.parse(JSON.stringify(site.sections));
    applyClientEdits(sections, body || {});
    db.prepare(`UPDATE sites SET sections = ?, updated_at = datetime('now') WHERE id = ?`).run(JSON.stringify(sections), site.id);
    invalidateSiteCache(site);
  }


  app.post('/client/:token/ai-edit', clientLimiter, loadClientSite, generateLimiter, editProposeHandler('client'));
  app.post('/client/:token/ai-edit/apply', clientLimiter, loadClientSite, editApplyHandler('client'));

  app.post('/client/:token', clientLimiter, loadClientSite, (req, res) => {
    saveClientEdits(req.site, req.body);
    db.prepare(`UPDATE client_links SET last_used_at = datetime('now') WHERE id = ?`).run(req.clientLink.id);
    res.redirect(`/client/${req.params.token}?saved=1`);
  });

  app.post('/client/:token/upload', clientLimiter, loadClientSite, (req, res) => {
    upload.single('image')(req, res, async (err) => {
      if (err) return res.status(400).json({ ok: false, error: err.message });
      if (!req.file) return res.status(400).json({ ok: false, error: 'No file received.' });
      await optimizeUpload(req.file);
      res.json({ ok: true, url: `/uploads/${req.file.filename}` });
    });
  });


  // ---- client logins ----
  // Named logins (email + password) for a site's client, as an alternative to the private link. A client
  // can change the same day-to-day basics as with the link, nothing about design, publishing or domain.
  // The owner invites them; the invite link (valid 7 days, shown once) lets them choose their own password.
  // The session key is separate from the owner's (`clientIds`), so signing in here never grants owner access.
  const INVITE_DAYS = 7;
  function issueInvite(userId) {
    const token = nanoid(32);
    const expires = new Date(Date.now() + INVITE_DAYS * 86400000).toISOString();
    db.prepare('UPDATE client_users SET invite_hash = ?, invite_expires = ? WHERE id = ?').run(hashToken(token), expires, userId);
    return token;
  }
  async function emailInvite(req, site, user, link) {
    if (!mailer.isConfigured()) return false;
    try {
      await mailer.sendReport({
        to: user.email, subject: `Edit your ${site.name} website`,
        text: `Hi${user.name ? ' ' + user.name : ''},\n\nYou can now update your website, ${site.name}, yourself: your text, hours, contact details and photos.\n\nChoose your password here (the link works for ${INVITE_DAYS} days):\n${link}\n\nAfter that, log in any time at ${req.protocol}://${req.get('host')}/client-login\n`,
        replyTo: ''
      });
      return true;
    } catch (e) { console.error('Invite email failed:', e.message); return false; }
  }
  app.post('/sites/:id/client-users', requireAuth, loadOwnedSite, async (req, res) => {
    const email = str((req.body || {}).email, 254).toLowerCase();
    const name = str((req.body || {}).name, 80);
    if (!isValidEmail(email)) return res.redirect(`/sites/${req.site.id}/edit?clientuser=bademail`);
    const count = db.prepare('SELECT COUNT(*) AS n FROM client_users WHERE site_id = ?').get(req.site.id).n;
    let user = db.prepare('SELECT * FROM client_users WHERE site_id = ? AND email = ?').get(req.site.id, email);
    if (!user && count >= 10) return res.redirect(`/sites/${req.site.id}/edit?clientuser=toomany`);
    if (!user) {
      const info = db.prepare('INSERT INTO client_users (site_id, email, name) VALUES (?, ?, ?)').run(req.site.id, email, name);
      user = db.prepare('SELECT * FROM client_users WHERE id = ?').get(info.lastInsertRowid);
    }
    await finishInvite(req, res, user);
  });
  app.post('/sites/:id/client-users/:uid/invite', requireAuth, loadOwnedSite, async (req, res) => {
    const user = db.prepare('SELECT * FROM client_users WHERE id = ? AND site_id = ?').get(req.params.uid, req.site.id);
    if (!user) return res.redirect(`/sites/${req.site.id}/edit`);
    await finishInvite(req, res, user);
  });
  async function finishInvite(req, res, user) {
    // a new invite also signs out whoever held the old password
    db.prepare("UPDATE client_users SET password_hash = '' WHERE id = ?").run(user.id);
    const link = `${req.protocol}://${req.get('host')}/client-invite/${issueInvite(user.id)}`;
    const emailed = await emailInvite(req, req.site, user, link);
    req.session.newInvite = { link, email: user.email, emailed };
    res.redirect(`/sites/${req.site.id}/edit?clientuser=invited`);
  }
  app.post('/sites/:id/client-users/:uid/delete', requireAuth, loadOwnedSite, (req, res) => {
    db.prepare('DELETE FROM client_users WHERE id = ? AND site_id = ?').run(req.params.uid, req.site.id);
    res.redirect(`/sites/${req.site.id}/edit?clientuser=removed`);
  });

  function inviteUser(token) {
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(String(token || ''))) return null;
    const u = db.prepare('SELECT * FROM client_users WHERE invite_hash = ?').get(hashToken(token));
    return u && u.invite_expires && new Date(u.invite_expires) > new Date() ? u : null;
  }
  app.get('/client-invite/:token', clientLimiter, (req, res) => {
    res.set({ 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' });
    const u = inviteUser(req.params.token);
    if (!u) return res.status(404).render('client-login', { mode: 'expired', error: '', email: '' });
    res.render('client-login', { mode: 'invite', error: '', email: u.email, siteName: getSite(u.site_id).name });
  });
  app.post('/client-invite/:token', clientLimiter, (req, res) => {
    res.set({ 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' });
    const u = inviteUser(req.params.token);
    if (!u) return res.status(404).render('client-login', { mode: 'expired', error: '', email: '' });
    const pw = String((req.body || {}).password || '');
    const site = getSite(u.site_id);
    if (pw.length < 8) return res.render('client-login', { mode: 'invite', error: 'Choose a password with at least 8 characters.', email: u.email, siteName: site.name });
    if (pw !== String((req.body || {}).password2 || '')) return res.render('client-login', { mode: 'invite', error: 'The two passwords do not match.', email: u.email, siteName: site.name });
    db.prepare("UPDATE client_users SET password_hash = ?, invite_hash = NULL, invite_expires = NULL, last_login_at = datetime('now') WHERE id = ?").run(bcrypt.hashSync(pw, 10), u.id);
    req.session.clientIds = [u.id];
    res.redirect(`/portal/${u.site_id}`);
  });
  app.get('/client-login', (req, res) => {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    res.render('client-login', { mode: 'login', error: '', email: '' });
  });
  app.post('/client-login', authLimiter, (req, res) => {
    const email = str((req.body || {}).email, 254).toLowerCase();
    const pw = String((req.body || {}).password || '');
    const rows = db.prepare("SELECT * FROM client_users WHERE email = ? AND password_hash != ''").all(email);
    const ok = rows.filter(r => bcrypt.compareSync(pw, r.password_hash));
    if (!ok.length) return res.status(401).render('client-login', { mode: 'login', error: 'That email and password do not match.', email });
    for (const r of ok) db.prepare("UPDATE client_users SET last_login_at = datetime('now') WHERE id = ?").run(r.id);
    req.session.clientIds = ok.map(r => r.id);
    res.redirect(ok.length === 1 ? `/portal/${ok[0].site_id}` : '/portal');
  });
  app.post('/client-logout', (req, res) => {
    delete req.session.clientIds;
    res.redirect('/client-login');
  });
  function clientSession(req) {
    const ids = Array.isArray(req.session && req.session.clientIds) ? req.session.clientIds : [];
    return ids.length ? db.prepare(`SELECT * FROM client_users WHERE id IN (${ids.map(() => '?').join(',')}) AND password_hash != ''`).all(...ids) : [];
  }
  app.get('/portal', clientLimiter, (req, res) => {
    const users = clientSession(req);
    if (!users.length) return res.redirect('/client-login');
    if (users.length === 1) return res.redirect(`/portal/${users[0].site_id}`);
    res.render('client-login', { mode: 'pick', error: '', email: users[0].email, sites: users.map(u => getSite(u.site_id)).filter(Boolean) });
  });
  function loadPortalSite(req, res, next) {
    res.set({ 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' });
    const sid = parseInt(req.params.siteId, 10);
    const user = clientSession(req).find(u => u.site_id === sid);
    if (!user) return res.redirect('/client-login');
    const site = getSite(sid);
    if (!site) return res.status(404).render('not-found');
    req.site = site; req.portalUser = user;
    next();
  }
  app.get('/portal/:siteId', clientLimiter, loadPortalSite, (req, res) => {
    res.render('client-edit', { site: req.site, base: `/portal/${req.site.id}`, saved: req.query.saved === '1', portalUser: req.portalUser });
  });
  app.post('/portal/:siteId/ai-edit', clientLimiter, loadPortalSite, generateLimiter, editProposeHandler('client'));
  app.post('/portal/:siteId/ai-edit/apply', clientLimiter, loadPortalSite, editApplyHandler('client'));
  app.post('/portal/:siteId', clientLimiter, loadPortalSite, (req, res) => {
    saveClientEdits(req.site, req.body);
    res.redirect(`/portal/${req.site.id}?saved=1`);
  });
  app.post('/portal/:siteId/upload', clientLimiter, loadPortalSite, (req, res) => {
    upload.single('image')(req, res, async (err) => {
      if (err) return res.status(400).json({ ok: false, error: err.message });
      if (!req.file) return res.status(400).json({ ok: false, error: 'No file received.' });
      await optimizeUpload(req.file);
      res.json({ ok: true, url: `/uploads/${req.file.filename}` });
    });
  });
  app.get('/portal/:siteId/report', clientLimiter, loadPortalSite, (req, res) => {
    res.render('report', {
      site: req.site, ...reportContext(req.site, req.query.days),
      base: `/portal/${req.site.id}/report`, backHref: `/portal/${req.site.id}`, owner: false,
      mailConfigured: false, reportEmail: '', flash: ''
    });
  });

  return { clientLimiter, loadClientSite };
};
