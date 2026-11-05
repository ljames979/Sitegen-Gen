// Helpers for local-SEO pages and tracking IDs. Pure functions, shared by the
// server and the page template.

function slugify(text) {
  return String(text || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
}

// Services with a URL-safe, unique slug each ("Roof Repair" -> roof-repair).
// Slugs come from the title, so they stay stable until the title is edited.
function servicesWithSlugs(items) {
  const seen = new Set();
  const out = [];
  for (const it of items || []) {
    if (!it || !it.title) continue;
    const base = slugify(it.title) || 'service';
    let slug = base, n = 2;
    while (seen.has(slug)) slug = `${base}-${n++}`;
    seen.add(slug);
    out.push({ ...it, slug });
  }
  return out;
}

// "Orlando, FL" -> { locality: 'Orlando', region: 'FL' }
function parseCity(city) {
  const parts = String(city || '').split(',').map(s => s.trim()).filter(Boolean);
  return { locality: parts[0] || '', region: parts[1] || '' };
}

// Google Analytics 4 / Google tag IDs look like G-ABC123XYZ; Meta pixel IDs are digits.
function cleanGaId(v) {
  const s = String(v || '').trim().toUpperCase();
  return /^(G|GT|AW)-[A-Z0-9]{4,20}$/.test(s) ? s : '';
}
function cleanPixelId(v) {
  const s = String(v || '').trim();
  return /^\d{8,20}$/.test(s) ? s : '';
}

// Service-area names with a slug and the owner's text for each town's page.
function areasWithSlugs(names, textMap) {
  const seen = new Set();
  const out = [];
  for (const name of names || []) {
    const base = slugify(name) || 'area';
    let slug = base, n = 2;
    while (seen.has(slug)) slug = `${base}-${n++}`;
    seen.add(slug);
    out.push({ name, slug, text: (textMap && textMap[name]) || '' });
  }
  return out;
}

module.exports = { slugify, areasWithSlugs, servicesWithSlugs, parseCity, cleanGaId, cleanPixelId };
