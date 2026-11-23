// Prospect finder (prospects.js): /prospects lists local businesses found on OpenStreetMap, checks their own websites,
// makes a demo (the existing "generate" or "modernize an old website" routes, linked back with prospect_id) and keeps
// a short status per business. Emails are drafts to copy; nothing is sent from here.
const prospects = require('../prospects');
const { safeFetch } = require('../scraper');

module.exports = function (app, deps) {
  const { db, requireAuth, rateLimit, isTestEnv, str } = deps;
  // the map search runs on OpenStreetMap's free servers: a few searches a minute is plenty
  const findLimiter = rateLimit({ windowMs: 60 * 1000, limit: 4, standardHeaders: true, legacyHeaders: false, skip: () => isTestEnv, handler: (req, res) => res.redirect('/prospects?err=' + encodeURIComponent('Too many searches at once. Wait a minute and try again.')) });
  // tests point this at a stand-in server (PROSPECTS_FETCH_BASE)
  const mapFetch = (url, init) => {
    const base = isTestEnv && process.env.PROSPECTS_FETCH_BASE;
    return fetch(base ? base + '?u=' + encodeURIComponent(url) : url, init);
  };
  const siteFetch = async (url) => {
    const base = isTestEnv && process.env.PROSPECTS_FETCH_BASE;
    if (base) { const r = await fetch(base + '?u=' + encodeURIComponent(url)); return { response: r, finalUrl: r.headers.get('x-final-url') || url }; }
    return safeFetch(url, { timeoutMs: 12000 });
  };
  const shareLink = (req, siteId) => {
    const r = siteId ? db.prepare('SELECT token FROM share_links WHERE site_id = ?').get(siteId) : null;
    return r ? `${req.protocol}://${req.get('host')}/look/${r.token}` : '';
  };

  app.get('/prospects', requireAuth, (req, res) => {
    const f = { niche: prospects.niche(req.query.niche) ? req.query.niche : '', status: prospects.STATUSES.some(s => s[0] === req.query.status) ? req.query.status : '', web: ['none', 'has'].includes(req.query.web) ? req.query.web : '', q: str(req.query.q, 60) };
    const rows = prospects.list(db, req.session.userId, f);
    const sites = new Map(db.prepare('SELECT id, name FROM sites WHERE user_id = ?').all(req.session.userId).map(s => [s.id, s.name]));
    res.render('prospects', {
      niches: prospects.NICHES, statuses: prospects.STATUSES, f, rows: rows.map(r => ({ ...r, siteName: r.site_id ? sites.get(r.site_id) || '' : '' })),
      total: db.prepare('SELECT COUNT(*) n FROM prospects WHERE user_id = ?').get(req.session.userId).n,
      added: /^\d+$/.test(String(req.query.added || '')) ? +req.query.added : -1, found: /^\d+$/.test(String(req.query.found || '')) ? +req.query.found : -1,
      err: str(req.query.err, 300), lastPlace: str(req.query.place, 120)
    });
  });

  app.post('/prospects/find', requireAuth, findLimiter, async (req, res) => {
    const b = req.body || {};
    const place = str(b.place, 120), nicheId = String(b.niche || '');
    try {
      const r = await prospects.find(place, nicheId, { fetchFn: mapFetch });
      const added = prospects.saveFound(db, req.session.userId, r.place, r.list);
      res.redirect(`/prospects?niche=${encodeURIComponent(nicheId)}&found=${r.list.length}&added=${added}&place=${encodeURIComponent(place)}`);
    } catch (e) {
      res.redirect('/prospects?err=' + encodeURIComponent(e.message || 'The search did not work.') + '&place=' + encodeURIComponent(place));
    }
  });

  const back = (req, p) => res => res.redirect(`/prospects?${new URLSearchParams(Object.fromEntries(Object.entries({ niche: req.body.f_niche || '', status: req.body.f_status || '', web: req.body.f_web || '', q: req.body.f_q || '' }).filter(([, v]) => v))).toString()}#p-${p.id}`);

  app.post('/prospects/:id/check', requireAuth, async (req, res) => {
    req.body = req.body || {};
    const p = prospects.get(db, req.session.userId, req.params.id);
    if (!p) return res.redirect('/prospects');
    const r = await prospects.checkSite(p.website, { fetchFn: siteFetch });
    prospects.update(db, req.session.userId, p.id, { reasons: r.reasons.join('\n') || 'Looks up to date', checked: 1 });
    back(req, p)(res);
  });

  app.post('/prospects/:id/status', requireAuth, (req, res) => {
    req.body = req.body || {};
    const p = prospects.get(db, req.session.userId, req.params.id);
    if (!p) return res.redirect('/prospects');
    const patch = {};
    if (prospects.STATUSES.some(s => s[0] === req.body.status)) patch.status = req.body.status;
    if (req.body.note !== undefined) patch.note = str(req.body.note, 500);
    prospects.update(db, req.session.userId, p.id, patch);
    back(req, p)(res);
  });

  app.get('/prospects/:id/email', requireAuth, (req, res) => {
    const p = prospects.get(db, req.session.userId, req.params.id);
    if (!p) return res.status(404).render('not-found');
    const reasons = p.reasons && p.reasons !== 'Looks up to date' ? p.reasons.split('\n').filter(r => r && r !== 'No website listed') : [];
    const text = prospects.pitch(p, { link: shareLink(req, p.site_id), reasons });
    res.render('prospect-email', { p, text, hasLink: !!shareLink(req, p.site_id) });
  });
};
