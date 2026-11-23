// All-clients board (Leo, 2026-11-23): one screen with every client and the step they are at, built from what SiteGen
// already records (questionnaire answers, the site, its preview link and the client's suggestions, the approval and
// deposit, the launch, the hosting subscription). Nothing new is stored. Pure helpers over a db handle.
'use strict';

const STAGES = [
  { id: 'answers', label: 'Answers in', hint: 'The client sent the questionnaire; no site yet.' },
  { id: 'draft', label: 'Draft', hint: 'Site made; the client has not been shown it.' },
  { id: 'shown', label: 'Shown to client', hint: 'Preview link made; waiting for their approval.' },
  { id: 'approved', label: 'Approved', hint: 'The client approved; deposit or launch to do.' },
  { id: 'live', label: 'Live', hint: 'Launched or published.' }
];

const n = (v) => Number(v) || 0;

// One site's card: its stage, short notes and the next step (label + link)
function card(r) {
  const notes = [];
  const id = r.id;
  const live = !!(r.launched_at || r.launch_state === 'live' || r.published || r.netlify_url);
  const approved = !!r.approved_at;
  const depositDue = approved && n(r.deposit_cents) > 0 && r.pay_status !== 'paid';
  const openFeedback = n(r.fb_open), newFeedback = n(r.fb_new);
  let stage, next;
  if (live) {
    stage = 'live';
    if (r.launch_state === 'waiting-dns') notes.push({ tone: 'warn', text: 'Waiting for the domain to point here' });
    if (r.launch_state === 'failed') notes.push({ tone: 'bad', text: 'Launch did not finish' });
    if (r.billing_required || (r.billing_status && r.billing_status !== 'none')) {
      const s = r.billing_status || 'none';
      if (s === 'active' || s === 'trialing') notes.push({ tone: 'good', text: 'Hosting paid' });
      else if (s === 'past_due') notes.push({ tone: 'bad', text: 'Hosting payment overdue' });
      else notes.push({ tone: 'warn', text: s === 'none' ? 'Hosting not set up yet' : `Hosting ${s.replace('_', ' ')}` });
    }
    next = r.launch_state === 'waiting-dns' || r.launch_state === 'failed' ? { label: 'Open Launch', href: `/sites/${id}/launch` }
      : (r.billing_status === 'past_due' || (r.billing_required && r.billing_status === 'none')) ? { label: 'Open Billing', href: `/sites/${id}/billing` }
        : { label: 'Leads', href: `/sites/${id}/leads` };
  } else if (approved) {
    stage = 'approved';
    if (depositDue) notes.push({ tone: r.pay_status === 'pending' ? 'warn' : 'warn', text: `Deposit ${r.pay_status === 'pending' ? 'started, not paid yet' : 'not paid yet'}` });
    else if (n(r.deposit_cents) > 0) notes.push({ tone: 'good', text: 'Deposit paid' });
    next = depositDue ? { label: 'Sell and launch', href: `/sites/${id}/launch` } : { label: 'Launch it', href: `/sites/${id}/launch` };
  } else if (r.share_token) {
    stage = 'shown';
    notes.push({ tone: '', text: n(r.share_views) ? `Viewed ${n(r.share_views)} time${n(r.share_views) === 1 ? '' : 's'}` : 'Not opened yet' });
    next = { label: 'Open', href: `/sites/${id}/edit` };
  } else {
    stage = 'draft';
    next = { label: 'Show the client', href: `/sites/${id}/edit` };
  }
  if (openFeedback) {
    notes.unshift({ tone: newFeedback ? 'bad' : 'warn', text: `${openFeedback} suggestion${openFeedback === 1 ? '' : 's'} to do${newFeedback ? ` (${newFeedback} new)` : ''}` });
    if (stage !== 'live') next = { label: 'Client suggestions', href: `/sites/${id}/feedback` };
  }
  if (r.package) notes.push({ tone: '', text: `Package: ${r.package}` });
  return { kind: 'site', id, name: r.name, stage, notes, next, updated: r.updated_at || '', from: r.sub_id ? 'questionnaire' : '' };
}

