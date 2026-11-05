// Per-site activity reports: page views (counted without cookies or personal
// data), leads, and new reviews over a date range. Pure functions of the
// database, shared by the report page and the monthly email.

const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|curl|wget|headless|monitor|uptime|lighthouse/i;

function isBot(userAgent) {
  return !userAgent || BOT_RE.test(userAgent);
}

function recordView(db, siteId, pathKey) {
  db.prepare(
    `INSERT INTO page_views (site_id, day, path, views) VALUES (?, date('now'), ?, 1)
     ON CONFLICT(site_id, day, path) DO UPDATE SET views = views + 1`
  ).run(siteId, String(pathKey).slice(0, 120));
}

const ymd = (d) => d.toISOString().slice(0, 10);

function rangeForDays(days, today = new Date()) {
  const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const from = new Date(to.getTime() - (days - 1) * 86400000);
  return { from: ymd(from), to: ymd(to) };
}

// previous calendar month, e.g. on 2026-11-03 -> 2026-10-01..2026-10-31
function previousMonth(today = new Date()) {
  const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const last = new Date(first.getTime() - 86400000);
  const start = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), 1));
  return { from: ymd(start), to: ymd(last), period: ymd(start).slice(0, 7), label: start.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) };
}

function buildReport(db, siteId, { from, to }) {
  const viewRows = db.prepare('SELECT day, SUM(views) AS v FROM page_views WHERE site_id = ? AND day BETWEEN ? AND ? GROUP BY day').all(siteId, from, to);
  const leadRows = db.prepare(
    'SELECT date(created_at) AS day, service, status FROM contact_submissions WHERE site_id = ? AND date(created_at) BETWEEN ? AND ?'
  ).all(siteId, from, to);
  const topPages = db.prepare(
    'SELECT path, SUM(views) AS v FROM page_views WHERE site_id = ? AND day BETWEEN ? AND ? GROUP BY path ORDER BY v DESC LIMIT 8'
  ).all(siteId, from, to);
  const reviewsApproved = db.prepare(
    "SELECT COUNT(*) AS n FROM review_submissions WHERE site_id = ? AND status = 'approved' AND date(created_at) BETWEEN ? AND ?"
  ).get(siteId, from, to).n;

  const events = { call: 0, email: 0, text: 0, cta: 0, directions: 0, social: 0 };
  for (const r of db.prepare('SELECT event, SUM(n) AS n FROM page_events WHERE site_id = ? AND day BETWEEN ? AND ? GROUP BY event').all(siteId, from, to)) {
    if (r.event in events) events[r.event] = r.n;
  }
  const bookings = db.prepare('SELECT COUNT(*) AS n FROM bookings WHERE site_id = ? AND date(created_at) BETWEEN ? AND ?').get(siteId, from, to).n;

  const viewsBy = new Map(viewRows.map(r => [r.day, r.v]));
  const leadsBy = new Map();
  for (const l of leadRows) leadsBy.set(l.day, (leadsBy.get(l.day) || 0) + 1);
  const days = [];
  for (let t = Date.parse(from + 'T00:00:00Z'); t <= Date.parse(to + 'T00:00:00Z'); t += 86400000) {
    const day = ymd(new Date(t));
    days.push({ day, views: viewsBy.get(day) || 0, leads: leadsBy.get(day) || 0 });
  }
  const byService = new Map();
  for (const l of leadRows) if (l.service) byService.set(l.service, (byService.get(l.service) || 0) + 1);

  return {
    from, to, days, topPages, events, bookings,
    byService: [...byService].map(([service, count]) => ({ service, count })).sort((a, b) => b.count - a.count),
    totals: {
      views: days.reduce((a, d) => a + d.views, 0),
      leads: leadRows.length,
      won: leadRows.filter(l => l.status === 'won').length,
      contacted: leadRows.filter(l => l.status === 'contacted' || l.status === 'won').length,
      reviews: reviewsApproved,
      // phone taps, email taps, text taps, form messages and bookings, as a share of page views
      actions: events.call + events.email + events.text + leadRows.length + bookings
    }
  };
}

// readable name for a stored page path
function pageLabel(site, pathKey) {
  if (pathKey === 'home') return 'Home';
  if (pathKey === 'thank-you') return 'Thank-you page (form submitted)';
  if (pathKey === 'review') return 'Review form';
  if (pathKey.startsWith('services/')) {
    const { servicesWithSlugs } = require('./local');
    const sv = servicesWithSlugs(site.sections.services.items).find(s => `services/${s.slug}` === pathKey);
    return sv ? `${sv.title} (service page)` : pathKey;
  }
  const item = pathKey.match(/^(areas|blog|p)\/(.+)$/);
  if (item) {
    const { servicesWithSlugs, areasWithSlugs } = require('./local');
    const t = site.sections.trust || {};
    const found = item[1] === 'areas' ? areasWithSlugs(t.serviceAreas, t.areaText).find(x => x.slug === item[2])
      : servicesWithSlugs(item[1] === 'blog' ? site.sections.blog.items : site.sections.extraPages.items.filter(i => i.title && i.body)).find(x => x.slug === item[2]);
    const name = found ? (found.name || found.title) : item[2];
    return item[1] === 'areas' ? `${name} (town page)` : item[1] === 'blog' ? `${name} (blog post)` : name;
  }
  const sec = site.sections[pathKey];
  return (sec && sec.heading) || pathKey;
}

function reportEmailText(site, report, label) {
  const t = report.totals;
  const lines = [
    `Website report for ${site.name} — ${label}`,
    '',
    `Page views:        ${t.views}`,
    `Messages / leads:  ${t.leads}`,
    `Marked as won:     ${t.won}`,
    `New reviews:       ${t.reviews}`
  ];
  const ev = report.events || {};
  if (ev.call || ev.email || ev.text || report.bookings) {
    lines.push('', 'What visitors did:');
    if (ev.call) lines.push(`  Tapped the phone number:  ${ev.call}`);
    if (ev.email) lines.push(`  Tapped the email address: ${ev.email}`);
    if (ev.text) lines.push(`  Tapped Text / WhatsApp:   ${ev.text}`);
    if (report.bookings) lines.push(`  Booking requests:         ${report.bookings}`);
  }
  if (report.byService.length) {
    lines.push('', 'Requests by service:');
    for (const s of report.byService) lines.push(`  ${s.service}: ${s.count}`);
  }
  if (report.topPages.length) {
    lines.push('', 'Most viewed pages:');
    for (const p of report.topPages.slice(0, 5)) lines.push(`  ${pageLabel(site, p.path)}: ${p.v}`);
  }
  lines.push('', 'Page views are counted without cookies and exclude most search-engine and monitoring bots.');
  return lines.join('\n');
}

module.exports = { isBot, recordView, rangeForDays, previousMonth, buildReport, pageLabel, reportEmailText };
