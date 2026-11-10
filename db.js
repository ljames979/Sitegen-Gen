const Database = require('better-sqlite3');
const path = require('path');

// DB_PATH lets the test suite (and any other tooling) point at an isolated
// database file instead of the real one used by `npm start`.
const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'sitegen.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  theme TEXT NOT NULL DEFAULT '{}',
  sections TEXT NOT NULL DEFAULT '{}',
  layout TEXT NOT NULL DEFAULT '{}',
  source_url TEXT DEFAULT '',
  custom_domain TEXT,
  seo_title TEXT DEFAULT '',
  seo_description TEXT DEFAULT '',
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS contact_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL,
  name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  message TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (site_id) REFERENCES sites(id)
);

-- blocks a user saved once and can drop into any of their sites
CREATE TABLE IF NOT EXISTS block_library (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  block TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_block_library_user ON block_library(user_id);

-- cookie-free counts of what visitors did (tapped call, email, text ...), per site and day
CREATE TABLE IF NOT EXISTS page_events (
  site_id INTEGER NOT NULL,
  day TEXT NOT NULL,
  event TEXT NOT NULL,
  path TEXT NOT NULL DEFAULT '',
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (site_id, day, event, path)
);

-- one shareable "edit your website" link per site; only a hash of the secret
-- token is stored, so a database leak doesn't reveal working links
-- cookie-free page view counts: one row per site, day and page
CREATE TABLE IF NOT EXISTS page_views (
  site_id INTEGER NOT NULL,
  day TEXT NOT NULL,
  path TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (site_id, day, path)
);

-- which monthly report emails have already gone out
CREATE TABLE IF NOT EXISTS report_log (
  site_id INTEGER NOT NULL,
  period TEXT NOT NULL,
  sent_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (site_id, period)
);

-- customer-written reviews waiting for the owner's approval
CREATE TABLE IF NOT EXISTS review_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL,
  name TEXT DEFAULT '',
  rating INTEGER NOT NULL DEFAULT 5,
  quote TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (site_id) REFERENCES sites(id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_site_id ON review_submissions(site_id);

-- online booking requests / appointments (times are the business's local wall-clock time)
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  service TEXT NOT NULL DEFAULT '',
  addons TEXT NOT NULL DEFAULT '[]',
  start_at TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 60,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (site_id) REFERENCES sites(id)
);
CREATE INDEX IF NOT EXISTS idx_bookings_site_start ON bookings(site_id, start_at);

CREATE TABLE IF NOT EXISTS client_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL UNIQUE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now')),
  last_used_at TEXT,
  FOREIGN KEY (site_id) REFERENCES sites(id)
);

CREATE TABLE IF NOT EXISTS share_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now')),
  views INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TEXT,
  FOREIGN KEY (site_id) REFERENCES sites(id)
);

CREATE TABLE IF NOT EXISTS client_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL DEFAULT '',
  invite_hash TEXT,
  invite_expires TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  last_login_at TEXT,
  UNIQUE (site_id, email),
  FOREIGN KEY (site_id) REFERENCES sites(id)
);

CREATE TABLE IF NOT EXISTS followup_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  site_id INTEGER NOT NULL,
  step INTEGER NOT NULL,
  due_at TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  sent_at TEXT,
  canceled INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_followup_due ON followup_queue(due_at);

