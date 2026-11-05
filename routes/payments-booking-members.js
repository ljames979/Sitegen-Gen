// Payment links, online booking and members-only pages
// server.js calls this where these routes belong in its route order and hands it the shared helpers they use.
module.exports = function (app, deps) {
  const {
    PORT, bcrypt, billing, booking, db, hostingNotifyEmail, hydrateSite, isTestEnv, isValidEmail, loadOwnedSite,
    mailer, membersLib, nanoid, payments, rateLimit, renderSitePage, requireAuth, session, str
  } = deps;

  // ---- online booking ----
  // Customers pick a service, add-ons and a time on /book; the request is stored
  // as 'pending' (or 'confirmed' when the owner turned on auto-confirm) and the
  // owner confirms or declines it on the Bookings page. Times are stored as the
  // business's own wall-clock time, so the business time zone decides what "now" is.
  const bookingLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
    skip: () => isTestEnv, message: 'Too many booking attempts from this device. Please try again later.'
  });
  // ---- customer payments (deposits, payment requests, service purchases) ----
  // Money goes to the site owner's own Stripe account (their key, stored encrypted). Payments are confirmed by
  // asking Stripe about the Checkout Session, so no webhook is needed.
  const siteStripeKey = (row) => payments.decryptKey(row.stripe_key_enc);
  const payReady = (row, site) => !!(site.sections.payments && site.sections.payments.enabled && siteStripeKey(row));
  const payBase = (req, row) => (row.custom_domain ? `https://${row.custom_domain}` : `${req.protocol}://${req.get('host')}`);
  function newPayment(row, { kind, refId = null, description, amountCents, name = '', email = '', currency = 'usd' }) {
    const token = nanoid(24);
    db.prepare('INSERT INTO payments (site_id, token, kind, ref_id, description, amount_cents, currency, customer_name, customer_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(row.id, token, kind, refId, String(description || '').slice(0, 200), amountCents, payments.CURRENCIES[currency] ? currency : 'usd', String(name).slice(0, 100), String(email).slice(0, 254));
    return db.prepare('SELECT * FROM payments WHERE token = ?').get(token);
  }
  // returns the Stripe-hosted page to send the customer to
  async function startCheckout(req, row, p) {
    const key = siteStripeKey(row);
    if (!key) throw new Error('This site is not set up to take payments.');
    if (p.stripe_session_id) { // reuse a still-open session; notice if it was already paid
      try {
        const s = await payments.getSession(key, p.stripe_session_id);
        if (payments.isPaid(s)) { markPaid(row, p, s); return `${payBase(req, row)}/pay/${p.token}?done=1`; }
        if (s.status === 'open' && s.url) return s.url;
      } catch { /* make a new one */ }
    }
    const base = payBase(req, row);
    const s = await payments.createCheckout(key, {
      amountCents: p.amount_cents, currency: p.currency, description: p.description, customerEmail: p.customer_email,
      successUrl: `${base}/pay/${p.token}?done=1`, cancelUrl: `${base}/pay/${p.token}`, paymentId: p.id, siteName: row.name
    });
    db.prepare('UPDATE payments SET stripe_session_id = ?, stripe_session_url = ? WHERE id = ?').run(s.id, s.url || '', p.id);
    return s.url;
  }
  // the one place a payment becomes "paid" (safe to call twice: only the first call does the follow-up work)
  function pseudoReq(row) { // for emails sent from background jobs: build links from PUBLIC_URL (or the site's own domain)
    let u = null; try { u = process.env.PUBLIC_URL ? new URL(process.env.PUBLIC_URL) : null; } catch { /* ignore */ }
    const host = row.custom_domain || (u && u.host) || `localhost:${PORT}`;
    return { protocol: row.custom_domain ? 'https' : (u ? u.protocol.replace(':', '') : 'http'), get: (h) => (h === 'host' ? host : '') };
  }
  function markPaid(row, p, session, via = 'stripe', req) {
    const cd = (session && session.customer_details) || {};
    const r = db.prepare("UPDATE payments SET status = 'paid', paid_at = datetime('now'), paid_via = ?, customer_name = CASE WHEN customer_name = '' THEN ? ELSE customer_name END, customer_email = CASE WHEN customer_email = '' THEN ? ELSE customer_email END WHERE id = ? AND status != 'paid'")
      .run(via, String(cd.name || '').slice(0, 100), String(cd.email || '').slice(0, 254), p.id);
    if (!r.changes) return false;
    const paid = db.prepare('SELECT * FROM payments WHERE id = ?').get(p.id);
    try {
      if (paid.kind === 'deposit' && paid.ref_id) {
        const bk = db.prepare("SELECT * FROM bookings WHERE id = ? AND site_id = ? AND status = 'awaiting_payment'").get(paid.ref_id, row.id);
        const site = hydrateSite(row);
        if (bk) {
          const status = site.sections.booking.autoConfirm ? 'confirmed' : 'pending';
          db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, bk.id);
          emailBooking(req || pseudoReq(row), row, { ...bk, status }, 'created');
        }
      }
      const site = hydrateSite(row); const to = ownerEmailFor(site);
      if (to && mailer.isConfigured()) {
        mailer.sendReport({ to, replyTo: paid.customer_email || undefined, subject: `Payment received: ${payments.money(paid.amount_cents, paid.currency)} (${row.name})`,
          text: `${paid.customer_name || 'A customer'} paid ${payments.money(paid.amount_cents, paid.currency)}.\n\nFor: ${paid.description}\n${paid.customer_email ? 'Email: ' + paid.customer_email + '\n' : ''}\nSee all payments in SiteGen under Payments for ${row.name}.\n` })
          .catch(e => console.error('Payment alert failed:', e.message));
      }
    } catch (e) { console.error('After-payment steps failed:', e.message); }
    return true;
  }
  // ask Stripe where a pending payment stands
  async function refreshPayment(row, p) {
    if (p.status !== 'pending' || !p.stripe_session_id) return p;
    const key = siteStripeKey(row);
    if (!key) return p;
    try {
      const s = await payments.getSession(key, p.stripe_session_id);
      if (payments.isPaid(s)) markPaid(row, p, s);
      else if (payments.isExpired(s)) db.prepare("UPDATE payments SET status = 'expired' WHERE id = ? AND status = 'pending'").run(p.id);
    } catch (e) { console.error('Payment check failed:', e.message); }
    return db.prepare('SELECT * FROM payments WHERE id = ?').get(p.id);
  }
  // background: confirm payments the customer paid but never came back from, and release unpaid deposit holds
  async function runPaymentSweep() {
    let checked = 0, released = 0;
    const pend = db.prepare("SELECT * FROM payments WHERE status = 'pending' AND stripe_session_id != '' AND created_at > datetime('now', '-3 days')").all();
    for (const p of pend) {
      const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(p.site_id);
      if (row) { await refreshPayment(row, p); checked++; }
    }
    const stale = db.prepare("SELECT * FROM bookings WHERE status = 'awaiting_payment' AND created_at <= datetime('now', '-30 minutes')").all();
    for (const bk of stale) {
      const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(bk.site_id);
      const pay = db.prepare("SELECT * FROM payments WHERE kind = 'deposit' AND ref_id = ? ORDER BY id DESC").get(bk.id);
      if (row && pay) await refreshPayment(row, pay);
      const now = db.prepare('SELECT status FROM bookings WHERE id = ?').get(bk.id);
      if (now && now.status === 'awaiting_payment') {
        db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").run(bk.id);
        db.prepare("UPDATE payments SET status = 'expired' WHERE kind = 'deposit' AND ref_id = ? AND status = 'pending'").run(bk.id);
        released++;
      }
    }
    return { checked, released };
  }

  // customer-facing payment page: one link per payment, works on the site's own domain too
  const payLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, skip: () => isTestEnv,
    message: 'Too many attempts. Please try again in a few minutes.'
  });
  function loadPayment(req, res, next) {
    const t = String(req.params.token || '');
    const p = /^[A-Za-z0-9_-]{16,64}$/.test(t) ? db.prepare('SELECT * FROM payments WHERE token = ?').get(t) : null;
    const row = p && db.prepare('SELECT * FROM sites WHERE id = ?').get(p.site_id);
    if (!p || !row) return res.status(404).render('not-found');
    res.set({ 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' });
    req.pay = p; req.payRow = row;
    next();
  }
  app.get('/pay/:token', loadPayment, async (req, res) => {
    let p = req.pay; const row = req.payRow;
    if (p.status === 'pending' && p.stripe_session_id) p = await refreshPayment(row, p);
    const site = hydrateSite(row);
    res.render('pay', { p, siteName: row.name, color: (site.theme && site.theme.primaryColor) || '#2563eb', amount: payments.money(p.amount_cents, p.currency), ready: payReady(row, site), error: req.query.error === '1', done: req.query.done === '1' });
  });
  app.post('/pay/:token', payLimiter, loadPayment, async (req, res) => {
    const p = req.pay, row = req.payRow, site = hydrateSite(row);
    if (p.status !== 'pending' || !payReady(row, site)) return res.redirect(`/pay/${p.token}`);
    try { res.redirect(await startCheckout(req, row, p)); }
    catch (e) { console.error('Checkout failed:', e.message); res.redirect(`/pay/${p.token}?error=1`); }
  });

  const BOOKING_LIVE = ['pending', 'confirmed'];
  const BOOKING_ERRORS = {
    name: 'Please enter your name.', email: 'Please enter a valid email address so we can confirm with you.',
    service: 'Please choose a service.', slot: 'Please pick a date and time.', taken: 'Sorry, that time is no longer available. Please choose another.',
    required: 'Please fill in the highlighted questions.', address: 'Please enter the address where we should come.'
  };

  function bookableServices(b) {
    return b.services.length ? b.services : [{ name: 'Appointment', minutes: 60, price: '', description: '' }];
  }
  // what the customer asked for -> the service, add-ons and total length (null if it doesn't match the owner's setup)
  function resolveBookingChoice(b, serviceName, addonNames) {
    const svc = bookableServices(b).find(s => s.name === serviceName);
    if (!svc) return null;
    const wanted = ([]).concat(addonNames || []).map(a => String(a));
    const addons = b.addons.filter(a => wanted.includes(a.name));
    const minutes = (+svc.minutes || 60) + addons.reduce((n, a) => n + (+a.minutes || 0), 0);
    return { service: svc, addons, minutes };
  }
  function liveBookingsOn(siteId, date) {
    return db.prepare(`SELECT start_at, duration FROM bookings WHERE site_id = ? AND start_at LIKE ? AND (status IN ('pending','confirmed') OR (status = 'awaiting_payment' AND created_at > datetime('now', '-30 minutes')))`).all(siteId, `${date}%`);
  }
  function bookingSlotsResponse(req, res, row) {
    const b = hydrateSite(row).sections.booking;
    if (!b.enabled) return res.status(404).json({ slots: [] });
    const date = String(req.query.date || '');
    const choice = resolveBookingChoice(b, String(req.query.service || ''), String(req.query.addons || '').split('|').filter(Boolean));
    if (!choice || !booking.DATE_RE.test(date)) return res.json({ slots: [] });
    const slots = booking.slotsFor(b, date, choice.minutes, liveBookingsOn(row.id, date));
    res.json({ date, minutes: choice.minutes, slots: slots.map(t => ({ time: t, label: booking.prettyTime(t) })) });
  }
  function bookingSummaryText(bk, b) {
    const details = JSON.parse(bk.details || '[]');
    const addons = JSON.parse(bk.addons || '[]');
    return [
      `${bk.name} — ${bk.service}${addons.length ? ' + ' + addons.join(', ') : ''}`,
      `When: ${booking.prettyDate(bk.start_at.slice(0, 10))} at ${booking.prettyTime(bk.start_at.slice(11, 16))} (about ${bk.duration} min)`,
      `Email: ${bk.email}`, bk.phone ? `Phone: ${bk.phone}` : null, bk.address ? `Address: ${bk.address}` : null,
      ...details.filter(d => d.value).map(d => `${d.label}: ${d.value}`),
      bk.notes ? `Notes: ${bk.notes}` : null
    ].filter(Boolean).join('\n');
  }
  function ownerEmailFor(site) {
    const c = site.sections.contact;
    return (c.notifyEmail && isValidEmail(c.notifyEmail)) ? c.notifyEmail : c.email;
  }
  function bookingStatusLink(req, row, bk) {
    const base = row.custom_domain ? `https://${row.custom_domain}/book` : `${req.protocol}://${req.get('host')}/site/${row.slug}/book`;
    return `${base}?t=${bk.token}`;
  }
  // background, best-effort emails for a booking event
  function emailBooking(req, row, bk, event, extraMessage) {
    if (!mailer.isConfigured()) return;
    try {
      const site = hydrateSite(row);
      const b = site.sections.booking;
      const ownerTo = ownerEmailFor(site);
      const summary = bookingSummaryText(bk, b);
      const log = (err) => console.error('Booking email failed:', err.message);
      const base = `${req.protocol}://${req.get('host')}`;
      if (event === 'created' || event === 'cancelled-by-customer') {
        if (ownerTo) mailer.sendBookingAlert({
          to: ownerTo, siteName: row.name, replyTo: bk.email, needsAction: event === 'created' && bk.status === 'pending',
          summary: (event === 'cancelled-by-customer' ? 'A customer cancelled this booking:\n\n' : '') + summary,
          bookingsUrl: `${base}/sites/${row.id}/bookings`
        }).catch(log);
      }
      const link = bookingStatusLink(req, row, bk);
      const when = `${booking.prettyDate(bk.start_at.slice(0, 10))} at ${booking.prettyTime(bk.start_at.slice(11, 16))}`;
      const replyTo = ownerTo || undefined;
      const note = [extraMessage, event === 'confirmed' || (event === 'created' && bk.status === 'confirmed') ? b.confirmNote : ''].filter(Boolean).join('\n\n');
      let subject, text;
      if (event === 'created' && bk.status === 'confirmed') { subject = 'Your appointment is confirmed'; text = `Hi ${bk.name},\n\nYour appointment is confirmed for ${when}.\n\n${summary}\n\n${note ? note + '\n\n' : ''}View or cancel your booking: ${link}`; }
      else if (event === 'created') { subject = 'We received your booking request'; text = `Hi ${bk.name},\n\nThanks! We received your request for ${when}. It is not confirmed yet; we will email you once we have reviewed it.\n\n${summary}\n\nCheck its status or cancel: ${link}`; }
      else if (event === 'confirmed') { subject = 'Your appointment is confirmed'; text = `Hi ${bk.name},\n\nGood news: your appointment is confirmed for ${when}.\n\n${summary}\n\n${note ? note + '\n\n' : ''}View or cancel your booking: ${link}`; }
      else if (event === 'declined') { subject = 'About your booking request'; text = `Hi ${bk.name},\n\nUnfortunately we are not able to take your request for ${when}.${extraMessage ? '\n\n' + extraMessage : ''}\n\nYou are welcome to choose another time: ${link.split('?')[0]}`; }
      else if (event === 'cancelled') { subject = 'Your appointment was cancelled'; text = `Hi ${bk.name},\n\nYour appointment for ${when} has been cancelled.${extraMessage ? '\n\n' + extraMessage : ''}\n\nYou can book another time here: ${link.split('?')[0]}`; }
      if (subject && bk.email) mailer.sendBookingCustomer({ to: bk.email, siteName: row.name, subject, text, replyTo }).catch(log);
    } catch (err) { console.error('Booking email failed:', err.message); }
  }

  function createBooking(req, res, row, basePath) {
    const site = hydrateSite(row);
    const b = site.sections.booking;
    if (!b.enabled) return res.status(404).render('not-found');
    const body = req.body || {};
    if (body.website) return res.redirect(`${basePath}/book?done=1`); // honeypot
    const values = { name: str(body.name, 100), email: str(body.email, 254), phone: str(body.phone, 40), address: str(body.address, 200), notes: str(body.notes, 1000), service: str(body.service, 80), date: str(body.date, 10), time: str(body.time, 5), addon: ([]).concat(body.addon || []).map(a => str(a, 80)), fields: {} };
    b.fields.forEach((f, i) => { values.fields[i] = str(body['f_' + i], 500); });
    const fail = (code, field) => renderSitePage(req, res.status(422), null, {
      site, page: 'book', basePath, preview: false, cacheKey: null,
      bookingView: { mode: 'form', error: BOOKING_ERRORS[code], errorCode: code, field: field || '', values }
    });
    if (values.name.length < 2) return fail('name', 'name');
    if (!isValidEmail(values.email)) return fail('email', 'email');
    const choice = resolveBookingChoice(b, values.service, values.addon);
    if (!choice) return fail('service');
    if (b.askAddress && values.address.length < 5) return fail('address', 'address');
    if (!booking.DATE_RE.test(values.date) || !booking.TIME_RE.test(values.time)) return fail('slot');
    const details = [];
    for (let i = 0; i < b.fields.length; i++) {
      const f = b.fields[i];
      let v = values.fields[i] || '';
      if (f.type === 'select' && v && !f.options.includes(v)) v = '';
      if (f.required && !v) return fail('required', 'f_' + i);
      details.push({ label: f.label, value: v });
    }
    const token = nanoid(24);
    const startAt = `${values.date} ${values.time}`;
    // a deposit holds the time for 30 minutes; the booking is only confirmed or sent to the owner once it is paid
    const payCfg = site.sections.payments || {};
    const priceCents = payments.toCents(choice.service.price) + choice.addons.reduce((n, a) => n + payments.toCents(a.price), 0);
    const depCents = payReady(row, site) ? payments.depositCents(payCfg, priceCents) : 0;
    const status = depCents ? 'awaiting_payment' : (b.autoConfirm ? 'confirmed' : 'pending');
    const insert = db.transaction(() => {
      const ok = booking.slotsFor(b, values.date, choice.minutes, liveBookingsOn(row.id, values.date)).includes(values.time);
      if (!ok) return false;
      db.prepare(`INSERT INTO bookings (site_id, token, service, addons, start_at, duration, name, email, phone, address, details, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(row.id, token, choice.service.name, JSON.stringify(choice.addons.map(a => a.name)), startAt, choice.minutes,
        values.name, values.email, values.phone, b.askAddress ? values.address : '', JSON.stringify(details), values.notes, status);
      return true;
    });
    if (!insert()) return fail('taken');
    const bk = db.prepare('SELECT * FROM bookings WHERE token = ?').get(token);
    if (depCents) {
      const pay = newPayment(row, { kind: 'deposit', refId: bk.id, description: `Deposit: ${choice.service.name} on ${booking.prettyDate(values.date)}`, amountCents: depCents, name: values.name, email: values.email, currency: payCfg.currency });
      return startCheckout(req, row, pay).then(
        (url) => res.redirect(url),
        (err) => { console.error('Deposit checkout failed:', err.message); res.redirect(`${payBase(req, row)}/pay/${pay.token}?error=1`); }
      );
    }
    emailBooking(req, row, bk, 'created');
    res.redirect(`${basePath}/book?t=${token}&new=1`);
  }

  function cancelBookingByCustomer(req, res, row, basePath) {
    const token = str((req.body || {}).token, 60);
    const bk = token && db.prepare('SELECT * FROM bookings WHERE token = ? AND site_id = ?').get(token, row.id);
    if (bk && BOOKING_LIVE.includes(bk.status)) {
      db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").run(bk.id);
      emailBooking(req, row, { ...bk, status: 'cancelled' }, 'cancelled-by-customer');
    }
    res.redirect(`${basePath}/book?t=${encodeURIComponent(token)}`);
  }

  // One entry point for /book, /book/slots and /book/cancel, used by the slug
  // routes and by the custom-domain middleware.
  function bookingRoute(req, res, next, row, basePath, sub) {
    if (!row || !row.published) return res.status(404).render('not-found');
    if (billing.isSuspended(row)) return res.status(503).render('suspended', { name: row.name });
    if (sub === 'slots' && req.method === 'GET') return bookingSlotsResponse(req, res, row);
    if (sub === 'cancel' && req.method === 'POST') return bookingLimiter(req, res, () => cancelBookingByCustomer(req, res, row, basePath));
    if (!sub && req.method === 'POST') return bookingLimiter(req, res, () => createBooking(req, res, row, basePath));
    if (sub || req.method !== 'GET') return res.status(404).render('not-found');
    const site = hydrateSite(row);
    let view = { mode: 'form', values: {} };
    const t = str(req.query.t, 60);
    if (t) {
      const bk = db.prepare('SELECT * FROM bookings WHERE token = ? AND site_id = ?').get(t, row.id);
      if (bk) {
        const dep = db.prepare("SELECT token, status, amount_cents, currency FROM payments WHERE kind = 'deposit' AND ref_id = ? AND site_id = ? ORDER BY id DESC").get(bk.id, row.id);
        view = { mode: 'status', booking: bk, isNew: req.query.new === '1', details: JSON.parse(bk.details || '[]'), addons: JSON.parse(bk.addons || '[]'),
          payToken: dep && dep.status === 'pending' ? dep.token : '', depositPaid: dep && dep.status === 'paid' ? payments.money(dep.amount_cents, dep.currency) : '' };
      }
    } else if (req.query.done === '1') view = { mode: 'done' };
    renderSitePage(req, res, next, { site, page: 'book', basePath, preview: false, cacheKey: null, bookingView: view });
  }
  app.all(['/site/:slug/book', '/site/:slug/book/:sub'], (req, res, next) => {
    const row = db.prepare('SELECT * FROM sites WHERE slug = ?').get(req.params.slug);
    bookingRoute(req, res, next, row, `/site/${req.params.slug}`, req.params.sub);
  });
  // the editor's preview can look up open times too (it is read-only: nothing can be submitted there)
  app.get('/sites/:id/preview/book/slots', requireAuth, loadOwnedSite, (req, res) => bookingSlotsResponse(req, res, db.prepare('SELECT * FROM sites WHERE id = ?').get(req.site.id)));

  // ---- members area: visitors sign up / log in and see members-only pages ----
  const memberLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, skip: () => isTestEnv,
    message: 'Too many attempts. Please wait a few minutes and try again.'
  });
  function currentMember(req, row) {
    const id = req.session && req.session.members && req.session.members[row.id];
    if (!id) return null;
    const m = db.prepare('SELECT * FROM site_members WHERE id = ? AND site_id = ?').get(id, row.id);
    return m && m.status === 'active' ? m : null;     // a disabled or removed member loses access at once
  }
  function memberLogin(req, row, m) {
    req.session.members = { ...(req.session.members || {}), [row.id]: m.id };
    db.prepare("UPDATE site_members SET last_login_at = datetime('now') WHERE id = ?").run(m.id);
  }
  const MEMBER_MSGS = { welcome: 'Welcome! Your account is ready.', pending: 'Thanks for signing up. Your account will be ready once the site owner approves it.', bye: 'You have been logged out.', reset: 'Your password was changed. Log in with the new one.', sent: 'If that email has an account, a link to choose a new password is on its way. If it does not arrive, ask the site owner for help.' };
  function membersRoute(req, res, next, row, basePath, sub) {
    res.set({ 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    if (!row || !row.published) return res.status(404).render('not-found');
    if (billing.isSuspended(row)) return res.status(503).render('suspended', { name: row.name });
    const site = hydrateSite(row);
    const cfg = membersLib.clean(site.sections.members);
    if (!cfg.enabled) return res.status(404).render('not-found');
    const home = `${basePath}/members`;
    const show = (view) => renderSitePage(req, res, next, { site, page: 'members', basePath, preview: false, cacheKey: null, memberView: { cfg, ...view } });
    const body = req.body || {};
    const run = (fn) => memberLimiter(req, res, fn);

    if (req.method === 'GET' && !sub) {
      const m = currentMember(req, row);
      const msg = MEMBER_MSGS[str(req.query.msg, 12)] ? str(req.query.msg, 12) : '';
      if (m) return show({ mode: 'area', member: { name: m.name, email: m.email }, notice: msg ? MEMBER_MSGS[msg] : '' });
      return show({ mode: 'login', error: '', email: '', tab: req.query.tab === 'signup' && cfg.signup !== 'invite' ? 'signup' : 'login', notice: msg ? MEMBER_MSGS[msg] : '' });
    }
    if (req.method === 'POST' && sub === 'logout') {
      if (req.session.members) { const o = { ...req.session.members }; delete o[row.id]; req.session.members = o; }
      return res.redirect(`${home}?msg=bye`);
    }
    if (req.method === 'POST' && sub === 'login') return run(() => {
      const email = membersLib.normEmail(body.email), pw = String(body.password || '');
      const m = email ? db.prepare('SELECT * FROM site_members WHERE site_id = ? AND email = ?').get(row.id, email) : null;
      const ok = bcrypt.compareSync(pw.slice(0, 200), m && m.password_hash ? m.password_hash : membersLib.dummyHash()) && m && m.password_hash;
      if (!ok) return show({ mode: 'login', error: 'Incorrect email or password.', email, tab: 'login' });
      if (m.status === 'pending') return show({ mode: 'login', error: 'Your account is waiting for the site owner to approve it.', email, tab: 'login' });
      if (m.status !== 'active') return show({ mode: 'login', error: 'This account is not active. Please contact the site owner.', email, tab: 'login' });
      memberLogin(req, row, m);
      res.redirect(home);
    });
    if (req.method === 'POST' && sub === 'signup') return run(() => {
      if (cfg.signup === 'invite') return res.status(404).render('not-found');
      if (str(body.website, 100)) return res.redirect(`${home}?msg=pending`);        // honeypot: looks fine, saves nothing
      const email = membersLib.normEmail(body.email), name = str(body.name, 80);
      const fail = (error) => show({ mode: 'login', error, email, name, tab: 'signup' });
      if (!name) return fail('Please enter your name.');
      if (!membersLib.okEmail(email)) return fail('Please enter a valid email address.');
      const pwErr = membersLib.passwordProblem(body.password); if (pwErr) return fail(pwErr);
      if (String(body.password) !== String(body.password2 || '')) return fail('The two passwords do not match.');
      if (db.prepare('SELECT 1 FROM site_members WHERE site_id = ? AND email = ?').get(row.id, email)) return fail('There is already an account with that email. Try logging in, or use "Forgot your password?".');
      const total = db.prepare('SELECT COUNT(*) n FROM site_members WHERE site_id = ?').get(row.id).n;
      if (total >= 5000) return fail('Sign-ups are closed right now. Please contact the site owner.');
      const status = cfg.signup === 'open' ? 'active' : 'pending';
      const info = db.prepare('INSERT INTO site_members (site_id, email, name, password_hash, status) VALUES (?, ?, ?, ?, ?)').run(row.id, email, name, bcrypt.hashSync(String(body.password), 10), status);
      const to = hostingNotifyEmail(site);
      if (to) mailer.sendBookingCustomer({ to, siteName: row.name, subject: status === 'pending' ? 'New member waiting for approval' : 'New member signed up', text: `${name} (${email}) signed up for the members area.${status === 'pending' ? `\n\nApprove or remove them here: ${req.protocol}://${req.get('host')}/sites/${row.id}/members` : ''}` }).catch(() => {});
      if (status === 'active') { memberLogin(req, row, { id: info.lastInsertRowid }); return res.redirect(`${home}?msg=welcome`); }
      return res.redirect(`${home}?msg=pending`);
    });
    if (req.method === 'POST' && sub === 'forgot') return run(() => {
      const email = membersLib.normEmail(body.email);
      const m = email ? db.prepare("SELECT * FROM site_members WHERE site_id = ? AND email = ? AND password_hash != ''").get(row.id, email) : null;
      if (m && m.status !== 'disabled' && mailer.isConfigured()) {
        const t = membersLib.newToken();
        db.prepare("UPDATE site_members SET reset_hash = ?, reset_expires = datetime('now', '+1 hour') WHERE id = ?").run(membersLib.hashToken(t), m.id);
        mailer.sendBookingCustomer({ to: m.email, siteName: row.name, subject: 'Choose a new password', text: `Use this link within one hour to choose a new password:\n${req.protocol}://${req.get('host')}${home}/reset?t=${t}\n\nIf you did not ask for this, you can ignore this email.` }).catch(() => {});
      }
      res.redirect(`${home}?msg=sent`);                   // same answer whether or not the email has an account
    });
    if (sub === 'reset' && (req.method === 'GET' || req.method === 'POST')) {
      const t = str(req.query.t || body.t, 80);
      const m = /^[a-f0-9]{48}$/.test(t) ? db.prepare("SELECT * FROM site_members WHERE site_id = ? AND reset_hash = ? AND reset_expires > datetime('now') AND status != 'disabled'").get(row.id, membersLib.hashToken(t)) : null;
      if (!m) return show({ mode: 'reset-bad' });
      if (req.method === 'GET') return show({ mode: 'reset', token: t, error: '' });
      return run(() => {
        const err = membersLib.passwordProblem(body.password) || (String(body.password) !== String(body.password2 || '') ? 'The two passwords do not match.' : '');
        if (err) return show({ mode: 'reset', token: t, error: err });
        db.prepare("UPDATE site_members SET password_hash = ?, reset_hash = '', reset_expires = '' WHERE id = ?").run(bcrypt.hashSync(String(body.password), 10), m.id);
        res.redirect(`${home}?msg=reset`);
      });
    }
    return res.status(404).render('not-found');
  }
  app.all(['/site/:slug/members', '/site/:slug/members/:sub'], (req, res, next) => {
    membersRoute(req, res, next, db.prepare('SELECT * FROM sites WHERE slug = ?').get(req.params.slug), `/site/${req.params.slug}`, req.params.sub);
  });

  // owner side: see, approve, add, disable and remove members
  app.get('/sites/:id/members', requireAuth, loadOwnedSite, (req, res) => {
    const link = req.session.memberResetLink; delete req.session.memberResetLink;
    const rows = db.prepare('SELECT id, email, name, status, created_at, last_login_at FROM site_members WHERE site_id = ? ORDER BY (status = \'pending\') DESC, id DESC').all(req.site.id);
    res.render('members-admin', { site: req.site, rows, cfg: membersLib.clean(req.site.sections.members), link: link || null, flash: str(req.query.f, 12), err: str(req.query.err, 160), mailOn: mailer.isConfigured() });
  });
  function loadMember(req, res, next) {
    const m = /^\d+$/.test(req.params.mid) ? db.prepare('SELECT * FROM site_members WHERE id = ? AND site_id = ?').get(req.params.mid, req.site.id) : null;
    if (!m) return res.status(404).render('not-found');
    req.member = m; next();
  }
  app.post('/sites/:id/members/add', requireAuth, loadOwnedSite, (req, res) => {
    const b = req.body || {}, back = (q) => res.redirect(`/sites/${req.site.id}/members?${q}`);
    const email = membersLib.normEmail(b.email), name = str(b.name, 80);
    if (!membersLib.okEmail(email)) return back('err=' + encodeURIComponent('That does not look like an email address.'));
    const pwErr = membersLib.passwordProblem(b.password); if (pwErr) return back('err=' + encodeURIComponent(pwErr));
    if (db.prepare('SELECT 1 FROM site_members WHERE site_id = ? AND email = ?').get(req.site.id, email)) return back('err=' + encodeURIComponent('That email already has an account.'));
    db.prepare("INSERT INTO site_members (site_id, email, name, password_hash, status) VALUES (?, ?, ?, ?, 'active')").run(req.site.id, email, name, bcrypt.hashSync(String(b.password), 10));
    back('f=added');
  });
  for (const [action, status] of [['approve', 'active'], ['enable', 'active'], ['disable', 'disabled']]) {
    app.post(`/sites/:id/members/:mid/${action}`, requireAuth, loadOwnedSite, loadMember, (req, res) => {
      db.prepare('UPDATE site_members SET status = ? WHERE id = ?').run(status, req.member.id);
      res.redirect(`/sites/${req.site.id}/members?f=${action}`);
    });
  }
  app.post('/sites/:id/members/:mid/delete', requireAuth, loadOwnedSite, loadMember, (req, res) => {
    db.prepare('DELETE FROM site_members WHERE id = ?').run(req.member.id);
    res.redirect(`/sites/${req.site.id}/members?f=deleted`);
  });
  // a one-hour link the owner can pass on when email is not set up (shown once)
  app.post('/sites/:id/members/:mid/reset-link', requireAuth, loadOwnedSite, loadMember, (req, res) => {
    const t = membersLib.newToken();
    db.prepare("UPDATE site_members SET reset_hash = ?, reset_expires = datetime('now', '+1 hour') WHERE id = ?").run(membersLib.hashToken(t), req.member.id);
    const base = req.site.custom_domain ? `${req.protocol}://${req.site.custom_domain}` : `${req.protocol}://${req.get('host')}/site/${req.site.slug}`;
    req.session.memberResetLink = { email: req.member.email, url: `${base}/members/reset?t=${t}` };
    res.redirect(`/sites/${req.site.id}/members?f=link`);
  });

  return { BOOKING_LIVE, bookingRoute, emailBooking, markPaid, membersRoute, newPayment, ownerEmailFor, payBase, payLimiter, payReady, refreshPayment, runPaymentSweep, startCheckout };
};
