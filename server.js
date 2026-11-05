require('dotenv').config();

const path = require('path');
const os = require('os');
const crypto = require('crypto');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { nanoid } = require('nanoid');

const db = require('./db');
const cache = require('./cache');
const mailer = require('./mailer');
const reports = require('./reports');
const billing = require('./billing');
const fonts = require('./fonts');
const icons = require('./icons');
const lookfeel = require('./lookfeel');
const cardLayouts = require('./cardlayouts');
const motionFx = require('./motionfx');
const nameFx = require('./namefx');
const headerColor = require('./headercolor');
const menuStyles = require('./menustyles');
const smoothScroll = require('./smoothscroll');
const splitText = require('./splittext');
const scrollFx = require('./scrollfx');
const extraFx = require('./extrafx');
const pinFx = require('./pinfx');
const filmFx = require('./filmfx');
const imgFx = require('./imgfx');
const heightFx = require('./heightfx');
const lookPacks = require('./lookpacks');
const videoMask = require('./videomask');
const wordStyle = require('./wordstyle');
const brandWall = require('./brandwall');
const cardCascade = require('./cardcascade');
const photoBanner = require('./photobanner');
const collageBlock = require('./collageblock');
const gradients = require('./gradients');
const glassFx = require('./glassfx');
const motionBlocks = require('./motionblocks');
const nodeCards = require('./nodecards');
const shapeBlock = require('./shapeblock');
const stackCards = require('./stackcards');
const heroCard = require('./herocard');
const aboutBlob = require('./aboutblob');
const thirdsBlock = require('./thirdsblock');
const mosaicHero = require('./mosaichero');
const crossBand = require('./crossband');
const adviceBlock = require('./adviceblock');
const photoBlend = require('./photoblend');
const patternBlock = require('./patternblock');
const overlapCard = require('./overlapcard');
const photoTabs = require('./phototabs');
const reviewCard = require('./reviewcard');
const twinPhotos = require('./twinphotos');
const ringCard = require('./ringcard');
const shapeForm = require('./shapeform');
const framedPhoto = require('./framedphoto');
const roundPhoto = require('./roundphoto');
const photoPairs = require('./photopairs');
const offsetPhoto = require('./offsetphoto');
const aboutBlocks = require('./aboutblocks');
const textBoxes = require('./textboxes');
const picBoxes = require('./picboxes');
const textStyles = require('./textstyles');
const elStyles = require('./elstyles');
const designLab = require('./designlab');
const brandKit = require('./brandkit');
const siteScore = require('./score');
const { buildChecklist } = require('./checklist');
const forms = require('./forms');
const redirects = require('./redirects');
const legal = require('./legal');
const backups = require('./backups');
const leadsLib = require('./leads');
const chat = require('./chat');
const googleReviews = require('./googlereviews');
const calc = require('./calc');
const intake = require('./intake');
const intakePdf = require('./intakepdf');
const grounding = require('./grounding');
const netlify = require('./netlify');
const payments = require('./payments');
const images = require('./images');
const { optimizeUpload } = images;
const cutout = require('./cutout');
const { hasAiProvider, generateCopy, generateGroundedCopy, complete: aiComplete } = require('./ai');
const chatedit = require('./chatedit');
const accents = require('./accents');
const industryDesign = require('./industry-design');
const designOptionsLib = require('./design-options');
const quality = require('./quality');
const designBrief = require('./design-brief');
const membersLib = require('./members');
const { ZipArchive } = require('archiver');
const extraThemes = require('./themes');
const templateLooks = require('./template-looks');
const { defaultSections, defaultTheme, defaultLayout, SECTION_KEYS } = require('./defaults');
const { scrapeUrl, safeFetch } = require('./scraper');
const { servicesWithSlugs, areasWithSlugs, cleanGaId, cleanPixelId } = require('./local');
const { scrapeSocialInspiration, applySocialInspiration } = require('./social');
const { findTemplate, fillTemplate } = require('./templates');
const booking = require('./booking');
const { videoInfo } = require('./video');
const { fetchPhotoSet, hasPhotoProvider, searchPhotosPage, pickerSources, searchUnsplashPage, recentUnsplash, trackUnsplashDownload } = require('./photos');
const photoCredits = require('./photocredits');
const { isValidEmail, isValidPassword, isValidHostname, isValidHexColor, isSafeUrl, str } = require('./validate');

// icon keys available for the "Why Choose Us" section — kept in sync with
// the inline SVG library rendered in views/public-site.ejs
const WHY_CHOOSE_ICONS = ['check', 'dollar', 'shield', 'clock', 'people', 'tools', 'star', 'truck', 'leaf', 'home'];

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

if (IS_PROD && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 16)) {
  console.warn('WARNING: SESSION_SECRET is missing or short. Set a long random value in .env before deploying.');
}

app.locals.fonts = fonts;
app.locals.photoCreditsFor = (site) => { try { return photoCredits.forSite(db, site); } catch { return null; } };
app.locals.extraThemes = extraThemes;
app.locals.formsLib = forms;
app.locals.legalLib = legal;
app.locals.calcLib = calc;
app.locals.intakeLib = intake;
app.locals.payLib = payments;
app.locals.accentsLib = accents;
app.locals.motionLib = require('./motion-presets');
app.locals.openHours = require('./openhours');
const sectionLibrary = require('./library/blueprints');
const sectionLibraryRegistry = require('./library');
app.locals.libRegistry = sectionLibraryRegistry;
app.locals.libCustoms = ctx => sectionLibrary.tailItems(ctx);
app.locals.libPlan = ctx => sectionLibrary.plan(ctx);
const styleLib = require('./stylelib');
const slPageLib = require('./stylelib-page');
app.locals.slPage = ctx => slPageLib.render(ctx);
const atelier = require('./atelier');
const mixPage = require('./mixpage');
app.locals.atelierPage = ctx => atelier.render(ctx);
app.locals.mixPage = (ctx, blocks) => mixPage.render(ctx, blocks);
app.locals.blockKinds = mixPage.BLOCK_KINDS;
app.locals.blockCatalog = require('./blockcatalog');
app.locals.hlHtml = require('./library/content').hlHtml;
app.locals.styleLibBlueprints = styleLib.BLUEPRINTS;
app.locals.libHeroData = ctx => require('./library/content').bind('hero', ctx);
app.locals.scrimHero = require('./scrimhero');
app.locals.libWrap = sectionLibrary.wrap;
app.locals.libTemplateId = site => findTemplate((site.sections.meta && site.sections.meta.businessType) || '').id;
app.locals.membersLib = require('./members');
app.locals.hasAi = hasAiProvider;
app.locals.leadsLibDefault = leadsLib.DEFAULT_TEXT;
app.locals.bookingLib = require('./booking');
app.locals.videoInfo = require('./video').videoInfo;
app.locals.icons = icons;
app.locals.lookfeel = lookfeel;
app.locals.cardLayouts = cardLayouts;
app.locals.motionFx = motionFx;
app.locals.nameFx = nameFx;
app.locals.headerColor = headerColor;
app.locals.menuStyles = menuStyles;
app.locals.smoothScroll = smoothScroll;
app.locals.splitText = splitText;
app.locals.scrollFx = scrollFx;
app.locals.extraFx = extraFx;
app.locals.pinFx = pinFx;
app.locals.filmFx = filmFx;
app.locals.imgFx = imgFx;
app.locals.heightFx = heightFx;
app.locals.lookPacks = lookPacks;
app.locals.videoMask = videoMask;
app.locals.wordStyle = wordStyle;
app.locals.brandWall = brandWall;
app.locals.cardCascade = cardCascade;
app.locals.photoBanner = photoBanner;
app.locals.collageBlock = collageBlock;
app.locals.gradients = gradients;
app.locals.glassFx = glassFx;
app.locals.motionBlocks = motionBlocks;
app.locals.nodeCards = nodeCards;
app.locals.shapeBlock = shapeBlock;
app.locals.stackCards = stackCards;
app.locals.heroCard = heroCard;
app.locals.aboutBlob = aboutBlob;
app.locals.thirdsBlock = thirdsBlock;
app.locals.mosaicHero = mosaicHero;
app.locals.crossBand = crossBand;
app.locals.adviceBlock = adviceBlock;
app.locals.overlapCard = overlapCard;
app.locals.photoTabs = photoTabs;
app.locals.reviewCard = reviewCard;
app.locals.twinPhotos = twinPhotos;
app.locals.ringCard = ringCard;
app.locals.shapeForm = shapeForm;
app.locals.framedPhoto = framedPhoto;
app.locals.roundPhoto = roundPhoto;
app.locals.photoPairs = photoPairs;
app.locals.offsetPhoto = offsetPhoto;
app.locals.aboutBlocks = aboutBlocks;
app.locals.photoBlend = photoBlend;
app.locals.patternBlock = patternBlock;
app.locals.textBoxes = textBoxes;
app.locals.picBoxes = picBoxes;
app.locals.petArt = require('./petart');
app.locals.textStyles = textStyles;
app.locals.elStyles = elStyles;
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.set('trust proxy', 1);
// Stripe webhooks need the exact raw bytes to verify the signature, so this
// route is registered before the body parsers.
app.post('/stripe/webhook', express.raw({ type: '*/*', limit: '1mb' }), (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  if (!billing.verifyWebhook(raw, req.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET)) return res.status(400).send('bad signature');
  let event;
  try { event = JSON.parse(raw); } catch (e) { return res.status(400).send('bad json'); }
  try { billing.applyEvent(db, event); } catch (err) { console.error('stripe webhook failed:', err.message); return res.status(500).send('error'); }
  res.json({ received: true });
});
// Big sites send many boxes in one save (about 17 per content block): the defaults (1000 boxes, 100 KB) refused a
// save with 25+ blocks, which the editor showed as "no connection"
app.use(express.urlencoded({ extended: true, limit: '5mb', parameterLimit: 50000 }));
app.use(express.json());
// Smaller pages: gzip text responses with Node's built-in zlib (no extra package)
const zlib = require('zlib');
app.use((req, res, next) => {
  if (!/\bgzip\b/.test(req.headers['accept-encoding'] || '')) return next();
  const send = res.send.bind(res);
  res.send = function (body) {
    if (res.headersSent || res.get('Content-Encoding')) return send(body);
    let ct = String(res.get('Content-Type') || '');
    if (!ct && typeof body === 'string') { res.type('html'); ct = 'text/html'; }
    if ((typeof body === 'string' || Buffer.isBuffer(body)) && body.length > 1024 && /text|json|xml|svg/i.test(ct)) {
      res.set('Content-Encoding', 'gzip');
      res.vary('Accept-Encoding');
      return send(zlib.gzipSync(Buffer.isBuffer(body) ? body : Buffer.from(body), { level: 6 }));
    }
    return send(body);
  };
  next();
});

// uploaded photos get random file names, so browsers can keep them for a month
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads'), { maxAge: '30d', immutable: true }));
// the shared site styles: the page asks for them with a version, so browsers keep them until they change
const SITE_CSS = path.join(__dirname, 'public', 'sg-site.css');
app.locals.siteCssV = require('crypto').createHash('sha1').update(fs.readFileSync(SITE_CSS)).digest('hex').slice(0, 10);
app.get('/sg-site.css', (req, res, next) => {
  if (req.query.v !== app.locals.siteCssV) return next();
  res.sendFile(SITE_CSS, { maxAge: '365d', immutable: true });
});
app.use(express.static(__dirname + '/public'));
// Stock photos read by the page (Photo that blends in, public/sg-fx.js): browsers won't let a page read the pixels of
// another site's photo, so the page asks for it here. Only the stock photo sites' image hosts, only images, at most
// 15 MB; a few are kept in memory for a while.
const PHOTO_HOSTS = ['images.pexels.com', 'images.unsplash.com', 'plus.unsplash.com', 'cdn.pixabay.com'];
const photoCache = new Map();
app.get('/sg-photo', async (req, res) => {
  let u; try { u = new URL(String(req.query.u || '')); } catch (e) { return res.status(400).end(); }
  if (u.protocol !== 'https:' || !PHOTO_HOSTS.includes(u.hostname)) return res.status(400).end();
  const key = u.href, hit = photoCache.get(key);
  const send = (c) => { res.set({ 'Content-Type': c.type, 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' }); res.end(c.buf); };
  if (hit) return send(hit);
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000);
    const r = await fetch(key, { signal: ctl.signal, redirect: 'error' }); clearTimeout(t);
    const type = String(r.headers.get('content-type') || '').split(';')[0].trim();
    if (!r.ok || !/^image\/(jpeg|png|webp|avif|gif)$/.test(type)) return res.status(502).end();
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 15 * 1024 * 1024) return res.status(502).end();
    photoCache.set(key, { type, buf }); if (photoCache.size > 30) photoCache.delete(photoCache.keys().next().value);
    send({ type, buf });
  } catch (e) { res.status(502).end(); }
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7, httpOnly: true, sameSite: 'lax', secure: IS_PROD }
}));

// ---- rate limiting ----
// Auth endpoints and the URL importer (which makes this server fetch
// arbitrary third-party pages) are the routes most worth throttling.
// The test suite runs dozens of signups/imports/generates from a single IP
// in minutes (each test signs up its own user for isolation), which isn't a
// real abuse pattern — so limiting is skipped when running under the test
// harness (identified by DB_PATH, which only the test suite sets).
const isTestEnv = !!process.env.DB_PATH;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  message: 'Too many attempts. Please try again in a few minutes.'
});

const importLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  message: 'Too many import attempts. Please try again in a few minutes.'
});

const generateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  message: 'Too many generate attempts. Please try again in a few minutes.'
});

// Public contact-form submissions (unauthenticated, one per visitor's site
// visit) get their own, stricter limiter since this endpoint is reachable
// by anyone who finds a published site.
const contactLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  message: 'Too many submissions from this device. Please try again later.'
});

// A small set of pleasant color pairs, assigned deterministically per
// business-template category so generated sites aren't all the same blue.
const GENERATE_PALETTE = [
  { primaryColor: '#2563eb', accentColor: '#1e293b' }, // blue
  { primaryColor: '#0f766e', accentColor: '#134e4a' }, // teal
  { primaryColor: '#b45309', accentColor: '#78350f' }, // amber
  { primaryColor: '#be123c', accentColor: '#881337' }, // rose
  { primaryColor: '#4d7c0f', accentColor: '#365314' }, // olive
  { primaryColor: '#7c3aed', accentColor: '#4c1d95' }, // violet
  { primaryColor: '#0369a1', accentColor: '#0c4a6e' }, // sky
  { primaryColor: '#c2410c', accentColor: '#7c2d12' }  // burnt orange
];

