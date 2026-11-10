// Publishing to Netlify: one click sends the finished site (plain HTML files) to a Netlify site, and the
// owner can attach a custom domain with automatic HTTPS. Everything talks to Netlify's documented REST API
// with a personal access token kept in the NETLIFY_AUTH_TOKEN environment variable (never stored in the
// database, never shown on a page). NETLIFY_API_URL exists so tests can use a fake server.

const DEFAULT_API = 'https://api.netlify.com/api/v1';
const apiBase = () => (process.env.NETLIFY_API_URL || DEFAULT_API).replace(/\/+$/, '');

function isConfigured() { return Boolean(process.env.NETLIFY_AUTH_TOKEN); }

class NetlifyError extends Error {
  constructor(message, status) { super(message); this.status = status || 0; }
}

async function call(method, path, { json, body, headers, timeoutMs = 60000 } = {}) {
  if (!isConfigured()) throw new NetlifyError('Netlify is not connected yet. Add NETLIFY_AUTH_TOKEN to the .env file.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(apiBase() + path, {
      method,
      headers: { Authorization: `Bearer ${process.env.NETLIFY_AUTH_TOKEN}`, ...(json ? { 'Content-Type': 'application/json' } : {}), ...(headers || {}) },
      body: json ? JSON.stringify(json) : body,
      signal: controller.signal
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* not json */ }
    if (!res.ok) {
      const detail = data && (data.message || data.error) ? String(data.message || data.error).slice(0, 200) : '';
      if (res.status === 401) throw new NetlifyError('Netlify did not accept the access token. Create a new one and update NETLIFY_AUTH_TOKEN.', 401);
      if (res.status === 429) throw new NetlifyError('Netlify says too many deploys right now (limit: 3 per minute). Wait a minute and try again.', 429);
      throw new NetlifyError(`Netlify said no${detail ? ': ' + detail : ''} (HTTP ${res.status}).`, res.status);
    }
    return data;
  } catch (err) {
    if (err instanceof NetlifyError) throw err;
    throw new NetlifyError(err.name === 'AbortError' ? 'Netlify took too long to answer. Try again in a minute.' : 'Could not reach Netlify: ' + err.message);
  } finally {
    clearTimeout(timer);
  }
}

// site names are global on netlify.app, so add a short random ending
function siteName(slug, attempt) {
  const base = String(slug || 'site').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'site';
  const rnd = Math.random().toString(36).slice(2, 2 + 5);
  return attempt === 0 ? `${base}-${rnd}` : `${base}-${rnd}${attempt}`;
}

async function createSite(slug) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const s = await call('POST', '/sites', { json: { name: siteName(slug, attempt) } });
      return { id: s.id, name: s.name, url: s.ssl_url || s.url || `https://${s.name}.netlify.app` };
    } catch (e) { last = e; if (e.status !== 422 && e.status !== 409) throw e; } // name taken: try another
  }
  throw last;
}

// raw zip body, as Netlify documents for zip deploys
async function deployZip(siteId, zipBuffer) {
  const d = await call('POST', `/sites/${encodeURIComponent(siteId)}/deploys`, { headers: { 'Content-Type': 'application/zip' }, body: zipBuffer, timeoutMs: 120000 });
  return { id: d && d.id, state: d && d.state };
}

// make an earlier deploy the live one again (Netlify keeps every deploy)
async function restoreDeploy(siteId, deployId) {
  const d = await call('POST', `/sites/${encodeURIComponent(siteId)}/deploys/${encodeURIComponent(deployId)}/restore`, { json: {} });
  return { id: d && d.id, state: d && d.state };
}

async function getDeploy(deployId) {
  const d = await call('GET', `/deploys/${encodeURIComponent(deployId)}`);
  return { id: d.id, state: d.state, error: d.error_message || '' };
}

// waits until Netlify finishes processing the zip (usually a few seconds)
async function waitForDeploy(deployId, { tries = 20, delayMs = 1500 } = {}) {
  let state = '';
  for (let i = 0; i < tries; i++) {
    const d = await getDeploy(deployId);
    state = d.state;
    if (state === 'ready') return { ok: true, state };
    if (state === 'error') return { ok: false, state, error: d.error || 'Netlify could not process the files.' };
    await new Promise(r => setTimeout(r, delayMs));
  }
  return { ok: false, state, error: 'Netlify is still working on it. Check back in a minute.', pending: true };
}

async function getSite(siteId) {
  const s = await call('GET', `/sites/${encodeURIComponent(siteId)}`);
  return { id: s.id, name: s.name, url: s.ssl_url || s.url, customDomain: s.custom_domain || '', ssl: Boolean(s.ssl), sslUrl: s.ssl_url || '' };
}

async function setCustomDomain(siteId, domain) {
  await call('PATCH', `/sites/${encodeURIComponent(siteId)}`, { json: { custom_domain: domain } });
}

async function clearCustomDomain(siteId) {
  await call('PATCH', `/sites/${encodeURIComponent(siteId)}`, { json: { custom_domain: null } });
}

// asks Netlify for the free HTTPS certificate; it only works once the domain's DNS points at Netlify
async function provisionSsl(siteId) {
  await call('POST', `/sites/${encodeURIComponent(siteId)}/ssl`, {});
}

// emails the owner when someone fills in the contact form on the hosted site
async function createFormEmailHook(siteId, formName, email) {
  await call('POST', '/hooks', { json: { site_id: siteId, form_name: formName, type: 'email', event: 'submission_created', data: { email } } });
}

// the newest contact-form messages sent to the hosted copy (Netlify Forms keeps them; SiteGen copies them into Leads)
async function listSubmissions(siteId, { perPage = 100 } = {}) {
  const d = await call('GET', `/sites/${encodeURIComponent(siteId)}/submissions?per_page=${Math.min(100, Math.max(1, perPage))}`, { timeoutMs: 20000 });
  return Array.isArray(d) ? d : [];
}

// "Example.com", "https://www.example.com/" -> "example.com" / "www.example.com"; '' when it is not a real domain
function cleanDomain(input) {
  let d = String(input || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '').replace(/\.$/, '');
  if (d.length > 253 || !/^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d)) return '';
  if (d.endsWith('.netlify.app')) return '';
  return d;
}

// the DNS records the owner (or the client's domain provider) has to create
function dnsInstructions(domain, netlifySubdomain) {
  const d = cleanDomain(domain);
  if (!d) return [];
  const target = `${netlifySubdomain}.netlify.app`;
  const parts = d.split('.');
  const isWww = parts[0] === 'www' && parts.length >= 3;
  const isApex = parts.length === 2 || (parts.length === 3 && ['co', 'com', 'org', 'net'].includes(parts[1]) && parts[2].length === 2);
  if (isApex) {
    return [
      { type: 'A', host: '@', value: '75.2.60.5', note: 'For the bare domain. If your provider offers ALIAS/ANAME, point @ to apex-loadbalancer.netlify.com instead.' },
      { type: 'CNAME', host: 'www', value: target, note: 'So www.' + d + ' works too.' }
    ];
  }
  const out = [{ type: 'CNAME', host: parts.slice(0, parts.length - 2).join('.'), value: target, note: '' }];
  if (isWww) out.push({ type: 'A', host: '@', value: '75.2.60.5', note: 'So ' + parts.slice(1).join('.') + ' (without www) also works.' });
  return out;
}

module.exports = { isConfigured, NetlifyError, createSite, deployZip, restoreDeploy, getDeploy, waitForDeploy, getSite, setCustomDomain, clearCustomDomain, provisionSsl, createFormEmailHook, listSubmissions, cleanDomain, dnsInstructions, siteName };
