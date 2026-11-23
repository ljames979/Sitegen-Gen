const test = require('node:test');
const assert = require('node:assert');
const Database = require('better-sqlite3');
const clientBoard = require('../clientboard');

test('card: each site lands in the right column with the right next step', () => {
  assert.strictEqual(clientBoard.card({ id: 1, name: 'A' }).stage, 'draft');
  const shown = clientBoard.card({ id: 2, name: 'B', share_token: 't', share_views: 0, fb_open: 2, fb_new: 1 });
  assert.strictEqual(shown.stage, 'shown');
  assert.strictEqual(shown.next.href, '/sites/2/feedback');
  assert.ok(shown.notes.some(n => n.tone === 'bad' && /2 suggestions/.test(n.text)));
  const appr = clientBoard.card({ id: 3, name: 'C', share_token: 't', approved_at: 'x', deposit_cents: 5000, pay_status: 'none' });
  assert.strictEqual(appr.stage, 'approved');
  assert.ok(appr.notes.some(n => /Deposit not paid/.test(n.text)));
  const live = clientBoard.card({ id: 4, name: 'D', published: 1, billing_required: 1, billing_status: 'past_due' });
  assert.strictEqual(live.stage, 'live');
  assert.strictEqual(live.next.href, '/sites/4/billing');
  assert.ok(live.notes.some(n => n.tone === 'bad'));
});

test('board: sites, waiting questionnaires and hidden sites', () => {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE sites (id INTEGER PRIMARY KEY, user_id INT, name TEXT, published INT DEFAULT 0, netlify_url TEXT DEFAULT '', updated_at TEXT DEFAULT '', billing_required INT DEFAULT 0, billing_status TEXT DEFAULT 'none');
    CREATE TABLE site_sales (site_id INT PRIMARY KEY, package TEXT DEFAULT '', approved_at TEXT DEFAULT '', deposit_cents INT DEFAULT 0, pay_status TEXT DEFAULT 'none', launch_state TEXT DEFAULT '', launched_at TEXT DEFAULT '');
    CREATE TABLE share_links (site_id INT, token TEXT, views INT DEFAULT 0);
    CREATE TABLE share_feedback (site_id INT, done INT DEFAULT 0, seen INT DEFAULT 0);
    CREATE TABLE intake_submissions (id INTEGER PRIMARY KEY, user_id INT, site_id INT, data TEXT, created_at TEXT, package TEXT DEFAULT '');
    CREATE TABLE user_prefs (user_id INTEGER PRIMARY KEY, data TEXT NOT NULL DEFAULT '{}');`);
  db.prepare("INSERT INTO sites (id, user_id, name) VALUES (1, 9, 'Draft Co'), (2, 9, 'Live Co'), (3, 8, 'Other owner')").run();
  db.prepare('UPDATE sites SET published = 1 WHERE id = 2').run();
  db.prepare("INSERT INTO intake_submissions (user_id, site_id, data) VALUES (9, NULL, ?)").run(JSON.stringify({ bizName: 'Waiting Bakery', bizType: 'Bakery' }));
  let b = clientBoard.board(db, 9);
  const at = (id) => b.cols.find(c => c.id === id).cards.map(c => c.name);
  assert.deepStrictEqual(at('answers'), ['Waiting Bakery']);
  assert.deepStrictEqual(at('draft'), ['Draft Co']);
  assert.deepStrictEqual(at('live'), ['Live Co']);
  assert.strictEqual(b.total, 3);
  clientBoard.setHidden(db, 9, 1, true);
  b = clientBoard.board(db, 9);
  assert.deepStrictEqual(at('draft'), []);
  assert.strictEqual(b.hiddenCount, 1);
  b = clientBoard.board(db, 9, { showHidden: true });
  assert.deepStrictEqual(at('draft'), ['Draft Co']);
});
