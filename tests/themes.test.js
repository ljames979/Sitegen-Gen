const test = require("node:test");
const assert = require("node:assert/strict");
test('noir is a registered dark style with a hint', () => {
  const t = require('../themes');
  assert.ok(t.ALL_STYLES.includes('noir')); assert.equal(t.byId.noir.dark, true);
  assert.ok(t.STYLE_HINTS.noir);
});

test('accents: cleanEmoji keeps only emoji and caps the count', () => {
  const { cleanEmoji } = require('../accents');
  assert.equal(cleanEmoji('🐾 ✂️ x 🦴<b>'), '🐾 ✂️ 🦴');
  assert.equal(cleanEmoji('plain text'), '');
  assert.equal(cleanEmoji('🐾🐾🐾🐾🐾🐾'), '🐾 🐾 🐾 🐾');
  assert.equal(cleanEmoji(null), '');
  assert.equal(cleanEmoji('👩‍👩‍👧 👍🏽'), '👩‍👩‍👧 👍🏽');
});