function colorForCategory(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return GENERATE_PALETTE[hash % GENERATE_PALETTE.length];
}

// A darker shade of a brand color, used as the accent when the intake form
// supplies only one color.
function darkenHex(hex, amount = 0.45) {
  let h = hex.replace('#', '');
  if (h.length === 3 || h.length === 4) h = h.split('').map(c => c + c).join('');
  h = h.slice(0, 6);
  if (h.length !== 6) return hex;
  const n = parseInt(h, 16);
  const ch = (shift) => Math.round(((n >> shift) & 255) * (1 - amount));
  return '#' + [16, 8, 0].map(sh => ch(sh).toString(16).padStart(2, '0')).join('');
}

// ---- uploads ----
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, 'public', 'uploads')),
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '.jpg').toLowerCase().slice(0, 5);
      cb(null, `${nanoid(12)}${ext}`);
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(png|jpe?g|gif|webp|svg\+xml)$/.test(file.mimetype)) {
      return cb(new Error('Only image files are allowed.'));
    }
    cb(null, true);
  }
});

// ---- helpers ----
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  next();
}

function slugify(s) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'site';
}

function uniqueSlug(base) {
  let slug = slugify(base);
  let candidate = slug;
  let i = 1;
  const exists = (s) => db.prepare('SELECT id FROM sites WHERE slug = ?').get(s);
  while (exists(candidate)) {
    candidate = `${slug}-${i}`;
    i++;
  }
  return candidate;
}

function getSite(id) {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(id);
  if (!row) return null;
  return hydrateSite(row);
}

function hydrateSite(row) {
  return {
    ...row,
    theme: JSON.parse(row.theme),
    sections: mergeSectionsWithDefaults(JSON.parse(row.sections)),
    layout: safeParseLayout(row.layout)
  };
}

// A site saved before a new section type or field existed (e.g. "Why Choose
// Us", or the social/acceptSubmissions fields on contact) won't have it in
// its stored JSON. Fill in just the missing pieces from the defaults so
// older sites keep working in the editor and on the public page, without
// touching anything the site owner actually set.
function mergeSectionsWithDefaults(sections) {
  const defaults = defaultSections();
  const merged = { ...defaults, ...sections };
  for (const key of Object.keys(defaults)) {
    if (sections[key] && typeof sections[key] === 'object' && typeof defaults[key] === 'object') {
      merged[key] = { ...defaults[key], ...sections[key] };
    }
  }
  merged.booking = booking.mergeBooking(sections.booking);
  // sites saved before the Image + Scrim hero keep their classic hero; only new sites start on "automatic"
  if (!sections.hero || !Object.prototype.hasOwnProperty.call(sections.hero, 'design')) merged.hero.design = '';
  if (merged.contact) {
    merged.contact.social = { ...defaults.contact.social, ...(sections.contact && sections.contact.social) };
  }
  return merged;
}

// A content block's id (stable, so the Blocks page and the Page sections list can point at it)
const BLK_ID = /^b[a-z0-9]{7}$/;
const BLK_KEY = /^blk:b[a-z0-9]{7}$/;
function safeParseLayout(raw) {
  let parsed = {};
  try { parsed = JSON.parse(raw || '{}'); } catch { parsed = {}; }
  const order = Array.isArray(parsed.order) && parsed.order.length ? parsed.order : defaultLayout().order;
  // make sure every known section key is present exactly once, even if the
  // stored layout predates a newly added section type
  const known = new Set(SECTION_KEYS);
  const cleanOrder = order.filter(k => known.has(k));
  for (const k of SECTION_KEYS) if (!cleanOrder.includes(k)) cleanOrder.push(k);
  const hidden = Array.isArray(parsed.hidden) ? [...new Set(parsed.hidden.filter(k => known.has(k) || BLK_KEY.test(k)))] : [];
  // items: the editor's Page sections list, which also holds the content blocks (blk:<id>) where the owner put them
  const items = [...new Set((Array.isArray(parsed.items) ? parsed.items : []).filter(k => known.has(k) || BLK_KEY.test(k)))];
  for (const k of cleanOrder) if (!items.includes(k)) items.push(k);
  return { order: cleanOrder, hidden, items: items.filter(k => !known.has(k) || cleanOrder.includes(k)).slice(0, 60) };
}
const newBlockId = () => 'b' + crypto.randomBytes(8).toString('hex').replace(/[^a-z0-9]/g, '').slice(0, 7).padEnd(7, '0');
// Blocks saved before they had ids get one (saved at once, so the id stays the same)
function ensureBlockIds(site) {
  const items = (site.sections.blocks && site.sections.blocks.items) || [];
  const seen = new Set(); let changed = false;
  for (const b of items) { if (!BLK_ID.test(b.id || '') || seen.has(b.id)) { b.id = newBlockId(); changed = true; } seen.add(b.id); }
  if (changed) db.prepare('UPDATE sites SET sections = ? WHERE id = ?').run(JSON.stringify(site.sections), site.id);
}
// On a Blocks home page the home page's content blocks are blocks of the page too ({ k: 'blk', v: id }): a new one
// joins the page (right under the top banner when set near the top, otherwise at the end), a deleted one or one moved
// to another page leaves it. One hidden in Page sections keeps its spot but isn't drawn.
function syncMixBlocks(mix, sections, hidden) {
  const off = new Set((hidden || []).filter(k => BLK_KEY.test(k)).map(k => k.slice(4)));
  const home = ((sections.blocks && sections.blocks.items) || []).filter(b => (b.page || 'home') === 'home' && BLK_ID.test(b.id || ''));
  const ids = new Set(home.map(b => b.id));
  const out = (mix || []).filter(m => m.k !== 'blk' || ids.has(m.v)).filter((m, i, a) => m.k !== 'blk' || a.findIndex(x => x.k === 'blk' && x.v === m.v) === i);
  let top = 1;
  for (const b of home) {
    if (off.has(b.id) || out.some(m => m.k === 'blk' && m.v === b.id)) continue;
    if (b.place === 'top') out.splice(Math.min(top++, out.length), 0, { k: 'blk', v: b.id }); else out.push({ k: 'blk', v: b.id });
  }
  return mixPage.clean(out);
}

// Undo / redo. Every change saved through saveVersion first records the site as it stands. Autosaves while
// someone keeps typing (less than 2.5 seconds apart) count as one step. A new change clears the redo list.
const UNDO_KEEP = 50, UNDO_BURST_MS = 2500;
const lastAutosave = new Map();
function trimUndo(siteId, kind) {
  db.prepare(`DELETE FROM site_undo WHERE id IN (SELECT id FROM site_undo WHERE site_id = ? AND kind = ? ORDER BY id DESC LIMIT -1 OFFSET ${UNDO_KEEP})`).run(siteId, kind);
}
function pushUndo(siteId, kind = 'undo') {
  const row = db.prepare('SELECT name, theme, sections, layout FROM sites WHERE id = ?').get(siteId);
  if (!row) return;
  const top = db.prepare('SELECT name, theme, sections, layout FROM site_undo WHERE site_id = ? AND kind = ? ORDER BY id DESC LIMIT 1').get(siteId, kind);
  if (top && top.name === row.name && top.theme === row.theme && top.sections === row.sections && top.layout === row.layout) return;
  db.prepare('INSERT INTO site_undo (site_id, kind, name, theme, sections, layout) VALUES (?, ?, ?, ?, ?, ?)').run(siteId, kind, row.name, row.theme, row.sections, row.layout || '{}');
  trimUndo(siteId, kind);
}
function recordChange(siteId, autosave) {
  const now = Date.now(), last = lastAutosave.get(siteId) || 0;
  if (autosave) lastAutosave.set(siteId, now); else lastAutosave.delete(siteId);
  if (autosave && now - last < UNDO_BURST_MS) return;
  pushUndo(siteId, 'undo');
  db.prepare("DELETE FROM site_undo WHERE site_id = ? AND kind = 'redo'").run(siteId);
}
function undoCounts(siteId) {
  const n = (kind) => db.prepare('SELECT COUNT(*) n FROM site_undo WHERE site_id = ? AND kind = ?').get(siteId, kind).n;
  return { undo: n('undo'), redo: n('redo') };
}

function saveVersion(siteId, theme, sections, layout, label = '') {
  recordChange(siteId, !label);
  db.prepare(
    'INSERT INTO site_versions (site_id, theme, sections, layout, label) VALUES (?, ?, ?, ?, ?)'
  ).run(siteId, JSON.stringify(theme), JSON.stringify(sections), JSON.stringify(layout), label);
  // keep only the most recent 10 versions per site
  const old = db.prepare(
    'SELECT id FROM site_versions WHERE site_id = ? ORDER BY id DESC LIMIT -1 OFFSET 10'
  ).all(siteId);
  if (old.length) {
    const ids = old.map(o => o.id);
    db.prepare(`DELETE FROM site_versions WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
  }
}

// Publish history: a snapshot each time the owner publishes (live toggle or Netlify), so any earlier published
// state can be previewed and rolled back to. Newest 20 kept per site.
function recordPublish(site, kind, deployId = '', label = '') {
  db.prepare('INSERT INTO publish_history (site_id, kind, theme, sections, layout, deploy_id, label) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(site.id, kind, JSON.stringify(site.theme), JSON.stringify(site.sections), JSON.stringify(site.layout), String(deployId || ''), label);
  const old = db.prepare('SELECT id FROM publish_history WHERE site_id = ? ORDER BY id DESC LIMIT -1 OFFSET 20').all(site.id);
  if (old.length) db.prepare(`DELETE FROM publish_history WHERE id IN (${old.map(() => '?').join(',')})`).run(...old.map(o => o.id));
}

function invalidateSiteCache(site) {
  // the render cache is keyed per page ("slug:home", "slug:about", …), so
  // clearing a site means clearing every page it might have cached
  cache.invalidatePrefix(`${site.slug}:`);
  if (site.custom_domain) cache.invalidatePrefix(`${site.custom_domain}:`);
}

// ---- multi-page public site ----
// Every section except the hero gets its own page; the hero (plus the
// featured photo row) is the home page. PAGE_KEYS is SECTION_KEYS minus
// 'hero', i.e. the set of valid :page route params.
// (extraPages is a section in the editor but each of its items is its own page at /p/<name>)
const PAGE_KEYS = SECTION_KEYS.filter(k => k !== 'hero' && k !== 'extraPages');
// /<prefix>/<item> pages: which page type each URL prefix serves
const ITEM_ROUTES = { services: 'service', areas: 'area', blog: 'post', p: 'extra' };
const PAGE_LABELS = {
  about: 'About', services: 'Services', testimonials: 'Reviews',
  whyChoose: 'Why Choose Us', gallery: 'Gallery', faq: 'FAQ', blog: 'News & Tips', hours: 'Hours', contact: 'Contact'
};

// Some pages only make sense once there's something to show (no point
// linking to an empty testimonials or gallery page); about/services/contact
// always exist once their section isn't hidden.
function sectionHasContent(site, key) {
  const s = site.sections;
  switch (key) {
    case 'testimonials': return !!(s.testimonials && (s.testimonials.items.length || (s.testimonials.googleMode === 'reviews' && googleReviews.forSite(db, { id: site.id, sections: s }))));
    case 'whyChoose': return !!(s.whyChoose && s.whyChoose.items.length);
    case 'gallery': return !!(s.gallery && (s.gallery.images.length || (s.gallery.beforeAfter || []).length));
    case 'faq': return !!(s.faq && s.faq.items.length);
    case 'blog': return !!(s.blog && s.blog.items.length);
    case 'hours': return !!(s.hours && s.hours.items.length);
    default: return true; // about, services, contact
  }
}

function pageIsAvailable(site, key) {
  if (!PAGE_KEYS.includes(key)) return false;
  const hidden = site.layout ? site.layout.hidden : [];
  if (hidden.includes(key)) return false;
  return sectionHasContent(site, key);
}

// Owner-written extra pages (Financing, Service plans, ...): each item with
// text is its own page, shown wherever the "Extra pages" block sits in the order.
function extraPageList(site) {
  const hidden = (site.layout && site.layout.hidden) || [];
  if (hidden.includes('extraPages')) return [];
  return servicesWithSlugs((site.sections.extraPages.items || []).filter(i => i.title && i.body));
}

function buildNavPages(site, basePath, serverFeatures = true) {
  const order = (site.layout && site.layout.order) || PAGE_KEYS;
  const nav = [];
  for (const k of order) {
    if (k === 'extraPages') {
      for (const ex of extraPageList(site)) nav.push({ key: `p:${ex.slug}`, label: ex.title, href: `${basePath}/p/${ex.slug}` });
    } else if (pageIsAvailable(site, k)) {
      nav.push({
        key: k,
        label: (site.sections[k] && site.sections[k].heading) || PAGE_LABELS[k] || k,
        href: `${basePath}/${k}`
      });
    }
  }
  if (serverFeatures && site.sections.members && site.sections.members.enabled) nav.push({ key: 'members', label: membersLib.clean(site.sections.members).navLabel, href: `${basePath}/members` });
  if (serverFeatures && calc.isUsable(site.sections.calculator)) nav.push({ key: 'estimate', label: calc.normalize(site.sections.calculator).heading, href: `${basePath}/estimate` });
  return nav;
}

// Shared renderer for the home page and every section page, used by the
// slug-based route, the custom-domain route, and the editor's preview.
// `next` is only needed for the custom-domain middleware (so a render
// error can fall through instead of crashing); the ordinary routes pass
// null and just throw, matching how they behaved before.
// the site's own "page not found" page (same header, footer and style as the rest of the site)
function siteNotFound(req, res, next, siteIn, basePath, preview) {
  return renderSitePage(req, res.status(404), next, { site: siteIn, page: 'notfound', basePath, preview: !!preview, cacheKey: null });
}

function renderSitePage(req, res, next, { site: siteIn, page, basePath, preview, contactSent, contactError, cacheKey, serviceSlug, itemSlug, reviewThanks, reviewError, bookingView, hideMotionBar, memberView, calm, bare }) {
  const site = extraThemes.withPageStyle(siteIn, page);
  const slugArg = itemSlug || serviceSlug;
  const trustData = site.sections.trust || {};
  const services = servicesWithSlugs(site.sections.services.items);
  const areas = areasWithSlugs(trustData.serviceAreas, trustData.areaText);
  const posts = servicesWithSlugs(site.sections.blog.items);
  const extras = extraPageList(site);
  let service = null, area = null, post = null, extra = null;
  if (page === 'service') {
    service = pageIsAvailable(site, 'services') ? services.find(x => x.slug === slugArg) : null;
    if (!service) return siteNotFound(req, res, next, siteIn, basePath, preview);
  } else if (page === 'area') {
    area = areas.find(x => x.slug === slugArg);
    if (!area) return siteNotFound(req, res, next, siteIn, basePath, preview);
  } else if (page === 'post') {
    post = pageIsAvailable(site, 'blog') ? posts.find(x => x.slug === slugArg) : null;
    if (!post) return siteNotFound(req, res, next, siteIn, basePath, preview);
  } else if (page === 'extra') {
    extra = extras.find(x => x.slug === slugArg);
    if (!extra) return siteNotFound(req, res, next, siteIn, basePath, preview);
  } else if (page === 'book') {
    if (!site.sections.booking.enabled) return siteNotFound(req, res, next, siteIn, basePath, preview);
  } else if (page === 'members') {
    if (!(site.sections.members && site.sections.members.enabled)) return siteNotFound(req, res, next, siteIn, basePath, preview);
  } else if (page !== 'home' && page !== 'thank-you' && page !== 'review' && page !== 'notfound' && !(legal.PAGES.includes(page) && legal.enabled(site)) && !(page === 'estimate' && calc.isUsable(site.sections.calculator)) && !pageIsAvailable(site, page)) {
    return siteNotFound(req, res, next, siteIn, basePath, preview);
  }
  // cookie-free page-view count (live pages only, not the owner's preview, not bots)
  if (!preview && page !== 'notfound' && req.method === 'GET' && !reports.isBot(req.get('user-agent'))) {
    try { reports.recordView(db, site.id, service ? `services/${service.slug}` : area ? `areas/${area.slug}` : post ? `blog/${post.slug}` : extra ? `p/${extra.slug}` : page); } catch (e) { /* counting must never break a page */ }
  }
  const origin = `${req.protocol}://${req.get('host')}`;
  if (cacheKey) cacheKey = `${cacheKey}@${req.get('host')}`;
  const skipCache = !cacheKey || page === 'book' || page === 'estimate' || contactSent || contactError || reviewThanks || reviewError;
  if (!skipCache) {
    const cached = cache.get(cacheKey);
    if (cached) return res.send(cached);
  }
  const locals = {
    tierOverride: preview ? str(req.query && req.query.tier, 12) : '',
    site, preview: !!preview, hideMotionBar: !!hideMotionBar, calm: !!(preview && calm), bare: !!(preview && bare), page, basePath, origin, services, service, areas, area, posts, post, extras, extra,
    navPages: buildNavPages(site, basePath),
    estimateError: str(req.query && req.query.error, 140),
    googleData: (preview ? null : googleReviews.forSite(db, site, () => cache.clear())),
    contactSent: !!contactSent, contactError: !!contactError,
    reviewThanks: !!reviewThanks, reviewError: !!reviewError,
    bookingView: bookingView || { mode: 'form', values: {} },
    memberView: memberView || { mode: 'login' },
    payOn: payReady(siteIn, site), payCur: (site.sections.payments || {}).currency || 'usd', buyLabel: (site.sections.payments || {}).buyLabel || 'Pay online'
  };
  res.render('public-site', locals, (err, html) => {
    if (err) {
      console.error('Render error:', err.message);
      if (next) return next(err);
      return res.status(500).send('Something went wrong rendering this page.');
    }
    html = wordStyle.apply(images.optimizeHtml(html, { onVariants: () => cache.clear() }));
    if (!skipCache) cache.set(cacheKey, html);
    res.send(html);
  });
}

// Emails the site owner about a new lead. Never blocks or fails the visitor's
// submission: it runs in the background and any error is only logged.
function notifyOwner(req, row, lead, imageUrl) {
  if (!mailer.isConfigured()) return;
  try {
    const contact = hydrateSite(row).sections.contact;
    const to = (contact.notifyEmail && isValidEmail(contact.notifyEmail)) ? contact.notifyEmail : contact.email;
    if (!to) return;
    const base = `${req.protocol}://${req.get('host')}`;
    mailer.sendLeadAlert({
      to,
      siteName: row.name,
      lead,
      leadsUrl: `${base}/sites/${row.id}/leads`,
      photoUrl: imageUrl ? `${base}${imageUrl}` : ''
    }).catch(err => console.error('Lead email failed:', err.message));
  } catch (err) {
    console.error('Lead email failed:', err.message);
  }
}

const reviewLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false,
  skip: () => isTestEnv, message: 'Too many submissions from this device. Please try again later.'
});
const reviewRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  skip: () => isTestEnv, message: 'Too many review requests sent this hour. Please try again later.'
});

