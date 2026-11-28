// AI-made photos for the "generate a site" feature, made to order for each business instead of searched for.
// Needs FAL_KEY in .env (https://fal.ai, pay per image). The model is FLUX.2 [pro]; a photo costs about 3 to 5 cents.
//
// How a site's photos are made:
//   1. shot specs: one written brief per photo (hero, about, gallery), from the business type, the template's photo
//      subjects and the site's colors. With ANTHROPIC_API_KEY, Claude writes the briefs; without it, built-in ones.
//   2. each brief is rendered as 2 versions when Claude can judge them (ANTHROPIC_API_KEY), otherwise 1.
//   3. Claude looks at both versions and keeps the better one, then writes its alt text.
//   4. the kept photo is saved into public/uploads (as WebP when the optional "sharp" package is installed).
// Everything fails soft: with no key, or if a call errors or times out, callers get null and use stock photos.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ai = require('./ai');

const MODEL = 'fal-ai/flux-2-pro';
const falUrl = () => (process.env.FAL_API_URL || 'https://fal.run') + '/' + MODEL;

const hasAiPhotos = () => Boolean(process.env.FAL_KEY) && process.env.PHOTO_SOURCE !== 'stock';
const galleryCount = (wanted) => {
  const n = parseInt(process.env.AI_PHOTO_GALLERY, 10);
  return Math.min(wanted, Number.isFinite(n) && n >= 0 ? n : 4);
};

const SIZES = { hero: { width: 1920, height: 1080 }, about: { width: 1600, height: 1200 }, gallery: { width: 1600, height: 1200 } };
const STYLE = 'Natural, candid editorial photography, realistic light and texture, shot on a full-frame camera. '
  + 'No text, no lettering, no signage, no logos, no brand names, no watermarks.';
const ROLE = {
  hero: 'Wide establishing photo for a website hero banner. Keep the left half calm and uncluttered, softly out of focus, so a headline can sit over it. 35mm lens.',
  about: 'Warm, human photo of the people behind the business at work, unposed, friendly, natural daylight. 50mm lens, shallow depth of field.',
  gallery: 'Detail photo of the work itself, close and well lit, with breathing room around the subject. 50mm lens.'
};

const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

