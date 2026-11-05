const cheerio = require('cheerio');
const dns = require('dns').promises;
const ipaddr = require('ipaddr.js');

const ICONY_HINTS = ['icon', 'sprite', 'spacer', 'pixel', 'avatar', 'favicon', 'badge', 'button'];
const FAKE_EMAIL_HINTS = ['example.com', 'sentry.io', 'wixpress.com', 'schema.org', 'w3.org', 'godaddy.com', 'yourdomain'];
const ALLOW_PRIVATE_HOSTS = process.env.ALLOW_PRIVATE_IMPORT_HOSTS === 'true';

// ---------- SSRF protection ----------
// Blocks imports that would make this server fetch internal/private
// infrastructure (localhost, cloud metadata IPs, RFC1918 ranges, etc.)
// masquerading as a "website". Checked on the initial host and on every
// redirect hop, since DNS/redirects can point anywhere after the first check.
async function assertPublicHost(hostname) {
  if (ALLOW_PRIVATE_HOSTS) return; // dev/test escape hatch only
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.localhost') || lower.endsWith('.local')) {
    throw new Error('That address points to a local/internal host, which cannot be imported.');
  }
  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error('Could not resolve that URL\'s address.');
  }
  for (const { address } of addresses) {
    let addr;
    try {
      addr = ipaddr.parse(address);
    } catch {
      continue;
    }
    const range = addr.range();
    if (range !== 'unicast') {
      throw new Error('That address points to a private or internal network, which cannot be imported.');
    }
  }
}

async function safeFetch(url, { maxRedirects = 5, timeoutMs = 12000 } = {}) {
  let current = url;
  for (let i = 0; i <= maxRedirects; i++) {
    const parsed = new URL(current);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Only http/https URLs can be imported.');
    }
    await assertPublicHost(parsed.hostname);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteGenImporter/1.0)' }
      });
    } catch (err) {
      throw new Error(`Could not reach that URL (${err.message || 'network error'}).`);
    } finally {
      clearTimeout(timeout);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('That URL redirected without a destination.');
      current = new URL(location, current).toString();
      continue;
    }
    return { response, finalUrl: current };
  }
  throw new Error('Too many redirects while fetching that URL.');
}

// ---------- extraction helpers ----------
function absolutize(base, maybeUrl) {
  if (!maybeUrl) return null;
  try {
    return new URL(maybeUrl, base).toString();
  } catch {
    return null;
  }
}

function cleanText(str) {
  return (str || '').replace(/\s+/g, ' ').trim();
}

function pickMeta($, names) {
  for (const name of names) {
    const val =
      $(`meta[property="${name}"]`).attr('content') ||
      $(`meta[name="${name}"]`).attr('content');
    if (val && cleanText(val)) return cleanText(val);
  }
  return null;
}

function extractHeadline($, title) {
  const h1 = cleanText($('h1').first().text());
  if (h1 && h1.length > 2 && h1.length < 120) return h1;
  return title || 'Welcome';
}

function extractAboutBody($) {
  let best = '';
  $('p').each((_, el) => {
    const $el = $(el);
    if ($el.parents('nav, header, footer, script, style').length) return;
    const text = cleanText($el.text());
    if (text.length > 80 && text.length > best.length && text.length < 1200) {
      best = text;
    }
  });
  return best;
}

function extractServices($) {
  const items = [];
  ['h2', 'h3'].forEach((sel) => {
    if (items.length >= 6) return;
    $(sel).each((_, el) => {
      if (items.length >= 6) return;
      const $el = $(el);
      if ($el.parents('nav, header, footer, script, style').length) return;
      const title = cleanText($el.text());
      if (!title || title.length < 3 || title.length > 60 || title.endsWith('?')) return;
      let description = '';
      const $next = $el.next('p');
      if ($next && $next.length) {
        description = cleanText($next.text()).slice(0, 200);
      } else {
        const $parentP = $el.parent().find('p').first();
        if ($parentP && $parentP.length) description = cleanText($parentP.text()).slice(0, 200);
      }
      if (title && !items.some(i => i.title.toLowerCase() === title.toLowerCase())) {
        items.push({ title, description });
      }
    });
  });
  return items.slice(0, 6);
}

function extractTestimonials($) {
  const items = [];
  $('blockquote').each((_, el) => {
    if (items.length >= 4) return;
    const $el = $(el);
    const quote = cleanText($el.text());
    if (!quote || quote.length < 15 || quote.length > 400) return;
    let author = cleanText($el.find('cite').first().text());
    if (!author) {
      const $next = $el.next();
      const nextText = cleanText($next.text());
      if (nextText && nextText.length < 60) author = nextText;
    }
    items.push({ quote, author: author || '' });
  });
  return items;
}