// A customer-written review. It is only stored as "pending"; nothing appears
// on the site until the owner approves it.
function handleReviewSubmission(req, res, row, basePath) {
  if (!row.published) return res.status(404).render('not-found');
  if (billing.isSuspended(row)) return res.status(503).render('suspended', { name: row.name });
  const b = req.body || {};
  const back = (q) => res.redirect(`${basePath}/review?${q}`);
  if (b.website) return back('thanks=1'); // honeypot
  const name = str(b.name, 80);
  const rating = parseInt(b.rating, 10);
  const quote = str(b.quote, 800);
  if (!(rating >= 1 && rating <= 5) || quote.length < 10) return back('error=1');
  const info = db.prepare('INSERT INTO review_submissions (site_id, name, rating, quote) VALUES (?, ?, ?, ?)')
    .run(row.id, name, rating, quote);
  try {
    const contact = hydrateSite(row).sections.contact;
    const to = (contact.notifyEmail && isValidEmail(contact.notifyEmail)) ? contact.notifyEmail : contact.email;
    if (to && mailer.isConfigured()) {
      mailer.sendReviewAlert({
        to, siteName: row.name, review: { name, rating, quote },
        reviewsUrl: `${req.protocol}://${req.get('host')}/sites/${row.id}/reviews`
      }).catch(err => console.error('Review alert failed:', err.message));
    }
  } catch (err) { console.error('Review alert failed:', err.message); }
  void info;
  back('thanks=1');
}