CREATE TABLE IF NOT EXISTS google_reviews_cache (
  site_id INTEGER PRIMARY KEY,
  fetched_at TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  error TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS chat_usage (
  site_id INTEGER NOT NULL,
  day TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (site_id, day)
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'invoice',
  ref_id INTEGER,
  description TEXT NOT NULL DEFAULT '',
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  customer_name TEXT NOT NULL DEFAULT '',
  customer_email TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  stripe_session_id TEXT NOT NULL DEFAULT '',
  stripe_session_url TEXT NOT NULL DEFAULT '',
  paid_via TEXT NOT NULL DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  paid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_site ON payments(site_id, id);

CREATE TABLE IF NOT EXISTS site_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  theme TEXT NOT NULL,
  sections TEXT NOT NULL,
  copy_source TEXT NOT NULL DEFAULT 'template',
  created_at TEXT DEFAULT (datetime('now'))
);

-- photographer credits for stock photos picked from Unsplash (shown in the published site's footer while used)
CREATE TABLE IF NOT EXISTS photo_credits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'unsplash',
  photo_id TEXT NOT NULL,
  url TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  profile_url TEXT NOT NULL DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (site_id, source, photo_id)
);

CREATE TABLE IF NOT EXISTS intake_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT '',
  closed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS intake_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new',
  site_id INTEGER,
  todo TEXT NOT NULL DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_intake_sub_user ON intake_submissions(user_id);

CREATE TABLE IF NOT EXISTS site_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL,
  theme TEXT NOT NULL,
  sections TEXT NOT NULL,
  layout TEXT NOT NULL DEFAULT '{}',
  label TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (site_id) REFERENCES sites(id)
);
CREATE TABLE IF NOT EXISTS site_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  reset_hash TEXT NOT NULL DEFAULT '',
  reset_expires TEXT NOT NULL DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  last_login_at TEXT NOT NULL DEFAULT '',
  UNIQUE (site_id, email),
  FOREIGN KEY (site_id) REFERENCES sites(id)
);
CREATE TABLE IF NOT EXISTS publish_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'live',
  theme TEXT NOT NULL,
  sections TEXT NOT NULL,
  layout TEXT NOT NULL DEFAULT '{}',
  deploy_id TEXT NOT NULL DEFAULT '',
  label TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (site_id) REFERENCES sites(id)
);
`);

// --- lightweight migrations for columns added after initial release,
// so an existing sitegen.db from an older version keeps working ---
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn('sites', 'billing_required', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('sites', 'billing_status', "TEXT NOT NULL DEFAULT 'none'");
ensureColumn('sites', 'billing_email', "TEXT DEFAULT ''");
ensureColumn('sites', 'stripe_customer_id', "TEXT DEFAULT ''");
ensureColumn('sites', 'stripe_subscription_id', "TEXT DEFAULT ''");
ensureColumn('sites', 'past_due_since', 'TEXT');
ensureColumn('contact_submissions', 'status', "TEXT NOT NULL DEFAULT 'new'");
// questionnaires uploaded as a PDF: a hidden per-owner link holds them, and the original PDF is kept beside the database
ensureColumn('intake_links', 'kind', "TEXT NOT NULL DEFAULT ''");
ensureColumn('intake_submissions', 'source', "TEXT NOT NULL DEFAULT ''");
ensureColumn('intake_submissions', 'pdf_file', "TEXT NOT NULL DEFAULT ''");
ensureColumn('contact_submissions', 'notes', "TEXT DEFAULT ''");
ensureColumn('contact_submissions', 'service', "TEXT DEFAULT ''");
ensureColumn('contact_submissions', 'answers', "TEXT DEFAULT ''");
ensureColumn('contact_submissions', 'follow_up_at', "TEXT DEFAULT ''");
ensureColumn('contact_submissions', 'reminded_on', "TEXT DEFAULT ''");
ensureColumn('contact_submissions', 'optout_token', "TEXT DEFAULT ''");
ensureColumn('contact_submissions', 'opted_out', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('contact_submissions', 'source', "TEXT DEFAULT 'form'");
ensureColumn('sites', 'layout', "TEXT NOT NULL DEFAULT '{}'");
ensureColumn('sites', 'source_url', "TEXT DEFAULT ''");
ensureColumn('sites', 'custom_domain', 'TEXT');
ensureColumn('sites', 'stripe_key_enc', "TEXT DEFAULT ''");
ensureColumn('sites', 'stripe_key_hint', "TEXT DEFAULT ''");
ensureColumn('sites', 'netlify_site_id', "TEXT DEFAULT ''");
ensureColumn('sites', 'netlify_name', "TEXT DEFAULT ''");
ensureColumn('sites', 'netlify_url', "TEXT DEFAULT ''");
ensureColumn('sites', 'netlify_domain', "TEXT DEFAULT ''");
ensureColumn('sites', 'netlify_deployed_at', "TEXT DEFAULT ''");
ensureColumn('sites', 'netlify_ssl', 'INTEGER DEFAULT 0');
ensureColumn('sites', 'seo_title', "TEXT DEFAULT ''");
ensureColumn('sites', 'seo_description', "TEXT DEFAULT ''");

// reusable brand kits (logo, colors, fonts, button shape, browser icon), owned by the SiteGen user
db.exec(`
CREATE TABLE IF NOT EXISTS brand_kits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_brand_kits_user ON brand_kits(user_id);
`);

// undo / redo in the editor: the site as it was before each change (newest 50 per site and direction)
db.exec(`
CREATE TABLE IF NOT EXISTS site_undo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'undo',
  name TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL,
  sections TEXT NOT NULL,
  layout TEXT NOT NULL DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (site_id) REFERENCES sites(id)
);
CREATE INDEX IF NOT EXISTS idx_site_undo_site ON site_undo(site_id, kind);
`);

// Mix and match: saved blocks and page recipes (block lists), owned by the SiteGen user and usable on any site
db.exec(`
CREATE TABLE IF NOT EXISTS mix_saved (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  spec TEXT NOT NULL DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_mix_saved_user ON mix_saved(user_id);

-- the SiteGen user's own settings that belong to no one site (packages.js: Pitch packages and the demo gallery)
CREATE TABLE IF NOT EXISTS user_prefs (
  user_id INTEGER PRIMARY KEY,
  data TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- notes a client types on the private preview link (/look/:token): what they want changed, and where
CREATE TABLE IF NOT EXISTS share_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL,
  page TEXT NOT NULL DEFAULT '',
  spot TEXT NOT NULL DEFAULT '',
  x REAL,
  y REAL,
  name TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  seen INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (site_id) REFERENCES sites(id)
);
`);

// indexes created after columns are guaranteed to exist
db.exec(`
CREATE INDEX IF NOT EXISTS idx_sites_user_id ON sites(user_id);
CREATE INDEX IF NOT EXISTS idx_sites_custom_domain ON sites(custom_domain);
CREATE INDEX IF NOT EXISTS idx_versions_site_id ON site_versions(site_id);
CREATE INDEX IF NOT EXISTS idx_submissions_site_id ON contact_submissions(site_id);
CREATE INDEX IF NOT EXISTS idx_share_feedback_site ON share_feedback(site_id);
`);

module.exports = db;
