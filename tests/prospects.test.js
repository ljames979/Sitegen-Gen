const test = require('node:test');
const assert = require('node:assert');
const Database = require('better-sqlite3');
const prospects = require('../prospects');

const json = (o) => ({ ok: true, status: 200, json: async () => o });

test('find: town from Nominatim, businesses from Overpass, unnamed ones dropped', async () => {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url, init });
    if (url.includes('nominatim')) return json([{ lat: '28.29', lon: '-81.41', display_name: 'Kissimmee, FL', boundingbox: ['28.2', '28.4', '-81.5', '-81.3'] }]);
    if (url.includes('overpass-api')) return { ok: false, status: 429 };
    return json({ elements: [
      { type: 'node', id: 1, lat: 1, lon: 2, tags: { name: 'Bella', phone: '407-555-0123', website: 'bella.test', 'addr:city': 'Kissimmee' } },
      { type: 'node', id: 2, tags: { shop: 'hairdresser' } }
    ] });
  };
  const r = await prospects.find('Kissimmee, FL', 'hair', { fetchFn });
  assert.strictEqual(r.list.length, 1);
  assert.strictEqual(r.list[0].website, 'http://bella.test/');
  assert.strictEqual(r.list[0].osm_id, 'node/1');
  assert.match(decodeURIComponent(calls[1].init.body), /nwr\["shop"="hairdresser"\]\["name"\]/);
  assert.ok(calls[2].url.includes('kumi'), 'falls back to the second map server');
  assert.ok(calls.every(c => /SiteGen/.test(c.init ? c.init.headers['User-Agent'] : '') || !c.init));
  await assert.rejects(prospects.find('x', 'nope', { fetchFn }), /kind of business/);
});

test('checkSite lists only what it found; pitch uses it and never invents', async () => {
  const page = '<html><head><title>Old</title></head><body><footer>Copyright 2015</footer></body></html>';
  const fetchFn = async () => ({ response: { status: 200, text: async () => page }, finalUrl: 'http://old.test/' });
  const r = await prospects.checkSite('http://old.test', { fetchFn, now: new Date('2026-11-23') });
  assert.deepStrictEqual(r.reasons.map(x => x.split(' ')[0]), ['Not', 'Not', 'Copyright', 'No']);
  const down = await prospects.checkSite('http://down.test', { fetchFn: async () => { throw new Error('x'); } });
  assert.deepStrictEqual(down.reasons, ['Their website does not open']);
  const mail = prospects.pitch({ name: 'Bella', city: 'Kissimmee', website: '' }, { link: 'https://x.test/look/abc' });
  assert.match(mail, /couldn't find a website for Bella/);
  assert.match(mail, /https:\/\/x\.test\/look\/abc/);
  assert.match(prospects.pitch({ name: 'Old Co', website: 'http://old.test/' }, { reasons: r.reasons }), /not secure/);
});

test('saveFound keeps status and notes when the same business is found again', () => {
  const db = new Database(':memory:');
  const p = { osm_id: 'node/1', niche: 'hair', name: 'Bella', phone: '', email: '', website: '', facebook: '', address: '', city: '', lat: 1, lon: 2 };
  assert.strictEqual(prospects.saveFound(db, 1, 'Kissimmee', [p]), 1);
  const row = prospects.list(db, 1)[0];
  prospects.update(db, 1, row.id, { status: 'contacted', note: 'Called Monday' });
  assert.strictEqual(prospects.saveFound(db, 1, 'Kissimmee', [{ ...p, phone: '407' }]), 0);
  const again = prospects.get(db, 1, row.id);
  assert.strictEqual(again.status, 'contacted');
  assert.strictEqual(again.phone, '407');
  assert.strictEqual(prospects.get(db, 2, row.id), null);
  assert.strictEqual(prospects.list(db, 1, { web: 'has' }).length, 0);
});
