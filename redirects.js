// Redirects for rebuilt sites: when a client moves from an old website, their
// old addresses (/about-us.html, /old-blog/…) should send visitors and Google
// to the new pages instead of a dead end.
const MAX = 100;

// "/About-Us.html/" -> "/about-us.html"; anything that is not a path -> ''
function normPath(p) {
  let s = String(p == null ? '' : p).trim();
  if (!s) return '';
  s = s.replace(/[?#].*$/, '');
  if (!s.startsWith('/') || s.startsWith('//')) return '';
  s = s.toLowerCase().replace(/\/{2,}/g, '/');
  if (s.length > 1) s = s.replace(/\/+$/, (m, off, whole) => (whole.endsWith('/*') ? m : ''));
  return s.slice(0, 200);
}

function cleanTarget(t) {
  const s = String(t == null ? '' : t).trim().slice(0, 500);
  if (/^https?:\/\/[^\s]+$/i.test(s)) return s;
  if (s.startsWith('/') && !s.startsWith('//') && !/\s/.test(s)) return s;
  return '';
}

// rows: [{ from, to, code }] (from the editor's parallel arrays or saved data)
function clean(rows) {
  const out = [];
  const seen = new Set();
  for (const r of Array.isArray(rows) ? rows : []) {
    const from = normPath(r && r.from), to = cleanTarget(r && r.to);
    if (!from || !to || from === '/' || seen.has(from)) continue;
    if (to.startsWith('/') && normPath(to) === from) continue; // would loop on itself
    seen.add(from);
    out.push({ from, to, code: String(r.code) === '302' ? 302 : 301 });
    if (out.length >= MAX) break;
  }
  return out;
}

function fromBody(b) {
  const col = (k) => (b[k] == null ? [] : Array.isArray(b[k]) ? b[k] : [b[k]]);
  const froms = col('rd_from'), tos = col('rd_to'), codes = col('rd_code');
  return clean(froms.map((from, i) => ({ from, to: tos[i], code: codes[i] })));
}

// Where should this request path go? null when no rule applies.
// Exact paths win over "/old/*" prefix rules; a "*" in the target is replaced
// by whatever the prefix rule matched.
function find(rows, pathname) {
  const p = normPath(pathname);
  if (!p) return null;
  const list = Array.isArray(rows) ? rows : [];
  const exact = list.find(r => r.from === p);
  if (exact) return { to: exact.to, code: exact.code };
  let best = null;
  for (const r of list) {
    if (!r.from.endsWith('/*')) continue;
    const prefix = r.from.slice(0, -1); // keeps the trailing slash
    if (p.startsWith(prefix) || p === prefix.slice(0, -1)) {
      if (!best || prefix.length > best.prefix.length) best = { r, prefix };
    }
  }
  if (!best) return null;
  const rest = p.slice(best.prefix.length);
  let to = best.r.to.includes('*') ? best.r.to.replace('*', rest) : best.r.to;
  if (!rest && to.length > 1 && to.endsWith('/') && best.r.to.includes('*')) to = to.slice(0, -1);
  return { to, code: best.r.code };
}

module.exports = { normPath, cleanTarget, clean, fromBody, find, MAX };
