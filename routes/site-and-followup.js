// The published site, leads, bookings, reviews, reports, follow-ups, robots.txt and sitemap
// server.js calls this where these routes belong in its route order and hands it the shared helpers they use.
module.exports = function (app, deps) {
  const {
    BOOKING_LIVE, ITEM_ROUTES, PAGE_KEYS, PORT, areasWithSlugs, billing, booking, calc, clientLimiter,
    contactLimiter, db, emailBooking, extraPageList, forms, handleContactSubmission, handleReviewSubmission,
    hydrateSite, invalidateSiteCache, isTestEnv, isValidEmail, leadsLib, legal, loadClientSite, loadOwnedSite,
    mailer, pageIsAvailable, payments, redirects, renderSitePage, reportContext, reports, requireAuth, reviewLimiter,
    reviewRequestLimiter, runPaymentSweep, saveVersion, servicesWithSlugs, str
  } = deps;

  // ---- public site ----
  // Every section (other than the hero, which is the home page) is its own
  // page: /site/:slug for home, /site/:slug/:page for everything else.
  // old addresses the owner mapped to new ones (see redirects.js)
  function redirectFor(row, pathname) {
    let rules;
    try { rules = redirects.clean((JSON.parse(row.sections).seo || {}).redirects); } catch { return null; }
    return rules.length ? redirects.find(rules, pathname) : null;
  }
  function sendRedirect(req, res, hit, basePath) {
    const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    const target = hit.to.startsWith('/') ? basePath + hit.to : hit.to;
    res.redirect(hit.code, target + (target.includes('?') ? '' : q));
  }
  app.use('/site/:slug', (req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path === '/') return next();
    const row = db.prepare('SELECT * FROM sites WHERE slug = ?').get(req.params.slug);
    if (!row || !row.published) return next();
    const hit = redirectFor(row, req.path);
    if (!hit) return next();
    sendRedirect(req, res, hit, `/site/${row.slug}`);
  });

  app.get('/site/:slug', (req, res) => {
    const row = db.prepare('SELECT * FROM sites WHERE slug = ?').get(req.params.slug);
    if (!row || !row.published) return res.status(404).render('not-found');
    if (billing.isSuspended(row)) return res.status(503).render('suspended', { name: row.name });
    const site = hydrateSite(row);
    const hasFlash = req.query.contact_sent === '1' || req.query.contact_error === '1';
    renderSitePage(req, res, null, {
      site, page: 'home', basePath: `/site/${site.slug}`,
      preview: false,
      contactSent: req.query.contact_sent === '1',
      contactError: req.query.contact_error === '1',
      cacheKey: hasFlash ? null : `${site.slug}:home`
    });
  });

  app.get('/site/:slug/:page', (req, res) => {
    const row = db.prepare('SELECT * FROM sites WHERE slug = ?').get(req.params.slug);
    if (!row || !row.published) return res.status(404).render('not-found');
    if (billing.isSuspended(row)) return res.status(503).render('suspended', { name: row.name });
    const site = hydrateSite(row);
    const page = req.params.page;
    const hasFlash = req.query.contact_sent === '1' || req.query.contact_error === '1';
    renderSitePage(req, res, null, {
      site, page, basePath: `/site/${site.slug}`,
      preview: false,
      contactSent: req.query.contact_sent === '1',
      contactError: req.query.contact_error === '1',
      reviewThanks: page === 'review' && req.query.thanks === '1',
      reviewError: page === 'review' && req.query.error === '1',
      cacheKey: (hasFlash || page === 'review') ? null : `${site.slug}:${page}`
    });
  });

  app.get('/site/:slug/:prefix/:item', (req, res) => {
    if (!Object.prototype.hasOwnProperty.call(ITEM_ROUTES, req.params.prefix)) return res.status(404).render('not-found');
    const row = db.prepare('SELECT * FROM sites WHERE slug = ?').get(req.params.slug);
    if (!row || !row.published) return res.status(404).render('not-found');
    if (billing.isSuspended(row)) return res.status(503).render('suspended', { name: row.name });
    const site = hydrateSite(row);
    renderSitePage(req, res, null, {
      site, page: ITEM_ROUTES[req.params.prefix], itemSlug: req.params.item, basePath: `/site/${site.slug}`,
      preview: false, contactSent: false, contactError: false,
      cacheKey: `${site.slug}:${req.params.prefix}/${req.params.item}`
    });
  });

  app.post('/site/:slug/contact', contactLimiter, (req, res) => {
    const row = db.prepare('SELECT * FROM sites WHERE slug = ?').get(req.params.slug);
    if (!row || !row.published) return res.status(404).render('not-found');
    if (billing.isSuspended(row)) return res.status(503).render('suspended', { name: row.name });
    handleContactSubmission(req, res, row, `/site/${row.slug}`);
  });

  const LEAD_STATUSES = leadsLib.STATUSES;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  function siteToday(siteRow) {
    let tz = 'America/New_York';
    try { tz = (JSON.parse(siteRow.sections).booking || {}).timezone || tz; } catch { /* default */ }
    return booking.nowIn(tz).date;
  }

  app.get('/sites/:id/leads', requireAuth, loadOwnedSite, (req, res) => {
    const all = db.prepare(
      'SELECT * FROM contact_submissions WHERE site_id = ? ORDER BY id DESC LIMIT 500'
    ).all(req.site.id);
    const todayStr = siteToday(db.prepare('SELECT sections FROM sites WHERE id = ?').get(req.site.id));
    const isDue = (l) => leadsLib.OPEN.includes(l.status) && l.follow_up_at && l.follow_up_at <= todayStr;
    const counts = { all: all.length, due: all.filter(isDue).length };
    for (const st of LEAD_STATUSES) counts[st] = all.filter(l => l.status === st).length;
    const filter = (LEAD_STATUSES.includes(req.query.status) || req.query.status === 'due') ? req.query.status : 'all';
    const leads = filter === 'all' ? all : filter === 'due' ? all.filter(isDue) : all.filter(l => l.status === filter);
    const pending = db.prepare("SELECT lead_id, COUNT(*) AS n FROM followup_queue WHERE site_id = ? AND sent_at IS NULL AND canceled = 0 GROUP BY lead_id").all(req.site.id);
    const pendingBy = new Map(pending.map(p => [p.lead_id, p.n]));
    res.render('leads', { site: req.site, leads: leads.map(l => ({ ...l, due: isDue(l), pendingFollowUps: pendingBy.get(l.id) || 0, answerList: forms.parseAnswers(l.answers) })), counts, filter, statuses: LEAD_STATUSES, today: todayStr });
  });

  app.post('/sites/:id/leads/:leadId', requireAuth, loadOwnedSite, (req, res) => {
    const status = LEAD_STATUSES.includes(req.body.status) ? req.body.status : null;
    if (!status) return res.status(400).send('Bad status');
    const followUp = DATE_RE.test(String(req.body.follow_up_at || '')) ? req.body.follow_up_at : '';
    const info = db.prepare('UPDATE contact_submissions SET status = ?, notes = ?, follow_up_at = ?, reminded_on = ? WHERE id = ? AND site_id = ?')
      .run(status, str(req.body.notes, 1000), followUp, '', req.params.leadId, req.site.id);
    if (!info.changes) return res.status(404).send('Lead not found');
    if (status !== 'new') leadsLib.cancelPending(db, req.params.leadId); // the owner has taken over: stop automatic emails
    const back = LEAD_STATUSES.includes(req.body.filter) || req.body.filter === 'due' ? '?status=' + req.body.filter : '';
    res.redirect(`/sites/${req.site.id}/leads${back}#lead-${req.params.leadId}`);
  });

  // the "stop emailing me" link in follow-up emails (works on any host)
  app.get('/unsubscribe/:token', (req, res) => res.render('unsubscribe', { token: req.params.token, done: false }));
  app.post('/unsubscribe/:token', (req, res) => {
    leadsLib.optOut(db, req.params.token);
    res.render('unsubscribe', { token: req.params.token, done: true });
  });

  // spreadsheet apps run text that starts with = + - @ as a formula; defuse it
  function csvCell(v) {
    let s = String(v == null ? '' : v).replace(/\r?\n/g, ' ');
    if (/^[=+\-@\t]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  }

  app.get('/sites/:id/leads.csv', requireAuth, loadOwnedSite, (req, res) => {
    const rows = db.prepare('SELECT * FROM contact_submissions WHERE site_id = ? ORDER BY id DESC').all(req.site.id);
    const lines = [['Date', 'Name', 'Email', 'Phone', 'Service', 'Message', 'Answers', 'Status', 'Follow up', 'Source', 'Notes'].map(csvCell).join(',')];
    for (const r of rows) {
      lines.push([r.created_at, r.name, r.email, r.phone, r.service, r.message, forms.answersText(forms.parseAnswers(r.answers), ' | '), r.status, r.follow_up_at, r.source, r.notes].map(csvCell).join(','));
    }
    res.attachment(`${req.site.slug}-leads.csv`).type('text/csv').send('\ufeff' + lines.join('\r\n'));
  });

  app.post('/site/:slug/review', reviewLimiter, (req, res) => {
    const row = db.prepare('SELECT * FROM sites WHERE slug = ?').get(req.params.slug);
    if (!row || !row.published) return res.status(404).render('not-found');
    if (billing.isSuspended(row)) return res.status(503).render('suspended', { name: row.name });
    handleReviewSubmission(req, res, row, `/site/${row.slug}`);
  });

  // ---- owner side of online booking ----
  const BOOKING_ACTIONS = { confirm: 'confirmed', decline: 'declined', cancel: 'cancelled', done: 'done' };
  app.get('/sites/:id/bookings', requireAuth, loadOwnedSite, (req, res) => {
    const b = req.site.sections.booking;
    const now = booking.nowIn(b.timezone);
    const nowStr = `${now.date} ${String(Math.floor(now.minutes / 60)).padStart(2, '0')}:${String(now.minutes % 60).padStart(2, '0')}`;
    const rows = db.prepare('SELECT * FROM bookings WHERE site_id = ? ORDER BY start_at').all(req.site.id).map(r => ({
      ...r, addonList: JSON.parse(r.addons || '[]'), detailList: JSON.parse(r.details || '[]'),
      whenText: `${booking.prettyDate(r.start_at.slice(0, 10))} at ${booking.prettyTime(r.start_at.slice(11, 16))}`,
      deposit: (() => { const d = db.prepare("SELECT status, amount_cents, currency FROM payments WHERE kind = 'deposit' AND ref_id = ? AND site_id = ? ORDER BY id DESC").get(r.id, req.site.id); return d ? { status: d.status, text: payments.money(d.amount_cents, d.currency) } : null; })()
    }));
    const waiting = rows.filter(r => r.status === 'awaiting_payment');
    const pending = rows.filter(r => r.status === 'pending' && r.start_at >= nowStr);
    const upcoming = rows.filter(r => r.status === 'confirmed' && r.start_at >= nowStr);
    const past = rows.filter(r => !pending.includes(r) && !upcoming.includes(r) && !waiting.includes(r)).reverse().slice(0, 100);
    res.render('bookings', {
      site: req.site, booking: b, pending, upcoming, past, waiting, flash: str(req.query.m, 20),
      mailConfigured: mailer.isConfigured(),
      bookUrl: req.site.custom_domain ? `https://${req.site.custom_domain}/book` : `${req.protocol}://${req.get('host')}/site/${req.site.slug}/book`
    });
  });

  app.post('/sites/:id/bookings/:bid', requireAuth, loadOwnedSite, (req, res) => {
    const back = (m) => res.redirect(`/sites/${req.site.id}/bookings?m=${m}`);
    const bk = db.prepare('SELECT * FROM bookings WHERE id = ? AND site_id = ?').get(req.params.bid, req.site.id);
    const status = BOOKING_ACTIONS[req.body.action];
    if (!bk || !status) return back('bad');
    if (status === 'confirmed' && bk.status !== 'pending') return back('bad');
    if (status === 'declined' && bk.status !== 'pending') return back('bad');
    if (status === 'cancelled' && !BOOKING_LIVE.includes(bk.status)) return back('bad');
    if (status === 'done' && bk.status !== 'confirmed') return back('bad');
    db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, bk.id);
    const event = { confirmed: 'confirmed', declined: 'declined', cancelled: 'cancelled' }[status];
    if (event && req.body.notify !== '0') emailBooking(req, req.siteRow || db.prepare('SELECT * FROM sites WHERE id = ?').get(req.site.id), { ...bk, status }, event, str(req.body.message, 500));
    back(status);
  });

  // load a ready-made setup for an industry (replaces services, add-ons and questions; hours stay)
  app.post('/sites/:id/booking/preset', requireAuth, loadOwnedSite, (req, res) => {
    const kind = booking.PRESETS[req.body.kind] ? req.body.kind : 'generic';
    saveVersion(req.site.id, req.site.theme, req.site.sections, req.site.layout, 'Before loading a booking preset');
    const sections = { ...req.site.sections, booking: booking.applyPreset(req.site.sections.booking, kind, req.site.sections.services.items) };
    db.prepare("UPDATE sites SET sections = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(sections), req.site.id);
    invalidateSiteCache(req.site);
    res.redirect(`/sites/${req.site.id}/edit?booking=1`);
  });

  // where customers are sent to leave a review: the site's own domain if it has one
  function reviewLink(req, site) {
    return site.custom_domain ? `https://${site.custom_domain}/review` : `${req.protocol}://${req.get('host')}/site/${site.slug}/review`;
  }

  app.get('/sites/:id/reviews', requireAuth, loadOwnedSite, (req, res) => {
    const rows = db.prepare('SELECT * FROM review_submissions WHERE site_id = ? ORDER BY id DESC LIMIT 200').all(req.site.id);
    res.render('reviews', {
      site: req.site,
      link: reviewLink(req, req.site),
      pending: rows.filter(r => r.status === 'pending'),
      done: rows.filter(r => r.status !== 'pending').slice(0, 30),
      mailConfigured: mailer.isConfigured(),
      flash: ['approved', 'rejected', 'sent', 'sendfailed', 'full', 'bademail'].includes(req.query.m) ? req.query.m : ''
    });
  });

  app.post('/sites/:id/reviews/request', requireAuth, loadOwnedSite, reviewRequestLimiter, async (req, res) => {
    const back = (m) => res.redirect(`/sites/${req.site.id}/reviews?m=${m}`);
    const to = str(req.body.email, 254);
    if (!isValidEmail(to)) return back('bademail');
    const contact = req.site.sections.contact;
    try {
      const ok = await mailer.sendReviewRequest({
        to, name: str(req.body.name, 80), siteName: req.site.name, link: reviewLink(req, req.site),
        replyTo: (contact.notifyEmail && isValidEmail(contact.notifyEmail)) ? contact.notifyEmail : contact.email
      });
      back(ok ? 'sent' : 'sendfailed');
    } catch (err) {
      console.error('Review request failed:', err.message);
      back('sendfailed');
    }
  });

  app.post('/sites/:id/reviews/:rid', requireAuth, loadOwnedSite, (req, res) => {
    const back = (m) => res.redirect(`/sites/${req.site.id}/reviews?m=${m}`);
    const rev = db.prepare('SELECT * FROM review_submissions WHERE id = ? AND site_id = ?').get(req.params.rid, req.site.id);
    if (!rev || rev.status !== 'pending') return back('');
    if (req.body.action === 'reject') {
      db.prepare("UPDATE review_submissions SET status = 'rejected' WHERE id = ?").run(rev.id);
      return back('rejected');
    }
    if (req.body.action !== 'approve') return res.status(400).send('Bad action');
    const sections = JSON.parse(JSON.stringify(req.site.sections));
    if (sections.testimonials.items.length >= 30) return back('full');
    saveVersion(req.site.id, req.site.theme, req.site.sections, req.site.layout, 'Before adding a review');
    sections.testimonials.items.push({
      quote: rev.quote, author: rev.name, rating: rev.rating,
      date: new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
    });
    db.prepare("UPDATE sites SET sections = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(sections), req.site.id);
    db.prepare("UPDATE review_submissions SET status = 'approved' WHERE id = ?").run(rev.id);
    invalidateSiteCache(req.site);
    back('approved');
  });

  // ---- activity reports ----

  app.get('/sites/:id/report', requireAuth, loadOwnedSite, (req, res) => {
    res.render('report', {
      site: req.site, ...reportContext(req.site, req.query.days),
      base: `/sites/${req.site.id}/report`, backHref: `/sites/${req.site.id}/edit`, owner: true,
      mailConfigured: mailer.isConfigured(), reportEmail: req.site.sections.meta.reportEmail,
      flash: ['sent', 'sendfailed', 'noemail'].includes(req.query.m) ? req.query.m : ''
    });
  });

  app.post('/sites/:id/report/send', requireAuth, loadOwnedSite, async (req, res) => {
    const days = [7, 30, 90].includes(parseInt(req.body.days, 10)) ? parseInt(req.body.days, 10) : 30;
    const back = (m) => res.redirect(`/sites/${req.site.id}/report?days=${days}&m=${m}`);
    const to = req.site.sections.meta.reportEmail;
    if (!to) return back('noemail');
    const { report } = reportContext(req.site, days);
    try {
      const ok = await mailer.sendReport({
        to, subject: `Website report (last ${days} days) — ${req.site.name}`,
        text: reports.reportEmailText(req.site, report, `last ${days} days`)
      });
      back(ok ? 'sent' : 'sendfailed');
    } catch (err) {
      console.error('Report email failed:', err.message);
      back('sendfailed');
    }
  });

  app.get('/client/:token/report', clientLimiter, loadClientSite, (req, res) => {
    res.render('report', {
      site: req.site, ...reportContext(req.site, req.query.days),
      base: `/client/${req.params.token}/report`, backHref: `/client/${req.params.token}`, owner: false,
      mailConfigured: false, reportEmail: '', flash: ''
    });
  });

  // On the first run each month, email last month's report to every published
  // site whose owner entered a report address. Logged per site and month, so a
  // restart never sends one twice.
  async function sendDueReports() {
    if (!mailer.isConfigured()) return;
    const prev = reports.previousMonth();
    for (const row of db.prepare('SELECT * FROM sites WHERE published = 1').all()) {
      if (billing.isSuspended(row)) continue;
      try {
        const site = hydrateSite(row);
        const to = site.sections.meta.reportEmail;
        if (!to || !isValidEmail(to)) continue;
        if (db.prepare('SELECT 1 FROM report_log WHERE site_id = ? AND period = ?').get(row.id, prev.period)) continue;
        db.prepare('INSERT INTO report_log (site_id, period) VALUES (?, ?)').run(row.id, prev.period);
        const report = reports.buildReport(db, row.id, prev);
        try {
          await mailer.sendReport({
            to, subject: `Website report for ${prev.label} — ${row.name}`,
            text: reports.reportEmailText(site, report, prev.label)
          });
        } catch (err) {
          db.prepare('DELETE FROM report_log WHERE site_id = ? AND period = ?').run(row.id, prev.period); // retry next time
          throw err;
        }
      } catch (err) {
        console.error('Monthly report failed:', err.message);
      }
    }
  }
  if (!isTestEnv) {
    setTimeout(sendDueReports, 60 * 1000).unref();
    setInterval(sendDueReports, 6 * 60 * 60 * 1000).unref();
  }

  // ---- automatic follow-up emails and "follow up today" reminders ----
  async function runFollowUps() {
    if (!mailer.isConfigured()) return 0;
    const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
    return leadsLib.process(db, {
      siteFor: (id) => { const r = db.prepare('SELECT * FROM sites WHERE id = ?').get(id); return r && r.published && !billing.isSuspended(r) ? hydrateSite(r) : null; },
      send: async ({ lead, site, text, subject, optoutToken }) => {
        const c = site.sections.contact;
        const replyTo = (c.notifyEmail && isValidEmail(c.notifyEmail)) ? c.notifyEmail : c.email;
        const link = `${base || 'http://localhost:' + PORT}/unsubscribe/${optoutToken}`;
        await mailer.sendReport({ to: lead.email, subject, replyTo, text: `${text}\n\n— ${site.name}\n\nDon't want these emails? ${link}` });
      }
    });
  }
  async function runLeadReminders() {
    if (!mailer.isConfigured()) return;
    const sites = new Map();
    const todayFor = (id) => { if (!sites.has(id)) { const r = db.prepare('SELECT * FROM sites WHERE id = ?').get(id); sites.set(id, r || null); } return sites.get(id) ? siteToday(sites.get(id)) : '0000-00-00'; };
    const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '') || `http://localhost:${PORT}`;
    for (const [siteId, g] of leadsLib.dueReminders(db, todayFor)) {
      const r = sites.get(siteId); if (!r) continue;
      const site = hydrateSite(r), c = site.sections.contact;
      if (c.remindersOff) continue;
      const to = (c.notifyEmail && isValidEmail(c.notifyEmail)) ? c.notifyEmail : c.email;
      if (!to) continue;
      const lines = g.leads.map(l => `- ${l.name || 'Someone'}${l.phone ? ' · ' + l.phone : ''}${l.email ? ' · ' + l.email : ''} (${l.status}, follow up ${l.follow_up_at})${l.notes ? ' — ' + l.notes : ''}`);
      try {
        await mailer.sendReport({ to, subject: `Follow up today: ${g.leads.length} lead${g.leads.length === 1 ? '' : 's'} — ${site.name}`, text: `These leads for ${site.name} are due for a follow-up:\n\n${lines.join('\n')}\n\nOpen them: ${base}/sites/${siteId}/leads?status=due\n` });
        leadsLib.markReminded(db, g.leads.map(l => l.id), g.today);
      } catch (e) { console.error('Lead reminder failed:', e.message); }
    }
  }
  if (!isTestEnv) {
    setInterval(() => runFollowUps().catch(e => console.error('Follow-ups failed:', e.message)), 10 * 60 * 1000).unref();
    setInterval(() => runPaymentSweep().catch(e => console.error('Payment sweep failed:', e.message)), 5 * 60 * 1000).unref();
    setInterval(() => runLeadReminders().catch(e => console.error('Reminders failed:', e.message)), 60 * 60 * 1000).unref();
    setTimeout(() => runLeadReminders().catch(() => {}), 90 * 1000).unref();
  }
  // test hooks (only exist when the suite runs the server with NODE_ENV=test and a secret header)
  if (isTestEnv && process.env.NODE_ENV === 'test') {
    app.post('/__test/run-jobs', async (req, res) => {
      if (req.get('x-test-key') !== 'suite') return res.status(404).end();
      res.json({ followUps: await runFollowUps(), reminders: await runLeadReminders().then(() => true), payments: await runPaymentSweep() });
    });
    app.post('/__test/age-queue', (req, res) => {
      if (req.get('x-test-key') !== 'suite') return res.status(404).end();
      db.prepare("UPDATE followup_queue SET due_at = '2000-01-01T00:00:00.000Z' WHERE sent_at IS NULL").run();
      res.json({ ok: true });
    });
  }

  app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(`User-agent: *\nAllow: /site/\nDisallow: /site/*/members\nDisallow: /members\nDisallow: /dashboard\nDisallow: /sites/\n\nSitemap: ${req.protocol}://${req.get('host')}/sitemap.xml\n`);
  });

  app.get('/sitemap.xml', (req, res) => {
    const host = (req.hostname || '').toLowerCase();
    const origin = `${req.protocol}://${req.get('host')}`;
    const entries = [];
    const addSite = (row, base) => {
      const site = hydrateSite(row);
      const lastmod = (row.updated_at || '').slice(0, 10);
      const noindex = (k) => !!(((site.sections.seo || {}).pages || {})[k] || {}).noindex;
      const pages = ['', ...PAGE_KEYS.filter(k => pageIsAvailable(site, k) && !noindex(k)).map(k => `/${k}`)];
      // service pages are only listed once they have their own text (thin pages are noindex)
      if (pageIsAvailable(site, 'services')) {
        for (const sv of servicesWithSlugs(site.sections.services.items)) if (sv.detail) pages.push(`/services/${sv.slug}`);
      }
      // town pages only once the owner wrote text for them
      for (const ar of areasWithSlugs(site.sections.trust.serviceAreas, site.sections.trust.areaText)) if (ar.text) pages.push(`/areas/${ar.slug}`);
      if (pages.includes('/blog')) for (const po of servicesWithSlugs(site.sections.blog.items)) pages.push(`/blog/${po.slug}`);
      for (const ex of extraPageList(site)) pages.push(`/p/${ex.slug}`);
      if (legal.enabled(site)) pages.push('/privacy', '/terms');
      if (calc.isUsable(site.sections.calculator)) pages.push('/estimate');
      for (const p of pages) {
        entries.push(`  <url><loc>${base}${p || (base.endsWith('/site/' + row.slug) ? '' : '/')}</loc><lastmod>${lastmod}</lastmod></url>`);
      }
    };
    // on a site's own custom domain, list just that site, with clean URLs
    const own = host && host !== 'localhost'
      ? db.prepare('SELECT * FROM sites WHERE custom_domain = ? AND published = 1').get(host)
      : null;
    if (own && billing.isSuspended(own)) return res.status(503).type('text/plain').send('');
    if (own) {
      addSite(own, origin);
    } else {
      for (const row of db.prepare('SELECT * FROM sites WHERE published = 1').all()) {
        addSite(row, `${origin}/site/${row.slug}`);
      }
    }
    res.type('application/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>`
    );
  });

  return { redirectFor, sendRedirect };
};