function extractFAQ($) {
  const items = [];
  ['h2', 'h3', 'h4', 'dt'].forEach((sel) => {
    if (items.length >= 6) return;
    $(sel).each((_, el) => {
      if (items.length >= 6) return;
      const $el = $(el);
      const question = cleanText($el.text());
      if (!question || !question.endsWith('?') || question.length > 150) return;
      let answer = '';
      const $ddSibling = sel === 'dt' ? $el.next('dd') : $el.next('p');
      if ($ddSibling && $ddSibling.length) answer = cleanText($ddSibling.text()).slice(0, 300);
      if (question && !items.some(i => i.question === question)) {
        items.push({ question, answer });
      }
    });
  });
  return items;
}

function extractGalleryImages($, baseUrl, excludeUrls) {
  const seen = new Set();
  const images = [];
  $('img').each((_, el) => {
    if (images.length >= 8) return;
    const $el = $(el);
    const src = $el.attr('src') || $el.attr('data-src');
    if (!src) return;
    const abs = absolutize(baseUrl, src);
    if (!abs) return;
    const lower = abs.toLowerCase();
    if (ICONY_HINTS.some(hint => lower.includes(hint))) return;
    if (excludeUrls.includes(abs)) return;
    const w = parseInt($el.attr('width') || '0', 10);
    const h = parseInt($el.attr('height') || '0', 10);
    if ((w && w < 80) || (h && h < 80)) return;
    if (seen.has(abs)) return;
    seen.add(abs);
    images.push(abs);
  });
  return images;
}

function extractLogo($, baseUrl) {
  let logo = null;
  const candidates = $('header img, nav img, [class*="logo"] img, img[class*="logo"], img[id*="logo"], img[alt*="logo" i]');
  candidates.each((_, el) => {
    if (logo) return;
    const src = $(el).attr('src') || $(el).attr('data-src');
    const abs = absolutize(baseUrl, src);
    if (abs) logo = abs;
  });
  return logo;
}

function extractEmail($, bodyText) {
  const mailto = $('a[href^="mailto:"]').first().attr('href');
  if (mailto) {
    const addr = mailto.replace('mailto:', '').split('?')[0].trim();
    if (addr) return addr;
  }
  const match = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (match) {
    const found = match[0];
    if (!FAKE_EMAIL_HINTS.some(hint => found.includes(hint))) return found;
  }
  return '';
}