// One place every new lead goes through (contact form, chat, estimate): store it, alert the owner,
// send the optional receipt, and queue the optional follow-up emails.
function recordLead(req, row, lead, imageUrl, source) {
  const info = db.prepare(
    'INSERT INTO contact_submissions (site_id, name, email, phone, message, image_url, service, answers, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(row.id, lead.name, lead.email, lead.phone, lead.message, imageUrl || '', lead.service || '', (lead.answers || []).length ? JSON.stringify(lead.answers) : '', source || 'form');
  notifyOwner(req, row, lead, imageUrl || '');
  autoReplyToVisitor(row, lead.email);
  try { leadsLib.enqueue(db, info.lastInsertRowid, row.id, hydrateSite(row).sections.contact.followUp); } catch (e) { console.error('Follow-up queue failed:', e.message); }
  return info.lastInsertRowid;
}

// Shared contact-form submission handler for both the slug-based route and
// the custom-domain route — see the two POST routes near the bottom.
function handleContactSubmission(req, res, row, basePath) {
  upload.single('photo')(req, res, async (err) => {
    if (!row.published) return res.status(404).render('not-found');
    if (billing.isSuspended(row)) return res.status(503).render('suspended', { name: row.name });
    // an uploaded photo that never gets stored as a lead shouldn't pile up on disk
    const redirectTo = (flag, keepFile) => {
      if (!keepFile && req.file) fs.rm(req.file.path, { force: true }, () => {});
      // a real submission lands on the thank-you page (where conversion
      // tracking fires); errors and bot traps go back to the form
      if (flag === 'thank_you') return res.redirect(`${basePath}/thank-you`);
      res.redirect(`${basePath}/contact?${flag}=1`);
    };
    if (err) return redirectTo('contact_error');
    const b = req.body || {};
    // honeypot: a real visitor never fills this hidden field in; a bot that
    // does gets a normal-looking success without anything being stored
    if (b.website) return redirectTo('contact_sent');
    const siteData = hydrateSite(row);
    const customForm = forms.normalize(siteData.sections.contact.form);
    let name, email, phone, message, service, answers = [];
    if (customForm.mode === 'custom') {
      const result = forms.validate(customForm, b, { services: siteData.sections.services.items.map(it => it.title), hasFile: !!req.file, isValidEmail });
      if (!result.ok) return redirectTo('contact_error');
      ({ name, email, phone, message, service } = result.values);
      answers = result.answers;
    } else {
      name = str(b.name, 100);
      email = isValidEmail(b.email || '') ? str(b.email, 254) : '';
      phone = str(b.phone, 40);
      message = str(b.message, 2000);
      // only accept a service the site actually lists
      const requested = str(b.service, 60);
      service = requested && siteData.sections.services.items.some(it => it.title === requested) ? requested : '';
    }
    if (!name && !email && !phone) return redirectTo('contact_error');
    if (req.file) await optimizeUpload(req.file, 1600);
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : '';
    recordLead(req, row, { name, email, phone, message, service, answers }, imageUrl, 'form');
    redirectTo('thank_you', true);
  });
}

// Optional receipt email to the visitor ("we got your request"). Background,
// best-effort, and only when the owner switched it on and the visitor gave an email.
function autoReplyToVisitor(row, visitorEmail) {
  if (!visitorEmail || !mailer.isConfigured()) return;
  try {
    const contact = hydrateSite(row).sections.contact;
    if (!contact.autoReply) return;
    const text = contact.autoReplyText ||
      `Thanks for contacting ${row.name}. We received your request and will be in touch.` +
      (contact.phone ? ` If it is urgent, please call ${contact.phone}.` : '');
    const replyTo = (contact.notifyEmail && isValidEmail(contact.notifyEmail)) ? contact.notifyEmail : contact.email;
    mailer.sendAutoReply({ to: visitorEmail, siteName: row.name, text, replyTo })
      .catch(err => console.error('Auto-reply failed:', err.message));
  } catch (err) {
    console.error('Auto-reply failed:', err.message);
  }
}

function wantsJson(req) {
  return req.xhr || (req.headers.accept || '').includes('application/json') || req.headers['x-requested-with'] === 'fetch';
}

// "a, b\nc" -> ['a', 'b', 'c'] (trimmed, de-duplicated, length- and count-capped)
function splitList(value, maxLen, maxCount) {
  const out = [];
  for (const part of String(value || '').split(/[\n,;]+/)) {
    const t = str(part, maxLen);
    if (t && !out.some(o => o.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out.slice(0, maxCount);
}

function parseSectionsFromBody(b) {
  const cap = (v, n) => str(v, n);
  return {
    hero: {
      headline: cap(b.hero_headline, 100),
      subheadline: cap(b.hero_subheadline, 160),
      imageUrl: isSafeUrl(b.hero_imageUrl) ? cap(b.hero_imageUrl, 500) : '',
      slides: ([]).concat(b.hero_slide || []).filter(u => u && isSafeUrl(u)).map(u => cap(u, 500)).slice(0, 5),
      ctaText: cap(b.hero_ctaText, 40),
      ctaLink: isSafeUrl(b.hero_ctaLink) ? cap(b.hero_ctaLink, 300) : '#contact',
      trustText: cap(b.hero_trustText, 160),
      quickLinks: b.hero_quickLinks === '1',
      float: accents.HERO_FLOATS.includes(b.hero_float) ? b.hero_float : '',
      edge: ['wave', 'scallop'].includes(b.hero_edge) ? b.hero_edge : '',
      focalX: Math.max(0, Math.min(100, Number.isFinite(parseFloat(b.hero_focalX)) ? Math.round(parseFloat(b.hero_focalX)) : 50)),
      focalY: Math.max(0, Math.min(100, Number.isFinite(parseFloat(b.hero_focalY)) ? Math.round(parseFloat(b.hero_focalY)) : 50)),
      overlay: ['15', '30', '45', '60', '75'].includes(String(b.hero_overlay)) ? String(b.hero_overlay) : '',
      align: ['left', 'center', 'right'].includes(b.hero_align) ? b.hero_align : '',
      videoUrl: (() => { const u = str(b.hero_videoUrl, 500).trim(); const v = isSafeUrl(u) && videoInfo(u); return v && v.kind === 'file' ? u : ''; })(),
      stickers: lookfeel.cleanStickers(b.hero_sticker),
      rotate: b.hero_rotate === '1' || b.hero_rotate === 'on',
      rotatePrefix: cap(b.hero_rotatePrefix, 40),
      highlight: cap(b.hero_highlight, 40),
      eyebrow: cap(b.hero_eyebrow, 60),
      pill: ['accent', 'lime'].includes(b.hero_pill) ? b.hero_pill : '',
      cards: ([]).concat(b.hero_card_title || []).map((t, i) => ({ title: cap(t, 40), text: cap(([]).concat(b.hero_card_text || [])[i], 140) })).filter(c => c.title).slice(0, 4),
      ...app.locals.scrimHero.clean({ design: b.hero_design, scrim: b.hero_scrim, scrimLayout: b.hero_scrimLayout })
    },
    about: {
      heading: cap(b.about_heading, 60),
      eyebrow: cap(b.about_eyebrow, 40),
      body: cap(b.about_body, 2000),
      imageUrl: isSafeUrl(b.about_imageUrl) ? cap(b.about_imageUrl, 500) : '',
      imageAlt: cap(b.about_imageAlt, 140)
    },
    services: {
      heading: cap(b.services_heading, 60),
      eyebrow: cap(b.services_eyebrow, 40),
      items: ([]).concat(b.service_title || []).map((title, i) => ({
        title: cap(title, 60),
        description: cap(([]).concat(b.service_description || [])[i], 300),
        detail: cap(([]).concat(b.service_detail || [])[i], 1500),
        pay: String(([]).concat(b.service_pay || [])[i] || '').replace(/[^0-9.]/g, '').slice(0, 10),
        imageUrl: isSafeUrl(([]).concat(b.service_image || [])[i]) ? cap(([]).concat(b.service_image || [])[i], 500) : '',
        image2: isSafeUrl(([]).concat(b.service_image2 || [])[i]) ? cap(([]).concat(b.service_image2 || [])[i], 500) : '',
        icon: icons.ICONS[([]).concat(b.service_icon || [])[i]] ? ([]).concat(b.service_icon || [])[i] : '',
        seoTitle: cap(([]).concat(b.service_seoTitle || [])[i], 70),
        seoDescription: cap(([]).concat(b.service_seoDescription || [])[i], 160)
      })).filter(item => item.title || item.description).slice(0, 12)
    },
    testimonials: {
      heading: cap(b.testimonials_heading, 60),
      eyebrow: cap(b.testimonials_eyebrow, 40),
      display: ['carousel', 'wall'].includes(b.testimonials_display) ? b.testimonials_display : 'grid',
      googlePlaceId: googleReviews.cleanPlaceId(b.testimonials_googlePlaceId),
      googleMode: ['badge', 'reviews'].includes(b.testimonials_googleMode) ? b.testimonials_googleMode : '',
      items: ([]).concat(b.testimonial_quote || []).map((quote, i) => {
        const rating = parseInt(([]).concat(b.testimonial_rating || [])[i], 10);
        return {
          quote: cap(quote, 500),
          author: cap(([]).concat(b.testimonial_author || [])[i], 80),
          rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : 0,
          date: cap(([]).concat(b.testimonial_date || [])[i], 40),
          photo: (u => (u && isSafeUrl(u) ? str(u, 500) : ''))(([]).concat(b.testimonial_photo || [])[i])
        };
      }).filter(item => item.quote).slice(0, 30)
    },
    whyChoose: {
      heading: cap(b.whyChoose_heading, 60),
      eyebrow: cap(b.whyChoose_eyebrow, 40),
      items: ([]).concat(b.whyChoose_title || []).map((title, i) => ({
        icon: WHY_CHOOSE_ICONS.includes(([]).concat(b.whyChoose_icon || [])[i]) ? ([]).concat(b.whyChoose_icon || [])[i] : 'check',
        title: cap(title, 50),
        text: cap(([]).concat(b.whyChoose_text || [])[i], 160),
        imageUrl: (u => (u && isSafeUrl(u) ? str(u, 500) : ''))(([]).concat(b.whyChoose_image || [])[i])
      })).filter(item => item.title || item.text).slice(0, 8)
    },
    gallery: {
      heading: cap(b.gallery_heading, 60),
      eyebrow: cap(b.gallery_eyebrow, 40),
      ...(() => {
        const alts = ([]).concat(b.gallery_alt || []);
        const rows = ([]).concat(b.gallery_image || []).map((u, i) => ({ u: str(u, 500), a: str(alts[i], 140) })).filter(r => r.u && isSafeUrl(r.u)).slice(0, 20);
        return { images: rows.map(r => r.u), alts: rows.map(r => r.a) };
      })(),
      beforeAfter: ([]).concat(b.ba_before || []).map((before, i) => ({
        before: isSafeUrl(before) ? str(before, 500) : '',
        after: isSafeUrl(([]).concat(b.ba_after || [])[i]) ? str(([]).concat(b.ba_after || [])[i], 500) : '',
        caption: cap(([]).concat(b.ba_caption || [])[i], 120)
      })).filter(p => p.before && p.after).slice(0, 6)
    },
    custom: { items: parseCustomFromBody(b) },
    blocks: { items: parseBlocksFromBody(b) },
    texts: { items: textBoxes.fromBody(b.texts_json), styles: textStyles.fromBody(b.tstyles_json), elems: elStyles.fromBody(b.estyles_json), pics: picBoxes.fromBody(b.pics_json) },
    trust: {
      badges: splitList(b.trust_badges, 40, 8),
      stats: ([]).concat(b.trust_stat_value || []).map((value, i) => ({
        value: cap(value, 14),
        label: cap(([]).concat(b.trust_stat_label || [])[i], 40)
      })).filter(st => st.value && st.label).slice(0, 4),
      serviceAreas: splitList(b.trust_serviceAreas, 50, 30),
      legalNote: cap(b.trust_legalNote, 300),
      areaText: (() => {
        const names = ([]).concat(b.area_name || []);
        const texts = ([]).concat(b.area_text || []);
        const map = {};
        names.forEach((n, i) => { const t = str(texts[i], 1500); if (n && t) map[str(n, 50)] = t; });
        return map;
      })(),
      logosHeading: cap(b.trust_logosHeading, 60),
      logos: ([]).concat(b.trust_logo_url || []).map((u, i) => ({ imageUrl: isSafeUrl(u) ? cap(u, 500) : '', label: cap(([]).concat(b.trust_logo_label || [])[i], 60) })).filter(l => l.imageUrl).slice(0, 8),
      googleReviewsUrl: isSafeUrl(b.trust_googleReviewsUrl) && /^https?:\/\//i.test(b.trust_googleReviewsUrl) ? cap(b.trust_googleReviewsUrl, 500) : ''
    },
    blog: {
      heading: cap(b.blog_heading, 60),
      eyebrow: cap(b.blog_eyebrow, 40),
      items: ([]).concat(b.blog_title || []).map((title, i) => ({
        title: cap(title, 120),
        date: cap(([]).concat(b.blog_date || [])[i], 40),
        body: cap(([]).concat(b.blog_body || [])[i], 8000)
      })).filter(it => it.title && it.body).slice(0, 30)
    },
    extraPages: {
      heading: cap(b.extraPages_heading, 60) || 'Extra pages',
      items: ([]).concat(b.extra_title || []).map((title, i) => ({
        title: cap(title, 60),
        body: cap(([]).concat(b.extra_body || [])[i], 8000)
      })).filter(it => it.title || it.body).slice(0, 10)   // a page still being written is kept; it goes live once it has a title and text
    },
    meta: {
      businessType: cap(b.meta_businessType, 100),
      city: cap(b.meta_city, 80),
      gaId: cleanGaId(b.meta_gaId),
      metaPixelId: cleanPixelId(b.meta_metaPixelId),
      reportEmail: isValidEmail(b.meta_reportEmail || '') ? str(b.meta_reportEmail, 254) : '',
      trackingMode: b.meta_trackingMode === 'always' ? 'always' : 'ask'
    },
    faq: {
      heading: cap(b.faq_heading, 60),
      eyebrow: cap(b.faq_eyebrow, 40),
      items: ([]).concat(b.faq_question || []).map((q, i) => ({
        question: cap(q, 150),
        answer: cap(([]).concat(b.faq_answer || [])[i], 500)
      })).filter(item => item.question).slice(0, 15)
    },
    hours: {
      heading: cap(b.hours_heading, 60),
      eyebrow: cap(b.hours_eyebrow, 40),
      items: ([]).concat(b.hours_day || []).map((day, i) => ({
        day: cap(day, 20),
        time: cap(([]).concat(b.hours_time || [])[i], 60)
      })).filter(item => item.day).slice(0, 7),
      openBadge: b.hours_openBadge === '1' || b.hours_openBadge === 'on',
      timezone: booking.TIMEZONES.some(t => t[0] === b.hours_timezone) ? b.hours_timezone : ''
    },
    pitch: {
      oldShot: isSafeUrl(b.pitch_oldShot) ? cap(b.pitch_oldShot, 500) : '',
      oldUrl: cap(b.pitch_oldUrl, 200)
    },
    contact: {
      heading: cap(b.contact_heading, 60),
      eyebrow: cap(b.contact_eyebrow, 40),
      email: isValidEmail(b.contact_email || '') ? str(b.contact_email, 254) : '',
      phone: cap(b.contact_phone, 40),
      address: cap(b.contact_address, 200),
      locations: ([]).concat(b.loc_name || []).map((name, i) => ({
        name: cap(name, 80),
        address: cap(([]).concat(b.loc_address || [])[i], 200),
        phone: cap(([]).concat(b.loc_phone || [])[i], 40)
      })).filter(l => l.name || l.address || l.phone).slice(0, 6),
      social: {
        facebook: isSafeUrl(b.contact_social_facebook) ? cap(b.contact_social_facebook, 300) : '',
        instagram: isSafeUrl(b.contact_social_instagram) ? cap(b.contact_social_instagram, 300) : '',
        twitter: isSafeUrl(b.contact_social_twitter) ? cap(b.contact_social_twitter, 300) : ''
      },
      notifyEmail: isValidEmail(b.contact_notifyEmail || '') ? str(b.contact_notifyEmail, 254) : '',
      autoReply: b.contact_autoReply === '1' || b.contact_autoReply === 'on',
      autoReplyText: cap(b.contact_autoReplyText, 600),
      homeMap: b.contact_homeMap === '1',
      footerHours: b.contact_footerHours === '1',
      floatButton: ['text', 'whatsapp', 'call', 'book', 'quote'].includes(b.contact_floatButton) ? b.contact_floatButton : '',
      form: forms.fromBody(b),
      followUp: leadsLib.fromBody(b),
      remindersOff: b.rem_off === '1' || b.rem_off === 'on',
      acceptSubmissions: b.contact_acceptSubmissions === '1' || b.contact_acceptSubmissions === 'on'
    },
    seo: {
      title: cap(b.seo_title, 70),
      description: cap(b.seo_description, 160),
      shareImage: isSafeUrl(b.seo_shareImage) ? cap(b.seo_shareImage, 500) : '',
      pages: (() => {
        const o = {};
        for (const k of [...PAGE_KEYS, 'book']) {
          const e = { title: cap(b['seopage_' + k + '_title'], 70), description: cap(b['seopage_' + k + '_description'], 160), shareImage: isSafeUrl(b['seopage_' + k + '_shareImage']) ? cap(b['seopage_' + k + '_shareImage'], 500) : '', noindex: b['seopage_' + k + '_noindex'] === '1' || b['seopage_' + k + '_noindex'] === 'on' };
          if (e.title || e.description || e.shareImage || e.noindex) o[k] = e;
        }
        return o;
      })(),
      redirects: redirects.fromBody(b),
      notFound: { heading: cap(b.nf_heading, 80), text: cap(b.nf_text, 300) }
    },
    legal: (() => {
      const on = b.legal_enabled === '1' || b.legal_enabled === 'on';
      const l = legal.clean({ enabled: on, ownerName: b.legal_ownerName, email: isValidEmail(b.legal_email || '') ? b.legal_email : '', address: b.legal_address, state: b.legal_state, updated: b.legal_updated, banner: b.legal_banner, privacyExtra: b.legal_privacyExtra, termsExtra: b.legal_termsExtra });
      if (l.enabled && !l.updated) l.updated = legal.monthYear();
      return l;
    })(),
    calculator: calc.fromBody(b),
    payments: payments.normalize({ enabled: b.pay_enabled === '1', currency: b.pay_currency, depositMode: b.pay_depositMode, depositAmount: b.pay_depositAmount, buyLabel: cap(b.pay_buyLabel, 30) }),
    members: membersLib.clean({
      enabled: b.members_enabled === '1' || b.members_enabled === 'on', title: b.members_title, navLabel: b.members_navLabel, intro: b.members_intro, signup: b.members_signup,
      pages: ([]).concat(b.members_page_title || []).map((title, i) => ({ title, body: ([]).concat(b.members_page_body || [])[i], linkLabel: ([]).concat(b.members_page_linkLabel || [])[i], linkUrl: ([]).concat(b.members_page_linkUrl || [])[i] }))
    }),
    chat: chat.clean({ enabled: b.chat_enabled === '1' || b.chat_enabled === 'on', greeting: b.chat_greeting, dailyCap: b.chat_dailyCap }),
    booking: parseBookingFromBody(b),
    announcement: {
      enabled: b.ann_enabled === '1' || b.ann_enabled === 'on',
      text: cap(b.ann_text, 160),
      linkText: cap(b.ann_linkText, 40),
      linkUrl: isSafeUrl(b.ann_linkUrl) ? cap(b.ann_linkUrl, 500) : '',
      dismissible: !(b.ann_dismissible === '0')
    }
  };
}

// Online booking settings. Hours come as one row per weekday; services, add-ons
// and the industry-specific questions are parallel arrays like the other lists.
function parseBookingFromBody(b) {
  const cap = (v, n) => str(v, n);
  const col = (k) => ([]).concat(b[k] || []);
  const num = (v, lo, hi, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  const d = booking.defaultBooking();
  const hours = {};
  for (const k of booking.DAYS) {
    const open = String(b[`bk_open_${k}`] || '').trim(), close = String(b[`bk_close_${k}`] || '').trim();
    const ok = booking.TIME_RE.test(open) && booking.TIME_RE.test(close) && booking.toMin(open) < booking.toMin(close);
    hours[k] = ok ? { closed: b[`bk_closed_${k}`] === '1' || b[`bk_closed_${k}`] === 'on', open, close } : { ...d.hours[k], closed: true };
  }
  const money = (v) => cap(v, 20);
  return {
    enabled: b.bk_enabled === '1' || b.bk_enabled === 'on',
    kind: booking.PRESETS[b.bk_kind] ? b.bk_kind : 'generic',
    heading: cap(b.bk_heading, 60) || d.heading,
    intro: cap(b.bk_intro, 400),
    autoConfirm: b.bk_autoConfirm === '1' || b.bk_autoConfirm === 'on',
    timezone: booking.TIMEZONES.some(t => t[0] === b.bk_timezone) ? b.bk_timezone : d.timezone,
    stepMinutes: [10, 15, 20, 30, 45, 60].includes(parseInt(b.bk_step, 10)) ? parseInt(b.bk_step, 10) : 30,
    leadHours: num(b.bk_lead, 0, 720, 24),
    windowDays: num(b.bk_window, 1, 365, 45),
    capacity: num(b.bk_capacity, 1, 20, 1),
    hours,
    services: col('bk_service_name').map((name, i) => ({
      name: cap(name, 80), minutes: num(col('bk_service_minutes')[i], 5, 600, 60),
      price: money(col('bk_service_price')[i]), description: cap(col('bk_service_desc')[i], 200)
    })).filter(x => x.name).slice(0, 20),
    addons: col('bk_addon_name').map((name, i) => ({
      name: cap(name, 80), price: money(col('bk_addon_price')[i]), minutes: num(col('bk_addon_minutes')[i], 0, 240, 0)
    })).filter(x => x.name).slice(0, 15),
    fields: col('bk_field_label').map((label, i) => {
      const type = ['text', 'select', 'textarea'].includes(col('bk_field_type')[i]) ? col('bk_field_type')[i] : 'text';
      const options = type === 'select' ? String(col('bk_field_options')[i] || '').split(',').map(o => cap(o, 60)).filter(Boolean).slice(0, 12) : [];
      return { label: cap(label, 80), type: type === 'select' && !options.length ? 'text' : type, options, required: col('bk_field_required')[i] === '1' };
    }).filter(x => x.label).slice(0, 12),
    askAddress: b.bk_askAddress === '1' || b.bk_askAddress === 'on',
    policy: cap(b.bk_policy, 800),
    confirmNote: cap(b.bk_confirmNote, 400)
  };
}

function parseThemeFromBody(b) {
  return {
    primaryColor: isValidHexColor(b.theme_primaryColor) ? b.theme_primaryColor.trim() : '#2563eb',
    accentColor: isValidHexColor(b.theme_accentColor) ? b.theme_accentColor.trim() : '#1e293b',
    font: ['Inter, system-ui, sans-serif', "Georgia, 'Times New Roman', serif", "'Trebuchet MS', sans-serif"]
      .includes(b.theme_font) ? b.theme_font : 'Inter, system-ui, sans-serif',
    style: extraThemes.ALL_STYLES.includes(b.theme_style) ? b.theme_style : 'modern',
    headingFont: fonts.cleanFontName(b.theme_headingFontCustom) || fonts.cleanFontName(b.theme_headingFont),
    bodyFont: fonts.cleanFontName(b.theme_bodyFontCustom) || fonts.cleanFontName(b.theme_bodyFont),
    headingCase: ['none', 'uppercase'].includes(b.theme_headingCase) ? b.theme_headingCase : '',
    homeLayout: extraThemes.HOME_LAYOUTS.includes(b.theme_homeLayout) ? b.theme_homeLayout : ((b.theme_homeFull === '1' || b.theme_homeFull === 'on') ? 'full' : ''),
    homeFull: false,
    blueprint: sectionLibrary.cleanId(b.theme_blueprint),
    bpSkip: ([]).concat(b.bp_skip || []).filter(f => Object.prototype.hasOwnProperty.call(sectionLibraryRegistry.FAMILIES, f)),
    bpVariants: (() => { const o = {}; for (const f of Object.keys(sectionLibraryRegistry.FAMILIES)) { const v = b['bpv_' + f]; if (v && sectionLibraryRegistry.isVariant(f, v)) o[f] = v; } return o; })(),
    bpHero: b.theme_bpHero === 'native' ? 'native' : '',
    slBlueprint: styleLib.BLUEPRINT_IDS.includes(b.theme_slBlueprint) ? b.theme_slBlueprint : '',
    mix: (() => { try { return mixPage.clean(JSON.parse(b.theme_mix || '[]')); } catch (e) { return []; } })(),
    bpAlt: b.theme_bpAlt === 'off' ? 'off' : '',
    bpAdd: ([]).concat(b.bp_add || []).filter(f => f !== 'hero' && Object.prototype.hasOwnProperty.call(sectionLibraryRegistry.FAMILIES, f)),
    bpSec: sectionLibrary.cleanSectionOpts(Object.fromEntries(Object.keys(sectionLibraryRegistry.FAMILIES).map(f => [f, Object.fromEntries(['emoji', 'doodle', 'bg', 'title', 'flip', 'shape', 'bgColor', 'bgColor2', 'gradDir', 'grad', 'gradStyle', 'gradAngle', 'gradMove', 'grain', 'gradBlend', 'gradInk', 'space', 'width', 'text', 'padY', 'maxW', 'fs', 'photo', 'photoPos', 'photoSize', 'photoOverlay'].map(k => [k, b['bps_' + f + '_' + k]]))])), accents.cleanEmoji, isSafeUrl),
    pageStyles: (() => { const o = {}; for (const k of extraThemes.PAGE_KEYS_FOR_STYLE) { const v = b['pagestyle_' + k]; if (extraThemes.ALL_STYLES.includes(v)) o[k] = v; } return o; })(),
    buttonShape: ['square', 'rounded', 'pill'].includes(b.theme_buttonShape) ? b.theme_buttonShape : '',
    corners: ['sharp', 'soft', 'round'].includes(b.theme_corners) ? b.theme_corners : '',
    spacing: ['compact', 'airy'].includes(b.theme_spacing) ? b.theme_spacing : '',
    emoji: accents.cleanEmoji(b.theme_emoji),
    doodles: b.theme_doodles === '1',
    emojiHeads: b.theme_emojiHeads === '1',
    bgColor: isValidHexColor(b.theme_bgColor) ? b.theme_bgColor.trim() : '',
    headingScale: ['large', 'xl'].includes(b.theme_headingScale) ? b.theme_headingScale : '',
    bands: b.theme_bands === '1',
    header: ['static', 'shrink', 'transparent'].includes(b.theme_header) ? b.theme_header : '',
    headerLayout: b.theme_headerLayout === 'centered' ? 'centered' : '',
    menuStyle: menuStyles.clean(b.theme_menuStyle),
    motionStyle: app.locals.motionLib.isValid(b.theme_motionStyle) ? b.theme_motionStyle : app.locals.motionLib.DEFAULT,
    motionLevel: app.locals.motionLib.isLevel(b.theme_motionLevel) ? b.theme_motionLevel : app.locals.motionLib.LEVEL_DEFAULT,
    motionShader: app.locals.motionLib.isShader(b.theme_motionShader) ? b.theme_motionShader : 'aurora',
    hoverLift: b.theme_hoverLift === '1' || b.theme_hoverLift === 'on',
    logoUrl: isSafeUrl(b.theme_logoUrl) ? str(b.theme_logoUrl, 500) : '',
    faviconUrl: isSafeUrl(b.theme_faviconUrl) ? str(b.theme_faviconUrl, 500) : '',
    touchIconUrl: isSafeUrl(b.theme_touchIconUrl) ? str(b.theme_touchIconUrl, 500) : '',
    ...lookfeel.parse(b),
    ...gradients.parse(b),
    ...cardLayouts.parse(b),
    ...motionFx.parse(b),
    ...nameFx.parse(b),
    ...headerColor.parse(b),
    ...smoothScroll.parse(b),
    ...splitText.parse(b),
    ...scrollFx.parse(b),
    ...extraFx.parse(b)
  };
}

// Content blocks (photo + text, numbered steps). Parallel arrays from the
// editor, one entry per block; steps are one per line as "Title | text".
// content blocks a site can have (hidden ones count too); was 20, which silently dropped new blocks (Leo, 2026-11-02)
const MAX_BLOCKS = require('./blockcatalog').MAX_BLOCKS;
const BLOCK_TYPES = ['photoText', 'steps', 'features', 'cta', 'chips', 'strip', 'split', 'pricing', 'team', 'stats', 'video', 'tabs', 'accordion', 'wall', 'cascade', 'photoBanner', 'beforeAfter', 'collage', 'trail', 'wave', 'bigwords', 'story', 'path', 'zoomword', 'morph', 'nodes', 'shapes', 'stack', 'herocard', 'aboutphone', 'thirds', 'mosaic', 'crossband', 'advice', 'photoblend', 'patterns', 'overlapcard', 'phototabs', 'reviewcard', 'twinphotos', 'ringcard', 'shapeform', 'framedphoto', 'roundphoto', 'photopairs', 'offsetphoto', 'aboutstory', 'aboutme', 'aboutbig', 'aboutfacts', 'aboutcollage', 'aboutnote', 'aboutpanel', 'socialshapes', 'socialphoto', 'socialcounts', 'socialonphoto', 'socialfeed', 'socialprofile', 'socialstrip', 'numcards', 'tipcards'];
const BLOCK_PAGES = ['home', 'about', 'services', 'testimonials', 'whyChoose', 'gallery', 'faq', 'blog', 'hours', 'contact'];
function parseBlocksFromBody(b) {
  const cap = (v, n) => str(v, n);
  const col = (k) => ([]).concat(b[k] || []);
  const types = col('block_type');
  const pick = (v, allowed, dflt) => (allowed.includes(v) ? v : dflt);
  const out = [];
  const ids = new Set();
  types.forEach((type, i) => {
    if (!BLOCK_TYPES.includes(type)) return;
    let id = str(col('block_id')[i], 8);
    if (!BLK_ID.test(id) || ids.has(id)) id = newBlockId();
    const blk = {
      id,
      type,
      heading: cap(col('block_heading')[i], 120),
      body: type === 'video'
        ? (() => { const u = str(col('block_body')[i], 500).split('\n')[0].trim(); return isSafeUrl(u) && videoInfo(u) ? u : ''; })()
        : type === 'team'
        ? str(col('block_body')[i], 6000).split('\n').map(l => { const parts = l.split('|').map(x => x.trim()); if (!parts[0]) return ''; const photo = parts[3] && isSafeUrl(parts[3]) ? parts[3].slice(0, 500) : ''; return [parts[0].slice(0, 60), (parts[1] || '').slice(0, 60), (parts[2] || '').slice(0, 300), photo].join(' | '); }).filter(Boolean).slice(0, 12).join('\n')
        : type === 'wall' || type === 'cascade' || type === 'trail' || type === 'wave' || type === 'story' || type === 'path'
        ? str(col('block_body')[i], 8000).split('\n').map(l => l.trim()).filter(Boolean).filter(l => !/^(https?:\/\/|\/)\S+$/i.test(l) || isSafeUrl(l)).map(l => l.slice(0, /^(https?:\/\/|\/)\S+$/i.test(l) ? 500 : type === 'story' ? 240 : 90)).slice(0, 20).join('\n')
        : type === 'collage'
        ? collageBlock.cleanBody(str(col('block_body')[i], 8000))
        : type === 'nodes'
        ? nodeCards.cleanBody(str(col('block_body')[i], 8000))
        : type === 'shapes'
        ? shapeBlock.cleanBody(str(col('block_body')[i], 8000))
        : type === 'stack'
        ? stackCards.cleanBody(str(col('block_body')[i], 8000))
        : type === 'herocard'
        ? heroCard.cleanBody(str(col('block_body')[i], 8000))
        : type === 'aboutphone'
        ? aboutBlob.cleanBody(str(col('block_body')[i], 8000))
        : type === 'thirds'
        ? thirdsBlock.cleanBody(str(col('block_body')[i], 8000))
        : type === 'mosaic'
        ? mosaicHero.cleanBody(str(col('block_body')[i], 8000))
        : type === 'crossband'
        ? crossBand.cleanBody(str(col('block_body')[i], 8000))
        : type === 'advice'
        ? adviceBlock.cleanBody(str(col('block_body')[i], 8000))
        : type === 'photoblend'
        ? photoBlend.cleanBody(str(col('block_body')[i], 8000))
        : type === 'patterns'
        ? patternBlock.cleanBody(str(col('block_body')[i], 2000))
        : type === 'overlapcard'
        ? overlapCard.cleanBody(str(col('block_body')[i], 4000))
        : type === 'phototabs'
        ? photoTabs.cleanBody(str(col('block_body')[i], 8000))
        : type === 'reviewcard'
        ? reviewCard.cleanBody(str(col('block_body')[i], 4000))
        : type === 'twinphotos'
        ? twinPhotos.cleanBody(str(col('block_body')[i], 6000))
        : type === 'ringcard'
        ? ringCard.cleanBody(str(col('block_body')[i], 4000))
        : type === 'shapeform'
        ? shapeForm.cleanBody(str(col('block_body')[i], 2000))
        : type === 'framedphoto'
        ? framedPhoto.cleanBody(str(col('block_body')[i], 4000))
        : type === 'roundphoto'
        ? roundPhoto.cleanBody(str(col('block_body')[i], 4000))
        : type === 'photopairs'
        ? photoPairs.cleanBody(str(col('block_body')[i], 6000))
        : type === 'offsetphoto'
        ? offsetPhoto.cleanBody(str(col('block_body')[i], 4000))
        : aboutBlocks.SPECS[type]
        ? aboutBlocks.cleanBody(type, str(col('block_body')[i], 6000))
        : type === 'strip'
        ? str(col('block_body')[i], 12000).split('\n').map(u => u.trim()).filter(u => u && isSafeUrl(u)).map(u => u.slice(0, 500)).slice(0, 20).join('\n')
        : cap(col('block_body')[i], type === 'photoText' || type === 'cta' || type === 'split' ? 2000 : 1600),
      imageUrl: isSafeUrl(col('block_image')[i]) ? cap(col('block_image')[i], 500) : '',
      buttonText: cap(col('block_buttonText')[i], 40),
      buttonUrl: isSafeUrl(col('block_buttonUrl')[i]) ? cap(col('block_buttonUrl')[i], 500) : '',
      side: type === 'wave' ? motionBlocks.cleanShape(col('block_side')[i]) : type === 'wall' ? brandWall.cleanSide(col('block_side')[i]) : type === 'cascade' ? cardCascade.cleanSide(col('block_side')[i]) : type === 'photoBanner' ? photoBanner.cleanSide(col('block_side')[i]) : type === 'video' ? videoMask.clean(col('block_side')[i]) : type === 'nodes' ? nodeCards.cleanSide(col('block_side')[i]) : type === 'shapes' ? shapeBlock.cleanSide(col('block_side')[i]) : type === 'stack' ? stackCards.cleanSide(col('block_side')[i]) : type === 'herocard' ? heroCard.cleanSide(col('block_side')[i]) : type === 'aboutphone' ? aboutBlob.cleanSide(col('block_side')[i]) : type === 'thirds' ? thirdsBlock.cleanSide(col('block_side')[i]) : type === 'mosaic' ? mosaicHero.cleanSide(col('block_side')[i]) : type === 'advice' ? adviceBlock.cleanSide(col('block_side')[i]) : type === 'photoblend' ? photoBlend.cleanSide(col('block_side')[i]) : type === 'patterns' ? patternBlock.cleanSide(col('block_side')[i]) : type === 'overlapcard' ? overlapCard.cleanSide(col('block_side')[i]) : type === 'phototabs' ? photoTabs.cleanSide(col('block_side')[i]) : type === 'reviewcard' ? reviewCard.cleanSide(col('block_side')[i]) : type === 'twinphotos' ? twinPhotos.cleanSide(col('block_side')[i]) : type === 'ringcard' ? ringCard.cleanSide(col('block_side')[i]) : type === 'shapeform' ? shapeForm.cleanSide(col('block_side')[i]) : type === 'framedphoto' ? framedPhoto.cleanSide(col('block_side')[i]) : type === 'roundphoto' ? roundPhoto.cleanSide(col('block_side')[i]) : type === 'photopairs' ? photoPairs.cleanSide(col('block_side')[i]) : type === 'offsetphoto' ? offsetPhoto.cleanSide(col('block_side')[i]) : aboutBlocks.SPECS[type] ? aboutBlocks.cleanSide(type, col('block_side')[i]) : pick(col('block_side')[i], type === 'steps' ? ['auto', 'timeline', 'stack'] : type === 'collage' ? ['auto', 'banner'] : ['auto', 'left', 'right'], 'auto'),
      bg: gradients.cleanBlockBg(col('block_bg')[i]),
      bgmix: gradients.cleanBlockMix(col('block_bgmix')[i]),
      bgink: gradients.textures.cleanInk(col('block_bgink')[i]),
      gx: gradients.cleanStrength(col('block_gx')[i]),          // the background gradient's intensity ('' = as designed)
      cardbg: gradients.cleanCardBg(col('block_cardbg')[i]),   // a gradient on the cards inside the block
      cardgx: gradients.cleanStrength(col('block_cardgx')[i]),
      edge: pick(col('block_edge')[i], ['none', 'wave', 'scallop'], 'none'),
      place: pick(col('block_place')[i], ['bottom', 'top'], 'bottom'),
      page: pick(col('block_page')[i], BLOCK_PAGES, 'home'),
      pin: pinFx.clean(col('block_pin')[i]),
      film: filmFx.clean(col('block_film')[i]),
      imgfx: imgFx.clean(col('block_imgfx')[i]),
      height: heightFx.clean(col('block_height')[i])
    };
    if (blk.heading || blk.body || blk.imageUrl || type === 'wall' || type === 'cascade' || ['collage', 'trail', 'wave', 'path', 'nodes', 'stack', 'herocard', 'aboutphone', 'thirds', 'mosaic', 'crossband', 'advice', 'photoblend', 'patterns', 'overlapcard', 'phototabs', 'reviewcard', 'twinphotos', 'ringcard', 'shapeform', 'framedphoto', 'roundphoto', 'photopairs', 'offsetphoto'].includes(type) || !!aboutBlocks.SPECS[type]) { ids.add(id); out.push(blk); }   // a wall, cascade, collage, trail, wave, photo cards or stacked cards shows the site's own content even when empty
  });
  return out.slice(0, MAX_BLOCKS);
}

// "Your own sections": words, photos or both, placed after a chosen section (see library/content.js bindCustom)
const CUSTOM_LAYOUTS = ['', 'text', 'photo-text', 'text-photo', 'photo', 'photos', 'overlap', 'offset', 'collage', 'sticky', 'frosted', 'editorial', 'magazine', 'strip', 'bleed'];
function parseCustomFromBody(b) {
  const col = (k) => ([]).concat(b[k] || []);
  const afters = ['top', 'end'].concat(Object.keys(sectionLibraryRegistry.FAMILIES).filter(f => f !== 'hero' && f !== 'custom'));
  const out = [];
  col('cs_heading').forEach((heading, i) => {
    const images = [1, 2, 3, 4].map(n => col('cs_img' + n)[i]).filter(u => u && isSafeUrl(u)).map(u => str(u, 500));
    const it = {
      after: afters.includes(col('cs_after')[i]) ? col('cs_after')[i] : 'end',
      layout: CUSTOM_LAYOUTS.includes(col('cs_layout')[i]) ? col('cs_layout')[i] : '',
      heading: str(heading, 120), body: str(col('cs_body')[i], 3000), images,
      buttonText: str(col('cs_buttonText')[i], 40), buttonUrl: isSafeUrl(col('cs_buttonUrl')[i]) ? str(col('cs_buttonUrl')[i], 500) : '',
      bg: sectionLibrary.BG_MODES.includes(col('cs_bg')[i]) ? col('cs_bg')[i] : '', emoji: accents.cleanEmoji(col('cs_emoji')[i], 1),
      ...sectionLibrary.sizePhotoOf({ flip: col('cs_flip')[i], shape: col('cs_shape')[i], space: col('cs_space')[i], width: col('cs_width')[i], text: col('cs_text')[i], padY: col('cs_padY')[i], maxW: col('cs_maxW')[i], fs: col('cs_fs')[i], bgColor: col('cs_bgColor')[i], bgColor2: col('cs_bgColor2')[i], gradDir: col('cs_gradDir')[i], grad: col('cs_grad')[i], gradStyle: col('cs_gradStyle')[i], gradAngle: col('cs_gradAngle')[i], gradMove: col('cs_gradMove')[i], grain: col('cs_grain')[i], gradBlend: col('cs_gradBlend')[i], gradInk: col('cs_gradInk')[i] }, 'custom')
    };
    if (it.bg !== 'color' && it.bg !== 'gradient') { delete it.bgColor; delete it.bgColor2; delete it.gradDir; }
    if ((it.bg === 'color' && !it.bgColor) || (it.bg === 'gradient' && !(it.bgColor && it.bgColor2)) || (it.bg === 'preset' && !it.grad)) it.bg = '';
    sectionLibrary.dropUnusedGrad(it.bg, it);
    if (it.heading || it.body || it.images.length) out.push(it);
  });
  return out.slice(0, 12);
}

function parseLayoutFromBody(b) {
  const orderRaw = str(b.layout_order, 1500);
  const items = orderRaw ? orderRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
  const hidden = ([]).concat(b.hidden_sections || []).filter(Boolean);
  return safeParseLayout(JSON.stringify({ order: items.filter(k => !BLK_KEY.test(k)), items, hidden }));
}

// Shared by several route groups below (kept here so each group can be handed them when it is set up)
// the email address hosting and payment notices go to: the site's notify address, its contact email, or the owner's login
const hostingNotifyEmail = (site) => [site.sections.contact.notifyEmail, site.sections.contact.email].map(e => str(e, 254)).find(e => e && isValidEmail(e)) || (db.prepare('SELECT email FROM users WHERE id = ?').get(site.user_id) || {}).email || '';
// whether a user is the app's admin (ADMIN_EMAIL, or the first account)
function isAdmin(userId) {
  const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId);
  if (!user) return false;
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (adminEmail) return user.email.toLowerCase() === adminEmail;
  return db.prepare('SELECT MIN(id) AS id FROM users').get().id === user.id;
}
// a site's visit report for 7, 30 or 90 days
function reportContext(site, daysParam) {
  const days = [7, 30, 90].includes(parseInt(daysParam, 10)) ? parseInt(daysParam, 10) : 30;
  const report = reports.buildReport(db, site.id, reports.rangeForDays(days));
  report.topPages = report.topPages.map(p => ({ ...p, label: reports.pageLabel(site, p.path) }));
  return { report, days };
}

// Payment links, online booking and members-only pages (routes/payments-booking-members.js)
const {
  BOOKING_LIVE, bookingRoute, emailBooking, markPaid, membersRoute, newPayment, ownerEmailFor, payBase, payLimiter,
  payReady, refreshPayment, runPaymentSweep, startCheckout
} = require('./routes/payments-booking-members')(app, {
  PORT, bcrypt, billing, booking, db, hostingNotifyEmail, hydrateSite, isTestEnv, isValidEmail, loadOwnedSite,
  mailer, membersLib, nanoid, payments, rateLimit, renderSitePage, requireAuth, session, str
});

// ---- custom domain routing ----
// If a request's Host header matches a published site's custom_domain,
// serve that site's pages at "/", "/about", "/contact", etc. instead of the
// normal dashboard/marketing page.
// (For this to work in a real deployment, the domain's DNS must point at
// this server, and a reverse proxy / TLS termination is the operator's job.)
app.use((req, res, next) => {
  const host = (req.hostname || '').toLowerCase();
  if (!host || host === 'localhost') return next();
  const row = db.prepare('SELECT * FROM sites WHERE custom_domain = ? AND published = 1').get(host);
  if (!row) return next();
  if (billing.isSuspended(row)) return res.status(503).render('suspended', { name: row.name });
  if ((req.method === 'GET' || req.method === 'HEAD') && req.path !== '/') {
    const hit = redirectFor(row, req.path);
    if (hit) return sendRedirect(req, res, hit, '');
  }
  const segments = req.path.split('/').filter(Boolean);
  if (segments[0] === 'book' && segments.length <= 2) return bookingRoute(req, res, next, row, '', segments[1]);
  if (segments[0] === 'members' && segments.length <= 2) return membersRoute(req, res, next, row, '', segments[1]);
  const isItemPage = segments.length === 2 && Object.prototype.hasOwnProperty.call(ITEM_ROUTES, segments[0]);
  if (segments.length > 1 && !isItemPage) return next(); // not a page; let normal routing 404 it
  const page = isItemPage ? ITEM_ROUTES[segments[0]] : segments.length === 0 ? 'home' : segments[0];
  if (!isItemPage && page !== 'home' && page !== 'thank-you' && page !== 'review' && !PAGE_KEYS.includes(page) && !legal.PAGES.includes(page) && page !== 'estimate') return next();
  const site = hydrateSite(row);
  const hasFlash = req.query.contact_sent === '1' || req.query.contact_error === '1';
  renderSitePage(req, res, next, {
    site, page, basePath: '',
    preview: false,
    contactSent: req.query.contact_sent === '1',
    contactError: req.query.contact_error === '1',
    itemSlug: isItemPage ? segments[1] : undefined,
    reviewThanks: page === 'review' && req.query.thanks === '1',
    reviewError: page === 'review' && req.query.error === '1',
    cacheKey: (hasFlash || page === 'review') ? null : `${row.custom_domain}:${isItemPage ? segments[0] + '/' + segments[1] : page}`
  });
});

// What site visitors send: events, chat, estimates, buy buttons, reviews and contact forms (routes/visitor.js)
require('./routes/visitor')(app, {
  billing, calc, chat, contactLimiter, db, handleContactSubmission, handleReviewSubmission, hydrateSite,
  isTestEnv, isValidEmail, newPayment, payLimiter, payReady, payments, rateLimit, recordLead, reports, reviewLimiter,
  startCheckout, str
});

// Sign up, log in, dashboard, new sites (import, generate, drafts), AI copy and photo search (routes/account.js)
const {
  applyIntake, autoDesign, baseSiteFromTemplate, readGenLogo, editApplyHandler, editProposeHandler, renderDashboard
} = require('./routes/account')(app, {
  aiComplete, applySocialInspiration, atelier, authLimiter, bcrypt, booking, chatedit, colorForCategory, crypto,
  darkenHex, db, defaultLayout, defaultSections, defaultTheme, designBrief, extraThemes, fetchPhotoSet, fillTemplate,
  findTemplate, generateCopy, generateLimiter, hasAiProvider, hasPhotoProvider, hydrateSite, importLimiter,
  industryDesign, intake, invalidateSiteCache, isAdmin, isSafeUrl, isTestEnv, isValidEmail, isValidHexColor,
  isValidPassword, loadOwnedSite, mergeSectionsWithDefaults, nanoid, path, photoCredits, pickerSources, rateLimit,
  recentUnsplash, renderSitePage, requireAuth, saveVersion, scrapeSocialInspiration, scrapeUrl, searchPhotosPage,
  searchUnsplashPage, sectionLibraryRegistry, splitList, str, styleSwap, templateLooks, trackUnsplashDownload,
  uniqueSlug, upload
});

// Client edit links, client logins and the client portal (routes/clients.js)
const {
  clientLimiter, loadClientSite
} = require('./routes/clients')(app, {
  authLimiter, bcrypt, crypto, db, editApplyHandler, editProposeHandler, generateLimiter, getSite,
  invalidateSiteCache, isSafeUrl, isTestEnv, isValidEmail, loadOwnedSite, mailer, nanoid, optimizeUpload, rateLimit,
  reportContext, requireAuth, saveVersion, str, upload
});

// Billing, admin and backups, block library, export, hosting and payment requests (routes/admin-export-hosting.js)
const {
  checklistOpts, libraryRows
} = require('./routes/admin-export-hosting')(app, {
  PAGE_KEYS, ZipArchive, areasWithSlugs, backups, billing, buildChecklist, buildNavPages, cache, calc, db,
  defaultTheme, extraPageList, extraThemes, fs, googleReviews, hostingNotifyEmail, images, isAdmin, isTestEnv,
  isValidEmail, isValidHostname, legal, loadOwnedSite, mailer, markPaid, mergeSectionsWithDefaults, multer, nanoid,
  netlify, newPayment, os, ownerEmailFor, pageIsAvailable, parseBlocksFromBody, path, payBase, payReady, payments,
  qualityGate, rateLimit, recordPublish, refreshPayment, renderDashboard, requireAuth, safeParseLayout, saveVersion,
  servicesWithSlugs, session, str, uniqueSlug, wordStyle
});

// Intake questionnaires: start links, PDF intake and submissions (routes/intake.js)
require('./routes/intake')(app, {
  aiComplete, applyIntake, autoDesign, baseSiteFromTemplate, readGenLogo, db, defaultLayout, designBrief, designOptionsLib, fs,
  generateGroundedCopy, generateLimiter, getSite, grounding, hasAiProvider, intake, intakePdf, isTestEnv, mailer,
  multer, nanoid, optimizeUpload, path, rateLimit, requireAuth, saveVersion, str, uniqueSlug, upload
});

app.post('/sites/:id/delete', requireAuth, (req, res) => {
  const site = db.prepare('SELECT * FROM sites WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
  if (site) {
    db.prepare('DELETE FROM site_versions WHERE site_id = ?').run(site.id);
    db.prepare('DELETE FROM site_undo WHERE site_id = ?').run(site.id);
    db.prepare('DELETE FROM site_members WHERE site_id = ?').run(site.id);
    db.prepare('DELETE FROM publish_history WHERE site_id = ?').run(site.id);
    db.prepare('DELETE FROM client_users WHERE site_id = ?').run(site.id);
    db.prepare('DELETE FROM photo_credits WHERE site_id = ?').run(site.id);
    db.prepare('DELETE FROM client_links WHERE site_id = ?').run(site.id);
    db.prepare('DELETE FROM share_links WHERE site_id = ?').run(site.id);
    db.prepare('DELETE FROM sites WHERE id = ?').run(site.id);
    invalidateSiteCache(site);
  }
  res.redirect('/dashboard');
});

// ---- site builder ----
function loadOwnedSite(req, res, next) {
  const site = getSite(req.params.id);
  if (!site || site.user_id !== req.session.userId) {
    return res.status(404).send('Site not found');
  }
  req.site = site;
  next();
}

app.get('/sites/:id/edit', requireAuth, loadOwnedSite, (req, res) => {
  ensureBlockIds(req.site);
  const versions = db.prepare(
    'SELECT id, label, created_at FROM site_versions WHERE site_id = ? ORDER BY id DESC LIMIT 10'
  ).all(req.site.id);
  const leadCount = db.prepare('SELECT COUNT(*) AS n FROM contact_submissions WHERE site_id = ?').get(req.site.id).n;
  const pendingReviews = db.prepare("SELECT COUNT(*) AS n FROM review_submissions WHERE site_id = ? AND status = 'pending'").get(req.site.id).n;
  const pendingBookings = db.prepare("SELECT COUNT(*) AS n FROM bookings WHERE site_id = ? AND status = 'pending'").get(req.site.id).n;
  let newClientLink = '';
  if (req.query.clientlink === '1' && req.session.newClientLink) {
    newClientLink = req.session.newClientLink;
    delete req.session.newClientLink; // show it once only
  }
  let newInvite = null;
  if (req.query.clientuser === 'invited' && req.session.newInvite) { newInvite = req.session.newInvite; delete req.session.newInvite; }
  // Use the saved business type; if there is none (older sites, or a site made another way), guess from its name, headline and services
  const adviceTpl = adviceTemplateFor(req.site);
  const bpList = sectionLibrary.sectionList(req.site.theme, adviceTpl.id);
  const bpResolved = bpList.blueprint;
  res.render('editor', {
    undoState: undoCounts(req.site.id),
    extraPagesNav: extraPageList(req.site).map(e => ({ slug: e.slug, title: e.title })),
    bpUi: { resolved: bpResolved, rows: bpList.sections, all: sectionLibrary.BLUEPRINTS, families: sectionLibraryRegistry.FAMILIES,
      variants: Object.fromEntries(Object.keys(sectionLibraryRegistry.FAMILIES).map(f => [f, sectionLibraryRegistry.variantsOf(f)])) },
    indFlash: str(req.query.ind, 12),
    designAdvice: adviceTpl && adviceTpl.id !== 'generic' ? industryDesign.industryDesign(adviceTpl.id) : null,
    levelSuggest: adviceTpl ? app.locals.motionLib.suggestLevel({ templateId: adviceTpl.id }) : null,
    motionSuggest: adviceTpl && adviceTpl.id !== 'generic' ? app.locals.motionLib.suggest({ templateId: adviceTpl.id, style: req.site.theme.style, advice: industryDesign.industryDesign(adviceTpl.id) }) : '',
    site: req.site,
    versions,
    leadCount,
    pendingReviews,
    pendingBookings,
    bookingFlash: req.query.booking === '1',
    mailConfigured: mailer.isConfigured(),
    checklist: buildChecklist(req.site, checklistOpts(req.site)),
    library: libraryRows(req.session.userId),
    saved: req.query.saved === '1',
    imported: req.query.imported === '1',
    refreshed: req.query.refreshed === '1',
    generated: req.query.generated === '1' || req.query.generated === 'ai',
    generatedByAi: req.query.generated === 'ai',
    fromIntake: req.query.fromintake === '1',
    aiConfigured: hasAiProvider(),
    rewrite: req.query.rewrite || '',
    clientLinkInfo: db.prepare('SELECT created_at, last_used_at FROM client_links WHERE site_id = ?').get(req.site.id) || null,
    newClientLink,
    clientLinkFlash: req.query.clientlink || '',
    clientUsers: db.prepare('SELECT id, email, name, password_hash != \'\' AS active, invite_expires, last_login_at FROM client_users WHERE site_id = ? ORDER BY id').all(req.site.id),
    newInvite,
    clientUserFlash: req.query.clientuser || '',
    googleFlash: req.query.google || '',
    googleCache: googleReviews.row(db, req.site.id) || null,
    googleConfigured: googleReviews.isConfigured()
  });
});

// A Blocks page (home layout "mix") draws its own hero block, so the hero design picked in hero setup and the
// Blocks page's hero are kept the same: picking a design in one changes the other.
const LIB_HERO_DESIGNS = ['scrim', 'showcase', 'scroll', 'shapes', 'blend'];
const mixHeroAt = mix => (mix || []).findIndex(m => m && m.k === 'lib' && m.f === 'hero');

app.post('/sites/:id/edit', requireAuth, loadOwnedSite, (req, res) => {
  const b = req.body;
  const sections = parseSectionsFromBody(b);
  // your own text boxes are kept as they are when the save doesn't carry them
  if (b.texts_json === undefined) sections.texts.items = textBoxes.clean(((req.site.sections || {}).texts || {}).items);
  // and so are the text styles (Style text mode)
  if (b.tstyles_json === undefined) sections.texts.styles = textStyles.clean(((req.site.sections || {}).texts || {}).styles);
  // and so are the moves and sizes of any piece of a block (Move & size mode)
  if (b.estyles_json === undefined) sections.texts.elems = elStyles.clean(((req.site.sections || {}).texts || {}).elems);
  // and so are your own pictures (+ Add picture)
  if (b.pics_json === undefined) sections.texts.pics = picBoxes.clean(((req.site.sections || {}).texts || {}).pics);
  const theme = parseThemeFromBody(b);
  // Scroll Smoother and Split text are set in the Design lab, so an editor save keeps them as they are
  Object.assign(theme, keptMotion(req.site.theme, b));
  const layout = parseLayoutFromBody(b);
  let mixSynced = false;
  const design = sections.hero.design;
  if (extraThemes.homeLayoutOf(theme) === 'mix' && LIB_HERO_DESIGNS.includes(design) && design !== ((req.site.sections.hero || {}).design)) {
    const mix = theme.mix.slice(), at = mixHeroAt(mix);
    if (at >= 0) mix[at] = { ...mix[at], v: design }; else mix.unshift({ k: 'lib', f: 'hero', v: design });
    theme.mix = mixPage.clean(mix);
    mixSynced = true;
  }
  if (extraThemes.homeLayoutOf(theme) === 'mix') {
    const synced = syncMixBlocks(theme.mix, sections, layout.hidden);
    if (JSON.stringify(synced) !== JSON.stringify(theme.mix)) { theme.mix = synced; mixSynced = true; }
  }
  const name = str(b.name, 80) || req.site.name;
  const customDomain = str(b.custom_domain, 253);

  if (customDomain && !isValidHostname(customDomain)) {
    if (wantsJson(req)) return res.status(400).json({ ok: false, error: 'That doesn\'t look like a valid domain (e.g. www.example.com).' });
    return res.redirect(`/sites/${req.site.id}/edit`);
  }

  saveVersion(req.site.id, req.site.theme, req.site.sections, req.site.layout);

  db.prepare(
    `UPDATE sites SET name = ?, theme = ?, sections = ?, layout = ?, custom_domain = ?,
     seo_title = ?, seo_description = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    name,
    JSON.stringify(theme),
    JSON.stringify(sections),
    JSON.stringify(layout),
    customDomain || null,
    sections.seo.title,
    sections.seo.description,
    req.site.id
  );

  // the Stripe key is write-only: stored encrypted, never sent back to the page
  if (b.stripe_key_remove === '1') db.prepare("UPDATE sites SET stripe_key_enc = '', stripe_key_hint = '' WHERE id = ?").run(req.site.id);
  else if (payments.validKey(b.stripe_key)) {
    const k = String(b.stripe_key).trim();
    db.prepare('UPDATE sites SET stripe_key_enc = ?, stripe_key_hint = ? WHERE id = ?').run(payments.encryptKey(k), payments.keyHint(k), req.site.id);
  }

  invalidateSiteCache(req.site);
  if (customDomain) cache.invalidatePrefix(`${customDomain}:`);

  if (wantsJson(req)) {
    return res.json({ ok: true, savedAt: new Date().toISOString(), ...undoCounts(req.site.id), extraPages: extraPageList({ sections, layout }).map(e => ({ slug: e.slug, title: e.title })), ...(mixSynced ? { mix: theme.mix } : {}) });
  }
  res.redirect(`/sites/${req.site.id}/edit?saved=1`);
});

// Undo / redo: move one step back or forward, keeping the current state on the other list
function stepUndo(req, res, from, to) {
  const id = req.site.id;
  const cur = db.prepare('SELECT name, theme, sections, layout FROM sites WHERE id = ?').get(id);
  let row;
  // skip saved steps that match the site as it is now (a save that changed nothing)
  while ((row = db.prepare('SELECT * FROM site_undo WHERE site_id = ? AND kind = ? ORDER BY id DESC LIMIT 1').get(id, from))) {
    db.prepare('DELETE FROM site_undo WHERE id = ?').run(row.id);
    if (!(row.name === cur.name && row.theme === cur.theme && row.sections === cur.sections && row.layout === cur.layout)) break;
  }
  if (!row) return res.json({ ok: false, error: from === 'undo' ? 'Nothing to undo' : 'Nothing to redo', ...undoCounts(id) });
  pushUndo(id, to);
  const sections = JSON.parse(row.sections);
  db.prepare(`UPDATE sites SET name = ?, theme = ?, sections = ?, layout = ?, seo_title = ?, seo_description = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(row.name || req.site.name, row.theme, row.sections, row.layout, (sections.seo && sections.seo.title) || '', (sections.seo && sections.seo.description) || '', id);
  lastAutosave.delete(id);
  invalidateSiteCache(req.site);
  res.json({ ok: true, ...undoCounts(id) });
}
app.post('/sites/:id/undo', requireAuth, loadOwnedSite, (req, res) => stepUndo(req, res, 'undo', 'redo'));
app.post('/sites/:id/redo', requireAuth, loadOwnedSite, (req, res) => stepUndo(req, res, 'redo', 'undo'));

// A video reel (hero card block): .mp4 or .webm, up to 60 MB, kept as it is
const uploadVideo = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, 'public', 'uploads')),
    filename: (req, file, cb) => cb(null, `${nanoid(12)}${file.mimetype === 'video/webm' ? '.webm' : '.mp4'}`)
  }),
  limits: { fileSize: 60 * 1024 * 1024 },
  fileFilter: (req, file, cb) => (/^video\/(mp4|webm)$/.test(file.mimetype) ? cb(null, true) : cb(new Error('Only .mp4 or .webm videos are allowed.')))
});
app.post('/sites/:id/upload-video', requireAuth, loadOwnedSite, (req, res) => {
  uploadVideo.single('video')(req, res, (err) => {
    if (err) return res.status(400).json({ ok: false, error: err.code === 'LIMIT_FILE_SIZE' ? 'That video is over 60 MB. Try a shorter clip.' : err.message });
    if (!req.file) return res.status(400).json({ ok: false, error: 'No file received.' });
    res.json({ ok: true, url: `/uploads/${req.file.filename}` });
  });
});
// Cut out the pet, person or thing in a photo (cutout.js), for the Photo that blends in block: one photo per call
const cutoutLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });
app.post('/sites/:id/cutout', requireAuth, loadOwnedSite, cutoutLimiter, express.json({ limit: '4kb' }), async (req, res) => {
  try { res.json({ ok: true, ...(await cutout.cutout(String((req.body || {}).url || '').trim())) }); }
  catch (e) { res.status(400).json({ ok: false, error: e.message || 'Could not cut out that photo.' }); }
});
app.post('/sites/:id/upload', requireAuth, loadOwnedSite, (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ ok: false, error: err.message });
    if (!req.file) return res.status(400).json({ ok: false, error: 'No file received.' });
    await optimizeUpload(req.file);
    res.json({ ok: true, url: `/uploads/${req.file.filename}` });
  });
});

