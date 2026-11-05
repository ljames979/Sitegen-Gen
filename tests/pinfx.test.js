const test = require('node:test');
const assert = require('node:assert');
const pin = require('../pinfx');

test('pin: only known settings are kept; hold sets how long, cover stacks', () => {
  assert.equal(pin.clean('hold:200'), 'hold:200'); assert.equal(pin.clean('hold:999'), ''); assert.equal(pin.clean('cover'), 'cover');
  assert.deepEqual(pin.attrs(''), { cls: '', style: '' });
  assert.deepEqual(pin.attrs('hold:50'), { cls: ' sg-pin sg-pin-hold', style: '--pin-len: 50vh;' });
  assert.deepEqual(pin.attrs('cover'), { cls: ' sg-pin sg-pin-cover', style: '' });
  assert.match(pin.CSS, /\.sg-pin-hold::after\{content:'';display:block;height:var\(--pin-len,100vh\)\}/);
  assert.doesNotThrow(() => new Function(pin.SCRIPT));
});

test('pin: stack and side are offered and draw their own wrapper', () => {
  assert.equal(pin.clean('stack'), 'stack'); assert.equal(pin.clean('side'), 'side');
  assert.deepEqual(pin.attrs('stack'), { cls: ' sg-pin sg-pin-stack', style: '' });
  assert.deepEqual(pin.attrs('side'), { cls: ' sg-pin sg-pin-side', style: '' });
  assert.ok(pin.OPTIONS.some(o => o[0] === 'stack') && pin.OPTIONS.some(o => o[0] === 'side'));
});

test('pin: stack piles the cards and side holds the shorter side (in a browser)', { timeout: 60000 }, async (t) => {
  let chromium = null;
  for (const p of ['playwright', '/opt/node-tools/node_modules/playwright']) { try { ({ chromium } = require(p)); break; } catch { /* next */ } }
  if (!chromium) return t.skip('playwright not installed');
  let browser; try { browser = await chromium.launch(); } catch { return t.skip('Chromium not available'); }
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    const card = n => `<div class="card"><img style="width:100%;aspect-ratio:3/2;display:block"><div style="padding:20px"><h3>Card ${n}</h3><p>Words</p></div></div>`;
    await page.setContent(`<style>${pin.CSS}</style><main>
      <div class="sg-pin sg-pin-stack"><section style="overflow:hidden"><div class="grid" style="display:grid;grid-template-columns:repeat(3,1fr)">${[1, 2, 3].map(card).join('')}</div></section></div>
      <div class="sg-pin sg-pin-side"><section><div style="display:flex;gap:20px"><div class="photo" style="flex:1;height:300px;background:#ccc"></div><div class="list" style="flex:1;height:1500px"></div></div></section></div>
      <div style="height:2000px"></div></main><script>${pin.SCRIPT}</script>`);
    const r = await page.evaluate(() => {
      const g = document.querySelector('.grid'), cards = [...g.children], photo = document.querySelector('.photo');
      return { stack: g.classList.contains('sg-stack'), dir: getComputedStyle(g).flexDirection, sticky: cards.map(c => getComputedStyle(c).position),
        tops: cards.map(c => getComputedStyle(c).top), cols: getComputedStyle(cards[0]).gridTemplateColumns, clip: getComputedStyle(g.parentElement).overflow,
        side: photo.classList.contains('sg-side-hold') && getComputedStyle(photo).position, list: document.querySelector('.list').classList.contains('sg-side-hold') };
    });
    assert.equal(r.stack, true); assert.equal(r.dir, 'column'); assert.deepEqual(r.sticky, ['sticky', 'sticky', 'sticky']);
    assert.deepEqual(r.tops, ['20px', '46px', '72px'], 'each card stops a little lower');
    assert.notEqual(r.cols, 'none', 'a wide card puts its photo beside the words');
    assert.equal(r.clip, 'clip', 'a box that hides its overflow is clipped instead, so sticky works');
    assert.equal(r.side, 'sticky'); assert.equal(r.list, false);
    await page.setViewportSize({ width: 380, height: 800 });
    await page.evaluate(() => { const f = document.querySelector('.sg-pin-side section > div'); f.style.flexDirection = 'column'; dispatchEvent(new Event('resize')); });
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => document.querySelector('.sg-side-hold')), null, 'sides above each other scroll as normal');
  } finally { await browser.close(); }
});