function extractPhone($, bodyText) {
  const telLink = $('a[href^="tel:"]').first().attr('href');
  if (telLink) {
    const num = telLink.replace('tel:', '').trim();
    if (num) return num;
  }
  const match = bodyText.match(/(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/);
  return match ? match[0].trim() : '';
}

function extractAddress($) {
  const addr = $('address').first();
  if (addr && addr.length) {
    const text = cleanText(addr.text());
    if (text) return text.slice(0, 160);
  }
  return '';
}

function pickThemeColor($) {
  const candidates = [
    $('meta[name="theme-color"]').attr('content'),
    $('meta[name="msapplication-TileColor"]').attr('content'),
    $('meta[property="og:theme-color"]').attr('content')
  ];
  for (const c of candidates) {
    if (c && /^#[0-9a-f]{3,6}$/i.test(c.trim())) return c.trim();
  }
  return null;
}

function parseFromHtml(html, baseUrl) {
  const $ = cheerio.load(html);

  const title = cleanText($('title').first().text());
  const siteName = pickMeta($, ['og:site_name']) || title.split(/[-|–]/)[0].trim() || 'My Site';
  const metaDescription = pickMeta($, ['og:description', 'description', 'twitter:description']);
  const ogImage = absolutize(baseUrl, pickMeta($, ['og:image', 'twitter:image']));
  const themeColor = pickThemeColor($);
  const logoUrl = extractLogo($, baseUrl);

  const bodyText = cleanText($('body').text());

  const headline = extractHeadline($, title);
  let subheadline = metaDescription;
  if (!subheadline) {
    const firstP = extractAboutBody($);
    subheadline = firstP ? firstP.slice(0, 140) : '';
  }

  const aboutBody = extractAboutBody($) || metaDescription || '';
  const services = extractServices($);
  const testimonials = extractTestimonials($);
  const faq = extractFAQ($);
  const exclude = [ogImage, logoUrl].filter(Boolean);
  const gallery = extractGalleryImages($, baseUrl, exclude);
  const email = extractEmail($, bodyText);
  const phone = extractPhone($, bodyText);
  const address = extractAddress($);

  return {
    signalStrength: bodyText.length + services.length * 40 + ($('h1,h2,h3').length * 10),
    name: siteName.slice(0, 80) || 'My Site',
    theme: {
      primaryColor: themeColor || '#2563eb',
      accentColor: '#1e293b',
      font: 'Inter, system-ui, sans-serif',
      style: 'modern',
      logoUrl: logoUrl || ''
    },
    sections: {
      hero: {
        headline: headline.slice(0, 100),
        subheadline: cleanText(subheadline).slice(0, 160),
        imageUrl: ogImage || '',
        ctaText: 'Get in touch',
        ctaLink: '#contact'
      },
      about: {
        heading: 'About Us',
        body: aboutBody.slice(0, 800) || 'Tell visitors who you are and what makes your business great.',
        imageUrl: gallery[0] || ''
      },
      services: {
        heading: 'What We Offer',
        items: services.length ? services : [
          { title: 'Service One', description: 'Describe this service.' },
          { title: 'Service Two', description: 'Describe this service.' },
          { title: 'Service Three', description: 'Describe this service.' }
        ]
      },
      testimonials: {
        heading: 'What Our Customers Say',
        items: testimonials
      },
      gallery: {
        heading: 'Gallery',
        images: gallery
      },
      faq: {
        heading: 'Frequently Asked Questions',
        items: faq.length ? faq : [
          { question: 'What areas do you serve?', answer: 'Update this with your service area.' }
        ]
      },
      hours: {
        heading: 'Hours',
        items: [
          { day: 'Monday', time: '9:00 AM – 5:00 PM' },
          { day: 'Tuesday', time: '9:00 AM – 5:00 PM' },
          { day: 'Wednesday', time: '9:00 AM – 5:00 PM' },
          { day: 'Thursday', time: '9:00 AM – 5:00 PM' },
          { day: 'Friday', time: '9:00 AM – 5:00 PM' },
          { day: 'Saturday', time: 'Closed' },
          { day: 'Sunday', time: 'Closed' }
        ]
      },
      whyChoose: {
        heading: 'Why Choose Us',
        items: []
      },
      contact: {
        heading: 'Contact Us',
        email,
        phone,
        address,
        social: { facebook: '', instagram: '', twitter: '' },
        acceptSubmissions: true
      },
      seo: {
        title: title.slice(0, 70) || siteName,
        description: (metaDescription || subheadline || '').slice(0, 160)
      }
    },
    meta: {
      servicesFound: services.length,
      imagesFound: gallery.length,
      testimonialsFound: testimonials.length,
      faqFound: faq.length
    }
  };
}

// Optional: if the `playwright` package is installed (npm install playwright
// && npx playwright install chromium), it's used as a fallback for sites
// that render their content with JavaScript, where a plain fetch of the
// initial HTML comes back mostly empty. This keeps the base install light —
// most old business sites are plain server-rendered HTML and never need it.
async function renderWithPlaywright(url) {
  let playwright;
  try {
    playwright = require('playwright');
  } catch {
    return null; // not installed — silently skip the fallback
  }
  const browser = await playwright.chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    return await page.content();
  } finally {
    await browser.close();
  }
}

async function scrapeUrl(rawUrl) {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  // validates protocol/host up front for a clean error before any fetch
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('That doesn\'t look like a valid URL.');
  }
  await assertPublicHost(parsed.hostname);

  const { response, finalUrl } = await safeFetch(url);

  if (!response.ok) {
    throw new Error(`That URL responded with status ${response.status}.`);
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    throw new Error('That URL does not appear to be a webpage (not HTML).');
  }

  const html = await response.text();
  let result = parseFromHtml(html, finalUrl);

  // Sparse result (likely a JS-rendered app shell) — try Playwright if available.
  if (result.signalStrength < 200) {
    try {
      const rendered = await renderWithPlaywright(finalUrl);
      if (rendered) {
        const richer = parseFromHtml(rendered, finalUrl);
        if (richer.signalStrength > result.signalStrength) result = richer;
      }
    } catch {
      // fall back silently to the plain-fetch result
    }
  }

  delete result.signalStrength;
  result.sourceUrl = finalUrl;
  return result;
}

module.exports = {
  scrapeUrl,
  assertPublicHost,
  safeFetch,
  absolutize,
  cleanText,
  pickMeta,
  pickThemeColor
};
