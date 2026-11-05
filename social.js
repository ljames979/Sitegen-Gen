const cheerio = require('cheerio');
const { safeFetch, absolutize, cleanText, pickMeta, pickThemeColor } = require('./scraper');
const { isSafeUrl, isValidHexColor } = require('./validate');

// Images that show up in og:image on a lot of pages but are never useful —
// generic platform logos, favicons, share-card fallbacks.
const GENERIC_IMAGE_HINTS = [
  'favicon', 'default_profile', 'placeholder', '/static/images/ico',
  'og-image-default', 'og_default', 'sprite'
];

function platformFromHost(hostname) {
  const h = (hostname || '').toLowerCase();
  if (h.includes('facebook.com')) return 'facebook';
  if (h.includes('instagram.com')) return 'instagram';
  if (h.includes('google.com') || h.includes('g.page') || h.includes('goo.gl')) return 'google';
  if (h.includes('linkedin.com')) return 'linkedin';
  return 'other';
}

const PLATFORM_LABEL = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  google: 'Google Business Profile',
  linkedin: 'LinkedIn',
  other: 'that page'
};

// Best-effort "inspiration" pull from a social/business profile link: a name,
// a short bio, a brand color if declared, and any real (non-generic) images
// the page exposes without logging in. Facebook and Instagram both block most
// content from logged-out requests, so this often comes back thin — it never
// throws, so it can be safely layered on top of the main generate/import flow
// without risking the site creation itself.
async function scrapeSocialInspiration(rawUrl) {
  const input = (rawUrl || '').trim();
  if (!input) return null;

  let url = input;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { platform: 'other', error: 'That doesn\'t look like a valid link.' };
  }

  const platform = platformFromHost(parsed.hostname);

  try {
    const { response, finalUrl } = await safeFetch(url, { timeoutMs: 10000 });
    if (!response.ok) {
      return { platform, error: `That link responded with status ${response.status}.` };
    }
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return { platform, error: 'That link does not appear to be a webpage.' };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const name = pickMeta($, ['og:title', 'twitter:title']) || cleanText($('title').first().text()) || '';
    const bio = pickMeta($, ['og:description', 'description', 'twitter:description']) || '';
    const themeColor = pickThemeColor($);

    const images = [];
    $('meta[property="og:image"], meta[property="og:image:url"], meta[property="og:image:secure_url"], meta[name="twitter:image"]')
      .each((_, el) => {
        const src = $(el).attr('content');
        const abs = absolutize(finalUrl, src);
        if (!abs) return;
        const lower = abs.toLowerCase();
        if (GENERIC_IMAGE_HINTS.some(hint => lower.includes(hint))) return;
        if (!images.includes(abs)) images.push(abs);
      });

    if (!name && !bio && images.length === 0) {
      return {
        platform,
        error: null,
        note: `Couldn't pull anything usable from ${PLATFORM_LABEL[platform]} — it likely blocked the request since we're not logged in.`,
        name: '', bio: '', themeColor: null, images: []
      };
    }

    return { platform, error: null, note: null, name, bio, themeColor, images: images.slice(0, 8) };
  } catch (err) {
    return { platform, error: err.message || 'Could not fetch that link.' };
  }
}

// Layers a best-effort social-profile scrape onto an already-built theme/sections
// object, filling gaps rather than clobbering real content. Mutates in place.
// `preferOverHero` (used by "generate a site", where the existing hero image is
// just a generic stock photo) lets a real social photo replace it outright;
// the importer instead only fills the hero if the source site had none at all.
function applySocialInspiration(theme, sections, social, { preferOverHero = false } = {}) {
  if (!social || social.error || !Array.isArray(social.images)) return;

  const images = social.images.filter(isSafeUrl);
  if (images.length) {
    if (preferOverHero || !sections.hero.imageUrl) {
      sections.hero.imageUrl = images[0];
      sections.gallery.images = Array.from(new Set([...images.slice(1), ...sections.gallery.images])).slice(0, 20);
    } else {
      sections.gallery.images = Array.from(new Set([...sections.gallery.images, ...images])).slice(0, 20);
    }
  }

  // '#2563eb' is this app's own fallback blue, used whenever nothing better
  // was detected — safe to treat as "no real brand color yet" and override.
  if (social.themeColor && isValidHexColor(social.themeColor) &&
      (theme.primaryColor === '#2563eb' || preferOverHero)) {
    theme.primaryColor = social.themeColor;
  }
}

module.exports = { scrapeSocialInspiration, applySocialInspiration, platformFromHost };
