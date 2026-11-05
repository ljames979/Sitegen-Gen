// Tiny in-memory render cache for published public pages, keyed by slug
// (or custom domain). Avoids hitting SQLite + re-rendering EJS on every
// visitor request for pages that change rarely. Invalidated explicitly
// whenever a site is saved, published, unpublished, or deleted — never
// relies on TTL alone for correctness, TTL is just a safety net.
const store = new Map();
const TTL_MS = 5 * 60 * 1000;

function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) {
    store.delete(key);
    return null;
  }
  return entry.html;
}

function set(key, html) {
  store.set(key, { html, ts: Date.now() });
}

function invalidate(...keys) {
  for (const key of keys) {
    if (key) store.delete(key);
  }
}

// Deletes every cached entry whose key starts with `prefix` — used to clear
// all of a multi-page site's cached pages ("slug:home", "slug:about", …) in
// one call instead of needing to know every page key in advance.
function invalidatePrefix(prefix) {
  if (!prefix) return;
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

function clear() {
  store.clear();
}

module.exports = { get, set, invalidate, invalidatePrefix, clear };
