// Photographer credits for Unsplash photos. A credit is saved when a photo is picked in the editor and shown in the
// published site's footer only while the site still uses that photo (matched on the photo's address without its
// size settings, so a resized copy still counts).
const { UNSPLASH_UTM } = require('./photos');

const baseOf = u => String(u || '').split('?')[0];

function record(db, siteId, photo) {
  db.prepare(`INSERT INTO photo_credits (site_id, source, photo_id, url, name, profile_url) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (site_id, source, photo_id) DO UPDATE SET url = excluded.url, name = excluded.name, profile_url = excluded.profile_url`)
    .run(siteId, photo.source || 'unsplash', photo.id, photo.url, photo.photographer || '', photo.photographerUrl || '');
}

// The credits a page should show: [{ name, href }], each photographer once, plus the link to Unsplash
function forSite(db, site) {
  if (!site || !site.id) return null;
  const rows = db.prepare('SELECT * FROM photo_credits WHERE site_id = ? ORDER BY id').all(site.id);
  if (!rows.length) return null;
  const text = JSON.stringify(site.sections || {});
  const seen = new Set(), people = [];
  rows.forEach(r => {
    if (!r.url || !text.includes(baseOf(r.url))) return;
    const key = r.name + '|' + r.profile_url;
    if (seen.has(key)) return; seen.add(key);
    people.push({ name: r.name || 'Unsplash photographer', href: /^https:\/\/unsplash\.com\//.test(r.profile_url) ? r.profile_url : '' });
  });
  return people.length ? { people, unsplashHref: `https://unsplash.com/?${UNSPLASH_UTM}` } : null;
}

module.exports = { record, forSite, baseOf };