// ---- publish history: preview and roll back to an earlier publish ----
function loadPublish(req, res, next) {
  const row = /^\d+$/.test(req.params.hid) ? db.prepare('SELECT * FROM publish_history WHERE id = ? AND site_id = ?').get(req.params.hid, req.site.id) : null;
  if (!row) return res.status(404).render('not-found');
  req.publish = row;
  next();
}
const HISTORY_MSG = { rollback: 'Rolled back. The site now shows that earlier version.', nlok: 'The matching Netlify deploy was made live again too.', nlfail: 'The content was rolled back, but Netlify could not restore its earlier deploy. Use "Publish again" on the Publish online page to update the Netlify copy.', nlskip: 'Netlify was not touched. Use "Publish again" on the Publish online page to update the Netlify copy.' };
app.get('/sites/:id/history', requireAuth, loadOwnedSite, (req, res) => {
  const rows = db.prepare('SELECT id, kind, deploy_id, label, created_at FROM publish_history WHERE site_id = ? ORDER BY id DESC').all(req.site.id);
  res.render('history', { site: req.site, rows, msgs: HISTORY_MSG, flash: ['rollback', 'nlok', 'nlfail', 'nlskip'].filter(k => str(req.query[k], 3) === '1'), canNetlify: netlify.isConfigured() && !!req.site.netlify_site_id });
});
function renderPublishPreview(req, res, page) {
  const p = req.publish;
  let site;
  try { site = hydrateSite({ ...req.site, id: 0, slug: 'preview', theme: p.theme, sections: p.sections, layout: p.layout, published: 0, custom_domain: null }); } catch { return res.status(404).render('not-found'); }
  renderSitePage(req, res, null, { site, page, basePath: `/sites/${req.site.id}/history/${p.id}/view`, preview: true, hideMotionBar: true, contactSent: false, contactError: false, cacheKey: null });
}
app.get('/sites/:id/history/:hid/view', requireAuth, loadOwnedSite, loadPublish, (req, res) => renderPublishPreview(req, res, 'home'));
app.get('/sites/:id/history/:hid/view/:page', requireAuth, loadOwnedSite, loadPublish, (req, res) => renderPublishPreview(req, res, req.params.page));
app.post('/sites/:id/history/:hid/rollback', requireAuth, loadOwnedSite, loadPublish, async (req, res) => {
  const site = req.site, p = req.publish;
  saveVersion(site.id, site.theme, site.sections, site.layout, 'Before rollback');
  let seo = { title: '', description: '' };
  try { const sc = JSON.parse(p.sections); seo = { title: (sc.seo && sc.seo.title) || '', description: (sc.seo && sc.seo.description) || '' }; } catch { /* keep blanks */ }
  db.prepare(`UPDATE sites SET theme = ?, sections = ?, layout = ?, seo_title = ?, seo_description = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(p.theme, p.sections, p.layout, seo.title, seo.description, site.id);
  invalidateSiteCache(site);
  let nl = 'nlskip';
  if (p.kind === 'netlify' && p.deploy_id && site.netlify_site_id && netlify.isConfigured()) {
    try { await netlify.restoreDeploy(site.netlify_site_id, p.deploy_id); nl = 'nlok'; db.prepare("UPDATE sites SET netlify_deployed_at = datetime('now') WHERE id = ?").run(site.id); } catch (err) { console.error('Netlify restore failed:', err.message); nl = 'nlfail'; }
  } else if (p.kind !== 'netlify') nl = '';
  const after = hydrateSite(db.prepare('SELECT * FROM sites WHERE id = ?').get(site.id));
  recordPublish({ ...site, theme: after.theme, sections: after.sections, layout: after.layout }, 'rollback', p.kind === 'netlify' && nl === 'nlok' ? p.deploy_id : '', `Rolled back to ${p.created_at}`);
  res.redirect(`/sites/${site.id}/history?rollback=1${nl ? '&' + nl + '=1' : ''}`);
});

// ---- pre-publish quality check (contrast, tap targets, images, fonts) ----
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
function renderHomeHtml(req, res, site) {
  return new Promise((resolve) => {
    const cap = Object.create(res);
    const timer = setTimeout(() => resolve(''), 8000);
    cap.send = (html) => { clearTimeout(timer); resolve(String(html)); return cap; };
    cap.status = () => cap;
    try {
      renderSitePage(req, cap, (err) => { clearTimeout(timer); resolve(''); void err; }, { site, page: 'home', basePath: `/sites/${site.id}/preview`, preview: true, contactSent: false, contactError: false, cacheKey: null });
    } catch { clearTimeout(timer); resolve(''); }
  });
}
async function runQuality(req, res, withScore) {
  const html = await renderHomeHtml(req, res, req.site);
  let sharpLib = null; try { sharpLib = require('sharp'); } catch { /* optional */ }
  const report = await quality.audit(req.site, { html, uploadsDir: UPLOADS_DIR, sharp: sharpLib });
  if (withScore) report.score = siteScore.score(req.site, html, report, { uploadsDir: UPLOADS_DIR });
  return report;
}
app.get('/sites/:id/quality', requireAuth, loadOwnedSite, async (req, res) => {
  const report = await runQuality(req, res, true);
  let hasSharp = true; try { require.resolve('sharp'); } catch { hasSharp = false; }
  res.render('quality', { site: req.site, report, hasSharp, gate: ['publish', 'hosting'].includes(req.query.gate) ? req.query.gate : '', done: str(req.query.done, 60) });
});
// One-click fixes. Each works on a copy of the site and reports what it changed; the fix list is always recomputed
// here, never trusted from the form. Returns a short word for the page's "done" note, or '' when nothing changed.
const QUALITY_FIXES = {
  async colors(site) {
    const report = await quality.audit(site, {});   // the color checks need only the theme
    const fix = report.items.map(i => i.fix).find(f => f && f.type === 'colors');
    if (!fix) return '';
    const theme = { ...site.theme };
    if (!quality.applyColorFix(theme, fix)) return '';
    site.theme = theme; return 'colors';
  },
  async images(site) {
    let sharpLib; try { sharpLib = require('sharp'); } catch { return ''; }
    const r = await quality.optimiseImages(site, { uploadsDir: UPLOADS_DIR, sharp: sharpLib });
    if (!r.count) return 'images0';
    site.theme = r.theme; site.sections = r.sections; return 'images' + r.count;
  },
  async motion(site) {
    if (app.locals.motionLib.resolveLevel(site.theme, site.sections.hero) !== 'showcase') return '';
    site.theme = { ...site.theme, motionLevel: 'premium' }; return 'motion';
  },
  async icons(site) {
    let sharpLib; try { sharpLib = require('sharp'); } catch { return ''; }
    if (site.theme.faviconUrl) return '';
    const buf = await brandKit.readLogo(site.theme.logoUrl, { uploadsDir: UPLOADS_DIR, safeFetch }); if (!buf) return '';
    try { const ic = await brandKit.makeIcons(buf, sharpLib, UPLOADS_DIR, site.id); site.theme = { ...site.theme, faviconUrl: ic.faviconUrl, touchIconUrl: ic.touchIconUrl }; return 'icons'; } catch { return ''; }
  },
  async share(site) {
    let sharpLib; try { sharpLib = require('sharp'); } catch { return ''; }
    if (site.sections.seo && site.sections.seo.shareImage) return '';
    const buf = await brandKit.readLogo(site.theme.logoUrl, { uploadsDir: UPLOADS_DIR, safeFetch }); if (!buf) return '';
    try {
      const url = await brandKit.makeShare(buf, sharpLib, { uploadsDir: UPLOADS_DIR, siteId: site.id, heroUrl: site.sections.hero && site.sections.hero.imageUrl, primary: site.theme.primaryColor, accent: site.theme.accentColor });
      site.sections = { ...site.sections, seo: { ...(site.sections.seo || {}), shareImage: url } }; return 'share';
    } catch { return ''; }
  }
};
app.post('/sites/:id/quality/fix', requireAuth, loadOwnedSite, async (req, res) => {
  const orig = req.site; const back = (q) => res.redirect(`/sites/${orig.id}/quality${q ? '?' + q : ''}`);
  let kinds;
  if (req.body.fix === 'all') {
    const report = await runQuality(req, res, true);
    kinds = report.score.fixes.filter(k => QUALITY_FIXES[k]);
  } else kinds = QUALITY_FIXES[req.body.fix] ? [req.body.fix] : [];
  if (!kinds.length) return back();
  const site = { ...orig, theme: { ...orig.theme }, sections: { ...orig.sections } };
  const done = [];
  for (const k of kinds) { const d = await QUALITY_FIXES[k](site); if (d) done.push(d); }
  const changed = done.filter(d => d !== 'images0');
  if (changed.length) {
    saveVersion(orig.id, orig.theme, orig.sections, orig.layout, `Before quality fix (${kinds.length > 1 ? 'all' : kinds[0]})`);
    db.prepare("UPDATE sites SET theme = ?, sections = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(site.theme), JSON.stringify(site.sections), orig.id);
    invalidateSiteCache(orig);
  }
  back(done.length ? 'done=' + done.join('.') : '');
});
// Publishing stops at the fix list when there are real errors; "Publish anyway" on that page sets force=1.
async function qualityGate(req, res, kind) {
  if (req.body.force === '1') return false;
  const report = await runQuality(req, res);
  if (report.ok) return false;
  res.redirect(`/sites/${req.site.id}/quality?gate=${kind}`);
  return true;
}

// "Use this style" from the preview switcher (owner only; value checked against the three presets)
app.post('/sites/:id/motion', requireAuth, loadOwnedSite, (req, res) => {
  const lib = app.locals.motionLib;
  if (lib.isValid(req.body.motionStyle) || lib.isLevel(req.body.motionLevel)) {
    saveVersion(req.site.id, req.site.theme, req.site.sections, req.site.layout, 'Before motion change');
    const patch = {};
    if (lib.isValid(req.body.motionStyle)) patch.motionStyle = req.body.motionStyle;
    if (lib.isLevel(req.body.motionLevel)) patch.motionLevel = req.body.motionLevel;
    db.prepare('UPDATE sites SET theme = ? WHERE id = ?').run(JSON.stringify({ ...req.site.theme, ...patch }), req.site.id);
    invalidateSiteCache(req.site);
  }
  res.redirect(`/sites/${req.site.id}/preview`);
});

app.post('/sites/:id/publish', requireAuth, loadOwnedSite, async (req, res) => {
  const publish = req.body.published === '1' ? 1 : 0;
  if (publish && await qualityGate(req, res, 'publish')) return;
  db.prepare('UPDATE sites SET published = ? WHERE id = ?').run(publish, req.site.id);
  if (publish) recordPublish(req.site, 'live');
  invalidateSiteCache(req.site);
  res.redirect(`/sites/${req.site.id}/edit`);
});

app.post('/sites/:id/refresh', requireAuth, loadOwnedSite, importLimiter, async (req, res) => {
  if (!req.site.source_url) {
    return res.redirect(`/sites/${req.site.id}/edit`);
  }
  try {
    saveVersion(req.site.id, req.site.theme, req.site.sections, req.site.layout, 'Before refresh');
    const scraped = await scrapeUrl(req.site.source_url);
    db.prepare(
      `UPDATE sites SET theme = ?, sections = ?, seo_title = ?, seo_description = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(
      JSON.stringify(scraped.theme),
      JSON.stringify(scraped.sections),
      scraped.sections.seo.title,
      scraped.sections.seo.description,
      req.site.id
    );
    invalidateSiteCache(req.site);
    res.redirect(`/sites/${req.site.id}/edit?refreshed=1`);
  } catch (err) {
    res.redirect(`/sites/${req.site.id}/edit`);
  }
});

