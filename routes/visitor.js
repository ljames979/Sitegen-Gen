// What site visitors send: events, chat, estimates, buy buttons, reviews and contact forms
// server.js calls this where these routes belong in its route order and hands it the shared helpers they use.
module.exports = function (app, deps) {
  const {
    billing, calc, chat, contactLimiter, db, handleContactSubmission, handleReviewSubmission, hydrateSite,
    isTestEnv, isValidEmail, newPayment, payLimiter, payReady, payments, rateLimit, recordLead, reports,
    reviewLimiter, startCheckout, str
  } = deps;

  // ---- "what did visitors do" counters (taps on call / email / text, button clicks) ----
  const EVENT_NAMES = ['call', 'email', 'text', 'cta', 'directions', 'social'];
  const eventLimiter = rateLimit({
    windowMs: 60 * 1000, limit: 90, standardHeaders: true, legacyHeaders: false, skip: () => isTestEnv,
    handler: (req, res) => res.status(204).end()
  });
  function handleEvent(req, res, row) {
    const b = req.body || {};
    const name = EVENT_NAMES.includes(b.e) ? b.e : '';
    if (name && row && row.published && !reports.isBot(req.get('user-agent'))) {
      const pathKey = String(b.p || '').toLowerCase().replace(/[^a-z0-9/_-]/g, '').slice(0, 80) || 'home';
      try {
        db.prepare(`INSERT INTO page_events (site_id, day, event, path, n) VALUES (?, date('now'), ?, ?, 1)
        ON CONFLICT(site_id, day, event, path) DO UPDATE SET n = n + 1`).run(row.id, name, pathKey);
      } catch (e) { /* counting must never break anything */ }
    }
    res.status(204).end();
  }
  app.post('/site/:slug/e', eventLimiter, (req, res) => handleEvent(req, res, db.prepare('SELECT * FROM sites WHERE slug = ?').get(req.params.slug)));
  app.post('/e', eventLimiter, (req, res, next) => {
    const host = (req.hostname || '').toLowerCase();
    if (!host || host === 'localhost') return next();
    const row = db.prepare('SELECT * FROM sites WHERE custom_domain = ? AND published = 1').get(host);
    if (!row) return next();
    handleEvent(req, res, row);
  });

  // ---- website chat assistant ----
  const chatLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, limit: 24, standardHeaders: true, legacyHeaders: false, skip: () => isTestEnv,
    handler: (req, res) => res.status(429).json({ ok: false, reply: 'Too many messages for now. Please leave your details below or try again in a few minutes.' })
  });
  async function handleChat(req, res, row) {
    if (!row || !row.published || billing.isSuspended(row)) return res.status(404).json({ ok: false });
    const site = hydrateSite(row);
    const cfg = chat.clean(site.sections.chat);
    if (!cfg.enabled) return res.status(404).json({ ok: false });
    const messages = chat.sanitize((req.body || {}).messages);
    if (!messages.length) return res.status(400).json({ ok: false, reply: 'Please type a question.' });
    const day = new Date().toISOString().slice(0, 10);
    db.prepare('INSERT INTO chat_usage (site_id, day, n) VALUES (?, ?, 1) ON CONFLICT(site_id, day) DO UPDATE SET n = n + 1').run(row.id, day);
    const used = db.prepare('SELECT n FROM chat_usage WHERE site_id = ? AND day = ?').get(row.id, day).n;
    let reply = used <= cfg.dailyCap ? await chat.askAi(site, messages) : null;
    const ai = !!reply;
    if (!reply) reply = chat.fallback(site, messages[messages.length - 1].content);
    res.json({ ok: true, reply, ai });
  }
  function handleChatLead(req, res, row) {
    if (!row || !row.published || billing.isSuspended(row)) return res.status(404).json({ ok: false });
    const site = hydrateSite(row);
    if (!chat.clean(site.sections.chat).enabled) return res.status(404).json({ ok: false });
    const b = req.body || {};
    if (b.website) return res.json({ ok: true }); // honeypot
    const name = str(b.name, 100), phone = str(b.phone, 40);
    const email = isValidEmail(b.email || '') ? str(b.email, 254) : '';
    if (!name && !email && !phone) return res.status(400).json({ ok: false, error: 'Please add a phone number or email so we can reply.' });
    const transcript = chat.sanitize(([]).concat(Array.isArray(b.transcript) ? b.transcript : [])).map(m => `${m.role === 'user' ? 'Visitor' : 'Assistant'}: ${m.content}`).join('\n');
    const message = (str(b.message, 1000) + (transcript ? `\n\n--- Chat ---\n${transcript}` : '')).trim().slice(0, 2000);
    recordLead(req, row, { name, email, phone, message, service: '', answers: [] }, '', 'chat');
    res.json({ ok: true });
  }
  app.post('/site/:slug/chat', chatLimiter, (req, res) => handleChat(req, res, db.prepare('SELECT * FROM sites WHERE slug = ?').get(req.params.slug)));
  app.post('/site/:slug/chat/lead', contactLimiter, (req, res) => handleChatLead(req, res, db.prepare('SELECT * FROM sites WHERE slug = ?').get(req.params.slug)));
  const byHost = (fn) => (req, res, next) => {
    const host = (req.hostname || '').toLowerCase();
    if (!host || host === 'localhost') return next();
    const row = db.prepare('SELECT * FROM sites WHERE custom_domain = ? AND published = 1').get(host);
    if (!row) return next();
    return fn(req, res, row);
  };
  app.post('/chat', chatLimiter, byHost(handleChat));
  app.post('/chat/lead', contactLimiter, byHost(handleChatLead));

  // ---- quote / estimate calculator ----
  function handleEstimate(req, res, row, basePath) {
    if (!row || !row.published) return res.status(404).render('not-found');
    if (billing.isSuspended(row)) return res.status(503).render('suspended', { name: row.name });
    const site = hydrateSite(row);
    const cfg = calc.normalize(site.sections.calculator);
    if (!calc.isUsable(cfg)) return res.status(404).render('not-found');
    const b = req.body || {};
    const back = (q) => res.redirect(`${basePath}/estimate?${q}`);
    if (b.website) return res.redirect(`${basePath}/thank-you`); // honeypot
    const answers = cfg.fields.map((f, i) => b['ce_' + i]);
    const r = calc.compute(cfg, answers);
    if (!r.ok) return back('error=' + encodeURIComponent(r.error.slice(0, 120)));
    const name = str(b.name, 100), phone = str(b.phone, 40);
    const email = isValidEmail(b.email || '') ? str(b.email, 254) : '';
    if (!email && !phone) return back('error=' + encodeURIComponent('Please add a phone number or email so we can reply.'));
    const lines = r.lines.map(l => ({ label: l.label, value: cfg.showPrice && l.amount ? `${l.value} (${calc.fmt(l.amount)})` : l.value }));
    if (cfg.showPrice && r.total > 0) lines.push({ label: 'Estimate shown to visitor', value: calc.rangeText(r) });
    const message = (cfg.showPrice && r.total > 0 ? `Asked for an estimate: ${calc.rangeText(r)}.` : 'Asked for a quote.') + (str(b.message, 1000) ? '\n' + str(b.message, 1000) : '');
    recordLead(req, row, { name, email, phone, message, service: '', answers: lines }, '', 'estimate');
    res.redirect(`${basePath}/thank-you`);
  }
  app.post('/site/:slug/estimate', contactLimiter, (req, res) => handleEstimate(req, res, db.prepare('SELECT * FROM sites WHERE slug = ?').get(req.params.slug), `/site/${req.params.slug}`));
  app.post('/estimate', contactLimiter, byHost((req, res, row) => handleEstimate(req, res, row, '')));

  // "Pay online" on a service: the price always comes from the owner's settings, never from the visitor
  async function handleBuy(req, res, row, basePath) {
    if (!row || !row.published) return res.status(404).render('not-found');
    if (billing.isSuspended(row)) return res.status(503).render('suspended', { name: row.name });
    const site = hydrateSite(row);
    const svc = (site.sections.services.items || []).find(x => x.title === str((req.body || {}).service, 80));
    const cents = svc ? payments.toCents(svc.pay) : 0;
    if (!svc || !cents || !payReady(row, site)) return res.redirect(`${basePath}/services`);
    try {
      const pay = newPayment(row, { kind: 'purchase', description: svc.title, amountCents: cents, currency: site.sections.payments.currency });
      res.redirect(await startCheckout(req, row, pay));
    } catch (e) { console.error('Purchase checkout failed:', e.message); res.redirect(`${basePath}/services`); }
  }
  app.post('/site/:slug/buy', payLimiter, (req, res) => handleBuy(req, res, db.prepare('SELECT * FROM sites WHERE slug = ?').get(req.params.slug), `/site/${req.params.slug}`));
  app.post('/buy', payLimiter, byHost((req, res, row) => handleBuy(req, res, row, '')));

  app.post('/review', reviewLimiter, (req, res, next) => {
    const host = (req.hostname || '').toLowerCase();
    if (!host || host === 'localhost') return next();
    const row = db.prepare('SELECT * FROM sites WHERE custom_domain = ? AND published = 1').get(host);
    if (!row) return next();
    if (billing.isSuspended(row)) return res.status(503).render('suspended', { name: row.name });
    handleReviewSubmission(req, res, row, '');
  });

  app.post('/contact', contactLimiter, (req, res, next) => {
    const host = (req.hostname || '').toLowerCase();
    if (!host || host === 'localhost') return next();
    const row = db.prepare('SELECT * FROM sites WHERE custom_domain = ? AND published = 1').get(host);
    if (!row) return next();
    if (billing.isSuspended(row)) return res.status(503).render('suspended', { name: row.name });
    handleContactSubmission(req, res, row, '');
  });
};
