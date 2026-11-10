const test = require('node:test');
const assert = require('node:assert');
const hf = require('../public/helpfold.js');

test('help notes: long ones show their first sentence and fold the rest; short ones stay whole', () => {
  assert.equal(hf.split('Short note.'), null);
  const long = 'Set Background (above) to "Gradient from the gallery" to use a gallery pick. ' + 'Style, angle and movement work with any gradient background. '.repeat(5);
  const [head, rest] = hf.split(long);
  assert.equal(head, 'Set Background (above) to "Gradient from the gallery" to use a gallery pick.');
  assert.match(rest, /^Style, angle/);
  assert.equal(hf.split('x'.repeat(400)), null, 'no sentence end: left whole');
});