app.post('/sites/:id/versions/:versionId/restore', requireAuth, loadOwnedSite, (req, res) => {
  const version = db.prepare('SELECT * FROM site_versions WHERE id = ? AND site_id = ?').get(req.params.versionId, req.site.id);
  if (version) {
    saveVersion(req.site.id, req.site.theme, req.site.sections, req.site.layout, 'Before restore');
    db.prepare(`UPDATE sites SET theme = ?, sections = ?, layout = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(version.theme, version.sections, version.layout, req.site.id);
    invalidateSiteCache(req.site);
  }
  res.redirect(`/sites/${req.site.id}/edit?saved=1`);
});

// Preview-only changes from the query string (nothing is saved): ?style= shows another style
// (&pal=1 with that style's own colors), ?mstyle= another motion style, ?lab= a Design lab mix, ?bar=0 hides the motion switcher,
// ?fx= Scroll Smoother and Split text settings (the Design lab's card, as JSON), ?mix= a Mix and match block list, ?bare=1 the page without its header and footer (block thumbnails).
function previewSite(req) {
  const q = req.query || {};
  const style = extraThemes.ALL_STYLES.includes(q.style) ? q.style : '';
  const mstyle = app.locals.motionLib.isValid(q.mstyle) ? q.mstyle : '';
  const lab = q.lab ? designLab.parse(q.lab) : null;
  let mix = null;
  const mixRaw = q.mix || (req.method === 'POST' && req.body && req.body.mix);   // the Blocks page posts long layouts
  if (mixRaw) { try { mix = mixPage.clean(JSON.parse(String(mixRaw).slice(0, 200000))); } catch (e) { mix = null; } }
  let fx = null;
  if (q.fx) { try { const o = JSON.parse(String(q.fx).slice(0, 2000)); fx = o && typeof o === 'object' ? keptMotion(req.site.theme, o) : null; } catch (e) { fx = null; } }
  if (!style && !mstyle && !lab && !fx && !(mix && mix.length)) return req.site;
  const theme = lab ? designLab.apply(req.site.theme, lab) : { ...req.site.theme };
  if (fx) Object.assign(theme, fx);
  if (style) Object.assign(theme, styleSwap(style, q.pal === '1'));
  if (style && styleLib.BLUEPRINT_IDS.includes(q.slbp)) theme.slBlueprint = q.slbp;
  if (mstyle) theme.motionStyle = mstyle;
  if (mix && mix.length) Object.assign(theme, { homeLayout: 'mix', mix });   // ?mix= a block list (the Blocks page)
  return { ...req.site, theme };
}
// what changes when a whole style is swapped in (Compare designs): the style's own home layout, no per-page styles
function styleSwap(style, ownColors) {
  const out = { style, homeLayout: '', homeFull: false, pageStyles: {} };
  const pal = extraThemes.byId[style] && extraThemes.byId[style].palette;
  if (ownColors && pal) Object.assign(out, { primaryColor: pal.primary, accentColor: pal.accent, bgColor: '' });
  return out;
}
const previewOpts = (req, extra) => ({
  site: previewSite(req), basePath: `/sites/${req.site.id}/preview`, preview: true, hideMotionBar: req.query.bar === '0', calm: req.query.calm === '1', bare: req.query.bare === '1',
  contactSent: false, contactError: false, cacheKey: null, ...extra
});

app.get('/sites/:id/preview', requireAuth, loadOwnedSite, (req, res) => {
  renderSitePage(req, res, null, previewOpts(req, { page: 'home' }));
});
// the same preview with a block list too long for the address (Blocks page arrangements); nothing is saved
app.post('/sites/:id/preview', requireAuth, loadOwnedSite, (req, res) => {
  renderSitePage(req, res, null, previewOpts(req, { page: 'home' }));
});

app.get('/sites/:id/preview/:page', requireAuth, loadOwnedSite, (req, res) => {
  renderSitePage(req, res, null, previewOpts(req, { page: req.params.page }));
});

app.get('/sites/:id/preview/:prefix/:item', requireAuth, loadOwnedSite, (req, res) => {
  if (!Object.prototype.hasOwnProperty.call(ITEM_ROUTES, req.params.prefix)) return res.status(404).render('not-found');
  renderSitePage(req, res, null, previewOpts(req, { page: ITEM_ROUTES[req.params.prefix], itemSlug: req.params.item }));
});

// Design tools: compare, Design lab, Style Library, Signature, Blocks screen, Brand kit, devices and share links (routes/design-tools.js)
const {
  adviceTemplateFor, keptMotion
} = require('./routes/design-tools')(app, {
  BLK_ID, BLK_KEY, ITEM_ROUTES, LIB_HERO_DESIGNS, UPLOADS_DIR, areasWithSlugs, atelier, brandKit, buildNavPages,
  clientLimiter, crypto, db, designLab, ensureBlockIds, extraThemes, filmFx, findTemplate, fonts, fs, getSite,
  heightFx, icons, imgFx, industryDesign, invalidateSiteCache, isSafeUrl, isValidHexColor, loadOwnedSite, mixHeroAt,
  mixPage, multer, nanoid, path, pinFx, renderSitePage, requireAuth, safeFetch, saveVersion, scrollFx,
  servicesWithSlugs, slPageLib, smoothScroll, splitText, str, styleLib, styleSwap, syncMixBlocks
});

// The published site, leads, bookings, reviews, reports, follow-ups, robots.txt and sitemap (routes/site-and-followup.js)
const {
  redirectFor, sendRedirect
} = require('./routes/site-and-followup')(app, {
  BOOKING_LIVE, ITEM_ROUTES, PAGE_KEYS, PORT, areasWithSlugs, billing, booking, calc, clientLimiter,
  contactLimiter, db, emailBooking, extraPageList, forms, handleContactSubmission, handleReviewSubmission,
  hydrateSite, invalidateSiteCache, isTestEnv, isValidEmail, leadsLib, legal, loadClientSite, loadOwnedSite, mailer,
  pageIsAvailable, payments, redirects, renderSitePage, reportContext, reports, requireAuth, reviewLimiter,
  reviewRequestLimiter, runPaymentSweep, saveVersion, servicesWithSlugs, str
});

// anything nothing else answered: a published site's own 404 page when the address
// belongs to a site (its custom domain, or /site/<name>/...), otherwise a plain one
app.use((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(404).render('not-found');
  const host = (req.hostname || '').toLowerCase();
  let row = null, basePath = '';
  if (host && host !== 'localhost') row = db.prepare('SELECT * FROM sites WHERE custom_domain = ? AND published = 1').get(host);
  if (!row) {
    const m = /^\/site\/([^/]+)(?:\/|$)/.exec(req.path);
    if (m) { row = db.prepare('SELECT * FROM sites WHERE slug = ? AND published = 1').get(m[1]); basePath = row ? `/site/${row.slug}` : ''; }
  }
  if (!row || billing.isSuspended(row)) return res.status(404).render('not-found');
  return siteNotFound(req, res, null, hydrateSite(row), basePath, false);
});

app.listen(PORT, () => {
  console.log(`Site generator running at http://localhost:${PORT}`);
});