// The built-in briefs: one hero, one about, then gallery photos cycling through the template's photo subjects.
function shotSpecs({ businessType, queries = [], colors = {}, gallery = 4 }) {
  const what = clip(businessType, 80) || clip(queries[0], 80) || 'a small local business';
  const palette = [colors.primary, colors.accent].filter(c => /^#[0-9a-f]{6}$/i.test(c || ''));
  const tone = palette.length ? ` Colour grade gently towards ${palette.join(' and ')} where it looks natural.` : '';
  const subjects = queries.length ? queries.map(q => clip(q, 80)) : [what];
  const specs = [
    { role: 'hero', subject: `the setting of ${what}, ${subjects[0]}` },
    { role: 'about', subject: `people running ${what}, ${subjects[subjects.length > 1 ? 1 : 0]}` }
  ];
  for (let i = 0; i < gallery; i++) specs.push({ role: 'gallery', subject: `${subjects[i % subjects.length]}, for ${what}` });
  return specs.map(s => ({ ...s, ...SIZES[s.role], prompt: `${ROLE[s.role]} Subject: ${s.subject}.${tone} ${STYLE}` }));
}

// Claude rewrites the built-in briefs into specific, vivid ones (same roles and sizes). Keeps the built-in ones on failure.
async function refineSpecs(specs, { businessType, name }) {
  if (!ai.hasAiProvider()) return specs;
  const text = await ai.complete({
    system: 'You write shot briefs for a photo generator making website photos for a small local business. '
      + 'Each brief is one paragraph (60 to 110 words): the scene, subject, light, lens and mood, concrete and plausible for this kind of business. '
      + 'Keep each brief\'s purpose and layout notes. Never ask for text, signs, logos, brand names or labelled packaging; say "plain, unlabelled" for bags, sacks or boxes. '
      + 'People look like ordinary local staff, diverse and natural. Output only a JSON array of strings, one per brief, in the same order.',
    prompt: `Business: ${clip(name, 80) || 'unnamed'} (${clip(businessType, 80)})\n\nBriefs to rewrite:\n${specs.map((s, i) => `${i + 1}. [${s.role}] ${s.prompt}`).join('\n')}`,
    maxTokens: 2500
  });
  try {
    const arr = JSON.parse(String(text || '').replace(/^[^[]*/, '').replace(/[^\]]*$/, ''));
    if (!Array.isArray(arr) || arr.length !== specs.length) return specs;
    return specs.map((s, i) => (typeof arr[i] === 'string' && arr[i].length > 40 ? { ...s, prompt: clip(arr[i], 1500) + ' ' + STYLE } : s));
  } catch { return specs; }
}

// One render. Returns a Buffer (JPEG) or null. sync_mode asks fal to send the image back inline rather than as a link,
// so nothing else needs to be reachable.
async function render(spec, seed) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const res = await fetch(falUrl(), {
      method: 'POST',
      headers: { Authorization: `Key ${process.env.FAL_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: spec.prompt, image_size: { width: spec.width, height: spec.height }, seed, output_format: 'jpeg', safety_tolerance: '2', sync_mode: true }),
      signal: controller.signal
    });
    if (!res.ok) { console.error('AI photo failed:', res.status, clip(await res.text().catch(() => ''), 200)); return null; }
    const data = await res.json();
    const url = data && data.images && data.images[0] && data.images[0].url;
    if (!url) return null;
    if (url.startsWith('data:')) return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    if (!/^https:\/\/[a-z0-9.-]+\.fal\.media\//.test(url)) return null;   // only fal's own file host
    const img = await fetch(url, { signal: controller.signal });
    return img.ok ? Buffer.from(await img.arrayBuffer()) : null;
  } catch (err) {
    console.error('AI photo failed:', err.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Claude compares the versions of one brief and keeps the better one, and writes alt text. Without a key: the first one.
async function pick(spec, bufs) {
  const fallback = { index: 0, alt: '' };
  if (bufs.length < 2 || !ai.hasAiProvider()) return fallback;
  const content = [];
  bufs.forEach((b, i) => {
    content.push({ type: 'text', text: `Version ${i + 1}:` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b.toString('base64') } });
  });
  content.push({ type: 'text', text: `These are versions of one website photo. The brief was:\n${spec.prompt}\n\n`
    + 'Pick the version a careful photo editor would publish: realistic people and hands, no garbled text or lettering, no warped objects, '
    + 'fits the brief and its layout notes. Reply with JSON only: {"pick": <version number>, "alt": "<plain alt text, under 120 characters>"}' });
  const text = await ai.complete({ system: 'You are a picture editor choosing website photos.', content, maxTokens: 200 });
  try {
    const j = JSON.parse(String(text || '').replace(/^[^{]*/, '').replace(/[^}]*$/, ''));
    const index = Math.round(Number(j.pick)) - 1;
    return { index: index >= 0 && index < bufs.length ? index : 0, alt: clip(j.alt, 160) };
  } catch { return fallback; }
}

// Saves a photo into the uploads folder: WebP when sharp is there, otherwise the JPEG as it came. Returns its /uploads/ address.
async function save(buf, uploadsDir) {
  let sharp = null; try { sharp = require('sharp'); } catch { sharp = null; }
  const id = 'ai-' + crypto.randomBytes(9).toString('base64url').replace(/[^A-Za-z0-9]/g, 'x');
  fs.mkdirSync(uploadsDir, { recursive: true });
  if (sharp) {
    try { await sharp(buf).webp({ quality: 82 }).toFile(path.join(uploadsDir, id + '.webp')); return `/uploads/${id}.webp`; } catch { /* keep the JPEG */ }
  }
  fs.writeFileSync(path.join(uploadsDir, id + '.jpg'), buf);
  return `/uploads/${id}.jpg`;
}

// One finished photo for one brief: render the versions, pick, save. Returns { url, alt, role } or null.
async function makePhoto(spec, { uploadsDir, versions }) {
  const seeds = Array.from({ length: versions }, () => crypto.randomInt(1, 2 ** 31 - 1));
  const bufs = (await Promise.all(seeds.map(s => render(spec, s)))).filter(Boolean);
  if (!bufs.length) return null;
  const choice = await pick(spec, bufs);
  return { url: await save(bufs[choice.index], uploadsDir), alt: choice.alt, role: spec.role, ai: true };
}

// The same shape as photos.fetchPhotoSet: { hero, gallery } with gallery[0] used by About. null if nothing could be made,
// so the caller can fall back to stock photos.
async function makePhotoSet({ businessType, name, queries, colors, galleryCount: wanted = 6, uploadsDir }) {
  if (!hasAiPhotos()) return null;
  const versions = ai.hasAiProvider() ? 2 : 1;
  const specs = await refineSpecs(shotSpecs({ businessType, queries, colors, gallery: Math.max(0, galleryCount(wanted) - 1) }), { businessType, name });
  const made = await Promise.all(specs.map(s => makePhoto(s, { uploadsDir, versions })));
  const hero = made[0] || null;
  const gallery = made.slice(1).filter(Boolean);   // about first, then the gallery photos
  return hero || gallery.length ? { hero, gallery } : null;
}

module.exports = { hasAiPhotos, shotSpecs, refineSpecs, render, pick, save, makePhoto, makePhotoSet, MODEL };
