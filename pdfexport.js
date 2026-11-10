// Export PDF: prints every page of a site to one PDF Leo can email to a client for comments.
// It drives the Chrome or Edge already on the computer with playwright-core (Apache-2.0, downloads no browser);
// pdf-lib (MIT) joins the pages into one file. Motion is shown at rest (the same as Calm motion), so a PDF is a
// still snapshot: the envelope opening, scroll effects and drift do not play in it.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// page sizes in CSS px: a laptop screen, or a phone
const SIZES = {
  desktop: { w: 1280, h: 900, label: 'Computer' },
  phone: { w: 390, h: 844, label: 'Phone' }
};
const sizeOf = (v) => SIZES[v] ? v : 'desktop';

function browserCandidates() {
  const out = [];
  if (process.env.SITEGEN_BROWSER) out.push(process.env.SITEGEN_BROWSER);
  if (process.platform === 'win32') {
    const roots = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA, 'C:\\Program Files (x86)', 'C:\\Program Files'].filter(Boolean);
    for (const r of roots) {
      out.push(path.join(r, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
      out.push(path.join(r, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    }
  } else if (process.platform === 'darwin') {
    out.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Chromium.app/Contents/MacOS/Chromium');
  } else {
    out.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge', '/opt/pw-browsers/chromium');
    try {
      for (const d of fs.readdirSync('/opt/pw-browsers')) if (/^chromium-\d+$/.test(d)) out.push(`/opt/pw-browsers/${d}/chrome-linux64/chrome`, `/opt/pw-browsers/${d}/chrome-linux/chrome`);
    } catch { /* not there */ }
  }
  return out;
}
let found;
function findBrowser() {
  if (found !== undefined && (found === null || fs.existsSync(found))) return found;
  found = null;
  for (const p of browserCandidates()) {
    try { if (p && fs.statSync(p).isFile()) { found = p; break; } } catch { /* next */ }
  }
  return found;
}

// one browser for the whole export (playwright-core drives the Chrome or Edge already installed; it downloads nothing)
async function printPages(exe, pages, size, onPage) {
  const { chromium } = require('playwright-core');
  const s = SIZES[sizeOf(size)];
  const args = ['--disable-extensions', '--hide-scrollbars', '--mute-audio'];
  const browser = await chromium.launch({ executablePath: exe, headless: true, args, timeout: 60000 });
  try {
    const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1, isMobile: size === 'phone', hasTouch: size === 'phone', reducedMotion: 'reduce' });
    for (const p of pages) {
      const page = await ctx.newPage();
      try {
        try { await page.goto(p.url, { waitUntil: 'load', timeout: 45000 }); } catch (e) { if (!/Timeout/i.test(e.message)) throw e; }
        // walk down the page so anything that appears on scroll is drawn, then back to the top
        await page.evaluate(async () => {
          const step = Math.max(300, innerHeight * 0.8), end = () => document.documentElement.scrollHeight;
          for (let y = 0; y < end() && y < 60000; y += step) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); }
          scrollTo(0, 0);
        }).catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(400);
        await onPage(p, await page.pdf({ width: `${s.w}px`, height: `${s.h}px`, printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } }));
      } catch (e) {
        await onPage(p, null, e);
      } finally {
        await page.close().catch(() => {});
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }
}

// pages: [{ label, url }] → one PDF (Buffer), pages in the order given
async function makePdf({ pages, size, title, browser }) {
  const exe = browser || findBrowser();
  if (!exe) { const e = new Error('No Chrome or Edge found on this computer.'); e.code = 'NO_BROWSER'; throw e; }
  const { PDFDocument } = require('pdf-lib');
  const out = await PDFDocument.create();
  out.setTitle(String(title || 'Website preview').slice(0, 200));
  out.setCreator('SiteGen');
  out.setSubject('Website preview: add comments anywhere with your PDF reader');
  const failed = [];
  await printPages(exe, pages, size, async (p, buf, err) => {
    if (!buf) { failed.push(p.label); console.error(`PDF export: ${p.label} failed:`, err && err.message); return; }
    const doc = await PDFDocument.load(buf);
    (await out.copyPages(doc, doc.getPageIndices())).forEach(pg => out.addPage(pg));
  });
  if (!out.getPageCount()) throw new Error('None of the pages could be printed.');
  return { pdf: Buffer.from(await out.save()), failed };
}

// short-lived keys that let the headless browser open the owner's preview without a login
const keys = new Map();
function issueKey(siteId, ttlMs = 10 * 60 * 1000) {
  const now = Date.now();
  for (const [k, v] of keys) if (v.exp < now) keys.delete(k);
  const key = crypto.randomBytes(18).toString('base64url');
  keys.set(key, { siteId: Number(siteId), exp: now + ttlMs });
  return key;
}
function checkKey(key) {
  const v = keys.get(String(key || ''));
  if (!v || v.exp < Date.now()) return null;
  return v.siteId;
}
function dropKey(key) { keys.delete(String(key || '')); }

const safeName = (s) => String(s || 'website').replace(/[^\w\- ]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'website';

module.exports = { SIZES, sizeOf, findBrowser, makePdf, issueKey, checkKey, dropKey, safeName };
