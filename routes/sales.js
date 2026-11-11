// Selling and launching (salesflow.js, gbp.js): the client approves the preview and pays a deposit, one-click Launch,
// Netlify form messages into Leads, a lead webhook for a CRM, Google basics, and visit counts for Netlify copies.
// server.js calls this where these routes belong in its route order and hands it the shared helpers they use.
'use strict';
const sales = require('../salesflow');
const salesLib = require('../packages');
const gbp = require('../gbp');

module.exports = function (app, deps) {
  const {
    PORT, billing, clientLimiter, db, findTemplate, getSite, hydrateSite, invalidateSiteCache, isTestEnv, isValidEmail,
    leadsLib, loadOwnedSite, mailer, netlify, payments, publishToNetlify, rateLimit, reports, requireAuth, runQuality,
    saveVersion, str
  } = deps;

  const stripeKey = () => String(process.env.STRIPE_SECRET_KEY || '').trim();
  const stripeOn = () => payments.validKey(stripeKey()) || (isTestEnv && /^sk_test_/.test(stripeKey()));
  const ownerEmail = (site) => (db.prepare('SELECT email FROM users WHERE id = ?').get(site.user_id) || {}).email || '';
  const publicOrigin = (req) => {
    if (req) return `${req.protocol}://${req.get('host')}`;
    try { return new URL(process.env.PUBLIC_URL).origin; } catch { return `http://localhost:${PORT}`; }
  };
  const tell = (opts) => (mailer.isConfigured() && opts.to ? mailer.sendReport(opts).catch(e => { console.error('Email failed:', e.message); return false; }) : Promise.resolve(false));

  // ---- the Search Console tag on every page (public-site.ejs calls this; small cache, cleared on save) ----
  const gsvCache = new Map();
  app.locals.sgVerifyTag = (siteId) => {
    if (!gsvCache.has(siteId)) { try { gsvCache.set(siteId, sales.get(db, siteId).ext.gsv); } catch { gsvCache.set(siteId, ''); } }
    return gsvCache.get(siteId);
  };

  // ======================= Approve and pay (on the client's preview link) =======================
  function loadShare(req, res, next) {
    res.set('Referrer-Policy', 'no-referrer');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    const token = String(req.params.token || '');
    const row = /^[A-Za-z0-9_-]{20,64}$/.test(token) ? db.prepare('SELECT * FROM share_links WHERE token = ?').get(token) : null;
    const site = row ? getSite(row.site_id) : null;
    if (!site) return res.status(404).json({ ok: false, error: 'This preview link is no longer active.' });
    req.site = site; req.share = row;
    next();
  }
  const approveLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, skip: () => isTestEnv, message: { ok: false, error: 'Too many tries. Please wait a few minutes.' } });
  const pkgsFor = (site) => sales.clientPackages(salesLib.read(db, site.user_id), salesLib.depositCents);
  function approvalJson(site) {
    const row = sales.get(db, site.id);
    return {
      ok: true,
      packages: pkgsFor(site).map(p => ({ i: p.i, name: p.name, price: p.price, items: p.items, best: p.best, deposit: p.depositCents && stripeOn() ? sales.money(p.depositCents) : '' })),
      chosen: row.package,
      approved: sales.isApproved(row) ? { name: row.approved_name, at: row.approved_at, package: row.package } : null,
      pay: { status: row.pay_status, amount: row.deposit_cents ? sales.money(row.deposit_cents, row.currency) : '', can: sales.canPay(row, stripeOn()) }
    };
  }
  app.get('/look/:token/approval', clientLimiter, loadShare, (req, res) => res.json(approvalJson(req.site)));

  app.post('/look/:token/approve', approveLimiter, loadShare, (req, res) => {
    const b = req.body || {};
    if (b.website) return res.json(approvalJson(req.site)); // honeypot
    const cur = sales.get(db, req.site.id);
    if (cur.pay_status === 'paid') return res.status(409).json({ ok: false, error: 'This design is already approved and the deposit is paid.' });
    const { approval, errors } = sales.cleanApproval(b, pkgsFor(req.site));
    if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });
    const deposit = approval.pkg ? approval.pkg.depositCents : 0;
    sales.set(db, req.site.id, {
      package: approval.pkg ? approval.pkg.name : '', approved_at: sales.nowIso(), approved_name: approval.name, approved_email: approval.email,
      approved_note: approval.note, deposit_cents: deposit, currency: 'usd',
      ...(cur.pay_status === 'pending' ? { pay_status: 'none', stripe_session_id: '' } : {})
    });
    const to = ownerEmail(req.site);
    tell({
      to, replyTo: approval.email, subject: `Approved: ${req.site.name}${approval.pkg ? ' · ' + approval.pkg.name : ''}`,
      text: `${approval.name} (${approval.email}) approved the design for ${req.site.name}.\n\nPackage: ${approval.pkg ? approval.pkg.name + (approval.pkg.price ? ' (' + approval.pkg.price + ')' : '') : 'not chosen yet'}\n${deposit ? `Deposit: ${sales.money(deposit)} (they can pay it online now)\n` : ''}${approval.note ? `\nTheir note: ${approval.note}\n` : ''}\nNext step, launch it: ${publicOrigin(req)}/sites/${req.site.id}/launch\n`
    });
    res.json(approvalJson(req.site));
  });

  app.post('/look/:token/deposit', approveLimiter, loadShare, async (req, res) => {
    const row = sales.get(db, req.site.id);
    if (!sales.canPay(row, stripeOn())) return res.status(400).json({ ok: false, error: row.pay_status === 'paid' ? 'The deposit is already paid. Thank you!' : 'There is no deposit to pay online for this design.' });
    const base = `${publicOrigin(req)}/look/${req.params.token}`;
    try {
      const s = await payments.createCheckout(stripeKey(), {
        amountCents: row.deposit_cents, currency: row.currency || 'usd', description: `${row.package || 'Website'} deposit: ${req.site.name}`.slice(0, 120),
        customerEmail: row.approved_email, successUrl: `${base}/paid?session_id={CHECKOUT_SESSION_ID}`, cancelUrl: `${base}?pay=canceled`,
        paymentId: `site-${req.site.id}`, siteName: req.site.name
      });
      sales.set(db, req.site.id, { stripe_session_id: String(s.id || ''), pay_status: 'pending' });
      res.json({ ok: true, url: s.url });
    } catch (e) {
      console.error('Deposit checkout failed:', e.message);
      res.status(502).json({ ok: false, error: 'The payment page could not be opened just now. Please try again in a minute.' });
    }
  });

  // marks the deposit paid once and tells Leo
  function depositPaid(site, how) {
    const row = sales.get(db, site.id);
    if (row.pay_status === 'paid') return false;
    sales.set(db, site.id, { pay_status: 'paid', paid_at: sales.nowIso(), paid_how: how });
    tell({ to: ownerEmail(site), replyTo: row.approved_email, subject: `Deposit paid: ${site.name}`, text: `${row.approved_name || 'Your client'} paid the ${sales.money(row.deposit_cents, row.currency)} deposit for ${site.name}${row.package ? ' (' + row.package + ')' : ''}${how === 'stripe' ? ' through Stripe' : ''}.\n\nLaunch it: ${publicOrigin()}/sites/${site.id}/launch\n` });
    return true;
  }
  async function refreshDeposit(site) {
    const row = sales.get(db, site.id);
    if (row.pay_status !== 'pending' || !row.stripe_session_id || !stripeOn()) return row.pay_status;
    try {
      const s = await payments.getSession(stripeKey(), row.stripe_session_id);
      if (payments.isPaid(s)) { depositPaid(site, 'stripe'); return 'paid'; }
      if (payments.isExpired(s)) { sales.set(db, site.id, { pay_status: 'none', stripe_session_id: '' }); return 'none'; }
    } catch (e) { console.error('Deposit check failed:', e.message); }
    return 'pending';
  }
  app.get('/look/:token/paid', clientLimiter, loadShare, async (req, res) => {
    const st = await refreshDeposit(req.site);
    res.redirect(`/look/${req.params.token}?pay=${st === 'paid' ? 'paid' : 'checking'}`);
  });
  async function runDepositSweep() {
    let n = 0;
    for (const r of db.prepare("SELECT site_id FROM site_sales WHERE pay_status = 'pending' AND stripe_session_id != ''").all()) {
      const site = getSite(r.site_id); if (!site) continue;
      if (await refreshDeposit(site) === 'paid') n++;
    }
    return n;
  }

  // ======================= Launch (one click: quality, publish, domain, HTTPS, tell the client) =======================
  const launchMsg = {
    launched: 'Launched. The site is live.', waiting: 'Published and the domain is added. HTTPS turns on by itself once the domain\'s DNS points at Netlify: SiteGen keeps trying every 15 minutes and emails the client when it is live.',
    nonetlify: 'Netlify is not connected yet. Add NETLIFY_AUTH_TOKEN to the .env file (see Publish online), then restart SiteGen.',
    baddomain: 'That does not look like a domain name. Use something like www.yourbusiness.com, or leave it blank.', bademail: 'That client email does not look right.',
    cleared: 'Approval cleared. The client can approve again on the preview link.', markpaid: 'Marked the deposit as paid.', unpaid: 'Deposit set back to not paid.',
    hook: 'Webhook saved.', hookoff: 'Webhook removed.', hooktest: 'Test lead sent.', synced: 'Checked Netlify for new messages.', rotated: 'New signing secret made. Update it in your CRM.',
    stopped: 'Stopped waiting for HTTPS.'
  };
  async function launchContext(req, quality) {
    const site = req.site;
    const row = sales.get(db, site.id);
    const share = db.prepare('SELECT token FROM share_links WHERE site_id = ?').get(site.id);
    const leads = db.prepare("SELECT COUNT(*) AS n, SUM(CASE WHEN source = 'netlify' THEN 1 ELSE 0 END) AS nl FROM contact_submissions WHERE site_id = ?").get(site.id);
    return {
      site, row, quality, steps: sales.launchSteps({ site, row, netlifyOn: netlify.isConfigured(), quality }),
      netlifyOn: netlify.isConfigured(), stripeOn: stripeOn(), mailOn: mailer.isConfigured(), money: sales.money,
      shareLink: share ? `${publicOrigin(req)}/look/${share.token}` : '', dns: site.netlify_domain && site.netlify_name ? netlify.dnsInstructions(site.netlify_domain, site.netlify_name) : [],
      liveUrl: gbp.liveUrl(site, ''), leads: { n: leads.n || 0, netlify: leads.nl || 0 }, statsOn: !!sales.statsBase(),
      flash: launchMsg[req.query.f] || '', err: req.query.err ? String(req.query.err).slice(0, 300) : '',
      clientMessage: liveMessage(site, row, gbp.liveUrl(site, '') || '[the website address]'),
      defaultNotify: req.query.gate ? str(req.query.notify, 254) : (row.launch_notify || row.approved_email || ''),
      defaultDomain: req.query.gate ? str(req.query.domain, 253) : (site.netlify_domain || row.launch_domain || ''),
      gate: parseInt(req.query.gate, 10) || 0, reportTick: req.query.gate ? req.query.report === '1' : !site.sections.meta.reportEmail
    };
  }
  app.get('/sites/:id/launch', requireAuth, loadOwnedSite, async (req, res) => {
    let quality = null;
    try { const q = await runQuality(req, res); quality = { ok: q.ok, red: q.errors || 0 }; } catch (e) { console.error('Quality check failed:', e.message); }
    res.render('launch', await launchContext(req, quality));
  });

  function liveMessage(site, row, url) {
    return `Hi${row.approved_name ? ' ' + row.approved_name.split(' ')[0] : ''},\n\nGood news: the new ${site.name} website is live.\n\n${url}\n\nHave a look on your phone too, and send me anything you would like changed.\n\nThank you!`;
  }
  // the end of a launch: live, client told (when email is set up), Leo told
  async function finishLaunch(site) {
    const row = sales.get(db, site.id);
    const fresh = getSite(site.id) || site;
    const url = gbp.liveUrl(fresh, '');
    sales.set(db, site.id, { launch_state: 'live' });
    if (row.launch_notify && !row.launched_at) {
      const ok = await tell({ to: row.launch_notify, replyTo: ownerEmail(site), subject: `Your new website is live: ${site.name}`, text: liveMessage(site, row, url) });
      if (ok) sales.set(db, site.id, { launched_at: sales.nowIso() });
    }
    tell({ to: ownerEmail(site), subject: `Live: ${site.name}`, text: `${site.name} is live at ${url}${row.launch_notify ? `\n\n${row.launch_notify} ${sales.get(db, site.id).launched_at ? 'was emailed' : 'was not emailed (email sending is not set up)'}.` : ''}\n` });
  }
  // asks Netlify for HTTPS; true when on, false while DNS is not ready, throws on other errors
  async function trySsl(site) {
    try {
      await netlify.provisionSsl(site.netlify_site_id);
      db.prepare('UPDATE sites SET netlify_ssl = 1 WHERE id = ?').run(site.id);
      return true;
    } catch (err) {
      if (err instanceof netlify.NetlifyError && err.status >= 400 && err.status < 500 && err.status !== 401 && err.status !== 429) return false;
      throw err;
    }
  }

  app.post('/sites/:id/launch', requireAuth, loadOwnedSite, async (req, res) => {
    const site = req.site; const back = (q) => res.redirect(`/sites/${site.id}/launch?${q}`);
    if (!netlify.isConfigured()) return back('f=nonetlify');
    const domainIn = String(req.body.domain || '').trim();
    const domain = domainIn ? netlify.cleanDomain(domainIn) : '';
    if (domainIn && !domain) return back('f=baddomain');
    const notifyIn = String(req.body.notify || '').trim();
    if (notifyIn && !isValidEmail(notifyIn)) return back('f=bademail');
    if (req.body.force !== '1') {
      const q = await runQuality(req, res);
      if (!q.ok) return back(`gate=${q.errors || 1}&domain=${encodeURIComponent(domainIn)}&notify=${encodeURIComponent(notifyIn)}&report=${req.body.report === '1' ? 1 : 0}`);
    }
    sales.set(db, site.id, { launch_state: 'publishing', launch_started_at: sales.nowIso(), launch_tries: 0, launch_notify: notifyIn ? str(notifyIn, 254) : '', launch_domain: domain, launched_at: '' });
    // the monthly report goes to the client too, when Leo ticks it (saved in the editor's Local SEO box)
    if (req.body.report === '1' && notifyIn && site.sections.meta.reportEmail !== notifyIn) {
      saveVersion(site.id, site.theme, site.sections, site.layout, 'Before setting the report email');
      const sec = { ...site.sections, meta: { ...site.sections.meta, reportEmail: str(notifyIn, 254) } };
      db.prepare('UPDATE sites SET sections = ? WHERE id = ?').run(JSON.stringify(sec), site.id);
      site.sections = sec;
    }
    if (domain && domain !== site.netlify_domain && site.netlify_site_id) { // known Netlify site: set the domain first so the copy carries it
      try { await netlify.setCustomDomain(site.netlify_site_id, domain); db.prepare('UPDATE sites SET netlify_domain = ?, netlify_ssl = 0 WHERE id = ?').run(domain, site.id); Object.assign(site, { netlify_domain: domain, netlify_ssl: 0 }); }
      catch (e) { sales.set(db, site.id, { launch_state: 'failed' }); return back('err=' + encodeURIComponent(e.message)); }
    }
    const pub = await publishToNetlify(site);
    if (!pub.ok) { sales.set(db, site.id, { launch_state: 'failed' }); return back('err=' + encodeURIComponent(pub.error)); }
    if (domain && domain !== site.netlify_domain) {
      try { await netlify.setCustomDomain(site.netlify_site_id, domain); db.prepare('UPDATE sites SET netlify_domain = ?, netlify_ssl = 0 WHERE id = ?').run(domain, site.id); Object.assign(site, { netlify_domain: domain, netlify_ssl: 0 }); }
      catch (e) { sales.set(db, site.id, { launch_state: 'failed' }); return back('err=' + encodeURIComponent(e.message)); }
    }
    if (site.netlify_domain && !site.netlify_ssl) {
      let on = false;
      try { on = await trySsl(site); } catch (e) { sales.set(db, site.id, { launch_state: 'failed' }); return back('err=' + encodeURIComponent(e.message)); }
      if (!on) { sales.set(db, site.id, { launch_state: 'waiting-dns', launch_tries: 1 }); return back('f=waiting'); }
      const again = getSite(site.id); if (again) await publishToNetlify(again); // the copy now knows its https address (sitemap)
    }
    await finishLaunch(site);
    back('f=launched');
  });
  app.post('/sites/:id/launch/stop', requireAuth, loadOwnedSite, (req, res) => {
    sales.set(db, req.site.id, { launch_state: '', launch_tries: 0 });
    res.redirect(`/sites/${req.site.id}/launch?f=stopped`);
  });
  // every 15 minutes: try HTTPS again for launches waiting on DNS
  async function runLaunchRetries() {
    if (!netlify.isConfigured()) return 0;
    let n = 0;
    for (const r of db.prepare("SELECT site_id, launch_tries FROM site_sales WHERE launch_state = 'waiting-dns'").all()) {
      const site = getSite(r.site_id);
      if (!site || !site.netlify_site_id || !site.netlify_domain) { sales.set(db, r.site_id, { launch_state: '' }); continue; }
      let on = false;
      try { on = await trySsl(site); } catch (e) { console.error('HTTPS retry failed:', e.message); }
      if (on) { const again = getSite(site.id); if (again) await publishToNetlify(again); await finishLaunch(site); n++; continue; }
      const tries = (r.launch_tries || 0) + 1;
      if (tries >= sales.LAUNCH_MAX_TRIES) {
        sales.set(db, site.id, { launch_state: 'failed', launch_tries: tries });
        tell({ to: ownerEmail(site), subject: `HTTPS is still not on: ${site.name}`, text: `For 3 days Netlify could not turn on HTTPS for ${site.netlify_domain}. The domain's DNS records probably do not point at Netlify yet. Check them on the Launch page: ${publicOrigin()}/sites/${site.id}/launch\n` });
      } else sales.set(db, site.id, { launch_tries: tries });
    }
    return n;
  }

  // ---- approval and deposit, from Leo's side ----
  app.post('/sites/:id/sales/clear-approval', requireAuth, loadOwnedSite, (req, res) => {
    sales.set(db, req.site.id, { approved_at: '', approved_name: '', approved_email: '', approved_note: '', ...(sales.get(db, req.site.id).pay_status === 'paid' ? {} : { pay_status: 'none', stripe_session_id: '', deposit_cents: 0 }) });
    res.redirect(`/sites/${req.site.id}/launch?f=cleared`);
  });
  app.post('/sites/:id/sales/mark-paid', requireAuth, loadOwnedSite, (req, res) => {
    if (req.body.paid === '0') { sales.set(db, req.site.id, { pay_status: 'none', paid_at: '', paid_how: '', stripe_session_id: '' }); return res.redirect(`/sites/${req.site.id}/launch?f=unpaid`); }
    const amount = salesLib.depositCents(req.body.amount);
    if (amount) sales.set(db, req.site.id, { deposit_cents: amount });
    depositPaid(req.site, 'manual');
    res.redirect(`/sites/${req.site.id}/launch?f=markpaid`);
  });

  // ======================= Leads: Netlify Forms into Leads, and a webhook for a CRM =======================
  async function fireWebhook(siteId, leadIds, event = 'lead.created') {
    const ext = sales.get(db, siteId).ext;
    if (!ext.webhook.url || !leadIds.length) return null;
    const site = getSite(siteId); if (!site) return null;
    let last = null;
    for (const id of leadIds) {
      const lead = db.prepare('SELECT * FROM contact_submissions WHERE id = ? AND site_id = ?').get(id, siteId);
      if (!lead) continue;
      last = await sales.sendWebhook(ext.webhook, sales.leadPayload(site, lead, event));
    }
    if (last) sales.setExtras(db, siteId, { webhook: { lastStatus: last.status, lastAt: sales.nowIso() } });
    return last;
  }
  // called by server.js (recordLead) for every lead a site receives directly
  function onLeadCreated(siteId, leadId) { fireWebhook(siteId, [leadId]).catch(e => console.error('Lead webhook failed:', e.message)); }

  async function syncForms(row) {
    if (!netlify.isConfigured() || !row || !row.netlify_site_id) return 0;
    const subs = await netlify.listSubmissions(row.netlify_site_id);
    const added = sales.importLeads(db, row.id, subs);
    sales.set(db, row.id, { forms_synced_at: sales.nowIso() });
    if (!added.length) return 0;
    const site = hydrateSite(row);
    for (const l of added) { try { leadsLib.enqueue(db, l.id, row.id, site.sections.contact.followUp); } catch (e) { console.error('Follow-up queue failed:', e.message); } }
    await fireWebhook(row.id, added.map(l => l.id)).catch(() => null);
    return added.length;
  }
  async function runFormSync() {
    if (!netlify.isConfigured()) return 0;
    let n = 0;
    for (const row of db.prepare("SELECT * FROM sites WHERE netlify_site_id != ''").all()) {
      try { n += await syncForms(row); } catch (e) { console.error('Netlify form sync failed:', e.message); }
    }
    return n;
  }
  // opening the Leads page first copies in any new Netlify messages (gives up quietly after 6 seconds)
  app.get('/sites/:id/leads', requireAuth, loadOwnedSite, async (req, res, next) => {
    if (req.site.netlify_site_id && netlify.isConfigured()) {
      const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.site.id);
      await Promise.race([syncForms(row).catch(e => console.error('Netlify form sync failed:', e.message)), new Promise(r => setTimeout(r, 6000))]);
    }
    next();
  });
  app.post('/sites/:id/sales/sync-forms', requireAuth, loadOwnedSite, async (req, res) => {
    try { await syncForms(db.prepare('SELECT * FROM sites WHERE id = ?').get(req.site.id)); res.redirect(`/sites/${req.site.id}/launch?f=synced#leads`); }
    catch (e) { res.redirect(`/sites/${req.site.id}/launch?err=${encodeURIComponent(e.message)}#leads`); }
  });
  app.post('/sites/:id/sales/webhook', requireAuth, loadOwnedSite, (req, res) => {
    const back = (q) => res.redirect(`/sites/${req.site.id}/launch?${q}#leads`);
    if (req.body.action === 'remove') { sales.setExtras(db, req.site.id, { webhook: { url: '', secret: '', lastStatus: '', lastAt: '' } }); return back('f=hookoff'); }
    if (req.body.action === 'rotate') { sales.setExtras(db, req.site.id, { webhook: { secret: sales.newSecret() } }); return back('f=rotated'); }
    const url = sales.cleanWebhookUrl(req.body.url);
    if (!url) return back('err=' + encodeURIComponent('Use a full https:// address (or http://localhost for a CRM on this computer).'));
    const cur = sales.get(db, req.site.id).ext.webhook;
    sales.setExtras(db, req.site.id, { webhook: { url, secret: cur.secret || sales.newSecret() } });
    back('f=hook');
  });
  app.post('/sites/:id/sales/webhook/test', requireAuth, loadOwnedSite, async (req, res) => {
    const ext = sales.get(db, req.site.id).ext;
    const r = await sales.sendWebhook(ext.webhook, sales.leadPayload(req.site, { id: 0, name: 'Test Lead', email: 'test@example.com', phone: '', service: 'Test', message: 'A test from SiteGen. You can delete it.', source: 'test' }, 'lead.test'));
    sales.setExtras(db, req.site.id, { webhook: { lastStatus: r.status, lastAt: sales.nowIso() } });
    res.redirect(`/sites/${req.site.id}/launch?${r.ok ? 'f=hooktest' : 'err=' + encodeURIComponent(r.status)}#leads`);
  });

  // ======================= Google basics =======================
  app.get('/sites/:id/google', requireAuth, loadOwnedSite, (req, res) => {
    const site = req.site, row = sales.get(db, site.id);
    // the saved business type; failing that, a guess from the name and services (as the editor's advice does)
    let tpl = findTemplate((site.sections.meta && site.sections.meta.businessType) || '') || {};
    if (!tpl.id || tpl.id === 'generic') tpl = findTemplate([site.name, ...((site.sections.services && site.sections.services.items) || []).map(x => x && x.title)].filter(Boolean).join(' ')) || {};
    const base = gbp.liveUrl(site, '') || '';
    const auto = gbp.autoChecks(site, { ext: row.ext, publicOrigin: publicOrigin(req), templateId: tpl.id, reviewLink: site.published ? `${publicOrigin(req)}/site/${site.slug}/review` : '' });
    const sitemap = site.netlify_site_id && base ? base.replace(/\/?$/, '/') + 'sitemap.xml' : site.published ? `${publicOrigin(req)}/sitemap.xml` : '';
    res.render('google', {
      site, ext: row.ext, auto, nap: gbp.napCheck(site, row.ext.gbp), manual: gbp.MANUAL, sitemap, description: gbp.suggestedDescription(site),
      onNetlify: !!site.netlify_site_id, saved: req.query.saved === '1', bad: req.query.bad === '1'
    });
  });
  app.post('/sites/:id/google', requireAuth, loadOwnedSite, (req, res) => {
    const b = req.body || {};
    const gsvIn = String(b.gsv || '').trim();
    const gsv = sales.cleanVerify(gsvIn);
    const done = [].concat(b.done || []).filter(x => gbp.MANUAL_IDS.includes(x));
    sales.setExtras(db, req.site.id, { gsv, gbp: { name: b.gbp_name, phone: b.gbp_phone, address: b.gbp_address, category: b.gbp_category, done } });
    gsvCache.delete(req.site.id);
    invalidateSiteCache(req.site);
    res.redirect(`/sites/${req.site.id}/google?saved=1${gsvIn && !gsv ? '&bad=1' : ''}`);
  });

  // ======================= visits on a Netlify copy =======================
  const statsLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false, skip: () => isTestEnv, handler: (req, res) => res.status(204).end() });
  const EVENTS = ['call', 'email', 'text', 'cta', 'directions', 'social'];
  function statsSite(key) {
    if (!/^[A-Za-z0-9_-]{16,40}$/.test(String(key || ''))) return null;
    const r = db.prepare('SELECT s.* FROM site_sales x JOIN sites s ON s.id = x.site_id WHERE x.stats_key = ?').get(key);
    return r && (r.netlify_site_id || r.published) && !billing.isSuspended(r) ? r : null;
  }
  const cleanPath = (p) => String(p || '').toLowerCase().replace(/[^a-z0-9/_-]/g, '').slice(0, 80) || 'home';
  app.post('/h/:key/v', statsLimiter, (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    const row = statsSite(req.params.key);
    if (row && !reports.isBot(req.get('user-agent'))) { try { reports.recordView(db, row.id, cleanPath((req.body || {}).p)); } catch { /* counting never breaks anything */ } }
    res.status(204).end();
  });
  app.post('/h/:key/e', statsLimiter, (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    const row = statsSite(req.params.key), ev = EVENTS.includes((req.body || {}).e) ? req.body.e : '';
    if (row && ev && !reports.isBot(req.get('user-agent'))) {
      try {
        db.prepare(`INSERT INTO page_events (site_id, day, event, path, n) VALUES (?, date('now'), ?, ?, 1)
          ON CONFLICT(site_id, day, event, path) DO UPDATE SET n = n + 1`).run(row.id, ev, cleanPath(req.body.p));
      } catch { /* counting never breaks anything */ }
    }
    res.status(204).end();
  });

  // ---- background jobs ----
  if (!isTestEnv) {
    setInterval(() => runDepositSweep().catch(e => console.error('Deposit sweep failed:', e.message)), 5 * 60 * 1000).unref();
    setInterval(() => runLaunchRetries().catch(e => console.error('Launch retries failed:', e.message)), sales.LAUNCH_RETRY_MS).unref();
    setInterval(() => runFormSync().catch(e => console.error('Netlify form sync failed:', e.message)), 10 * 60 * 1000).unref();
    setTimeout(() => runFormSync().catch(() => {}), 2 * 60 * 1000).unref();
  }
  if (isTestEnv && process.env.NODE_ENV === 'test') {
    app.post('/__test/sales-jobs', async (req, res) => {
      if (req.get('x-test-key') !== 'suite') return res.status(404).end();
      res.json({ deposits: await runDepositSweep(), launches: await runLaunchRetries(), forms: await runFormSync() });
    });
  }

  return { onLeadCreated, runFormSync };
};
