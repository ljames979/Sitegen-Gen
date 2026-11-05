// Speed and polish score: four 0-100 scores in the spirit of Lighthouse (Speed, Accessibility, Search, Polish),
// worked out from the rendered home page, the saved site and the quality check's findings. It is an estimate
// made on this server (no real phone or network is measured), so the page says so. One-click fixes are named
// here and carried out in server.js; anything that needs the owner's own words only links to the editor.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const cheerio = require('cheerio');
const quality = require('./quality');
const motion = require('./motion-presets');

const KB = 1024;
const GOOD = 600 * KB, BAD = 5 * 1024 * KB;   // whole-page weight that scores 100 and 0

// The bytes a first visit downloads: the page, its bundled scripts, its own photos and an estimate for web fonts
function pageWeight(html, uploadsDir) {
  const doc = String(html || '');
  const htmlGz = zlib.gzipSync(Buffer.from(doc)).length;
  const scripts = quality.scriptWeight(doc).gz;
  let images = 0; const seen = new Set();
  const re = /(?:src|data-sg-hover|href)="(\/uploads\/[A-Za-z0-9._-]+)"|url\(['"]?(\/uploads\/[A-Za-z0-9._-]+)/g;
  let m; while ((m = re.exec(doc))) {
    const u = m[1] || m[2]; if (seen.has(u) || /\.(ico)$/i.test(u)) continue; seen.add(u);
    try { images += fs.statSync(path.join(uploadsDir || '', path.basename(u))).size; } catch { /* missing: the quality check reports it */ }
  }
  const fam = (doc.match(/fonts\.googleapis\.com\/css2\?[^"]*/) || [''])[0].split('family=').length - 1;
  const fontBytes = fam * 35 * KB;
  return { total: htmlGz + scripts + images + fontBytes, html: htmlGz, scripts, images, fonts: fontBytes, fontFamilies: fam, photos: seen.size };
}
const weightScore = (n) => Math.round(Math.max(0, Math.min(100, 100 - (Math.log(Math.max(n, GOOD) / GOOD) / Math.log(BAD / GOOD)) * 100)));

// sum of points earned / points possible, as 0-100
const total = (checks) => { const all = checks.reduce((a, c) => a + c.pts, 0); return all ? Math.round(checks.reduce((a, c) => a + (c.ok ? c.pts : c.part || 0), 0) / all * 100) : 100; };

function score(site, html, report, { uploadsDir } = {}) {
  const $ = cheerio.load(html || '');
  const items = (report && report.items) || [];
  const has = (re) => items.some(i => re.test(i.id));
  const theme = site.theme || {}, sec = site.sections || {};
  const mb = (n) => (n / 1048576).toFixed(1) + ' MB', kb = (n) => Math.round(n / KB) + ' KB';
  const edit = (hash) => ({ type: 'link', href: `/sites/${site.id}/edit${hash || ''}`, label: 'Open in the editor' });

  // ---- speed ----
  const w = pageWeight(html, uploadsDir);
  const ws = weightScore(w.total);
  const blocking = $('head script[src]').toArray().filter(s => !$(s).attr('defer') && !$(s).attr('async') && $(s).attr('type') !== 'module').length;
  const showcase = motion.resolveLevel(theme, sec.hero) === 'showcase';
  const speed = [
    { pts: 60, ok: ws >= 100, part: Math.round(ws * 0.6), title: `Page weight: about ${w.total > 1048576 ? mb(w.total) : kb(w.total)}`,
      detail: `Photos ${kb(w.images)} (${w.photos}), scripts ${kb(w.scripts)}, page ${kb(w.html)}, fonts about ${kb(w.fonts)}. Under ${kb(GOOD)} scores full marks; phones on mobile data feel every extra megabyte.`,
      fix: w.images > 400 * KB ? { type: 'images', label: 'Optimize all photos' } : (showcase ? { type: 'motion', label: 'Switch Motion level to Premium' } : null) },
    { pts: 15, ok: !has(/^img-(heavy|png)-/), title: 'Photos are a sensible size', detail: 'No photo is over about 700 KB or a PNG holding a photo.', fix: has(/^img-(heavy|png)-/) ? { type: 'images', label: 'Optimize all photos' } : null },
    { pts: 10, ok: !has(/^img-lazy$/), title: 'Photos further down load lazily', detail: 'Photos below the first screen wait until the visitor scrolls near them.' },
    { pts: 5, ok: !has(/^font-(swap|preconnect)$/), title: 'Text shows while fonts load', detail: 'Fonts use display=swap and connect early.' },
    { pts: 10, ok: blocking === 0, title: 'No scripts hold up the first paint', detail: blocking ? `${blocking} script${blocking > 1 ? 's' : ''} in the page head load before anything shows.` : 'Every script waits until the page is drawn.' }
  ];
  if (showcase && !speed[0].fix) speed[0].fix = { type: 'motion', label: 'Switch Motion level to Premium' };
  if (has(/^weight-showcase/)) speed.push({ pts: 10, ok: false, title: 'Showcase motion makes the first visit heavy', detail: 'The animated hero background adds its libraries to every first visit.', fix: { type: 'motion', label: 'Switch Motion level to Premium' } });

  // ---- accessibility ----
  const h1 = $('h1').length;
  const unlabelled = $('form input:not([type=hidden]):not([type=submit]):not([type=checkbox]):not([type=radio]), form textarea, form select').toArray()
    .filter(el => { const id = $(el).attr('id'); return !$(el).attr('aria-label') && !$(el).attr('aria-labelledby') && !$(el).closest('label').length && !(id && $(`label[for="${id}"]`).length) && !$(el).attr('title') && $(el).attr('name') !== 'website'; }).length;
  const colorFix = items.find(i => i.fix && i.fix.type === 'colors');
  const access = [
    { pts: 25, ok: !has(/^contrast-ink$/), title: 'Main text is easy to read', detail: 'Body text against the page background meets WCAG AA (4.5:1).' },
    { pts: 20, ok: !has(/^contrast-button$/), title: 'Button text is easy to read', detail: 'Labels on brand-colored buttons meet 4.5:1.', fix: has(/^contrast-button$/) && colorFix ? { type: 'colors', label: colorFix.fix.label } : null },
    { pts: 10, ok: !has(/^contrast-(muted|brand)$/), title: 'Secondary text and brand-colored text stand out', detail: 'Captions and brand-colored links have enough contrast.', fix: has(/^contrast-brand$/) && colorFix ? { type: 'colors', label: colorFix.fix.label } : null },
    { pts: 15, ok: !has(/^img-alt$/), title: 'Every image has alt text', detail: 'Screen readers can describe or skip each picture.' },
    { pts: 5, ok: !has(/^alt-(hero|about)$/), title: 'Main photos are described', detail: 'The top photo and About photo have a short description.', fix: has(/^alt-(hero|about)$/) ? edit('#content') : null },
    { pts: 10, ok: !has(/^tap-/), title: 'Easy to tap and zoom on phones', detail: 'Buttons are at least 44px tall and pinch-zoom works.' },
    { pts: 5, ok: !!$('html').attr('lang'), title: 'Page language is set', detail: 'Screen readers pronounce the words correctly.' },
    { pts: 5, ok: h1 === 1, title: 'One main heading', detail: h1 === 1 ? 'The page has a single top-level heading.' : `The page has ${h1} top-level headings; one is clearest.` },
    { pts: 5, ok: unlabelled === 0, title: 'Form fields have labels', detail: unlabelled ? `${unlabelled} form field${unlabelled > 1 ? 's have' : ' has'} no label a screen reader can read.` : 'Every form field is labelled.' }
  ];

  // ---- search ----
  const title = $('head title').first().text().trim(), desc = ($('meta[name=description]').attr('content') || '').trim();
  // previews always carry noindex, so the owner's own switch for the home page is what counts
  const noindex = !!((((site.sections || {}).seo || {}).pages || {}).home || {}).noindex;
  const ld = $('script[type="application/ld+json"]').length;
  const search = [
    { pts: 20, ok: title.length >= 10 && title.length <= 65, title: 'Page title is a good length', detail: title ? `"${title.slice(0, 80)}" is ${title.length} characters; 10 to 65 shows in full on Google.` : 'The page has no title.', fix: edit('#settings') },
    { pts: 20, ok: desc.length >= 50 && desc.length <= 165, title: 'Search description is a good length', detail: desc ? `${desc.length} characters; 50 to 165 is the useful range.` : 'No description, so Google picks a random snippet. Write one in the editor (Settings > Search).', fix: edit('#settings') },
    { pts: 15, ok: ld > 0, title: 'Business details for Google (structured data)', detail: ld ? 'The page tells Google the business name, address and hours in its own format.' : 'No structured data found.' },
    { pts: 15, ok: !noindex, title: 'Search engines may list the page', detail: noindex ? 'The page asks search engines not to list it.' : 'Nothing blocks Google.' },
    { pts: 10, ok: h1 >= 1, title: 'A main heading Google can read', detail: 'The headline is a real heading, not just big text.' },
    { pts: 10, ok: !has(/^img-alt$/), title: 'Images are described for search', detail: 'Alt text also helps image search.' },
    { pts: 10, ok: !!$('meta[name=viewport]').attr('content'), title: 'Mobile friendly', detail: 'Google ranks mobile-ready pages first.' }
  ];

  // ---- polish ----
  $('script, style, noscript, template').remove();
  const text = $('body').text().replace(/\s+/g, ' ');
  const holders = [...new Set((text.match(/\[[A-Z][^\]\[]{1,40}\]/g) || []))];
  const lorem = /lorem ipsum/i.test(text);
  const phone = sec.contact && sec.contact.phone;
  const telLink = $('a[href^="tel:"]').length > 0;
  const iconOk = !!(theme.faviconUrl || theme.logoUrl);
  const shareOk = !!((sec.seo && sec.seo.shareImage) || (sec.hero && sec.hero.imageUrl));
  const insecure = has(/^img-http-/);
  const year = new Date().getFullYear();
  const footerYear = (text.match(/©\s*(\d{4})/) || [])[1];
  const polish = [
    { pts: 25, ok: !holders.length, title: 'No placeholders left', detail: holders.length ? `Still to fill in: ${holders.slice(0, 4).join(', ')}${holders.length > 4 ? '…' : ''}. These need the client's real details.` : 'No [bracketed] placeholders on the page.', fix: holders.length ? edit('') : null },
    { pts: 10, ok: !lorem, title: 'No sample text', detail: lorem ? 'The page still has "lorem ipsum" filler text.' : 'No filler text found.' },
    { pts: 20, ok: !!theme.faviconUrl, part: iconOk ? 10 : 0, title: 'A proper browser icon', detail: theme.faviconUrl ? 'The site has its own browser icon.' : theme.logoUrl ? 'The browser tab uses the full logo, which is often unreadable at 16px. A trimmed square icon looks sharper.' : 'The browser tab shows a plain letter.', fix: theme.faviconUrl ? null : (theme.logoUrl ? { type: 'icons', label: 'Make a browser icon from the logo' } : { type: 'link', href: `/sites/${site.id}/brand`, label: 'Open Brand kit' }) },
    { pts: 15, ok: !!(sec.seo && sec.seo.shareImage), part: shareOk ? 8 : 0, title: 'A share picture for texts and social posts', detail: sec.seo && sec.seo.shareImage ? 'Links to the site show a chosen picture.' : shareOk ? 'Links show the home photo cropped by each app. A 1200 x 630 picture with the logo looks deliberate.' : 'Links to the site show no picture.', fix: (sec.seo && sec.seo.shareImage) ? null : (theme.logoUrl ? { type: 'share', label: 'Make a share picture' } : { type: 'link', href: `/sites/${site.id}/brand`, label: 'Open Brand kit' }) },
    { pts: 10, ok: !phone || telLink, title: 'Phone number is tap-to-call', detail: phone ? (telLink ? 'Visitors on phones can tap the number to call.' : 'The number is on the page but not a tap-to-call link.') : 'No phone number on the site (nothing to check).' },
    { pts: 10, ok: !insecure, title: 'Everything loads securely', detail: insecure ? 'Some images use http://, which browsers block on https sites.' : 'All pictures load over https.' },
    { pts: 10, ok: !footerYear || +footerYear >= year - 1, title: 'Copyright year is current', detail: footerYear ? `The footer says ${footerYear}.` : 'No copyright year shown.' }
  ];

  const cats = [
    { id: 'speed', label: 'Speed', score: total(speed), checks: speed },
    { id: 'access', label: 'Accessibility', score: total(access), checks: access },
    { id: 'search', label: 'Search', score: total(search), checks: search },
    { id: 'polish', label: 'Polish', score: total(polish), checks: polish }
  ];
  const fixes = [...new Set(cats.flatMap(c => c.checks.filter(x => !x.ok && x.fix && x.fix.type !== 'link').map(x => x.fix.type)))];
  return { cats, weight: w, fixes, estimate: true };
}

const grade = (n) => (n >= 90 ? 'good' : n >= 50 ? 'ok' : 'poor');

module.exports = { score, pageWeight, weightScore, grade };
