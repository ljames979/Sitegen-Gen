const test = require('node:test');
const assert = require('node:assert');
const sales = require('../packages');

test('packages never show a made-up price, and keep only what the owner typed', () => {
  const d = sales.clean({});
  assert.strictEqual(d.tiers.length, 3);
  assert.ok(d.tiers.every(t => t.price === ''));
  assert.strictEqual(sales.priceOf(d.tiers[0]), sales.PLACEHOLDER);
  assert.strictEqual(d.tiers.filter(t => t.best).length, 1);
  const f = sales.fromForm({ tier0_name: 'Starter<script>', tier0_price: '$900', tier0_items: 'One\r\n\r\nTwo', best: '2', note: 'Hosting included', demo: ['4', 'x', '4', '7'] });
  assert.strictEqual(f.tiers[0].name, 'Starterscript');
  assert.strictEqual(f.tiers[0].price, '$900');
  assert.deepStrictEqual(f.tiers[0].items, ['One', 'Two']);
  assert.ok(f.tiers[2].best && !f.tiers[1].best);
  assert.deepStrictEqual(f.demos, [4, 7]);
});

test('packages are saved per SiteGen user', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.exec("CREATE TABLE user_prefs (user_id INTEGER PRIMARY KEY, data TEXT NOT NULL DEFAULT '{}')");
  sales.write(db, 1, sales.fromForm({ tier1_price: '$1,500' }));
  assert.strictEqual(sales.read(db, 1).tiers[1].price, '$1,500');
  assert.strictEqual(sales.read(db, 2).tiers[1].price, '');
});
