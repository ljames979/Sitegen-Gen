// Nightly check of live sites (Leo, 2026-11-23): once a day SiteGen opens every client site that is online at its own
// address (Netlify or the client's domain) the way a visitor would, and emails Leo one message if anything is wrong:
//   down        the home page does not open, or answers with an error
//   https       the secure (https) address does not open, so browsers warn visitors
//   suspended   the site shows the "temporarily unavailable" page (hosting not paid)
//   photos      pictures or style files on the home page that do not load
//   pages       links to the site's own pages that answer "not found"
//   hosting     the hosting subscription is overdue
// Results are kept per site (site_watch) so the All clients board can show them. Nothing on the site is changed.
'use strict';

const cheerio = require('cheerio');

const MAX_ASSETS = 16, MAX_PAGES = 12;
const DAY_MS = 24 * 60 * 60 * 1000;

function ensureTable(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS site_watch (
    site_id INTEGER PRIMARY KEY,
    url TEXT NOT NULL DEFAULT '',
    checked_at TEXT NOT NULL DEFAULT '',
    ok INTEGER NOT NULL DEFAULT 1,
    problems TEXT NOT NULL DEFAULT '[]',
    FOREIGN KEY (site_id) REFERENCES sites(id)
  )`);
}

// the address a visitor uses: the client's domain or the Netlify address (not SiteGen's own /site/ pages, which are
// only as online as the computer SiteGen runs on)
function liveAddress(site) {
  if (site.netlify_domain) return (site.netlify_ssl ? 'https://' : 'http://') + site.netlify_domain + '/';
  if (site.netlify_url) return String(site.netlify_url).replace(/\/?$/, '/');
  if (site.custom_domain && site.published) return 'https://' + site.custom_domain + '/';
  return '';
}

const short = (u, base) => { try { const x = new URL(u, base); return x.pathname + (x.search || ''); } catch { return String(u).slice(0, 80); } };

// fetchFn(url) -> { status, text() } (it follows redirects; throws when the address cannot be reached)
async function checkSite(site, { fetchFn }) {
  const problems = [];
  const url = liveAddress(site);
  if (!url) return { url: '', problems };
  if (site.billing_status === 'past_due') problems.push({ kind: 'hosting', text: 'Hosting payment is overdue' });
  let res, html = '';
  try { res = await fetchFn(url); html = res.status < 400 ? await res.text() : ''; } catch (e) {
    // a broken secure address: try plain http to tell "down" from "certificate problem"
    if (url.startsWith('https://')) {
      try { const r2 = await fetchFn('http://' + url.slice(8)); if (r2.status < 400) { problems.push({ kind: 'https', text: 'The secure (https) address does not open, so browsers warn visitors' }); return { url, problems }; } } catch { /* down */ }
    }
    problems.push({ kind: 'down', text: `The site does not open (${String(e.message || 'no answer').slice(0, 80)})` });
    return { url, problems };
  }
  if (res.status >= 400) { problems.push({ kind: 'down', text: `The site answers with an error (${res.status})` }); return { url, problems }; }
  if (/temporarily unavailable|site is suspended/i.test(html) && !/<nav/i.test(html)) problems.push({ kind: 'suspended', text: 'The site shows the "temporarily unavailable" page' });
  const $ = cheerio.load(html);
  const origin = new URL(url).origin;
  const same = (u) => { try { const x = new URL(u, url); return x.origin === origin ? x.href : ''; } catch { return ''; } };
  const assets = [...new Set([
    ...$('img[src]').toArray().map(e => $(e).attr('src')),
    ...$('link[rel="stylesheet"][href]').toArray().map(e => $(e).attr('href')),
    ...$('script[src]').toArray().map(e => $(e).attr('src'))
  ].filter(u => u && !/^data:/i.test(u)).map(same).filter(Boolean))].slice(0, MAX_ASSETS);
  const pages = [...new Set($('a[href]').toArray().map(e => $(e).attr('href'))
    .filter(h => h && !/^(#|mailto:|tel:|javascript:)/i.test(h)).map(same).filter(Boolean)
    .map(h => h.split('#')[0]).filter(h => h !== url && h !== url.replace(/\/$/, '')))].slice(0, MAX_PAGES);
  const bad = async (list) => {
    const out = [];
    for (const u of list) { try { const r = await fetchFn(u); if (r.status >= 400) out.push(short(u, url)); } catch { out.push(short(u, url)); } }
    return out;
  };
  const badAssets = await bad(assets);
  if (badAssets.length) problems.push({ kind: 'photos', text: `${badAssets.length} picture or style file${badAssets.length === 1 ? '' : 's'} do not load (${badAssets.slice(0, 3).join(', ')}${badAssets.length > 3 ? '…' : ''})` });
  const badPages = await bad(pages);
  if (badPages.length) problems.push({ kind: 'pages', text: `${badPages.length} page link${badPages.length === 1 ? '' : 's'} answer "not found" (${badPages.slice(0, 3).join(', ')}${badPages.length > 3 ? '…' : ''})` });
  return { url, problems };
}

function save(db, siteId, url, problems) {
  ensureTable(db);
  db.prepare(`INSERT INTO site_watch (site_id, url, checked_at, ok, problems) VALUES (?, ?, datetime('now'), ?, ?)
    ON CONFLICT(site_id) DO UPDATE SET url = excluded.url, checked_at = excluded.checked_at, ok = excluded.ok, problems = excluded.problems`)
    .run(siteId, url, problems.length ? 0 : 1, JSON.stringify(problems));
}

function results(db, userId) {
  ensureTable(db);
  return db.prepare('SELECT w.*, s.name FROM site_watch w JOIN sites s ON s.id = w.site_id WHERE s.user_id = ? ORDER BY w.ok, s.name').all(userId)
    .map(r => { let p = []; try { p = JSON.parse(r.problems); } catch { /* */ } return { ...r, problems: p }; });
}

// checks every live site (of one owner, or everyone's) and emails each owner one message listing the problems
async function runAll(db, { fetchFn, mailer, userId = null, email = true, host = '' }) {
  ensureTable(db);
  const sites = db.prepare(`SELECT id, user_id, name, slug, published, custom_domain, netlify_url, netlify_domain, netlify_ssl, billing_status
    FROM sites WHERE (netlify_url != '' OR netlify_domain != '' OR (custom_domain IS NOT NULL AND custom_domain != '' AND published = 1))${userId ? ' AND user_id = ?' : ''}`).all(...(userId ? [userId] : []));
  const byOwner = new Map();
  let checked = 0;
  for (const s of sites) {
    const r = await checkSite(s, { fetchFn });
    if (!r.url) continue;
    checked++;
    save(db, s.id, r.url, r.problems);
    if (r.problems.length) { if (!byOwner.has(s.user_id)) byOwner.set(s.user_id, []); byOwner.get(s.user_id).push({ site: s, ...r }); }
  }
  let emailed = 0;
  if (email && mailer && mailer.isConfigured()) {
    for (const [uid, list] of byOwner) {
      const owner = db.prepare('SELECT email FROM users WHERE id = ?').get(uid);
      if (!owner) continue;
      const text = `The nightly check found ${list.length === 1 ? 'a problem on 1 live site' : `problems on ${list.length} live sites`}:\n\n` +
        list.map(x => `${x.site.name} (${x.url})\n${x.problems.map(p => '- ' + p.text).join('\n')}`).join('\n\n') +
        `\n\n${host ? `See them all: ${host}/board\n\n` : ''}The check runs once a day. Nothing on the sites was changed.\n`;
      try { await mailer.sendReport({ to: owner.email, subject: `Live site check: ${list.length} site${list.length === 1 ? '' : 's'} need${list.length === 1 ? 's' : ''} a look`, text }); emailed++; } catch (e) { console.error('Site check email failed:', e.message); }
    }
  }
  return { checked, withProblems: [...byOwner.values()].reduce((a, l) => a + l.length, 0), emailed };
}

// true when the last full check is more than ~a day old (the hourly timer asks this)
function due(db) {
  ensureTable(db);
  const r = db.prepare('SELECT MAX(checked_at) AS t FROM site_watch').get();
  if (!r || !r.t) return true;
  return Date.now() - Date.parse(r.t.replace(' ', 'T') + 'Z') > DAY_MS - 60 * 60 * 1000;
}

module.exports = { ensureTable, liveAddress, checkSite, runAll, results, save, due };
