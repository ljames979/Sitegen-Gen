// Lead pipeline helpers (statuses, follow-up dates, reminder digests) and the automatic
// follow-up email queue. Pure functions over a db handle so they can be tested on their own.
const crypto = require('crypto');

const STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost'];
const OPEN = ['new', 'contacted', 'quoted'];
const MAX_STEPS = 3;

const DEFAULT_TEXT = 'Hi [name], this is [business]. We received your request and want to make sure you hear from us. Reply to this email[phone] whenever you are ready.';

const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

function cleanFollowUp(fu) {
  fu = fu || {};
  const steps = (Array.isArray(fu.steps) ? fu.steps : []).slice(0, MAX_STEPS).map(s => ({
    afterHours: Math.min(24 * 30, Math.max(1, parseInt(s && s.afterHours, 10) || 24)),
    text: str(s && s.text, 1200)
  }));
  return { enabled: !!fu.enabled, steps };
}

function fromBody(b) {
  const hours = [].concat(b.fu_hours || []), texts = [].concat(b.fu_text || []);
  const steps = [];
  for (let i = 0; i < Math.min(MAX_STEPS, Math.max(hours.length, texts.length)); i++) {
    if (!str(hours[i], 6) && !str(texts[i], 1200)) continue;
    steps.push({ afterHours: hours[i], text: texts[i] });
  }
  return cleanFollowUp({ enabled: b.fu_enabled === '1' || b.fu_enabled === 'on', steps });
}

function fill(text, vars) {
  return String(text || DEFAULT_TEXT).replace(/\[(name|business|phone)\]/g, (m, k) => vars[k] || (k === 'name' ? 'there' : ''));
}

const today = (d = new Date()) => d.toISOString().slice(0, 10);

function newToken() { return crypto.randomBytes(18).toString('base64url'); }

// queue the site's follow-up steps for a brand-new lead that left an email address
function enqueue(db, leadId, siteId, followUp, now = new Date()) {
  const fu = cleanFollowUp(followUp);
  if (!fu.enabled || !fu.steps.length) return 0;
  const lead = db.prepare('SELECT email FROM contact_submissions WHERE id = ?').get(leadId);
  if (!lead || !lead.email) return 0;
  db.prepare('UPDATE contact_submissions SET optout_token = ? WHERE id = ? AND (optout_token IS NULL OR optout_token = \'\')').run(newToken(), leadId);
  const ins = db.prepare('INSERT INTO followup_queue (lead_id, site_id, step, due_at, text) VALUES (?, ?, ?, ?, ?)');
  fu.steps.forEach((s, i) => ins.run(leadId, siteId, i + 1, new Date(now.getTime() + s.afterHours * 3600000).toISOString(), s.text));
  return fu.steps.length;
}

// once the owner has been in touch (or the lead is won / lost) nothing more is sent automatically
function cancelPending(db, leadId) {
  return db.prepare('UPDATE followup_queue SET canceled = 1 WHERE lead_id = ? AND sent_at IS NULL AND canceled = 0').run(leadId).changes;
}

function optOut(db, token) {
  if (!token || String(token).length < 10) return null;
  const lead = db.prepare('SELECT id, site_id FROM contact_submissions WHERE optout_token = ?').get(token);
  if (!lead) return null;
  db.prepare('UPDATE contact_submissions SET opted_out = 1 WHERE id = ?').run(lead.id);
  cancelPending(db, lead.id);
  return lead;
}

// send everything that is due. `send({lead, site, text, subject, optoutToken})` does the delivery.
async function process(db, { now = new Date(), send, siteFor }) {
  const due = db.prepare(`SELECT q.id AS qid, q.step, q.text, l.* FROM followup_queue q JOIN contact_submissions l ON l.id = q.lead_id
    WHERE q.sent_at IS NULL AND q.canceled = 0 AND q.due_at <= ? ORDER BY q.due_at LIMIT 50`).all(now.toISOString());
  let sent = 0;
  for (const r of due) {
    const done = (col) => db.prepare(`UPDATE followup_queue SET ${col} = ? WHERE id = ?`).run(col === 'canceled' ? 1 : now.toISOString(), r.qid);
    if (r.status !== 'new' || r.opted_out || !r.email) { done('canceled'); continue; }
    const site = siteFor(r.site_id);
    if (!site) { done('canceled'); continue; }
    done('sent_at'); // mark first: a crash must never cause a double send
    try {
      const phone = (site.sections.contact || {}).phone;
      const text = fill(r.text, { name: (r.name || '').split(' ')[0], business: site.name, phone: phone ? ` or call ${phone}` : '' });
      await send({ lead: r, site, text, subject: r.step === 1 ? `Following up on your request — ${site.name}` : `Still need help? — ${site.name}`, optoutToken: r.optout_token });
      sent++;
    } catch (e) { console.error('Follow-up failed:', e.message); }
  }
  return sent;
}

// leads whose follow-up date has come and that are still open, grouped by site (one digest per site per day)
function dueReminders(db, todayFor) {
  const rows = db.prepare(`SELECT * FROM contact_submissions WHERE follow_up_at IS NOT NULL AND follow_up_at != '' AND status IN ('new','contacted','quoted') ORDER BY follow_up_at`).all();
  const bySite = new Map();
  for (const r of rows) {
    const t = todayFor(r.site_id);
    if (r.follow_up_at > t || r.reminded_on === t) continue;
    if (!bySite.has(r.site_id)) bySite.set(r.site_id, { today: t, leads: [] });
    bySite.get(r.site_id).leads.push(r);
  }
  return bySite;
}

function markReminded(db, ids, day) {
  const up = db.prepare('UPDATE contact_submissions SET reminded_on = ? WHERE id = ?');
  for (const id of ids) up.run(day, id);
}

module.exports = { STATUSES, OPEN, MAX_STEPS, DEFAULT_TEXT, cleanFollowUp, fromBody, fill, enqueue, cancelPending, optOut, process, dueReminders, markReminded, today };
