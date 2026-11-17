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

// pages: [{ label, url }] → one PDF (Buffer), pages in the order given.
// editable: under each page a strip with a box the client types changes into and a "Looks good" tick, and a
// last sign-off page (name, date, overall changes, approve). Plain PDF form fields: they work in the free readers
// (Adobe Acrobat Reader, Edge, Chrome, Preview on a Mac) and stay filled in when the client saves the file.
async function makePdf({ pages, size, title, browser, editable, siteName }) {
  const exe = browser || findBrowser();
  if (!exe) { const e = new Error('No Chrome or Edge found on this computer.'); e.code = 'NO_BROWSER'; throw e; }
  const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
  const out = await PDFDocument.create();
  out.setTitle(String(title || 'Website preview').slice(0, 200));
  out.setCreator('SiteGen');
  out.setSubject(editable ? 'Website preview: type your changes in the boxes, save, and email it back' : 'Website preview: add comments anywhere with your PDF reader');
  const font = editable ? await out.embedFont(StandardFonts.Helvetica) : null;
  const bold = editable ? await out.embedFont(StandardFonts.HelveticaBold) : null;
  const form = editable ? out.getForm() : null;
  const ink = rgb(0.06, 0.09, 0.16), muted = rgb(0.39, 0.45, 0.55), line = rgb(0.8, 0.84, 0.89), paper = rgb(0.96, 0.97, 0.98), white = rgb(1, 1, 1);
  // the standard PDF fonts only cover Western characters: leave out anything else in labels
  const safe = (t) => String(t || '').replace(/[^\x20-\x7E -ÿ]/g, '').replace(/\s+/g, ' ').trim();
  const failed = [];
  let n = 0;
  await printPages(exe, pages, size, async (p, buf, err) => {
    if (!buf) { failed.push(p.label); console.error(`PDF export: ${p.label} failed:`, err && err.message); return; }
    const doc = await PDFDocument.load(buf);
    if (!editable) { (await out.copyPages(doc, doc.getPageIndices())).forEach(pg => out.addPage(pg)); return; }
    const src = doc.getPages();
    for (let i = 0; i < src.length; i++) {
      n++;
      const { width: w, height: h } = src[i].getSize();
      const small = w < 400, pad = small ? 10 : 18, strip = small ? 120 : 130, fs1 = small ? 8.5 : 10.5, okW = small ? 70 : 96;
      const emb = await out.embedPage(src[i]);
      const pg = out.addPage([w, h + strip]);
      pg.drawRectangle({ x: 0, y: 0, width: w, height: strip, color: paper });
      pg.drawLine({ start: { x: 0, y: strip }, end: { x: w, y: strip }, thickness: 1, color: line });
      pg.drawPage(emb, { x: 0, y: strip, width: w, height: h });
      const head = `Page ${n} - ${safe(p.label)}${src.length > 1 ? ` (part ${i + 1} of ${src.length})` : ''}: anything to change here?`;
      pg.drawText(head, { x: pad, y: strip - pad - fs1, size: fs1, font: bold, color: ink, maxWidth: w - pad * 2 });
      const boxTop = strip - pad * 2 - fs1;
      const tf = form.createTextField(`page${n}.changes`);
      tf.enableMultiline();
      tf.addToPage(pg, { x: pad, y: pad, width: w - pad * 3 - okW, height: boxTop - pad, font, borderColor: line, borderWidth: 1, backgroundColor: white, textColor: ink });
      tf.setFontSize(small ? 9 : 11);
      const cb = form.createCheckBox(`page${n}.looksgood`);
      cb.addToPage(pg, { x: w - pad - okW, y: boxTop - 15, width: 14, height: 14, borderColor: muted, borderWidth: 1, backgroundColor: white });
      pg.drawText('Looks good', { x: w - pad - okW + 19, y: boxTop - 12, size: fs1, font, color: ink });
    }
  });
  if (!out.getPageCount()) throw new Error('None of the pages could be printed.');
  if (editable) {
    // the sign-off page, as wide as the others
    const w = out.getPage(0).getWidth(), small = w < 400, h = small ? 560 : 640, pad = small ? 16 : 40;
    const big = small ? 16 : 24, fs1 = small ? 9.5 : 12;
    const pg = out.addPage([w, h]);
    let y = h - pad - big;
    pg.drawText(`Your changes${siteName ? ' for ' + safe(siteName).slice(0, 60) : ''}`, { x: pad, y, size: big, font: bold, color: ink, maxWidth: w - pad * 2 });
    y -= big;
    pg.drawText('Type in the boxes on any page, then save this PDF and email it back.', { x: pad, y, size: fs1, font, color: muted, maxWidth: w - pad * 2, lineHeight: fs1 * 1.3 });
    const field = (name, label, height, multiline) => {
      y -= fs1 + 18;
      pg.drawText(label, { x: pad, y, size: fs1, font: bold, color: ink, maxWidth: w - pad * 2 });
      y -= height + 6;
      const f = form.createTextField(name);
      if (multiline) f.enableMultiline();
      f.addToPage(pg, { x: pad, y, width: w - pad * 2, height, font, borderColor: line, borderWidth: 1, backgroundColor: white, textColor: ink });
      f.setFontSize(small ? 9 : 11);
    };
    field('signoff.name', 'Your name', 22, false);
    field('signoff.date', 'Date', 22, false);
    field('signoff.overall', small ? 'Anything else?' : 'Anything else? (colors, photos, wording, things to add or take away)', Math.max(120, y - pad - 120), true);
    y -= 36;
    const cb = form.createCheckBox('signoff.approved');
    cb.addToPage(pg, { x: pad, y, width: 16, height: 16, borderColor: muted, borderWidth: 1, backgroundColor: white });
    pg.drawText(small ? 'I approve this design' : 'I approve this design as it is, or with the changes I typed', { x: pad + 24, y: y + 3, size: fs1, font, color: ink, maxWidth: w - pad * 2 - 24 });
    form.updateFieldAppearances(font);
  }
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