// sites Leo keeps off the board (his own sites, demos, tests): user_prefs.data.board.hidden
function prefs(db, userId) {
  try { const r = db.prepare('SELECT data FROM user_prefs WHERE user_id = ?').get(userId); const b = (JSON.parse((r && r.data) || '{}') || {}).board || {}; return { hidden: (Array.isArray(b.hidden) ? b.hidden : []).map(Number).filter(Number.isInteger).slice(0, 500) }; } catch { return { hidden: [] }; }
}
function setHidden(db, userId, siteId, hide) {
  const r = db.prepare('SELECT data FROM user_prefs WHERE user_id = ?').get(userId);
  let data = {}; try { data = JSON.parse((r && r.data) || '{}') || {}; } catch { data = {}; }
  const cur = new Set(prefs(db, userId).hidden);
  if (hide) cur.add(Number(siteId)); else cur.delete(Number(siteId));
  data.board = { ...(data.board || {}), hidden: [...cur].slice(-500) };
  db.prepare('INSERT INTO user_prefs (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data').run(userId, JSON.stringify(data));
}

// every client of one owner, sorted into STAGES (newest change first in each)
function board(db, userId, { showHidden = false, watch = [] } = {}) {
  const rows = db.prepare(`
    SELECT s.id, s.name, s.published, s.netlify_url, s.updated_at, s.billing_required, s.billing_status,
      ss.package, ss.approved_at, ss.deposit_cents, ss.pay_status, ss.launch_state, ss.launched_at,
      sl.token AS share_token, sl.views AS share_views,
      (SELECT COUNT(*) FROM share_feedback f WHERE f.site_id = s.id AND f.done = 0) AS fb_open,
      (SELECT COUNT(*) FROM share_feedback f WHERE f.site_id = s.id AND f.done = 0 AND f.seen = 0) AS fb_new,
      (SELECT i.id FROM intake_submissions i WHERE i.site_id = s.id LIMIT 1) AS sub_id
    FROM sites s
    LEFT JOIN site_sales ss ON ss.site_id = s.id
    LEFT JOIN share_links sl ON sl.site_id = s.id
    WHERE s.user_id = ?
    ORDER BY s.updated_at DESC, s.id DESC`).all(userId);
  const hidden = new Set(prefs(db, userId).hidden);
  const watchBy = new Map(watch.map(w => [w.site_id, w]));
  const cards = rows.map(card).map(c => {
    const w = watchBy.get(c.id);
    // the daily live check (sitewatch.js): its problems lead the card, as they matter most
    if (w && w.problems && w.problems.length) {
      c.notes.unshift(...w.problems.filter(p => p.kind !== 'hosting' || !c.notes.some(n => /Hosting payment overdue/.test(n.text))).map(p => ({ tone: 'bad', text: p.text })));
      if (c.stage === 'live') c.next = { label: 'Open Launch', href: `/sites/${c.id}/launch` };
    } else if (w && c.stage === 'live') c.notes.push({ tone: 'good', text: `Checked ${String(w.checked_at).slice(0, 10)}: all fine` });
    return { ...c, hidden: hidden.has(c.id) };
  }).filter(c => showHidden || !c.hidden);
  const hiddenCount = rows.filter(r => hidden.has(r.id)).length;
  const subs = db.prepare("SELECT id, data, created_at, package FROM intake_submissions WHERE user_id = ? AND (site_id IS NULL OR site_id NOT IN (SELECT id FROM sites)) ORDER BY id DESC LIMIT 60").all(userId);
  for (const s of subs) {
    let d = {}; try { d = JSON.parse(s.data); } catch { /* */ }
    const notes = [{ tone: '', text: `${d.bizType || 'Questionnaire'}${d.contactName ? ' · ' + d.contactName : ''}` }];
    if (s.package) notes.push({ tone: '', text: `Package: ${s.package}` });
    cards.unshift({ kind: 'answers', id: s.id, name: d.bizName || 'Untitled', stage: 'answers', notes, next: { label: 'Build the website', href: `/intake/submissions/${s.id}` }, updated: s.created_at || '' });
  }
  const cols = STAGES.map(st => ({ ...st, cards: cards.filter(c => c.stage === st.id) }));
  const todo = cards.filter(c => !c.hidden && c.notes.some(x => x.tone === 'bad')).length;
  return { cols, total: cards.length, todo, hiddenCount, showHidden };
}

module.exports = { STAGES, card, board, prefs, setHidden };
