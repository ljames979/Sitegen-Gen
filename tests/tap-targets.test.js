// Real-browser guard: on a phone-sized screen, every button, field and stand-alone link on every style
// is at least 44px tall and wide (WCAG 2.5.5). Skipped when Playwright / Chromium is not installed.
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');
const themes = require('../themes');

let chromium = null;
for (const p of ['playwright', '/opt/node-tools/node_modules/playwright']) { try { ({ chromium } = require(p)); break; } catch { /* try next */ } }
const PORT = 3992, BASE = `http://localhost:${PORT}`;

test('tap targets are at least 44px on every style', { skip: !chromium && 'playwright not installed', timeout: 180000 }, async (t) => {
  const db = path.join(os.tmpdir(), `tap-${process.pid}.db`);
  const srv = spawn('node', ['server.js'], { cwd: path.join(__dirname, '..'), env: { ...process.env, PORT, DB_PATH: db, SESSION_SECRET: 'x'.repeat(40), NODE_ENV: 'test' }, stdio: 'ignore' });
  let browser;
  try {
    for (let i = 0; i < 40; i++) { try { await fetch(BASE + '/login'); break; } catch { await new Promise(r => setTimeout(r, 250)); } }
    try { browser = await chromium.launch(); } catch { return t.skip('Chromium not available'); }
    const ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, hasTouch: true, isMobile: true });
    const api = ctx.request;
    await api.post(BASE + '/signup', { form: { email: 'tap@example.com', password: 'password1' }, maxRedirects: 0 });
    const edit = (await api.post(BASE + '/sites', { form: { name: 'Tap Test' }, maxRedirects: 0 })).headers().location;
    const id = edit.match(/\/sites\/(\d+)\//)[1];
    const failures = [];
    for (const style of themes.ALL_STYLES) {
      await api.post(BASE + edit, { form: { name: 'Tap Test', hero_headline: 'Hello', about_heading: 'About', about_body: 'Text', services_heading: 'Services', service_title: ['A', 'B'], service_description: ['x', 'y'], service_detail: ['', ''], contact_heading: 'Contact', contact_email: 'a@b.test', contact_phone: '555-0100', contact_acceptSubmissions: '1', meta_businessType: 'roofer', theme_style: style, layout_order: 'hero,about,services,testimonials,whyChoose,gallery,faq,blog,extraPages,hours,contact' }, maxRedirects: 0 });
      const page = await ctx.newPage();
      await page.goto(BASE + `/sites/${id}/preview`, { waitUntil: 'load' });
      const bad = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button]').forEach(el => {
          const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
          if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') return;
          if (el.closest('[hidden], [aria-hidden=true]')) return;
          if (el.tagName === 'A' && cs.display === 'inline' && el.parentElement && /^(P|LI|SPAN|DD|SMALL|STRONG|EM)$/.test(el.parentElement.tagName)) return;
          if (el.type === 'checkbox' || el.type === 'radio') return;
          if (r.height < 43.5 || r.width < 43.5) out.push(`${(el.className || el.tagName).toString().slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`);
        });
        return out;
      });
      await page.close();
      if (bad.length) failures.push(`${style}: ${bad.join('; ')}`);
    }
    assert.deepEqual(failures, [], 'controls under 44px:\n' + failures.join('\n'));
  } finally {
    if (browser) await browser.close();
    srv.kill();
    for (const f of [db, db + '-wal', db + '-shm']) { try { fs.unlinkSync(f); } catch { /* ignore */ } }
  }
});
